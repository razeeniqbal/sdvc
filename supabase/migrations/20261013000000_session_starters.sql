/*
# Starting players (admin / organizer adds members to a session)

add_session_starters(session, user_ids[]): books members straight in as
Confirmed places with no payment (RM0, marked Paid so they never show as
owing and are never released by the hold job). For core players, coaches or
people who settle with the admin separately.

- Admins: any session. Organizers: only sessions they created.
- Skips members who already hold a place; refuses to go over capacity.
- Takes them off that session's waiting list if they were queued.
- Each member gets an in-app notification.
Returns how many places were added.
*/

CREATE OR REPLACE FUNCTION public.add_session_starters(p_session_id uuid, p_user_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_session sessions%ROWTYPE;
  v_ids uuid[];
  v_free integer;
  v_added integer := 0;
  v_uid uuid;
BEGIN
  SELECT * INTO v_session FROM sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session not found'; END IF;
  IF NOT (is_admin() OR (is_organizer() AND v_session.created_by = auth.uid())) THEN
    RAISE EXCEPTION 'Only admins or this session''s organizer can add players' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Real members only, each once, not already holding a place in this session.
  SELECT coalesce(array_agg(DISTINCT p.id), '{}') INTO v_ids
  FROM profiles p
  WHERE p.id = ANY(p_user_ids)
    AND NOT EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.session_id = p_session_id AND b.booking_status IN ('Pending Payment', 'Confirmed')
        AND ((NOT b.is_guest AND b.user_id = p.id) OR b.guest_user_id = p.id));

  v_free := v_session.maximum_capacity - confirmed_booking_count(p_session_id);
  IF cardinality(v_ids) > v_free THEN
    RAISE EXCEPTION 'Only % place(s) left in this session', greatest(v_free, 0);
  END IF;

  FOREACH v_uid IN ARRAY v_ids LOOP
    INSERT INTO bookings (user_id, session_id, booking_status, payment_status,
                          subtotal, processing_fee, discount_amount, total_amount, is_guest, admin_notes)
    VALUES (v_uid, p_session_id, 'Confirmed', 'Paid', 0, 0, 0, 0, false, 'Starter: added by the organizer, no payment');

    UPDATE waiting_list SET status = 'Booked'
    WHERE session_id = p_session_id AND user_id = v_uid AND status = 'Waiting';

    INSERT INTO notifications (user_id, notification_type, title, message, delivery_channel, delivery_status, sent_at)
    VALUES (v_uid, 'starter_added', 'You''re in the lineup',
            'You were added to "' || v_session.title || '" on ' || to_char(v_session.session_date, 'DD Mon') || '. Your place is confirmed.',
            'in_app', 'Sent', now());
    v_added := v_added + 1;
  END LOOP;

  RETURN v_added;
END;
$$;

REVOKE ALL ON FUNCTION public.add_session_starters(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_session_starters(uuid, uuid[]) TO authenticated;
