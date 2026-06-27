import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Spinner from '../ui/Spinner';

export default function ProtectedRoute({ allowedRoles }) {
  const { user, profile, tutorData, loading } = useAuth();

  if (loading) return <Spinner dark size={32} />;
  if (!user)   return <Navigate to="/login" replace />;

  // Tutors who are approved but have no certification scores
  // must go to certification first — block dashboard access
  if (
    profile?.role === 'tutor' &&
    tutorData?.status === 'approved' &&
    !tutorData?.certification_scores &&
    window.location.pathname !== '/certification' &&
    window.location.pathname !== '/pending-approval'
  ) {
    return <Navigate to="/certification" replace />;
  }

  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}