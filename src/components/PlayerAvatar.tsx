import { User } from 'lucide-react';

// The one avatar for every player spot in VSB Play and VSB Admin.
//   1. the player's generated VSB player (`src`)
//   2. otherwise their initial, on a tone picked from the name
//   3. a guest silhouette for companions without an account
// VSB characters are never shown in place of a real person: a character on
// someone's avatar should always mean they generated it.
// Tones are brand blues/ink only; never derived from gender.
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
  guest?: boolean;
  size?: AvatarSize;
  /** Set when the avatar stands alone; leave empty when the name is next to it. */
  label?: string;
  className?: string;
}

export function PlayerAvatar({ name, src, guest = false, size = 'sm', label, className = '' }: PlayerAvatarProps) {
  const base = `inline-flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full ring-2 ring-ink font-display font-bold ${SIZES[size]} ${className}`;
  const a11y = label ? { role: 'img' as const, 'aria-label': label } : { 'aria-hidden': true as const };

  if (src) {
    return <img src={src} alt={label ?? ''} loading="lazy" decoding="async" width={256} height={256} className={`${base} bg-ink-700 object-cover`} />;
  }
  if (guest) {
    return (
      <span className={`${base} bg-ink-700 text-muted`} {...a11y}>
        <User className="h-1/2 w-1/2" />
      </span>
    );
  }
  return (
    <span className={`${base} ${toneFor(name)}`} {...a11y}>
      {name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
}
