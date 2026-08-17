import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Save, MessageCircle, Phone, Bell, UserCog, Search, Trash2, QrCode, Upload, Users, ShieldCheck, Download, CalendarDays } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { fetchClubSettings } from '@/lib/settings';
import { uploadClubQrImage } from '@/lib/receipts';
import { formatDate } from '@/lib/format';
import { Spinner } from '@/components/LoadingScreen';
import { GenderBadge } from '@/components/StatusBadge';
import type { Profile } from '@/types/database';

type RoleFilter = 'all' | 'admin' | 'player';

type Tab = 'general' | 'payment' | 'admins';

export default function AdminSettingsPage() {
  const { show } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<Tab>('general');
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
  }, []);

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
        <Spinner className="h-8 w-8 text-navy-600" />
      </div>
    );
  }

  const inputClass = 'w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-900 focus:border-navy-400 focus:ring-2 focus:ring-navy-400/20 outline-none transition-all bg-white';
  const labelClass = 'block text-sm font-medium text-slate-600 mb-1.5';

  const tabs: { key: Tab; label: string }[] = [
    { key: 'general', label: 'General' },
    { key: 'payment', label: 'Payment' },
    { key: 'admins', label: 'Admins' },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 mb-6">Settings</h1>

      <div className="inline-flex rounded-full border border-slate-200 p-1 bg-slate-50 mb-6">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              tab === tb.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {tab === 'general' && (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h2 className="font-bold text-slate-900">Club Information</h2>
            <div>
              <label className={labelClass}>Club Name</label>
              <input className={inputClass} value={form.club_name} onChange={(e) => setForm({ ...form, club_name: e.target.value })} required />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h2 className="font-bold text-slate-900 flex items-center gap-2"><Phone className="h-5 w-5 text-slate-500" /> Contact Person</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Contact Person Name</label>
                <input className={inputClass} value={form.contact_person_name} onChange={(e) => setForm({ ...form, contact_person_name: e.target.value })} required />
              </div>
              <div>
                <label className={labelClass}>WhatsApp Number</label>
                <input className={inputClass} placeholder="0137441727" value={form.contact_whatsapp} onChange={(e) => setForm({ ...form, contact_whatsapp: e.target.value })} required />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h2 className="font-bold text-slate-900 flex items-center gap-2"><MessageCircle className="h-5 w-5 text-green-500" /> WhatsApp Group</h2>
            <div>
              <label className={labelClass}>WhatsApp Group Link</label>
              <input className={inputClass} placeholder="https://chat.whatsapp.com/..." value={form.whatsapp_group_link} onChange={(e) => setForm({ ...form, whatsapp_group_link: e.target.value })} />
            </div>
            <label className="flex items-start gap-2 cursor-pointer bg-green-50 rounded-xl p-3 border border-green-200">
              <input type="checkbox" checked={form.whatsapp_group_notify} onChange={(e) => setForm({ ...form, whatsapp_group_notify: e.target.checked })} className="mt-1 h-4 w-4 rounded border-slate-300 text-green-500 focus:ring-green-500" />
              <div>
                <span className="text-sm font-medium text-green-900 flex items-center gap-1.5"><Bell className="h-4 w-4" /> Notify Telegram group on slot updates</span>
                <span className="text-xs text-green-700 block mt-0.5">When enabled, a message is sent to your Telegram group when a player books or cancels a session.</span>
              </div>
            </label>
          </div>

          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-6 py-3 bg-navy-700 hover:bg-navy-800 text-white font-semibold rounded-xl transition-all disabled:opacity-60">
            {saving ? <Spinner className="h-5 w-5" /> : <Save className="h-5 w-5" />}
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </form>
      )}

      {tab === 'payment' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h2 className="font-bold text-slate-900 flex items-center gap-2"><QrCode className="h-5 w-5 text-blue-500" /> Payment QR Code</h2>
          <p className="text-sm text-slate-500">Shown to players after they lock a slot, so they can scan and pay via DuitNow (or your bank's QR) directly.</p>
          {qrUrl && (
            <img src={qrUrl} alt="Payment QR code" className="w-40 h-40 object-contain rounded-lg border border-slate-200 p-2" />
          )}
          <input ref={qrInputRef} type="file" accept="image/*" className="hidden" onChange={handleQrUpload} disabled={uploadingQr} />
          <button
            type="button"
            onClick={() => qrInputRef.current?.click()}
            disabled={uploadingQr}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
          >
            {uploadingQr ? <Spinner className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
            {uploadingQr ? 'Uploading...' : qrUrl ? 'Change QR Code' : 'Upload QR Code'}
          </button>
        </div>
      )}

      {tab === 'admins' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1"><Users className="h-4 w-4" /> Total Users</div>
              <p className="text-2xl font-bold text-slate-900">{users.length}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1"><ShieldCheck className="h-4 w-4" /> Admins</div>
              <p className="text-2xl font-bold text-slate-900">{adminCount}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1"><UserCog className="h-4 w-4" /> Players</div>
              <p className="text-2xl font-bold text-slate-900">{playerCount}</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-1 gap-3">
              <h2 className="font-bold text-slate-900 flex items-center gap-2">
                <UserCog className="h-5 w-5 text-navy-600" />
                Manage Users
              </h2>
              <button
                onClick={exportUsersCSV}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg transition-colors flex-shrink-0"
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </button>
            </div>
            <p className="text-sm text-slate-500 mb-4">Promote or demote users between player and admin roles.</p>

            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  placeholder="Search by name, phone, or email..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-navy-400 focus:ring-2 focus:ring-navy-400/20 outline-none bg-white"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="inline-flex rounded-full border border-slate-200 p-1 bg-slate-50 w-fit">
                {([
                  { key: 'all', label: 'All' },
                  { key: 'admin', label: 'Admins' },
                  { key: 'player', label: 'Players' },
                ] as { key: RoleFilter; label: string }[]).map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setRoleFilter(f.key)}
                    className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      roleFilter === f.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs text-slate-500 mb-3">{filteredUsers.length} of {users.length} users</p>

            <div className="space-y-2">
              {filteredUsers.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">No users match your search.</p>
              ) : filteredUsers.map((u) => (
              <div key={u.id} className="flex items-center justify-between bg-slate-50 rounded-xl p-3 border border-slate-100">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-600 text-sm font-bold">
                    {(u.short_name || u.full_name)?.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 font-medium text-slate-900 text-sm">
                      {u.short_name || u.full_name}
                      <GenderBadge gender={u.gender} />
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                      <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{u.phone_number || 'No phone number'}</span>
                      <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />Joined {formatDate(u.created_at)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.role === 'admin' ? 'bg-navy-100 text-navy-700' : 'bg-blue-100 text-blue-700'}`}>
                    {u.role === 'admin' ? 'Admin' : 'Player'}
                  </span>
                  <button
                    onClick={() => toggleAdmin(u)}
                    disabled={promoting}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 ${
                      u.role === 'admin'
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        : 'bg-navy-700 hover:bg-navy-800 text-white'
                    }`}
                  >
                    {u.role === 'admin' ? 'Demote' : 'Make Admin'}
                  </button>
                  <button
                    onClick={() => setDeleteUser(u)}
                    title="Delete account"
                    className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
            </div>
          </div>
        </div>
      )}

      {/* Delete user dialog */}
      {deleteUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4" onClick={() => setDeleteUser(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-slate-900 mb-2">Delete {deleteUser.short_name || deleteUser.full_name}'s account?</h3>
            <p className="text-sm text-slate-500 mb-4">
              This permanently deletes their login, profile, and all associated bookings and payment history. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteUser(null)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-colors">Cancel</button>
              <button onClick={handleDeleteUser} disabled={deleting} className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                {deleting && <Spinner className="h-4 w-4" />}
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
