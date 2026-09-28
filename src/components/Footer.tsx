import { MessageCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchClubSettings } from '@/lib/settings';
import { VsbLogo } from '@/components/VsbLogo';
import type { ClubSettings } from '@/types/database';

export function Footer() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<ClubSettings | null>(null);
  useEffect(() => { fetchClubSettings().then(setSettings); }, []);

  return (
    <footer className="bg-ink border-t border-ink-600 mt-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <VsbLogo variant="lockup" className="h-9" />
          {settings?.whatsapp_group_link && (
            <a href={settings.whatsapp_group_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-green-400 hover:text-green-300 transition-colors">
              <MessageCircle className="h-4 w-4" /> {t('footer.joinWhatsapp')}
            </a>
          )}
          <p className="text-muted text-sm text-center sm:text-right">
            {t('footer.copyright', { year: new Date().getFullYear(), clubName: settings?.club_name || 'Volleyball Sdn Bhd' })}
          </p>
        </div>
      </div>
    </footer>
  );
}
