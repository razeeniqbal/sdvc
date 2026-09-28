import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { formatCurrency, formatTime } from '@/lib/format';
import { adminSessionState, fetchAdminSessions, localToday, STATE_TONE, type AdminSession } from '@/lib/adminSessions';
import { Spinner } from '@/components/LoadingScreen';
import { CapacityIndicator } from '@/components/vsb/CapacityIndicator';
import { AdminPageHeader, OpsBadge, SectionTitle, Stat, type OpsTone } from '@/components/admin/AdminUI';
import type { Booking } from '@/types/database';
import { vsbAssets } from '@/lib/vsbAssets';

interface AttentionItem { key: string; tone: OpsTone; count: number; title: string; detail: string; to: string; action: string }

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function shortDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return { day: d.getDate(), mon: d.toLocaleDateString('en-MY', { month: 'short' }).toUpperCase(), wk: d.toLocaleDateString('en-MY', { weekday: 'short' }).toUpperCase() };
}

export default function AdminDashboardPage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [bookings, setBookings] = useState<Pick<Booking, 'id' | 'session_id' | 'booking_status' | 'payment_status' | 'total_amount' | 'receipt_path' | 'created_at'>[]>([]);
  const [players, setPlayers] = useState<number | null>(null);
  const [waiting, setWaiting] = useState<{ session_id: string }[]>([]);

  useEffect(() => {
    (async () => {
      const [s, b, p, w] = await Promise.all([
        fetchAdminSessions(),
        supabase.from('bookings').select('id, session_id, booking_status, payment_status, total_amount, receipt_path, created_at'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'player'),
        supabase.from('waiting_list').select('session_id').eq('status', 'Waiting'),
      ]);
      setSessions(s);
      setBookings((b.data || []) as typeof bookings);
      setPlayers(p.count ?? null);
      setWaiting((w.data || []) as { session_id: string }[]);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Spinner className="h-8 w-8 text-vsb-500" /></div>;
  }

  const today = localToday();
  const upcoming = sessions.filter((s) => s.session_date >= today && s.status !== 'Cancelled');
  const upcomingIds = new Set(upcoming.map((s) => s.id));
  const next = upcoming[0];
  const revenue = bookings.filter((b) => b.payment_status === 'Paid').reduce((sum, b) => sum + Number(b.total_amount), 0);

  // ---- Needs attention: every item is a live count from real rows ----
  const pending = bookings.filter((b) => b.booking_status === 'Pending Payment' && upcomingIds.has(b.session_id));
  const receiptsToVerify = pending.filter((b) => b.receipt_path);
  const unpaidNoReceipt = pending.filter((b) => !b.receipt_path);
  const waitingUpcoming = waiting.filter((w) => upcomingIds.has(w.session_id));
  const waitingBySession = new Map<string, number>();
  waitingUpcoming.forEach((w) => waitingBySession.set(w.session_id, (waitingBySession.get(w.session_id) || 0) + 1));
  const almostFull = upcoming.filter((s) => adminSessionState(s, today) === 'Almost full');
  const tbcWithPlayers = upcoming.filter((s) => s.price === 0 && s.active_count > 0);

  const attention: AttentionItem[] = [];
  if (receiptsToVerify.length) attention.push({ key: 'receipts', tone: 'attention', count: receiptsToVerify.length, title: 'Receipts to verify', detail: 'Players uploaded payment receipts and are waiting for confirmation.', to: '/admin/payments', action: 'Review' });
  if (waitingUpcoming.length) {
    const [sid] = [...waitingBySession.entries()].sort((a, b) => b[1] - a[1])[0];
    attention.push({ key: 'waitlist', tone: 'attention', count: waitingUpcoming.length, title: 'On waiting lists', detail: `Across ${waitingBySession.size} upcoming session${waitingBySession.size > 1 ? 's' : ''}.`, to: `/admin/sessions/${sid}/waiting-list`, action: 'Open queue' });
  }
  if (tbcWithPlayers.length) attention.push({ key: 'tbc', tone: 'attention', count: tbcWithPlayers.length, title: 'Price still TBC', detail: 'Sessions with players booked but no final price set.', to: `/admin/sessions/${tbcWithPlayers[0].id}/edit`, action: 'Set price' });
  if (unpaidNoReceipt.length) attention.push({ key: 'unpaid', tone: 'neutral', count: unpaidNoReceipt.length, title: 'Unpaid, no receipt yet', detail: 'Booked slots awaiting payment from the player.', to: '/admin/payments?queue=awaiting', action: 'View' });
  almostFull.slice(0, 3).forEach((s) => attention.push({ key: `af-${s.id}`, tone: 'info', count: s.maximum_capacity - s.active_count, title: `Spots left · ${s.title}`, detail: 'Almost full. Consider a Telegram blast or a second court.', to: `/admin/sessions/${s.id}`, action: 'Manage' }));

  // ---- Booking activity: last 14 days ----
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (13 - i));
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { key, label: d.toLocaleDateString('en-MY', { weekday: 'narrow' }), count: bookings.filter((b) => b.created_at.slice(0, 10) === key).length };
  });
  const maxDay = Math.max(1, ...days.map((d) => d.count));
  const total14 = days.reduce((s, d) => s + d.count, 0);

  return (
    <div className="adm-page">
      <AdminPageHeader
        meta="Operations / Overview"
        title={<>{greeting()}{profile?.short_name ? `, ${profile.short_name}` : ''}.</>}
        subtitle="Here's what's happening at VSB."
        actions={<Link to="/admin/sessions/new" className="v2-btn-primary font-display uppercase tracking-wider"><Plus className="h-4 w-4" aria-hidden /> Create session</Link>}
      />

      {/* Primary metrics */}
      <section aria-label="Key numbers" className="grid grid-cols-2 gap-x-6 gap-y-8 border-y border-ink-600 py-6 lg:grid-cols-4">
        <Stat label="Upcoming games" value={upcoming.length} hint={next ? `Next: ${shortDate(next.session_date).wk} ${shortDate(next.session_date).day} ${shortDate(next.session_date).mon}` : 'None scheduled'} />
        <Stat label="Registered players" value={players ?? '-'} hint="Player accounts" />
        <Stat label="Awaiting payment" value={pending.length} tone={pending.length ? 'attention' : 'neutral'} hint={`${receiptsToVerify.length} with receipt uploaded`} />
        <Stat label="Revenue collected" value={formatCurrency(revenue).replace(/\.00$/, '')} tone="good" hint="All paid bookings" />
      </section>

      <div className="mt-8 grid gap-10 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        {/* Needs attention */}
        <section aria-labelledby="attention-heading">
          <SectionTitle id="attention-heading" action={<span className="adm-label">{attention.length} item{attention.length === 1 ? '' : 's'}</span>}>Needs attention</SectionTitle>
          {attention.length === 0 ? (
            <p className="py-6 text-slate-400">All clear. Nothing needs action right now.</p>
          ) : (
            <ul className="divide-y divide-ink-700">
              {attention.map((a) => (
                <li key={a.key} className="flex items-center gap-4 py-4">
                  <span className="adm-num w-14 flex-shrink-0 text-right text-3xl">{a.count}</span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-chalk">
                      {a.title}
                      <OpsBadge tone={a.tone}>{a.tone === 'attention' ? 'Action' : a.tone === 'info' ? 'Heads up' : 'Watch'}</OpsBadge>
                    </p>
                    <p className="text-sm text-slate-400">{a.detail}</p>
                  </div>
                  <Link to={a.to} className="adm-btn flex-shrink-0">{a.action} <ArrowRight className="h-3.5 w-3.5" aria-hidden /></Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Next session */}
        <section aria-labelledby="next-heading">
          <SectionTitle id="next-heading">Next session</SectionTitle>
          {!next ? (
            <div className="py-6">
              <p className="text-slate-400">No upcoming sessions.</p>
              <Link to="/admin/sessions/new" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-vsb-400 hover:text-vsb-300">Create one <ArrowRight className="h-4 w-4" aria-hidden /></Link>
            </div>
          ) : (() => {
            const d = shortDate(next.session_date);
            const state = adminSessionState(next, today);
            return (
              <div className="relative overflow-hidden border border-ink-600 bg-ink">
                <img src={vsbAssets.court.horizontal1024.src} alt="" width={1024} height={356} className="absolute inset-0 h-full w-full object-cover opacity-15" />
                <div className="relative grid gap-5 p-5 sm:grid-cols-[auto_1fr]">
                  <div className="font-display uppercase leading-none">
                    <p className="text-sm font-bold tracking-[0.2em] text-vsb-300">{d.wk}</p>
                    <p className="text-6xl font-extrabold text-chalk">{d.day}</p>
                    <p className="text-sm font-bold tracking-[0.2em] text-chalk">{d.mon}</p>
                  </div>
                  <div className="min-w-0 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-2xl font-extrabold uppercase tracking-wide text-chalk">{next.title}</h3>
                      <OpsBadge tone={STATE_TONE[state]}>{state}</OpsBadge>
                    </div>
                    <p className="text-sm text-slate-300">
                      {formatTime(next.start_time)} to {formatTime(next.end_time)} · {[next.venue_name, next.court_number].filter(Boolean).join(' · ')}
                    </p>
                    <CapacityIndicator confirmed={next.active_count} max={next.maximum_capacity} size="sm" />
                    <p className="text-xs text-muted">{next.confirmed_count} confirmed · {next.pending_count} awaiting payment · {waitingBySession.get(next.id) || 0} waiting</p>
                    <Link to={`/admin/sessions/${next.id}`} className="v2-btn-primary !py-2 font-display text-sm uppercase tracking-wider">Manage session <ArrowRight className="h-4 w-4" aria-hidden /></Link>
                  </div>
                </div>
              </div>
            );
          })()}
        </section>
      </div>

      {/* Booking activity — kept small; analytics shouldn't dominate */}
      <section aria-labelledby="activity-heading" className="mt-10">
        <SectionTitle id="activity-heading" action={<span className="adm-label">{total14} bookings · 14 days</span>}>Booking activity</SectionTitle>
        <div className="flex h-28 items-end gap-1.5" role="img" aria-label={`Bookings per day over the last 14 days, ${total14} in total`}>
          {days.map((d) => (
            <div key={d.key} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[10px] font-semibold text-slate-400">{d.count || ''}</span>
              <div className="w-full bg-vsb-600" style={{ height: `${(d.count / maxDay) * 100}%`, minHeight: d.count ? 3 : 1, opacity: d.count ? 1 : 0.25 }} />
              <span className="text-[10px] text-muted">{d.label}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
