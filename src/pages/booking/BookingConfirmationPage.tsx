import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, Calendar, Clock, MapPin, Ticket, ArrowRight, CalendarPlus, MessageCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { formatCurrency, formatDate, formatTime } from '@/lib/format';
import { fetchClubSettings } from '@/lib/settings';
import type { Booking, Session, Payment, Profile, ClubSettings } from '@/types/database';
import { Spinner } from '@/components/LoadingScreen';

export default function BookingConfirmationPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [settings, setSettings] = useState<ClubSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClubSettings().then(setSettings);
    if (!bookingId) return;
    (async () => {
      const { data: b } = await supabase.from('bookings').select('*').eq('id', bookingId).maybeSingle();
      if (!b) {
        navigate('/dashboard');
        return;
      }
      setBooking(b as Booking);
      const { data: s } = await supabase.from('sessions').select('*').eq('id', b.session_id).maybeSingle();
      setSession(s as Session);
      const { data: p } = await supabase.from('payments').select('*').eq('booking_id', b.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
      setPayment(p as Payment);
      setLoading(false);
    })();
  }, [bookingId]);

  function handleAddToCalendar() {
    if (!session) return;
    const start = new Date(`${session.session_date}T${session.start_time}`);
    const end = new Date(`${session.session_date}T${session.end_time}`);
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const title = encodeURIComponent(session.title);
    const details = encodeURIComponent(`Volleyball session at ${session.venue_name}`);
    const location = encodeURIComponent(session.venue_name);
    const dates = `${fmt(start)}/${fmt(end)}`;
    window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${location}`, '_blank');
  }

  if (loading || !booking || !session) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spinner className="h-8 w-8 text-orange-500" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="glass-card rounded-2xl shadow-lg border border-white/50 overflow-hidden">
        {/* Success header */}
        <div className="bg-gradient-to-r from-rose-500 to-orange-500 p-6 sm:p-8 text-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-white/20 mb-4">
            <CheckCircle2 className="h-9 w-9 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Booking Confirmed!</h1>
          <p className="text-green-100 text-sm">Your slot has been reserved. See you on court!</p>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          {/* Booking reference */}
          <div className="text-center bg-slate-50 rounded-xl p-4">
            <p className="text-xs text-slate-500 mb-1">Booking Reference</p>
            <p className="text-2xl font-mono font-bold text-slate-900">{booking.booking_reference}</p>
          </div>

          {/* Session info */}
          <div>
            <h2 className="font-bold text-slate-900 mb-3">Session Information</h2>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-slate-600">
                <Ticket className="h-4 w-4 text-slate-400" />
                <span className="font-medium text-slate-900">{session.title}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Calendar className="h-4 w-4 text-slate-400" />
                <span>{formatDate(session.session_date)}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Clock className="h-4 w-4 text-slate-400" />
                <span>{formatTime(session.start_time)} - {formatTime(session.end_time)}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <MapPin className="h-4 w-4 text-slate-400" />
                <span>{session.venue_name} {session.court_number && `· ${session.court_number}`}</span>
              </div>
            </div>
          </div>

          {/* Player info */}
          <div>
            <h2 className="font-bold text-slate-900 mb-3">Player Information</h2>
            <div className="space-y-1 text-sm text-slate-600">
              <p><span className="text-slate-500">Name:</span> <span className="font-medium text-slate-900">{profile?.full_name}</span></p>
              <p><span className="text-slate-500">Email:</span> <span className="font-medium text-slate-900">{profile?.email}</span></p>
              <p><span className="text-slate-500">Phone:</span> <span className="font-medium text-slate-900">{profile?.phone_number || 'N/A'}</span></p>
            </div>
          </div>

          {/* Payment info */}
          <div>
            <h2 className="font-bold text-slate-900 mb-3">Payment Information</h2>
            <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Status</span>
                <span className="font-semibold text-green-600">Paid</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Method</span>
                <span className="font-medium text-slate-900">{payment?.payment_method || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Reference</span>
                <span className="font-mono text-slate-900">{payment?.transaction_reference || 'N/A'}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-200">
                <span className="font-bold text-slate-900">Amount Paid</span>
                <span className="text-lg font-bold text-green-600">{formatCurrency(booking.total_amount)}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={handleAddToCalendar}
              className="flex items-center justify-center gap-2 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-colors"
            >
              <CalendarPlus className="h-5 w-5" />
              Add to Calendar
            </button>
            <Link
              to="/bookings"
              className="flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white font-bold rounded-xl transition-all"
            >
              <Ticket className="h-5 w-5" />
              View My Bookings
            </Link>
          </div>

          <Link to="/sessions" className="flex items-center justify-center gap-1.5 text-sm text-rose-600 font-semibold hover:underline">
            Book another session
            <ArrowRight className="h-4 w-4" />
          </Link>

          {settings?.whatsapp_group_link && (
            <a href={settings.whatsapp_group_link} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 text-sm text-green-600 font-semibold hover:underline">
              <MessageCircle className="h-4 w-4" />
              Join our WhatsApp Group
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
