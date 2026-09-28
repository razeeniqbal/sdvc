import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { LoadingScreen } from '@/components/LoadingScreen';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

// The console: admins, and organizers for their own games.
export function AdminRoute({ children }: { children: ReactNode }) {
  const { session, profile, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!session) return <Navigate to="/login" replace />;
  if (profile?.role !== 'admin' && profile?.role !== 'organizer') return <Navigate to="/sessions" replace />;
  return <>{children}</>;
}

// Club-wide console pages (overview, players, club settings). Organizers go
// to their sessions instead.
export function AdminOnly({ children }: { children: ReactNode }) {
  const { profile, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (profile?.role === 'organizer') return <Navigate to="/admin/sessions" replace />;
  return <>{children}</>;
}

// Organizer-only console pages (payment QR).
export function OrganizerOnly({ children }: { children: ReactNode }) {
  const { profile, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (profile?.role !== 'organizer') return <Navigate to="/admin" replace />;
  return <>{children}</>;
}
