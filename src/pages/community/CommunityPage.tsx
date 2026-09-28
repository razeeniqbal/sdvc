import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Search } from 'lucide-react';
import { fetchCommunity, type CommunityPlayer } from '@/lib/community';
import { PLAYING_POSITIONS, POSITION_ABBR, POSITION_KEY, SKILL_LEVELS, SKILL_LEVEL_KEY } from '@/lib/volleyball';
import { formatDateLocale } from '@/lib/format';
import { vsbAssets } from '@/lib/vsbAssets';
import { playstyleKey, type Playstyle } from '@/lib/yourGame';
import type { PlayingPosition, SkillLevel } from '@/types/database';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { Spinner } from '@/components/LoadingScreen';

// Community: the real people of VSB. Every row is a member (never illustration
// characters standing in for people); the header lineup is decorative art.

type PosFilter = 'all' | PlayingPosition;
type LevelFilter = 'all' | SkillLevel;

export default function CommunityPage() {
  const { t, i18n } = useTranslation();
  const [players, setPlayers] = useState<CommunityPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState('');
  const [pos, setPos] = useState<PosFilter>('all');
  const [level, setLevel] = useState<LevelFilter>('all');

  useEffect(() => {
    fetchCommunity().then(setPlayers).catch(() => setError(true)).finally(() => setLoading(false));
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return players.filter((p) =>
      (!q || p.display_name.toLowerCase().includes(q)) &&
      (pos === 'all' || p.playing_position === pos) &&
      (level === 'all' || p.skill_level === level));
  }, [players, query, pos, level]);

  const me = players.find((p) => p.is_me);
  const others = players.filter((p) => !p.is_me).length;
  const playingSoon = players.filter((p) => p.next_session_id).length;
  const lang = i18n.language;

  return (
    <div className="bg-ink text-chalk">
      {/* Header */}
      <section className="relative overflow-hidden border-b border-ink-600">
        <div className="vsb-gutter relative grid items-end gap-8 pt-12 lg:grid-cols-[1fr_auto] lg:pt-16">
          <div className="pb-10 lg:pb-14">
            <p className="vsb-meta mb-3 !text-vsb-400">{t('v2.community.meta')}</p>
            <h1 className="vsb-display text-5xl sm:text-6xl lg:text-7xl">{t('v2.community.title')}</h1>
            <p className="mt-4 max-w-xl text-lg text-slate-300">{t('v2.community.intro')}</p>
            {!loading && !error && (
              <dl className="mt-8 flex gap-10">
                <div>
                  <dt className="vsb-meta">{t('v2.community.statMembers')}</dt>
                  <dd className="font-display text-4xl font-extrabold text-chalk">{others + (me ? 1 : 0)}</dd>
                </div>
                <div>
                  <dt className="vsb-meta">{t('v2.community.statPlayingSoon')}</dt>
                  <dd className="font-display text-4xl font-extrabold text-vsb-400">{playingSoon}</dd>
                </div>
              </dl>
            )}
          </div>
          {/* decorative lineup — illustration, not members */}
          <div className="hidden items-end self-end lg:flex" aria-hidden>
            {[vsbAssets.players[1], vsbAssets.players[5], vsbAssets.players[2]].map((c, i) => (
              <img key={c.sm.src} src={c.sm.src} alt="" width={c.sm.width} height={c.sm.height} decoding="async"
                className={`relative w-auto ${i === 1 ? 'z-10 -mx-6 h-72' : 'h-60'}`} />
            ))}
          </div>
        </div>
      </section>

      <section className="vsb-section" aria-labelledby="community-list-heading">
        <h2 id="community-list-heading" className="sr-only">{t('v2.community.listHeading')}</h2>

        {/* Filters */}
        <div className="flex flex-col gap-5 border-b border-ink-600 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <label className="relative block w-full max-w-sm">
            <span className="sr-only">{t('v2.community.search')}</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('v2.community.search')} className="v2-input !pl-9" />
          </label>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-x-5 gap-y-1" role="group" aria-label={t('v2.community.positionFilter')}>
              <button onClick={() => setPos('all')} aria-pressed={pos === 'all'} className="vsb-tab">{t('v2.community.allPositions')}</button>
              {PLAYING_POSITIONS.map((p) => (
                <button key={p} onClick={() => setPos(p)} aria-pressed={pos === p} className="vsb-tab" title={t(POSITION_KEY[p])}>
                  {POSITION_ABBR[p]}<span className="sr-only">: {t(POSITION_KEY[p])}</span>
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1" role="group" aria-label={t('v2.community.levelFilter')}>
              <button onClick={() => setLevel('all')} aria-pressed={level === 'all'} className="vsb-tab">{t('v2.community.allLevels')}</button>
              {SKILL_LEVELS.map((l) => (
                <button key={l} onClick={() => setLevel(l)} aria-pressed={level === l} className="vsb-tab">{t(SKILL_LEVEL_KEY[l])}</button>
              ))}
            </div>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-20"><Spinner className="h-8 w-8 text-vsb-500" /></div>
        ) : error ? (
          <p className="py-16 text-slate-400">{t('v2.community.error')}</p>
        ) : shown.length === 0 ? (
          <p className="py-16 text-slate-400">{t('v2.community.none')}</p>
        ) : (
          <>
            <p className="mt-4 text-sm text-muted" aria-live="polite">{t('v2.community.showing', { count: shown.length })}</p>
            <ul className="mt-4 grid grid-cols-1 border-l border-t border-ink-600 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {shown.map((p) => (
                <li key={p.user_id} className={`flex gap-4 border-b border-r border-ink-600 p-5 ${p.is_me ? 'bg-vsb-900/30' : ''}`}>
                  <PlayerAvatar name={p.display_name} src={p.avatar_url} size="lg" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-baseline gap-2">
                      <span className="truncate font-display text-2xl font-extrabold uppercase leading-none text-chalk">{p.display_name}</span>
                      {p.is_me && <span className="font-display text-xs font-bold uppercase tracking-wider text-vsb-400">{t('v2.community.you')}</span>}
                    </p>
                    <p className="mt-1.5 text-sm text-slate-300">
                      {[p.playing_position ? t(POSITION_KEY[p.playing_position]) : t('v2.community.noPosition'),
                        p.skill_level ? t(SKILL_LEVEL_KEY[p.skill_level]) : null].filter(Boolean).join(' · ')}
                    </p>
                    {p.playstyle && (
                      <p className="mt-1.5"><span className="border border-vsb-500/50 px-2 py-0.5 font-display text-[11px] font-bold uppercase tracking-[0.14em] text-vsb-200">{t(playstyleKey(p.playstyle as Playstyle))}</span></p>
                    )}
                    <p className="mt-1 text-xs text-muted">
                      {t('v2.community.games', { count: p.games_played })} · {t('v2.community.since', { date: formatDateLocale(p.member_since, lang, 'medium') })}
                    </p>
                    {p.next_session_id && (
                      <Link to={`/sessions/${p.next_session_id}`} className="mt-3 inline-flex max-w-full items-center gap-1.5 text-sm font-semibold text-vsb-400 hover:text-vsb-300">
                        <span className="truncate">{t('v2.community.next', { title: p.next_session_title, date: formatDateLocale(p.next_session_date!, lang, 'medium') })}</span>
                        <ArrowRight className="h-4 w-4 flex-shrink-0" aria-hidden />
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        <p className="mt-8 max-w-2xl text-sm text-muted">
          {t('v2.community.privacy')}{' '}
          <Link to="/profile#community" className="font-semibold text-slate-300 underline decoration-ink-500 underline-offset-4 hover:text-white">{t('v2.community.privacyLink')}</Link>
        </p>
      </section>
    </div>
  );
}
