/*
# Tighten RLS policies and fix function search paths

1. Fixes `set_updated_at()` to have an explicit `SET search_path = public` (security lint).
2. Tightens UPDATE policies on `bookings` and `waiting_list` so the WITH CHECK
   clause verifies ownership/admin instead of being `true`.
3. Tightens INSERT policy on `notifications` so WITH CHECK verifies ownership/admin.
*/

-- Fix search_path on set_updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Tighten bookings UPDATE policy
DROP POLICY IF EXISTS "bookings_update_own_or_admin" ON bookings;
CREATE POLICY "bookings_update_own_or_admin" ON bookings
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR is_admin())
  WITH CHECK (auth.uid() = user_id OR is_admin());

-- Tighten waiting_list UPDATE policy
DROP POLICY IF EXISTS "waitlist_update_own_or_admin" ON waiting_list;
CREATE POLICY "waitlist_update_own_or_admin" ON waiting_list
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR is_admin())
  WITH CHECK (auth.uid() = user_id OR is_admin());

-- Tighten notifications INSERT policy
DROP POLICY IF EXISTS "notifications_insert_own_or_admin" ON notifications;
CREATE POLICY "notifications_insert_own_or_admin" ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR is_admin());

-- Tighten notifications UPDATE policy
DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR is_admin())
  WITH CHECK (auth.uid() = user_id OR is_admin());
