import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { phoneToEmail } from '@/lib/auth';
import { useToast } from '@/context/ToastContext';
import { Spinner } from '@/components/LoadingScreen';

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

  const inputClass = 'w-full rounded-lg border border-slate-200 px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-navy-400 focus:ring-2 focus:ring-navy-400/20 outline-none transition-all bg-white';

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/logo.jpg" alt="Logo" className="h-14 w-14 mx-auto rounded-xl object-cover mb-4" />
          <h1 className="text-xl font-semibold text-slate-900">{t('auth.login.title')}</h1>
          <p className="text-slate-500 text-sm mt-1">{t('auth.login.subtitle')}</p>
        </div>

        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-3">
            <input type="text" aria-label={t('auth.login.phoneLabel')} className={inputClass} placeholder={t('auth.login.phonePlaceholder')} value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
            <input type="password" aria-label={t('auth.login.passwordLabel')} className={inputClass} placeholder={t('auth.login.passwordLabel')} value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="submit" disabled={loading}
              className="w-full py-3 bg-navy-700 hover:bg-navy-800 text-white font-semibold rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-2 mt-1">
              {loading && <Spinner className="h-5 w-5" />}
              {loading ? t('auth.login.submitting') : t('auth.login.submit')}
            </button>
          </form>

          <div className="flex flex-col items-center gap-2 mt-5">
            <Link to="/forgot-password" className="text-sm text-navy-700 font-medium hover:underline">{t('auth.login.forgotPassword')}</Link>
            <p className="text-sm text-slate-500">{t('auth.login.newHere')} <Link to="/register" className="text-navy-700 font-medium hover:underline">{t('auth.login.signUp')}</Link></p>
          </div>
        </div>
      </div>
    </div>
  );
}
