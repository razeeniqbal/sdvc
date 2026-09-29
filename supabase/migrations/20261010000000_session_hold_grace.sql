/*
# Per-session hold grace

sessions.hold_grace: when true, unpaid bookings in that session are held
until 2 hours before the game instead of 12 hours from booking (still at
least 30 minutes). Used for the first session after the 12-hour rule went
live (Sun-Thai, 4 Oct 2026), when players hadn't heard about it yet.

Additive: V1 ignores the column. booking_hold_deadline() is the only rule
that reads it, so the release job and triggers need no change.
*/

ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS hold_grace boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.booking_hold_deadline(p_session_id uuid)
RETURNS timestamp with time zone
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT GREATEST(
           CASE WHEN s.hold_grace
                THEN ((s.session_date + s.start_time) AT TIME ZONE 'Asia/Kuala_Lumpur') - interval '2 hours'
                ELSE LEAST(now() + interval '12 hours',
                           ((s.session_date + s.start_time) AT TIME ZONE 'Asia/Kuala_Lumpur') - interval '2 hours')
           END,
           now() + interval '30 minutes')
  FROM sessions s WHERE s.id = p_session_id;
$$;
