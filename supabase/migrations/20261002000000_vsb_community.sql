/*
# Community

- `profiles.show_in_community` (default on, per club decision): a player can
  hide themselves from the Community page in My VSB. Players already update
  their own profile row, and the role guard doesn't touch this column.
- `community_players()`: signed-in members only. Returns public fields only —
  name, avatar, position, level, games played, member since, next public game.
  Never email, phone, gender, emergency contacts or role.
- `session_player_roster()` now also returns the player's user id (NULL for
  guests) so the app can give everyone a stable VSB character everywhere. Ids
  are already visible in avatar image paths; they grant no access.

Additive: V1 uses neither function.
*/

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS show_in_community boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.community_players()
RETURNS TABLE (
  user_id uuid,
  display_name text,
  playing_position playing_position,
  skill_level skill_level,
  avatar_thumb_path text,
  games_played integer,
  member_since timestamptz,
  next_session_id uuid,
  next_session_title text,
  next_session_date date,
  is_me boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH played AS (
    SELECT b.user_id, count(DISTINCT b.session_id)::integer AS n
    FROM bookings b
    JOIN sessions s ON s.id = b.session_id
    WHERE NOT b.is_guest
      AND b.booking_status IN ('Confirmed', 'Completed')
      AND s.session_date < (now() AT TIME ZONE 'Asia/Kuala_Lumpur')::date
    GROUP BY b.user_id
  ),
  upcoming AS (
    SELECT DISTINCT ON (b.user_id) b.user_id, s.id, s.title, s.session_date
    FROM bookings b
    JOIN sessions s ON s.id = b.session_id
    WHERE NOT b.is_guest
      AND b.booking_status IN ('Pending Payment', 'Confirmed')
      AND s.session_date >= (now() AT TIME ZONE 'Asia/Kuala_Lumpur')::date
      AND s.status = 'Open'
      -- private (passkey) games are not advertised
      AND NOT EXISTS (SELECT 1 FROM session_passkeys k WHERE k.session_id = s.id)
    ORDER BY b.user_id, s.session_date, s.start_time
  )
  SELECT
    p.id,
    COALESCE(NULLIF(p.short_name, ''), p.full_name),
    p.playing_position,
    p.skill_level,
    av.thumb_path,
    COALESCE(pl.n, 0),
    p.created_at,
    u.id,
    u.title,
    u.session_date,
    p.id = auth.uid()
  FROM profiles p
  LEFT JOIN player_avatars av ON av.user_id = p.id
  LEFT JOIN played pl ON pl.user_id = p.id
  LEFT JOIN upcoming u ON u.user_id = p.id
  WHERE auth.uid() IS NOT NULL
    AND (p.show_in_community OR p.id = auth.uid())
  ORDER BY COALESCE(pl.n, 0) DESC, p.created_at;
$$;

REVOKE ALL ON FUNCTION public.community_players() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.community_players() TO authenticated;

-- Roster: same rows as before plus user_id.
DROP FUNCTION IF EXISTS public.session_player_roster(uuid);
CREATE FUNCTION public.session_player_roster(p_session_id uuid)
RETURNS TABLE (
  user_id uuid,
  display_name text,
  booking_status booking_status,
  gender gender,
  playing_position playing_position,
  is_guest boolean,
  avatar_thumb_path text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE WHEN b.is_guest THEN NULL ELSE b.user_id END,
    COALESCE(b.guest_name, p.short_name, p.full_name),
    b.booking_status,
    CASE WHEN b.is_guest THEN b.guest_gender ELSE p.gender END,
    CASE WHEN b.is_guest THEN NULL ELSE p.playing_position END,
    b.is_guest,
    CASE WHEN b.is_guest THEN NULL ELSE av.thumb_path END
  FROM bookings b
  JOIN profiles p ON p.id = b.user_id
  LEFT JOIN player_avatars av ON av.user_id = b.user_id
  WHERE b.session_id = p_session_id
    AND b.booking_status IN ('Pending Payment', 'Confirmed')
  ORDER BY b.created_at ASC;
$$;

REVOKE ALL ON FUNCTION public.session_player_roster(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.session_player_roster(uuid) TO authenticated;
