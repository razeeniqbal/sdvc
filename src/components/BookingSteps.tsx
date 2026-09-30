import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// BOOK → PAYMENT → CONFIRM (PRD §10). Purely presentational: `current` is
// derived by the page from the real booking state, never advanced by the UI.
export function BookingSteps({ current }: { current: 1 | 2 | 3 }) {
  const { t } = useTranslation();
  const steps = [t('v2.booking.stepBook'), t('v2.booking.stepPayment'), t('v2.booking.stepConfirm')];

  return (
    <ol className="grid max-w-xl grid-cols-3 gap-3" aria-label={t('v2.booking.progressLabel')}>
      {steps.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <li key={label} aria-current={active ? 'step' : undefined}
            className={`border-t-2 pt-2 font-display text-xs font-bold uppercase tracking-[0.12em] sm:text-sm sm:tracking-[0.2em] ${active ? 'border-vsb-500 text-chalk' : done ? 'border-vsb-800 text-vsb-300' : 'border-ink-600 text-muted'}`}>
            <span className="mr-2">{String(n).padStart(2, '0')}</span>{label}
            {done && <Check className="ml-1.5 inline h-3.5 w-3.5 align-[-2px]" aria-hidden />}
            {done && <span className="sr-only"> ({t('v2.booking.stepDone')})</span>}
          </li>
        );
      })}
    </ol>
  );
}
