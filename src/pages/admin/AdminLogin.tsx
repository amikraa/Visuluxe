import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAdmin } from '@/contexts/AdminContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { devLog } from '@/lib/logger';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const navigate = useNavigate();
  const { user } = useAuth();
  const { canAccessAdmin, loading: adminLoading } = useAdmin();
  const { toast } = useToast();

  // Redirect if already authenticated and has admin access
  useEffect(() => {
    if (user && !adminLoading && canAccessAdmin) {
      navigate('/admin', { replace: true });
    }
  }, [user, canAccessAdmin, adminLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validate input
      const validationResult = loginSchema.safeParse({ email, password });
      if (!validationResult.success) {
        setError(validationResult.error.errors[0].message);
        setLoading(false);
        return;
      }

      // Sign in with Supabase
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError('Invalid credentials. Please try again.');
        setLoading(false);
        return;
      }

      if (!data.user) {
        setError('Authentication failed. Please try again.');
        setLoading(false);
        return;
      }

      // Check if user has admin access
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', data.user.id)
        .maybeSingle();

      if (roleError) {
        devLog.error('Error checking role:', roleError);
      }

      const role = roleData?.role;
      const hasAdminAccess = role === 'super_admin' || role === 'admin' || role === 'moderator';

      if (!hasAdminAccess) {
        // Sign out the user since they don't have admin access
        await supabase.auth.signOut();
        setError('Access denied. This area is restricted to authorized personnel only.');
        setLoading(false);
        return;
      }

      toast({
        title: 'Welcome back',
        description: 'Successfully authenticated.',
      });

      navigate('/admin', { replace: true });
    } catch (err) {
      devLog.error('Login error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-admin-background font-display antialiased flex flex-col overflow-x-hidden selection:bg-admin-primary selection:text-white">
      {/* Background Elements */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] bg-admin-primary/20 rounded-full blur-[120px] mix-blend-screen opacity-40"></div>
        <div className="absolute bottom-[-10%] right-[-5%] w-[40vw] h-[40vw] bg-purple-900/20 rounded-full blur-[100px] mix-blend-screen opacity-30"></div>
      </div>

      <div className="relative z-10 flex flex-col h-full grow min-h-screen">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 w-full">
          <div className="flex items-center gap-2 text-white/80">
            <div className="size-6 bg-admin-primary/20 rounded flex items-center justify-center">
              <span className="material-symbols-outlined text-admin-primary text-sm">grid_view</span>
            </div>
            <h2 className="text-sm font-semibold tracking-wide uppercase text-white/50">AI Gen Core</h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-xs font-mono text-emerald-500 uppercase tracking-widest">System: Operational</span>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex flex-1 items-center justify-center px-4 py-12">
          <div className="w-full max-w-[440px] relative">
            {/* Decorative border glow */}
            <div className="absolute -inset-0.5 bg-gradient-to-br from-admin-primary/30 to-transparent rounded-xl blur opacity-50"></div>
            
            <div className="relative flex flex-col bg-admin-sidebar/80 backdrop-blur-xl border border-white/10 shadow-2xl rounded-xl overflow-hidden">
              {/* Card Header */}
              <div className="p-8 pb-4">
                <div className="flex flex-col gap-1 items-center text-center mb-6">
                  <div className="size-12 rounded-full bg-admin-primary/10 flex items-center justify-center mb-4 border border-admin-primary/20 text-admin-primary">
                    <span className="material-symbols-outlined text-[28px]">shield_lock</span>
                  </div>
                  <h1 className="text-white text-2xl font-bold tracking-tight">Admin Portal</h1>
                  <p className="text-slate-400 text-sm">Secure Access Gateway</p>
                </div>

                {/* Warning Chip */}
                <div className="flex justify-center mb-3">
                  <div className="inline-flex items-center gap-2 rounded-full bg-admin-danger/10 px-3 py-1 border border-admin-danger/25 shadow-sm">
                    <span className="material-symbols-outlined text-admin-danger text-sm">lock</span>
                    <span className="text-admin-danger text-[11px] font-semibold tracking-wider uppercase">Admins Only</span>
                  </div>
                </div>

                {/* Warning Banner */}
                <div className="bg-admin-danger/10 border border-admin-danger/20 rounded-lg p-3 mb-6 flex items-start gap-3">
                  <span className="material-symbols-outlined text-admin-danger text-lg mt-0.5">warning</span>
                  <div className="flex flex-col">
                    <span className="text-admin-danger text-xs font-bold uppercase tracking-wider mb-0.5">Restricted Area</span>
                    <p className="text-red-200/70 text-xs leading-relaxed">
                      Authorized personnel only. IP address logged. No public signup available.
                    </p>
                  </div>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="bg-admin-danger/10 border border-admin-danger/20 rounded-lg p-3 mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-admin-danger text-lg">error</span>
                    <p className="text-admin-danger text-sm">{error}</p>
                  </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                  {/* Email Field */}
                  <div className="flex flex-col gap-2">
                    <label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Email Identity
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="material-symbols-outlined text-slate-500 group-focus-within:text-admin-primary transition-colors">mail</span>
                      </div>
                      <input
                        type="email"
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="admin@platform.com"
                        required
                        autoComplete="email"
                        className="block w-full rounded-lg bg-admin-background border border-white/5 pl-10 pr-3 py-3 text-sm text-white placeholder-slate-600 focus:border-admin-primary focus:ring-1 focus:ring-admin-primary transition-all shadow-inner"
                      />
                    </div>
                  </div>

                  {/* Password Field */}
                  <div className="flex flex-col gap-2">
                    <label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Password
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="material-symbols-outlined text-slate-500 group-focus-within:text-admin-primary transition-colors">lock</span>
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        required
                        className="block w-full rounded-lg bg-admin-background border border-white/5 pl-10 pr-10 py-3 text-sm text-white placeholder-slate-600 focus:border-admin-primary focus:ring-1 focus:ring-admin-primary transition-all shadow-inner"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer text-slate-500 hover:text-white transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">
                          {showPassword ? 'visibility_off' : 'visibility'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Action Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="mt-4 flex w-full items-center justify-center rounded-lg bg-admin-primary py-3 px-4 text-sm font-bold text-white shadow-lg shadow-admin-primary/25 hover:bg-admin-primary/90 hover:shadow-admin-primary/40 focus:outline-none focus:ring-2 focus:ring-admin-primary focus:ring-offset-2 focus:ring-offset-admin-sidebar transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        Authenticating...
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined mr-2 text-lg">login</span>
                        Secure Authenticate
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Footer */}
              <div className="bg-admin-background/50 px-8 py-4 border-t border-white/5 flex flex-col items-center gap-2">
                <p className="text-xs text-slate-500 text-center">
                  Having trouble?{' '}
                  <a href="#" className="text-admin-primary hover:text-admin-primary/80 underline underline-offset-2 decoration-admin-primary/30 hover:decoration-admin-primary">
                    Contact Super Admin
                  </a>
                </p>
                <div className="flex items-center gap-2 mt-2 opacity-50">
                  <span className="material-symbols-outlined text-[10px] text-slate-600">lock</span>
                  <span className="text-[10px] text-slate-600 uppercase tracking-widest">End-to-End Encrypted</span>
                </div>
              </div>
            </div>

            {/* Background glow reflection under card */}
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-3/4 h-8 bg-admin-primary/20 blur-xl rounded-full pointer-events-none"></div>
          </div>
        </main>

        {/* Footer */}
        <footer className="py-6 text-center">
          <p className="text-[10px] text-slate-600 uppercase tracking-widest">
            © {new Date().getFullYear()} AI Gen Platform. Unauthorized access is prohibited.
          </p>
        </footer>
      </div>
    </div>
  );
}
