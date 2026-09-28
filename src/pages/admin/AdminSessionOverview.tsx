import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, MapPin, Receipt } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { bookingDisplayName, formatCurrency, formatDateTime } from '@/lib/format';
import { Spinner } from '@/components/LoadingScreen';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { OpsBadge, SectionTitle, Stat, type OpsTone } from '@/components/admin/AdminUI';
import { useSessionWorkspace } from './sessionWorkspace';
import { localToday } from '@/lib/adminSessions';
import { useAvatarMap } from '@/lib/avatars';
import type { Booking, BookingStatus, Profile } from '@/types/database';

type Row = Booking & { profile: Pick<Profile, 'short_name' | 'full_name' | 'gender'> };

const BOOKING_TONE: Partial<Record<BookingStatus, OpsTone>> = {
  Confirmed: 'good', Completed: 'neutral', 'Pending Payment': 'attention', 'No Show': 'neutral',
  'Cancelled by Player': 'critical', 'Cancelled by Admin': 'critical', Refunded: 'neutral',
};

// Postgres intervals arrive as "24:00:00" or "1 day"; show them as hours.
function formatInterval(v: string | null): string {
  if (!v) return '24 hours';
  const m = /^(\d+):(\d{2}):\d{2}$/.exec(v);
  if (m) return `${Number(m[1])} hours${m[2] !== '00' ? ` ${Number(m[2])} min` : ''}`;
  return v;
}

export default function AdminSessionOverview() {
  const { session, waitingCount } = useSessionWorkspace();
  const [rows, setRows] = useState<Row[] | null>(null);
  const avatars = useAvatarMap((rows || []).filter((b) => !b.is_guest).map((b) => b.user_id));

  useEffect(() => {
    supabase
      .from('bookings')
      .select('*, profile:profiles(short_name, full_name, gender)')
      .eq('session_id', session.id)
      .order('created_at', { ascending: true })
      .then(({ data }) => setRows((data || []) as unknown as Row[]));
  }, [session.id, session.active_count]);

  if (!rows) return <div className="flex min-h-[30vh] items-center justify-center"><Spinner className="h-7 w-7 text-vsb-500" /></div>;

  const active = rows.filter((b) => ['Confirmed', 'Completed', 'Pending Payment'].includes(b.booking_status));
  const pending = active.filter((b) => b.booking_status === 'Pending Payment');
  const withReceipt = pending.filter((b) => b.receipt_path).length;
  const collected = rows.filter((b) => b.payment_status === 'Paid').reduce((s, b) => s + Number(b.total_amount), 0);
  // Unpaid rows owe the session's *current* price (TBC sessions get priced later).
  const outstanding = pending.length * session.price;
  const spotsLeft = Math.max(0, session.maximum_capacity - session.active_count);

  const facts: [string, string][] = [
    ['Price per player', session.price > 0 ? formatCurrency(session.price) : 'TBC'],
    ['Skill level', session.skill_level || 'Open Level'],
    ['Capacity', `${session.maximum_capacity} players`],
    ['Booking opens', session.booking_open_at ? formatDateTime(session.booking_open_at) : 'Immediately'],
    ['Booking closes', session.booking_close_at ? formatDateTime(session.booking_close_at) : 'Not set'],
    ['Cancellation window', formatInterval(session.cancellation_deadline)],
  ];

  return (
    <div className="adm-page">
      <section aria-label="Session numbers" className="grid grid-cols-2 gap-x-6 gap-y-8 border-b border-ink-600 pb-6 sm:grid-cols-3 xl:grid-cols-5">
        <Stat label="Confirmed" value={session.confirmed_count} tone="good" />
        <Stat label="Awaiting payment" value={pending.length} tone={pending.length ? 'attention' : 'neutral'} hint={`${withReceipt} receipt${withReceipt === 1 ? '' : 's'} to verify`} />
        {session.session_date >= localToday()
          ? <Stat label="Spots left" value={spotsLeft} tone={spotsLeft === 0 ? 'critical' : spotsLeft <= 3 ? 'attention' : 'neutral'} />
          : <Stat label="Capacity" value={session.maximum_capacity} hint="Session has finished" />}
        <Stat label="Waiting list" value={waitingCount} tone={waitingCount ? 'attention' : 'neutral'} />
        <Stat label="Collected" value={formatCurrency(collected).replace(/\.00$/, '')} tone="good" hint={outstanding > 0 ? `${formatCurrency(outstanding)} outstanding` : undefined} />
      </section>

      <div className="mt-8 grid gap-10 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section aria-labelledby="roster-heading">
          <SectionTitle id="roster-heading" action={<Link to="bookings" className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-vsb-400 hover:text-vsb-300">All bookings <ArrowRight className="h-3.5 w-3.5" aria-hidden /></Link>}>
            Players · {active.length}
          </SectionTitle>
          {active.length === 0 ? (
            <p className="py-4 text-slate-400">No one has booked yet.</p>
          ) : (
            <ul className="grid gap-x-8 sm:grid-cols-2">
              {active.map((b, i) => {
                const name = bookingDisplayName(b, b.profile);
                return (
                  <li key={b.id} className="flex items-center gap-3 border-b border-ink-700 py-2.5">
                    <span className="w-5 text-right font-display text-sm font-bold text-muted">{i + 1}</span>
                    <PlayerAvatar name={name} src={b.is_guest ? null : avatars.get(b.user_id)} seed={b.is_guest ? null : b.user_id} guest={b.is_guest} size="xs" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-chalk">{name}</p>
                      <p className="text-[11px] text-muted">
                        {b.is_guest ? `Guest of ${b.profile.short_name || b.profile.full_name}` : (b.profile.gender || 'Gender not set')}
                      </p>
                    </div>
                    {b.receipt_path && b.booking_status === 'Pending Payment' && <Receipt className="h-4 w-4 text-amber-300" aria-label="Receipt uploaded" />}
                    <OpsBadge tone={BOOKING_TONE[b.booking_status] || 'neutral'}>{b.booking_status === 'Pending Payment' ? 'Unpaid' : b.booking_status}</OpsBadge>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-labelledby="info-heading" className="space-y-6">
          <div>
            <SectionTitle id="info-heading">Session info</SectionTitle>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
              {facts.map(([k, v]) => (
                <div key={k}>
                  <dt className="adm-label">{k}</dt>
                  <dd className="mt-0.5 text-sm font-semibold text-chalk">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          {(session.description || session.notes) && (
            <div className="space-y-3">
              {session.description && <p className="text-sm text-slate-300">{session.description}</p>}
              {session.notes && (
                <p className="border-l-2 border-amber-400 pl-3 text-sm text-slate-300"><span className="adm-label mb-1 block">Note to players</span>{session.notes}</p>
              )}
            </div>
          )}

          <div className="border-t border-ink-600 pt-4">
            <p className="adm-label">Venue</p>
            <p className="mt-1 font-semibold text-chalk">{session.venue_name}{session.court_number ? ` · ${session.court_number}` : ''}</p>
            {session.venue_address && <p className="text-sm text-slate-400">{session.venue_address}</p>}
            {session.maps_link && (
              <a href={session.maps_link} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-vsb-400 hover:text-vsb-300">
                <MapPin className="h-4 w-4" aria-hidden /> Open in Maps
              </a>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
