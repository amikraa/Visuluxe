import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, EyeOff, Mail, Lock, ArrowRight, Shield, CloudOff, Lock as LockIcon, Sparkles, KeyRound, Wand2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { GlobalNavbar } from '@/components/GlobalNavbar';
import { getAuthErrorMessage } from '@/lib/errorUtils';
import { useAuthSettings } from '@/hooks/useAuthSettings';
import { OTPSignIn } from '@/components/auth/OTPSignIn';
import { MagicLinkSignIn } from '@/components/auth/MagicLinkSignIn';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type AuthMethod = 'password' | 'otp' | 'magic-link';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeMethod, setActiveMethod] = useState<AuthMethod>('password');
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { otpEnabled, magicLinkEnabled, isLoading: settingsLoading } = useAuthSettings();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast({
        title: "Missing fields",
        description: "Please enter both email and password.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      toast({
        title: "Sign in failed",
        description: getAuthErrorMessage(error, 'signin'),
        variant: "destructive",
      });
    } else {
      navigate('/dashboard');
    }
  };

  const handleGoogleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });

    if (error) {
      toast({
        title: "Sign in failed",
        description: getAuthErrorMessage(error, 'signin'),
        variant: "destructive",
      });
    }
  };

  // Determine which tabs to show
  const showTabs = otpEnabled || magicLinkEnabled;
  const availableTabs: { value: AuthMethod; label: string; icon: React.ReactNode }[] = [
    { value: 'password', label: 'Password', icon: <Lock className="w-4 h-4" /> },
  ];
  
  if (otpEnabled) {
    availableTabs.push({ value: 'otp', label: 'OTP', icon: <KeyRound className="w-4 h-4" /> });
  }
  if (magicLinkEnabled) {
    availableTabs.push({ value: 'magic-link', label: 'Magic Link', icon: <Wand2 className="w-4 h-4" /> });
  }

  return (
    <div className="relative min-h-screen w-full flex flex-col font-body">
      <GlobalNavbar />
      
      {/* Background Effects */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] mix-blend-screen opacity-40 animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[100px] mix-blend-screen opacity-30"></div>
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>
      </div>

      <div className="relative z-10 flex min-h-screen w-full flex-col items-center justify-center p-4 sm:p-6 lg:p-8 pt-20">
        {/* Auth Card */}
        <div className="w-full max-w-[440px] rounded-2xl border border-border bg-card/70 backdrop-blur-xl shadow-2xl ring-1 ring-black/5 flex flex-col overflow-hidden">
          {/* Header Section */}
          <div className="flex flex-col items-center px-8 pt-10 pb-6 text-center">
            {/* Logo + Brand */}
            <Link to="/" className="mb-6 flex items-center gap-3 rounded-xl bg-primary/10 px-4 py-3 ring-1 ring-inset ring-white/10">
              <Sparkles className="h-8 w-8 text-primary shrink-0" />
              <span className="text-lg font-semibold tracking-tight text-foreground">
                Visuluxe
              </span>
            </Link>

            <h1 className="text-2xl font-bold tracking-tight text-foreground mb-2">
              Welcome back
            </h1>
            <p className="text-sm text-muted-foreground font-normal leading-relaxed">
              Generate AI images securely and privately.
            </p>
          </div>

          {/* Form Section */}
          <div className="px-8 pb-8">
            {showTabs && !settingsLoading ? (
              <Tabs value={activeMethod} onValueChange={(v) => setActiveMethod(v as AuthMethod)} className="w-full">
                <TabsList className="w-full mb-6 bg-background/50 border border-border">
                  {availableTabs.map((tab) => (
                    <TabsTrigger 
                      key={tab.value} 
                      value={tab.value}
                      className="flex-1 gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                    >
                      {tab.icon}
                      <span className="hidden sm:inline">{tab.label}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>

                <TabsContent value="password" className="mt-0">
                  <form onSubmit={handleEmailSignIn} className="space-y-4">
                    {/* Email Input */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground" htmlFor="email">Email</label>
                      <div className="relative group">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <Mail className="w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        </div>
                        <input
                          className="block w-full rounded-lg border border-border bg-background py-3 pl-10 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary sm:text-sm sm:leading-6 transition-all shadow-sm"
                          id="email"
                          name="email"
                          placeholder="name@example.com"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Password Input */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground" htmlFor="password">Password</label>
                        <a className="text-xs font-medium text-primary hover:text-primary/80 transition-colors" href="#">Forgot password?</a>
                      </div>
                      <div className="relative group">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <Lock className="w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        </div>
                        <input
                          className="block w-full rounded-lg border border-border bg-background py-3 pl-10 pr-10 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary sm:text-sm sm:leading-6 transition-all shadow-sm"
                          id="password"
                          name="password"
                          placeholder="••••••••"
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                        <button
                          type="button"
                          className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={loading}
                      className="mt-2 w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 px-4 rounded-lg transition-all duration-200 shadow-[0_0_20px_-5px_hsl(var(--primary)/0.4)] hover:shadow-[0_0_25px_-5px_hsl(var(--primary)/0.6)] flex items-center justify-center gap-2 group/btn disabled:opacity-50"
                    >
                      {loading ? (
                        <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <>
                          <span>Sign In</span>
                          <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-0.5 transition-transform" />
                        </>
                      )}
                    </button>
                  </form>
                </TabsContent>

                <TabsContent value="otp" className="mt-0">
                  <OTPSignIn onSuccess={() => navigate('/dashboard')} />
                </TabsContent>

                <TabsContent value="magic-link" className="mt-0">
                  <MagicLinkSignIn redirectTo={`${window.location.origin}/dashboard`} />
                </TabsContent>
              </Tabs>
            ) : (
              <form onSubmit={handleEmailSignIn} className="space-y-4">
                {/* Email Input */}
                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground" htmlFor="email">Email</label>
                  <div className="relative group">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <Mail className="w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    </div>
                    <input
                      className="block w-full rounded-lg border border-border bg-background py-3 pl-10 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary sm:text-sm sm:leading-6 transition-all shadow-sm"
                      id="email"
                      name="email"
                      placeholder="name@example.com"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground" htmlFor="password">Password</label>
                    <a className="text-xs font-medium text-primary hover:text-primary/80 transition-colors" href="#">Forgot password?</a>
                  </div>
                  <div className="relative group">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <Lock className="w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    </div>
                    <input
                      className="block w-full rounded-lg border border-border bg-background py-3 pl-10 pr-10 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary sm:text-sm sm:leading-6 transition-all shadow-sm"
                      id="password"
                      name="password"
                      placeholder="••••••••"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="mt-2 w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 px-4 rounded-lg transition-all duration-200 shadow-[0_0_20px_-5px_hsl(var(--primary)/0.4)] hover:shadow-[0_0_25px_-5px_hsl(var(--primary)/0.6)] flex items-center justify-center gap-2 group/btn disabled:opacity-50"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <span>Sign In</span>
                      <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-0.5 transition-transform" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Divider */}
            <div className="relative mt-8 mb-6">
              <div aria-hidden="true" className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-3 text-muted-foreground">Or continue with</span>
              </div>
            </div>

            {/* Google Login */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="w-full flex items-center justify-center gap-3 bg-surface hover:bg-surface-hover border border-border text-foreground py-3 px-4 rounded-lg transition-all text-sm font-medium group/social"
            >
              <svg className="w-5 h-5 group-hover/social:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M23.766 12.2764C23.766 11.4607 23.6999 10.6406 23.5588 9.83807H12.24V14.4591H18.7217C18.4528 15.9494 17.5885 17.2678 16.323 18.1056V21.1039H20.19C22.4608 19.0139 23.766 15.9274 23.766 12.2764Z" fill="#4285F4"></path>
                <path d="M12.2401 24.0008C15.4766 24.0008 18.2059 22.9382 20.1945 21.1039L16.3275 18.1055C15.2517 18.8375 13.8627 19.252 12.2445 19.252C9.11388 19.252 6.45946 17.1399 5.50705 14.3003H1.5166V17.3912C3.55371 21.4434 7.7029 24.0008 12.2401 24.0008Z" fill="#34A853"></path>
                <path d="M5.50253 14.3003C5.00236 12.8199 5.00236 11.1799 5.50253 9.69951V6.60861H1.51649C-0.18551 10.0056 -0.18551 13.9945 1.51649 17.3915L5.50253 14.3003Z" fill="#FBBC05"></path>
                <path d="M12.2401 4.74966C13.9509 4.7232 15.6044 5.36697 16.8434 6.54867L20.2695 3.12262C18.1001 1.0855 15.2208 -0.034466 12.2401 0.000808666C7.7029 0.000808666 3.55371 2.55822 1.5166 6.60861L5.50264 9.69951C6.45064 6.86248 9.10947 4.74966 12.2401 4.74966Z" fill="#EA4335"></path>
              </svg>
              <span>Continue with Google</span>
            </button>

            {/* Footer Links */}
            <p className="mt-8 text-center text-sm text-muted-foreground">
              Don't have an account?{' '}
              <Link className="text-primary hover:text-primary/80 font-semibold transition-colors hover:underline decoration-primary/30 underline-offset-4" to="/signup">Sign up</Link>
            </p>
          </div>

          {/* Trust Signals Footer */}
          <div className="border-t border-border bg-background/50 px-8 py-4 flex flex-wrap justify-center gap-x-4 gap-y-2 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
            <div className="flex items-center gap-1.5 hover:text-foreground transition-colors cursor-help" title="Traffic is protected by Cloudflare">
              <Shield className="w-4 h-4 text-primary/80" />
              <span>Cloudflare Protected</span>
            </div>
            <div className="flex items-center gap-1.5 hover:text-foreground transition-colors cursor-help" title="We do not store your generated images">
              <CloudOff className="w-4 h-4 text-primary/80" />
              <span>No Storage</span>
            </div>
            <div className="flex items-center gap-1.5 hover:text-foreground transition-colors cursor-help" title="Authentication is secure and encrypted">
              <LockIcon className="w-4 h-4 text-primary/80" />
              <span>Secure Auth</span>
            </div>
          </div>
        </div>

        {/* Terms text */}
        <div className="mt-8 text-xs text-muted-foreground text-center max-w-sm leading-relaxed">
          By continuing, you acknowledge that you understand and agree to the{' '}
          <a className="underline hover:text-foreground" href="#">Terms of Service</a> and{' '}
          <a className="underline hover:text-foreground" href="#">Privacy Policy</a>.
        </div>
      </div>
    </div>
  );
}
