import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Search } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { dateParts, formatCurrency, formatTime } from '@/lib/format';
import { byDateAsc, fetchMyGames, gameState, isUpcoming, type MyGame } from '@/lib/myGames';
import { SKILL_LEVEL_KEY } from '@/lib/volleyball';
import { GameStateLabel } from '@/components/vsb/GameStateLabel';
import { ListSkeleton } from '@/components/vsb/Skeletons';
import { vsbAssets } from '@/lib/vsbAssets';

// MY GAMES (/bookings): the player's volleyball journey as one timeline.
// Upcoming leads with the next game on court; below it, every past game
// grouped by year and month like a fixture list. No tabs: upcoming and past
// are two parts of the same page. Same booking data and route as before.

export default function MyBookingsPage() {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();
  const [params] = useSearchParams();
  const [games, setGames] = useState<MyGame[] | null>(null);
  const [showCancelled, setShowCancelled] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (profile) fetchMyGames(profile.id).then(setGames).catch(() => setGames([]));
  }, [profile]);

  // Older links (?view=past) land on the history.
  useEffect(() => {
    if (games && params.get('view') === 'past') document.getElementById('history')?.scrollIntoView();
  }, [games, params]);

  const lang = i18n.language;
  const upcoming = (games || []).filter((g) => isUpcoming(g)).sort(byDateAsc);
  const q = search.trim().toLowerCase();
  const pastAll = (games || []).filter((g) => !isUpcoming(g));
  const past = pastAll
    .filter((g) => showCancelled || gameState(g) !== 'cancelled')
    .filter((g) => !q || g.session.title.toLowerCase().includes(q) || g.booking_reference.toLowerCase().includes(q) || g.session.venue_name.toLowerCase().includes(q))
    .sort(byDateAsc)
    .reverse();
  const next = upcoming.find((g) => !g.is_guest) || upcoming[0];
  const rest = upcoming.filter((g) => g !== next);
  const playedCount = pastAll.filter((g) => gameState(g) === 'played' && !g.is_guest).length;

  return (
    <div className="bg-ink text-chalk">
      <header className="vsb-gutter relative overflow-hidden border-b border-ink-600 py-12 lg:py-16">
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="vsb-meta mb-4">{t('v2.games.meta')}</p>
            <h1 className="vsb-display text-[clamp(3rem,7vw,6rem)]">{t('v2.games.title')}</h1>
          </div>
          {games && (
            <dl className="flex gap-10 font-display uppercase leading-none">
              <div className="flex flex-col-reverse"><dt className="mt-1 text-sm font-bold tracking-[0.2em] text-muted">{t('v2.myVsb.statUpcoming')}</dt><dd className="text-5xl font-extrabold">{String(upcoming.length).padStart(2, '0')}</dd></div>
              <div className="flex flex-col-reverse"><dt className="mt-1 text-sm font-bold tracking-[0.2em] text-muted">{t('v2.games.state.played')}</dt><dd className="text-5xl font-extrabold">{String(playedCount).padStart(2, '0')}</dd></div>
            </dl>
          )}
        </div>
      </header>

      {!games ? (
        <div className="vsb-gutter py-10"><ListSkeleton rows={5} /></div>
      ) : games.length === 0 ? (
        <section className="vsb-gutter py-14">
          <div className="border-y border-ink-600 py-12">
            <p className="font-display text-4xl font-extrabold uppercase leading-none text-chalk">{t('v2.myVsb.storyStarts')}</p>
            <Link to="/sessions" className="v2-btn-primary mt-6 font-display uppercase tracking-wider">{t('v2.landing.findGame')} <ArrowRight className="h-4 w-4" aria-hidden /></Link>
          </div>
        </section>
      ) : (
        <>
          {/* ===== Upcoming ===== */}
          <section aria-labelledby="upcoming-heading" className="vsb-section">
            <h2 id="upcoming-heading" className="vsb-display mb-6 text-3xl sm:text-4xl">{t('v2.games.upcoming')}</h2>
            {upcoming.length === 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-4 border-y border-ink-600 py-8">
                <p className="font-display text-2xl font-bold uppercase text-chalk">{t('v2.myVsb.noUpcoming')}</p>
                <Link to="/sessions" className="hub-link">{t('v2.landing.findGame')} <ArrowRight className="h-4 w-4" aria-hidden /></Link>
              </div>
            ) : (
              <div className="space-y-8">
                {next && <FeaturedGame game={next} lang={lang} />}
                {rest.length > 0 && <Timeline games={rest} lang={lang} />}
              </div>
            )}
          </section>

          {/* ===== History, by year and month ===== */}
          <section id="history" aria-labelledby="history-heading" className="vsb-section scroll-mt-16 border-t border-ink-600">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <h2 id="history-heading" className="vsb-display text-3xl sm:text-4xl">{t('v2.games.history')}</h2>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                <label className="relative block w-full sm:w-72">
                  <span className="sr-only">{t('myBookings.searchPlaceholder')}</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
                  <input type="search" placeholder={t('v2.games.search')} className="v2-input !py-2.5 !pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
                  <input type="checkbox" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} className="h-4 w-4 accent-[#168BFF]" />
                  {t('v2.games.showCancelled')}
                </label>
              </div>
            </div>
            {past.length === 0 ? (
              <p className="border-y border-ink-600 py-8 font-display text-2xl font-bold uppercase tracking-wide text-slate-300">
                {q ? t('v2.games.noMatch') : t('v2.myVsb.storyStarts')}
              </p>
            ) : (
              <Timeline games={past} lang={lang} withYears />
            )}
          </section>
        </>
      )}
    </div>
  );
}

// Games grouped by month (and year, for history), each a fixture row.
function Timeline({ games, lang, withYears = false }: { games: MyGame[]; lang: string; withYears?: boolean }) {
  const loc = lang === 'ms' ? 'ms-MY' : 'en-MY';
  const groups: { year: string; month: string; key: string; items: MyGame[] }[] = [];
  for (const g of games) {
    const key = g.session.session_date.slice(0, 7);
    let grp = groups[groups.length - 1];
    if (!grp || grp.key !== key) {
      const d = new Date(`${key}-01T00:00:00`);
      grp = { key, year: key.slice(0, 4), month: d.toLocaleDateString(loc, { month: 'long' }), items: [] };
      groups.push(grp);
    }
    grp.items.push(g);
  }
  return (
    <div className="space-y-10">
      {groups.map((grp, i) => (
        <div key={grp.key}>
          {withYears && (i === 0 || groups[i - 1].year !== grp.year) && (
            <p className="mb-4 font-display text-6xl font-extrabold leading-none text-chalk/90">{grp.year}</p>
          )}
          <h3 className="flex items-center gap-4 font-display text-sm font-bold uppercase tracking-[0.25em] text-muted">
            {grp.month}{!withYears && ` ${grp.year}`}
            <span className="h-px flex-1 bg-ink-600" aria-hidden />
          </h3>
          <ol className="divide-y divide-ink-700">
            {grp.items.map((g) => <GameRow key={g.id} game={g} lang={lang} />)}
          </ol>
        </div>
      ))}
    </div>
  );
}

function GameRow({ game: g, lang }: { game: MyGame; lang: string }) {
  const { t } = useTranslation();
  const d = dateParts(g.session.session_date, lang);
  const level = g.session.skill_level || 'Open Level';
  return (
    <li>
      <Link to={`/bookings/${g.id}`} className="group grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-4 py-4 hover:bg-ink-850 sm:grid-cols-[4.5rem_minmax(0,1fr)_minmax(0,14rem)_9rem_1.25rem]">
        <span className="text-center font-display uppercase leading-none">
          <span className="block text-3xl font-extrabold text-chalk">{String(d.day).padStart(2, '0')}</span>
          <span className="text-xs font-bold tracking-wider text-muted">{d.weekday}</span>
        </span>
        <span className="min-w-0">
          <span className="block truncate font-display text-xl font-bold uppercase tracking-wide text-chalk">{g.session.title}</span>
          <span className="block truncate text-sm text-muted">
            {formatTime(g.session.start_time)} · {g.session.venue_name}
            {g.is_guest && g.guest_name && <> · {t('myBookings.bookingFor', { name: g.guest_name })}</>}
            {g.booked_by_friend && <> · {t('v2.games.friendBooked')}</>}
          </span>
        </span>
        <span className="hidden truncate font-display text-sm font-bold uppercase tracking-wider text-slate-400 sm:block">{t(SKILL_LEVEL_KEY[level])}</span>
        <span className="justify-self-end sm:justify-self-start"><GameStateLabel state={gameState(g)} /></span>
        <ArrowRight className="hidden h-5 w-5 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-chalk sm:block" aria-hidden />
      </Link>
    </li>
  );
}

function FeaturedGame({ game, lang }: { game: MyGame; lang: string }) {
  const { t } = useTranslation();
  const d = dateParts(game.session.session_date, lang);
  const pending = game.booking_status === 'Pending Payment';
  const amount = game.payment_status !== 'Paid' ? game.session.price : game.total_amount;
  return (
    <Link to={`/bookings/${game.id}`} className="group relative grid overflow-hidden border border-ink-600 transition-colors hover:border-vsb-500 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div className="relative min-h-[14rem] overflow-hidden">
        <img src={vsbAssets.court.horizontal1024.src} alt="" width={1024} height={356} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-transparent" aria-hidden />
        <p className="absolute bottom-5 left-6 font-display uppercase leading-none" aria-hidden>
          <span className="block text-lg font-bold tracking-[0.25em] text-vsb-300">{d.weekday}</span>
          <span className="block text-8xl font-extrabold text-chalk">{d.day}</span>
          <span className="block text-lg font-bold tracking-[0.25em] text-chalk">{d.month}</span>
        </p>
      </div>
      <div className="flex flex-col justify-between gap-6 bg-ink-850 p-6 lg:p-8">
        <div>
          <p className="vsb-meta mb-3">{t('v2.myVsb.nextOnCourt')}</p>
          <GameStateLabel state={pending ? 'awaiting-payment' : 'upcoming'} />
          <p className="mt-3 font-display text-4xl font-extrabold uppercase leading-none tracking-wide text-chalk">{game.session.title}</p>
          <p className="mt-3 text-lg text-slate-300">{t('v2.session.timeRange', { start: formatTime(game.session.start_time), end: formatTime(game.session.end_time) })}</p>
          <p className="text-slate-400">{[game.session.venue_name, game.session.court_number].filter(Boolean).join(' · ')}</p>
          {pending && <p className="mt-4 text-sm text-amber-300">{t('v2.games.payHint', { amount: amount > 0 ? formatCurrency(amount) : 'TBC' })}</p>}
        </div>
        <span className="inline-flex items-center gap-1.5 font-display text-lg font-bold uppercase tracking-wider text-vsb-400 group-hover:text-vsb-300">
          {t('v2.myVsb.viewGame')} <ArrowRight className="h-5 w-5" aria-hidden />
        </span>
      </div>
    </Link>
  );
}
