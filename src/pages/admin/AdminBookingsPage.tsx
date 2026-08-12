import { useEffect, useState } from 'react';
import { Search, Download, Eye, RefreshCw, XCircle, DollarSign, RotateCcw, ChevronLeft, ChevronRight, Receipt } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { bookingDisplayName, formatCurrency, formatDate, formatTime, formatDateTime } from '@/lib/format';
import { getReceiptSignedUrl } from '@/lib/receipts';
import { notifyGroup } from '@/lib/notifications';
import { fetchSessionRoster, buildRosterMessage } from '@/lib/sessions';
import { StatusBadge, GenderBadge } from '@/components/StatusBadge';
import { Spinner } from '@/components/LoadingScreen';
import type { Booking, Session, Profile, BookingStatus } from '@/types/database';

interface AdminBooking extends Booking {
  session: Session;
  profile: Profile;
}

const PAGE_SIZE = 20;

// Search text is spliced into a PostgREST .or() filter string, where commas and
// parentheses are syntax. Strip anything but safe search characters so a stray
// comma can't break the query (RLS still bounds what admins can see either way).
function sanitizeSearchTerm(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9 _-]/g, '').trim();
}

export default function AdminBookingsPage() {
  const { show } = useToast();
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ search: '', session: '', bookingStatus: '', paymentStatus: '' });
  const [hideCancelled, setHideCancelled] = useState(true);
  const [selected, setSelected] = useState<AdminBooking | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [amountInput, setAmountInput] = useState('');
  const [exporting, setExporting] = useState(false);
  const [viewingReceipt, setViewingReceipt] = useState(false);

  async function viewReceipt(path: string) {
    setViewingReceipt(true);
    const url = await getReceiptSignedUrl(path, 3600);
    setViewingReceipt(false);
    if (!url) { show('Failed to load receipt', 'error'); return; }
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  // Booking reference and guest name/phone live on the bookings table; the booker's own
  // name/phone live on the joined profile, so this resolves matching profile ids up front.
  async function getSearchUserIds(term: string): Promise<string[]> {
    const { data: matchedProfiles } = await supabase
      .from('profiles')
      .select('id')
      .or(`full_name.ilike.%${term}%,phone_number.ilike.%${term}%`);
    return (matchedProfiles || []).map((p: { id: string }) => p.id);
  }

  // Deliberately synchronous — the Supabase query builder is "thenable" (calling .then()
  // on it fires the request), so returning it from an async function would make `await`
  // silently unwrap it into the already-executed {data, count} result instead of the
  // builder, breaking any further chaining like .range() on the caller's side.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase's PostgrestFilterBuilder
  // generics don't compose cleanly through a shared helper; narrow typing happens at the call sites.
  function applyFilters(query: any, term: string, userIds: string[]) {
    let q = query;
    if (filters.session) q = q.eq('session_id', filters.session);
    if (filters.bookingStatus) q = q.eq('booking_status', filters.bookingStatus);
    if (filters.paymentStatus) q = q.eq('payment_status', filters.paymentStatus);

    if (term) {
      const orParts = [`booking_reference.ilike.%${term}%`, `guest_name.ilike.%${term}%`, `guest_phone.ilike.%${term}%`];
      if (userIds.length > 0) orParts.push(`user_id.in.(${userIds.join(',')})`);
      q = q.or(orParts.join(','));
    }
    // Only apply the default cancelled-hiding when the admin hasn't explicitly asked
    // for a specific status — an explicit "Cancelled by Player" filter should still work.
    if (hideCancelled && !filters.bookingStatus) {
      q = q.not('booking_status', 'in', '("Cancelled by Player","Cancelled by Admin")');
    }
    return q;
  }

  async function load() {
    setLoading(true);
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const term = sanitizeSearchTerm(filters.search);
    const userIds = term ? await getSearchUserIds(term) : [];

    let query = supabase
      .from('bookings')
      .select('*, session:sessions(*), profile:profiles(*)', { count: 'exact' })
      .order('created_at', { ascending: false });
    query = applyFilters(query, term, userIds);

    const { data, count } = await query.range(from, to);
    setBookings((data || []) as unknown as AdminBooking[]);
    setTotalCount(count ?? 0);
    setLoading(false);
  }

  useEffect(() => {
    supabase.from('sessions').select('*').order('session_date', { ascending: false }).then(({ data }) => {
      setSessions((data || []) as Session[]);
    });
  }, []);

  // Single debounced trigger for every filter + page change. The debounce is
  // short enough to feel instant for dropdown clicks while still coalescing
  // keystrokes in the search box into one query instead of one per key.
  useEffect(() => {
    const handle = setTimeout(() => { load(); }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filters.search, filters.session, filters.bookingStatus, filters.paymentStatus, hideCancelled]);

  async function exportCSV() {
    setExporting(true);
    const term = sanitizeSearchTerm(filters.search);
    const userIds = term ? await getSearchUserIds(term) : [];
    let query = supabase
      .from('bookings')
      .select('*, session:sessions(*), profile:profiles(*)')
      .order('created_at', { ascending: false });
    query = applyFilters(query, term, userIds);
    const { data } = await query;
    const rows = ((data || []) as unknown as AdminBooking[]).map((b) => [
      b.booking_reference,
      bookingDisplayName(b, b.profile),
      (b.is_guest ? b.guest_gender : b.profile.gender) || '',
      (b.is_guest ? b.guest_phone : b.profile.phone_number) || '',
      b.is_guest ? `${b.profile.short_name || b.profile.full_name} (booker)` : '',
      b.session.title,
      b.session.session_date,
      b.booking_status,
      b.payment_status,
      b.total_amount.toFixed(2),
      b.created_at,
    ]);
    setExporting(false);

    const headers = ['Reference', 'Player', 'Gender', 'Phone', 'Booked By (if guest)', 'Session', 'Date', 'Booking Status', 'Payment Status', 'Total Amount', 'Created At'];
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bookings-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function updateBookingStatus(booking: AdminBooking, status: BookingStatus) {
    setActionLoading(true);
    const updates: { booking_status: BookingStatus; cancelled_at?: string } = { booking_status: status };
    if (status.includes('Cancelled')) {
      updates.cancelled_at = new Date().toISOString();
    }
    const { error } = await supabase.from('bookings').update(updates).eq('id', booking.id);
    setActionLoading(false);
    if (error) { show(error.message, 'error'); return; }
    show(`Booking status updated to ${status}`, 'success');
    load();
    setSelected(null);
  }

  async function confirmBooking(booking: AdminBooking, finalAmount?: number) {
    setActionLoading(true);

    let amount = booking.total_amount;
    if (finalAmount !== undefined && finalAmount !== booking.total_amount) {
      amount = finalAmount;
      await supabase.from('bookings').update({
        subtotal: amount,
        processing_fee: 0,
        total_amount: amount,
      }).eq('id', booking.id);
    }

    await supabase.from('payments').insert({
      booking_id: booking.id,
      payment_provider: 'manual',
      payment_method: 'Cash',
      amount,
      payment_status: 'Paid',
      transaction_reference: 'MANUAL-' + Date.now(),
      paid_at: new Date().toISOString(),
    });
    const { error } = await supabase.from('bookings').update({
      booking_status: 'Confirmed',
      payment_status: 'Paid',
    }).eq('id', booking.id);
    setActionLoading(false);
    if (error) { show(error.message, 'error'); return; }

    await supabase.from('notifications').insert({
      user_id: booking.user_id,
      booking_id: booking.id,
      notification_type: 'booking_confirmation',
      title: 'Booking Confirmed',
      message: `Your booking ${booking.booking_reference} for "${booking.session.title}" is confirmed. See you on court!`,
      delivery_channel: 'in_app',
      delivery_status: 'Sent',
      sent_at: new Date().toISOString(),
    });

    const roster = await fetchSessionRoster(booking.session_id);
    await notifyGroup(buildRosterMessage(booking.session, roster));

    show('Booking confirmed', 'success');
    load();
    setSelected(null);
  }

  async function issueRefund(booking: AdminBooking) {
    setActionLoading(true);
    await supabase.from('payments').update({
      payment_status: 'Refunded',
      refunded_amount: booking.total_amount,
      refunded_at: new Date().toISOString(),
    }).eq('booking_id', booking.id);
    const { error } = await supabase.from('bookings').update({
      booking_status: 'Refunded',
      payment_status: 'Refunded',
    }).eq('id', booking.id);
    setActionLoading(false);
    if (error) { show(error.message, 'error'); return; }
    show('Refund issued', 'success');
    load();
    setSelected(null);
  }

  if (loading && bookings.length === 0) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spinner className="h-8 w-8 text-navy-600" />
      </div>
    );
  }

  const inputClass = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20 outline-none';
  const isTbc = !!selected && selected.total_amount === 0 && selected.payment_status !== 'Paid';
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const rangeStart = totalCount === 0 ? 0 : page * PAGE_SIZE + 1;
  const rangeEnd = Math.min(totalCount, (page + 1) * PAGE_SIZE);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">Booking Management</h1>
          <p className="text-slate-500 text-sm mt-1">View, search, and manage all bookings</p>
        </div>
        <button onClick={exportCSV} disabled={exporting} className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl transition-colors disabled:opacity-60">
          {exporting ? <Spinner className="h-5 w-5" /> : <Download className="h-5 w-5" />}
          {exporting ? 'Exporting...' : 'Export CSV'}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input placeholder="Search name, phone, ref..." className={`${inputClass} pl-9`} value={filters.search} onChange={(e) => { setPage(0); setFilters({ ...filters, search: e.target.value }); }} />
        </div>
        <select className={inputClass} value={filters.session} onChange={(e) => { setPage(0); setFilters({ ...filters, session: e.target.value }); }}>
          <option value="">All sessions</option>
          {sessions.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
        </select>
        <select className={inputClass} value={filters.bookingStatus} onChange={(e) => { setPage(0); setFilters({ ...filters, bookingStatus: e.target.value }); }}>
          <option value="">All booking statuses</option>
          {['Pending Payment', 'Confirmed', 'Cancelled by Player', 'Cancelled by Admin', 'Completed', 'No Show', 'Refunded'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className={inputClass} value={filters.paymentStatus} onChange={(e) => { setPage(0); setFilters({ ...filters, paymentStatus: e.target.value }); }}>
          <option value="">All payment statuses</option>
          {['Pending', 'Paid', 'Failed', 'Cancelled', 'Refunded', 'Partially Refunded', 'Manual Payment Pending Verification'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-600 sm:col-span-2 lg:col-span-4">
          <input
            type="checkbox"
            checked={hideCancelled}
            onChange={(e) => { setPage(0); setHideCancelled(e.target.checked); }}
            className="h-4 w-4 rounded border-slate-300 text-navy-600 focus:ring-navy-500"
          />
          Hide cancelled bookings
        </label>
      </div>

      {bookings.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-slate-500">No bookings found.</p>
        </div>
      ) : (
        <>
        {/* Mobile card list */}
        <div className="sm:hidden space-y-3">
          {bookings.map((b) => (
            <button
              key={b.id}
              onClick={() => { setSelected(b); setAmountInput(b.total_amount.toString()); }}
              className="w-full text-left bg-white rounded-2xl border border-slate-200 shadow-sm p-4 hover:border-navy-300 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 font-semibold text-slate-900 text-sm truncate">
                    {bookingDisplayName(b, b.profile)}
                    <GenderBadge gender={b.is_guest ? b.guest_gender : b.profile.gender} />
                    {b.is_guest && <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-[10px] font-medium">Guest</span>}
                  </p>
                  <p className="text-xs text-slate-500">{(b.is_guest ? b.guest_phone : b.profile.phone_number) || 'N/A'}</p>
                  <p className="font-mono text-xs text-slate-500 mt-1">{b.booking_reference}</p>
                </div>
                <p className="text-sm font-bold text-slate-900 flex-shrink-0">{formatCurrency(b.total_amount)}</p>
              </div>
              <p className="text-xs text-slate-500 mt-2 truncate">{b.session.title} · {formatDate(b.session.session_date)}</p>
              <div className="mt-2 flex items-center gap-2">
                <StatusBadge status={b.booking_status} />
                {b.receipt_path && <Receipt className="h-3.5 w-3.5 text-blue-500" />}
              </div>
            </button>
          ))}
        </div>

        {/* Desktop table */}
        <div className="hidden sm:block overflow-x-auto bg-white rounded-2xl border border-slate-200 shadow-sm">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3">Reference</th>
                <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3">Player</th>
                <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3 hidden sm:table-cell">Session</th>
                <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3 hidden md:table-cell">Date</th>
                <th className="text-center text-xs font-semibold text-slate-600 px-4 py-3">Status</th>
                <th className="text-right text-xs font-semibold text-slate-600 px-4 py-3">Amount</th>
                <th className="text-right text-xs font-semibold text-slate-600 px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bookings.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-900">{b.booking_reference}</td>
                  <td className="px-4 py-3">
                    <p className="flex items-center gap-1.5 font-medium text-slate-900 text-sm">
                      {bookingDisplayName(b, b.profile)}
                      <GenderBadge gender={b.is_guest ? b.guest_gender : b.profile.gender} />
                      {b.is_guest && <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-[10px] font-medium">Guest</span>}
                    </p>
                    <p className="text-xs text-slate-500">{(b.is_guest ? b.guest_phone : b.profile.phone_number) || 'N/A'}</p>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-sm text-slate-600">{b.session.title}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-sm text-slate-600">{formatDate(b.session.session_date)}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="inline-flex items-center gap-1.5">
                      <StatusBadge status={b.booking_status} />
                      {b.receipt_path && <Receipt className="h-3.5 w-3.5 text-blue-500" />}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-slate-900">{formatCurrency(b.total_amount)}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => { setSelected(b); setAmountInput(b.total_amount.toString()); }} className="p-2 text-slate-400 hover:text-navy-700 rounded-lg hover:bg-navy-50 transition-colors">
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-4 text-sm text-slate-500">
          <span>Showing {rangeStart}–{rangeEnd} of {totalCount}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || loading}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </button>
            <span className="px-2">Page {page + 1} of {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page + 1 >= totalPages || loading}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        </>
      )}

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4 py-4 overflow-y-auto" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full my-8 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="bg-slate-900 p-5 sticky top-0 z-10">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">Booking Details</h2>
                  <p className="font-mono text-sm text-slate-400">{selected.booking_reference}</p>
                </div>
                <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-white">
                  <XCircle className="h-6 w-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Player */}
              <div>
                <h3 className="font-bold text-slate-900 mb-2 text-sm flex items-center gap-2">
                  Player
                  {selected.is_guest && <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-[10px] font-medium">Guest</span>}
                </h3>
                <div className="bg-slate-50 rounded-xl p-3 text-sm space-y-1">
                  <p><span className="text-slate-500">Name:</span> <span className="font-medium">{bookingDisplayName(selected, selected.profile)}</span></p>
                  <p className="flex items-center gap-1.5"><span className="text-slate-500">Gender:</span> <GenderBadge gender={selected.is_guest ? selected.guest_gender : selected.profile.gender} /> {!(selected.is_guest ? selected.guest_gender : selected.profile.gender) && <span className="font-medium">N/A</span>}</p>
                  <p><span className="text-slate-500">Phone:</span> <span className="font-medium">{(selected.is_guest ? selected.guest_phone : selected.profile.phone_number) || 'N/A'}</span></p>
                  {selected.is_guest && (
                    <p><span className="text-slate-500">Booked by:</span> <span className="font-medium">{selected.profile.short_name || selected.profile.full_name}</span></p>
                  )}
                </div>
              </div>

              {/* Session */}
              <div>
                <h3 className="font-bold text-slate-900 mb-2 text-sm">Session</h3>
                <div className="bg-slate-50 rounded-xl p-3 text-sm space-y-1">
                  <p><span className="text-slate-500">Title:</span> <span className="font-medium">{selected.session.title}</span></p>
                  <p><span className="text-slate-500">Date:</span> <span className="font-medium">{formatDate(selected.session.session_date)}</span></p>
                  <p><span className="text-slate-500">Time:</span> <span className="font-medium">{formatTime(selected.session.start_time)} - {formatTime(selected.session.end_time)}</span></p>
                  <p><span className="text-slate-500">Venue:</span> <span className="font-medium">{selected.session.venue_name}</span></p>
                </div>
              </div>

              {/* Payment */}
              <div>
                <h3 className="font-bold text-slate-900 mb-2 text-sm">Payment</h3>
                <div className="bg-slate-50 rounded-xl p-3 text-sm space-y-1">
                  {isTbc ? (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500">Final Amount (RM), price was TBC</span>
                      <input
                        type="number" step="0.01" min="0"
                        className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-right text-sm focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20 outline-none"
                        value={amountInput}
                        onChange={(e) => setAmountInput(e.target.value)}
                      />
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between"><span className="text-slate-500">Session fee</span><span>{formatCurrency(selected.subtotal)}</span></div>
                      {selected.processing_fee > 0 && <div className="flex justify-between"><span className="text-slate-500">Processing fee</span><span>{formatCurrency(selected.processing_fee)}</span></div>}
                      <div className="flex justify-between font-bold"><span>Total</span><span>{formatCurrency(selected.total_amount)}</span></div>
                    </>
                  )}
                  <div className="flex justify-between pt-2 border-t border-slate-200"><span className="text-slate-500">Status</span><StatusBadge status={selected.booking_status} /></div>
                </div>
              </div>

              {/* Payment receipt */}
              {selected.receipt_path && (
                <div>
                  <h3 className="font-bold text-slate-900 mb-2 text-sm">Payment Receipt</h3>
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm flex items-center justify-between gap-2">
                    <span className="text-blue-800">
                      {selected.receipt_uploaded_at ? `Uploaded ${formatDateTime(selected.receipt_uploaded_at)}` : 'Receipt uploaded'}
                    </span>
                    <button
                      onClick={() => viewReceipt(selected.receipt_path!)}
                      disabled={viewingReceipt}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-60 flex-shrink-0"
                    >
                      <Receipt className="h-3.5 w-3.5" />
                      {viewingReceipt ? 'Loading...' : 'View Receipt'}
                    </button>
                  </div>
                </div>
              )}

              {selected.cancelled_at && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm">
                  <p className="font-semibold text-red-900">Cancelled</p>
                  <p className="text-red-700 text-xs mt-1">{selected.cancellation_reason}</p>
                  <p className="text-red-600 text-xs mt-1">{formatDateTime(selected.cancelled_at)}</p>
                </div>
              )}

              {/* Admin actions */}
              <div>
                <h3 className="font-bold text-slate-900 mb-2 text-sm">Admin Actions</h3>
                <div className="flex flex-wrap gap-2">
                  {selected.payment_status !== 'Paid' && selected.booking_status !== 'Cancelled by Player' && selected.booking_status !== 'Cancelled by Admin' && (
                    <button
                      onClick={() => confirmBooking(selected, isTbc ? parseFloat(amountInput) || 0 : undefined)}
                      disabled={actionLoading || (isTbc && !amountInput)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-green-50 hover:bg-green-100 text-green-700 font-medium rounded-lg text-sm border border-green-200 transition-colors disabled:opacity-60"
                    >
                      <DollarSign className="h-4 w-4" />
                      Confirm Booking
                    </button>
                  )}
                  {selected.payment_status === 'Paid' && selected.booking_status !== 'Refunded' && (
                    <button onClick={() => issueRefund(selected)} disabled={actionLoading} className="inline-flex items-center gap-1.5 px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 font-medium rounded-lg text-sm border border-purple-200 transition-colors disabled:opacity-60">
                      <RotateCcw className="h-4 w-4" />
                      Issue Refund
                    </button>
                  )}
                  {selected.booking_status === 'Confirmed' && (
                    <button onClick={() => updateBookingStatus(selected, 'Completed')} disabled={actionLoading} className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium rounded-lg text-sm border border-blue-200 transition-colors disabled:opacity-60">
                      <RefreshCw className="h-4 w-4" />
                      Mark Completed
                    </button>
                  )}
                  {!selected.booking_status.includes('Cancelled') && selected.booking_status !== 'Completed' && (
                    <button onClick={() => updateBookingStatus(selected, 'Cancelled by Admin')} disabled={actionLoading} className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 font-medium rounded-lg text-sm border border-red-200 transition-colors disabled:opacity-60">
                      <XCircle className="h-4 w-4" />
                      Cancel Booking
                    </button>
                  )}
                </div>
              </div>

              {/* Admin notes */}
              <AdminNotes booking={selected} onUpdate={load} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminNotes({ booking, onUpdate }: { booking: AdminBooking; onUpdate: () => void }) {
  const { show } = useToast();
  const [notes, setNotes] = useState(booking.admin_notes || '');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const { error } = await supabase.from('bookings').update({ admin_notes: notes }).eq('id', booking.id);
    setSaving(false);
    if (error) { show(error.message, 'error'); return; }
    show('Notes saved', 'success');
    onUpdate();
  }

  return (
    <div>
      <h3 className="font-bold text-slate-900 mb-2 text-sm">Admin Notes</h3>
      <textarea
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20 outline-none"
        rows={2}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Internal notes..."
      />
      <button onClick={save} disabled={saving} className="mt-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60">
        {saving ? 'Saving...' : 'Save Notes'}
      </button>
    </div>
  );
}
