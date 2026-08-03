import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { phoneToEmail } from '@/lib/auth';
import { useToast } from '@/context/ToastContext';
import { Spinner } from '@/components/LoadingScreen';
import { Zap } from 'lucide-react';

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

  const inputClass = 'w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20 outline-none transition-all bg-white/80';

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-orange-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="glass-card rounded-3xl shadow-xl p-6 sm:p-8">
          <div className="text-center mb-6">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-orange-500 text-white mb-3 shadow-lg">
              <Zap className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">{t('auth.login.title')}</h1>
            <p className="text-slate-500 text-sm mt-1">{t('auth.login.subtitle')}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('auth.login.phoneLabel')}</label>
              <input type="text" className={inputClass} placeholder={t('auth.login.phonePlaceholder')} value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('auth.login.passwordLabel')}</label>
              <input type="password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white font-bold rounded-xl transition-all disabled:opacity-60 flex items-center justify-center gap-2">
              {loading && <Spinner className="h-5 w-5" />}
              {loading ? t('auth.login.submitting') : t('auth.login.submit')}
            </button>
          </form>

          <div className="flex flex-col items-center gap-2 mt-4">
            <Link to="/forgot-password" className="text-sm text-rose-600 font-semibold hover:underline">{t('auth.login.forgotPassword')}</Link>
            <p className="text-sm text-slate-500">{t('auth.login.newHere')} <Link to="/register" className="text-rose-600 font-semibold hover:underline">{t('auth.login.signUp')}</Link></p>
          </div>
        </div>
      </div>
    </div>
  );
}
