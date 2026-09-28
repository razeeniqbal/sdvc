import { useTranslation } from 'react-i18next';

export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { i18n, t } = useTranslation();

  return (
    <div role="group" aria-label={t('v2.nav.language')} className={`inline-flex items-center gap-2 text-xs font-bold tracking-wider ${className}`}>
      {(['en', 'ms'] as const).map((lng, i) => (
        <span key={lng} className="flex items-center gap-2">
          {i > 0 && <span className="h-3 w-px bg-ink-500" aria-hidden />}
          <button
            onClick={() => i18n.changeLanguage(lng)}
            aria-pressed={i18n.language === lng}
            className={`py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vsb-400 ${
              i18n.language === lng ? 'text-chalk' : 'text-muted hover:text-chalk'
            }`}
          >
            {lng === 'en' ? 'EN' : 'BM'}
          </button>
        </span>
      ))}
    </div>
  );
}
