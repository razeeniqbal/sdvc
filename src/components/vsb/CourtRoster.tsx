import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import type { CourtPlayer } from '@/lib/sessions';
import { POSITION_ABBR, POSITION_KEY } from '@/lib/volleyball';
import { vsbAssets } from '@/lib/vsbAssets';
import { GENDER_BADGE, GENDER_RING, GENDER_SYMBOL } from '@/lib/gender';
import { PlayerAvatar } from '@/components/PlayerAvatar';

// Who's Playing on the production VSB court. A social picture of who's in,
// never a claim about rotation or teams. Players sit on the measured playing
// area of the artwork (vsbAssets.roster), filling both sides of the net
// from the front row back. Only real players are drawn; open places appear
// only for real remaining capacity; anyone past the court limit sits on the
// row underneath.

type Orientation = 'horizontal' | 'vertical';
interface Pt { x: number; y: number }

const MAX_ON_COURT: Record<Orientation, number> = { horizontal: 24, vertical: 18 };

// Middle row first, then the edges, so a few players look centred.
const rowOrder = (n: number) => (n === 3 ? [1, 0, 2] : n === 4 ? [1, 2, 0, 3] : Array.from({ length: n }, (_, i) => i));

// `total` spots, alternating side A / side B.
function layout(o: Orientation, total: number): Pt[] {
  const { court, net } = vsbAssets.roster[o];
  const perSide = Math.ceil(total / 2);
  const a: Pt[] = [];
  const b: Pt[] = [];

  if (o === 'horizontal') {
    const rows = Math.min(3, Math.max(1, perSide));
    const cols = Math.ceil(perSide / rows);
    const ys = rowOrder(rows).map((r) => court.y0 + ((r + 0.5) * (court.y1 - court.y0)) / rows);
    for (let c = 0; c < cols; c++) {
      for (const y of ys) {
        a.push({ x: net - ((c + 0.5) * (net - court.x0)) / cols, y });
        b.push({ x: net + ((c + 0.5) * (court.x1 - net)) / cols, y });
      }
    }
  } else {
    const cols = Math.min(3, Math.max(1, perSide));
    const rows = Math.ceil(perSide / cols);
    const xs = rowOrder(cols).map((c) => court.x0 + ((c + 0.5) * (court.x1 - court.x0)) / cols);
    for (let r = 0; r < rows; r++) {
      for (const x of xs) {
        a.push({ x, y: net - ((r + 0.5) * (net - court.y0)) / rows });
        b.push({ x, y: net + ((r + 0.5) * (court.y1 - net)) / rows });
      }
    }
  }
  return a.slice(0, perSide).flatMap((p, i) => (b[i] ? [p, b[i]] : [p])).slice(0, total);
}

export type RosterItem = { player: CourtPlayer; index: number };

interface CourtRosterProps {
  items: RosterItem[];
  /** Real places still free (0 when a filter is active). */
  openCount: number;
  selected: number | null;
  onSelect: (index: number) => void;
  orientation: Orientation;
  className?: string;
}

export function CourtRoster({ items, openCount, selected, onSelect, orientation, className = '' }: CourtRosterProps) {
  const { t } = useTranslation();
  const max = MAX_ON_COURT[orientation];
  const onCourt = items.slice(0, max);
  const bench = items.slice(max);
  const openOnCourt = Math.min(openCount, max - onCourt.length);
  const openElsewhere = openCount - openOnCourt;
  const pts = layout(orientation, onCourt.length + openOnCourt);
  const { image } = vsbAssets.roster[orientation];
  const compact = orientation === 'vertical';

  return (
    <div className={className}>
      <div className="relative w-full overflow-hidden border border-ink-600" style={{ aspectRatio: `${image.width} / ${image.height}` }}>
        <img src={image.src} alt="" width={image.width} height={image.height} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full" />
        <ul className="absolute inset-0">
          {onCourt.map(({ player, index }, i) => (
            <li key={index} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${pts[i].x}%`, top: `${pts[i].y}%` }}>
              <PlayerMarker player={player} pressed={selected === index} onClick={() => onSelect(index)} delay={i * 30} compact={compact} />
            </li>
          ))}
          {Array.from({ length: openOnCourt }, (_, i) => {
            const p = pts[onCourt.length + i];
            return (
              <li key={`open-${i}`} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
                <OpenMarker compact={compact} />
              </li>
            );
          })}
        </ul>
      </div>

      {(bench.length > 0 || openElsewhere > 0) && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-ink-600 pb-3">
          {bench.length > 0 && <span className="vsb-meta">{t('v2.whosPlaying.bench', { count: bench.length })}</span>}
          {bench.map(({ player, index }) => (
            <button key={index} type="button" onClick={() => onSelect(index)} aria-pressed={selected === index}
              className={`flex items-center gap-2 py-1 pr-2 text-sm font-semibold text-chalk hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vsb-400 ${selected === index ? 'underline decoration-vsb-500 decoration-2 underline-offset-4' : ''}`}>
              <PlayerAvatar name={player.display_name} src={player.avatar_url} guest={player.is_guest} size="xs" className={player.gender ? GENDER_RING[player.gender] : ''} />
              {player.display_name}
            </button>
          ))}
          {openElsewhere > 0 && (
            <span className="font-display text-sm font-bold uppercase tracking-wider text-muted">{t('v2.whosPlaying.moreOpen', { count: openElsewhere })}</span>
          )}
        </div>
      )}
    </div>
  );
}

function PlayerMarker({ player, pressed, onClick, delay, compact }: { player: CourtPlayer; pressed: boolean; onClick: () => void; delay: number; compact: boolean }) {
  const { t } = useTranslation();
  const pos = !player.is_guest && player.playing_position ? POSITION_ABBR[player.playing_position] : null;
  const genderText = player.gender === 'Male' ? t('common.genderMale') : player.gender === 'Female' ? t('common.genderFemale') : null;
  const description = [
    player.display_name,
    player.is_guest ? t('v2.whosPlaying.guest') : player.playing_position ? t(POSITION_KEY[player.playing_position]) : null,
    genderText,
  ].filter(Boolean).join(', ');
  const tag = player.is_guest ? t('v2.whosPlaying.guestShort') : pos;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      aria-label={description}
      className={`animate-pop group flex flex-col items-center focus-visible:outline-none ${compact ? 'w-[4.5rem]' : 'w-24'}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className={`relative rounded-full transition-transform group-hover:scale-105 group-focus-visible:ring-2 group-focus-visible:ring-chalk ${pressed ? 'ring-2 ring-chalk ring-offset-2 ring-offset-ink' : ''}`}>
        <PlayerAvatar name={player.display_name} src={player.avatar_url} guest={player.is_guest} size="md"
          className={`shadow-lg shadow-black/50 ${compact ? '!h-9 !w-9' : '!h-11 !w-11 2xl:!h-12 2xl:!w-12'} ${player.gender ? GENDER_RING[player.gender] : '!ring-ink/80'}`} />
        {player.gender && (
          <span className={`absolute -right-1.5 -top-1 flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold leading-none ring-2 ring-ink ${GENDER_BADGE[player.gender]}`} aria-hidden>
            {GENDER_SYMBOL[player.gender]}
          </span>
        )}
      </span>
      <span className={`mt-1 flex max-w-full items-baseline gap-1 bg-ink/90 px-1.5 py-0.5 leading-tight ${compact ? 'text-[10px]' : 'text-xs'}`} aria-hidden>
        <span className="truncate font-bold text-chalk">{player.display_name}</span>
        {tag && <span className="flex-shrink-0 font-display font-bold tracking-wider text-vsb-300">{tag}</span>}
      </span>
    </button>
  );
}

function OpenMarker({ compact }: { compact: boolean }) {
  const { t } = useTranslation();
  return (
    <div className={`flex flex-col items-center ${compact ? 'w-[4.5rem]' : 'w-24'}`} role="img" aria-label={t('v2.whosPlaying.openSlot')}>
      <span className={`flex items-center justify-center rounded-full border-2 border-dashed border-chalk/80 bg-ink/50 text-chalk ${compact ? 'h-9 w-9' : 'h-11 w-11 2xl:h-12 2xl:w-12'}`} aria-hidden>
        <Plus className="h-4 w-4" />
      </span>
      <span className="mt-1 bg-ink/80 px-1.5 font-display text-[10px] font-bold uppercase tracking-wider text-chalk" aria-hidden>{t('v2.whosPlaying.open')}</span>
    </div>
  );
}
