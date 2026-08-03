import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Save, Repeat } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { SKILL_LEVELS, type SkillLevel, type Session, type SessionStatus } from '@/types/database';
import { Spinner } from '@/components/LoadingScreen';

export default function AdminSessionFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { show } = useToast();
  const isEdit = !!id;
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [showRecurring, setShowRecurring] = useState(false);

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
    skill_level: 'Open Level' as SkillLevel,
    price: '20',
    maximum_capacity: '24',
    booking_open_at: '',
    booking_close_at: '',
    cancellation_deadline: '24',
    status: 'Open' as SessionStatus,
    notes: '',
  });

  const [recurring, setRecurring] = useState({
    enabled: false,
    endDate: '',
  });

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data } = await supabase.from('sessions').select('*').eq('id', id).maybeSingle();
      if (data) {
        const s = data as Session;
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
          skill_level: s.skill_level,
          price: s.price.toString(),
          maximum_capacity: s.maximum_capacity.toString(),
          booking_open_at: s.booking_open_at ? s.booking_open_at.slice(0, 16) : '',
          booking_close_at: s.booking_close_at ? s.booking_close_at.slice(0, 16) : '',
          cancellation_deadline: s.cancellation_deadline ? s.cancellation_deadline.replace(' hours', '') : '24',
          status: s.status,
          notes: s.notes || '',
        });
      }
      setLoading(false);
    })();
  }, [id]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);

    const sessionData: any = {
      title: form.title,
      description: form.description || null,
      session_date: form.session_date,
      start_time: form.start_time,
      end_time: form.end_time,
      venue_name: form.venue_name,
      venue_address: form.venue_address || null,
      maps_link: form.maps_link || null,
      court_number: form.court_number || null,
      skill_level: form.skill_level,
      price: parseFloat(form.price) || 0,
      maximum_capacity: parseInt(form.maximum_capacity) || 24,
      booking_open_at: form.booking_open_at ? new Date(form.booking_open_at).toISOString() : null,
      booking_close_at: form.booking_close_at ? new Date(form.booking_close_at).toISOString() : null,
      cancellation_deadline: `${form.cancellation_deadline || '24'} hours`,
      status: form.status,
      notes: form.notes || null,
    };

    if (isEdit) {
      const { error } = await supabase.from('sessions').update(sessionData).eq('id', id);
      if (error) { show(error.message, 'error'); setSaving(false); return; }
      show('Session updated', 'success');
    } else {
      sessionData.created_by = profile.id;
      const { error } = await supabase.from('sessions').insert(sessionData);
      if (error) { show(error.message, 'error'); setSaving(false); return; }

      // Create recurring sessions
      if (recurring.enabled && recurring.endDate) {
        const start = new Date(form.session_date);
        const end = new Date(recurring.endDate);
        const sessions: any[] = [];
        let d = new Date(start);
        d.setDate(d.getDate() + 7);
        while (d <= end) {
          sessions.push({ ...sessionData, session_date: d.toISOString().split('T')[0] });
          d.setDate(d.getDate() + 7);
        }
        if (sessions.length > 0) {
          const { error: recError } = await supabase.from('sessions').insert(sessions);
          if (recError) {
            show(`Main session created, but recurring sessions failed: ${recError.message}`, 'error');
          } else {
            show(`Session created with ${sessions.length} recurring sessions`, 'success');
          }
        } else {
          show('Session created', 'success');
        }
      } else {
        show('Session created', 'success');
      }
    }

    setSaving(false);
    navigate('/admin/sessions');
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spinner className="h-8 w-8 text-orange-500" />
      </div>
    );
  }

  const inputClass = 'w-full rounded-lg border border-slate-300 px-4 py-2.5 text-slate-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-colors';
  const labelClass = 'block text-sm font-medium text-slate-700 mb-1.5';

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <Link to="/admin/sessions" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ArrowLeft className="h-4 w-4" />
        Back to sessions
      </Link>

      <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-6">{isEdit ? 'Edit Session' : 'Create Session'}</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <h2 className="font-bold text-slate-900">Session Details</h2>

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

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Skill Level *</label>
              <select className={inputClass} value={form.skill_level} onChange={(e) => setForm({ ...form, skill_level: e.target.value as SkillLevel })}>
                {SKILL_LEVELS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <select className={inputClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as SessionStatus })}>
                <option value="Open">Open</option>
                <option value="Closed">Closed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <h2 className="font-bold text-slate-900">Venue Information</h2>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Venue Name *</label>
              <input className={inputClass} value={form.venue_name} onChange={(e) => setForm({ ...form, venue_name: e.target.value })} required placeholder="e.g. Main Sports Complex" />
            </div>
            <div>
              <label className={labelClass}>Court Number</label>
              <input className={inputClass} value={form.court_number} onChange={(e) => setForm({ ...form, court_number: e.target.value })} placeholder="e.g. Court 1" />
            </div>
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

        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <h2 className="font-bold text-slate-900">Pricing & Capacity</h2>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Price per Player (RM) *</label>
              <input type="number" step="0.01" min="0" className={inputClass} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
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

        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <h2 className="font-bold text-slate-900">Notes for Players</h2>
          <textarea className={inputClass} rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Any additional notes visible to players" />
        </div>

        {/* Recurring sessions */}
        {!isEdit && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <button type="button" onClick={() => setShowRecurring(!showRecurring)} className="flex items-center gap-2 font-bold text-slate-900">
              <Repeat className="h-5 w-5 text-orange-500" />
              Recurring Sessions
            </button>
            {showRecurring && (
              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={recurring.enabled} onChange={(e) => setRecurring({ ...recurring, enabled: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500" />
                  <span className="text-sm text-slate-700">Repeat weekly on the same day and time</span>
                </label>
                {recurring.enabled && (
                  <div>
                    <label className={labelClass}>End Date</label>
                    <input type="date" className={inputClass} value={recurring.endDate} onChange={(e) => setRecurring({ ...recurring, endDate: e.target.value })} />
                    <p className="text-xs text-slate-500 mt-1">Sessions will be created weekly from the start date until this date.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <Link to="/admin/sessions" className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-center transition-colors">
            Cancel
          </Link>
          <button type="submit" disabled={saving} className="flex-1 py-3 bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white font-bold rounded-xl transition-all disabled:opacity-60 flex items-center justify-center gap-2">
            {saving ? <Spinner className="h-5 w-5" /> : <Save className="h-5 w-5" />}
            {saving ? 'Saving...' : isEdit ? 'Update Session' : 'Create Session'}
          </button>
        </div>
      </form>
    </div>
  );
}
