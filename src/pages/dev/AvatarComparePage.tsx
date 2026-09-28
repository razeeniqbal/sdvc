import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { avatarPublicUrl } from '@/lib/avatars';
import { useAuth } from '@/context/AuthContext';

// DEV-ONLY generation review (route exists only in `vite dev`). Shows the
// approved Player #10 master beside every generation of the signed-in user,
// at the same height. Acceptance: with faces hidden, both must still read as
// the same VSB character system.

const MASTER = '/brand/avatar-style-v3.png';
const HEIGHT = 560;

interface Gen {
  id: string;
  status: string;
  prompt_version: string | null;
  model: string | null;
  provider_request_id: string | null;
  failure_reason: string | null;
  output_path: string | null;
  created_at: string;
}

export default function AvatarComparePage() {
  const { profile } = useAuth();
  const [gens, setGens] = useState<Gen[] | null>(null);
  const [hideFaces, setHideFaces] = useState(false);

  useEffect(() => {
    if (!profile) return;
    supabase.from('player_avatar_generations')
      .select('id, status, prompt_version, model, provider_request_id, failure_reason, output_path, created_at')
      .eq('user_id', profile.id).order('created_at', { ascending: false })
      .then(({ data }) => setGens((data || []) as Gen[]));
  }, [profile]);

  if (!profile) return <p className="vsb-gutter py-10 text-slate-300">Sign in to review your generations.</p>;

  return (
    <div className="vsb-gutter bg-ink py-8 text-chalk">
      <p className="mb-4 border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
        Dev-only generation review · {profile.short_name || profile.full_name} ·{' '}
        <label className="cursor-pointer font-semibold"><input type="checkbox" className="mr-1.5" checked={hideFaces} onChange={(e) => setHideFaces(e.target.checked)} />Hide faces</label>
      </p>
      <div className="flex gap-6 overflow-x-auto pb-4">
        <Figure src={MASTER} label="APPROVED · Player #10 master" sub="avatar-style-v3.png" hideFaces={hideFaces} />
        {gens === null && <p className="self-center text-muted">Loading…</p>}
        {gens?.length === 0 && <p className="self-center text-muted">No generations yet.</p>}
        {gens?.map((g) => (
          g.status === 'succeeded' && g.output_path ? (
            <Figure key={g.id} src={avatarPublicUrl(g.output_path)!} label={`${g.prompt_version ?? 'unversioned'} · ${g.model ?? '?'}`}
              sub={`${new Date(g.created_at).toLocaleString()} · ${g.provider_request_id ?? 'no request id'}`} hideFaces={hideFaces} />
          ) : (
            <div key={g.id} className="flex w-60 flex-shrink-0 flex-col justify-center border border-red-500/40 p-4 text-sm" style={{ height: HEIGHT }}>
              <p className="font-semibold text-red-300">{g.status} · {g.prompt_version ?? 'unversioned'}</p>
              <p className="mt-1 break-words text-slate-400">{g.failure_reason}</p>
            </div>
          )
        ))}
      </div>
    </div>
  );
}

function Figure({ src, label, sub, hideFaces }: { src: string; label: string; sub: string; hideFaces: boolean }) {
  return (
    <figure className="flex-shrink-0">
      <div className="relative bg-ink-700 [background-image:repeating-conic-gradient(#19212D_0_25%,#232D3B_0_50%)] [background-size:24px_24px]" style={{ height: HEIGHT }}>
        <img src={src} alt={label} className="h-full w-auto" />
        {hideFaces && <div className="absolute inset-x-0 top-0 h-[34%] bg-ink" aria-hidden />}
      </div>
      <figcaption className="mt-2 max-w-[380px] text-xs">
        <span className="block font-bold text-chalk">{label}</span>
        <span className="block break-all text-muted">{sub}</span>
      </figcaption>
    </figure>
  );
}
