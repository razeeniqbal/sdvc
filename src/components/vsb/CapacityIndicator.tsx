import { useTranslation } from 'react-i18next';

// "8 / 12 PLAYERS" plus a segmented bar — one segment per spot, so capacity
// reads as people rather than a percentage. The text carries the meaning; the
// bar is a visual echo (aria-hidden).
export function CapacityIndicator({ confirmed, max, size = 'md' }: { confirmed: number; max: number; size?: 'sm' | 'md' }) {
  const { t } = useTranslation();
  const filled = Math.min(confirmed, max);
  const full = filled >= max;
  const segments = Math.min(max, 30);
  const scaled = max > 30 ? Math.round((filled / max) * segments) : filled;

  return (
    <div>
      <p className={`font-display font-bold uppercase tracking-wide ${size === 'sm' ? 'text-sm' : 'text-base'}`}>
        <span className="text-chalk">{filled}</span>
        <span className="text-muted"> / {max} {t('v2.capacity.players')}</span>
      </p>
      <div className="mt-1.5 flex gap-[3px]" aria-hidden>
        {Array.from({ length: segments }, (_, i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-[1px] ${i < scaled ? (full ? 'bg-ball' : 'bg-vsb-500') : 'bg-ink-600'}`}
          />
        ))}
      </div>
    </div>
  );
}
