import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getAuthErrorMessage } from '@/lib/errorUtils';
import { Mail, ArrowRight, Loader2 } from 'lucide-react';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

interface OTPSignUpProps {
  onSuccess?: () => void;
}

export function OTPSignUp({ onSuccess }: OTPSignUpProps) {
  const [email, setEmail] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSendOTP = async (e: React.FormEvent) => {
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
      },
    });

    setLoading(false);

    if (error) {
      toast({
        title: "Failed to send OTP",
        description: getAuthErrorMessage(error, 'signup'),
        variant: "destructive",
      });
    } else {
      setOtpSent(true);
      toast({
        title: "OTP sent!",
        description: "Check your email for the verification code.",
      });
    }
  };

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      toast({
        title: "Invalid OTP",
        description: "Please enter the 6-digit code.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: 'email',
    });

    setLoading(false);

    if (error) {
      toast({
        title: "Verification failed",
        description: getAuthErrorMessage(error, 'signup'),
        variant: "destructive",
      });
    } else {
      toast({
        title: "Account created!",
        description: "Welcome to Visuluxe.",
      });
      onSuccess?.();
    }
  };

  const handleResend = () => {
    setOtpSent(false);
    setOtp('');
  };

  if (otpSent) {
    return (
      <div className="space-y-4">
        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            We sent a 6-digit code to
          </p>
          <p className="font-medium text-foreground">{email}</p>
        </div>

        <div className="flex justify-center">
          <InputOTP
            maxLength={6}
            value={otp}
            onChange={setOtp}
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
        </div>

        <Button
          onClick={handleVerifyOTP}
          disabled={loading || otp.length !== 6}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <span>Verify & Create Account</span>
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>

        <button
          type="button"
          onClick={handleResend}
          className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Didn't receive the code? <span className="text-primary">Resend</span>
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSendOTP} className="space-y-5">
      <div className="space-y-2">
        <label className="text-foreground text-sm font-medium pl-1" htmlFor="otp-signup-email">
          Email address
        </label>
        <div className="relative group">
          <input
            className="w-full rounded-lg border border-border bg-surface/50 text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all duration-200 h-12 px-4 text-base font-normal leading-normal"
            id="otp-signup-email"
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
          id="otp-terms"
          checked={termsAccepted}
          onCheckedChange={(checked) => setTermsAccepted(checked === true)}
          className="mt-0.5"
        />
        <label className="text-sm text-muted-foreground leading-relaxed cursor-pointer select-none" htmlFor="otp-terms">
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
            <span>Send OTP Code</span>
            <ArrowRight className="w-4 h-4 ml-2" />
          </>
        )}
      </Button>

      <p className="text-xs text-muted-foreground text-center">
        We'll send a 6-digit verification code to your email
      </p>
    </form>
  );
}
