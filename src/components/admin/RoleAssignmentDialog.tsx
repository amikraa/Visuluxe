import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Loader2, Shield, AlertTriangle, Gauge } from 'lucide-react';
import { toast } from 'sonner';
import { TypeToConfirmDialog } from '@/components/shared/TypeToConfirmDialog';
import type { AppRole, AccountType } from '@/contexts/AdminContext';

// Validation constants
const MIN_RATE_LIMIT = 1;
const MAX_RATE_LIMIT = 10000;

interface UserProfile {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  account_type: AccountType;
  custom_rpm: number | null;
  custom_rpd: number | null;
  max_images_per_day: number | null;
}

interface RoleAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserProfile | null;
  currentRole: AppRole;
  isOwner: boolean;
  isTargetSuperAdmin: boolean;
  callerIsOwner: boolean;
  onSuccess: () => void;
}

interface RateLimitErrors {
  rpm?: string;
  rpd?: string;
  images?: string;
}

export function RoleAssignmentDialog({
  open,
  onOpenChange,
  user,
  currentRole,
  isOwner,
  isTargetSuperAdmin,
  callerIsOwner,
  onSuccess,
}: RoleAssignmentDialogProps) {
  const [selectedRole, setSelectedRole] = useState<AppRole>(currentRole);
  const [selectedAccountType, setSelectedAccountType] = useState<AccountType>(user?.account_type || 'normal');
  const [saving, setSaving] = useState(false);
  const [showDemotionConfirm, setShowDemotionConfirm] = useState(false);
  
  // Rate limit states
  const [customRpm, setCustomRpm] = useState<string>('');
  const [customRpd, setCustomRpd] = useState<string>('');
  const [maxImagesPerDay, setMaxImagesPerDay] = useState<string>('');
  const [rateLimitErrors, setRateLimitErrors] = useState<RateLimitErrors>({});
  
  // Reset form when user changes
  useEffect(() => {
    if (user) {
      setSelectedRole(currentRole);
      setSelectedAccountType(user.account_type || 'normal');
      setCustomRpm(user.custom_rpm?.toString() || '');
      setCustomRpd(user.custom_rpd?.toString() || '');
      setMaxImagesPerDay(user.max_images_per_day?.toString() || '');
      setRateLimitErrors({});
    }
  }, [user, currentRole]);

  // Reset demotion dialog when main dialog closes
  useEffect(() => {
    if (!open) {
      setShowDemotionConfirm(false);
    }
  }, [open]);
  
  // Non-owner super_admins cannot modify other super_admins
  const cannotModify = isOwner || (!callerIsOwner && isTargetSuperAdmin);

  // Check if this is a demotion from admin roles
  const adminRoles: AppRole[] = ['super_admin', 'admin'];
  const isDemotion = useMemo(() => {
    const wasAdmin = adminRoles.includes(currentRole);
    const willBeAdmin = adminRoles.includes(selectedRole);
    return wasAdmin && !willBeAdmin && selectedRole !== currentRole;
  }, [currentRole, selectedRole]);

  // Validate rate limits
  const validateRateLimits = useMemo((): RateLimitErrors => {
    const errors: RateLimitErrors = {};
    
    if (customRpm) {
      const rpm = parseInt(customRpm);
      if (isNaN(rpm) || rpm < MIN_RATE_LIMIT) {
        errors.rpm = `Must be at least ${MIN_RATE_LIMIT}`;
      } else if (rpm > MAX_RATE_LIMIT) {
        errors.rpm = `Max is ${MAX_RATE_LIMIT.toLocaleString()}`;
      }
    }
    
    if (customRpd) {
      const rpd = parseInt(customRpd);
      if (isNaN(rpd) || rpd < MIN_RATE_LIMIT) {
        errors.rpd = `Must be at least ${MIN_RATE_LIMIT}`;
      } else if (rpd > MAX_RATE_LIMIT) {
        errors.rpd = `Max is ${MAX_RATE_LIMIT.toLocaleString()}`;
      }
    }
    
    if (maxImagesPerDay) {
      const images = parseInt(maxImagesPerDay);
      if (isNaN(images) || images < MIN_RATE_LIMIT) {
        errors.images = `Must be at least ${MIN_RATE_LIMIT}`;
      } else if (images > MAX_RATE_LIMIT) {
        errors.images = `Max is ${MAX_RATE_LIMIT.toLocaleString()}`;
      }
    }
    
    return errors;
  }, [customRpm, customRpd, maxImagesPerDay]);

  const hasValidationErrors = Object.keys(validateRateLimits).length > 0;

  const handleAttemptSave = () => {
    if (hasValidationErrors) {
      toast.error('Please fix validation errors');
      return;
    }

    // If demoting from admin role, show confirmation
    if (isDemotion) {
      onOpenChange(false); // Close main dialog
      setShowDemotionConfirm(true);
      return;
    }

    // Otherwise proceed directly
    executeSave();
  };

  const executeSave = async () => {
    if (!user) return;

    // Validate rate limits
    const rpmValue = customRpm ? parseInt(customRpm) : null;
    const rpdValue = customRpd ? parseInt(customRpd) : null;
    const maxImagesValue = maxImagesPerDay ? parseInt(maxImagesPerDay) : null;

    setSaving(true);
    try {
      // Update role if changed
      if (selectedRole !== currentRole) {
        const { data: roleResult, error: roleError } = await supabase.rpc('assign_user_role', {
          _target_user_id: user.user_id,
          _role: selectedRole
        });

        if (roleError) throw roleError;

        const result = roleResult as { success: boolean; error?: string };
        if (!result.success) {
          throw new Error(result.error || 'Failed to assign role');
        }
      }

      // Update account type if changed
      if (selectedAccountType !== user.account_type) {
        const { data: typeResult, error: typeError } = await supabase.rpc('update_account_type', {
          _target_user_id: user.user_id,
          _account_type: selectedAccountType
        });

        if (typeError) throw typeError;

        const result = typeResult as { success: boolean; error?: string };
        if (!result.success) {
          throw new Error(result.error || 'Failed to update account type');
        }
      }

      // Update rate limits if changed
      const rateLimitsChanged = 
        rpmValue !== user.custom_rpm || 
        rpdValue !== user.custom_rpd || 
        maxImagesValue !== user.max_images_per_day;

      if (rateLimitsChanged) {
        const { error: limitsError } = await supabase
          .from('profiles')
          .update({
            custom_rpm: rpmValue,
            custom_rpd: rpdValue,
            max_images_per_day: maxImagesValue,
          })
          .eq('user_id', user.user_id);

        if (limitsError) throw limitsError;

        // Log the rate limit change to audit logs
        await supabase.rpc('log_admin_action', {
          _action: 'user_rate_limits_updated',
          _target_type: 'profiles',
          _target_id: user.user_id,
          _old_value: {
            custom_rpm: user.custom_rpm,
            custom_rpd: user.custom_rpd,
            max_images_per_day: user.max_images_per_day
          },
          _new_value: {
            custom_rpm: rpmValue,
            custom_rpd: rpdValue,
            max_images_per_day: maxImagesValue
          }
        });
      }

      toast.success('User updated successfully');
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      devLog.error('Error updating user:', error);
      toast.error('Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  const getInitials = () => {
    if (user?.display_name) {
      return user.display_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    if (user?.username) {
      return user.username.slice(0, 2).toUpperCase();
    }
    return 'U';
  };

  const getRoleBadgeVariant = (role: AppRole) => {
    switch (role) {
      case 'super_admin':
        return 'destructive';
      case 'admin':
        return 'default';
      case 'moderator':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Edit User Access
          </DialogTitle>
          <DialogDescription>
            Modify role and account type for this user.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* User info */}
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <Avatar className="h-12 w-12">
              <AvatarImage src={user.avatar_url || undefined} />
              <AvatarFallback>{getInitials()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">
                {user.display_name || user.username || 'Unnamed User'}
              </p>
              {user.username && (
                <p className="text-sm text-muted-foreground truncate">@{user.username}</p>
              )}
            </div>
            {isOwner && (
              <Badge variant="destructive">Owner</Badge>
            )}
          </div>

          {cannotModify ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {isOwner 
                  ? 'The system owner cannot be modified. This is a security invariant.'
                  : 'Only the system owner can modify other super_admins.'}
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {/* Role selection */}
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={selectedRole}
                  onValueChange={(value) => setSelectedRole(value as AppRole)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">user</Badge>
                        <span className="text-muted-foreground text-sm">Default access</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="moderator">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">moderator</Badge>
                        <span className="text-muted-foreground text-sm">Content review</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="admin">
                      <div className="flex items-center gap-2">
                        <Badge className="text-xs">admin</Badge>
                        <span className="text-muted-foreground text-sm">Full management</span>
                      </div>
                    </SelectItem>
                    {callerIsOwner && (
                      <SelectItem value="super_admin">
                        <div className="flex items-center gap-2">
                          <Badge variant="destructive" className="text-xs">super_admin</Badge>
                          <span className="text-muted-foreground text-sm">Full system control</span>
                        </div>
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {callerIsOwner 
                    ? 'As the owner, you can assign any role including super_admin.'
                    : 'super_admin role can only be assigned by the system owner.'}
                </p>
              </div>

              {/* Account type selection */}
              <div className="space-y-2">
                <Label>Account Type</Label>
                <Select
                  value={selectedAccountType}
                  onValueChange={(value) => setSelectedAccountType(value as AccountType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">
                      <div className="flex items-center gap-2">
                        <span>Normal</span>
                        <span className="text-muted-foreground text-sm">— Standard access</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="partner">
                      <div className="flex items-center gap-2">
                        <span>Partner</span>
                        <span className="text-muted-foreground text-sm">— Partner-only models</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Partners gain access to partner-only models but no admin privileges.
                </p>
              </div>

              {/* Rate Limits Section */}
              <Separator className="my-4" />
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-muted-foreground" />
                  <Label className="font-medium">Rate Limits</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  1 - {MAX_RATE_LIMIT.toLocaleString()} (leave blank for defaults)
                </p>
                
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">RPM</Label>
                    <Input
                      type="number"
                      placeholder="60"
                      value={customRpm}
                      onChange={(e) => setCustomRpm(e.target.value)}
                      min={MIN_RATE_LIMIT}
                      max={MAX_RATE_LIMIT}
                      className={`h-9 ${validateRateLimits.rpm ? 'border-destructive' : ''}`}
                    />
                    {validateRateLimits.rpm && (
                      <p className="text-xs text-destructive">{validateRateLimits.rpm}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">RPD</Label>
                    <Input
                      type="number"
                      placeholder="1000"
                      value={customRpd}
                      onChange={(e) => setCustomRpd(e.target.value)}
                      min={MIN_RATE_LIMIT}
                      max={MAX_RATE_LIMIT}
                      className={`h-9 ${validateRateLimits.rpd ? 'border-destructive' : ''}`}
                    />
                    {validateRateLimits.rpd && (
                      <p className="text-xs text-destructive">{validateRateLimits.rpd}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Images/Day</Label>
                    <Input
                      type="number"
                      placeholder="100"
                      value={maxImagesPerDay}
                      onChange={(e) => setMaxImagesPerDay(e.target.value)}
                      min={MIN_RATE_LIMIT}
                      max={MAX_RATE_LIMIT}
                      className={`h-9 ${validateRateLimits.images ? 'border-destructive' : ''}`}
                    />
                    {validateRateLimits.images && (
                      <p className="text-xs text-destructive">{validateRateLimits.images}</p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {!cannotModify && (
            <Button onClick={handleAttemptSave} disabled={saving || hasValidationErrors}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>

      {/* Demotion Confirmation Dialog */}
      <TypeToConfirmDialog
        open={showDemotionConfirm}
        onOpenChange={(open) => {
          setShowDemotionConfirm(open);
          if (!open) {
            // Re-open main dialog if user cancels
            onOpenChange(true);
          }
        }}
        title="Confirm Role Demotion"
        message="This action will remove administrative privileges from this user."
        confirmWord="CONFIRM"
        variant="warning"
        isLoading={saving}
        confirmButtonText="Confirm Demotion"
        onConfirm={executeSave}
      >
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <p className="text-sm text-amber-300 font-medium">Role Change Warning</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-muted-foreground">User:</span>
            <span className="text-foreground">{user?.display_name || user?.username || 'Unknown'}</span>
            
            <span className="text-muted-foreground">Current Role:</span>
            <Badge variant={getRoleBadgeVariant(currentRole)} className="w-fit">{currentRole}</Badge>
            
            <span className="text-muted-foreground">New Role:</span>
            <Badge variant={getRoleBadgeVariant(selectedRole)} className="w-fit">{selectedRole}</Badge>
          </div>
          <p className="text-xs text-amber-400 mt-2">
            This user will lose access to admin features and panels.
          </p>
        </div>
      </TypeToConfirmDialog>
    </Dialog>
  );
}
