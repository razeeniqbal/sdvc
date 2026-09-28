/*
# Organizer role (1/2): enum value

Postgres needs a new enum value committed before anything can use it, so this
is its own migration. Additive: V1 only checks for 'admin', so organizers are
treated as ordinary players there.
*/
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'organizer';
