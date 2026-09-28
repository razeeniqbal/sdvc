/*
# Bring a registered member as your friend

A companion can now be a VSB member instead of a typed-in guest. The row stays
a companion booking owned by the booker (they pay; one receipt covers the
group; admins confirm the group as before; V1 sees an ordinary guest row), and
`guest_user_id` records WHICH member it is, so that member:
  - can read the booking and its attendance (My Games, stats)
  - appears in Who's Playing under their own name and avatar
  - gets a notification, and can remove themselves (leave_friend_booking)

Rules (enforced here, not in the app):
  - only members visible in Community can be picked (show_in_community)
  - not yourself, and not someone already holding a place in that session
  - guest name / gender are filled from the member's profile
*/

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS guest_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_guest_user_is_companion;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_guest_user_is_companion CHECK (guest_user_id IS NULL OR is_guest);
CREATE INDEX IF NOT EXISTS bookings_guest_user_id ON public.bookings (guest_user_id) WHERE guest_user_id IS NOT NULL;

-- The member can see the booking made for them, and its attendance mark.
DROP POLICY IF EXISTS bookings_select_linked_member ON public.bookings;
CREATE POLICY bookings_select_linked_member ON public.bookings
  FOR SELECT TO authenticated USING (guest_user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS attendance_select_linked_member ON public.attendance;
CREATE POLICY attendance_select_linked_member ON public.attendance
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM bookings b WHERE b.id = attendance.booking_id AND b.guest_user_id = (SELECT auth.uid())));

-- Validate + fill a member companion on insert (runs before the player guard).
CREATE OR REPLACE FUNCTION public.prepare_member_companion()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m profiles%ROWTYPE;
BEGIN
  IF NEW.guest_user_id IS NULL THEN RETURN NEW; END IF;
  IF NOT NEW.is_guest THEN
    RAISE EXCEPTION 'A member friend must be a companion booking' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.guest_user_id = NEW.user_id THEN
    RAISE EXCEPTION 'You can''t add yourself as your friend' USING ERRCODE = 'check_violation';
  END IF;
  SELECT * INTO m FROM profiles WHERE id = NEW.guest_user_id;
  IF NOT FOUND OR (NOT m.show_in_community AND NOT is_admin()) THEN
    RAISE EXCEPTION 'That player can''t be added' USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (
    SELECT 1 FROM bookings b
    WHERE b.session_id = NEW.session_id
      AND b.booking_status IN ('Pending Payment', 'Confirmed')
      AND ((b.user_id = NEW.guest_user_id AND NOT b.is_guest) OR b.guest_user_id = NEW.guest_user_id)
  ) THEN
    RAISE EXCEPTION 'That player is already in this game' USING ERRCODE = 'check_violation';
  END IF;
  NEW.guest_name := COALESCE(NULLIF(m.short_name, ''), m.full_name);
  NEW.guest_gender := m.gender;
  NEW.guest_phone := NULL; -- never copy a member's phone onto someone else's booking
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.prepare_member_companion() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS bookings_prepare_member_companion ON public.bookings;
CREATE TRIGGER bookings_prepare_member_companion
  BEFORE INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.prepare_member_companion();

-- Tell the member they were added.
CREATE OR REPLACE FUNCTION public.notify_member_companion()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.guest_user_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, booking_id, notification_type, title, message, delivery_channel, delivery_status, sent_at)
    SELECT NEW.guest_user_id, NEW.id, 'added_by_friend', 'You''re in a game',
           COALESCE(NULLIF(bp.short_name, ''), bp.full_name) || ' added you to "' || s.title || '". They handle the payment. You can remove yourself from the game page.',
           'in_app', 'Sent', now()
    FROM sessions s, profiles bp
    WHERE s.id = NEW.session_id AND bp.id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_member_companion() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS bookings_notify_member_companion ON public.bookings;
CREATE TRIGGER bookings_notify_member_companion
  AFTER INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.notify_member_companion();

-- The member removes themselves; the booker is told.
CREATE OR REPLACE FUNCTION public.leave_friend_booking(p_booking_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b bookings%ROWTYPE;
  v_name text;
  v_title text;
BEGIN
  SELECT * INTO b FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND OR b.guest_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Booking not found' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF b.booking_status NOT IN ('Pending Payment', 'Confirmed') THEN
    RAISE EXCEPTION 'You are not in this game any more';
  END IF;
  UPDATE bookings
  SET booking_status = 'Cancelled by Player', cancelled_at = now(),
      cancellation_reason = 'Removed by the player (added by a friend)'
  WHERE id = p_booking_id;

  SELECT COALESCE(NULLIF(short_name, ''), full_name) INTO v_name FROM profiles WHERE id = b.guest_user_id;
  SELECT title INTO v_title FROM sessions WHERE id = b.session_id;
  INSERT INTO notifications (user_id, booking_id, notification_type, title, message, delivery_channel, delivery_status, sent_at)
  VALUES (b.user_id, b.id, 'friend_left', 'Your friend left the game',
          v_name || ' removed themselves from "' || v_title || '".', 'in_app', 'Sent', now());
END;
$$;
REVOKE ALL ON FUNCTION public.leave_friend_booking(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leave_friend_booking(uuid) TO authenticated;

-- Who's Playing: a member friend shows as themselves.
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
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE WHEN b.is_guest THEN b.guest_user_id ELSE b.user_id END,
    CASE WHEN b.is_guest AND b.guest_user_id IS NULL THEN b.guest_name
         ELSE COALESCE(NULLIF(pm.short_name, ''), pm.full_name) END,
    b.booking_status,
    CASE WHEN b.is_guest AND b.guest_user_id IS NULL THEN b.guest_gender ELSE pm.gender END,
    CASE WHEN b.is_guest AND b.guest_user_id IS NULL THEN NULL ELSE pm.playing_position END,
    (b.is_guest AND b.guest_user_id IS NULL),
    CASE WHEN b.is_guest AND b.guest_user_id IS NULL THEN NULL ELSE av.thumb_path END
  FROM bookings b
  JOIN profiles pm ON pm.id = COALESCE(CASE WHEN b.is_guest THEN b.guest_user_id END, b.user_id)
  LEFT JOIN player_avatars av ON av.user_id = pm.id
  WHERE b.session_id = p_session_id
    AND b.booking_status IN ('Pending Payment', 'Confirmed')
  ORDER BY b.created_at ASC;
$$;
REVOKE ALL ON FUNCTION public.session_player_roster(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.session_player_roster(uuid) TO authenticated;

-- Community: games played / next game include places a friend booked.
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

-- The member's game page shows who added them (they can't read the booker's
-- profile directly). Only for their own linked booking; display name only.
CREATE OR REPLACE FUNCTION public.friend_booking_host(p_booking_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(NULLIF(p.short_name, ''), p.full_name)
  FROM bookings b JOIN profiles p ON p.id = b.user_id
  WHERE b.id = p_booking_id AND b.guest_user_id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.friend_booking_host(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.friend_booking_host(uuid) TO authenticated;
