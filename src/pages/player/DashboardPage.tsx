import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Clock, MapPin, Ticket, TrendingUp, XCircle, CalendarPlus, Bell } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { formatDate, formatTime, formatDateTime } from '@/lib/format';
import { StatusBadge, PaymentStatusBadge } from '@/components/StatusBadge';
import { Spinner } from '@/components/LoadingScreen';
import type { Booking, Session, Notification } from '@/types/database';

interface BookingWithSession extends Booking {
  session: Session;
}

export default function DashboardPage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<BookingWithSession[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data } = await supabase
        .from('bookings')
        .select('*, session:sessions(*)')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });
      setBookings((data || []) as unknown as BookingWithSession[]);

      const { data: notifs } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(5);
      setNotifications((notifs || []) as Notification[]);

      setLoading(false);
    })();
  }, [profile]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spinner className="h-8 w-8 text-orange-500" />
      </div>
    );
  }

  const now = new Date();
  const upcoming = bookings.filter((b) => new Date(b.session.session_date) >= now && ['Confirmed', 'Pending Payment'].includes(b.booking_status));
  const pendingPayments = bookings.filter((b) => b.booking_status === 'Pending Payment');
  const pastSessions = bookings.filter((b) => new Date(b.session.session_date) < now && b.booking_status === 'Completed');
  const cancelled = bookings.filter((b) => b.booking_status.includes('Cancelled'));
  const totalJoined = bookings.filter((b) => ['Confirmed', 'Completed'].includes(b.booking_status)).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
            Hey, {profile?.short_name || profile?.full_name?.split(' ')[0] || 'Player'}!
          </h1>
          <p className="text-slate-500 text-sm mt-1">Here's an overview of your volleyball activity.</p>
        </div>
        <Link
          to="/sessions"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white font-bold rounded-xl transition-all"
        >
          <CalendarPlus className="h-5 w-5" />
          Book a Session
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={CalendarDays} label="Upcoming" value={upcoming.length} color="text-rose-600 bg-rose-100" />
        <StatCard icon={Clock} label="Pending Payment" value={pendingPayments.length} color="text-amber-600 bg-amber-100" />
        <StatCard icon={TrendingUp} label="Total Joined" value={totalJoined} color="text-green-600 bg-green-100" />
        <StatCard icon={XCircle} label="Cancelled" value={cancelled.length} color="text-red-600 bg-red-100" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Upcoming bookings */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-slate-900">Upcoming Bookings</h2>
              <Link to="/bookings" className="text-sm text-rose-600 font-semibold hover:underline">View all</Link>
            </div>
            {upcoming.length === 0 ? (
              <div className="text-center py-8">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
                  <Ticket className="h-6 w-6" />
                </div>
                <p className="text-slate-500 text-sm">No upcoming bookings. Book a session to get started!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcoming.slice(0, 5).map((b) => (
                  <Link key={b.id} to={`/bookings/${b.id}`} className="block bg-slate-50 rounded-xl p-4 hover:bg-slate-100 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 truncate">{b.session.title}</p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-slate-500">
                          <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{formatDate(b.session.session_date)}</span>
                          <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{formatTime(b.session.start_time)}</span>
                          <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{b.session.venue_name}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <StatusBadge status={b.booking_status} />
                        <span className="font-mono text-xs text-slate-400">{b.booking_reference}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Pending payments */}
          {pendingPayments.length > 0 && (
            <div className="bg-amber-50 rounded-2xl border border-amber-200 p-5 mt-4">
              <h2 className="font-bold text-amber-900 mb-3 flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Pending Payments
              </h2>
              <div className="space-y-2">
                {pendingPayments.map((b) => (
                  <Link key={b.id} to={`/payment/${b.id}`} className="flex items-center justify-between bg-white rounded-xl p-3 hover:shadow-sm transition-shadow">
                    <div>
                      <p className="font-medium text-slate-900 text-sm">{b.session.title}</p>
                      <p className="text-xs text-slate-500">{formatDate(b.session.session_date)} · RM{b.total_amount.toFixed(2)}</p>
                    </div>
                    <span className="text-sm font-bold text-rose-600">Pay Now</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Notifications */}
        <div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Bell className="h-5 w-5 text-slate-400" />
              Recent Notifications
            </h2>
            {notifications.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-4">No notifications yet.</p>
            ) : (
              <div className="space-y-3">
                {notifications.map((n) => (
                  <div key={n.id} className="border-l-2 border-rose-300 pl-3 py-1">
                    <p className="text-sm font-medium text-slate-900">{n.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{n.message}</p>
                    <p className="text-xs text-slate-400 mt-1">{formatDateTime(n.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <div className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${color} mb-3`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}
