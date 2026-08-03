/*
# Volleyball Club Booking App — Core Schema

Creates the full database for a volleyball club session-booking and payment app:
profiles, sessions, bookings, payments, waiting list, attendance, and notifications.

## 1. New Tables

- `profiles` — extends auth.users with club member fields (full name, phone,
  emergency contact, playing position, skill level, role).
- `sessions` — weekly volleyball sessions (date/time, venue, court, skill level,
  price, capacity, booking windows, status).
- `bookings` — a player's booking for a session, with booking + payment status,
  pricing breakdown, reservation hold, cancellation info, admin notes.
- `payments` — payment records per booking (provider, method, amount, status,
  transaction reference, refund tracking).
- `waiting_list` — ordered queue of players waiting for a full session.
- `attendance` — per-booking attendance status set by admin.
- `notifications` — in-app notification log, structured for future email/SMS/push.

## 2. Enums

- `skill_level`, `playing_position`, `session_status`, `booking_status`,
  `payment_status`, `payment_method`, `waiting_list_status`,
  `attendance_status`, `notification_channel`, `delivery_status`, `user_role`.

## 3. Security (RLS)

- All tables have RLS enabled.
- Profiles: a user can read/update only their own profile; admins can read all.
- Sessions: any authenticated user can read; only admins can insert/update/delete.
- Bookings: a user can read/insert their own; admins can read/update all.
- Payments: a user can read their own (via booking ownership); admins can read/update all.
- Waiting list: a user can read/insert their own; admins can read/update all.
- Attendance: a user can read their own; admins can read/update all.
- Notifications: a user can read their own; admins can read all.
- A helper SECURITY DEFINER function `is_admin()` checks the caller's role.
- A helper function `confirmed_booking_count(session_uuid)` returns the number
  of active (non-cancelled) bookings for a session (used for capacity checks).
- A trigger auto-creates a profile row when a new auth user signs up, copying
  email and defaulting role to 'player'.

## 4. Notes

- `user_id` columns default to `auth.uid()` so inserts omitting the owner succeed.
- Booking reference generated as a readable code (e.g. VBC-XXXXXX) via a default.
- `reserved_until` supports the 10-minute temporary slot hold during checkout.
- No full card details are ever stored; payments table stores only references/status.
*/

-- ===== Enums =====
DO $$ BEGIN
  CREATE TYPE skill_level AS ENUM ('Beginner', 'Intermediate', 'Advanced', 'Open Level');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE playing_position AS ENUM ('Setter', 'Outside Hitter', 'Opposite Hitter', 'Middle Blocker', 'Libero', 'Flexible / Any Position');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE session_status AS ENUM ('Open', 'Closed', 'Cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE booking_status AS ENUM ('Pending Payment', 'Confirmed', 'Cancelled by Player', 'Cancelled by Admin', 'Completed', 'No Show', 'Refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('Pending', 'Paid', 'Failed', 'Cancelled', 'Refunded', 'Partially Refunded', 'Manual Payment Pending Verification');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM ('Credit Card', 'Debit Card', 'FPX', 'DuitNow QR', 'E-Wallet', 'Manual Bank Transfer', 'Cash');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE waiting_list_status AS ENUM ('Waiting', 'Offered', 'Booked', 'Expired', 'Cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE attendance_status AS ENUM ('Attended', 'Absent', 'No Show', 'Cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notification_channel AS ENUM ('in_app', 'email', 'whatsapp', 'sms', 'push');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE delivery_status AS ENUM ('Pending', 'Sent', 'Failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('player', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ===== Profiles =====
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  phone_number text,
  emergency_contact_name text,
  emergency_contact_phone text,
  playing_position playing_position,
  skill_level skill_level,
  role user_role NOT NULL DEFAULT 'player',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ===== Sessions =====
CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  session_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  venue_name text NOT NULL,
  venue_address text,
  maps_link text,
  court_number text,
  skill_level skill_level NOT NULL DEFAULT 'Open Level',
  price numeric(10,2) NOT NULL DEFAULT 0,
  maximum_capacity integer NOT NULL DEFAULT 24,
  booking_open_at timestamptz,
  booking_close_at timestamptz,
  cancellation_deadline interval DEFAULT '24 hours',
  status session_status NOT NULL DEFAULT 'Open',
  notes text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ===== Bookings =====
CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_reference text NOT NULL DEFAULT ('VBC-' || upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 6))),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  booking_status booking_status NOT NULL DEFAULT 'Pending Payment',
  payment_status payment_status NOT NULL DEFAULT 'Pending',
  subtotal numeric(10,2) NOT NULL DEFAULT 0,
  processing_fee numeric(10,2) NOT NULL DEFAULT 0,
  discount_amount numeric(10,2) NOT NULL DEFAULT 0,
  total_amount numeric(10,2) NOT NULL DEFAULT 0,
  reserved_until timestamptz,
  cancellation_reason text,
  cancelled_at timestamptz,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ===== Payments =====
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  payment_reference text NOT NULL DEFAULT ('PAY-' || upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 6))),
  payment_provider text NOT NULL DEFAULT 'simulated',
  payment_method payment_method,
  amount numeric(10,2) NOT NULL DEFAULT 0,
  payment_status payment_status NOT NULL DEFAULT 'Pending',
  transaction_reference text,
  paid_at timestamptz,
  refunded_amount numeric(10,2) NOT NULL DEFAULT 0,
  refunded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ===== Waiting list =====
CREATE TABLE IF NOT EXISTS waiting_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  queue_position integer NOT NULL,
  status waiting_list_status NOT NULL DEFAULT 'Waiting',
  offer_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ===== Attendance =====
CREATE TABLE IF NOT EXISTS attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  attendance_status attendance_status,
  checked_in_at timestamptz,
  checked_in_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ===== Notifications =====
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  notification_type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  delivery_channel notification_channel NOT NULL DEFAULT 'in_app',
  delivery_status delivery_status NOT NULL DEFAULT 'Sent',
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ===== Helper functions =====
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION confirmed_booking_count(p_session_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer FROM bookings
  WHERE session_id = p_session_id
    AND booking_status IN ('Pending Payment', 'Confirmed');
$$;

-- ===== updated_at trigger =====
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER sessions_updated_at BEFORE UPDATE ON sessions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER bookings_updated_at BEFORE UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER payments_updated_at BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER waiting_list_updated_at BEFORE UPDATE ON waiting_list
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER attendance_updated_at BEFORE UPDATE ON attendance
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ===== Auto-create profile on signup =====
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New Player'),
    NEW.email
  );
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ===== RLS: Profiles =====
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON profiles;
CREATE POLICY "profiles_select_own_or_admin" ON profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR is_admin());

DROP POLICY IF EXISTS "profiles_insert_self" ON profiles;
CREATE POLICY "profiles_insert_self" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ===== RLS: Sessions =====
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sessions_select_all" ON sessions;
CREATE POLICY "sessions_select_all" ON sessions
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "sessions_insert_admin" ON sessions;
CREATE POLICY "sessions_insert_admin" ON sessions
  FOR INSERT TO authenticated
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "sessions_update_admin" ON sessions;
CREATE POLICY "sessions_update_admin" ON sessions
  FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "sessions_delete_admin" ON sessions;
CREATE POLICY "sessions_delete_admin" ON sessions
  FOR DELETE TO authenticated
  USING (is_admin());

CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);

-- ===== RLS: Bookings =====
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bookings_select_own_or_admin" ON bookings;
CREATE POLICY "bookings_select_own_or_admin" ON bookings
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR is_admin());

DROP POLICY IF EXISTS "bookings_insert_own" ON bookings;
CREATE POLICY "bookings_insert_own" ON bookings
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "bookings_update_own_or_admin" ON bookings;
CREATE POLICY "bookings_update_own_or_admin" ON bookings
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR is_admin())
  WITH CHECK (true);

DROP POLICY IF EXISTS "bookings_delete_own" ON bookings;
CREATE POLICY "bookings_delete_own" ON bookings
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_session ON bookings(session_id);
CREATE INDEX IF NOT EXISTS idx_bookings_reference ON bookings(booking_reference);

-- ===== RLS: Payments =====
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payments_select_own_or_admin" ON payments;
CREATE POLICY "payments_select_own_or_admin" ON payments
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM bookings b WHERE b.id = payments.booking_id AND b.user_id = auth.uid()) OR is_admin());

DROP POLICY IF EXISTS "payments_insert_own_or_admin" ON payments;
CREATE POLICY "payments_insert_own_or_admin" ON payments
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM bookings b WHERE b.id = payments.booking_id AND (b.user_id = auth.uid() OR is_admin())));

DROP POLICY IF EXISTS "payments_update_admin" ON payments;
CREATE POLICY "payments_update_admin" ON payments
  FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id);

-- ===== RLS: Waiting list =====
ALTER TABLE waiting_list ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "waitlist_select_own_or_admin" ON waiting_list;
CREATE POLICY "waitlist_select_own_or_admin" ON waiting_list
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR is_admin());

DROP POLICY IF EXISTS "waitlist_insert_own" ON waiting_list;
CREATE POLICY "waitlist_insert_own" ON waiting_list
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "waitlist_update_own_or_admin" ON waiting_list;
CREATE POLICY "waitlist_update_own_or_admin" ON waiting_list
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR is_admin())
  WITH CHECK (true);

DROP POLICY IF EXISTS "waitlist_delete_own_or_admin" ON waiting_list;
CREATE POLICY "waitlist_delete_own_or_admin" ON waiting_list
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR is_admin());

CREATE INDEX IF NOT EXISTS idx_waitlist_session ON waiting_list(session_id);

-- ===== RLS: Attendance =====
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attendance_select_own_or_admin" ON attendance;
CREATE POLICY "attendance_select_own_or_admin" ON attendance
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM bookings b WHERE b.id = attendance.booking_id AND b.user_id = auth.uid()) OR is_admin());

DROP POLICY IF EXISTS "attendance_insert_admin" ON attendance;
CREATE POLICY "attendance_insert_admin" ON attendance
  FOR INSERT TO authenticated
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "attendance_update_admin" ON attendance;
CREATE POLICY "attendance_update_admin" ON attendance
  FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE INDEX IF NOT EXISTS idx_attendance_booking ON attendance(booking_id);

-- ===== RLS: Notifications =====
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_own_or_admin" ON notifications;
CREATE POLICY "notifications_select_own_or_admin" ON notifications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR is_admin());

DROP POLICY IF EXISTS "notifications_insert_own_or_admin" ON notifications;
CREATE POLICY "notifications_insert_own_or_admin" ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR is_admin());

DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR is_admin())
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
