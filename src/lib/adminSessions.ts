import { supabase } from './supabase';
import type { Session } from '@/types/database';
import type { OpsTone } from '@/components/admin/AdminUI';

// Admin-side session data. Admins can read every booking under RLS, so counts
// come from one bookings query instead of the per-session RPC the player site uses.

export interface AdminSession extends Session {
  active_count: number; // players holding a place: pending + confirmed (+ completed, once attended)
  confirmed_count: number; // Confirmed, or Completed after attendance
  pending_count: number; // Pending Payment
}

// Statuses that hold a place in a session. 'Completed' is what a Confirmed
// booking becomes once attendance marks the player present.
export const PLACE_HOLDING = ['Pending Payment', 'Confirmed', 'Completed'];

// ownerId: organizer console, only their own sessions.
export async function fetchAdminSessions(ownerId: string | null = null): Promise<AdminSession[]> {
  const sessionsQuery = supabase.from('sessions').select('*').order('session_date', { ascending: true });
  const [{ data: sessions }, { data: active }] = await Promise.all([
    ownerId ? sessionsQuery.eq('created_by', ownerId) : sessionsQuery,
    supabase.from('bookings').select('session_id, booking_status').in('booking_status', PLACE_HOLDING),
  ]);
  const tally = new Map<string, { confirmed: number; pending: number }>();
  (active || []).forEach((b: { session_id: string; booking_status: string }) => {
    const t = tally.get(b.session_id) || { confirmed: 0, pending: 0 };
    if (b.booking_status === 'Pending Payment') t.pending++; else t.confirmed++;
    tally.set(b.session_id, t);
  });
  return ((sessions || []) as Session[]).map((s) => {
    const t = tally.get(s.id) || { confirmed: 0, pending: 0 };
    return { ...s, confirmed_count: t.confirmed, pending_count: t.pending, active_count: t.confirmed + t.pending };
  });
}

export function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Operational state derived from real fields only: the stored status, the date,
// and capacity. "Completed" = a past session that wasn't cancelled.
export type AdminSessionState = 'Open' | 'Almost full' | 'Full' | 'Closed' | 'Cancelled' | 'Completed';

export function adminSessionState(s: AdminSession, today = localToday()): AdminSessionState {
  if (s.status === 'Cancelled') return 'Cancelled';
  if (s.session_date < today) return 'Completed';
  if (s.status === 'Closed') return 'Closed';
  if (s.active_count >= s.maximum_capacity) return 'Full';
  if (s.active_count >= s.maximum_capacity * 0.8) return 'Almost full';
  return 'Open';
}

export const STATE_TONE: Record<AdminSessionState, OpsTone> = {
  Open: 'good',
  'Almost full': 'attention',
  Full: 'info',
  Closed: 'neutral',
  Cancelled: 'critical',
  Completed: 'neutral',
};
