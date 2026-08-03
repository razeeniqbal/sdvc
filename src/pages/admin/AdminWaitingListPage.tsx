import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Users, Clock, Phone, UserPlus, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { formatDate, formatTime, formatDateTime } from '@/lib/format';
import { Spinner } from '@/components/LoadingScreen';
import type { Session, WaitingListEntry, Profile } from '@/types/database';

interface WaitlistEntry extends WaitingListEntry {
  profile: Profile;
}

export default function AdminWaitingListPage() {
  const { id } = useParams<{ id: string }>();
  const { show } = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!id) return;
    const { data: s } = await supabase.from('sessions').select('*').eq('id', id).maybeSingle();
    setSession(s as Session);
    const { data } = await supabase
      .from('waiting_list')
      .select('*, profile:profiles(*)')
      .eq('session_id', id)
      .order('queue_position', { ascending: true });
    setEntries((data || []) as unknown as WaitlistEntry[]);
    setLoading(false);
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when the session id changes
  useEffect(() => { load(); }, [id]);

  async function offerSlot(entry: WaitlistEntry) {
    const { error } = await supabase.from('waiting_list').update({
      status: 'Offered',
      offer_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    }).eq('id', entry.id);
    if (error) { show(error.message, 'error'); return; }
    await supabase.from('notifications').insert({
      user_id: entry.user_id,
      notification_type: 'waitlist_slot_available',
      title: 'Slot Available!',
      message: `A slot opened up for "${session?.title}" on ${session?.session_date}. You have 10 minutes to complete your booking.`,
      delivery_channel: 'in_app',
      delivery_status: 'Sent',
      sent_at: new Date().toISOString(),
    });
    show('Slot offered to next player in queue', 'success');
    load();
  }

  async function removeEntry(entry: WaitlistEntry) {
    const { error } = await supabase.from('waiting_list').delete().eq('id', entry.id);
    if (error) { show(error.message, 'error'); return; }
    show('Removed from waiting list', 'success');
    load();
  }

  if (loading || !session) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spinner className="h-8 w-8 text-orange-500" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <Link to="/admin/sessions" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ArrowLeft className="h-4 w-4" />
        Back to sessions
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Waiting List</h1>
        <p className="text-slate-500 text-sm mt-1">{session.title} · {formatDate(session.session_date)} · {formatTime(session.start_time)}</p>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-16">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-4">
            <Users className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-1">No one on the waiting list</h3>
          <p className="text-slate-500 text-sm">When the session is full, players can join the waiting list.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <div key={entry.id} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 font-bold text-sm">
                    #{entry.queue_position}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{entry.profile.full_name}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                      <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{entry.profile.phone_number || 'N/A'}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">Joined {formatDateTime(entry.created_at)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                    entry.status === 'Waiting' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                    entry.status === 'Offered' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                    entry.status === 'Booked' ? 'bg-green-100 text-green-800 border-green-200' :
                    'bg-slate-100 text-slate-600 border-slate-200'
                  }`}>
                    {entry.status}
                  </span>
                  {entry.status === 'Offered' && entry.offer_expires_at && (
                    <span className="flex items-center gap-1 text-xs text-amber-600">
                      <Clock className="h-3 w-3" />
                      {new Date(entry.offer_expires_at).toLocaleTimeString('en-MY', { hour: 'numeric', minute: '2-digit', hour12: true })}
                    </span>
                  )}
                  {entry.status === 'Waiting' && (
                    <button onClick={() => offerSlot(entry)} className="inline-flex items-center gap-1.5 px-3 py-2 bg-green-50 hover:bg-green-100 text-green-700 font-medium rounded-lg text-sm border border-green-200 transition-colors">
                      <UserPlus className="h-4 w-4" />
                      Offer Slot
                    </button>
                  )}
                  <button onClick={() => removeEntry(entry)} className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
