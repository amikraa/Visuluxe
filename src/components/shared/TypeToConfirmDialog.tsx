import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TypeToConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message: React.ReactNode;
  confirmWord: string;
  onConfirm: () => void;
  variant?: 'destructive' | 'warning' | 'default';
  isLoading?: boolean;
  confirmButtonText?: string;
  children?: React.ReactNode;
}

export function TypeToConfirmDialog({
  open,
  onOpenChange,
  title,
  message,
  confirmWord,
  onConfirm,
  variant = 'destructive',
  isLoading = false,
  confirmButtonText,
  children,
}: TypeToConfirmDialogProps) {
  const [inputValue, setInputValue] = useState('');
  const isConfirmEnabled = inputValue === confirmWord;

  // Reset input when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setInputValue('');
    }
  }, [open]);

  const handleConfirm = () => {
    if (isConfirmEnabled && !isLoading) {
      onConfirm();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isConfirmEnabled && !isLoading) {
      onConfirm();
    }
  };

  const variantStyles = {
    destructive: {
      titleClass: 'text-red-400',
      buttonClass: 'bg-red-600 hover:bg-red-700',
      iconClass: 'text-red-400',
      borderClass: 'border-red-500/20',
      bgClass: 'bg-red-500/10',
    },
    warning: {
      titleClass: 'text-amber-400',
      buttonClass: 'bg-amber-600 hover:bg-amber-700',
      iconClass: 'text-amber-400',
      borderClass: 'border-amber-500/20',
      bgClass: 'bg-amber-500/10',
    },
    default: {
      titleClass: 'text-white',
      buttonClass: 'bg-admin-accent hover:bg-admin-accent-hover',
      iconClass: 'text-slate-400',
      borderClass: 'border-admin-border',
      bgClass: 'bg-admin-background',
    },
  };

  const styles = variantStyles[variant];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-admin-surface border-admin-border text-white">
        <DialogHeader>
          <DialogTitle className={cn('flex items-center gap-2', styles.titleClass)}>
            {variant !== 'default' && <AlertTriangle className="h-5 w-5" />}
            {title}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {message}
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 space-y-4">
          {children}
          
          <div className="space-y-2">
            <label className="text-sm text-slate-300">
              Type <span className="font-mono font-bold text-white">{confirmWord}</span> to confirm:
            </label>
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={confirmWord}
              className={cn(
                "bg-admin-background border-admin-border text-white",
                isConfirmEnabled && "border-emerald-500/50"
              )}
              autoComplete="off"
              autoFocus
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-admin-border text-slate-300"
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            className={styles.buttonClass}
            disabled={!isConfirmEnabled || isLoading}
            onClick={handleConfirm}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              confirmButtonText || `Confirm ${confirmWord}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
