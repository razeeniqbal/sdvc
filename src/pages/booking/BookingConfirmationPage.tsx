import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Clock as ClockPending, Calendar, Clock, MapPin, Ticket, ArrowRight, CalendarPlus, MessageCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { bookingDisplayName, formatCurrency, formatDate, formatTime } from '@/lib/format';
import { fetchClubSettings } from '@/lib/settings';
import { StatusBadge, GenderBadge } from '@/components/StatusBadge';
import type { Booking, Session, Payment, ClubSettings } from '@/types/database';
import { Spinner } from '@/components/LoadingScreen';
import { ReceiptUpload } from '@/components/ReceiptUpload';

export default function BookingConfirmationPage() {
  const { t } = useTranslation();
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [groupBookings, setGroupBookings] = useState<Booking[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [settings, setSettings] = useState<ClubSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClubSettings().then(setSettings);
    if (!bookingId) return;
    (async () => {
      const { data: b } = await supabase.from('bookings').select('*').eq('id', bookingId).maybeSingle();
      if (!b) {
        navigate('/sessions');
        return;
      }
      setBooking(b as Booking);
      // Companion bookings share a booking_group_id, so pull the rest of the group
      // (if any) to show the whole party and the combined total on this one page.
      if (b.booking_group_id) {
        const { data: group } = await supabase.from('bookings').select('*').eq('booking_group_id', b.booking_group_id).order('created_at', { ascending: true });
        setGroupBookings((group || []) as Booking[]);
      }
      const { data: s } = await supabase.from('sessions').select('*').eq('id', b.session_id).maybeSingle();
      setSession(s as Session);
      const { data: p } = await supabase.from('payments').select('*').eq('booking_id', b.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
      setPayment(p as Payment);
      setLoading(false);
    })();
    // reload only when the booking id changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  function handleAddToCalendar() {
    if (!session) return;
    const start = new Date(`${session.session_date}T${session.start_time}`);
    const end = new Date(`${session.session_date}T${session.end_time}`);
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const title = encodeURIComponent(session.title);
    const details = encodeURIComponent(`Volleyball session at ${session.venue_name}`);
    const location = encodeURIComponent(session.venue_name);
    const dates = `${fmt(start)}/${fmt(end)}`;
    window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${location}`, '_blank');
  }

  if (loading || !booking || !session) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spinner className="h-8 w-8 text-navy-600" />
      </div>
    );
  }

  const isConfirmed = booking.booking_status === 'Confirmed';
  const allBookings = groupBookings.length > 0 ? groupBookings : [booking];
  const totalAmount = allBookings.reduce((sum, b) => sum + Number(b.total_amount), 0);

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {isConfirmed ? (
          <div className="bg-green-600 p-6 sm:p-8 text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-white/15 mb-3">
              <CheckCircle2 className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-xl font-semibold text-white mb-1">{t('bookingConfirmation.bookingConfirmed')}</h1>
            <p className="text-green-100 text-sm">{t('bookingConfirmation.slotReserved')}</p>
          </div>
        ) : (
          <div className="bg-amber-500 p-6 sm:p-8 text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-white/15 mb-3">
              <ClockPending className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-xl font-semibold text-white mb-1">{t('bookingConfirmation.slotLocked')}</h1>
            <p className="text-amber-50 text-sm">{t('bookingConfirmation.awaitingConfirmation')}</p>
          </div>
        )}

        <div className="p-6 sm:p-8 space-y-6">
          {/* Booking reference */}
          <div className="text-center bg-slate-50 rounded-xl p-4">
            <p className="text-xs text-slate-500 mb-1">{t('bookingConfirmation.bookingReference')}</p>
            <p className="text-2xl font-mono font-bold text-slate-900">{booking.booking_reference}</p>
          </div>

          {/* Session info */}
          <div>
            <h2 className="font-bold text-slate-900 mb-3">{t('bookingConfirmation.sessionInformation')}</h2>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-slate-600">
                <Ticket className="h-4 w-4 text-slate-500" />
                <span className="font-medium text-slate-900">{session.title}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Calendar className="h-4 w-4 text-slate-500" />
                <span>{formatDate(session.session_date)}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Clock className="h-4 w-4 text-slate-500" />
                <span>{formatTime(session.start_time)} - {formatTime(session.end_time)}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <MapPin className="h-4 w-4 text-slate-500" />
                <span>{session.venue_name} {session.court_number && `· ${session.court_number}`}</span>
              </div>
            </div>
          </div>

          {/* Player info */}
          <div>
            <h2 className="font-bold text-slate-900 mb-3">
              {allBookings.length > 1 ? `${t('bookingConfirmation.playerInformation')} (${allBookings.length})` : t('bookingConfirmation.playerInformation')}
            </h2>
            {allBookings.length > 1 ? (
              <div className="space-y-1.5">
                {allBookings.map((b) => (
                  <div key={b.id} className="flex items-center justify-between gap-2 bg-slate-50 rounded-lg px-3 py-2 text-sm">
                    <span className="flex items-center gap-1.5 font-medium text-slate-900 truncate">
                      {bookingDisplayName(b, profile)}
                      <GenderBadge gender={b.is_guest ? b.guest_gender : profile?.gender} />
                    </span>
                    <StatusBadge status={b.booking_status} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-1 text-sm text-slate-600">
                <p><span className="text-slate-500">{t('bookingConfirmation.nameLabel')}</span> <span className="font-medium text-slate-900">{profile?.full_name}</span></p>
                <p><span className="text-slate-500">{t('bookingConfirmation.phoneLabel')}</span> <span className="font-medium text-slate-900">{profile?.phone_number || t('common.na')}</span></p>
              </div>
            )}
          </div>

          {/* Payment info */}
          <div>
            <h2 className="font-bold text-slate-900 mb-3">{t('bookingConfirmation.paymentInformation')}</h2>
            <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">{t('bookingConfirmation.statusLabel')}</span>
                <span className={`font-semibold ${isConfirmed ? 'text-green-600' : 'text-amber-600'}`}>
                  {isConfirmed ? t('bookingConfirmation.paid') : t('bookingConfirmation.pendingVerification')}
                </span>
              </div>
              {isConfirmed && (
                <>
                  <div className="flex justify-between">
                    <span className="text-slate-500">{t('bookingConfirmation.methodLabel')}</span>
                    <span className="font-medium text-slate-900">{payment?.payment_method || t('common.na')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">{t('bookingConfirmation.referenceLabel')}</span>
                    <span className="font-mono text-slate-900">{payment?.transaction_reference || t('common.na')}</span>
                  </div>
                </>
              )}
              {allBookings.length > 1 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('checkout.totalPlayers')}</span>
                  <span className="font-medium text-slate-900">{allBookings.length}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-slate-200">
                <span className="font-bold text-slate-900">{isConfirmed ? t('bookingConfirmation.amountPaid') : t('bookingConfirmation.amountDue')}</span>
                <span className={`text-lg font-bold ${isConfirmed ? 'text-green-600' : 'text-amber-600'}`}>{formatCurrency(totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Payment receipt upload */}
          {!isConfirmed && profile && (
            <ReceiptUpload booking={booking} session={session} profile={profile} qrUrl={settings?.payment_qr_url} groupBookings={groupBookings} onUploaded={(path) => setBooking({ ...booking, receipt_path: path })} />
          )}

          {/* Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={handleAddToCalendar}
              className="flex items-center justify-center gap-2 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-colors"
            >
              <CalendarPlus className="h-5 w-5" />
              {t('bookingConfirmation.addToCalendar')}
            </button>
            <Link
              to="/bookings"
              className="flex items-center justify-center gap-2 py-3 bg-navy-700 hover:bg-navy-800 text-white font-semibold rounded-xl transition-all"
            >
              <Ticket className="h-5 w-5" />
              {t('bookingConfirmation.viewMyBookings')}
            </Link>
          </div>

          <Link to="/sessions" className="flex items-center justify-center gap-1.5 text-sm text-navy-700 font-semibold hover:underline">
            {t('bookingConfirmation.bookAnotherSession')}
            <ArrowRight className="h-4 w-4" />
          </Link>

          {settings?.whatsapp_group_link && (
            <a href={settings.whatsapp_group_link} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 text-sm text-green-600 font-semibold hover:underline">
              <MessageCircle className="h-4 w-4" />
              {t('bookingConfirmation.joinWhatsappGroup')}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
