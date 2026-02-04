import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSignedAvatarUrl } from '@/hooks/useSignedAvatarUrl';
import { useUserCredits } from '@/hooks/useUserCredits';
import { ProfilePopup } from '@/components/ProfilePopup';
import { NotificationBell } from '@/components/NotificationBell';
import { CreditBalance } from '@/components/shared';
import { Sparkles, Zap, Menu, X, ChevronDown, LogOut } from 'lucide-react';
export function GlobalNavbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showProfilePopup, setShowProfilePopup] = useState(false);
  const { user, profile, loading, signOut } = useAuth();
  const { data: credits, isLoading: creditsLoading } = useUserCredits();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  const displayUsername = profile?.display_name || profile?.username || user?.email?.split('@')[0] || 'User';
  
  const avatarPath = profile?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  const { signedUrl: avatarUrl } = useSignedAvatarUrl(avatarPath);

  // Calculate total credits
  const totalCredits = (credits?.balance || 0) + (credits?.daily_credits || 0);
  
  // Determine credit badge color
  const getCreditBadgeClass = () => {
    if (totalCredits <= 0) return 'text-destructive';
    if (totalCredits < 10) return 'text-yellow-500';
    return 'text-accent';
  };

  const handleSignOut = async () => {
    await signOut();
    setShowProfileMenu(false);
  };

  const navLinks = [
    { label: 'Home', to: '/' },
    { label: 'Docs', to: '/docs' },
    { label: 'Pricing', to: '/pricing' },
  ];

  const authLinks = user ? [
    { label: 'Dashboard', to: '/dashboard' },
    { label: 'Generate', to: '/generate' },
  ] : [];

  if (loading) return null;

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <div className="mx-4 mt-4">
        <div className="max-w-6xl mx-auto glass-nav rounded-2xl px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5 flex-shrink-0 group">
              <div className="w-9 h-9 flex items-center justify-center bg-gradient-to-br from-primary/30 to-accent/20 rounded-xl text-primary transition-all duration-300 group-hover:shadow-glow group-hover:scale-105">
                <Sparkles className="w-5 h-5" />
              </div>
              <span className="text-lg font-bold tracking-tight text-foreground font-display">Visuluxe</span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`px-4 py-2 text-sm font-medium rounded-xl transition-all duration-300 ${
                    isActive(link.to)
                      ? 'text-foreground bg-surface-elevated shadow-3d'
                      : 'text-muted-foreground hover:text-foreground hover:bg-surface/50'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              {authLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`px-4 py-2 text-sm font-medium rounded-xl transition-all duration-300 ${
                    isActive(link.to)
                      ? 'text-foreground bg-surface-elevated shadow-3d'
                      : 'text-muted-foreground hover:text-foreground hover:bg-surface/50'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Auth Actions */}
            <div className="flex items-center gap-3">
              {user ? (
                <>
                  {/* Dashboard: Show Plan + User block */}
                  {location.pathname === '/dashboard' && (
                    <div className="hidden lg:block text-right mr-3">
                      <p className="text-xs font-medium text-muted-foreground leading-tight">
                        {profile?.account_type === 'partner' ? 'Partner' : 'Free Tier'}
                      </p>
                      <p className="text-sm font-semibold text-foreground leading-tight">{displayUsername}</p>
                    </div>
                  )}

                  {/* Generate: Show Credits badge */}
                  {location.pathname === '/generate' && (
                    <div className="hidden lg:block">
                      <CreditBalance variant="compact" />
                    </div>
                  )}

                  {/* Notification Bell (visible on all pages when logged in) */}
                  <NotificationBell />

                  {/* User Avatar & Menu */}
                  <div className="relative">
                    <button
                      onClick={() => setShowProfileMenu(!showProfileMenu)}
                      className="flex items-center gap-2 rounded-xl p-1 hover:bg-surface/50 transition-all duration-300 group"
                    >
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/30 to-accent/20 border border-border/50 overflow-hidden flex items-center justify-center shadow-3d transition-all duration-300 group-hover:shadow-glow group-hover:scale-105">
                        {avatarUrl ? (
                          <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-foreground text-sm font-bold">{displayUsername.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <ChevronDown className={`w-4 h-4 text-muted-foreground hidden sm:block transition-transform duration-300 ${showProfileMenu ? 'rotate-180' : ''}`} />
                    </button>

                    {showProfileMenu && (
                      <div className="absolute right-0 top-14 w-60 rounded-2xl border border-border/50 glass shadow-float py-2 z-[60] animate-scale-in">
                        <div className="px-4 py-3 border-b border-border/50">
                          <p className="text-sm font-semibold text-foreground truncate">{displayUsername}</p>
                          <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                          <div className="flex items-center gap-1 mt-2">
                            <Zap className={`w-3 h-3 ${getCreditBadgeClass()}`} />
                            <span className={`text-xs font-medium ${getCreditBadgeClass()}`}>
                              {creditsLoading ? '...' : `${totalCredits.toFixed(1)} credits`}
                            </span>
                          </div>
                        </div>
                        <div className="p-2">
                          <button
                            onClick={() => {
                              setShowProfileMenu(false);
                              setShowProfilePopup(true);
                            }}
                            className="w-full text-left px-3 py-2.5 text-sm text-foreground hover:bg-surface-elevated rounded-xl transition-all duration-200"
                          >
                            Profile
                          </button>
                          <Link
                            to="/dashboard"
                            onClick={() => setShowProfileMenu(false)}
                            className="block w-full text-left px-3 py-2.5 text-sm text-foreground hover:bg-surface-elevated rounded-xl transition-all duration-200"
                          >
                            Settings
                          </Link>
                          <Link
                            to="/pricing"
                            onClick={() => setShowProfileMenu(false)}
                            className="block w-full text-left px-3 py-2.5 text-sm text-foreground hover:bg-surface-elevated rounded-xl transition-all duration-200"
                          >
                            Billing
                          </Link>
                          <button
                            onClick={handleSignOut}
                            className="w-full flex items-center gap-2 text-left px-3 py-2.5 text-sm text-destructive hover:bg-destructive/10 rounded-xl transition-all duration-200"
                          >
                            <LogOut className="w-4 h-4" />
                            Sign Out
                          </button>
                        </div>
                      </div>
                    )}

                    <ProfilePopup 
                      isOpen={showProfilePopup} 
                      onClose={() => setShowProfilePopup(false)} 
                    />
                  </div>
                </>
              ) : (
                <>
                  <Link
                    to="/signin"
                    className="hidden sm:block px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-all duration-300"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/signup"
                    className="px-5 py-2.5 text-sm font-bold text-primary-foreground bg-gradient-to-r from-primary to-accent rounded-xl transition-all duration-300 shadow-glow hover:shadow-glow-lg hover:-translate-y-0.5"
                  >
                    Get Started
                  </Link>
                </>
              )}

              {/* Mobile Menu Toggle */}
              <button
                className="md:hidden flex items-center justify-center w-10 h-10 text-muted-foreground hover:text-foreground hover:bg-surface/50 rounded-xl transition-all duration-300"
                onClick={() => setIsOpen(!isOpen)}
                aria-label={isOpen ? 'Close menu' : 'Open menu'}
              >
                {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <div
        className={`md:hidden absolute top-full left-4 right-4 mt-2 glass rounded-2xl border border-border/50 shadow-float transition-all duration-300 overflow-hidden ${
          isOpen ? 'max-h-[400px] opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
        }`}
      >
        <nav className="flex flex-col p-4 gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setIsOpen(false)}
              className={`px-4 py-3 text-sm font-medium rounded-xl transition-all duration-300 ${
                isActive(link.to)
                  ? 'text-foreground bg-surface-elevated'
                  : 'text-muted-foreground hover:text-foreground hover:bg-surface/50'
              }`}
            >
              {link.label}
            </Link>
          ))}
          {authLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setIsOpen(false)}
              className={`px-4 py-3 text-sm font-medium rounded-xl transition-all duration-300 ${
                isActive(link.to)
                  ? 'text-foreground bg-surface-elevated'
                  : 'text-muted-foreground hover:text-foreground hover:bg-surface/50'
              }`}
            >
              {link.label}
            </Link>
          ))}
          
          {user && (
            <div className="flex items-center gap-2 px-4 py-3 border-t border-border/50 mt-2">
              <Zap className={`w-4 h-4 ${getCreditBadgeClass()}`} />
              <span className={`text-sm font-medium ${getCreditBadgeClass()}`}>
                {creditsLoading ? 'Loading...' : `${totalCredits.toFixed(1)} Credits`}
              </span>
            </div>
          )}
          
          {!user && (
            <div className="flex flex-col gap-2 pt-4 border-t border-border/50 mt-2">
              <Link
                to="/signin"
                onClick={() => setIsOpen(false)}
                className="px-4 py-3 text-sm font-medium text-center text-muted-foreground hover:text-foreground border border-border/50 rounded-xl transition-all duration-300"
              >
                Sign In
              </Link>
              <Link
                to="/signup"
                onClick={() => setIsOpen(false)}
                className="px-4 py-3 text-sm font-bold text-center text-primary-foreground bg-gradient-to-r from-primary to-accent rounded-xl transition-all duration-300 shadow-glow"
              >
                Get Started
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}

export default GlobalNavbar;
