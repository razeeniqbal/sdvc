import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next';
import { ArrowLeft, Calendar, Clock, MapPin, Tag, Users, CreditCard, XCircle, AlertTriangle, type LucideIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { bookingDisplayName, formatCurrency, formatDate, formatTime, formatDateTime } from '@/lib/format';
import { notifyGroup } from '@/lib/notifications';
import { fetchSessionRoster, buildRosterMessage } from '@/lib/sessions';
import { fetchClubSettings } from '@/lib/settings';
import { StatusBadge, PaymentStatusBadge } from '@/components/StatusBadge';
import { Spinner } from '@/components/LoadingScreen';
import { ReceiptUpload } from '@/components/ReceiptUpload';
import type { Booking, Session, Payment, Attendance, ClubSettings } from '@/types/database';

export default function BookingDetailsPage() {
  const { t } = useTranslation();
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
  const [settings, setSettings] = useState<ClubSettings | null>(null);
  const [groupBookings, setGroupBookings] = useState<Booking[]>([]);

  useEffect(() => {
    fetchClubSettings().then(setSettings);
    if (!id || !profile) return;
    (async () => {
      const { data: b } = await supabase.from('bookings').select('*').eq('id', id).maybeSingle();
      if (!b) {
        navigate('/bookings');
        return;
      }
      setBooking(b as Booking);
      if (b.booking_group_id) {
        const { data: group } = await supabase.from('bookings').select('*').eq('booking_group_id', b.booking_group_id).order('created_at', { ascending: true });
        setGroupBookings((group || []) as Booking[]);
      }
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

    // Notify the group with the updated roster now that a slot opened up
    const roster = await fetchSessionRoster(session.id);
    await notifyGroup(buildRosterMessage(session, roster));

    setCancelling(false);
    setShowCancelDialog(false);
    show(t('bookingDetails.errorBookingCancelled'), 'info');
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
        {t('bookingDetails.backToBookings')}
      </Link>

      <div className="glass-card rounded-2xl border border-white/50 overflow-hidden">
        <div className="bg-gradient-to-r from-slate-900 via-rose-950 to-slate-900 p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-white">{session.title}</h1>
              <p className="font-mono text-sm text-slate-400 mt-1">{booking.booking_reference}</p>
              {booking.is_guest && (
                <p className="text-sm text-rose-200 mt-1">{t('myBookings.bookingFor', { name: booking.guest_name })}</p>
              )}
              {groupBookings.length > 1 && (
                <p className="text-sm text-slate-400 mt-1">
                  Booked together with: {groupBookings.filter((b) => b.id !== booking.id).map((b) => bookingDisplayName(b, profile)).join(', ')}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5 items-end">
              <StatusBadge status={booking.booking_status} />
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Session info */}
          <div>
            <h2 className="font-bold text-slate-900 mb-3">{t('bookingDetails.sessionDetails')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <InfoItem icon={Calendar} label={t('bookingDetails.dateLabel')} value={formatDate(session.session_date)} />
              <InfoItem icon={Clock} label={t('bookingDetails.timeLabel')} value={`${formatTime(session.start_time)} - ${formatTime(session.end_time)}`} />
              <InfoItem icon={MapPin} label={t('bookingDetails.venueLabel')} value={session.venue_name} />
              <InfoItem icon={Tag} label={t('bookingDetails.courtLabel')} value={session.court_number || t('common.na')} />
              <InfoItem icon={Users} label={t('sessionDetails.capacityLabel')} value={t('bookingDetails.capacityValue', { count: session.maximum_capacity })} />
            </div>
            {session.maps_link && (
              <a href={session.maps_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-rose-600 font-medium text-sm mt-3 hover:underline">
                <MapPin className="h-4 w-4" />
                {t('bookingDetails.viewOnMaps')}
              </a>
            )}
          </div>

          {/* Payment info */}
          <div>
            <h2 className="font-bold text-slate-900 mb-3">{t('bookingDetails.paymentDetails')}</h2>
            <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">{t('bookingDetails.sessionFee')}</span><span className="font-medium">{formatCurrency(booking.subtotal)}</span></div>
              {booking.processing_fee > 0 && <div className="flex justify-between"><span className="text-slate-500">{t('bookingDetails.processingFee')}</span><span className="font-medium">{formatCurrency(booking.processing_fee)}</span></div>}
              {booking.discount_amount > 0 && <div className="flex justify-between text-green-600"><span>{t('bookingDetails.discount')}</span><span>-{formatCurrency(booking.discount_amount)}</span></div>}
              <div className="flex justify-between pt-2 border-t border-slate-200"><span className="font-bold text-slate-900">{t('bookingDetails.total')}</span><span className="text-lg font-bold text-rose-600">{formatCurrency(booking.total_amount)}</span></div>
            </div>
            {payments.length > 0 && (
              <div className="mt-3 space-y-2">
                {payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-slate-500" />
                      <span className="text-slate-600">{p.payment_method || t('bookingDetails.paymentFallback')}</span>
                      <span className="font-mono text-xs text-slate-500">{p.transaction_reference}</span>
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
              <h2 className="font-bold text-slate-900 mb-3">{t('bookingDetails.attendance')}</h2>
              <div className="bg-slate-50 rounded-xl p-3 text-sm">
                <span className="text-slate-500">{t('bookingDetails.statusLabel')} </span>
                <span className="font-medium text-slate-900">{attendance.attendance_status || t('bookingDetails.notRecorded')}</span>
              </div>
            </div>
          )}

          {/* Cancellation info */}
          {booking.cancelled_at && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-start gap-2">
                <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-900 text-sm">{t('bookingDetails.bookingCancelled')}</p>
                  <p className="text-red-700 text-sm mt-0.5">{booking.cancellation_reason}</p>
                  <p className="text-red-600 text-xs mt-1">{t('bookingDetails.cancelledOn', { date: formatDateTime(booking.cancelled_at) })}</p>
                </div>
              </div>
            </div>
          )}

          {/* Awaiting confirmation notice */}
          {awaitingConfirmation && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-900 text-sm">{t('bookingDetails.awaitingAdminConfirmation')}</p>
                <p className="text-amber-700 text-sm mt-0.5">{t('bookingDetails.awaitingAdminConfirmationDesc')}</p>
              </div>
            </div>
          )}

          {/* Payment receipt upload */}
          {awaitingConfirmation && profile && (
            <ReceiptUpload booking={booking} session={session} profile={profile} qrUrl={settings?.payment_qr_url} groupBookings={groupBookings} onUploaded={(path) => setBooking({ ...booking, receipt_path: path })} />
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            {canCancel && (
              <button
                onClick={() => setShowCancelDialog(true)}
                className="flex-1 py-3 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-xl border border-red-200 transition-colors"
              >
                {t('bookingDetails.cancelBooking')}
              </button>
            )}
            {!canCancel && !isPast && booking.booking_status === 'Confirmed' && (
              <div className="flex-1 py-3 bg-amber-50 text-amber-700 text-sm font-medium rounded-xl border border-amber-200 text-center flex items-center justify-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                {t('bookingDetails.cancellationPeriodPassed')}
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
                <h3 className="font-bold text-slate-900">{t('bookingDetails.cancelDialogTitle')}</h3>
                <p className="text-sm text-slate-500 mt-1">
                  <Trans i18nKey="bookingDetails.cancelDialogDesc" components={{ strong: <strong /> }} />
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowCancelDialog(false)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-colors">
                {t('bookingDetails.keepBooking')}
              </button>
              <button onClick={handleCancel} disabled={cancelling} className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg transition-colors disabled:opacity-60">
                {cancelling ? t('bookingDetails.cancelling') : t('bookingDetails.yesCancel')}
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
      <Icon className="h-4 w-4 text-slate-500 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-sm font-medium text-slate-900">{value}</p>
      </div>
    </div>
  );
}
