/*
# Revoke EXECUTE from PUBLIC on internal functions

Postgres grants EXECUTE on functions to PUBLIC by default. Revoke from PUBLIC
to prevent direct REST API calls to these internal helper functions.
*/

REVOKE EXECUTE ON FUNCTION is_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION confirmed_booking_count(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION handle_new_user() FROM PUBLIC;
