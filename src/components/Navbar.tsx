import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays, User as UserIcon, Users, LogOut, ChevronDown, ShieldCheck, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { VsbLogo } from '@/components/VsbLogo';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { useMyAvatar } from '@/lib/avatars';

// VSB Play navigation. Primary areas only — routes are not navigation.
//   SESSIONS  ·  COMMUNITY  ·  MY VSB (avatar menu)
// My Games, profile, card and account all live under My VSB; the logo is Home.

interface NavItem { to: string; label: string; icon: LucideIcon; end?: boolean }

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
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMenuOpen(false); }, [location.pathname, location.hash]);

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
  const myAvatar = useMyAvatar(profile?.id);
  const itemClass = 'block px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-ink-700 hover:text-white focus-visible:bg-ink-700 focus-visible:outline-none';

  return (
    <header className="sticky top-0 z-50 border-b border-ink-600 bg-ink/95 backdrop-blur-sm">
      <nav className="vsb-gutter flex h-16 items-center justify-between gap-6" aria-label={t('v2.nav.primaryLabel')}>
        <Link to="/" aria-label={t('nav.home')} className="flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vsb-400">
          <VsbLogo variant="mark" className="h-6 sm:h-7" />
        </Link>

        {profile && (
          <div className="hidden h-full items-center gap-10 md:flex">
            <NavLink to="/sessions" className={topLink}>{t('nav.sessions')}</NavLink>
            <NavLink to="/community" className={topLink}>{t('v2.nav.community')}</NavLink>
            <NavLink to="/profile" className={({ isActive }) => topLink({ isActive: isActive || /^\/(bookings|confirmation)/.test(location.pathname) })}>{t('v2.nav.myVsb')}</NavLink>
          </div>
        )}

        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageSwitcher className="hidden sm:inline-flex" />
          {profile ? (
            <div className="relative" ref={menuRef} onKeyDown={onMenuKey}>
              <button
                onClick={() => setMenuOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label={t('v2.nav.playerMenu', { name: displayName })}
                className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vsb-400"
              >
                <PlayerAvatar name={displayName || '?'} src={myAvatar?.thumb} seed={profile.id} size="sm" />
                <span className="hidden max-w-[10rem] truncate text-sm font-semibold text-chalk lg:block">{displayName}</span>
                <ChevronDown className={`hidden h-4 w-4 text-muted transition-transform sm:block ${menuOpen ? 'rotate-180' : ''}`} aria-hidden />
              </button>
              {menuOpen && (
                <div role="menu" className="animate-pop absolute right-0 mt-2 w-60 origin-top-right border border-ink-600 bg-ink-800 py-2 shadow-2xl shadow-black/50">
                  <Link role="menuitem" to="/profile" className={itemClass}>{t('v2.nav.myVsb')}</Link>
                  <Link role="menuitem" to="/bookings" className={itemClass}>{t('v2.nav.myGames')}</Link>
                  {isAdmin && (
                    <div className="my-2 border-t border-ink-600 pt-2">
                      <Link role="menuitem" to="/admin" className={`${itemClass} flex items-center gap-2`}>
                        <ShieldCheck className="h-4 w-4 text-vsb-400" aria-hidden /> {t('v2.nav.adminConsole')}
                      </Link>
                    </div>
                  )}
                  <div className="mx-4 my-2 flex items-center justify-between border-t border-ink-600 pt-3">
                    <span className="vsb-meta">{t('v2.nav.language')}</span>
                    <LanguageSwitcher />
                  </div>
                  <button role="menuitem" onClick={handleSignOut} className="flex w-full items-center gap-2 border-t border-ink-600 px-4 pb-1 pt-3 text-left text-sm font-semibold text-slate-300 hover:text-white">
                    <LogOut className="h-4 w-4" aria-hidden /> {t('nav.signOut')}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <LanguageSwitcher className="sm:hidden" />
              <Link to="/login" className="whitespace-nowrap px-1 text-sm font-semibold text-slate-300 hover:text-white sm:px-2">{t('nav.logIn')}</Link>
              <Link to="/register" className="v2-btn-primary whitespace-nowrap !px-3 !py-2 text-sm sm:!px-4">{t('nav.signUp')}</Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

// Mobile bottom navigation: the same primary areas, nothing more.
export function PlayerTabBar() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { pathname } = useLocation();
  if (!profile) return null;
  // My Games, bookings and confirmations are part of My VSB.
  const inMyVsb = /^\/(profile|bookings|confirmation)/.test(pathname);

  const links: NavItem[] = [
    { to: '/sessions', label: t('nav.sessions'), icon: CalendarDays },
    { to: '/community', label: t('v2.nav.community'), icon: Users },
    { to: '/profile', label: t('v2.nav.myVsb'), icon: UserIcon },
  ];

  return (
    <>
      {/* In-flow spacer so the fixed bar never covers the footer or page bottom. */}
      <div className="h-16 bg-ink md:hidden" aria-hidden />
      <nav aria-label={t('v2.nav.mobileLabel')} className="fixed inset-x-0 bottom-0 z-50 border-t border-ink-600 bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm md:hidden">
        <div className="grid" style={{ gridTemplateColumns: `repeat(${links.length}, minmax(0, 1fr))` }}>
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <NavLink key={link.to} to={link.to} end={link.end}
                className={({ isActive }) => `relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold uppercase tracking-wider transition-colors ${
                  isActive || (link.to === '/profile' && inMyVsb) ? 'text-chalk before:absolute before:inset-x-10 before:top-0 before:h-0.5 before:bg-vsb-500' : 'text-muted hover:text-chalk'
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
