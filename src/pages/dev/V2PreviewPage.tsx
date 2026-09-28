import { useState } from 'react';
import { SessionCard } from '@/components/SessionCard';
import { WhosPlaying } from '@/components/WhosPlaying';
import { PlayerCard } from '@/components/PlayerCard';
import { BookingSteps } from '@/components/BookingSteps';
import type { CourtPlayer, SessionWithCount } from '@/lib/sessions';

// DEV-ONLY design review page (route registered only when import.meta.env.DEV).
// Sample data lives here and nowhere else — never shown to real users.

const roster: CourtPlayer[] = [
  { display_name: 'Amir', booking_status: 'Confirmed', gender: 'Male', playing_position: 'Setter', is_guest: false },
  { display_name: 'Aina', booking_status: 'Confirmed', gender: 'Female', playing_position: 'Outside Hitter', is_guest: false },
  { display_name: 'Jason', booking_status: 'Confirmed', gender: 'Male', playing_position: 'Opposite Hitter', is_guest: false },
  { display_name: 'Mei', booking_status: 'Pending Payment', gender: 'Female', playing_position: 'Libero', is_guest: false },
  { display_name: 'Hafiz', booking_status: 'Confirmed', gender: null, playing_position: 'Middle Blocker', is_guest: false },
  { display_name: 'Sarah', booking_status: 'Confirmed', gender: 'Female', playing_position: 'Flexible / Any Position', is_guest: false },
  { display_name: 'Kumar', booking_status: 'Confirmed', gender: 'Male', playing_position: null, is_guest: false },
  { display_name: 'Guest of Amir', booking_status: 'Pending Payment', gender: null, playing_position: null, is_guest: true },
];

const base: Omit<SessionWithCount, 'id' | 'title' | 'skill_level' | 'confirmed_count' | 'maximum_capacity'> = {
  description: null, session_date: '2026-10-02', start_time: '20:00:00', end_time: '22:00:00',
  venue_name: 'The Challenger Sports Centre', venue_address: null, maps_link: null, court_number: 'Court 3',
  price: 25, booking_open_at: null, booking_close_at: null, cancellation_deadline: null, status: 'Open',
  notes: null, created_by: null, created_at: '', updated_at: '',
};

const sessions: SessionWithCount[] = [
  { ...base, id: 'a', title: 'Friday Night Volley', skill_level: 'Intermediate', confirmed_count: 8, maximum_capacity: 12 },
  { ...base, id: 'b', title: 'Weekend Chill', skill_level: 'Beginner', confirmed_count: 11, maximum_capacity: 12, price: 0 },
  { ...base, id: 'c', title: 'Mixed Fun Play', skill_level: 'Advanced', confirmed_count: 18, maximum_capacity: 18 },
];

export default function V2PreviewPage() {
  const [capacity, setCapacity] = useState(12);
  return (
    <div className="bg-ink text-chalk">
      <div className="mx-auto max-w-6xl space-y-10 px-4 py-8 sm:px-6">
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">Dev-only preview with sample data.</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <SessionCard session={sessions[0]} to="#" roster={roster} isPrivate={false} />
          <SessionCard session={sessions[1]} to="#" roster={roster.slice(0, 3)} isPrivate />
          <SessionCard session={sessions[2]} to="#" roster={[]} isPrivate={false} />
        </div>
        <div>
          <label className="mb-3 flex items-center gap-2 text-sm text-slate-400">
            Capacity
            <select className="v2-input !w-auto" value={capacity} onChange={(e) => setCapacity(Number(e.target.value))}>
              {[8, 12, 18, 24].map((n) => <option key={n}>{n}</option>)}
            </select>
          </label>
          <WhosPlaying players={roster} capacity={capacity} />
        </div>
        <div className="grid items-start gap-8 md:grid-cols-2">
          <PlayerCard name="Razeen" position="Middle Blocker" skill="Intermediate" gender="Male" joinedAt="2026-03-01T00:00:00Z" stats={{ played: 24, upcoming: 2 }} />
          <div className="v2-surface space-y-6 p-6">
            <BookingSteps current={1} />
            <BookingSteps current={2} />
            <BookingSteps current={3} />
          </div>
        </div>
      </div>
    </div>
  );
}
