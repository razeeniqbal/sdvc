// Club booking rules shared by checkout and booking details.

// Each player may bring at most this many extra people (companions) to a
// session. Also enforced by a database trigger once V2 launches (see
// supabase/launch/v2_launch_rules.sql), so it can't be bypassed from the client.
export const MAX_COMPANIONS = 1;

// Statuses in which a companion still holds a place.
export const ACTIVE_BOOKING_STATUSES = ['Pending Payment', 'Confirmed'];
