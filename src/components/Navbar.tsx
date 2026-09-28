import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Menu, X, Home, CalendarDays, Ticket, User as UserIcon, LogOut, ChevronDown, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { VsbLogo } from '@/components/VsbLogo';
import { PlayerAvatar } from '@/components/PlayerAvatar';

interface NavItem { to: string; label: string; icon: LucideIcon; end?: boolean }

// Primary player destinations. Community joins this list once that page exists
// (it needs a player-visibility setting the current schema doesn't have).
function usePrimaryLinks(): NavItem[] {
  const { t } = useTranslation();
  return [
    { to: '/', label: t('nav.home'), icon: Home, end: true },
    { to: '/sessions', label: t('nav.sessions'), icon: CalendarDays },
  ];
}

const topLink = ({ isActive }: { isActive: boolean }) =>
  `relative flex h-full items-center px-1 text-sm font-semibold uppercase tracking-[0.14em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vsb-400 ${
    isActive ? 'text-chalk after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-vsb-500' : 'text-muted hover:text-chalk'
  }`;

export function Navbar() {
  const { t } = useTranslation();
  const { profile, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [adminMobileOpen, setAdminMobileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const primary = usePrimaryLinks();
  const inAdmin = location.pathname.startsWith('/admin');

  useEffect(() => { setMenuOpen(false); setAdminMobileOpen(false); }, [location.pathname, location.hash]);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  function handleSignOut() { signOut(); navigate('/'); }

  function onMenuKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') { setMenuOpen(false); (menuRef.current?.querySelector('button') as HTMLButtonElement | null)?.focus(); }
  }

  const displayName = profile?.short_name || profile?.full_name || '';

  const adminLinks: NavItem[] = [
    { to: '/admin', label: 'Dashboard', icon: Home, end: true },
    { to: '/admin/sessions', label: 'Sessions', icon: CalendarDays },
    { to: '/admin/bookings', label: 'Bookings', icon: Ticket },
    { to: '/admin/settings', label: 'Settings', icon: UserIcon },
  ];
  // Admins see their tools in the centre while inside /admin, and the player
  // site otherwise (they're players too).
  const centre = isAdmin && inAdmin ? adminLinks : primary;

  const playerMenu = [
    { to: '/profile', label: t('v2.nav.myVsb') },
    { to: '/profile#card', label: t('v2.nav.myPlayerCard') },
    { to: '/bookings', label: t('v2.nav.myGames') },
    { to: '/profile#settings', label: t('v2.nav.profileSettings') },
    ...(isAdmin ? [{ to: inAdmin ? '/' : '/admin', label: inAdmin ? t('v2.nav.playerSite') : t('v2.nav.adminTools') }] : []),
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-ink-600 bg-ink/95 backdrop-blur-sm">
      <nav className="vsb-gutter flex h-16 items-center justify-between gap-6" aria-label={t('v2.nav.primaryLabel')}>
        <Link to={isAdmin && inAdmin ? '/admin' : '/'} className="flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vsb-400">
          <VsbLogo variant="mark" className="h-6 sm:h-7" />
        </Link>

        {profile && (
          <div className="hidden h-full items-center gap-8 md:flex">
            {centre.map((l) => <NavLink key={l.to} to={l.to} end={l.end} className={topLink}>{l.label}</NavLink>)}
          </div>
        )}

        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageSwitcher className="hidden sm:inline-flex" />
          {profile ? (
            <>
              <div className="relative" ref={menuRef} onKeyDown={onMenuKey}>
                <button
                  onClick={() => setMenuOpen((o) => !o)}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  aria-label={t('v2.nav.playerMenu', { name: displayName })}
                  className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vsb-400"
                >
                  <PlayerAvatar name={displayName || '?'} size="sm" />
                  <span className="hidden max-w-[10rem] truncate text-sm font-semibold text-chalk lg:block">{displayName}</span>
                  <ChevronDown className={`hidden h-4 w-4 text-muted transition-transform sm:block ${menuOpen ? 'rotate-180' : ''}`} aria-hidden />
                </button>
                {menuOpen && (
                  <div role="menu" className="animate-pop absolute right-0 mt-2 w-60 origin-top-right border border-ink-600 bg-ink-800 py-2 shadow-2xl shadow-black/50">
                    <p className="px-4 pb-2 pt-1 text-xs text-muted">{t('v2.nav.signedInAs')} <span className="font-semibold text-chalk">{displayName}</span></p>
                    {playerMenu.map((item) => (
                      <Link key={item.to} to={item.to} role="menuitem" className="block px-4 py-2 text-sm text-slate-200 hover:bg-ink-700 hover:text-white focus-visible:bg-ink-700 focus-visible:outline-none">
                        {item.label}
                      </Link>
                    ))}
                    <div className="mx-4 my-2 border-t border-ink-600 pt-3 sm:hidden">
                      <p className="vsb-meta mb-2">{t('v2.nav.language')}</p>
                      <LanguageSwitcher />
                    </div>
                    <button role="menuitem" onClick={handleSignOut} className="mt-1 flex w-full items-center gap-2 border-t border-ink-600 px-4 pt-3 pb-1 text-left text-sm text-slate-300 hover:text-white">
                      <LogOut className="h-4 w-4" aria-hidden /> {t('nav.signOut')}
                    </button>
                  </div>
                )}
              </div>
              {isAdmin && inAdmin && (
                <button onClick={() => setAdminMobileOpen((o) => !o)} aria-label="Menu" aria-expanded={adminMobileOpen} className="p-2 text-slate-300 hover:text-white md:hidden">
                  {adminMobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                </button>
              )}
            </>
          ) : (
            <>
              <LanguageSwitcher className="sm:hidden" />
              <Link to="/login" className="whitespace-nowrap px-1 text-sm font-semibold text-slate-300 hover:text-white sm:px-2">{t('nav.logIn')}</Link>
              <Link to="/register" className="v2-btn-primary whitespace-nowrap !px-3 !py-2 text-sm sm:!px-4">{t('nav.signUp')}</Link>
            </>
          )}
        </div>
      </nav>

      {adminMobileOpen && isAdmin && inAdmin && (
        <div className="vsb-gutter space-y-1 border-t border-ink-600 pb-4 pt-2 md:hidden">
          {adminLinks.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end}
              className={({ isActive }) => `block px-3 py-2.5 text-sm font-medium ${isActive ? 'bg-ink-700 text-white' : 'text-slate-300 hover:bg-ink-700'}`}>
              {l.label}
            </NavLink>
          ))}
        </div>
      )}
    </header>
  );
}

// Player bottom navigation on small screens. Not shown inside /admin.
export function PlayerTabBar() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { pathname } = useLocation();
  if (!profile || pathname.startsWith('/admin')) return null;

  const links: NavItem[] = [
    { to: '/', label: t('nav.home'), icon: Home, end: true },
    { to: '/sessions', label: t('nav.sessions'), icon: CalendarDays },
    { to: '/bookings', label: t('v2.nav.myGames'), icon: Ticket },
    { to: '/profile', label: t('nav.profile'), icon: UserIcon },
  ];

  return (
    <>
      {/* In-flow spacer so the fixed bar never covers the footer or page bottom. */}
      <div className="h-16 bg-ink md:hidden" aria-hidden />
      <nav aria-label={t('v2.nav.mobileLabel')} className="fixed inset-x-0 bottom-0 z-50 border-t border-ink-600 bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm md:hidden">
        <div className="grid grid-cols-4">
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <NavLink key={link.to} to={link.to} end={link.end}
                className={({ isActive }) => `relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold uppercase tracking-wider transition-colors ${
                  isActive ? 'text-chalk before:absolute before:inset-x-6 before:top-0 before:h-0.5 before:bg-vsb-500' : 'text-muted hover:text-chalk'
                }`}>
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
