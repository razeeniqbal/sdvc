import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, MapPin, Clock, Users, Tag, Filter, Search } from 'lucide-react';
import { fetchSessionsWithCounts, getSessionStatus, type SessionWithCount } from '@/lib/sessions';
import { formatCurrency, formatDate, formatTime, getDayName } from '@/lib/format';
import { SKILL_LEVELS, type SkillLevel } from '@/types/database';
import { Spinner } from '@/components/LoadingScreen';

const statusStyles: Record<string, string> = {
  Available: 'bg-green-100 text-green-800 border-green-200',
  'Almost Full': 'bg-amber-100 text-amber-800 border-amber-200',
  'Fully Booked': 'bg-red-100 text-red-700 border-red-200',
  'Booking Closed': 'bg-slate-100 text-slate-600 border-slate-200',
  Cancelled: 'bg-red-100 text-red-700 border-red-200',
};

export default function SessionsPage() {
  const [sessions, setSessions] = useState<SessionWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    venue: '',
    skillLevel: '',
    availability: '',
    date: '',
  });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchSessionsWithCounts()
      .then(setSessions)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const venues = [...new Set(sessions.map((s) => s.venue_name))];

  const filtered = sessions.filter((s) => {
    if (filters.venue && s.venue_name !== filters.venue) return false;
    if (filters.skillLevel && s.skill_level !== filters.skillLevel) return false;
    if (filters.date && s.session_date !== filters.date) return false;
    if (filters.availability) {
      const status = getSessionStatus(s, s.confirmed_count);
      if (filters.availability === 'available' && status !== 'Available') return false;
      if (filters.availability === 'almost' && status !== 'Almost Full') return false;
      if (filters.availability === 'booked' && status !== 'Fully Booked') return false;
    }
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spinner className="h-8 w-8 text-orange-500" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Upcoming Sessions</h1>
          <p className="text-slate-500 text-sm mt-1">Browse and book your next volleyball session</p>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <Filter className="h-4 w-4" />
          Filters
        </button>
      </div>

      {showFilters && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Venue</label>
            <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={filters.venue} onChange={(e) => setFilters({ ...filters, venue: e.target.value })}>
              <option value="">All venues</option>
              {venues.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Skill Level</label>
            <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={filters.skillLevel} onChange={(e) => setFilters({ ...filters, skillLevel: e.target.value })}>
              <option value="">All levels</option>
              {SKILL_LEVELS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
            <input type="date" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={filters.date} onChange={(e) => setFilters({ ...filters, date: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Availability</label>
            <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={filters.availability} onChange={(e) => setFilters({ ...filters, availability: e.target.value })}>
              <option value="">Any</option>
              <option value="available">Available</option>
              <option value="almost">Almost Full</option>
              <option value="booked">Fully Booked</option>
            </select>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-4">
            <CalendarDays className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-1">No sessions found</h3>
          <p className="text-slate-500 text-sm">Try adjusting your filters or check back later.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((session) => {
            const status = getSessionStatus(session, session.confirmed_count);
            const available = session.maximum_capacity - session.confirmed_count;
            const canBook = status === 'Available' || status === 'Almost Full';
            const isAlmostFull = status === 'Almost Full';

            return (
              <Link
                key={session.id}
                to={`/sessions/${session.id}`}
                className={`glass-card rounded-2xl border shadow-sm hover:shadow-lg hover:scale-[1.02] transition-all overflow-hidden group ${
                  isAlmostFull ? 'border-amber-300' : 'border-white/50'
                }`}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-900 group-hover:text-orange-600 transition-colors">{session.title}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">{getDayName(session.session_date)}</p>
                    </div>
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusStyles[status]}`}>
                      {status}
                    </span>
                  </div>

                  <div className="space-y-2 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-slate-400 flex-shrink-0" />
                      <span>{formatDate(session.session_date)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-slate-400 flex-shrink-0" />
                      <span>{formatTime(session.start_time)} - {formatTime(session.end_time)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-slate-400 flex-shrink-0" />
                      <span className="truncate">{session.venue_name} {session.court_number && `· ${session.court_number}`}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-slate-400 flex-shrink-0" />
                      <span>{session.skill_level}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-slate-400 flex-shrink-0" />
                      <span className={available <= 3 && canBook ? 'text-amber-600 font-semibold' : ''}>
                        {available} of {session.maximum_capacity} slots left
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-2xl font-bold text-slate-900">{formatCurrency(session.price)}</span>
                    <span className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                      canBook
                        ? 'bg-gradient-to-r from-rose-500 to-orange-500 text-white'
                        : 'bg-slate-100 text-slate-400'
                    }`}>
                      {canBook ? 'Book Now' : status === 'Fully Booked' ? 'Waitlist' : 'View'}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
