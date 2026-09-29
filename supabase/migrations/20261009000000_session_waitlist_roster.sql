/*
# Waiting list on the session roster

Players can see who is queued for a full session, in queue order, under
Who's Playing. Same public fields as session_player_roster (name, player art,
position, gender); no contact details, no user ids. Signed-in members only.
The waiting_list table itself stays own-rows-only under RLS.
*/

CREATE OR REPLACE FUNCTION public.session_waitlist_roster(p_session_id uuid)
RETURNS TABLE(queue_number integer, display_name text, gender gender, playing_position playing_position, avatar_thumb_path text, is_me boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    (row_number() OVER (ORDER BY wl.queue_position NULLS LAST, wl.created_at))::integer,
    COALESCE(NULLIF(p.short_name, ''), p.full_name),
    p.gender,
    p.playing_position,
    av.thumb_path,
    wl.user_id = auth.uid()
  FROM waiting_list wl
  JOIN profiles p ON p.id = wl.user_id
  LEFT JOIN player_avatars av ON av.user_id = p.id
  WHERE wl.session_id = p_session_id
    AND wl.status = 'Waiting'
    AND auth.uid() IS NOT NULL
  ORDER BY wl.queue_position NULLS LAST, wl.created_at;
$$;

REVOKE ALL ON FUNCTION public.session_waitlist_roster(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.session_waitlist_roster(uuid) TO authenticated;
