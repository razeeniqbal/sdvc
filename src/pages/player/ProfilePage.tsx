import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { User, Phone, AlertCircle, Save } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { friendlyProfileError } from '@/lib/auth';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Spinner } from '@/components/LoadingScreen';

export default function ProfilePage() {
  const { t } = useTranslation();
  const { profile, refreshProfile } = useAuth();
  const { show } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    short_name: profile?.short_name || profile?.full_name || '',
    full_name: profile?.full_name || '',
    phone_number: profile?.phone_number || '',
    gender: profile?.gender || '',
    emergency_contact_name: profile?.emergency_contact_name || '',
    emergency_contact_phone: profile?.emergency_contact_phone || '',
  });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    if (!form.gender) {
      show(t('common.errorGenderRequired'), 'error');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      short_name: form.short_name,
      full_name: form.full_name || form.short_name,
      phone_number: form.phone_number,
      gender: form.gender,
      emergency_contact_name: form.emergency_contact_name,
      emergency_contact_phone: form.emergency_contact_phone,
    }).eq('id', profile.id);
    setSaving(false);
    if (error) { show(friendlyProfileError(error), 'error'); return; }
    refreshProfile();
    show(t('profile.profileUpdated'), 'success');
  }

  if (!profile) return null;

  const inputClass = 'w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-900 focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20 outline-none transition-all bg-white/80';
  const labelClass = 'block text-sm font-medium text-slate-600 mb-1.5';
  const isComplete = !!profile.phone_number && !!profile.gender;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-6">{t('profile.title')}</h1>

      {!isComplete && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-900 text-sm">{t('profile.completeProfile')}</p>
            <p className="text-amber-700 text-sm mt-0.5">{t('profile.completeProfileDesc')}</p>
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
            <p className="text-sm text-slate-500 flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{profile.phone_number || t('profile.noPhoneNumber')}</p>
            <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-0.5">
              <User className="h-3.5 w-3.5" />
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${profile.role === 'admin' ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'}`}>
                {profile.role === 'admin' ? t('profile.administrator') : t('profile.player')}
              </span>
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>{t('profile.displayNameLabel')}</label>
              <input className={inputClass} value={form.short_name} onChange={(e) => setForm({ ...form, short_name: e.target.value })} required />
            </div>
            <div>
              <label className={labelClass}>{t('profile.fullNameLabel')}</label>
              <input className={inputClass} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>{t('profile.phoneNumberLabel')}</label>
              <input className={inputClass} value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} required />
            </div>
            <div>
              <label className={labelClass}>{t('common.genderLabel')}</label>
              <select className={inputClass} value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} required>
                <option value="" disabled>{t('common.genderSelectPlaceholder')}</option>
                <option value="Male">{t('common.genderMale')}</option>
                <option value="Female">{t('common.genderFemale')}</option>
              </select>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>{t('profile.emergencyContactNameLabel')}</label>
              <input className={inputClass} value={form.emergency_contact_name} onChange={(e) => setForm({ ...form, emergency_contact_name: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>{t('profile.emergencyContactPhoneLabel')}</label>
              <input className={inputClass} value={form.emergency_contact_phone} onChange={(e) => setForm({ ...form, emergency_contact_phone: e.target.value })} />
            </div>
          </div>

          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white font-bold rounded-xl transition-all disabled:opacity-60">
            {saving ? <Spinner className="h-5 w-5" /> : <Save className="h-5 w-5" />}
            {saving ? t('profile.saving') : t('profile.saveChanges')}
          </button>
        </form>
      </div>
    </div>
  );
}
