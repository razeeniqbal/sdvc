import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchClubSettings, whatsappLink } from '@/lib/settings';
import { useToast } from '@/context/ToastContext';
import { Spinner } from '@/components/LoadingScreen';
import { VsbLogo } from '@/components/VsbLogo';
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
    <div className="min-h-screen bg-ink flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <VsbLogo variant="lockup" className="h-12 mx-auto mb-6" />
          <h1 className="v2-heading text-3xl">{t('auth.forgotPassword.title')}</h1>
          <p className="text-slate-400 text-sm mt-1">
            {requested ? t('auth.forgotPassword.subtitleStep2') : t('auth.forgotPassword.subtitleStep1')}
          </p>
        </div>

        <div className="v2-surface p-6 sm:p-8">
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
              className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
            >
              <MessageCircle className="h-5 w-5" />
              {t('auth.forgotPassword.askAdmin')}
            </a>
          )}

          <p className="text-center text-sm text-slate-400 mt-5">
            <Link to="/login" className="text-vsb-400 font-medium hover:underline">{t('auth.forgotPassword.backToLogin')}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
