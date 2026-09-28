import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { bookingDisplayName } from '@/lib/format';
import { Spinner } from '@/components/LoadingScreen';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { OpsBadge } from '@/components/admin/AdminUI';
import type { Booking, Profile, Attendance, AttendanceStatus } from '@/types/database';

// Courtside attendance for one session (rendered inside the session workspace).
//   Present    → attendance 'Attended' and booking 'Completed' (existing rule)
//   Absent     → attendance 'Absent'
//   Not marked → attendance status cleared; a booking that was set to
//                'Completed' by Present goes back to 'Confirmed'
//   Cancelled  → attendance 'Cancelled' (kept from the previous page, behind a confirm)

interface BookingWithProfile extends Booking {
  profile: Profile;
}

type Mark = 'present' | 'absent' | 'none';

function markOf(att: Attendance | undefined): Mark | 'cancelled' {
  switch (att?.attendance_status) {
    case 'Attended': return 'present';
    case 'Absent':
    case 'No Show': return 'absent';
    case 'Cancelled': return 'cancelled';
    default: return 'none';
  }
}

export default function AdminAttendancePage() {
  const { id } = useParams<{ id: string }>();
  const { show } = useToast();
  const [bookings, setBookings] = useState<BookingWithProfile[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Map<string, Attendance>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);
  const [bulk, setBulk] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState<BookingWithProfile | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: bs } = await supabase
        .from('bookings')
        .select('*, profile:profiles(*)')
        .eq('session_id', id)
        .in('booking_status', ['Confirmed', 'Completed', 'No Show'])
        .order('created_at', { ascending: true });
      setBookings((bs || []) as unknown as BookingWithProfile[]);
      const bookingIds = (bs || []).map((b: { id: string }) => b.id);
      const map = new Map<string, Attendance>();
      if (bookingIds.length > 0) {
        const { data: atts } = await supabase.from('attendance').select('*').in('booking_id', bookingIds);
        (atts || []).forEach((a: Attendance) => map.set(a.booking_id, a));
      }
      setAttendanceMap(map);
      setLoading(false);
    })();
  }, [id]);

  // Writes one attendance change. Returns false on failure (and toasts), so bulk
  // marking can stop at the first error instead of half-silently continuing.
  async function write(booking: BookingWithProfile, status: AttendanceStatus | null): Promise<boolean> {
    const existing = attendanceMap.get(booking.id);
    const row = { attendance_status: status, checked_in_at: status === 'Attended' ? new Date().toISOString() : null };
    let saved: Attendance | null = null;
    if (existing) {
      const { data, error } = await supabase.from('attendance').update(row).eq('id', existing.id).select().single();
      if (error) { show(error.message, 'error'); return false; }
      saved = data as Attendance;
    } else {
      if (status === null) return true; // nothing recorded, nothing to clear
      const { data, error } = await supabase.from('attendance').insert({ booking_id: booking.id, ...row }).select().single();
      if (error) { show(error.message, 'error'); return false; }
      saved = data as Attendance;
    }

    let bookingStatus = booking.booking_status;
    if (status === 'Attended') bookingStatus = 'Completed';
    else if (status === 'No Show') bookingStatus = 'No Show';
    else if (booking.booking_status === 'Completed') bookingStatus = 'Confirmed';
    if (bookingStatus !== booking.booking_status) {
      const { error } = await supabase.from('bookings').update({ booking_status: bookingStatus }).eq('id', booking.id);
      if (error) { show(error.message, 'error'); return false; }
    }

    setAttendanceMap((m) => new Map(m).set(booking.id, saved!));
    setBookings((bs) => bs.map((b) => (b.id === booking.id ? { ...b, booking_status: bookingStatus } : b)));
    return true;
  }

  async function setMark(booking: BookingWithProfile, mark: Mark) {
    setUpdating(booking.id);
    await write(booking, mark === 'present' ? 'Attended' : mark === 'absent' ? 'Absent' : null);
    setUpdating(null);
  }

  async function markAllPresent() {
    const targets = bookings.filter((b) => markOf(attendanceMap.get(b.id)) === 'none');
    if (targets.length === 0) return;
    setBulk(true);
    let done = 0;
    for (const b of targets) {
      if (!(await write(b, 'Attended'))) break;
      done++;
    }
    setBulk(false);
    show(`Marked ${done} player${done === 1 ? '' : 's'} present`, 'success');
  }

  async function handleConfirmCancel() {
    if (!confirmCancel) return;
    const booking = confirmCancel;
    setConfirmCancel(null);
    setUpdating(booking.id);
    if (await write(booking, 'Cancelled')) show('Marked as Cancelled', 'success');
    setUpdating(null);
  }

  if (loading) {
    return <div className="flex min-h-[30vh] items-center justify-center"><Spinner className="h-7 w-7 text-vsb-500" /></div>;
  }

  const marks = bookings.map((b) => markOf(attendanceMap.get(b.id)));
  const summary = {
    present: marks.filter((m) => m === 'present').length,
    absent: marks.filter((m) => m === 'absent').length,
    none: marks.filter((m) => m === 'none').length,
    cancelled: marks.filter((m) => m === 'cancelled').length,
  };
  const q = search.toLowerCase();
  const filtered = bookings.filter((b) => !q || bookingDisplayName(b, b.profile).toLowerCase().includes(q) || b.booking_reference.toLowerCase().includes(q));

  const options: { key: Mark; label: string; on: string }[] = [
    { key: 'present', label: 'Present', on: 'border-green-500 bg-green-500/15 text-green-300' },
    { key: 'absent', label: 'Absent', on: 'border-red-500 bg-red-500/15 text-red-300' },
    { key: 'none', label: 'Not marked', on: 'border-chalk bg-ink-600 text-chalk' },
  ];

  return (
    <div className="adm-page">
      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-ink-600 pb-5">
        <div>
          <p className="adm-label">Attendance</p>
          <p className="adm-num mt-1 text-4xl">{bookings.length} <span className="text-lg font-bold tracking-wider text-muted">confirmed</span></p>
        </div>
        <dl className="flex flex-wrap gap-x-8 gap-y-3" aria-live="polite">
          {[['Present', summary.present, 'text-green-300'], ['Absent', summary.absent, 'text-red-300'], ['Not marked', summary.none, 'text-chalk'], ...(summary.cancelled ? [['Cancelled', summary.cancelled, 'text-slate-400']] : [])].map(([label, n, c]) => (
            <div key={label as string} className="flex flex-col-reverse">
              <dt className="adm-label">{label}</dt>
              <dd className={`adm-num text-3xl ${c}`}>{n}</dd>
            </div>
          ))}
        </dl>
        <button onClick={markAllPresent} disabled={bulk || summary.none === 0} className="v2-btn-primary font-display uppercase tracking-wider">
          {bulk && <Spinner className="h-4 w-4" />} Mark all present{summary.none > 0 ? ` (${summary.none})` : ''}
        </button>
      </div>

      <div className="relative my-4 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
        <input aria-label="Search players" placeholder="Search name or booking reference" className="v2-input !py-2.5 !pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <p className="py-10 text-slate-400">{bookings.length === 0 ? 'No confirmed players for this session yet.' : 'No players match your search.'}</p>
      ) : (
        <ul className="divide-y divide-ink-700 border-y border-ink-600">
          {filtered.map((b) => {
            const name = bookingDisplayName(b, b.profile);
            const mark = markOf(attendanceMap.get(b.id));
            const busy = updating === b.id || bulk;
            return (
              <li key={b.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <PlayerAvatar name={name} guest={b.is_guest} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-chalk">{name}</p>
                    <p className="text-xs text-muted">
                      {b.is_guest ? `Guest of ${b.profile.short_name || b.profile.full_name}` : (b.profile.gender || '—')} · <span className="font-mono">{b.booking_reference}</span>
                    </p>
                  </div>
                  {mark === 'cancelled' && <OpsBadge tone="neutral">Cancelled</OpsBadge>}
                </div>
                <div className="flex items-center gap-2">
                  <div role="radiogroup" aria-label={`Attendance for ${name}`} className="grid flex-1 grid-cols-3 gap-1.5 sm:flex-none">
                    {options.map((o) => (
                      <button
                        key={o.key}
                        role="radio"
                        aria-checked={mark === o.key}
                        disabled={busy}
                        onClick={() => mark !== o.key && setMark(b, o.key)}
                        className={`min-h-[44px] rounded-md border px-3 text-sm font-bold uppercase tracking-wide transition-colors disabled:opacity-50 sm:min-w-[7rem] ${
                          mark === o.key ? o.on : 'border-ink-500 text-slate-400 hover:border-slate-300 hover:text-chalk'
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setConfirmCancel(b)} disabled={busy || mark === 'cancelled'} className="min-h-[44px] rounded-md px-2 text-xs font-semibold uppercase tracking-wider text-muted hover:text-red-300 disabled:opacity-40" aria-label={`Mark ${name} as cancelled`}>
                    Cancel
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {confirmCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setConfirmCancel(null)}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="cancel-att-title" className="w-full max-w-md border border-ink-600 bg-ink-800 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-400" aria-hidden />
              <div>
                <h3 id="cancel-att-title" className="font-display text-xl font-bold uppercase tracking-wide text-chalk">Mark as cancelled?</h3>
                <p className="mt-1 text-sm text-slate-400">{bookingDisplayName(confirmCancel, confirmCancel.profile)}'s attendance will be marked Cancelled for this session.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmCancel(null)} className="adm-btn flex-1 !py-2.5">Keep as is</button>
              <button onClick={handleConfirmCancel} className="flex-1 rounded-md bg-red-600 py-2.5 font-bold text-white hover:bg-red-700">Yes, cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
