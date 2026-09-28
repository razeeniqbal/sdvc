import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useParams } from 'react-router-dom';
import type { SessionWorkspaceContext } from './sessionWorkspace';
import { ArrowLeft, Pencil } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { formatTime } from '@/lib/format';
import { adminSessionState, localToday, PLACE_HOLDING, STATE_TONE, type AdminSession } from '@/lib/adminSessions';
import { Spinner } from '@/components/LoadingScreen';
import { OpsBadge } from '@/components/admin/AdminUI';
import type { Session } from '@/types/database';

// Session operations workspace: /admin/sessions/:id[/bookings|/attendance|/waiting-list].
// Attendance and the waiting list live here — in the context of one session —
// rather than as global admin destinations.

export default function AdminSessionLayout() {
  const { id } = useParams<{ id: string }>();
  const { show } = useToast();
  const [session, setSession] = useState<AdminSession | null>(null);
  const [waitingCount, setWaitingCount] = useState(0);
  const [missing, setMissing] = useState(false);

  const reload = useCallback(async () => {
    if (!id) return;
    const [{ data: s }, { data: active }, { count: waiting }] = await Promise.all([
      supabase.from('sessions').select('*').eq('id', id).maybeSingle(),
      supabase.from('bookings').select('booking_status').eq('session_id', id).in('booking_status', PLACE_HOLDING),
      supabase.from('waiting_list').select('id', { count: 'exact', head: true }).eq('session_id', id).eq('status', 'Waiting'),
    ]);
    if (!s) { setMissing(true); return; }
    const confirmed = (active || []).filter((b: { booking_status: string }) => b.booking_status !== 'Pending Payment').length;
    const pending = (active || []).length - confirmed;
    setSession({ ...(s as Session), confirmed_count: confirmed, pending_count: pending, active_count: confirmed + pending });
    setWaitingCount(waiting ?? 0);
  }, [id]);

  useEffect(() => { reload(); }, [reload]);

  async function toggleBooking() {
    if (!session) return;
    const next = session.status === 'Open' ? 'Closed' : 'Open';
    const { error } = await supabase.from('sessions').update({ status: next }).eq('id', session.id);
    if (error) { show(error.message, 'error'); return; }
    show(`Booking ${next === 'Open' ? 'opened' : 'closed'}`, 'success');
    reload();
  }

  if (missing) {
    return (
      <div className="adm-page">
        <p className="font-display text-2xl font-bold uppercase text-chalk">Session not found</p>
        <Link to="/admin/sessions" className="mt-3 inline-block text-sm font-semibold text-vsb-400">Back to sessions</Link>
      </div>
    );
  }
  if (!session) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Spinner className="h-8 w-8 text-vsb-500" /></div>;
  }

  const today = localToday();
  const state = adminSessionState(session, today);
  const d = new Date(`${session.session_date}T00:00:00`);
  const pct = Math.min(100, (session.active_count / session.maximum_capacity) * 100);
  const canToggle = session.status !== 'Cancelled' && session.session_date >= today;

  const tabs = [
    { to: '', label: 'Overview', end: true },
    { to: 'bookings', label: 'Bookings', count: session.active_count },
    { to: 'attendance', label: 'Attendance' },
    { to: 'waiting-list', label: 'Waitlist', count: waitingCount },
  ];

  return (
    <div>
      {/* Session context header */}
      <header className="relative overflow-hidden border-b border-ink-600 bg-ink">
        <img src="/brand/court-horizontal.webp" alt="" width={973} height={335} className="absolute inset-0 h-full w-full object-cover opacity-[0.12]" />
        <div className="relative px-4 pt-5 sm:px-6 lg:px-10 lg:pt-7">
          <Link to="/admin/sessions" className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted hover:text-chalk">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Sessions
          </Link>

          <div className="mt-4 flex flex-wrap items-end justify-between gap-6">
            <div className="flex items-end gap-5">
              <div className="font-display uppercase leading-none" aria-hidden>
                <p className="text-sm font-bold tracking-[0.2em] text-vsb-300">{d.toLocaleDateString('en-MY', { weekday: 'short' })}</p>
                <p className="text-6xl font-extrabold text-chalk">{d.getDate()}</p>
                <p className="text-sm font-bold tracking-[0.2em] text-chalk">{d.toLocaleDateString('en-MY', { month: 'short' })}</p>
              </div>
              <div className="min-w-0 pb-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="adm-title">{session.title}</h1>
                  <OpsBadge tone={STATE_TONE[state]}>{state}</OpsBadge>
                </div>
                <p className="mt-2 text-sm text-slate-300">
                  <span className="sr-only">{d.toLocaleDateString('en-MY', { dateStyle: 'full' })} · </span>
                  {formatTime(session.start_time)} – {formatTime(session.end_time)} · {[session.venue_name, session.court_number].filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-6">
              <div className="w-44">
                <p className="adm-label">Players</p>
                <p className="adm-num mt-1 text-3xl">{session.active_count}<span className="text-muted"> / {session.maximum_capacity}</span></p>
                <div className="mt-1.5 h-1 bg-ink-600" aria-hidden><div className={`h-full ${state === 'Full' ? 'bg-ball' : 'bg-vsb-500'}`} style={{ width: `${pct}%` }} /></div>
              </div>
              <div className="flex gap-2">
                <Link to={`/admin/sessions/${session.id}/edit`} className="adm-btn"><Pencil className="h-3.5 w-3.5" aria-hidden /> Edit</Link>
                {canToggle && (
                  <button onClick={toggleBooking} className="adm-btn">{session.status === 'Open' ? 'Close booking' : 'Open booking'}</button>
                )}
              </div>
            </div>
          </div>

          <nav aria-label="Session management" className="-mb-px mt-6 flex gap-6 overflow-x-auto [scrollbar-width:none]">
            {tabs.map((t) => (
              <NavLink key={t.label} to={t.to} end={t.end}
                className={({ isActive }) => `relative whitespace-nowrap py-3 text-sm font-semibold uppercase tracking-wider transition-colors ${
                  isActive ? 'text-chalk after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-vsb-500' : 'text-muted hover:text-chalk'
                }`}>
                {t.label}{t.count !== undefined && t.count > 0 && <span className="ml-1.5 text-muted">{t.count}</span>}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <Outlet context={{ session, waitingCount, reload } satisfies SessionWorkspaceContext} />
    </div>
  );
}
