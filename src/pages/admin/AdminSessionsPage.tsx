import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Copy, Trash2, Edit, Users, CalendarDays, Megaphone, MoreVertical } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { formatDate, formatTime } from '@/lib/format';
import { Spinner } from '@/components/LoadingScreen';
import { SessionStatusBadge } from '@/components/StatusBadge';
import { sendGroupBlast } from '@/lib/notifications';
import type { Session } from '@/types/database';

interface SessionWithCount extends Session {
  confirmed_count: number;
}

export default function AdminSessionsPage() {
  const { show } = useToast();
  const [sessions, setSessions] = useState<SessionWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [blastSession, setBlastSession] = useState<SessionWithCount | null>(null);
  const [blastMessage, setBlastMessage] = useState('');
  const [blasting, setBlasting] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenuId(null);
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  async function load() {
    const { data } = await supabase.from('sessions').select('*').order('session_date', { ascending: true });
    const sessionList = (data || []) as Session[];
    const { data: active } = await supabase.from('bookings').select('session_id, booking_status').in('booking_status', ['Pending Payment', 'Confirmed']);
    const counts = new Map<string, number>();
    (active || []).forEach((b: { session_id: string }) => counts.set(b.session_id, (counts.get(b.session_id) || 0) + 1));
    setSessions(sessionList.map((s) => ({ ...s, confirmed_count: counts.get(s.id) || 0 })));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleDuplicate(id: string) {
    const session = sessions.find((s) => s.id === id);
    if (!session) return;
    const newDate = new Date(session.session_date);
    newDate.setDate(newDate.getDate() + 7);
    const { error } = await supabase.from('sessions').insert({
      title: session.title,
      description: session.description,
      session_date: newDate.toISOString().split('T')[0],
      start_time: session.start_time,
      end_time: session.end_time,
      venue_name: session.venue_name,
      venue_address: session.venue_address,
      maps_link: session.maps_link,
      court_number: session.court_number,
      price: session.price,
      maximum_capacity: session.maximum_capacity,
      booking_open_at: session.booking_open_at,
      booking_close_at: session.booking_close_at,
      cancellation_deadline: session.cancellation_deadline,
      status: session.status,
      notes: session.notes,
    });
    if (error) { show(error.message, 'error'); return; }
    show('Session duplicated for next week', 'success');
    load();
  }

  async function handleDelete() {
    if (!deleteId) return;
    const { error } = await supabase.from('sessions').delete().eq('id', deleteId);
    setDeleteId(null);
    if (error) { show(error.message, 'error'); return; }
    show('Session deleted', 'success');
    load();
  }

  async function toggleStatus(session: Session) {
    const newStatus = session.status === 'Open' ? 'Closed' : 'Open';
    const { error } = await supabase.from('sessions').update({ status: newStatus }).eq('id', session.id);
    if (error) { show(error.message, 'error'); return; }
    show(`Session ${newStatus === 'Open' ? 'opened' : 'closed'} for booking`, 'success');
    load();
  }

  function openBlast(s: SessionWithCount) {
    const slotsLeft = s.maximum_capacity - s.confirmed_count;
    setBlastMessage(
      `📢 ${s.title}\n${formatDate(s.session_date)}, ${formatTime(s.start_time)} - ${formatTime(s.end_time)}\n📍 ${s.venue_name}\n${slotsLeft} slot${slotsLeft === 1 ? '' : 's'} left — book now!`
    );
    setBlastSession(s);
  }

  async function handleBlastSend() {
    if (!blastMessage.trim()) return;
    setBlasting(true);
    const ok = await sendGroupBlast(blastMessage);
    setBlasting(false);
    if (!ok) { show('Failed to send WhatsApp blast', 'error'); return; }
    show('WhatsApp blast sent', 'success');
    setBlastSession(null);
  }

  const filtered = sessions.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.title.toLowerCase().includes(q) || s.venue_name.toLowerCase().includes(q);
  });

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spinner className="h-8 w-8 text-orange-500" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Session Management</h1>
          <p className="text-slate-500 text-sm mt-1">Create, edit, and manage volleyball sessions</p>
        </div>
        <Link to="/admin/sessions/new" className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white font-bold rounded-xl transition-all">
          <Plus className="h-5 w-5" />
          Create Session
        </Link>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          placeholder="Search by title or venue..."
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-4">
            <CalendarDays className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-1">No sessions yet</h3>
          <p className="text-slate-500 text-sm mb-4">Create your first volleyball session.</p>
          <Link to="/admin/sessions/new" className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white font-bold rounded-xl transition-all">
            <Plus className="h-5 w-5" />
            Create Session
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3">Session</th>
                <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3 hidden sm:table-cell">Date</th>
                <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3 hidden md:table-cell">Venue</th>
                <th className="text-center text-xs font-semibold text-slate-600 px-4 py-3">Bookings</th>
                <th className="text-center text-xs font-semibold text-slate-600 px-4 py-3">Status</th>
                <th className="text-right text-xs font-semibold text-slate-600 px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900 text-sm">{s.title}</p>
                    <p className="text-xs text-slate-500">{s.price > 0 ? `RM${s.price.toFixed(2)}` : 'TBC'}</p>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-sm text-slate-600">{formatDate(s.session_date)}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-sm text-slate-600">{s.venue_name}</td>
                  <td className="px-4 py-3 text-center">
                    <Link to={`/admin/sessions/${s.id}/attendance`} className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
                      <Users className="h-3.5 w-3.5" />
                      {s.confirmed_count}/{s.maximum_capacity}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => toggleStatus(s)}>
                      <SessionStatusBadge status={s.status} />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link to={`/admin/sessions/${s.id}/edit`} className="p-2 text-slate-400 hover:text-orange-600 rounded-lg hover:bg-orange-50 transition-colors" title="Edit">
                        <Edit className="h-4 w-4" />
                      </Link>
                      <button onClick={() => setDeleteId(s.id)} className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors" title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <div className="relative" ref={s.id === openMenuId ? menuRef : undefined}>
                        <button
                          onClick={() => setOpenMenuId(openMenuId === s.id ? null : s.id)}
                          className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                          title="More actions"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                        {openMenuId === s.id && (
                          <div className="absolute right-0 mt-1 w-44 bg-white rounded-xl border border-slate-200 shadow-lg z-10 py-1 text-sm">
                            <Link to={`/admin/sessions/${s.id}/attendance`} onClick={() => setOpenMenuId(null)} className="flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-slate-50">
                              <Users className="h-4 w-4 text-blue-500" /> Attendance
                            </Link>
                            <Link to={`/admin/sessions/${s.id}/waiting-list`} onClick={() => setOpenMenuId(null)} className="flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-slate-50">
                              <CalendarDays className="h-4 w-4 text-amber-500" /> Waiting List
                            </Link>
                            <button onClick={() => { setOpenMenuId(null); openBlast(s); }} className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-slate-50">
                              <Megaphone className="h-4 w-4 text-green-500" /> Blast to WhatsApp
                            </button>
                            <button onClick={() => { setOpenMenuId(null); handleDuplicate(s.id); }} className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-slate-50">
                              <Copy className="h-4 w-4 text-green-500" /> Duplicate
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Blast dialog */}
      {blastSession && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4" onClick={() => setBlastSession(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-slate-900 mb-1 flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-green-600" /> Blast "{blastSession.title}"
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              Sends this message directly to your Telegram group.
            </p>
            <textarea
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:border-green-400 focus:ring-2 focus:ring-green-400/20 outline-none transition-all resize-none"
              rows={5}
              value={blastMessage}
              onChange={(e) => setBlastMessage(e.target.value)}
            />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setBlastSession(null)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-colors">Cancel</button>
              <button onClick={handleBlastSend} disabled={blasting} className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                {blasting && <Spinner className="h-4 w-4" />}
                {blasting ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete dialog */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4" onClick={() => setDeleteId(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-slate-900 mb-2">Delete this session?</h3>
            <p className="text-sm text-slate-500 mb-4">This will also delete all associated bookings and payments. This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-colors">Cancel</button>
              <button onClick={handleDelete} className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
