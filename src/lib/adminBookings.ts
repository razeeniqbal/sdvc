import { supabase } from './supabase';
import { notifyGroup } from './notifications';
import { fetchSessionRoster, buildRosterMessage } from './sessions';
import type { Booking, BookingStatus, Profile, Session } from '@/types/database';
import type { OpsTone } from '@/components/admin/AdminUI';

// Booking/payment operations shared by Admin → Bookings, Admin → Payments and
// the session workspace. Moved here unchanged from AdminBookingsPage so every
// view runs the same logic. Each returns an error message, or null on success.

export interface AdminBooking extends Booking {
  session: Session;
  profile: Profile;
}

export const ADMIN_BOOKING_SELECT = '*, session:sessions(*), profile:profiles(*)';

// Unpaid bookings owe the session's *current* price (a TBC session may have been
// priced after the slot was locked); paid ones show what was actually paid.
export function amountDue(b: AdminBooking): number {
  return b.payment_status !== 'Paid' ? b.session.price : b.total_amount;
}

export async function updateBookingStatus(booking: AdminBooking, status: BookingStatus): Promise<string | null> {
  const updates: { booking_status: BookingStatus; cancelled_at?: string } = { booking_status: status };
  if (status.includes('Cancelled')) {
    updates.cancelled_at = new Date().toISOString();
  }
  const { error } = await supabase.from('bookings').update(updates).eq('id', booking.id);
  return error?.message ?? null;
}

// Verify payment: records a manual payment, confirms the booking, notifies the
// player in-app and posts the refreshed roster to the group.
export async function confirmBooking(booking: AdminBooking, finalAmount?: number): Promise<string | null> {
  let amount = booking.total_amount;
  if (finalAmount !== undefined && finalAmount !== booking.total_amount) {
    amount = finalAmount;
    await supabase.from('bookings').update({
      subtotal: amount,
      processing_fee: 0,
      total_amount: amount,
    }).eq('id', booking.id);
  }

  await supabase.from('payments').insert({
    booking_id: booking.id,
    payment_provider: 'manual',
    payment_method: 'Cash',
    amount,
    payment_status: 'Paid',
    transaction_reference: 'MANUAL-' + Date.now(),
    paid_at: new Date().toISOString(),
  });
  const { error } = await supabase.from('bookings').update({
    booking_status: 'Confirmed',
    payment_status: 'Paid',
  }).eq('id', booking.id);
  if (error) return error.message;

  await supabase.from('notifications').insert({
    user_id: booking.user_id,
    booking_id: booking.id,
    notification_type: 'booking_confirmation',
    title: 'Booking Confirmed',
    message: `Your booking ${booking.booking_reference} for "${booking.session.title}" is confirmed. See you on court!`,
    delivery_channel: 'in_app',
    delivery_status: 'Sent',
    sent_at: new Date().toISOString(),
  });

  const roster = await fetchSessionRoster(booking.session_id);
  await notifyGroup(buildRosterMessage(booking.session, roster));
  return null;
}

export async function issueRefund(booking: AdminBooking): Promise<string | null> {
  await supabase.from('payments').update({
    payment_status: 'Refunded',
    refunded_amount: booking.total_amount,
    refunded_at: new Date().toISOString(),
  }).eq('booking_id', booking.id);
  const { error } = await supabase.from('bookings').update({
    booking_status: 'Refunded',
    payment_status: 'Refunded',
  }).eq('id', booking.id);
  return error?.message ?? null;
}

export async function saveAdminNotes(bookingId: string, notes: string): Promise<string | null> {
  const { error } = await supabase.from('bookings').update({ admin_notes: notes }).eq('id', bookingId);
  return error?.message ?? null;
}

// Payment state derived from the booking row: a pending booking with a receipt
// is waiting on the admin; without one it's waiting on the player.
export function paymentState(b: Pick<Booking, 'payment_status' | 'booking_status' | 'receipt_path'>): [OpsTone, string] {
  if (b.payment_status === 'Paid') return ['good', 'Paid'];
  if (b.payment_status === 'Refunded' || b.payment_status === 'Partially Refunded') return ['neutral', 'Refunded'];
  if (b.booking_status.includes('Cancelled')) return ['neutral', 'Not paid'];
  if (b.receipt_path) return ['attention', 'Needs review'];
  return ['neutral', 'Awaiting receipt'];
}

