import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { phoneToEmail } from '@/lib/auth';
import { useToast } from '@/context/ToastContext';
import { Spinner } from '@/components/LoadingScreen';
import { VsbLogo } from '@/components/VsbLogo';

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
    navigate('/sessions');
  }

  const inputClass = 'v2-input !py-3 !text-base';

  return (
    <div className="min-h-screen bg-ink flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <VsbLogo variant="lockup" className="h-12 mx-auto mb-6" />
          <h1 className="v2-heading text-3xl">{t('auth.login.title')}</h1>
          <p className="text-slate-400 text-sm mt-1">{t('auth.login.subtitle')}</p>
        </div>

        <div className="v2-surface p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-3">
            <input type="text" aria-label={t('auth.login.phoneLabel')} className={inputClass} placeholder={t('auth.login.phonePlaceholder')} value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
            <input type="password" aria-label={t('auth.login.passwordLabel')} className={inputClass} placeholder={t('auth.login.passwordLabel')} value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="submit" disabled={loading}
              className="v2-btn-primary w-full !py-3 mt-1">
              {loading && <Spinner className="h-5 w-5" />}
              {loading ? t('auth.login.submitting') : t('auth.login.submit')}
            </button>
          </form>

          <div className="flex flex-col items-center gap-2 mt-5">
            <Link to="/forgot-password" className="text-sm text-vsb-400 font-medium hover:underline">{t('auth.login.forgotPassword')}</Link>
            <p className="text-sm text-slate-400">{t('auth.login.newHere')} <Link to="/register" className="text-vsb-400 font-medium hover:underline">{t('auth.login.signUp')}</Link></p>
          </div>
        </div>
      </div>
    </div>
  );
}
