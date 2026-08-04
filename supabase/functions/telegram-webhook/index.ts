import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Telegram-Bot-Api-Secret-Token",
};

interface TelegramMessage {
  chat: { id: number };
  message_id: number;
  text?: string;
  caption?: string;
  photo?: unknown[];
}

interface TelegramCallbackQuery {
  id: string;
  data?: string;
  from?: { first_name?: string };
  message?: TelegramMessage;
}

interface BookingRow {
  id: string;
  booking_reference: string;
  booking_status: string;
  is_guest: boolean;
  guest_name: string | null;
  total_amount: number;
  created_at: string;
  booking_group_id: string | null;
  session: { title: string; session_date: string } | null;
  profile: { full_name: string; short_name: string | null } | null;
}

const STATUS_EMOJI: Record<string, string> = {
  "Confirmed": "✅",
  "Pending Payment": "🕒",
  "Cancelled by Player": "❌",
  "Cancelled by Admin": "❌",
  "Completed": "🏐",
  "No Show": "🚫",
  "Refunded": "💸",
};

function escapeHtml(input: string): string {
  return input.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const webhookSecret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");
  const configuredChatId = Deno.env.get("TELEGRAM_CHAT_ID");

  // Telegram sends this header on every webhook call when a secret_token was set via
  // setWebhook — without it, anyone who finds this URL could fake button presses and
  // confirm/cancel bookings.
  if (!webhookSecret || req.headers.get("X-Telegram-Bot-Api-Secret-Token") !== webhookSecret) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }
  if (!botToken) {
    return new Response("Bot not configured", { status: 500, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  async function sendMessage(chatId: number, text: string) {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
  }

  async function sendConfirmCard(chatId: number, row: BookingRow, partySize: number) {
    const name = row.is_guest ? row.guest_name ?? "Guest" : row.profile?.short_name || row.profile?.full_name || "Player";
    const sessionLine = row.session ? `${row.session.title} — ${row.session.session_date}` : "Unknown session";
    const partyNote = partySize > 1 ? ` (+${partySize - 1} more)` : "";
    const waitingHrs = Math.max(0, Math.round((Date.now() - new Date(row.created_at).getTime()) / 3_600_000));
    const text = `👤 <b>${escapeHtml(name)}</b>${escapeHtml(partyNote)}\n${escapeHtml(sessionLine)}\nRef: ${row.booking_reference} · RM${Number(row.total_amount).toFixed(2)}\nWaiting: ${waitingHrs}h`;

    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[
            { text: "✅ Confirm", callback_data: `appr:${row.id}` },
            { text: "❌ Reject", callback_data: `rej:${row.id}` },
          ]],
        },
      }),
    });
  }

  async function handlePendingCommand(chatId: number) {
    const { data, error } = await supabase
      .from("bookings")
      .select("id, booking_reference, booking_status, is_guest, guest_name, total_amount, created_at, booking_group_id, session:sessions(title, session_date), profile:profiles(full_name, short_name)")
      .eq("booking_status", "Pending Payment")
      .order("created_at", { ascending: true })
      .limit(50);

    if (error || !data || data.length === 0) {
      await sendMessage(chatId, "✅ No pending bookings right now — all caught up!");
      return;
    }

    const rows = data as unknown as BookingRow[];
    const seenGroups = new Set<string>();
    const cards: BookingRow[] = [];
    for (const row of rows) {
      if (row.booking_group_id) {
        if (seenGroups.has(row.booking_group_id)) continue;
        seenGroups.add(row.booking_group_id);
      }
      cards.push(row);
    }

    await sendMessage(chatId, `🕒 <b>${cards.length} booking${cards.length > 1 ? "s" : ""} awaiting confirmation</b>`);

    for (const row of cards.slice(0, 20)) {
      const partySize = row.booking_group_id ? rows.filter((r) => r.booking_group_id === row.booking_group_id).length : 1;
      await sendConfirmCard(chatId, row, partySize);
    }
  }

  // Read-only recent-activity feed across every status — distinct from /pending, which
  // only surfaces bookings that still need an approve/reject decision.
  async function handleListCommand(chatId: number) {
    const { data, error } = await supabase
      .from("bookings")
      .select("id, booking_reference, booking_status, is_guest, guest_name, total_amount, created_at, booking_group_id, session:sessions(title, session_date), profile:profiles(full_name, short_name)")
      .order("created_at", { ascending: false })
      .limit(15);

    if (error || !data || data.length === 0) {
      await sendMessage(chatId, "No bookings yet.");
      return;
    }

    const rows = data as unknown as BookingRow[];
    const lines = rows.map((row, i) => {
      const name = row.is_guest ? row.guest_name ?? "Guest" : row.profile?.short_name || row.profile?.full_name || "Player";
      const emoji = STATUS_EMOJI[row.booking_status] ?? "•";
      const sessionTitle = row.session?.title ?? "Unknown session";
      return `${i + 1}. ${emoji} <b>${escapeHtml(name)}</b> — ${escapeHtml(sessionTitle)} — RM${Number(row.total_amount).toFixed(2)} — ${escapeHtml(row.booking_status)}`;
    });

    await sendMessage(chatId, `📋 <b>Latest ${rows.length} bookings</b>\n\n${lines.join("\n")}`);
  }

  const update = await req.json();

  // Bot commands (e.g. "/pending" or "/pending@YourBotName" in a group) arrive as
  // regular messages, not callback_query.
  if (update.message?.text) {
    const msg = update.message as TelegramMessage;
    if (!configuredChatId || String(msg.chat.id) !== configuredChatId) {
      return new Response("ok", { status: 200, headers: corsHeaders });
    }
    const command = msg.text.trim().split(/[\s@]/)[0].toLowerCase();
    if (command === "/pending") {
      await handlePendingCommand(msg.chat.id);
    } else if (command === "/list") {
      await handleListCommand(msg.chat.id);
    }
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  const callback: TelegramCallbackQuery | undefined = update.callback_query;

  // Telegram expects a 200 for any update type it sends, even ones we ignore, or it
  // will keep retrying delivery.
  if (!callback?.data) {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
  if (!configuredChatId || String(callback.message?.chat.id) !== configuredChatId) {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  const [action, bookingId] = callback.data.split(":");
  if ((action !== "appr" && action !== "rej") || !bookingId) {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  async function answerCallback(text: string) {
    await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callback!.id, text }),
    });
  }

  // Works for both receipt-photo cards (caption) and /pending list cards (text).
  async function editMessage(newText: string) {
    const msg = callback!.message;
    if (!msg) return;
    const isPhoto = Array.isArray(msg.photo);
    const body: Record<string, unknown> = {
      chat_id: msg.chat.id,
      message_id: msg.message_id,
      reply_markup: { inline_keyboard: [] },
    };
    if (isPhoto) {
      body.caption = newText;
    } else {
      body.text = newText;
      body.parse_mode = "HTML";
    }
    await fetch(`https://api.telegram.org/bot${botToken}/${isPhoto ? "editMessageCaption" : "editMessageText"}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  const { data: booking, error: fetchError } = await supabase
    .from("bookings")
    .select("id, booking_status, payment_status, total_amount, booking_group_id")
    .eq("id", bookingId)
    .maybeSingle();

  if (fetchError || !booking) {
    await answerCallback("Booking not found");
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (booking.payment_status === "Paid" || String(booking.booking_status).includes("Cancelled")) {
    await answerCallback("Already processed");
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  // Companion bookings share a booking_group_id — one decision covers the whole party,
  // so approving/rejecting must apply to every booking in the group, not just this row.
  const party = booking.booking_group_id
    ? ((await supabase.from("bookings").select("id, total_amount").eq("booking_group_id", booking.booking_group_id)).data ?? [booking])
    : [booking];

  const actorName = callback.from?.first_name ?? "Admin";
  const originalText = callback.message?.caption ?? callback.message?.text ?? "";

  if (action === "appr") {
    for (const b of party) {
      await supabase.from("payments").insert({
        booking_id: b.id,
        payment_provider: "manual",
        payment_method: "DuitNow QR",
        amount: b.total_amount,
        payment_status: "Paid",
        transaction_reference: "TG-" + Date.now(),
        paid_at: new Date().toISOString(),
      });
    }
    await supabase.from("bookings")
      .update({ booking_status: "Confirmed", payment_status: "Paid" })
      .in("id", party.map((b) => b.id));

    await answerCallback("Approved ✅");
    await editMessage(`${originalText}\n\n✅ Approved by ${escapeHtml(actorName)}`);
  } else {
    await supabase.from("bookings")
      .update({ booking_status: "Cancelled by Admin", payment_status: "Failed", cancelled_at: new Date().toISOString() })
      .in("id", party.map((b) => b.id));

    await answerCallback("Rejected ❌");
    await editMessage(`${originalText}\n\n❌ Rejected by ${escapeHtml(actorName)}`);
  }

  return new Response("ok", { status: 200, headers: corsHeaders });
});
