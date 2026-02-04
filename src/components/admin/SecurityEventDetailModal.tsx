import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Ban, UserX, Shield, Clock, CheckCircle2, RotateCcw, 
  FileText, Timer, Loader2 
} from 'lucide-react';

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

interface SecurityEventDetailModalProps {
  event: SecurityEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBlockIP: (ip: string) => void;
  onBanUser: (userId: string) => void;
  onResolve?: (notes: string) => void;
  onUnresolve?: (reason: string) => void;
  blockedIPs: string[];
  isReadOnly?: boolean;
  isResolving?: boolean;
  isUnresolving?: boolean;
}

const MAX_NOTES_LENGTH = 1000;

export function SecurityEventDetailModal({
  event,
  open,
  onOpenChange,
  onBlockIP,
  onBanUser,
  onResolve,
  onUnresolve,
  blockedIPs,
  isReadOnly = false,
  isResolving = false,
  isUnresolving = false,
}: SecurityEventDetailModalProps) {
  // Resolution form state (for inline resolution in modal)
  const [showResolveForm, setShowResolveForm] = useState(false);
  const [showUnresolveForm, setShowUnresolveForm] = useState(false);
  const [notes, setNotes] = useState('');
  const [reopenReason, setReopenReason] = useState('');
  const [checkedItems, setCheckedItems] = useState({
    investigated: false,
    actionTaken: false,
    noFurtherAction: false,
  });

  const allChecked = checkedItems.investigated && checkedItems.actionTaken && checkedItems.noFurtherAction;
  const notesRequired = event ? (event.severity === 'high' || event.severity === 'critical') : false;
  const notesValid = !notesRequired || notes.trim().length > 0;
  const canResolve = allChecked && notesValid;
  // Reset form state when modal closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setShowResolveForm(false);
      setShowUnresolveForm(false);
      setNotes('');
      setReopenReason('');
      setCheckedItems({ investigated: false, actionTaken: false, noFurtherAction: false });
    }
    onOpenChange(newOpen);
  };

  // Fetch user profile if user_id exists
  const { data: userProfile } = useQuery({
    queryKey: ['user-profile-detail', event?.user_id],
    queryFn: async () => {
      if (!event?.user_id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('email, display_name, is_banned')
        .eq('user_id', event.user_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!event?.user_id && open,
  });

  // Fetch resolver profile if resolved_by exists
  const { data: resolverProfile } = useQuery({
    queryKey: ['resolver-profile', event?.resolved_by],
    queryFn: async () => {
      if (!event?.resolved_by) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('email, display_name')
        .eq('user_id', event.resolved_by)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!event?.resolved_by && open,
  });

  const getSeverityBadge = (severity: string) => {
    const styles: Record<string, string> = {
      low: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
      medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      high: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
      critical: 'bg-red-500/10 text-red-400 border-red-500/20',
    };
    return <Badge className={styles[severity] || styles.low}>{severity}</Badge>;
  };

  const formatDuration = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffMs = endDate.getTime() - startDate.getTime();
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days} day${days > 1 ? 's' : ''} ${hours % 24} hour${hours % 24 !== 1 ? 's' : ''}`;
    }
    if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  };

  if (!event) return null;

  const isIPBlocked = event.ip_address ? blockedIPs.includes(event.ip_address) : false;
  const isUserBanned = userProfile?.is_banned ?? false;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl bg-admin-surface border-admin-border text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-admin-warning" />
            Security Event Details
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Event ID: <code className="text-xs bg-admin-background px-1 py-0.5 rounded">{event.id}</code>
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Event Type & Severity */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-400 text-xs">Event Type</Label>
              <p className="text-white capitalize font-medium">{event.event_type.replace(/_/g, ' ')}</p>
            </div>
            <div>
              <Label className="text-slate-400 text-xs">Severity</Label>
              <div className="mt-1">{getSeverityBadge(event.severity)}</div>
            </div>
          </div>
          
          {/* User Info */}
          {event.user_id && (
            <div className="p-4 rounded-lg bg-admin-background border border-admin-border">
              <Label className="text-slate-400 text-xs">User Information</Label>
              <div className="mt-2 space-y-1">
                <p className="text-sm">
                  <span className="text-slate-400">User ID:</span>{' '}
                  <code className="text-xs bg-admin-surface px-1 py-0.5 rounded">{event.user_id}</code>
                </p>
                <p className="text-sm">
                  <span className="text-slate-400">Email:</span>{' '}
                  <span className="text-white">{userProfile?.email || 'Loading...'}</span>
                </p>
                <p className="text-sm">
                  <span className="text-slate-400">Display Name:</span>{' '}
                  <span className="text-white">{userProfile?.display_name || 'N/A'}</span>
                </p>
                <p className="text-sm">
                  <span className="text-slate-400">Status:</span>{' '}
                  {isUserBanned ? (
                    <Badge className="bg-red-500/10 text-red-400 border-red-500/20">Banned</Badge>
                  ) : (
                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Active</Badge>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Resolution Info Section */}
          {event.resolved_at && (
            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <Label className="text-emerald-400 text-sm font-medium">Resolved</Label>
              </div>
              <div className="space-y-2 text-sm">
                <p>
                  <span className="text-slate-400">Resolved at:</span>{' '}
                  <span className="text-white">{new Date(event.resolved_at).toLocaleString()}</span>
                </p>
                {resolverProfile && (
                  <p>
                    <span className="text-slate-400">Resolved by:</span>{' '}
                    <span className="text-white">{resolverProfile.display_name || resolverProfile.email}</span>
                  </p>
                )}
                {event.resolution_notes && (
                  <div>
                    <div className="flex items-center gap-1 text-slate-400 mb-1">
                      <FileText className="h-3 w-3" />
                      <span>Resolution Notes:</span>
                    </div>
                    <p className="text-slate-300 bg-admin-background p-2 rounded font-mono text-xs whitespace-pre-wrap">
                      {event.resolution_notes}
                    </p>
                  </div>
                )}
                <p className="flex items-center gap-1">
                  <Timer className="h-3 w-3 text-slate-400" />
                  <span className="text-slate-400">Time to resolve:</span>{' '}
                  <span className="text-white">{formatDuration(event.created_at, event.resolved_at)}</span>
                </p>
              </div>
            </div>
          )}
          
          {/* IP & User Agent */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-400 text-xs">IP Address</Label>
              <p className="font-mono text-white text-sm">{event.ip_address || 'N/A'}</p>
              {isIPBlocked && (
                <Badge className="mt-1 bg-red-500/10 text-red-400 border-red-500/20">Blocked</Badge>
              )}
            </div>
            <div>
              <Label className="text-slate-400 text-xs">API Key ID</Label>
              <p className="font-mono text-white text-sm truncate">{event.api_key_id || 'N/A'}</p>
            </div>
          </div>
          
          {/* User Agent */}
          <div>
            <Label className="text-slate-400 text-xs">User Agent</Label>
            <p className="text-sm text-slate-300 break-all">{event.user_agent || 'N/A'}</p>
          </div>
          
          {/* Request Details (JSON) */}
          {event.details && Object.keys(event.details).length > 0 && (
            <div>
              <Label className="text-slate-400 text-xs">Event Details</Label>
              <pre className="mt-2 p-4 rounded-lg bg-admin-background border border-admin-border text-xs text-slate-300 overflow-auto max-h-48">
                {JSON.stringify(event.details, null, 2)}
              </pre>
            </div>
          )}
          
          {/* Timestamp */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-400 text-xs">Created At</Label>
              <p className="text-slate-300 flex items-center gap-1 text-sm">
                <Clock className="h-3 w-3" />
                {new Date(event.created_at).toLocaleString()}
              </p>
            </div>
            <div>
              <Label className="text-slate-400 text-xs">Status</Label>
              <div className="mt-1">
                {event.resolved_at ? (
                  <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                    Resolved {new Date(event.resolved_at).toLocaleDateString()}
                  </Badge>
                ) : (
                  <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">Open</Badge>
                )}
              </div>
            </div>
          </div>

          {/* Inline Resolve Form */}
          {!isReadOnly && !event.resolved_at && showResolveForm && (
            <div className="p-4 rounded-lg bg-admin-background border border-emerald-500/30 space-y-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <Label className="text-emerald-400 font-medium">Resolve Incident</Label>
              </div>
              
              <div className="space-y-2">
                <Label className="text-slate-300 text-sm">
                  Resolution Notes {notesRequired ? (
                    <span className="text-red-400">(Required)</span>
                  ) : (
                    <span className="text-slate-500">(Optional)</span>
                  )}
                </Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value.slice(0, MAX_NOTES_LENGTH))}
                  placeholder="Describe how this incident was resolved..."
                  className="min-h-[80px] bg-admin-surface border-admin-border text-white placeholder:text-slate-500 resize-none"
                />
                <div className="flex justify-between items-center">
                  {notesRequired && notes.trim().length === 0 ? (
                    <p className="text-xs text-red-400">
                      Required for {event.severity} severity incidents
                    </p>
                  ) : (
                    <span />
                  )}
                  <p className="text-xs text-slate-500">
                    {notes.length} / {MAX_NOTES_LENGTH}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="modal-investigated"
                    checked={checkedItems.investigated}
                    onCheckedChange={(checked) => 
                      setCheckedItems(prev => ({ ...prev, investigated: !!checked }))
                    }
                    className="border-admin-border data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                  />
                  <Label htmlFor="modal-investigated" className="text-sm text-slate-300 cursor-pointer">
                    I have investigated this incident
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="modal-actionTaken"
                    checked={checkedItems.actionTaken}
                    onCheckedChange={(checked) => 
                      setCheckedItems(prev => ({ ...prev, actionTaken: !!checked }))
                    }
                    className="border-admin-border data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                  />
                  <Label htmlFor="modal-actionTaken" className="text-sm text-slate-300 cursor-pointer">
                    I have taken appropriate action
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="modal-noFurtherAction"
                    checked={checkedItems.noFurtherAction}
                    onCheckedChange={(checked) => 
                      setCheckedItems(prev => ({ ...prev, noFurtherAction: !!checked }))
                    }
                    className="border-admin-border data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                  />
                  <Label htmlFor="modal-noFurtherAction" className="text-sm text-slate-300 cursor-pointer">
                    No further action is required
                  </Label>
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowResolveForm(false)}
                  className="text-slate-400 hover:text-white"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => onResolve?.(notes)}
                  disabled={!canResolve || isResolving}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isResolving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      Resolving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Confirm
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Inline Unresolve Form */}
          {!isReadOnly && event.resolved_at && showUnresolveForm && (
            <div className="p-4 rounded-lg bg-admin-background border border-amber-500/30 space-y-4">
              <div className="flex items-center gap-2">
                <RotateCcw className="h-4 w-4 text-amber-400" />
                <Label className="text-amber-400 font-medium">Reopen Incident</Label>
              </div>
              
              <div className="space-y-2">
                <Label className="text-slate-300 text-sm">Reason for reopening (Optional)</Label>
                <Textarea
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  placeholder="Why is this incident being reopened?"
                  className="min-h-[60px] bg-admin-surface border-admin-border text-white placeholder:text-slate-500 resize-none"
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowUnresolveForm(false)}
                  className="text-slate-400 hover:text-white"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => onUnresolve?.(reopenReason)}
                  disabled={isUnresolving}
                  className="bg-amber-600 hover:bg-amber-700"
                >
                  {isUnresolving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      Reopening...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Confirm Reopen
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
        
        <DialogFooter className="gap-2 sm:gap-2 flex-wrap">
          {/* Resolution Actions - shown when not in form mode */}
          {!isReadOnly && !showResolveForm && !showUnresolveForm && (
            event.resolved_at ? (
              <Button
                variant="outline"
                onClick={() => setShowUnresolveForm(true)}
                className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reopen Incident
              </Button>
            ) : (
              <Button
                onClick={() => setShowResolveForm(true)}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Mark Resolved
              </Button>
            )
          )}

          {/* Block IP Button - hidden for read-only users */}
          {!isReadOnly && event.ip_address && !isIPBlocked && (
            <Button 
              variant="destructive" 
              onClick={() => {
                onBlockIP(event.ip_address!);
                handleOpenChange(false);
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              <Ban className="w-4 h-4 mr-2" />
              Block IP
            </Button>
          )}
          {event.ip_address && isIPBlocked && (
            <Badge className="bg-red-500/20 text-red-400 px-3 py-2">IP Already Blocked</Badge>
          )}
          
          {/* Ban User Button - hidden for read-only users */}
          {!isReadOnly && event.user_id && !isUserBanned && (
            <Button 
              variant="destructive"
              onClick={() => {
                onBanUser(event.user_id!);
                handleOpenChange(false);
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              <UserX className="w-4 h-4 mr-2" />
              Ban User
            </Button>
          )}
          {event.user_id && isUserBanned && (
            <Badge className="bg-red-500/20 text-red-400 px-3 py-2">User Already Banned</Badge>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
