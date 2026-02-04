import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Key, ImageIcon, Bell, Search, type LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
  icon?: LucideIcon;
  variant?: 'default' | 'compact';
  className?: string;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  actionHref,
  icon: Icon,
  variant = 'default',
  className,
}: EmptyStateProps) {
  const isCompact = variant === 'compact';

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        isCompact ? 'py-6 px-3' : 'py-12 px-4',
        className
      )}
    >
      {/* Icon/Illustration */}
      {Icon && (
        <div
          className={cn(
            'rounded-full bg-muted/50 flex items-center justify-center mb-4',
            isCompact ? 'w-12 h-12' : 'w-16 h-16'
          )}
        >
          <Icon className={cn('text-muted-foreground', isCompact ? 'w-6 h-6' : 'w-8 h-8')} />
        </div>
      )}

      {/* Title */}
      <h3
        className={cn(
          'font-semibold text-foreground mb-2',
          isCompact ? 'text-base' : 'text-lg'
        )}
      >
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p
          className={cn(
            'text-muted-foreground max-w-sm',
            isCompact ? 'text-xs mb-4' : 'text-sm mb-6'
          )}
        >
          {description}
        </p>
      )}

      {/* CTA Button */}
      {actionLabel && (onAction || actionHref) && (
        actionHref ? (
          <Button asChild size={isCompact ? 'sm' : 'default'}>
            <Link to={actionHref}>{actionLabel}</Link>
          </Button>
        ) : (
          <Button onClick={onAction} size={isCompact ? 'sm' : 'default'}>
            {actionLabel}
          </Button>
        )
      )}
    </div>
  );
}

// Preset variants
export function EmptyAPIKeys({ onCreateKey }: { onCreateKey?: () => void }) {
  return (
    <EmptyState
      icon={Key}
      title="No API Keys"
      description="Create your first API key to start using the API"
      actionLabel="Create API Key"
      onAction={onCreateKey}
    />
  );
}

export function EmptyImages() {
  return (
    <EmptyState
      icon={ImageIcon}
      title="No Images Yet"
      description="Start creating stunning images with AI"
      actionLabel="Generate Image"
      actionHref="/generate"
    />
  );
}

export function EmptyNotifications() {
  return (
    <EmptyState
      icon={Bell}
      title="All Caught Up"
      description="You have no new notifications"
      variant="compact"
    />
  );
}

export function EmptySearchResults({ query }: { query?: string }) {
  return (
    <EmptyState
      icon={Search}
      title="No Results Found"
      description={query ? `No results for "${query}"` : 'Try adjusting your search'}
    />
  );
}

export default EmptyState;
