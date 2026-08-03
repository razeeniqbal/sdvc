import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { Spinner } from '@/components/LoadingScreen';
import { Zap } from 'lucide-react';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { show } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ short_name: '', phone: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.short_name.trim()) e.short_name = 'Name is required';
    const digits = form.phone.replace(/[^0-9]/g, '');
    if (!digits) e.phone = 'Phone number is required';
    else if (digits.length < 9) e.phone = 'Enter a valid phone number';
    if (!form.password) e.password = 'Password is required';
    else if (form.password.length < 6) e.password = 'Password must be at least 6 characters';
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    setLoading(true);

    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/phone-signup`;
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phone: form.phone, password: form.password, full_name: form.short_name, short_name: form.short_name }),
    });
    const body = await res.json();

    if (!res.ok) {
      setLoading(false);
      show(body.error || 'Failed to create account', 'error');
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email: body.email, password: form.password });
    setLoading(false);
    if (error) { show(error.message, 'error'); return; }

    show('Welcome to Volleyball Sdn Bhd! Complete your profile to book sessions.', 'success');
    navigate('/profile');
  }

  const inputClass = 'w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20 outline-none transition-all bg-white/80';
  const labelClass = 'block text-sm font-medium text-slate-600 mb-1.5';
  const errorClass = 'text-rose-500 text-xs mt-1';

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-orange-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="glass-card rounded-3xl shadow-xl p-6 sm:p-8">
          <div className="text-center mb-6">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-orange-500 text-white mb-3 shadow-lg">
              <Zap className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Join Volleyball Sdn Bhd</h1>
            <p className="text-slate-500 text-sm mt-1">Just your name, phone number, and password — that's it!</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={labelClass}>Your Name</label>
              <input className={inputClass} placeholder="e.g. Mamat" value={form.short_name} onChange={(e) => setForm({ ...form, short_name: e.target.value })} />
              {errors.short_name && <p className={errorClass}>{errors.short_name}</p>}
            </div>
            <div>
              <label className={labelClass}>Phone Number</label>
              <input type="tel" className={inputClass} placeholder="e.g. 0123456789" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              {errors.phone && <p className={errorClass}>{errors.phone}</p>}
            </div>
            <div>
              <label className={labelClass}>Password</label>
              <input type="password" className={inputClass} placeholder="At least 6 characters" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              {errors.password && <p className={errorClass}>{errors.password}</p>}
            </div>
            <div>
              <label className={labelClass}>Confirm Password</label>
              <input type="password" className={inputClass} value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} />
              {errors.confirmPassword && <p className={errorClass}>{errors.confirmPassword}</p>}
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white font-bold rounded-xl transition-all disabled:opacity-60 flex items-center justify-center gap-2">
              {loading && <Spinner className="h-5 w-5" />}
              {loading ? 'Creating...' : 'Start Playing'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-4">
            Already playing? <Link to="/login" className="text-rose-600 font-semibold hover:underline">Log In</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
