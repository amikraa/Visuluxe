import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface Icon3DProps {
  children: ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'primary' | 'accent';
}

export function Icon3D({ 
  children, 
  className,
  size = 'md',
  variant = 'default'
}: Icon3DProps) {
  const sizes = {
    sm: 'w-10 h-10',
    md: 'w-14 h-14',
    lg: 'w-16 h-16',
  };
  
  const variants = {
    default: cn(
      "bg-gradient-to-br from-surface-elevated to-surface",
      "text-muted-foreground group-hover:text-foreground"
    ),
    primary: cn(
      "bg-gradient-to-br from-primary/20 to-primary/10",
      "text-primary group-hover:text-primary-glow",
      "shadow-glow/20"
    ),
    accent: cn(
      "bg-gradient-to-br from-accent/20 to-accent/10",
      "text-accent group-hover:text-accent-glow",
      "shadow-glow-accent/20"
    ),
  };

  return (
    <div
      className={cn(
        "relative flex items-center justify-center",
        "rounded-xl",
        "border border-border/50",
        "shadow-3d",
        "transition-all duration-300 ease-spring",
        "group-hover:-translate-y-1 group-hover:shadow-3d-lg",
        sizes[size],
        variants[variant],
        className
      )}
      style={{
        boxShadow: `
          0 4px 12px hsl(var(--shadow-color) / 0.3),
          inset 0 1px 0 hsl(var(--foreground) / 0.04),
          inset 0 -2px 4px hsl(var(--shadow-color) / 0.2)
        `
      }}
    >
      {/* Inner highlight */}
      <div className="absolute inset-0 rounded-xl opacity-50">
        <div 
          className="absolute inset-0 rounded-xl"
          style={{
            background: 'linear-gradient(145deg, hsl(var(--foreground) / 0.03) 0%, transparent 50%)'
          }}
        />
      </div>
      
      <span className="relative z-10 transition-transform duration-300 group-hover:scale-110">
        {children}
      </span>
    </div>
  );
}

export default Icon3D;