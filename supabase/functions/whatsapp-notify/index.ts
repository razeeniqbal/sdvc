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

    // In production, this would call the WhatsApp Business API or a service like
    // Twilio/MessageBird to send a message to the WhatsApp group.
    // For now, we log the notification and return success.
    //
    // Example integration with WhatsApp Cloud API:
    // const res = await fetch(`https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`, {
    //   method: "POST",
    //   headers: {
    //     "Authorization": `Bearer ${Deno.env.get("WHATSAPP_TOKEN")}`,
    //     "Content-Type": "application/json",
    //   },
    //   body: JSON.stringify({
    //     messaging_product: "whatsapp",
    //     to: phone || GROUP_ID,
    //     type: "text",
    //     text: { body: message },
    //   }),
    // });

    console.log("[WhatsApp Notify]", { message, phone, timestamp: new Date().toISOString() });

    return new Response(
      JSON.stringify({ success: true, message: "Notification logged (WhatsApp integration pending)" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
