import { useTranslation } from 'react-i18next';
import { SESSION_STATUS_KEY, type getSessionStatus } from '@/lib/sessions';

type Status = ReturnType<typeof getSessionStatus>;

// A session's availability as a chip, always in words. "Fully booked" is the
// one players must not miss, so it is solid Volleyball Orange (the same colour
// the capacity bar turns when full); "Almost full" is an amber outline.
// Nothing is shown for a plain open game.
const STYLE: Record<Status, string> = {
  Available: '',
  'Almost Full': 'border border-amber-400/70 text-amber-300',
  'Fully Booked': 'bg-ball text-ink',
  'Booking Closed': 'bg-ink-600 text-slate-200',
  Cancelled: 'border border-red-500/60 text-red-300',
};

export function SessionStatusChip({ status }: { status: Status }) {
  const { t } = useTranslation();
  if (status === 'Available') return null;
  return <span className={`v2-chip font-bold uppercase tracking-wider ${STYLE[status]}`}>{t(SESSION_STATUS_KEY[status] || status)}</span>;
}
