import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Lock } from 'lucide-react';
import { getSessionStatus, type SessionWithCount, type CourtPlayer } from '@/lib/sessions';
import { dateParts, formatCurrency, formatTime } from '@/lib/format';
import { SKILL_LEVEL_KEY, SKILL_LEVEL_STYLE } from '@/lib/volleyball';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { SessionStatusChip } from '@/components/vsb/SessionStatusChip';
import { CapacityIndicator } from '@/components/vsb/CapacityIndicator';
import { sessionImage } from '@/lib/sessionMedia';

const MAX_FACES = 5;

interface SessionCardProps {
  session: SessionWithCount;
  to: string;
  // Optional — only available to signed-in viewers (see fetchSessionExtras).
  roster?: CourtPlayer[];
  isPrivate?: boolean;
}

// PLACE + PEOPLE + AVAILABILITY. The court artwork stands in for venue
// photography (none is approved) and never carries data itself.
export function SessionCard({ session, to, roster, isPrivate }: SessionCardProps) {
  const { t, i18n } = useTranslation();
  const status = getSessionStatus(session, session.confirmed_count);
  const canBook = status === 'Available' || status === 'Almost Full';
  const skill = session.skill_level || 'Open Level';
  const faces = roster?.slice(0, MAX_FACES) ?? [];
  const extra = (roster?.length ?? 0) - faces.length;
  const d = dateParts(session.session_date, i18n.language);

  return (
    <Link
      to={to}
      className="group flex flex-col overflow-hidden rounded-md border border-ink-600 bg-ink-800 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-vsb-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vsb-400"
    >
      {/* Place */}
      <div className="relative h-36 overflow-hidden bg-ink-700">
        <img src={sessionImage(session.cover_image_path)} alt="" loading="lazy" width={973} height={335}
          className="absolute inset-0 h-full w-full object-cover opacity-80 transition-transform duration-500 group-hover:scale-[1.03]" />
        <div className="absolute inset-0 bg-ink/40" aria-hidden />
        <div className="relative flex h-full items-end justify-between p-4">
          <div className="leading-none">
            <p className="font-display text-sm font-bold tracking-[0.2em] text-vsb-300">{d.weekday}</p>
            <p className="font-display text-5xl font-extrabold text-chalk">{d.day}</p>
            <p className="font-display text-sm font-bold tracking-[0.2em] text-chalk">{d.month}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span className={`v2-chip uppercase tracking-wider ${SKILL_LEVEL_STYLE[skill]}`}>{t(SKILL_LEVEL_KEY[skill])}</span>
            {isPrivate && (
              <span className="v2-chip bg-ink text-chalk uppercase tracking-wider"><Lock className="mr-1 h-3 w-3" aria-hidden />{t('v2.session.private')}</span>
            )}
            <SessionStatusChip status={status} />
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-2xl font-extrabold uppercase leading-tight tracking-wide text-chalk">{session.title}</h3>
        <p className="mt-1 text-sm text-slate-300">
          {t('v2.session.timeRange', { start: formatTime(session.start_time), end: formatTime(session.end_time) })}
        </p>
        <p className="truncate text-sm text-muted">
          {[session.venue_name, session.court_number].filter(Boolean).join(' · ')}
        </p>

        {/* People */}
        <div className="mt-5">
          <p className="vsb-meta mb-2">{t('v2.whosPlaying.title')}</p>
          {faces.length > 0 ? (
            <div className="flex items-center -space-x-2" role="img" aria-label={t('v2.session.playersJoined', { count: roster?.length ?? 0 })}>
              {faces.map((p, i) => <PlayerAvatar key={i} name={p.display_name} src={p.avatar_url} guest={p.is_guest} size="sm" />)}
              {extra > 0 && (
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-ink-600 text-xs font-bold text-chalk ring-2 ring-ink">+{extra}</span>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted">{roster ? t('v2.session.beFirst') : t('v2.session.signInToSee')}</p>
          )}
        </div>

        {/* Availability */}
        <div className="mt-5">
          <CapacityIndicator confirmed={session.confirmed_count} max={session.maximum_capacity} size="sm" />
        </div>

        <div className="mt-auto flex items-end justify-between pt-5">
          <p className="text-chalk">
            <span className="font-display text-3xl font-extrabold">{session.price > 0 ? formatCurrency(session.price).replace(/\.00$/, '') : 'TBC'}</span>
            <span className="ml-1 text-xs text-muted">{t('v2.session.perPlayer')}</span>
          </p>
          <span className={`inline-flex items-center gap-1.5 font-display text-lg font-bold uppercase tracking-wider ${
            canBook ? 'text-vsb-400 group-hover:text-vsb-300' : 'text-muted'
          }`}>
            {canBook ? t('v2.session.join') : status === 'Fully Booked' ? t('sessions.waitlist') : t('sessions.view')}
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </span>
        </div>
      </div>
    </Link>
  );
}
