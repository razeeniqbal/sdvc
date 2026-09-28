import { useTranslation } from 'react-i18next';
import { CalendarCheck, Gamepad2, Users } from 'lucide-react';
import type { Gender, PlayingPosition, SkillLevel } from '@/types/database';
import { POSITION_ABBR, POSITION_KEY, SKILL_LEVEL_KEY } from '@/lib/volleyball';
import { vsbAssets } from '@/lib/vsbAssets';
import { VsbLogo } from '@/components/VsbLogo';

// Collectible VSB player card (PRD §14, "Player Card Frame" reference):
// CSS frame + the player's generated character + live data. Every number comes
// from real bookings and attendance. No ratings, no "overall".
// Without a generated player the art slot shows the player's initial, never a
// stand-in character.

export interface PlayerCardStats {
  played: number;
  attended: number;
  attendancePct: number | null; // null until at least one game has an attendance mark
}

interface PlayerCardProps {
  name: string;
  position: PlayingPosition | null;
  skill: SkillLevel | null;
  gender: Gender | null;
  stats: PlayerCardStats | null;
  artSrc?: string | null;
  // Overrides the position · level line (e.g. a sample card).
  subtitle?: string;
}

// Sports-card silhouette: clipped top corners, shield point at the bottom.
const FRAME = 'polygon(9% 0, 91% 0, 100% 6%, 100% 84%, 50% 100%, 0 84%, 0 6%)';
const PLATE = 'polygon(4% 0, 96% 0, 100% 50%, 96% 100%, 4% 100%, 0 50%)';

export function PlayerCard({ name, position, skill, gender, stats, artSrc, subtitle }: PlayerCardProps) {
  const { t } = useTranslation();
  const pos = position ? POSITION_ABBR[position] : '-';

  const statItems = [
    { label: t('v2.card.games'), value: stats?.played, Icon: Gamepad2 },
    { label: t('v2.card.attended'), value: stats?.attended, Icon: CalendarCheck },
    { label: t('v2.card.attendance'), value: stats?.attendancePct != null ? `${stats.attendancePct}%` : undefined, Icon: Users },
  ];

  return (
    <figure
      className="relative mx-auto aspect-[5/7] w-full max-w-[340px] bg-gradient-to-b from-vsb-400 via-vsb-600 to-[#C9A36A] p-[3px] drop-shadow-[0_14px_34px_rgba(22,139,255,0.28)]"
      style={{ clipPath: FRAME }}
      aria-label={t('v2.card.ariaLabel', { name })}
    >
      <div className="relative h-full overflow-hidden bg-ink" style={{ clipPath: FRAME }}>
        {/* arena backdrop: lights + truss from the production hero art */}
        <img src={vsbAssets.hero.cardArena.src} alt="" width={vsbAssets.hero.cardArena.width} height={vsbAssets.hero.cardArena.height} className="absolute inset-x-0 top-0 h-[70%] w-full object-cover object-bottom" />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/30 via-transparent to-ink" aria-hidden />
        {/* net line the character stands in front of */}
        <div className="absolute inset-x-0 top-[44%] h-6 border-y border-chalk/15 opacity-40 [background-image:repeating-linear-gradient(90deg,rgba(244,241,234,0.25)_0_1px,transparent_1px_8px)]" aria-hidden />
        {/* gold inner edge */}
        <div className="pointer-events-none absolute inset-[6px] border border-[#C9A36A]/40" style={{ clipPath: FRAME }} aria-hidden />

        {/* top row */}
        <VsbLogo variant="mark" className="absolute left-1/2 top-[4.5%] h-6 -translate-x-1/2" sizes="120px" />
        <div className="absolute left-[7%] top-[12%] z-20 flex h-[4.25rem] w-14 flex-col items-center justify-center border border-vsb-500/60 bg-ink/90" aria-hidden>
          <span className="font-display text-2xl font-extrabold leading-none text-chalk">{pos}</span>
          <span className="mt-1 text-[9px] font-bold uppercase tracking-widest text-muted">POS</span>
        </div>
        <span className="absolute right-[5%] top-[13%] z-20 font-display text-[10px] font-bold uppercase tracking-[0.3em] text-chalk/70 [writing-mode:vertical-rl]" aria-hidden>
          Volleyball Sdn Bhd
        </span>

        {/* character */}
        <div className="absolute inset-x-[8%] bottom-[31%] top-[9%] z-10 flex items-end justify-center">
          {artSrc ? (
            <img src={artSrc} alt="" decoding="async" className="h-full w-auto max-w-full object-contain object-bottom drop-shadow-[0_10px_18px_rgba(0,0,0,0.55)]" />
          ) : (
            <span className="mb-2 font-display text-[8rem] font-extrabold leading-none text-vsb-500/70" aria-hidden>
              {name.trim().charAt(0).toUpperCase() || '?'}
            </span>
          )}
        </div>

        {/* name plate */}
        <div className="absolute inset-x-[6%] bottom-[25%] z-20 bg-vsb-500/70 p-px" style={{ clipPath: PLATE }}>
          <div className="bg-ink px-6 py-2 text-center" style={{ clipPath: PLATE }}>
            <figcaption className="truncate font-display text-[1.7rem] font-extrabold uppercase leading-none tracking-wide text-chalk">{name}</figcaption>
            <p className="mt-1 truncate text-[11px] text-slate-300">
              {subtitle ?? ([position ? t(POSITION_KEY[position]) : t('v2.whosPlaying.noPosition'), skill ? t(SKILL_LEVEL_KEY[skill]) : null,
                gender ? (gender === 'Male' ? t('common.genderMale') : t('common.genderFemale')) : null].filter(Boolean).join(' · '))}
            </p>
          </div>
        </div>

        {/* stats */}
        <dl className="absolute inset-x-[10%] bottom-[11%] z-20 grid grid-cols-3 border border-ink-500 bg-ink/90 text-center">
          {statItems.map(({ label, value, Icon }, i) => (
            <div key={label} className={`flex flex-col items-center py-1.5 ${i > 0 ? 'border-l border-ink-500' : ''}`}>
              <Icon className="h-3.5 w-3.5 text-vsb-400" aria-hidden />
              <dd className="mt-0.5 font-display text-xl font-extrabold leading-none text-chalk">{value ?? '-'}</dd>
              <dt className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-muted">{label}</dt>
            </div>
          ))}
        </dl>
        <p className="absolute inset-x-0 bottom-[4.5%] z-20 text-center font-display text-[9px] font-bold uppercase tracking-[0.35em] text-chalk/60" aria-hidden>
          {t('v2.card.tagline')}
        </p>
      </div>
    </figure>
  );
}
