import { supabase } from './supabase';
import type { AttendanceStatus, Booking, Session } from '@/types/database';

// The signed-in player's games: their bookings (own + companions they booked),
// each with its session and any attendance mark. RLS limits every row to the
// player's own bookings. Shared by My VSB and My Games.

export interface MyGame extends Booking {
  session: Session;
  attendance: { attendance_status: AttendanceStatus | null }[] | { attendance_status: AttendanceStatus | null } | null;
}

export type GameState = 'upcoming' | 'awaiting-payment' | 'attended' | 'missed' | 'played' | 'cancelled';

export async function fetchMyGames(userId: string): Promise<MyGame[]> {
  const { data } = await supabase
    .from('bookings')
    .select('*, session:sessions(*), attendance(attendance_status)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return (data || []) as unknown as MyGame[];
}

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function attendanceOf(g: MyGame): AttendanceStatus | null {
  const a = Array.isArray(g.attendance) ? g.attendance[0] : g.attendance;
  return a?.attendance_status ?? null;
}

// Derived only from stored status + date + attendance mark. "Played" = a past
// confirmed game nobody marked; we don't claim attended or missed without a mark.
export function gameState(g: MyGame, today = localToday()): GameState {
  if (g.booking_status.includes('Cancelled') || g.booking_status === 'Refunded') return 'cancelled';
  const att = attendanceOf(g);
  if (att === 'Cancelled') return 'cancelled';
  if (g.session.session_date >= today) return g.booking_status === 'Pending Payment' ? 'awaiting-payment' : 'upcoming';
  if (att === 'Attended' || g.booking_status === 'Completed') return 'attended';
  if (att === 'Absent' || att === 'No Show' || g.booking_status === 'No Show') return 'missed';
  return 'played';
}

export function isUpcoming(g: MyGame, today = localToday()) {
  const s = gameState(g, today);
  return s === 'upcoming' || s === 'awaiting-payment';
}

export function byDateAsc(a: MyGame, b: MyGame) {
  return `${a.session.session_date} ${a.session.start_time}`.localeCompare(`${b.session.session_date} ${b.session.start_time}`);
}

export interface PlayerStats {
  played: number;     // past games not cancelled (attended + missed + unmarked)
  attended: number;   // marked present
  marked: number;     // past games with an attendance mark
  upcoming: number;
  attendancePct: number | null; // attended / marked — null until something is marked
}

// Stats count the player's OWN place only (not companions they booked for).
export function playerStats(games: MyGame[]): PlayerStats {
  const today = localToday();
  const own = games.filter((g) => !g.is_guest);
  let played = 0, attended = 0, marked = 0, upcoming = 0;
  for (const g of own) {
    const s = gameState(g, today);
    if (s === 'upcoming' || s === 'awaiting-payment') upcoming++;
    else if (s === 'attended') { played++; attended++; marked++; }
    else if (s === 'missed') { played++; marked++; }
    else if (s === 'played') played++;
  }
  return { played, attended, marked, upcoming, attendancePct: marked > 0 ? Math.round((attended / marked) * 100) : null };
}
