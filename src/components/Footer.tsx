import { Link } from 'react-router-dom';
import { MessageCircle, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { fetchClubSettings } from '@/lib/settings';
import type { ClubSettings } from '@/types/database';

export function Footer() {
  const [settings, setSettings] = useState<ClubSettings | null>(null);
  useEffect(() => { fetchClubSettings().then(setSettings); }, []);

  return (
    <footer className="bg-gradient-to-r from-slate-900 via-rose-950 to-slate-900 border-t border-rose-900/30 mt-auto">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-rose-500 to-orange-500 text-white font-bold">
              <Zap className="h-4 w-4" />
            </div>
            <span className="text-slate-300 font-semibold">{settings?.club_name || 'FunPlay Volleyball'}</span>
          </div>
          {settings?.whatsapp_group_link && (
            <a href={settings.whatsapp_group_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-green-400 hover:text-green-300 transition-colors">
              <MessageCircle className="h-4 w-4" /> Join WhatsApp Group
            </a>
          )}
          <p className="text-slate-500 text-sm text-center sm:text-right">
            &copy; {new Date().getFullYear()} {settings?.club_name || 'FunPlay Volleyball'}
          </p>
        </div>
      </div>
    </footer>
  );
}
