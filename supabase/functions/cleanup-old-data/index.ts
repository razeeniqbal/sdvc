import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Scheduled data-retention cleanup — not called from the app itself. Meant to be
// invoked on a daily schedule via Supabase's Cron Jobs (Dashboard → Database → Cron
// Jobs → New cron job → target this function). See the deployment notes for the SQL
// that wires that up, since it needs the project's service role key which isn't
// committed to the repo.
//
// Three independent passes, each with its own retention window:
//   1. Receipt images for sessions >30 days old — the image is only useful for a
//      short payment-verification window; the payment record itself (amount, status,
//      reference) is untouched and stays forever.
//   2. In-app notifications >30 days old — no lasting value once read.
//   3. Sessions >1 year old — cascades to their bookings, payments, attendance,
//      waiting_list, and session_passkeys rows via existing FK ON DELETE CASCADE.
//      This is real financial/attendance history; the 1-year window was a deliberate,
//      informed choice (not a safe default) — see the conversation this was built in.
//
// Order matters: receipts are cleared out first so that when step 3 later deletes
// year-old sessions, there's no orphaned file left behind in storage with no DB row
// pointing at it anymore.

const RECEIPTS_BUCKET = "payment-receipts";
const RECEIPT_RETENTION_DAYS = 30;
const NOTIFICATION_RETENTION_DAYS = 30;
const SESSION_RETENTION_DAYS = 365;

function daysAgoDateString(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

function daysAgoTimestamp(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const result = {
    receiptsRemoved: 0,
    notificationsDeleted: 0,
    sessionsDeleted: 0,
    errors: [] as string[],
  };

  // 1. Receipt images for old sessions
  try {
    const receiptCutoff = daysAgoDateString(RECEIPT_RETENTION_DAYS);
    const { data: oldSessions, error: oldSessionsError } = await supabase
      .from("sessions")
      .select("id")
      .lt("session_date", receiptCutoff);
    if (oldSessionsError) throw oldSessionsError;

    const oldSessionIds = (oldSessions ?? []).map((s: { id: string }) => s.id);
    if (oldSessionIds.length > 0) {
      const { data: bookingsWithReceipts, error: bookingsError } = await supabase
        .from("bookings")
        .select("id, receipt_path")
        .in("session_id", oldSessionIds)
        .not("receipt_path", "is", null);
      if (bookingsError) throw bookingsError;

      const rows = (bookingsWithReceipts ?? []) as { id: string; receipt_path: string }[];
      const paths = rows.map((r) => r.receipt_path);
      if (paths.length > 0) {
        const { error: removeError } = await supabase.storage.from(RECEIPTS_BUCKET).remove(paths);
        if (removeError) throw removeError;

        const { error: clearError } = await supabase
          .from("bookings")
          .update({ receipt_path: null, receipt_uploaded_at: null })
          .in("id", rows.map((r) => r.id));
        if (clearError) throw clearError;

        result.receiptsRemoved = paths.length;
      }
    }
  } catch (err) {
    result.errors.push(`receipts: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 2. Old notifications
  try {
    const notifCutoff = daysAgoTimestamp(NOTIFICATION_RETENTION_DAYS);
    const { error, count } = await supabase
      .from("notifications")
      .delete({ count: "exact" })
      .lt("created_at", notifCutoff);
    if (error) throw error;
    result.notificationsDeleted = count ?? 0;
  } catch (err) {
    result.errors.push(`notifications: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 3. Old sessions (cascades to bookings/payments/attendance/waiting_list/session_passkeys)
  try {
    const sessionCutoff = daysAgoDateString(SESSION_RETENTION_DAYS);
    const { error, count } = await supabase
      .from("sessions")
      .delete({ count: "exact" })
      .lt("session_date", sessionCutoff);
    if (error) throw error;
    result.sessionsDeleted = count ?? 0;
  } catch (err) {
    result.errors.push(`sessions: ${err instanceof Error ? err.message : String(err)}`);
  }

  return new Response(JSON.stringify(result), {
    status: result.errors.length > 0 ? 500 : 200,
    headers: { "Content-Type": "application/json" },
  });
});
