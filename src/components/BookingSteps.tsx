import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// BOOK → PAYMENT → CONFIRM (PRD §10). Purely presentational: `current` is
// derived by the page from the real booking state, never advanced by the UI.
export function BookingSteps({ current }: { current: 1 | 2 | 3 }) {
  const { t } = useTranslation();
  const steps = [t('v2.booking.stepBook'), t('v2.booking.stepPayment'), t('v2.booking.stepConfirm')];

  return (
    <ol className="flex items-center gap-2 sm:gap-3" aria-label={t('v2.booking.progressLabel')}>
      {steps.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <li key={label} className="flex flex-1 items-center gap-2 sm:flex-none" aria-current={active ? 'step' : undefined}>
            <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full font-display text-sm font-bold ${
              done ? 'bg-vsb-500 text-white' : active ? 'bg-chalk text-ink' : 'border border-ink-500 text-muted'
            }`}>
              {done ? <Check className="h-4 w-4" aria-hidden /> : n}
            </span>
            <span className={`font-display text-sm font-bold uppercase tracking-wide ${active ? 'text-chalk' : done ? 'text-vsb-300' : 'text-muted'}`}>
              {label}
              {done && <span className="sr-only"> ({t('v2.booking.stepDone')})</span>}
            </span>
            {n < steps.length && <span className="hidden h-px w-8 bg-ink-500 sm:block" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}
