import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { Spinner } from '@/components/LoadingScreen';

const CLUB_NAME = 'Volleyball Sdn Bhd';

export default function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { show } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ short_name: '', phone: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.short_name.trim()) e.short_name = t('auth.register.errorNameRequired');
    const digits = form.phone.replace(/[^0-9]/g, '');
    if (!digits) e.phone = t('auth.register.errorPhoneRequired');
    else if (digits.length < 9) e.phone = t('auth.register.errorPhoneInvalid');
    if (!form.password) e.password = t('auth.register.errorPasswordRequired');
    else if (form.password.length < 6) e.password = t('auth.register.errorPasswordLength');
    if (form.password !== form.confirmPassword) e.confirmPassword = t('auth.register.errorPasswordMismatch');
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    setLoading(true);

    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/phone-signup`;
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phone: form.phone, password: form.password, full_name: form.short_name, short_name: form.short_name }),
    });
    const body = await res.json();

    if (!res.ok) {
      setLoading(false);
      show(body.error || t('auth.register.errorFailedSignup'), 'error');
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email: body.email, password: form.password });
    setLoading(false);
    if (error) { show(error.message, 'error'); return; }

    show(t('auth.register.welcomeMessage', { clubName: CLUB_NAME }), 'success');
    navigate('/profile');
  }

  const inputClass = 'w-full rounded-lg border border-slate-200 px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-navy-400 focus:ring-2 focus:ring-navy-400/20 outline-none transition-all bg-white';
  const labelClass = 'block text-sm font-medium text-slate-700 mb-1.5';
  const errorClass = 'text-red-600 text-xs mt-1';

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/logo.jpg" alt="Logo" className="h-14 w-14 mx-auto rounded-xl object-cover mb-4" />
          <h1 className="text-xl font-semibold text-slate-900">{t('auth.register.title', { clubName: CLUB_NAME })}</h1>
          <p className="text-slate-500 text-sm mt-1">{t('auth.register.subtitle')}</p>
        </div>

        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className={labelClass}>{t('auth.register.nameLabel')}</label>
              <input className={inputClass} placeholder={t('auth.register.namePlaceholder')} value={form.short_name} onChange={(e) => setForm({ ...form, short_name: e.target.value })} />
              {errors.short_name && <p className={errorClass}>{errors.short_name}</p>}
            </div>
            <div>
              <label className={labelClass}>{t('auth.register.phoneLabel')}</label>
              <input type="tel" className={inputClass} placeholder={t('auth.register.phonePlaceholder')} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              {errors.phone && <p className={errorClass}>{errors.phone}</p>}
            </div>
            <div>
              <label className={labelClass}>{t('auth.register.passwordLabel')}</label>
              <input type="password" className={inputClass} placeholder={t('auth.register.passwordPlaceholder')} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              {errors.password && <p className={errorClass}>{errors.password}</p>}
            </div>
            <div>
              <label className={labelClass}>{t('auth.register.confirmPasswordLabel')}</label>
              <input type="password" className={inputClass} value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} />
              {errors.confirmPassword && <p className={errorClass}>{errors.confirmPassword}</p>}
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3 bg-navy-700 hover:bg-navy-800 text-white font-semibold rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-2 mt-1">
              {loading && <Spinner className="h-5 w-5" />}
              {loading ? t('auth.register.submitting') : t('auth.register.submit')}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-5">
            {t('auth.register.alreadyPlaying')} <Link to="/login" className="text-navy-700 font-medium hover:underline">{t('auth.register.logIn')}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
