import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Spinner from '../ui/Spinner';

/**
 * Wraps routes that require authentication.
 * Optionally restricts to specific roles via `allowedRoles`.
 *
 * Usage:
 *   <Route element={<ProtectedRoute allowedRoles={['parent']} />}>
 *     <Route path="/my-children" element={<MyChildrenPage />} />
 *   </Route>
 */
export default function ProtectedRoute({ allowedRoles }) {
  const { user, profile, loading } = useAuth();

  if (loading) return <Spinner dark size={32} />;

  if (!user) return <Navigate to="/login" replace />;

  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
