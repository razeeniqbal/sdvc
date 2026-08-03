import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/context/ToastContext';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { ProtectedRoute, AdminRoute } from '@/components/ProtectedRoute';
import { PublicOnlyRoute } from '@/components/PublicOnlyRoute';

import LandingPage from '@/pages/LandingPage';
import RegisterPage from '@/pages/auth/RegisterPage';
import LoginPage from '@/pages/auth/LoginPage';
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage';

import SessionsPage from '@/pages/sessions/SessionsPage';
import SessionDetailsPage from '@/pages/sessions/SessionDetailsPage';
import CheckoutPage from '@/pages/booking/CheckoutPage';
import BookingConfirmationPage from '@/pages/booking/BookingConfirmationPage';

import MyBookingsPage from '@/pages/player/MyBookingsPage';
import BookingDetailsPage from '@/pages/player/BookingDetailsPage';
import ProfilePage from '@/pages/player/ProfilePage';

import AdminDashboardPage from '@/pages/admin/AdminDashboardPage';
import AdminSessionsPage from '@/pages/admin/AdminSessionsPage';
import AdminSessionFormPage from '@/pages/admin/AdminSessionFormPage';
import AdminBookingsPage from '@/pages/admin/AdminBookingsPage';
import AdminAttendancePage from '@/pages/admin/AdminAttendancePage';
import AdminWaitingListPage from '@/pages/admin/AdminWaitingListPage';
import AdminSettingsPage from '@/pages/admin/AdminSettingsPage';

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <div className="min-h-screen flex flex-col bg-slate-50">
            <Navbar />
            <main className="flex-1">
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
            </main>
            <Footer />
          </div>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
