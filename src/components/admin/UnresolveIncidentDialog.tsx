import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RotateCcw, Loader2 } from 'lucide-react';

interface UnresolveIncidentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  isUnresolving: boolean;
}

export function UnresolveIncidentDialog({
  open,
  onOpenChange,
  onConfirm,
  isUnresolving,
}: UnresolveIncidentDialogProps) {
  const [reason, setReason] = useState('');

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setReason('');
    }
    onOpenChange(newOpen);
  };

  const handleConfirm = () => {
    onConfirm(reason);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="bg-admin-surface border-admin-border text-white">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-white">
            <RotateCcw className="h-5 w-5 text-amber-400" />
            Reopen Incident?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-slate-400">
            This incident will be marked as unresolved and will appear in the active incidents list again.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-2">
          <Label className="text-slate-300">Reason for reopening (optional)</Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this incident being reopened?"
            className="min-h-[80px] bg-admin-background border-admin-border text-white placeholder:text-slate-500 resize-none"
          />
        </div>

        <AlertDialogFooter className="gap-2 sm:gap-2">
          <AlertDialogCancel 
            className="bg-transparent border-admin-border text-slate-400 hover:bg-admin-surface-hover hover:text-white"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isUnresolving}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {isUnresolving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Reopening...
              </>
            ) : (
              <>
                <RotateCcw className="h-4 w-4 mr-2" />
                Reopen Incident
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
