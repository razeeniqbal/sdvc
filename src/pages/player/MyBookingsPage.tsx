import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Clock, MapPin, Ticket, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { formatDate, formatTime, formatCurrency } from '@/lib/format';
import { StatusBadge, PaymentStatusBadge } from '@/components/StatusBadge';
import { Spinner } from '@/components/LoadingScreen';
import type { Booking, Session } from '@/types/database';

interface BookingWithSession extends Booking {
  session: Session;
}

type Tab = 'upcoming' | 'past' | 'cancelled' | 'all';

export default function MyBookingsPage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<BookingWithSession[]>([]);
  const [tab, setTab] = useState<Tab>('upcoming');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data } = await supabase
        .from('bookings')
        .select('*, session:sessions(*)')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });
      setBookings((data || []) as unknown as BookingWithSession[]);
      setLoading(false);
    })();
  }, [profile]);

  const now = new Date();
  const filtered = bookings.filter((b) => {
    const isPast = new Date(b.session.session_date) < now;
    const isCancelled = b.booking_status.includes('Cancelled');
    if (tab === 'upcoming' && (isPast || isCancelled)) return false;
    if (tab === 'past' && (!isPast || isCancelled)) return false;
    if (tab === 'cancelled' && !isCancelled) return false;
    if (search) {
      const q = search.toLowerCase();
      return b.booking_reference.toLowerCase().includes(q) || b.session.title.toLowerCase().includes(q);
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

  const tabs: { key: Tab; label: string }[] = [
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'past', label: 'Past Sessions' },
    { key: 'cancelled', label: 'Cancelled' },
    { key: 'all', label: 'All' },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-6">My Bookings</h1>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-orange-500 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          placeholder="Search by booking reference or session name..."
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-4">
            <Ticket className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-1">No bookings found</h3>
          <p className="text-slate-500 text-sm mb-4">Browse sessions and book your next game.</p>
          <Link to="/sessions" className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition-colors">
            Browse Sessions
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((b) => (
            <Link
              key={b.id}
              to={`/bookings/${b.id}`}
              className="block bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-slate-900 truncate">{b.session.title}</p>
                    <span className="font-mono text-xs text-slate-400">{b.booking_reference}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{formatDate(b.session.session_date)}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{formatTime(b.session.start_time)}</span>
                    <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{b.session.venue_name}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <StatusBadge status={b.booking_status} />
                  <PaymentStatusBadge status={b.payment_status} />
                  <span className="text-sm font-bold text-slate-900">{formatCurrency(b.total_amount)}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
