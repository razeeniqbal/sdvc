import { User } from 'lucide-react';
import { fallbackCharacter } from '@/lib/vsbAssets';

// The one avatar for every player spot in VSB Play and VSB Admin.
// Priority:
//   1. the player's generated VSB identity (`src`)
//   2. a stable VSB character picked from their user id (`seed`) — same
//      player, same character on every screen; never random
//   3. initials (no id known), or a guest silhouette for companions
// Tones are brand blues/ink only — never derived from gender or anything else
// about the person.
const TONES = [
  'bg-vsb-600 text-white',
  'bg-vsb-800 text-vsb-100',
  'bg-ink-500 text-chalk',
  'bg-vsb-400 text-ink',
  'bg-ink-600 text-vsb-200',
];

function toneFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return TONES[Math.abs(h) % TONES.length];
}

const SIZES = {
  xs: 'h-7 w-7 text-[11px]',
  sm: 'h-9 w-9 text-sm',
  md: 'h-12 w-12 text-base',
  lg: 'h-20 w-20 text-2xl',
  xl: 'h-32 w-32 text-4xl',
  hero: 'h-48 w-48 text-6xl',
} as const;

export type AvatarSize = keyof typeof SIZES;

interface PlayerAvatarProps {
  name: string;
  src?: string | null;
  /** Stable id (user id) for the fallback character. */
  seed?: string | null;
  guest?: boolean;
  size?: AvatarSize;
  /** Set when the avatar stands alone; leave empty when the name is next to it. */
  label?: string;
  className?: string;
}

export function PlayerAvatar({ name, src, seed, guest = false, size = 'sm', label, className = '' }: PlayerAvatarProps) {
  const base = `inline-flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full ring-2 ring-ink font-display font-bold ${SIZES[size]} ${className}`;
  const alt = label ?? '';

  if (src) {
    return <img src={src} alt={alt} loading="lazy" decoding="async" width={256} height={256} className={`${base} bg-ink-700 object-cover`} />;
  }
  if (guest) {
    return (
      <span className={`${base} bg-ink-700 text-muted`} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
        <User className="h-1/2 w-1/2" />
      </span>
    );
  }
  if (seed) {
    const face = fallbackCharacter(seed).face;
    return <img src={face.src} alt={alt} loading="lazy" decoding="async" width={face.width} height={face.height} className={`${base} bg-vsb-900 object-cover`} />;
  }
  return (
    <span className={`${base} ${toneFor(name)}`} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
}
