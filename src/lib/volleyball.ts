import type { PlayingPosition, SkillLevel } from '@/types/database';

// Order matches the Postgres enums (skill_level / playing_position).
export const SKILL_LEVELS: SkillLevel[] = ['Beginner', 'Intermediate', 'Advanced', 'Open Level'];

export const PLAYING_POSITIONS: PlayingPosition[] = [
  'Setter',
  'Outside Hitter',
  'Opposite Hitter',
  'Middle Blocker',
  'Libero',
  'Flexible / Any Position',
];

// Court-marker abbreviations from the V2 PRD (§9).
export const POSITION_ABBR: Record<PlayingPosition, string> = {
  Setter: 'S',
  'Outside Hitter': 'OH',
  'Opposite Hitter': 'OPP',
  'Middle Blocker': 'MB',
  Libero: 'L',
  'Flexible / Any Position': 'FLEX',
};

// i18n keys, so enum values from the DB never render as raw English in BM.
export const SKILL_LEVEL_KEY: Record<SkillLevel, string> = {
  Beginner: 'volleyball.skill.beginner',
  Intermediate: 'volleyball.skill.intermediate',
  Advanced: 'volleyball.skill.advanced',
  'Open Level': 'volleyball.skill.open',
};

export const POSITION_KEY: Record<PlayingPosition, string> = {
  Setter: 'volleyball.position.setter',
  'Outside Hitter': 'volleyball.position.outsideHitter',
  'Opposite Hitter': 'volleyball.position.opposite',
  'Middle Blocker': 'volleyball.position.middleBlocker',
  Libero: 'volleyball.position.libero',
  'Flexible / Any Position': 'volleyball.position.flex',
};

// Skill level is informational, not a status — so it gets neutral/brand tones
// rather than the green/amber/red status palette owned by StatusBadge.
export const SKILL_LEVEL_STYLE: Record<SkillLevel, string> = {
  Beginner: 'bg-ink-600 text-chalk',
  Intermediate: 'bg-vsb-600 text-white',
  Advanced: 'bg-ball text-ink',
  'Open Level': 'bg-chalk text-ink',
};
