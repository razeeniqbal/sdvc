import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, CreditCard, Landmark, QrCode, Wallet, Banknote, ShieldCheck, Clock, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { formatCurrency, formatDate, formatTime } from '@/lib/format';
import { PAYMENT_METHODS, type PaymentMethod, type Booking, type Session } from '@/types/database';
import { notifyWhatsAppGroup } from '@/lib/notifications';
import { Spinner } from '@/components/LoadingScreen';

const methodIcons: Record<PaymentMethod, any> = {
  'Credit Card': CreditCard,
  'Debit Card': CreditCard,
  'FPX': Landmark,
  'DuitNow QR': QrCode,
  'E-Wallet': Wallet,
  'Manual Bank Transfer': Banknote,
  'Cash': Banknote,
};

export default function PaymentPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const { show } = useToast();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>('Credit Card');
  const [timeLeft, setTimeLeft] = useState(600);

  useEffect(() => {
    if (!bookingId) return;
    (async () => {
      const { data: b, error } = await supabase.from('bookings').select('*').eq('id', bookingId).maybeSingle();
      if (error || !b) {
        show('Booking not found', 'error');
        navigate('/sessions');
        return;
      }
      setBooking(b as Booking);
      const { data: s } = await supabase.from('sessions').select('*').eq('id', b.session_id).maybeSingle();
      setSession(s as Session);
      setLoading(false);

      if (b.reserved_until) {
        const remaining = Math.max(0, Math.floor((new Date(b.reserved_until).getTime() - Date.now()) / 1000));
        setTimeLeft(remaining);
      }
    })();
  }, [bookingId]);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => setTimeLeft((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  async function handlePay() {
    if (!booking || !session) return;
    if (timeLeft <= 0) {
      show('Your reservation has expired. Please book again.', 'error');
      navigate('/sessions');
      return;
    }
    setProcessing(true);

    // Simulate payment processing
    await new Promise((r) => setTimeout(r, 1500));

    // Create payment record
    const { error: payError } = await supabase.from('payments').insert({
      booking_id: booking.id,
      payment_provider: 'simulated',
      payment_method: method,
      amount: booking.total_amount,
      payment_status: 'Paid',
      transaction_reference: 'SIM-' + Date.now(),
      paid_at: new Date().toISOString(),
    });

    if (payError) {
      show(payError.message, 'error');
      setProcessing(false);
      return;
    }

    // Update booking to confirmed
    const { error: bookingError } = await supabase.from('bookings').update({
      booking_status: 'Confirmed',
      payment_status: 'Paid',
      reserved_until: null,
    }).eq('id', booking.id);

    if (bookingError) {
      show(bookingError.message, 'error');
      setProcessing(false);
      return;
    }

    // Create notification
    await supabase.from('notifications').insert({
      user_id: booking.user_id,
      booking_id: booking.id,
      notification_type: 'booking_confirmation',
      title: 'Booking Confirmed',
      message: `Your booking ${booking.booking_reference} for "${session.title}" is confirmed. See you on court!`,
      delivery_channel: 'in_app',
      delivery_status: 'Sent',
      sent_at: new Date().toISOString(),
    });

    await supabase.from('notifications').insert({
      user_id: booking.user_id,
      booking_id: booking.id,
      notification_type: 'payment_successful',
      title: 'Payment Successful',
      message: `Payment of ${formatCurrency(booking.total_amount)} received for booking ${booking.booking_reference}.`,
      delivery_channel: 'in_app',
      delivery_status: 'Sent',
      sent_at: new Date().toISOString(),
    });

    // Notify WhatsApp group about slot update
    const { count } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', session.id)
      .in('booking_status', ['Confirmed']);
    const slotsLeft = session.maximum_capacity - (count || 0);
    await notifyWhatsAppGroup(
      `Slot Update: "${session.title}" on ${formatDate(session.session_date)} at ${formatTime(session.start_time)} — ${slotsLeft} slot${slotsLeft === 1 ? '' : 's'} left (${count || 0}/${session.maximum_capacity} booked).`
    );

    setProcessing(false);
    show('Payment successful!', 'success');
    navigate(`/confirmation/${booking.id}`);
  }

  if (loading || !booking || !session) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spinner className="h-8 w-8 text-orange-500" />
      </div>
    );
  }

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <Link to={`/sessions/${session.id}`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">Payment</h1>
      <div className="flex items-center gap-2 mb-6">
        <Clock className="h-4 w-4 text-orange-500" />
        <span className={`text-sm font-medium ${timeLeft < 60 ? 'text-red-600' : 'text-slate-600'}`}>
          Reservation expires in {mins}:{secs.toString().padStart(2, '0')}
        </span>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Payment methods */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="font-bold text-slate-900 mb-4">Select Payment Method</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PAYMENT_METHODS.filter((m) => m !== 'Cash').map((m) => {
                const Icon = methodIcons[m];
                return (
                  <button
                    key={m}
                    onClick={() => setMethod(m)}
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                      method === m
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                      method === m ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-slate-900 text-sm">{m}</p>
                    </div>
                    {method === m && <CheckCircle2 className="h-5 w-5 text-orange-500" />}
                  </button>
                );
              })}
            </div>

            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-start gap-2">
                <ShieldCheck className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-blue-900">Secure Payment</p>
                  <p className="text-xs text-blue-700 mt-1">
                    This is a simulated payment for demonstration. No real charges are made.
                    The payment module is structured for easy integration with Malaysian payment
                    providers (Billplz, ToyyibPay, Stripe, SenangPay).
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={handlePay}
              disabled={processing || timeLeft <= 0}
              className="w-full mt-6 py-4 bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white font-bold rounded-xl text-lg transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {processing ? (
                <>
                  <Spinner className="h-5 w-5" />
                  Processing payment...
                </>
              ) : (
                `Pay ${formatCurrency(booking.total_amount)}`
              )}
            </button>
          </div>
        </div>

        {/* Summary */}
        <div>
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sticky top-20">
            <h2 className="font-bold text-slate-900 mb-4">Order Summary</h2>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-slate-500">Booking Reference</p>
                <p className="font-mono font-semibold text-slate-900">{booking.booking_reference}</p>
              </div>
              <div>
                <p className="text-slate-500">Session</p>
                <p className="font-semibold text-slate-900">{session.title}</p>
              </div>
              <div>
                <p className="text-slate-500">Date & Time</p>
                <p className="text-slate-900">{formatDate(session.session_date)}</p>
                <p className="text-slate-600">{formatTime(session.start_time)} - {formatTime(session.end_time)}</p>
              </div>
              <div>
                <p className="text-slate-500">Venue</p>
                <p className="text-slate-900">{session.venue_name}</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Session fee</span>
                <span className="font-medium text-slate-900">{formatCurrency(booking.subtotal)}</span>
              </div>
              {booking.processing_fee > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Processing fee</span>
                  <span className="font-medium text-slate-900">{formatCurrency(booking.processing_fee)}</span>
                </div>
              )}
              {booking.discount_amount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>-{formatCurrency(booking.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-slate-100">
                <span className="font-bold text-slate-900">Total</span>
                <span className="text-xl font-bold text-rose-600">{formatCurrency(booking.total_amount)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
