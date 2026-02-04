import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminReadOnly } from '@/components/admin/AdminProtectedRoute';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Shield, Ban, AlertTriangle, Plus, Trash2, RefreshCw, Globe, Activity, UserX, Upload, Info } from 'lucide-react';
import { toast } from 'sonner';

type BlockReason = 'abuse' | 'spam' | 'ddos' | 'vpn' | 'proxy' | 'manual' | 'country';
type SecurityEventType = 'login_failed' | 'rate_limit' | 'suspicious_activity' | 'api_abuse' | 'blocked_ip' | 'auto_ban' | 'prompt_filter' | 'vpn_detected';

interface IPBlock {
  id: string;
  ip_address: string;
  cidr_range: string | null;
  reason: BlockReason;
  notes: string | null;
  expires_at: string | null;
  created_at: string;
}

interface SecurityEvent {
  id: string;
  user_id: string | null;
  event_type: SecurityEventType;
  severity: string;
  ip_address: string | null;
  details: Record<string, unknown>;
  resolved_at: string | null;
  created_at: string;
}

interface SystemSetting {
  key: string;
  value: unknown;
  description: string | null;
}

interface BannedUser {
  user_id: string;
  email: string | null;
  display_name: string | null;
  ban_reason: string | null;
  banned_at: string | null;
  banned_by: string | null;
}

export default function AdminSecurity() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isReadOnly } = useAdminReadOnly();
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importResults, setImportResults] = useState<{ valid: string[]; invalid: string[] } | null>(null);
  const [newBlock, setNewBlock] = useState({
    ip_address: '',
    reason: 'manual' as BlockReason,
    notes: '',
    expires_days: 0,
  });

  const { data: blocklist, isLoading: blocklistLoading } = useQuery({
    queryKey: ['admin-ip-blocklist'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ip_blocklist')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data as IPBlock[];
    },
  });

  const { data: events, isLoading: eventsLoading } = useQuery({
    queryKey: ['admin-security-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('security_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data as SecurityEvent[];
    },
  });

  const { data: settings } = useQuery({
    queryKey: ['admin-security-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .in('key', ['enable_vpn_detection', 'enable_prompt_filtering', 'auto_ban_threshold', 'default_rpm', 'default_rpd', 'captcha_enabled']);
      
      if (error) throw error;
      return data as SystemSetting[];
    },
  });

  const { data: bannedUsers, isLoading: bannedLoading } = useQuery({
    queryKey: ['admin-banned-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, email, display_name, ban_reason, banned_at, banned_by')
        .eq('is_banned', true)
        .order('banned_at', { ascending: false });
      if (error) throw error;
      return data as BannedUser[];
    },
  });

  const addBlockMutation = useMutation({
    mutationFn: async (data: typeof newBlock) => {
      const { error } = await supabase.from('ip_blocklist').insert({
        ip_address: data.ip_address,
        reason: data.reason,
        notes: data.notes || null,
        expires_at: data.expires_days > 0 
          ? new Date(Date.now() + data.expires_days * 24 * 60 * 60 * 1000).toISOString() 
          : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('IP blocked successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-ip-blocklist'] });
      setBlockDialogOpen(false);
      setNewBlock({ ip_address: '', reason: 'manual', notes: '', expires_days: 0 });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to block IP');
    },
  });

  const removeBlockMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('ip_blocklist').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('IP unblocked');
      queryClient.invalidateQueries({ queryKey: ['admin-ip-blocklist'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to unblock IP');
    },
  });

  const updateSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: unknown }) => {
      // Check if setting exists
      const { data: existing } = await supabase
        .from('system_settings')
        .select('key')
        .eq('key', key)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('system_settings')
          .update({ value: JSON.stringify(value), updated_by: user?.id })
          .eq('key', key);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('system_settings')
          .insert({ key, value: JSON.stringify(value), updated_by: user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Setting updated');
      queryClient.invalidateQueries({ queryKey: ['admin-security-settings'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update setting');
    },
  });

  const unbanMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('profiles')
        .update({
          is_banned: false,
          ban_reason: null,
          banned_at: null,
          banned_by: null,
        })
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('User unbanned');
      queryClient.invalidateQueries({ queryKey: ['admin-banned-users'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to unban user');
    },
  });

  const bulkImportMutation = useMutation({
    mutationFn: async (ips: string[]) => {
      const records = ips.map((ip) => ({
        ip_address: ip,
        reason: 'manual' as BlockReason,
        notes: 'Bulk imported',
      }));

      const { error } = await supabase.from('ip_blocklist').insert(records);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${importResults?.valid.length || 0} IPs imported`);
      queryClient.invalidateQueries({ queryKey: ['admin-ip-blocklist'] });
      setImportDialogOpen(false);
      setImportText('');
      setImportResults(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to import IPs');
    },
  });

  const getSettingValue = (key: string, defaultValue: unknown = '') => {
    const setting = settings?.find((s) => s.key === key);
    if (!setting) return defaultValue;
    try {
      return typeof setting.value === 'string' ? JSON.parse(setting.value) : setting.value;
    } catch {
      return setting.value;
    }
  };

  const getReasonBadge = (reason: BlockReason) => {
    const styles: Record<BlockReason, string> = {
      abuse: 'bg-red-500/10 text-red-400 border-red-500/20',
      spam: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
      ddos: 'bg-red-500/10 text-red-400 border-red-500/20',
      vpn: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      proxy: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      manual: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
      country: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    };
    return <Badge className={styles[reason]}>{reason}</Badge>;
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

  // IP validation function
  const validateIPs = (text: string) => {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?:\/(?:[12]?[0-9]|3[0-2]))?$/;

    const valid: string[] = [];
    const invalid: string[] = [];

    lines.forEach((line) => {
      if (ipRegex.test(line)) {
        valid.push(line);
      } else {
        invalid.push(line);
      }
    });

    return { valid, invalid };
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Security & Abuse Protection</h1>
        <p className="text-slate-400 text-sm mt-1">Monitor and manage platform security</p>
      </div>

      <Tabs defaultValue="blocklist" className="space-y-4">
        <TabsList className="bg-admin-surface border border-admin-border">
          <TabsTrigger value="blocklist" className="data-[state=active]:bg-admin-accent">
            <Ban className="h-4 w-4 mr-2" />
            IP Blocklist
          </TabsTrigger>
          <TabsTrigger value="events" className="data-[state=active]:bg-admin-accent">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Security Events
          </TabsTrigger>
          <TabsTrigger value="autobans" className="data-[state=active]:bg-admin-accent">
            <UserX className="h-4 w-4 mr-2" />
            Auto-Bans
          </TabsTrigger>
          <TabsTrigger value="settings" className="data-[state=active]:bg-admin-accent">
            <Shield className="h-4 w-4 mr-2" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* IP Blocklist Tab */}
        <TabsContent value="blocklist">
          <Card className="bg-admin-surface border-admin-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-admin-danger/20">
                    <Ban className="h-5 w-5 text-admin-danger" />
                  </div>
                  <div>
                    <CardTitle className="text-white">Blocked IPs</CardTitle>
                    <CardDescription className="text-slate-400">
                      {blocklist?.length || 0} IPs currently blocked
                    </CardDescription>
                  </div>
                </div>
                <div className="flex gap-2">
                  {!isReadOnly && (
                    <>
                      <Button onClick={() => setImportDialogOpen(true)} variant="outline" className="border-admin-border text-slate-300 hover:text-white">
                        <Upload className="h-4 w-4 mr-2" />
                        Import IPs
                      </Button>
                      <Button onClick={() => setBlockDialogOpen(true)} className="bg-admin-danger hover:bg-admin-danger/80">
                        <Plus className="h-4 w-4 mr-2" />
                        Block IP
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {blocklistLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-admin-accent" />
                </div>
              ) : blocklist && blocklist.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="border-admin-border hover:bg-transparent">
                      <TableHead className="text-slate-400">IP Address</TableHead>
                      <TableHead className="text-slate-400">Reason</TableHead>
                      <TableHead className="text-slate-400">Notes</TableHead>
                      <TableHead className="text-slate-400">Expires</TableHead>
                      <TableHead className="text-slate-400 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {blocklist.map((block) => (
                      <TableRow key={block.id} className="border-admin-border hover:bg-admin-surface-hover">
                        <TableCell className="font-mono text-white">{block.ip_address}</TableCell>
                        <TableCell>{getReasonBadge(block.reason)}</TableCell>
                        <TableCell className="text-slate-400 max-w-[200px] truncate">{block.notes || '-'}</TableCell>
                        <TableCell className="text-slate-300">
                          {block.expires_at ? new Date(block.expires_at).toLocaleDateString() : 'Permanent'}
                        </TableCell>
                        <TableCell className="text-right">
                          {!isReadOnly && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeBlockMutation.mutate(block.id)}
                              className="text-slate-400 hover:text-admin-success"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-slate-400">
                  <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No blocked IPs</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Events Tab */}
        <TabsContent value="events">
          <Card className="bg-admin-surface border-admin-border">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-admin-warning/20">
                  <AlertTriangle className="h-5 w-5 text-admin-warning" />
                </div>
                <div>
                  <CardTitle className="text-white">Security Events</CardTitle>
                  <CardDescription className="text-slate-400">
                    Recent security-related activities
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {eventsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-admin-accent" />
                </div>
              ) : events && events.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="border-admin-border hover:bg-transparent">
                      <TableHead className="text-slate-400">Event</TableHead>
                      <TableHead className="text-slate-400">Severity</TableHead>
                      <TableHead className="text-slate-400">IP Address</TableHead>
                      <TableHead className="text-slate-400">Time</TableHead>
                      <TableHead className="text-slate-400">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.map((event) => (
                      <TableRow key={event.id} className="border-admin-border hover:bg-admin-surface-hover">
                        <TableCell className="text-white">{event.event_type.replace(/_/g, ' ')}</TableCell>
                        <TableCell>{getSeverityBadge(event.severity)}</TableCell>
                        <TableCell className="font-mono text-slate-400">{event.ip_address || '-'}</TableCell>
                        <TableCell className="text-slate-300">
                          {new Date(event.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {event.resolved_at ? (
                            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Resolved</Badge>
                          ) : (
                            <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">Open</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-slate-400">
                  <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No security events</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Auto-Bans Tab */}
        <TabsContent value="autobans">
          <Card className="bg-admin-surface border-admin-border">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/20">
                  <UserX className="h-5 w-5 text-red-400" />
                </div>
                <div>
                  <CardTitle className="text-white">Banned Users</CardTitle>
                  <CardDescription className="text-slate-400">
                    Users banned due to policy violations ({bannedUsers?.length || 0} total)
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {bannedLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-admin-accent" />
                </div>
              ) : bannedUsers && bannedUsers.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="border-admin-border hover:bg-transparent">
                      <TableHead className="text-slate-400">User</TableHead>
                      <TableHead className="text-slate-400">Ban Reason</TableHead>
                      <TableHead className="text-slate-400">Banned At</TableHead>
                      <TableHead className="text-slate-400 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bannedUsers.map((bannedUser) => (
                      <TableRow key={bannedUser.user_id} className="border-admin-border hover:bg-admin-surface-hover">
                        <TableCell>
                          <div>
                            <p className="text-white font-medium">{bannedUser.display_name || 'Unknown'}</p>
                            <p className="text-xs text-slate-400">{bannedUser.email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-300">{bannedUser.ban_reason || 'N/A'}</TableCell>
                        <TableCell className="text-slate-300">
                          {bannedUser.banned_at ? new Date(bannedUser.banned_at).toLocaleString() : 'N/A'}
                        </TableCell>
                        <TableCell className="text-right">
                          {!isReadOnly && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => unbanMutation.mutate(bannedUser.user_id)}
                              className="border-admin-border text-slate-300 hover:text-white"
                            >
                              Unban
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-slate-400">
                  <UserX className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No banned users</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <div className="grid gap-6">
            <Card className="bg-admin-surface border-admin-border">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-admin-accent/20">
                    <Shield className="h-5 w-5 text-admin-accent" />
                  </div>
                  <div>
                    <CardTitle className="text-white">Security Settings</CardTitle>
                    <CardDescription className="text-slate-400">
                      Configure security features
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-white">VPN/Proxy Detection</p>
                    <p className="text-sm text-slate-400">Block requests from known VPN/proxy IPs</p>
                  </div>
                  <Switch
                    checked={getSettingValue('enable_vpn_detection', false) === 'true' || getSettingValue('enable_vpn_detection', false) === true}
                    onCheckedChange={(v) => updateSettingMutation.mutate({ key: 'enable_vpn_detection', value: v })}
                    disabled={isReadOnly}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-white">Prompt Content Filtering</p>
                    <p className="text-sm text-slate-400">Filter NSFW and harmful prompts</p>
                  </div>
                  <Switch
                    checked={getSettingValue('enable_prompt_filtering', true) === 'true' || getSettingValue('enable_prompt_filtering', true) === true}
                    onCheckedChange={(v) => updateSettingMutation.mutate({ key: 'enable_prompt_filtering', value: v })}
                    disabled={isReadOnly}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-white">Require CAPTCHA on Generation</p>
                    <p className="text-sm text-slate-400">When enabled, users must complete CAPTCHA before generating images</p>
                    <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                      <Info className="h-3 w-3" />
                      Note: Backend enforcement must be configured separately
                    </p>
                  </div>
                  <Switch
                    checked={getSettingValue('captcha_enabled', false) === 'true' || getSettingValue('captcha_enabled', false) === true}
                    onCheckedChange={(v) => updateSettingMutation.mutate({ key: 'captcha_enabled', value: v })}
                    disabled={isReadOnly}
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-slate-300">Auto-Ban Threshold (violations)</Label>
                  <Input
                    type="number"
                    value={getSettingValue('auto_ban_threshold', 10)}
                    onChange={(e) => updateSettingMutation.mutate({ key: 'auto_ban_threshold', value: parseInt(e.target.value) })}
                    className="bg-admin-background border-admin-border text-white max-w-[200px]"
                    disabled={isReadOnly}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-admin-surface border-admin-border">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-admin-warning/20">
                    <Globe className="h-5 w-5 text-admin-warning" />
                  </div>
                  <div>
                    <CardTitle className="text-white">Rate Limiting</CardTitle>
                    <CardDescription className="text-slate-400">
                      Default rate limits for API requests
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label className="text-slate-300">Default RPM (Requests/Minute)</Label>
                    <Input
                      type="number"
                      value={getSettingValue('default_rpm', 60)}
                      onChange={(e) => updateSettingMutation.mutate({ key: 'default_rpm', value: parseInt(e.target.value) })}
                      className="bg-admin-background border-admin-border text-white"
                      disabled={isReadOnly}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-slate-300">Default RPD (Requests/Day)</Label>
                    <Input
                      type="number"
                      value={getSettingValue('default_rpd', 1000)}
                      onChange={(e) => updateSettingMutation.mutate({ key: 'default_rpd', value: parseInt(e.target.value) })}
                      className="bg-admin-background border-admin-border text-white"
                      disabled={isReadOnly}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Block IP Dialog */}
      <Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
        <DialogContent className="bg-admin-surface border-admin-border text-white">
          <DialogHeader>
            <DialogTitle>Block IP Address</DialogTitle>
            <DialogDescription className="text-slate-400">
              Add an IP address to the blocklist
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label className="text-slate-300">IP Address</Label>
              <Input
                value={newBlock.ip_address}
                onChange={(e) => setNewBlock({ ...newBlock, ip_address: e.target.value })}
                placeholder="192.168.1.1"
                className="bg-admin-background border-admin-border text-white"
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-slate-300">Reason</Label>
              <Select value={newBlock.reason} onValueChange={(v) => setNewBlock({ ...newBlock, reason: v as BlockReason })}>
                <SelectTrigger className="bg-admin-background border-admin-border text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-admin-surface border-admin-border">
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="abuse">Abuse</SelectItem>
                  <SelectItem value="spam">Spam</SelectItem>
                  <SelectItem value="ddos">DDoS</SelectItem>
                  <SelectItem value="vpn">VPN</SelectItem>
                  <SelectItem value="proxy">Proxy</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label className="text-slate-300">Notes (optional)</Label>
              <Textarea
                value={newBlock.notes}
                onChange={(e) => setNewBlock({ ...newBlock, notes: e.target.value })}
                placeholder="Reason for blocking..."
                className="bg-admin-background border-admin-border text-white"
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-slate-300">Expires in (days, 0 = permanent)</Label>
              <Input
                type="number"
                value={newBlock.expires_days}
                onChange={(e) => setNewBlock({ ...newBlock, expires_days: parseInt(e.target.value) || 0 })}
                className="bg-admin-background border-admin-border text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockDialogOpen(false)} className="border-admin-border text-slate-300">
              Cancel
            </Button>
            <Button onClick={() => addBlockMutation.mutate(newBlock)} className="bg-admin-danger hover:bg-admin-danger/80">
              Block IP
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="bg-admin-surface border-admin-border text-white">
          <DialogHeader>
            <DialogTitle>Bulk Import IPs</DialogTitle>
            <DialogDescription className="text-slate-400">
              Paste IP addresses (one per line). Supports CIDR notation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea
              value={importText}
              onChange={(e) => {
                setImportText(e.target.value);
                setImportResults(null);
              }}
              placeholder="192.168.1.1
10.0.0.0/8
..."
              rows={10}
              className="bg-admin-background border-admin-border text-white font-mono text-sm"
            />

            {importResults && (
              <div className="space-y-2 p-3 rounded-lg bg-admin-background border border-admin-border">
                <p className="text-emerald-400 text-sm">✓ Valid: {importResults.valid.length}</p>
                {importResults.invalid.length > 0 && (
                  <div>
                    <p className="text-red-400 text-sm">✗ Invalid: {importResults.invalid.length}</p>
                    <p className="text-xs text-slate-400 mt-1 truncate">
                      {importResults.invalid.slice(0, 3).join(', ')}
                      {importResults.invalid.length > 3 && '...'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setImportResults(validateIPs(importText))}
              className="border-admin-border text-slate-300"
            >
              Validate
            </Button>
            <Button
              onClick={() => bulkImportMutation.mutate(importResults?.valid || [])}
              disabled={!importResults?.valid.length || bulkImportMutation.isPending}
              className="bg-admin-accent hover:bg-admin-accent/80"
            >
              Import {importResults?.valid.length || 0} IPs
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
