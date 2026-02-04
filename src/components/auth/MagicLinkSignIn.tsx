import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getAuthErrorMessage } from '@/lib/errorUtils';
import { Mail, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MagicLinkSignInProps {
  redirectTo?: string;
}

export function MagicLinkSignIn({ redirectTo }: MagicLinkSignInProps) {
  const [email, setEmail] = useState('');
  const [linkSent, setLinkSent] = useState(false);
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

    setLoading(true);
    
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false, // Only existing users
        emailRedirectTo: redirectTo || `${window.location.origin}/dashboard`,
      },
    });

    setLoading(false);

    if (error) {
      toast({
        title: "Failed to send magic link",
        description: getAuthErrorMessage(error, 'signin'),
        variant: "destructive",
      });
    } else {
      setLinkSent(true);
      toast({
        title: "Magic link sent!",
        description: "Check your email to sign in.",
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
          Click the link in your email to sign in. The link expires in 1 hour.
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
    <form onSubmit={handleSendMagicLink} className="space-y-4">
      <div className="space-y-2">
        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground" htmlFor="magic-email">
          Email
        </label>
        <div className="relative group">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Mail className="w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
          </div>
          <input
            className="block w-full rounded-lg border border-border bg-background py-3 pl-10 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary sm:text-sm sm:leading-6 transition-all shadow-sm"
            id="magic-email"
            name="email"
            placeholder="name@example.com"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
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
        We'll email you a magic link for passwordless sign-in
      </p>
    </form>
  );
}
