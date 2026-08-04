import type { BookingStatus, PaymentStatus, SessionStatus, Gender } from '@/types/database';

const bookingStatusStyles: Record<BookingStatus, string> = {
  'Pending Payment': 'bg-amber-100 text-amber-800 border-amber-200',
  Confirmed: 'bg-green-100 text-green-800 border-green-200',
  'Cancelled by Player': 'bg-red-100 text-red-700 border-red-200',
  'Cancelled by Admin': 'bg-red-100 text-red-700 border-red-200',
  Completed: 'bg-blue-100 text-blue-700 border-blue-200',
  'No Show': 'bg-slate-100 text-slate-600 border-slate-200',
  Refunded: 'bg-purple-100 text-purple-700 border-purple-200',
};

const paymentStatusStyles: Record<PaymentStatus, string> = {
  Pending: 'bg-amber-100 text-amber-800 border-amber-200',
  Paid: 'bg-green-100 text-green-800 border-green-200',
  Failed: 'bg-red-100 text-red-700 border-red-200',
  Cancelled: 'bg-slate-100 text-slate-600 border-slate-200',
  Refunded: 'bg-purple-100 text-purple-700 border-purple-200',
  'Partially Refunded': 'bg-purple-100 text-purple-700 border-purple-200',
  'Manual Payment Pending Verification': 'bg-amber-100 text-amber-800 border-amber-200',
};

const sessionStatusStyles: Record<SessionStatus, string> = {
  Open: 'bg-green-100 text-green-800 border-green-200',
  Closed: 'bg-slate-100 text-slate-600 border-slate-200',
  Cancelled: 'bg-red-100 text-red-700 border-red-200',
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${bookingStatusStyles[status]}`}>
      {status}
    </span>
  );
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${paymentStatusStyles[status]}`}>
      {status}
    </span>
  );
}

export function SessionStatusBadge({ status }: { status: SessionStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${sessionStatusStyles[status]}`}>
      {status}
    </span>
  );
}

const genderStyles: Record<Gender, string> = {
  Male: 'bg-blue-100 text-blue-700 border-blue-200',
  Female: 'bg-pink-100 text-pink-700 border-pink-200',
};

// Renders nothing when gender is unset — an unlabeled player shouldn't show an
// empty/placeholder badge in a list full of labeled ones.
export function GenderBadge({ gender }: { gender: Gender | null | undefined }) {
  if (!gender) return null;
  return (
    <span className={`inline-flex items-center justify-center rounded-full border h-5 w-5 text-[10px] font-bold flex-shrink-0 ${genderStyles[gender]}`}>
      {gender === 'Male' ? 'M' : 'F'}
    </span>
  );
}
