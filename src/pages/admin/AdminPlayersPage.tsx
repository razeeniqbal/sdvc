import { useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatDateShort } from '@/lib/format';
import { localToday } from '@/lib/adminSessions';
import { PLAYING_POSITIONS, POSITION_ABBR, SKILL_LEVELS } from '@/lib/volleyball';
import { Spinner } from '@/components/LoadingScreen';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { AdminPageHeader, OpsBadge, Stat } from '@/components/admin/AdminUI';
import type { Profile } from '@/types/database';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import { useAvatarMap } from '@/lib/avatars';

// Admin → Players: operational view of the membership. Activity is derived
// from the player's own (non-guest) bookings only. Contact and emergency
// details appear here for admins and never in player-facing Community views.

interface Activity { booked: number; played: number; attended: number; upcoming: number; last: string | null }
type BookingRow = { user_id: string; booking_status: string; is_guest: boolean; session: { session_date: string } | null };

const ACTIVE = ['Pending Payment', 'Confirmed', 'Completed', 'No Show'];

export default function AdminPlayersPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activity, setActivity] = useState<Map<string, Activity>>(new Map());
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [position, setPosition] = useState('');
  const [skill, setSkill] = useState('');
  const [gender, setGender] = useState('');
  const [sort, setSort] = useState<'recent' | 'games' | 'name' | 'joined'>('recent');
  const [selected, setSelected] = useState<Profile | null>(null);
  const avatars = useAvatarMap(profiles.map((p) => p.id));

  useEffect(() => {
    (async () => {
      const [{ data: ps }, { data: bs }] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('bookings').select('user_id, booking_status, is_guest, session:sessions(session_date)').eq('is_guest', false),
      ]);
      const today = localToday();
      const map = new Map<string, Activity>();
      ((bs || []) as unknown as BookingRow[]).forEach((b) => {
        if (!ACTIVE.includes(b.booking_status) || !b.session) return;
        const a = map.get(b.user_id) || { booked: 0, played: 0, attended: 0, upcoming: 0, last: null };
        const date = b.session.session_date;
        a.booked++;
        if (date >= today) a.upcoming++;
        else if (b.booking_status !== 'Pending Payment') {
          a.played++;
          if (!a.last || date > a.last) a.last = date;
        }
        if (b.booking_status === 'Completed') a.attended++;
        map.set(b.user_id, a);
      });
      setProfiles((ps || []) as Profile[]);
      setActivity(map);
      setLoading(false);
    })();
  }, []);

  const players = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = profiles.filter((p) => {
      if (term && !`${p.full_name} ${p.short_name ?? ''} ${p.phone_number ?? ''}`.toLowerCase().includes(term)) return false;
      if (position && p.playing_position !== position) return false;
      if (skill && p.skill_level !== skill) return false;
      if (gender === 'unset' ? p.gender : gender && p.gender !== gender) return false;
      return true;
    });
    const act = (p: Profile) => activity.get(p.id);
    return list.sort((a, b) => {
      if (sort === 'name') return (a.short_name || a.full_name).localeCompare(b.short_name || b.full_name);
      if (sort === 'games') return (act(b)?.played ?? 0) - (act(a)?.played ?? 0);
      if (sort === 'joined') return b.created_at.localeCompare(a.created_at);
      return (act(b)?.last ?? '').localeCompare(act(a)?.last ?? '');
    });
  }, [profiles, activity, q, position, skill, gender, sort]);

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><Spinner className="h-8 w-8 text-vsb-500" /></div>;

  const members = profiles.filter((p) => p.role === 'player');
  const activeRecently = members.filter((p) => {
    const last = activity.get(p.id)?.last;
    if (!last) return false;
    return (Date.now() - new Date(`${last}T00:00:00`).getTime()) / 86400000 <= 30;
  }).length;
  const withUpcoming = members.filter((p) => (activity.get(p.id)?.upcoming ?? 0) > 0).length;
  const incomplete = members.filter((p) => !p.phone_number || !p.gender).length;

  return (
    <div className="adm-page">
      <AdminPageHeader meta="Operations" title="Players" subtitle="Everyone with a VSB account." />

      <section aria-label="Membership numbers" className="grid grid-cols-2 gap-x-6 gap-y-8 border-y border-ink-600 py-6 lg:grid-cols-4">
        <Stat label="Registered players" value={members.length} hint={`${profiles.length - members.length} admin account${profiles.length - members.length === 1 ? '' : 's'} not counted`} />
        <Stat label="Played in last 30 days" value={activeRecently} tone="good" />
        <Stat label="Booked for upcoming" value={withUpcoming} />
        <Stat label="Incomplete profiles" value={incomplete} tone={incomplete ? 'attention' : 'neutral'} hint="Missing phone or gender" />
      </section>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,1fr))]">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input aria-label="Search players" placeholder="Search name or phone" className="v2-input !py-2.5 !pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select aria-label="Position" className="v2-input !py-2.5" value={position} onChange={(e) => setPosition(e.target.value)}>
          <option value="">Any position</option>
          {PLAYING_POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select aria-label="Skill level" className="v2-input !py-2.5" value={skill} onChange={(e) => setSkill(e.target.value)}>
          <option value="">Any level</option>
          {SKILL_LEVELS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select aria-label="Gender" className="v2-input !py-2.5" value={gender} onChange={(e) => setGender(e.target.value)}>
          <option value="">Any gender</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
          <option value="unset">Not set</option>
        </select>
        <select aria-label="Sort" className="v2-input !py-2.5" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
          <option value="recent">Most recently played</option>
          <option value="games">Most games</option>
          <option value="joined">Newest members</option>
          <option value="name">Name A–Z</option>
        </select>
      </div>

      <p className="adm-label mt-5">{players.length} shown</p>
      {players.length === 0 && <p className="py-10 text-slate-400">{profiles.length === 0 ? 'No player accounts yet.' : 'No players match these filters.'}</p>}

      {/* Desktop table */}
      <table className={`adm-table mt-2 ${players.length ? 'hidden md:table' : 'hidden'}`}>
        <thead>
          <tr>
            <th>Player</th>
            <th className="w-20">Pos</th>
            <th className="w-32">Level</th>
            <th className="hidden w-24 lg:table-cell">Gender</th>
            <th className="w-24 text-right">Played</th>
            <th className="w-24 text-right">Attended</th>
            <th className="w-32">Last game</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p) => {
            const a = activity.get(p.id);
            const name = p.short_name || p.full_name;
            return (
              <tr key={p.id} className="cursor-pointer" onClick={() => setSelected(p)}>
                <td>
                  <button onClick={(e) => { e.stopPropagation(); setSelected(p); }} className="flex items-center gap-3 text-left">
                    <PlayerAvatar name={name} src={avatars.get(p.id)} seed={p.id} size="xs" />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-chalk">{name}</span>
                      {p.short_name && p.short_name !== p.full_name && <span className="block truncate text-xs text-muted">{p.full_name}</span>}
                    </span>
                    {p.role === 'admin' && <OpsBadge tone="info">Admin</OpsBadge>}
                  </button>
                </td>
                <td className="font-display text-base font-bold text-vsb-300">{p.playing_position ? POSITION_ABBR[p.playing_position] : <span className="text-muted">—</span>}</td>
                <td>{p.skill_level || <span className="text-muted">—</span>}</td>
                <td className="hidden lg:table-cell">{p.gender || <span className="text-muted">Not set</span>}</td>
                <td className="text-right font-display text-lg font-bold text-chalk">{a?.played ?? 0}</td>
                <td className="text-right font-display text-lg font-bold text-chalk">{a?.attended ?? 0}</td>
                <td className="text-slate-300">{a?.last ? formatDateShort(a.last) : <span className="text-muted">Never</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Mobile rows */}
      <ul className="mt-2 divide-y divide-ink-700 border-y border-ink-600 md:hidden">
        {players.map((p) => {
          const a = activity.get(p.id);
          const name = p.short_name || p.full_name;
          return (
            <li key={p.id}>
              <button onClick={() => setSelected(p)} className="flex w-full items-center gap-3 py-3 text-left">
                <PlayerAvatar name={name} src={avatars.get(p.id)} seed={p.id} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-chalk">{name}</p>
                  <p className="text-xs text-muted">{[p.playing_position && POSITION_ABBR[p.playing_position], p.skill_level, p.gender].filter(Boolean).join(' · ') || 'Profile incomplete'}</p>
                </div>
                <p className="text-right font-display leading-none"><span className="block text-xl font-bold text-chalk">{a?.played ?? 0}</span><span className="text-[10px] uppercase tracking-wider text-muted">games</span></p>
              </button>
            </li>
          );
        })}
      </ul>

      {selected && <PlayerSheet profile={selected} avatarUrl={avatars.get(selected.id)} activity={activity.get(selected.id)} onClose={() => setSelected(null)} />}
    </div>
  );
}

function PlayerSheet({ profile, avatarUrl, activity, onClose }: { profile: Profile; avatarUrl?: string; activity?: Activity; onClose: () => void }) {
  const { show } = useToast();
  const { profile: me } = useAuth();
  const [gens, setGens] = useState<{ used: number; allowed: number; lastFailure: string | null } | null>(null);
  const [granting, setGranting] = useState(false);

  async function loadGens() {
    const [{ data: g }, { count: grants }] = await Promise.all([
      supabase.from('player_avatar_generations').select('status, failure_reason, created_at').eq('user_id', profile.id).order('created_at', { ascending: false }),
      supabase.from('player_avatar_grants').select('id', { count: 'exact', head: true }).eq('user_id', profile.id),
    ]);
    const rows = (g || []) as { status: string; failure_reason: string | null }[];
    setGens({
      used: rows.filter((r) => r.status !== 'failed').length,
      allowed: 1 + (grants ?? 0),
      lastFailure: rows[0]?.status === 'failed' ? rows[0].failure_reason : null,
    });
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when the selected player changes
  useEffect(() => { loadGens(); }, [profile.id]);

  async function grant() {
    if (!me) return;
    setGranting(true);
    const { error } = await supabase.from('player_avatar_grants').insert({ user_id: profile.id, granted_by: me.id });
    setGranting(false);
    if (error) { show(error.message, 'error'); return; }
    show('Granted one more avatar generation', 'success');
    loadGens();
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const name = profile.short_name || profile.full_name;
  const attendance = activity && activity.played > 0 ? Math.round((activity.attended / activity.played) * 100) : null;
  const facts: [string, string][] = [
    ['Full name', profile.full_name],
    ['Position', profile.playing_position || 'Not set'],
    ['Skill level', profile.skill_level || 'Not set'],
    ['Gender', profile.gender || 'Not set'],
    ['Member since', formatDateShort(profile.created_at)],
    ['Role', profile.role === 'admin' ? 'Administrator' : 'Player'],
  ];

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="player-sheet-title">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col overflow-y-auto border-l border-ink-600 bg-ink-850">
        <header className="flex items-start justify-between gap-4 border-b border-ink-600 p-5">
          <div className="flex items-center gap-3">
            <PlayerAvatar name={name} src={avatarUrl} size="lg" />
            <div>
              <h2 id="player-sheet-title" className="font-display text-3xl font-extrabold uppercase leading-none text-chalk">{name}</h2>
              {profile.playing_position && <p className="mt-1 font-display text-sm font-bold uppercase tracking-wider text-vsb-300">{profile.playing_position}</p>}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" autoFocus className="p-1 text-muted hover:text-chalk"><X className="h-6 w-6" /></button>
        </header>

        <div className="space-y-6 p-5">
          <section className="grid grid-cols-3 gap-4 border-b border-ink-600 pb-5">
            <Stat label="Played" value={activity?.played ?? 0} />
            <Stat label="Upcoming" value={activity?.upcoming ?? 0} />
            <Stat label="Attended" value={activity?.attended ?? 0} hint={attendance !== null ? `${attendance}% of played` : undefined} />
          </section>

          <section>
            <h3 className="adm-label mb-2">Profile</h3>
            <dl className="space-y-2 text-sm">
              {facts.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-ink-700 pb-2"><dt className="text-muted">{k}</dt><dd className="text-right font-semibold text-chalk">{v}</dd></div>
              ))}
            </dl>
          </section>

          <section>
            <h3 className="adm-label mb-2 flex items-center gap-2">Contact & safety <OpsBadge tone="neutral">Admin only</OpsBadge></h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4 border-b border-ink-700 pb-2"><dt className="text-muted">Phone</dt><dd className="font-semibold text-chalk">{profile.phone_number || 'Not provided'}</dd></div>
              <div className="flex justify-between gap-4 border-b border-ink-700 pb-2"><dt className="text-muted">Emergency contact</dt><dd className="text-right font-semibold text-chalk">{profile.emergency_contact_name || 'Not provided'}{profile.emergency_contact_phone ? ` · ${profile.emergency_contact_phone}` : ''}</dd></div>
            </dl>
          </section>

          <section>
            <h3 className="adm-label mb-2">VSB player avatar</h3>
            {profile.role === 'admin' ? (
              <p className="text-sm text-slate-400">Admins can generate as many times as they need.</p>
            ) : gens ? (
              <div className="space-y-3 text-sm">
                <p className="text-slate-300">
                  {avatarUrl ? 'Has a generated avatar.' : 'No avatar yet.'} Used <span className="font-semibold text-chalk">{gens.used}</span> of <span className="font-semibold text-chalk">{gens.allowed}</span> generation{gens.allowed === 1 ? '' : 's'}.
                </p>
                {gens.lastFailure && <p className="text-xs text-amber-300">Last attempt failed: {gens.lastFailure}</p>}
                <button onClick={grant} disabled={granting} className="adm-btn">{granting ? 'Granting…' : 'Give another generation'}</button>
              </div>
            ) : <Spinner className="h-4 w-4 text-vsb-500" />}
          </section>

          <p className="text-xs text-muted">"Attended" counts bookings marked present in session attendance. Role changes are managed in Club Settings → Admins.</p>
        </div>
      </aside>
    </div>
  );
}
