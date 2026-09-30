import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { applyToOrganize, fetchMyLatestApplication, fetchMyPaymentProfile } from '@/lib/organizers';
import { formatDateLocale } from '@/lib/format';
import type { OrganizerApplication } from '@/types/database';
import { Spinner } from '@/components/LoadingScreen';

// My VSB: apply to organize games, see where the application stands, or (once
// approved) jump into the organizer console. Hidden for admins.
export function OrganizeSection({ bare = false }: { bare?: boolean }) {
  const { t, i18n } = useTranslation();
  const { profile, isAdmin, isOrganizer } = useAuth();
  const { show } = useToast();
  const [app, setApp] = useState<OrganizerApplication | null | undefined>(undefined);
  const [hasQr, setHasQr] = useState<boolean | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!profile || isAdmin) return;
    if (isOrganizer) fetchMyPaymentProfile(profile.id).then((p) => setHasQr(!!p?.qr_path));
    else fetchMyLatestApplication(profile.id).then(setApp);
  }, [profile, isAdmin, isOrganizer]);

  if (!profile || isAdmin) return null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSending(true);
    try {
      await applyToOrganize(profile.id, message);
      setApp(await fetchMyLatestApplication(profile.id));
      setMessage('');
      show(t('v2.organizer.applied'), 'success');
    } catch {
      show(t('v2.organizer.applyError'), 'error');
    } finally {
      setSending(false);
    }
  }

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
        <form onSubmit={submit} className="max-w-3xl">
          {app?.status === 'rejected' && (
            <p className="mb-4 border-l-2 border-ink-500 pl-3 text-sm text-slate-400">{t('v2.organizer.rejected', { date: formatDateLocale(app.reviewed_at ?? app.created_at, lang, 'medium') })}</p>
          )}
          <p className="text-slate-300">{t('v2.organizer.intro')}</p>
          <label htmlFor="organize-msg" className="mb-1.5 mt-5 block text-sm font-medium text-slate-300">{t('v2.organizer.messageLabel')}</label>
          <textarea id="organize-msg" rows={3} maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)}
            placeholder={t('v2.organizer.messagePlaceholder')} className="v2-input !text-base" />
          <button type="submit" disabled={sending} className={`${bare ? 'v2-btn-secondary' : 'v2-btn-primary'} mt-4 !px-6 font-display uppercase tracking-wider`}>
            {sending && <Spinner className="h-4 w-4" />} {t('v2.organizer.apply')}
          </button>
        </form>
      )}
    </section>
  );
}
