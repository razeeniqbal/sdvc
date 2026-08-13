import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays, Filter } from 'lucide-react';
import { fetchSessionsWithCounts, getSessionStatus, type SessionWithCount } from '@/lib/sessions';
import { Spinner } from '@/components/LoadingScreen';
import { SessionCard } from '@/components/SessionCard';

export default function SessionsPage() {
  const { t } = useTranslation();
  const [sessions, setSessions] = useState<SessionWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    venue: '',
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
        <Spinner className="h-8 w-8 text-navy-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">{t('sessions.title')}</h1>
          <p className="text-slate-500 text-sm mt-1">{t('sessions.subtitle')}</p>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          <Filter className="h-4 w-4" />
          {t('sessions.filters')}
        </button>
      </div>

      {showFilters && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('sessions.venue')}</label>
            <select className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 px-3 py-2 text-sm" value={filters.venue} onChange={(e) => setFilters({ ...filters, venue: e.target.value })}>
              <option value="">{t('sessions.allVenues')}</option>
              {venues.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('sessions.date')}</label>
            <input type="date" className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 px-3 py-2 text-sm" value={filters.date} onChange={(e) => setFilters({ ...filters, date: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('sessions.availability')}</label>
            <select className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 px-3 py-2 text-sm" value={filters.availability} onChange={(e) => setFilters({ ...filters, availability: e.target.value })}>
              <option value="">{t('sessions.any')}</option>
              <option value="available">{t('sessionStatus.available')}</option>
              <option value="almost">{t('sessionStatus.almostFull')}</option>
              <option value="booked">{t('sessionStatus.fullyBooked')}</option>
            </select>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-4">
            <CalendarDays className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-1">{t('sessions.noSessionsFound')}</h3>
          <p className="text-slate-500 text-sm">{t('sessions.tryAdjusting')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((session) => (
            <SessionCard key={session.id} session={session} to={`/sessions/${session.id}`} />
          ))}
        </div>
      )}
    </div>
  );
}
