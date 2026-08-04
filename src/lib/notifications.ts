import { supabase } from './supabase';
import type { Booking, Session, Profile } from '@/types/database';
import { fetchClubSettings } from './settings';

export async function createNotification(
  userId: string,
  notificationType: string,
  title: string,
  message: string,
  bookingId?: string
) {
  try {
    await supabase.from('notifications').insert({
      user_id: userId,
      booking_id: bookingId ?? null,
      notification_type: notificationType,
      title,
      message,
      delivery_channel: 'in_app',
      delivery_status: 'Sent',
      sent_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error('Failed to create notification:', e);
  }
}

async function postToTelegramNotify(body: Record<string, string | undefined>): Promise<boolean> {
  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telegram-notify`;
  const headers = {
    Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  };
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return response.ok;
}

async function sendTelegramMessage(message: string): Promise<boolean> {
  return postToTelegramNotify({ message });
}

// Sends a receipt photo straight to the club's Telegram group so the admin sees proof
// of payment immediately, without needing to open the admin panel. photoUrl must be
// reachable by Telegram's servers — a short-lived signed URL works fine. Passing
// bookingId attaches Approve/Reject buttons the admin can tap directly in Telegram.
export async function notifyReceiptUploaded(photoUrl: string, caption: string, bookingId?: string): Promise<boolean> {
  try {
    return await postToTelegramNotify({ photoUrl, caption, bookingId });
  } catch (e) {
    console.error('Failed to send Telegram receipt photo:', e);
    return false;
  }
}

export async function notifyGroup(message: string): Promise<void> {
  try {
    const settings = await fetchClubSettings();
    if (!settings?.whatsapp_group_notify) return;
    const ok = await sendTelegramMessage(message);
    if (!ok) console.error('Telegram notify failed');
  } catch (e) {
    console.error('Failed to send Telegram notification:', e);
  }
}

// Admin-triggered manual send, independent of the whatsapp_group_notify auto-notify setting.
export async function sendGroupBlast(message: string): Promise<boolean> {
  try {
    return await sendTelegramMessage(message);
  } catch (e) {
    console.error('Failed to send Telegram blast:', e);
    return false;
  }
}

export function buildBookingConfirmationMessage(booking: Booking, session: Session): string {
  return `Your booking ${booking.booking_reference} for "${session.title}" on ${session.session_date} at ${session.venue_name} is confirmed. See you on court!`;
}

export function buildPaymentSuccessMessage(booking: Booking, session: Session): string {
  return `Payment of RM${booking.total_amount.toFixed(2)} received for booking ${booking.booking_reference} (${session.title}).`;
}

export function buildPaymentFailedMessage(booking: Booking, session: Session): string {
  return `Payment for booking ${booking.booking_reference} (${session.title}) failed. Please try again or contact the club.`;
}

export function buildCancellationMessage(booking: Booking, session: Session, byAdmin: boolean): string {
  const who = byAdmin ? 'by the club admin' : 'by you';
  return `Booking ${booking.booking_reference} for "${session.title}" has been cancelled ${who}.`;
}

export function buildRefundMessage(booking: Booking, session: Session, amount: number): string {
  return `A refund of RM${amount.toFixed(2)} has been issued for booking ${booking.booking_reference} (${session.title}).`;
}

export function buildRegistrationMessage(profile: Profile): string {
  return `Welcome to the club, ${profile.full_name}! Your account has been created successfully. Browse upcoming sessions and book your first game.`;
}

export function buildWaitlistOfferMessage(session: Session): string {
  return `A slot opened up for "${session.title}" on ${session.session_date}. You have 10 minutes to complete your booking.`;
}

export function buildSessionReminderMessage(session: Session, hoursBefore: number): string {
  return `Reminder: "${session.title}" starts in ${hoursBefore} hour${hoursBefore > 1 ? 's' : ''} at ${session.venue_name}. See you there!`;
}

export function buildSessionCancelledMessage(session: Session): string {
  return `The session "${session.title}" on ${session.session_date} has been cancelled by the club. A refund will be issued if applicable.`;
}
