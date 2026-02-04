import { forwardRef, ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Slot } from '@radix-ui/react-slot';

interface GlowButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  asChild?: boolean;
}

export const GlowButton = forwardRef<HTMLButtonElement, GlowButtonProps>(
  ({ className, children, variant = 'primary', size = 'md', asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    
    const baseStyles = cn(
      "relative inline-flex items-center justify-center gap-2",
      "font-semibold rounded-xl",
      "transition-all duration-300 ease-spring",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      "disabled:pointer-events-none disabled:opacity-50",
      "overflow-hidden group"
    );
    
    const variants = {
      primary: cn(
        "bg-gradient-to-r from-primary to-accent text-primary-foreground",
        "shadow-glow hover:shadow-glow-lg",
        "hover:-translate-y-0.5 active:translate-y-0",
        "border border-primary/30"
      ),
      secondary: cn(
        "bg-surface-elevated text-foreground",
        "border border-border/60 hover:border-border-glow",
        "shadow-3d hover:shadow-3d-lg",
        "hover:-translate-y-0.5 active:translate-y-0"
      ),
      ghost: cn(
        "bg-transparent text-muted-foreground hover:text-foreground",
        "hover:bg-surface/50"
      ),
    };
    
    const sizes = {
      sm: "h-9 px-4 text-sm",
      md: "h-11 px-6 text-sm",
      lg: "h-14 px-8 text-base",
    };

    // When using asChild, we can't add extra elements as siblings
    // The Slot component expects exactly one child
    if (asChild) {
      return (
        <Slot
          ref={ref}
          className={cn(baseStyles, variants[variant], sizes[size], className)}
          {...props}
        >
          {children}
        </Slot>
      );
    }

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {/* Shimmer effect for primary */}
        {variant === 'primary' && (
          <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        )}
        
        {/* Inner glow */}
        <span className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" 
          style={{
            background: 'radial-gradient(circle at 50% 0%, hsl(var(--foreground) / 0.1) 0%, transparent 50%)'
          }}
        />
        
        <span className="relative z-10 flex items-center gap-2">
          {children}
        </span>
      </button>
    );
  }
);

GlowButton.displayName = 'GlowButton';

export default GlowButton;