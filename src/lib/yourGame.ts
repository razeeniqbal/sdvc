import { supabase } from './supabase';
import type { Profile } from '@/types/database';

// YOUR GAME: how a player says they like to play. Self-description only,
// never measured performance, never required for booking. Stored as stable
// machine values (validated by CHECK constraints); labels come from i18n
// (v2.yourGame.*).

export const GAME_VIBES = ['competitive', 'balanced', 'just_for_fun'] as const;
export const PLAYSTYLES = ['attacking', 'defensive', 'supportive', 'all_rounder'] as const;
export const EXPERIENCE_RANGES = ['new', 'under_1', '1_3', '3_5', '5_plus'] as const;
export const PLAY_REASONS = ['compete', 'improve', 'fitness', 'social', 'love_volleyball'] as const;

export type GameVibe = (typeof GAME_VIBES)[number];
export type Playstyle = (typeof PLAYSTYLES)[number];
export type ExperienceRange = (typeof EXPERIENCE_RANGES)[number];
export type PlayReason = (typeof PLAY_REASONS)[number];

export interface YourGame {
  game_vibe: GameVibe | null;
  playstyle: Playstyle | null;
  experience_range: ExperienceRange | null;
  play_reasons: PlayReason[];
}

export const EMPTY_YOUR_GAME: YourGame = { game_vibe: null, playstyle: null, experience_range: null, play_reasons: [] };

export function yourGameOf(p: Pick<Profile, 'game_vibe' | 'playstyle' | 'experience_range' | 'play_reasons'> | null | undefined): YourGame {
  if (!p) return EMPTY_YOUR_GAME;
  return {
    game_vibe: (p.game_vibe as GameVibe) ?? null,
    playstyle: (p.playstyle as Playstyle) ?? null,
    experience_range: (p.experience_range as ExperienceRange) ?? null,
    play_reasons: (p.play_reasons ?? []) as PlayReason[],
  };
}

/** Anything answered at all? (Unanswered parts are simply left out.) */
export function hasYourGame(g: YourGame): boolean {
  return !!(g.game_vibe || g.playstyle || g.experience_range || g.play_reasons.length);
}

export async function saveYourGame(userId: string, g: YourGame) {
  const { error } = await supabase.from('profiles').update({
    game_vibe: g.game_vibe,
    playstyle: g.playstyle,
    experience_range: g.experience_range,
    play_reasons: g.play_reasons,
  }).eq('id', userId);
  if (error) throw error;
}

// i18n keys
export const vibeKey = (v: GameVibe) => `v2.yourGame.vibe.${v}`;
export const playstyleKey = (v: Playstyle) => `v2.yourGame.playstyle.${v}`;
export const experienceKey = (v: ExperienceRange) => `v2.yourGame.experience.${v}`;
export const reasonKey = (v: PlayReason) => `v2.yourGame.reason.${v}`;
