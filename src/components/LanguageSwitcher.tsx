import { useTranslation } from 'react-i18next';

export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { i18n } = useTranslation();

  return (
    <div className={`inline-flex items-center rounded-lg border border-white/20 bg-white/10 p-0.5 text-xs font-bold ${className}`}>
      {(['en', 'ms'] as const).map((lng) => (
        <button
          key={lng}
          onClick={() => i18n.changeLanguage(lng)}
          className={`px-2 py-1 rounded-md transition-colors ${
            i18n.language === lng ? 'bg-gradient-to-r from-rose-500 to-orange-500 text-white' : 'text-slate-300 hover:text-white'
          }`}
        >
          {lng.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
