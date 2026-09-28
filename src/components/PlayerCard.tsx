import { useTranslation } from 'react-i18next';
import { Shield, Target } from 'lucide-react';
import type { PlayingPosition, SkillLevel } from '@/types/database';
import { POSITION_ABBR, POSITION_KEY, SKILL_LEVEL_KEY } from '@/lib/volleyball';
import { vsbAssets } from '@/lib/vsbAssets';
import { VsbLogo } from '@/components/VsbLogo';

// Collectible VSB player card, composed like the approved V2 concept:
//   HERO      the player's generated character dominates the top of the card,
//             fading into the identity panel; the position abbreviation and
//             the VSB mark sit in the upper-left (where the concept shows its
//             exploratory "87" rating, which VSB does not have)
//   IDENTITY  name, then position + skill level
//   ACTIVITY  real games played in VSB, plus at most two of the player's own
//             Your Game tags (self-described, never a rating)
// Permanent identity = art, name, position, level. Games update around it; the
// art is never regenerated for them. No attendance, no gender, no ratings.
// Sizes use card-width units (cqw) so the card scales as one piece: a full-width
// phone card is not a shrunken desktop card.

interface PlayerCardProps {
  name: string;
  position: PlayingPosition | null;
  skill: SkillLevel | null;
  /** Real past games in VSB; null hides the line (e.g. a sample card). */
  games: number | null;
  /** Translated Your Game tags (playstyle, vibe); unanswered ones are simply omitted. */
  tags?: string[];
  artSrc?: string | null;
  // Replaces the position + level row (e.g. a sample card).
  subtitle?: string;
}

// Sports-card silhouette: clipped top corners, shield point at the bottom.
const FRAME = 'polygon(9% 0, 91% 0, 100% 6%, 100% 84%, 50% 100%, 0 84%, 0 6%)';
const PLATE = 'polygon(3% 0, 97% 0, 100% 50%, 97% 100%, 3% 100%, 0 50%)';

export function PlayerCard({ name, position, skill, games, tags = [], artSrc, subtitle }: PlayerCardProps) {
  const { t } = useTranslation();
  const abbr = position ? POSITION_ABBR[position] : null;

  const shownTags = tags.filter(Boolean).slice(0, 2);

  return (
    <figure
      className="relative mx-auto aspect-[5/7] w-full max-w-[380px] bg-gradient-to-b from-vsb-400 via-vsb-600 to-[#C9A36A] p-[3px] drop-shadow-[0_14px_34px_rgba(22,139,255,0.28)] [container-type:inline-size]"
      style={{ clipPath: FRAME }}
      aria-label={t('v2.card.ariaLabel', { name })}
    >
      <div className="relative h-full overflow-hidden bg-ink" style={{ clipPath: FRAME }}>
        {/* ---- HERO ---- */}
        <img src={vsbAssets.hero.cardArena.src} alt="" width={vsbAssets.hero.cardArena.width} height={vsbAssets.hero.cardArena.height}
          className="absolute inset-x-0 top-0 h-[66%] w-full object-cover object-bottom" />
        <div className="absolute inset-x-0 top-[34%] h-[5%] border-y border-chalk/10 opacity-50 [background-image:repeating-linear-gradient(90deg,rgba(244,241,234,0.22)_0_1px,transparent_1px_7px)]" aria-hidden />
        <div className="pointer-events-none absolute inset-[5px] border border-[#C9A36A]/35" style={{ clipPath: FRAME }} aria-hidden />

        {artSrc ? (
          // Generated art keeps transparent margins; the box runs from above
          // the frame to well below the identity panel so the character fills
          // the hero region and its legs fade out behind the panel.
          <div className="absolute -top-[2%] bottom-[5%] left-[20%] right-[-12%] z-10 flex items-end justify-center">
            <img src={artSrc} alt="" decoding="async" className="h-full w-auto max-w-none object-contain object-bottom drop-shadow-[0_12px_20px_rgba(0,0,0,0.55)]" />
          </div>
        ) : (
          <span className="absolute inset-x-0 top-[14%] z-10 text-center font-display text-[48cqw] font-extrabold leading-none text-vsb-500/60" aria-hidden>
            {name.trim().charAt(0).toUpperCase() || '?'}
          </span>
        )}
        {/* the character fades into the identity panel; below it the card is solid */}
        <div className="absolute inset-x-0 top-[44%] z-[15] h-[19%] bg-gradient-to-b from-transparent via-ink/80 to-ink" aria-hidden />
        <div className="absolute inset-x-0 bottom-0 top-[62.5%] z-[15] bg-ink" aria-hidden />

        {/* position + VSB mark, upper left */}
        <div className="absolute left-[8%] top-[7%] z-20 flex flex-col items-start" aria-hidden>
          <span className="font-display text-[13cqw] font-extrabold leading-[0.85] text-chalk drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">{abbr ?? '-'}</span>
          <span className="mt-[1.5cqw] h-[0.6cqw] w-[9cqw] bg-vsb-500" />
          <VsbLogo variant="mark" className="mt-[2.5cqw] !h-[5.5cqw] drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]" sizes="120px" />
        </div>

        {/* ---- IDENTITY ---- */}
        <div className="absolute inset-x-[5%] top-[61%] z-20 bg-vsb-500/70 p-px" style={{ clipPath: PLATE }}>
          <div className="bg-ink px-[6cqw] py-[2.2cqw] text-center" style={{ clipPath: PLATE }}>
            <figcaption className="truncate font-display text-[10.5cqw] font-extrabold uppercase leading-none tracking-wide text-chalk">{name}</figcaption>
            {subtitle ? (
              <p className="mt-[1.4cqw] truncate text-[3.3cqw] text-slate-300">{subtitle}</p>
            ) : (
              <p className="mt-[1.6cqw] flex items-center justify-center gap-[2.5cqw] font-display text-[3.6cqw] font-bold uppercase tracking-[0.12em] text-slate-200">
                <span className="inline-flex min-w-0 items-center gap-[1.2cqw]">
                  <Target className="h-[3.6cqw] w-[3.6cqw] flex-shrink-0 text-vsb-400" aria-hidden />
                  <span className="truncate">{position === 'Flexible / Any Position' ? t('v2.card.flexible') : position ? t(POSITION_KEY[position]) : t('v2.whosPlaying.noPosition')}</span>
                </span>
                {skill && (
                  <>
                    <span className="h-[3.6cqw] w-px bg-ink-500" aria-hidden />
                    <span className="inline-flex flex-shrink-0 items-center gap-[1.2cqw]">
                      <Shield className="h-[3.6cqw] w-[3.6cqw] text-vsb-400" aria-hidden />
                      {t(SKILL_LEVEL_KEY[skill])}
                    </span>
                  </>
                )}
              </p>
            )}
          </div>
        </div>

        {/* ---- ACTIVITY + YOUR GAME ---- */}
        <div className="absolute inset-x-[10%] top-[76%] z-20 flex flex-col items-center text-center">
          {games !== null && (
            <p className="flex items-baseline gap-[1.6cqw] font-display uppercase leading-none">
              <span className="text-[10cqw] font-extrabold text-chalk">{games}</span>
              <span className="text-[3.6cqw] font-bold tracking-[0.2em] text-slate-300">{t('v2.card.gamesLabel', { count: games })}</span>
            </p>
          )}
          {shownTags.length > 0 && (
            <ul className="mt-[2cqw] flex flex-wrap justify-center gap-[1.5cqw]">
              {shownTags.map((tag) => (
                <li key={tag} className="border border-vsb-500/50 px-[2cqw] py-[0.6cqw] font-display text-[3.2cqw] font-bold uppercase tracking-[0.14em] text-vsb-200">{tag}</li>
              ))}
            </ul>
          )}
        </div>
        <p className="absolute inset-x-0 bottom-[5.5%] z-20 text-center font-display text-[2.4cqw] font-bold uppercase tracking-[0.35em] text-chalk/55" aria-hidden>
          {t('v2.card.tagline')}
        </p>
      </div>
    </figure>
  );
}
