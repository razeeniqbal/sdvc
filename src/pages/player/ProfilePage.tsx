import { useState, type FormEvent } from 'react';
import { User, Mail, AlertCircle, Save } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { SKILL_LEVELS, PLAYING_POSITIONS } from '@/types/database';
import { Spinner } from '@/components/LoadingScreen';

export default function ProfilePage() {
  const { profile, refreshProfile } = useAuth();
  const { show } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    short_name: profile?.short_name || profile?.full_name || '',
    full_name: profile?.full_name || '',
    phone_number: profile?.phone_number || '',
    emergency_contact_name: profile?.emergency_contact_name || '',
    emergency_contact_phone: profile?.emergency_contact_phone || '',
    playing_position: profile?.playing_position || '',
    skill_level: profile?.skill_level || '',
  });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      short_name: form.short_name,
      full_name: form.full_name || form.short_name,
      phone_number: form.phone_number,
      emergency_contact_name: form.emergency_contact_name,
      emergency_contact_phone: form.emergency_contact_phone,
      playing_position: form.playing_position as any,
      skill_level: form.skill_level as any,
    }).eq('id', profile.id);
    setSaving(false);
    if (error) { show(error.message, 'error'); return; }
    refreshProfile();
    show('Profile updated!', 'success');
  }

  if (!profile) return null;

  const inputClass = 'w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-900 focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20 outline-none transition-all bg-white/80';
  const labelClass = 'block text-sm font-medium text-slate-600 mb-1.5';
  const isComplete = profile.phone_number && profile.emergency_contact_name && profile.emergency_contact_phone && profile.playing_position && profile.skill_level;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-6">My Profile</h1>

      {!isComplete && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-900 text-sm">Complete your profile</p>
            <p className="text-amber-700 text-sm mt-0.5">Fill in your phone, emergency contact, position, and skill level to book sessions.</p>
          </div>
        </div>
      )}

      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-100">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-rose-400 to-orange-400 text-white text-2xl font-bold">
            {(profile.short_name || profile.full_name)?.charAt(0).toUpperCase() || 'P'}
          </div>
          <div>
            <p className="font-bold text-slate-900 text-lg">{profile.short_name || profile.full_name}</p>
            <p className="text-sm text-slate-500 flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{profile.email}</p>
            <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-0.5">
              <User className="h-3.5 w-3.5" />
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${profile.role === 'admin' ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'}`}>
                {profile.role === 'admin' ? 'Administrator' : 'Player'}
              </span>
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Display Name (nickname)</label>
              <input className={inputClass} value={form.short_name} onChange={(e) => setForm({ ...form, short_name: e.target.value })} required />
            </div>
            <div>
              <label className={labelClass}>Full Name</label>
              <input className={inputClass} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Phone Number</label>
              <input className={inputClass} value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} required />
            </div>
            <div>
              <label className={labelClass}>Emergency Contact Name</label>
              <input className={inputClass} value={form.emergency_contact_name} onChange={(e) => setForm({ ...form, emergency_contact_name: e.target.value })} required />
            </div>
          </div>

          <div>
            <label className={labelClass}>Emergency Contact Phone</label>
            <input className={inputClass} value={form.emergency_contact_phone} onChange={(e) => setForm({ ...form, emergency_contact_phone: e.target.value })} required />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Preferred Playing Position</label>
              <select className={inputClass} value={form.playing_position} onChange={(e) => setForm({ ...form, playing_position: e.target.value })}>
                <option value="">Select position</option>
                {PLAYING_POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Skill Level</label>
              <select className={inputClass} value={form.skill_level} onChange={(e) => setForm({ ...form, skill_level: e.target.value })}>
                <option value="">Select level</option>
                {SKILL_LEVELS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white font-bold rounded-xl transition-all disabled:opacity-60">
            {saving ? <Spinner className="h-5 w-5" /> : <Save className="h-5 w-5" />}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  );
}
