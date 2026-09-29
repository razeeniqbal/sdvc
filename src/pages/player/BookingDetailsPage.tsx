import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next';
import { ArrowLeft, ArrowRight, MapPin, UserPlus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { bookingDisplayName, dateParts, formatCurrency, formatDateLocale, formatTime, formatDateTime } from '@/lib/format';
import { notifyGroup } from '@/lib/notifications';
import { fetchSessionRoster, buildRosterMessage } from '@/lib/sessions';
import { fetchClubSettings } from '@/lib/settings';
import { StatusBadge, PaymentStatusBadge, GenderBadge } from '@/components/StatusBadge';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { TicketSkeleton } from '@/components/vsb/Skeletons';
import { useMyAvatar } from '@/lib/avatars';
import { POSITION_KEY } from '@/lib/volleyball';
import { ReceiptUpload } from '@/components/ReceiptUpload';
import { HoldCountdown } from '@/components/vsb/HoldCountdown';
import { ACTIVE_BOOKING_STATUSES, MAX_COMPANIONS } from '@/lib/bookingRules';
import type { Booking, Session, Payment, ClubSettings } from '@/types/database';
import { vsbAssets } from '@/lib/vsbAssets';
import { MemberPicker } from '@/components/vsb/MemberPicker';
import type { CommunityPlayer } from '@/lib/community';

// BOOKING DETAILS: my game ticket. The top is the ticket itself (game, date,
// venue, who holds the place, status, reference); below it, what still needs
// doing (pay, upload, bring a friend) beside payment, venue and cancellation.
export default function BookingDetailsPage() {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { show } = useToast();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [settings, setSettings] = useState<ClubSettings | null>(null);
  const [groupBookings, setGroupBookings] = useState<Booking[]>([]);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [friendForm, setFriendForm] = useState({ name: '', phone: '', gender: '' });
  const [friendKind, setFriendKind] = useState<'member' | 'guest'>('member');
  const [host, setHost] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [addingFriend, setAddingFriend] = useState(false);
  const myAvatar = useMyAvatar(profile?.id);
  // Home's "Pay now" links here with #pay: jump to the payment step once loaded.
  useEffect(() => {
    if (!loading && window.location.hash === '#pay') document.getElementById('pay')?.scrollIntoView({ block: 'start' });
  }, [loading]);

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

  // Friend view: who booked this place, and removing yourself from it.
  useEffect(() => {
    if (!booking?.id || !profile || booking.guest_user_id !== profile.id) return;
    supabase.rpc('friend_booking_host', { p_booking_id: booking.id }).then(({ data }) => setHost((data as string | null) ?? null));
  }, [booking?.id, booking?.guest_user_id, profile]);

  async function leaveGame() {
    if (!booking || !window.confirm(t('v2.friend.leaveConfirm'))) return;
    setLeaving(true);
    const { error } = await supabase.rpc('leave_friend_booking', { p_booking_id: booking.id });
    setLeaving(false);
    if (error) { show(error.message, 'error'); return; }
    show(t('v2.friend.left'), 'success');
    navigate('/bookings');
  }

  // A member friend (picked) or a typed-in guest (form).
  async function handleAddFriend(e: FormEvent | null, member?: CommunityPlayer) {
    e?.preventDefault();
    if (!booking || !session) return;
    if (!member) {
      if (!friendForm.name.trim()) { show(t('checkout.errorCompanionName'), 'error'); return; }
      if (!friendForm.gender) { show(t('common.errorGenderRequired'), 'error'); return; }
    }
    setAddingFriend(true);

    // Uses the SECURITY DEFINER count function so the check sees every booking, not
    // just the caller's own (which RLS would otherwise limit to) — same guard as
    // CheckoutPage's initial booking flow.
    const { data: activeCountData } = await supabase.rpc('confirmed_booking_count', { p_session_id: session.id });
    const activeCount = (activeCountData as number) || 0;
    const available = session.maximum_capacity - activeCount;
    if (available < 1) {
      show(t('checkout.errorFullyBooked'), 'error');
      setAddingFriend(false);
      return;
    }

    // The original booking may have been made solo, with no booking_group_id yet —
    // backfill one now so the new companion row can link to it.
    let groupId = booking.booking_group_id;
    if (!groupId) {
      groupId = crypto.randomUUID();
      const { error: linkError } = await supabase.from('bookings').update({ booking_group_id: groupId }).eq('id', booking.id);
      if (linkError) {
        show(linkError.message, 'error');
        setAddingFriend(false);
        return;
      }
    }

    const { error } = await supabase.from('bookings').insert({
      session_id: session.id,
      booking_status: 'Pending Payment',
      payment_status: 'Manual Payment Pending Verification',
      subtotal: session.price,
      processing_fee: 0,
      discount_amount: 0,
      total_amount: session.price,
      booking_group_id: groupId,
      is_guest: true,
      // Member friends: name/gender are filled from their profile server-side.
      guest_name: member ? member.display_name : friendForm.name.trim(),
      guest_phone: member ? null : friendForm.phone.trim() || null,
      guest_gender: member ? null : friendForm.gender || null,
      guest_user_id: member ? member.user_id : null,
    });

    if (error) {
      show(error.message, 'error');
      setAddingFriend(false);
      return;
    }

    const { data: group } = await supabase.from('bookings').select('*').eq('booking_group_id', groupId).order('created_at', { ascending: true });
    setGroupBookings((group || []) as Booking[]);
    setBooking({ ...booking, booking_group_id: groupId });

    const roster = await fetchSessionRoster(session.id);
    await notifyGroup(buildRosterMessage(session, roster));

    setAddingFriend(false);
    setShowAddFriend(false);
    setFriendForm({ name: '', phone: '', gender: '' });
    show(t('bookingDetails.friendAdded'), 'success');
  }

  if (loading || !booking || !session) {
    return <TicketSkeleton />;
  }

  // Opened by a member whose friend booked this place for them.
  const friendView = !!profile && booking.guest_user_id === profile.id;

  const sessionDate = new Date(`${session.session_date}T${session.start_time}`);
  const hoursBefore = (sessionDate.getTime() - Date.now()) / (1000 * 60 * 60);
  const canCancel = !friendView && ['Confirmed', 'Pending Payment'].includes(booking.booking_status) && hoursBefore > 24;
  const isPast = sessionDate < new Date();
  const awaitingConfirmation = booking.booking_status === 'Pending Payment';
  // A friend added after this booking was already confirmed still needs to be paid
  // for — the receipt upload can't be gated on just the original booking's status.
  const groupHasPendingPayment = awaitingConfirmation || groupBookings.some((b) => b.id !== booking.id && b.booking_status === 'Pending Payment');
  // Only the original booker (not a companion looking at their own row) can add
  // someone else, and only while the booking is still active and the session hasn't
  // happened yet or closed.
  const activeCompanions = groupBookings.filter((b) => b.is_guest && ACTIVE_BOOKING_STATUSES.includes(b.booking_status)).length;
  const canAddFriend = !friendView && !booking.is_guest && ['Pending Payment', 'Confirmed'].includes(booking.booking_status) && !isPast && session.status === 'Open' && activeCompanions < MAX_COMPANIONS;

  const d = dateParts(session.session_date, i18n.language);
  const cancelled = booking.booking_status.includes('Cancelled') || booking.booking_status === 'Refunded';
  const onCourt = ['Confirmed', 'Completed'].includes(booking.booking_status);
  const headline = cancelled ? t('bookingDetails.bookingCancelled')
    : awaitingConfirmation ? t('v2.booking.payToConfirm')
    : onCourt && isPast ? t('v2.games.state.played')
    : onCourt ? t('v2.booking.onCourt')
    : t(`v2.status.booking.${booking.booking_status}`, { defaultValue: booking.booking_status });
  // Whose place this ticket is: the booker's own, a companion they brought, or
  // (friend view) the signed-in member's place that a friend booked.
  const holder = booking.is_guest && !friendView ? booking.guest_name || '' : profile?.short_name || profile?.full_name || '';
  const holderPosition = !booking.is_guest || friendView ? profile?.playing_position : null;
  const amount = formatCurrency(booking.payment_status !== 'Paid' ? session.price : booking.total_amount);

  return (
    <div className="bg-ink text-chalk">
      <div className="vsb-gutter border-b border-ink-600 py-3">
        <Link to="/bookings" className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted hover:text-chalk">
          <ArrowLeft className="h-4 w-4" aria-hidden /> {t('bookingDetails.backToBookings')}
        </Link>
      </div>

      {/* ===== The ticket: game | stub ===== */}
      <section aria-labelledby="ticket-title" className="relative overflow-hidden border-b border-ink-600">
        <img src={vsbAssets.court.horizontal1024.src} alt="" width={1024} height={356} className="absolute inset-0 h-full w-full object-cover opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/90 to-ink/60" aria-hidden />
        <div className="relative grid lg:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="vsb-gutter py-10 lg:py-14">
            <p className={`font-display text-lg font-bold uppercase tracking-wider ${cancelled ? 'text-red-300' : awaitingConfirmation ? 'text-amber-300' : 'text-green-400'}`}>{headline}</p>
            <div className="mt-6 flex flex-wrap items-end gap-x-10 gap-y-6">
              <p className="font-display uppercase leading-none" aria-hidden>
                <span className="block text-xl font-bold tracking-[0.25em] text-vsb-300">{d.weekday}</span>
                <span className="block text-8xl font-extrabold text-chalk lg:text-9xl">{String(d.day).padStart(2, '0')}</span>
                <span className="block text-xl font-bold tracking-[0.25em] text-chalk">{d.month}</span>
              </p>
              <div className="min-w-0 pb-1">
                <h1 id="ticket-title" className="vsb-display text-5xl lg:text-6xl">{session.title}</h1>
                <p className="mt-3 font-display text-2xl font-bold uppercase tracking-wide text-chalk">
                  {formatDateLocale(session.session_date, i18n.language, 'medium')} · {t('v2.session.timeRange', { start: formatTime(session.start_time), end: formatTime(session.end_time) })}
                </p>
                <p className="mt-1 text-lg text-slate-300">{[session.venue_name, session.court_number].filter(Boolean).join(' · ')}</p>
              </div>
            </div>
          </div>

          {/* Stub: who, status, reference. Perforated edge, like a match ticket. */}
          <div className="vsb-gutter flex flex-col justify-end gap-5 border-t-2 border-dashed border-ink-500 bg-ink-850/90 py-8 lg:border-l-2 lg:border-t-0 lg:!px-8 lg:py-14">
            <div className="flex items-center gap-4">
              <PlayerAvatar name={holder || '?'} src={!booking.is_guest || friendView ? myAvatar?.thumb : null} guest={booking.is_guest && !friendView} size="md" />
              <div className="min-w-0">
                <p className="truncate font-display text-3xl font-extrabold uppercase leading-none text-chalk">{holder}</p>
                <p className="mt-1 font-display text-sm font-bold uppercase tracking-wider text-slate-400">
                  {holderPosition ? t(POSITION_KEY[holderPosition]) : booking.is_guest && !friendView ? t('v2.whosPlaying.guest') : t('v2.myVsb.noPosition')}
                </p>
              </div>
            </div>
            {friendView && <p className="text-sm text-slate-300">{t('v2.friend.addedBy', { name: host ?? '…' })}</p>}
            {booking.is_guest && !friendView && <p className="text-sm text-slate-300">{t('myBookings.bookingFor', { name: booking.guest_name })}</p>}
            <div className="flex items-end justify-between gap-4 border-t border-ink-600 pt-5">
              <div>
                <p className="vsb-meta mb-1">{t('bookingConfirmation.bookingReference')}</p>
                <p className="font-mono text-2xl font-bold tracking-wider text-chalk">{booking.booking_reference}</p>
              </div>
              <StatusBadge status={booking.booking_status} />
            </div>
          </div>
        </div>
      </section>

      {/* ===== What needs doing | the details ===== */}
      <div className="vsb-section grid gap-12 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-16">
        <div className="min-w-0 space-y-10">
          {/* Cancellation info */}
          {booking.cancelled_at && (
            <div className="border-l-2 border-red-500 pl-4">
              <p className="font-semibold text-red-200">{t('bookingDetails.bookingCancelled')}</p>
              <p className="mt-0.5 text-sm text-red-300">{booking.cancellation_reason}</p>
              <p className="mt-1 text-xs text-red-400">{t('bookingDetails.cancelledOn', { date: formatDateTime(booking.cancelled_at) })}</p>
            </div>
          )}

          {/* Pay-by deadline (12-hour hold); a receipt upload stops the clock */}
          {!friendView && awaitingConfirmation && !booking.receipt_path && booking.reserved_until && (
            <HoldCountdown reservedUntil={booking.reserved_until} />
          )}

          {awaitingConfirmation && (
            <div className="border-l-2 border-amber-400 pl-4">
              <p className="font-semibold text-amber-200">{t('bookingDetails.awaitingAdminConfirmation')}</p>
              <p className="mt-0.5 text-sm text-amber-300">{t('bookingDetails.awaitingAdminConfirmationDesc')}</p>
            </div>
          )}

          {friendView && (
            <div className="border-l-2 border-vsb-500 pl-4">
              <p className="text-slate-300">{t('v2.friend.hostPays', { name: host ?? '…' })}</p>
              {['Pending Payment', 'Confirmed'].includes(booking.booking_status) && !isPast && (
                <button type="button" disabled={leaving} onClick={leaveGame} className="mt-3 text-sm font-semibold text-red-400 hover:text-red-300 disabled:opacity-60">
                  {t('v2.friend.leave')}
                </button>
              )}
            </div>
          )}

          {!friendView && groupHasPendingPayment && profile && (
            <section id="pay" aria-labelledby="pay-heading" className="scroll-mt-20">
              <h2 id="pay-heading" className="vsb-display mb-4 text-3xl">{t('v2.booking.stepPayment')}</h2>
              <ReceiptUpload booking={booking} session={session} profile={profile} qrUrl={settings?.payment_qr_url} groupBookings={groupBookings} onUploaded={(path) => setBooking({ ...booking, receipt_path: path })} />
            </section>
          )}

          {/* Players on this booking + bring a friend */}
          {(groupBookings.length > 1 || canAddFriend) && (
            <section aria-labelledby="party-heading">
              <h2 id="party-heading" className="vsb-display mb-4 text-3xl">{t('v2.booking.players')}{groupBookings.length > 1 && <span className="text-muted"> {groupBookings.length}</span>}</h2>
              {groupBookings.length > 1 && (
                <ul className="divide-y divide-ink-700 border-y border-ink-600">
                  {groupBookings.map((b) => (
                    <li key={b.id} className="flex items-center justify-between gap-3 py-3">
                      <span className="flex min-w-0 items-center gap-3 font-semibold text-chalk">
                        <PlayerAvatar name={bookingDisplayName(b, profile)} src={!b.is_guest ? myAvatar?.thumb : null} guest={b.is_guest && !b.guest_user_id} size="sm" />
                        <span className="truncate">{bookingDisplayName(b, profile)}</span>
                        <GenderBadge gender={b.is_guest ? b.guest_gender : profile?.gender} />
                        {b.id === booking.id && <span className="font-display text-xs font-bold uppercase tracking-wider text-vsb-400">{t('v2.booking.thisTicket')}</span>}
                      </span>
                      <StatusBadge status={b.booking_status} />
                    </li>
                  ))}
                </ul>
              )}

              {canAddFriend && (
                !showAddFriend ? (
                  <button type="button" onClick={() => setShowAddFriend(true)} className="hub-link mt-4">
                    <UserPlus className="h-4 w-4" aria-hidden /> {t('bookingDetails.addFriend')}
                  </button>
                ) : (
                  <form onSubmit={(e) => handleAddFriend(e)} className="mt-5 border-t border-ink-600 pt-5">
                    <p className="font-semibold text-chalk">{t('bookingDetails.addFriend')}</p>
                    <p className="mb-3 text-sm text-slate-400">{t('bookingDetails.addFriendDesc')}</p>
                    <div className="mb-4 flex gap-6 border-b border-ink-600" role="group" aria-label={t('bookingDetails.addFriend')}>
                      <button type="button" onClick={() => setFriendKind('member')} aria-pressed={friendKind === 'member'} className="vsb-tab">{t('v2.friend.tabMember')}</button>
                      <button type="button" onClick={() => setFriendKind('guest')} aria-pressed={friendKind === 'guest'} className="vsb-tab">{t('v2.friend.tabGuest')}</button>
                    </div>
                    {friendKind === 'member' ? (
                      <MemberPicker
                        excludeIds={[profile?.id ?? '', ...groupBookings.map((b) => b.guest_user_id ?? '')]}
                        onPick={(m) => { if (!addingFriend) handleAddFriend(null, m); }}
                      />
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-3">
                        <input className="v2-input" placeholder={t('checkout.companionNamePlaceholder')} aria-label={t('checkout.companionName')}
                          value={friendForm.name} onChange={(e) => setFriendForm({ ...friendForm, name: e.target.value })} />
                        <input className="v2-input" placeholder={t('checkout.companionPhone')} aria-label={t('checkout.companionPhone')}
                          value={friendForm.phone} onChange={(e) => setFriendForm({ ...friendForm, phone: e.target.value })} />
                        <select className="v2-input" value={friendForm.gender} aria-label={t('common.genderLabel')}
                          onChange={(e) => setFriendForm({ ...friendForm, gender: e.target.value })} required>
                          <option value="" disabled>{t('common.genderSelectPlaceholder')}</option>
                          <option value="Male">{t('common.genderMale')}</option>
                          <option value="Female">{t('common.genderFemale')}</option>
                        </select>
                      </div>
                    )}
                    <div className="mt-4 flex gap-3">
                      {friendKind === 'guest' && (
                        <button type="submit" disabled={addingFriend} className="v2-btn-primary">
                          {addingFriend ? t('bookingDetails.addingFriend') : t('bookingDetails.saveFriend')}
                        </button>
                      )}
                      <button type="button" onClick={() => { setShowAddFriend(false); setFriendForm({ name: '', phone: '', gender: '' }); }} className="v2-btn-secondary">
                        {t('bookingDetails.cancelAddFriend')}
                      </button>
                    </div>
                  </form>
                )
              )}
            </section>
          )}
        </div>

        <div className="min-w-0 space-y-10">
          {/* Payment */}
          <section aria-labelledby="payment-heading">
            <h2 id="payment-heading" className="vsb-display mb-4 text-3xl">{t('bookingDetails.paymentDetails')}</h2>
            <dl className="divide-y divide-ink-700 border-y border-ink-600 text-sm">
              <div className="flex justify-between py-3"><dt className="text-slate-400">{t('bookingDetails.sessionFee')}</dt><dd className="text-chalk">{formatCurrency(booking.payment_status !== 'Paid' ? session.price : booking.subtotal)}</dd></div>
              {booking.processing_fee > 0 && <div className="flex justify-between py-3"><dt className="text-slate-400">{t('bookingDetails.processingFee')}</dt><dd className="text-chalk">{formatCurrency(booking.processing_fee)}</dd></div>}
              {booking.discount_amount > 0 && <div className="flex justify-between py-3 text-green-400"><dt>{t('bookingDetails.discount')}</dt><dd>-{formatCurrency(booking.discount_amount)}</dd></div>}
              <div className="flex items-baseline justify-between py-3"><dt className="font-semibold text-chalk">{t('bookingDetails.total')}</dt><dd className="font-display text-3xl font-extrabold text-chalk">{amount}</dd></div>
              <div className="flex items-center justify-between py-3"><dt className="text-slate-400">{t('v2.booking.paymentStatus')}</dt><dd><PaymentStatusBadge status={booking.payment_status} /></dd></div>
            </dl>
            {payments.length > 0 && (
              <ul className="mt-3 divide-y divide-ink-700">
                {payments.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                    <span className="text-slate-300">{p.payment_method || t('bookingDetails.paymentFallback')} <span className="font-mono text-xs text-slate-400">{p.transaction_reference}</span></span>
                    <span className="flex items-center gap-2"><PaymentStatusBadge status={p.payment_status} /><span className="font-medium text-chalk">{formatCurrency(p.amount)}</span></span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Venue */}
          <section aria-labelledby="venue-heading">
            <h2 id="venue-heading" className="vsb-display mb-4 text-3xl">{t('v2.sessionDetails.venue')}</h2>
            <p className="font-display text-2xl font-bold uppercase tracking-wide text-chalk">{session.venue_name}</p>
            {session.court_number && <p className="font-display text-lg font-bold uppercase tracking-wider text-vsb-300">{session.court_number}</p>}
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
              {session.maps_link && (
                <a href={session.maps_link} target="_blank" rel="noopener noreferrer" className="hub-link"><MapPin className="h-4 w-4" aria-hidden /> {t('bookingDetails.viewOnMaps')}</a>
              )}
              <Link to={`/sessions/${session.id}`} className="hub-link">{t('v2.booking.viewSession')} <ArrowRight className="h-4 w-4" aria-hidden /></Link>
            </div>
          </section>

          {/* Actions */}
          {(canCancel || (!isPast && booking.booking_status === 'Confirmed')) && (
            <section aria-label={t('bookingDetails.cancelBooking')} className="border-t border-ink-600 pt-6">
              {canCancel ? (
                <button onClick={() => setShowCancelDialog(true)} className="w-full rounded-md border border-red-500/40 py-3 font-semibold text-red-400 transition-colors hover:bg-red-500/10">
                  {t('bookingDetails.cancelBooking')}
                </button>
              ) : (
                <p className="text-sm text-amber-300">{t('bookingDetails.cancellationPeriodPassed')}</p>
              )}
            </section>
          )}
        </div>
      </div>

      {/* Cancel dialog */}
      {showCancelDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setShowCancelDialog(false)}
          onKeyDown={(e) => { if (e.key === 'Escape') setShowCancelDialog(false); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="cancel-title" className="w-full max-w-md border border-ink-600 bg-ink-800 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 id="cancel-title" className="font-display text-2xl font-extrabold uppercase text-chalk">{t('bookingDetails.cancelDialogTitle')}</h3>
            <p className="mt-2 text-sm text-slate-300">
              <Trans i18nKey="bookingDetails.cancelDialogDesc" components={{ strong: <strong /> }} />
            </p>
            <div className="mt-6 flex gap-3">
              <button autoFocus onClick={() => setShowCancelDialog(false)} className="v2-btn-secondary flex-1">
                {t('bookingDetails.keepBooking')}
              </button>
              <button onClick={handleCancel} disabled={cancelling} className="flex-1 rounded-md bg-red-500 py-2.5 font-bold text-white transition-colors hover:bg-red-600 disabled:opacity-60">
                {cancelling ? t('bookingDetails.cancelling') : t('bookingDetails.yesCancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
