/*
# Player pose (presentation only)

The pose a player's generated character stands in. Six calm identity poses,
stored as stable machine values; the app shows friendly labels. Pose is
presentation, never derived from volleyball position.

  ball_hold | front_hold | shoulder | ready | relaxed | confident

- profiles.player_pose: chosen in Create Player, or assigned
  deterministically when skipped; players edit their own row (existing
  profiles_update_own policy)
- player_avatar_generations.pose: which pose each attempt used (traceability)

Existing generated players keep their art. Their art uses the original
master pose, recorded as ball_hold. Additive: V1 ignores both columns.
*/

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS player_pose text;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_player_pose_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_player_pose_check
  CHECK (player_pose IS NULL OR player_pose IN ('ball_hold', 'front_hold', 'shoulder', 'ready', 'relaxed', 'confident'));

ALTER TABLE public.player_avatar_generations ADD COLUMN IF NOT EXISTS pose text;

-- Existing identities were generated in the master's ball-at-hip pose.
UPDATE public.profiles p SET player_pose = 'ball_hold'
WHERE p.player_pose IS NULL AND EXISTS (SELECT 1 FROM public.player_avatars a WHERE a.user_id = p.id);
UPDATE public.player_avatar_generations SET pose = 'ball_hold' WHERE pose IS NULL AND status = 'succeeded';
