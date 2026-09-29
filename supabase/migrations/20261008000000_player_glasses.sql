/*
# Player glasses (presentation only)

Whether the player's generated character wears glasses, answered by the
player in Create Player instead of left to the image model to guess from the
photo (it tended to add glasses).

- profiles.wears_glasses: true / false, or NULL when never answered (the
  prompt then only allows glasses clearly worn in the photo). Players edit
  their own row (existing profiles_update_own policy).
- player_avatar_generations.glasses: what each attempt was told (traceability).

Additive: V1 ignores both columns.
*/

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wears_glasses boolean;
ALTER TABLE public.player_avatar_generations ADD COLUMN IF NOT EXISTS glasses boolean;
