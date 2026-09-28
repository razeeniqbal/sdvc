import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import type { CourtPlayer } from '@/lib/sessions';
import { POSITION_ABBR, POSITION_KEY } from '@/lib/volleyball';
import { PlayerAvatar } from '@/components/PlayerAvatar';

// A social picture of who's in — drawn on a clean UI court, never a claim
// about rotation or teams. Coordinates are normalised (0–100 on each axis) so
// the same layout works at any size. Only real players are drawn; open places
// appear only for real remaining capacity; anyone beyond the 12 court spots
// sits on the bench row underneath.

type Orientation = 'horizontal' | 'vertical';
interface Pt { x: number; y: number }

// Six spots per side: front row (by the net) first, middle out, then back row.
// Horizontal court: net at x = 50. Side A left, side B right.
const H_A: Pt[] = [
  { x: 40, y: 50 }, { x: 40, y: 22 }, { x: 40, y: 78 },
  { x: 18, y: 50 }, { x: 18, y: 22 }, { x: 18, y: 78 },
];
const mirrorX = (p: Pt): Pt => ({ x: 100 - p.x, y: p.y });
// Vertical court (phones): net at y = 50. Side A top, side B bottom.
const toVertical = (p: Pt): Pt => ({ x: p.y, y: p.x });
const mirrorY = (p: Pt): Pt => ({ x: p.x, y: 100 - p.y });

// Alternate sides so a half-full game reads as two sides filling up.
function spots(o: Orientation): Pt[] {
  const a = o === 'horizontal' ? H_A : H_A.map(toVertical);
  const b = o === 'horizontal' ? H_A.map(mirrorX) : H_A.map(toVertical).map(mirrorY);
  return a.flatMap((p, i) => [p, b[i]]);
}

export const COURT_SPOTS = 12;

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
  const pts = spots(orientation);
  const onCourt = items.slice(0, COURT_SPOTS);
  const bench = items.slice(COURT_SPOTS);
  const openOnCourt = Math.min(openCount, COURT_SPOTS - onCourt.length);
  const openElsewhere = openCount - openOnCourt;

  return (
    <div className={className}>
      <div className={`relative w-full overflow-hidden border border-ink-600 ${orientation === 'horizontal' ? 'aspect-[2/1]' : 'aspect-[5/8]'}`}>
        <UiCourt orientation={orientation} />
        <ul className="absolute inset-0">
          {onCourt.map(({ player, index }, i) => (
            <li key={index} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${pts[i].x}%`, top: `${pts[i].y}%` }}>
              <PlayerMarker player={player} pressed={selected === index} onClick={() => onSelect(index)} delay={i * 30} />
            </li>
          ))}
          {Array.from({ length: openOnCourt }, (_, i) => {
            const p = pts[onCourt.length + i];
            return (
              <li key={`open-${i}`} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
                <OpenMarker />
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
              <PlayerAvatar name={player.display_name} src={player.avatar_url} seed={player.user_id} guest={player.is_guest} size="xs" />
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

// Flat court diagram: free zone, court, attack lines, net. Pure geometry.
function UiCourt({ orientation }: { orientation: Orientation }) {
  const h = orientation === 'horizontal';
  const [W, H] = h ? [200, 100] : [100, 160];
  // playing area (18 m × 9 m) inside a free zone
  const court = h ? { x: 12, y: 8, w: 176, h: 84 } : { x: 8, y: 10, w: 84, h: 140 };
  const attack = (h ? court.w : court.h) / 6; // 3 m of the 9 m half
  const mid = h ? court.x + court.w / 2 : court.y + court.h / 2;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
      <rect width={W} height={H} fill="#0E1219" />
      <rect x={court.x} y={court.y} width={court.w} height={court.h} fill="#0B2848" />
      {/* front zones, a shade lighter */}
      {h ? (
        <rect x={mid - attack} y={court.y} width={attack * 2} height={court.h} fill="#0D3056" />
      ) : (
        <rect x={court.x} y={mid - attack} width={court.w} height={attack * 2} fill="#0D3056" />
      )}
      <g stroke="#F4F1EA" strokeOpacity="0.55" strokeWidth="0.6" fill="none" vectorEffect="non-scaling-stroke">
        <rect x={court.x} y={court.y} width={court.w} height={court.h} />
        {h ? (
          <>
            <line x1={mid - attack} y1={court.y} x2={mid - attack} y2={court.y + court.h} />
            <line x1={mid + attack} y1={court.y} x2={mid + attack} y2={court.y + court.h} />
          </>
        ) : (
          <>
            <line x1={court.x} y1={mid - attack} x2={court.x + court.w} y2={mid - attack} />
            <line x1={court.x} y1={mid + attack} x2={court.x + court.w} y2={mid + attack} />
          </>
        )}
      </g>
      {/* net */}
      {h
        ? <line x1={mid} y1={court.y - 4} x2={mid} y2={court.y + court.h + 4} stroke="#168BFF" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
        : <line x1={court.x - 4} y1={mid} x2={court.x + court.w + 4} y2={mid} stroke="#168BFF" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />}
    </svg>
  );
}

function PlayerMarker({ player, pressed, onClick, delay }: { player: CourtPlayer; pressed: boolean; onClick: () => void; delay: number }) {
  const { t } = useTranslation();
  const pos = !player.is_guest && player.playing_position ? POSITION_ABBR[player.playing_position] : null;
  const genderText = player.gender === 'Male' ? t('common.genderMale') : player.gender === 'Female' ? t('common.genderFemale') : null;
  const description = [
    player.display_name,
    player.is_guest ? t('v2.whosPlaying.guest') : player.playing_position ? t(POSITION_KEY[player.playing_position]) : null,
    genderText,
  ].filter(Boolean).join(', ');

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      aria-label={description}
      className="animate-pop group flex w-[4.5rem] flex-col items-center focus-visible:outline-none sm:w-20 xl:w-24"
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className={`relative rounded-full transition-transform group-hover:scale-105 group-focus-visible:ring-2 group-focus-visible:ring-vsb-300 ${pressed ? 'ring-2 ring-vsb-400 ring-offset-2 ring-offset-ink' : ''}`}>
        <PlayerAvatar name={player.display_name} src={player.avatar_url} seed={player.user_id} guest={player.is_guest} size="md"
          className="!h-10 !w-10 !ring-ink/80 sm:!h-12 sm:!w-12 xl:!h-14 xl:!w-14" />
        {player.gender && (
          <span
            className={`absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold leading-none ring-2 ring-ink ${
              player.gender === 'Male' ? 'bg-vsb-600 text-white' : 'bg-chalk text-ink'
            }`}
            aria-hidden
          >
            {player.gender === 'Male' ? '♂' : '♀'}
          </span>
        )}
      </span>
      <span className="mt-1 max-w-full bg-ink/85 px-1.5 py-0.5 text-center leading-tight" aria-hidden>
        <span className="block truncate text-[11px] font-bold text-chalk sm:text-xs">{player.display_name}</span>
        {(player.is_guest || pos) && (
          <span className="block font-display text-[11px] font-bold tracking-wider text-vsb-300">{player.is_guest ? t('v2.whosPlaying.guestShort') : pos}</span>
        )}
      </span>
    </button>
  );
}

function OpenMarker() {
  const { t } = useTranslation();
  return (
    <div className="flex w-[4.5rem] flex-col items-center sm:w-20 xl:w-24" role="img" aria-label={t('v2.whosPlaying.openSlot')}>
      <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-chalk/40 text-chalk/70 sm:h-12 sm:w-12 xl:h-14 xl:w-14" aria-hidden>
        <Plus className="h-4 w-4" />
      </span>
      <span className="mt-1 font-display text-[11px] font-bold uppercase tracking-wider text-chalk/60" aria-hidden>{t('v2.whosPlaying.open')}</span>
    </div>
  );
}
