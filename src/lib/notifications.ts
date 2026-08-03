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

async function sendWhatsAppMessage(message: string): Promise<boolean> {
  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-notify`;
  const headers = {
    Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  };
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ message }),
  });
  return response.ok;
}

export async function notifyWhatsAppGroup(message: string): Promise<void> {
  try {
    const settings = await fetchClubSettings();
    if (!settings?.whatsapp_group_notify) return;
    const ok = await sendWhatsAppMessage(message);
    if (!ok) console.error('WhatsApp notify failed');
  } catch (e) {
    console.error('Failed to send WhatsApp notification:', e);
  }
}

// Admin-triggered manual send, independent of the whatsapp_group_notify auto-notify setting.
export async function sendWhatsAppBlast(message: string): Promise<boolean> {
  try {
    return await sendWhatsAppMessage(message);
  } catch (e) {
    console.error('Failed to send WhatsApp blast:', e);
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
