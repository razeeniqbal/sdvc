import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X } from 'lucide-react';
import type { CourtPlayer } from '@/lib/sessions';
import type { BookingStatus, Gender } from '@/types/database';
import { POSITION_ABBR, POSITION_KEY } from '@/lib/volleyball';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { StatusBadge } from '@/components/StatusBadge';

// Who's Playing (PRD §9). A social roster drawn on the VSB court — NOT a claim
// about the actual match rotation. Players and open slots are overlaid live;
// the court artwork carries no data. Gender is shown only from explicit
// profile data, always with a text label, never inferred.

type GenderFilter = 'all' | 'male' | 'female' | 'unspecified';

const matches = (g: Gender | null, f: GenderFilter) =>
  f === 'all' || (f === 'male' && g === 'Male') || (f === 'female' && g === 'Female') || (f === 'unspecified' && !g);

type Slot = { kind: 'player'; player: CourtPlayer; index: number } | { kind: 'open' };

// Alternate sides of the net so a half-full session reads as two teams filling up.
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
  const [selected, setSelected] = useState<number | null>(null);

  const genderLabel = (g: Gender | null) => (g === 'Male' ? t('common.genderMale') : g === 'Female' ? t('common.genderFemale') : t('v2.whosPlaying.filterUnspecified'));

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

  const visible = players.map((player, index) => ({ player, index })).filter(({ player }) => matches(player.gender, filter));
  // Open slots only make sense against the whole roster, not a filtered subset.
  const openCount = filter === 'all' ? Math.max(0, capacity - players.length) : 0;
  const slots: Slot[] = [
    ...visible.map(({ player, index }) => ({ kind: 'player' as const, player, index })),
    ...Array.from({ length: openCount }, () => ({ kind: 'open' as const })),
  ];
  const [sideA, sideB] = splitHalves(slots);
  const sel = selected !== null ? players[selected] : null;

  const toggle = (i: number) => setSelected((cur) => (cur === i ? null : i));

  return (
    <section aria-labelledby="whos-playing-heading">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div>
          <p className="vsb-meta mb-2">{t('v2.whosPlaying.meta')}</p>
          <h2 id="whos-playing-heading" className="vsb-display text-4xl sm:text-5xl">
            {t('v2.whosPlaying.title')} <span className="text-muted">{players.length}/{capacity}</span>
          </h2>
        </div>
        <div className="flex gap-6 border-b border-ink-600" role="group" aria-label={t('v2.whosPlaying.viewLabel')}>
          {(['court', 'list'] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} aria-pressed={view === v} className="vsb-tab">
              {v === 'court' ? t('v2.whosPlaying.courtView') : t('v2.whosPlaying.listView')}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-x-6 gap-y-1 border-b border-ink-600" role="group" aria-label={t('v2.whosPlaying.filterLabel')}>
        {filters.map((f) => (
          <button key={f.key} onClick={() => { setFilter(f.key); setSelected(null); }} aria-pressed={filter === f.key} className="vsb-tab">
            {f.label} <span className="text-muted">{counts[f.key]}</span>
          </button>
        ))}
      </div>

      {view === 'court' ? (
        <div className="mt-6">
          {/* Desktop / tablet: horizontal court. Each half sits over the floor on
              its side of the net (percentages match court-horizontal.webp). */}
          <div className="relative hidden overflow-hidden rounded-sm border border-ink-600 sm:block">
            <img src="/brand/court-horizontal.webp" alt="" width={973} height={335} loading="lazy" className="block h-auto w-full" />
            <div className="absolute inset-y-[8%] left-[16%] right-[53%]"><CourtHalf slots={sideA} selected={selected} onSelect={toggle} /></div>
            <div className="absolute inset-y-[8%] left-[49%] right-[20%]"><CourtHalf slots={sideB} selected={selected} onSelect={toggle} /></div>
          </div>

          {/* Mobile: vertical court, halves above and below the net. */}
          <div className="relative overflow-hidden rounded-sm border border-ink-600 sm:hidden">
            <img src="/brand/court-vertical.webp" alt="" width={374} height={344} loading="lazy" className="block h-auto min-h-[460px] w-full object-cover" />
            <div className="absolute inset-x-[3%] top-[3%] bottom-[52%]"><CourtHalf slots={sideA} selected={selected} onSelect={toggle} /></div>
            <div className="absolute inset-x-[3%] top-[52%] bottom-[3%]"><CourtHalf slots={sideB} selected={selected} onSelect={toggle} /></div>
          </div>

          {/* Player preview — only what's visible about a player under current privacy rules */}
          <div aria-live="polite">
            {sel && (
              <div className="animate-pop mt-4 flex items-center gap-4 border border-ink-600 bg-ink-800 p-4">
                <PlayerAvatar name={sel.display_name} src={sel.avatar_url} guest={sel.is_guest} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-2xl font-extrabold uppercase leading-none text-chalk">{sel.display_name}</p>
                  <p className="mt-1 text-sm text-slate-300">
                    {[
                      sel.is_guest ? t('v2.whosPlaying.guest') : sel.playing_position ? t(POSITION_KEY[sel.playing_position]) : null,
                      genderLabel(sel.gender),
                    ].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <StatusBadge status={sel.booking_status as BookingStatus} />
                <button onClick={() => setSelected(null)} aria-label={t('v2.whosPlaying.closePreview')} className="p-1 text-muted hover:text-chalk">
                  <X className="h-5 w-5" />
                </button>
              </div>
            )}
          </div>

          <p className="mt-3 text-xs text-muted">{t('v2.whosPlaying.notRotation')} {t('v2.whosPlaying.tapHint')}</p>
          {filter !== 'all' && visible.length === 0 && <p className="mt-2 text-sm text-slate-400">{t('v2.whosPlaying.nobody')}</p>}
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-ink-600 border-y border-ink-600">
          {visible.length === 0 && <li className="py-6 text-sm text-muted">{t('v2.whosPlaying.nobody')}</li>}
          {visible.map(({ player: p }, i) => (
            <li key={i} className="flex items-center gap-4 py-3">
              <span className="w-6 text-right font-display text-lg font-bold text-muted">{i + 1}</span>
              <PlayerAvatar name={p.display_name} src={p.avatar_url} guest={p.is_guest} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-chalk">{p.display_name}</p>
                <p className="text-xs text-slate-400">
                  {[
                    p.is_guest ? t('v2.whosPlaying.guest') : p.playing_position ? t(POSITION_KEY[p.playing_position]) : null,
                    genderLabel(p.gender),
                  ].filter(Boolean).join(' · ')}
                </p>
              </div>
              <StatusBadge status={p.booking_status as BookingStatus} />
            </li>
          ))}
          {filter === 'all' && openCount > 0 && (
            <li className="py-3 font-display text-sm font-bold uppercase tracking-wider text-muted">{t('v2.whosPlaying.openCount', { count: openCount })}</li>
          )}
        </ul>
      )}
    </section>
  );
}

function CourtHalf({ slots, selected, onSelect }: { slots: Slot[]; selected: number | null; onSelect: (i: number) => void }) {
  const cols = slots.length <= 4 ? 2 : slots.length <= 9 ? 3 : 4;
  return (
    <ul className="grid h-full w-full content-center items-start justify-items-center gap-y-1 lg:gap-y-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {slots.map((s, i) => (
        <li key={i} className="flex w-full justify-center">
          {s.kind === 'player'
            ? <PlayerMarker player={s.player} pressed={selected === s.index} onClick={() => onSelect(s.index)} delay={i * 30} />
            : <OpenMarker />}
        </li>
      ))}
    </ul>
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
      className="animate-pop group flex w-full max-w-[96px] flex-col items-center focus-visible:outline-none"
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className={`relative rounded-full transition-transform group-hover:scale-105 group-focus-visible:ring-2 group-focus-visible:ring-vsb-300 ${pressed ? 'ring-2 ring-vsb-400 ring-offset-2 ring-offset-ink' : ''}`}>
        <PlayerAvatar name={player.display_name} src={player.avatar_url} guest={player.is_guest} size="md" className="!h-10 !w-10 sm:!h-12 sm:!w-12 xl:!h-14 xl:!w-14 !ring-ink/80 shadow-lg shadow-black/40" />
        {player.gender && (
          <span
            className={`absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold leading-none ring-2 ring-ink ${
              player.gender === 'Male' ? 'bg-vsb-600 text-white' : 'bg-pink-400 text-ink'
            }`}
            aria-hidden
          >
            {player.gender === 'Male' ? '♂' : '♀'}
          </span>
        )}
      </span>
      <span className="mt-1 w-full bg-ink/90 px-1 py-0.5 text-center leading-tight" aria-hidden>
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
    <div className="flex w-full max-w-[96px] flex-col items-center" role="img" aria-label={t('v2.whosPlaying.openSlot')}>
      <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-chalk/60 bg-ink/40 text-chalk sm:h-12 sm:w-12 xl:h-14 xl:w-14" aria-hidden>
        <Plus className="h-4 w-4" />
      </span>
      <span className="mt-1 bg-ink/70 px-1.5 font-display text-xs font-bold uppercase tracking-wider text-chalk/80" aria-hidden>{t('v2.whosPlaying.open')}</span>
    </div>
  );
}
