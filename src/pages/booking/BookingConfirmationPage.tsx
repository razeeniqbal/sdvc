import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarPlus, MessageCircle } from 'lucide-react';
import { useMyAvatar } from '@/lib/avatars';
import { HoldCountdown } from '@/components/vsb/HoldCountdown';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { bookingDisplayName, dateParts, formatCurrency, formatTime } from '@/lib/format';
import { fetchClubSettings } from '@/lib/settings';
import { StatusBadge, GenderBadge } from '@/components/StatusBadge';
import type { Booking, Session, Payment, ClubSettings } from '@/types/database';
import { TicketSkeleton } from '@/components/vsb/Skeletons';
import { ReceiptUpload } from '@/components/ReceiptUpload';
import { BookingSteps } from '@/components/BookingSteps';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { vsbAssets } from '@/lib/vsbAssets';

// CONFIRMATION: you're on court. Celebratory but plain: the state in words,
// the game, the player's own VSB player, then reference, payment and actions.
export default function BookingConfirmationPage() {
  const { t, i18n } = useTranslation();
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
    return <TicketSkeleton />;
  }

  const isConfirmed = booking.booking_status === 'Confirmed';
  const verifying = !isConfirmed && !!booking.receipt_path;
  const allBookings = groupBookings.length > 0 ? groupBookings : [booking];
  const totalAmount = allBookings.reduce((sum, b) => sum + (b.payment_status !== 'Paid' ? session.price : Number(b.total_amount)), 0);
  const displayName = profile?.short_name || profile?.full_name || '';
  const d = dateParts(session.session_date, i18n.language);
  // The player's own generated VSB player when they have one; otherwise the
  // state art (celebrate once confirmed or locked, waiting while verifying).
  const state = verifying ? vsbAssets.states.waiting : vsbAssets.states.celebrate;
  const figure = myAvatar?.image
    ? { src: myAvatar.image, width: 1024, height: 1536, alt: t('v2.booking.yourPlayerAlt', { name: displayName }) }
    : { ...state.full, alt: '' };

  return (
    <div className="bg-ink text-chalk">
      {/* ===== You're on court (state always in words, not just art) ===== */}
      <section aria-labelledby="confirm-title" className="relative overflow-hidden border-b border-ink-600">
        <div className="vsb-gutter relative grid items-end gap-6 pt-8 md:grid-cols-[minmax(0,1fr)_auto] md:pt-10">
          <div className="pb-10 md:pb-14">
            <BookingSteps current={isConfirmed ? 3 : 2} />
            {!isConfirmed && (
              <p className="mt-8 font-display text-lg font-bold uppercase tracking-wider text-amber-300">
                {verifying ? t('bookingConfirmation.pendingVerification') : t('v2.booking.payToConfirm')}
              </p>
            )}
            <h1 id="confirm-title" className={`vsb-display text-5xl sm:text-6xl lg:text-7xl ${isConfirmed ? 'mt-8' : 'mt-2'}`}>
              {isConfirmed ? t('v2.booking.onCourt') : t('bookingConfirmation.slotLocked')}
            </h1>

            <div className="mt-8 flex flex-wrap items-end gap-x-8 gap-y-4 border-t border-ink-600 pt-6">
              <p className="font-display uppercase leading-none" aria-hidden>
                <span className="block text-sm font-bold tracking-[0.25em] text-vsb-300">{d.weekday}</span>
                <span className="block text-7xl font-extrabold text-chalk">{String(d.day).padStart(2, '0')}</span>
                <span className="block text-sm font-bold tracking-[0.25em] text-chalk">{d.month}</span>
              </p>
              <div className="min-w-0 pb-1">
                <p className="font-display text-3xl font-extrabold uppercase leading-none tracking-wide text-chalk sm:text-4xl">{session.title}</p>
                <p className="mt-2 text-lg text-slate-200">
                  {t('v2.session.timeRange', { start: formatTime(session.start_time), end: formatTime(session.end_time) })}
                </p>
                <p className="text-slate-300">{[session.venue_name, session.court_number].filter(Boolean).join(' · ')}</p>
                <p className="mt-2 font-semibold text-chalk">
                  {displayName}
                  {allBookings.length > 1 && <span className="text-slate-400"> {t('v2.booking.plusFriends', { count: allBookings.length - 1 })}</span>}
                </p>
              </div>
            </div>
          </div>
          <img src={figure.src} alt={figure.alt} width={figure.width} height={figure.height} decoding="async"
            className="hidden h-64 w-auto self-end object-contain md:block lg:h-80" />
        </div>
      </section>

      {/* ===== Reference + payment | actions ===== */}
      <div className="vsb-gutter grid gap-12 py-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-16 lg:py-14">
        <div className="min-w-0 space-y-8">
          <dl className="grid grid-cols-2 gap-6 border-b border-ink-600 pb-6">
            <div>
              <dt className="vsb-meta mb-1">{t('bookingConfirmation.bookingReference')}</dt>
              <dd className="font-mono text-2xl font-bold tracking-wider text-chalk">{booking.booking_reference}</dd>
            </div>
            <div>
              <dt className="vsb-meta mb-1">{isConfirmed ? t('bookingConfirmation.amountPaid') : t('bookingConfirmation.amountDue')}</dt>
              <dd className={`font-display text-2xl font-extrabold sm:text-3xl ${isConfirmed ? 'text-green-400' : 'text-amber-300'}`}>{formatCurrency(totalAmount)}</dd>
            </div>
            {isConfirmed && payment?.payment_method && (
              <div>
                <dt className="vsb-meta mb-1">{t('bookingConfirmation.methodLabel')}</dt>
                <dd className="font-semibold text-chalk">{payment.payment_method}</dd>
              </div>
            )}
            {isConfirmed && payment?.transaction_reference && (
              <div>
                <dt className="vsb-meta mb-1">{t('bookingConfirmation.referenceLabel')}</dt>
                <dd className="font-mono text-chalk">{payment.transaction_reference}</dd>
              </div>
            )}
          </dl>

          {!isConfirmed && !booking.receipt_path && booking.reserved_until && <HoldCountdown reservedUntil={booking.reserved_until} />}

          {!isConfirmed && profile && (
            <ReceiptUpload booking={booking} session={session} profile={profile} qrUrl={settings?.payment_qr_url} groupBookings={groupBookings} onUploaded={(path) => setBooking({ ...booking, receipt_path: path })} />
          )}

          {allBookings.length > 1 && (
            <div>
              <h2 className="vsb-meta mb-3">{t('v2.booking.players')} ({allBookings.length})</h2>
              <ul className="divide-y divide-ink-700 border-y border-ink-600">
                {allBookings.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="flex min-w-0 items-center gap-2 font-medium text-chalk">
                      <PlayerAvatar name={bookingDisplayName(b, profile)} src={b.is_guest ? null : myAvatar?.thumb} guest={b.is_guest} size="xs" />
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

        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <Link to={`/bookings/${booking.id}`} className="v2-btn-primary !py-3.5 font-display uppercase tracking-wider">{t('v2.booking.viewGame')}</Link>
            <Link to="/bookings" className="v2-btn-secondary !py-3.5 font-display uppercase tracking-wider">{t('v2.nav.myGames')}</Link>
          </div>
          <div className="flex flex-col items-start gap-3 border-t border-ink-600 pt-5">
            <button onClick={handleAddToCalendar} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-200 hover:text-white">
              <CalendarPlus className="h-4 w-4" aria-hidden /> {t('bookingConfirmation.addToCalendar')}
            </button>
            {settings?.whatsapp_group_link && (
              <a href={settings.whatsapp_group_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-green-400 hover:text-green-300">
                <MessageCircle className="h-4 w-4" aria-hidden /> {t('bookingConfirmation.joinWhatsappGroup')}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
