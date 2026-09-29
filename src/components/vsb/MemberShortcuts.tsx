import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { byDateAsc, fetchMyGames, isUpcoming, type MyGame } from '@/lib/myGames';
import { dateParts, formatCurrency, formatDateTime, formatTime } from '@/lib/format';
import { useMyAvatar } from '@/lib/avatars';
import { GameStateLabel } from '@/components/vsb/GameStateLabel';
import { PlayerAvatar } from '@/components/PlayerAvatar';

// Home for a signed-in player: their next game (with Pay now while it's
// unpaid) and the few places they go most. Real data only; nothing here is
// shown to signed-out visitors.
export function MemberShortcuts({ openCount }: { openCount: number | null }) {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();
  const avatar = useMyAvatar(profile?.id);
  const [games, setGames] = useState<MyGame[] | null>(null);

  useEffect(() => {
    if (profile) fetchMyGames(profile.id).then(setGames).catch(() => setGames([]));
  }, [profile]);

  if (!profile) return null;
  const name = profile.short_name || profile.full_name;
  const upcoming = (games || []).filter((g) => !g.is_guest && isUpcoming(g)).sort(byDateAsc);
  const next = upcoming[0];
  const unpaid = upcoming.filter((g) => g.booking_status === 'Pending Payment' && !g.receipt_path).length;

  const shortcuts = [
    { to: '/sessions', label: t('v2.landing.findGame'), meta: openCount === null ? '' : t('v2.home.openGames', { count: openCount }) },
    { to: '/bookings', label: t('v2.nav.myGames'), meta: games ? t('v2.home.upcomingGames', { count: upcoming.length }) : '' },
    avatar
      ? { to: '/profile', label: t('v2.nav.myVsb'), meta: t('v2.home.cardAndGame') }
      : { to: '/profile/player', label: t('v2.landing.createPlayer'), meta: t('v2.home.onePhoto') },
    { to: '/community', label: t('v2.nav.community'), meta: t('v2.home.whoPlays') },
  ];

  return (
    <section aria-labelledby="member-home" className="vsb-gutter border-b border-ink-600 bg-ink-850 py-8 lg:py-10">
      <div className="flex items-center gap-4">
        <PlayerAvatar name={name} src={avatar?.thumb} size="md" />
        <div>
          <p className="vsb-meta">{t('v2.home.meta')}</p>
          <h2 id="member-home" className="font-display text-3xl font-extrabold uppercase leading-none text-chalk sm:text-4xl">{t('v2.home.welcome', { name })}</h2>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:gap-10">
        {/* Next game, with the one action it needs */}
        {games === null ? (
          <div className="vsb-skel h-40 border border-ink-600" aria-hidden />
        ) : next ? (
          <NextGameShortcut game={next} lang={i18n.language} />
        ) : (
          <div className="flex flex-col justify-center border border-ink-600 p-5">
            <p className="vsb-meta">{t('v2.myVsb.nextOnCourt')}</p>
            <p className="mt-1 font-display text-2xl font-extrabold uppercase text-chalk">{t('v2.myVsb.noUpcoming')}</p>
            <p className="mt-1 text-slate-400">{t('v2.myVsb.nextWaiting')}</p>
          </div>
        )}

        {/* Shortcuts */}
        <nav aria-label={t('v2.home.shortcuts')} className="grid grid-cols-2 border-l border-t border-ink-600">
          {shortcuts.map((s) => (
            <Link key={s.to} to={s.to} className="group flex flex-col justify-between gap-3 border-b border-r border-ink-600 p-4 transition-colors hover:bg-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-vsb-400">
              <span className="flex items-center justify-between gap-2 font-display text-lg font-bold uppercase tracking-wide text-chalk">
                {s.label} <ArrowRight className="h-4 w-4 flex-shrink-0 text-vsb-400 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
              <span className="text-xs text-muted">{s.meta}</span>
            </Link>
          ))}
        </nav>
      </div>
      {unpaid > 1 && <p className="mt-4 text-sm text-amber-300">{t('v2.home.moreUnpaid', { count: unpaid - 1 })}</p>}
    </section>
  );
}

function NextGameShortcut({ game, lang }: { game: MyGame; lang: string }) {
  const { t } = useTranslation();
  const d = dateParts(game.session.session_date, lang);
  const needsPay = game.booking_status === 'Pending Payment' && !game.receipt_path;
  const verifying = game.booking_status === 'Pending Payment' && !!game.receipt_path;
  return (
    <div className={`grid grid-cols-[auto_minmax(0,1fr)] gap-5 border p-5 ${needsPay ? 'border-amber-400/60' : 'border-ink-600'}`}>
      <p className="font-display uppercase leading-none" aria-hidden>
        <span className="block text-sm font-bold tracking-[0.2em] text-vsb-300">{d.weekday}</span>
        <span className="block text-6xl font-extrabold text-chalk">{String(d.day).padStart(2, '0')}</span>
        <span className="block text-sm font-bold tracking-[0.2em] text-chalk">{d.month}</span>
      </p>
      <div className="min-w-0">
        <p className="vsb-meta">{t('v2.myVsb.nextOnCourt')}</p>
        <p className="mt-1 truncate font-display text-2xl font-extrabold uppercase leading-tight tracking-wide text-chalk">{game.session.title}</p>
        <p className="text-sm text-slate-300">
          {t('v2.session.timeRange', { start: formatTime(game.session.start_time), end: formatTime(game.session.end_time) })} · {game.session.venue_name}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          {needsPay ? (
            <>
              <Link to={`/bookings/${game.id}#pay`} className="v2-btn-primary !py-2 font-display uppercase tracking-wider">
                {t('v2.home.payNow', { amount: game.session.price > 0 ? formatCurrency(game.session.price) : 'TBC' })} <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              {game.reserved_until && <span className="text-sm text-amber-300">{t('v2.home.payBy', { time: formatDateTime(game.reserved_until) })}</span>}
            </>
          ) : (
            <>
              <GameStateLabel state={verifying || game.booking_status === 'Pending Payment' ? 'awaiting-payment' : 'upcoming'} />
              {verifying && <span className="text-sm text-slate-400">{t('v2.home.receiptSent')}</span>}
              <Link to={`/bookings/${game.id}`} className="hub-link">{t('v2.myVsb.viewGame')} <ArrowRight className="h-4 w-4" aria-hidden /></Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
