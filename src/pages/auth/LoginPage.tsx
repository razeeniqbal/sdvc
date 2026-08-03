import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { phoneToEmail } from '@/lib/auth';
import { useToast } from '@/context/ToastContext';
import { Spinner } from '@/components/LoadingScreen';
import { Zap } from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const { show } = useToast();
  const [loading, setLoading] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!identifier || !password) { show('Please enter your phone number and password', 'error'); return; }
    setLoading(true);
    // Admin/legacy accounts may still use a real email; new accounts are phone-based.
    const email = identifier.includes('@') ? identifier.trim() : phoneToEmail(identifier);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { show(error.message.includes('Invalid login') ? 'Invalid phone number or password' : error.message, 'error'); return; }
    show('Welcome back!', 'success');
    navigate('/sessions');
  }

  const inputClass = 'w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20 outline-none transition-all bg-white/80';

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-orange-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="glass-card rounded-3xl shadow-xl p-6 sm:p-8">
          <div className="text-center mb-6">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-orange-500 text-white mb-3 shadow-lg">
              <Zap className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Welcome Back</h1>
            <p className="text-slate-500 text-sm mt-1">Log in to manage your bookings</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Phone Number</label>
              <input type="text" className={inputClass} placeholder="e.g. 0173364524" value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Password</label>
              <input type="password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white font-bold rounded-xl transition-all disabled:opacity-60 flex items-center justify-center gap-2">
              {loading && <Spinner className="h-5 w-5" />}
              {loading ? 'Logging in...' : 'Log In'}
            </button>
          </form>

          <div className="flex flex-col items-center gap-2 mt-4">
            <Link to="/forgot-password" className="text-sm text-rose-600 font-semibold hover:underline">Forgot password?</Link>
            <p className="text-sm text-slate-500">New here? <Link to="/register" className="text-rose-600 font-semibold hover:underline">Sign Up</Link></p>
          </div>
        </div>
      </div>
    </div>
  );
}
