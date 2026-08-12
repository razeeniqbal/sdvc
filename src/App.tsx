import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/context/ToastContext';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { LoadingScreen } from '@/components/LoadingScreen';
import { ProtectedRoute, AdminRoute } from '@/components/ProtectedRoute';
import { PublicOnlyRoute } from '@/components/PublicOnlyRoute';

const LandingPage = lazy(() => import('@/pages/LandingPage'));
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage'));
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage'));

const SessionsPage = lazy(() => import('@/pages/sessions/SessionsPage'));
const SessionDetailsPage = lazy(() => import('@/pages/sessions/SessionDetailsPage'));
const CheckoutPage = lazy(() => import('@/pages/booking/CheckoutPage'));
const BookingConfirmationPage = lazy(() => import('@/pages/booking/BookingConfirmationPage'));

const MyBookingsPage = lazy(() => import('@/pages/player/MyBookingsPage'));
const BookingDetailsPage = lazy(() => import('@/pages/player/BookingDetailsPage'));
const ProfilePage = lazy(() => import('@/pages/player/ProfilePage'));

const AdminDashboardPage = lazy(() => import('@/pages/admin/AdminDashboardPage'));
const AdminSessionsPage = lazy(() => import('@/pages/admin/AdminSessionsPage'));
const AdminSessionFormPage = lazy(() => import('@/pages/admin/AdminSessionFormPage'));
const AdminBookingsPage = lazy(() => import('@/pages/admin/AdminBookingsPage'));
const AdminAttendancePage = lazy(() => import('@/pages/admin/AdminAttendancePage'));
const AdminWaitingListPage = lazy(() => import('@/pages/admin/AdminWaitingListPage'));
const AdminSettingsPage = lazy(() => import('@/pages/admin/AdminSettingsPage'));

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <div className="min-h-screen flex flex-col bg-slate-50">
            <Navbar />
            <main className="flex-1">
              <Suspense fallback={<LoadingScreen />}>
                <Routes>
                  <Route path="/" element={<LandingPage />} />

                  <Route path="/register" element={<PublicOnlyRoute><RegisterPage /></PublicOnlyRoute>} />
                  <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
                  <Route path="/forgot-password" element={<PublicOnlyRoute><ForgotPasswordPage /></PublicOnlyRoute>} />

                  <Route path="/sessions" element={<ProtectedRoute><SessionsPage /></ProtectedRoute>} />
                  <Route path="/sessions/:id" element={<ProtectedRoute><SessionDetailsPage /></ProtectedRoute>} />
                  <Route path="/checkout/:sessionId" element={<ProtectedRoute><CheckoutPage /></ProtectedRoute>} />
                  <Route path="/confirmation/:bookingId" element={<ProtectedRoute><BookingConfirmationPage /></ProtectedRoute>} />

                  <Route path="/bookings" element={<ProtectedRoute><MyBookingsPage /></ProtectedRoute>} />
                  <Route path="/bookings/:id" element={<ProtectedRoute><BookingDetailsPage /></ProtectedRoute>} />
                  <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />

                  <Route path="/admin" element={<AdminRoute><AdminDashboardPage /></AdminRoute>} />
                  <Route path="/admin/sessions" element={<AdminRoute><AdminSessionsPage /></AdminRoute>} />
                  <Route path="/admin/sessions/new" element={<AdminRoute><AdminSessionFormPage /></AdminRoute>} />
                  <Route path="/admin/sessions/:id/edit" element={<AdminRoute><AdminSessionFormPage /></AdminRoute>} />
                  <Route path="/admin/bookings" element={<AdminRoute><AdminBookingsPage /></AdminRoute>} />
                  <Route path="/admin/sessions/:id/attendance" element={<AdminRoute><AdminAttendancePage /></AdminRoute>} />
                  <Route path="/admin/sessions/:id/waiting-list" element={<AdminRoute><AdminWaitingListPage /></AdminRoute>} />
                  <Route path="/admin/settings" element={<AdminRoute><AdminSettingsPage /></AdminRoute>} />
                </Routes>
              </Suspense>
            </main>
            <Footer />
          </div>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
