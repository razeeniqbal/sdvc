import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/context/ToastContext';
import { Spinner } from '@/components/LoadingScreen';
import { AlertCircle } from 'lucide-react';

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const { token } = useParams();
  const navigate = useNavigate();
  const { show } = useToast();
  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/password-reset`;
    fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'validate', token }),
    })
      .then((res) => res.ok)
      .then(setValid)
      .catch(() => setValid(false))
      .finally(() => setChecking(false));
  }, [token]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) { show(t('auth.forgotPassword.errorPasswordLength'), 'error'); return; }
    if (newPassword !== confirmPassword) { show(t('auth.forgotPassword.errorPasswordMismatch'), 'error'); return; }
    setResetting(true);
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/password-reset`;
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'confirm', token, new_password: newPassword }),
    });
    const body = await res.json();
    setResetting(false);
    if (!res.ok) { show(body.error || t('auth.forgotPassword.errorInvalidCode'), 'error'); return; }
    show(t('auth.forgotPassword.success'), 'success');
    navigate('/login');
  }

  const inputClass = 'w-full rounded-lg border border-slate-200 px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-navy-400 focus:ring-2 focus:ring-navy-400/20 outline-none transition-all bg-white';

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/logo.jpg" alt="Logo" className="h-14 w-14 mx-auto rounded-xl object-cover mb-4" />
          <h1 className="text-xl font-semibold text-slate-900">{t('auth.forgotPassword.title')}</h1>
        </div>

        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 sm:p-8">
          {checking ? (
            <div className="flex justify-center py-4"><Spinner className="h-6 w-6 text-navy-600" /></div>
          ) : !valid ? (
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-slate-600">{t('auth.forgotPassword.errorInvalidCode')}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="password"
                aria-label={t('auth.forgotPassword.newPasswordLabel')}
                className={inputClass}
                placeholder={t('auth.forgotPassword.newPasswordLabel')}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <input
                type="password"
                aria-label={t('auth.forgotPassword.confirmPasswordLabel')}
                className={inputClass}
                placeholder={t('auth.forgotPassword.confirmPasswordLabel')}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <button type="submit" disabled={resetting}
                className="w-full py-3 bg-navy-700 hover:bg-navy-800 text-white font-semibold rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-2 mt-1">
                {resetting && <Spinner className="h-5 w-5" />}
                {resetting ? t('auth.forgotPassword.resetting') : t('auth.forgotPassword.resetPassword')}
              </button>
            </form>
          )}

          <p className="text-center text-sm text-slate-500 mt-5">
            <Link to="/login" className="text-navy-700 font-medium hover:underline">{t('auth.forgotPassword.backToLogin')}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
