import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { Spinner } from '@/components/LoadingScreen';
import { AuthLayout } from '@/components/layout/AuthLayout';

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

  const inputClass = 'v2-input !py-3 !text-base';
  const labelClass = 'block text-sm font-medium text-slate-300 mb-1.5';
  const errorClass = 'text-red-400 text-xs mt-1';

  return (
    <AuthLayout title={<>{t('auth.register.title', { clubName: CLUB_NAME })}</>} subtitle={<>{t('auth.register.subtitle')}</>}>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label htmlFor="reg-name" className={labelClass}>{t('auth.register.nameLabel')}</label>
              <input id="reg-name" className={inputClass} placeholder={t('auth.register.namePlaceholder')} value={form.short_name} onChange={(e) => setForm({ ...form, short_name: e.target.value })} />
              {errors.short_name && <p className={errorClass}>{errors.short_name}</p>}
            </div>
            <div>
              <label htmlFor="reg-phone" className={labelClass}>{t('auth.register.phoneLabel')}</label>
              <input id="reg-phone" type="tel" className={inputClass} placeholder={t('auth.register.phonePlaceholder')} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              {errors.phone && <p className={errorClass}>{errors.phone}</p>}
            </div>
            <div>
              <label htmlFor="reg-password" className={labelClass}>{t('auth.register.passwordLabel')}</label>
              <input id="reg-password" type="password" className={inputClass} placeholder={t('auth.register.passwordPlaceholder')} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              {errors.password && <p className={errorClass}>{errors.password}</p>}
            </div>
            <div>
              <label htmlFor="reg-confirm" className={labelClass}>{t('auth.register.confirmPasswordLabel')}</label>
              <input id="reg-confirm" type="password" className={inputClass} value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} />
              {errors.confirmPassword && <p className={errorClass}>{errors.confirmPassword}</p>}
            </div>
            <button type="submit" disabled={loading}
              className="v2-btn-primary w-full !py-3 mt-1">
              {loading && <Spinner className="h-5 w-5" />}
              {loading ? t('auth.register.submitting') : t('auth.register.submit')}
            </button>
          </form>

          <p className="mt-6 border-t border-ink-600 pt-5 text-sm text-slate-400">
            {t('auth.register.alreadyPlaying')} <Link to="/login" className="text-vsb-400 font-medium hover:underline">{t('auth.register.logIn')}</Link>
          </p>
    </AuthLayout>
  );
}
