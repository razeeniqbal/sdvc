import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchClubSettings, whatsappLink } from '@/lib/settings';
import { useToast } from '@/context/ToastContext';
import { Spinner } from '@/components/LoadingScreen';
import { AuthLayout } from '@/components/layout/AuthLayout';
import type { ClubSettings } from '@/types/database';
import { MessageCircle } from 'lucide-react';

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const { show } = useToast();
  const [settings, setSettings] = useState<ClubSettings | null>(null);
  const [requested, setRequested] = useState(false);
  const [phone, setPhone] = useState('');
  const [requesting, setRequesting] = useState(false);

  useEffect(() => { fetchClubSettings().then(setSettings); }, []);

  const clubName = settings?.club_name || 'Volleyball Sdn Bhd';
  const inputClass = 'v2-input !py-3 !text-base';

  async function handleRequestLink(e: FormEvent) {
    e.preventDefault();
    if (!phone.trim()) { show(t('auth.forgotPassword.errorPhoneRequired'), 'error'); return; }
    setRequesting(true);
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/password-reset`;
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'request', phone }),
    });
    const body = await res.json();
    setRequesting(false);
    if (!res.ok) { show(body.error || t('auth.forgotPassword.errorNoAccount'), 'error'); return; }
    setRequested(true);
  }

  return (
    <AuthLayout title={<>{t('auth.forgotPassword.title')}</>} subtitle={<>{requested ? t('auth.forgotPassword.subtitleStep2') : t('auth.forgotPassword.subtitleStep1')}</>}>
          {!requested ? (
            <form onSubmit={handleRequestLink} className="space-y-3">
              <input
                type="text"
                aria-label={t('auth.forgotPassword.phoneLabel')}
                className={inputClass}
                placeholder={t('auth.forgotPassword.phonePlaceholder')}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <button type="submit" disabled={requesting}
                className="v2-btn-primary w-full !py-3 mt-1">
                {requesting && <Spinner className="h-5 w-5" />}
                {requesting ? t('auth.forgotPassword.requesting') : t('auth.forgotPassword.requestCode')}
              </button>
            </form>
          ) : (
            <a
              href={whatsappLink(settings?.contact_whatsapp || '0137441727', t('auth.forgotPassword.whatsappMessage', { clubName, phone }))}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-md bg-green-600 py-3 font-semibold text-white transition-colors hover:bg-green-700"
            >
              <MessageCircle className="h-5 w-5" />
              {t('auth.forgotPassword.askAdmin')}
            </a>
          )}

          <p className="mt-6 border-t border-ink-600 pt-5 text-sm text-slate-400">
            <Link to="/login" className="text-vsb-400 font-medium hover:underline">{t('auth.forgotPassword.backToLogin')}</Link>
          </p>
    </AuthLayout>
  );
}
