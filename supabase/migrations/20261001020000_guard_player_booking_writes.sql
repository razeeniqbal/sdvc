/*
# Players can only make the booking changes the app offers

RLS lets players insert/update their own bookings and waiting-list rows and
insert payments for their own bookings, but it doesn't limit *what* they
write. From the browser console a player could mark their own booking
Confirmed/Paid, change the price, or put themselves first in the queue.

For direct requests from non-admin app users (`anon` / `authenticated`), these
triggers allow only what the V1 and V2 apps actually do:

bookings, new row   → 'Pending Payment', not paid, at the session price
bookings, change    → receipt upload, linking to a friend group (once),
                      cancelling (→ 'Cancelled by Player')
waiting_list        → join at the back of the queue; leave (→ 'Cancelled')
payments            → admins only (players never create payments)

Admins, SECURITY DEFINER functions and service-role edge functions (Telegram
approve/reject) are not affected.
*/

CREATE OR REPLACE FUNCTION public.guard_player_booking()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  n bookings%ROWTYPE;
  v_price numeric;
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') OR is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.booking_status <> 'Pending Payment'
       OR NEW.payment_status NOT IN ('Pending', 'Manual Payment Pending Verification') THEN
      RAISE EXCEPTION 'New bookings start as Pending Payment' USING ERRCODE = 'insufficient_privilege';
    END IF;
    SELECT price INTO v_price FROM sessions WHERE id = NEW.session_id;
    NEW.subtotal := v_price;
    NEW.total_amount := v_price;
    NEW.processing_fee := 0;
    NEW.discount_amount := 0;
    NEW.admin_notes := NULL;
    NEW.cancelled_at := NULL;
    NEW.cancellation_reason := NULL;
    RETURN NEW;
  END IF;

  -- UPDATE: blank out the fields a player may change, then nothing else may differ.
  n := NEW;
  n.receipt_path := OLD.receipt_path;
  n.receipt_uploaded_at := OLD.receipt_uploaded_at;
  n.updated_at := OLD.updated_at;
  IF OLD.booking_group_id IS NULL THEN
    n.booking_group_id := OLD.booking_group_id;
  END IF;
  IF NEW.booking_status IS DISTINCT FROM OLD.booking_status THEN
    IF NEW.booking_status <> 'Cancelled by Player'
       OR OLD.booking_status NOT IN ('Pending Payment', 'Confirmed') THEN
      RAISE EXCEPTION 'Players can only cancel their booking' USING ERRCODE = 'insufficient_privilege';
    END IF;
    n.booking_status := OLD.booking_status;
    n.cancelled_at := OLD.cancelled_at;
    n.cancellation_reason := OLD.cancellation_reason;
    -- The app marks a paid booking cancelled in time as due for refund.
    IF NEW.payment_status = 'Refunded' AND OLD.payment_status = 'Paid' THEN
      n.payment_status := OLD.payment_status;
    END IF;
  END IF;

  IF n IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'That booking change needs an admin' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

-- Next place in a session's queue. Needs to see everyone's rows, which the
-- player's own RLS view doesn't.
CREATE OR REPLACE FUNCTION public.next_waitlist_position(p_session_id uuid)
RETURNS integer
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(max(queue_position), 0) + 1 FROM waiting_list WHERE session_id = p_session_id;
$$;

CREATE OR REPLACE FUNCTION public.guard_player_waitlist()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  n waiting_list%ROWTYPE;
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') OR is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.status := 'Waiting';
    NEW.offer_expires_at := NULL;
    NEW.queue_position := next_waitlist_position(NEW.session_id);
    RETURN NEW;
  END IF;

  n := NEW;
  n.updated_at := OLD.updated_at;
  IF NEW.status = 'Cancelled' THEN
    n.status := OLD.status;
  END IF;
  IF n IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'Players can only leave the waiting list' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_player_booking() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_player_waitlist() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.next_waitlist_position(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_waitlist_position(uuid) TO authenticated;

DROP TRIGGER IF EXISTS bookings_guard_player ON public.bookings;
CREATE TRIGGER bookings_guard_player
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.guard_player_booking();

DROP TRIGGER IF EXISTS waiting_list_guard_player ON public.waiting_list;
CREATE TRIGGER waiting_list_guard_player
  BEFORE INSERT OR UPDATE ON public.waiting_list
  FOR EACH ROW EXECUTE FUNCTION public.guard_player_waitlist();

-- Players never create payments; admins (and service-role functions) do.
DROP POLICY IF EXISTS payments_insert_own_or_admin ON public.payments;
DROP POLICY IF EXISTS payments_insert_admin ON public.payments;
CREATE POLICY payments_insert_admin ON public.payments
  FOR INSERT TO authenticated
  WITH CHECK (is_admin());
