import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchSessionExtras, fetchSessionsWithCounts, type SessionExtras, type SessionWithCount } from '@/lib/sessions';
import { Spinner } from '@/components/LoadingScreen';
import { SessionCard } from '@/components/SessionCard';
import { CourtLines } from '@/components/vsb/CourtLines';

// Sessions are either public or private, so that's the only filter.
type Filter = 'all' | 'public' | 'private';

export default function SessionsPage() {
  const { t } = useTranslation();
  const [sessions, setSessions] = useState<SessionWithCount[]>([]);
  const [extras, setExtras] = useState<Record<string, SessionExtras>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');

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

  const filtered = sessions.filter((s) => {
    const priv = extras[s.id]?.isPrivate;
    if (filter === 'private') return priv === true;
    if (filter === 'public') return priv !== true;
    return true;
  });

  const options: { key: Filter; label: string }[] = [
    { key: 'all', label: t('v2.sessions.quickAll') },
    { key: 'public', label: t('v2.session.public') },
    { key: 'private', label: t('v2.session.private') },
  ];

  return (
    <div className="bg-ink text-chalk">
      {/* Header */}
      <header className="vsb-gutter relative overflow-hidden border-b border-ink-600 pt-12 lg:pt-20">
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
        <div className="relative -mb-px mt-10 flex gap-8" role="group" aria-label={t('v2.sessions.quickLabel')}>
          {options.map((o) => (
            <button key={o.key} onClick={() => setFilter(o.key)} aria-pressed={filter === o.key} className="vsb-tab py-4 text-base">
              {o.label}
            </button>
          ))}
        </div>
      </header>

      {/* Results */}
      <div className="vsb-gutter py-10 lg:py-14">
        {loading ? (
          <div className="flex min-h-[30vh] items-center justify-center"><Spinner className="h-8 w-8 text-vsb-500" /></div>
        ) : filtered.length === 0 ? (
          <div className="border-y border-ink-600 py-16">
            <h2 className="font-display text-4xl font-extrabold uppercase text-chalk">{t('sessions.noSessionsFound')}</h2>
            <p className="mt-2 text-slate-400">{filter === 'all' ? t('landing.noOpenSessions') : t('sessions.tryAdjusting')}</p>
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
