import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Telegram-Bot-Api-Secret-Token",
};

interface TelegramCallbackQuery {
  id: string;
  data?: string;
  from?: { first_name?: string };
  message?: {
    chat: { id: number };
    message_id: number;
    caption?: string;
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const webhookSecret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");

  // Telegram sends this header on every webhook call when a secret_token was set via
  // setWebhook — without it, anyone who finds this URL could fake button presses and
  // confirm/cancel bookings.
  if (!webhookSecret || req.headers.get("X-Telegram-Bot-Api-Secret-Token") !== webhookSecret) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }
  if (!botToken) {
    return new Response("Bot not configured", { status: 500, headers: corsHeaders });
  }

  const update = await req.json();
  const callback: TelegramCallbackQuery | undefined = update.callback_query;

  // Telegram expects a 200 for any update type it sends, even ones we ignore, or it
  // will keep retrying delivery.
  if (!callback?.data) {
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

  async function editCaption(newCaption: string) {
    const msg = callback!.message;
    if (!msg) return;
    await fetch(`https://api.telegram.org/bot${botToken}/editMessageCaption`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: msg.chat.id,
        message_id: msg.message_id,
        caption: newCaption,
        reply_markup: { inline_keyboard: [] },
      }),
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

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

  // Companion bookings share a booking_group_id — one receipt covers the whole party,
  // so approving/rejecting must apply to every booking in the group, not just this row.
  const party = booking.booking_group_id
    ? ((await supabase.from("bookings").select("id, total_amount").eq("booking_group_id", booking.booking_group_id)).data ?? [booking])
    : [booking];

  const actorName = callback.from?.first_name ?? "Admin";
  const originalCaption = callback.message?.caption ?? "";

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
    await editCaption(`${originalCaption}\n\n✅ Approved by ${actorName}`);
  } else {
    await supabase.from("bookings")
      .update({ booking_status: "Cancelled by Admin", payment_status: "Failed", cancelled_at: new Date().toISOString() })
      .in("id", party.map((b) => b.id));

    await answerCallback("Rejected ❌");
    await editCaption(`${originalCaption}\n\n❌ Rejected by ${actorName}`);
  }

  return new Response("ok", { status: 200, headers: corsHeaders });
});
