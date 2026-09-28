import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarDays, Clock, MapPin, Users, ArrowLeft, Info, Lock, MessageCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate, formatTime, getDayName } from '@/lib/format';
import { fetchCourtRoster, getSessionStatus, SESSION_STATUS_KEY, type CourtPlayer, type SessionWithCount } from '@/lib/sessions';
import { SKILL_LEVEL_KEY, SKILL_LEVEL_STYLE } from '@/lib/volleyball';
import { fetchClubSettings, whatsappLink } from '@/lib/settings';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import { Spinner } from '@/components/LoadingScreen';
import { PasskeyGate } from '@/components/PasskeyGate';
import { WhosPlaying } from '@/components/WhosPlaying';
import type { ClubSettings, WaitingListEntry } from '@/types/database';

const statusChip: Record<string, string> = {
  Available: 'bg-green-100 text-green-800 border-green-200',
  'Almost Full': 'bg-amber-100 text-amber-800 border-amber-200',
  'Fully Booked': 'bg-red-100 text-red-700 border-red-200',
  'Booking Closed': 'bg-slate-100 text-slate-600 border-slate-200',
  Cancelled: 'bg-red-100 text-red-700 border-red-200',
};

type Tab = 'players' | 'details' | 'rules' | 'location';
const TABS: Tab[] = ['players', 'details', 'rules', 'location'];

export default function SessionDetailsPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { show } = useToast();
  const { profile } = useAuth();
  const [session, setSession] = useState<SessionWithCount | null>(null);
  const [loading, setLoading] = useState(true);
  const [myWaitlistEntry, setMyWaitlistEntry] = useState<WaitingListEntry | null>(null);
  const [settings, setSettings] = useState<ClubSettings | null>(null);
  const [players, setPlayers] = useState<CourtPlayer[]>([]);
  const [needsPasskey, setNeedsPasskey] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [tab, setTab] = useState<Tab>('players');
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ players: null, details: null, rules: null, location: null });

  useEffect(() => {
    fetchClubSettings().then(setSettings);
    if (!id || !profile) return;
    (async () => {
      const { data, error } = await supabase.from('sessions').select('*').eq('id', id).maybeSingle();
      if (error || !data) {
        show(t('sessionDetails.sessionNotFound'), 'error');
        navigate('/sessions');
        return;
      }
      const { data: count } = await supabase.rpc('confirmed_booking_count', { p_session_id: id });
      setSession({ ...data, confirmed_count: (count as number) || 0 } as SessionWithCount);
      setPlayers(await fetchCourtRoster(id));
      const { data: requiresPasskey } = await supabase.rpc('session_requires_passkey', { p_session_id: id });
      setNeedsPasskey(!!requiresPasskey);
      // Was this player already waitlisted for this session? The old version only
      // tracked this in local state after a fresh join click, so returning to the page
      // never showed up here.
      const { data: waitlistEntry } = await supabase
        .from('waiting_list')
        .select('*')
        .eq('session_id', id)
        .eq('user_id', profile.id)
        .eq('status', 'Waiting')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setMyWaitlistEntry(waitlistEntry as WaitingListEntry | null);
      setLoading(false);
    })();
    // reload only when the session id or profile changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, profile]);

  async function handleJoinWaitlist() {
    if (!session) return;
    const { data: existing } = await supabase
      .from('waiting_list')
      .select('id')
      .eq('session_id', session.id)
      .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
      .eq('status', 'Waiting')
      .maybeSingle();
    if (existing) {
      show(t('sessionDetails.alreadyOnWaitlist'), 'info');
      return;
    }
    const { count } = await supabase
      .from('waiting_list')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', session.id)
      .eq('status', 'Waiting');
    const { data: inserted, error } = await supabase.from('waiting_list').insert({
      session_id: session.id,
      queue_position: (count || 0) + 1,
      status: 'Waiting',
    }).select().maybeSingle();
    if (error) {
      show(error.message, 'error');
      return;
    }
    setMyWaitlistEntry(inserted as WaitingListEntry);
    show(t('sessionDetails.addedToWaitlist'), 'success');
  }

  function onTabKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = TABS.indexOf(tab);
    const next = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
    setTab(next);
    tabRefs.current[next]?.focus();
  }

  if (loading || !session) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spinner className="h-8 w-8 text-vsb-500" />
      </div>
    );
  }

  const status = getSessionStatus(session, session.confirmed_count);
  const canBook = status === 'Available' || status === 'Almost Full';
  const available = Math.max(0, session.maximum_capacity - session.confirmed_count);
  const skill = session.skill_level || 'Open Level';
  const requiredItems = [t('sessionDetails.itemShoes'), t('sessionDetails.itemWaterBottle'), t('sessionDetails.itemAttire'), t('sessionDetails.itemTowel')];
  const rules = [t('sessionDetails.rule1'), t('sessionDetails.rule2'), t('sessionDetails.rule3'), t('sessionDetails.rule4')];
  const tabLabel: Record<Tab, string> = {
    players: t('v2.sessionDetails.tabPlayers'),
    details: t('v2.sessionDetails.tabDetails'),
    rules: t('v2.sessionDetails.tabRules'),
    location: t('v2.sessionDetails.tabLocation'),
  };

  return (
    <div className="bg-ink text-chalk">
      {/* Header */}
      <header className="relative border-b border-ink-600">
        <img src="/brand/court-horizontal.webp" alt="" width={973} height={335} className="absolute inset-0 h-full w-full object-cover opacity-40" />
        <div className="relative mx-auto max-w-6xl px-4 pb-6 pt-4 sm:px-6 sm:pb-8">
          <Link to="/sessions" className="inline-flex items-center gap-1.5 text-sm text-slate-300 hover:text-white">
            <ArrowLeft className="h-4 w-4" aria-hidden /> {t('sessionDetails.backToSessions')}
          </Link>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className={`v2-chip ${SKILL_LEVEL_STYLE[skill]}`}>{t(SKILL_LEVEL_KEY[skill])}</span>
            <span className="v2-chip bg-ink/85 text-chalk">
              {needsPasskey && <Lock className="mr-1 h-3 w-3" aria-hidden />}
              {needsPasskey ? t('v2.session.private') : t('v2.session.public')}
            </span>
            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusChip[status]}`}>
              {t(SESSION_STATUS_KEY[status] || status)}
            </span>
          </div>

          <h1 className="mt-3 font-display text-4xl font-extrabold uppercase leading-none tracking-tight sm:text-5xl">{session.title}</h1>

          <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm text-slate-200 sm:grid-cols-2 lg:flex lg:flex-wrap">
            <Meta icon={CalendarDays} label={t('sessionDetails.dateLabel')} value={`${getDayName(session.session_date)}, ${formatDate(session.session_date)}`} />
            <Meta icon={Clock} label={t('sessionDetails.timeLabel')} value={`${formatTime(session.start_time)} – ${formatTime(session.end_time)}`} />
            <Meta icon={MapPin} label={t('sessionDetails.venueLabel')} value={[session.venue_name, session.court_number].filter(Boolean).join(' · ')} />
            <Meta icon={Users} label={t('sessionDetails.capacityLabel')} value={t('v2.sessionDetails.confirmedCapacity', { confirmed: session.confirmed_count, max: session.maximum_capacity })} />
          </dl>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:py-8">
        <div className="min-w-0">
          <div role="tablist" aria-label={session.title} className="grid grid-cols-4 gap-1 rounded-xl border border-ink-600 bg-ink-850 p-1">
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
                className={`rounded-lg px-2 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vsb-400 ${
                  tab === key ? 'bg-vsb-500 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {tabLabel[key]}
              </button>
            ))}
          </div>

          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="mt-6">
            {tab === 'players' && <WhosPlaying players={players} capacity={session.maximum_capacity} />}

            {tab === 'details' && (
              <div className="space-y-6">
                {session.description && (
                  <section>
                    <h2 className="v2-heading mb-2 text-xl">{t('sessionDetails.aboutSession')}</h2>
                    <p className="leading-relaxed text-slate-300">{session.description}</p>
                  </section>
                )}
                {session.notes && (
                  <div className="rounded-xl border border-vsb-700 bg-vsb-900/40 p-4">
                    <div className="flex items-start gap-2">
                      <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-vsb-300" aria-hidden />
                      <div>
                        <p className="mb-1 text-sm font-semibold text-chalk">{t('sessionDetails.notesFromClub')}</p>
                        <p className="text-sm text-slate-300">{session.notes}</p>
                      </div>
                    </div>
                  </div>
                )}
                <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <InfoRow label={t('sessionDetails.dateLabel')} value={formatDate(session.session_date)} />
                  <InfoRow label={t('sessionDetails.timeLabel')} value={`${formatTime(session.start_time)} – ${formatTime(session.end_time)}`} />
                  <InfoRow label={t('sessionDetails.venueLabel')} value={session.venue_name} />
                  <InfoRow label={t('sessionDetails.courtLabel')} value={session.court_number || t('common.notSpecified')} />
                  <InfoRow label={t('v2.sessions.skillLevel')} value={t(SKILL_LEVEL_KEY[skill])} />
                  <InfoRow label={t('sessionDetails.capacityLabel')} value={t('sessionDetails.capacityValue', { confirmed: session.confirmed_count, max: session.maximum_capacity, available })} />
                </dl>
                <section className="v2-surface p-4">
                  <p className="mb-3 text-sm font-semibold text-chalk">{t('sessionDetails.needHelp')}</p>
                  <div className="flex flex-wrap gap-3">
                    <a
                      href={whatsappLink(settings?.contact_whatsapp || '0137441727', t('sessionDetails.whatsappQuestion', { title: session.title, date: formatDate(session.session_date) }))}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
                    >
                      <MessageCircle className="h-4 w-4" aria-hidden />
                      {t('sessionDetails.whatsappBtn', { number: settings?.contact_whatsapp || '0137441727' })}
                    </a>
                    {settings?.whatsapp_group_link && (
                      <a href={settings.whatsapp_group_link} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-green-500/50 px-4 py-2 text-sm font-medium text-green-400 transition-colors hover:bg-green-500/10">
                        <MessageCircle className="h-4 w-4" aria-hidden />
                        {t('sessionDetails.joinGroup')}
                      </a>
                    )}
                  </div>
                </section>
              </div>
            )}

            {tab === 'rules' && (
              <div className="space-y-6">
                <section>
                  <h2 className="v2-heading mb-3 text-xl">{t('sessionDetails.sessionRules')}</h2>
                  <ul className="space-y-2 text-slate-300">
                    {rules.map((rule) => (
                      <li key={rule} className="flex gap-2"><span className="text-vsb-500" aria-hidden>—</span>{rule}</li>
                    ))}
                  </ul>
                </section>
                <section>
                  <h2 className="v2-heading mb-3 text-xl">{t('sessionDetails.whatToBring')}</h2>
                  <ul className="flex flex-wrap gap-2">
                    {requiredItems.map((item) => (
                      <li key={item} className="rounded-lg border border-ink-600 bg-ink-800 px-3 py-1.5 text-sm text-slate-200">{item}</li>
                    ))}
                  </ul>
                </section>
              </div>
            )}

            {tab === 'location' && (
              <section className="v2-surface p-5">
                <h2 className="v2-heading text-xl">{session.venue_name}</h2>
                {session.court_number && <p className="mt-1 text-sm text-slate-400">{session.court_number}</p>}
                <p className="mt-3 text-slate-300">{session.venue_address || t('common.notSpecified')}</p>
                {session.maps_link && (
                  <a href={session.maps_link} target="_blank" rel="noopener noreferrer" className="v2-btn-secondary mt-4 !py-2 text-sm">
                    <MapPin className="h-4 w-4" aria-hidden />
                    {t('sessionDetails.viewOnMaps')}
                  </a>
                )}
              </section>
            )}
          </div>
        </div>

        {/* Booking panel */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="v2-surface p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t('sessionDetails.pricePerPlayer')}</p>
            <p className="font-display text-4xl font-extrabold text-chalk">{session.price > 0 ? formatCurrency(session.price) : 'TBC'}</p>
            {session.price === 0 && <p className="mt-0.5 text-xs text-amber-400">{t('sessionDetails.tbcNote')}</p>}

            <div className="my-4 space-y-1 border-y border-ink-600 py-3 text-sm text-slate-400">
              <p>{t('sessionDetails.bookingDeadline', { date: session.booking_close_at ? formatDate(session.booking_close_at) : t('common.none') })}</p>
              <p>{t('sessionDetails.cancellationDeadline')}</p>
              <p className="font-medium text-amber-400">{t('sessionDetails.nonRefundable')}</p>
            </div>

            {canBook && (
              <p className="mb-3 text-sm text-slate-300">{t('v2.session.openSlots', { count: available })}</p>
            )}

            {needsPasskey && !unlocked ? (
              <PasskeyGate sessionId={session.id} onUnlocked={() => setUnlocked(true)} />
            ) : canBook ? (
              <button
                onClick={() => navigate(`/checkout/${session.id}`, { state: { passkeyVerified: true } })}
                className="v2-btn-primary w-full !py-3 text-lg"
              >
                {t('sessionDetails.bookThisSession')}
              </button>
            ) : status === 'Fully Booked' ? (
              myWaitlistEntry?.status === 'Waiting' ? (
                <div className="w-full rounded-xl border border-amber-500/40 bg-amber-500/10 py-3 text-center font-bold text-amber-300">
                  {t('sessionDetails.onWaitlist')}
                </div>
              ) : (
                <button
                  onClick={handleJoinWaitlist}
                  className="w-full rounded-xl bg-amber-500 py-3 text-lg font-bold text-ink transition-colors hover:bg-amber-400"
                >
                  {t('sessionDetails.joinWaitlist')}
                </button>
              )
            ) : (
              <div className="w-full rounded-xl bg-ink-700 py-3 text-center font-bold text-slate-400">
                {t(SESSION_STATUS_KEY[status] || status)}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Meta({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <dt className="sr-only">{label}</dt>
      <Icon className="h-4 w-4 flex-shrink-0 text-vsb-400" aria-hidden />
      <dd>{value}</dd>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-ink-600 bg-ink-800 p-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-chalk">{value}</dd>
    </div>
  );
}
