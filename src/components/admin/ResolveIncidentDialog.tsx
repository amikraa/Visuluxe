import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { CheckCircle2, Shield, AlertTriangle, Clock, Globe, Loader2 } from 'lucide-react';

interface SecurityEvent {
  id: string;
  user_id: string | null;
  event_type: string;
  severity: string;
  ip_address: string | null;
  user_agent: string | null;
  details: Record<string, unknown> | null;
  resolved_at: string | null;
  resolved_by: string | null;
  api_key_id: string | null;
  created_at: string;
  resolution_notes?: string | null;
}

interface ResolveIncidentDialogProps {
  incident: SecurityEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResolve: (notes: string) => void;
  isResolving: boolean;
}

const MAX_NOTES_LENGTH = 1000;

export function ResolveIncidentDialog({
  incident,
  open,
  onOpenChange,
  onResolve,
  isResolving,
}: ResolveIncidentDialogProps) {
  const [notes, setNotes] = useState('');
  const [checkedItems, setCheckedItems] = useState({
    investigated: false,
    actionTaken: false,
    noFurtherAction: false,
  });

  const allChecked = checkedItems.investigated && checkedItems.actionTaken && checkedItems.noFurtherAction;
  const notesRequired = incident ? (incident.severity === 'high' || incident.severity === 'critical') : false;
  const notesValid = !notesRequired || notes.trim().length > 0;
  const canResolve = allChecked && notesValid;

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset state when closing
      setNotes('');
      setCheckedItems({ investigated: false, actionTaken: false, noFurtherAction: false });
    }
    onOpenChange(newOpen);
  };

  const handleResolve = () => {
    onResolve(notes);
  };

  const getSeverityBadge = (severity: string) => {
    const styles: Record<string, string> = {
      low: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
      medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      high: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
      critical: 'bg-red-500/10 text-red-400 border-red-500/20',
    };
    return <Badge className={styles[severity] || styles.low}>{severity}</Badge>;
  };

  if (!incident) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg bg-admin-surface border-admin-border text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-emerald-400" />
            Resolve Security Incident
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Review and mark this incident as resolved
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Incident Summary */}
          <div className="p-4 rounded-lg bg-admin-background border border-admin-border space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-admin-warning" />
                <span className="text-sm font-medium text-white capitalize">
                  {incident.event_type.replace(/_/g, ' ')}
                </span>
              </div>
              {getSeverityBadge(incident.severity)}
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-sm">
              {incident.ip_address && (
                <div className="flex items-center gap-2 text-slate-400">
                  <Globe className="h-3 w-3" />
                  <span className="font-mono">{incident.ip_address}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-slate-400">
                <Clock className="h-3 w-3" />
                <span>{new Date(incident.created_at).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Resolution Notes */}
          <div className="space-y-2">
            <Label className="text-slate-300">
              Resolution Notes {notesRequired ? (
                <span className="text-red-400">(Required)</span>
              ) : (
                <span className="text-slate-500">(Optional)</span>
              )}
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, MAX_NOTES_LENGTH))}
              placeholder="Describe how this incident was resolved, actions taken, or why it's being marked resolved..."
              className="min-h-[100px] bg-admin-background border-admin-border text-white placeholder:text-slate-500 resize-none"
            />
            <div className="flex justify-between items-center">
              {notesRequired && notes.trim().length === 0 ? (
                <p className="text-xs text-red-400">
                  Required for {incident.severity} severity incidents
                </p>
              ) : (
                <span />
              )}
              <p className="text-xs text-slate-500">
                {notes.length} / {MAX_NOTES_LENGTH}
              </p>
            </div>
          </div>

          {/* Confirmation Checkboxes */}
          <div className="space-y-3 p-4 rounded-lg bg-admin-background border border-admin-border">
            <p className="text-sm text-slate-400 mb-2">Please confirm before resolving:</p>
            
            <div className="flex items-center gap-2">
              <Checkbox
                id="investigated"
                checked={checkedItems.investigated}
                onCheckedChange={(checked) => 
                  setCheckedItems(prev => ({ ...prev, investigated: !!checked }))
                }
                className="border-admin-border data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
              />
              <Label htmlFor="investigated" className="text-sm text-slate-300 cursor-pointer">
                I have investigated this incident
              </Label>
            </div>
            
            <div className="flex items-center gap-2">
              <Checkbox
                id="actionTaken"
                checked={checkedItems.actionTaken}
                onCheckedChange={(checked) => 
                  setCheckedItems(prev => ({ ...prev, actionTaken: !!checked }))
                }
                className="border-admin-border data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
              />
              <Label htmlFor="actionTaken" className="text-sm text-slate-300 cursor-pointer">
                I have taken appropriate action
              </Label>
            </div>
            
            <div className="flex items-center gap-2">
              <Checkbox
                id="noFurtherAction"
                checked={checkedItems.noFurtherAction}
                onCheckedChange={(checked) => 
                  setCheckedItems(prev => ({ ...prev, noFurtherAction: !!checked }))
                }
                className="border-admin-border data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
              />
              <Label htmlFor="noFurtherAction" className="text-sm text-slate-300 cursor-pointer">
                No further action is required
              </Label>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            className="text-slate-400 hover:text-white hover:bg-admin-surface-hover"
          >
            Cancel
          </Button>
          <Button
            onClick={handleResolve}
            disabled={!canResolve || isResolving}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
          >
            {isResolving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Resolving...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Mark as Resolved
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
