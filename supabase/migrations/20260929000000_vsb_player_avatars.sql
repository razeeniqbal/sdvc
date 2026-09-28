/*
# VSB V2 — Player identity (chibi avatar generation)

Additive only: new tables, functions and storage buckets. Nothing existing is
altered or dropped.

## Model
- `player_avatars` — one current avatar per player (file paths in the public
  `player-avatars` bucket). Readable by every signed-in user ("all people can
  see the avatar"). No client write policies: only the `generate-avatar` edge
  function (service role) writes it.
- `player_avatar_generations` — one row per generation attempt. The entitlement
  is enforced HERE, server-side:
    * players get 1 free generation + 1 per admin grant;
    * admins are unlimited;
    * `processing` and `succeeded` attempts count, `failed` ones don't (a failed
      provider call gives the free generation back);
    * (user_id, idempotency_key) is unique, so a network retry of the same
      request can never consume a second generation;
    * at most one attempt in `processing` per player.
- `player_avatar_grants` — an admin giving a player another generation.

## Privacy
- Source photos go to the private `player-sources` bucket under
  `{user_id}/…`; players can upload/delete only their own folder and nobody
  can read them from the client. The edge function deletes the source photo
  after every attempt (the club chose not to keep originals).
- `player-avatars` is public-read and holds only generated artwork.
*/

-- ===== Current avatar per player =====
CREATE TABLE IF NOT EXISTS public.player_avatars (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  image_path text NOT NULL,
  thumb_path text NOT NULL,
  style_version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.player_avatars ENABLE ROW LEVEL SECURITY;

CREATE POLICY player_avatars_select_authenticated ON public.player_avatars
  FOR SELECT TO authenticated USING (true);

-- ===== Generation attempts (entitlement ledger) =====
CREATE TABLE IF NOT EXISTS public.player_avatar_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'succeeded', 'failed')),
  style_version integer NOT NULL DEFAULT 1,
  source_path text,
  output_path text,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (user_id, idempotency_key)
);
CREATE UNIQUE INDEX IF NOT EXISTS player_avatar_generations_one_processing
  ON public.player_avatar_generations (user_id) WHERE status = 'processing';
CREATE INDEX IF NOT EXISTS player_avatar_generations_user_idx
  ON public.player_avatar_generations (user_id, created_at DESC);
ALTER TABLE public.player_avatar_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY player_avatar_generations_select_own_or_admin ON public.player_avatar_generations
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_admin());

-- ===== Extra generations granted by an admin =====
CREATE TABLE IF NOT EXISTS public.player_avatar_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS player_avatar_grants_user_idx ON public.player_avatar_grants (user_id);
ALTER TABLE public.player_avatar_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY player_avatar_grants_select_own_or_admin ON public.player_avatar_grants
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_admin());

CREATE POLICY player_avatar_grants_insert_admin ON public.player_avatar_grants
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() AND granted_by = (SELECT auth.uid()));

-- ===== Entitlement, as seen by the signed-in player =====
-- unlimited = true for admins; otherwise remaining = allowed - used.
CREATE OR REPLACE FUNCTION public.my_avatar_entitlement()
RETURNS TABLE (allowed integer, used integer, remaining integer, unlimited boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH me AS (SELECT (SELECT auth.uid()) AS uid),
  a AS (SELECT 1 + (SELECT count(*) FROM player_avatar_grants g, me WHERE g.user_id = me.uid)::int AS allowed),
  u AS (SELECT count(*)::int AS used FROM player_avatar_generations x, me WHERE x.user_id = me.uid AND x.status IN ('processing', 'succeeded'))
  SELECT a.allowed, u.used, GREATEST(a.allowed - u.used, 0), public.is_admin()
  FROM a, u;
$$;
REVOKE EXECUTE ON FUNCTION public.my_avatar_entitlement() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_avatar_entitlement() TO authenticated;

-- ===== Reserve a generation (edge function / service role only) =====
-- Serialises per player (row lock on the profile), honours idempotency, clears
-- attempts stuck in 'processing' for > 10 minutes, then checks the entitlement.
CREATE OR REPLACE FUNCTION public.reserve_avatar_generation(p_user_id uuid, p_idempotency_key text, p_source_path text)
RETURNS TABLE (generation_id uuid, already_existed boolean, generation_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_existing player_avatar_generations%ROWTYPE;
  v_is_admin boolean;
  v_allowed integer;
  v_used integer;
  v_id uuid;
BEGIN
  SELECT (role = 'admin') INTO v_is_admin FROM profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PLAYER_NOT_FOUND';
  END IF;

  SELECT * INTO v_existing FROM player_avatar_generations
   WHERE user_id = p_user_id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN QUERY SELECT v_existing.id, true, v_existing.status;
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM player_avatar_generations
              WHERE user_id = p_user_id AND status = 'processing' AND created_at > now() - interval '10 minutes') THEN
    RAISE EXCEPTION 'GENERATION_IN_PROGRESS';
  END IF;

  UPDATE player_avatar_generations
     SET status = 'failed', failure_reason = 'Timed out', completed_at = now()
   WHERE user_id = p_user_id AND status = 'processing';

  IF NOT COALESCE(v_is_admin, false) THEN
    SELECT 1 + count(*)::int INTO v_allowed FROM player_avatar_grants WHERE user_id = p_user_id;
    SELECT count(*)::int INTO v_used FROM player_avatar_generations
     WHERE user_id = p_user_id AND status IN ('processing', 'succeeded');
    IF v_used >= v_allowed THEN
      RAISE EXCEPTION 'NO_GENERATIONS_LEFT';
    END IF;
  END IF;

  INSERT INTO player_avatar_generations (user_id, idempotency_key, source_path)
  VALUES (p_user_id, p_idempotency_key, p_source_path)
  RETURNING id INTO v_id;

  RETURN QUERY SELECT v_id, false, 'processing'::text;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.reserve_avatar_generation(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_avatar_generation(uuid, text, text) TO service_role;

-- ===== Session roster with identity (Who's Playing / session cards) =====
-- Same rows as session_player_list (left untouched for the V1 UI + Telegram),
-- plus position, companion flag and avatar thumbnail. Companions never borrow
-- the booker's position or avatar.
CREATE OR REPLACE FUNCTION public.session_player_roster(p_session_id uuid)
RETURNS TABLE (
  display_name text,
  booking_status booking_status,
  gender gender,
  playing_position playing_position,
  is_guest boolean,
  avatar_thumb_path text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    COALESCE(b.guest_name, p.short_name, p.full_name) AS display_name,
    b.booking_status,
    CASE WHEN b.is_guest THEN b.guest_gender ELSE p.gender END AS gender,
    CASE WHEN b.is_guest THEN NULL ELSE p.playing_position END AS playing_position,
    b.is_guest,
    CASE WHEN b.is_guest THEN NULL ELSE av.thumb_path END AS avatar_thumb_path
  FROM bookings b
  JOIN profiles p ON p.id = b.user_id
  LEFT JOIN player_avatars av ON av.user_id = b.user_id
  WHERE b.session_id = p_session_id
    AND b.booking_status IN ('Pending Payment', 'Confirmed')
  ORDER BY b.created_at ASC;
$$;
REVOKE EXECUTE ON FUNCTION public.session_player_roster(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.session_player_roster(uuid) TO authenticated;

-- ===== Storage =====
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('player-sources', 'player-sources', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('player-avatars', 'player-avatars', true, 10485760, ARRAY['image/png', 'image/webp', 'image/jpeg'])
ON CONFLICT (id) DO NOTHING;

-- Players may put/remove a source photo only in their own folder. There is no
-- SELECT policy: nobody can read source photos from the client.
CREATE POLICY player_sources_owner_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'player-sources' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

CREATE POLICY player_sources_owner_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'player-sources' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

-- player-avatars is a public bucket (public URLs); only the service role writes.
