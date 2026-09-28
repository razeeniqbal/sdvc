import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Outlet, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/context/ToastContext';
import { Navbar, PlayerTabBar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { LoadingScreen } from '@/components/LoadingScreen';
import { ProtectedRoute, AdminRoute } from '@/components/ProtectedRoute';
import { PublicOnlyRoute } from '@/components/PublicOnlyRoute';
import { AdminShell } from '@/components/admin/AdminShell';

const LandingPage = lazy(() => import('@/pages/LandingPage'));
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage'));
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPasswordPage'));

const SessionsPage = lazy(() => import('@/pages/sessions/SessionsPage'));
const SessionDetailsPage = lazy(() => import('@/pages/sessions/SessionDetailsPage'));
const CheckoutPage = lazy(() => import('@/pages/booking/CheckoutPage'));
const BookingConfirmationPage = lazy(() => import('@/pages/booking/BookingConfirmationPage'));

const MyBookingsPage = lazy(() => import('@/pages/player/MyBookingsPage'));
const BookingDetailsPage = lazy(() => import('@/pages/player/BookingDetailsPage'));
const ProfilePage = lazy(() => import('@/pages/player/ProfilePage'));
const CreatePlayerPage = lazy(() => import('@/pages/player/CreatePlayerPage'));
const CommunityPage = lazy(() => import('@/pages/community/CommunityPage'));

const AdminDashboardPage = lazy(() => import('@/pages/admin/AdminDashboardPage'));
const AdminSessionsPage = lazy(() => import('@/pages/admin/AdminSessionsPage'));
const AdminSessionFormPage = lazy(() => import('@/pages/admin/AdminSessionFormPage'));
const AdminSessionLayout = lazy(() => import('@/pages/admin/AdminSessionLayout'));
const AdminSessionOverview = lazy(() => import('@/pages/admin/AdminSessionOverview'));
const AdminSessionBookings = lazy(() => import('@/pages/admin/AdminSessionBookings'));
const AdminBookingsPage = lazy(() => import('@/pages/admin/AdminBookingsPage'));
const AdminAttendancePage = lazy(() => import('@/pages/admin/AdminAttendancePage'));
const AdminWaitingListPage = lazy(() => import('@/pages/admin/AdminWaitingListPage'));
const AdminSettingsPage = lazy(() => import('@/pages/admin/AdminSettingsPage'));
const AdminPaymentsPage = lazy(() => import('@/pages/admin/AdminPaymentsPage'));
const AdminPlayersPage = lazy(() => import('@/pages/admin/AdminPlayersPage'));

// Dev-only design review route; the import is dead-code-eliminated in production builds.
const V2PreviewPage = import.meta.env.DEV ? lazy(() => import('@/pages/dev/V2PreviewPage')) : null;

// VSB Play: public + player screens share the consumer chrome (nav, footer,
// mobile tab bar). VSB Admin gets its own full-height console (AdminShell).
function PlayShell() {
  return (
    <div className="flex min-h-screen flex-col bg-ink">
      <Navbar />
      <main className="flex-1">
        <Suspense fallback={<LoadingScreen />}><Outlet /></Suspense>
      </main>
      <Footer />
      <PlayerTabBar />
    </div>
  );
}

function AdminArea() {
  return (
    <AdminRoute>
      <AdminShell />
    </AdminRoute>
  );
}

const Lazy = ({ children }: { children: ReactNode }) => <Suspense fallback={<LoadingScreen />}>{children}</Suspense>;

// Admin child routes. Mounted under /admin; in dev only, also under
// /__admin-preview without auth so the console layout can be reviewed (data is
// whatever RLS lets a signed-out viewer read — nothing privileged).
function adminRoutes(base: string) {
  return (
    <>
      <Route index element={<Lazy><AdminDashboardPage /></Lazy>} />
      <Route path="sessions" element={<Lazy><AdminSessionsPage /></Lazy>} />
      <Route path="sessions/new" element={<Lazy><AdminSessionFormPage /></Lazy>} />
      <Route path="sessions/:id/edit" element={<Lazy><AdminSessionFormPage /></Lazy>} />
      {/* Session workspace — attendance & waiting list live here, not in global nav */}
      <Route path="sessions/:id" element={<Lazy><AdminSessionLayout /></Lazy>}>
        <Route index element={<Lazy><AdminSessionOverview /></Lazy>} />
        <Route path="bookings" element={<Lazy><AdminSessionBookings /></Lazy>} />
        <Route path="attendance" element={<Lazy><AdminAttendancePage /></Lazy>} />
        <Route path="waiting-list" element={<Lazy><AdminWaitingListPage /></Lazy>} />
      </Route>
      <Route path="bookings" element={<Lazy><AdminBookingsPage /></Lazy>} />
      <Route path="payments" element={<Lazy><AdminPaymentsPage /></Lazy>} />
      <Route path="players" element={<Lazy><AdminPlayersPage /></Lazy>} />
      <Route path="settings" element={<Lazy><AdminSettingsPage /></Lazy>} />
      <Route path="*" element={<Navigate to={base} replace />} />
    </>
  );
}

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* ===== VSB Play ===== */}
            <Route element={<PlayShell />}>
              {/* Public */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/register" element={<PublicOnlyRoute><RegisterPage /></PublicOnlyRoute>} />
              <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
              <Route path="/forgot-password" element={<PublicOnlyRoute><ForgotPasswordPage /></PublicOnlyRoute>} />
              <Route path="/reset-password/:token" element={<ResetPasswordPage />} />

              {/* Player */}
              <Route path="/sessions" element={<ProtectedRoute><SessionsPage /></ProtectedRoute>} />
              <Route path="/sessions/:id" element={<ProtectedRoute><SessionDetailsPage /></ProtectedRoute>} />
              <Route path="/checkout/:sessionId" element={<ProtectedRoute><CheckoutPage /></ProtectedRoute>} />
              <Route path="/confirmation/:bookingId" element={<ProtectedRoute><BookingConfirmationPage /></ProtectedRoute>} />
              <Route path="/bookings" element={<ProtectedRoute><MyBookingsPage /></ProtectedRoute>} />
              <Route path="/bookings/:id" element={<ProtectedRoute><BookingDetailsPage /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
              <Route path="/profile/player" element={<ProtectedRoute><CreatePlayerPage /></ProtectedRoute>} />
              <Route path="/community" element={<ProtectedRoute><CommunityPage /></ProtectedRoute>} />

              {V2PreviewPage && <Route path="/__v2-preview" element={<V2PreviewPage />} />}
            </Route>

            {/* ===== VSB Admin ===== */}
            <Route path="/admin" element={<AdminArea />}>{adminRoutes('/admin')}</Route>
            {import.meta.env.DEV && (
              <Route path="/__admin-preview" element={<AdminShell />}>{adminRoutes('/__admin-preview')}</Route>
            )}
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
