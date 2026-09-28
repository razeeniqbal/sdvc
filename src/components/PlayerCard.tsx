import { useTranslation } from 'react-i18next';
import type { Gender, PlayingPosition, SkillLevel } from '@/types/database';
import { POSITION_ABBR, POSITION_KEY, SKILL_LEVEL_KEY } from '@/lib/volleyball';
import { VsbLogo } from '@/components/VsbLogo';

// Collectible VSB player card (PRD §14): CSS frame + character art + live data.
// Every number here comes from real booking + attendance data — no ratings, no "overall".
// Until generated chibi art exists (Milestone 6) the art slot shows the same
// deterministic initial used everywhere else, so the card never looks broken.

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
  // Overrides the position · level · gender line (e.g. a sample card).
  subtitle?: string;
}

// Angular sports-card silhouette: clipped corners top, shield point at the bottom.
const FRAME = 'polygon(8% 0, 92% 0, 100% 5%, 100% 86%, 50% 100%, 0 86%, 0 5%)';

export function PlayerCard({ name, position, skill, gender, stats, artSrc, subtitle }: PlayerCardProps) {
  const { t } = useTranslation();
  const pos = position ? POSITION_ABBR[position] : '—';

  const statItems = [
    { label: t('v2.card.games'), value: stats?.played },
    { label: t('v2.card.attended'), value: stats?.attended },
    { label: t('v2.card.attendance'), value: stats?.attendancePct != null ? `${stats.attendancePct}%` : undefined },
  ];

  return (
    <figure
      className="relative mx-auto aspect-[5/7] w-full max-w-[320px] bg-gradient-to-b from-vsb-400 via-vsb-600 to-[#C9A36A] p-[3px] drop-shadow-[0_12px_30px_rgba(22,139,255,0.25)]"
      style={{ clipPath: FRAME }}
      aria-label={t('v2.card.ariaLabel', { name })}
    >
      <div className="relative flex h-full flex-col bg-ink-850" style={{ clipPath: FRAME }}>
        {/* court-line texture */}
        <div className="absolute inset-0 opacity-[0.07] [background-image:repeating-linear-gradient(115deg,#F4F1EA_0_1px,transparent_1px_28px)]" aria-hidden />

        <div className="relative flex items-start justify-between px-5 pt-4">
          <div className="flex h-14 w-12 flex-col items-center justify-center rounded-md border border-ink-500 bg-ink" aria-hidden>
            <span className="font-display text-xl font-extrabold leading-none text-chalk">{pos}</span>
            <span className="mt-0.5 text-[9px] font-bold uppercase tracking-widest text-muted">POS</span>
          </div>
          <VsbLogo variant="mark" className="mt-1 h-5" />
          <span className="w-12 text-right font-display text-[10px] font-bold uppercase leading-tight tracking-widest text-muted" aria-hidden>
            {t('v2.card.tagline')}
          </span>
        </div>

        {/* Character art slot */}
        <div className="relative mx-5 mt-2 flex flex-1 items-end justify-center overflow-hidden rounded-t-lg bg-vsb-900/30">
          {artSrc ? (
            <img src={artSrc} alt="" className="absolute inset-x-0 bottom-0 mx-auto h-[112%] w-auto max-w-none object-contain object-bottom" />
          ) : (
            <span className="mb-2 font-display text-[7rem] font-extrabold leading-none text-vsb-500/80" aria-hidden>
              {name.trim().charAt(0).toUpperCase() || '?'}
            </span>
          )}
        </div>

        <div className="relative -mt-3 border-y border-vsb-500/40 bg-ink px-4 py-2 text-center">
          <figcaption className="truncate font-display text-2xl font-extrabold uppercase tracking-wide text-chalk">{name}</figcaption>
          <p className="text-xs text-slate-300">
            {subtitle ?? <>{position ? t(POSITION_KEY[position]) : t('v2.whosPlaying.noPosition')}
            {skill && <> · {t(SKILL_LEVEL_KEY[skill])}</>}
            {gender && <> · {gender === 'Male' ? t('common.genderMale') : t('common.genderFemale')}</>}</>}
          </p>
        </div>

        <dl className="relative grid grid-cols-3 px-4 pb-12 pt-3 text-center">
          {statItems.map((s, i) => (
            <div key={s.label} className={`flex flex-col-reverse ${i > 0 ? 'border-l border-ink-600' : ''}`}>
              <dt className="mt-1 text-[10px] font-bold uppercase tracking-wider text-muted">{s.label}</dt>
              <dd className="font-display text-2xl font-extrabold leading-none text-chalk">{s.value ?? '–'}</dd>
            </div>
          ))}
        </dl>
      </div>
    </figure>
  );
}
