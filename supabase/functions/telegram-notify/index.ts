import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { message, photoUrl, caption, bookingId } = await req.json();

    if (!message && !photoUrl) {
      return new Response(
        JSON.stringify({ error: "message or photoUrl is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const chatId = Deno.env.get("TELEGRAM_CHAT_ID");

    // Falls back to logging only until TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID secrets are set.
    if (!botToken || !chatId) {
      console.log("[Telegram Notify] Not configured, logging only:", { message, photoUrl, caption, bookingId, timestamp: new Date().toISOString() });
      return new Response(
        JSON.stringify({ success: true, message: "Notification logged (Telegram not configured)" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
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
      return new Response(
        JSON.stringify({ error: "Failed to send Telegram message", detail: body.description || body }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "Telegram notification sent" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
