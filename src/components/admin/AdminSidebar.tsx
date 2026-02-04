import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAdmin, AppRole } from '@/contexts/AdminContext';
import { cn } from '@/lib/utils';

interface AdminSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavItem {
  path: string;
  icon: string;
  label: string;
  exact?: boolean;
  minRole?: AppRole;
}

interface NavSection {
  section: string;
  items: NavItem[];
}

type NavEntry = NavItem | NavSection;

const navItems: NavEntry[] = [
  { path: '/admin', icon: 'dashboard', label: 'Overview', exact: true },
  { path: '/admin/analytics', icon: 'analytics', label: 'Analytics' },
  { 
    section: 'Management',
    items: [
      { path: '/admin/models', icon: 'view_in_ar', label: 'Models', minRole: 'admin' },
      { path: '/admin/providers', icon: 'hub', label: 'Providers', minRole: 'admin' },
      { path: '/admin/users', icon: 'group', label: 'Users' },
      { path: '/admin/api-keys', icon: 'vpn_key', label: 'API Keys' },
      { path: '/admin/notifications', icon: 'notifications', label: 'Notifications', minRole: 'admin' },
    ]
  },
  {
    section: 'Billing',
    items: [
      { path: '/admin/billing', icon: 'payments', label: 'Credits & Billing', minRole: 'admin' },
    ]
  },
  {
    section: 'Security',
    items: [
      { path: '/admin/security', icon: 'security', label: 'Security & Abuse', minRole: 'admin' },
      { path: '/admin/incidents', icon: 'shield_lock', label: 'DDoS & Incidents' },
      { path: '/admin/logs', icon: 'terminal', label: 'Logs' },
    ]
  },
  {
    section: 'System',
    items: [
      { path: '/admin/settings', icon: 'settings', label: 'Settings', minRole: 'super_admin' },
    ]
  },
];

// Role hierarchy for comparison
const roleHierarchy: Record<AppRole, number> = {
  'super_admin': 100,
  'admin': 80,
  'moderator': 60,
  'support': 40,
  'analyst': 40,
  'user': 0,
};

export function AdminSidebar({ isOpen, onClose }: AdminSidebarProps) {
  const location = useLocation();
  const { profile } = useAuth();
  const { userRole, isOwner } = useAdmin();

  const isActive = (path: string, exact = false) => {
    if (exact) {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  const getRoleDisplay = () => {
    if (isOwner) return 'Owner';
    if (userRole === 'super_admin') return 'Super Admin';
    if (userRole === 'admin') return 'Admin';
    if (userRole === 'moderator') return 'Moderator';
    if (userRole === 'support') return 'Support';
    if (userRole === 'analyst') return 'Analyst';
    return 'User';
  };

  // Check if user has minimum role
  const hasMinRole = (minRole?: AppRole): boolean => {
    if (!minRole) return true;
    if (isOwner) return true;
    const currentLevel = roleHierarchy[userRole as AppRole] || 0;
    const requiredLevel = roleHierarchy[minRole] || 0;
    return currentLevel >= requiredLevel;
  };

  // Filter nav items based on role
  const filteredNavItems = navItems
    .map((item) => {
      if ('section' in item) {
        const filteredSubItems = item.items.filter((subItem) => hasMinRole(subItem.minRole));
        if (filteredSubItems.length === 0) return null;
        return { ...item, items: filteredSubItems };
      }
      return hasMinRole(item.minRole) ? item : null;
    })
    .filter((item): item is NavEntry => item !== null);

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-50 w-64 flex-shrink-0 flex flex-col border-r border-admin-border bg-admin-sidebar overflow-y-auto transition-transform duration-300",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className="p-6 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-admin-primary to-purple-600 flex items-center justify-center shadow-lg shadow-admin-primary/20">
            <span className="material-symbols-outlined text-white">smart_toy</span>
          </div>
          <div>
            <h1 className="text-white text-lg font-bold leading-none tracking-tight">AI Nexus</h1>
            <span className="text-xs text-slate-500 font-medium">Admin Console</span>
          </div>
          {/* Mobile close button */}
          <button 
            onClick={onClose}
            className="lg:hidden ml-auto text-slate-400 hover:text-white"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {filteredNavItems.map((item, index) => {
            if ('section' in item) {
              return (
                <div key={item.section}>
                  <div className="pt-4 pb-2 px-3">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{item.section}</p>
                  </div>
                  {item.items.map((subItem) => (
                    <NavLink
                      key={subItem.path}
                      to={subItem.path}
                      onClick={onClose}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                        isActive(subItem.path)
                          ? "bg-admin-primary/10 text-admin-primary border border-admin-primary/20"
                          : "text-slate-400 hover:text-white hover:bg-admin-border/50"
                      )}
                    >
                      <span className="material-symbols-outlined">{subItem.icon}</span>
                      <span className="text-sm font-medium">{subItem.label}</span>
                    </NavLink>
                  ))}
                </div>
              );
            }
            
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.exact}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                  isActive(item.path, item.exact)
                    ? "bg-admin-primary/10 text-admin-primary border border-admin-primary/20"
                    : "text-slate-400 hover:text-white hover:bg-admin-border/50"
                )}
              >
                <span className="material-symbols-outlined">{item.icon}</span>
                <span className="text-sm font-medium">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* User profile */}
        <div className="p-4 border-t border-admin-border">
          <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-admin-border/50 cursor-pointer">
            <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center text-white font-medium text-sm">
              {profile?.display_name?.charAt(0)?.toUpperCase() || 'A'}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <p className="text-sm font-medium text-white truncate">
                {profile?.display_name || 'Admin User'}
              </p>
              <p className="text-xs text-slate-400">{getRoleDisplay()}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
