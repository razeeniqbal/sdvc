import { useAuth } from '@/context/AuthContext';
import { ADMIN_BOOKING_SELECT } from './adminBookings';

// The console (/admin) serves two roles:
//   admin     → the whole club
//   organizer → only the sessions they created
// The database enforces the organizer limit (RLS: owns_session). These helpers
// keep the screens tidy on top of that, e.g. an organizer's own bookings as a
// player in someone else's game don't show up in their console.

export interface ConsoleScope {
  isAdmin: boolean;
  isOrganizer: boolean;
  /** Set for organizers: only sessions with created_by = ownerId. */
  ownerId: string | null;
  /** Booking select for console lists (inner-joins the session when scoped). */
  bookingSelect: string;
}

export function useConsoleScope(): ConsoleScope {
  const { profile } = useAuth();
  const isOrganizer = profile?.role === 'organizer';
  const ownerId = isOrganizer ? profile!.id : null;
  return {
    isAdmin: profile?.role === 'admin',
    isOrganizer,
    ownerId,
    bookingSelect: ownerId ? ADMIN_BOOKING_SELECT.replace('session:sessions(', 'session:sessions!inner(') : ADMIN_BOOKING_SELECT,
  };
}

// Limit a bookings query (selected with scope.bookingSelect or an inner-joined
// session) to the organizer's own sessions. No-op for admins.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function scopeBookings<Q extends { eq: (col: string, v: string) => any }>(q: Q, ownerId: string | null): Q {
  return ownerId ? q.eq('session.created_by', ownerId) : q;
}

// Limit a sessions query to the organizer's own sessions. No-op for admins.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function scopeSessions<Q extends { eq: (col: string, v: string) => any }>(q: Q, ownerId: string | null): Q {
  return ownerId ? q.eq('created_by', ownerId) : q;
}
