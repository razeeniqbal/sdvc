import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Menu, X, CalendarDays, Ticket, User as UserIcon, LogOut, ShieldCheck, Settings } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { fetchClubSettings } from '@/lib/settings';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import type { ClubSettings } from '@/types/database';

export function Navbar() {
  const { t } = useTranslation();
  const { profile, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<ClubSettings | null>(null);

  useEffect(() => { fetchClubSettings().then(setSettings); }, []);

  const playerLinks = [
    { to: '/sessions', label: t('nav.sessions'), icon: CalendarDays },
    { to: '/bookings', label: t('nav.myBookings'), icon: Ticket },
    { to: '/profile', label: t('nav.profile'), icon: UserIcon },
  ];

  const adminLinks = [
    { to: '/admin', label: 'Dashboard', icon: ShieldCheck },
    { to: '/admin/sessions', label: 'Sessions', icon: CalendarDays },
    { to: '/admin/bookings', label: 'Bookings', icon: Ticket },
    { to: '/admin/settings', label: 'Settings', icon: Settings },
    { to: '/profile', label: 'Profile', icon: UserIcon },
  ];

  const links = isAdmin ? adminLinks : playerLinks;

  function handleSignOut() { signOut(); navigate('/'); }
  const isActive = (path: string) => location.pathname === path || (path !== '/admin' && location.pathname.startsWith(path));

  return (
    <nav className="sticky top-0 z-50 bg-gradient-to-r from-slate-900 via-rose-950 to-slate-900 border-b border-rose-900/30">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex h-16 items-center justify-between">
          <Link to={profile ? '/sessions' : '/'} className="flex items-center gap-2">
            <img src="/logo.jpg" alt="Logo" className="h-9 w-9 rounded-xl object-cover shadow-lg" />
            <span className="text-white font-bold text-base tracking-tight hidden sm:block">
              {settings?.club_name || 'Volleyball Sdn Bhd'}
            </span>
          </Link>

          {profile ? (
            <>
              <div className="hidden md:flex items-center gap-1">
                {links.map((link) => {
                  const Icon = link.icon;
                  return (
                    <Link key={link.to} to={link.to}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive(link.to) ? 'bg-gradient-to-r from-rose-500 to-orange-500 text-white' : 'text-slate-300 hover:text-white hover:bg-white/10'
                      }`}>
                      <Icon className="h-4 w-4" />
                      {link.label}
                    </Link>
                  );
                })}
                <button onClick={handleSignOut} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-white/10 transition-colors">
                  <LogOut className="h-4 w-4" /> {t('nav.signOut')}
                </button>
                <LanguageSwitcher className="ml-1" />
              </div>
              <div className="md:hidden flex items-center gap-2">
                <LanguageSwitcher />
                <button onClick={() => setOpen(!open)} className="text-slate-300 hover:text-white p-2">
                  {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <LanguageSwitcher />
              <Link to="/login" className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors">{t('nav.logIn')}</Link>
              <Link to="/register" className="px-4 py-2 text-sm font-bold text-white bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 rounded-lg transition-all">{t('nav.signUp')}</Link>
            </div>
          )}
        </div>

        {open && profile && (
          <div className="md:hidden pb-4 space-y-1">
            {links.map((link) => {
              const Icon = link.icon;
              return (
                <Link key={link.to} to={link.to} onClick={() => setOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium ${isActive(link.to) ? 'bg-gradient-to-r from-rose-500 to-orange-500 text-white' : 'text-slate-300 hover:bg-white/10'}`}>
                  <Icon className="h-4 w-4" /> {link.label}
                </Link>
              );
            })}
            <button onClick={handleSignOut} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-white/10">
              <LogOut className="h-4 w-4" /> {t('nav.signOut')}
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
