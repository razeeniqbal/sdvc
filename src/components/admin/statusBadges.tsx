import type { Booking, BookingStatus } from '@/types/database';
import { OpsBadge, type OpsTone } from './AdminUI';
import { paymentState } from '@/lib/adminBookings';

// Admin status language: green = confirmed/paid, amber = pending/attention,
// red = cancelled, slate = neutral/completed. Always text, never colour alone.

const BOOKING: Record<BookingStatus, [OpsTone, string]> = {
  'Pending Payment': ['attention', 'Pending'],
  Confirmed: ['good', 'Confirmed'],
  Completed: ['neutral', 'Completed'],
  'No Show': ['neutral', 'No show'],
  'Cancelled by Player': ['critical', 'Cancelled · player'],
  'Cancelled by Admin': ['critical', 'Cancelled · admin'],
  Refunded: ['neutral', 'Refunded'],
};

export function BookingOpsBadge({ status }: { status: BookingStatus }) {
  const [tone, label] = BOOKING[status];
  return <OpsBadge tone={tone}>{label}</OpsBadge>;
}

export function PaymentOpsBadge({ booking }: { booking: Pick<Booking, 'payment_status' | 'booking_status' | 'receipt_path'> }) {
  const [tone, label] = paymentState(booking);
  return <OpsBadge tone={tone}>{label}</OpsBadge>;
}
