import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, XCircle, Search, QrCode, Users, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { bookingDisplayName, formatDate, formatTime } from '@/lib/format';
import { Spinner } from '@/components/LoadingScreen';
import { StatusBadge, GenderBadge } from '@/components/StatusBadge';
import type { Session, Booking, Profile, Attendance, AttendanceStatus } from '@/types/database';

interface BookingWithProfile extends Booking {
  profile: Profile;
}

export default function AdminAttendancePage() {
  const { id } = useParams<{ id: string }>();
  const { show } = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [bookings, setBookings] = useState<BookingWithProfile[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Map<string, Attendance>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<BookingWithProfile | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: s } = await supabase.from('sessions').select('*').eq('id', id).maybeSingle();
      setSession(s as Session);
      const { data: bs } = await supabase
        .from('bookings')
        .select('*, profile:profiles(*)')
        .eq('session_id', id)
        .in('booking_status', ['Confirmed', 'Completed', 'No Show'])
        .order('created_at', { ascending: true });
      setBookings((bs || []) as unknown as BookingWithProfile[]);
      const bookingIds = (bs || []).map((b: { id: string }) => b.id);
      let atts: Attendance[] | null = null;
      if (bookingIds.length > 0) {
        const res = await supabase.from('attendance').select('*').in('booking_id', bookingIds);
        atts = res.data;
      }
      const map = new Map<string, Attendance>();
      (atts || []).forEach((a) => map.set(a.booking_id, a));
      setAttendanceMap(map);
      setLoading(false);
    })();
  }, [id]);

  async function setAttendance(booking: BookingWithProfile, status: AttendanceStatus) {
    setUpdating(booking.id);
    const existing = attendanceMap.get(booking.id);
    if (existing) {
      const { error } = await supabase.from('attendance').update({
        attendance_status: status,
        checked_in_at: status === 'Attended' ? new Date().toISOString() : null,
      }).eq('id', existing.id);
      if (error) { show(error.message, 'error'); setUpdating(null); return; }
    } else {
      const { data, error } = await supabase.from('attendance').insert({
        booking_id: booking.id,
        attendance_status: status,
        checked_in_at: status === 'Attended' ? new Date().toISOString() : null,
      }).select().single();
      if (error) { show(error.message, 'error'); setUpdating(null); return; }
      attendanceMap.set(booking.id, data);
    }

    // Update booking status for No Show
    if (status === 'No Show') {
      await supabase.from('bookings').update({ booking_status: 'No Show' }).eq('id', booking.id);
    } else if (status === 'Attended') {
      await supabase.from('bookings').update({ booking_status: 'Completed' }).eq('id', booking.id);
    }

    setAttendanceMap(new Map(attendanceMap));
    setUpdating(null);
    show(`Marked as ${status}`, 'success');
  }

  async function handleConfirmCancel() {
    if (!confirmCancel) return;
    const booking = confirmCancel;
    setConfirmCancel(null);
    await setAttendance(booking, 'Cancelled');
  }

  if (loading || !session) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spinner className="h-8 w-8 text-navy-600" />
      </div>
    );
  }

  const filtered = bookings.filter((b) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return bookingDisplayName(b, b.profile).toLowerCase().includes(q) || b.booking_reference.toLowerCase().includes(q);
  });

  const attended = bookings.filter((b) => attendanceMap.get(b.id)?.attendance_status === 'Attended').length;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <Link to="/admin/sessions" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ArrowLeft className="h-4 w-4" />
        Back to sessions
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">Attendance</h1>
          <p className="text-slate-500 text-sm mt-1">{session.title} · {formatDate(session.session_date)} · {formatTime(session.start_time)}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-5 w-5 text-green-500" />
            <span className="font-bold text-slate-900">{attended}/{bookings.length}</span>
            <span className="text-slate-500">checked in</span>
          </div>
          <button className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-400 rounded-lg text-sm font-medium cursor-not-allowed" title="QR check-in coming soon">
            <QrCode className="h-4 w-4" />
            QR Check-in
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <input
          placeholder="Search by name or booking reference..."
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20 outline-none"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-4">
            <Users className="h-8 w-8" />
          </div>
          <p className="text-slate-500">No confirmed bookings for this session.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((b) => {
            const att = attendanceMap.get(b.id);
            const currentStatus = att?.attendance_status;
            return (
              <div key={b.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-navy-100 text-navy-700 font-bold text-sm">
                      {bookingDisplayName(b, b.profile).charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="flex items-center gap-1.5 font-semibold text-slate-900">
                        {bookingDisplayName(b, b.profile)}
                        <GenderBadge gender={b.is_guest ? b.guest_gender : b.profile.gender} />
                        {b.is_guest && <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-[10px] font-medium">Guest</span>}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-mono">{b.booking_reference}</span>
                        <StatusBadge status={b.booking_status} />
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setConfirmCancel(b)}
                      disabled={updating === b.id}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors disabled:opacity-50 ${
                        currentStatus === 'Cancelled' ? 'bg-slate-500 text-white border-slate-500' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <XCircle className="h-4 w-4" />
                      Cancelled
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cancel confirmation */}
      {confirmCancel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4" onClick={() => setConfirmCancel(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600 flex-shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Mark this booking as cancelled?</h3>
                <p className="text-sm text-slate-500 mt-1">
                  {bookingDisplayName(confirmCancel, confirmCancel.profile)}'s attendance will be marked Cancelled for this session.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmCancel(null)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-colors">
                Keep As Is
              </button>
              <button onClick={handleConfirmCancel} disabled={updating === confirmCancel.id} className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg transition-colors disabled:opacity-60">
                {updating === confirmCancel.id ? 'Cancelling...' : 'Yes, Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
