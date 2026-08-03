import type { BookingStatus, PaymentStatus, SessionStatus } from '@/types/database';

const bookingStatusStyles: Record<BookingStatus, string> = {
  'Pending Payment': 'bg-amber-100 text-amber-800 border-amber-200',
  Confirmed: 'bg-green-100 text-green-800 border-green-200',
  'Cancelled by Player': 'bg-red-100 text-red-700 border-red-200',
  'Cancelled by Admin': 'bg-red-100 text-red-700 border-red-200',
  Completed: 'bg-blue-100 text-blue-800 border-blue-200',
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
