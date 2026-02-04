import { cn } from '@/lib/utils';

interface FloatingOrbsProps {
  className?: string;
}

export function FloatingOrbs({ className }: FloatingOrbsProps) {
  return (
    <div className={cn("absolute inset-0 overflow-hidden pointer-events-none", className)}>
      {/* Primary orb - top right */}
      <div 
        className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full animate-float-slow"
        style={{
          background: 'radial-gradient(circle, hsl(var(--glow-primary) / 0.15) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />
      
      {/* Accent orb - bottom left */}
      <div 
        className="absolute -bottom-60 -left-60 w-[700px] h-[700px] rounded-full animate-float"
        style={{
          background: 'radial-gradient(circle, hsl(var(--glow-accent) / 0.1) 0%, transparent 70%)',
          filter: 'blur(80px)',
          animationDelay: '-3s',
        }}
      />
      
      {/* Small accent orb - center */}
      <div 
        className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full animate-pulse-glow"
        style={{
          background: 'radial-gradient(circle, hsl(var(--glow-primary) / 0.08) 0%, transparent 60%)',
          filter: 'blur(40px)',
        }}
      />
    </div>
  );
}

export default FloatingOrbs;