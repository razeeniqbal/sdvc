import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, ArrowRight, Save } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { friendlyProfileError } from '@/lib/auth';
import { dateParts, formatTime } from '@/lib/format';
import { byDateAsc, fetchMyGames, gameState, isUpcoming, playerActivity, type MyGame } from '@/lib/myGames';
import { PLAYING_POSITIONS, POSITION_ABBR, POSITION_KEY, SKILL_LEVELS, SKILL_LEVEL_KEY } from '@/lib/volleyball';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Spinner } from '@/components/LoadingScreen';
import { ListSkeleton } from '@/components/vsb/Skeletons';
import { PlayerCard } from '@/components/PlayerCard';
import { GameStateLabel } from '@/components/vsb/GameStateLabel';
import { fetchMyEntitlement, useMyAvatar, type Entitlement } from '@/lib/avatars';
import type { PlayingPosition, SkillLevel } from '@/types/database';
import { vsbAssets } from '@/lib/vsbAssets';
import { setShowInCommunity } from '@/lib/community';
import { OrganizeSection } from '@/components/vsb/OrganizeSection';
import { YourGameForm } from '@/components/vsb/YourGameForm';
import { experienceKey, hasYourGame, playstyleKey, reasonKey, saveYourGame, vibeKey, yourGameOf, type YourGame } from '@/lib/yourGame';

// MY VSB: the player's hub. Identity first:
//   card + profile facts + REAL activity → next on court | your game (self-
//   described) → recent games → settings (profile, visibility, organize,
//   account) in one quieter band.
// Three kinds of data, never mixed up: profile facts, what the player says
// about their game, and what they have actually done in VSB. No ratings, no
// attendance. Editing is inline rather than separate pages.

export default function ProfilePage() {
  const { t, i18n } = useTranslation();
  const { profile, refreshProfile } = useAuth();
  const { show } = useToast();
  const [games, setGames] = useState<MyGame[] | null>(null);
  const avatar = useMyAvatar(profile?.id);
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingAccount, setEditingAccount] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    short_name: profile?.short_name || profile?.full_name || '',
    full_name: profile?.full_name || '',
    phone_number: profile?.phone_number || '',
    gender: profile?.gender || '',
    playing_position: profile?.playing_position || '',
    skill_level: profile?.skill_level || '',
    emergency_contact_name: profile?.emergency_contact_name || '',
    emergency_contact_phone: profile?.emergency_contact_phone || '',
  });
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ new_password: '', confirm_password: '' });
  const [savingVisibility, setSavingVisibility] = useState(false);
  const [editingGame, setEditingGame] = useState(false);
  const [gameDraft, setGameDraft] = useState<YourGame>(yourGameOf(profile));
  const [savingGame, setSavingGame] = useState(false);

  async function handleSaveGame() {
    if (!profile) return;
    setSavingGame(true);
    try {
      await saveYourGame(profile.id, gameDraft);
      await refreshProfile();
      setEditingGame(false);
      show(t('v2.yourGame.saved'), 'success');
    } catch {
      show(t('v2.yourGame.saveError'), 'error');
    } finally {
      setSavingGame(false);
    }
  }

  async function toggleCommunity() {
    if (!profile) return;
    setSavingVisibility(true);
    try {
      await setShowInCommunity(profile.id, !profile.show_in_community);
      await refreshProfile();
    } catch {
      show(t('v2.community.toggleError'), 'error');
    } finally {
      setSavingVisibility(false);
    }
  }

  useEffect(() => {
    if (profile) fetchMyGames(profile.id).then(setGames).catch(() => setGames([]));
  }, [profile]);
  useEffect(() => { fetchMyEntitlement().then(setEntitlement); }, []);

  // Deep links from older menus (#card, #settings) still land somewhere sensible.
  useEffect(() => {
    if (window.location.hash === '#settings') setEditingAccount(true);
  }, []);

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    if (passwordForm.new_password.length < 6) { show(t('profile.changePassword.errorPasswordLength'), 'error'); return; }
    if (passwordForm.new_password !== passwordForm.confirm_password) { show(t('profile.changePassword.errorPasswordMismatch'), 'error'); return; }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: passwordForm.new_password });
    setChangingPassword(false);
    if (error) { show(error.message, 'error'); return; }
    setPasswordForm({ new_password: '', confirm_password: '' });
    show(t('profile.changePassword.success'), 'success');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    if (!form.gender) {
      show(t('common.errorGenderRequired'), 'error');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      short_name: form.short_name,
      full_name: form.full_name || form.short_name,
      phone_number: form.phone_number,
      gender: form.gender,
      playing_position: form.playing_position || null,
      skill_level: form.skill_level || null,
      emergency_contact_name: form.emergency_contact_name,
      emergency_contact_phone: form.emergency_contact_phone,
    }).eq('id', profile.id);
    setSaving(false);
    if (error) { show(friendlyProfileError(error), 'error'); return; }
    refreshProfile();
    setEditingProfile(false);
    setEditingAccount(false);
    show(t('profile.profileUpdated'), 'success');
  }

  if (!profile) return null;

  const inputClass = 'v2-input !py-2.5 !text-base';
  const labelClass = 'mb-1.5 block text-sm font-medium text-slate-300';
  const isComplete = !!profile.phone_number && !!profile.gender;
  const displayName = profile.short_name || profile.full_name;
  const activity = games ? playerActivity(games) : null;
  const yourGame = yourGameOf(profile);
  const cardTags = [yourGame.playstyle && t(playstyleKey(yourGame.playstyle)), yourGame.game_vibe && t(vibeKey(yourGame.game_vibe))].filter(Boolean) as string[];
  const memberSince = new Intl.DateTimeFormat(i18n.language === 'ms' ? 'ms-MY' : 'en-MY', { month: 'short', year: 'numeric' }).format(new Date(profile.created_at));
  const canGenerate = !avatar || entitlement?.unlimited || (entitlement?.remaining ?? 0) > 0;
  const upcoming = (games || []).filter((g) => !g.is_guest && isUpcoming(g)).sort(byDateAsc);
  const next = upcoming[0];
  const recent = (games || []).filter((g) => !g.is_guest && !isUpcoming(g) && gameState(g) !== 'cancelled').sort(byDateAsc).reverse().slice(0, 4);
  const saveBar = (
    <div className="flex flex-wrap gap-3 pt-2">
      <button type="submit" disabled={saving} className="v2-btn-primary !px-6 font-display uppercase tracking-wider">
        {saving ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" aria-hidden />} {saving ? t('profile.saving') : t('profile.saveChanges')}
      </button>
      <button type="button" onClick={() => { setEditingProfile(false); setEditingAccount(false); }} className="v2-btn-secondary">{t('v2.myVsb.cancel')}</button>
    </div>
  );

  return (
    <div className="bg-ink text-chalk">
      {/* ===== Identity ===== */}
      <section id="card" aria-labelledby="myvsb-name" className="vsb-gutter relative scroll-mt-16 overflow-hidden border-b border-ink-600 py-10 lg:py-16">
        <div className="relative grid items-center gap-10 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,28rem)_minmax(0,1fr)] xl:gap-16">
          <div className="mx-auto w-full max-w-[24rem] lg:mx-0 lg:max-w-none">
            <PlayerCard name={displayName} position={profile.playing_position} skill={profile.skill_level}
              games={activity ? activity.games : null} tags={cardTags} artSrc={avatar?.image} />
            {!avatar ? (
              <Link to="/profile/player" className="v2-btn-primary mt-4 w-full font-display uppercase tracking-wider">
                {t('v2.landing.createPlayer')} <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            ) : (
              <p className="mt-4 text-center text-sm lg:text-left">
                {canGenerate ? (
                  <Link to="/profile/player" className="font-semibold text-slate-300 underline decoration-ink-500 underline-offset-4 hover:text-white">{t('v2.create.regenerate')}</Link>
                ) : (
                  <span className="text-muted">{t('v2.yourGame.regenerateUsed')}</span>
                )}
              </p>
            )}
          </div>
          <div className="relative">
            {/* the player's position, very quietly, behind the hub */}
            <span className="vsb-watermark -top-[0.35em] right-0 hidden lg:block" aria-hidden>{profile.playing_position ? POSITION_ABBR[profile.playing_position] : 'VSB'}</span>
            <p className="vsb-meta relative mb-3">{t('v2.myVsb.meta')}</p>
            <h1 id="myvsb-name" className="vsb-display relative text-5xl sm:text-6xl lg:text-8xl xl:text-9xl">{displayName}</h1>
            <p className="mt-3 font-display text-xl font-bold uppercase tracking-wider text-slate-200">
              {[profile.playing_position ? t(POSITION_KEY[profile.playing_position]) : t('v2.myVsb.noPosition'),
                profile.skill_level ? t(SKILL_LEVEL_KEY[profile.skill_level]) : null].filter(Boolean).join(' · ')}
            </p>
            <p className="vsb-meta mt-2">{t('v2.myVsb.vsbMember', { date: memberSince.toUpperCase() })}</p>

            <dl className="relative mt-10 grid max-w-3xl grid-cols-3 gap-6 border-t border-ink-600 pt-6">
              <BigStat label={t('v2.myVsb.statGames')} value={activity?.games} />
              <BigStat label={t('v2.myVsb.statVenues')} value={activity?.venues} />
              <BigStat label={t('v2.myVsb.statUpcoming')} value={activity?.upcoming} />
            </dl>

            {!isComplete && (
              <div className="mt-6 flex max-w-xl items-start gap-3 border-l-2 border-amber-400 pl-4">
                <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-400" aria-hidden />
                <div>
                  <p className="font-semibold text-amber-200">{t('profile.completeProfile')}</p>
                  <p className="text-sm text-amber-300">{t('profile.completeProfileDesc')}</p>
                  <button onClick={() => { setEditingProfile(true); document.getElementById('profile-section')?.scrollIntoView({ behavior: 'smooth' }); }} className="mt-2 text-sm font-semibold text-vsb-400 hover:text-vsb-300">{t('v2.myVsb.completeNow')} →</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className={`vsb-gutter grid gap-12 py-12 lg:gap-16 lg:py-16 ${editingGame ? '' : 'lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]'}`}>
        {/* ===== Next on court ===== */}
        <section aria-labelledby="next-heading">
          <HubHeading id="next-heading" action={<Link to="/bookings" className="hub-link">{t('v2.myVsb.allGames')} <ArrowRight className="h-4 w-4" aria-hidden /></Link>}>{t('v2.myVsb.nextOnCourt')}</HubHeading>
          {games === null ? (
            <ListSkeleton rows={1} />
          ) : next ? (
            <NextGame game={next} lang={i18n.language} />
          ) : (
            <div className="flex items-end gap-6 border-y border-ink-600">
              {games.length === 0 && (
                <img src={vsbAssets.states.welcome.sm.src} alt="" width={vsbAssets.states.welcome.sm.width} height={vsbAssets.states.welcome.sm.height}
                  loading="lazy" decoding="async" className="mt-6 h-44 w-auto sm:h-52" />
              )}
              <div className="py-8">
                <p className="font-display text-3xl font-extrabold uppercase leading-none text-chalk">{t('v2.myVsb.noUpcoming')}</p>
                <p className="mt-2 max-w-sm text-slate-300">{t('v2.myVsb.nextWaiting')}</p>
                <Link to="/sessions" className="v2-btn-primary mt-5 !px-6 font-display uppercase tracking-wider">{t('v2.landing.findGame')} <ArrowRight className="h-4 w-4" aria-hidden /></Link>
              </div>
            </div>
          )}
          {upcoming.length > 1 && <p className="mt-3 text-sm text-muted">{t('v2.myVsb.moreUpcoming', { count: upcoming.length - 1 })}</p>}
        </section>

        {/* ===== Your Game (self-described, never a rating) ===== */}
        <section id="your-game" aria-labelledby="yg-heading" className="scroll-mt-16">
          <HubHeading id="yg-heading" action={!editingGame && <button onClick={() => { setGameDraft(yourGame); setEditingGame(true); }} className="hub-link">{hasYourGame(yourGame) ? t('v2.yourGame.edit') : t('v2.yourGame.start')} <ArrowRight className="h-4 w-4" aria-hidden /></button>}>
            {t('v2.yourGame.title')}
          </HubHeading>
          {editingGame ? (
            <div className="max-w-4xl">
              <p className="mb-6 text-slate-300">{t('v2.yourGame.intro')}</p>
              <YourGameForm value={gameDraft} onChange={setGameDraft} idPrefix="myvsb" />
              <div className="mt-6 flex flex-wrap gap-3">
                <button type="button" onClick={handleSaveGame} disabled={savingGame} className="v2-btn-primary !px-6 font-display uppercase tracking-wider">
                  {savingGame ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" aria-hidden />} {t('v2.yourGame.save')}
                </button>
                <button type="button" onClick={() => setEditingGame(false)} className="v2-btn-secondary">{t('v2.myVsb.cancel')}</button>
              </div>
            </div>
          ) : hasYourGame(yourGame) ? (
            <dl className="divide-y divide-ink-700 border-y border-ink-600">
              {yourGame.playstyle && <GameRow label={t('v2.yourGame.label.playstyle')} value={t(playstyleKey(yourGame.playstyle))} />}
              {yourGame.game_vibe && <GameRow label={t('v2.yourGame.label.vibe')} value={t(vibeKey(yourGame.game_vibe))} />}
              {yourGame.experience_range && <GameRow label={t('v2.yourGame.label.experience')} value={t(experienceKey(yourGame.experience_range))} />}
              {yourGame.play_reasons.length > 0 && <GameRow label={t('v2.yourGame.label.reasons')} value={yourGame.play_reasons.map((r) => t(reasonKey(r))).join(' · ')} />}
            </dl>
          ) : (
            <p className="border-y border-ink-600 py-8 text-slate-300">{t('v2.yourGame.empty')}</p>
          )}
        </section>
      </div>

      {/* ===== Recent games: real history ===== */}
      <section aria-labelledby="recent-heading" className="vsb-gutter pb-14 lg:pb-20">
        <HubHeading id="recent-heading" action={recent.length > 0 && <Link to="/bookings?view=past" className="hub-link">{t('v2.myVsb.viewAllGames')} <ArrowRight className="h-4 w-4" aria-hidden /></Link>}>{t('v2.myVsb.recent')}</HubHeading>
        {games === null ? <ListSkeleton rows={3} /> : recent.length === 0 ? (
          <p className="border-y border-ink-600 py-8 font-display text-2xl font-bold uppercase tracking-wide text-slate-300">{t('v2.myVsb.storyStarts')}</p>
        ) : (
          <ol className="divide-y divide-ink-700 border-y border-ink-600">
            {recent.map((g) => {
              const d = dateParts(g.session.session_date, i18n.language);
              return (
                <li key={g.id}>
                  <Link to={`/bookings/${g.id}`} className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-4 py-4 hover:bg-ink-850 sm:grid-cols-[4.5rem_minmax(0,1fr)_minmax(0,16rem)_8rem]">
                    <span className="text-center font-display leading-none"><span className="block text-3xl font-extrabold text-chalk">{d.day}</span><span className="text-xs font-bold tracking-wider text-muted">{d.month}</span></span>
                    <span className="min-w-0 truncate font-display text-xl font-bold uppercase tracking-wide text-chalk">{g.session.title}</span>
                    <span className="hidden truncate text-sm text-muted sm:block">{g.session.venue_name}</span>
                    <span className="justify-self-end"><GameStateLabel state={gameState(g)} /></span>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/* ===== Settings: the quieter half of My VSB ===== */}
      <div className="border-t border-ink-600 bg-ink-850">
      <div className="vsb-gutter grid gap-x-16 lg:grid-cols-2">
      <p className="vsb-meta pt-10 lg:col-span-2">{t('v2.myVsb.settings')}</p>
      {/* ===== Volleyball profile ===== */}
      <section id="profile-section" aria-labelledby="vp-heading" className="scroll-mt-16 border-t border-ink-600 py-10">
        <HubHeading id="vp-heading" action={!editingProfile && <button onClick={() => { setEditingProfile(true); setEditingAccount(false); }} className="hub-link">{t('v2.myVsb.edit')} <ArrowRight className="h-4 w-4" aria-hidden /></button>}>
          {t('v2.profile.volleyballProfile')}
        </HubHeading>
        {editingProfile ? (
          <form onSubmit={handleSubmit} className="max-w-4xl space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="p-short" className={labelClass}>{t('profile.displayNameLabel')}</label>
                <input id="p-short" className={inputClass} value={form.short_name} onChange={(e) => setForm({ ...form, short_name: e.target.value })} required />
              </div>
              <div>
                <label htmlFor="p-full" className={labelClass}>{t('profile.fullNameLabel')}</label>
                <input id="p-full" className={inputClass} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="p-pos" className={labelClass}>{t('v2.profile.position')}</label>
                <select id="p-pos" className={inputClass} value={form.playing_position} onChange={(e) => setForm({ ...form, playing_position: e.target.value as PlayingPosition })}>
                  <option value="">{t('v2.profile.notSet')}</option>
                  {PLAYING_POSITIONS.map((p) => <option key={p} value={p}>{t(POSITION_KEY[p])}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="p-skill" className={labelClass}>{t('v2.sessions.skillLevel')}</label>
                <select id="p-skill" className={inputClass} value={form.skill_level} onChange={(e) => setForm({ ...form, skill_level: e.target.value as SkillLevel })}>
                  <option value="">{t('v2.profile.notSet')}</option>
                  {SKILL_LEVELS.map((l) => <option key={l} value={l}>{t(SKILL_LEVEL_KEY[l])}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="p-gender" className={labelClass}>{t('common.genderLabel')}</label>
                <select id="p-gender" className={inputClass} value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} required>
                  <option value="" disabled>{t('common.genderSelectPlaceholder')}</option>
                  <option value="Male">{t('common.genderMale')}</option>
                  <option value="Female">{t('common.genderFemale')}</option>
                </select>
              </div>
            </div>
            {saveBar}
          </form>
        ) : (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3">
            <Fact label={t('profile.displayNameLabel')} value={profile.short_name || profile.full_name} />
            <Fact label={t('profile.fullNameLabel')} value={profile.full_name} />
            <Fact label={t('v2.profile.position')} value={profile.playing_position ? t(POSITION_KEY[profile.playing_position]) : t('v2.profile.notSet')} />
            <Fact label={t('v2.sessions.skillLevel')} value={profile.skill_level ? t(SKILL_LEVEL_KEY[profile.skill_level]) : t('v2.profile.notSet')} />
            <Fact label={t('common.genderLabel')} value={profile.gender === 'Male' ? t('common.genderMale') : profile.gender === 'Female' ? t('common.genderFemale') : t('v2.profile.notSet')} />
          </dl>
        )}
      </section>

      {/* ===== Community visibility ===== */}
      <section id="community" aria-labelledby="community-vis-heading" className="scroll-mt-16 border-t border-ink-600 py-10">
        <HubHeading id="community-vis-heading">{t('v2.community.visibilityTitle')}</HubHeading>
        <div className="flex items-start justify-between gap-6">
          <p className="text-slate-300">{t('v2.community.visibilityBody')}</p>
          <button type="button" role="switch" aria-checked={profile.show_in_community} aria-labelledby="community-vis-heading"
            onClick={toggleCommunity} disabled={savingVisibility}
            className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vsb-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ink disabled:opacity-60 ${profile.show_in_community ? 'bg-vsb-600' : 'bg-ink-500'}`}>
            <span className={`inline-block h-5 w-5 rounded-full bg-chalk transition-transform ${profile.show_in_community ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
        <p className="mt-2 text-sm font-semibold text-muted" aria-live="polite">{profile.show_in_community ? t('v2.community.visibleOn') : t('v2.community.visibleOff')}</p>
      </section>

      {/* ===== Organize games ===== */}
      <OrganizeSection bare />

      {/* ===== Account & safety ===== */}
      <section id="settings" aria-labelledby="acct-heading" className="scroll-mt-16 border-t border-ink-600 py-10">
        <HubHeading id="acct-heading" action={!editingAccount && <button onClick={() => { setEditingAccount(true); setEditingProfile(false); }} className="hub-link">{t('v2.myVsb.manage')} <ArrowRight className="h-4 w-4" aria-hidden /></button>}>
          {t('v2.myVsb.account')}
        </HubHeading>
        {editingAccount ? (
          <div className="max-w-4xl space-y-10">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="p-phone" className={labelClass}>{t('profile.phoneNumberLabel')}</label>
                  <input id="p-phone" className={inputClass} value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} required />
                </div>
                <div>
                  <label htmlFor="p-ecn" className={labelClass}>{t('profile.emergencyContactNameLabel')}</label>
                  <input id="p-ecn" className={inputClass} value={form.emergency_contact_name} onChange={(e) => setForm({ ...form, emergency_contact_name: e.target.value })} />
                </div>
                <div>
                  <label htmlFor="p-ecp" className={labelClass}>{t('profile.emergencyContactPhoneLabel')}</label>
                  <input id="p-ecp" className={inputClass} value={form.emergency_contact_phone} onChange={(e) => setForm({ ...form, emergency_contact_phone: e.target.value })} />
                </div>
              </div>
              {saveBar}
            </form>
            <form onSubmit={handleChangePassword} className="space-y-4 border-t border-ink-600 pt-8">
              <h3 className="vsb-meta">{t('profile.changePassword.title')}</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="p-pw" className={labelClass}>{t('profile.changePassword.newPasswordLabel')}</label>
                  <input id="p-pw" type="password" autoComplete="new-password" className={inputClass} value={passwordForm.new_password} onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })} />
                </div>
                <div>
                  <label htmlFor="p-pw2" className={labelClass}>{t('profile.changePassword.confirmPasswordLabel')}</label>
                  <input id="p-pw2" type="password" autoComplete="new-password" className={inputClass} value={passwordForm.confirm_password} onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })} />
                </div>
              </div>
              <button type="submit" disabled={changingPassword} className="v2-btn-secondary">
                {changingPassword && <Spinner className="h-4 w-4" />}
                {changingPassword ? t('profile.changePassword.submitting') : t('profile.changePassword.submit')}
              </button>
            </form>
          </div>
        ) : (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-6">
            <Fact label={t('profile.phoneNumberLabel')} value={profile.phone_number || t('profile.noPhoneNumber')} />
            <Fact label={t('v2.myVsb.emergencyContact')} value={profile.emergency_contact_name ? `${profile.emergency_contact_name}${profile.emergency_contact_phone ? ` · ${profile.emergency_contact_phone}` : ''}` : t('v2.profile.notSet')} />
            <Fact label={t('v2.myVsb.password')} value="••••••••" />
          </dl>
        )}
      </section>
      </div>
      </div>
    </div>
  );
}

function HubHeading({ id, children, action }: { id: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <h2 id={id} className="vsb-display text-3xl sm:text-4xl">{children}</h2>
      {action}
    </div>
  );
}

function GameRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[8rem_minmax(0,1fr)] items-baseline gap-4 py-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
      <dt className="vsb-meta">{label}</dt>
      <dd className="font-display text-xl font-bold uppercase tracking-wide text-chalk">{value}</dd>
    </div>
  );
}

function BigStat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="flex flex-col-reverse">
      <dt className="vsb-meta mt-1">{label}</dt>
      <dd className="font-display text-6xl font-extrabold leading-none text-chalk">{typeof value === 'number' ? String(value).padStart(2, '0') : '-'}</dd>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="vsb-meta mb-1">{label}</dt>
      <dd className="truncate text-lg font-semibold text-chalk">{value}</dd>
    </div>
  );
}

function NextGame({ game, lang }: { game: MyGame; lang: string }) {
  const { t } = useTranslation();
  const d = dateParts(game.session.session_date, lang);
  const pending = game.booking_status === 'Pending Payment';
  return (
    <Link to={`/bookings/${game.id}`} className="group relative block overflow-hidden border border-ink-600 transition-colors hover:border-vsb-500">
      <img src={vsbAssets.court.horizontal1024.src} alt="" width={1024} height={356} className="absolute inset-0 h-full w-full object-cover opacity-30" />
      <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/80 to-ink/30" aria-hidden />
      <div className="relative flex items-end gap-6 p-6">
        <p className="font-display uppercase leading-none" aria-hidden>
          <span className="block text-sm font-bold tracking-[0.2em] text-vsb-300">{d.weekday}</span>
          <span className="block text-7xl font-extrabold text-chalk">{d.day}</span>
          <span className="block text-sm font-bold tracking-[0.2em] text-chalk">{d.month}</span>
        </p>
        <div className="min-w-0 flex-1 pb-1">
          <p className="font-display text-3xl font-extrabold uppercase leading-none tracking-wide text-chalk">{game.session.title}</p>
          <p className="mt-2 text-slate-300">{[game.session.venue_name, game.session.court_number].filter(Boolean).join(' · ')}</p>
          <p className="text-slate-400">{t('v2.session.timeRange', { start: formatTime(game.session.start_time), end: formatTime(game.session.end_time) })}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <GameStateLabel state={pending ? 'awaiting-payment' : 'upcoming'} />
            <span className="inline-flex items-center gap-1 font-display font-bold uppercase tracking-wider text-vsb-400 group-hover:text-vsb-300">{t('v2.myVsb.viewGame')} <ArrowRight className="h-4 w-4" aria-hidden /></span>
          </div>
        </div>
      </div>
    </Link>
  );
}
