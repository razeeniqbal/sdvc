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
  guest_phone: string | null;
  guest_gender: string | null;
  total_amount: number;
  created_at: string;
  booking_group_id: string | null;
  session: { id: string; title: string; session_date: string; price: number } | null;
  profile: { full_name: string; short_name: string | null; phone_number: string | null; gender: string | null } | null;
}

function genderTag(gender: string | null | undefined): string {
  return gender ? ` (${gender === 'Male' ? 'M' : 'F'})` : '';
}

// Bookings here are always still unpaid, so the amount owed should track the session's
// current price rather than the snapshot taken when the booking was created — an admin
// who updates a TBC/incorrect price afterward expects these views to follow it.
function displayAmount(row: BookingRow): number {
  return row.session?.price ?? row.total_amount;
}

// Groups rows into per-session buckets, preserving first-seen order, so a combined
// list (e.g. /pending or /reminder with no session filter) can be rendered as separate
// blocks instead of one interleaved list.
function groupBySession(rows: BookingRow[]): { title: string; rows: BookingRow[] }[] {
  const groups: { key: string; title: string; rows: BookingRow[] }[] = [];
  const indexByKey = new Map<string, number>();
  for (const row of rows) {
    const key = row.session?.id ?? "unknown";
    let idx = indexByKey.get(key);
    if (idx === undefined) {
      idx = groups.length;
      indexByKey.set(key, idx);
      groups.push({ key, title: row.session?.title ?? "Unknown session", rows: [] });
    }
    groups[idx].rows.push(row);
  }
  return groups;
}

interface SessionRow {
  id: string;
  title: string;
  venue_name: string;
  session_date: string;
  start_time: string;
  end_time: string;
  price: number;
  maximum_capacity: number;
}

interface RosterPlayer {
  display_name: string;
  booking_status: string;
  gender: string | null;
}

function escapeHtml(input: string): string {
  return input.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatTime(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${m} ${period}`;
}

const MALAY_DAYS = ["AHAD", "ISNIN", "SELASA", "RABU", "KHAMIS", "JUMAAT", "SABTU"];

function formatMalayDateLabel(sessionDate: string): string {
  const date = new Date(`${sessionDate}T00:00:00`);
  const day = date.getDate();
  const month = date.toLocaleDateString("en-MY", { month: "long" }).toUpperCase();
  const dayName = MALAY_DAYS[date.getDay()];
  return `${day} ${month} (${dayName})`;
}

// Same date, softer casing — the all-caps roster/notify style reads as a shouty
// header, wrong tone for a message addressed to one person.
function formatFriendlyDateLabel(sessionDate: string): string {
  const date = new Date(`${sessionDate}T00:00:00`);
  const day = date.getDate();
  const month = date.toLocaleDateString("en-MY", { month: "long" });
  const dayName = MALAY_DAYS[date.getDay()];
  const titleCased = dayName.charAt(0) + dayName.slice(1).toLowerCase();
  return `${day} ${month} (${titleCased})`;
}

// Mirrors src/lib/sessions.ts buildRosterMessage() so the /list output matches the
// same numbered signup-sheet format the app already posts when someone books.
function buildRosterMessage(session: SessionRow, players: RosterPlayer[]): string {
  const priceLine = session.price > 0 ? `RM${Number(session.price).toFixed(2)}/pax` : "TBC/pax";

  const lines = [
    session.title.toUpperCase(),
    "",
    `🏟️: ${session.venue_name.toUpperCase()}`,
    `📆: ${formatMalayDateLabel(session.session_date)}`,
    `⏰: ${formatTime(session.start_time)} - ${formatTime(session.end_time)}`,
    `💵: ${priceLine}`,
    "",
  ];

  for (let i = 1; i <= session.maximum_capacity; i++) {
    const player = players[i - 1];
    if (!player) { lines.push(`${i})`); continue; }
    const tick = player.booking_status === "Confirmed" ? " ✅" : "";
    lines.push(`${i}) ${player.display_name}${genderTag(player.gender)}${tick}`);
  }

  return lines.join("\n");
}

// Slot-availability update the admin copy-pastes straight into the WhatsApp group —
// no bridge needed since it's manual, just formatted for zero-effort pasting.
function buildNotifyMessage(session: SessionRow, filledCount: number): string {
  const remaining = session.maximum_capacity - filledCount;
  const header = `${session.title.toUpperCase()} (${formatMalayDateLabel(session.session_date)})`;
  if (remaining <= 0) {
    return `${header}\n\nUPDATE: SLOT DAH PENUH! 🏐\nTerima kasih semua yang dah daftar. Nak masuk waiting list boleh PM admin.`;
  }
  return `${header}\n\nUPDATE: SLOT TINGGAL LAGI ${remaining} ORANG\nMana yang belum bayar sila bayar, nanti system akan cancel booking kalau hold lama sangat.`;
}

// wa.me deep link that opens a chat with the message pre-filled — the admin still has
// to tap Send themselves, but this needs no API, no bridge, and costs nothing. Mirrors
// src/lib/settings.ts whatsappLink()'s Malaysian "0" → "60" normalization.
function normalizePhone(phone: string): string {
  const clean = phone.replace(/[^0-9]/g, "");
  return clean.startsWith("0") ? "60" + clean.slice(1) : clean;
}

function waMeLink(phone: string, message: string): string {
  return `https://wa.me/${normalizePhone(phone)}?text=${encodeURIComponent(message)}`;
}

function buildReminderText(name: string, sessionTitle: string, friendlyDate: string, amount: number): string {
  return `Hai ${name}! 👋\nSlot anda untuk *${sessionTitle}* (${friendlyDate}) masih belum dibayar (RM${amount.toFixed(2)}).\n\nSila selesaikan bayaran sebelum 24 jam dari tarikh sesi. Jika tidak, slot akan dibuka semula untuk pemain lain. Terima kasih! 🙏`;
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

  async function sendMessage(chatId: number, text: string, useHtml = true, replyMarkup?: Record<string, unknown>) {
    const body: Record<string, unknown> = { chat_id: chatId, text };
    if (useHtml) body.parse_mode = "HTML";
    if (replyMarkup) body.reply_markup = replyMarkup;
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async function getUpcomingSessions(): Promise<SessionRow[]> {
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase
      .from("sessions")
      .select("*")
      .neq("status", "Cancelled")
      .gte("session_date", today)
      .order("session_date", { ascending: true })
      .order("start_time", { ascending: true })
      .limit(20);
    return (data ?? []) as SessionRow[];
  }

  // One tappable button per session — callback_data encodes which command asked and
  // which session was picked, so the callback handler can run the same logic these
  // commands run directly, just resolved via a button tap instead of typed text.
  async function sendSessionPicker(chatId: number, sessions: SessionRow[], commandName: string, headerText: string) {
    await sendMessage(chatId, headerText, false, {
      inline_keyboard: sessions.map((s) => [{
        text: `${s.title} (${formatMalayDateLabel(s.session_date)})`,
        callback_data: `sesspick:${commandName}:${s.id}`,
      }]),
    });
  }

  // Picks which session a /list or /notify call targets. With one upcoming session it
  // just works like before; with several, shows tappable buttons instead of silently
  // guessing — that silent guess (always "the next one") was the bug where a second
  // session was invisible to these commands entirely. A typed /list 2 still works too.
  async function resolveSession(chatId: number, arg: string | undefined, commandName: string): Promise<SessionRow | null> {
    const sessions = await getUpcomingSessions();
    if (sessions.length === 0) {
      await sendMessage(chatId, "No upcoming sessions.", false);
      return null;
    }
    if (sessions.length === 1) {
      return sessions[0];
    }
    if (arg) {
      const idx = parseInt(arg, 10);
      if (!isNaN(idx) && idx >= 1 && idx <= sessions.length) {
        return sessions[idx - 1];
      }
    }
    await sendSessionPicker(chatId, sessions, commandName, "Multiple sessions coming up, which one?");
    return null;
  }

  // Optional session filter for /pending and /reminder — unlike resolveSession() above,
  // no arg here means "show everything across all sessions" (already the useful
  // default for these two), not "ask which one."
  async function resolveOptionalSessionFilter(chatId: number, arg: string | undefined, commandName: string): Promise<SessionRow | null | undefined> {
    if (!arg) return undefined;
    const sessions = await getUpcomingSessions();
    const idx = parseInt(arg, 10);
    if (isNaN(idx) || idx < 1 || idx > sessions.length) {
      if (sessions.length === 0) {
        await sendMessage(chatId, "No upcoming sessions.", false);
      } else {
        await sendSessionPicker(chatId, sessions, commandName, "Not a valid session number, pick one:");
      }
      return null;
    }
    return sessions[idx - 1];
  }

  async function sendConfirmCard(chatId: number, row: BookingRow, partySize: number) {
    const name = row.is_guest ? row.guest_name ?? "Guest" : row.profile?.short_name || row.profile?.full_name || "Player";
    const gender = row.is_guest ? row.guest_gender : row.profile?.gender;
    const sessionLine = row.session ? `${row.session.title} (${row.session.session_date})` : "Unknown session";
    const partyNote = partySize > 1 ? ` (+${partySize - 1} more)` : "";
    const waitingHrs = Math.max(0, Math.round((Date.now() - new Date(row.created_at).getTime()) / 3_600_000));
    const text = `👤 <b>${escapeHtml(name)}</b>${escapeHtml(genderTag(gender))}${escapeHtml(partyNote)}\n${escapeHtml(sessionLine)}\nRef: ${row.booking_reference} · RM${displayAmount(row).toFixed(2)}\nWaiting: ${waitingHrs}h`;

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

  // Looks up one booking fresh and sends its Confirm/Reject card — used when a name is
  // tapped in the /pending summary list, so the detail card only gets sent for the one
  // booking the admin actually wants to act on, not all of them upfront.
  async function sendPendingDetail(chatId: number, bookingId: string) {
    const { data } = await supabase
      .from("bookings")
      .select("id, booking_reference, booking_status, is_guest, guest_name, guest_phone, guest_gender, total_amount, created_at, booking_group_id, session:sessions(id, title, session_date, price), profile:profiles(full_name, short_name, phone_number, gender)")
      .eq("id", bookingId)
      .maybeSingle();
    if (!data) {
      await sendMessage(chatId, "That booking isn't available anymore.", false);
      return;
    }
    const row = data as unknown as BookingRow;
    let partySize = 1;
    if (row.booking_group_id) {
      const { count } = await supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("booking_group_id", row.booking_group_id);
      partySize = count ?? 1;
    }
    await sendConfirmCard(chatId, row, partySize);
  }

  // Shared by /pending and its "sesspick:pending:<id>" button-tap equivalent. No filter
  // shows every pending booking across all sessions; a filter narrows to just that one.
  // Posts one compact summary with a tappable button per person instead of flooding the
  // chat with every booking's full Confirm/Reject card at once — tapping a name pulls up
  // just that one card via sendPendingDetail().
  async function runPending(chatId: number, filter: SessionRow | undefined) {
    let query = supabase
      .from("bookings")
      .select("id, booking_reference, booking_status, is_guest, guest_name, guest_phone, guest_gender, total_amount, created_at, booking_group_id, session:sessions(id, title, session_date, price), profile:profiles(full_name, short_name, phone_number, gender)")
      .eq("booking_status", "Pending Payment")
      .order("created_at", { ascending: true })
      .limit(50);
    if (filter) query = query.eq("session_id", filter.id);
    const { data, error } = await query;

    const scopeSuffix = filter ? ` for ${filter.title}` : "";
    if (error || !data || data.length === 0) {
      await sendMessage(chatId, `✅ No pending bookings${scopeSuffix} right now, all caught up!`);
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

    const shown = cards.slice(0, 20);
    // With no filter, bookings span multiple sessions — group them into separate
    // labeled blocks instead of one interleaved list; a filter already means everything
    // shown is from the same session, so a single unlabeled group is enough.
    const groups = filter ? [{ title: filter.title, rows: shown }] : groupBySession(shown);

    const lines: string[] = [];
    const buttons: { text: string; callback_data: string }[][] = [];
    let n = 0;
    for (const group of groups) {
      if (!filter) {
        if (lines.length > 0) lines.push("");
        lines.push(`🏐 <b>${escapeHtml(group.title)}</b>`);
      }
      for (const row of group.rows) {
        n++;
        const name = row.is_guest ? row.guest_name ?? "Guest" : row.profile?.short_name || row.profile?.full_name || "Player";
        const gender = row.is_guest ? row.guest_gender : row.profile?.gender;
        const waitingHrs = Math.max(0, Math.round((Date.now() - new Date(row.created_at).getTime()) / 3_600_000));
        lines.push(`${n}) ${escapeHtml(name)}${genderTag(gender)} · RM${displayAmount(row).toFixed(2)} · ${waitingHrs}h`);
        buttons.push([{ text: `${n}) ${name}`, callback_data: `pendetail:${row.id}` }]);
      }
    }

    await sendMessage(
      chatId,
      `🕒 <b>${cards.length} booking${cards.length > 1 ? "s" : ""} awaiting confirmation${scopeSuffix}</b>\n\n${lines.join("\n")}\n\nTap a name to confirm or reject:`,
      true,
      { inline_keyboard: buttons }
    );
  }

  // No arg shows every pending booking across all sessions; /pending N or a button tap
  // narrows to just session N.
  async function handlePendingCommand(chatId: number, arg: string | undefined) {
    const filter = await resolveOptionalSessionFilter(chatId, arg, "pending");
    if (filter === null) return;
    await runPending(chatId, filter);
  }

  // Shared by /list and its button-tap equivalent. Posts the same numbered signup-sheet
  // roster the app posts automatically when someone books — e.g.:
  //   1) Jeen ✅
  //   2) Madi ✅
  //   3)
  async function runRoster(chatId: number, session: SessionRow) {
    const { data: players } = await supabase.rpc("session_player_list", { p_session_id: session.id });
    await sendMessage(chatId, buildRosterMessage(session, (players ?? []) as RosterPlayer[]), false);
  }

  // Targets the next upcoming session, or asks which one (via buttons) if more than one
  // is scheduled.
  async function handleListCommand(chatId: number, arg: string | undefined) {
    const session = await resolveSession(chatId, arg, "list");
    if (!session) return;
    await runRoster(chatId, session);
  }

  async function sendReminderCard(chatId: number, row: BookingRow) {
    const phone = (row.is_guest ? row.guest_phone : row.profile?.phone_number)!;
    const name = row.is_guest ? row.guest_name ?? "Guest" : row.profile?.short_name || row.profile?.full_name || "Player";
    const gender = row.is_guest ? row.guest_gender : row.profile?.gender;
    const sessionTitle = row.session?.title ?? "your session";
    const rawDate = row.session?.session_date;
    const dateLabel = rawDate ? formatMalayDateLabel(rawDate) : "TBC";
    const friendlyDate = rawDate ? formatFriendlyDateLabel(rawDate) : "TBC";
    const waitingHrs = Math.max(0, Math.round((Date.now() - new Date(row.created_at).getTime()) / 3_600_000));
    const amount = displayAmount(row);
    const cardText = `👤 <b>${escapeHtml(name)}</b>${escapeHtml(genderTag(gender))}\n🏐 ${escapeHtml(sessionTitle)} (${escapeHtml(dateLabel)})\n🎫 Ref: ${row.booking_reference} · 💰 RM${amount.toFixed(2)}\n⏳ Waiting ${waitingHrs}h for payment`;
    const reminderMsg = buildReminderText(name, sessionTitle, friendlyDate, amount);

    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: cardText,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[{ text: "💬 Message on WhatsApp", url: waMeLink(phone, reminderMsg) }]],
        },
      }),
    });
  }

  // Looks up one booking fresh and sends its wa.me reminder card — used when a name is
  // tapped in the /reminder summary list, same pattern as sendPendingDetail().
  async function sendReminderDetail(chatId: number, bookingId: string) {
    const { data } = await supabase
      .from("bookings")
      .select("id, booking_reference, booking_status, is_guest, guest_name, guest_phone, guest_gender, total_amount, created_at, booking_group_id, session:sessions(id, title, session_date, price), profile:profiles(full_name, short_name, phone_number, gender)")
      .eq("id", bookingId)
      .maybeSingle();
    if (!data) {
      await sendMessage(chatId, "That booking isn't available anymore.", false);
      return;
    }
    const row = data as unknown as BookingRow;
    const phone = row.is_guest ? row.guest_phone : row.profile?.phone_number;
    if (!phone) {
      await sendMessage(chatId, "No phone number on file for that player.", false);
      return;
    }
    await sendReminderCard(chatId, row);
  }

  // Shared by /reminder and its button-tap equivalent. Posts one compact summary with a
  // tappable button per unpaid player who has a phone on file, instead of sending every
  // wa.me reminder card upfront — tapping a name pulls up just that one via
  // sendReminderDetail().
  async function runReminder(chatId: number, filter: SessionRow | undefined) {
    let query = supabase
      .from("bookings")
      .select("id, booking_reference, booking_status, is_guest, guest_name, guest_phone, guest_gender, total_amount, created_at, booking_group_id, session:sessions(id, title, session_date, price), profile:profiles(full_name, short_name, phone_number, gender)")
      .eq("booking_status", "Pending Payment")
      .order("created_at", { ascending: true })
      .limit(50);
    if (filter) query = query.eq("session_id", filter.id);
    const { data, error } = await query;

    const scopeSuffix = filter ? ` for ${filter.title}` : "";
    if (error || !data || data.length === 0) {
      await sendMessage(chatId, `✅ No pending bookings${scopeSuffix} right now, all caught up!`);
      return;
    }

    const rows = data as unknown as BookingRow[];
    const withPhone = rows.filter((r) => (r.is_guest ? r.guest_phone : r.profile?.phone_number));

    if (withPhone.length === 0) {
      await sendMessage(chatId, `There are pending bookings${scopeSuffix}, but none of them have a phone number on file to message.`);
      return;
    }

    const shown = withPhone.slice(0, 20);
    // Same per-session grouping as /pending — see comment there.
    const groups = filter ? [{ title: filter.title, rows: shown }] : groupBySession(shown);

    const lines: string[] = [];
    const buttons: { text: string; callback_data: string }[][] = [];
    let n = 0;
    for (const group of groups) {
      if (!filter) {
        if (lines.length > 0) lines.push("");
        lines.push(`🏐 <b>${escapeHtml(group.title)}</b>`);
      }
      for (const row of group.rows) {
        n++;
        const name = row.is_guest ? row.guest_name ?? "Guest" : row.profile?.short_name || row.profile?.full_name || "Player";
        const gender = row.is_guest ? row.guest_gender : row.profile?.gender;
        const waitingHrs = Math.max(0, Math.round((Date.now() - new Date(row.created_at).getTime()) / 3_600_000));
        lines.push(`${n}) ${escapeHtml(name)}${genderTag(gender)} · RM${displayAmount(row).toFixed(2)} · ${waitingHrs}h`);
        buttons.push([{ text: `${n}) ${name}`, callback_data: `remdetail:${row.id}` }]);
      }
    }

    await sendMessage(
      chatId,
      `📣 <b>${shown.length} reminder${shown.length > 1 ? "s" : ""} ready${scopeSuffix}</b>\n\n${lines.join("\n")}\n\nTap a name to get their WhatsApp reminder:`,
      true,
      { inline_keyboard: buttons }
    );
  }

  // Same /reminder N (or button-tap) session-narrowing as /pending.
  async function handleReminderCommand(chatId: number, arg: string | undefined) {
    const filter = await resolveOptionalSessionFilter(chatId, arg, "reminder");
    if (filter === null) return;
    await runReminder(chatId, filter);
  }

  // Shared by /notify and its button-tap equivalent. Generates the copy-paste-ready
  // group update text — nothing automated, just saves the admin from typing out slot
  // counts by hand.
  async function runNotify(chatId: number, session: SessionRow) {
    const { data: filledCount } = await supabase.rpc("confirmed_booking_count", { p_session_id: session.id });
    await sendMessage(chatId, buildNotifyMessage(session, (filledCount as number) ?? 0), false);
  }

  // Same multi-session picker as /list.
  async function handleNotifyCommand(chatId: number, arg: string | undefined) {
    const session = await resolveSession(chatId, arg, "notify");
    if (!session) return;
    await runNotify(chatId, session);
  }

  const update = await req.json();

  // Bot commands (e.g. "/pending" or "/pending@YourBotName" in a group) arrive as
  // regular messages, not callback_query.
  if (update.message?.text) {
    const msg = update.message as TelegramMessage;
    if (!configuredChatId || String(msg.chat.id) !== configuredChatId) {
      return new Response("ok", { status: 200, headers: corsHeaders });
    }
    const parts = (msg.text ?? "").trim().split(/\s+/);
    const command = parts[0].split("@")[0].toLowerCase();
    const arg = parts[1];
    if (command === "/pending") {
      await handlePendingCommand(msg.chat.id, arg);
    } else if (command === "/list") {
      await handleListCommand(msg.chat.id, arg);
    } else if (command === "/reminder") {
      await handleReminderCommand(msg.chat.id, arg);
    } else if (command === "/notify") {
      await handleNotifyCommand(msg.chat.id, arg);
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

  const parts = callback.data.split(":");
  const action = parts[0];
  if (!parts[1]) {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  async function answerCallback(text: string) {
    await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callback!.id, text }),
    });
  }

  // Button tap from the /pending summary list — pulls up just that one booking's
  // Confirm/Reject card instead of them all being sent upfront.
  if (action === "pendetail") {
    const bookingIdArg = parts[1];
    const chatId = callback.message?.chat.id;
    if (!bookingIdArg || !chatId) {
      return new Response("ok", { status: 200, headers: corsHeaders });
    }
    await answerCallback("Loading…");
    await sendPendingDetail(chatId, bookingIdArg);
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  // Button tap from the /reminder summary list — pulls up just that one player's wa.me
  // reminder card instead of them all being sent upfront.
  if (action === "remdetail") {
    const bookingIdArg = parts[1];
    const chatId = callback.message?.chat.id;
    if (!bookingIdArg || !chatId) {
      return new Response("ok", { status: 200, headers: corsHeaders });
    }
    await answerCallback("Loading…");
    await sendReminderDetail(chatId, bookingIdArg);
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  // Button tap from sendSessionPicker() — runs the same logic /list, /notify, /pending,
  // or /reminder would run directly, just resolved via a tap instead of a typed number.
  if (action === "sesspick") {
    const cmdName = parts[1];
    const sessionId = parts[2];
    const chatId = callback.message?.chat.id;
    if (!sessionId || !chatId) {
      return new Response("ok", { status: 200, headers: corsHeaders });
    }
    await answerCallback("Loading…");
    const { data: session } = await supabase.from("sessions").select("*").eq("id", sessionId).maybeSingle();
    if (!session) {
      await sendMessage(chatId, "That session isn't available anymore.", false);
      return new Response("ok", { status: 200, headers: corsHeaders });
    }
    const sessionRow = session as SessionRow;
    if (cmdName === "list") await runRoster(chatId, sessionRow);
    else if (cmdName === "notify") await runNotify(chatId, sessionRow);
    else if (cmdName === "pending") await runPending(chatId, sessionRow);
    else if (cmdName === "reminder") await runReminder(chatId, sessionRow);
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  const bookingId = parts[1];
  if (action !== "appr" && action !== "rej") {
    return new Response("ok", { status: 200, headers: corsHeaders });
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
