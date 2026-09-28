import { User } from 'lucide-react';

// One avatar for every roster/card/profile spot (PRD §8 fallback order):
//   1. generated VSB player art (`src`, once Milestone 6 lands)
//   2. deterministic VSB placeholder — initial on a tone picked from the name
//   3. neutral guest silhouette for non-account companions (`guest`)
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
} as const;

interface PlayerAvatarProps {
  name: string;
  src?: string | null;
  guest?: boolean;
  size?: keyof typeof SIZES;
  className?: string;
}

export function PlayerAvatar({ name, src, guest = false, size = 'sm', className = '' }: PlayerAvatarProps) {
  const base = `inline-flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full ring-2 ring-ink font-display font-bold ${SIZES[size]} ${className}`;

  if (src) {
    return <img src={src} alt="" loading="lazy" className={`${base} object-cover bg-ink-700`} />;
  }
  if (guest) {
    return (
      <span className={`${base} bg-ink-700 text-muted`} aria-hidden>
        <User className="h-1/2 w-1/2" />
      </span>
    );
  }
  return (
    <span className={`${base} ${toneFor(name)}`} aria-hidden>
      {name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
}
