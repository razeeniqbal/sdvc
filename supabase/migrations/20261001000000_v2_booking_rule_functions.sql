/*
# V2 booking rule functions (inert)

Defines the functions behind the 12-hour hold, the automatic waiting list and
the 1-friend limit. Nothing calls them yet: the triggers and the cron job that
switch them on are in supabase/launch/v2_launch_rules.sql and only run at V2
launch, because the live V1 app shares this database.

process_booking_holds() is not callable by app users (service/cron only).
*/

CREATE OR REPLACE FUNCTION public.booking_hold_deadline(p_session_id uuid)
RETURNS timestamptz
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT GREATEST(
           LEAST(now() + interval '12 hours',
                 ((s.session_date + s.start_time) AT TIME ZONE 'Asia/Kuala_Lumpur') - interval '2 hours'),
           now() + interval '30 minutes')
  FROM sessions s WHERE s.id = p_session_id;
$$;

CREATE OR REPLACE FUNCTION public.set_booking_hold()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Server decides the deadline; whatever the client sent is ignored.
  IF NEW.booking_status = 'Pending Payment' AND NEW.payment_status <> 'Paid' THEN
    NEW.reserved_until := booking_hold_deadline(NEW.session_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_companion_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF NOT NEW.is_guest OR NEW.booking_group_id IS NULL OR is_admin() THEN
    RETURN NEW;
  END IF;
  SELECT count(*) INTO v_count
  FROM bookings
  WHERE booking_group_id = NEW.booking_group_id
    AND is_guest
    AND booking_status IN ('Pending Payment', 'Confirmed');
  IF v_count >= 1 THEN
    RAISE EXCEPTION 'You can bring 1 friend per booking' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_booking_holds()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_released integer := 0;
  v_promoted integer := 0;
  r record;
  s record;
  w record;
  v_free integer;
  v_booking_id uuid;
BEGIN
  -- One run at a time (cron overlap / manual call).
  IF NOT pg_try_advisory_xact_lock(hashtext('vsb.process_booking_holds')) THEN
    RETURN jsonb_build_object('skipped', true);
  END IF;

  -- 1) Release unpaid bookings whose hold has run out and who sent no receipt.
  FOR r IN
    UPDATE bookings b
    SET booking_status = 'Cancelled by Admin',
        payment_status = 'Cancelled',
        cancelled_at = now(),
        cancellation_reason = 'Released automatically: payment not received within the hold time'
    WHERE b.booking_status = 'Pending Payment'
      AND b.payment_status <> 'Paid'
      AND b.receipt_path IS NULL
      AND b.reserved_until IS NOT NULL
      AND b.reserved_until < now()
      -- Games already played are left for the admin (they may have been paid in cash).
      AND EXISTS (
        SELECT 1 FROM sessions se
        WHERE se.id = b.session_id
          AND ((se.session_date + se.start_time) AT TIME ZONE 'Asia/Kuala_Lumpur') > now()
      )
    RETURNING b.id, b.user_id, b.is_guest, b.session_id
  LOOP
    v_released := v_released + 1;
    IF NOT r.is_guest THEN
      INSERT INTO notifications (user_id, booking_id, notification_type, title, message, delivery_channel, delivery_status, sent_at)
      SELECT r.user_id, r.id, 'booking_released', 'Booking released',
             'Your place for "' || se.title || '" was released because payment wasn''t received in time. Book again if places are still open.',
             'in_app', 'Sent', now()
      FROM sessions se WHERE se.id = r.session_id;
    END IF;
  END LOOP;

  -- 2) Fill free places from the waiting list, oldest first, for upcoming open games.
  FOR s IN
    SELECT se.id, se.title, se.maximum_capacity, se.price
    FROM sessions se
    WHERE se.status = 'Open'
      AND ((se.session_date + se.start_time) AT TIME ZONE 'Asia/Kuala_Lumpur') > now() + interval '30 minutes'
      AND EXISTS (SELECT 1 FROM waiting_list wl WHERE wl.session_id = se.id AND wl.status = 'Waiting')
    FOR UPDATE
  LOOP
    v_free := s.maximum_capacity - confirmed_booking_count(s.id);
    FOR w IN
      SELECT wl.id, wl.user_id
      FROM waiting_list wl
      WHERE wl.session_id = s.id AND wl.status = 'Waiting'
      ORDER BY wl.queue_position NULLS LAST, wl.created_at
      FOR UPDATE SKIP LOCKED
    LOOP
      EXIT WHEN v_free <= 0;

      -- Already holding a place (booked directly after joining the list)?
      IF EXISTS (
        SELECT 1 FROM bookings b
        WHERE b.session_id = s.id AND b.user_id = w.user_id AND NOT b.is_guest
          AND b.booking_status IN ('Pending Payment', 'Confirmed')
      ) THEN
        UPDATE waiting_list SET status = 'Booked' WHERE id = w.id;
        CONTINUE;
      END IF;

      INSERT INTO bookings (
        user_id, session_id, booking_status, payment_status,
        subtotal, processing_fee, discount_amount, total_amount, is_guest
      ) VALUES (
        w.user_id, s.id, 'Pending Payment', 'Manual Payment Pending Verification',
        s.price, 0, 0, s.price, false
      ) RETURNING id INTO v_booking_id;

      UPDATE waiting_list SET status = 'Booked' WHERE id = w.id;

      INSERT INTO notifications (user_id, booking_id, notification_type, title, message, delivery_channel, delivery_status, sent_at)
      VALUES (w.user_id, v_booking_id, 'waitlist_promoted', 'You''re in!',
              'A place opened up for "' || s.title || '" and it''s yours. Pay and upload your receipt before the hold runs out.',
              'in_app', 'Sent', now());

      v_free := v_free - 1;
      v_promoted := v_promoted + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('released', v_released, 'promoted', v_promoted);
END;
$$;

REVOKE ALL ON FUNCTION public.process_booking_holds() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.booking_hold_deadline(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.booking_hold_deadline(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.enforce_companion_limit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_booking_hold() FROM PUBLIC, anon, authenticated;
