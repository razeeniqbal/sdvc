import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/context/ToastContext';
import { Spinner } from '@/components/LoadingScreen';
import { VsbLogo } from '@/components/VsbLogo';
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

  const inputClass = 'v2-input !py-3 !text-base';

  return (
    <div className="min-h-screen bg-ink flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <VsbLogo variant="lockup" className="h-12 mx-auto mb-6" />
          <h1 className="v2-heading text-3xl">{t('auth.forgotPassword.title')}</h1>
        </div>

        <div className="v2-surface p-6 sm:p-8">
          {checking ? (
            <div className="flex justify-center py-4"><Spinner className="h-6 w-6 text-vsb-500" /></div>
          ) : !valid ? (
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-slate-300">{t('auth.forgotPassword.errorInvalidCode')}</p>
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
                className="v2-btn-primary w-full !py-3 mt-1">
                {resetting && <Spinner className="h-5 w-5" />}
                {resetting ? t('auth.forgotPassword.resetting') : t('auth.forgotPassword.resetPassword')}
              </button>
            </form>
          )}

          <p className="text-center text-sm text-slate-400 mt-5">
            <Link to="/login" className="text-vsb-400 font-medium hover:underline">{t('auth.forgotPassword.backToLogin')}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
