import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarDays, Clock, MapPin, Lock } from 'lucide-react';
import { getSessionStatus, SESSION_STATUS_KEY, type SessionWithCount, type CourtPlayer } from '@/lib/sessions';
import { formatCurrency, formatDateShort, formatTime, getDayName } from '@/lib/format';
import { SKILL_LEVEL_KEY, SKILL_LEVEL_STYLE } from '@/lib/volleyball';
import { PlayerAvatar } from '@/components/PlayerAvatar';

const statusStyles: Record<string, string> = {
  Available: 'bg-green-100 text-green-800 border-green-200',
  'Almost Full': 'bg-amber-100 text-amber-800 border-amber-200',
  'Fully Booked': 'bg-red-100 text-red-700 border-red-200',
  'Booking Closed': 'bg-slate-100 text-slate-600 border-slate-200',
  Cancelled: 'bg-red-100 text-red-700 border-red-200',
};


const MAX_FACES = 5;

interface SessionCardProps {
  session: SessionWithCount;
  to: string;
  // Optional — only available to signed-in viewers (see fetchSessionExtras).
  roster?: CourtPlayer[];
  isPrivate?: boolean;
}

export function SessionCard({ session, to, roster, isPrivate }: SessionCardProps) {
  const { t } = useTranslation();
  const status = getSessionStatus(session, session.confirmed_count);
  const available = Math.max(0, session.maximum_capacity - session.confirmed_count);
  const canBook = status === 'Available' || status === 'Almost Full';
  const skill = session.skill_level || 'Open Level';
  const faces = roster?.slice(0, MAX_FACES) ?? [];
  const extra = (roster?.length ?? 0) - faces.length;

  return (
    <Link
      to={to}
      className="group flex flex-col overflow-hidden rounded-2xl border border-ink-600 bg-ink-800 transition-colors hover:border-vsb-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vsb-400"
    >
      <div className="relative h-20 bg-ink-700">
        <img src="/brand/court-horizontal.webp" alt="" loading="lazy" width={973} height={335} className="absolute inset-0 h-full w-full object-cover opacity-70" />
        <div className="relative flex flex-wrap items-start gap-1.5 p-3">
          <span className={`v2-chip ${SKILL_LEVEL_STYLE[skill]}`}>{t(SKILL_LEVEL_KEY[skill])}</span>
          {isPrivate !== undefined && (
            <span className="v2-chip bg-ink/85 text-chalk">
              {isPrivate && <Lock className="mr-1 h-3 w-3" aria-hidden />}
              {isPrivate ? t('v2.session.private') : t('v2.session.public')}
            </span>
          )}
          {status !== 'Available' && (
            <span className={`ml-auto inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusStyles[status]}`}>
              {t(SESSION_STATUS_KEY[status] || status)}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-display text-xl font-bold uppercase leading-tight tracking-wide text-chalk group-hover:text-white">{session.title}</h3>

        <dl className="mt-2 space-y-1.5 text-sm text-slate-300">
          <div className="flex items-start gap-2">
            <dt className="sr-only">{t('sessionDetails.venueLabel')}</dt>
            <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted" aria-hidden />
            <dd className="min-w-0">
              <span className="block truncate">{session.venue_name}</span>
              {session.court_number && <span className="block text-xs text-muted">{session.court_number}</span>}
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="sr-only">{t('sessionDetails.dateLabel')}</dt>
            <CalendarDays className="h-4 w-4 flex-shrink-0 text-muted" aria-hidden />
            <dd>{getDayName(session.session_date)}, {formatDateShort(session.session_date)}</dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="sr-only">{t('sessionDetails.timeLabel')}</dt>
            <Clock className="h-4 w-4 flex-shrink-0 text-muted" aria-hidden />
            <dd>{formatTime(session.start_time)} – {formatTime(session.end_time)}</dd>
          </div>
        </dl>

        <div className="mt-4 flex items-center justify-between gap-3">
          {faces.length > 0 ? (
            <div className="flex -space-x-2" aria-hidden>
              {faces.map((p, i) => <PlayerAvatar key={i} name={p.display_name} guest={p.is_guest} size="xs" />)}
              {extra > 0 && (
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-ink-600 text-[10px] font-bold text-chalk ring-2 ring-ink">+{extra}</span>
              )}
            </div>
          ) : (
            <span className="text-xs text-muted">{roster ? t('v2.session.beFirst') : ''}</span>
          )}
          <div className="text-right">
            <p className="text-sm font-semibold text-chalk">{t('v2.session.confirmedOfCapacity', { confirmed: session.confirmed_count, max: session.maximum_capacity })}</p>
            {canBook && (
              <p className={`text-xs ${available <= 3 ? 'font-semibold text-amber-400' : 'text-muted'}`}>{t('v2.session.openSlots', { count: available })}</p>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-ink-600 pt-4">
          <p className="text-chalk">
            <span className="font-display text-2xl font-bold">{session.price > 0 ? formatCurrency(session.price) : 'TBC'}</span>
            <span className="ml-1 text-xs text-muted">{t('v2.session.perPlayer')}</span>
          </p>
          <span className={`rounded-lg px-5 py-2 text-sm font-bold transition-colors ${
            canBook ? 'bg-vsb-500 text-white group-hover:bg-vsb-400' : 'bg-ink-600 text-slate-300'
          }`}>
            {canBook ? t('v2.session.join') : status === 'Fully Booked' ? t('sessions.waitlist') : t('sessions.view')}
          </span>
        </div>
      </div>
    </Link>
  );
}
