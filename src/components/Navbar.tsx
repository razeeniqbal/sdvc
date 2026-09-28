import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Menu, X, Home, CalendarDays, Ticket, User as UserIcon, LogOut, ShieldCheck, Settings, ChevronDown, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { VsbLogo } from '@/components/VsbLogo';

interface NavItem { to: string; label: string; icon: LucideIcon; end?: boolean }

function usePlayerLinks(): NavItem[] {
  const { t } = useTranslation();
  return [
    { to: '/', label: t('nav.home'), icon: Home, end: true },
    { to: '/sessions', label: t('nav.sessions'), icon: CalendarDays },
    { to: '/bookings', label: t('nav.myBookings'), icon: Ticket },
    { to: '/profile', label: t('nav.profile'), icon: UserIcon },
  ];
}

export function Navbar() {
  const { t } = useTranslation();
  const { profile, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const playerLinks = usePlayerLinks();

  // Admins already have 4 tool links on this row — adding My Bookings/Profile inline
  // there wrapped onto a second line. Those two move into a compact dropdown instead.
  useEffect(() => {
    if (!accountOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [accountOpen]);

  useEffect(() => { setOpen(false); setAccountOpen(false); }, [location.pathname]);

  const adminLinks: NavItem[] = [
    { to: '/admin', label: 'Dashboard', icon: ShieldCheck, end: true },
    { to: '/admin/sessions', label: 'Sessions', icon: CalendarDays },
    { to: '/admin/bookings', label: 'Bookings', icon: Ticket },
    { to: '/admin/settings', label: 'Settings', icon: Settings },
  ];

  const accountLinks: NavItem[] = [
    { to: '/bookings', label: t('nav.myBookings'), icon: Ticket },
    { to: '/profile', label: t('nav.profile'), icon: UserIcon },
  ];

  const links = isAdmin ? adminLinks : playerLinks;

  function handleSignOut() { signOut(); navigate('/'); }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `relative px-3 py-2 text-sm font-semibold transition-colors ${
      isActive ? 'text-white after:absolute after:inset-x-3 after:-bottom-[13px] after:h-0.5 after:bg-vsb-500' : 'text-slate-400 hover:text-white'
    }`;

  return (
    <nav className="sticky top-0 z-50 bg-ink/95 border-b border-ink-600">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex h-14 items-center justify-between gap-4">
          <Link to={profile && isAdmin ? '/admin' : '/'} className="flex items-center rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vsb-400">
            <VsbLogo variant="mark" className="h-6 sm:h-7" />
          </Link>

          {profile ? (
            <>
              <div className="hidden md:flex items-center gap-1">
                {links.map((link) => (
                  <NavLink key={link.to} to={link.to} end={link.end} className={linkClass}>{link.label}</NavLink>
                ))}
                {isAdmin && (
                  <div className="relative" ref={accountRef}>
                    <button
                      onClick={() => setAccountOpen(!accountOpen)}
                      aria-expanded={accountOpen}
                      className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-slate-400 hover:text-white transition-colors"
                    >
                      {profile.short_name || profile.full_name || t('nav.profile')}
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${accountOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {accountOpen && (
                      <div className="absolute right-0 mt-2 w-44 bg-ink-800 border border-ink-600 rounded-lg shadow-lg py-1 z-50">
                        {accountLinks.map((link) => (
                          <Link key={link.to} to={link.to} className="block px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-ink-700">
                            {link.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <span className="mx-2 h-5 w-px bg-ink-600" aria-hidden />
                <LanguageSwitcher />
                <button onClick={handleSignOut} className="ml-1 flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors">
                  <LogOut className="h-4 w-4" /> {t('nav.signOut')}
                </button>
              </div>
              <div className="md:hidden flex items-center gap-1">
                <LanguageSwitcher />
                {isAdmin ? (
                  <button onClick={() => setOpen(!open)} aria-label="Menu" aria-expanded={open} className="text-slate-300 hover:text-white p-2">
                    {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                  </button>
                ) : (
                  <button onClick={handleSignOut} aria-label={t('nav.signOut')} className="text-slate-400 hover:text-white p-2">
                    <LogOut className="h-5 w-5" />
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <LanguageSwitcher />
              <Link to="/login" className="px-3 py-2 text-sm font-semibold text-slate-300 hover:text-white transition-colors">{t('nav.logIn')}</Link>
              <Link to="/register" className="v2-btn-primary !px-4 !py-2 text-sm">{t('nav.signUp')}</Link>
            </div>
          )}
        </div>

        {open && profile && isAdmin && (
          <div className="md:hidden pb-4 space-y-1">
            {[...links, ...accountLinks].map((link) => {
              const Icon = link.icon;
              return (
                <NavLink key={link.to} to={link.to} end={link.end}
                  className={({ isActive }) => `flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium ${isActive ? 'bg-ink-700 text-white' : 'text-slate-300 hover:bg-ink-700'}`}>
                  <Icon className="h-4 w-4" /> {link.label}
                </NavLink>
              );
            })}
            <button onClick={handleSignOut} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-ink-700">
              <LogOut className="h-4 w-4" /> {t('nav.signOut')}
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}

// Bottom tab bar for signed-in players on small screens (PRD §6). Admins keep
// the hamburger menu since their tool links aren't a player journey.
export function PlayerTabBar() {
  const { profile, isAdmin } = useAuth();
  const links = usePlayerLinks();
  if (!profile || isAdmin) return null;

  return (
    <>
    {/* In-flow spacer so the fixed bar never covers the footer or page bottom. */}
    <div className="md:hidden h-16 bg-ink" aria-hidden />
    <nav aria-label="Primary" className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-ink/95 border-t border-ink-600 pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-4">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <NavLink key={link.to} to={link.to} end={link.end}
              className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold transition-colors ${isActive ? 'text-vsb-400' : 'text-slate-400 hover:text-white'}`}>
              <Icon className="h-5 w-5" aria-hidden />
              {link.label}
            </NavLink>
          );
        })}
      </div>
    </nav>
    </>
  );
}
