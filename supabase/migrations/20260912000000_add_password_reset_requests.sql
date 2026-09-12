-- Self-service "forgot password" for phone-based accounts. There's no real email/SMS
-- channel to deliver a code to (accounts use synthetic fake emails), so the club admin
-- is the human-in-the-loop who relays the code over WhatsApp instead: the player never
-- sees their own code, so having to go through the admin to get it is what actually
-- proves it's really them, not just anyone who knows the phone number.
CREATE TABLE IF NOT EXISTS password_reset_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  code text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'used')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz
);

CREATE INDEX IF NOT EXISTS password_reset_requests_profile_id_idx ON password_reset_requests(profile_id);

ALTER TABLE password_reset_requests ENABLE ROW LEVEL SECURITY;

-- Only admins can see pending codes (to relay them over WhatsApp); only the
-- service-role edge function writes rows, so there's no insert/update/delete policy.
DROP POLICY IF EXISTS "password_reset_requests_admin_read" ON password_reset_requests;
CREATE POLICY "password_reset_requests_admin_read" ON password_reset_requests
  FOR SELECT TO authenticated
  USING (is_admin());
