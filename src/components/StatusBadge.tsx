import { useTranslation } from 'react-i18next';
import type { BookingStatus, PaymentStatus, SessionStatus, Gender } from '@/types/database';

// Status is always stated in words; colour only reinforces it. Semantic
// colours only (green / amber / red / slate) — never brand colours.
const GREEN = 'border-green-500/40 bg-green-500/10 text-green-300';
const AMBER = 'border-amber-500/40 bg-amber-500/10 text-amber-300';
const RED = 'border-red-500/40 bg-red-500/10 text-red-300';
const SLATE = 'border-ink-500 bg-ink-700 text-slate-300';

const bookingStatusStyles: Record<BookingStatus, string> = {
  'Pending Payment': AMBER,
  Confirmed: GREEN,
  'Cancelled by Player': RED,
  'Cancelled by Admin': RED,
  Completed: SLATE,
  'No Show': SLATE,
  Refunded: SLATE,
};

const paymentStatusStyles: Record<PaymentStatus, string> = {
  Pending: AMBER,
  Paid: GREEN,
  Failed: RED,
  Cancelled: SLATE,
  Refunded: SLATE,
  'Partially Refunded': SLATE,
  'Manual Payment Pending Verification': AMBER,
};

const sessionStatusStyles: Record<SessionStatus, string> = {
  Open: GREEN,
  Closed: SLATE,
  Cancelled: RED,
};

const base = 'inline-flex items-center whitespace-nowrap rounded-sm border px-2 py-0.5 text-xs font-semibold';

export function StatusBadge({ status }: { status: BookingStatus }) {
  const { t } = useTranslation();
  return <span className={`${base} ${bookingStatusStyles[status] ?? SLATE}`}>{t(`v2.status.booking.${status}`, { defaultValue: status })}</span>;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const { t } = useTranslation();
  return <span className={`${base} ${paymentStatusStyles[status] ?? SLATE}`}>{t(`v2.status.payment.${status}`, { defaultValue: status })}</span>;
}

export function SessionStatusBadge({ status }: { status: SessionStatus }) {
  const { t } = useTranslation();
  return <span className={`${base} ${sessionStatusStyles[status] ?? SLATE}`}>{t(`v2.status.session.${status}`, { defaultValue: status })}</span>;
}

// Renders nothing when gender is unset — an unlabeled player shouldn't show an
// empty/placeholder badge in a list full of labeled ones. Neutral styling; the
// letter carries the meaning (with a full-word label for screen readers).
export function GenderBadge({ gender }: { gender: Gender | null | undefined }) {
  const { t } = useTranslation();
  if (!gender) return null;
  const label = gender === 'Male' ? t('common.genderMale') : t('common.genderFemale');
  return (
    <span title={label} className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-ink-500 bg-ink-700 text-[10px] font-bold text-slate-200">
      <span aria-hidden>{gender === 'Male' ? 'M' : 'F'}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
