import { useTranslation } from 'react-i18next';

export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { i18n } = useTranslation();

  return (
    <div className={`inline-flex items-center rounded-lg border border-ink-500 bg-ink-850 p-0.5 text-xs font-bold ${className}`}>
      {(['en', 'ms'] as const).map((lng) => (
        <button
          key={lng}
          onClick={() => i18n.changeLanguage(lng)}
          aria-pressed={i18n.language === lng}
          className={`px-2 py-1 rounded-md transition-colors ${
            i18n.language === lng ? 'bg-chalk text-ink' : 'text-slate-400 hover:text-white'
          }`}
        >
          {lng.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
