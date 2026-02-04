import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, EyeOff, Mail, ArrowRight, Lock, Shield, CloudOff, Sparkles, KeyRound, Wand2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { GlobalNavbar } from '@/components/GlobalNavbar';
import { getAuthErrorMessage } from '@/lib/errorUtils';
import { useAuthSettings } from '@/hooks/useAuthSettings';
import { OTPSignUp } from '@/components/auth/OTPSignUp';
import { MagicLinkSignUp } from '@/components/auth/MagicLinkSignUp';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type AuthMethod = 'password' | 'otp' | 'magic-link';

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
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

  const getPasswordStrength = () => {
    if (!password) return { width: '0%', label: '', color: '' };
    if (password.length < 6) return { width: '25%', label: 'Weak', color: 'text-red-400 bg-red-500' };
    if (password.length < 8) return { width: '50%', label: 'Fair', color: 'text-yellow-400 bg-yellow-500' };
    if (password.length < 12) return { width: '75%', label: 'Good', color: 'text-blue-400 bg-blue-500' };
    return { width: '100%', label: 'Strong', color: 'text-green-400 bg-green-500' };
  };

  const passwordStrength = getPasswordStrength();
  const passwordsMatch = password && confirmPassword && password === confirmPassword;

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password || !confirmPassword) {
      toast({
        title: "Missing fields",
        description: "Please fill in all fields.",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure your passwords match.",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters.",
        variant: "destructive",
      });
      return;
    }

    if (!termsAccepted) {
      toast({
        title: "Terms required",
        description: "Please accept the Terms of Service and Privacy Policy.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });

    setLoading(false);

    if (error) {
      toast({
        title: "Sign up failed",
        description: getAuthErrorMessage(error, 'signup'),
        variant: "destructive",
      });
    } else {
      toast({
        title: "Account created!",
        description: "Welcome to Visuluxe.",
      });
      navigate('/dashboard');
    }
  };

  const handleGoogleSignUp = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });

    if (error) {
      toast({
        title: "Sign up failed",
        description: getAuthErrorMessage(error, 'signup'),
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
        <div className="absolute inset-0 bg-[#0a0e17]"></div>
        <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] opacity-40 mix-blend-screen"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[100px] opacity-30 mix-blend-screen"></div>
      </div>

      <div className="relative z-10 flex min-h-screen w-full flex-col items-center justify-center p-4 py-12 pt-20">
        {/* Sign Up Card */}
        <div className="w-full max-w-[520px] rounded-2xl border border-border bg-card/75 backdrop-blur-xl shadow-2xl p-8 md:p-10 transition-all duration-300">
          {/* Header */}
          <div className="flex flex-col items-center text-center gap-4 mb-8">
            <Link to="/" className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/25 mb-1">
              <Sparkles className="w-7 h-7 text-primary-foreground" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Create your account</h1>
              <p className="text-muted-foreground text-base">Start generating AI images in seconds</p>
            </div>
          </div>

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
                {/* Password Form */}
                <form onSubmit={handleEmailSignUp} className="flex flex-col gap-5">
                  {/* Email Field */}
                  <div className="flex flex-col gap-2">
                    <label className="text-foreground text-sm font-medium pl-1" htmlFor="email">Email address</label>
                    <div className="relative group">
                      <input
                        className="w-full rounded-lg border border-border bg-surface/50 text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all duration-200 h-12 px-4 text-base font-normal leading-normal"
                        id="email"
                        placeholder="name@example.com"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                      <Mail className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none group-focus-within:text-primary transition-colors" />
                    </div>
                  </div>

                  {/* Password Field */}
                  <div className="flex flex-col gap-2">
                    <label className="text-foreground text-sm font-medium pl-1" htmlFor="password">Password</label>
                    <div className="relative group">
                      <input
                        className="w-full rounded-lg border border-border bg-surface/50 text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all duration-200 h-12 pl-4 pr-12 text-base font-normal leading-normal"
                        id="password"
                        placeholder="Create a password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        className="absolute right-0 top-0 h-full px-4 text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center focus:outline-none"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    {/* Password Strength Meter */}
                    {password && (
                      <div className="flex flex-col gap-1.5 mt-1">
                        <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-border/50">
                          <div className={`h-full ${passwordStrength.color.split(' ')[1]} rounded-full transition-all duration-300`} style={{ width: passwordStrength.width }}></div>
                        </div>
                        <div className="flex justify-between items-center text-xs px-1">
                          <span className={passwordStrength.color.split(' ')[0] + " font-medium"}>{passwordStrength.label}</span>
                          <span className="text-muted-foreground">Must contain 8+ characters</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Confirm Password Field */}
                  <div className="flex flex-col gap-2">
                    <label className="text-foreground text-sm font-medium pl-1" htmlFor="confirm_password">Confirm password</label>
                    <div className="relative group">
                      <input
                        className="w-full rounded-lg border border-border bg-surface/50 text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all duration-200 h-12 pl-4 pr-12 text-base font-normal leading-normal"
                        id="confirm_password"
                        placeholder="Confirm your password"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                      {passwordsMatch && (
                        <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                    </div>
                  </div>

                  {/* Terms Checkbox */}
                  <div className="flex items-start gap-3 mt-1">
                    <div className="relative flex items-center h-6">
                      <input
                        className="h-5 w-5 cursor-pointer appearance-none rounded border border-border bg-surface/50 checked:bg-primary checked:border-primary focus:ring-2 focus:ring-primary/30 transition-all"
                        id="terms"
                        type="checkbox"
                        checked={termsAccepted}
                        onChange={(e) => setTermsAccepted(e.target.checked)}
                      />
                      {termsAccepted && (
                        <svg className="absolute pointer-events-none text-primary-foreground w-4 h-4 left-0.5 top-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <label className="text-sm text-muted-foreground leading-relaxed cursor-pointer select-none" htmlFor="terms">
                      I agree to the <a className="text-foreground hover:text-primary underline decoration-border hover:decoration-primary underline-offset-4 transition-colors" href="#">Terms of Service</a> and <a className="text-foreground hover:text-primary underline decoration-border hover:decoration-primary underline-offset-4 transition-colors" href="#">Privacy Policy</a>.
                    </label>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="group relative mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3.5 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <>
                        Create Account
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>
                </form>
              </TabsContent>

              <TabsContent value="otp" className="mt-0">
                <OTPSignUp onSuccess={() => navigate('/dashboard')} />
              </TabsContent>

              <TabsContent value="magic-link" className="mt-0">
                <MagicLinkSignUp redirectTo={`${window.location.origin}/dashboard`} />
              </TabsContent>
            </Tabs>
          ) : (
            /* Password-only form (default) */
            <form onSubmit={handleEmailSignUp} className="flex flex-col gap-5">
              {/* Email Field */}
              <div className="flex flex-col gap-2">
                <label className="text-foreground text-sm font-medium pl-1" htmlFor="email">Email address</label>
                <div className="relative group">
                  <input
                    className="w-full rounded-lg border border-border bg-surface/50 text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all duration-200 h-12 px-4 text-base font-normal leading-normal"
                    id="email"
                    placeholder="name@example.com"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <Mail className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none group-focus-within:text-primary transition-colors" />
                </div>
              </div>

              {/* Password Field */}
              <div className="flex flex-col gap-2">
                <label className="text-foreground text-sm font-medium pl-1" htmlFor="password">Password</label>
                <div className="relative group">
                  <input
                    className="w-full rounded-lg border border-border bg-surface/50 text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all duration-200 h-12 pl-4 pr-12 text-base font-normal leading-normal"
                    id="password"
                    placeholder="Create a password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute right-0 top-0 h-full px-4 text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center focus:outline-none"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {/* Password Strength Meter */}
                {password && (
                  <div className="flex flex-col gap-1.5 mt-1">
                    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-border/50">
                      <div className={`h-full ${passwordStrength.color.split(' ')[1]} rounded-full transition-all duration-300`} style={{ width: passwordStrength.width }}></div>
                    </div>
                    <div className="flex justify-between items-center text-xs px-1">
                      <span className={passwordStrength.color.split(' ')[0] + " font-medium"}>{passwordStrength.label}</span>
                      <span className="text-muted-foreground">Must contain 8+ characters</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Password Field */}
              <div className="flex flex-col gap-2">
                <label className="text-foreground text-sm font-medium pl-1" htmlFor="confirm_password">Confirm password</label>
                <div className="relative group">
                  <input
                    className="w-full rounded-lg border border-border bg-surface/50 text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all duration-200 h-12 pl-4 pr-12 text-base font-normal leading-normal"
                    id="confirm_password"
                    placeholder="Confirm your password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                  {passwordsMatch && (
                    <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                </div>
              </div>

              {/* Terms Checkbox */}
              <div className="flex items-start gap-3 mt-1">
                <div className="relative flex items-center h-6">
                  <input
                    className="h-5 w-5 cursor-pointer appearance-none rounded border border-border bg-surface/50 checked:bg-primary checked:border-primary focus:ring-2 focus:ring-primary/30 transition-all"
                    id="terms"
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                  />
                  {termsAccepted && (
                    <svg className="absolute pointer-events-none text-primary-foreground w-4 h-4 left-0.5 top-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <label className="text-sm text-muted-foreground leading-relaxed cursor-pointer select-none" htmlFor="terms">
                  I agree to the <a className="text-foreground hover:text-primary underline decoration-border hover:decoration-primary underline-offset-4 transition-colors" href="#">Terms of Service</a> and <a className="text-foreground hover:text-primary underline decoration-border hover:decoration-primary underline-offset-4 transition-colors" href="#">Privacy Policy</a>.
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="group relative mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3.5 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    Create Account
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Divider */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-card px-3 text-muted-foreground">Or continue with</span>
            </div>
          </div>

          {/* Google OAuth Button */}
          <button
            type="button"
            onClick={handleGoogleSignUp}
            className="w-full flex items-center justify-center gap-3 rounded-lg border border-border bg-surface/30 py-3 text-sm font-medium text-foreground hover:bg-surface hover:border-muted-foreground transition-all duration-200"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"></path>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
            </svg>
            Continue with Google
          </button>

          {/* Sign In Link */}
          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link className="font-medium text-primary hover:text-primary/80 hover:underline underline-offset-4 transition-colors" to="/signin">Sign in</Link>
            </p>
          </div>
        </div>

        {/* Trust Footer */}
        <div className="mt-8 flex flex-wrap justify-center gap-x-8 gap-y-4 max-w-[500px] text-center">
          <div className="flex items-center gap-2 text-muted-foreground/70 hover:text-muted-foreground transition-colors cursor-help" title="Your data is encrypted and secure">
            <Lock className="w-4 h-4" />
            <span className="text-xs font-medium">Secure Auth</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground/70 hover:text-muted-foreground transition-colors cursor-help" title="Protected against DDoS and attacks">
            <Shield className="w-4 h-4" />
            <span className="text-xs font-medium">Cloudflare Protected</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground/70 hover:text-muted-foreground transition-colors cursor-help" title="We process images in memory and do not save them">
            <CloudOff className="w-4 h-4" />
            <span className="text-xs font-medium">Privacy-first</span>
          </div>
        </div>
        <p className="mt-4 text-xs text-muted-foreground/40 max-w-[400px] text-center">
          * We never store generated images. Anonymous users can upgrade anytime. API access included.
        </p>
      </div>
    </div>
  );
}
