import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Lock } from 'lucide-react';
import { getSessionStatus, type SessionWithCount, type CourtPlayer } from '@/lib/sessions';
import { dateParts, formatCurrency, formatTime } from '@/lib/format';
import { SKILL_LEVEL_KEY, SKILL_LEVEL_STYLE } from '@/lib/volleyball';
import { sessionImage } from '@/lib/sessionMedia';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { SessionStatusChip } from '@/components/vsb/SessionStatusChip';
import { CapacityIndicator } from '@/components/vsb/CapacityIndicator';

const MAX_FACES = 7;

interface SessionRowProps {
  session: SessionWithCount;
  to: string;
  roster?: CourtPlayer[];
  isPrivate?: boolean;
}

// A session as one full-width row: WHEN · WHAT/WHERE · WHO · AVAILABILITY · PRICE.
// Stacks into a single column on phones.
export function SessionRow({ session, to, roster, isPrivate }: SessionRowProps) {
  const { t, i18n } = useTranslation();
  const status = getSessionStatus(session, session.confirmed_count);
  const canBook = status === 'Available' || status === 'Almost Full';
  const skill = session.skill_level || 'Open Level';
  const faces = roster?.slice(0, MAX_FACES) ?? [];
  const extra = (roster?.length ?? 0) - faces.length;
  const d = dateParts(session.session_date, i18n.language);
  const action = canBook ? t('v2.session.join') : status === 'Fully Booked' ? t('sessions.waitlist') : t('sessions.view');

  return (
    <Link
      to={to}
      className="group grid overflow-hidden border border-ink-600 bg-ink-850 transition-colors hover:border-vsb-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vsb-400 md:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[18rem_minmax(0,1.3fr)_minmax(0,1fr)_12rem]"
    >
      {/* WHEN, on the court */}
      <div className="relative min-h-[9rem] overflow-hidden">
        <img src={sessionImage(session.cover_image_path)} alt="" loading="lazy" decoding="async" width={1024} height={356}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        <div className="absolute inset-0 bg-ink/45" aria-hidden />
        <p className="relative p-5 font-display uppercase leading-none">
          <span className="block text-sm font-bold tracking-[0.2em] text-vsb-300">{d.weekday}</span>
          <span className="block text-6xl font-extrabold text-chalk">{d.day}</span>
          <span className="block text-sm font-bold tracking-[0.2em] text-chalk">{d.month}</span>
        </p>
      </div>

      {/* WHAT + WHERE */}
      <div className="flex min-w-0 flex-col justify-center gap-2 p-5 xl:border-r xl:border-ink-600">
        <div className="flex flex-wrap gap-2">
          <span className={`v2-chip uppercase tracking-wider ${SKILL_LEVEL_STYLE[skill]}`}>{t(SKILL_LEVEL_KEY[skill])}</span>
          {isPrivate && <span className="v2-chip bg-ink uppercase tracking-wider text-chalk"><Lock className="mr-1 h-3 w-3" aria-hidden />{t('v2.session.private')}</span>}
          <SessionStatusChip status={status} />
        </div>
        <h3 className="font-display text-3xl font-extrabold uppercase leading-none tracking-wide text-chalk">{session.title}</h3>
        <p className="text-slate-300">{t('v2.session.timeRange', { start: formatTime(session.start_time), end: formatTime(session.end_time) })}</p>
        <p className="truncate text-sm text-muted">{[session.venue_name, session.court_number].filter(Boolean).join(' · ')}</p>
      </div>

      {/* WHO + AVAILABILITY */}
      <div className="flex flex-col justify-center gap-4 border-t border-ink-600 p-5 md:col-span-2 xl:col-span-1 xl:border-r xl:border-t-0">
        <div>
          <p className="vsb-meta mb-2">{t('v2.whosPlaying.title')}</p>
          {faces.length > 0 ? (
            <div className="flex items-center -space-x-2" role="img" aria-label={t('v2.session.playersJoined', { count: roster?.length ?? 0 })}>
              {faces.map((p, i) => (
                <PlayerAvatar key={i} name={p.display_name} src={p.avatar_url} guest={p.is_guest} size="sm" />
              ))}
              {extra > 0 && <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-ink-600 text-xs font-bold text-chalk ring-2 ring-ink">+{extra}</span>}
            </div>
          ) : (
            <p className="text-sm text-muted">{roster ? t('v2.session.beFirst') : t('v2.session.signInToSee')}</p>
          )}
        </div>
        <CapacityIndicator confirmed={session.confirmed_count} max={session.maximum_capacity} size="sm" />
      </div>

      {/* PRICE + ACTION */}
      <div className="flex items-center justify-between gap-4 border-t border-ink-600 p-5 md:col-span-2 xl:col-span-1 xl:flex-col xl:items-start xl:justify-center xl:border-t-0">
        <p className="whitespace-nowrap text-chalk">
          <span className="font-display text-4xl font-extrabold">{session.price > 0 ? formatCurrency(session.price).replace(/\.00$/, '') : 'TBC'}</span>
          <span className="ml-1 text-xs text-muted">{t('v2.session.perPlayer')}</span>
        </p>
        <span className={`inline-flex items-center gap-1.5 font-display text-lg font-bold uppercase tracking-wider ${canBook ? 'text-vsb-400 group-hover:text-vsb-300' : 'text-muted'}`}>
          {action} <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </span>
      </div>
    </Link>
  );
}
