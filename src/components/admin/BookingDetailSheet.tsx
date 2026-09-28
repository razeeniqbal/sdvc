import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Receipt, X } from 'lucide-react';
import { useToast } from '@/context/ToastContext';
import { bookingDisplayName, formatCurrency, formatDate, formatDateTime, formatTime } from '@/lib/format';
import { getReceiptSignedUrl } from '@/lib/receipts';
import { amountDue, confirmBooking, issueRefund, saveAdminNotes, updateBookingStatus, type AdminBooking } from '@/lib/adminBookings';
import { Spinner } from '@/components/LoadingScreen';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { BookingOpsBadge, PaymentOpsBadge } from '@/components/admin/statusBadges';
import type { BookingStatus } from '@/types/database';
import { useAvatarMap } from '@/lib/avatars';

// Operational detail for one booking, as a right-hand sheet so the list stays
// in view. All actions come from lib/adminBookings (shared with Payments).
export function BookingDetailSheet({ booking, onClose, onChanged }: {
  booking: AdminBooking;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { show } = useToast();
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [amount, setAmount] = useState(amountDue(booking).toString());
  const [notes, setNotes] = useState(booking.admin_notes || '');
  const [savingNotes, setSavingNotes] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const avatars = useAvatarMap(booking.is_guest ? [] : [booking.user_id]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const name = bookingDisplayName(booking, booking.profile);
  const gender = booking.is_guest ? booking.guest_gender : booking.profile.gender;
  const phone = booking.is_guest ? booking.guest_phone : booking.profile.phone_number;
  const unpaid = booking.payment_status !== 'Paid';
  const cancelled = booking.booking_status.includes('Cancelled');

  async function run(fn: () => Promise<string | null>, ok: string) {
    setBusy(true);
    const err = await fn();
    setBusy(false);
    if (err) { show(err, 'error'); return; }
    show(ok, 'success');
    onChanged();
    onClose();
  }

  async function viewReceipt() {
    if (!booking.receipt_path) return;
    setViewing(true);
    const url = await getReceiptSignedUrl(booking.receipt_path, 3600);
    setViewing(false);
    if (!url) { show('Failed to load receipt', 'error'); return; }
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function saveNotes() {
    setSavingNotes(true);
    const err = await saveAdminNotes(booking.id, notes);
    setSavingNotes(false);
    if (err) { show(err, 'error'); return; }
    show('Notes saved', 'success');
    onChanged();
  }

  const rows: [string, string][] = [
    ['Session', booking.session.title],
    ['Date', `${formatDate(booking.session.session_date)} · ${formatTime(booking.session.start_time)}`],
    ['Venue', booking.session.venue_name],
    ['Booked', formatDateTime(booking.created_at)],
  ];

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="booking-sheet-title">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <aside className="animate-slide-up absolute inset-y-0 right-0 flex w-full max-w-lg flex-col border-l border-ink-600 bg-ink-850 sm:animate-none">
        <header className="flex items-start justify-between gap-4 border-b border-ink-600 p-5">
          <div className="flex min-w-0 items-center gap-3">
            <PlayerAvatar name={name} src={booking.is_guest ? null : avatars.get(booking.user_id)} seed={booking.is_guest ? null : booking.user_id} guest={booking.is_guest} size="md" />
            <div className="min-w-0">
              <h2 id="booking-sheet-title" className="truncate font-display text-2xl font-extrabold uppercase leading-none text-chalk">{name}</h2>
              <p className="mt-1 font-mono text-xs text-muted">{booking.booking_reference}</p>
            </div>
          </div>
          <button ref={closeRef} onClick={onClose} aria-label="Close" className="p-1 text-muted hover:text-chalk"><X className="h-6 w-6" /></button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          <div className="flex flex-wrap gap-2">
            <BookingOpsBadge status={booking.booking_status} />
            <PaymentOpsBadge booking={booking} />
          </div>

          <section>
            <h3 className="adm-label mb-2">Player</h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div><dt className="text-muted">Gender</dt><dd className="font-semibold text-chalk">{gender || 'Not set'}</dd></div>
              <div><dt className="text-muted">Phone</dt><dd className="font-semibold text-chalk">{phone || 'Not provided'}</dd></div>
              {booking.is_guest && <div className="col-span-2"><dt className="text-muted">Booked by</dt><dd className="font-semibold text-chalk">{booking.profile.short_name || booking.profile.full_name} (guest of)</dd></div>}
            </dl>
          </section>

          <section>
            <h3 className="adm-label mb-2">Session</h3>
            <dl className="space-y-2 text-sm">
              {rows.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-ink-700 pb-2"><dt className="text-muted">{k}</dt><dd className="text-right font-semibold text-chalk">{v}</dd></div>
              ))}
            </dl>
            <Link to={`/admin/sessions/${booking.session_id}`} onClick={onClose} className="mt-2 inline-block text-xs font-semibold uppercase tracking-wider text-vsb-400 hover:text-vsb-300">Open session →</Link>
          </section>

          <section>
            <h3 className="adm-label mb-2">Payment</h3>
            <div className="flex items-end justify-between gap-4">
              {unpaid && !cancelled ? (
                <label className="text-sm">
                  <span className="text-muted">Amount to confirm (RM)</span>
                  <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="v2-input mt-1 w-36 !text-lg font-bold" />
                </label>
              ) : (
                <p className="adm-num text-4xl">{formatCurrency(booking.total_amount)}</p>
              )}
              {unpaid && <p className="text-right text-xs text-muted">Session price now {booking.session.price > 0 ? formatCurrency(booking.session.price) : 'TBC'}</p>}
            </div>

            {booking.receipt_path ? (
              <div className="mt-4 flex items-center justify-between gap-3 border border-vsb-700 bg-vsb-900/40 p-3 text-sm">
                <span className="text-vsb-100">{booking.receipt_uploaded_at ? `Receipt uploaded ${formatDateTime(booking.receipt_uploaded_at)}` : 'Receipt uploaded'}</span>
                <button onClick={viewReceipt} disabled={viewing} className="adm-btn flex-shrink-0"><Receipt className="h-3.5 w-3.5" aria-hidden /> {viewing ? 'Loading…' : 'View receipt'}</button>
              </div>
            ) : unpaid && !cancelled ? (
              <p className="mt-3 text-sm text-slate-400">No receipt uploaded yet.</p>
            ) : null}
          </section>

          {booking.cancelled_at && (
            <section className="border-l-2 border-red-500 pl-3 text-sm">
              <p className="font-semibold text-red-300">Cancelled {formatDateTime(booking.cancelled_at)}</p>
              {booking.cancellation_reason && <p className="text-slate-400">{booking.cancellation_reason}</p>}
            </section>
          )}

          <section>
            <h3 className="adm-label mb-2">Admin notes</h3>
            <textarea aria-label="Admin notes" className="v2-input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes — not shown to the player" />
            <button onClick={saveNotes} disabled={savingNotes || notes === (booking.admin_notes || '')} className="adm-btn mt-2">{savingNotes ? 'Saving…' : 'Save notes'}</button>
          </section>
        </div>

        {/* Actions */}
        <footer className="space-y-2 border-t border-ink-600 p-5">
          {confirmCancel ? (
            <div className="space-y-2">
              <p className="text-sm text-slate-300">Cancel this booking? The player loses the slot.</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmCancel(false)} className="adm-btn flex-1 !py-2.5">Keep booking</button>
                <button onClick={() => run(() => updateBookingStatus(booking, 'Cancelled by Admin'), 'Booking cancelled')} disabled={busy} className="flex-1 rounded-md bg-red-600 py-2.5 font-bold text-white hover:bg-red-700 disabled:opacity-60">Yes, cancel</button>
              </div>
            </div>
          ) : (
            <>
              {unpaid && !cancelled && (
                <button
                  onClick={() => run(() => confirmBooking(booking, parseFloat(amount) || 0), 'Payment verified — booking confirmed')}
                  disabled={busy || !amount}
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-green-600 py-3 font-display text-lg font-bold uppercase tracking-wider text-white transition-colors hover:bg-green-700 disabled:opacity-60"
                >
                  {busy && <Spinner className="h-4 w-4" />} Verify payment & confirm
                </button>
              )}
              <div className="flex flex-wrap gap-2">
                {booking.booking_status === 'Confirmed' && (
                  <button onClick={() => run(() => updateBookingStatus(booking, 'Completed' as BookingStatus), 'Marked completed')} disabled={busy} className="adm-btn flex-1">Mark completed</button>
                )}
                {booking.payment_status === 'Paid' && booking.booking_status !== 'Refunded' && (
                  <button onClick={() => run(() => issueRefund(booking), 'Refund recorded')} disabled={busy} className="adm-btn flex-1">Record refund</button>
                )}
                {!cancelled && booking.booking_status !== 'Completed' && (
                  <button onClick={() => setConfirmCancel(true)} disabled={busy} className="adm-btn flex-1 !border-red-500/50 !text-red-300 hover:!border-red-400">Cancel booking</button>
                )}
              </div>
            </>
          )}
        </footer>
      </aside>
    </div>
  );
}
