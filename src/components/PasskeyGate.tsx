import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Spinner } from '@/components/LoadingScreen';

interface PasskeyGateProps {
  sessionId: string;
  onUnlocked: () => void;
}

// Blocks whatever it's placed in front of until the caller enters the session's
// passkey correctly. The check happens server-side (verify_session_passkey) — this
// component never sees or stores the real passkey, only whether a guess matched.
export function PasskeyGate({ sessionId, onUnlocked }: PasskeyGateProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    setChecking(true);
    setError(false);
    const { data, error: rpcError } = await supabase.rpc('verify_session_passkey', { p_session_id: sessionId, p_passkey: value });
    setChecking(false);
    if (rpcError || !data) {
      setError(true);
      return;
    }
    onUnlocked();
  }

  return (
    <form onSubmit={handleSubmit} className="border-l-2 border-amber-400 pl-4">
      <p className="flex items-center gap-2 font-semibold text-amber-200">
        <Lock className="h-4 w-4 flex-shrink-0 text-amber-400" aria-hidden /> {t('passkey.title')}
      </p>
      <p className="mt-1 text-sm text-amber-300">{t('passkey.subtitle')}</p>
      <div className="mt-3 flex gap-2">
        <input
          className="v2-input flex-1 !py-2.5 !text-base"
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(false); }}
          placeholder={t('passkey.placeholder')}
          aria-label={t('passkey.placeholder')}
          aria-invalid={error || undefined}
          autoComplete="off"
        />
        <button type="submit" disabled={checking || !value.trim()} className="v2-btn-primary flex-shrink-0">
          {checking && <Spinner className="h-4 w-4" />}
          {t('passkey.unlock')}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-400" role="alert">{t('passkey.error')}</p>}
    </form>
  );
}
