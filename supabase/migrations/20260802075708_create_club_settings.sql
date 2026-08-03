/*
# Club settings table

Stores configurable club-wide settings: club name, contact person, WhatsApp
links, and WhatsApp group notification settings. Single-row table (id = 1).
*/

CREATE TABLE IF NOT EXISTS club_settings (
  id integer PRIMARY KEY DEFAULT 1,
  club_name text NOT NULL DEFAULT 'Volleyball Sdn Bhd',
  contact_person_name text NOT NULL DEFAULT 'Club Admin',
  contact_whatsapp text NOT NULL DEFAULT '0137441727',
  whatsapp_group_link text NOT NULL DEFAULT 'https://chat.whatsapp.com/your-group-link',
  whatsapp_group_notify boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE club_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read club settings
DROP POLICY IF EXISTS "settings_select_all" ON club_settings;
CREATE POLICY "settings_select_all" ON club_settings
  FOR SELECT TO anon, authenticated
  USING (true);

-- Only admins can update
DROP POLICY IF EXISTS "settings_update_admin" ON club_settings;
CREATE POLICY "settings_update_admin" ON club_settings
  FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Only admins can insert
DROP POLICY IF EXISTS "settings_insert_admin" ON club_settings;
CREATE POLICY "settings_insert_admin" ON club_settings
  FOR INSERT TO authenticated
  WITH CHECK (is_admin());

-- Insert default row
INSERT INTO club_settings (id) VALUES (1) ON CONFLICT DO NOTHING;
