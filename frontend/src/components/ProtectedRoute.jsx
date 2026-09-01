import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Admin routes aren't wrapped in this: AdminDashboard already gates its own content
// behind an inline admin-login screen when isAdmin is false, so no data ever renders
// without a valid admin token.
export function RequireUser({ children }) {
    const { user } = useAuth();
    const location = useLocation();
    if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    return children;
}
