/*
# Organizer role (2/2)

Members can apply to organize games; an admin approves. An organizer runs
ONLY the sessions they created (sessions.created_by):
  sessions (create / edit / delete while empty), passkeys, bookings, payment
  verification, attendance, waiting list, and the contact details of the
  players booked on those sessions.
Never: club settings, other organizers' games, the full player list, roles.

Everything is additive: new tables, new functions, and extra policies that
are OR'ed with the existing ones. Existing admin/player access is unchanged.

Ownership = the session was created by the caller AND the caller is currently
an organizer (demoting someone removes their access immediately).
*/

-- --------------------------------------------------------------- helpers ---
CREATE OR REPLACE FUNCTION public.is_organizer()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'organizer');
$$;

CREATE OR REPLACE FUNCTION public.owns_session(p_session_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM sessions s JOIN profiles p ON p.id = auth.uid()
    WHERE s.id = p_session_id AND s.created_by = auth.uid() AND p.role = 'organizer'
  );
$$;

REVOKE ALL ON FUNCTION public.is_organizer() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owns_session(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_organizer() TO authenticated;
GRANT EXECUTE ON FUNCTION public.owns_session(uuid) TO authenticated;

-- ---------------------------------------------------------- applications ---
CREATE TABLE IF NOT EXISTS public.organizer_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message text NOT NULL DEFAULT '' CHECK (char_length(message) <= 1000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS organizer_applications_one_pending
  ON public.organizer_applications (user_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS organizer_applications_status ON public.organizer_applications (status, created_at);

ALTER TABLE public.organizer_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY organizer_applications_insert_own ON public.organizer_applications
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()) AND status = 'pending' AND reviewed_by IS NULL AND reviewed_at IS NULL);
CREATE POLICY organizer_applications_select_own_or_admin ON public.organizer_applications
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR is_admin());
-- Decisions go through review_organizer_application(); no direct updates.

CREATE OR REPLACE FUNCTION public.review_organizer_application(p_id uuid, p_approve boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app organizer_applications%ROWTYPE;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only admins can review organizer applications' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO v_app FROM organizer_applications WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Application not found'; END IF;
  IF v_app.status <> 'pending' THEN RAISE EXCEPTION 'This application was already reviewed'; END IF;

  UPDATE organizer_applications
  SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
      reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = p_id;

  IF p_approve THEN
    -- never demote an admin by approving them as organizer
    UPDATE profiles SET role = 'organizer' WHERE id = v_app.user_id AND role = 'player';
  END IF;

  INSERT INTO notifications (user_id, notification_type, title, message, delivery_channel, delivery_status, sent_at)
  VALUES (
    v_app.user_id,
    CASE WHEN p_approve THEN 'organizer_approved' ELSE 'organizer_rejected' END,
    CASE WHEN p_approve THEN 'You''re an organizer' ELSE 'Organizer application' END,
    CASE WHEN p_approve
      THEN 'Your organizer application was approved. Open the Organizer Console from your menu to set your payment QR and create your first game.'
      ELSE 'Your organizer application was not approved this time. Contact the club if you have questions.' END,
    'in_app', 'Sent', now()
  );
END;
$$;
REVOKE ALL ON FUNCTION public.review_organizer_application(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_organizer_application(uuid, boolean) TO authenticated;

-- ------------------------------------------------------ payment profiles ---
-- Shown to players who pay for this organizer's games.
CREATE TABLE IF NOT EXISTS public.organizer_payment_profiles (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  qr_path text,
  bank_name text CHECK (char_length(bank_name) <= 100),
  account_name text CHECK (char_length(account_name) <= 100),
  account_number text CHECK (char_length(account_number) <= 40),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.organizer_payment_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY organizer_payment_select_own_or_admin ON public.organizer_payment_profiles
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()) OR is_admin());
CREATE POLICY organizer_payment_insert_own ON public.organizer_payment_profiles
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()) AND is_organizer());
CREATE POLICY organizer_payment_update_own ON public.organizer_payment_profiles
  FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid()) AND is_organizer())
  WITH CHECK (user_id = (SELECT auth.uid()) AND is_organizer());

-- Where to pay for a session: the organizer's details when the session is
-- theirs and they've set a QR, otherwise nothing (the app uses the club QR).
CREATE OR REPLACE FUNCTION public.session_payment_details(p_session_id uuid)
RETURNS TABLE (qr_path text, bank_name text, account_name text, account_number text, organizer_name text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pp.qr_path, pp.bank_name, pp.account_name, pp.account_number,
         COALESCE(NULLIF(p.short_name, ''), p.full_name)
  FROM sessions s
  JOIN profiles p ON p.id = s.created_by AND p.role = 'organizer'
  JOIN organizer_payment_profiles pp ON pp.user_id = p.id AND pp.qr_path IS NOT NULL
  WHERE s.id = p_session_id AND auth.uid() IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.session_payment_details(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.session_payment_details(uuid) TO authenticated;

-- ------------------------------------------------------------- sessions ---
CREATE POLICY sessions_insert_organizer ON public.sessions
  FOR INSERT TO authenticated
  WITH CHECK (is_organizer() AND created_by = (SELECT auth.uid()));
CREATE POLICY sessions_update_organizer ON public.sessions
  FOR UPDATE TO authenticated
  USING (owns_session(id))
  WITH CHECK (created_by = (SELECT auth.uid()));
-- Delete only while nobody has booked; otherwise cancel instead.
CREATE POLICY sessions_delete_organizer ON public.sessions
  FOR DELETE TO authenticated
  USING (owns_session(id) AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.session_id = sessions.id));

CREATE POLICY session_passkeys_organizer ON public.session_passkeys
  FOR ALL TO authenticated
  USING (owns_session(session_id)) WITH CHECK (owns_session(session_id));

-- ------------------------------------------------------------- bookings ---
CREATE POLICY bookings_select_organizer ON public.bookings
  FOR SELECT TO authenticated USING (owns_session(session_id));
CREATE POLICY bookings_update_organizer ON public.bookings
  FOR UPDATE TO authenticated USING (owns_session(session_id)) WITH CHECK (owns_session(session_id));

-- Players booked on an organizer's games (name, phone, emergency contact for
-- running the game). Not the full member list.
CREATE POLICY profiles_select_organizer_players ON public.profiles
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM bookings b WHERE b.user_id = profiles.id AND owns_session(b.session_id)));

CREATE POLICY payments_select_organizer ON public.payments
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM bookings b WHERE b.id = payments.booking_id AND owns_session(b.session_id)));
CREATE POLICY payments_insert_organizer ON public.payments
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM bookings b WHERE b.id = payments.booking_id AND owns_session(b.session_id)));
CREATE POLICY payments_update_organizer ON public.payments
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM bookings b WHERE b.id = payments.booking_id AND owns_session(b.session_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM bookings b WHERE b.id = payments.booking_id AND owns_session(b.session_id)));

CREATE POLICY attendance_select_organizer ON public.attendance
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM bookings b WHERE b.id = attendance.booking_id AND owns_session(b.session_id)));
CREATE POLICY attendance_insert_organizer ON public.attendance
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM bookings b WHERE b.id = attendance.booking_id AND owns_session(b.session_id)));
CREATE POLICY attendance_update_organizer ON public.attendance
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM bookings b WHERE b.id = attendance.booking_id AND owns_session(b.session_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM bookings b WHERE b.id = attendance.booking_id AND owns_session(b.session_id)));

CREATE POLICY waitlist_select_organizer ON public.waiting_list
  FOR SELECT TO authenticated USING (owns_session(session_id));
CREATE POLICY waitlist_update_organizer ON public.waiting_list
  FOR UPDATE TO authenticated USING (owns_session(session_id)) WITH CHECK (owns_session(session_id));
CREATE POLICY waitlist_delete_organizer ON public.waiting_list
  FOR DELETE TO authenticated USING (owns_session(session_id));

-- In-app notices to players about bookings on the organizer's games.
CREATE POLICY notifications_insert_organizer ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM bookings b
    WHERE b.id = notifications.booking_id AND b.user_id = notifications.user_id AND owns_session(b.session_id)
  ));

-- --------------------------------------------------------------- storage ---
-- Organizer files live under club-assets/organizers/{uid}/ (session photos, QR).
CREATE POLICY club_assets_organizer_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'club-assets' AND (storage.foldername(name))[1] = 'organizers'
              AND (storage.foldername(name))[2] = (SELECT auth.uid())::text AND is_organizer());
CREATE POLICY club_assets_organizer_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'club-assets' AND (storage.foldername(name))[1] = 'organizers'
         AND (storage.foldername(name))[2] = (SELECT auth.uid())::text AND is_organizer());
CREATE POLICY club_assets_organizer_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'club-assets' AND (storage.foldername(name))[1] = 'organizers'
         AND (storage.foldername(name))[2] = (SELECT auth.uid())::text AND is_organizer());
-- Receipts for bookings on their games: payment-receipts/{player}/{booking}/file
CREATE POLICY receipts_organizer_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'payment-receipts' AND EXISTS (
    SELECT 1 FROM bookings b WHERE b.id::text = (storage.foldername(name))[2] AND owns_session(b.session_id)));

-- ------------------------------------------ guards: owners act like admins ---
-- The player-write guards (20261001020000) let admins through; session owners
-- need the same for bookings / waiting list on their own games.
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
  IF TG_OP = 'UPDATE' AND owns_session(OLD.session_id) AND owns_session(NEW.session_id) THEN
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
  IF TG_OP = 'UPDATE' AND owns_session(OLD.session_id) AND owns_session(NEW.session_id) THEN
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

-- Session owners can book a waiting-list player into their game.
CREATE OR REPLACE FUNCTION public.admin_book_waitlist_offer(p_entry_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry waiting_list%ROWTYPE;
  v_session sessions%ROWTYPE;
  v_confirmed_count integer;
  v_booking_id uuid;
BEGIN
  SELECT * INTO v_entry FROM waiting_list WHERE id = p_entry_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Waiting list entry not found';
  END IF;
  IF NOT (is_admin() OR owns_session(v_entry.session_id)) THEN
    RAISE EXCEPTION 'Only admins or this game''s organizer can do this';
  END IF;
  IF v_entry.status <> 'Waiting' THEN
    RAISE EXCEPTION 'This entry is not waiting (status: %)', v_entry.status;
  END IF;

  SELECT * INTO v_session FROM sessions WHERE id = v_entry.session_id;

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
$$;
