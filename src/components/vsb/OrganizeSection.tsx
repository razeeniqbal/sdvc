import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { fetchMyLatestApplication, fetchMyPaymentProfile } from '@/lib/organizers';
import { fetchClubSettings, whatsappLink } from '@/lib/settings';
import { formatDateLocale } from '@/lib/format';
import type { ClubSettings, OrganizerApplication } from '@/types/database';
import { Spinner } from '@/components/LoadingScreen';

// My VSB: how to become an organizer (message a club admin; in-app applications
// are switched off), an application still pending from before, or (once made an
// organizer) the way into the organizer console. Hidden for admins.
export function OrganizeSection({ bare = false }: { bare?: boolean }) {
  const { t, i18n } = useTranslation();
  const { profile, isAdmin, isOrganizer } = useAuth();
  const [app, setApp] = useState<OrganizerApplication | null | undefined>(undefined);
  const [hasQr, setHasQr] = useState<boolean | null>(null);
  const [settings, setSettings] = useState<ClubSettings | null>(null);

  useEffect(() => {
    if (!profile || isAdmin) return;
    if (isOrganizer) fetchMyPaymentProfile(profile.id).then((p) => setHasQr(!!p?.qr_path));
    else {
      fetchMyLatestApplication(profile.id).then(setApp);
      fetchClubSettings().then(setSettings).catch(() => {});
    }
  }, [profile, isAdmin, isOrganizer]);

  if (!profile || isAdmin) return null;

  const lang = i18n.language;

  return (
    <section id="organize" aria-labelledby="organize-heading" className={`scroll-mt-16 border-t border-ink-600 ${bare ? 'py-10' : 'vsb-gutter py-12'}`}>
      {bare
        ? <h3 id="organize-heading" className="mb-5 font-display text-2xl font-bold uppercase tracking-wide text-chalk">{t('v2.organizer.title')}</h3>
        : <h2 id="organize-heading" className="vsb-display mb-6 text-3xl sm:text-4xl">{t('v2.organizer.title')}</h2>}

      {isOrganizer ? (
        <div className="max-w-3xl">
          <p className="text-slate-300">{t('v2.organizer.youAre')}</p>
          {hasQr === false && <p className="mt-3 border-l-2 border-amber-400 pl-3 text-sm text-amber-200">{t('v2.organizer.noQr')}</p>}
          <div className="mt-5 flex flex-wrap gap-3">
            <Link to="/admin/sessions" className="v2-btn-primary !px-6 font-display uppercase tracking-wider">{t('v2.nav.organizerConsole')} <ArrowRight className="h-4 w-4" aria-hidden /></Link>
            <Link to="/admin/payment-qr" className="v2-btn-secondary">{t('v2.organizer.paymentQr')}</Link>
          </div>
        </div>
      ) : app === undefined ? (
        <Spinner className="h-6 w-6 text-vsb-500" />
      ) : app?.status === 'pending' ? (
        <div className="max-w-3xl border-l-2 border-vsb-500 pl-4">
          <p className="font-semibold text-chalk">{t('v2.organizer.pendingTitle')}</p>
          <p className="mt-1 text-slate-300">{t('v2.organizer.pendingBody', { date: formatDateLocale(app.created_at, lang, 'medium') })}</p>
        </div>
      ) : (
        <div className="max-w-3xl">
          <p className="text-slate-300">{t('v2.organizer.intro')}</p>
          <a href={whatsappLink(settings?.contact_whatsapp || '0137441727', t('v2.organizer.contactMessage'))} target="_blank" rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 font-semibold text-green-400 hover:text-green-300">
            <MessageCircle className="h-5 w-5" aria-hidden /> {t('v2.organizer.contactAdmin', { name: settings?.contact_person_name || 'the club' })}
          </a>
        </div>
      )}
    </section>
  );
}
