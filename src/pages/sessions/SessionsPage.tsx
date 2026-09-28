import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SlidersHorizontal } from 'lucide-react';
import { fetchSessionExtras, fetchSessionsWithCounts, getSessionStatus, type SessionExtras, type SessionWithCount } from '@/lib/sessions';
import { SKILL_LEVELS, SKILL_LEVEL_KEY } from '@/lib/volleyball';
import type { SkillLevel } from '@/types/database';
import { Spinner } from '@/components/LoadingScreen';
import { SessionCard } from '@/components/SessionCard';
import { CourtLines } from '@/components/vsb/CourtLines';

type Quick = 'all' | 'today' | 'week' | 'private' | SkillLevel;
const EMPTY = { venue: '', availability: '', date: '' };

function localISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function SessionsPage() {
  const { t } = useTranslation();
  const [sessions, setSessions] = useState<SessionWithCount[]>([]);
  const [extras, setExtras] = useState<Record<string, SessionExtras>>({});
  const [loading, setLoading] = useState(true);
  const [quick, setQuick] = useState<Quick>('all');
  const [filters, setFilters] = useState(EMPTY);
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    fetchSessionsWithCounts()
      .then((s) => {
        setSessions(s);
        // Avatars + private flag load after the grid so they never block it.
        fetchSessionExtras(s.map((x) => x.id)).then(setExtras).catch(() => {});
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const venues = [...new Set(sessions.map((s) => s.venue_name))];
  const today = localISO(new Date());
  const weekEnd = localISO(new Date(Date.now() + 6 * 86400000));

  const filtered = sessions.filter((s) => {
    if (quick === 'today' && s.session_date !== today) return false;
    if (quick === 'week' && (s.session_date < today || s.session_date > weekEnd)) return false;
    if (quick === 'private' && !extras[s.id]?.isPrivate) return false;
    if (SKILL_LEVELS.includes(quick as SkillLevel) && (s.skill_level || 'Open Level') !== quick) return false;
    if (filters.venue && s.venue_name !== filters.venue) return false;
    if (filters.date && s.session_date !== filters.date) return false;
    if (filters.availability) {
      const status = getSessionStatus(s, s.confirmed_count);
      if (filters.availability === 'available' && status !== 'Available') return false;
      if (filters.availability === 'almost' && status !== 'Almost Full') return false;
      if (filters.availability === 'booked' && status !== 'Fully Booked') return false;
    }
    return true;
  });

  const quickOptions: { key: Quick; label: string }[] = [
    { key: 'all', label: t('v2.sessions.quickAll') },
    { key: 'today', label: t('v2.sessions.quickToday') },
    { key: 'week', label: t('v2.sessions.quickWeek') },
    ...SKILL_LEVELS.map((l) => ({ key: l as Quick, label: t(SKILL_LEVEL_KEY[l]) })),
    { key: 'private', label: t('v2.session.private') },
  ];
  const secondaryActive = Object.values(filters).filter(Boolean).length;
  const labelClass = 'vsb-meta mb-1.5 block';

  return (
    <div className="bg-ink text-chalk">
      {/* Header */}
      <header className="vsb-gutter relative overflow-hidden border-b border-ink-600 pb-10 pt-12 lg:pb-14 lg:pt-20">
        <CourtLines opacity={0.06} />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="vsb-meta mb-4">{t('v2.sessions.meta')}</p>
            <h1 className="vsb-display text-[clamp(3rem,7vw,6.5rem)]">
              {t('v2.sessions.titleLine1')}<br /><span className="text-vsb-500">{t('v2.sessions.titleLine2')}</span>
            </h1>
          </div>
          {!loading && (
            <p className="font-display uppercase leading-none" aria-live="polite">
              <span className="block text-7xl font-extrabold text-chalk lg:text-8xl">{sessions.length}</span>
              <span className="text-sm font-bold tracking-[0.2em] text-muted">{t('v2.sessions.upcomingCount', { count: sessions.length })}</span>
            </p>
          )}
        </div>
      </header>

      {/* Filters */}
      <div className="vsb-gutter sticky top-16 z-30 border-b border-ink-600 bg-ink/95 backdrop-blur-sm">
        <div className="flex items-center gap-6">
          <div className="-mb-px flex flex-1 gap-6 overflow-x-auto [scrollbar-width:none]" role="group" aria-label={t('v2.sessions.quickLabel')}>
            {quickOptions.map((o) => (
              <button key={o.key} onClick={() => setQuick(o.key)} aria-pressed={quick === o.key} className="vsb-tab py-4">
                {o.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowMore((v) => !v)}
            aria-expanded={showMore}
            aria-controls="more-filters"
            className="flex flex-shrink-0 items-center gap-2 py-4 text-sm font-semibold uppercase tracking-wider text-muted hover:text-chalk lg:hidden"
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">{t('v2.sessions.moreFilters')}</span>
            {secondaryActive > 0 && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-vsb-600 text-[11px] text-white">{secondaryActive}</span>}
          </button>
        </div>
        <div id="more-filters" className={`${showMore ? 'grid' : 'hidden'} gap-4 lg:grid border-t border-ink-600 py-4 sm:grid-cols-3 lg:grid-cols-[repeat(3,minmax(0,16rem))_auto] lg:items-end`}>
          <div>
            <label htmlFor="f-venue" className={labelClass}>{t('sessions.venue')}</label>
            <select id="f-venue" className="v2-input" value={filters.venue} onChange={(e) => setFilters({ ...filters, venue: e.target.value })}>
              <option value="">{t('sessions.allVenues')}</option>
              {venues.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="f-date" className={labelClass}>{t('sessions.date')}</label>
            <input id="f-date" type="date" className="v2-input [color-scheme:dark]" value={filters.date} onChange={(e) => setFilters({ ...filters, date: e.target.value })} />
          </div>
          <div>
            <label htmlFor="f-avail" className={labelClass}>{t('sessions.availability')}</label>
            <select id="f-avail" className="v2-input" value={filters.availability} onChange={(e) => setFilters({ ...filters, availability: e.target.value })}>
              <option value="">{t('sessions.any')}</option>
              <option value="available">{t('sessionStatus.available')}</option>
              <option value="almost">{t('sessionStatus.almostFull')}</option>
              <option value="booked">{t('sessionStatus.fullyBooked')}</option>
            </select>
          </div>
          {secondaryActive > 0 && (
            <button onClick={() => setFilters(EMPTY)} className="justify-self-start py-2 text-sm font-semibold uppercase tracking-wider text-vsb-400 hover:text-vsb-300">
              {t('v2.sessions.clearFilters')}
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="vsb-gutter py-10 lg:py-14">
        {loading ? (
          <div className="flex min-h-[30vh] items-center justify-center"><Spinner className="h-8 w-8 text-vsb-500" /></div>
        ) : filtered.length === 0 ? (
          <div className="border-y border-ink-600 py-16">
            <h2 className="font-display text-4xl font-extrabold uppercase text-chalk">{t('sessions.noSessionsFound')}</h2>
            <p className="mt-2 text-slate-400">{t('sessions.tryAdjusting')}</p>
          </div>
        ) : (
          <>
            <p className="vsb-meta mb-6" aria-live="polite">{t('v2.sessions.showing', { count: filtered.length })}</p>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filtered.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  to={`/sessions/${session.id}`}
                  roster={extras[session.id]?.roster}
                  isPrivate={extras[session.id]?.isPrivate}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
