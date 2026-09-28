import { supabase } from './supabase';
import type { Booking, Session } from '@/types/database';

// The signed-in player's games: their bookings (own + companions they booked)
// plus places a friend booked for them (guest_user_id), each with its session.
// Shared by My VSB and My Games. VSB does not track attendance for players.

export interface MyGame extends Booking {
  session: Session;
  /** A friend booked this place for the player (the friend pays). */
  booked_by_friend?: boolean;
}

export type GameState = 'upcoming' | 'awaiting-payment' | 'played' | 'not-played' | 'cancelled';

export async function fetchMyGames(userId: string): Promise<MyGame[]> {
  const { data } = await supabase
    .from('bookings')
    .select('*, session:sessions(*)')
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

// Derived only from the booking status and the date:
//   played     = a past game with a Confirmed/Completed booking
//   not-played = a past game that never became a confirmed place (unpaid, no-show)
export function gameState(g: MyGame, today = localToday()): GameState {
  if (g.booking_status.includes('Cancelled') || g.booking_status === 'Refunded') return 'cancelled';
  if (g.session.session_date >= today) return g.booking_status === 'Pending Payment' ? 'awaiting-payment' : 'upcoming';
  return g.booking_status === 'Confirmed' || g.booking_status === 'Completed' ? 'played' : 'not-played';
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
