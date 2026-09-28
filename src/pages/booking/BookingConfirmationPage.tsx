import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Clock as ClockPending, Calendar, Clock, MapPin, Ticket, ArrowRight, CalendarPlus, MessageCircle } from 'lucide-react';
import { useMyAvatar } from '@/lib/avatars';
import { HoldCountdown } from '@/components/vsb/HoldCountdown';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { bookingDisplayName, formatCurrency, formatDate, formatTime } from '@/lib/format';
import { fetchClubSettings } from '@/lib/settings';
import { StatusBadge, GenderBadge } from '@/components/StatusBadge';
import type { Booking, Session, Payment, ClubSettings } from '@/types/database';
import { Spinner } from '@/components/LoadingScreen';
import { ReceiptUpload } from '@/components/ReceiptUpload';
import { BookingSteps } from '@/components/BookingSteps';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { vsbAssets } from '@/lib/vsbAssets';

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
  const myAvatar = useMyAvatar(profile?.id);

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
        <Spinner className="h-8 w-8 text-vsb-500" />
      </div>
    );
  }

  const isConfirmed = booking.booking_status === 'Confirmed';
  const verifying = !isConfirmed && !!booking.receipt_path;
  const allBookings = groupBookings.length > 0 ? groupBookings : [booking];
  const totalAmount = allBookings.reduce((sum, b) => sum + (b.payment_status !== 'Paid' ? session.price : Number(b.total_amount)), 0);
  // celebrate: confirmed, or the spot was just locked · waiting: receipt being verified
  const art = verifying ? vsbAssets.states.waiting : vsbAssets.states.celebrate;
  const displayName = profile?.short_name || profile?.full_name || '';

  return (
    <div className="bg-ink text-chalk">
      {/* ===== Success: you're on court (state always in words, not just art) ===== */}
      <section className="relative overflow-hidden border-b border-ink-600">
        <img src={vsbAssets.court.horizontal1024.src} alt="" width={1024} height={356} className="absolute inset-0 h-full w-full object-cover opacity-15" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/85 to-ink/40" aria-hidden />
        <div className="vsb-gutter relative grid items-end gap-6 pt-8 md:grid-cols-[minmax(0,1fr)_auto] md:pt-10">
          <div className="pb-10 md:pb-14">
            <BookingSteps current={isConfirmed ? 3 : 2} />
            <p className={`mt-8 inline-flex items-center gap-2 font-display text-lg font-bold uppercase tracking-wider ${isConfirmed ? 'text-green-400' : 'text-amber-300'}`}>
              {isConfirmed ? <CheckCircle2 className="h-5 w-5" aria-hidden /> : <ClockPending className="h-5 w-5" aria-hidden />}
              {isConfirmed ? t('bookingConfirmation.bookingConfirmed') : verifying ? t('bookingConfirmation.pendingVerification') : t('v2.booking.payToConfirm')}
            </p>
            <h1 className="vsb-display mt-2 text-5xl sm:text-6xl lg:text-7xl">
              {isConfirmed ? t('v2.booking.onCourt') : t('bookingConfirmation.slotLocked')}
            </h1>

            <div className="mt-6 flex items-center gap-3">
              <PlayerAvatar name={displayName || '?'} src={myAvatar?.thumb} seed={profile?.id} size="md" />
              <p className="font-semibold text-chalk">
                {displayName}
                {allBookings.length > 1 && <span className="text-slate-400"> {t('v2.booking.plusFriends', { count: allBookings.length - 1 })}</span>}
              </p>
            </div>

            <p className="mt-6 font-display text-3xl font-extrabold uppercase leading-none tracking-wide text-chalk sm:text-4xl">{session.title}</p>
            <p className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-lg text-slate-200">
              <span className="inline-flex items-center gap-2"><Calendar className="h-4 w-4 text-vsb-400" aria-hidden />{formatDate(session.session_date)}</span>
              <span className="inline-flex items-center gap-2"><Clock className="h-4 w-4 text-vsb-400" aria-hidden />{formatTime(session.start_time)} – {formatTime(session.end_time)}</span>
            </p>
            <p className="mt-1 inline-flex items-center gap-2 text-slate-300">
              <MapPin className="h-4 w-4 text-vsb-400" aria-hidden />{[session.venue_name, session.court_number].filter(Boolean).join(' · ')}
            </p>
          </div>
          <img src={art.full.src} alt="" width={art.full.width} height={art.full.height} decoding="async"
            className="hidden h-[22rem] w-auto self-end md:block lg:h-[26rem]" />
        </div>
      </section>

      {/* ===== Reference, payment, actions ===== */}
      <div className="vsb-gutter grid gap-12 py-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-16 lg:py-14">
        <div className="space-y-8">
          <dl className="grid grid-cols-2 gap-6 border-b border-ink-600 pb-6">
            <div>
              <dt className="vsb-meta mb-1">{t('bookingConfirmation.bookingReference')}</dt>
              <dd className="font-mono text-2xl font-bold tracking-wider text-chalk">{booking.booking_reference}</dd>
            </div>
            <div>
              <dt className="vsb-meta mb-1">{isConfirmed ? t('bookingConfirmation.amountPaid') : t('bookingConfirmation.amountDue')}</dt>
              <dd className={`font-display text-3xl font-extrabold ${isConfirmed ? 'text-green-400' : 'text-amber-300'}`}>{formatCurrency(totalAmount)}</dd>
            </div>
            {isConfirmed && (
              <>
                <div>
                  <dt className="vsb-meta mb-1">{t('bookingConfirmation.methodLabel')}</dt>
                  <dd className="font-semibold text-chalk">{payment?.payment_method || t('common.na')}</dd>
                </div>
                <div>
                  <dt className="vsb-meta mb-1">{t('bookingConfirmation.referenceLabel')}</dt>
                  <dd className="font-mono text-chalk">{payment?.transaction_reference || t('common.na')}</dd>
                </div>
              </>
            )}
          </dl>

          {!isConfirmed && !booking.receipt_path && booking.reserved_until && <HoldCountdown reservedUntil={booking.reserved_until} />}

          {!isConfirmed && profile && (
            <ReceiptUpload booking={booking} session={session} profile={profile} qrUrl={settings?.payment_qr_url} groupBookings={groupBookings} onUploaded={(path) => setBooking({ ...booking, receipt_path: path })} />
          )}

          {allBookings.length > 1 && (
            <div>
              <h2 className="vsb-meta mb-3">{t('bookingConfirmation.playerInformation')} ({allBookings.length})</h2>
              <ul className="divide-y divide-ink-700 border-y border-ink-600">
                {allBookings.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="flex min-w-0 items-center gap-2 font-medium text-chalk">
                      <PlayerAvatar name={bookingDisplayName(b, profile)} src={b.is_guest ? null : myAvatar?.thumb} seed={b.is_guest ? null : profile?.id} guest={b.is_guest} size="xs" />
                      <span className="truncate">{bookingDisplayName(b, profile)}</span>
                      <GenderBadge gender={b.is_guest ? b.guest_gender : profile?.gender} />
                    </span>
                    <StatusBadge status={b.booking_status} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Link to={`/bookings/${booking.id}`} className="v2-btn-primary !py-3 font-display uppercase tracking-wider">
              <Ticket className="h-5 w-5" aria-hidden />
              {t('v2.booking.viewBooking')}
            </Link>
            <button onClick={handleAddToCalendar} className="v2-btn-secondary !py-3">
              <CalendarPlus className="h-5 w-5" aria-hidden />
              {t('bookingConfirmation.addToCalendar')}
            </button>
            <Link to={`/sessions/${session.id}`} className="v2-btn-secondary !py-3">{t('v2.booking.viewSession')}</Link>
            <Link to="/bookings" className="v2-btn-secondary !py-3">{t('bookingConfirmation.viewMyBookings')}</Link>
          </div>
          <Link to="/sessions" className="inline-flex items-center gap-1.5 text-sm font-semibold text-vsb-400 hover:text-vsb-300">
            {t('bookingConfirmation.bookAnotherSession')} <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          {settings?.whatsapp_group_link && (
            <a href={settings.whatsapp_group_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm font-semibold text-green-400 hover:underline">
              <MessageCircle className="h-4 w-4" aria-hidden />
              {t('bookingConfirmation.joinWhatsappGroup')}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
