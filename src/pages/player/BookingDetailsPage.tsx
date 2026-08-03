import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, MapPin, Tag, Users, CreditCard, XCircle, AlertTriangle, type LucideIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { formatCurrency, formatDate, formatTime, formatDateTime } from '@/lib/format';
import { notifyGroup } from '@/lib/notifications';
import { StatusBadge, PaymentStatusBadge } from '@/components/StatusBadge';
import { Spinner } from '@/components/LoadingScreen';
import type { Booking, Session, Payment, Attendance } from '@/types/database';

export default function BookingDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { show } = useToast();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [attendance, setAttendance] = useState<Attendance | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!id || !profile) return;
    (async () => {
      const { data: b } = await supabase.from('bookings').select('*').eq('id', id).maybeSingle();
      if (!b) {
        navigate('/bookings');
        return;
      }
      setBooking(b as Booking);
      const { data: s } = await supabase.from('sessions').select('*').eq('id', b.session_id).maybeSingle();
      setSession(s as Session);
      const { data: pays } = await supabase.from('payments').select('*').eq('booking_id', b.id).order('created_at', { ascending: false });
      setPayments((pays || []) as Payment[]);
      const { data: att } = await supabase.from('attendance').select('*').eq('booking_id', b.id).maybeSingle();
      setAttendance(att as Attendance);
      setLoading(false);
    })();
    // reload only when the booking id or profile changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, profile]);

  async function handleCancel() {
    if (!booking || !session) return;
    setCancelling(true);

    const sessionDate = new Date(`${session.session_date}T${session.start_time}`);
    const hoursBefore = (sessionDate.getTime() - Date.now()) / (1000 * 60 * 60);
    const canCancelWithRefund = hoursBefore >= 24;

    const { error } = await supabase.from('bookings').update({
      booking_status: 'Cancelled by Player',
      payment_status: canCancelWithRefund && booking.payment_status === 'Paid' ? 'Refunded' : booking.payment_status,
      cancelled_at: new Date().toISOString(),
      cancellation_reason: canCancelWithRefund ? 'Cancelled by player (within 24h policy)' : 'Cancelled by player (late cancellation)',
    }).eq('id', booking.id);

    if (error) {
      show(error.message, 'error');
      setCancelling(false);
      return;
    }

    await supabase.from('notifications').insert({
      user_id: booking.user_id,
      booking_id: booking.id,
      notification_type: 'booking_cancellation',
      title: 'Booking Cancelled',
      message: `Your booking ${booking.booking_reference} for "${session.title}" has been cancelled. All bookings are non-refundable.`,
      delivery_channel: 'in_app',
      delivery_status: 'Sent',
      sent_at: new Date().toISOString(),
    });

    // Notify WhatsApp group about slot opening up
    const { data: countData } = await supabase.rpc('confirmed_booking_count', { p_session_id: session.id });
    const count = (countData as number) || 0;
    const slotsLeft = session.maximum_capacity - count;
    await notifyGroup(
      `Slot Update: A slot opened up for "${session.title}" on ${formatDate(session.session_date)} — ${slotsLeft} slot${slotsLeft === 1 ? '' : 's'} now available (${count}/${session.maximum_capacity} booked).`
    );

    setCancelling(false);
    setShowCancelDialog(false);
    show('Booking cancelled. All bookings are non-refundable.', 'info');
    navigate('/bookings');
  }

  if (loading || !booking || !session) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spinner className="h-8 w-8 text-orange-500" />
      </div>
    );
  }

  const sessionDate = new Date(`${session.session_date}T${session.start_time}`);
  const hoursBefore = (sessionDate.getTime() - Date.now()) / (1000 * 60 * 60);
  const canCancel = ['Confirmed', 'Pending Payment'].includes(booking.booking_status) && hoursBefore > 24;
  const isPast = sessionDate < new Date();
  const awaitingConfirmation = booking.booking_status === 'Pending Payment';

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <Link to="/bookings" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ArrowLeft className="h-4 w-4" />
        Back to bookings
      </Link>

      <div className="glass-card rounded-2xl border border-white/50 overflow-hidden">
        <div className="bg-gradient-to-r from-slate-900 via-rose-950 to-slate-900 p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-white">{session.title}</h1>
              <p className="font-mono text-sm text-slate-400 mt-1">{booking.booking_reference}</p>
            </div>
            <div className="flex flex-col gap-1.5 items-end">
              <StatusBadge status={booking.booking_status} />
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Session info */}
          <div>
            <h2 className="font-bold text-slate-900 mb-3">Session Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <InfoItem icon={Calendar} label="Date" value={formatDate(session.session_date)} />
              <InfoItem icon={Clock} label="Time" value={`${formatTime(session.start_time)} - ${formatTime(session.end_time)}`} />
              <InfoItem icon={MapPin} label="Venue" value={session.venue_name} />
              <InfoItem icon={Tag} label="Court" value={session.court_number || 'N/A'} />
              <InfoItem icon={Users} label="Capacity" value={`${session.maximum_capacity} players`} />
            </div>
            {session.maps_link && (
              <a href={session.maps_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-rose-600 font-medium text-sm mt-3 hover:underline">
                <MapPin className="h-4 w-4" />
                View on Google Maps
              </a>
            )}
          </div>

          {/* Payment info */}
          <div>
            <h2 className="font-bold text-slate-900 mb-3">Payment Details</h2>
            <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Session fee</span><span className="font-medium">{formatCurrency(booking.subtotal)}</span></div>
              {booking.processing_fee > 0 && <div className="flex justify-between"><span className="text-slate-500">Processing fee</span><span className="font-medium">{formatCurrency(booking.processing_fee)}</span></div>}
              {booking.discount_amount > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>-{formatCurrency(booking.discount_amount)}</span></div>}
              <div className="flex justify-between pt-2 border-t border-slate-200"><span className="font-bold text-slate-900">Total</span><span className="text-lg font-bold text-rose-600">{formatCurrency(booking.total_amount)}</span></div>
            </div>
            {payments.length > 0 && (
              <div className="mt-3 space-y-2">
                {payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-slate-400" />
                      <span className="text-slate-700">{p.payment_method || 'Payment'}</span>
                      <span className="font-mono text-xs text-slate-400">{p.transaction_reference}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <PaymentStatusBadge status={p.payment_status} />
                      <span className="text-slate-900 font-medium">{formatCurrency(p.amount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Attendance */}
          {attendance && (
            <div>
              <h2 className="font-bold text-slate-900 mb-3">Attendance</h2>
              <div className="bg-slate-50 rounded-xl p-3 text-sm">
                <span className="text-slate-500">Status: </span>
                <span className="font-medium text-slate-900">{attendance.attendance_status || 'Not recorded'}</span>
              </div>
            </div>
          )}

          {/* Cancellation info */}
          {booking.cancelled_at && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-start gap-2">
                <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-900 text-sm">Booking Cancelled</p>
                  <p className="text-red-700 text-sm mt-0.5">{booking.cancellation_reason}</p>
                  <p className="text-red-600 text-xs mt-1">Cancelled on {formatDateTime(booking.cancelled_at)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Awaiting confirmation notice */}
          {awaitingConfirmation && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-900 text-sm">Awaiting Admin Confirmation</p>
                <p className="text-amber-700 text-sm mt-0.5">Your slot is locked. The club admin will verify your payment and confirm this booking soon.</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            {canCancel && (
              <button
                onClick={() => setShowCancelDialog(true)}
                className="flex-1 py-3 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-xl border border-red-200 transition-colors"
              >
                Cancel Booking
              </button>
            )}
            {!canCancel && !isPast && booking.booking_status === 'Confirmed' && (
              <div className="flex-1 py-3 bg-amber-50 text-amber-700 text-sm font-medium rounded-xl border border-amber-200 text-center flex items-center justify-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Cancellation period has passed
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cancel dialog */}
      {showCancelDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4" onClick={() => setShowCancelDialog(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600 flex-shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Cancel this booking?</h3>
                <p className="text-sm text-slate-500 mt-1">
                  You can cancel to free up your slot for others. Please note: <strong>all bookings are non-refundable</strong>.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowCancelDialog(false)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-colors">
                Keep Booking
              </button>
              <button onClick={handleCancel} disabled={cancelling} className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg transition-colors disabled:opacity-60">
                {cancelling ? 'Cancelling...' : 'Yes, Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoItem({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-sm font-medium text-slate-900">{value}</p>
      </div>
    </div>
  );
}
