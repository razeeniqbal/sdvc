import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { vsbAssets } from '@/lib/vsbAssets';

// Sign in / sign up / password pages: the VSB court on one side, the form on
// the other. Phones get the form first and no artwork. Presentation only;
// each page keeps its own auth logic.
export function AuthLayout({ title, subtitle, children }: { title: ReactNode; subtitle?: ReactNode; children: ReactNode }) {
  const { t } = useTranslation();
  const art = vsbAssets.hero.mobile750;
  return (
    <div className="grid min-h-[calc(100svh-4rem)] bg-ink lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* Brand side: desktop only. Lazy, so phones never download it. */}
      <div className="relative hidden overflow-hidden border-r border-ink-600 lg:block">
        <img src={art.src} alt="" width={art.width} height={art.height} loading="lazy" decoding="async"
          className="absolute inset-0 h-full w-full object-cover object-top" />
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-ink via-ink/70 to-transparent" aria-hidden />
        <div className="vsb-gutter absolute inset-x-0 bottom-0 pb-12">
          <p className="vsb-display text-5xl xl:text-6xl">
            {t('v2.landing.heroLine1')}<br />{t('v2.landing.heroLine2')}<br /><span className="text-vsb-500">{t('v2.landing.heroLine3')}</span>
          </p>
        </div>
      </div>

      {/* Form side */}
      <div className="vsb-gutter flex items-start py-10 lg:items-center lg:py-16">
        <div className="w-full max-w-md lg:mx-auto">
          <h1 className="vsb-display text-5xl">{title}</h1>
          {subtitle && <p className="mt-2 text-slate-400">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
