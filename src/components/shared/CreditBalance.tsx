import { Link } from 'react-router-dom';
import { useUserCredits } from '@/hooks/useUserCredits';
import { useAuth } from '@/contexts/AuthContext';
import { Zap, Coins, CreditCard, Gift, Clock, Plus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';

interface CreditBalanceProps {
  variant: 'compact' | 'detailed';
  showBuyButton?: boolean;
  className?: string;
}

export function CreditBalance({ variant, showBuyButton = false, className }: CreditBalanceProps) {
  const { user } = useAuth();
  const { data: credits, isLoading } = useUserCredits();
  const [countdown, setCountdown] = useState<{ hours: number; minutes: number } | null>(null);

  const totalCredits = (credits?.balance || 0) + (credits?.daily_credits || 0);

  // Calculate next reset countdown
  useEffect(() => {
    if (variant !== 'detailed') return;

    const updateCountdown = () => {
      const now = new Date();
      const nextMidnight = new Date(now);
      nextMidnight.setUTCHours(24, 0, 0, 0);

      const diffMs = nextMidnight.getTime() - now.getTime();
      if (diffMs <= 0) {
        setCountdown({ hours: 0, minutes: 0 });
        return;
      }

      const hours = Math.floor(diffMs / 3600000);
      const minutes = Math.floor((diffMs % 3600000) / 60000);
      setCountdown({ hours, minutes });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000);
    return () => clearInterval(interval);
  }, [variant]);

  // Get credit badge color based on level
  const getCreditColorClass = () => {
    if (totalCredits <= 0) return 'text-destructive';
    if (totalCredits < 10) return 'text-yellow-500';
    return 'text-accent';
  };

  // Don't render if not authenticated
  if (!user) return null;

  // Compact variant for navbar
  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center gap-2 glass rounded-xl px-3 py-1.5', className)}>
        <Zap className={cn('w-4 h-4', getCreditColorClass())} />
        {isLoading ? (
          <span className="text-xs font-medium text-muted-foreground">...</span>
        ) : (
          <span className={cn('text-xs font-medium', getCreditColorClass())}>
            {totalCredits.toFixed(1)} Credits
          </span>
        )}
      </div>
    );
  }

  // Detailed variant for dashboard
  return (
    <div className={cn(
      'bg-card/40 backdrop-blur-xl p-5 rounded-xl border border-border flex flex-col h-auto min-h-[160px] relative overflow-hidden group',
      className
    )}>
      <div className="absolute -right-6 -top-6 w-24 h-24 bg-purple-500/20 rounded-full blur-2xl group-hover:bg-purple-500/30 transition-all" />
      
      <div className="flex justify-between items-start z-10 mb-3">
        <div>
          <p className="text-muted-foreground text-sm font-medium mb-1">Credit Balance</p>
          {isLoading ? (
            <div className="h-8 flex items-center">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <h3 className="text-3xl font-bold text-foreground">{totalCredits.toLocaleString()}</h3>
          )}
        </div>
        <div className="p-2 bg-surface rounded-lg text-purple-400">
          <Coins className="w-5 h-5" />
        </div>
      </div>

      {/* Credit Breakdown */}
      <div className="space-y-2 z-10 flex-1">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
            Purchased
          </span>
          <span className="font-medium text-foreground">{credits?.balance || 0}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Gift className="w-3.5 h-3.5 text-primary" />
            Daily Free
          </span>
          <span className="font-medium text-foreground">{credits?.daily_credits || 10}</span>
        </div>

        {/* Next Reset */}
        {countdown && (
          <div className="flex items-center gap-1.5 text-xs text-amber-400 pt-1">
            <Clock className="w-3.5 h-3.5" />
            <span>Resets in {countdown.hours}h {countdown.minutes}m</span>
          </div>
        )}
      </div>

      {/* Buy More Button */}
      {showBuyButton && (
        <Link
          to="/pricing"
          className="mt-3 flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-xs font-medium z-10"
        >
          <Plus className="w-3.5 h-3.5" />
          Buy More Credits
        </Link>
      )}
    </div>
  );
}

export default CreditBalance;
