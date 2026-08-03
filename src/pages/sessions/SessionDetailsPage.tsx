import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CalendarDays, Clock, MapPin, Tag, Users, ArrowLeft, CheckCircle2, Info, MessageCircle, Phone, type LucideIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate, formatTime, getDayName } from '@/lib/format';
import { getSessionStatus, type SessionWithCount } from '@/lib/sessions';
import { fetchClubSettings, whatsappLink } from '@/lib/settings';
import { useToast } from '@/context/ToastContext';
import { Spinner } from '@/components/LoadingScreen';
import { StatusBadge } from '@/components/StatusBadge';
import type { ClubSettings, BookingStatus } from '@/types/database';

interface SessionPlayer {
  display_name: string;
  booking_status: BookingStatus;
}

export default function SessionDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { show } = useToast();
  const [session, setSession] = useState<SessionWithCount | null>(null);
  const [loading, setLoading] = useState(true);
  const [onWaitlist, setOnWaitlist] = useState(false);
  const [settings, setSettings] = useState<ClubSettings | null>(null);
  const [players, setPlayers] = useState<SessionPlayer[]>([]);

  useEffect(() => {
    fetchClubSettings().then(setSettings);
    if (!id) return;
    (async () => {
      const { data, error } = await supabase.from('sessions').select('*').eq('id', id).maybeSingle();
      if (error || !data) {
        show('Session not found', 'error');
        navigate('/sessions');
        return;
      }
      const { data: count } = await supabase.rpc('confirmed_booking_count', { p_session_id: id });
      setSession({ ...data, confirmed_count: (count as number) || 0 } as SessionWithCount);
      const { data: playerList } = await supabase.rpc('session_player_list', { p_session_id: id });
      setPlayers((playerList || []) as SessionPlayer[]);
      setLoading(false);
    })();
    // reload only when the session id changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleJoinWaitlist() {
    if (!session) return;
    const { data: existing } = await supabase
      .from('waiting_list')
      .select('id')
      .eq('session_id', session.id)
      .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
      .eq('status', 'Waiting')
      .maybeSingle();
    if (existing) {
      show('You are already on the waiting list', 'info');
      return;
    }
    const { count } = await supabase
      .from('waiting_list')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', session.id)
      .eq('status', 'Waiting');
    const { error } = await supabase.from('waiting_list').insert({
      session_id: session.id,
      queue_position: (count || 0) + 1,
      status: 'Waiting',
    });
    if (error) {
      show(error.message, 'error');
      return;
    }
    setOnWaitlist(true);
    show('Added to the waiting list! We will notify you if a slot opens up.', 'success');
  }

  if (loading || !session) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spinner className="h-8 w-8 text-orange-500" />
      </div>
    );
  }

  const status = getSessionStatus(session, session.confirmed_count);
  const canBook = status === 'Available' || status === 'Almost Full';
  const available = session.maximum_capacity - session.confirmed_count;
  const requiredItems = ['Sports shoes', 'Water bottle', 'Comfortable sports attire', 'Towel'];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <Link to="/sessions" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ArrowLeft className="h-4 w-4" />
        Back to sessions
      </Link>

      <div className="glass-card rounded-2xl border border-white/50 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-slate-900 via-rose-950 to-slate-900 p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">{session.title}</h1>
              <p className="text-slate-400">{getDayName(session.session_date)} · {formatDate(session.session_date)}</p>
            </div>
            <span className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium ${
              status === 'Available' ? 'bg-green-100 text-green-800 border-green-200' :
              status === 'Almost Full' ? 'bg-amber-100 text-amber-800 border-amber-200' :
              status === 'Fully Booked' ? 'bg-red-100 text-red-700 border-red-200' :
              'bg-slate-100 text-slate-600 border-slate-200'
            }`}>
              {status}
            </span>
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          {session.description && (
            <div>
              <h2 className="font-bold text-slate-900 mb-2">About this session</h2>
              <p className="text-slate-600 leading-relaxed">{session.description}</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InfoRow icon={CalendarDays} label="Date" value={formatDate(session.session_date)} />
            <InfoRow icon={Clock} label="Time" value={`${formatTime(session.start_time)} - ${formatTime(session.end_time)}`} />
            <InfoRow icon={MapPin} label="Venue" value={session.venue_name} />
            <InfoRow icon={Tag} label="Court" value={session.court_number || 'Not specified'} />
            <InfoRow icon={Users} label="Capacity" value={`${session.confirmed_count} / ${session.maximum_capacity} (${available} slots left)`} />
          </div>

          {players.length > 0 && (
            <div>
              <h2 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                <Users className="h-5 w-5 text-rose-500" /> Who's Playing ({players.length})
              </h2>
              <div className="space-y-1.5">
                {players.map((p, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 bg-slate-50 rounded-xl px-3 py-2">
                    <span className="flex items-center gap-2 text-sm text-slate-700 min-w-0">
                      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rose-400 to-orange-400 text-white text-[10px] font-bold">
                        {p.display_name.charAt(0).toUpperCase()}
                      </span>
                      <span className="truncate">{p.display_name}</span>
                    </span>
                    <StatusBadge status={p.booking_status} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {session.venue_address && (
            <div>
              <h2 className="font-bold text-slate-900 mb-2">Venue Address</h2>
              <p className="text-slate-600">{session.venue_address}</p>
              {session.maps_link && (
                <a href={session.maps_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-orange-600 font-medium text-sm mt-2 hover:underline">
                  <MapPin className="h-4 w-4" />
                  View on Google Maps
                </a>
              )}
            </div>
          )}

          <div>
            <h2 className="font-bold text-slate-900 mb-2">Session Rules</h2>
            <ul className="space-y-1.5 text-sm text-slate-600">
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-rose-500 flex-shrink-0 mt-0.5" /> Please arrive 10 minutes before the session starts.</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-rose-500 flex-shrink-0 mt-0.5" /> Cancel at least 24 hours before to free your slot.</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-rose-500 flex-shrink-0 mt-0.5" /> All bookings are non-refundable.</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-rose-500 flex-shrink-0 mt-0.5" /> Respect all players — we're here for fun!</li>
            </ul>
          </div>

          <div>
            <h2 className="font-bold text-slate-900 mb-2">What to Bring</h2>
            <div className="flex flex-wrap gap-2">
              {requiredItems.map((item) => (
                <span key={item} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-lg text-sm text-slate-700">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  {item}
                </span>
              ))}
            </div>
          </div>

          {session.notes && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-start gap-2">
                <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-blue-900 text-sm mb-1">Notes from the club</p>
                  <p className="text-blue-700 text-sm">{session.notes}</p>
                </div>
              </div>
            </div>
          )}

          {/* Contact */}
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Phone className="h-5 w-5 text-green-600" />
              <p className="font-semibold text-green-900 text-sm">Need help? Contact us</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                href={whatsappLink(settings?.contact_whatsapp || '0137441727', `Hi, I have a question about the session "${session.title}" on ${formatDate(session.session_date)}.`)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp {settings?.contact_whatsapp || '0137441727'}
              </a>
              {settings?.whatsapp_group_link && (
                <a
                  href={settings.whatsapp_group_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-green-300 hover:bg-green-50 text-green-700 text-sm font-medium rounded-lg transition-colors"
                >
                  <MessageCircle className="h-4 w-4" />
                  Join Group
                </a>
              )}
            </div>
          </div>

          <div className="border-t border-slate-200 pt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-slate-500">Price per player</p>
                <p className="text-3xl font-bold text-slate-900">{session.price > 0 ? formatCurrency(session.price) : 'TBC'}</p>
                {session.price === 0 && <p className="text-xs text-amber-600 mt-0.5">Final price depends on turnout — confirmed by admin</p>}
              </div>
              <div className="text-right text-sm text-slate-500">
                <p>Booking deadline: {session.booking_close_at ? formatDate(session.booking_close_at) : 'None'}</p>
                <p>Cancellation deadline: 24h before session</p>
                <p className="text-rose-600 font-medium">Non-refundable</p>
              </div>
            </div>

            {canBook ? (
              <button
                onClick={() => navigate(`/checkout/${session.id}`)}
                className="w-full py-4 bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white font-bold rounded-xl text-lg transition-all"
              >
                Book This Session
              </button>
            ) : status === 'Fully Booked' ? (
              onWaitlist ? (
                <div className="w-full py-4 bg-amber-50 border border-amber-200 text-amber-800 font-bold rounded-xl text-center">
                  You are on the waiting list
                </div>
              ) : (
                <button
                  onClick={handleJoinWaitlist}
                  className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-lg transition-colors"
                >
                  Join Waiting List
                </button>
              )
            ) : (
              <div className="w-full py-4 bg-slate-100 text-slate-500 font-bold rounded-xl text-center">
                {status}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 bg-slate-50 rounded-xl p-3">
      <Icon className="h-5 w-5 text-slate-400 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-sm font-medium text-slate-900">{value}</p>
      </div>
    </div>
  );
}
