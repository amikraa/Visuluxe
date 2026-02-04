import { createContext, useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAdmin, AppRole } from '@/contexts/AdminContext';
import { Eye } from 'lucide-react';

// Context for read-only mode
interface AdminReadOnlyContextType {
  isReadOnly: boolean;
}

const AdminReadOnlyContext = createContext<AdminReadOnlyContextType>({ isReadOnly: false });

export const useAdminReadOnly = () => useContext(AdminReadOnlyContext);

interface AdminProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: AppRole;
  allowedRoles?: AppRole[];
}

export function AdminProtectedRoute({ children, requiredRole = 'moderator', allowedRoles }: AdminProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { userRole, loading: adminLoading, canAccessAdmin, isAdmin, isSuperAdmin, isModerator, isSupport, isAnalyst } = useAdmin();

  const loading = authLoading || adminLoading;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-admin-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-admin-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-admin-muted text-sm font-medium">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  // Check if user has one of the allowed roles
  const hasAllowedRole = allowedRoles 
    ? allowedRoles.includes(userRole as AppRole)
    : false;

  // Check role hierarchy
  const hasAccess = (() => {
    if (hasAllowedRole) return true;
    
    switch (requiredRole) {
      case 'super_admin':
        return isSuperAdmin;
      case 'admin':
        return isAdmin;
      case 'moderator':
        return canAccessAdmin;
      case 'support':
        return isSupport;
      case 'analyst':
        return isAnalyst;
      default:
        return canAccessAdmin;
    }
  })();

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-admin-background">
        <div className="bg-admin-surface border border-admin-border rounded-xl p-8 max-w-md text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-admin-danger/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-admin-danger text-3xl">lock</span>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-admin-muted text-sm mb-4">
            You don't have permission to access this area. 
            {requiredRole === 'super_admin' && ' This section requires Super Admin privileges.'}
            {requiredRole === 'admin' && ' This section requires Admin privileges.'}
          </p>
          <p className="text-admin-muted text-xs">
            Your current role: <span className="text-admin-primary font-medium uppercase">{userRole || 'user'}</span>
          </p>
        </div>
      </div>
    );
  }

  // Analyst is read-only
  const isReadOnly = userRole === 'analyst';

  return (
    <AdminReadOnlyContext.Provider value={{ isReadOnly }}>
      {isReadOnly && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2">
          <p className="text-amber-400 text-sm flex items-center justify-center gap-2">
            <Eye className="w-4 h-4" />
            Read-only access. You cannot make changes.
          </p>
        </div>
      )}
      {children}
    </AdminReadOnlyContext.Provider>
  );
}
