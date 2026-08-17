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
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-amber-600 flex-shrink-0" />
          <p className="font-semibold text-amber-900 text-sm">{t('passkey.title')}</p>
        </div>
        <p className="text-xs text-amber-800">{t('passkey.subtitle')}</p>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg border border-amber-300 px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none"
            value={value}
            onChange={(e) => { setValue(e.target.value); setError(false); }}
            placeholder={t('passkey.placeholder')}
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={checking || !value.trim()}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg text-sm transition-colors disabled:opacity-60 flex items-center gap-2 flex-shrink-0"
          >
            {checking && <Spinner className="h-4 w-4" />}
            {t('passkey.unlock')}
          </button>
        </div>
        {error && <p className="text-xs text-red-600">{t('passkey.error')}</p>}
      </form>
    </div>
  );
}
