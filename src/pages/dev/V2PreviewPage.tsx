import { useState } from 'react';
import { SessionCard } from '@/components/SessionCard';
import { SessionRow } from '@/components/vsb/SessionRow';
import { PlayerCard } from '@/components/PlayerCard';
import { BookingSteps } from '@/components/BookingSteps';
import { SessionDetailsView } from '@/components/vsb/SessionDetailsView';
import type { CourtPlayer, SessionWithCount } from '@/lib/sessions';
import { vsbAssets } from '@/lib/vsbAssets';
import { YourGameForm } from '@/components/vsb/YourGameForm';
import { EMPTY_YOUR_GAME, type YourGame } from '@/lib/yourGame';

// DEV-ONLY design review page (route registered only when import.meta.env.DEV).
// Sample data lives here and nowhere else — never shown to real users.
// Sample roster: 16 players with fake ids (seed the stable fallback
// character), positions, a guest and mixed statuses.
const NAMES = ['Amir', 'Aina', 'Jason', 'Mei', 'Hafiz', 'Sarah', 'Kumar', 'Nadia', 'Daniel', 'Siti', 'Arjun', 'Lina', 'Farid', 'Grace', 'Wei', 'Zara'];
const POS = ['Setter', 'Outside Hitter', 'Middle Blocker', 'Opposite Hitter', 'Libero', null] as const;
const roster: CourtPlayer[] = NAMES.map((name, i) => ({
  user_id: i === 5 ? null : `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
  display_name: i === 5 ? 'Sarah (guest)' : name,
  booking_status: i % 4 === 3 ? 'Pending Payment' : 'Confirmed',
  gender: i % 5 === 4 ? null : i % 2 ? 'Female' : 'Male',
  playing_position: i === 5 ? null : POS[i % POS.length],
  is_guest: i === 5,
}));

const AVATARS = 'https://kygkaxrainpdwqporuvy.supabase.co/storage/v1/object/public/player-avatars/72e27023-a858-4983-9802-8a7af6c0d3e5';
const GENERATED_SAMPLES = [`${AVATARS}/e196bdcb-0c55-4910-b562-326eb3684af8.png`, `${AVATARS}/f0ed8a48-703f-48c5-bc14-58a2aee30c75.png`];

const base: Omit<SessionWithCount, 'id' | 'title' | 'skill_level' | 'confirmed_count' | 'maximum_capacity'> = {
  description: 'Friendly Friday games for players who can rally and want a steady pace.', session_date: '2026-10-02', start_time: '20:00:00', end_time: '22:00:00',
  venue_name: 'The Challenger Sports Centre', venue_address: 'Jalan Example 1, Kuala Lumpur', maps_link: 'https://maps.google.com', court_number: 'Court 3', cover_image_path: null,
  price: 25, booking_open_at: null, booking_close_at: null, cancellation_deadline: null, status: 'Open',
  notes: 'Bring both light and dark shirts.', created_by: null, created_at: '', updated_at: '',
};

const sessions: SessionWithCount[] = [
  { ...base, id: 'a', title: 'Friday Night Volley', skill_level: 'Intermediate', confirmed_count: 8, maximum_capacity: 12 },
  { ...base, id: 'b', title: 'Weekend Chill', skill_level: 'Beginner', confirmed_count: 11, maximum_capacity: 12, price: 0, session_date: '2026-10-03' },
  { ...base, id: 'c', title: 'Mixed Fun Play', skill_level: 'Advanced', confirmed_count: 18, maximum_capacity: 18, session_date: '2026-10-04' },
  { ...base, id: 'd', title: 'Open Court Sunday', skill_level: 'Open Level', confirmed_count: 3, maximum_capacity: 18, session_date: '2026-10-05' },
];

export default function V2PreviewPage() {
  const q = new URLSearchParams(window.location.search);
  const [yourGame, setYourGame] = useState<YourGame>({ ...EMPTY_YOUR_GAME, playstyle: 'all_rounder', play_reasons: ['fitness'] });
  const [capacity, setCapacity] = useState(Number(q.get('cap') ?? 12));
  const [count, setCount] = useState(Number(q.get('players') ?? 8));
  return (
    <div className="bg-ink text-chalk">
      <p className="vsb-gutter border-b border-amber-500/40 bg-amber-500/10 py-2 text-sm text-amber-300">
        Dev-only preview with sample data ·{' '}
        <label>Capacity{' '}
          <select className="bg-transparent font-semibold" value={capacity} onChange={(e) => setCapacity(Number(e.target.value))}>
            {[6, 8, 12, 16, 18, 24].map((n) => <option key={n} className="bg-ink">{n}</option>)}
          </select>
        </label>{' · '}
        <label>Players{' '}
          <select className="bg-transparent font-semibold" value={count} onChange={(e) => setCount(Number(e.target.value))}>
            {Array.from({ length: 17 }, (_, n) => <option key={n} className="bg-ink">{n}</option>)}
          </select>
        </label>
      </p>

      <SessionDetailsView
        session={{ ...sessions[0], maximum_capacity: capacity, confirmed_count: Math.min(count, capacity) }}
        players={roster.slice(0, Math.min(count, capacity))}
        settings={null}
        needsPasskey={false}
        unlocked
        onUnlocked={() => {}}
        onWaitlist={false}
        onBook={() => {}}
        onJoinWaitlist={() => {}}
      />

      <section className="vsb-section border-t border-ink-600">
        <p className="vsb-meta mb-6">Session rows (Sessions page)</p>
        <div className="space-y-4">
          <SessionRow session={sessions[0]} to="#" roster={roster.slice(0, 8)} isPrivate={false} />
          <SessionRow session={sessions[2]} to="#" roster={roster} isPrivate />
        </div>
      </section>

      <section className="vsb-section border-t border-ink-600">
        <p className="vsb-meta mb-6">Session cards</p>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          <SessionCard session={sessions[0]} to="#" roster={roster} isPrivate={false} />
          <SessionCard session={sessions[1]} to="#" roster={roster.slice(0, 3)} isPrivate />
          <SessionCard session={sessions[2]} to="#" roster={roster} isPrivate={false} />
          <SessionCard session={sessions[3]} to="#" roster={[]} isPrivate={false} />
        </div>
      </section>

      <section className="vsb-section grid items-start gap-10 border-t border-ink-600 md:grid-cols-2">
        <div className="w-[19rem]">
          <PlayerCard name="Razeen" position="Middle Blocker" skill="Intermediate" games={24} tags={["All-rounder", "Competitive"]} artSrc={vsbAssets.players[0].full.src} />
          <div className="mt-8"><PlayerCard name="Jeen" position="Flexible / Any Position" skill="Open Level" games={0} /></div>
          {/* generated art (transparent margins): V3 accepted, V2 wider figure */}
          {GENERATED_SAMPLES.map((src) => (
            <div key={src} className="mt-8"><PlayerCard name="Jeen" position="Flexible / Any Position" skill="Open Level" games={12} tags={["All-rounder", "Balanced"]} artSrc={src} /></div>
          ))}
        </div>
        <div className="space-y-6">
          <div className="border border-ink-600 p-5" id="your-game-preview"><YourGameForm value={yourGame} onChange={setYourGame} idPrefix="preview" /></div>
          <BookingSteps current={1} />
          <BookingSteps current={2} />
          <BookingSteps current={3} />
        </div>
      </section>
    </div>
  );
}
