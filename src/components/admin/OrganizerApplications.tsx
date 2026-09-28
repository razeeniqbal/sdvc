import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/context/ToastContext';
import { fetchPendingApplications, reviewApplication, type PendingApplication } from '@/lib/organizers';
import { formatDateTime } from '@/lib/format';
import { SectionTitle } from '@/components/admin/AdminUI';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { Spinner } from '@/components/LoadingScreen';

// Admin: pending organizer applications. Approving makes the member an
// organizer (review_organizer_application RPC); both outcomes notify them.
// Renders nothing when there's nothing to review.
export function OrganizerApplications({ onChange }: { onChange?: () => void }) {
  const { show } = useToast();
  const [apps, setApps] = useState<PendingApplication[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchPendingApplications().then(setApps).catch(() => setApps([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function decide(app: PendingApplication, approve: boolean) {
    setBusy(app.id);
    try {
      await reviewApplication(app.id, approve);
      const name = app.profile?.short_name || app.profile?.full_name || 'Member';
      show(approve ? `${name} is now an organizer.` : `${name}'s application was declined.`, 'success');
      load();
      onChange?.();
    } catch (err) {
      show((err as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  }

  if (!apps || apps.length === 0) return null;

  return (
    <section className="mb-10" aria-labelledby="org-apps-heading">
      <SectionTitle id="org-apps-heading" action={<span className="adm-label">{apps.length} waiting</span>}>Organizer applications</SectionTitle>
      <ul className="divide-y divide-ink-700 border-y border-ink-600">
        {apps.map((a) => {
          const name = a.profile?.short_name || a.profile?.full_name || 'Member';
          return (
            <li key={a.id} className="flex flex-wrap items-start gap-4 py-4">
              <PlayerAvatar name={name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-chalk">{name} <span className="text-sm font-normal text-muted">· {a.profile?.phone_number || a.profile?.email}</span></p>
                <p className="text-xs text-muted">Applied {formatDateTime(a.created_at)}</p>
                {a.message && <p className="mt-2 max-w-2xl whitespace-pre-line text-sm text-slate-300">{a.message}</p>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => decide(a, false)} disabled={busy === a.id} className="adm-btn">Decline</button>
                <button onClick={() => decide(a, true)} disabled={busy === a.id} className="adm-btn !border-vsb-600 !text-vsb-200">
                  {busy === a.id && <Spinner className="h-4 w-4" />} Approve
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
