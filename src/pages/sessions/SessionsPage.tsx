import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageCircle } from 'lucide-react';
import { fetchSessionExtras, fetchSessionsWithCounts, type SessionExtras, type SessionWithCount } from '@/lib/sessions';
import { fetchClubSettings } from '@/lib/settings';
import { vsbAssets } from '@/lib/vsbAssets';
import type { ClubSettings } from '@/types/database';
import { Spinner } from '@/components/LoadingScreen';
import { SessionRow } from '@/components/vsb/SessionRow';

// Sessions are either public or private, so that's the only filter.
type Filter = 'all' | 'public' | 'private';

export default function SessionsPage() {
  const { t } = useTranslation();
  const [sessions, setSessions] = useState<SessionWithCount[]>([]);
  const [extras, setExtras] = useState<Record<string, SessionExtras>>({});
  const [settings, setSettings] = useState<ClubSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    fetchClubSettings().then(setSettings).catch(() => {});
    fetchSessionsWithCounts()
      .then((s) => {
        setSessions(s);
        // Avatars + private flag load after the list so they never block it.
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
  const neutral = vsbAssets.states.neutral.sm;

  return (
    <div className="bg-ink text-chalk">
      {/* Header: title, count and the one filter, on the production court */}
      <header className="relative overflow-hidden border-b border-ink-600">
        <img src={vsbAssets.court.horizontal1024.src} alt="" width={1024} height={356} className="absolute inset-0 h-full w-full object-cover opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/85 to-ink/50" aria-hidden />
        <div className="vsb-gutter relative pt-10 lg:pt-14">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="vsb-meta mb-3">{t('v2.sessions.meta')}</p>
              <h1 className="vsb-display text-[clamp(2.75rem,6vw,5rem)]">
                {t('v2.sessions.titleLine1')} <span className="text-vsb-500">{t('v2.sessions.titleLine2')}</span>
              </h1>
            </div>
            {!loading && (
              <p className="font-display uppercase leading-none" aria-live="polite">
                <span className="block text-6xl font-extrabold text-chalk">{sessions.length}</span>
                <span className="text-sm font-bold tracking-[0.2em] text-muted">{t('v2.sessions.upcomingCount', { count: sessions.length })}</span>
              </p>
            )}
          </div>
          <div className="relative -mb-px mt-8 flex gap-8" role="group" aria-label={t('v2.sessions.quickLabel')}>
            {options.map((o) => (
              <button key={o.key} onClick={() => setFilter(o.key)} aria-pressed={filter === o.key} className="vsb-tab py-4 text-base">
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="vsb-gutter py-8 lg:py-12">
        {loading ? (
          <div className="flex min-h-[30vh] items-center justify-center"><Spinner className="h-8 w-8 text-vsb-500" /></div>
        ) : (
          <>
            {filtered.length > 0 && (
              <ul className="space-y-4" aria-label={t('v2.sessions.showing', { count: filtered.length })}>
                {filtered.map((session) => (
                  <li key={session.id}>
                    <SessionRow session={session} to={`/sessions/${session.id}`} roster={extras[session.id]?.roster} isPrivate={extras[session.id]?.isPrivate} />
                  </li>
                ))}
              </ul>
            )}

            {/* Few or no games: say so plainly and point to where new ones appear */}
            {filtered.length < 3 && (
              <section className={`flex items-end gap-6 border-y border-ink-600 pr-2 ${filtered.length > 0 ? 'mt-10' : ''}`} aria-labelledby="more-games">
                <img src={neutral.src} alt="" width={neutral.width} height={neutral.height} loading="lazy" decoding="async" className="hidden h-44 w-auto self-end pt-4 sm:block" />
                <div className="flex-1 py-8">
                  <h2 id="more-games" className="font-display text-3xl font-extrabold uppercase leading-none text-chalk">
                    {filtered.length === 0 ? t('sessions.noSessionsFound') : t('v2.sessions.thatsAll')}
                  </h2>
                  <p className="mt-2 max-w-xl text-slate-300">
                    {filter !== 'all' && filtered.length === 0 ? t('sessions.tryAdjusting') : t('v2.sessions.newGamesWhere')}
                  </p>
                  {settings?.whatsapp_group_link && (
                    <a href={settings.whatsapp_group_link} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2 font-semibold text-green-400 hover:text-green-300">
                      <MessageCircle className="h-5 w-5" aria-hidden /> {t('landing.joinWhatsappGroup')}
                    </a>
                  )}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
