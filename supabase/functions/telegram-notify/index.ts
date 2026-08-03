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
    const { message } = await req.json();

    if (!message) {
      return new Response(
        JSON.stringify({ error: "Message is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const chatId = Deno.env.get("TELEGRAM_CHAT_ID");

    // Falls back to logging only until TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID secrets are set.
    if (!botToken || !chatId) {
      console.log("[Telegram Notify] Not configured, logging only:", { message, timestamp: new Date().toISOString() });
      return new Response(
        JSON.stringify({ success: true, message: "Notification logged (Telegram not configured)" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message }),
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
