import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { fetchCommunity, type CommunityPlayer } from '@/lib/community';
import { POSITION_KEY } from '@/lib/volleyball';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { Spinner } from '@/components/LoadingScreen';

// Pick a registered VSB member to bring as your friend. Lists only members
// visible in Community (the database enforces the same rule), never yourself.
export function MemberPicker({ excludeIds, onPick }: { excludeIds: string[]; onPick: (m: CommunityPlayer) => void }) {
  const { t } = useTranslation();
  const [all, setAll] = useState<CommunityPlayer[] | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => { fetchCommunity().then(setAll).catch(() => setAll([])); }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (all || [])
      .filter((m) => !m.is_me && !excludeIds.includes(m.user_id))
      .filter((m) => !q || m.display_name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [all, query, excludeIds]);

  return (
    <div className="border border-ink-600 bg-ink-850 p-3">
      <label className="relative block">
        <span className="sr-only">{t('v2.friend.search')}</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
        <input type="search" autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('v2.friend.search')} className="v2-input !pl-9" />
      </label>
      {all === null ? (
        <div className="py-4"><Spinner className="h-5 w-5 text-vsb-500" /></div>
      ) : matches.length === 0 ? (
        <p className="py-3 text-sm text-muted">{t('v2.friend.noMatch')}</p>
      ) : (
        <ul className="mt-2 divide-y divide-ink-700" aria-label={t('v2.friend.results')}>
          {matches.map((m) => (
            <li key={m.user_id}>
              <button type="button" onClick={() => onPick(m)} className="flex w-full items-center gap-3 px-1 py-2 text-left hover:bg-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vsb-400">
                <PlayerAvatar name={m.display_name} src={m.avatar_url} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-chalk">{m.display_name}</span>
                  <span className="block truncate text-xs text-muted">{m.playing_position ? t(POSITION_KEY[m.playing_position]) : t('v2.community.noPosition')}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-muted">{t('v2.friend.pickerNote')}</p>
    </div>
  );
}
