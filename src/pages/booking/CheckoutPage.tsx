import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { formatDate, formatTime } from '@/lib/format';
import { notifyGroup } from '@/lib/notifications';
import { friendlyProfileError } from '@/lib/auth';
import type { Session } from '@/types/database';
import { Spinner } from '@/components/LoadingScreen';

export default function CheckoutPage() {
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
  });

  useEffect(() => {
    if (!sessionId || !profile) return;
    (async () => {
      const { data, error } = await supabase.from('sessions').select('*').eq('id', sessionId).maybeSingle();
      if (error || !data) {
        show('Session not found', 'error');
        navigate('/sessions');
        return;
      }
      setSession(data as Session);
      setForm({
        short_name: profile.short_name || profile.full_name || '',
        full_name: profile.full_name || '',
        phone_number: profile.phone_number || '',
      });
      setLoading(false);
    })();
    // reload only when the session id or profile changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, profile]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!agreed) {
      show('Please agree to the booking and cancellation policy', 'error');
      return;
    }
    if (!session || !profile) return;

    setSubmitting(true);

    // Check capacity before booking. Uses the SECURITY DEFINER count function so the
    // check sees every booking, not just the caller's own (which RLS would otherwise limit to).
    const { data: activeCountData } = await supabase.rpc('confirmed_booking_count', { p_session_id: session.id });
    const activeCount = (activeCountData as number) || 0;

    if (activeCount >= session.maximum_capacity) {
      show('Sorry, this session is fully booked', 'error');
      setSubmitting(false);
      navigate(`/sessions/${session.id}`);
      return;
    }

    // Check for existing active booking
    const { data: existing } = await supabase
      .from('bookings')
      .select('id')
      .eq('session_id', session.id)
      .eq('user_id', profile.id)
      .in('booking_status', ['Pending Payment', 'Confirmed'])
      .maybeSingle();

    if (existing) {
      show('You already have an active booking for this session', 'error');
      setSubmitting(false);
      navigate(`/sessions/${session.id}`);
      return;
    }

    // Update profile with any changes
    const { error: profileError } = await supabase.from('profiles').update({
      full_name: form.full_name || form.short_name,
      short_name: form.short_name,
      phone_number: form.phone_number,
    }).eq('id', profile.id);
    if (profileError) show(friendlyProfileError(profileError), 'error');
    refreshProfile();

    // Lock the slot; admin will manually confirm the booking. No processing fee —
    // payment is collected manually (bank transfer/cash), not via an online processor.
    const { data: booking, error } = await supabase.from('bookings').insert({
      session_id: session.id,
      booking_status: 'Pending Payment',
      payment_status: 'Manual Payment Pending Verification',
      subtotal: session.price,
      processing_fee: 0,
      discount_amount: 0,
      total_amount: session.price,
      reserved_until: null,
    }).select().single();

    if (error || !booking) {
      show(error?.message || 'Failed to create booking', 'error');
      setSubmitting(false);
      return;
    }

    await supabase.from('notifications').insert({
      user_id: profile.id,
      booking_id: booking.id,
      notification_type: 'booking_locked',
      title: 'Slot Locked',
      message: `Your slot for "${session.title}" is locked under booking ${booking.booking_reference}. The club admin will confirm it shortly.`,
      delivery_channel: 'in_app',
      delivery_status: 'Sent',
      sent_at: new Date().toISOString(),
    });

    const slotsLeft = session.maximum_capacity - activeCount - 1;
    await notifyGroup(
      `New booking locked for "${session.title}" on ${formatDate(session.session_date)} — ${slotsLeft} slot${slotsLeft === 1 ? '' : 's'} left. Awaiting admin confirmation.`
    );

    setSubmitting(false);
    navigate(`/confirmation/${booking.id}`);
  }

  if (loading || !session) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spinner className="h-8 w-8 text-orange-500" />
      </div>
    );
  }

  const inputClass = 'w-full rounded-lg border border-slate-300 px-4 py-2.5 text-slate-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-colors';
  const labelClass = 'block text-sm font-medium text-slate-700 mb-1.5';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <Link to={`/sessions/${session.id}`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ArrowLeft className="h-4 w-4" />
        Back to session
      </Link>

      <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-6">Confirm Your Booking</h1>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Player details */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="font-bold text-slate-900 mb-4">Player Details</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Display Name</label>
                  <input className={inputClass} value={form.short_name} onChange={(e) => setForm({ ...form, short_name: e.target.value })} required />
                </div>
                <div>
                  <label className={labelClass}>Phone Number</label>
                  <input className={inputClass} value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} required />
                </div>
              </div>
              {/* Cancellation policy */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-start gap-2 mb-3">
                  <ShieldCheck className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-amber-900 text-sm mb-1">Booking & Cancellation Policy</p>
                    <ul className="text-xs text-amber-800 space-y-1">
                      <li>• Cancel at least 24 hours before the session to free your slot.</li>
                      <li>• All bookings are non-refundable.</li>
                      <li>• Your slot is locked once you submit, pending admin confirmation.</li>
                      <li>• The club admin will verify your payment and confirm your booking.</li>
                    </ul>
                  </div>
                </div>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500" />
                  <span className="text-sm text-amber-900">I have read and agree to the club booking and cancellation policy.</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={submitting || !agreed}
                className="w-full py-3.5 bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white font-bold rounded-xl transition-all disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {submitting && <Spinner className="h-5 w-5" />}
                {submitting ? 'Locking slot...' : 'Lock My Slot'}
              </button>
            </form>
          </div>
        </div>

        {/* Summary */}
        <div>
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sticky top-20">
            <h2 className="font-bold text-slate-900 mb-4">Booking Summary</h2>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-slate-500">Session</p>
                <p className="font-semibold text-slate-900">{session.title}</p>
              </div>
              <div>
                <p className="text-slate-500">Date & Time</p>
                <p className="font-medium text-slate-900">{formatDate(session.session_date)}</p>
                <p className="text-slate-600">{formatTime(session.start_time)} - {formatTime(session.end_time)}</p>
              </div>
              <div>
                <p className="text-slate-500">Venue</p>
                <p className="font-medium text-slate-900">{session.venue_name}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg p-3">
              <Clock className="h-4 w-4 text-orange-500" />
              Your slot is locked once submitted, pending admin confirmation.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
