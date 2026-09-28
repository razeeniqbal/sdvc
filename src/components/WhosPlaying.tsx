import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import type { CourtPlayer } from '@/lib/sessions';
import type { BookingStatus, Gender } from '@/types/database';
import { POSITION_ABBR, POSITION_KEY } from '@/lib/volleyball';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { StatusBadge } from '@/components/StatusBadge';

// Who's Playing (PRD §9). A social roster drawn on the VSB court — NOT a claim
// about the actual match rotation. Players and open slots are overlaid live;
// the court artwork carries no data.

type GenderFilter = 'all' | 'male' | 'female' | 'unspecified';

const matches = (g: Gender | null, f: GenderFilter) =>
  f === 'all' || (f === 'male' && g === 'Male') || (f === 'female' && g === 'Female') || (f === 'unspecified' && !g);

type Slot = { kind: 'player'; player: CourtPlayer } | { kind: 'open' };

// Split slots across the two sides of the net, alternating so a half-full
// session looks like two teams filling up rather than one full side.
function splitHalves(slots: Slot[]): [Slot[], Slot[]] {
  const a: Slot[] = [];
  const b: Slot[] = [];
  slots.forEach((s, i) => (i % 2 === 0 ? a : b).push(s));
  return [a, b];
}

export function WhosPlaying({ players, capacity }: { players: CourtPlayer[]; capacity: number }) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<GenderFilter>('all');
  const [view, setView] = useState<'court' | 'list'>('court');

  const counts: Record<GenderFilter, number> = {
    all: players.length,
    male: players.filter((p) => p.gender === 'Male').length,
    female: players.filter((p) => p.gender === 'Female').length,
    unspecified: players.filter((p) => !p.gender).length,
  };
  const filters: { key: GenderFilter; label: string }[] = [
    { key: 'all', label: t('v2.whosPlaying.filterAll') },
    { key: 'male', label: t('common.genderMale') },
    { key: 'female', label: t('common.genderFemale') },
    { key: 'unspecified', label: t('v2.whosPlaying.filterUnspecified') },
  ];

  const visible = players.filter((p) => matches(p.gender, filter));
  // Open slots only make sense against the whole roster, not a filtered subset.
  const openCount = filter === 'all' ? Math.max(0, capacity - players.length) : 0;
  const slots: Slot[] = [
    ...visible.map((player) => ({ kind: 'player' as const, player })),
    ...Array.from({ length: openCount }, () => ({ kind: 'open' as const })),
  ];
  const [sideA, sideB] = splitHalves(slots);

  return (
    <section aria-labelledby="whos-playing-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="whos-playing-heading" className="v2-heading text-2xl sm:text-3xl">
          {t('v2.whosPlaying.title')} <span className="text-muted">({players.length}/{capacity})</span>
        </h2>
        <div className="inline-flex rounded-lg border border-ink-500 bg-ink-850 p-0.5 text-xs font-bold" role="group" aria-label={t('v2.whosPlaying.viewLabel')}>
          {(['court', 'list'] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} aria-pressed={view === v}
              className={`rounded-md px-3 py-1.5 transition-colors ${view === v ? 'bg-chalk text-ink' : 'text-slate-400 hover:text-white'}`}>
              {v === 'court' ? t('v2.whosPlaying.courtView') : t('v2.whosPlaying.listView')}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={t('v2.whosPlaying.filterLabel')}>
        {filters.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)} aria-pressed={filter === f.key}
            className={`rounded-full border px-3 py-1 text-sm font-semibold transition-colors ${
              filter === f.key ? 'border-vsb-600 bg-vsb-600 text-white' : 'border-ink-500 text-slate-300 hover:border-vsb-400 hover:text-white'
            }`}>
            {f.label} <span className={filter === f.key ? 'text-white' : 'text-muted'}>({counts[f.key]})</span>
          </button>
        ))}
      </div>

      {view === 'court' ? (
        <>
          {/* Desktop / tablet: horizontal court, one side of the net per half. */}
          <div className="relative mt-4 hidden overflow-hidden rounded-2xl border border-ink-600 sm:block">
            <img src="/brand/court-horizontal.webp" alt="" width={973} height={335} loading="lazy" className="block h-auto w-full" />
            <div className="absolute inset-y-[10%] left-[16%] right-[53%]"><CourtHalf slots={sideA} /></div>
            <div className="absolute inset-y-[10%] left-[49%] right-[20%]"><CourtHalf slots={sideB} /></div>
          </div>

          {/* Mobile: vertical court, halves above and below the net. */}
          <div className="relative mt-4 overflow-hidden rounded-2xl border border-ink-600 sm:hidden">
            <img src="/brand/court-vertical.webp" alt="" width={374} height={344} loading="lazy" className="block h-auto min-h-[440px] w-full object-cover" />
            <div className="absolute inset-x-[3%] top-[3%] bottom-[52%]"><CourtHalf slots={sideA} /></div>
            <div className="absolute inset-x-[3%] top-[52%] bottom-[3%]"><CourtHalf slots={sideB} /></div>
          </div>

          <p className="mt-2 text-xs text-muted">{t('v2.whosPlaying.notRotation')}</p>
        </>
      ) : (
        <ul className="mt-4 divide-y divide-ink-600 rounded-2xl border border-ink-600 bg-ink-800">
          {visible.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted">{t('v2.whosPlaying.nobody')}</li>}
          {visible.map((p, i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-3">
              <PlayerAvatar name={p.display_name} guest={p.is_guest} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-chalk">{p.display_name}</p>
                <p className="text-xs text-slate-400">
                  {[
                    p.is_guest ? t('v2.whosPlaying.guest') : p.playing_position ? t(POSITION_KEY[p.playing_position]) : null,
                    p.gender ? (p.gender === 'Male' ? t('common.genderMale') : t('common.genderFemale')) : t('v2.whosPlaying.filterUnspecified'),
                  ].filter(Boolean).join(' · ')}
                </p>
              </div>
              <StatusBadge status={p.booking_status as BookingStatus} />
            </li>
          ))}
        </ul>
      )}

      {filter !== 'all' && view === 'court' && visible.length === 0 && (
        <p className="mt-2 text-sm text-slate-400">{t('v2.whosPlaying.nobody')}</p>
      )}
    </section>
  );
}

function CourtHalf({ slots }: { slots: Slot[] }) {
  const cols = slots.length <= 4 ? 2 : slots.length <= 9 ? 3 : 4;
  return (
    <ul className="grid h-full w-full content-center items-start justify-items-center gap-y-1" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {slots.map((s, i) => (
        <li key={i} className="flex w-full justify-center">
          {s.kind === 'player' ? <PlayerMarker player={s.player} /> : <OpenMarker />}
        </li>
      ))}
    </ul>
  );
}

function PlayerMarker({ player }: { player: CourtPlayer }) {
  const { t } = useTranslation();
  const pos = !player.is_guest && player.playing_position ? POSITION_ABBR[player.playing_position] : null;
  const genderLabel = player.gender === 'Male' ? t('common.genderMale') : player.gender === 'Female' ? t('common.genderFemale') : null;
  const description = [
    player.display_name,
    player.is_guest ? t('v2.whosPlaying.guest') : player.playing_position ? t(POSITION_KEY[player.playing_position]) : null,
    genderLabel,
  ].filter(Boolean).join(', ');

  return (
    <div className="flex w-full max-w-[84px] flex-col items-center" aria-label={description} role="img">
      <div className="relative">
        <PlayerAvatar name={player.display_name} guest={player.is_guest} size="md" className="!h-10 !w-10 sm:!h-11 sm:!w-11 !ring-ink/80 shadow-md" />
        {player.gender && (
          <span
            className={`absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold leading-none ring-2 ring-ink ${
              player.gender === 'Male' ? 'bg-vsb-600 text-white' : 'bg-pink-400 text-ink'
            }`}
            aria-hidden
          >
            {player.gender === 'Male' ? '♂' : '♀'}
          </span>
        )}
      </div>
      <div className="mt-0.5 w-full rounded bg-ink/85 px-1 py-px text-center leading-tight" aria-hidden>
        <p className="truncate text-[11px] font-bold text-chalk">{player.display_name}</p>
        {(player.is_guest || pos) && (
          <p className="font-display text-[10px] font-bold tracking-wide text-vsb-300">{player.is_guest ? t('v2.whosPlaying.guestShort') : pos}</p>
        )}
      </div>
    </div>
  );
}

function OpenMarker() {
  const { t } = useTranslation();
  return (
    <div className="flex w-full max-w-[84px] flex-col items-center" role="img" aria-label={t('v2.whosPlaying.openSlot')}>
      <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-chalk/60 bg-ink/40 text-chalk sm:h-11 sm:w-11" aria-hidden>
        <Plus className="h-4 w-4" />
      </span>
      <span className="mt-0.5 rounded bg-ink/70 px-1.5 text-[11px] font-semibold text-chalk/80" aria-hidden>{t('v2.whosPlaying.open')}</span>
    </div>
  );
}
