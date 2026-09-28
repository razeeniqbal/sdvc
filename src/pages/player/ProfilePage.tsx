import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Save } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { friendlyProfileError } from '@/lib/auth';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Spinner } from '@/components/LoadingScreen';
import { PlayerCard, type PlayerCardStats } from '@/components/PlayerCard';
import { PLAYING_POSITIONS, POSITION_KEY, SKILL_LEVELS, SKILL_LEVEL_KEY } from '@/lib/volleyball';
import type { PlayingPosition, SkillLevel } from '@/types/database';

// Stats derived only from the player's own (non-companion) bookings:
//   played   = Confirmed/Completed bookings for sessions already in the past
//   upcoming = Pending/Confirmed bookings for sessions still ahead
// Attendance % is deliberately absent: admins don't record "Attended" today,
// so any percentage would be invented.
async function fetchPlayerStats(userId: string): Promise<PlayerCardStats> {
  const { data } = await supabase
    .from('bookings')
    .select('booking_status, session:sessions(session_date, end_time)')
    .eq('user_id', userId)
    .eq('is_guest', false);
  const now = Date.now();
  let played = 0;
  let upcoming = 0;
  for (const row of (data || []) as unknown as { booking_status: string; session: { session_date: string; end_time: string } | null }[]) {
    if (!row.session) continue;
    const past = new Date(`${row.session.session_date}T${row.session.end_time}`).getTime() < now;
    if (past && ['Confirmed', 'Completed'].includes(row.booking_status)) played++;
    if (!past && ['Confirmed', 'Pending Payment'].includes(row.booking_status)) upcoming++;
  }
  return { played, upcoming };
}

export default function ProfilePage() {
  const { t } = useTranslation();
  const { profile, refreshProfile } = useAuth();
  const { show } = useToast();
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState<PlayerCardStats | null>(null);
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

  useEffect(() => {
    if (profile) fetchPlayerStats(profile.id).then(setStats).catch(() => {});
  }, [profile]);

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
    show(t('profile.profileUpdated'), 'success');
  }

  if (!profile) return null;

  const inputClass = 'v2-input !py-2.5 !text-base';
  const labelClass = 'block text-sm font-medium text-slate-300 mb-1.5';
  const isComplete = !!profile.phone_number && !!profile.gender;
  const displayName = profile.short_name || profile.full_name;

  return (
    <div className="bg-ink">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <h1 className="v2-heading mb-6 text-4xl sm:text-5xl">{t('v2.profile.title')}</h1>

        {!isComplete && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-400" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-amber-200">{t('profile.completeProfile')}</p>
              <p className="mt-0.5 text-sm text-amber-300">{t('profile.completeProfileDesc')}</p>
            </div>
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-[340px_minmax(0,1fr)]">
          {/* Identity */}
          <div className="space-y-4">
            <PlayerCard
              name={displayName}
              position={profile.playing_position}
              skill={profile.skill_level}
              gender={profile.gender}
              joinedAt={profile.created_at}
              stats={stats}
            />
            <p className="text-center text-xs text-muted">{t('v2.profile.cardNote')}</p>
            <div className="flex justify-center gap-4 text-sm">
              <Link to="/bookings" className="font-semibold text-vsb-400 hover:text-vsb-300">{t('nav.myBookings')}</Link>
              <span className={`v2-chip ${profile.role === 'admin' ? 'bg-vsb-900 text-vsb-200' : 'bg-ink-700 text-slate-300'}`}>
                {profile.role === 'admin' ? t('profile.administrator') : t('profile.player')}
              </span>
            </div>
          </div>

          {/* Edit */}
          <div className="space-y-6">
            <section className="v2-surface p-6">
              <h2 className="v2-heading mb-4 text-xl">{t('v2.profile.volleyballProfile')}</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
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

                <button type="submit" disabled={saving} className="v2-btn-primary !px-6 !py-3">
                  {saving ? <Spinner className="h-5 w-5" /> : <Save className="h-5 w-5" aria-hidden />}
                  {saving ? t('profile.saving') : t('profile.saveChanges')}
                </button>
              </form>
            </section>

            <section className="v2-surface p-6">
              <h2 className="v2-heading mb-4 text-xl">{t('profile.changePassword.title')}</h2>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="p-pw" className={labelClass}>{t('profile.changePassword.newPasswordLabel')}</label>
                    <input id="p-pw" type="password" className={inputClass} value={passwordForm.new_password} onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })} />
                  </div>
                  <div>
                    <label htmlFor="p-pw2" className={labelClass}>{t('profile.changePassword.confirmPasswordLabel')}</label>
                    <input id="p-pw2" type="password" className={inputClass} value={passwordForm.confirm_password} onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })} />
                  </div>
                </div>
                <button type="submit" disabled={changingPassword} className="v2-btn-secondary !px-6 !py-3">
                  {changingPassword ? <Spinner className="h-5 w-5" /> : <Save className="h-5 w-5" aria-hidden />}
                  {changingPassword ? t('profile.changePassword.submitting') : t('profile.changePassword.submit')}
                </button>
              </form>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
