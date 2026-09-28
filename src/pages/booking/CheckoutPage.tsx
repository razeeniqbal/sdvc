import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ShieldCheck, Clock, UserPlus, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { formatCurrency, formatDate, formatTime } from '@/lib/format';
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

// A friend is either a registered VSB member (memberId) or a typed-in guest.
interface Companion {
  kind: 'member' | 'guest';
  memberId?: string;
  avatarUrl?: string | null;
  name: string;
  phone: string;
  gender: string;
}

export default function CheckoutPage() {
  const { t } = useTranslation();
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, refreshProfile } = useAuth();
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
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spinner className="h-8 w-8 text-vsb-500" />
      </div>
    );
  }

  if (needsPasskey && !unlocked) {
    return (
      <div className="max-w-md mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <Link to={`/sessions/${session.id}`} className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white mb-4">
          <ArrowLeft className="h-4 w-4" />
          {t('checkout.backToSession')}
        </Link>
        <PasskeyGate sessionId={session.id} onUnlocked={() => setUnlocked(true)} />
      </div>
    );
  }

  const inputClass = 'v2-input !py-2.5 !text-base';
  const labelClass = 'block text-sm font-medium text-slate-200 mb-1.5';
  const totalPlayers = 1 + companions.length;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <Link to={`/sessions/${session.id}`} className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white mb-4">
        <ArrowLeft className="h-4 w-4" />
        {t('checkout.backToSession')}
      </Link>

      <div className="mb-6 space-y-4">
        <BookingSteps current={1} />
        <h1 className="v2-heading text-3xl sm:text-4xl">{t('checkout.title')}</h1>
      </div>

      {/* A single <form> acts as the grid container so `order` can resequence the three
          sections independently of the DOM: on mobile that puts the summary between the
          fields and the policy/button (so players see what they're booking and how much
          before hitting a paywall-looking button); on desktop the same order values fall
          into place as fields+policy stacked on the left and summary spanning the right. */}
      <form onSubmit={handleSubmit} className="grid lg:grid-cols-3 gap-6">
        {/* Player details (order 1) */}
        <div className="lg:col-span-2 order-1 v2-surface p-6">
          <div className="mb-4 flex items-center gap-3">
            <PlayerAvatar name={form.short_name || profile?.full_name || '?'} size="md" />
            <h2 className="v2-heading text-xl">{t('checkout.playerDetails')}</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="co-name" className={labelClass}>{t('checkout.displayName')}</label>
              <input id="co-name" className={inputClass} value={form.short_name} onChange={(e) => setForm({ ...form, short_name: e.target.value })} required />
            </div>
            <div>
              <label htmlFor="co-phone" className={labelClass}>{t('checkout.phoneNumber')}</label>
              <input id="co-phone" className={inputClass} value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} required />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 mt-4">
            <div>
              <label htmlFor="co-gender" className={labelClass}>{t('common.genderLabel')}</label>
              <select id="co-gender" className={inputClass} value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} required>
                <option value="" disabled>{t('common.genderSelectPlaceholder')}</option>
                <option value="Male">{t('common.genderMale')}</option>
                <option value="Female">{t('common.genderFemale')}</option>
              </select>
            </div>
          </div>

          {/* Companions */}
          <div className="border-t border-ink-600 pt-4 mt-4">
            <h3 className="font-semibold text-chalk text-sm">{t('checkout.companionsTitle')}</h3>
            <p className="text-xs text-slate-400 mb-3">{t('checkout.companionsSubtitle')}</p>
            <div className="space-y-3">
              {companions.map((c, i) => c.kind === 'member' ? (
                <div key={i} className="flex items-start gap-2">
                  <div className="flex-1">
                    {c.memberId ? (
                      <div className="flex items-center gap-3 border border-ink-600 bg-ink-850 px-3 py-2">
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
                  <button
                    type="button"
                    onClick={() => removeCompanion(i)}
                    title={t('checkout.removeCompanion')}
                    aria-label={t('checkout.removeCompanion')}
                    className="mt-2.5 p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors flex-shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div key={i} className="flex items-start gap-2">
                  <div className="grid sm:grid-cols-3 gap-2 flex-1">
                    <input
                      className={inputClass}
                      placeholder={t('checkout.companionNamePlaceholder')}
                      aria-label={`${t('checkout.companionName')} ${i + 1}`}
                      value={c.name}
                      onChange={(e) => updateCompanion(i, 'name', e.target.value)}
                    />
                    <input
                      className={inputClass}
                      placeholder={t('checkout.companionPhone')}
                      aria-label={`${t('checkout.companionPhone')} ${i + 1}`}
                      value={c.phone}
                      onChange={(e) => updateCompanion(i, 'phone', e.target.value)}
                    />
                    <select
                      className={inputClass}
                      value={c.gender}
                      aria-label={`${t('common.genderLabel')} ${i + 1}`}
                      onChange={(e) => updateCompanion(i, 'gender', e.target.value)}
                      required
                    >
                      <option value="" disabled>{t('common.genderSelectPlaceholder')}</option>
                      <option value="Male">{t('common.genderMale')}</option>
                      <option value="Female">{t('common.genderFemale')}</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeCompanion(i)}
                    title={t('checkout.removeCompanion')}
                    aria-label={t('checkout.removeCompanion')}
                    className="mt-2.5 p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors flex-shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            {companions.length < MAX_COMPANIONS ? (
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
                <button type="button" onClick={() => addCompanion('member')} className="inline-flex items-center gap-1.5 text-sm font-semibold text-vsb-400 hover:text-vsb-300">
                  <UserPlus className="h-4 w-4" aria-hidden />
                  {t('v2.friend.addMember')}
                </button>
                <button type="button" onClick={() => addCompanion('guest')} className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-300 hover:text-white">
                  <UserPlus className="h-4 w-4" aria-hidden />
                  {t('v2.friend.addGuest')}
                </button>
              </div>
            ) : (
              <p className="mt-3 text-xs text-muted">{t('v2.booking.companionLimit', { count: MAX_COMPANIONS })}</p>
            )}
          </div>
        </div>

        {/* Summary (order 2 on mobile; spans both rows on the right on desktop) */}
        <div className="order-2 lg:row-span-2">
          <div className="v2-surface p-6 lg:sticky lg:top-20">
            <h2 className="v2-heading text-xl mb-4">{t('checkout.bookingSummary')}</h2>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-slate-400">{t('checkout.sessionLabel')}</p>
                <p className="font-semibold text-chalk">{session.title}</p>
              </div>
              <div>
                <p className="text-slate-400">{t('checkout.dateTimeLabel')}</p>
                <p className="font-medium text-chalk">{formatDate(session.session_date)}</p>
                <p className="text-slate-300">{formatTime(session.start_time)} - {formatTime(session.end_time)}</p>
              </div>
              <div>
                <p className="text-slate-400">{t('checkout.venueLabel')}</p>
                <p className="font-medium text-chalk">{session.venue_name}</p>
              </div>
              <div className="pt-3 border-t border-ink-600">
                <p className="text-slate-400 mb-2">{t('v2.booking.players')}</p>
                <ul className="space-y-1.5">
                  <li className="flex items-center gap-2">
                    <PlayerAvatar name={form.short_name || '?'} size="xs" />
                    <span className="font-medium text-chalk truncate">{form.short_name || profile?.full_name}</span>
                  </li>
                  {companions.map((c, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <PlayerAvatar name={c.name || '?'} src={c.avatarUrl} guest={c.kind === 'guest'} size="xs" />
                      <span className="truncate text-slate-300">{c.name.trim() || t('v2.booking.companionN', { n: i + 1 })}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{t('checkout.totalPlayers')}</span>
                <span className="font-semibold text-chalk">{totalPlayers}</span>
              </div>
              {session.price > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-400">{t('v2.booking.pricePerPlayer')}</span>
                  <span className="text-chalk">{formatCurrency(session.price)}</span>
                </div>
              )}
              {session.price > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-400">{t('bookingConfirmation.amountDue')}</span>
                  <span className="font-display text-2xl font-bold text-chalk">{formatCurrency(session.price * totalPlayers)}</span>
                </div>
              )}
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-slate-400 bg-ink-850 rounded-lg p-3">
              <Clock className="h-4 w-4 text-vsb-400 flex-shrink-0" />
              {t('checkout.lockedNotice')}
            </div>
          </div>
        </div>

        {/* Policy + submit (order 3) */}
        <div className="lg:col-span-2 order-3 v2-surface p-6 space-y-4">
          {/* Cancellation policy */}
          <div className="bg-amber-500/10 border border-amber-500/40 rounded-xl p-4">
            <div className="flex items-start gap-2 mb-3">
              <ShieldCheck className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-200 text-sm mb-1">{t('checkout.policyTitle')}</p>
                <ul className="text-xs text-amber-300 space-y-1">
                  <li>• {t('checkout.policyRule1')}</li>
                  <li>• {t('checkout.policyRule2')}</li>
                  <li>• {t('checkout.policyRule3')}</li>
                  <li>• {t('checkout.policyRule4')}</li>
                </ul>
              </div>
            </div>
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1 h-4 w-4 rounded border-ink-500 accent-[#168BFF] bg-ink-850" />
              <span className="text-sm text-amber-200">{t('checkout.agreeLabel')}</span>
            </label>
          </div>

          <p className="text-xs text-slate-400 text-center">{t('checkout.noPaymentYetNote')}</p>

          <button
            type="submit"
            disabled={submitting || !agreed}
            className="v2-btn-primary w-full !py-3.5 text-lg"
          >
            {submitting && <Spinner className="h-5 w-5" />}
            {submitting ? t('checkout.lockingSlot') : totalPlayers > 1 ? t('checkout.lockSlotsButton', { count: totalPlayers }) : t('checkout.lockMySlot')}
          </button>
        </div>
      </form>
    </div>
  );
}
