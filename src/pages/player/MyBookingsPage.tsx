import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarDays, Clock, MapPin, Ticket, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { formatDate, formatTime, formatCurrency } from '@/lib/format';
import { StatusBadge } from '@/components/StatusBadge';
import { Spinner } from '@/components/LoadingScreen';
import type { Booking, Session } from '@/types/database';

interface BookingWithSession extends Booking {
  session: Session;
}

type Tab = 'upcoming' | 'past' | 'cancelled' | 'all';

export default function MyBookingsPage() {
  const { t } = useTranslation();
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
        <Spinner className="h-8 w-8 text-navy-600" />
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'upcoming', label: t('myBookings.tabUpcoming') },
    { key: 'past', label: t('myBookings.tabPast') },
    { key: 'cancelled', label: t('myBookings.tabCancelled') },
    { key: 'all', label: t('myBookings.tabAll') },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 mb-6">{t('myBookings.title')}</h1>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              tab === tb.key ? 'bg-navy-700 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <input
          placeholder={t('myBookings.searchPlaceholder')}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20 outline-none"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-4">
            <Ticket className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-1">{t('myBookings.noBookingsFound')}</h3>
          <p className="text-slate-500 text-sm mb-4">{t('myBookings.browseAndBook')}</p>
          <Link to="/sessions" className="inline-flex items-center gap-2 px-5 py-2.5 bg-navy-700 hover:bg-navy-800 text-white font-semibold rounded-xl transition-colors">
            {t('myBookings.browseSessions')}
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((b) => (
            <Link
              key={b.id}
              to={`/bookings/${b.id}`}
              className="block bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-slate-900 truncate">{b.session.title}</p>
                    <span className="font-mono text-xs text-slate-500">{b.booking_reference}</span>
                    {b.is_guest && (
                      <span className="flex-shrink-0 px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-[10px] font-medium">
                        {t('myBookings.bookingFor', { name: b.guest_name })}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{formatDate(b.session.session_date)}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{formatTime(b.session.start_time)}</span>
                    <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{b.session.venue_name}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <StatusBadge status={b.booking_status} />
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
