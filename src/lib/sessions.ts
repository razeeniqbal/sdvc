import { supabase } from './supabase';
import type { Session } from '@/types/database';

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
