import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface LoadingSkeletonProps {
  variant: 'card' | 'table' | 'list' | 'text';
  count?: number;
  className?: string;
}

export function LoadingSkeleton({ variant, count = 3, className }: LoadingSkeletonProps) {
  // Card variant - for dashboard stat cards
  if (variant === 'card') {
    return (
      <div className={cn('p-6 rounded-xl border border-border bg-card/40 backdrop-blur-xl', className)}>
        <div className="space-y-3">
          <Skeleton className="h-4 w-24 bg-muted/50" />
          <Skeleton className="h-8 w-32 bg-muted/50" />
          <Skeleton className="h-3 w-full bg-muted/50" />
        </div>
      </div>
    );
  }

  // Table variant - for admin tables
  if (variant === 'table') {
    return (
      <div className={cn('space-y-2', className)}>
        {/* Header */}
        <div className="flex gap-4 p-4 border-b border-border/50">
          <Skeleton className="h-4 w-32 bg-muted/50" />
          <Skeleton className="h-4 w-24 bg-muted/50" />
          <Skeleton className="h-4 w-20 bg-muted/50" />
          <Skeleton className="h-4 w-16 bg-muted/50 ml-auto" />
        </div>
        {/* Rows */}
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex gap-4 p-4 items-center animate-pulse">
            <Skeleton className="h-4 w-32 bg-muted/50" />
            <Skeleton className="h-4 w-24 bg-muted/50" />
            <Skeleton className="h-4 w-20 bg-muted/50" />
            <div className="ml-auto flex gap-2">
              <Skeleton className="h-8 w-8 rounded-lg bg-muted/50" />
              <Skeleton className="h-8 w-8 rounded-lg bg-muted/50" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // List variant - for activity feeds with thumbnails
  if (variant === 'list') {
    return (
      <div className={cn('space-y-3', className)}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3 animate-pulse">
            <Skeleton className="h-14 w-14 rounded-lg bg-muted/50 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4 bg-muted/50" />
              <Skeleton className="h-3 w-1/2 bg-muted/50" />
            </div>
            <Skeleton className="h-3 w-12 bg-muted/50" />
          </div>
        ))}
      </div>
    );
  }

  // Text variant - for paragraphs
  return (
    <div className={cn('space-y-2', className)}>
      <Skeleton className="h-4 w-full bg-muted/50" />
      <Skeleton className="h-4 w-5/6 bg-muted/50" />
      <Skeleton className="h-4 w-4/6 bg-muted/50" />
    </div>
  );
}

export default LoadingSkeleton;
