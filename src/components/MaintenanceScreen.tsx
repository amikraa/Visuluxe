import { Wrench, Clock } from 'lucide-react';
import { CountdownTimer } from './MaintenanceCountdown';

interface MaintenanceScreenProps {
  message: string;
  scheduledEnd?: Date | null;
}

export function MaintenanceScreen({ message, scheduledEnd }: MaintenanceScreenProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-500/5 rounded-full blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-lg mx-auto px-6 text-center">
        {/* Icon */}
        <div className="relative inline-flex items-center justify-center mb-8">
          <div className="absolute inset-0 w-24 h-24 bg-amber-500/20 rounded-full blur-xl animate-pulse" />
          <div className="relative p-6 bg-card/60 backdrop-blur-xl rounded-full border border-amber-500/30 shadow-lg">
            <Wrench className="w-12 h-12 text-amber-500 animate-[spin_3s_ease-in-out_infinite]" style={{ animationDirection: 'alternate' }} />
          </div>
        </div>

        {/* Heading */}
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
          We'll Be Back Soon
        </h1>

        {/* Message */}
        <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
          {message}
        </p>

        {/* Countdown timer if scheduled end is known */}
        {scheduledEnd && (
          <div className="mb-8 p-6 bg-card/60 backdrop-blur-sm rounded-xl border border-amber-500/20">
            <CountdownTimer 
              targetDate={scheduledEnd} 
              label="Expected to end in" 
              variant="screen"
            />
          </div>
        )}

        {/* Status indicator */}
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-card/60 backdrop-blur-sm rounded-full border border-border text-sm text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span>Maintenance in progress</span>
          <span className="flex gap-1">
            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </span>
        </div>

        {/* Footer note */}
        <p className="mt-8 text-sm text-muted-foreground/60">
          Thank you for your patience. We're working to improve your experience.
        </p>
      </div>
    </div>
  );
}
