import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Save, Repeat } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import type { Session, SessionStatus, SkillLevel } from '@/types/database';
import { SKILL_LEVELS } from '@/lib/volleyball';
import { sessionImage, uploadSessionCover } from '@/lib/sessionMedia';
import { Spinner } from '@/components/LoadingScreen';
import { useConsoleScope } from '@/lib/consoleScope';
import { StarterPicker } from '@/components/admin/StarterPicker';
import { addStarters, type Starter } from '@/lib/starters';

export default function AdminSessionFormPage() {
  const scope = useConsoleScope();
  const [notYours, setNotYours] = useState(false);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { show } = useToast();
  const isEdit = !!id;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showRecurring, setShowRecurring] = useState(false);
  const [starters, setStarters] = useState<Starter[]>([]);

  const [form, setForm] = useState({
    title: '',
    description: '',
    session_date: '',
    start_time: '20:00',
    end_time: '22:00',
    venue_name: '',
    venue_address: '',
    maps_link: '',
    court_number: '',
    cover_image_path: '',
    skill_level: 'Open Level' as SkillLevel,
    price: '20',
    maximum_capacity: '18',
    booking_open_at: '',
    booking_close_at: '',
    cancellation_deadline: '24',
    status: 'Open' as SessionStatus,
    notes: '',
    passkey: '',
  });

  const [recurring, setRecurring] = useState({
    enabled: false,
    endDate: '',
  });

  useEffect(() => {
    (async () => {
      if (id) {
        const { data } = await supabase.from('sessions').select('*').eq('id', id).maybeSingle();
        if (data) {
          const s = data as Session;
          if (scope.ownerId && s.created_by !== scope.ownerId) { setNotYours(true); setLoading(false); return; }
          setForm({
            title: s.title,
            description: s.description || '',
            session_date: s.session_date,
            start_time: s.start_time.slice(0, 5),
            end_time: s.end_time.slice(0, 5),
            venue_name: s.venue_name,
            venue_address: s.venue_address || '',
            maps_link: s.maps_link || '',
            court_number: s.court_number || '',
            cover_image_path: s.cover_image_path || '',
            skill_level: s.skill_level || 'Open Level',
            price: s.price.toString(),
            maximum_capacity: s.maximum_capacity.toString(),
            booking_open_at: s.booking_open_at ? s.booking_open_at.slice(0, 16) : '',
            booking_close_at: s.booking_close_at ? s.booking_close_at.slice(0, 16) : '',
            cancellation_deadline: s.cancellation_deadline ? s.cancellation_deadline.replace(' hours', '') : '24',
            status: s.status,
            notes: s.notes || '',
            passkey: '',
          });
          const { data: pk } = await supabase.from('session_passkeys').select('passkey').eq('session_id', id).maybeSingle();
          if (pk) setForm((f) => ({ ...f, passkey: pk.passkey }));
        }
        setLoading(false);
        return;
      }

      // Prefill new session from the most recently created one, so recurring
      // weekly sessions only need the date changed. Each newly created session
      // becomes the source for the next prefill.
      const lastQuery = supabase.from('sessions').select('*').order('created_at', { ascending: false }).limit(1);
      const { data: last } = await (scope.ownerId ? lastQuery.eq('created_by', scope.ownerId) : lastQuery).maybeSingle();
      if (last) {
        const s = last as Session;
        setForm((f) => ({
          ...f,
          title: s.title,
          description: s.description || '',
          start_time: s.start_time.slice(0, 5),
          end_time: s.end_time.slice(0, 5),
          venue_name: s.venue_name,
          venue_address: s.venue_address || '',
          maps_link: s.maps_link || '',
          court_number: s.court_number || '',
          cover_image_path: s.cover_image_path || '',
          skill_level: s.skill_level || 'Open Level',
          price: s.price.toString(),
          maximum_capacity: s.maximum_capacity.toString(),
          cancellation_deadline: s.cancellation_deadline ? s.cancellation_deadline.replace(' hours', '') : '24',
          notes: s.notes || '',
        }));
      }
      setLoading(false);
    })();
  }, [id, scope.ownerId]);

  // Upserts or clears this session's passkey row to match the form field — a blank
  // field means the session goes back to (or stays) public. Returns the error (if any)
  // instead of swallowing it, since a failure here (e.g. the session_passkeys table
  // migration not having been applied yet) would otherwise look identical to success.
  async function savePasskey(sessionId: string): Promise<string | null> {
    const value = form.passkey.trim();
    const { error } = value
      ? await supabase.from('session_passkeys').upsert({ session_id: sessionId, passkey: value })
      : await supabase.from('session_passkeys').delete().eq('session_id', sessionId);
    return error?.message ?? null;
  }

  const [uploadingCover, setUploadingCover] = useState(false);
  async function handleCover(file: File | undefined) {
    if (!file || !profile) return;
    setUploadingCover(true);
    try {
      const path = await uploadSessionCover(file, { userId: profile.id, isAdmin: profile.role === 'admin' });
      setForm((f) => ({ ...f, cover_image_path: path }));
    } catch (err) {
      show(`Photo upload failed: ${(err as Error).message}`, 'error');
    } finally {
      setUploadingCover(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    const starterFailures: string[] = [];

    const sessionData: Omit<Session, 'id' | 'created_by' | 'created_at' | 'updated_at'> & { created_by?: string } = {
      title: form.title,
      description: form.description || null,
      session_date: form.session_date,
      start_time: form.start_time,
      end_time: form.end_time,
      venue_name: form.venue_name,
      venue_address: form.venue_address || null,
      maps_link: form.maps_link || null,
      court_number: form.court_number || null,
      cover_image_path: form.cover_image_path || null,
      skill_level: form.skill_level,
      price: parseFloat(form.price) || 0,
      maximum_capacity: parseInt(form.maximum_capacity) || 18,
      booking_open_at: form.booking_open_at ? new Date(form.booking_open_at).toISOString() : null,
      booking_close_at: form.booking_close_at ? new Date(form.booking_close_at).toISOString() : null,
      cancellation_deadline: `${form.cancellation_deadline || '24'} hours`,
      status: form.status,
      notes: form.notes || null,
    };

    if (isEdit) {
      const { error } = await supabase.from('sessions').update(sessionData).eq('id', id);
      if (error) { show(error.message, 'error'); setSaving(false); return; }
      const pkError = await savePasskey(id);
      if (pkError) { show(`Session updated, but the passkey failed to save: ${pkError}`, 'error'); setSaving(false); return; }
      show('Session updated', 'success');
    } else {
      sessionData.created_by = profile.id;
      const { data: created, error } = await supabase.from('sessions').insert(sessionData).select().single();
      if (error) { show(error.message, 'error'); setSaving(false); return; }
      const pkError = await savePasskey(created.id);
      if (pkError) { show(`Session created, but the passkey failed to save: ${pkError}`, 'error'); setSaving(false); return; }

      // Starting players: confirmed places with no payment (add_session_starters).
      const starterIds = starters.map((s) => s.id);
      const seat = async (sessionId: string) => {
        try { await addStarters(sessionId, starterIds); } catch (err) { starterFailures.push((err as Error).message); }
      };
      await seat(created.id);

      // Create recurring sessions
      if (recurring.enabled && recurring.endDate) {
        const start = new Date(form.session_date);
        const end = new Date(recurring.endDate);
        const sessions: typeof sessionData[] = [];
        const d = new Date(start);
        d.setDate(d.getDate() + 7);
        while (d <= end) {
          sessions.push({ ...sessionData, session_date: d.toISOString().split('T')[0] });
          d.setDate(d.getDate() + 7);
        }
        if (sessions.length > 0) {
          const { data: recCreated, error: recError } = await supabase.from('sessions').insert(sessions).select();
          if (recError) {
            show(`Main session created, but recurring sessions failed: ${recError.message}`, 'error');
          } else {
            // Recurring instances share the same passkey (or lack of one) as the main session.
            if (form.passkey.trim() && recCreated) {
              await Promise.all(recCreated.map((s: { id: string }) => savePasskey(s.id)));
            }
            // The starting lineup repeats with the session.
            for (const s of (recCreated || []) as { id: string }[]) await seat(s.id);
            show(`Session created with ${sessions.length} recurring sessions`, 'success');
          }
        } else {
          show('Session created', 'success');
        }
      } else {
        show('Session created', 'success');
      }
    }

    if (!isEdit && starterFailures.length > 0) show(`Session saved, but some starting players couldn't be added: ${starterFailures[0]}`, 'error');
    setSaving(false);
    navigate('/admin/sessions');
  }

  if (notYours) {
    return (
      <div className="adm-page">
        <p className="font-display text-2xl font-bold uppercase text-chalk">Session not found</p>
        <p className="mt-1 text-sm text-muted">You can only edit games you created.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spinner className="h-8 w-8 text-vsb-400" />
      </div>
    );
  }

  const inputClass = 'v2-input !py-2.5 !text-base';
  const labelClass = 'block text-sm font-medium text-slate-200 mb-1.5';

  return (
    <div className="adm-page max-w-5xl">
      <Link to="/admin/sessions" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white mb-4">
        <ArrowLeft className="h-4 w-4" />
        Back to sessions
      </Link>

      <p className="adm-label mb-2">Operations / Sessions</p>
      <h1 className="adm-title mb-8">{isEdit ? 'Edit session' : 'Create session'}</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="border-t border-ink-600 py-6 space-y-4">
          <h2 className="font-display text-lg font-bold uppercase tracking-[0.12em] text-chalk">Session Details</h2>

          <div>
            <label className={labelClass}>Session Title *</label>
            <input className={inputClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="e.g. Saturday Social Volleyball" />
          </div>

          <div>
            <label className={labelClass}>Description</label>
            <textarea className={inputClass} rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Brief description of the session" />
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Date *</label>
              <input type="date" className={inputClass} value={form.session_date} onChange={(e) => setForm({ ...form, session_date: e.target.value })} required />
            </div>
            <div>
              <label className={labelClass}>Start Time *</label>
              <input type="time" className={inputClass} value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} required />
            </div>
            <div>
              <label className={labelClass}>End Time *</label>
              <input type="time" className={inputClass} value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} required />
            </div>
          </div>

          <div>
            <label className={labelClass}>Status</label>
            <select className={inputClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as SessionStatus })}>
              <option value="Open">Open</option>
              <option value="Closed">Closed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Passkey (optional)</label>
            <input className={inputClass} value={form.passkey} onChange={(e) => setForm({ ...form, passkey: e.target.value })} placeholder="Leave blank for a public session" />
            <p className="text-xs text-slate-400 mt-1">If set, players must enter this exact passkey before they can register. This makes the session private/invite-only. It's never shown to players anywhere else, so share it directly.</p>
          </div>
        </div>

        <div className="border-t border-ink-600 py-6 space-y-4">
          <h2 className="font-display text-lg font-bold uppercase tracking-[0.12em] text-chalk">Venue Information</h2>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Venue Name *</label>
              <input className={inputClass} value={form.venue_name} onChange={(e) => setForm({ ...form, venue_name: e.target.value })} required placeholder="e.g. Main Sports Complex" />
            </div>
            <div>
              <label className={labelClass}>Court Number</label>
              <input className={inputClass} value={form.court_number} onChange={(e) => setForm({ ...form, court_number: e.target.value })} placeholder="e.g. Court 1" />
            </div>
            <div>
              <label className={labelClass}>Skill Level</label>
              <select className={inputClass} value={form.skill_level} onChange={(e) => setForm({ ...form, skill_level: e.target.value as SkillLevel })}>
                {SKILL_LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}
              </select>
            </div>
          </div>

          <div>
            <span className={labelClass}>Court photo (optional)</span>
            <div className="flex flex-wrap items-end gap-4">
              <img src={sessionImage(form.cover_image_path)} alt={form.cover_image_path ? 'Court photo preview' : 'Default VSB court artwork'} className="h-28 w-48 border border-ink-600 object-cover" />
              <div className="flex flex-wrap gap-2">
                <label className="adm-btn cursor-pointer !py-2">
                  {uploadingCover ? 'Uploading…' : form.cover_image_path ? 'Replace photo' : 'Upload photo'}
                  <input type="file" accept="image/*" className="sr-only" disabled={uploadingCover} onChange={(e) => handleCover(e.target.files?.[0])} />
                </label>
                {form.cover_image_path && (
                  <button type="button" onClick={() => setForm({ ...form, cover_image_path: '' })} className="adm-btn !py-2">Use VSB court art</button>
                )}
              </div>
            </div>
            <p className="mt-1 text-xs text-slate-400">Shown on the session card and page. Without a photo, the VSB court artwork is used.</p>
          </div>

          <div>
            <label className={labelClass}>Venue Address</label>
            <input className={inputClass} value={form.venue_address} onChange={(e) => setForm({ ...form, venue_address: e.target.value })} placeholder="Full address" />
          </div>

          <div>
            <label className={labelClass}>Google Maps Link</label>
            <input className={inputClass} value={form.maps_link} onChange={(e) => setForm({ ...form, maps_link: e.target.value })} placeholder="https://maps.google.com/..." />
          </div>
        </div>

        <div className="border-t border-ink-600 py-6 space-y-4">
          <h2 className="font-display text-lg font-bold uppercase tracking-[0.12em] text-chalk">Pricing & Capacity</h2>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Price per Player (RM) *</label>
              <input type="number" step="0.01" min="0" className={inputClass} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
              <p className="text-xs text-slate-400 mt-1">Set to 0 for TBC (To Be Confirmed). Players can still lock a slot, and you finalize the amount per booking once turnout is known.</p>
            </div>
            <div>
              <label className={labelClass}>Maximum Players *</label>
              <input type="number" min="1" className={inputClass} value={form.maximum_capacity} onChange={(e) => setForm({ ...form, maximum_capacity: e.target.value })} required />
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Booking Opens</label>
              <input type="datetime-local" className={inputClass} value={form.booking_open_at} onChange={(e) => setForm({ ...form, booking_open_at: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>Booking Closes</label>
              <input type="datetime-local" className={inputClass} value={form.booking_close_at} onChange={(e) => setForm({ ...form, booking_close_at: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>Cancellation Deadline (hours)</label>
              <input type="number" className={inputClass} value={form.cancellation_deadline} onChange={(e) => setForm({ ...form, cancellation_deadline: e.target.value })} />
            </div>
          </div>
        </div>

        <div className="border-t border-ink-600 py-6 space-y-4">
          <h2 className="font-display text-lg font-bold uppercase tracking-[0.12em] text-chalk">Notes for Players</h2>
          <textarea className={inputClass} rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Any additional notes visible to players" />
        </div>

        {/* Starting players (create only; later, use the session's Overview) */}
        {!isEdit && (
          <div className="border-t border-ink-600 py-6 space-y-3">
            <h2 className="font-display text-lg font-bold uppercase tracking-[0.12em] text-chalk">Starting players</h2>
            <p className="text-sm text-slate-400">Optional. Members added here get a confirmed place with no payment (core players, coaches, or people who pay you separately). For recurring sessions they're added to every week.</p>
            <StarterPicker value={starters} onChange={setStarters} max={parseInt(form.maximum_capacity) || 18} />
          </div>
        )}

        {/* Recurring sessions */}
        {!isEdit && (
          <div className="border-t border-ink-600 py-6 space-y-4">
            <button type="button" onClick={() => setShowRecurring(!showRecurring)} className="flex items-center gap-2 font-bold text-chalk">
              <Repeat className="h-5 w-5 text-vsb-400" />
              Recurring Sessions
            </button>
            {showRecurring && (
              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={recurring.enabled} onChange={(e) => setRecurring({ ...recurring, enabled: e.target.checked })} className="h-4 w-4 rounded border-ink-500 text-vsb-400 focus:ring-vsb-500" />
                  <span className="text-sm text-slate-300">Repeat weekly on the same day and time</span>
                </label>
                {recurring.enabled && (
                  <div>
                    <label className={labelClass}>End Date</label>
                    <input type="date" className={inputClass} value={recurring.endDate} onChange={(e) => setRecurring({ ...recurring, endDate: e.target.value })} />
                    <p className="text-xs text-slate-400 mt-1">Sessions will be created weekly from the start date until this date.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <Link to="/admin/sessions" className="flex-1 py-3 bg-ink-700 hover:bg-ink-600 text-slate-200 font-bold rounded-md text-center transition-colors">
            Cancel
          </Link>
          <button type="submit" disabled={saving} className="flex-1 py-3 bg-vsb-600 hover:bg-vsb-700 text-white font-semibold rounded-md transition-all disabled:opacity-60 flex items-center justify-center gap-2">
            {saving ? <Spinner className="h-5 w-5" /> : <Save className="h-5 w-5" />}
            {saving ? 'Saving...' : isEdit ? 'Update Session' : 'Create Session'}
          </button>
        </div>
      </form>
    </div>
  );
}
