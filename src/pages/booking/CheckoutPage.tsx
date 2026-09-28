import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, UserPlus, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { formatCurrency, formatDateLocale, formatTime } from '@/lib/format';
import { notifyGroup } from '@/lib/notifications';
import { friendlyProfileError } from '@/lib/auth';
import { fetchSessionRoster, buildRosterMessage } from '@/lib/sessions';
import type { Session, Booking } from '@/types/database';
import { Spinner } from '@/components/LoadingScreen';
import { PasskeyGate } from '@/components/PasskeyGate';
import { MAX_COMPANIONS } from '@/lib/bookingRules';
import { BookingSteps } from '@/components/BookingSteps';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { MemberPicker } from '@/components/vsb/MemberPicker';
import { TicketSkeleton } from '@/components/vsb/Skeletons';
import { useMyAvatar } from '@/lib/avatars';

// A friend is either a registered VSB member (memberId) or a typed-in guest.
interface Companion {
  kind: 'member' | 'guest';
  memberId?: string;
  avatarUrl?: string | null;
  name: string;
  phone: string;
  gender: string;
}

// CHECKOUT: secure my slot. Your game (what, when, who) on the left; your
// slot (price, policy, lock) on the right. Booking logic is unchanged: this
// only locks the place; paying happens on the confirmation page.
export default function CheckoutPage() {
  const { t, i18n } = useTranslation();
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, refreshProfile } = useAuth();
  const myAvatar = useMyAvatar(profile?.id);
  const { show } = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [form, setForm] = useState({
    short_name: '',
    full_name: '',
    phone_number: '',
    gender: '',
  });
  const [companions, setCompanions] = useState<Companion[]>([]);
  const [needsPasskey, setNeedsPasskey] = useState(false);
  // Already verified on the session details page immediately before this navigation —
  // skip asking a second time. A direct link to this URL has no such state, so it
  // still falls through to the passkey prompt below.
  const [unlocked, setUnlocked] = useState(() => !!(location.state as { passkeyVerified?: boolean } | null)?.passkeyVerified);

  useEffect(() => {
    if (!sessionId || !profile) return;
    (async () => {
      const { data, error } = await supabase.from('sessions').select('*').eq('id', sessionId).maybeSingle();
      if (error || !data) {
        show(t('checkout.errorSessionNotFound'), 'error');
        navigate('/sessions');
        return;
      }
      setSession(data as Session);
      // Re-checked here too (not just on the session details page) since this page is
      // reachable directly by URL, which would otherwise skip the passkey prompt entirely.
      const { data: requiresPasskey } = await supabase.rpc('session_requires_passkey', { p_session_id: sessionId });
      setNeedsPasskey(!!requiresPasskey);
      setForm({
        short_name: profile.short_name || profile.full_name || '',
        full_name: profile.full_name || '',
        phone_number: profile.phone_number || '',
        gender: profile.gender || '',
      });
      setLoading(false);
    })();
    // reload only when the session id or profile changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, profile]);

  function addCompanion(kind: Companion['kind']) {
    if (companions.length >= MAX_COMPANIONS) return;
    setCompanions([...companions, { kind, name: '', phone: '', gender: '' }]);
  }

  function updateCompanion(i: number, field: keyof Companion, value: string) {
    setCompanions(companions.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)));
  }

  function removeCompanion(i: number) {
    setCompanions(companions.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!agreed) {
      show(t('checkout.errorAgree'), 'error');
      return;
    }
    if (companions.some((c) => (c.kind === 'member' ? !c.memberId : !c.name.trim()))) {
      show(companions.some((c) => c.kind === 'member' && !c.memberId) ? t('v2.friend.pickFirst') : t('checkout.errorCompanionName'), 'error');
      return;
    }
    if (!form.gender || companions.some((c) => c.kind === 'guest' && !c.gender)) {
      show(t('common.errorGenderRequired'), 'error');
      return;
    }
    if (!session || !profile) return;

    setSubmitting(true);

    const totalSlotsRequested = 1 + companions.length;

    // Check capacity before booking. Uses the SECURITY DEFINER count function so the
    // check sees every booking, not just the caller's own (which RLS would otherwise limit to).
    const { data: activeCountData } = await supabase.rpc('confirmed_booking_count', { p_session_id: session.id });
    const activeCount = (activeCountData as number) || 0;
    const available = session.maximum_capacity - activeCount;

    if (totalSlotsRequested > available) {
      show(available <= 0 ? t('checkout.errorFullyBooked') : t('checkout.errorNotEnoughSlots', { available }), 'error');
      setSubmitting(false);
      if (available <= 0) navigate(`/sessions/${session.id}`);
      return;
    }

    // Check for existing active booking
    const { data: existing } = await supabase
      .from('bookings')
      .select('id')
      .eq('session_id', session.id)
      .eq('user_id', profile.id)
      .eq('is_guest', false)
      .in('booking_status', ['Pending Payment', 'Confirmed'])
      .maybeSingle();

    if (existing) {
      show(t('checkout.errorAlreadyBooked'), 'error');
      setSubmitting(false);
      navigate(`/sessions/${session.id}`);
      return;
    }

    // Update profile with any changes
    const { error: profileError } = await supabase.from('profiles').update({
      full_name: form.full_name || form.short_name,
      short_name: form.short_name,
      phone_number: form.phone_number,
      gender: form.gender,
    }).eq('id', profile.id);
    if (profileError) show(friendlyProfileError(profileError), 'error');
    refreshProfile();

    // Lock the slot(s); admin will manually confirm each booking. No processing fee —
    // payment is collected manually (bank transfer/cash), not via an online processor.
    // Companions share a booking_group_id purely for display grouping; each still gets
    // its own row so admins can confirm/cancel each person.
    const bookingGroupId = companions.length > 0 ? crypto.randomUUID() : null;
    // Every row must set the same keys explicitly — PostgREST's bulk insert sends a
    // literal NULL (not the column default) for any key missing from a given row when
    // the batch's rows don't share an identical key set, which trips the is_guest
    // NOT NULL constraint on the self-booking row as soon as companions are added.
    const baseRow = {
      session_id: session.id,
      booking_status: 'Pending Payment' as const,
      payment_status: 'Manual Payment Pending Verification' as const,
      subtotal: session.price,
      processing_fee: 0,
      discount_amount: 0,
      total_amount: session.price,
      reserved_until: null,
      booking_group_id: bookingGroupId,
      is_guest: false,
      guest_name: null as string | null,
      guest_phone: null as string | null,
      guest_gender: null as string | null,
      guest_user_id: null as string | null,
    };
    const rows = [
      baseRow,
      ...companions.map((c) => ({
        ...baseRow,
        is_guest: true,
        // Member friends: name/gender are filled from their profile server-side.
        guest_name: c.name.trim(),
        guest_phone: c.kind === 'member' ? null : c.phone.trim() || null,
        guest_gender: c.kind === 'member' ? null : c.gender || null,
        guest_user_id: c.kind === 'member' ? c.memberId ?? null : null,
      })),
    ];

    const { data: bookings, error } = await supabase.from('bookings').insert(rows).select();

    if (error || !bookings || bookings.length === 0) {
      show(error?.message || t('checkout.errorFailedBooking'), 'error');
      setSubmitting(false);
      return;
    }

    const selfBooking = (bookings as Booking[]).find((b) => !b.is_guest) || (bookings as Booking[])[0];

    await supabase.from('notifications').insert({
      user_id: profile.id,
      booking_id: selfBooking.id,
      notification_type: 'booking_locked',
      title: 'Slot Locked',
      message: `Your slot for "${session.title}" is locked under booking ${selfBooking.booking_reference}. The club admin will confirm it shortly.`,
      delivery_channel: 'in_app',
      delivery_status: 'Sent',
      sent_at: new Date().toISOString(),
    });

    const roster = await fetchSessionRoster(session.id);
    await notifyGroup(buildRosterMessage(session, roster));

    setSubmitting(false);
    navigate(`/confirmation/${selfBooking.id}`);
  }

  if (loading || !session) {
    return <TicketSkeleton />;
  }

  if (needsPasskey && !unlocked) {
    return (
      <div className="vsb-gutter py-10">
        <Link to={`/sessions/${session.id}`} className="mb-8 inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted hover:text-chalk">
          <ArrowLeft className="h-4 w-4" aria-hidden /> {t('checkout.backToSession')}
        </Link>
        <div className="max-w-md"><PasskeyGate sessionId={session.id} onUnlocked={() => setUnlocked(true)} /></div>
      </div>
    );
  }

  const inputClass = 'v2-input !py-2.5 !text-base';
  const labelClass = 'block text-sm font-medium text-slate-200 mb-1.5';
  const totalPlayers = 1 + companions.length;
  const removeBtn = (i: number) => (
    <button type="button" onClick={() => removeCompanion(i)} title={t('checkout.removeCompanion')} aria-label={t('checkout.removeCompanion')}
      className="mt-2 flex-shrink-0 p-1.5 text-slate-400 transition-colors hover:text-red-400">
      <X className="h-4 w-4" aria-hidden />
    </button>
  );

  return (
    <div className="bg-ink text-chalk">
      <div className="vsb-gutter border-b border-ink-600 py-3">
        <Link to={`/sessions/${session.id}`} className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted hover:text-chalk">
          <ArrowLeft className="h-4 w-4" aria-hidden /> {t('checkout.backToSession')}
        </Link>
      </div>

      <header className="vsb-gutter border-b border-ink-600 py-8 lg:py-10">
        <BookingSteps current={1} />
        <h1 className="vsb-display mt-6 text-5xl lg:text-6xl">{t('v2.checkout.title')}</h1>
      </header>

      {/* Your game (left) | your slot (right). On phones the slot, policy and
          submit come last, after the player has seen what they're booking. */}
      <form onSubmit={handleSubmit} className="grid lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="vsb-gutter space-y-10 py-10 lg:py-12">
          {/* The game */}
          <section aria-labelledby="co-game">
            <h2 id="co-game" className="vsb-meta mb-3">{t('v2.checkout.yourGame')}</h2>
            <p className="font-display text-4xl font-extrabold uppercase leading-none tracking-wide text-chalk">{session.title}</p>
            <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-ink-600 pt-5 sm:grid-cols-4">
              <Fact label={t('sessionDetails.dateLabel')} value={formatDateLocale(session.session_date, i18n.language, 'medium')} />
              <Fact label={t('sessionDetails.timeLabel')} value={t('v2.session.timeRange', { start: formatTime(session.start_time), end: formatTime(session.end_time) })} />
              <Fact label={t('sessionDetails.venueLabel')} value={session.venue_name} />
              <Fact label={t('sessionDetails.courtLabel')} value={session.court_number || t('common.notSpecified')} />
            </dl>
          </section>

          {/* You */}
          <section aria-labelledby="co-player" className="border-t border-ink-600 pt-8">
            <div className="mb-5 flex items-center gap-3">
              <PlayerAvatar name={form.short_name || profile?.full_name || '?'} src={myAvatar?.thumb} size="md" />
              <h2 id="co-player" className="vsb-display text-3xl">{t('checkout.playerDetails')}</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="co-name" className={labelClass}>{t('checkout.displayName')}</label>
                <input id="co-name" className={inputClass} value={form.short_name} onChange={(e) => setForm({ ...form, short_name: e.target.value })} required />
              </div>
              <div>
                <label htmlFor="co-phone" className={labelClass}>{t('checkout.phoneNumber')}</label>
                <input id="co-phone" className={inputClass} value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} required />
              </div>
              <div>
                <label htmlFor="co-gender" className={labelClass}>{t('common.genderLabel')}</label>
                <select id="co-gender" className={inputClass} value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} required>
                  <option value="" disabled>{t('common.genderSelectPlaceholder')}</option>
                  <option value="Male">{t('common.genderMale')}</option>
                  <option value="Female">{t('common.genderFemale')}</option>
                </select>
              </div>
            </div>
          </section>

          {/* Friends */}
          <section aria-labelledby="co-friends" className="border-t border-ink-600 pt-8">
            <h2 id="co-friends" className="vsb-display text-3xl">{t('checkout.companionsTitle')}</h2>
            <p className="mb-4 mt-1 text-sm text-slate-400">{t('checkout.companionsSubtitle')}</p>
            <div className="space-y-3">
              {companions.map((c, i) => c.kind === 'member' ? (
                <div key={i} className="flex items-start gap-2">
                  <div className="flex-1">
                    {c.memberId ? (
                      <div className="flex items-center gap-3 border-y border-ink-600 py-2">
                        <PlayerAvatar name={c.name} src={c.avatarUrl} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold text-chalk">{c.name}</span>
                          <span className="block text-xs text-muted">{t('v2.friend.memberNote')}</span>
                        </span>
                        <button type="button" onClick={() => setCompanions(companions.map((x, idx) => (idx === i ? { ...x, memberId: undefined, name: '', avatarUrl: null } : x)))}
                          className="text-sm font-semibold text-vsb-400 hover:text-vsb-300">{t('v2.friend.change')}</button>
                      </div>
                    ) : (
                      <MemberPicker
                        excludeIds={[profile?.id ?? '', ...companions.map((x) => x.memberId ?? '')]}
                        onPick={(m) => setCompanions(companions.map((x, idx) => (idx === i ? { ...x, memberId: m.user_id, name: m.display_name, avatarUrl: m.avatar_url } : x)))}
                      />
                    )}
                  </div>
                  {removeBtn(i)}
                </div>
              ) : (
                <div key={i} className="flex items-start gap-2">
                  <div className="grid flex-1 gap-2 sm:grid-cols-3">
                    <input className={inputClass} placeholder={t('checkout.companionNamePlaceholder')} aria-label={`${t('checkout.companionName')} ${i + 1}`}
                      value={c.name} onChange={(e) => updateCompanion(i, 'name', e.target.value)} />
                    <input className={inputClass} placeholder={t('checkout.companionPhone')} aria-label={`${t('checkout.companionPhone')} ${i + 1}`}
                      value={c.phone} onChange={(e) => updateCompanion(i, 'phone', e.target.value)} />
                    <select className={inputClass} value={c.gender} aria-label={`${t('common.genderLabel')} ${i + 1}`} onChange={(e) => updateCompanion(i, 'gender', e.target.value)} required>
                      <option value="" disabled>{t('common.genderSelectPlaceholder')}</option>
                      <option value="Male">{t('common.genderMale')}</option>
                      <option value="Female">{t('common.genderFemale')}</option>
                    </select>
                  </div>
                  {removeBtn(i)}
                </div>
              ))}
            </div>
            {companions.length < MAX_COMPANIONS ? (
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
                <button type="button" onClick={() => addCompanion('member')} className="inline-flex items-center gap-1.5 text-sm font-semibold text-vsb-400 hover:text-vsb-300">
                  <UserPlus className="h-4 w-4" aria-hidden /> {t('v2.friend.addMember')}
                </button>
                <button type="button" onClick={() => addCompanion('guest')} className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-300 hover:text-white">
                  <UserPlus className="h-4 w-4" aria-hidden /> {t('v2.friend.addGuest')}
                </button>
              </div>
            ) : (
              <p className="mt-3 text-xs text-muted">{t('v2.booking.companionLimit', { count: MAX_COMPANIONS })}</p>
            )}
          </section>
        </div>

        {/* Your slot */}
        <aside aria-labelledby="co-slot" className="border-t border-ink-600 bg-ink-850 lg:border-l lg:border-t-0">
          <div className="vsb-gutter space-y-6 py-10 lg:sticky lg:top-16 lg:!px-10 lg:py-12">
            <h2 id="co-slot" className="vsb-display text-3xl">{t('v2.checkout.yourSlot')}</h2>
            <ul className="divide-y divide-ink-700 border-y border-ink-600">
              <li className="flex items-center gap-3 py-2.5">
                <PlayerAvatar name={form.short_name || '?'} src={myAvatar?.thumb} size="xs" />
                <span className="truncate font-semibold text-chalk">{form.short_name || profile?.full_name}</span>
              </li>
              {companions.map((c, i) => (
                <li key={i} className="flex items-center gap-3 py-2.5">
                  <PlayerAvatar name={c.name || '?'} src={c.avatarUrl} guest={c.kind === 'guest'} size="xs" />
                  <span className="truncate text-slate-300">{c.name.trim() || t('v2.booking.companionN', { n: i + 1 })}</span>
                </li>
              ))}
            </ul>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-slate-400">{t('checkout.totalPlayers')}</dt><dd className="font-semibold text-chalk">{totalPlayers}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-400">{t('v2.booking.pricePerPlayer')}</dt><dd className="text-chalk">{session.price > 0 ? formatCurrency(session.price) : 'TBC'}</dd></div>
              {session.price > 0 && (
                <div className="flex items-baseline justify-between border-t border-ink-600 pt-3">
                  <dt className="font-semibold text-chalk">{t('bookingConfirmation.amountDue')}</dt>
                  <dd className="font-display text-4xl font-extrabold text-chalk">{formatCurrency(session.price * totalPlayers)}</dd>
                </div>
              )}
            </dl>

            {/* Cancellation policy */}
            <div className="border-l-2 border-amber-400 pl-4">
              <p className="font-semibold text-amber-200">{t('checkout.policyTitle')}</p>
              <ul className="mt-2 space-y-1 text-sm text-amber-300/90">
                <li>{t('checkout.policyRule1')}</li>
                <li>{t('checkout.policyRule2')}</li>
                <li>{t('checkout.policyRule3')}</li>
                <li>{t('checkout.policyRule4')}</li>
              </ul>
              <label className="mt-3 flex cursor-pointer items-start gap-2">
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1 h-4 w-4 accent-[#168BFF]" />
                <span className="text-sm text-amber-100">{t('checkout.agreeLabel')}</span>
              </label>
            </div>

            <button type="submit" disabled={submitting || !agreed} className="v2-btn-primary w-full !py-4 font-display text-lg uppercase tracking-wider">
              {submitting && <Spinner className="h-5 w-5" />}
              {submitting ? t('checkout.lockingSlot') : totalPlayers > 1 ? t('checkout.lockSlotsButton', { count: totalPlayers }) : t('checkout.lockMySlot')}
            </button>
            <p className="text-xs text-slate-400">{t('checkout.noPaymentYetNote')}</p>
          </div>
        </aside>
      </form>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="vsb-meta mb-1">{label}</dt>
      <dd className="font-display text-lg font-bold uppercase leading-tight tracking-wide text-chalk">{value}</dd>
    </div>
  );
}
