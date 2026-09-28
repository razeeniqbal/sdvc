import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
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

// Presentation for /sessions/:id. All data loading and booking/waitlist
// behaviour lives in SessionDetailsPage and arrives here as props + callbacks.

type Tab = 'players' | 'details' | 'rules' | 'location';
const TABS: Tab[] = ['players', 'details', 'rules', 'location'];

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
  const [tab, setTab] = useState<Tab>('players');
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ players: null, details: null, rules: null, location: null });
  const panelRef = useRef<HTMLDivElement>(null);

  const status = getSessionStatus(session, session.confirmed_count);
  const canBook = status === 'Available' || status === 'Almost Full';
  const available = Math.max(0, session.maximum_capacity - session.confirmed_count);
  const skill = session.skill_level || 'Open Level';
  const d = dateParts(session.session_date, i18n.language);
  const price = session.price > 0 ? formatCurrency(session.price) : 'TBC';
  const locked = needsPasskey && !unlocked;
  const requiredItems = [t('sessionDetails.itemShoes'), t('sessionDetails.itemWaterBottle'), t('sessionDetails.itemAttire'), t('sessionDetails.itemTowel')];
  const rules = [t('sessionDetails.rule1'), t('sessionDetails.rule2'), t('sessionDetails.rule3'), t('sessionDetails.rule4')];
  const tabLabel: Record<Tab, string> = {
    players: t('v2.sessionDetails.tabPlayers'),
    details: t('v2.sessionDetails.tabDetails'),
    rules: t('v2.sessionDetails.tabRules'),
    location: t('v2.sessionDetails.tabLocation'),
  };

  function onTabKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = TABS.indexOf(tab);
    const next = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
    setTab(next);
    tabRefs.current[next]?.focus();
  }

  // The primary action, shared by the booking panel and the mobile sticky bar.
  function renderAction(compact = false): ReactNode {
    const size = compact ? '!py-3 text-base' : '!py-4 text-lg';
    if (locked) {
      return compact ? (
        <button onClick={() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })} className={`v2-btn-primary w-full font-display uppercase tracking-wider ${size}`}>
          <Lock className="h-4 w-4" aria-hidden /> {t('v2.sessionDetails.unlockToBook')}
        </button>
      ) : <PasskeyGate sessionId={session.id} onUnlocked={onUnlocked} />;
    }
    if (canBook) {
      return <button onClick={onBook} className={`v2-btn-primary w-full font-display uppercase tracking-wider ${size}`}>{t('v2.sessionDetails.bookMySpot')}</button>;
    }
    if (status === 'Fully Booked') {
      return onWaitlist ? (
        <div className={`w-full rounded-md border border-amber-500/40 bg-amber-500/10 text-center font-bold text-amber-300 ${compact ? 'py-3' : 'py-4'}`}>{t('sessionDetails.onWaitlist')}</div>
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

      {/* ===== Session hero: visual left, broadcast-style data + booking right ===== */}
      <header className="grid border-b border-ink-600 lg:grid-cols-[minmax(0,1.4fr)_minmax(26rem,1fr)]">
        <div className="relative min-h-[15rem] overflow-hidden sm:min-h-[20rem] lg:min-h-[36rem]">
          <img src="/brand/court-horizontal.webp" alt="" width={973} height={335} className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/30 to-ink/10" aria-hidden />
          <div className="vsb-gutter relative flex h-full min-h-[inherit] flex-col justify-between py-6 lg:py-10">
            <div className="flex flex-wrap gap-2">
              <span className={`v2-chip uppercase tracking-wider ${SKILL_LEVEL_STYLE[skill]}`}>{t(SKILL_LEVEL_KEY[skill])}</span>
              <span className="v2-chip bg-ink text-chalk uppercase tracking-wider">
                {needsPasskey && <Lock className="mr-1 h-3 w-3" aria-hidden />}
                {needsPasskey ? t('v2.session.private') : t('v2.session.public')}
              </span>
              <span className="v2-chip bg-ink text-chalk uppercase tracking-wider">{t(SESSION_STATUS_KEY[status] || status)}</span>
            </div>
            <p className="font-display uppercase leading-none" aria-label={formatDateLocale(session.session_date, i18n.language)}>
              <span className="block text-xl font-bold tracking-[0.25em] text-vsb-300 lg:text-2xl" aria-hidden>{d.weekday}</span>
              <span className="block text-8xl font-extrabold text-chalk lg:text-[10rem]" aria-hidden>{d.day}</span>
              <span className="block text-xl font-bold tracking-[0.25em] text-chalk lg:text-2xl" aria-hidden>{d.month}</span>
            </p>
          </div>
        </div>

        <div ref={panelRef} id="booking-panel" className="vsb-gutter flex flex-col border-ink-600 bg-ink-850 py-8 lg:border-l lg:!px-10 lg:py-10">
          <p className="vsb-meta mb-3">{t('v2.sessionDetails.meta')}</p>
          <h1 className="vsb-display text-5xl lg:text-6xl">{session.title}</h1>

          <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-ink-600 pt-6">
            <Fact label={t('sessionDetails.timeLabel')} value={`${formatTime(session.start_time)} – ${formatTime(session.end_time)}`} />
            <Fact label={t('sessionDetails.dateLabel')} value={formatDateLocale(session.session_date, i18n.language, 'medium')} />
            <Fact label={t('sessionDetails.venueLabel')} value={session.venue_name} />
            <Fact label={t('sessionDetails.courtLabel')} value={session.court_number || t('common.notSpecified')} />
          </dl>

          <div className="mt-6 border-t border-ink-600 pt-6">
            <CapacityIndicator confirmed={session.confirmed_count} max={session.maximum_capacity} />
            {canBook && <p className={`mt-2 text-sm ${available <= 3 ? 'font-semibold text-amber-300' : 'text-slate-400'}`}>{t('v2.session.openSlots', { count: available })}</p>}
          </div>

          <div className="mt-6 flex items-end justify-between gap-4 border-t border-ink-600 pt-6">
            <p>
              <span className="vsb-meta block">{t('sessionDetails.pricePerPlayer')}</span>
              <span className="font-display text-5xl font-extrabold leading-none text-chalk">{price}</span>
            </p>
            {session.price === 0 && <p className="max-w-[12rem] text-right text-xs text-amber-300">{t('sessionDetails.tbcNote')}</p>}
          </div>

          <div className="mt-6">{renderAction()}</div>

          <div className="mt-4 space-y-0.5 text-xs text-muted">
            <p>{t('sessionDetails.bookingDeadline', { date: session.booking_close_at ? formatDateLocale(session.booking_close_at, i18n.language, 'medium') : t('common.none') })}</p>
            <p>{t('sessionDetails.cancellationDeadline')} · <span className="text-amber-300">{t('sessionDetails.nonRefundable')}</span></p>
          </div>
        </div>
      </header>

      {/* ===== Tabs ===== */}
      <div className="vsb-gutter sticky top-16 z-30 border-b border-ink-600 bg-ink/95 backdrop-blur-sm">
        <div role="tablist" aria-label={session.title} className="-mb-px flex gap-5 overflow-x-auto [scrollbar-width:none] sm:gap-8">
          {TABS.map((key) => (
            <button
              key={key}
              ref={(el) => { tabRefs.current[key] = el; }}
              role="tab"
              id={`tab-${key}`}
              aria-selected={tab === key}
              aria-controls={`panel-${key}`}
              tabIndex={tab === key ? 0 : -1}
              onClick={() => setTab(key)}
              onKeyDown={onTabKeyDown}
              className="vsb-tab py-4"
            >
              {tabLabel[key]}
            </button>
          ))}
        </div>
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="vsb-gutter py-10 lg:py-14">
        {tab === 'players' && (
          <div className="mx-auto max-w-[1500px]"><WhosPlaying players={players} capacity={session.maximum_capacity} /></div>
        )}

        {tab === 'details' && (
          <div className="grid gap-12 lg:grid-cols-[1.3fr_1fr]">
            <div className="space-y-8">
              {session.description && (
                <section>
                  <h2 className="vsb-display mb-3 text-3xl">{t('sessionDetails.aboutSession')}</h2>
                  <p className="max-w-2xl text-lg leading-relaxed text-slate-300">{session.description}</p>
                </section>
              )}
              {session.notes && (
                <div className="flex max-w-2xl gap-3 border-l-2 border-vsb-500 pl-4">
                  <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-vsb-300" aria-hidden />
                  <div>
                    <p className="vsb-meta mb-1">{t('sessionDetails.notesFromClub')}</p>
                    <p className="text-slate-300">{session.notes}</p>
                  </div>
                </div>
              )}
              <dl className="grid grid-cols-2 gap-x-6 gap-y-6 border-t border-ink-600 pt-6 sm:grid-cols-3">
                <Fact label={t('sessionDetails.dateLabel')} value={formatDateLocale(session.session_date, i18n.language)} />
                <Fact label={t('sessionDetails.timeLabel')} value={`${formatTime(session.start_time)} – ${formatTime(session.end_time)}`} />
                <Fact label={t('v2.sessions.skillLevel')} value={t(SKILL_LEVEL_KEY[skill])} />
                <Fact label={t('sessionDetails.venueLabel')} value={session.venue_name} />
                <Fact label={t('sessionDetails.courtLabel')} value={session.court_number || t('common.notSpecified')} />
                <Fact label={t('sessionDetails.capacityLabel')} value={t('sessionDetails.capacityValue', { confirmed: session.confirmed_count, max: session.maximum_capacity, available })} />
              </dl>
            </div>
            <section className="self-start border-t border-ink-600 pt-6 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
              <h2 className="vsb-display mb-4 text-3xl">{t('sessionDetails.needHelp')}</h2>
              <div className="flex flex-col gap-3">
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
        )}

        {tab === 'rules' && (
          <div className="grid gap-12 lg:grid-cols-2">
            <section>
              <h2 className="vsb-display mb-5 text-3xl">{t('sessionDetails.sessionRules')}</h2>
              <ol className="divide-y divide-ink-600 border-y border-ink-600">
                {rules.map((rule, i) => (
                  <li key={rule} className="flex gap-5 py-4 text-lg text-slate-200">
                    <span className="font-display text-2xl font-extrabold text-vsb-500">{String(i + 1).padStart(2, '0')}</span>{rule}
                  </li>
                ))}
              </ol>
            </section>
            <section>
              <h2 className="vsb-display mb-5 text-3xl">{t('sessionDetails.whatToBring')}</h2>
              <ul className="divide-y divide-ink-600 border-y border-ink-600">
                {requiredItems.map((item) => <li key={item} className="py-4 text-lg text-slate-200">{item}</li>)}
              </ul>
            </section>
          </div>
        )}

        {tab === 'location' && (
          <section className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <p className="vsb-meta mb-3">{t('sessionDetails.venueLabel')}</p>
              <h2 className="vsb-display text-5xl">{session.venue_name}</h2>
              {session.court_number && <p className="mt-2 font-display text-2xl font-bold uppercase tracking-wider text-vsb-300">{session.court_number}</p>}
              <p className="mt-6 max-w-md text-lg text-slate-300">{session.venue_address || t('common.notSpecified')}</p>
              {session.maps_link && (
                <a href={session.maps_link} target="_blank" rel="noopener noreferrer" className="v2-btn-secondary mt-6 font-display uppercase tracking-wider">
                  <MapPin className="h-4 w-4" aria-hidden /> {t('sessionDetails.viewOnMaps')}
                </a>
              )}
            </div>
            <div className="relative hidden overflow-hidden rounded-sm border border-ink-600 lg:block">
              <img src="/brand/court-horizontal.webp" alt="" width={973} height={335} loading="lazy" className="h-full w-full object-cover opacity-70" />
            </div>
          </section>
        )}
      </div>

      {/* Mobile sticky booking bar — sits above the bottom tab bar */}
      <div className="h-20 lg:hidden" aria-hidden />
      <div className="fixed inset-x-0 bottom-[calc(4.1rem+env(safe-area-inset-bottom))] md:bottom-0 z-40 border-t border-ink-600 bg-ink/95 backdrop-blur-sm lg:hidden">
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
