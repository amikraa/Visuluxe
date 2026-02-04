import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { devLog } from '@/lib/logger';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Copy, Check, UserPlus, Link, Crown, Shield, Eye, AlertTriangle, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import type { AppRole } from '@/contexts/AdminContext';

interface InviteTokenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type InviteRole = Exclude<AppRole, 'user'>;

type DialogStep = 'configure' | 'preview' | 'success';

export function InviteTokenDialog({
  open,
  onOpenChange,
  onSuccess,
}: InviteTokenDialogProps) {
  const [step, setStep] = useState<DialogStep>('configure');
  const [selectedRole, setSelectedRole] = useState<InviteRole>('moderator');
  const [expiresInDays, setExpiresInDays] = useState<number>(1);
  const [creating, setCreating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const { data, error } = await supabase.rpc('create_admin_invite', {
        _role: selectedRole,
        _expires_in_days: expiresInDays
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; token?: string; role?: string };

      if (result.success && result.token) {
        const inviteLink = `${window.location.origin}/admin/invite/${result.token}`;
        setGeneratedLink(inviteLink);
        setStep('success');
        toast.success('Invite created successfully');
        onSuccess?.();
      } else {
        throw new Error(result.error || 'Failed to create invite');
      }
    } catch (error: any) {
      devLog.error('Error creating invite:', error);
      toast.error('Failed to create invite');
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!generatedLink) return;
    
    try {
      await navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      toast.success('Link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy link');
    }
  };

  const handleClose = () => {
    setStep('configure');
    setGeneratedLink(null);
    setCopied(false);
    setSelectedRole('moderator');
    setExpiresInDays(1);
    onOpenChange(false);
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-400 border-amber-500/30';
      case 'admin':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'moderator':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      default:
        return '';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'super_admin':
        return <Crown className="h-3 w-3" />;
      case 'admin':
        return <Shield className="h-3 w-3" />;
      case 'moderator':
        return <Eye className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const getRoleDescription = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'Full system control & owner privileges';
      case 'admin':
        return 'Full management access';
      case 'moderator':
        return 'Content review & safety';
      default:
        return '';
    }
  };

  const getExpiryLabel = (days: number) => {
    if (days === 1) return '1 day';
    return `${days} days`;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            {step === 'preview' ? 'Confirm Invite' : step === 'success' ? 'Invite Created' : 'Create Admin Invite'}
          </DialogTitle>
          <DialogDescription>
            {step === 'preview' 
              ? 'Review the invite details before creating'
              : step === 'success'
              ? 'Share this link with the new team member'
              : 'Generate a one-time invite link for a new team member.'
            }
          </DialogDescription>
        </DialogHeader>

        {step === 'success' && generatedLink ? (
          <div className="space-y-4 py-4">
            <Alert className="bg-green-500/10 border-green-500/20">
              <Check className="h-4 w-4 text-green-500" />
              <AlertDescription className="text-green-700 dark:text-green-400">
                Invite created successfully! Share this link with the new team member.
              </AlertDescription>
            </Alert>

            {/* Summary of created invite */}
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Role</span>
                <Badge className={`${getRoleBadgeClass(selectedRole)} flex items-center gap-1`}>
                  {getRoleIcon(selectedRole)}
                  {selectedRole === 'super_admin' ? 'Super Admin' : selectedRole}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Expires in</span>
                <span className="text-sm font-medium">{getExpiryLabel(expiresInDays)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Usage</span>
                <Badge variant="outline" className="text-xs">Single-use</Badge>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Invite Link</Label>
              <div className="flex gap-2">
                <Input
                  value={generatedLink}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopy}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Link className="h-4 w-4" />
              <span>This link can only be used once and expires in {getExpiryLabel(expiresInDays)}.</span>
            </div>
          </div>
        ) : step === 'preview' ? (
          <div className="space-y-4 py-4">
            {/* Preview Summary */}
            <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4 space-y-4">
              <h4 className="font-medium text-center text-sm text-muted-foreground uppercase tracking-wide">
                Invite Preview
              </h4>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-border/50">
                  <span className="text-sm font-medium">Role</span>
                  <Badge className={`${getRoleBadgeClass(selectedRole)} flex items-center gap-1.5 px-3 py-1`}>
                    {getRoleIcon(selectedRole)}
                    {selectedRole === 'super_admin' ? 'Super Admin' : selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between py-2 border-b border-border/50">
                  <span className="text-sm font-medium">Expires in</span>
                  <span className="text-sm">{getExpiryLabel(expiresInDays)}</span>
                </div>
                
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm font-medium">Usage</span>
                  <Badge variant="outline" className="text-xs font-normal">Single-use invite</Badge>
                </div>
              </div>
            </div>

            {selectedRole === 'super_admin' && (
              <Alert className="bg-amber-500/10 border-amber-500/30">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <AlertDescription className="text-amber-700 dark:text-amber-400">
                  <strong>Warning:</strong> Super Admin has full system control. Only invite trusted individuals.
                </AlertDescription>
              </Alert>
            )}
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* Role selection */}
            <div className="space-y-2">
              <Label>Role to Assign</Label>
              <Select
                value={selectedRole}
                onValueChange={(value) => setSelectedRole(value as InviteRole)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="moderator">
                    <div className="flex items-center gap-2">
                      <Badge className={getRoleBadgeClass('moderator')}>
                        <Eye className="h-3 w-3 mr-1" />
                        moderator
                      </Badge>
                      <span className="text-muted-foreground text-sm">{getRoleDescription('moderator')}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <Badge className={getRoleBadgeClass('admin')}>
                        <Shield className="h-3 w-3 mr-1" />
                        admin
                      </Badge>
                      <span className="text-muted-foreground text-sm">{getRoleDescription('admin')}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="super_admin">
                    <div className="flex items-center gap-2">
                      <Badge className={getRoleBadgeClass('super_admin')}>
                        <Crown className="h-3 w-3 mr-1" />
                        super admin
                      </Badge>
                      <span className="text-muted-foreground text-sm">{getRoleDescription('super_admin')}</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {selectedRole === 'super_admin' && (
              <Alert className="bg-amber-500/10 border-amber-500/30">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <AlertDescription className="text-amber-700 dark:text-amber-400">
                  Super Admin has full system control including user management, model configuration, and system settings.
                </AlertDescription>
              </Alert>
            )}

            {/* Expiration */}
            <div className="space-y-2">
              <Label>Link Expiration</Label>
              <Select
                value={expiresInDays.toString()}
                onValueChange={(value) => setExpiresInDays(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">
                    <div className="flex items-center gap-2">
                      <span>1 day</span>
                      <Badge variant="secondary" className="text-xs">Default</Badge>
                    </div>
                  </SelectItem>
                  <SelectItem value="3">3 days</SelectItem>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="14">14 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Usage indicator */}
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
              <Link className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                This will create a <strong>single-use</strong> invite link
              </span>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {step === 'configure' && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={() => setStep('preview')}>
                Review Invite
              </Button>
            </>
          )}
          
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('configure')}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Create Invite
                  </>
                )}
              </Button>
            </>
          )}
          
          {step === 'success' && (
            <Button onClick={handleClose}>
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
