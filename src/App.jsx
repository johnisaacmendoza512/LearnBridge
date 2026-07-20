import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';
import Spinner from './components/ui/Spinner';

// Public
import LandingPage        from './pages/LandingPage';
import LoginPage          from './pages/auth/LoginPage';
import RegisterPage       from './pages/auth/RegisterPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage  from './pages/auth/ResetPasswordPage';

// Tutor pending approval
import PendingApprovalPage from './pages/tutor/PendingApprovalPage';

// Parent
import ParentDashboard    from './pages/parent/ParentDashboard';
import ParentProfilePage  from './pages/parent/ParentProfilePage';
import MyChildrenPage     from './pages/parent/MyChildrenPage';
import FindTutorsPage     from './pages/parent/FindTutorsPage';
import MessagesPage       from './pages/parent/MessagesPage';
import BookingsPage       from './pages/parent/BookingsPage';
import ParentSessionsPage from './pages/parent/ParentSessionsPage';
import ParentWalletPage   from './pages/parent/ParentWalletPage';

// Tutor
import TutorDashboard    from './pages/tutor/TutorDashboard';
import TutorBookingsPage from './pages/tutor/TutorBookingsPage';
import TutorProfilePage  from './pages/tutor/TutorProfilePage';
import CertificationPage from './pages/tutor/CertificationPage';
import SessionsPage      from './pages/tutor/SessionsPage';
import QuestionBankPage  from './pages/tutor/QuestionBankPage';
import WalletPage        from './pages/tutor/WalletPage';
import TutorMessagesPage from './pages/tutor/TutorMessagesPage';
import TutorCalendarPage from './pages/tutor/TutorCalendarPage';

// Admin
import AdminDashboard        from './pages/admin/AdminDashboard';
import TutorVerificationPage from './pages/admin/TutorVerificationPage';
import QuestionBankAdminPage from './pages/admin/QuestionBankAdminPage';
import AdminMessagesPage     from './pages/admin/AdminMessagesPage';
import UsersPage             from './pages/admin/UsersPage';
import TransactionsPage      from './pages/admin/TransactionsPage';
import AdminSessionsPage     from './pages/admin/AdminSessionsPage';

// ── Role-based routers ──────────────────────────────────────────────────────
function RoleWallet() {
  const { profile } = useAuth();
  if (profile?.role === 'tutor') return <WalletPage />;
  return <ParentWalletPage />;
}

function RoleDashboard() {
  const { profile } = useAuth();
  if (profile?.role === 'admin') return <AdminDashboard />;
  if (profile?.role === 'tutor') return <TutorDashboard />;
  return <ParentDashboard />;
}

function RoleProfile() {
  const { profile } = useAuth();
  if (profile?.role === 'tutor') return <TutorProfilePage />;
  return <ParentProfilePage />;
}

function RoleBookings() {
  const { profile } = useAuth();
  if (profile?.role === 'tutor') return <TutorBookingsPage />;
  return <BookingsPage />;
}

function RoleQuestionBank() {
  const { profile } = useAuth();
  if (profile?.role === 'admin') return <QuestionBankAdminPage />;
  return <QuestionBankPage />;
}

function RoleMessages() {
  const { profile } = useAuth();
  if (profile?.role === 'admin') return <AdminMessagesPage />;
  if (profile?.role === 'tutor') return <TutorMessagesPage />;
  return <MessagesPage />;
}

function RoleSessions() {
  const { profile } = useAuth();
  if (profile?.role === 'admin') return <AdminSessionsPage />;
  if (profile?.role === 'tutor') return <SessionsPage />;
  return <ParentSessionsPage />;
}

function AppRoutes() {
  const { loading } = useAuth();
  if (loading) return <Spinner dark size={32} />;

  return (
    <Routes>
      {/* ── Public ── */}
      <Route path="/"                element={<LandingPage />}        />
      <Route path="/login"           element={<LoginPage />}          />
      <Route path="/register"        element={<RegisterPage />}       />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password"  element={<ResetPasswordPage />}  />

      {/* ── Pending approval ── */}
      <Route path="/pending-approval" element={<PendingApprovalPage />} />

      {/* ── Authenticated App Shell ── */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>

          <Route path="/dashboard" element={<RoleDashboard />} />

          {/* Parent-only */}
          <Route element={<ProtectedRoute allowedRoles={['parent']} />}>
            <Route path="/my-children" element={<MyChildrenPage />} />
            <Route path="/find-tutors" element={<FindTutorsPage />} />
          </Route>

          {/* Tutor-only */}
          <Route element={<ProtectedRoute allowedRoles={['tutor']} />}>
            <Route path="/certification" element={<CertificationPage />} />
            <Route path="/calendar"      element={<TutorCalendarPage />} />
          </Route>

          {/* Admin-only */}
          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route path="/tutor-verification" element={<TutorVerificationPage />} />
            <Route path="/users"              element={<UsersPage />}             />
            <Route path="/transactions"       element={<TransactionsPage />}      />
          </Route>

          {/* Shared routes — accessible by all roles */}
          <Route path="/my-profile"    element={<RoleProfile />}      />
          <Route path="/bookings"      element={<RoleBookings />}     />
          <Route path="/sessions"      element={<RoleSessions />}     />
          <Route path="/question-bank" element={<RoleQuestionBank />} />
          <Route path="/messages"      element={<RoleMessages />}     />
          <Route path="/wallet"        element={<RoleWallet />}       />

          {/* Legacy redirect */}
          <Route path="/progress" element={<Navigate to="/sessions" replace />} />

        </Route>
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}