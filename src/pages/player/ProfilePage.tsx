import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, ArrowRight, Save } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { friendlyProfileError } from '@/lib/auth';
import { dateParts, formatDateLocale, formatTime } from '@/lib/format';
import { byDateAsc, fetchMyGames, gameState, isUpcoming, playerStats, type MyGame } from '@/lib/myGames';
import { PLAYING_POSITIONS, POSITION_KEY, SKILL_LEVELS, SKILL_LEVEL_KEY } from '@/lib/volleyball';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Spinner } from '@/components/LoadingScreen';
import { PlayerCard } from '@/components/PlayerCard';
import { GameStateLabel } from '@/components/vsb/GameStateLabel';
import { fetchMyEntitlement, useMyAvatar, type Entitlement } from '@/lib/avatars';
import type { PlayingPosition, SkillLevel } from '@/types/database';
import { vsbAssets } from '@/lib/vsbAssets';
import { setShowInCommunity } from '@/lib/community';

// MY VSB — the player's hub. Hierarchy: identity → next game → recent games
// → volleyball profile → account & safety. Profile/account editing is inline
// (Edit / Manage) rather than separate pages or tabs.

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
  const stats = games ? playerStats(games) : null;
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
        <div className="relative grid items-center gap-10 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] xl:gap-16">
          <div className="mx-auto w-full max-w-[20rem] lg:mx-0">
            <PlayerCard name={displayName} position={profile.playing_position} skill={profile.skill_level} gender={profile.gender} stats={stats} artSrc={avatar?.image} />
            {(!avatar || entitlement?.unlimited || (entitlement?.remaining ?? 0) > 0) && (
              <Link to="/profile/player" className={`mt-4 w-full font-display uppercase tracking-wider ${avatar ? 'v2-btn-secondary' : 'v2-btn-primary'}`}>
                {avatar ? t('v2.create.regenerate') : t('v2.landing.createPlayer')} <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            )}
          </div>
          <div>
            <p className="vsb-meta mb-3">{t('v2.myVsb.meta')}</p>
            <h1 id="myvsb-name" className="vsb-display text-5xl sm:text-6xl lg:text-7xl">{displayName}</h1>
            <p className="mt-3 font-display text-2xl font-bold uppercase tracking-wide text-vsb-300">
              {[profile.playing_position && t(POSITION_KEY[profile.playing_position]), profile.skill_level && t(SKILL_LEVEL_KEY[profile.skill_level])].filter(Boolean).join(' · ') || t('v2.myVsb.setPosition')}
            </p>
            <p className="mt-1 text-sm text-muted">{t('v2.myVsb.memberSince', { date: formatDateLocale(profile.created_at, i18n.language, 'medium') })}</p>

            <dl className="mt-8 grid max-w-xl grid-cols-3 gap-6 border-t border-ink-600 pt-6">
              <BigStat label={t('v2.card.games')} value={stats?.played} />
              <BigStat label={t('v2.card.attended')} value={stats?.attended} />
              <BigStat label={t('v2.card.attendance')} value={stats?.attendancePct != null ? `${stats.attendancePct}%` : '-'} />
            </dl>
            <p className="mt-3 max-w-xl text-xs text-muted">{t('v2.myVsb.statsNote')}</p>

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

      <div className="vsb-gutter grid gap-12 py-12 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-16 lg:py-16">
        {/* ===== Next on court ===== */}
        <section aria-labelledby="next-heading">
          <HubHeading id="next-heading" action={<Link to="/bookings" className="hub-link">{t('v2.myVsb.allGames')} <ArrowRight className="h-4 w-4" aria-hidden /></Link>}>{t('v2.myVsb.nextOnCourt')}</HubHeading>
          {games === null ? (
            <div className="py-8"><Spinner className="h-6 w-6 text-vsb-500" /></div>
          ) : next ? (
            <NextGame game={next} lang={i18n.language} />
          ) : games.length === 0 ? (
            <div className="flex items-end gap-6 border-y border-ink-600 pt-6">
              <img src={vsbAssets.states.welcome.sm.src} alt="" width={vsbAssets.states.welcome.sm.width} height={vsbAssets.states.welcome.sm.height}
                loading="lazy" decoding="async" className="h-48 w-auto sm:h-56" />
              <div className="pb-8">
                <p className="font-display text-3xl font-extrabold uppercase leading-none text-chalk">{t('v2.myVsb.welcomeTitle')}</p>
                <p className="mt-2 max-w-sm text-slate-300">{t('v2.myVsb.welcomeBody')}</p>
                <Link to="/sessions" className="v2-btn-primary mt-5 !px-6 font-display uppercase tracking-wider">{t('v2.landing.findGame')} <ArrowRight className="h-4 w-4" aria-hidden /></Link>
              </div>
            </div>
          ) : (
            <div className="border-y border-ink-600 py-8">
              <p className="font-display text-2xl font-bold uppercase text-chalk">{t('v2.myVsb.noUpcoming')}</p>
              <Link to="/sessions" className="mt-3 inline-flex items-center gap-1.5 font-semibold text-vsb-400 hover:text-vsb-300">{t('v2.landing.findGame')} <ArrowRight className="h-4 w-4" aria-hidden /></Link>
            </div>
          )}
          {upcoming.length > 1 && <p className="mt-3 text-sm text-muted">{t('v2.myVsb.moreUpcoming', { count: upcoming.length - 1 })}</p>}
        </section>

        {/* ===== Recent activity ===== */}
        <section aria-labelledby="recent-heading">
          <HubHeading id="recent-heading" action={<Link to="/bookings?view=past" className="hub-link">{t('v2.myVsb.viewAllGames')} <ArrowRight className="h-4 w-4" aria-hidden /></Link>}>{t('v2.myVsb.recent')}</HubHeading>
          {games === null ? null : recent.length === 0 ? (
            <p className="py-6 text-slate-400">{t('v2.myVsb.noRecent')}</p>
          ) : (
            <ol className="divide-y divide-ink-700 border-y border-ink-600">
              {recent.map((g) => {
                const d = dateParts(g.session.session_date, i18n.language);
                return (
                  <li key={g.id}>
                    <Link to={`/bookings/${g.id}`} className="flex items-center gap-4 py-3 hover:bg-ink-850">
                      <span className="w-14 text-center font-display leading-none"><span className="block text-2xl font-extrabold text-chalk">{d.day}</span><span className="text-[11px] font-bold tracking-wider text-muted">{d.month}</span></span>
                      <span className="min-w-0 flex-1 truncate font-semibold text-chalk">{g.session.title}</span>
                      <GameStateLabel state={gameState(g)} />
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>

      {/* ===== Volleyball profile ===== */}
      <section id="profile-section" aria-labelledby="vp-heading" className="vsb-gutter scroll-mt-16 border-t border-ink-600 py-12">
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
          <dl className="grid max-w-5xl grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
            <Fact label={t('profile.displayNameLabel')} value={profile.short_name || profile.full_name} />
            <Fact label={t('profile.fullNameLabel')} value={profile.full_name} />
            <Fact label={t('v2.profile.position')} value={profile.playing_position ? t(POSITION_KEY[profile.playing_position]) : t('v2.profile.notSet')} />
            <Fact label={t('v2.sessions.skillLevel')} value={profile.skill_level ? t(SKILL_LEVEL_KEY[profile.skill_level]) : t('v2.profile.notSet')} />
            <Fact label={t('common.genderLabel')} value={profile.gender === 'Male' ? t('common.genderMale') : profile.gender === 'Female' ? t('common.genderFemale') : t('v2.profile.notSet')} />
          </dl>
        )}
      </section>

      {/* ===== Community visibility ===== */}
      <section id="community" aria-labelledby="community-vis-heading" className="vsb-gutter scroll-mt-16 border-t border-ink-600 py-12">
        <HubHeading id="community-vis-heading">{t('v2.community.visibilityTitle')}</HubHeading>
        <div className="flex max-w-3xl items-start justify-between gap-6">
          <p className="text-slate-300">{t('v2.community.visibilityBody')}</p>
          <button type="button" role="switch" aria-checked={profile.show_in_community} aria-labelledby="community-vis-heading"
            onClick={toggleCommunity} disabled={savingVisibility}
            className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vsb-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ink disabled:opacity-60 ${profile.show_in_community ? 'bg-vsb-600' : 'bg-ink-500'}`}>
            <span className={`inline-block h-5 w-5 rounded-full bg-chalk transition-transform ${profile.show_in_community ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
        <p className="mt-2 text-sm font-semibold text-muted" aria-live="polite">{profile.show_in_community ? t('v2.community.visibleOn') : t('v2.community.visibleOff')}</p>
      </section>

      {/* ===== Account & safety ===== */}
      <section id="settings" aria-labelledby="acct-heading" className="vsb-gutter scroll-mt-16 border-t border-ink-600 py-12">
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
          <dl className="grid max-w-5xl grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3">
            <Fact label={t('profile.phoneNumberLabel')} value={profile.phone_number || t('profile.noPhoneNumber')} />
            <Fact label={t('v2.myVsb.emergencyContact')} value={profile.emergency_contact_name ? `${profile.emergency_contact_name}${profile.emergency_contact_phone ? ` · ${profile.emergency_contact_phone}` : ''}` : t('v2.profile.notSet')} />
            <Fact label={t('v2.myVsb.password')} value="••••••••" />
          </dl>
        )}
      </section>
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

function BigStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col-reverse">
      <dt className="vsb-meta mt-1">{label}</dt>
      <dd className="font-display text-5xl font-extrabold leading-none text-chalk">{value ?? '-'}</dd>
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
          <p className="mt-2 text-slate-300">{formatTime(game.session.start_time)} · {[game.session.venue_name, game.session.court_number].filter(Boolean).join(' · ')}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <GameStateLabel state={pending ? 'awaiting-payment' : 'upcoming'} />
            <span className="inline-flex items-center gap-1 font-display font-bold uppercase tracking-wider text-vsb-400 group-hover:text-vsb-300">{t('v2.myVsb.viewGame')} <ArrowRight className="h-4 w-4" aria-hidden /></span>
          </div>
        </div>
      </div>
    </Link>
  );
}
