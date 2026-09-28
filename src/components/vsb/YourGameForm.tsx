import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import {
  EXPERIENCE_RANGES, GAME_VIBES, PLAY_REASONS, PLAYSTYLES,
  experienceKey, playstyleKey, reasonKey, vibeKey,
  type YourGame,
} from '@/lib/yourGame';

// YOUR GAME: 4 quick, optional questions. Real radio buttons and checkboxes
// (keyboard + screen reader friendly), styled as chips. Selected state shows
// a tick and bold text, not just colour.
export function YourGameForm({ value, onChange, idPrefix = 'yg' }: { value: YourGame; onChange: (g: YourGame) => void; idPrefix?: string }) {
  const { t } = useTranslation();
  const toggleReason = (r: YourGame['play_reasons'][number]) =>
    onChange({ ...value, play_reasons: value.play_reasons.includes(r) ? value.play_reasons.filter((x) => x !== r) : [...value.play_reasons, r] });

  return (
    <div className="space-y-6">
      <Question legend={t('v2.yourGame.q.vibe')}>
        {GAME_VIBES.map((v) => (
          <Chip key={v} type="radio" name={`${idPrefix}-vibe`} checked={value.game_vibe === v} onChange={() => onChange({ ...value, game_vibe: v })} label={t(vibeKey(v))} />
        ))}
      </Question>
      <Question legend={t('v2.yourGame.q.playstyle')}>
        {PLAYSTYLES.map((v) => (
          <Chip key={v} type="radio" name={`${idPrefix}-style`} checked={value.playstyle === v} onChange={() => onChange({ ...value, playstyle: v })} label={t(playstyleKey(v))} />
        ))}
      </Question>
      <Question legend={t('v2.yourGame.q.experience')}>
        {EXPERIENCE_RANGES.map((v) => (
          <Chip key={v} type="radio" name={`${idPrefix}-exp`} checked={value.experience_range === v} onChange={() => onChange({ ...value, experience_range: v })} label={t(experienceKey(v))} />
        ))}
      </Question>
      <Question legend={t('v2.yourGame.q.reasons')} hint={t('v2.yourGame.q.reasonsHint')}>
        {PLAY_REASONS.map((v) => (
          <Chip key={v} type="checkbox" name={`${idPrefix}-why-${v}`} checked={value.play_reasons.includes(v)} onChange={() => toggleReason(v)} label={t(reasonKey(v))} />
        ))}
      </Question>
    </div>
  );
}

function Question({ legend, hint, children }: { legend: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="font-display text-lg font-bold uppercase tracking-wide text-chalk">{legend}</legend>
      {hint && <p className="text-xs text-muted">{hint}</p>}
      <div className="mt-3 flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

function Chip({ type, name, checked, onChange, label }: { type: 'radio' | 'checkbox'; name: string; checked: boolean; onChange: () => void; label: string }) {
  return (
    <label className={`inline-flex cursor-pointer select-none items-center gap-1.5 border px-3 py-2 font-display text-sm font-bold uppercase tracking-wider transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-vsb-400 ${
      checked ? 'border-vsb-500 bg-vsb-600/25 text-chalk' : 'border-ink-500 text-slate-300 hover:border-slate-400 hover:text-chalk'
    }`}>
      <input type={type} name={name} checked={checked} onChange={onChange} className="sr-only" />
      {checked && <Check className="h-4 w-4 text-vsb-300" aria-hidden />}
      {label}
    </label>
  );
}
