/*
# VSB V2 — Who's Playing roster

Additive: a new SECURITY DEFINER read function for the V2 session roster /
court view. It returns the same rows as `session_player_list` (left untouched,
since the V1 UI and the Telegram roster text still depend on its shape) plus:

- `playing_position` — the account holder's own profile position, for the
  court-marker abbreviation (S / OH / OPP / MB / L / FLEX). Always NULL for
  non-account companions: they get a neutral guest marker, never an identity
  borrowed from the person who booked them.
- `is_guest` — so the UI can render companions as guests.

Exposes nothing new that is private: display name and gender were already
returned by `session_player_list`; position is volleyball-profile data. No
phone numbers, emails, or user ids.

Unlike `session_player_list`, EXECUTE is granted to `authenticated` only.
*/

CREATE OR REPLACE FUNCTION public.session_player_roster(p_session_id uuid)
RETURNS TABLE(
  display_name text,
  booking_status booking_status,
  gender gender,
  playing_position playing_position,
  is_guest boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    COALESCE(b.guest_name, p.short_name, p.full_name) AS display_name,
    b.booking_status,
    CASE WHEN b.is_guest THEN b.guest_gender ELSE p.gender END AS gender,
    CASE WHEN b.is_guest THEN NULL ELSE p.playing_position END AS playing_position,
    b.is_guest
  FROM bookings b
  JOIN profiles p ON p.id = b.user_id
  WHERE b.session_id = p_session_id
    AND b.booking_status IN ('Pending Payment', 'Confirmed')
  ORDER BY b.created_at ASC;
$$;

REVOKE EXECUTE ON FUNCTION public.session_player_roster(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.session_player_roster(uuid) TO authenticated;
