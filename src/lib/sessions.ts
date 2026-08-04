import { supabase } from './supabase';
import { formatTime } from './format';
import type { Session, Gender } from '@/types/database';

export interface SessionWithCount extends Session {
  confirmed_count: number;
}

export async function fetchSessionsWithCounts(): Promise<SessionWithCount[]> {
  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('*')
    .gte('session_date', new Date().toISOString().split('T')[0])
    .order('session_date', { ascending: true });

  if (error) throw error;
  if (!sessions || sessions.length === 0) return [];

  // Uses the SECURITY DEFINER confirmed_booking_count() function so counts are
  // accurate for every viewer — a direct query against `bookings` would be
  // filtered by RLS to only the caller's own rows.
  const counts = await Promise.all(
    sessions.map((s) => supabase.rpc('confirmed_booking_count', { p_session_id: s.id }))
  );

  return sessions.map((s, i) => ({
    ...s,
    confirmed_count: (counts[i].data as number) || 0,
  })) as SessionWithCount[];
}

export function getSessionStatus(
  session: Session,
  confirmedCount: number
): 'Available' | 'Almost Full' | 'Fully Booked' | 'Booking Closed' | 'Cancelled' {
  if (session.status === 'Cancelled') return 'Cancelled';
  if (session.status === 'Closed') return 'Booking Closed';
  if (confirmedCount >= session.maximum_capacity) return 'Fully Booked';
  if (confirmedCount >= session.maximum_capacity * 0.8) return 'Almost Full';
  return 'Available';
}

export function canBook(session: Session, confirmedCount: number): boolean {
  const status = getSessionStatus(session, confirmedCount);
  return status === 'Available' || status === 'Almost Full';
}

export interface SessionRosterPlayer {
  display_name: string;
  booking_status: string;
  gender: Gender | null;
}

export async function fetchSessionRoster(sessionId: string): Promise<SessionRosterPlayer[]> {
  const { data } = await supabase.rpc('session_player_list', { p_session_id: sessionId });
  return (data || []) as SessionRosterPlayer[];
}

const MALAY_DAYS = ['AHAD', 'ISNIN', 'SELASA', 'RABU', 'KHAMIS', 'JUMAAT', 'SABTU'];

// Builds a numbered signup-sheet style roster, e.g.:
//   1) Shen ✅
//   2) Madi
//   3)
// Confirmed bookings get a tick; locked-but-unconfirmed bookings show just the name;
// slots beyond the current booking count are left blank.
export function buildRosterMessage(session: Session, players: SessionRosterPlayer[]): string {
  const date = new Date(`${session.session_date}T00:00:00`);
  const day = date.getDate();
  const month = date.toLocaleDateString('en-MY', { month: 'long' }).toUpperCase();
  const dayName = MALAY_DAYS[date.getDay()];
  const priceLine = session.price > 0 ? `RM${session.price.toFixed(2)}/pax` : 'TBC/pax';

  const lines = [
    session.title.toUpperCase(),
    '',
    `🏟️: ${session.venue_name.toUpperCase()}`,
    `📆: ${day} ${month} (${dayName})`,
    `⏰: ${formatTime(session.start_time)} - ${formatTime(session.end_time)}`,
    `💵: ${priceLine}`,
    '',
  ];

  for (let i = 1; i <= session.maximum_capacity; i++) {
    const player = players[i - 1];
    if (!player) { lines.push(`${i})`); continue; }
    const genderTag = player.gender ? ` (${player.gender === 'Male' ? 'M' : 'F'})` : '';
    const tick = player.booking_status === 'Confirmed' ? ' ✅' : '';
    lines.push(`${i}) ${player.display_name}${genderTag}${tick}`);
  }

  return lines.join('\n');
}
