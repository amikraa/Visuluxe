import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getAuthErrorMessage } from '@/lib/errorUtils';
import { Mail, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

interface MagicLinkSignUpProps {
  redirectTo?: string;
}

export function MagicLinkSignUp({ redirectTo }: MagicLinkSignUpProps) {
  const [email, setEmail] = useState('');
  const [linkSent, setLinkSent] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast({
        title: "Email required",
        description: "Please enter your email address.",
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
    
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true, // Allow new user creation for signup
        emailRedirectTo: redirectTo || `${window.location.origin}/dashboard`,
      },
    });

    setLoading(false);

    if (error) {
      toast({
        title: "Failed to send magic link",
        description: getAuthErrorMessage(error, 'signup'),
        variant: "destructive",
      });
    } else {
      setLinkSent(true);
      toast({
        title: "Magic link sent!",
        description: "Check your email to complete signup.",
      });
    }
  };

  const handleResend = () => {
    setLinkSent(false);
  };

  if (linkSent) {
    return (
      <div className="space-y-4 text-center">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-primary" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-foreground">Check your email</h3>
          <p className="text-sm text-muted-foreground">
            We sent a magic link to
          </p>
          <p className="font-medium text-foreground">{email}</p>
        </div>

        <p className="text-sm text-muted-foreground">
          Click the link in your email to create your account. The link expires in 1 hour.
        </p>

        <button
          type="button"
          onClick={handleResend}
          className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Didn't receive the email? <span className="text-primary">Resend</span>
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSendMagicLink} className="space-y-5">
      <div className="space-y-2">
        <label className="text-foreground text-sm font-medium pl-1" htmlFor="magic-signup-email">
          Email address
        </label>
        <div className="relative group">
          <input
            className="w-full rounded-lg border border-border bg-surface/50 text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all duration-200 h-12 px-4 text-base font-normal leading-normal"
            id="magic-signup-email"
            placeholder="name@example.com"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Mail className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none group-focus-within:text-primary transition-colors" />
        </div>
      </div>

      {/* Terms Checkbox */}
      <div className="flex items-start gap-3">
        <Checkbox
          id="magic-terms"
          checked={termsAccepted}
          onCheckedChange={(checked) => setTermsAccepted(checked === true)}
          className="mt-0.5"
        />
        <label className="text-sm text-muted-foreground leading-relaxed cursor-pointer select-none" htmlFor="magic-terms">
          I agree to the <a className="text-foreground hover:text-primary underline underline-offset-4 transition-colors" href="#">Terms of Service</a> and <a className="text-foreground hover:text-primary underline underline-offset-4 transition-colors" href="#">Privacy Policy</a>.
        </label>
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3"
      >
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <>
            <span>Send Magic Link</span>
            <ArrowRight className="w-4 h-4 ml-2" />
          </>
        )}
      </Button>

      <p className="text-xs text-muted-foreground text-center">
        We'll email you a magic link for passwordless signup
      </p>
    </form>
  );
}
