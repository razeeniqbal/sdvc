import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Receipt } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { bookingDisplayName, formatCurrency, formatDateTime } from '@/lib/format';
import { getReceiptSignedUrl } from '@/lib/receipts';
import { ADMIN_BOOKING_SELECT, amountDue, confirmBooking, type AdminBooking } from '@/lib/adminBookings';
import { Spinner } from '@/components/LoadingScreen';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { AdminPageHeader } from '@/components/admin/AdminUI';
import { BookingOpsBadge, PaymentOpsBadge } from '@/components/admin/statusBadges';
import { BookingDetailSheet } from '@/components/admin/BookingDetailSheet';
import { useAvatarMap } from '@/lib/avatars';

// Payments = the human verification queue over existing booking/payment data.
// No new payment model: "needs review" is a pending booking with a receipt,
// "awaiting receipt" is one without; verifying runs the same confirmBooking
// used everywhere else.

type Queue = 'review' | 'awaiting' | 'paid' | 'refunded';
const LABEL: Record<Queue, string> = { review: 'Needs review', awaiting: 'Awaiting receipt', paid: 'Verified', refunded: 'Refunded' };

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- PostgrestFilterBuilder generics
function scope(q: any, queue: Queue) {
  switch (queue) {
    case 'review': return q.eq('booking_status', 'Pending Payment').not('receipt_path', 'is', null);
    case 'awaiting': return q.eq('booking_status', 'Pending Payment').is('receipt_path', null);
    case 'paid': return q.eq('payment_status', 'Paid');
    case 'refunded': return q.in('payment_status', ['Refunded', 'Partially Refunded']);
  }
}

function sessionLine(b: AdminBooking) {
  const d = new Date(`${b.session.session_date}T00:00:00`).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' });
  return `${d} · ${b.session.title}`;
}

export default function AdminPaymentsPage() {
  const { show } = useToast();
  const [params, setParams] = useSearchParams();
  const qp = params.get('queue') as Queue | null;
  const queue: Queue = qp && qp in LABEL ? qp : 'review';
  const [rows, setRows] = useState<AdminBooking[]>([]);
  const [counts, setCounts] = useState<Record<Queue, number | null>>({ review: null, awaiting: null, paid: null, refunded: null });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AdminBooking | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const avatars = useAvatarMap(rows.filter((b) => !b.is_guest).map((b) => b.user_id));

  const load = useCallback(async () => {
    setLoading(true);
    const order = queue === 'review' ? { col: 'receipt_uploaded_at', asc: true } : { col: 'created_at', asc: false };
    const [list, ...cs] = await Promise.all([
      scope(supabase.from('bookings').select(ADMIN_BOOKING_SELECT).order(order.col, { ascending: order.asc }), queue).limit(100),
      ...(Object.keys(LABEL) as Queue[]).map((k) => scope(supabase.from('bookings').select('id', { count: 'exact', head: true }), k)),
    ]);
    setRows((list.data || []) as unknown as AdminBooking[]);
    const keys = Object.keys(LABEL) as Queue[];
    setCounts(Object.fromEntries(keys.map((k, i) => [k, cs[i].count ?? 0])) as Record<Queue, number>);
    setLoading(false);
  }, [queue]);

  useEffect(() => { load(); }, [load]);

  async function viewReceipt(b: AdminBooking) {
    if (!b.receipt_path) return;
    const url = await getReceiptSignedUrl(b.receipt_path, 3600);
    if (!url) { show('Failed to load receipt', 'error'); return; }
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function verify(b: AdminBooking) {
    setBusy(b.id);
    const err = await confirmBooking(b, amountDue(b));
    setBusy(null);
    if (err) { show(err, 'error'); return; }
    show(`Payment verified. ${bookingDisplayName(b, b.profile)} is confirmed.`, 'success');
    load();
  }

  return (
    <div className="adm-page">
      <AdminPageHeader meta="Operations" title="Payments" subtitle="Verify uploaded receipts and track what's been paid." />

      <div className="-mb-px flex gap-6 overflow-x-auto border-b border-ink-600 [scrollbar-width:none]" role="group" aria-label="Payment queue">
        {(Object.keys(LABEL) as Queue[]).map((k) => (
          <button key={k} onClick={() => setParams(k === 'review' ? {} : { queue: k }, { replace: true })} aria-pressed={queue === k} className="vsb-tab py-3">
            {LABEL[k]} {counts[k] !== null && <span className={k === 'review' && counts[k]! > 0 ? 'text-amber-300' : 'text-muted'}>{counts[k]}</span>}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {loading ? (
          <div className="flex min-h-[30vh] items-center justify-center"><Spinner className="h-7 w-7 text-vsb-500" /></div>
        ) : rows.length === 0 ? (
          <p className="py-12 text-slate-400">
            {queue === 'review' ? 'Nothing to review. No receipts are waiting for verification.' : queue === 'awaiting' ? 'Every pending booking has a receipt.' : 'Nothing here yet.'}
          </p>
        ) : queue === 'review' ? (
          /* Review queue: oldest receipt first, action-first rows */
          <ul className="divide-y divide-ink-700 border-y border-ink-600">
            {rows.map((b) => {
              const name = bookingDisplayName(b, b.profile);
              const tbc = b.session.price === 0;
              return (
                <li key={b.id} className="grid gap-4 py-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] lg:items-center">
                  <div className="flex min-w-0 items-center gap-3">
                    <PlayerAvatar name={name} src={b.is_guest ? null : avatars.get(b.user_id)} guest={b.is_guest} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-chalk">{name}</p>
                      <p className="truncate text-xs text-muted"><span className="font-mono">{b.booking_reference}</span> · {sessionLine(b)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <p className="adm-num text-3xl">{tbc ? 'TBC' : formatCurrency(amountDue(b))}</p>
                    <p className="text-xs text-muted">Receipt<br />{b.receipt_uploaded_at ? formatDateTime(b.receipt_uploaded_at) : '-'}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => viewReceipt(b)} className="adm-btn min-h-[40px]"><Receipt className="h-4 w-4" aria-hidden /> View receipt</button>
                    {tbc ? (
                      <button onClick={() => setSelected(b)} className="adm-btn min-h-[40px] !border-amber-500/50 !text-amber-300">Set amount & verify</button>
                    ) : (
                      <button onClick={() => verify(b)} disabled={busy === b.id} className="inline-flex min-h-[40px] items-center gap-2 rounded-md bg-green-600 px-4 font-bold text-white transition-colors hover:bg-green-700 disabled:opacity-60">
                        {busy === b.id && <Spinner className="h-4 w-4" />} Verify
                      </button>
                    )}
                    <button onClick={() => setSelected(b)} className="adm-btn min-h-[40px]">Details</button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <table className="adm-table">
            <thead>
              <tr>
                <th>Player</th>
                <th className="hidden md:table-cell">Session</th>
                <th className="w-40">Status</th>
                <th className="w-28 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => {
                const name = bookingDisplayName(b, b.profile);
                return (
                  <tr key={b.id} className="cursor-pointer" onClick={() => setSelected(b)}>
                    <td>
                      <p className="font-semibold text-chalk">{name}</p>
                      <p className="text-xs text-muted"><span className="font-mono">{b.booking_reference}</span><span className="md:hidden"> · {sessionLine(b)}</span></p>
                    </td>
                    <td className="hidden md:table-cell text-slate-300">{sessionLine(b)}</td>
                    <td><span className="flex flex-wrap gap-1.5"><PaymentOpsBadge booking={b} />{queue !== 'paid' && <BookingOpsBadge status={b.booking_status} />}</span></td>
                    <td className="text-right font-display text-lg font-bold text-chalk">{formatCurrency(amountDue(b))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {rows.length === 100 && <p className="mt-3 text-xs text-muted">Showing the 100 most recent. Use Bookings for full search and export.</p>}
      </div>

      {selected && <BookingDetailSheet booking={selected} onClose={() => setSelected(null)} onChanged={load} />}
    </div>
  );
}
