import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAdmin } from '@/contexts/AdminContext';
import { useAdminReadOnly } from '@/components/admin/AdminProtectedRoute';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Search, Users, Shield, UserCheck, UserPlus, Crown, Mail, Gauge, AlertTriangle, RefreshCw, Info, CheckCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { RoleAssignmentDialog } from '@/components/admin/RoleAssignmentDialog';
import { InviteTokenDialog } from '@/components/admin/InviteTokenDialog';
import { toast } from 'sonner';
import type { AppRole, AccountType } from '@/contexts/AdminContext';

interface UserProfile {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  account_type: AccountType;
  email: string | null;
  custom_rpm: number | null;
  custom_rpd: number | null;
  max_images_per_day: number | null;
}

// Role hierarchy for sorting (lower number = higher priority)
const ROLE_PRIORITY: Record<string, number> = {
  'owner': 0,
  'super_admin': 1,
  'admin': 2,
  'moderator': 3,
  'user': 4,
};

// Auth provider display names
const getAuthProvider = (email: string | null): { label: string; icon: 'google' | 'email' } => {
  // For now, we can infer Google users by their avatar or metadata
  // This is a simplified approach - in production you'd check auth.users.app_metadata
  return { label: 'Email', icon: 'email' };
};

export default function AdminUsers() {
  const { isSuperAdmin, isOwner: callerIsOwner } = useAdmin();
  const { isReadOnly } = useAdminReadOnly();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Check for orphaned users (auth.users without profiles)
  const { data: orphanedCount, refetch: refetchOrphanedCount } = useQuery({
    queryKey: ['orphaned-users-count'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_orphaned_user_count');
      if (error) {
        console.error('Failed to get orphaned count:', error);
        return 0;
      }
      return data as number;
    },
    enabled: isSuperAdmin,
  });

  // Check for recent fallback events (profiles created via client fallback in last 24h)
  const { data: fallbackEvents } = useQuery({
    queryKey: ['profile-fallback-events'],
    queryFn: async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const { count, error } = await supabase
        .from('admin_audit_logs')
        .select('*', { count: 'exact', head: true })
        .eq('action', 'profile_created_via_fallback')
        .gte('created_at', yesterday.toISOString());
      
      if (error) {
        console.error('Failed to get fallback events:', error);
        return 0;
      }
      return count || 0;
    },
    enabled: isSuperAdmin,
  });

  const handleSyncProfiles = async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.rpc('sync_missing_profiles');
      if (error) throw error;
      
      toast.success(`Synced ${data} missing profile(s)`);
      refetchOrphanedCount();
      queryClient.invalidateQueries({ queryKey: ['admin-profiles'] });
    } catch (error: any) {
      toast.error('Failed to sync profiles: ' + error.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const { data: profiles, isLoading } = useQuery({
    queryKey: ['admin-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as UserProfile[];
    },
  });

  const { data: userRoles, refetch: refetchRoles } = useQuery({
    queryKey: ['admin-user-roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('*');
      
      if (error) throw error;
      return data;
    },
  });

  const getRoleForUser = (userId: string): AppRole => {
    const roleRecord = userRoles?.find(r => r.user_id === userId);
    return (roleRecord?.role as AppRole) || 'user';
  };

  const getIsOwner = (userId: string) => {
    const roleRecord = userRoles?.find(r => r.user_id === userId);
    return roleRecord?.is_owner || false;
  };

  // Filter and sort profiles by role hierarchy
  const sortedAndFilteredProfiles = useMemo(() => {
    if (!profiles) return [];
    
    const filtered = profiles.filter(profile => 
      profile.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      profile.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      profile.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return filtered.sort((a, b) => {
      const aRole = getRoleForUser(a.user_id);
      const bRole = getRoleForUser(b.user_id);
      const aIsOwner = getIsOwner(a.user_id);
      const bIsOwner = getIsOwner(b.user_id);

      // Owners always first
      if (aIsOwner && !bIsOwner) return -1;
      if (!aIsOwner && bIsOwner) return 1;

      // Then by role priority
      const aPriority = ROLE_PRIORITY[aRole] ?? 4;
      const bPriority = ROLE_PRIORITY[bRole] ?? 4;
      
      if (aPriority !== bPriority) return aPriority - bPriority;

      // Same role: sort by name
      const aName = a.display_name || a.username || '';
      const bName = b.display_name || b.username || '';
      return aName.localeCompare(bName);
    });
  }, [profiles, userRoles, searchQuery]);

  const getRoleBadgeStyles = (role: string, isOwner: boolean): string => {
    if (isOwner) return 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white border-0';
    switch (role) {
      case 'super_admin': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'admin': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'moderator': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  const getRoleLabel = (role: string, isOwner: boolean): string => {
    if (isOwner) return 'Owner';
    return role.replace('_', ' ');
  };

  const handleEditUser = (profile: UserProfile) => {
    setSelectedUser(profile);
    setRoleDialogOpen(true);
  };

  const handleRoleUpdateSuccess = () => {
    refetchRoles();
    queryClient.invalidateQueries({ queryKey: ['admin-profiles'] });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">User Management</h1>
          <p className="text-slate-400 text-sm mt-1">Manage platform users and their roles</p>
        </div>
        {isSuperAdmin && !isReadOnly && (
          <Button onClick={() => setInviteDialogOpen(true)} className="bg-admin-accent hover:bg-admin-accent-hover">
            <UserPlus className="h-4 w-4 mr-2" />
            Create Invite
          </Button>
        )}
      </div>

      {/* Orphaned Users Warning */}
      {isSuperAdmin && orphanedCount !== undefined && orphanedCount > 0 && (
        <Alert className="bg-amber-500/10 border-amber-500/30">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-amber-200">
              <strong>{orphanedCount}</strong> user(s) in auth.users are missing profile records. 
              This may affect admin panel visibility.
            </span>
            <Button 
              size="sm" 
              variant="outline"
              onClick={handleSyncProfiles}
              disabled={isSyncing || isReadOnly}
              className="ml-4 border-amber-500/50 text-amber-200 hover:bg-amber-500/20"
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Sync Now
                </>
              )}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Fallback Events Info (when system is healthy but fallback was used) */}
      {isSuperAdmin && (orphanedCount === 0 || orphanedCount === undefined) && fallbackEvents !== undefined && fallbackEvents > 0 && (
        <Alert className="bg-blue-500/10 border-blue-500/30">
          <Info className="h-4 w-4 text-blue-400" />
          <AlertDescription className="text-blue-200">
            <strong>{fallbackEvents}</strong> profile(s) were created via client fallback in the last 24 hours.
            This is normal but indicates the server-side trigger may have been skipped.
          </AlertDescription>
        </Alert>
      )}

      {/* System Health Card */}
      {isSuperAdmin && (
        <Card className="bg-admin-surface border-admin-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${(orphanedCount === 0 || orphanedCount === undefined) ? 'bg-admin-success/20' : 'bg-admin-warning/20'}`}>
                {(orphanedCount === 0 || orphanedCount === undefined) ? (
                  <CheckCircle className="h-5 w-5 text-admin-success" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-admin-warning" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-lg font-semibold text-white">
                  {(orphanedCount === 0 || orphanedCount === undefined) ? '✅ System Healthy' : '⚠️ Attention Needed'}
                </p>
                <p className="text-sm text-slate-400">
                  {orphanedCount === 0 || orphanedCount === undefined ? 'All users have profiles' : `${orphanedCount} orphaned user(s) detected`}
                  {fallbackEvents !== undefined && fallbackEvents > 0 && ` • ${fallbackEvents} fallback event(s) today`}
                </p>
              </div>
              <div className="text-xs text-slate-500">
                Auto-sync: Hourly
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-admin-surface border-admin-border">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-admin-accent/20">
              <Users className="h-5 w-5 text-admin-accent" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{profiles?.length || 0}</p>
              <p className="text-sm text-slate-400">Total Users</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-admin-surface border-admin-border">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-admin-success/20">
              <UserCheck className="h-5 w-5 text-admin-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {profiles?.filter(p => p.account_type === 'partner').length || 0}
              </p>
              <p className="text-sm text-slate-400">Partners</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-admin-surface border-admin-border">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-admin-warning/20">
              <Shield className="h-5 w-5 text-admin-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {userRoles?.filter(r => r.role !== 'user').length || 0}
              </p>
              <p className="text-sm text-slate-400">Staff Members</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className="bg-admin-surface border-admin-border">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-admin-background border-admin-border text-white"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-admin-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="p-4 space-y-2">
                {sortedAndFilteredProfiles.map((profile) => {
                  const role = getRoleForUser(profile.user_id);
                  const isOwner = getIsOwner(profile.user_id);
                  const hasGoogleAvatar = profile.avatar_url?.includes('googleusercontent.com') || 
                                          profile.avatar_url?.includes('google.com');
                  const authProvider = hasGoogleAvatar ? 'Google' : 'Email';
                  
                  return (
                    <div
                      key={profile.user_id}
                      className="flex items-center justify-between p-4 rounded-lg bg-admin-background border border-admin-border hover:border-admin-accent/50 transition-colors h-[88px]"
                    >
                      {/* Left side: Avatar + Info */}
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        <div className="relative flex-shrink-0">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={profile.avatar_url || undefined} />
                            <AvatarFallback className="bg-admin-accent/20 text-admin-accent text-lg">
                              {profile.display_name?.charAt(0) || profile.username?.charAt(0) || '?'}
                            </AvatarFallback>
                          </Avatar>
                          {isOwner && (
                            <div className="absolute -top-1 -right-1 bg-gradient-to-r from-amber-500 to-yellow-500 rounded-full p-1">
                              <Crown className="h-3 w-3 text-white" />
                            </div>
                          )}
                        </div>
                        
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-white truncate">
                              {profile.display_name || profile.username || 'Unknown User'}
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-2 text-sm text-slate-400 mt-0.5">
                            <span className="truncate">@{profile.username || 'no-username'}</span>
                          </div>
                          
                          {profile.email && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                              <Mail className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">{profile.email}</span>
                              <span className="text-slate-600">•</span>
                              <span className="text-slate-500 flex-shrink-0">
                                via {authProvider}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Right side: Badges + Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                        {profile.account_type === 'partner' && (
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                            Partner
                          </Badge>
                        )}
                        
                        <Badge className={`${getRoleBadgeStyles(role, isOwner)} capitalize`}>
                          {isOwner && <Crown className="h-3 w-3 mr-1" />}
                          {getRoleLabel(role, isOwner)}
                        </Badge>

                        {/* Rate Limits Badge */}
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge 
                                variant="outline" 
                                className={
                                  (profile.custom_rpm || profile.custom_rpd || (profile.max_images_per_day && profile.max_images_per_day !== 100))
                                    ? "bg-orange-500/20 text-orange-400 border-orange-500/30 cursor-help" 
                                    : "bg-slate-500/10 text-slate-500 border-slate-500/20 cursor-help"
                                }
                              >
                                <Gauge className="h-3 w-3 mr-1" />
                                {(profile.custom_rpm || profile.custom_rpd || (profile.max_images_per_day && profile.max_images_per_day !== 100)) ? 'Custom' : 'Default'}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              <div className="space-y-1">
                                <p>RPM: {profile.custom_rpm || '60 (default)'}</p>
                                <p>RPD: {profile.custom_rpd || '1000 (default)'}</p>
                                <p>Images/Day: {profile.max_images_per_day || '100 (default)'}</p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        
                        {isSuperAdmin && !isOwner && !isReadOnly && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-slate-400 hover:text-white h-8 px-3"
                            onClick={() => handleEditUser(profile)}
                          >
                            Edit
                          </Button>
                        )}
                        {isSuperAdmin && isOwner && (
                          <div className="w-[52px]" /> 
                        )}
                      </div>
                    </div>
                  );
                })}
                {sortedAndFilteredProfiles.length === 0 && (
                  <div className="text-center py-12 text-slate-400">
                    No users found
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Role Assignment Dialog */}
      <RoleAssignmentDialog
        open={roleDialogOpen}
        onOpenChange={setRoleDialogOpen}
        user={selectedUser}
        currentRole={selectedUser ? getRoleForUser(selectedUser.user_id) : 'user'}
        isOwner={selectedUser ? getIsOwner(selectedUser.user_id) : false}
        isTargetSuperAdmin={selectedUser ? getRoleForUser(selectedUser.user_id) === 'super_admin' : false}
        callerIsOwner={callerIsOwner}
        onSuccess={handleRoleUpdateSuccess}
      />

      {/* Invite Token Dialog */}
      <InviteTokenDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        onSuccess={() => {}}
      />
    </div>
  );
}
