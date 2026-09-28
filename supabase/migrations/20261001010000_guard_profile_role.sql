/*
# Players can't change their own role

`profiles_update_own` lets a signed-in user update every column of their own
row, including `role` — so anyone could make themselves admin from the
browser console. Same for `profiles_insert_self` on sign-up.

This trigger only looks at direct requests from the app (the `anon` /
`authenticated` database roles):
  - new profiles are always created as 'player'
  - changing `role` is refused
Role changes keep working through the admin-only `set_user_role` RPC
(SECURITY DEFINER, so it runs as the owner, not as `authenticated`) and through
service-role edge functions.
*/
CREATE OR REPLACE FUNCTION public.guard_profile_role()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.role := 'player';
    ELSIF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Only an admin can change a role' USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_profile_role() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profiles_guard_role ON public.profiles;
CREATE TRIGGER profiles_guard_role
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_role();
