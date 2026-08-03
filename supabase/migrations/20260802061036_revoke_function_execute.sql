/*
# Revoke direct EXECUTE on internal SECURITY DEFINER functions

These functions are used internally by RLS policies and triggers, not by the
frontend. Revoking EXECUTE from anon and authenticated prevents them from being
called directly via the REST API.
*/

REVOKE EXECUTE ON FUNCTION is_admin() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION confirmed_booking_count(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION handle_new_user() FROM anon, authenticated;
