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

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { action, phone, token, new_password } = await req.json();

    if (action === "request") {
      const normalizedPhone = normalizePhone(String(phone || ""));
      if (normalizedPhone.length < 10) {
        return json({ error: "Enter a valid phone number" }, 400);
      }
      const syntheticEmail = `${normalizedPhone}@phone.volleyballsdnbhd.local`;

      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("id, phone_number")
        .eq("email", syntheticEmail)
        .maybeSingle();

      if (!profile) {
        return json({ error: "No account found with that phone number" }, 404);
      }

      // Long random token, valid for 15 minutes. The player never generates or sees
      // this — only an admin can read pending requests and sends the link straight
      // to the player's own WhatsApp, which is what actually verifies the request
      // came from the real phone owner rather than anyone who knows the number.
      const generatedToken = crypto.randomUUID().replace(/-/g, "");
      const { error: insertError } = await supabaseAdmin.from("password_reset_requests").insert({
        profile_id: profile.id,
        phone_number: profile.phone_number,
        token: generatedToken,
        expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
      });
      if (insertError) return json({ error: insertError.message }, 500);
      return json({ ok: true });
    }

    if (action === "validate" || action === "confirm") {
      if (!token) return json({ error: "Missing reset token" }, 400);

      const { data: request } = await supabaseAdmin
        .from("password_reset_requests")
        .select("id, profile_id")
        .eq("token", String(token).trim())
        .eq("status", "pending")
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (!request) return json({ error: "This reset link is invalid or has expired" }, 400);

      if (action === "validate") return json({ ok: true });

      if (!new_password || String(new_password).length < 6) {
        return json({ error: "Password must be at least 6 characters" }, 400);
      }

      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(request.profile_id, { password: new_password });
      if (updateError) return json({ error: updateError.message }, 500);

      await supabaseAdmin.from("password_reset_requests")
        .update({ status: "used", used_at: new Date().toISOString() })
        .eq("id", request.id);

      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
