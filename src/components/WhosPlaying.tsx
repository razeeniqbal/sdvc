import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import type { CourtPlayer, WaitlistPlayer } from '@/lib/sessions';
import type { BookingStatus, Gender } from '@/types/database';
import { POSITION_KEY } from '@/lib/volleyball';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { StatusBadge } from '@/components/StatusBadge';
import { CourtRoster } from '@/components/vsb/CourtRoster';
import { GENDER_BADGE, GENDER_RING, GENDER_SYMBOL } from '@/lib/gender';

// Who's Playing (PRD §9). A social roster drawn on the VSB court — NOT a claim
// about the actual match rotation. Players and open slots are overlaid live;
// the court artwork carries no data. Gender is shown only from explicit
// profile data, always with a text label, never inferred.

type GenderFilter = 'all' | 'male' | 'female' | 'unspecified';

const matches = (g: Gender | null, f: GenderFilter) =>
  f === 'all' || (f === 'male' && g === 'Male') || (f === 'female' && g === 'Female') || (f === 'unspecified' && !g);

export function WhosPlaying({ players, capacity, waiting = [] }: { players: CourtPlayer[]; capacity: number; waiting?: WaitlistPlayer[] }) {
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
            {(f.key === 'male' || f.key === 'female') && (
              <span className={`mr-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${GENDER_BADGE[f.key === 'male' ? 'Male' : 'Female']}`} aria-hidden>
                {GENDER_SYMBOL[f.key === 'male' ? 'Male' : 'Female']}
              </span>
            )}
            {f.label} <span className="text-muted">{counts[f.key]}</span>
          </button>
        ))}
      </div>

      {view === 'court' ? (
        <div className="mt-6">
          <CourtRoster orientation="horizontal" className="hidden sm:block" items={visible} openCount={openCount} selected={selected} onSelect={toggle} />
          <CourtRoster orientation="vertical" className="sm:hidden" items={visible} openCount={openCount} selected={selected} onSelect={toggle} />

          {/* Player preview — only what's visible about a player under current privacy rules */}
          <div aria-live="polite">
            {sel && (
              <div className="animate-pop mt-4 flex items-center gap-4 border border-ink-600 bg-ink-800 p-4">
                <PlayerAvatar name={sel.display_name} src={sel.avatar_url} guest={sel.is_guest} size="md" className={sel.gender ? GENDER_RING[sel.gender] : ''} />
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
              <PlayerAvatar name={p.display_name} src={p.avatar_url} guest={p.is_guest} size="sm" className={p.gender ? GENDER_RING[p.gender] : ''} />
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

      {/* Waiting list: who's queued, in order. Places go to them automatically. */}
      {waiting.length > 0 && (
        <div className="mt-10" aria-labelledby="waitlist-heading">
          <h3 id="waitlist-heading" className="flex items-baseline gap-3 font-display text-2xl font-extrabold uppercase tracking-wide text-chalk">
            {t('v2.whosPlaying.waitingTitle')} <span className="text-base font-bold text-ball">{waiting.length}</span>
          </h3>
          <p className="mt-1 text-sm text-muted">{t('v2.whosPlaying.waitingHint')}</p>
          <ol className="mt-4 grid border-l border-t border-ink-600 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {waiting.map((w) => (
              <li key={w.queue_number} className={`flex items-center gap-3 border-b border-r border-ink-600 px-4 py-3 ${w.is_me ? 'bg-ball/10' : ''}`}>
                <span className="w-7 font-display text-2xl font-extrabold leading-none text-ball">{w.queue_number}</span>
                <PlayerAvatar name={w.display_name} src={w.avatar_url} size="sm" className={w.gender ? GENDER_RING[w.gender] : ''} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-baseline gap-2">
                    <span className="truncate font-semibold text-chalk">{w.display_name}</span>
                    {w.is_me && <span className="font-display text-xs font-bold uppercase tracking-wider text-ball">{t('v2.community.you')}</span>}
                  </p>
                  <p className="text-xs text-slate-400">
                    {[w.playing_position ? t(POSITION_KEY[w.playing_position]) : null, genderLabel(w.gender)].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
