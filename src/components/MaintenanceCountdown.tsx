import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

interface CountdownTimerProps {
  targetDate: Date;
  label: string;
  variant?: 'banner' | 'screen';
}

function calculateTimeLeft(targetDate: Date): TimeLeft | null {
  const diff = targetDate.getTime() - Date.now();
  if (diff <= 0) return null;

  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

export function CountdownTimer({ targetDate, label, variant = 'banner' }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(() => calculateTimeLeft(targetDate));

  useEffect(() => {
    const timer = setInterval(() => {
      const newTimeLeft = calculateTimeLeft(targetDate);
      setTimeLeft(newTimeLeft);
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  if (!timeLeft) {
    return <span className="text-sm">Any moment now...</span>;
  }

  if (variant === 'screen') {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span className="text-sm">{label}</span>
        </div>
        <div className="flex gap-3">
          {timeLeft.days > 0 && (
            <div className="flex flex-col items-center">
              <span className="text-2xl font-bold text-foreground">{timeLeft.days}</span>
              <span className="text-xs text-muted-foreground">days</span>
            </div>
          )}
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold text-foreground">{String(timeLeft.hours).padStart(2, '0')}</span>
            <span className="text-xs text-muted-foreground">hours</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold text-foreground">{String(timeLeft.minutes).padStart(2, '0')}</span>
            <span className="text-xs text-muted-foreground">min</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold text-foreground">{String(timeLeft.seconds).padStart(2, '0')}</span>
            <span className="text-xs text-muted-foreground">sec</span>
          </div>
        </div>
      </div>
    );
  }

  // Banner variant (compact)
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-sm">
      <span>{label}</span>
      {timeLeft.days > 0 && <span>{timeLeft.days}d</span>}
      <span>{String(timeLeft.hours).padStart(2, '0')}h</span>
      <span>{String(timeLeft.minutes).padStart(2, '0')}m</span>
      <span>{String(timeLeft.seconds).padStart(2, '0')}s</span>
    </span>
  );
}
