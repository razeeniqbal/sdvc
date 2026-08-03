import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { formatCurrency, formatDate, formatTime } from '@/lib/format';
import { SKILL_LEVELS, PLAYING_POSITIONS, type Session } from '@/types/database';
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
    playing_position: '',
    skill_level: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
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
        playing_position: profile.playing_position || '',
        skill_level: profile.skill_level || '',
        emergency_contact_name: profile.emergency_contact_name || '',
        emergency_contact_phone: profile.emergency_contact_phone || '',
      });
      setLoading(false);
    })();
  }, [sessionId, profile]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!agreed) {
      show('Please agree to the booking and cancellation policy', 'error');
      return;
    }
    if (!session || !profile) return;

    setSubmitting(true);

    // Check capacity before booking
    const { count } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', session.id)
      .in('booking_status', ['Pending Payment', 'Confirmed']);

    if ((count || 0) >= session.maximum_capacity) {
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
    await supabase.from('profiles').update({
      full_name: form.full_name || form.short_name,
      short_name: form.short_name,
      phone_number: form.phone_number,
      playing_position: form.playing_position as any,
      skill_level: form.skill_level as any,
      emergency_contact_name: form.emergency_contact_name,
      emergency_contact_phone: form.emergency_contact_phone,
    }).eq('id', profile.id);
    refreshProfile();

    // Create booking with 10-minute reservation
    const processingFee = session.price > 0 ? Math.round(session.price * 0.02 * 100) / 100 : 0;
    const total = session.price + processingFee;
    const reservedUntil = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { data: booking, error } = await supabase.from('bookings').insert({
      session_id: session.id,
      booking_status: 'Pending Payment',
      payment_status: 'Pending',
      subtotal: session.price,
      processing_fee: processingFee,
      discount_amount: 0,
      total_amount: total,
      reserved_until: reservedUntil,
    }).select().single();

    if (error || !booking) {
      show(error?.message || 'Failed to create booking', 'error');
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    navigate(`/payment/${booking.id}`);
  }

  if (loading || !session) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spinner className="h-8 w-8 text-orange-500" />
      </div>
    );
  }

  const processingFee = session.price > 0 ? Math.round(session.price * 0.02 * 100) / 100 : 0;
  const total = session.price + processingFee;
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
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Playing Position</label>
                  <select className={inputClass} value={form.playing_position} onChange={(e) => setForm({ ...form, playing_position: e.target.value })}>
                    <option value="">Select position</option>
                    {PLAYING_POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Skill Level</label>
                  <select className={inputClass} value={form.skill_level} onChange={(e) => setForm({ ...form, skill_level: e.target.value })}>
                    <option value="">Select level</option>
                    {SKILL_LEVELS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Emergency Contact Name</label>
                  <input className={inputClass} value={form.emergency_contact_name} onChange={(e) => setForm({ ...form, emergency_contact_name: e.target.value })} required />
                </div>
                <div>
                  <label className={labelClass}>Emergency Contact Phone</label>
                  <input className={inputClass} value={form.emergency_contact_phone} onChange={(e) => setForm({ ...form, emergency_contact_phone: e.target.value })} required />
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
                      <li>• Your slot is reserved for 10 minutes during checkout.</li>
                      <li>• If payment is not completed within 10 minutes, the reservation is released.</li>
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
                {submitting ? 'Processing...' : 'Proceed to Payment'}
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
            <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Session fee</span>
                <span className="font-medium text-slate-900">{formatCurrency(session.price)}</span>
              </div>
              {processingFee > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Processing fee (2%)</span>
                  <span className="font-medium text-slate-900">{formatCurrency(processingFee)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-slate-100">
                <span className="font-bold text-slate-900">Total</span>
                <span className="text-xl font-bold text-rose-600">{formatCurrency(total)}</span>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg p-3">
              <Clock className="h-4 w-4 text-orange-500" />
              Your slot is held for 10 minutes after proceeding.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
