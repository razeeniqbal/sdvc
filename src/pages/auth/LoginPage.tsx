import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { phoneToEmail } from '@/lib/auth';
import { useToast } from '@/context/ToastContext';
import { Spinner } from '@/components/LoadingScreen';
import { AuthLayout } from '@/components/layout/AuthLayout';

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { show } = useToast();
  const [loading, setLoading] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!identifier || !password) { show(t('auth.login.errorEmptyFields'), 'error'); return; }
    setLoading(true);
    // Admin/legacy accounts may still use a real email; new accounts are phone-based.
    const email = identifier.includes('@') ? identifier.trim() : phoneToEmail(identifier);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { show(error.message.includes('Invalid login') ? t('auth.login.errorInvalidLogin') : error.message, 'error'); return; }
    show(t('auth.login.welcomeBack'), 'success');
    navigate('/');
  }

  const inputClass = 'v2-input !py-3 !text-base';

  return (
    <AuthLayout title={<>{t('auth.login.title')}</>} subtitle={<>{t('auth.login.subtitle')}</>}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-id" className="mb-1.5 block text-sm font-medium text-slate-300">{t('auth.login.phoneLabel')}</label>
              <input id="login-id" type="text" autoComplete="username" className={inputClass} placeholder={t('auth.login.phonePlaceholder')} value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
            </div>
            <div>
              <label htmlFor="login-pw" className="mb-1.5 block text-sm font-medium text-slate-300">{t('auth.login.passwordLabel')}</label>
              <input id="login-pw" type="password" autoComplete="current-password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <button type="submit" disabled={loading}
              className="v2-btn-primary w-full !py-3 mt-1">
              {loading && <Spinner className="h-5 w-5" />}
              {loading ? t('auth.login.submitting') : t('auth.login.submit')}
            </button>
          </form>

          <div className="mt-6 flex flex-col items-start gap-2 border-t border-ink-600 pt-5">
            <Link to="/forgot-password" className="text-sm text-vsb-400 font-medium hover:underline">{t('auth.login.forgotPassword')}</Link>
            <p className="text-sm text-slate-400">{t('auth.login.newHere')} <Link to="/register" className="text-vsb-400 font-medium hover:underline">{t('auth.login.signUp')}</Link></p>
          </div>
    </AuthLayout>
  );
}
