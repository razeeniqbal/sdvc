import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchClubSettings } from '@/lib/settings';
import { useAuth } from '@/context/AuthContext';
import { VsbLogo } from '@/components/VsbLogo';
import type { ClubSettings } from '@/types/database';

export function Footer() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [settings, setSettings] = useState<ClubSettings | null>(null);
  useEffect(() => { fetchClubSettings().then(setSettings); }, []);

  const links = [
    { to: profile ? '/sessions' : '/register', label: t('nav.sessions') },
    { to: profile ? '/profile' : '/login', label: t('v2.nav.myVsb') },
  ];

  return (
    <footer className="mt-auto border-t border-ink-600 bg-ink">
      <div className="vsb-gutter grid gap-10 py-12 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <VsbLogo variant="lockup" className="h-10" />
          <p className="vsb-meta mt-5 !text-slate-300">{t('v2.footer.tagline')}</p>
          <p className="mt-2 text-sm text-muted">{t('v2.footer.builtFor')}</p>
        </div>
        <nav aria-label={t('v2.footer.navLabel')} className="flex flex-wrap gap-x-8 gap-y-3 text-sm font-semibold uppercase tracking-[0.14em]">
          {links.map((l) => <Link key={l.label} to={l.to} className="text-slate-300 hover:text-white">{l.label}</Link>)}
          {settings?.whatsapp_group_link && (
            <a href={settings.whatsapp_group_link} target="_blank" rel="noopener noreferrer" className="text-slate-300 hover:text-white">WhatsApp</a>
          )}
        </nav>
      </div>
      <div className="vsb-gutter border-t border-ink-600 py-5 text-xs text-muted">
        {t('footer.copyright', { year: new Date().getFullYear(), clubName: settings?.club_name || 'Volleyball Sdn Bhd' })}
      </div>
    </footer>
  );
}
