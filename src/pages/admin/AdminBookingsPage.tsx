import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Receipt, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { bookingDisplayName, formatCurrency } from '@/lib/format';
import { ADMIN_BOOKING_SELECT, amountDue, type AdminBooking } from '@/lib/adminBookings';
import { Spinner } from '@/components/LoadingScreen';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { AdminPageHeader } from '@/components/admin/AdminUI';
import { BookingOpsBadge, PaymentOpsBadge } from '@/components/admin/statusBadges';
import { BookingDetailSheet } from '@/components/admin/BookingDetailSheet';
import type { Session } from '@/types/database';
import { useAvatarMap } from '@/lib/avatars';

const PAGE_SIZE = 25;

type StatusTab = 'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled';
const TAB_STATUSES: Record<StatusTab, string[] | null> = {
  all: null,
  pending: ['Pending Payment'],
  confirmed: ['Confirmed'],
  completed: ['Completed', 'No Show'],
  cancelled: ['Cancelled by Player', 'Cancelled by Admin', 'Refunded'],
};
const TAB_LABEL: Record<StatusTab, string> = { all: 'All', pending: 'Pending', confirmed: 'Confirmed', completed: 'Completed', cancelled: 'Cancelled' };

// Search text is spliced into a PostgREST .or() filter string, where commas and
// parentheses are syntax. Strip anything but safe search characters so a stray
// comma can't break the query (RLS still bounds what admins can see either way).
function sanitizeSearchTerm(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9 _-]/g, '').trim();
}

function shortDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' });
}

// Also rendered inside the session workspace (Bookings tab) with `sessionId`,
// which locks the session filter and drops the page-level header.
export default function AdminBookingsPage({ sessionId }: { sessionId?: string } = {}) {
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<StatusTab>(sessionId ? 'all' : 'all');
  const [filters, setFilters] = useState({ search: '', session: sessionId ?? '', paymentStatus: '' });
  const [selected, setSelected] = useState<AdminBooking | null>(null);
  const [exporting, setExporting] = useState(false);
  const avatars = useAvatarMap(bookings.filter((b) => !b.is_guest).map((b) => b.user_id));

  // Booking reference and guest name/phone live on the bookings table; the booker's own
  // name/phone live on the joined profile, so this resolves matching profile ids up front.
  async function getSearchUserIds(term: string): Promise<string[]> {
    const { data: matchedProfiles } = await supabase
      .from('profiles')
      .select('id')
      .or(`full_name.ilike.%${term}%,short_name.ilike.%${term}%,phone_number.ilike.%${term}%`);
    return (matchedProfiles || []).map((p: { id: string }) => p.id);
  }

  // Deliberately synchronous — the Supabase query builder is "thenable" (calling .then()
  // on it fires the request), so returning it from an async function would make `await`
  // silently unwrap it into the already-executed {data, count} result instead of the
  // builder, breaking any further chaining like .range() on the caller's side.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase's PostgrestFilterBuilder generics don't compose through a shared helper
  function applyFilters(query: any, term: string, userIds: string[]) {
    let q = query;
    if (filters.session) q = q.eq('session_id', filters.session);
    const statuses = TAB_STATUSES[tab];
    if (statuses) q = q.in('booking_status', statuses);
    if (filters.paymentStatus === 'review') q = q.eq('booking_status', 'Pending Payment').not('receipt_path', 'is', null);
    else if (filters.paymentStatus === 'awaiting') q = q.eq('booking_status', 'Pending Payment').is('receipt_path', null);
    else if (filters.paymentStatus) q = q.eq('payment_status', filters.paymentStatus);

    if (term) {
      const orParts = [`booking_reference.ilike.%${term}%`, `guest_name.ilike.%${term}%`, `guest_phone.ilike.%${term}%`];
      if (userIds.length > 0) orParts.push(`user_id.in.(${userIds.join(',')})`);
      q = q.or(orParts.join(','));
    }
    return q;
  }

  const load = useCallback(async () => {
    setLoading(true);
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const term = sanitizeSearchTerm(filters.search);
    const userIds = term ? await getSearchUserIds(term) : [];
    let query = supabase.from('bookings').select(ADMIN_BOOKING_SELECT, { count: 'exact' }).order('created_at', { ascending: false });
    query = applyFilters(query, term, userIds);
    const { data, count } = await query.range(from, to);
    setBookings((data || []) as unknown as AdminBooking[]);
    setTotalCount(count ?? 0);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filters.search, filters.session, filters.paymentStatus, tab]);

  useEffect(() => {
    if (sessionId) return;
    supabase.from('sessions').select('*').order('session_date', { ascending: false }).then(({ data }) => setSessions((data || []) as Session[]));
  }, [sessionId]);

  // Single debounced trigger for every filter + page change — short enough to
  // feel instant for clicks while coalescing keystrokes in the search box.
  useEffect(() => {
    const handle = setTimeout(() => { load(); }, 300);
    return () => clearTimeout(handle);
  }, [load]);

  async function exportCSV() {
    setExporting(true);
    const term = sanitizeSearchTerm(filters.search);
    const userIds = term ? await getSearchUserIds(term) : [];
    let query = supabase.from('bookings').select(ADMIN_BOOKING_SELECT).order('created_at', { ascending: false });
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
      amountDue(b).toFixed(2),
      b.created_at,
    ]);
    setExporting(false);
    const headers = ['Reference', 'Player', 'Gender', 'Phone', 'Booked By (if guest)', 'Session', 'Date', 'Booking Status', 'Payment Status', 'Total Amount', 'Created At'];
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `bookings-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const rangeStart = totalCount === 0 ? 0 : page * PAGE_SIZE + 1;
  const rangeEnd = Math.min(totalCount, (page + 1) * PAGE_SIZE);
  const setF = (patch: Partial<typeof filters>) => { setPage(0); setFilters((f) => ({ ...f, ...patch })); };

  const exportBtn = (
    <button onClick={exportCSV} disabled={exporting} className="adm-btn !py-2">
      {exporting ? <Spinner className="h-4 w-4" /> : <Download className="h-4 w-4" aria-hidden />} Export CSV
    </button>
  );

  return (
    <div className="adm-page">
      {!sessionId && <AdminPageHeader meta="Operations" title="Bookings" subtitle="Every booking across all sessions." actions={exportBtn} />}

      {/* Status tabs + filters */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink-600">
        <div className="-mb-px flex gap-6 overflow-x-auto [scrollbar-width:none]" role="group" aria-label="Booking status">
          {(Object.keys(TAB_LABEL) as StatusTab[]).map((t) => (
            <button key={t} onClick={() => { setPage(0); setTab(t); }} aria-pressed={tab === t} className="vsb-tab py-3">{TAB_LABEL[t]}</button>
          ))}
        </div>
        {sessionId && <div className="mb-2">{exportBtn}</div>}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input aria-label="Search bookings" placeholder="Search player, phone or booking reference" className="v2-input !py-2.5 !pl-9" value={filters.search} onChange={(e) => setF({ search: e.target.value })} />
        </div>
        {!sessionId && (
          <select aria-label="Session" className="v2-input !py-2.5" value={filters.session} onChange={(e) => setF({ session: e.target.value })}>
            <option value="">All sessions</option>
            {sessions.map((s) => <option key={s.id} value={s.id}>{shortDate(s.session_date)} · {s.title}</option>)}
          </select>
        )}
        <select aria-label="Payment" className="v2-input !py-2.5" value={filters.paymentStatus} onChange={(e) => setF({ paymentStatus: e.target.value })}>
          <option value="">Any payment state</option>
          <option value="review">Needs review (receipt uploaded)</option>
          <option value="awaiting">Awaiting receipt</option>
          <option value="Paid">Paid</option>
          <option value="Refunded">Refunded</option>
        </select>
      </div>

      <div className="mt-5">
        {loading && bookings.length === 0 ? (
          <div className="flex min-h-[30vh] items-center justify-center"><Spinner className="h-7 w-7 text-vsb-500" /></div>
        ) : bookings.length === 0 ? (
          <p className="py-12 text-slate-400">No bookings match these filters.</p>
        ) : (
          <>
            {/* Desktop table */}
            <table className={`adm-table hidden md:table ${loading ? 'opacity-60' : ''}`}>
              <thead>
                <tr>
                  <th>Player</th>
                  {!sessionId && <th>Session</th>}
                  <th className="w-36">Booking</th>
                  <th className="w-36">Payment</th>
                  <th className="w-28 text-right">Amount</th>
                  <th className="w-20 text-right"><span className="sr-only">Action</span></th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => {
                  const name = bookingDisplayName(b, b.profile);
                  return (
                    <tr key={b.id} className="cursor-pointer" onClick={() => setSelected(b)}>
                      <td>
                        <div className="flex items-center gap-3">
                          <PlayerAvatar name={name} src={b.is_guest ? null : avatars.get(b.user_id)} seed={b.is_guest ? null : b.user_id} guest={b.is_guest} size="xs" />
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-chalk">{name}</p>
                            <p className="truncate text-xs text-muted">
                              <span className="font-mono">{b.booking_reference}</span>
                              {b.is_guest && <> · guest of {b.profile.short_name || b.profile.full_name}</>}
                            </p>
                          </div>
                        </div>
                      </td>
                      {!sessionId && (
                        <td>
                          <p className="truncate font-medium text-slate-200">{b.session.title}</p>
                          <p className="text-xs text-muted">{shortDate(b.session.session_date)}</p>
                        </td>
                      )}
                      <td><BookingOpsBadge status={b.booking_status} /></td>
                      <td>
                        <span className="inline-flex items-center gap-1.5">
                          <PaymentOpsBadge booking={b} />
                          {b.receipt_path && <Receipt className="h-3.5 w-3.5 text-vsb-300" aria-label="Receipt uploaded" />}
                        </span>
                      </td>
                      <td className="text-right font-display text-lg font-bold text-chalk">{formatCurrency(amountDue(b))}</td>
                      <td className="text-right">
                        <button onClick={(e) => { e.stopPropagation(); setSelected(b); }} className="adm-btn">View</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Mobile rows */}
            <ul className="divide-y divide-ink-700 border-y border-ink-600 md:hidden">
              {bookings.map((b) => {
                const name = bookingDisplayName(b, b.profile);
                return (
                  <li key={b.id}>
                    <button onClick={() => setSelected(b)} className="flex w-full items-start gap-3 py-3 text-left">
                      <PlayerAvatar name={name} src={b.is_guest ? null : avatars.get(b.user_id)} seed={b.is_guest ? null : b.user_id} guest={b.is_guest} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate font-semibold text-chalk">{name}</p>
                          <p className="font-display text-lg font-bold text-chalk">{formatCurrency(amountDue(b))}</p>
                        </div>
                        {!sessionId && <p className="truncate text-xs text-muted">{shortDate(b.session.session_date)} · {b.session.title}</p>}
                        <div className="mt-1.5 flex flex-wrap gap-1.5"><BookingOpsBadge status={b.booking_status} /><PaymentOpsBadge booking={b} /></div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-400">
              <span>Showing {rangeStart}–{rangeEnd} of {totalCount}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0 || loading} className="adm-btn" aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
                <span className="px-2">Page {page + 1} of {totalPages}</span>
                <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page + 1 >= totalPages || loading} className="adm-btn" aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>
          </>
        )}
      </div>

      {selected && <BookingDetailSheet booking={selected} onClose={() => setSelected(null)} onChanged={load} />}
    </div>
  );
}
