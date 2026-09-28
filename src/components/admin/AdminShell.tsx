import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, CalendarDays, CreditCard, LayoutGrid, LogOut, Menu, QrCode, Settings, Ticket, Users, X, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { VsbLogo } from '@/components/VsbLogo';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { useMyAvatar } from '@/lib/avatars';

// VSB console: the club operations console for admins, and the organizer
// console (own games only) for organizers. Its own full-height application
// shell: no consumer navbar, footer or player tab bar. The waiting list is
// deliberately NOT here; it lives inside a session.

interface Item { to: string; label: string; icon: LucideIcon; end?: boolean }

const GROUPS: { heading?: string; items: Item[] }[] = [
  { items: [{ to: '/admin', label: 'Overview', icon: LayoutGrid, end: true }] },
  {
    heading: 'Operations',
    items: [
      { to: '/admin/sessions', label: 'Sessions', icon: CalendarDays },
      { to: '/admin/bookings', label: 'Bookings', icon: Ticket },
      { to: '/admin/payments', label: 'Payments', icon: CreditCard },
      { to: '/admin/players', label: 'Players', icon: Users },
    ],
  },
  { heading: 'System', items: [{ to: '/admin/settings', label: 'Club Settings', icon: Settings }] },
];

// Organizers: their own games, the money for them, and where players pay.
const ORGANIZER_GROUPS: { heading?: string; items: Item[] }[] = [
  {
    heading: 'My games',
    items: [
      { to: '/admin/sessions', label: 'Sessions', icon: CalendarDays },
      { to: '/admin/bookings', label: 'Bookings', icon: Ticket },
      { to: '/admin/payments', label: 'Payments', icon: CreditCard },
    ],
  },
  { heading: 'Setup', items: [{ to: '/admin/payment-qr', label: 'Payment QR', icon: QrCode }] },
];

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const { isOrganizer } = useAuth();
  return (
    <nav aria-label={isOrganizer ? 'Organizer' : 'Admin'} className="flex-1 space-y-6 overflow-y-auto px-3 py-2">
      {(isOrganizer ? ORGANIZER_GROUPS : GROUPS).map((g, i) => (
        <div key={i}>
          {g.heading && <p className="adm-label mb-2 px-3">{g.heading}</p>}
          <ul className="space-y-0.5">
            {g.items.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    onClick={onNavigate}
                    className={({ isActive }) => `relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vsb-400 ${
                      isActive ? 'bg-ink-700 text-chalk before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:bg-vsb-500' : 'text-slate-400 hover:bg-ink-800 hover:text-chalk'
                    }`}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                    {item.label}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function SidebarFooter({ onNavigate }: { onNavigate?: () => void }) {
  const { profile, signOut, isOrganizer } = useAuth();
  const navigate = useNavigate();
  const name = profile?.short_name || profile?.full_name || 'Admin';
  const avatar = useMyAvatar(profile?.id);
  return (
    <div className="space-y-1 border-t border-ink-600 p-3">
      <Link to="/sessions" onClick={onNavigate} className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold text-slate-400 hover:bg-ink-800 hover:text-chalk">
        <ArrowLeft className="h-4 w-4" aria-hidden /> VSB Play
      </Link>
      <div className="flex items-center gap-3 px-3 pt-2">
        <PlayerAvatar name={name} src={avatar?.thumb} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-chalk">{name}</p>
          <p className="text-xs text-muted">{isOrganizer ? 'Organizer' : 'Administrator'}</p>
        </div>
        <button onClick={() => { signOut(); navigate('/'); }} aria-label="Sign out" className="p-1.5 text-muted hover:text-chalk">
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function Brand() {
  const { isOrganizer } = useAuth();
  return (
    <Link to={isOrganizer ? '/admin/sessions' : '/admin'} className="flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vsb-400">
      <VsbLogo variant="mark" className="h-6" />
      <span className="border-l border-ink-500 pl-3 font-display text-sm font-bold uppercase tracking-[0.25em] text-muted">{isOrganizer ? 'Organizer' : 'Admin'}</span>
    </Link>
  );
}

export function AdminShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { pathname } = useLocation();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { setDrawerOpen(false); }, [pathname]);
  useEffect(() => {
    if (!drawerOpen) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerOpen(false); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [drawerOpen]);

  return (
    <div className="min-h-screen bg-ink-850 text-chalk">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-ink-600 bg-ink lg:flex">
        <div className="flex h-16 items-center px-6"><Brand /></div>
        <NavItems />
        <SidebarFooter />
      </aside>

      {/* Tablet / mobile header */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-ink-600 bg-ink px-4 lg:hidden">
        <Brand />
        <button onClick={() => setDrawerOpen(true)} aria-label="Open admin menu" aria-expanded={drawerOpen} className="p-2 text-slate-300 hover:text-white">
          <Menu className="h-6 w-6" />
        </button>
      </header>

      {/* Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Admin menu">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDrawerOpen(false)} />
          <div className="animate-slide-up absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-ink-600 bg-ink">
            <div className="flex h-14 items-center justify-between px-4">
              <Brand />
              <button ref={closeRef} onClick={() => setDrawerOpen(false)} aria-label="Close admin menu" className="p-2 text-slate-300 hover:text-white">
                <X className="h-6 w-6" />
              </button>
            </div>
            <NavItems onNavigate={() => setDrawerOpen(false)} />
            <SidebarFooter onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <main className="lg:pl-64">
        <Outlet />
      </main>
    </div>
  );
}
