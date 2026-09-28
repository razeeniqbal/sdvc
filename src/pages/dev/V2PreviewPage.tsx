import { useState } from 'react';
import { SessionCard } from '@/components/SessionCard';
import { PlayerCard } from '@/components/PlayerCard';
import { BookingSteps } from '@/components/BookingSteps';
import { SessionDetailsView } from '@/components/vsb/SessionDetailsView';
import type { CourtPlayer, SessionWithCount } from '@/lib/sessions';

// DEV-ONLY design review page (route registered only when import.meta.env.DEV).
// Sample data lives here and nowhere else — never shown to real users.
// Mirrors what session_player_list returns today: name, status, gender only
// (no position / companion flag without a schema change).

const roster: CourtPlayer[] = [
  { display_name: 'Amir', booking_status: 'Confirmed', gender: 'Male', playing_position: null, is_guest: false },
  { display_name: 'Aina', booking_status: 'Confirmed', gender: 'Female', playing_position: null, is_guest: false },
  { display_name: 'Jason', booking_status: 'Confirmed', gender: 'Male', playing_position: null, is_guest: false },
  { display_name: 'Mei', booking_status: 'Pending Payment', gender: 'Female', playing_position: null, is_guest: false },
  { display_name: 'Hafiz', booking_status: 'Confirmed', gender: null, playing_position: null, is_guest: false },
  { display_name: 'Sarah', booking_status: 'Confirmed', gender: 'Female', playing_position: null, is_guest: false },
  { display_name: 'Kumar', booking_status: 'Confirmed', gender: 'Male', playing_position: null, is_guest: false },
  { display_name: 'Nadia', booking_status: 'Pending Payment', gender: null, playing_position: null, is_guest: false },
];

const base: Omit<SessionWithCount, 'id' | 'title' | 'skill_level' | 'confirmed_count' | 'maximum_capacity'> = {
  description: 'Friendly Friday games for players who can rally and want a steady pace.', session_date: '2026-10-02', start_time: '20:00:00', end_time: '22:00:00',
  venue_name: 'The Challenger Sports Centre', venue_address: 'Jalan Example 1, Kuala Lumpur', maps_link: 'https://maps.google.com', court_number: 'Court 3',
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
  const [capacity, setCapacity] = useState(12);
  return (
    <div className="bg-ink text-chalk">
      <p className="vsb-gutter border-b border-amber-500/40 bg-amber-500/10 py-2 text-sm text-amber-300">
        Dev-only preview with sample data ·{' '}
        <label>Capacity{' '}
          <select className="bg-transparent font-semibold" value={capacity} onChange={(e) => setCapacity(Number(e.target.value))}>
            {[8, 12, 18, 24].map((n) => <option key={n} className="bg-ink">{n}</option>)}
          </select>
        </label>
      </p>

      <SessionDetailsView
        session={{ ...sessions[0], maximum_capacity: capacity, confirmed_count: Math.min(8, capacity) }}
        players={roster.slice(0, capacity)}
        settings={null}
        needsPasskey={false}
        unlocked
        onUnlocked={() => {}}
        onWaitlist={false}
        onBook={() => {}}
        onJoinWaitlist={() => {}}
      />

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
          <PlayerCard name="Razeen" position="Middle Blocker" skill="Intermediate" gender="Male" joinedAt="2026-03-01T00:00:00Z" stats={{ played: 24, upcoming: 2 }} />
        </div>
        <div className="space-y-6">
          <BookingSteps current={1} />
          <BookingSteps current={2} />
          <BookingSteps current={3} />
        </div>
      </section>
    </div>
  );
}
