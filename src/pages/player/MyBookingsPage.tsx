import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Search } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { dateParts, formatCurrency, formatTime } from '@/lib/format';
import { byDateAsc, fetchMyGames, gameState, isUpcoming, type MyGame } from '@/lib/myGames';
import { Spinner } from '@/components/LoadingScreen';
import { GameStateLabel } from '@/components/vsb/GameStateLabel';
import { CourtLines } from '@/components/vsb/CourtLines';
import { vsbAssets } from '@/lib/vsbAssets';

// MY GAMES (/bookings) — the player's activity history. Upcoming leads with
// the next game on court; Past is a compact timeline. Same booking data and
// route as before; only the presentation and wording changed.

type View = 'upcoming' | 'past';

export default function MyBookingsPage() {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();
  const [params, setParams] = useSearchParams();
  const view: View = params.get('view') === 'past' ? 'past' : 'upcoming';
  const [games, setGames] = useState<MyGame[] | null>(null);
  const [showCancelled, setShowCancelled] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (profile) fetchMyGames(profile.id).then(setGames).catch(() => setGames([]));
  }, [profile]);

  if (!games) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Spinner className="h-8 w-8 text-vsb-500" /></div>;
  }

  const upcoming = games.filter((g) => isUpcoming(g)).sort(byDateAsc);
  const q = search.trim().toLowerCase();
  const past = games
    .filter((g) => !isUpcoming(g) && (showCancelled || gameState(g) !== 'cancelled'))
    .filter((g) => !q || g.session.title.toLowerCase().includes(q) || g.booking_reference.toLowerCase().includes(q))
    .sort(byDateAsc)
    .reverse();
  const next = upcoming.find((g) => !g.is_guest) || upcoming[0];
  const rest = upcoming.filter((g) => g !== next);

  const setView = (v: View) => setParams(v === 'upcoming' ? {} : { view: v }, { replace: true });

  return (
    <div className="bg-ink text-chalk">
      <header className="vsb-gutter relative overflow-hidden border-b border-ink-600 pb-0 pt-12 lg:pt-16">
        <CourtLines opacity={0.05} />
        <div className="relative">
          <p className="vsb-meta mb-4">{t('v2.games.meta')}</p>
          <h1 className="vsb-display text-[clamp(3rem,7vw,6rem)]">{t('v2.games.title')}</h1>
          <div className="-mb-px mt-8 flex gap-8" role="group" aria-label={t('v2.games.viewLabel')}>
            {(['upcoming', 'past'] as View[]).map((v) => (
              <button key={v} onClick={() => setView(v)} aria-pressed={view === v} className="vsb-tab py-4 text-base">
                {v === 'upcoming' ? t('v2.games.upcoming') : t('v2.games.past')}{' '}
                <span className="text-muted">{v === 'upcoming' ? upcoming.length : games.filter((g) => !isUpcoming(g) && gameState(g) !== 'cancelled').length}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="vsb-gutter py-10 lg:py-14">
        {view === 'upcoming' ? (
          upcoming.length === 0 ? (
            <div className="border-y border-ink-600 py-14">
              <p className="font-display text-4xl font-extrabold uppercase text-chalk">{t('v2.myVsb.noUpcoming')}</p>
              <p className="mt-2 text-slate-400">{t('myBookings.browseAndBook')}</p>
              <Link to="/sessions" className="v2-btn-primary mt-6 font-display uppercase tracking-wider">{t('v2.landing.findGame')} <ArrowRight className="h-4 w-4" aria-hidden /></Link>
            </div>
          ) : (
            <div className="space-y-12">
              {next && (
                <section aria-labelledby="next-game">
                  <h2 id="next-game" className="vsb-meta mb-4">{t('v2.myVsb.nextOnCourt')}</h2>
                  <FeaturedGame game={next} lang={i18n.language} />
                </section>
              )}
              {rest.length > 0 && (
                <section aria-labelledby="later-games">
                  <h2 id="later-games" className="vsb-meta mb-2">{t('v2.games.later')}</h2>
                  <GameList games={rest} lang={i18n.language} />
                </section>
              )}
            </div>
          )
        ) : (
          <section aria-label={t('v2.games.past')}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
                <input aria-label={t('myBookings.searchPlaceholder')} placeholder={t('v2.games.search')} className="v2-input !py-2.5 !pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} className="h-4 w-4 accent-[#168BFF]" />
                {t('v2.games.showCancelled')}
              </label>
            </div>
            {past.length === 0 ? (
              <p className="py-10 text-slate-400">{t('v2.myVsb.noRecent')}</p>
            ) : (
              <GameList games={past} lang={i18n.language} />
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function GameList({ games, lang }: { games: MyGame[]; lang: string }) {
  const { t } = useTranslation();
  return (
    <ol className="divide-y divide-ink-700 border-y border-ink-600">
      {games.map((g) => {
        const d = dateParts(g.session.session_date, lang);
        return (
          <li key={g.id}>
            <Link to={`/bookings/${g.id}`} className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-4 py-4 hover:bg-ink-850 sm:grid-cols-[4.5rem_minmax(0,1fr)_10rem_auto]">
              <span className="text-center font-display leading-none">
                <span className="block text-3xl font-extrabold text-chalk">{d.day}</span>
                <span className="text-xs font-bold tracking-wider text-muted">{d.month}</span>
              </span>
              <span className="min-w-0">
                <span className="block truncate font-display text-xl font-bold uppercase tracking-wide text-chalk">{g.session.title}</span>
                <span className="block truncate text-sm text-muted">
                  {formatTime(g.session.start_time)} · {g.session.venue_name}
                  {g.is_guest && g.guest_name && <> · {t('myBookings.bookingFor', { name: g.guest_name })}</>}
                </span>
              </span>
              <span className="hidden sm:block"><GameStateLabel state={gameState(g)} /></span>
              <span className="flex flex-col items-end gap-1">
                <span className="sm:hidden"><GameStateLabel state={gameState(g)} /></span>
                <ArrowRight className="hidden h-5 w-5 text-muted sm:block" aria-hidden />
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
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
          <GameStateLabel state={pending ? 'awaiting-payment' : 'upcoming'} />
          <p className="mt-3 font-display text-4xl font-extrabold uppercase leading-none tracking-wide text-chalk">{game.session.title}</p>
          <p className="mt-3 text-lg text-slate-300">{formatTime(game.session.start_time)} – {formatTime(game.session.end_time)}</p>
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
