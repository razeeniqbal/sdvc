-- A private session's passkey lives in its own table, never in `sessions` itself, so it
-- never rides along on the `select('*')` calls used everywhere sessions are read. RLS
-- below restricts this table to admins only — a player can never read the stored value
-- through any query, direct or otherwise; the only way to test a guess is the
-- SECURITY DEFINER verify function, which returns a boolean and nothing else.
CREATE TABLE IF NOT EXISTS session_passkeys (
  session_id uuid PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  passkey text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE session_passkeys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "session_passkeys_admin_only" ON session_passkeys;
CREATE POLICY "session_passkeys_admin_only" ON session_passkeys
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DO $$ BEGIN
  CREATE TRIGGER session_passkeys_updated_at BEFORE UPDATE ON session_passkeys
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Lets any authenticated user check whether a session needs a passkey at all, without
-- exposing the stored value.
CREATE OR REPLACE FUNCTION public.session_requires_passkey(p_session_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM session_passkeys WHERE session_id = p_session_id);
$$;

GRANT EXECUTE ON FUNCTION public.session_requires_passkey(uuid) TO authenticated;

-- Verifies a guessed passkey server-side; the stored value never reaches the client
-- either way, whether the guess is right or wrong.
CREATE OR REPLACE FUNCTION public.verify_session_passkey(p_session_id uuid, p_passkey text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM session_passkeys
    WHERE session_id = p_session_id AND passkey = trim(p_passkey)
  );
$$;

GRANT EXECUTE ON FUNCTION public.verify_session_passkey(uuid, text) TO authenticated;
