import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAdmin } from '@/contexts/AdminContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Settings, Shield, Bell, Globe, UserPlus, Trash2, Copy, Check, Crown, Eye, Clock, Link, Wrench, AlertTriangle, Key, Coins, Calendar } from 'lucide-react';
import { InviteTokenDialog } from '@/components/admin/InviteTokenDialog';
import { toast } from 'sonner';
import { useMaintenanceMode } from '@/components/MaintenanceBanner';
import { useAuthSettings } from '@/hooks/useAuthSettings';

interface AdminInvite {
  id: string;
  token: string;
  role: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

export default function AdminSettings() {
  const { isOwner, isSuperAdmin } = useAdmin();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const queryClient = useQueryClient();
  
  // Maintenance mode state
  const { isMaintenanceMode, maintenanceMessage, maintenancePages, scheduledStart, scheduledEnd, isLoading: maintenanceLoading } = useMaintenanceMode();
  const [editedMessage, setEditedMessage] = useState('');
  const [selectedPages, setSelectedPages] = useState<string[]>(['/generate', '/dashboard']);
  const [editedScheduleStart, setEditedScheduleStart] = useState<string>('');
  const [editedScheduleEnd, setEditedScheduleEnd] = useState<string>('');
  
  // Available pages that can be put under maintenance
  const AVAILABLE_MAINTENANCE_PAGES = [
    { path: '/generate', label: 'Generate Page' },
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/notifications', label: 'Notifications' },
  ];
  
  // Auth settings from hook
  const { 
    dailyFreeCredits, 
    defaultRpm, 
    defaultRpd, 
    otpEnabled, 
    magicLinkEnabled,
    isLoading: settingsLoading 
  } = useAuthSettings();
  
  // Local state for editing settings
  const [editedDailyCredits, setEditedDailyCredits] = useState<number>(10);
  const [editedRpm, setEditedRpm] = useState<number>(60);
  const [editedRpd, setEditedRpd] = useState<number>(1000);
  const [editedOtpEnabled, setEditedOtpEnabled] = useState<boolean>(false);
  const [editedMagicLinkEnabled, setEditedMagicLinkEnabled] = useState<boolean>(false);
  
  // Initialize editedMessage and selectedPages when data loads
  useEffect(() => {
    if (maintenanceMessage) {
      setEditedMessage(maintenanceMessage);
    }
  }, [maintenanceMessage]);
  
  useEffect(() => {
    if (maintenancePages && maintenancePages.length > 0) {
      setSelectedPages(maintenancePages);
    }
  }, [maintenancePages]);
  
  // Initialize schedule times from fetched values
  useEffect(() => {
    if (scheduledStart) {
      // Convert to local datetime-local format
      const localStart = new Date(scheduledStart.getTime() - scheduledStart.getTimezoneOffset() * 60000)
        .toISOString().slice(0, 16);
      setEditedScheduleStart(localStart);
    }
    if (scheduledEnd) {
      const localEnd = new Date(scheduledEnd.getTime() - scheduledEnd.getTimezoneOffset() * 60000)
        .toISOString().slice(0, 16);
      setEditedScheduleEnd(localEnd);
    }
  }, [scheduledStart, scheduledEnd]);
  
  // Initialize settings from fetched values
  useEffect(() => {
    setEditedDailyCredits(dailyFreeCredits);
    setEditedRpm(defaultRpm);
    setEditedRpd(defaultRpd);
    setEditedOtpEnabled(otpEnabled);
    setEditedMagicLinkEnabled(magicLinkEnabled);
  }, [dailyFreeCredits, defaultRpm, defaultRpd, otpEnabled, magicLinkEnabled]);
  
  // Mutation to toggle maintenance mode
  const toggleMaintenanceMutation = useMutation({
    mutationFn: async ({ enabled, message }: { enabled: boolean; message: string }) => {
      const { error: modeError } = await supabase
        .from('system_settings')
        .upsert({ 
          key: 'maintenance_mode', 
          value: enabled, 
          updated_at: new Date().toISOString() 
        }, { onConflict: 'key' });
      
      if (modeError) throw modeError;
      
      const { error: msgError } = await supabase
        .from('system_settings')
        .upsert({ 
          key: 'maintenance_message', 
          value: message, 
          updated_at: new Date().toISOString() 
        }, { onConflict: 'key' });
      
      if (msgError) throw msgError;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-mode'] });
      toast.success(variables.enabled ? 'Maintenance mode enabled' : 'Maintenance mode disabled');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update maintenance mode');
    },
  });
  
  // Mutation to update individual settings
  const updateSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: unknown }) => {
      const { error } = await supabase
        .from('system_settings')
        .upsert({ 
          key, 
          value: value as any, 
          updated_at: new Date().toISOString() 
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth-settings'] });
      toast.success('Setting updated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update setting');
    },
  });

  const { data: invites, refetch: refetchInvites } = useQuery({
    queryKey: ['admin-invites'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_invites')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as AdminInvite[];
    },
    enabled: isOwner,
  });

  const handleCopyInviteLink = async (token: string) => {
    const link = `${window.location.origin}/admin/invite/${token}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedToken(token);
      toast.success('Link copied to clipboard');
      setTimeout(() => setCopiedToken(null), 2000);
    } catch (error) {
      toast.error('Failed to copy link');
    }
  };

  const handleDeleteInvite = async (inviteId: string) => {
    try {
      const { error } = await supabase
        .from('admin_invites')
        .delete()
        .eq('id', inviteId);
      
      if (error) throw error;
      
      toast.success('Invite deleted');
      refetchInvites();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete invite');
    }
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

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'Super Admin';
      case 'admin':
        return 'Admin';
      case 'moderator':
        return 'Moderator';
      default:
        return role;
    }
  };

  const isExpired = (expiresAt: string) => new Date(expiresAt) < new Date();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-slate-400 text-sm mt-1">Manage platform configuration</p>
      </div>

      <div className="grid gap-6">
        {/* Maintenance Mode - Super Admin / Owner Only */}
        {(isOwner || isSuperAdmin) && (
          <Card className="bg-admin-surface border-admin-border">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/20">
                  <Wrench className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <CardTitle className="text-white flex items-center gap-2">
                    Maintenance Mode
                    {isMaintenanceMode && (
                      <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                        Active
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    Block user access during scheduled maintenance
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Warning banner when active */}
              {isMaintenanceMode && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>Maintenance mode is active. Regular users cannot access: {selectedPages.join(', ') || 'no pages selected'}.</span>
                </div>
              )}
              
              {/* Toggle switch */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-white">Enable Maintenance Mode</p>
                  <p className="text-sm text-slate-400">Block access to protected routes for regular users</p>
                </div>
                <Switch 
                  checked={isMaintenanceMode}
                  onCheckedChange={(checked) => toggleMaintenanceMutation.mutate({ 
                    enabled: checked, 
                    message: editedMessage || 'System is under maintenance.' 
                  })}
                  disabled={toggleMaintenanceMutation.isPending || maintenanceLoading}
                />
              </div>
              
              <Separator className="bg-admin-border" />
              
              {/* Custom message */}
              <div className="grid gap-2">
                <Label htmlFor="maintenance-message" className="text-slate-300">
                  Maintenance Message
                </Label>
                <Textarea
                  id="maintenance-message"
                  value={editedMessage}
                  onChange={(e) => setEditedMessage(e.target.value)}
                  placeholder="Enter a message to display during maintenance..."
                  className="bg-admin-background border-admin-border text-white min-h-[80px]"
                />
                <p className="text-xs text-slate-500">
                  This message will be shown to users on the maintenance screen
                </p>
              </div>
              
              {/* Save message button (only if message changed) */}
              {editedMessage !== maintenanceMessage && (
                <Button 
                  onClick={() => toggleMaintenanceMutation.mutate({ 
                    enabled: isMaintenanceMode, 
                    message: editedMessage 
                  })}
                  disabled={toggleMaintenanceMutation.isPending}
                  className="bg-admin-accent hover:bg-admin-accent-hover"
                >
                  Save Message
                </Button>
              )}
              
              <Separator className="bg-admin-border" />
              
              {/* Affected Pages Multi-select */}
              <div className="grid gap-3">
                <Label className="text-slate-300">Affected Pages</Label>
                <p className="text-xs text-slate-500 -mt-1">
                  Select which pages should be blocked during maintenance
                </p>
                
                <div className="space-y-2">
                  {AVAILABLE_MAINTENANCE_PAGES.map(({ path, label }) => (
                    <div key={path} className="flex items-center gap-3">
                      <Checkbox
                        id={`page-${path}`}
                        checked={selectedPages.includes(path)}
                        onCheckedChange={(checked) => {
                          const newPages = checked 
                            ? [...selectedPages, path]
                            : selectedPages.filter(p => p !== path);
                          setSelectedPages(newPages);
                        }}
                      />
                      <Label 
                        htmlFor={`page-${path}`} 
                        className="text-white font-normal cursor-pointer"
                      >
                        {label} <code className="text-xs text-slate-400">{path}</code>
                      </Label>
                    </div>
                  ))}
                </div>
                
                {/* Show save button if pages changed */}
                {JSON.stringify(selectedPages.sort()) !== JSON.stringify((maintenancePages || []).slice().sort()) && (
                  <Button 
                    onClick={() => updateSettingMutation.mutate({ 
                      key: 'maintenance_pages', 
                      value: selectedPages 
                    })}
                    disabled={updateSettingMutation.isPending}
                    className="bg-admin-accent hover:bg-admin-accent-hover w-fit"
                  >
                    Save Affected Pages
                  </Button>
                )}
              </div>
              
              <Separator className="bg-admin-border" />
              
              {/* Schedule Maintenance Window */}
              <div className="grid gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  <Label className="text-slate-300 font-medium">Schedule Maintenance Window</Label>
                </div>
                <p className="text-xs text-slate-500 -mt-2">
                  Optionally schedule maintenance to start and end automatically. When scheduled, the countdown will be shown to users.
                </p>
                
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="schedule-start" className="text-slate-400 text-sm">Start Time</Label>
                    <Input
                      id="schedule-start"
                      type="datetime-local"
                      value={editedScheduleStart}
                      onChange={(e) => setEditedScheduleStart(e.target.value)}
                      className="bg-admin-background border-admin-border text-white"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="schedule-end" className="text-slate-400 text-sm">End Time</Label>
                    <Input
                      id="schedule-end"
                      type="datetime-local"
                      value={editedScheduleEnd}
                      onChange={(e) => setEditedScheduleEnd(e.target.value)}
                      className="bg-admin-background border-admin-border text-white"
                    />
                  </div>
                </div>
                
                {/* Validation warning */}
                {editedScheduleStart && editedScheduleEnd && new Date(editedScheduleStart) >= new Date(editedScheduleEnd) && (
                  <div className="flex items-center gap-2 p-2 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                    <AlertTriangle className="h-3 w-3" />
                    <span>End time must be after start time</span>
                  </div>
                )}
                
                <div className="flex gap-2">
                  <Button 
                    onClick={async () => {
                      const startVal = editedScheduleStart ? new Date(editedScheduleStart).toISOString() : null;
                      const endVal = editedScheduleEnd ? new Date(editedScheduleEnd).toISOString() : null;
                      
                      if (startVal && endVal && new Date(startVal) >= new Date(endVal)) {
                        toast.error('End time must be after start time');
                        return;
                      }
                      
                      await updateSettingMutation.mutateAsync({ key: 'scheduled_maintenance_start', value: startVal });
                      await updateSettingMutation.mutateAsync({ key: 'scheduled_maintenance_end', value: endVal });
                      queryClient.invalidateQueries({ queryKey: ['maintenance-mode'] });
                      toast.success('Maintenance schedule saved');
                    }}
                    disabled={updateSettingMutation.isPending}
                    className="bg-admin-accent hover:bg-admin-accent-hover"
                  >
                    Save Schedule
                  </Button>
                  {(editedScheduleStart || editedScheduleEnd) && (
                    <Button 
                      variant="outline"
                      onClick={async () => {
                        setEditedScheduleStart('');
                        setEditedScheduleEnd('');
                        await updateSettingMutation.mutateAsync({ key: 'scheduled_maintenance_start', value: null });
                        await updateSettingMutation.mutateAsync({ key: 'scheduled_maintenance_end', value: null });
                        queryClient.invalidateQueries({ queryKey: ['maintenance-mode'] });
                        toast.success('Schedule cleared');
                      }}
                      disabled={updateSettingMutation.isPending}
                      className="border-admin-border text-slate-300 hover:bg-admin-background"
                    >
                      Clear Schedule
                    </Button>
                  )}
                </div>
                
                {/* Current schedule display */}
                {scheduledStart && scheduledEnd && (
                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <p className="text-blue-400 text-sm flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span>
                        <strong>Scheduled:</strong>{' '}
                        {scheduledStart.toLocaleString()} — {scheduledEnd.toLocaleString()}
                      </span>
                    </p>
                    {scheduledStart > new Date() && (
                      <p className="text-blue-300/70 text-xs mt-1 ml-6">
                        Maintenance will start automatically at the scheduled time
                      </p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Authentication Methods - Super Admin / Owner Only */}
        {(isOwner || isSuperAdmin) && (
          <Card className="bg-admin-surface border-admin-border">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/20">
                  <Key className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <CardTitle className="text-white">Authentication Methods</CardTitle>
                  <CardDescription className="text-slate-400">
                    Configure available login methods for users
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* OTP Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-white">Enable OTP Login</p>
                  <p className="text-sm text-slate-400">Allow users to sign in with email OTP codes</p>
                </div>
                <Switch 
                  checked={editedOtpEnabled}
                  onCheckedChange={(checked) => {
                    setEditedOtpEnabled(checked);
                    updateSettingMutation.mutate({ key: 'otp_auth_enabled', value: checked });
                  }}
                  disabled={updateSettingMutation.isPending || settingsLoading}
                />
              </div>
              <Separator className="bg-admin-border" />
              {/* Magic Link Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-white">Enable Magic Link Login</p>
                  <p className="text-sm text-slate-400">Allow passwordless login via email link</p>
                </div>
                <Switch 
                  checked={editedMagicLinkEnabled}
                  onCheckedChange={(checked) => {
                    setEditedMagicLinkEnabled(checked);
                    updateSettingMutation.mutate({ key: 'magic_link_enabled', value: checked });
                  }}
                  disabled={updateSettingMutation.isPending || settingsLoading}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Credits Configuration - Super Admin / Owner Only */}
        {(isOwner || isSuperAdmin) && (
          <Card className="bg-admin-surface border-admin-border">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/20">
                  <Coins className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <CardTitle className="text-white">Credits Configuration</CardTitle>
                  <CardDescription className="text-slate-400">
                    Configure default credit allocations for users
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="daily-free-credits" className="text-slate-300">
                  Default Daily Free Credits
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="daily-free-credits"
                    type="number"
                    min="0"
                    max="1000"
                    value={editedDailyCredits}
                    onChange={(e) => setEditedDailyCredits(Number(e.target.value))}
                    className="bg-admin-background border-admin-border text-white"
                    disabled={settingsLoading}
                  />
                  {editedDailyCredits !== dailyFreeCredits && (
                    <Button 
                      onClick={() => updateSettingMutation.mutate({ 
                        key: 'daily_free_credits', 
                        value: editedDailyCredits 
                      })}
                      disabled={updateSettingMutation.isPending}
                      className="bg-admin-accent hover:bg-admin-accent-hover"
                    >
                      Save
                    </Button>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  Credits given to users at daily reset. Affects new users and daily reset logic.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Invite Management - Owner Only */}
        {isOwner && (
          <Card className="bg-admin-surface border-admin-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-admin-accent/20">
                    <UserPlus className="h-5 w-5 text-admin-accent" />
                  </div>
                  <div>
                    <CardTitle className="text-white">Admin Invites</CardTitle>
                    <CardDescription className="text-slate-400">
                      Create and manage invite tokens for new team members
                    </CardDescription>
                  </div>
                </div>
                <Button onClick={() => setInviteDialogOpen(true)} className="bg-admin-accent hover:bg-admin-accent-hover">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Create Invite
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {invites && invites.length > 0 ? (
                <div className="space-y-3">
                  {invites.map((invite) => (
                    <div
                      key={invite.id}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        invite.used_at 
                          ? 'bg-admin-background/50 border-admin-border/50 opacity-60' 
                          : isExpired(invite.expires_at)
                          ? 'bg-admin-danger/5 border-admin-danger/20'
                          : 'bg-admin-background border-admin-border'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Badge className={`${getRoleBadgeClass(invite.role)} flex items-center gap-1`}>
                          {getRoleIcon(invite.role)}
                          {getRoleDisplayName(invite.role)}
                        </Badge>
                        <div>
                          <div className="flex items-center gap-2">
                            <code className="text-xs text-slate-400 font-mono">
                              {invite.token.slice(0, 16)}...
                            </code>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-slate-600 text-slate-400">
                              <Link className="h-2.5 w-2.5 mr-1" />
                              Single-use
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {invite.used_at ? (
                              <span className="text-admin-success">Used</span>
                            ) : isExpired(invite.expires_at) ? (
                              <span className="text-admin-danger">Expired</span>
                            ) : (
                              <>Expires {new Date(invite.expires_at).toLocaleDateString()}</>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!invite.used_at && !isExpired(invite.expires_at) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyInviteLink(invite.token)}
                            className="text-slate-400 hover:text-white"
                          >
                            {copiedToken === invite.token ? (
                              <Check className="h-4 w-4 text-admin-success" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        {!invite.used_at && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteInvite(invite.id)}
                            className="text-slate-400 hover:text-admin-danger"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400">
                  <UserPlus className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No invite tokens created yet</p>
                  <p className="text-sm">Create an invite to add new team members</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* General Settings */}
        <Card className="bg-admin-surface border-admin-border">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-admin-accent/20">
                <Settings className="h-5 w-5 text-admin-accent" />
              </div>
              <div>
                <CardTitle className="text-white">General Settings</CardTitle>
                <CardDescription className="text-slate-400">
                  Basic platform configuration
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="platform-name" className="text-slate-300">Platform Name</Label>
              <Input
                id="platform-name"
                defaultValue="AIGen Platform"
                className="bg-admin-background border-admin-border text-white"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="support-email" className="text-slate-300">Support Email</Label>
              <Input
                id="support-email"
                type="email"
                defaultValue="support@aigen.com"
                className="bg-admin-background border-admin-border text-white"
              />
            </div>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card className="bg-admin-surface border-admin-border">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-admin-warning/20">
                <Shield className="h-5 w-5 text-admin-warning" />
              </div>
              <div>
                <CardTitle className="text-white">Security</CardTitle>
                <CardDescription className="text-slate-400">
                  Security and access control settings
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-white">Two-Factor Authentication</p>
                <p className="text-sm text-slate-400">Require 2FA for admin accounts</p>
              </div>
              <Switch />
            </div>
            <Separator className="bg-admin-border" />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-white">Session Timeout</p>
                <p className="text-sm text-slate-400">Auto-logout after inactivity</p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card className="bg-admin-surface border-admin-border">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-admin-success/20">
                <Bell className="h-5 w-5 text-admin-success" />
              </div>
              <div>
                <CardTitle className="text-white">Notifications</CardTitle>
                <CardDescription className="text-slate-400">
                  Configure system notifications
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-white">Email Alerts</p>
                <p className="text-sm text-slate-400">Receive email for critical events</p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator className="bg-admin-border" />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-white">Usage Alerts</p>
                <p className="text-sm text-slate-400">Notify when approaching limits</p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        {/* API Rate Limits - Super Admin / Owner Only */}
        {(isOwner || isSuperAdmin) && (
          <Card className="bg-admin-surface border-admin-border">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-admin-danger/20">
                  <Globe className="h-5 w-5 text-admin-danger" />
                </div>
                <div>
                  <CardTitle className="text-white">API Rate Limits</CardTitle>
                  <CardDescription className="text-slate-400">
                    Default rate limits for API requests (can be overridden per-user)
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* RPM */}
              <div className="grid gap-2">
                <Label htmlFor="default-rpm" className="text-slate-300">
                  Default RPM (Requests per minute)
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="default-rpm"
                    type="number"
                    min="1"
                    max="10000"
                    value={editedRpm}
                    onChange={(e) => setEditedRpm(Number(e.target.value))}
                    className="bg-admin-background border-admin-border text-white"
                    disabled={settingsLoading}
                  />
                  {editedRpm !== defaultRpm && (
                    <Button 
                      onClick={() => updateSettingMutation.mutate({ 
                        key: 'default_rpm', 
                        value: editedRpm 
                      })}
                      disabled={updateSettingMutation.isPending}
                      className="bg-admin-accent hover:bg-admin-accent-hover"
                    >
                      Save
                    </Button>
                  )}
                </div>
              </div>
              
              {/* RPD */}
              <div className="grid gap-2">
                <Label htmlFor="default-rpd" className="text-slate-300">
                  Default RPD (Requests per day)
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="default-rpd"
                    type="number"
                    min="1"
                    max="100000"
                    value={editedRpd}
                    onChange={(e) => setEditedRpd(Number(e.target.value))}
                    className="bg-admin-background border-admin-border text-white"
                    disabled={settingsLoading}
                  />
                  {editedRpd !== defaultRpd && (
                    <Button 
                      onClick={() => updateSettingMutation.mutate({ 
                        key: 'default_rpd', 
                        value: editedRpd 
                      })}
                      disabled={updateSettingMutation.isPending}
                      className="bg-admin-accent hover:bg-admin-accent-hover"
                    >
                      Save
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Invite Token Dialog */}
      <InviteTokenDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        onSuccess={() => refetchInvites()}
      />
    </div>
  );
}
