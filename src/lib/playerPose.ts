import { supabase } from './supabase';

// Player pose: how the generated character stands (presentation only, never
// derived from volleyball position). Stable machine values; labels in i18n
// (v2.pose.*). Keep POSES + defaultPose in sync with
// supabase/functions/generate-avatar/pose.ts (the server uses the same
// default when a player skips the choice).

export const POSES = ['ball_hold', 'front_hold', 'shoulder', 'ready', 'relaxed', 'confident'] as const;
export type Pose = (typeof POSES)[number];

export function isPose(v: unknown): v is Pose {
  return typeof v === 'string' && (POSES as readonly string[]).includes(v);
}

// Stable for a player (never random): FNV-1a of the user id.
export function defaultPose(userId: string): Pose {
  let h = 2166136261;
  for (let i = 0; i < userId.length; i++) {
    h ^= userId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return POSES[(h >>> 0) % POSES.length];
}

export const poseKey = (p: Pose) => `v2.pose.${p}`;

export async function savePose(userId: string, pose: Pose) {
  const { error } = await supabase.from('profiles').update({ player_pose: pose }).eq('id', userId);
  if (error) throw error;
}

// The generated character's look: pose + whether they wear glasses (the
// player's own answer, so the image model never guesses from the photo).
export async function saveLook(userId: string, look: { player_pose: Pose; wears_glasses: boolean }) {
  const { error } = await supabase.from('profiles').update(look).eq('id', userId);
  if (error) throw error;
}
