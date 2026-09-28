/*
# Avatar generation traceability

Every attempt records which prompt produced it and the image provider's
request id, so players made by the old style (VSB_PLAYER_V1) can be told
apart from the corrected one (VSB_PLAYER_V2) and any result can be matched to
the provider's logs. No secrets or source photos are stored.
*/
ALTER TABLE public.player_avatar_generations
  ADD COLUMN IF NOT EXISTS prompt_version text,
  ADD COLUMN IF NOT EXISTS provider_request_id text,
  ADD COLUMN IF NOT EXISTS model text;

ALTER TABLE public.player_avatars
  ADD COLUMN IF NOT EXISTS prompt_version text;

-- The one generation made before versioning used the V1 prompt.
UPDATE public.player_avatar_generations SET prompt_version = 'VSB_PLAYER_V1' WHERE prompt_version IS NULL AND style_version IS NOT DISTINCT FROM 1 AND status = 'succeeded';
UPDATE public.player_avatars SET prompt_version = 'VSB_PLAYER_V1' WHERE prompt_version IS NULL AND style_version = 1;
