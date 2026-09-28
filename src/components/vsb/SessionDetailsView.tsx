import { useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Info, Lock, MapPin, MessageCircle } from 'lucide-react';
import { dateParts, formatCurrency, formatDateLocale, formatTime } from '@/lib/format';
import { getSessionStatus, SESSION_STATUS_KEY, type CourtPlayer, type SessionWithCount } from '@/lib/sessions';
import { SKILL_LEVEL_KEY, SKILL_LEVEL_STYLE } from '@/lib/volleyball';
import { whatsappLink } from '@/lib/settings';
import type { ClubSettings } from '@/types/database';
import { PasskeyGate } from '@/components/PasskeyGate';
import { WhosPlaying } from '@/components/WhosPlaying';
import { CapacityIndicator } from '@/components/vsb/CapacityIndicator';
import { sessionImage } from '@/lib/sessionMedia';
import { vsbAssets } from '@/lib/vsbAssets';

// Presentation for /sessions/:id — ONE scrollable session experience (no tabs):
//   hero → who's playing → game info → what to know → venue → help,
// with the booking action in a sticky side rail on desktop and a sticky bottom
// bar on mobile. Data and booking/waitlist behaviour live in SessionDetailsPage.

export interface SessionDetailsViewProps {
  session: SessionWithCount;
  players: CourtPlayer[];
  settings: ClubSettings | null;
  needsPasskey: boolean;
  unlocked: boolean;
  onUnlocked: () => void;
  onWaitlist: boolean;
  onBook: () => void;
  onJoinWaitlist: () => void;
}

export function SessionDetailsView({ session, players, settings, needsPasskey, unlocked, onUnlocked, onWaitlist, onBook, onJoinWaitlist }: SessionDetailsViewProps) {
  const { t, i18n } = useTranslation();
  const railRef = useRef<HTMLDivElement>(null);

  const status = getSessionStatus(session, session.confirmed_count);
  const canBook = status === 'Available' || status === 'Almost Full';
  const available = Math.max(0, session.maximum_capacity - session.confirmed_count);
  const skill = session.skill_level || 'Open Level';
  const d = dateParts(session.session_date, i18n.language);
  const price = session.price > 0 ? formatCurrency(session.price) : 'TBC';
  const locked = needsPasskey && !unlocked;
  const time = `${formatTime(session.start_time)} – ${formatTime(session.end_time)}`;
  const requiredItems = [t('sessionDetails.itemShoes'), t('sessionDetails.itemWaterBottle'), t('sessionDetails.itemAttire'), t('sessionDetails.itemTowel')];
  const rules = [t('sessionDetails.rule1'), t('sessionDetails.rule2'), t('sessionDetails.rule3'), t('sessionDetails.rule4')];

  // The primary action, shared by the booking rail and the mobile sticky bar.
  function renderAction(compact = false): ReactNode {
    const size = compact ? '!py-3 text-base' : '!py-4 text-lg';
    if (locked) {
      return compact ? (
        <button onClick={() => railRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })} className={`v2-btn-primary w-full font-display uppercase tracking-wider ${size}`}>
          <Lock className="h-4 w-4" aria-hidden /> {t('v2.sessionDetails.unlockToBook')}
        </button>
      ) : <PasskeyGate sessionId={session.id} onUnlocked={onUnlocked} />;
    }
    if (canBook) {
      return <button onClick={onBook} className={`v2-btn-primary w-full font-display uppercase tracking-wider ${size}`}>{t('v2.sessionDetails.bookMySpot')}</button>;
    }
    if (status === 'Fully Booked') {
      return onWaitlist ? (
        compact ? (
          <div className="w-full rounded-md border border-amber-500/40 bg-amber-500/10 py-3 text-center font-bold text-amber-300">{t('sessionDetails.onWaitlist')}</div>
        ) : (
          <div className="flex items-end gap-4 border border-amber-500/40 bg-amber-500/10 pl-2 pr-4 pt-2">
            <img src={vsbAssets.states.waiting.sm.src} alt="" width={vsbAssets.states.waiting.sm.width} height={vsbAssets.states.waiting.sm.height} decoding="async" className="h-28 w-auto" />
            <div className="pb-4">
              <p className="font-display text-lg font-bold uppercase tracking-wider text-amber-300">{t('sessionDetails.onWaitlist')}</p>
              <p className="mt-1 text-sm text-slate-300">{t('v2.sessionDetails.waitlistAuto')}</p>
            </div>
          </div>
        )
      ) : (
        <button onClick={onJoinWaitlist} className={`w-full rounded-md bg-amber-500 font-display font-bold uppercase tracking-wider text-ink transition-colors hover:bg-amber-400 ${size}`}>
          {t('sessionDetails.joinWaitlist')}
        </button>
      );
    }
    return <div className={`w-full rounded-md bg-ink-700 text-center font-bold text-slate-300 ${compact ? 'py-3' : 'py-4'}`}>{t(SESSION_STATUS_KEY[status] || status)}</div>;
  }

  return (
    <div className="bg-ink text-chalk">
      <div className="vsb-gutter border-b border-ink-600 py-3">
        <Link to="/sessions" className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted hover:text-chalk">
          <ArrowLeft className="h-4 w-4" aria-hidden /> {t('sessionDetails.backToSessions')}
        </Link>
      </div>

      {/* ===== Session hero ===== */}
      <header className="grid border-b border-ink-600 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="relative min-h-[14rem] overflow-hidden sm:min-h-[18rem] lg:min-h-[28rem]">
          <img src={sessionImage(session.cover_image_path, 'lg')} alt="" width={2128} height={739} fetchPriority="high" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/30 to-ink/10" aria-hidden />
          <div className="vsb-gutter relative flex h-full min-h-[inherit] flex-col justify-between py-6 lg:py-10">
            <div className="flex flex-wrap gap-2">
              <span className={`v2-chip uppercase tracking-wider ${SKILL_LEVEL_STYLE[skill]}`}>{t(SKILL_LEVEL_KEY[skill])}</span>
              <span className="v2-chip bg-ink uppercase tracking-wider text-chalk">
                {needsPasskey && <Lock className="mr-1 h-3 w-3" aria-hidden />}
                {needsPasskey ? t('v2.session.private') : t('v2.session.public')}
              </span>
              <span className="v2-chip bg-ink uppercase tracking-wider text-chalk">{t(SESSION_STATUS_KEY[status] || status)}</span>
            </div>
            <p className="font-display uppercase leading-none" aria-hidden>
              <span className="block text-xl font-bold tracking-[0.25em] text-vsb-300 lg:text-2xl">{d.weekday}</span>
              <span className="block text-8xl font-extrabold text-chalk lg:text-[9rem]">{d.day}</span>
              <span className="block text-xl font-bold tracking-[0.25em] text-chalk lg:text-2xl">{d.month}</span>
            </p>
          </div>
        </div>
        <div className="vsb-gutter flex flex-col justify-end border-ink-600 bg-ink-850 py-8 lg:border-l lg:!px-10 lg:py-10">
          <p className="vsb-meta mb-3">{t('v2.sessionDetails.meta')}</p>
          <h1 className="vsb-display text-5xl lg:text-6xl xl:text-7xl">{session.title}</h1>
          <p className="mt-5 font-display text-2xl font-bold uppercase tracking-wide text-chalk">{formatDateLocale(session.session_date, i18n.language, 'medium')} · {time}</p>
          <p className="mt-1 text-lg text-slate-300">{[session.venue_name, session.court_number].filter(Boolean).join(' · ')}</p>
        </div>
      </header>

      {/* ===== Body: content + sticky booking rail ===== */}
      <div className="vsb-gutter grid gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-14 lg:py-14 xl:grid-cols-[minmax(0,1fr)_24rem]">
        {/* Booking rail (first on mobile so price + action sit right under the hero) */}
        <aside ref={railRef} id="booking-panel" aria-label={t('v2.sessionDetails.bookingLabel')} className="lg:order-2">
          <div className="border border-ink-600 bg-ink-850 p-6 lg:sticky lg:top-24">
            <p className="vsb-meta">{t('sessionDetails.pricePerPlayer')}</p>
            <p className="font-display text-5xl font-extrabold leading-none text-chalk">{price}</p>
            {session.price === 0 && <p className="mt-1 text-xs text-amber-300">{t('sessionDetails.tbcNote')}</p>}
            <div className="mt-6 border-t border-ink-600 pt-5">
              <CapacityIndicator confirmed={session.confirmed_count} max={session.maximum_capacity} />
              {canBook && <p className={`mt-2 text-sm ${available <= 3 ? 'font-semibold text-amber-300' : 'text-slate-400'}`}>{t('v2.session.openSlots', { count: available })}</p>}
            </div>
            <div className="mt-6">{renderAction()}</div>
            <div className="mt-4 space-y-0.5 text-xs text-muted">
              <p>{t('sessionDetails.bookingDeadline', { date: session.booking_close_at ? formatDateLocale(session.booking_close_at, i18n.language, 'medium') : t('common.none') })}</p>
              <p>{t('sessionDetails.cancellationDeadline')} · <span className="text-amber-300">{t('sessionDetails.nonRefundable')}</span></p>
            </div>
          </div>
        </aside>

        <div className="min-w-0 space-y-16 lg:order-1">
          {/* Who's playing — the signature feature */}
          <WhosPlaying players={players} capacity={session.maximum_capacity} />

          {/* Game info */}
          <section aria-labelledby="game-info">
            <h2 id="game-info" className="vsb-display mb-6 text-3xl sm:text-4xl">{t('v2.sessionDetails.gameInfo')}</h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-6 border-t border-ink-600 pt-6 sm:grid-cols-3 xl:grid-cols-4">
              <Fact label={t('sessionDetails.dateLabel')} value={formatDateLocale(session.session_date, i18n.language, 'medium')} />
              <Fact label={t('sessionDetails.timeLabel')} value={time} />
              <Fact label={t('sessionDetails.venueLabel')} value={session.venue_name} />
              <Fact label={t('sessionDetails.courtLabel')} value={session.court_number || t('common.notSpecified')} />
              <Fact label={t('v2.sessions.skillLevel')} value={t(SKILL_LEVEL_KEY[skill])} />
              <Fact label={t('sessionDetails.capacityLabel')} value={`${session.confirmed_count} / ${session.maximum_capacity}`} />
              <Fact label={t('sessionDetails.pricePerPlayer')} value={price} />
              <Fact label={t('v2.sessionDetails.sessionType')} value={needsPasskey ? t('v2.session.private') : t('v2.session.public')} />
            </dl>
          </section>

          {/* What to know */}
          <section aria-labelledby="what-to-know">
            <h2 id="what-to-know" className="vsb-display mb-6 text-3xl sm:text-4xl">{t('v2.sessionDetails.whatToKnow')}</h2>
            {session.description && <p className="mb-6 max-w-3xl text-lg leading-relaxed text-slate-300">{session.description}</p>}
            {session.notes && (
              <div className="mb-8 flex max-w-3xl gap-3 border-l-2 border-vsb-500 pl-4">
                <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-vsb-300" aria-hidden />
                <div>
                  <p className="vsb-meta mb-1">{t('sessionDetails.notesFromClub')}</p>
                  <p className="text-slate-300">{session.notes}</p>
                </div>
              </div>
            )}
            <div className="grid gap-10 md:grid-cols-2">
              <div>
                <h3 className="vsb-meta mb-3">{t('sessionDetails.sessionRules')}</h3>
                <ol className="divide-y divide-ink-600 border-y border-ink-600">
                  {rules.map((rule, i) => (
                    <li key={rule} className="flex gap-4 py-3 text-slate-200">
                      <span className="font-display text-xl font-extrabold text-vsb-500">{String(i + 1).padStart(2, '0')}</span>{rule}
                    </li>
                  ))}
                </ol>
              </div>
              <div>
                <h3 className="vsb-meta mb-3">{t('sessionDetails.whatToBring')}</h3>
                <ul className="divide-y divide-ink-600 border-y border-ink-600">
                  {requiredItems.map((item) => <li key={item} className="py-3 text-slate-200">{item}</li>)}
                </ul>
              </div>
            </div>
          </section>

          {/* Venue */}
          <section aria-labelledby="venue" className="grid gap-6 md:grid-cols-[1fr_1fr] md:items-end">
            <div>
              <h2 id="venue" className="vsb-display mb-4 text-3xl sm:text-4xl">{t('v2.sessionDetails.venue')}</h2>
              <p className="font-display text-2xl font-bold uppercase tracking-wide text-chalk">{session.venue_name}</p>
              {session.court_number && <p className="font-display text-lg font-bold uppercase tracking-wider text-vsb-300">{session.court_number}</p>}
              <p className="mt-3 max-w-md text-slate-300">{session.venue_address || t('common.notSpecified')}</p>
            </div>
            {session.maps_link && (
              <a href={session.maps_link} target="_blank" rel="noopener noreferrer" className="v2-btn-secondary justify-self-start font-display uppercase tracking-wider md:justify-self-end">
                <MapPin className="h-4 w-4" aria-hidden /> {t('sessionDetails.viewOnMaps')}
              </a>
            )}
          </section>

          {/* Help */}
          <section aria-labelledby="help" className="border-t border-ink-600 pt-8">
            <h2 id="help" className="vsb-display mb-4 text-3xl">{t('sessionDetails.needHelp')}</h2>
            <div className="flex flex-wrap gap-x-8 gap-y-3">
              <a
                href={whatsappLink(settings?.contact_whatsapp || '0137441727', t('sessionDetails.whatsappQuestion', { title: session.title, date: formatDateLocale(session.session_date, i18n.language) }))}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 font-semibold text-green-400 hover:text-green-300"
              >
                <MessageCircle className="h-5 w-5" aria-hidden />
                {t('sessionDetails.whatsappBtn', { number: settings?.contact_whatsapp || '0137441727' })}
              </a>
              {settings?.whatsapp_group_link && (
                <a href={settings.whatsapp_group_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 font-semibold text-green-400 hover:text-green-300">
                  <MessageCircle className="h-5 w-5" aria-hidden />
                  {t('sessionDetails.joinGroup')}
                </a>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Mobile sticky booking bar — sits above the bottom tab bar */}
      <div className="h-20 lg:hidden" aria-hidden />
      <div className="fixed inset-x-0 bottom-[calc(4.1rem+env(safe-area-inset-bottom))] z-40 border-t border-ink-600 bg-ink/95 backdrop-blur-sm md:bottom-0 lg:hidden">
        <div className="vsb-gutter flex items-center gap-4 py-3">
          <p className="leading-none">
            <span className="block font-display text-2xl font-extrabold text-chalk">{price}</span>
            <span className="text-xs text-muted">{t('v2.session.perPlayer')}</span>
          </p>
          <div className="flex-1">{renderAction(true)}</div>
        </div>
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="vsb-meta mb-1">{label}</dt>
      <dd className="font-display text-xl font-bold uppercase leading-tight tracking-wide text-chalk">{value}</dd>
    </div>
  );
}
