import { useTranslation } from 'react-i18next';
import type { GameState } from '@/lib/myGames';

// A game's state as text with a status dot (never colour alone).
const STYLE: Record<GameState, { dot: string; text: string; key: string }> = {
  upcoming: { dot: 'bg-green-400', text: 'text-green-300', key: 'v2.games.state.confirmed' },
  'awaiting-payment': { dot: 'bg-amber-400', text: 'text-amber-300', key: 'v2.games.state.awaitingPayment' },
  attended: { dot: 'bg-green-400', text: 'text-green-300', key: 'v2.games.state.attended' },
  missed: { dot: 'bg-red-400', text: 'text-red-300', key: 'v2.games.state.missed' },
  played: { dot: 'bg-slate-400', text: 'text-slate-300', key: 'v2.games.state.played' },
  cancelled: { dot: 'bg-slate-500', text: 'text-muted', key: 'v2.games.state.cancelled' },
};

export function GameStateLabel({ state }: { state: GameState }) {
  const { t } = useTranslation();
  const s = STYLE[state];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap font-display text-sm font-bold uppercase tracking-wider ${s.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden />
      {t(s.key)}
    </span>
  );
}
