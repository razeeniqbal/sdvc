import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { fetchCourtRoster, type CourtPlayer, type SessionWithCount } from '@/lib/sessions';
import { fetchClubSettings } from '@/lib/settings';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import { Spinner } from '@/components/LoadingScreen';
import { SessionDetailsView } from '@/components/vsb/SessionDetailsView';
import type { ClubSettings, WaitingListEntry } from '@/types/database';

// Data + behaviour for a session page. Presentation lives in SessionDetailsView.
export default function SessionDetailsPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { show } = useToast();
  const { profile } = useAuth();
  const [session, setSession] = useState<SessionWithCount | null>(null);
  const [loading, setLoading] = useState(true);
  const [myWaitlistEntry, setMyWaitlistEntry] = useState<WaitingListEntry | null>(null);
  const [settings, setSettings] = useState<ClubSettings | null>(null);
  const [players, setPlayers] = useState<CourtPlayer[]>([]);
  const [needsPasskey, setNeedsPasskey] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    fetchClubSettings().then(setSettings);
    if (!id || !profile) return;
    (async () => {
      const { data, error } = await supabase.from('sessions').select('*').eq('id', id).maybeSingle();
      if (error || !data) {
        show(t('sessionDetails.sessionNotFound'), 'error');
        navigate('/sessions');
        return;
      }
      const { data: count } = await supabase.rpc('confirmed_booking_count', { p_session_id: id });
      setSession({ ...data, confirmed_count: (count as number) || 0 } as SessionWithCount);
      setPlayers(await fetchCourtRoster(id));
      const { data: requiresPasskey } = await supabase.rpc('session_requires_passkey', { p_session_id: id });
      setNeedsPasskey(!!requiresPasskey);
      // Was this player already waitlisted for this session? The old version only
      // tracked this in local state after a fresh join click, so returning to the page
      // never showed up here.
      const { data: waitlistEntry } = await supabase
        .from('waiting_list')
        .select('*')
        .eq('session_id', id)
        .eq('user_id', profile.id)
        .eq('status', 'Waiting')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setMyWaitlistEntry(waitlistEntry as WaitingListEntry | null);
      setLoading(false);
    })();
    // reload only when the session id or profile changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, profile]);

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
      show(t('sessionDetails.alreadyOnWaitlist'), 'info');
      return;
    }
    const { count } = await supabase
      .from('waiting_list')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', session.id)
      .eq('status', 'Waiting');
    const { data: inserted, error } = await supabase.from('waiting_list').insert({
      session_id: session.id,
      queue_position: (count || 0) + 1,
      status: 'Waiting',
    }).select().maybeSingle();
    if (error) {
      show(error.message, 'error');
      return;
    }
    setMyWaitlistEntry(inserted as WaitingListEntry);
    show(t('sessionDetails.addedToWaitlist'), 'success');
  }

  if (loading || !session) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spinner className="h-8 w-8 text-vsb-500" />
      </div>
    );
  }

  return (
    <SessionDetailsView
      session={session}
      players={players}
      settings={settings}
      needsPasskey={needsPasskey}
      unlocked={unlocked}
      onUnlocked={() => setUnlocked(true)}
      onWaitlist={myWaitlistEntry?.status === 'Waiting'}
      onBook={() => navigate(`/checkout/${session.id}`, { state: { passkeyVerified: true } })}
      onJoinWaitlist={handleJoinWaitlist}
    />
  );
}
