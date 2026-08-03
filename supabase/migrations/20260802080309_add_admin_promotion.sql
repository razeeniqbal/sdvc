/*
# Add admin promotion function

Adds a SECURITY DEFINER function to promote/demote users between player and
admin roles. Only existing admins can call it. Also updates default club name
to FunPlay branding.
*/

-- Function to set a user's role (only callable by admins)
CREATE OR REPLACE FUNCTION set_user_role(target_email text, new_role user_role)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_id uuid;
BEGIN
  -- Check if caller is admin
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only admins can change user roles';
  END IF;

  -- Find the user by email
  SELECT id INTO target_id FROM profiles WHERE email = target_email;
  IF target_id IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Update the role
  UPDATE profiles SET role = new_role WHERE id = target_id;
  RETURN true;
END;
$$;

-- Revoke direct execute from public
REVOKE EXECUTE ON FUNCTION set_user_role(text, user_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION set_user_role(text, user_role) FROM anon, authenticated;

-- Update default club name to FunPlay
UPDATE club_settings SET club_name = 'FunPlay Volleyball' WHERE id = 1;
