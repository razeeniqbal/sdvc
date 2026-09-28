import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Timer } from 'lucide-react';
import { formatDateTime } from '@/lib/format';

// Unpaid bookings are held until `reservedUntil` (set by the database: 12 hours,
// never later than 2h before the game). After that the place goes to the waiting
// list, unless a receipt was uploaded.
export function HoldCountdown({ reservedUntil }: { reservedUntil: string }) {
  const { t } = useTranslation();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const msLeft = new Date(reservedUntil).getTime() - now;
  if (msLeft <= 0) return null;

  const totalMin = Math.ceil(msLeft / 60_000);
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  const left = hours > 0 ? t('v2.booking.holdLeftHours', { hours, minutes }) : t('v2.booking.holdLeftMinutes', { minutes });
  const urgent = msLeft < 60 * 60_000;

  return (
    <div role="status" className={`flex items-start gap-3 border p-4 ${urgent ? 'border-red-500/50 bg-red-500/10' : 'border-ball/40 bg-ball/10'}`}>
      <Timer className={`mt-0.5 h-5 w-5 flex-shrink-0 ${urgent ? 'text-red-400' : 'text-ball'}`} aria-hidden />
      <div className="text-sm">
        <p className="font-semibold text-chalk">
          {t('v2.booking.holdTitle', { time: formatDateTime(reservedUntil) })} <span className="font-mono text-ball">· {left}</span>
        </p>
        <p className="mt-0.5 text-slate-300">{t('v2.booking.holdDesc')}</p>
      </div>
    </div>
  );
}
