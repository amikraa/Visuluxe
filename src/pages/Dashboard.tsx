import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useAdmin } from '@/contexts/AdminContext';
import { GlobalNavbar } from '@/components/GlobalNavbar';
import { Progress } from '@/components/ui/progress';
import { APIKeyCreationModal } from '@/components/APIKeyCreationModal';
import { ImageHistoryPanel } from '@/components/ImageHistoryPanel';
import { supabase } from '@/integrations/supabase/client';
import { useUserCredits, useUserStats, useRecentImages } from '@/hooks/useUserCredits';
import { useMaintenanceMode } from '@/components/MaintenanceBanner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { 
  CreditBalance,
  LoadingSkeleton,
  EmptyAPIKeys,
  EmptyImages,
  ErrorBoundary
} from '@/components/shared';
import { 
  Diamond, Coins, ImageIcon, 
  Activity, Plus, Download, Key, Copy, Ban,
  ArrowRight, Shield, Lock, Monitor, LogOut,
  AlertTriangle, HelpCircle, FileText, ChevronRight,
  CheckCircle2, ExternalLink, Trash2, Loader2,
  CreditCard, Gift, Clock, History, Sparkles, User
} from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';

interface APIKey {
  id: string;
  name: string;
  key_prefix: string;
  status: 'active' | 'suspended' | 'expired' | 'revoked' | 'rate_limited';
  usage_count: number;
  last_used_at: string | null;
  created_at: string;
  expires_at: string | null;
  custom_rpm: number | null;
  custom_rpd: number | null;
}

export default function Dashboard() {
  const { user, profile } = useAuth();
  const { accountType, userRole, canAccessAdmin } = useAdmin();
  const queryClient = useQueryClient();
  const [createKeyModalOpen, setCreateKeyModalOpen] = useState(false);
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false);
  const { isMaintenanceMode } = useMaintenanceMode();
  
  // Revoke dialog state
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [keyToRevoke, setKeyToRevoke] = useState<string | null>(null);
  const [revokeConfirmation, setRevokeConfirmation] = useState('');

  // Next reset countdown state
  const [countdown, setCountdown] = useState<{ hours: number; minutes: number } | null>(null);
  
  const displayUsername = profile?.display_name || profile?.username || user?.email?.split('@')[0] || 'User';

  // Real data hooks
  const { data: credits, isLoading: creditsLoading, nextReset } = useUserCredits();
  const { imageStats, requestStats } = useUserStats();
  const { data: recentImages, isLoading: recentImagesLoading } = useRecentImages(10);

  // Update countdown every minute
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const nextMidnight = new Date(now);
      nextMidnight.setUTCHours(24, 0, 0, 0);
      
      const diffMs = nextMidnight.getTime() - now.getTime();
      if (diffMs <= 0) {
        setCountdown({ hours: 0, minutes: 0 });
        return;
      }
      
      const hours = Math.floor(diffMs / 3600000);
      const minutes = Math.floor((diffMs % 3600000) / 60000);
      setCountdown({ hours, minutes });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000);
    return () => clearInterval(interval);
  }, []);

  // Fetch API keys
  const { data: apiKeys, isLoading: keysLoading } = useQuery({
    queryKey: ['user-api-keys'],
    queryFn: async (): Promise<APIKey[]> => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('api_keys')
        .select('id, name, key_prefix, status, usage_count, last_used_at, created_at, expires_at, custom_rpm, custom_rpd')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as APIKey[];
    },
    enabled: !!user?.id,
  });

  // Delete API key mutation
  const deleteKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      const { error } = await supabase
        .from('api_keys')
        .delete()
        .eq('id', keyId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('API key deleted');
      queryClient.invalidateQueries({ queryKey: ['user-api-keys'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete API key');
    },
  });

  // Revoke API key mutation
  const revokeKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      const { error } = await supabase
        .from('api_keys')
        .update({ status: 'revoked' })
        .eq('id', keyId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('API key revoked');
      queryClient.invalidateQueries({ queryKey: ['user-api-keys'] });
      setRevokeDialogOpen(false);
      setRevokeConfirmation('');
      setKeyToRevoke(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to revoke API key');
    },
  });

  const totalCredits = (credits?.balance || 0) + (credits?.daily_credits || 0);
  const dailyCreditsMax = credits?.daily_credits || 10;
  const dailyUsed = imageStats?.today || 0;
  const dailyUsagePercent = Math.min((dailyUsed / dailyCreditsMax) * 100, 100);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Active
          </span>
        );
      case 'suspended':
      case 'rate_limited':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            Suspended
          </span>
        );
      case 'expired':
      case 'revoked':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-muted/50 text-muted-foreground border border-border">
            {status === 'revoked' ? 'Revoked' : 'Expired'}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-muted/50 text-muted-foreground border border-border">
            {status}
          </span>
        );
    }
  };

  const formatLastUsed = (date: string | null) => {
    if (!date) return 'Never';
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} mins ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    return format(d, 'MMM d, yyyy');
  };

  const formatExpiry = (expiresAt: string | null) => {
    if (!expiresAt) return 'Never';
    const d = new Date(expiresAt);
    const now = new Date();
    const diffMs = d.getTime() - now.getTime();
    
    if (diffMs < 0) return 'Expired';
    if (diffMs < 7 * 24 * 3600000) {
      return <span className="text-amber-400">{format(d, 'MMM d, yyyy')}</span>;
    }
    return format(d, 'MMM d, yyyy');
  };

  const handleRevokeClick = (keyId: string) => {
    setKeyToRevoke(keyId);
    setRevokeDialogOpen(true);
    setRevokeConfirmation('');
  };

  const handleRevokeConfirm = () => {
    if (keyToRevoke && revokeConfirmation === 'REVOKE') {
      revokeKeyMutation.mutate(keyToRevoke);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-body flex flex-col antialiased">
      <GlobalNavbar />

      {/* Main Content */}
      <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-20 space-y-8">
        {/* Page Heading */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mt-2 md:mt-0">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Welcome back, {displayUsername}
            </h1>
            <p className="text-muted-foreground text-sm md:text-base">
              Here's what's happening with your creative suite today.
            </p>
          </div>

          <div className="flex flex-col md:flex-row gap-3 md:items-center w-full md:w-auto">
            <div className="w-full md:w-auto flex items-center justify-center gap-2 text-sm text-muted-foreground bg-surface px-3 py-2 rounded-lg border border-border">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>{new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
            </div>

            <div className="flex gap-3 w-full md:w-auto">
              <button className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-surface border border-border text-sm font-medium text-foreground hover:bg-surface-hover transition-colors">
                <Download className="w-4 h-4" />
                Export
              </button>
              <Link
                to="/generate"
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors shadow-[0_0_12px_hsl(var(--primary)/0.4)]"
              >
                <Plus className="w-4 h-4" />
                Generate
              </Link>
            </div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Current Plan - Dynamic */}
          <div className="bg-card/40 backdrop-blur-xl p-5 rounded-xl border border-border flex flex-col justify-between h-[160px] relative overflow-hidden group">
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-primary/20 rounded-full blur-2xl group-hover:bg-primary/30 transition-all"></div>
            <div className="flex justify-between items-start z-10">
              <div>
                <p className="text-muted-foreground text-sm font-medium mb-1">Current Plan</p>
                <h3 className="text-2xl font-bold text-foreground">
                  {accountType === 'partner' ? 'Partner' : 'Free Tier'}
                </h3>
              </div>
              <div className="p-2 bg-surface rounded-lg text-primary">
                <Diamond className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 z-10">
              <Link className="text-sm text-primary font-medium hover:text-primary/80 flex items-center gap-1" to="/pricing">
                Manage Plan <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Enhanced Credit Breakdown - Using shared component */}
          <CreditBalance variant="detailed" showBuyButton />

          {/* Images Generated */}
          <div className="bg-card/40 backdrop-blur-xl p-5 rounded-xl border border-border flex flex-col justify-between h-[160px] relative overflow-hidden group">
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-emerald-500/20 rounded-full blur-2xl group-hover:bg-emerald-500/30 transition-all"></div>
            <div className="flex justify-between items-start z-10">
              <div>
                <p className="text-muted-foreground text-sm font-medium mb-1">Images Generated</p>
                <h3 className="text-2xl font-bold text-foreground">
                  {imageStats?.total?.toLocaleString() || 0}
                </h3>
              </div>
              <div className="p-2 bg-surface rounded-lg text-emerald-400">
                <ImageIcon className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-auto z-10">
              <span className="text-emerald-400 text-sm font-medium flex items-center">
                <Activity className="w-4 h-4 mr-0.5" /> {imageStats?.today || 0} today
              </span>
            </div>
          </div>

          {/* API Requests */}
          <div className="bg-card/40 backdrop-blur-xl p-5 rounded-xl border border-border flex flex-col justify-between h-[160px] relative overflow-hidden group">
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-orange-500/20 rounded-full blur-2xl group-hover:bg-orange-500/30 transition-all"></div>
            <div className="flex justify-between items-start z-10">
              <div>
                <p className="text-muted-foreground text-sm font-medium mb-1">API Requests</p>
                <h3 className="text-2xl font-bold text-foreground">
                  {requestStats?.total?.toLocaleString() || 0}
                </h3>
              </div>
              <div className="p-2 bg-surface rounded-lg text-orange-400">
                <Key className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-auto z-10">
              <span className="text-orange-400 text-sm font-medium flex items-center">
                <Activity className="w-4 h-4 mr-0.5" /> {requestStats?.today || 0} today
              </span>
            </div>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - API Keys & Security */}
          <div className="lg:col-span-2 space-y-6">
            {/* API Keys Section */}
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-foreground">API Keys</h2>
                  <p className="text-sm text-muted-foreground mt-1">Manage your secret keys for API access.</p>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                      onClick={() => !isMaintenanceMode && setCreateKeyModalOpen(true)}
                      disabled={isMaintenanceMode}
                      className={cn(
                        "shrink-0 flex items-center justify-center gap-2 rounded-lg w-11 h-11 md:w-auto md:h-auto md:px-4 md:py-2.5 text-base md:text-sm font-medium transition-colors",
                        isMaintenanceMode 
                          ? "bg-muted text-muted-foreground cursor-not-allowed"
                          : "bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_15px_hsl(var(--primary)/0.4)]"
                      )}
                    >
                      <Plus className="w-5 h-5" />
                      <span className="hidden md:inline">Create New Key</span>
                    </button>
                  </TooltipTrigger>
                  {isMaintenanceMode && (
                    <TooltipContent>
                      API key creation disabled during maintenance
                    </TooltipContent>
                  )}
                </Tooltip>
              </div>

              <div className="bg-card/40 backdrop-blur-xl rounded-xl overflow-hidden border border-border">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-muted-foreground">
                    <thead className="bg-surface text-xs uppercase text-foreground font-medium">
                      <tr>
                        <th className="px-4 py-4">Name</th>
                        <th className="px-4 py-4">Secret Key</th>
                        <th className="px-4 py-4">Last Used</th>
                        <th className="px-4 py-4">Expires</th>
                        <th className="px-4 py-4">Rate Limits</th>
                        <th className="px-4 py-4">Status</th>
                        <th className="px-4 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {keysLoading ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-0">
                            <LoadingSkeleton variant="table" count={3} />
                          </td>
                        </tr>
                      ) : apiKeys && apiKeys.length > 0 ? (
                        apiKeys.map((key) => (
                          <tr key={key.id} className="hover:bg-surface transition-colors group">
                            <td className="px-4 py-4 font-medium text-foreground">{key.name}</td>
                            <td className="px-4 py-4 font-mono text-muted-foreground tracking-wider text-xs">
                              {key.key_prefix}....
                            </td>
                            <td className="px-4 py-4 text-xs">{formatLastUsed(key.last_used_at)}</td>
                            <td className="px-4 py-4 text-xs">{formatExpiry(key.expires_at)}</td>
                            <td className="px-4 py-4 text-xs">
                              {key.custom_rpm || key.custom_rpd ? (
                                <span className="text-primary">
                                  Custom ({key.custom_rpm || 60}/{key.custom_rpd || 1000})
                                </span>
                              ) : (
                                <span className="text-muted-foreground">Default</span>
                              )}
                            </td>
                            <td className="px-4 py-4">{getStatusBadge(key.status)}</td>
                            <td className="px-4 py-4 text-right">
                              <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {key.status === 'active' && (
                                  <button 
                                    className="p-1.5 hover:bg-amber-500/10 rounded text-muted-foreground hover:text-amber-400"
                                    title="Revoke Key"
                                    onClick={() => handleRevokeClick(key.id)}
                                  >
                                    <Ban className="w-4 h-4" />
                                  </button>
                                )}
                                <button 
                                  className="p-1.5 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive"
                                  title="Delete Key"
                                  onClick={() => deleteKeyMutation.mutate(key.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="px-4 py-0">
                            <EmptyAPIKeys onCreateKey={() => !isMaintenanceMode && setCreateKeyModalOpen(true)} />
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {/* Security Note */}
                <div className="px-6 py-3 bg-amber-500/5 border-t border-amber-500/20 flex items-center gap-2 text-amber-400 text-sm">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Security Note: API keys are only visible once upon creation. Please save them securely.</span>
                </div>
              </div>
            </div>

            {/* Security Settings Section */}
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  Security Settings
                </h2>
                <p className="text-sm text-muted-foreground mt-1">Account protection and session management.</p>
              </div>

              <div className="bg-card/40 backdrop-blur-xl rounded-xl border border-border divide-y divide-border">
                {/* Change Password */}
                <button className="w-full px-6 py-4 flex items-center justify-between hover:bg-surface transition-colors group">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-surface rounded-lg text-primary group-hover:bg-primary/10 transition-colors">
                      <Lock className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-foreground">Change Password</p>
                      <p className="text-sm text-muted-foreground">Update your account password</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                </button>

                {/* Active Sessions */}
                <button className="w-full px-6 py-4 flex items-center justify-between hover:bg-surface transition-colors group">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-surface rounded-lg text-emerald-400 group-hover:bg-emerald-500/10 transition-colors">
                      <Monitor className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-foreground">Active Sessions</p>
                      <p className="text-sm text-muted-foreground">Manage your active sessions</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                </button>

                {/* Log out all sessions */}
                <div className="px-6 py-4">
                  <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors text-sm font-medium">
                    <LogOut className="w-4 h-4" />
                    Log out all sessions
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Usage, Account Status, Quick Actions, Activity */}
          <div className="space-y-6">

            {/* Account Status */}
            <div className="bg-card/40 backdrop-blur-xl rounded-xl border border-border p-5 space-y-4">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <User className="w-4 h-4 text-primary" />
                Account Status
              </h3>
              
              <div className="space-y-3">
                {/* Account Type Badge */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Account Type</span>
                  <Badge className={accountType === 'partner' 
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                    : 'bg-muted text-muted-foreground border-border'
                  }>
                    {accountType === 'partner' ? 'Partner' : 'Free Tier'}
                  </Badge>
                </div>
                
                {/* Member Since */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Member Since</span>
                  <span className="text-sm text-foreground">
                    {profile?.created_at ? format(new Date(profile.created_at), 'MMM yyyy') : 'N/A'}
                  </span>
                </div>
                
                {/* Role Badge (if admin) */}
                {canAccessAdmin && userRole && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Role</span>
                    <Badge className="bg-primary/10 text-primary border-primary/20 capitalize">
                      {userRole.replace('_', ' ')}
                    </Badge>
                  </div>
                )}
                
                {/* Email Verification */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Email Verified</span>
                  {user?.email_confirmed_at ? (
                    <span className="flex items-center gap-1 text-emerald-400 text-sm">
                      <CheckCircle2 className="w-4 h-4" />
                      Verified
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-amber-400 text-sm">
                      <AlertTriangle className="w-4 h-4" />
                      Pending
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-card/40 backdrop-blur-xl rounded-xl border border-border p-5 space-y-4">
              <h3 className="font-semibold text-foreground">Quick Actions</h3>
              
              <div className="grid grid-cols-2 gap-3">
                <Link 
                  to="/generate" 
                  className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary transition-colors border border-primary/20"
                >
                  <Sparkles className="w-6 h-6" />
                  <span className="text-xs font-medium text-center">Generate Image</span>
                </Link>
                
                <button 
                  onClick={() => setHistoryPanelOpen(true)}
                  className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-surface hover:bg-surface-hover text-foreground transition-colors border border-border"
                >
                  <History className="w-6 h-6" />
                  <span className="text-xs font-medium text-center">View History</span>
                </button>
                
                <button 
                  onClick={() => !isMaintenanceMode && setCreateKeyModalOpen(true)}
                  disabled={isMaintenanceMode}
                  className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-surface hover:bg-surface-hover text-foreground transition-colors border border-border disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Key className="w-6 h-6" />
                  <span className="text-xs font-medium text-center">Create API Key</span>
                </button>
                
                <Link 
                  to="/docs" 
                  className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-surface hover:bg-surface-hover text-foreground transition-colors border border-border"
                >
                  <FileText className="w-6 h-6" />
                  <span className="text-xs font-medium text-center">Documentation</span>
                </Link>
              </div>
            </div>

            {/* Recent Activity Feed */}
            <div className="bg-card/40 backdrop-blur-xl rounded-xl border border-border p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">Recent Activity</h3>
                <Button variant="ghost" size="sm" onClick={() => setHistoryPanelOpen(true)} className="text-xs">
                  View All
                </Button>
              </div>
              
              <ScrollArea className="h-[280px]">
                {recentImagesLoading ? (
                  <LoadingSkeleton variant="list" count={5} />
                ) : recentImages && recentImages.length > 0 ? (
                  <div className="space-y-3 pr-2">
                    {recentImages.map((image) => (
                      <div key={image.id} className="flex gap-3 p-2 rounded-lg hover:bg-surface transition-colors">
                        {/* Thumbnail 64x64 */}
                        <div className="w-14 h-14 rounded-lg overflow-hidden bg-surface flex-shrink-0 border border-border">
                          {image.thumbnail_url || image.image_url ? (
                            <img 
                              src={image.thumbnail_url || image.image_url || ''} 
                              alt="" 
                              className="w-full h-full object-cover" 
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon className="w-5 h-5 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        
                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-foreground line-clamp-2">
                            {image.prompt.length > 50 ? `${image.prompt.slice(0, 50)}...` : image.prompt}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            <span>{image.credits_used || 1} credits</span>
                            <span>•</span>
                            <span>{formatDistanceToNow(new Date(image.created_at), { addSuffix: true })}</span>
                          </div>
                          <div className="mt-1">
                            {image.status === 'completed' ? (
                              <span className="text-xs text-emerald-400">Completed</span>
                            ) : image.status === 'failed' ? (
                              <span className="text-xs text-destructive">Failed</span>
                            ) : (
                              <span className="text-xs text-amber-400">{image.status}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyImages />
                )}
              </ScrollArea>
            </div>

            {/* Usage & Limits */}
            <div className="bg-card/40 backdrop-blur-xl rounded-xl border border-border p-5 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">Usage & Limits</h3>
                <span className="text-xs text-muted-foreground">Daily reset at midnight</span>
              </div>

              {/* Daily Usage Progress */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Daily Credit Usage</span>
                  <span className="font-medium text-foreground">{dailyUsed} / {dailyCreditsMax}</span>
                </div>
                <Progress value={dailyUsagePercent} className="h-2" />
              </div>

              {/* Images Today */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Images Today</span>
                  <span className="font-medium text-foreground">{imageStats?.today || 0}</span>
                </div>
              </div>

              {/* API Keys */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Active API Keys</span>
                  <span className="font-medium text-foreground">
                    {apiKeys?.filter(k => k.status === 'active').length || 0}
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>

      {/* API Key Creation Modal */}
      <APIKeyCreationModal open={createKeyModalOpen} onOpenChange={setCreateKeyModalOpen} />
      
      {/* Image History Panel */}
      <ImageHistoryPanel open={historyPanelOpen} onOpenChange={setHistoryPanelOpen} />

      {/* Revoke Confirmation Dialog */}
      <AlertDialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API Key</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The API key will be permanently deactivated and can no longer be used for API requests.
              <br /><br />
              Type <strong className="text-foreground">REVOKE</strong> to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input 
            value={revokeConfirmation}
            onChange={(e) => setRevokeConfirmation(e.target.value)}
            placeholder="Type REVOKE"
            className="mt-2"
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setRevokeConfirmation('');
              setKeyToRevoke(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRevokeConfirm}
              disabled={revokeConfirmation !== 'REVOKE' || revokeKeyMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {revokeKeyMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Revoke Key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
