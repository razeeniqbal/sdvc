import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { formatDate, formatDateTime } from '@/lib/format';
import { whatsappLink } from '@/lib/settings';
import { Spinner } from '@/components/LoadingScreen';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { OpsBadge, type OpsTone } from '@/components/admin/AdminUI';
import { useSessionWorkspace } from './sessionWorkspace';
import type { WaitingListEntry, Profile, WaitingListStatus } from '@/types/database';
import { bookingLink } from '@/lib/site';

interface WaitlistEntry extends WaitingListEntry {
  profile: Profile;
}

const STATUS_TONE: Record<WaitingListStatus, OpsTone> = { Waiting: 'attention', Offered: 'info', Booked: 'good', Expired: 'neutral', Cancelled: 'neutral' };

function waitedFor(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins} min`;
  const h = Math.round(mins / 60);
  return h < 48 ? `${h} h` : `${Math.round(h / 24)} days`;
}

export default function AdminWaitingListPage() {
  const { id } = useParams<{ id: string }>();
  const { show } = useToast();
  const { session, reload } = useSessionWorkspace();
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    if (!id) return;
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

  // Books the slot for this player immediately (via a SECURITY DEFINER function, since
  // RLS otherwise only lets a user insert their own booking) rather than just marking
  // them "Offered" and waiting for them to click through Checkout themselves — faster
  // and doesn't depend on them acting within a countdown window.
  async function offerSlot(entry: WaitlistEntry) {
    setBusy(entry.id);
    const { data: bookingId, error } = await supabase.rpc('admin_book_waitlist_offer', { p_entry_id: entry.id });
    setBusy(null);
    if (error) { show(error.message, 'error'); return; }

    if (entry.profile.phone_number) {
      const bookingUrl = bookingLink(bookingId);
      const name = entry.profile.short_name || entry.profile.full_name;
      const message = `Hai ${name}! 🏐 Slot untuk "${session.title}" (${formatDate(session.session_date)}) telah ditempah untuk anda. Harga RM${Number(session.price).toFixed(2)}. Sila bayar & muat naik resit secepat mungkin, kalau tidak slot akan dibatalkan. Bayar sini: ${bookingUrl}`;
      window.open(whatsappLink(entry.profile.phone_number, message), '_blank');
    } else {
      show('Booked, but this player has no phone number on file to message.', 'info');
    }

    show('Slot booked for this player', 'success');
    load();
    reload();
  }

  async function removeEntry(entry: WaitlistEntry) {
    setBusy(entry.id);
    const { error } = await supabase.from('waiting_list').delete().eq('id', entry.id);
    setBusy(null);
    if (error) { show(error.message, 'error'); return; }
    show('Removed from waiting list', 'success');
    load();
    reload();
  }

  if (loading) {
    return <div className="flex min-h-[30vh] items-center justify-center"><Spinner className="h-7 w-7 text-vsb-500" /></div>;
  }

  const waiting = entries.filter((e) => e.status === 'Waiting');
  const history = entries.filter((e) => e.status !== 'Waiting');
  const spotsLeft = Math.max(0, session.maximum_capacity - session.active_count);

  return (
    <div className="adm-page">
      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-ink-600 pb-5">
        <div>
          <p className="adm-label">Waiting list</p>
          <p className="adm-num mt-1 text-4xl">{waiting.length} <span className="text-lg font-bold tracking-wider text-muted">waiting</span></p>
        </div>
        <p className="text-sm text-slate-400">
          {spotsLeft > 0 ? <><span className="font-semibold text-chalk">{spotsLeft} spot{spotsLeft === 1 ? '' : 's'}</span> open — booking a player uses one.</> : 'Session is currently full.'}
        </p>
      </div>

      {waiting.length === 0 ? (
        <p className="py-10 text-slate-400">No one is waiting. When the session is full, players can join the waiting list from the session page.</p>
      ) : (
        <ol className="divide-y divide-ink-700 border-b border-ink-600">
          {waiting.map((entry, i) => {
            const name = entry.profile.short_name || entry.profile.full_name;
            return (
              <li key={entry.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  <span className="adm-num w-10 text-3xl text-vsb-500">{String(i + 1).padStart(2, '0')}</span>
                  <PlayerAvatar name={name} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-chalk">{name}</p>
                    <p className="text-xs text-muted">
                      Waiting {waitedFor(entry.created_at)} · {entry.profile.gender || 'Gender not set'} · {entry.profile.phone_number || 'No phone'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => offerSlot(entry)} disabled={busy === entry.id} className="v2-btn-primary min-h-[44px] flex-1 font-display uppercase tracking-wider sm:flex-none">
                    {busy === entry.id && <Spinner className="h-4 w-4" />} Book this slot
                  </button>
                  <button onClick={() => removeEntry(entry)} disabled={busy === entry.id} aria-label={`Remove ${name} from the waiting list`} className="adm-btn min-h-[44px] !px-3">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {history.length > 0 && (
        <section className="mt-8" aria-labelledby="wl-history">
          <h2 id="wl-history" className="adm-label mb-2">Earlier entries</h2>
          <ul className="divide-y divide-ink-700 border-y border-ink-600">
            {history.map((entry) => (
              <li key={entry.id} className="flex items-center gap-3 py-2.5 text-sm">
                <span className="min-w-0 flex-1 truncate text-slate-300">{entry.profile.short_name || entry.profile.full_name}</span>
                <span className="hidden text-xs text-muted sm:inline">Joined {formatDateTime(entry.created_at)}</span>
                <OpsBadge tone={STATUS_TONE[entry.status]}>{entry.status}</OpsBadge>
                <button onClick={() => removeEntry(entry)} disabled={busy === entry.id} aria-label="Remove entry" className="p-1.5 text-muted hover:text-red-300"><Trash2 className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
