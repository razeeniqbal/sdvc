import { useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchCommunity } from '@/lib/community';
import { useAvatarMap } from '@/lib/avatars';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { Spinner } from '@/components/LoadingScreen';
import type { Starter } from '@/lib/starters';

// Pick starting players for a session (admin / organizer console). Admins see
// every member; organizers only see members who are visible in Community (the
// profiles table is admin-only). Places are added by add_session_starters.


export function StarterPicker({ value, onChange, excludeIds = [], max }: {
  value: Starter[];
  onChange: (next: Starter[]) => void;
  excludeIds?: string[];
  max?: number;
}) {
  const [members, setMembers] = useState<Starter[] | null>(null);
  const [query, setQuery] = useState('');
  const avatars = useAvatarMap(value.map((s) => s.id));

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('profiles').select('id, short_name, full_name, playing_position').order('short_name');
      const rows = (data || []) as { id: string; short_name: string | null; full_name: string; playing_position: string | null }[];
      if (rows.length > 1) {
        setMembers(rows.map((p) => ({ id: p.id, name: p.short_name || p.full_name, position: p.playing_position })));
        return;
      }
      // Organizer: only their own profile is readable, use the community list.
      const community = await fetchCommunity().catch(() => []);
      setMembers(community.map((m) => ({ id: m.user_id, name: m.display_name, position: m.playing_position })));
    })();
  }, []);

  const chosen = new Set(value.map((s) => s.id));
  const full = max !== undefined && value.length >= max;
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return (members || []).filter((m) => !chosen.has(m.id) && !excludeIds.includes(m.id) && m.name.toLowerCase().includes(q)).slice(0, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members, query, value, excludeIds]);

  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Starting players">
          {value.map((s) => (
            <li key={s.id} className="flex items-center gap-2 border border-ink-500 bg-ink-800 py-1 pl-1 pr-2 text-sm text-chalk">
              <PlayerAvatar name={s.name} src={avatars.get(s.id)} size="xs" />
              {s.name}
              <button type="button" onClick={() => onChange(value.filter((x) => x.id !== s.id))} aria-label={`Remove ${s.name}`} className="p-0.5 text-muted hover:text-red-300">
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <label className="relative block max-w-md">
        <span className="sr-only">Search members</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} disabled={full}
          placeholder={full ? 'Session is full' : 'Search members by name'} className="v2-input !pl-9" />
      </label>
      {members === null ? (
        <Spinner className="h-4 w-4 text-vsb-500" />
      ) : query.trim() && (
        matches.length === 0 ? <p className="text-sm text-muted">No members match.</p> : (
          <ul className="max-w-md divide-y divide-ink-700 border border-ink-600">
            {matches.map((m) => (
              <li key={m.id}>
                <button type="button" onClick={() => { onChange([...value, m]); setQuery(''); }}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-vsb-400">
                  <span className="font-semibold text-chalk">{m.name}</span>
                  <span className="text-xs text-muted">{m.position || 'Position not set'}</span>
                </button>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}
