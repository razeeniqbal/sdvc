import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, ImagePlus, RotateCcw } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { fetchMyEntitlement, generateMyAvatar, GenerationError, useMyAvatar, type Entitlement } from '@/lib/avatars';
import { PLAYING_POSITIONS, POSITION_KEY, SKILL_LEVEL_KEY } from '@/lib/volleyball';
import { supabase } from '@/lib/supabase';
import type { PlayingPosition } from '@/types/database';
import { Spinner } from '@/components/LoadingScreen';
import { PlayerCard } from '@/components/PlayerCard';
import { YourGameForm } from '@/components/vsb/YourGameForm';
import { PoseIcon } from '@/components/vsb/PoseIcon';
import { Check } from 'lucide-react';
import { defaultPose, isPose, poseKey, POSES, saveLook, type Pose } from '@/lib/playerPose';
import { hasYourGame, playstyleKey, saveYourGame, vibeKey, yourGameOf, type YourGame } from '@/lib/yourGame';

// CREATE YOUR VSB PLAYER: photo → crop → position → generate → "your player
// is ready". Only the photo and the position are asked for; name, level and
// gender are reused from the profile. Uploading, cropping and previewing never
// touch the entitlement; only the explicit "Generate" confirmation calls the
// server. The AI is infrastructure: the result is presented as the player.

type Step = 'upload' | 'crop' | 'confirm' | 'pose' | 'game' | 'generating' | 'done' | 'error';

const FRAME = 288; // on-screen crop frame (px) — fits 320px phones with gutters
const OUTPUT = 1024; // exported square photo (px)

export default function CreatePlayerPage() {
  const { t } = useTranslation();
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const avatar = useMyAvatar(profile?.id);
  const [step, setStep] = useState<Step>('upload');
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [cropped, setCropped] = useState<{ blob: Blob; url: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [position, setPosition] = useState<PlayingPosition>(profile?.playing_position ?? 'Flexible / Any Position');
  // Your Game is asked only if it was never answered (and can be skipped).
  const [needsGame] = useState(() => !hasYourGame(yourGameOf(profile)));
  const [gameDraft, setGameDraft] = useState<YourGame>(yourGameOf(profile));
  const [savingGame, setSavingGame] = useState(false);
  // Pose: kept from the profile by default (regenerating never silently
  // changes it); skipping assigns the stable default for this player.
  const currentPose = isPose(profile?.player_pose) ? profile!.player_pose : null;
  const [pose, setPose] = useState<Pose | null>(currentPose);
  const [savingPose, setSavingPose] = useState(false);
  // Glasses: asked, never guessed from the photo. Must be answered to continue.
  const [glasses, setGlasses] = useState<boolean | null>(profile?.wears_glasses ?? null);

  async function continueFromPose(skip: boolean) {
    if (!profile || glasses === null) return;
    const chosen: Pose = skip || !pose ? currentPose ?? defaultPose(profile.id) : pose;
    setSavingPose(true);
    try {
      if (chosen !== profile.player_pose || glasses !== profile.wears_glasses) {
        await saveLook(profile.id, { player_pose: chosen, wears_glasses: glasses });
        await refreshProfile();
      }
      setPose(chosen);
    } catch { /* the server applies the same pose default; glasses then fall back to "only if clearly worn" */ }
    setSavingPose(false);
    if (needsGame) setStep('game'); else setConfirming(true);
  }

  async function continueFromGame(save: boolean) {
    if (save && profile && hasYourGame(gameDraft)) {
      setSavingGame(true);
      try { await saveYourGame(profile.id, gameDraft); await refreshProfile(); } catch { /* optional; generation can still go ahead */ }
      setSavingGame(false);
    }
    setConfirming(true);
  }
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchMyEntitlement().then(setEntitlement); }, []);
  useEffect(() => () => { if (imgUrl) URL.revokeObjectURL(imgUrl); }, [imgUrl]);

  if (!profile) return null;

  const canGenerate = !!entitlement && (entitlement.unlimited || entitlement.remaining > 0);
  const isFirst = !!entitlement && !entitlement.unlimited && entitlement.used === 0;

  // ----- crop geometry: image covers the square frame; drag + zoom inside it -----
  const baseScale = natural.w ? FRAME / Math.min(natural.w, natural.h) : 1;
  const scale = baseScale * zoom;
  const dispW = natural.w * scale;
  const dispH = natural.h * scale;
  const clamp = (x: number, y: number) => ({
    x: Math.min(0, Math.max(FRAME - dispW, x)),
    y: Math.min(0, Math.max(FRAME - dispH, y)),
  });

  function onFile(file: File | undefined) {
    if (!file || !file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setNatural({ w: img.naturalWidth, h: img.naturalHeight });
      const s = FRAME / Math.min(img.naturalWidth, img.naturalHeight);
      setZoom(1);
      setOffset({ x: (FRAME - img.naturalWidth * s) / 2, y: (FRAME - img.naturalHeight * s) / 2 });
      setImgUrl(url);
      setStep('crop');
    };
    img.src = url;
  }

  function onZoom(z: number) {
    // Zoom around the frame centre.
    const cx = FRAME / 2 - offset.x;
    const cy = FRAME / 2 - offset.y;
    const ratio = z / zoom;
    setZoom(z);
    const nw = natural.w * baseScale * z;
    const nh = natural.h * baseScale * z;
    const nx = FRAME / 2 - cx * ratio;
    const ny = FRAME / 2 - cy * ratio;
    setOffset({ x: Math.min(0, Math.max(FRAME - nw, nx)), y: Math.min(0, Math.max(FRAME - nh, ny)) });
  }

  function onPointerDown(e: ReactPointerEvent) {
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  }
  function onPointerMove(e: ReactPointerEvent) {
    if (!drag.current) return;
    setOffset(clamp(drag.current.ox + e.clientX - drag.current.x, drag.current.oy + e.clientY - drag.current.y));
  }

  async function finishCrop() {
    if (!imgUrl) return;
    const img = new Image();
    img.src = imgUrl;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    canvas.getContext('2d')!.drawImage(img, -offset.x / scale, -offset.y / scale, FRAME / scale, FRAME / scale, 0, 0, OUTPUT, OUTPUT);
    const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), 'image/jpeg', 0.9));
    if (cropped) URL.revokeObjectURL(cropped.url);
    setCropped({ blob, url: URL.createObjectURL(blob) });
    setStep('confirm');
  }

  async function generate() {
    if (!cropped || !profile) return;
    setConfirming(false);
    setStep('generating');
    try {
      // Position is profile data (the card shows it); save a change first.
      if (position !== profile.playing_position) {
        const { error } = await supabase.from('profiles').update({ playing_position: position }).eq('id', profile.id);
        if (error) throw error;
        await refreshProfile();
      }
      await generateMyAvatar(profile.id, cropped.blob);
      setStep('done');
    } catch (e) {
      const code = e instanceof GenerationError ? e.code : 'UNKNOWN';
      setErrorMsg(t(`v2.create.errors.${code}`, { defaultValue: (e as Error).message }));
      setStep('error');
    } finally {
      fetchMyEntitlement().then(setEntitlement);
    }
  }

  const steps = [t('v2.create.stepPhoto'), t('v2.create.stepCrop'), t('v2.create.stepPosition'), t('v2.create.stepPose'), ...(needsGame ? [t('v2.create.stepYourGame')] : []), t('v2.create.stepGenerate')];
  const genIndex = steps.length;
  const stepIndex = { upload: 1, crop: 2, confirm: 3, pose: 4, game: 5, generating: genIndex, done: genIndex, error: genIndex }[step];

  return (
    <div className="bg-ink text-chalk">
      <div className="vsb-gutter border-b border-ink-600 py-3">
        <Link to="/profile" className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted hover:text-chalk">
          <ArrowLeft className="h-4 w-4" aria-hidden /> {t('v2.myVsb.meta')}
        </Link>
      </div>

      <div className="vsb-gutter grid gap-12 py-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:py-16">
        <div className="min-w-0">
          <p className="vsb-meta mb-3">{t('v2.create.meta')}</p>
          <h1 className="vsb-display text-5xl sm:text-6xl">{t('v2.create.titleLine1')}<br /><span className="text-vsb-500">{t('v2.create.titleLine2')}</span></h1>

          <ol className="mt-8 flex flex-wrap gap-x-6 gap-y-2" aria-label={t('v2.create.progress')}>
            {steps.map((s, i) => (
              <li key={s} aria-current={stepIndex === i + 1 ? 'step' : undefined}
                className={`font-display text-sm font-bold uppercase tracking-wider ${stepIndex === i + 1 ? 'text-chalk' : stepIndex > i + 1 ? 'text-vsb-300' : 'text-muted'}`}>
                <span className="mr-2 text-vsb-500">{String(i + 1).padStart(2, '0')}</span>{s}
              </li>
            ))}
          </ol>

          <div className="mt-8 border-t border-ink-600 pt-8">
            {/* 01 — upload */}
            {step === 'upload' && (
              <div className="max-w-xl space-y-5">
                <p className="text-lg text-slate-300">{t('v2.create.uploadIntro')}</p>
                <ul className="space-y-1.5 text-sm text-slate-400">
                  <li className="flex gap-3"><span className="mt-2.5 h-0.5 w-3 flex-shrink-0 bg-vsb-500" aria-hidden />{t('v2.create.tip1')}</li>
                  <li className="flex gap-3"><span className="mt-2.5 h-0.5 w-3 flex-shrink-0 bg-vsb-500" aria-hidden />{t('v2.create.tip2')}</li>
                  <li className="flex gap-3"><span className="mt-2.5 h-0.5 w-3 flex-shrink-0 bg-vsb-500" aria-hidden />{t('v2.create.tip3')}</li>
                </ul>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" id="photo-input" onChange={(e) => onFile(e.target.files?.[0])} />
                <label htmlFor="photo-input" className="v2-btn-primary cursor-pointer !px-6 !py-3 font-display uppercase tracking-wider">
                  <ImagePlus className="h-5 w-5" aria-hidden /> {t('v2.create.choosePhoto')}
                </label>
                <p className="text-xs text-muted">{t('v2.create.privacy')}</p>
              </div>
            )}

            {/* 02 — crop */}
            {step === 'crop' && imgUrl && (
              <div className="space-y-5">
                <p className="text-slate-300">{t('v2.create.cropIntro')}</p>
                <div
                  className="relative touch-none select-none overflow-hidden border border-ink-500 bg-ink-850"
                  style={{ width: FRAME, height: FRAME, maxWidth: '100%' }}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={() => { drag.current = null; }}
                  onPointerCancel={() => { drag.current = null; }}
                  role="img"
                  aria-label={t('v2.create.cropLabel')}
                >
                  <img src={imgUrl} alt="" draggable={false} className="pointer-events-none absolute max-w-none"
                    style={{ width: dispW, height: dispH, left: offset.x, top: offset.y }} />
                  <div className="pointer-events-none absolute inset-[12%] rounded-full border-2 border-dashed border-chalk/50" aria-hidden />
                </div>
                <label className="flex max-w-xs items-center gap-3 text-sm text-slate-300">
                  {t('v2.create.zoom')}
                  <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => onZoom(Number(e.target.value))} className="flex-1 accent-[#168BFF]" />
                </label>
                <div className="flex flex-wrap gap-3">
                  <button onClick={finishCrop} className="v2-btn-primary font-display uppercase tracking-wider">{t('v2.create.useThisCrop')} <ArrowRight className="h-4 w-4" aria-hidden /></button>
                  <button onClick={() => fileRef.current?.click()} className="v2-btn-secondary">{t('v2.create.differentPhoto')}</button>
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
                </div>
              </div>
            )}

            {/* 03 — position */}
            {step === 'confirm' && cropped && (
              <div className="grid gap-8 sm:grid-cols-[12rem_minmax(0,1fr)]">
                <img src={cropped.url} alt={t('v2.create.yourPhoto')} className="h-48 w-48 border border-ink-600 object-cover" />
                <div className="space-y-5">
                  <div>
                    <label htmlFor="cp-position" className="vsb-meta mb-2 block">{t('v2.profile.position')}</label>
                    <select id="cp-position" value={position} onChange={(e) => setPosition(e.target.value as PlayingPosition)} className="v2-input !py-3 !text-base">
                      {PLAYING_POSITIONS.map((pos) => <option key={pos} value={pos}>{t(POSITION_KEY[pos])}</option>)}
                    </select>
                  </div>
                  <p className="text-sm text-slate-400">
                    {t('v2.create.reusing', { name: profile.short_name || profile.full_name, level: profile.skill_level ? t(SKILL_LEVEL_KEY[profile.skill_level]) : t('v2.profile.notSet') })}{' '}
                    <Link to="/profile#profile-section" className="text-vsb-400 hover:text-vsb-300">{t('v2.myVsb.edit')}</Link>
                  </p>

                  {entitlement && !canGenerate ? (
                    <p className="border-l-2 border-amber-400 pl-3 text-amber-200">{t('v2.create.noneLeft')}</p>
                  ) : (
                    <>
                      {isFirst && <p className="border-t border-ink-600 pt-4 text-slate-300">{t('v2.create.firstFree')}</p>}
                      <div className="flex flex-wrap gap-3">
                        <button onClick={() => setStep('pose')} disabled={!entitlement} className="v2-btn-primary !px-6 !py-3 font-display uppercase tracking-wider">
                          {t('v2.create.continue')} <ArrowRight className="h-4 w-4" aria-hidden />
                        </button>
                        <button onClick={() => setStep('crop')} className="v2-btn-secondary"><RotateCcw className="h-4 w-4" aria-hidden /> {t('v2.create.recrop')}</button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* 04 — Your pose (optional) */}
            {step === 'pose' && (
              <div className="max-w-3xl">
                <p className="font-display text-3xl font-extrabold uppercase text-chalk">{t('v2.pose.title')}</p>
                <p className="mt-2 text-slate-300">{t('v2.pose.intro')}</p>
                <div role="radiogroup" aria-label={t('v2.pose.title')} className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-6">
                  {POSES.map((p) => (
                    <label key={p} className={`relative flex cursor-pointer flex-col items-center border px-2 pb-3 pt-2 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-vsb-400 ${
                      pose === p ? 'border-vsb-500 bg-vsb-600/20 text-chalk' : 'border-ink-500 text-slate-400 hover:border-slate-400 hover:text-chalk'}`}>
                      <input type="radio" name="player-pose" value={p} checked={pose === p} onChange={() => setPose(p)} className="sr-only" />
                      {pose === p && <Check className="absolute right-1.5 top-1.5 h-4 w-4 text-vsb-300" aria-hidden />}
                      <PoseIcon pose={p} className="h-20 w-auto" />
                      <span className="mt-2 font-display text-sm font-bold uppercase tracking-wider">{t(poseKey(p))}</span>
                    </label>
                  ))}
                </div>
                {avatar && currentPose && (
                  <p className="mt-4 text-sm text-slate-400">{t('v2.pose.current', { pose: t(poseKey(currentPose)) })}</p>
                )}

                <fieldset className="mt-8 border-t border-ink-600 pt-6">
                  <legend className="float-left w-full font-display text-xl font-bold uppercase tracking-wide text-chalk">{t('v2.glasses.question')}</legend>
                  <p className="clear-both pt-1 text-sm text-slate-400">{t('v2.glasses.hint')}</p>
                  <div role="radiogroup" aria-label={t('v2.glasses.question')} className="mt-4 flex gap-3">
                    {[true, false].map((v) => (
                      <label key={String(v)} className={`flex min-w-[7rem] cursor-pointer items-center justify-center gap-2 border px-5 py-3 font-display text-base font-bold uppercase tracking-wider transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-vsb-400 ${
                        glasses === v ? 'border-vsb-500 bg-vsb-600/20 text-chalk' : 'border-ink-500 text-slate-400 hover:border-slate-400 hover:text-chalk'}`}>
                        <input type="radio" name="wears-glasses" checked={glasses === v} onChange={() => setGlasses(v)} className="sr-only" />
                        {glasses === v && <Check className="h-4 w-4 text-vsb-300" aria-hidden />}
                        {v ? t('v2.glasses.yes') : t('v2.glasses.no')}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="mt-8 flex flex-wrap gap-3">
                  <button onClick={() => continueFromPose(false)} disabled={savingPose || !pose || glasses === null} className="v2-btn-primary !px-6 !py-3 font-display uppercase tracking-wider">
                    {savingPose && <Spinner className="h-4 w-4" />} {needsGame ? t('v2.create.continue') : t('v2.create.generate')} <ArrowRight className="h-4 w-4" aria-hidden />
                  </button>
                  <button onClick={() => continueFromPose(true)} disabled={savingPose || glasses === null} className="v2-btn-secondary">{currentPose ? t('v2.pose.keep') : t('v2.pose.skip')}</button>
                </div>
              </div>
            )}

            {/* 05 — Your Game (optional, only when never answered) */}
            {step === 'game' && (
              <div className="max-w-3xl">
                <p className="font-display text-3xl font-extrabold uppercase text-chalk">{t('v2.yourGame.title')}</p>
                <p className="mt-2 text-slate-300">{t('v2.yourGame.intro')}</p>
                <div className="mt-6"><YourGameForm value={gameDraft} onChange={setGameDraft} idPrefix="create" /></div>
                <div className="mt-8 flex flex-wrap gap-3">
                  <button onClick={() => continueFromGame(true)} disabled={savingGame} className="v2-btn-primary !px-6 !py-3 font-display uppercase tracking-wider">
                    {savingGame && <Spinner className="h-4 w-4" />} {t('v2.create.generate')} <ArrowRight className="h-4 w-4" aria-hidden />
                  </button>
                  <button onClick={() => continueFromGame(false)} className="v2-btn-secondary">{t('v2.yourGame.skip')}</button>
                </div>
              </div>
            )}

            {/* 06 — generating */}
            {step === 'generating' && (
              <div className="flex items-start gap-4" role="status" aria-live="polite">
                <Spinner className="h-8 w-8 text-vsb-500" />
                <div>
                  <p className="font-display text-2xl font-bold uppercase text-chalk">{t('v2.create.generating')}</p>
                  <p className="mt-1 text-slate-400">{t('v2.create.generatingNote')}</p>
                </div>
              </div>
            )}

            {step === 'done' && (
              <div role="status">
                <p className="vsb-display text-5xl text-chalk sm:text-6xl">{t('v2.create.readyTitle')}</p>
                {avatar?.image && (
                  <img src={avatar.image} alt={t('v2.create.readyAlt', { name: profile.short_name || profile.full_name })}
                    className="mt-6 h-[26rem] w-auto drop-shadow-[0_20px_40px_rgba(0,0,0,0.6)] sm:h-[32rem]" />
                )}
                <div className="mt-6 flex flex-wrap gap-3">
                  <button onClick={() => navigate('/profile')} className="v2-btn-primary !px-6 !py-3 font-display uppercase tracking-wider">{t('v2.create.toMyVsb')} <ArrowRight className="h-4 w-4" aria-hidden /></button>
                  <button onClick={() => navigate('/profile#card')} className="v2-btn-secondary">{t('v2.create.viewCard')}</button>
                </div>
              </div>
            )}

            {step === 'error' && (
              <div className="max-w-xl space-y-5" role="alert">
                <p className="font-display text-2xl font-bold uppercase text-red-300">{t('v2.create.errorTitle')}</p>
                <p className="text-slate-300">{errorMsg}</p>
                <div className="flex flex-wrap gap-3">
                  {canGenerate && cropped && <button onClick={() => setConfirming(true)} className="v2-btn-primary font-display uppercase tracking-wider">{t('v2.create.tryAgain')}</button>}
                  <button onClick={() => { setCropped(null); setStep('upload'); }} className="v2-btn-secondary">{t('v2.create.differentPhoto')}</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Live card preview */}
        <aside className="mx-auto w-full max-w-[24rem]">
          {step === 'done' && <p className="vsb-meta mb-3">{t('v2.create.yourCard')}</p>}
          <PlayerCard
            name={profile.short_name || profile.full_name}
            position={position}
            skill={profile.skill_level}
            games={null}
            tags={[gameDraft.playstyle && t(playstyleKey(gameDraft.playstyle)), gameDraft.game_vibe && t(vibeKey(gameDraft.game_vibe))].filter(Boolean) as string[]}
            artSrc={avatar?.image}
          />
          <p className="mt-3 text-center text-xs text-muted">
            {entitlement?.unlimited ? t('v2.create.unlimited') : entitlement ? t('v2.create.remaining', { count: entitlement.remaining }) : ''}
          </p>
        </aside>
      </div>

      {/* Free-generation confirmation */}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" onClick={() => setConfirming(false)}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="gen-title" aria-describedby="gen-desc" className="w-full max-w-md border border-ink-600 bg-ink-800 p-6" onClick={(e) => e.stopPropagation()}>
            <h2 id="gen-title" className="font-display text-3xl font-extrabold uppercase text-chalk">
              {entitlement?.unlimited ? t('v2.create.confirmTitleAdmin') : isFirst ? t('v2.create.confirmTitleFree') : t('v2.create.confirmTitle')}
            </h2>
            <p id="gen-desc" className="mt-3 text-slate-300">
              {entitlement?.unlimited ? t('v2.create.confirmBodyAdmin') : isFirst ? t('v2.create.confirmBodyFree') : t('v2.create.confirmBody', { count: entitlement?.remaining ?? 0 })}
            </p>
            {avatar && <p className="mt-2 text-sm text-amber-300">{t('v2.create.replaces')}</p>}
            <div className="mt-6 flex gap-3">
              <button onClick={() => setConfirming(false)} className="v2-btn-secondary flex-1">{t('v2.myVsb.cancel')}</button>
              <button onClick={generate} autoFocus className="v2-btn-primary flex-1 font-display uppercase tracking-wider">{t('v2.create.generateNow')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
