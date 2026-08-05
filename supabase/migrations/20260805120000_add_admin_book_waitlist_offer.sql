-- Lets an admin create a booking on behalf of a waitlisted player (used when offering
-- a freed-up slot) without broadening the general bookings INSERT policy, which only
-- allows auth.uid() = user_id. SECURITY DEFINER + an explicit is_admin() check keeps
-- this narrowly scoped to exactly this one admin action.
CREATE OR REPLACE FUNCTION public.admin_book_waitlist_offer(p_entry_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_entry waiting_list%ROWTYPE;
  v_session sessions%ROWTYPE;
  v_confirmed_count integer;
  v_booking_id uuid;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only admins can do this';
  END IF;

  SELECT * INTO v_entry FROM waiting_list WHERE id = p_entry_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Waiting list entry not found';
  END IF;
  IF v_entry.status <> 'Waiting' THEN
    RAISE EXCEPTION 'This entry is not waiting (status: %)', v_entry.status;
  END IF;

  SELECT * INTO v_session FROM sessions WHERE id = v_entry.session_id;

  -- Re-check capacity server-side rather than trusting the admin UI's last-loaded
  -- count, since another booking could have landed in the meantime.
  SELECT confirmed_booking_count(v_session.id) INTO v_confirmed_count;
  IF v_confirmed_count >= v_session.maximum_capacity THEN
    RAISE EXCEPTION 'Session is already full';
  END IF;

  INSERT INTO bookings (
    user_id, session_id, booking_status, payment_status,
    subtotal, processing_fee, discount_amount, total_amount,
    is_guest, guest_name, guest_phone, guest_gender, booking_group_id
  ) VALUES (
    v_entry.user_id, v_session.id, 'Pending Payment', 'Manual Payment Pending Verification',
    v_session.price, 0, 0, v_session.price,
    false, NULL, NULL, NULL, NULL
  ) RETURNING id INTO v_booking_id;

  UPDATE waiting_list SET status = 'Booked' WHERE id = p_entry_id;

  RETURN v_booking_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_book_waitlist_offer(uuid) TO authenticated;
