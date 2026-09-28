import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Save, MessageCircle, Search, Trash2, Upload, Download, KeyRound } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { fetchClubSettings, whatsappLink } from '@/lib/settings';
import { uploadClubQrImage } from '@/lib/receipts';
import { formatDate, formatDateTime } from '@/lib/format';
import { Spinner } from '@/components/LoadingScreen';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { AdminPageHeader, OpsBadge, Stat } from '@/components/admin/AdminUI';
import type { Profile } from '@/types/database';

type RoleFilter = 'all' | 'admin' | 'player';

interface PasswordResetRequest {
  id: string;
  token: string;
  phone_number: string;
  expires_at: string;
  created_at: string;
  profile: { full_name: string; short_name: string | null } | null;
}

export default function AdminSettingsPage() {
  const { show } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    club_name: '',
    contact_person_name: '',
    contact_whatsapp: '',
    whatsapp_group_link: '',
    whatsapp_group_notify: false,
  });

  // Admin promotion
  const [users, setUsers] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [promoting, setPromoting] = useState(false);
  const [deleteUser, setDeleteUser] = useState<Profile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [resetUser, setResetUser] = useState<Profile | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetRequests, setResetRequests] = useState<PasswordResetRequest[]>([]);

  // Payment QR code
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [uploadingQr, setUploadingQr] = useState(false);
  const qrInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchClubSettings().then((s) => {
      if (s) {
        setForm({
          club_name: s.club_name,
          contact_person_name: s.contact_person_name,
          contact_whatsapp: s.contact_whatsapp,
          whatsapp_group_link: s.whatsapp_group_link,
          whatsapp_group_notify: s.whatsapp_group_notify,
        });
        setQrUrl(s.payment_qr_url);
      }
      setLoading(false);
    });
    loadUsers();
    loadResetRequests();
  }, []);

  async function loadResetRequests() {
    const { data } = await supabase
      .from('password_reset_requests')
      .select('id, token, phone_number, expires_at, created_at, profile:profiles(full_name, short_name)')
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });
    setResetRequests((data || []) as unknown as PasswordResetRequest[]);
  }

  async function handleQrUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingQr(true);
    try {
      const url = await uploadClubQrImage(file);
      const { error } = await supabase.from('club_settings').update({ payment_qr_url: url }).eq('id', 1);
      if (error) throw error;
      setQrUrl(url);
      show('Payment QR code updated', 'success');
    } catch {
      show('Failed to upload QR code', 'error');
    } finally {
      setUploadingQr(false);
      if (qrInputRef.current) qrInputRef.current.value = '';
    }
  }

  async function loadUsers() {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    setUsers((data || []) as Profile[]);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from('club_settings').update({
      club_name: form.club_name,
      contact_person_name: form.contact_person_name,
      contact_whatsapp: form.contact_whatsapp,
      whatsapp_group_link: form.whatsapp_group_link,
      whatsapp_group_notify: form.whatsapp_group_notify,
    }).eq('id', 1);
    setSaving(false);
    if (error) { show(error.message, 'error'); return; }
    show('Settings saved', 'success');
  }

  async function toggleAdmin(user: Profile) {
    setPromoting(true);
    const newRole = user.role === 'admin' ? 'player' : 'admin';
    const { error } = await supabase.rpc('set_user_role', {
      target_email: user.email,
      new_role: newRole,
    });
    setPromoting(false);
    if (error) {
      show(error.message, 'error');
      return;
    }
    show(`${user.short_name || user.full_name} is now ${newRole === 'admin' ? 'an admin' : 'a player'}`, 'success');
    loadUsers();
  }

  async function handleDeleteUser() {
    if (!deleteUser) return;
    setDeleting(true);
    const { data: { session } } = await supabase.auth.getSession();
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`;
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ target_user_id: deleteUser.id }),
    });
    const body = await res.json();
    setDeleting(false);
    if (!res.ok) { show(body.error || 'Failed to delete account', 'error'); return; }
    show(`${deleteUser.short_name || deleteUser.full_name}'s account was deleted`, 'success');
    setDeleteUser(null);
    loadUsers();
  }

  async function handleResetPassword() {
    if (!resetUser) return;
    if (newPassword.length < 6) { show('Password must be at least 6 characters', 'error'); return; }
    setResetting(true);
    const { data: { session } } = await supabase.auth.getSession();
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reset-password`;
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ target_user_id: resetUser.id, new_password: newPassword }),
    });
    const body = await res.json();
    setResetting(false);
    if (!res.ok) { show(body.error || 'Failed to reset password', 'error'); return; }
    show(`${resetUser.short_name || resetUser.full_name}'s password was reset`, 'success');
    setResetUser(null);
    setNewPassword('');
  }

  function exportUsersCSV() {
    const headers = ['Name', 'Email', 'Phone', 'Gender', 'Role', 'Joined'];
    const rows = filteredUsers.map((u) => [
      u.short_name || u.full_name,
      u.email,
      u.phone_number || '',
      u.gender || '',
      u.role,
      formatDate(u.created_at),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const adminCount = users.filter((u) => u.role === 'admin').length;
  const playerCount = users.length - adminCount;

  const filteredUsers = users.filter((u) => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (u.short_name || u.full_name).toLowerCase().includes(q) || (u.phone_number || '').toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spinner className="h-8 w-8 text-vsb-400" />
      </div>
    );
  }

  const inputClass = 'v2-input !py-2.5 !text-base';
  const labelClass = 'mb-1.5 block text-sm font-medium text-slate-300';

  const sections = [
    { id: 'general', label: 'General' },
    { id: 'community', label: 'Community' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'payment', label: 'Payment' },
    { id: 'access', label: 'Access' },
  ];

  return (
    <div className="adm-page">
      <AdminPageHeader meta="System" title="Club settings" />

      <div className="grid gap-8 xl:grid-cols-[12rem_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="hidden xl:block">
          <ul className="sticky top-8 space-y-1 border-l border-ink-600">
            {sections.map((s) => (
              <li key={s.id}><a href={`#${s.id}`} className="-ml-px block border-l-2 border-transparent py-1.5 pl-4 text-sm font-semibold text-slate-400 hover:border-vsb-500 hover:text-chalk">{s.label}</a></li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 max-w-5xl">
          <form onSubmit={handleSubmit}>
            <SettingsRow id="general" title="General" desc="How the club is named and who players contact.">
              <div>
                <label htmlFor="st-club" className={labelClass}>Club name</label>
                <input id="st-club" className={inputClass} value={form.club_name} onChange={(e) => setForm({ ...form, club_name: e.target.value })} required />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="st-contact" className={labelClass}>Contact person</label>
                  <input id="st-contact" className={inputClass} value={form.contact_person_name} onChange={(e) => setForm({ ...form, contact_person_name: e.target.value })} required />
                </div>
                <div>
                  <label htmlFor="st-wa" className={labelClass}>Contact WhatsApp number</label>
                  <input id="st-wa" className={inputClass} placeholder="0137441727" value={form.contact_whatsapp} onChange={(e) => setForm({ ...form, contact_whatsapp: e.target.value })} required />
                </div>
              </div>
            </SettingsRow>

            <SettingsRow id="community" title="Community" desc="The group chat players are invited to join.">
              <div>
                <label htmlFor="st-group" className={labelClass}>WhatsApp group link</label>
                <input id="st-group" className={inputClass} placeholder="https://chat.whatsapp.com/..." value={form.whatsapp_group_link} onChange={(e) => setForm({ ...form, whatsapp_group_link: e.target.value })} />
                <p className="mt-1.5 text-xs text-muted">Shown on the landing page, session pages and booking confirmations.</p>
              </div>
            </SettingsRow>

            <SettingsRow id="notifications" title="Notifications" desc="Automatic messages to your Telegram group.">
              <label className="flex cursor-pointer items-start gap-3">
                <input type="checkbox" checked={form.whatsapp_group_notify} onChange={(e) => setForm({ ...form, whatsapp_group_notify: e.target.checked })} className="mt-1 h-5 w-5 accent-[#168BFF]" />
                <span>
                  <span className="block font-semibold text-chalk">Post slot updates to Telegram</span>
                  <span className="block text-sm text-slate-400">Sends the updated roster to your Telegram group when a player books or cancels.</span>
                </span>
              </label>
            </SettingsRow>

            <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-end gap-3 border-t border-ink-600 bg-ink-850/95 px-4 py-3 backdrop-blur-sm sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
              <span className="mr-auto text-xs text-muted">General, community and notification settings save together.</span>
              <button type="submit" disabled={saving} className="v2-btn-primary font-display uppercase tracking-wider">
                {saving ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" aria-hidden />}
                {saving ? 'Saving…' : 'Save settings'}
              </button>
            </div>
          </form>

          <SettingsRow id="payment" title="Payment" desc="The QR players scan to pay after locking a slot (DuitNow or your bank's QR). Saves as soon as you upload.">
            <div className="flex flex-wrap items-end gap-6">
              {qrUrl ? (
                <img src={qrUrl} alt="Current payment QR code" className="h-44 w-44 rounded-sm bg-white object-contain p-2" />
              ) : (
                <div className="flex h-44 w-44 items-center justify-center border border-dashed border-ink-500 text-sm text-muted">No QR uploaded</div>
              )}
              <div>
                <input ref={qrInputRef} type="file" accept="image/*" className="hidden" onChange={handleQrUpload} disabled={uploadingQr} />
                <button type="button" onClick={() => qrInputRef.current?.click()} disabled={uploadingQr} className="adm-btn !py-2.5">
                  {uploadingQr ? <Spinner className="h-4 w-4" /> : <Upload className="h-4 w-4" aria-hidden />}
                  {uploadingQr ? 'Uploading…' : qrUrl ? 'Replace QR code' : 'Upload QR code'}
                </button>
              </div>
            </div>
          </SettingsRow>

          <SettingsRow id="access" title="Access" desc="Admin roles, password help and account removal.">
            <div className="grid grid-cols-3 gap-4 border-b border-ink-600 pb-5">
              <Stat label="Accounts" value={users.length} />
              <Stat label="Admins" value={adminCount} />
              <Stat label="Players" value={playerCount} />
            </div>

            {resetRequests.length > 0 && (
              <div>
                <h3 className="adm-label mb-2 flex items-center gap-2">Password reset requests <OpsBadge tone="attention">{resetRequests.length}</OpsBadge></h3>
                <p className="mb-3 text-sm text-slate-400">Send each player their link on WhatsApp; they set a new password themselves.</p>
                <ul className="divide-y divide-ink-700 border-y border-ink-600">
                  {resetRequests.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-chalk">{r.profile?.short_name || r.profile?.full_name}</p>
                        <p className="text-xs text-muted">{r.phone_number} · requested {formatDateTime(r.created_at)}</p>
                      </div>
                      <a
                        href={whatsappLink(r.phone_number, `Hi ${r.profile?.short_name || r.profile?.full_name}, here's your password reset link: ${window.location.origin}/reset-password/${r.token}\nIt expires in 15 minutes.`)}
                        target="_blank" rel="noopener noreferrer"
                        className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700"
                      >
                        <MessageCircle className="h-4 w-4" aria-hidden /> Send link
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <div className="mb-3 flex flex-wrap items-end justify-between gap-3 border-b border-ink-600">
                <div className="-mb-px flex gap-5" role="group" aria-label="Filter accounts">
                  {([['all', 'All'], ['admin', 'Admins'], ['player', 'Players']] as [RoleFilter, string][]).map(([k, l]) => (
                    <button key={k} onClick={() => setRoleFilter(k)} aria-pressed={roleFilter === k} className="vsb-tab">{l}</button>
                  ))}
                </div>
                <button onClick={exportUsersCSV} className="adm-btn mb-2"><Download className="h-3.5 w-3.5" aria-hidden /> Export CSV</button>
              </div>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
                <input aria-label="Search accounts" placeholder="Search name or phone" className="v2-input !py-2.5 !pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <p className="adm-label mb-1">{filteredUsers.length} of {users.length}</p>
              {filteredUsers.length === 0 ? (
                <p className="py-6 text-sm text-slate-400">No accounts match your search.</p>
              ) : (
                <ul className="divide-y divide-ink-700 border-y border-ink-600">
                  {filteredUsers.map((u) => (
                    <li key={u.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <PlayerAvatar name={u.short_name || u.full_name} seed={u.id} size="xs" />
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 truncate font-semibold text-chalk">
                            {u.short_name || u.full_name}
                            {u.role === 'admin' && <OpsBadge tone="info">Admin</OpsBadge>}
                          </p>
                          <p className="text-xs text-muted">{u.phone_number || 'No phone'} · joined {formatDate(u.created_at)}</p>
                        </div>
                      </div>
                      <div className="flex flex-shrink-0 items-center gap-2">
                        <button onClick={() => toggleAdmin(u)} disabled={promoting} className={u.role === 'admin' ? 'adm-btn' : 'adm-btn !border-vsb-600 !text-vsb-200'}>
                          {u.role === 'admin' ? 'Remove admin' : 'Make admin'}
                        </button>
                        <button onClick={() => { setResetUser(u); setNewPassword(''); }} aria-label={`Reset password for ${u.short_name || u.full_name}`} className="adm-btn !px-2.5"><KeyRound className="h-4 w-4" /></button>
                        <button onClick={() => setDeleteUser(u)} aria-label={`Delete ${u.short_name || u.full_name}'s account`} className="adm-btn !px-2.5 hover:!border-red-400 hover:!text-red-300"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </SettingsRow>
        </div>
      </div>

      {/* Reset password dialog */}
      {resetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setResetUser(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="reset-title" className="w-full max-w-md border border-ink-600 bg-ink-800 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 id="reset-title" className="font-display text-xl font-bold uppercase tracking-wide text-chalk">Reset {resetUser.short_name || resetUser.full_name}'s password</h3>
            <p className="mb-4 mt-1 text-sm text-slate-400">Set a new password for this account and share it with the player yourself, e.g. on WhatsApp.</p>
            <input type="text" autoFocus aria-label="New password" className={inputClass} placeholder="New password (min. 6 characters)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            <div className="mt-4 flex gap-3">
              <button onClick={() => setResetUser(null)} className="adm-btn flex-1 !py-2.5">Cancel</button>
              <button onClick={handleResetPassword} disabled={resetting} className="v2-btn-primary flex-1">
                {resetting && <Spinner className="h-4 w-4" />}{resetting ? 'Resetting…' : 'Reset password'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete user dialog */}
      {deleteUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setDeleteUser(null)}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="del-title" className="w-full max-w-md border border-ink-600 bg-ink-800 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 id="del-title" className="font-display text-xl font-bold uppercase tracking-wide text-chalk">Delete {deleteUser.short_name || deleteUser.full_name}'s account?</h3>
            <p className="mb-4 mt-1 text-sm text-slate-400">This permanently deletes their login, profile, and all associated bookings and payment history. This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteUser(null)} className="adm-btn flex-1 !py-2.5">Cancel</button>
              <button onClick={handleDeleteUser} disabled={deleting} className="flex flex-1 items-center justify-center gap-2 rounded-md bg-red-600 py-2.5 font-bold text-white hover:bg-red-700 disabled:opacity-60">
                {deleting && <Spinner className="h-4 w-4" />}{deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// One settings row: what it is on the left, the controls on the right.
function SettingsRow({ id, title, desc, children }: { id: string; title: string; desc: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="grid scroll-mt-20 gap-4 border-t border-ink-600 py-8 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-10">
      <div>
        <h2 id={`${id}-h`} className="font-display text-xl font-bold uppercase tracking-wide text-chalk">{title}</h2>
        <p className="mt-1 text-sm text-slate-400">{desc}</p>
      </div>
      <div className="min-w-0 space-y-4">{children}</div>
    </section>
  );
}
