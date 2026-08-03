import { useEffect, useState } from 'react';
import { Search, Download, Eye, RefreshCw, XCircle, DollarSign, RotateCcw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { formatCurrency, formatDate, formatTime, formatDateTime } from '@/lib/format';
import { notifyWhatsAppGroup } from '@/lib/notifications';
import { StatusBadge, PaymentStatusBadge } from '@/components/StatusBadge';
import { Spinner } from '@/components/LoadingScreen';
import type { Booking, Session, Profile, BookingStatus } from '@/types/database';

interface AdminBooking extends Booking {
  session: Session;
  profile: Profile;
}

export default function AdminBookingsPage() {
  const { show } = useToast();
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ search: '', session: '', bookingStatus: '', paymentStatus: '' });
  const [selected, setSelected] = useState<AdminBooking | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [amountInput, setAmountInput] = useState('');

  async function load() {
    const { data } = await supabase
      .from('bookings')
      .select('*, session:sessions(*), profile:profiles(*)')
      .order('created_at', { ascending: false });
    setBookings((data || []) as unknown as AdminBooking[]);
    const { data: sess } = await supabase.from('sessions').select('*').order('session_date', { ascending: false });
    setSessions((sess || []) as Session[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = bookings.filter((b) => {
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const match = b.booking_reference.toLowerCase().includes(q) ||
        b.session.title.toLowerCase().includes(q) ||
        b.profile.full_name.toLowerCase().includes(q) ||
        (b.profile.phone_number || '').includes(q);
      if (!match) return false;
    }
    if (filters.session && b.session_id !== filters.session) return false;
    if (filters.bookingStatus && b.booking_status !== filters.bookingStatus) return false;
    if (filters.paymentStatus && b.payment_status !== filters.paymentStatus) return false;
    return true;
  });

  function exportCSV() {
    const headers = ['Reference', 'Player', 'Phone', 'Session', 'Date', 'Booking Status', 'Payment Status', 'Total Amount', 'Created At'];
    const rows = filtered.map((b) => [
      b.booking_reference,
      b.profile.full_name,
      b.profile.phone_number || '',
      b.session.title,
      b.session.session_date,
      b.booking_status,
      b.payment_status,
      b.total_amount.toFixed(2),
      b.created_at,
    ]);
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

    const { count } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', booking.session_id)
      .in('booking_status', ['Confirmed']);
    const slotsLeft = booking.session.maximum_capacity - (count || 0);
    await notifyWhatsAppGroup(
      `Booking confirmed for "${booking.session.title}" on ${formatDate(booking.session.session_date)} — ${slotsLeft} slot${slotsLeft === 1 ? '' : 's'} left (${count || 0}/${booking.session.maximum_capacity} booked).`
    );

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

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spinner className="h-8 w-8 text-orange-500" />
      </div>
    );
  }

  const inputClass = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none';
  const isTbc = !!selected && selected.total_amount === 0 && selected.payment_status !== 'Paid';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Booking Management</h1>
          <p className="text-slate-500 text-sm mt-1">View, search, and manage all bookings</p>
        </div>
        <button onClick={exportCSV} className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl transition-colors">
          <Download className="h-5 w-5" />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input placeholder="Search name, phone, ref..." className={`${inputClass} pl-9`} value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
        </div>
        <select className={inputClass} value={filters.session} onChange={(e) => setFilters({ ...filters, session: e.target.value })}>
          <option value="">All sessions</option>
          {sessions.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
        </select>
        <select className={inputClass} value={filters.bookingStatus} onChange={(e) => setFilters({ ...filters, bookingStatus: e.target.value })}>
          <option value="">All booking statuses</option>
          {['Pending Payment', 'Confirmed', 'Cancelled by Player', 'Cancelled by Admin', 'Completed', 'No Show', 'Refunded'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className={inputClass} value={filters.paymentStatus} onChange={(e) => setFilters({ ...filters, paymentStatus: e.target.value })}>
          <option value="">All payment statuses</option>
          {['Pending', 'Paid', 'Failed', 'Cancelled', 'Refunded', 'Partially Refunded', 'Manual Payment Pending Verification'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-slate-500">No bookings found.</p>
        </div>
      ) : (
        <>
        {/* Mobile card list */}
        <div className="sm:hidden space-y-3">
          {filtered.map((b) => (
            <button
              key={b.id}
              onClick={() => { setSelected(b); setAmountInput(b.total_amount.toString()); }}
              className="w-full text-left bg-white rounded-2xl border border-slate-200 p-4 hover:border-orange-300 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 text-sm truncate">{b.profile.full_name}</p>
                  <p className="text-xs text-slate-500">{b.profile.phone_number || 'N/A'}</p>
                  <p className="font-mono text-xs text-slate-400 mt-1">{b.booking_reference}</p>
                </div>
                <p className="text-sm font-bold text-slate-900 flex-shrink-0">{formatCurrency(b.total_amount)}</p>
              </div>
              <p className="text-xs text-slate-500 mt-2 truncate">{b.session.title} · {formatDate(b.session.session_date)}</p>
              <div className="flex items-center gap-1.5 mt-2">
                <StatusBadge status={b.booking_status} />
                <PaymentStatusBadge status={b.payment_status} />
              </div>
            </button>
          ))}
        </div>

        {/* Desktop table */}
        <div className="hidden sm:block overflow-x-auto bg-white rounded-2xl border border-slate-200">
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
              {filtered.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-900">{b.booking_reference}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900 text-sm">{b.profile.full_name}</p>
                    <p className="text-xs text-slate-500">{b.profile.phone_number || 'N/A'}</p>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-sm text-slate-600">{b.session.title}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-sm text-slate-600">{formatDate(b.session.session_date)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1 items-center">
                      <StatusBadge status={b.booking_status} />
                      <PaymentStatusBadge status={b.payment_status} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-slate-900">{formatCurrency(b.total_amount)}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => { setSelected(b); setAmountInput(b.total_amount.toString()); }} className="p-2 text-slate-400 hover:text-orange-600 rounded-lg hover:bg-orange-50 transition-colors">
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4 py-4 overflow-y-auto" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full my-8 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="bg-slate-950 p-5 sticky top-0 z-10">
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
                <h3 className="font-bold text-slate-900 mb-2 text-sm">Player</h3>
                <div className="bg-slate-50 rounded-xl p-3 text-sm space-y-1">
                  <p><span className="text-slate-500">Name:</span> <span className="font-medium">{selected.profile.full_name}</span></p>
                  <p><span className="text-slate-500">Phone:</span> <span className="font-medium">{selected.profile.phone_number || 'N/A'}</span></p>
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
                      <span className="text-slate-500">Final Amount (RM) — price was TBC</span>
                      <input
                        type="number" step="0.01" min="0"
                        className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-right text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none"
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
                  <div className="flex justify-between pt-2 border-t border-slate-200"><span className="text-slate-500">Payment Status</span><PaymentStatusBadge status={selected.payment_status} /></div>
                  <div className="flex justify-between"><span className="text-slate-500">Booking Status</span><StatusBadge status={selected.booking_status} /></div>
                </div>
              </div>

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
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none"
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
