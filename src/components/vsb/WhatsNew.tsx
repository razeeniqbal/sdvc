import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useMyAvatar } from '@/lib/avatars';
import { vsbAssets } from '@/lib/vsbAssets';
import { WHATS_NEW_EVENT } from '@/lib/whatsNew';

// One-time "What's new" announcement per person. Seen state lives on the
// profile (profiles.seen_whats_new), so it shows once across devices:
//   ANNOUNCEMENT          seen to the end: never shown again automatically
//   ANNOUNCEMENT + PARTIAL closed on step 1: shown once more, from step 2
// Anyone can reopen it from the player menu (openWhatsNew). Bump
// ANNOUNCEMENT for the next announcement; the copy lives in v2.whatsNew.*.
const ANNOUNCEMENT = '2026-10-rules-and-players';
const PARTIAL = ':rules';

// Never interrupt sign-in, the console, or someone already creating a player.
const QUIET = /^\/(admin|login|register|forgot-password|reset-password|profile\/player|__)/;

/** `preview`: dev review only (always shows, never saves). */
export function WhatsNew({ preview = false }: { preview?: boolean } = {}) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { pathname } = useLocation();
  const avatar = useMyAvatar(profile?.id);
  const [dismissed, setDismissed] = useState(false);
  const [manual, setManual] = useState(false);
  const [chosenStep, setStep] = useState<1 | 2 | null>(null);
  const seen = profile?.seen_whats_new ?? null;
  const onlyRulesSeen = seen === ANNOUNCEMENT + PARTIAL;
  // Someone who closed on the rules gets the features straight away next time.
  const step = chosenStep ?? (onlyRulesSeen && !manual ? 2 : 1);

  useEffect(() => {
    const reopen = () => { setManual(true); setDismissed(false); setStep(1); };
    window.addEventListener(WHATS_NEW_EVENT, reopen);
    return () => window.removeEventListener(WHATS_NEW_EVENT, reopen);
  }, []);

  const auto = !!profile && seen !== ANNOUNCEMENT && !QUIET.test(pathname);
  const open = !dismissed && (preview || manual || auto);

  function close() {
    setDismissed(true);
    setManual(false);
    if (!profile || preview || seen === ANNOUNCEMENT) return;
    const next = step === 2 ? ANNOUNCEMENT : ANNOUNCEMENT + PARTIAL;
    if (next !== seen) supabase.from('profiles').update({ seen_whats_new: next }).eq('id', profile.id).then(() => {});
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
    // close() only depends on the profile id, which can't change while open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const rules = [
    { title: t('v2.whatsNew.rule1Title'), body: t('v2.whatsNew.rule1Body') },
    { title: t('v2.whatsNew.rule2Title'), body: t('v2.whatsNew.rule2Body') },
    { title: t('v2.whatsNew.rule3Title'), body: t('v2.whatsNew.rule3Body') },
  ];
  const features = [
    { title: t('v2.whatsNew.feature1Title'), body: t('v2.whatsNew.feature1Body') },
    { title: t('v2.whatsNew.feature2Title'), body: t('v2.whatsNew.feature2Body') },
    { title: t('v2.whatsNew.feature3Title'), body: t('v2.whatsNew.feature3Body') },
  ];
  const items = step === 1 ? rules : features;
  const art = vsbAssets.states.welcome.sm;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 sm:items-center sm:p-6" onClick={close}>
      <div role="dialog" aria-modal="true" aria-labelledby="whats-new-title" onClick={(e) => e.stopPropagation()}
        className="animate-slide-up relative max-h-[92svh] w-full overflow-y-auto border-t border-ink-600 bg-ink-800 sm:max-w-2xl sm:border">
        <button onClick={close} aria-label={t('common.close')} className="absolute right-3 top-3 z-10 p-2 text-muted hover:text-chalk">
          <X className="h-5 w-5" aria-hidden />
        </button>

        <div className="grid sm:grid-cols-[minmax(0,1fr)_10rem]">
          <div className="px-6 pb-6 pt-7 sm:px-8 sm:pt-8">
            <p className="vsb-index"><b>0{step}</b> / 02 · {t('v2.whatsNew.meta')}</p>
            <h2 id="whats-new-title" className="vsb-display mt-3 text-4xl sm:text-5xl">
              {step === 1 ? t('v2.whatsNew.rulesTitle') : t('v2.whatsNew.featuresTitle')}
            </h2>
            <ol className="mt-6 divide-y divide-ink-600 border-y border-ink-600">
              {items.map((it, i) => (
                <li key={it.title} className="flex gap-4 py-4">
                  <span className="font-display text-2xl font-extrabold leading-none text-vsb-500">{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <p className="font-display text-lg font-bold uppercase tracking-wide text-chalk">{it.title}</p>
                    <p className="mt-1 text-sm text-slate-300">{it.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <img src={art.src} alt="" width={art.width} height={art.height} decoding="async"
            className="hidden h-72 w-auto self-end justify-self-center sm:block" />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-600 bg-ink-850 px-6 py-4 sm:px-8">
          <div className="flex gap-1.5" aria-hidden>
            <span className={`h-1 w-6 ${step === 1 ? 'bg-vsb-500' : 'bg-ink-500'}`} />
            <span className={`h-1 w-6 ${step === 2 ? 'bg-vsb-500' : 'bg-ink-500'}`} />
          </div>
          {step === 1 ? (
            <button autoFocus onClick={() => setStep(2)} className="v2-btn-primary !px-6 font-display uppercase tracking-wider">
              {t('v2.whatsNew.next')} <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          ) : (
            <div className="flex flex-wrap gap-3">
              <button onClick={close} className="v2-btn-secondary">{t('v2.whatsNew.done')}</button>
              <Link autoFocus to={avatar ? '/profile#your-game' : '/profile/player'} onClick={close} className="v2-btn-primary !px-6 font-display uppercase tracking-wider">
                {avatar ? t('v2.whatsNew.openMyVsb') : t('v2.landing.createPlayer')} <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
