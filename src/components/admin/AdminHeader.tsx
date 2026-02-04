import { useLocation, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface AdminHeaderProps {
  onMenuClick: () => void;
}

export function AdminHeader({ onMenuClick }: AdminHeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, profile } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  const getBreadcrumbs = () => {
    const path = location.pathname;
    const segments = path.split('/').filter(Boolean);
    
    return segments.map((segment, index) => ({
      label: segment.charAt(0).toUpperCase() + segment.slice(1),
      path: '/' + segments.slice(0, index + 1).join('/'),
      isLast: index === segments.length - 1,
    }));
  };

  const breadcrumbs = getBreadcrumbs();

  const handleSignOut = async () => {
    await signOut();
    navigate('/admin/login');
  };

  return (
    <header className="sticky top-0 z-30 bg-admin-surface/70 backdrop-blur-xl border-b border-admin-border px-4 md:px-8 py-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        {/* Mobile menu button */}
        <button 
          onClick={onMenuClick}
          className="lg:hidden text-slate-400 hover:text-white"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>

        {/* Breadcrumbs */}
        <nav className="hidden sm:flex text-sm font-medium text-slate-400">
          {breadcrumbs.map((crumb, index) => (
            <span key={crumb.path} className="flex items-center">
              {index > 0 && <span className="mx-2 text-slate-600">/</span>}
              {crumb.isLast ? (
                <span className="text-white">{crumb.label}</span>
              ) : (
                <Link to={crumb.path} className="hover:text-white transition-colors">
                  {crumb.label}
                </Link>
              )}
            </span>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        {/* Search Bar */}
        <div className="relative group hidden md:block">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="material-symbols-outlined text-slate-500 text-lg">search</span>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-48 lg:w-64 pl-10 pr-3 py-2 rounded-lg bg-admin-surface border border-admin-border text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-admin-primary focus:border-admin-primary transition-all"
            placeholder="Search..."
          />
          <div className="absolute inset-y-0 right-0 pr-2 flex items-center">
            <kbd className="hidden group-focus-within:inline-flex h-5 items-center gap-1 rounded border border-slate-600 bg-slate-800 px-1 font-mono text-[10px] font-medium text-slate-400">
              <span className="text-xs">⌘</span>K
            </kbd>
          </div>
        </div>

        {/* Notifications */}
        <button className="relative p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-admin-border/50">
          <span className="material-symbols-outlined">notifications</span>
          <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-admin-primary border-2 border-admin-surface"></span>
        </button>

        {/* User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-admin-border/50 transition-colors">
              <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center text-white font-medium text-sm">
                {profile?.display_name?.charAt(0)?.toUpperCase() || 'A'}
              </div>
              <span className="material-symbols-outlined text-slate-400 text-lg hidden sm:block">
                expand_more
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-admin-surface border-admin-border">
            <DropdownMenuItem asChild>
              <Link to="/" className="cursor-pointer text-slate-300 hover:text-white">
                <span className="material-symbols-outlined mr-2 text-lg">home</span>
                Back to Site
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-admin-border" />
            <DropdownMenuItem 
              onClick={handleSignOut}
              className="cursor-pointer text-admin-danger hover:text-admin-danger"
            >
              <span className="material-symbols-outlined mr-2 text-lg">logout</span>
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
