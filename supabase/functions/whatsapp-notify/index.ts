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
    const { message, phone } = await req.json();

    if (!message) {
      return new Response(
        JSON.stringify({ error: "Message is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const callMeBotPhone = phone || Deno.env.get("CALLMEBOT_PHONE");
    const callMeBotApiKey = Deno.env.get("CALLMEBOT_APIKEY");

    // Falls back to logging only until CALLMEBOT_PHONE / CALLMEBOT_APIKEY secrets are set.
    if (!callMeBotPhone || !callMeBotApiKey) {
      console.log("[WhatsApp Notify] CallMeBot not configured, logging only:", { message, phone, timestamp: new Date().toISOString() });
      return new Response(
        JSON.stringify({ success: true, message: "Notification logged (CallMeBot not configured)" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(callMeBotPhone)}&text=${encodeURIComponent(message)}&apikey=${encodeURIComponent(callMeBotApiKey)}`;
    const res = await fetch(url);
    const body = await res.text();

    if (!res.ok) {
      console.error("[WhatsApp Notify] CallMeBot request failed:", res.status, body);
      return new Response(
        JSON.stringify({ error: "Failed to send WhatsApp message", detail: body }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "WhatsApp notification sent" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
