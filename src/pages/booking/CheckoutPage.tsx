import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
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

interface Companion {
  name: string;
  phone: string;
  gender: string;
}

export default function CheckoutPage() {
  const { t } = useTranslation();
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
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
  const [unlocked, setUnlocked] = useState(false);

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

  function addCompanion() {
    setCompanions([...companions, { name: '', phone: '', gender: '' }]);
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
    if (companions.some((c) => !c.name.trim())) {
      show(t('checkout.errorCompanionName'), 'error');
      return;
    }
    if (!form.gender || companions.some((c) => !c.gender)) {
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
    // its own row so admins can confirm/cancel and track attendance per person.
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
    };
    const rows = [
      baseRow,
      ...companions.map((c) => ({
        ...baseRow,
        is_guest: true,
        guest_name: c.name.trim(),
        guest_phone: c.phone.trim() || null,
        guest_gender: c.gender || null,
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
        <Spinner className="h-8 w-8 text-navy-600" />
      </div>
    );
  }

  if (needsPasskey && !unlocked) {
    return (
      <div className="max-w-md mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <Link to={`/sessions/${session.id}`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4">
          <ArrowLeft className="h-4 w-4" />
          {t('checkout.backToSession')}
        </Link>
        <PasskeyGate sessionId={session.id} onUnlocked={() => setUnlocked(true)} />
      </div>
    );
  }

  const inputClass = 'w-full rounded-lg border border-slate-300 px-4 py-2.5 text-slate-900 focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20 outline-none transition-colors';
  const labelClass = 'block text-sm font-medium text-slate-700 mb-1.5';
  const totalPlayers = 1 + companions.length;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <Link to={`/sessions/${session.id}`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ArrowLeft className="h-4 w-4" />
        {t('checkout.backToSession')}
      </Link>

      <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 mb-6">{t('checkout.title')}</h1>

      {/* A single <form> acts as the grid container so `order` can resequence the three
          sections independently of the DOM: on mobile that puts the summary between the
          fields and the policy/button (so players see what they're booking and how much
          before hitting a paywall-looking button); on desktop the same order values fall
          into place as fields+policy stacked on the left and summary spanning the right. */}
      <form onSubmit={handleSubmit} className="grid lg:grid-cols-3 gap-6">
        {/* Player details (order 1) */}
        <div className="lg:col-span-2 order-1 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="font-bold text-slate-900 mb-4">{t('checkout.playerDetails')}</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>{t('checkout.displayName')}</label>
              <input className={inputClass} value={form.short_name} onChange={(e) => setForm({ ...form, short_name: e.target.value })} required />
            </div>
            <div>
              <label className={labelClass}>{t('checkout.phoneNumber')}</label>
              <input className={inputClass} value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} required />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 mt-4">
            <div>
              <label className={labelClass}>{t('common.genderLabel')}</label>
              <select className={inputClass} value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} required>
                <option value="" disabled>{t('common.genderSelectPlaceholder')}</option>
                <option value="Male">{t('common.genderMale')}</option>
                <option value="Female">{t('common.genderFemale')}</option>
              </select>
            </div>
          </div>

          {/* Companions */}
          <div className="border-t border-slate-200 pt-4 mt-4">
            <h3 className="font-semibold text-slate-900 text-sm">{t('checkout.companionsTitle')}</h3>
            <p className="text-xs text-slate-500 mb-3">{t('checkout.companionsSubtitle')}</p>
            <div className="space-y-3">
              {companions.map((c, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="grid sm:grid-cols-3 gap-2 flex-1">
                    <input
                      className={inputClass}
                      placeholder={t('checkout.companionNamePlaceholder')}
                      value={c.name}
                      onChange={(e) => updateCompanion(i, 'name', e.target.value)}
                    />
                    <input
                      className={inputClass}
                      placeholder={t('checkout.companionPhone')}
                      value={c.phone}
                      onChange={(e) => updateCompanion(i, 'phone', e.target.value)}
                    />
                    <select
                      className={inputClass}
                      value={c.gender}
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
                    className="mt-2.5 p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addCompanion}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-navy-700 hover:text-navy-800"
            >
              <UserPlus className="h-4 w-4" />
              {t('checkout.addCompanion')}
            </button>
          </div>
        </div>

        {/* Summary (order 2 on mobile; spans both rows on the right on desktop) */}
        <div className="order-2 lg:row-span-2">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 lg:sticky lg:top-20">
            <h2 className="font-bold text-slate-900 mb-4">{t('checkout.bookingSummary')}</h2>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-slate-500">{t('checkout.sessionLabel')}</p>
                <p className="font-semibold text-slate-900">{session.title}</p>
              </div>
              <div>
                <p className="text-slate-500">{t('checkout.dateTimeLabel')}</p>
                <p className="font-medium text-slate-900">{formatDate(session.session_date)}</p>
                <p className="text-slate-600">{formatTime(session.start_time)} - {formatTime(session.end_time)}</p>
              </div>
              <div>
                <p className="text-slate-500">{t('checkout.venueLabel')}</p>
                <p className="font-medium text-slate-900">{session.venue_name}</p>
              </div>
              <div className="flex justify-between pt-3 border-t border-slate-200">
                <span className="text-slate-500">{t('checkout.totalPlayers')}</span>
                <span className="font-semibold text-slate-900">{totalPlayers}</span>
              </div>
              {session.price > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('bookingConfirmation.amountDue')}</span>
                  <span className="font-bold text-slate-900">{formatCurrency(session.price * totalPlayers)}</span>
                </div>
              )}
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg p-3">
              <Clock className="h-4 w-4 text-navy-500 flex-shrink-0" />
              {t('checkout.lockedNotice')}
            </div>
          </div>
        </div>

        {/* Policy + submit (order 3) */}
        <div className="lg:col-span-2 order-3 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          {/* Cancellation policy */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-start gap-2 mb-3">
              <ShieldCheck className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-900 text-sm mb-1">{t('checkout.policyTitle')}</p>
                <ul className="text-xs text-amber-800 space-y-1">
                  <li>• {t('checkout.policyRule1')}</li>
                  <li>• {t('checkout.policyRule2')}</li>
                  <li>• {t('checkout.policyRule3')}</li>
                  <li>• {t('checkout.policyRule4')}</li>
                </ul>
              </div>
            </div>
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-300 text-navy-600 focus:ring-navy-500" />
              <span className="text-sm text-amber-900">{t('checkout.agreeLabel')}</span>
            </label>
          </div>

          <p className="text-xs text-slate-500 text-center">{t('checkout.noPaymentYetNote')}</p>

          <button
            type="submit"
            disabled={submitting || !agreed}
            className="w-full py-3.5 bg-navy-700 hover:bg-navy-800 text-white font-semibold rounded-xl transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {submitting && <Spinner className="h-5 w-5" />}
            {submitting ? t('checkout.lockingSlot') : totalPlayers > 1 ? t('checkout.lockSlotsButton', { count: totalPlayers }) : t('checkout.lockMySlot')}
          </button>
        </div>
      </form>
    </div>
  );
}
