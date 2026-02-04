import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getAuthErrorMessage } from '@/lib/errorUtils';
import { Mail, ArrowRight, Loader2 } from 'lucide-react';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Button } from '@/components/ui/button';

interface OTPSignInProps {
  onSuccess?: () => void;
}

export function OTPSignIn({ onSuccess }: OTPSignInProps) {
  const [email, setEmail] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
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

    setLoading(true);
    
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false, // Only existing users can use OTP
      },
    });

    setLoading(false);

    if (error) {
      toast({
        title: "Failed to send OTP",
        description: getAuthErrorMessage(error, 'signin'),
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
        description: getAuthErrorMessage(error, 'signin'),
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success!",
        description: "You have been signed in.",
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
              <span>Verify Code</span>
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
    <form onSubmit={handleSendOTP} className="space-y-4">
      <div className="space-y-2">
        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground" htmlFor="otp-email">
          Email
        </label>
        <div className="relative group">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Mail className="w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
          </div>
          <input
            className="block w-full rounded-lg border border-border bg-background py-3 pl-10 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary sm:text-sm sm:leading-6 transition-all shadow-sm"
            id="otp-email"
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
