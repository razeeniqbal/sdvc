/*
# Your Game: self-described volleyball identity

Four optional answers a player gives about how they like to play. They are
the player's own description, never measured performance, and never used
for booking. Stored as stable machine values (the app translates them):

  game_vibe         competitive | balanced | just_for_fun
  playstyle         attacking | defensive | supportive | all_rounder
  experience_range  new | under_1 | 1_3 | 3_5 | 5_plus
  play_reasons      any of compete, improve, fitness, social, love_volleyball

Validated by CHECK constraints (no arbitrary client strings). Players edit
their own row through the existing profiles_update_own policy; the role
guard is unaffected. Additive: V1 ignores these columns.

community_players() also returns `playstyle` (one public tag); the other
answers stay on the player's own profile.
*/

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS game_vibe text,
  ADD COLUMN IF NOT EXISTS playstyle text,
  ADD COLUMN IF NOT EXISTS experience_range text,
  ADD COLUMN IF NOT EXISTS play_reasons text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_game_vibe_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_game_vibe_check
  CHECK (game_vibe IS NULL OR game_vibe IN ('competitive', 'balanced', 'just_for_fun'));
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_playstyle_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_playstyle_check
  CHECK (playstyle IS NULL OR playstyle IN ('attacking', 'defensive', 'supportive', 'all_rounder'));
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_experience_range_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_experience_range_check
  CHECK (experience_range IS NULL OR experience_range IN ('new', 'under_1', '1_3', '3_5', '5_plus'));
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_play_reasons_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_play_reasons_check
  CHECK (play_reasons <@ ARRAY['compete', 'improve', 'fitness', 'social', 'love_volleyball']::text[]);

-- Community: add the one public Your Game tag.
DROP FUNCTION IF EXISTS public.community_players();
CREATE FUNCTION public.community_players()
RETURNS TABLE (
  user_id uuid,
  display_name text,
  playing_position playing_position,
  skill_level skill_level,
  playstyle text,
  avatar_thumb_path text,
  games_played integer,
  member_since timestamptz,
  next_session_id uuid,
  next_session_title text,
  next_session_date date,
  is_me boolean
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH places AS (
    SELECT CASE WHEN b.is_guest THEN b.guest_user_id ELSE b.user_id END AS player_id, b.session_id, b.booking_status
    FROM bookings b
    WHERE NOT b.is_guest OR b.guest_user_id IS NOT NULL
  ),
  played AS (
    SELECT pl.player_id, count(DISTINCT pl.session_id)::integer AS n
    FROM places pl JOIN sessions s ON s.id = pl.session_id
    WHERE pl.booking_status IN ('Confirmed', 'Completed')
      AND s.session_date < (now() AT TIME ZONE 'Asia/Kuala_Lumpur')::date
    GROUP BY pl.player_id
  ),
  upcoming AS (
    SELECT DISTINCT ON (pl.player_id) pl.player_id, s.id, s.title, s.session_date
    FROM places pl JOIN sessions s ON s.id = pl.session_id
    WHERE pl.booking_status IN ('Pending Payment', 'Confirmed')
      AND s.session_date >= (now() AT TIME ZONE 'Asia/Kuala_Lumpur')::date
      AND s.status = 'Open'
      AND NOT EXISTS (SELECT 1 FROM session_passkeys k WHERE k.session_id = s.id)
    ORDER BY pl.player_id, s.session_date, s.start_time
  )
  SELECT
    p.id,
    COALESCE(NULLIF(p.short_name, ''), p.full_name),
    p.playing_position,
    p.skill_level,
    p.playstyle,
    av.thumb_path,
    COALESCE(pl.n, 0),
    p.created_at,
    u.id,
    u.title,
    u.session_date,
    p.id = auth.uid()
  FROM profiles p
  LEFT JOIN player_avatars av ON av.user_id = p.id
  LEFT JOIN played pl ON pl.player_id = p.id
  LEFT JOIN upcoming u ON u.player_id = p.id
  WHERE auth.uid() IS NOT NULL
    AND (p.show_in_community OR p.id = auth.uid())
  ORDER BY COALESCE(pl.n, 0) DESC, p.created_at;
$$;
REVOKE ALL ON FUNCTION public.community_players() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.community_players() TO authenticated;
