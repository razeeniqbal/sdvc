import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchSessionExtras, fetchSessionsWithCounts, getSessionStatus, type SessionExtras, type SessionWithCount } from '@/lib/sessions';
import { SKILL_LEVELS, SKILL_LEVEL_KEY } from '@/lib/volleyball';
import { Spinner } from '@/components/LoadingScreen';
import { SessionCard } from '@/components/SessionCard';

const EMPTY_FILTERS = { venue: '', availability: '', date: '', skill: '', type: '' };

export default function SessionsPage() {
  const { t } = useTranslation();
  const [sessions, setSessions] = useState<SessionWithCount[]>([]);
  const [extras, setExtras] = useState<Record<string, SessionExtras>>({});
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(EMPTY_FILTERS);

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

  const filtered = sessions.filter((s) => {
    if (filters.venue && s.venue_name !== filters.venue) return false;
    if (filters.date && s.session_date !== filters.date) return false;
    if (filters.skill && (s.skill_level || 'Open Level') !== filters.skill) return false;
    if (filters.type) {
      const priv = extras[s.id]?.isPrivate;
      if (priv === undefined) return true;
      if (filters.type === 'private' && !priv) return false;
      if (filters.type === 'public' && priv) return false;
    }
    if (filters.availability) {
      const status = getSessionStatus(s, s.confirmed_count);
      if (filters.availability === 'available' && status !== 'Available') return false;
      if (filters.availability === 'almost' && status !== 'Almost Full') return false;
      if (filters.availability === 'booked' && status !== 'Fully Booked') return false;
    }
    return true;
  });

  const hasFilters = Object.values(filters).some(Boolean);
  const labelClass = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-muted';

  return (
    <div className="bg-ink">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <h1 className="v2-heading text-4xl sm:text-5xl">{t('sessions.title')}</h1>
        <p className="mt-1 text-sm text-slate-400">{t('sessions.subtitle')}</p>

        <div className="v2-surface mt-6 grid grid-cols-2 gap-3 p-4 lg:grid-cols-5">
          <div>
            <label htmlFor="f-date" className={labelClass}>{t('sessions.date')}</label>
            <input id="f-date" type="date" className="v2-input [color-scheme:dark]" value={filters.date} onChange={(e) => setFilters({ ...filters, date: e.target.value })} />
          </div>
          <div>
            <label htmlFor="f-skill" className={labelClass}>{t('v2.sessions.skillLevel')}</label>
            <select id="f-skill" className="v2-input" value={filters.skill} onChange={(e) => setFilters({ ...filters, skill: e.target.value })}>
              <option value="">{t('v2.sessions.allSkillLevels')}</option>
              {SKILL_LEVELS.map((l) => <option key={l} value={l}>{t(SKILL_LEVEL_KEY[l])}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="f-venue" className={labelClass}>{t('sessions.venue')}</label>
            <select id="f-venue" className="v2-input" value={filters.venue} onChange={(e) => setFilters({ ...filters, venue: e.target.value })}>
              <option value="">{t('sessions.allVenues')}</option>
              {venues.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="f-type" className={labelClass}>{t('v2.sessions.sessionType')}</label>
            <select id="f-type" className="v2-input" value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}>
              <option value="">{t('sessions.any')}</option>
              <option value="public">{t('v2.session.public')}</option>
              <option value="private">{t('v2.session.private')}</option>
            </select>
          </div>
          <div className="col-span-2 lg:col-span-1">
            <label htmlFor="f-avail" className={labelClass}>{t('sessions.availability')}</label>
            <select id="f-avail" className="v2-input" value={filters.availability} onChange={(e) => setFilters({ ...filters, availability: e.target.value })}>
              <option value="">{t('sessions.any')}</option>
              <option value="available">{t('sessionStatus.available')}</option>
              <option value="almost">{t('sessionStatus.almostFull')}</option>
              <option value="booked">{t('sessionStatus.fullyBooked')}</option>
            </select>
          </div>
        </div>
        {hasFilters && (
          <button onClick={() => setFilters(EMPTY_FILTERS)} className="mt-2 text-sm font-semibold text-vsb-400 hover:text-vsb-300">
            {t('v2.sessions.clearFilters')}
          </button>
        )}

        {loading ? (
          <div className="flex min-h-[40vh] items-center justify-center"><Spinner className="h-8 w-8 text-vsb-500" /></div>
        ) : filtered.length === 0 ? (
          <div className="v2-surface mt-6 py-16 text-center">
            <h2 className="font-display text-2xl font-bold uppercase text-chalk">{t('sessions.noSessionsFound')}</h2>
            <p className="mt-1 text-sm text-slate-400">{t('sessions.tryAdjusting')}</p>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
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
        )}
      </div>
    </div>
  );
}
