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

  const sessionIds = sessions.map((s) => s.id);

  const { data: counts, error: countError } = await supabase.rpc('confirmed_booking_count', {
    p_session_id: null as any,
  });

  // RPC with single param doesn't support arrays, so query bookings directly
  const { data: bookings, error: bookingsError } = await supabase
    .from('bookings')
    .select('session_id, booking_status')
    .in('session_id', sessionIds)
    .in('booking_status', ['Pending Payment', 'Confirmed']);

  if (bookingsError) throw bookingsError;

  const countMap = new Map<string, number>();
  (bookings || []).forEach((b) => {
    countMap.set(b.session_id, (countMap.get(b.session_id) || 0) + 1);
  });

  return sessions.map((s) => ({
    ...s,
    confirmed_count: countMap.get(s.id) || 0,
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
