import type { Gender } from '@/types/database';

// Gender colours (blue / pink, as in the VSB concept). Always paired with a
// ♂/♀ mark and a spoken label, never colour alone.
export const GENDER_RING: Record<Gender, string> = { Male: '!ring-vsb-500', Female: '!ring-pink-400' };
export const GENDER_BADGE: Record<Gender, string> = { Male: 'bg-vsb-500 text-white', Female: 'bg-pink-400 text-ink' };
export const GENDER_SYMBOL: Record<Gender, string> = { Male: '♂', Female: '♀' };
