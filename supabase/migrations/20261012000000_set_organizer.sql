/*
# Make / remove organizer directly (admin)

set_organizer(p_user_id, p_make): an admin turns a player into an organizer
(or back into a player) without an application. Only player <-> organizer;
admin accounts are never touched here (Club Settings -> Admins handles those).
The member gets an in-app notification either way.
*/

CREATE OR REPLACE FUNCTION public.set_organizer(p_user_id uuid, p_make boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_role user_role;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only admins can change organizers' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT role INTO v_role FROM profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Player not found'; END IF;
  IF v_role = 'admin' THEN RAISE EXCEPTION 'Admins are managed in Club Settings'; END IF;

  UPDATE profiles SET role = CASE WHEN p_make THEN 'organizer'::user_role ELSE 'player'::user_role END
  WHERE id = p_user_id;

  -- A pending application is settled by this decision.
  UPDATE organizer_applications
  SET status = CASE WHEN p_make THEN 'approved' ELSE 'rejected' END, reviewed_by = auth.uid(), reviewed_at = now()
  WHERE user_id = p_user_id AND status = 'pending';

  INSERT INTO notifications (user_id, notification_type, title, message, delivery_channel, delivery_status, sent_at)
  VALUES (p_user_id,
    CASE WHEN p_make THEN 'organizer_approved' ELSE 'organizer_removed' END,
    CASE WHEN p_make THEN 'You''re an organizer' ELSE 'Organizer access removed' END,
    CASE WHEN p_make
      THEN 'You can now run your own games. Open the Organizer Console from your menu to set your payment QR and create a session.'
      ELSE 'Your organizer access was removed by an admin. Your player account is unchanged.' END,
    'in_app', 'Sent', now());
END;
$$;

REVOKE ALL ON FUNCTION public.set_organizer(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_organizer(uuid, boolean) TO authenticated;
