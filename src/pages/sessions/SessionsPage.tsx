import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageCircle } from 'lucide-react';
import { fetchSessionExtras, fetchSessionsWithCounts, getSessionStatus, type SessionExtras, type SessionWithCount } from '@/lib/sessions';
import { fetchClubSettings } from '@/lib/settings';
import { vsbAssets } from '@/lib/vsbAssets';
import type { ClubSettings } from '@/types/database';
import { SessionRow } from '@/components/vsb/SessionRow';
import { FixtureSkeleton } from '@/components/vsb/Skeletons';

// SESSIONS: fixtures. Real upcoming games grouped by week (this week, next
// week, later), each one a wide fixture row. Sessions are public or private,
// so that's the only filter.
type Filter = 'all' | 'public' | 'private';
type Bucket = 'thisWeek' | 'nextWeek' | 'later';

// Monday of the week containing `d` (local time), as YYYY-MM-DD.
function weekStart(d: Date) {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return m;
}
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function bucketOf(date: string, now = new Date()): Bucket {
  const thisMon = weekStart(now);
  const nextMon = new Date(thisMon); nextMon.setDate(nextMon.getDate() + 7);
  const afterNext = new Date(thisMon); afterNext.setDate(afterNext.getDate() + 14);
  if (date < ymd(nextMon)) return 'thisWeek';
  if (date < ymd(afterNext)) return 'nextWeek';
  return 'later';
}

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
  const openCount = sessions.filter((s) => {
    const st = getSessionStatus(s, s.confirmed_count);
    return st === 'Available' || st === 'Almost Full';
  }).length;

  const groups = (['thisWeek', 'nextWeek', 'later'] as Bucket[])
    .map((b) => ({ bucket: b, items: filtered.filter((s) => bucketOf(s.session_date) === b) }))
    .filter((g) => g.items.length > 0);

  const options: { key: Filter; label: string }[] = [
    { key: 'all', label: t('v2.sessions.quickAll') },
    { key: 'public', label: t('v2.session.public') },
    { key: 'private', label: t('v2.session.private') },
  ];
  const whatsapp = settings?.whatsapp_group_link && (
    <a href={settings.whatsapp_group_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 font-semibold text-green-400 hover:text-green-300">
      <MessageCircle className="h-5 w-5" aria-hidden /> {t('landing.joinWhatsappGroup')}
    </a>
  );

  return (
    <div className="bg-ink text-chalk">
      {/* Header: title, open count and the one filter, on the production court */}
      <header className="relative overflow-hidden border-b border-ink-600">
        <img src={vsbAssets.court.horizontal1024.src} alt="" width={1024} height={356} className="absolute inset-0 h-full w-full object-cover opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/85 to-ink/50" aria-hidden />
        <div className="vsb-gutter relative pt-10 lg:pt-14">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="vsb-meta mb-3">{t('v2.sessions.meta', { year: new Date().getFullYear() })}</p>
              <h1 className="vsb-display text-[clamp(2.75rem,6vw,5rem)]">
                {t('v2.sessions.titleLine1')} <span className="text-vsb-500">{t('v2.sessions.titleLine2')}</span>
              </h1>
            </div>
            {!loading && (
              <p className="font-display uppercase leading-none" aria-live="polite">
                <span className="block text-6xl font-extrabold text-chalk">{String(openCount).padStart(2, '0')}</span>
                <span className="text-sm font-bold tracking-[0.2em] text-muted">{t('v2.sessions.openCount', { count: openCount })}</span>
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
          <FixtureSkeleton />
        ) : filtered.length === 0 ? (
          <section className="border-y border-ink-600 py-10" aria-labelledby="no-games">
            <h2 id="no-games" className="font-display text-3xl font-extrabold uppercase leading-none text-chalk">{t('v2.sessions.noneTitle')}</h2>
            <p className="mt-2 max-w-xl text-slate-300">{filter !== 'all' ? t('sessions.tryAdjusting') : t('v2.sessions.newGamesWhere')}</p>
            {filter !== 'all' ? (
              <button onClick={() => setFilter('all')} className="hub-link mt-4">{t('v2.sessions.clearFilters')}</button>
            ) : whatsapp && <p className="mt-4">{whatsapp}</p>}
          </section>
        ) : (
          <div className="space-y-12">
            {groups.map((g) => (
              <section key={g.bucket} aria-labelledby={`wk-${g.bucket}`}>
                <h2 id={`wk-${g.bucket}`} className="mb-4 flex items-baseline gap-4 border-b border-ink-600 pb-3 font-display text-2xl font-extrabold uppercase tracking-wide text-chalk">
                  {t(`v2.sessions.bucket.${g.bucket}`)}
                  <span className="text-base font-bold text-muted">{g.items.length}</span>
                </h2>
                <ul className="space-y-4">
                  {g.items.map((session) => (
                    <li key={session.id}>
                      <SessionRow session={session} to={`/sessions/${session.id}`} roster={extras[session.id]?.roster} isPrivate={extras[session.id]?.isPrivate} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {/* The list ends plainly and says where new games appear. */}
            <p className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-ink-600 pt-6 text-slate-400">
              <span>{t('v2.sessions.thatsAll')}. {t('v2.sessions.newGamesWhere')}</span>
              {whatsapp}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
