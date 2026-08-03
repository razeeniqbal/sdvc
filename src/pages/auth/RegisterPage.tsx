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
  const [form, setForm] = useState({ short_name: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.short_name.trim()) e.short_name = 'Name is required';
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email address';
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
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.short_name, short_name: form.short_name } },
    });
    setLoading(false);
    if (error) { show(error.message, 'error'); return; }
    const { data: sessionData } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password });
    if (sessionData.user) {
      await supabase.from('profiles').update({ full_name: form.short_name, short_name: form.short_name }).eq('id', sessionData.user.id);
    }
    show('Welcome to FunPlay! Complete your profile to book sessions.', 'success');
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
            <h1 className="text-2xl font-bold text-slate-900">Join FunPlay</h1>
            <p className="text-slate-500 text-sm mt-1">Just your name, email, and password — that's it!</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={labelClass}>Your Name</label>
              <input className={inputClass} placeholder="e.g. Alex" value={form.short_name} onChange={(e) => setForm({ ...form, short_name: e.target.value })} />
              {errors.short_name && <p className={errorClass}>{errors.short_name}</p>}
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input type="email" className={inputClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              {errors.email && <p className={errorClass}>{errors.email}</p>}
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
