import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, MoreHorizontal, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { formatCurrency, formatTime } from '@/lib/format';
import { fetchSessionRoster, buildRosterMessage } from '@/lib/sessions';
import { adminSessionState, fetchAdminSessions, localToday, STATE_TONE, type AdminSession } from '@/lib/adminSessions';
import { sendGroupBlast } from '@/lib/notifications';
import { Spinner } from '@/components/LoadingScreen';
import { AdminPageHeader, OpsBadge } from '@/components/admin/AdminUI';
import type { Session } from '@/types/database';
import { useConsoleScope } from '@/lib/consoleScope';
import { useAuth } from '@/context/AuthContext';

type Filter = 'upcoming' | 'completed' | 'cancelled' | 'all';

function dateBits(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return { day: d.getDate(), mon: d.toLocaleDateString('en-MY', { month: 'short' }).toUpperCase(), wk: d.toLocaleDateString('en-MY', { weekday: 'short' }).toUpperCase() };
}

export default function AdminSessionsPage() {
  const scope = useConsoleScope();
  const { profile } = useAuth();
  const { show } = useToast();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  // Filter lives in the URL so a view can be linked to (e.g. ?filter=completed).
  const [params, setParams] = useSearchParams();
  const filterParam = params.get('filter') as Filter | null;
  const filter: Filter = filterParam && ['upcoming', 'completed', 'cancelled', 'all'].includes(filterParam) ? filterParam : 'upcoming';
  const setFilter = (f: Filter) => setParams(f === 'upcoming' ? {} : { filter: f }, { replace: true });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [blastSession, setBlastSession] = useState<AdminSession | null>(null);
  const [blastMessage, setBlastMessage] = useState('');
  const [blasting, setBlasting] = useState(false);
  const [blastLoading, setBlastLoading] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenuId(null);
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpenMenuId(null); }
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('click', onDocClick); document.removeEventListener('keydown', onKey); };
  }, []);

  function toggleMenu(sessionId: string, e: React.MouseEvent<HTMLButtonElement>) {
    // The portaled menu lives outside this button in the DOM, so this same click
    // would otherwise bubble to the document listener and immediately close it.
    e.stopPropagation();
    if (openMenuId === sessionId) { setOpenMenuId(null); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    setOpenMenuId(sessionId);
  }

  async function load() {
    setSessions(await fetchAdminSessions(scope.ownerId));
    setLoading(false);
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [scope.ownerId]);

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
      cover_image_path: session.cover_image_path,
      skill_level: session.skill_level,
      price: session.price,
      maximum_capacity: session.maximum_capacity,
      booking_open_at: session.booking_open_at,
      booking_close_at: session.booking_close_at,
      cancellation_deadline: session.cancellation_deadline,
      status: session.status,
      notes: session.notes,
      created_by: profile?.id,
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

  async function openBlast(s: AdminSession) {
    setBlastSession(s);
    setBlastLoading(true);
    setBlastMessage('');
    const roster = await fetchSessionRoster(s.id);
    setBlastMessage(buildRosterMessage(s, roster));
    setBlastLoading(false);
  }

  async function handleBlastSend() {
    if (!blastMessage.trim()) return;
    setBlasting(true);
    const ok = await sendGroupBlast(blastMessage);
    setBlasting(false);
    if (!ok) { show('Failed to send Telegram blast', 'error'); return; }
    show('Telegram blast sent', 'success');
    setBlastSession(null);
  }

  const today = localToday();
  const buckets: Record<Filter, AdminSession[]> = {
    upcoming: sessions.filter((s) => s.session_date >= today && s.status !== 'Cancelled'),
    completed: sessions.filter((s) => s.session_date < today && s.status !== 'Cancelled'),
    cancelled: sessions.filter((s) => s.status === 'Cancelled'),
    all: sessions,
  };
  const q = search.toLowerCase();
  const rows = buckets[filter]
    .filter((s) => !q || s.title.toLowerCase().includes(q) || s.venue_name.toLowerCase().includes(q))
    .sort((a, b) => (filter === 'upcoming' ? a.session_date.localeCompare(b.session_date) : b.session_date.localeCompare(a.session_date)));

  const filterLabels: Record<Filter, string> = { upcoming: 'Upcoming', completed: 'Completed', cancelled: 'Cancelled', all: 'All' };
  const menuSession = sessions.find((s) => s.id === openMenuId);

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Spinner className="h-8 w-8 text-vsb-500" /></div>;
  }

  return (
    <div className="adm-page">
      <AdminPageHeader
        meta="Operations"
        title="Sessions"
        actions={<Link to="/admin/sessions/new" className="v2-btn-primary font-display uppercase tracking-wider"><Plus className="h-4 w-4" aria-hidden /> Create session</Link>}
      />

      <div className="mb-4 flex flex-wrap items-end justify-between gap-4 border-b border-ink-600">
        <div className="-mb-px flex gap-6 overflow-x-auto [scrollbar-width:none]" role="group" aria-label="Filter sessions">
          {(Object.keys(filterLabels) as Filter[]).map((f) => (
            <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f} className="vsb-tab py-3">
              {filterLabels[f]} <span className="text-muted">{buckets[f].length}</span>
            </button>
          ))}
        </div>
        <div className="relative mb-2 w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input aria-label="Search sessions" placeholder="Search title or venue" className="v2-input !pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="py-16">
          <p className="font-display text-2xl font-bold uppercase text-chalk">{filter === 'completed' ? 'No completed sessions' : filter === 'cancelled' ? 'No cancelled sessions' : 'No sessions found'}</p>
          {filter === 'upcoming' && !q && (
            <Link to="/admin/sessions/new" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-vsb-400 hover:text-vsb-300">Create a session <ArrowRight className="h-4 w-4" aria-hidden /></Link>
          )}
        </div>
      ) : (
        <>
          {/* Desktop / tablet table */}
          <table className="adm-table hidden md:table">
            <thead>
              <tr>
                <th className="w-20">Date</th>
                <th>Session</th>
                <th className="hidden lg:table-cell">Venue</th>
                <th className="w-56">Players</th>
                <th className="w-32">Status</th>
                <th className="w-40 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const d = dateBits(s.session_date);
                const state = adminSessionState(s, today);
                const pct = Math.min(100, (s.active_count / s.maximum_capacity) * 100);
                return (
                  <tr key={s.id} className="cursor-pointer" onClick={() => navigate(`/admin/sessions/${s.id}`)}>
                    <td>
                      <p className="font-display leading-none"><span className="text-3xl font-extrabold text-chalk">{d.day}</span> <span className="text-xs font-bold tracking-wider text-muted">{d.mon}</span></p>
                      <p className="text-[11px] font-semibold tracking-wider text-muted">{d.wk}</p>
                    </td>
                    <td>
                      <Link to={`/admin/sessions/${s.id}`} onClick={(e) => e.stopPropagation()} className="font-semibold text-chalk hover:text-vsb-300">{s.title}</Link>
                      <p className="text-xs text-muted">{formatTime(s.start_time)} to {formatTime(s.end_time)} · {s.price > 0 ? formatCurrency(s.price) : 'Price TBC'}</p>
                    </td>
                    <td className="hidden lg:table-cell">
                      <p>{s.venue_name}</p>
                      {s.court_number && <p className="text-xs text-muted">{s.court_number}</p>}
                    </td>
                    <td>
                      <p className="font-display text-lg font-bold leading-none text-chalk">{s.active_count}<span className="text-muted"> / {s.maximum_capacity}</span></p>
                      <div className="mt-1.5 h-1 w-full bg-ink-600" aria-hidden><div className={`h-full ${state === 'Full' ? 'bg-ball' : 'bg-vsb-500'}`} style={{ width: `${pct}%` }} /></div>
                      {s.pending_count > 0 && <p className="mt-1 text-[11px] text-amber-300">{s.pending_count} awaiting payment</p>}
                    </td>
                    <td><OpsBadge tone={STATE_TONE[state]}>{state}</OpsBadge></td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <Link to={`/admin/sessions/${s.id}`} className="adm-btn">Manage</Link>
                        <button onClick={(e) => toggleMenu(s.id, e)} aria-label={`More actions for ${s.title}`} aria-haspopup="menu" aria-expanded={openMenuId === s.id} className="rounded-md p-1.5 text-muted hover:bg-ink-700 hover:text-chalk">
                          <MoreHorizontal className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Mobile stacked rows */}
          <ul className="divide-y divide-ink-700 border-y border-ink-600 md:hidden">
            {rows.map((s) => {
              const d = dateBits(s.session_date);
              const state = adminSessionState(s, today);
              return (
                <li key={s.id} className="flex items-start gap-3 py-4">
                  <div className="w-12 flex-shrink-0 font-display leading-none">
                    <p className="text-[11px] font-bold tracking-wider text-vsb-300">{d.wk}</p>
                    <p className="text-3xl font-extrabold text-chalk">{d.day}</p>
                    <p className="text-[11px] font-bold tracking-wider text-muted">{d.mon}</p>
                  </div>
                  <Link to={`/admin/sessions/${s.id}`} className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-chalk">{s.title}</p>
                    <p className="truncate text-xs text-muted">{formatTime(s.start_time)} · {s.venue_name}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="font-display text-base font-bold text-chalk">{s.active_count}<span className="text-muted">/{s.maximum_capacity}</span></span>
                      <OpsBadge tone={STATE_TONE[state]}>{state}</OpsBadge>
                    </div>
                  </Link>
                  <button onClick={(e) => toggleMenu(s.id, e)} aria-label={`More actions for ${s.title}`} className="rounded-md p-2 text-muted hover:bg-ink-700 hover:text-chalk">
                    <MoreHorizontal className="h-5 w-5" />
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {/* Row actions menu */}
      {menuSession && menuPos && createPortal(
        <div ref={menuRef} role="menu" style={{ top: menuPos.top, right: menuPos.right }} className="fixed z-50 w-52 border border-ink-600 bg-ink-800 py-1 text-sm shadow-2xl shadow-black/50">
          <Link role="menuitem" to={`/admin/sessions/${menuSession.id}/edit`} onClick={() => setOpenMenuId(null)} className="block px-3 py-2 text-slate-200 hover:bg-ink-700">Edit session</Link>
          {menuSession.status !== 'Cancelled' && menuSession.session_date >= today && (
            <button role="menuitem" onClick={() => { setOpenMenuId(null); toggleStatus(menuSession); }} className="block w-full px-3 py-2 text-left text-slate-200 hover:bg-ink-700">
              {menuSession.status === 'Open' ? 'Close booking' : 'Open booking'}
            </button>
          )}
          <button role="menuitem" onClick={() => { setOpenMenuId(null); openBlast(menuSession); }} className="block w-full px-3 py-2 text-left text-slate-200 hover:bg-ink-700">Blast roster to Telegram</button>
          <button role="menuitem" onClick={() => { setOpenMenuId(null); handleDuplicate(menuSession.id); }} className="block w-full px-3 py-2 text-left text-slate-200 hover:bg-ink-700">Duplicate for next week</button>
          <button role="menuitem" onClick={() => { setOpenMenuId(null); setDeleteId(menuSession.id); }} className="block w-full border-t border-ink-600 px-3 py-2 text-left text-red-300 hover:bg-red-500/10">Delete session</button>
        </div>,
        document.body
      )}

      {/* Blast dialog */}
      {blastSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setBlastSession(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="blast-title" className="w-full max-w-md border border-ink-600 bg-ink-800 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 id="blast-title" className="font-display text-xl font-bold uppercase tracking-wide text-chalk">Blast “{blastSession.title}”</h3>
            <p className="mb-4 mt-1 text-sm text-slate-400">Sends this roster directly to your Telegram group. Confirmed players are ticked automatically.</p>
            {blastLoading ? (
              <div className="flex items-center justify-center py-10"><Spinner className="h-6 w-6 text-green-400" /></div>
            ) : (
              <textarea aria-label="Blast message" className="v2-input resize-none font-mono" rows={14} value={blastMessage} onChange={(e) => setBlastMessage(e.target.value)} />
            )}
            <div className="mt-4 flex gap-3">
              <button onClick={() => setBlastSession(null)} className="adm-btn flex-1 !py-2.5">Cancel</button>
              <button onClick={handleBlastSend} disabled={blasting || blastLoading} className="flex flex-1 items-center justify-center gap-2 rounded-md bg-green-600 py-2.5 font-bold text-white transition-colors hover:bg-green-700 disabled:opacity-60">
                {blasting && <Spinner className="h-4 w-4" />}
                {blasting ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete dialog */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setDeleteId(null)}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="delete-title" className="w-full max-w-md border border-ink-600 bg-ink-800 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 id="delete-title" className="font-display text-xl font-bold uppercase tracking-wide text-chalk">Delete this session?</h3>
            <p className="mb-4 mt-1 text-sm text-slate-400">This will also delete all associated bookings and payments. This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="adm-btn flex-1 !py-2.5">Cancel</button>
              <button onClick={handleDelete} className="flex-1 rounded-md bg-red-600 py-2.5 font-bold text-white transition-colors hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
