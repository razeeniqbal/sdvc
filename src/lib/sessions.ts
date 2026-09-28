import { supabase } from './supabase';
import { formatTime } from './format';
import { avatarPublicUrl } from './avatars';
import type { Session, Gender, PlayingPosition } from '@/types/database';

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

// i18n keys for getSessionStatus() results.
export const SESSION_STATUS_KEY: Record<string, string> = {
  Available: 'sessionStatus.available',
  'Almost Full': 'sessionStatus.almostFull',
  'Fully Booked': 'sessionStatus.fullyBooked',
  'Booking Closed': 'sessionStatus.bookingClosed',
  Cancelled: 'sessionStatus.cancelled',
};

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

// ===== VSB V2: Who's Playing =====

export interface CourtPlayer {
  user_id?: string | null; // null for guests; seeds the stable VSB character
  display_name: string;
  booking_status: string;
  gender: Gender | null;
  playing_position: PlayingPosition | null;
  is_guest: boolean;
  avatar_url?: string | null; // generated VSB avatar thumbnail, when the player has one
}

// `session_player_roster` (player-identity migration) adds position, the
// companion flag and the avatar thumbnail. Falls back to the original
// `session_player_list` if it's unavailable, without those extras.
export async function fetchCourtRoster(sessionId: string): Promise<CourtPlayer[]> {
  const { data, error } = await supabase.rpc('session_player_roster', { p_session_id: sessionId });
  if (!error) {
    return ((data || []) as (Omit<CourtPlayer, 'avatar_url'> & { avatar_thumb_path: string | null })[]).map(({ avatar_thumb_path, ...p }) => ({
      ...p,
      avatar_url: avatarPublicUrl(avatar_thumb_path),
    }));
  }
  const v1 = await fetchSessionRoster(sessionId);
  return v1.map((p) => ({ ...p, playing_position: null, is_guest: false }));
}

export interface SessionExtras {
  roster: CourtPlayer[];
  isPrivate: boolean;
}

// Per-card extras for the sessions grid: who's already in (for the avatar row)
// and whether the session is passkey-gated. Signed-in only — both RPCs are for
// authenticated users.
export async function fetchSessionExtras(sessionIds: string[]): Promise<Record<string, SessionExtras>> {
  const entries = await Promise.all(
    sessionIds.map(async (id) => {
      const [roster, passkey] = await Promise.all([
        fetchCourtRoster(id),
        supabase.rpc('session_requires_passkey', { p_session_id: id }),
      ]);
      return [id, { roster, isPrivate: !!passkey.data }] as const;
    })
  );
  return Object.fromEntries(entries);
}

const MALAY_DAYS =['AHAD', 'ISNIN', 'SELASA', 'RABU', 'KHAMIS', 'JUMAAT', 'SABTU'];

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
