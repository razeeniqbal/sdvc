import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { User, Phone, AlertCircle, Save, Send, RefreshCw } from 'lucide-react';
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
  const [generatingCode, setGeneratingCode] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [checkingLink, setCheckingLink] = useState(false);

  async function handleGenerateLinkCode() {
    if (!profile) return;
    setGeneratingCode(true);
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const { error } = await supabase.from('profiles').update({
      telegram_link_code: code,
      telegram_link_code_expires_at: expiresAt,
    }).eq('id', profile.id);
    setGeneratingCode(false);
    if (error) { show(error.message, 'error'); return; }
    refreshProfile();
  }

  async function handleUnlinkTelegram() {
    if (!profile) return;
    setUnlinking(true);
    const { error } = await supabase.from('profiles').update({
      telegram_user_id: null,
      telegram_link_code: null,
      telegram_link_code_expires_at: null,
    }).eq('id', profile.id);
    setUnlinking(false);
    if (error) { show(error.message, 'error'); return; }
    refreshProfile();
    show('Telegram account unlinked', 'success');
  }

  async function handleCheckLinkStatus() {
    setCheckingLink(true);
    await refreshProfile();
    setCheckingLink(false);
  }
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

  const inputClass = 'w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-900 focus:border-navy-400 focus:ring-2 focus:ring-navy-400/20 outline-none transition-all bg-white';
  const labelClass = 'block text-sm font-medium text-slate-600 mb-1.5';
  const isComplete = !!profile.phone_number && !!profile.gender;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 mb-6">{t('profile.title')}</h1>

      {!isComplete && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-900 text-sm">{t('profile.completeProfile')}</p>
            <p className="text-amber-700 text-sm mt-0.5">{t('profile.completeProfileDesc')}</p>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6">
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-100">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-navy-700 text-white text-2xl font-bold">
            {(profile.short_name || profile.full_name)?.charAt(0).toUpperCase() || 'P'}
          </div>
          <div>
            <p className="font-bold text-slate-900 text-lg">{profile.short_name || profile.full_name}</p>
            <p className="text-sm text-slate-500 flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{profile.phone_number || t('profile.noPhoneNumber')}</p>
            <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-0.5">
              <User className="h-3.5 w-3.5" />
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${profile.role === 'admin' ? 'bg-navy-100 text-navy-700' : 'bg-blue-100 text-blue-700'}`}>
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

          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-6 py-3 bg-navy-700 hover:bg-navy-800 text-white font-semibold rounded-xl transition-all disabled:opacity-60">
            {saving ? <Spinner className="h-5 w-5" /> : <Save className="h-5 w-5" />}
            {saving ? t('profile.saving') : t('profile.saveChanges')}
          </button>
        </form>
      </div>

      {profile.role === 'admin' && (
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 mt-6">
          <h2 className="font-bold text-slate-900 flex items-center gap-2 mb-1">
            <Send className="h-5 w-5 text-sky-500" />
            Telegram Bot Access
          </h2>
          <p className="text-sm text-slate-500 mb-4">Link your personal Telegram account so the bot recognizes your private messages as coming from an admin, not just the club group.</p>

          {profile.telegram_user_id ? (
            <div className="flex items-center justify-between gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-sm font-medium text-green-900">✅ Telegram account linked</p>
              <button
                onClick={handleUnlinkTelegram}
                disabled={unlinking}
                className="px-3 py-1.5 bg-white hover:bg-red-50 text-red-600 text-xs font-semibold rounded-lg border border-red-200 transition-colors disabled:opacity-60"
              >
                {unlinking ? 'Unlinking...' : 'Unlink'}
              </button>
            </div>
          ) : profile.telegram_link_code && profile.telegram_link_code_expires_at && new Date(profile.telegram_link_code_expires_at) > new Date() ? (
            <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 space-y-3">
              <div>
                <p className="text-sm text-sky-900">Message the bot privately (not in the group) with:</p>
                <p className="font-mono text-lg font-bold text-sky-900 mt-1">/link {profile.telegram_link_code}</p>
                <p className="text-xs text-sky-700 mt-1">Expires {new Date(profile.telegram_link_code_expires_at).toLocaleTimeString()}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCheckLinkStatus}
                  disabled={checkingLink}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-sky-100 text-sky-700 text-xs font-semibold rounded-lg border border-sky-300 transition-colors disabled:opacity-60"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${checkingLink ? 'animate-spin' : ''}`} />
                  {checkingLink ? 'Checking...' : "I've sent it, check status"}
                </button>
                <button
                  onClick={handleGenerateLinkCode}
                  disabled={generatingCode}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg border border-slate-300 transition-colors disabled:opacity-60"
                >
                  Generate new code
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleGenerateLinkCode}
              disabled={generatingCode}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
            >
              {generatingCode ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}
              {generatingCode ? 'Generating...' : 'Generate Link Code'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
