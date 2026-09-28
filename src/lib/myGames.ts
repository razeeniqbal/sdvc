import { supabase } from './supabase';
import type { AttendanceStatus, Booking, Session } from '@/types/database';

// The signed-in player's games: their bookings (own + companions they booked)
// plus places a friend booked for them (guest_user_id), each with its session
// and any attendance mark. Shared by My VSB and My Games.

export interface MyGame extends Booking {
  session: Session;
  /** A friend booked this place for the player (the friend pays). */
  booked_by_friend?: boolean;
  attendance: { attendance_status: AttendanceStatus | null }[] | { attendance_status: AttendanceStatus | null } | null;
}

export type GameState = 'upcoming' | 'awaiting-payment' | 'attended' | 'missed' | 'played' | 'cancelled';

export async function fetchMyGames(userId: string): Promise<MyGame[]> {
  const { data } = await supabase
    .from('bookings')
    .select('*, session:sessions(*), attendance(attendance_status)')
    .or(`user_id.eq.${userId},guest_user_id.eq.${userId}`)
    .order('created_at', { ascending: false });
  // A place a friend booked is this player's own place (not "a guest they
  // brought"), so it counts in their games and stats.
  return ((data || []) as unknown as MyGame[]).map((g) =>
    g.guest_user_id === userId ? { ...g, is_guest: false, booked_by_friend: true } : g);
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

// REAL VSB ACTIVITY for the player identity (card + My VSB). Only the
// player's own place counts (not companions they booked for).
//   games   = past sessions where their booking ended Confirmed or Completed
//             (cancelled, unpaid, refunded and no-show bookings don't count)
//   venues  = distinct venues among those games
//   upcoming = booked games still ahead
// No attendance or performance metrics: VSB doesn't rate players.
export interface PlayerActivity {
  games: number;
  venues: number;
  upcoming: number;
}

const PLAYED_STATUSES = ['Confirmed', 'Completed'];

export function playerActivity(games: MyGame[]): PlayerActivity {
  const today = localToday();
  const own = games.filter((g) => !g.is_guest);
  const played = own.filter((g) => g.session.session_date < today && PLAYED_STATUSES.includes(g.booking_status));
  const venues = new Set(played.map((g) => g.session.venue_name.trim().toLowerCase()).filter(Boolean));
  const upcoming = own.filter((g) => isUpcoming(g, today)).length;
  return { games: played.length, venues: venues.size, upcoming };
}
