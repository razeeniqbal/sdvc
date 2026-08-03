import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Ticket, DollarSign, TrendingUp, AlertCircle, Users, Plus, BarChart3, type LucideIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/format';
import { Spinner } from '@/components/LoadingScreen';
import type { Session, Booking } from '@/types/database';

interface SessionWithCount extends Session {
  confirmed_count: number;
}

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<SessionWithCount[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [revenue, setRevenue] = useState(0);
  const [refunds, setRefunds] = useState(0);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(0);
  const [weeklyBookings, setWeeklyBookings] = useState<{ label: string; count: number }[]>([]);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase
        .from('sessions')
        .select('*')
        .gte('session_date', new Date().toISOString().split('T')[0])
        .order('session_date', { ascending: true });
      const sessionList = (sess || []) as Session[];

      const { data: allBookings } = await supabase.from('bookings').select('*').order('created_at', { ascending: false });
      const bookingList = (allBookings || []) as Booking[];
      setBookings(bookingList);

      const counts = new Map<string, number>();
      const { data: activeBookings } = await supabase
        .from('bookings')
        .select('session_id, booking_status')
        .in('booking_status', ['Pending Payment', 'Confirmed']);
      (activeBookings || []).forEach((b: { session_id: string }) => {
        counts.set(b.session_id, (counts.get(b.session_id) || 0) + 1);
      });

      const sessionsWithCounts = sessionList.map((s) => ({ ...s, confirmed_count: counts.get(s.id) || 0 }));
      setSessions(sessionsWithCounts);

      const confirmedBookings = bookingList.filter((b) => b.booking_status === 'Confirmed' && b.payment_status === 'Paid');
      setRevenue(confirmedBookings.reduce((sum, b) => sum + Number(b.total_amount), 0));
      setRefunds(bookingList.filter((b) => b.payment_status === 'Refunded').reduce((sum, b) => sum + Number(b.total_amount), 0));
      setAwaitingConfirmation(bookingList.filter((b) => b.booking_status === 'Pending Payment').length);

      // Weekly bookings (last 7 days)
      const days: { label: string; count: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const count = bookingList.filter((b) => b.created_at.startsWith(dateStr)).length;
        days.push({ label: d.toLocaleDateString('en-MY', { weekday: 'short' }), count });
      }
      setWeeklyBookings(days);

      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spinner className="h-8 w-8 text-orange-500" />
      </div>
    );
  }

  const totalConfirmed = bookings.filter((b) => b.booking_status === 'Confirmed').length;
  const almostFull = sessions.filter((s) => s.confirmed_count >= s.maximum_capacity * 0.8 && s.confirmed_count < s.maximum_capacity);

  const maxWeekly = Math.max(...weeklyBookings.map((w) => w.count), 1);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Admin Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">Overview of club activity and performance</p>
        </div>
        <Link to="/admin/sessions/new" className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white font-bold rounded-xl transition-all">
          <Plus className="h-5 w-5" />
          Create Session
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <SummaryCard icon={CalendarDays} label="Upcoming Sessions" value={sessions.length.toString()} color="bg-rose-100 text-rose-600" />
        <SummaryCard icon={Ticket} label="Confirmed Bookings" value={totalConfirmed.toString()} color="bg-green-100 text-green-600" />
        <SummaryCard icon={AlertCircle} label="Awaiting Confirmation" value={awaitingConfirmation.toString()} color="bg-amber-100 text-amber-600" />
        <SummaryCard icon={DollarSign} label="Total Revenue" value={formatCurrency(revenue)} color="bg-green-100 text-green-600" />
        <SummaryCard icon={TrendingUp} label="Total Refunds" value={formatCurrency(refunds)} color="bg-slate-100 text-slate-500" />
        <SummaryCard icon={Users} label="Almost Full Sessions" value={almostFull.length.toString()} color="bg-orange-100 text-orange-600" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Weekly bookings chart */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-slate-500" />
            Weekly Bookings (Last 7 Days)
          </h2>
          <div className="flex items-end justify-between gap-2 h-40">
            {weeklyBookings.map((day, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full bg-gradient-to-t from-rose-400 to-orange-400 rounded-t-lg transition-all hover:from-rose-500 hover:to-orange-500" style={{ height: `${(day.count / maxWeekly) * 100}%`, minHeight: '4px' }}>
                  <div className="text-center text-xs font-bold text-white pt-1">{day.count > 0 ? day.count : ''}</div>
                </div>
                <span className="text-xs text-slate-500">{day.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Booking status distribution */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-slate-500" />
            Booking Status Distribution
          </h2>
          <div className="space-y-3">
            {(['Confirmed', 'Pending Payment', 'Cancelled by Player', 'Cancelled by Admin', 'Completed', 'No Show', 'Refunded'] as const).map((status) => {
              const count = bookings.filter((b) => b.booking_status === status).length;
              const pct = bookings.length > 0 ? (count / bookings.length) * 100 : 0;
              const colors: Record<string, string> = {
                Confirmed: 'bg-green-500',
                'Pending Payment': 'bg-amber-500',
                'Cancelled by Player': 'bg-red-500',
                'Cancelled by Admin': 'bg-red-400',
                Completed: 'bg-blue-500',
                'No Show': 'bg-slate-400',
                Refunded: 'bg-purple-500',
              };
              return (
                <div key={status}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600">{status}</span>
                    <span className="font-medium text-slate-900">{count}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${colors[status]} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Almost full sessions */}
      {almostFull.length > 0 && (
        <div className="mt-6 bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            Sessions Almost Full
          </h2>
          <div className="space-y-2">
            {almostFull.map((s) => (
              <Link key={s.id} to={`/admin/sessions/${s.id}/edit`} className="flex items-center justify-between bg-amber-50 rounded-xl p-3 hover:bg-amber-100 transition-colors">
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{s.title}</p>
                  <p className="text-xs text-slate-500">{formatDate(s.session_date)} · {s.venue_name}</p>
                </div>
                <span className="text-sm font-bold text-amber-600">{s.confirmed_count}/{s.maximum_capacity}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, color }: { icon: LucideIcon; label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <div className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${color} mb-3`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-xl font-bold text-slate-900">{value}</p>
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}
