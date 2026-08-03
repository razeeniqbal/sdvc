import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function normalizePhone(phone: string): string {
  const clean = phone.replace(/[^0-9]/g, "");
  return clean.startsWith("0") ? "60" + clean.slice(1) : clean;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { phone, password, full_name, short_name } = await req.json();

    // Used only to build a stable login email — kept separate from the number we
    // store/display, so a player sees back exactly what they typed.
    const normalizedPhone = normalizePhone(String(phone || ""));
    const displayPhone = String(phone || "").replace(/[^0-9]/g, "");
    if (normalizedPhone.length < 10) {
      return new Response(
        JSON.stringify({ error: "Enter a valid phone number" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!password || String(password).length < 6) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 6 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const syntheticEmail = `${normalizedPhone}@phone.volleyballsdnbhd.local`;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { error } = await supabaseAdmin.auth.admin.createUser({
      email: syntheticEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: full_name || short_name || "New Player",
        short_name: short_name || full_name || "Player",
        phone_number: displayPhone,
      },
    });

    if (error) {
      const isDuplicate = /already.*registered|already.*exists/i.test(error.message);
      return new Response(
        JSON.stringify({ error: isDuplicate ? "This phone number is already registered" : error.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ email: syntheticEmail }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
