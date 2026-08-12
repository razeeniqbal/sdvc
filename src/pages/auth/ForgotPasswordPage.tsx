import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchClubSettings, whatsappLink } from '@/lib/settings';
import type { ClubSettings } from '@/types/database';
import { MessageCircle } from 'lucide-react';

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<ClubSettings | null>(null);

  useEffect(() => { fetchClubSettings().then(setSettings); }, []);

  const clubName = settings?.club_name || 'Volleyball Sdn Bhd';

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/logo.jpg" alt="Logo" className="h-14 w-14 mx-auto rounded-xl object-cover mb-4" />
          <h1 className="text-xl font-semibold text-slate-900">{t('auth.forgotPassword.title')}</h1>
          <p className="text-slate-500 text-sm mt-1">
            {t('auth.forgotPassword.subtitle')}
          </p>
        </div>

        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 sm:p-8">
          <a
            href={whatsappLink(settings?.contact_whatsapp || '0137441727', t('auth.forgotPassword.whatsappMessage', { clubName }))}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
          >
            <MessageCircle className="h-5 w-5" />
            {t('auth.forgotPassword.messageAdmin')}
          </a>

          <p className="text-center text-sm text-slate-500 mt-5">
            <Link to="/login" className="text-navy-700 font-medium hover:underline">{t('auth.forgotPassword.backToLogin')}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
