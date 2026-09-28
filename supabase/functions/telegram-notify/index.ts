import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MAX_TEXT = 3500;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Only signed-in members may post to the club group. The anon key alone is not
    // enough — it is public, so accepting it would let anyone spam the chat.
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: auth } = token ? await admin.auth.getUser(token) : { data: { user: null } };
    const user = auth?.user;
    if (!user) return json({ error: "Sign in required" }, 401);

    const { message, photoUrl, caption, bookingId } = await req.json();

    if (!message && !photoUrl) return json({ error: "message or photoUrl is required" }, 400);
    if ((message && String(message).length > MAX_TEXT) || (caption && String(caption).length > 1024)) {
      return json({ error: "Message too long" }, 400);
    }

    const { data: me } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
    const isAdmin = me?.role === "admin";

    // Receipt photos: must be a signed link to our own receipts bucket, and the
    // booking must belong to the caller (admins may post for anyone).
    if (photoUrl) {
      const receiptsPrefix = `${supabaseUrl}/storage/v1/object/sign/payment-receipts/`;
      if (!String(photoUrl).startsWith(receiptsPrefix)) return json({ error: "Invalid photo" }, 400);
    }
    if (bookingId) {
      const { data: booking } = await admin.from("bookings").select("user_id").eq("id", bookingId).maybeSingle();
      if (!booking) return json({ error: "Booking not found" }, 404);
      if (!isAdmin && booking.user_id !== user.id) return json({ error: "Not your booking" }, 403);
    }

    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const chatId = Deno.env.get("TELEGRAM_CHAT_ID");

    // Falls back to logging only until TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID secrets are set.
    if (!botToken || !chatId) {
      console.log("[Telegram Notify] Not configured, logging only:", { user: user.id, bookingId, timestamp: new Date().toISOString() });
      return json({ success: true, message: "Notification logged (Telegram not configured)" });
    }

    const endpoint = photoUrl ? "sendPhoto" : "sendMessage";
    // Approve/Reject buttons let the admin action a payment receipt straight from the
    // Telegram chat via the telegram-webhook function, without opening the admin panel.
    const replyMarkup = photoUrl && bookingId
      ? {
          inline_keyboard: [[
            { text: "✅ Approve", callback_data: `appr:${bookingId}` },
            { text: "❌ Reject", callback_data: `rej:${bookingId}` },
          ]],
        }
      : undefined;
    const payload = photoUrl
      ? { chat_id: chatId, photo: photoUrl, caption: caption || message || undefined, reply_markup: replyMarkup }
      : { chat_id: chatId, text: message };

    const res = await fetch(`https://api.telegram.org/bot${botToken}/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json();

    if (!res.ok || !body.ok) {
      console.error("[Telegram Notify] Request failed:", res.status, body);
      return json({ error: "Failed to send Telegram message", detail: body.description || body }, 502);
    }

    return json({ success: true, message: "Telegram notification sent" });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
