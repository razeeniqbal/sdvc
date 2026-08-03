import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchClubSettings, whatsappLink } from '@/lib/settings';
import type { ClubSettings } from '@/types/database';
import { Zap, MessageCircle } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [settings, setSettings] = useState<ClubSettings | null>(null);

  useEffect(() => { fetchClubSettings().then(setSettings); }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-orange-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="glass-card rounded-3xl shadow-xl p-6 sm:p-8">
          <div className="text-center mb-6">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-orange-500 text-white mb-3 shadow-lg">
              <Zap className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Forgot Password</h1>
            <p className="text-slate-500 text-sm mt-1">
              Since accounts use a phone number instead of email, password resets are handled by the club admin.
            </p>
          </div>

          <a
            href={whatsappLink(settings?.contact_whatsapp || '0137441727', 'Hi, I forgot my password for my Volleyball Sdn Bhd account. Can you help me reset it?')}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition-colors"
          >
            <MessageCircle className="h-5 w-5" />
            Message Admin on WhatsApp
          </a>

          <p className="text-center text-sm text-slate-500 mt-4">
            <Link to="/login" className="text-rose-600 font-semibold hover:underline">Back to Login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
