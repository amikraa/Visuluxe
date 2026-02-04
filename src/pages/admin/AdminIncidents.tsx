import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Shield, AlertTriangle, Activity, CheckCircle, Clock, RefreshCw, 
  ShieldAlert, Server, CheckCircle2, RotateCcw, TrendingUp 
} from 'lucide-react';
import { SecurityEventDetailModal } from '@/components/admin/SecurityEventDetailModal';
import { ResolveIncidentDialog } from '@/components/admin/ResolveIncidentDialog';
import { UnresolveIncidentDialog } from '@/components/admin/UnresolveIncidentDialog';
import { useAdminReadOnly } from '@/components/admin/AdminProtectedRoute';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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

type SeverityFilter = 'all' | 'critical' | 'high' | 'medium' | 'low';
type StatusFilter = 'all' | 'unresolved' | 'resolved';

export default function AdminIncidents() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isReadOnly } = useAdminReadOnly();
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedEvent, setSelectedEvent] = useState<SecurityEvent | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  
  // Resolution dialogs state
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [unresolveDialogOpen, setUnresolveDialogOpen] = useState(false);
  const [selectedForAction, setSelectedForAction] = useState<SecurityEvent | null>(null);

  const { data: incidents, isLoading } = useQuery({
    queryKey: ['admin-incidents', severityFilter, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('security_events')
        .select('*')
        .in('event_type', ['api_abuse', 'auto_ban', 'blocked_ip', 'rate_limit'])
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (severityFilter !== 'all') {
        query = query.eq('severity', severityFilter);
      }
      
      if (statusFilter === 'unresolved') {
        query = query.is('resolved_at', null);
      } else if (statusFilter === 'resolved') {
        query = query.not('resolved_at', 'is', null);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as SecurityEvent[];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['admin-incident-stats'],
    queryFn: async () => {
      const { count: criticalCount } = await supabase
        .from('security_events')
        .select('*', { count: 'exact', head: true })
        .eq('severity', 'critical')
        .is('resolved_at', null);

      const { count: highCount } = await supabase
        .from('security_events')
        .select('*', { count: 'exact', head: true })
        .eq('severity', 'high')
        .is('resolved_at', null);

      const { count: blockedIPsCount } = await supabase
        .from('ip_blocklist')
        .select('*', { count: 'exact', head: true });

      const { count: totalCount } = await supabase
        .from('security_events')
        .select('*', { count: 'exact', head: true });

      const { count: resolvedCount } = await supabase
        .from('security_events')
        .select('*', { count: 'exact', head: true })
        .not('resolved_at', 'is', null);

      return {
        critical: criticalCount || 0,
        high: highCount || 0,
        blockedIPs: blockedIPsCount || 0,
        total: totalCount || 0,
        resolved: resolvedCount || 0,
      };
    },
  });

  // Fetch blocked IPs for the modal
  const { data: blockedIPsList } = useQuery({
    queryKey: ['admin-blocked-ips-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ip_blocklist')
        .select('ip_address');
      if (error) throw error;
      return data.map(b => b.ip_address);
    },
  });

  // Block IP mutation
  const blockIPMutation = useMutation({
    mutationFn: async (ipAddress: string) => {
      const { error } = await supabase.from('ip_blocklist').insert({
        ip_address: ipAddress,
        reason: 'manual',
        notes: 'Blocked from security incident',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('IP blocked successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-blocked-ips-list'] });
      queryClient.invalidateQueries({ queryKey: ['admin-incident-stats'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to block IP');
    },
  });

  // Ban user mutation
  const banUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('profiles')
        .update({
          is_banned: true,
          ban_reason: 'Banned from security incident',
          banned_at: new Date().toISOString(),
          banned_by: user?.id || null,
        })
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('User banned successfully');
      queryClient.invalidateQueries({ queryKey: ['user-profile-detail'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to ban user');
    },
  });

  // Resolve incident mutation
  const resolveMutation = useMutation({
    mutationFn: async ({ id, notes, severity }: { id: string; notes: string; severity: string }) => {
      // Backend validation: require notes for high/critical severity
      const notesRequired = severity === 'high' || severity === 'critical';
      if (notesRequired && (!notes || notes.trim().length === 0)) {
        throw new Error('Resolution notes are required for high/critical severity incidents');
      }

      const { error } = await supabase
        .from('security_events')
        .update({
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id,
          resolution_notes: notes || null,
        })
        .eq('id', id);
      if (error) throw error;

      // Log to audit logs
      await supabase.rpc('log_admin_action', {
        _action: 'incident_resolved',
        _target_type: 'security_events',
        _target_id: id,
        _details: { resolution_notes: notes || null },
      });
    },
    onSuccess: () => {
      toast.success('Incident marked as resolved');
      queryClient.invalidateQueries({ queryKey: ['admin-incidents'] });
      queryClient.invalidateQueries({ queryKey: ['admin-incident-stats'] });
      setResolveDialogOpen(false);
      setSelectedForAction(null);
    },
    onError: (error: Error) => {
      toast.error(`Failed to resolve: ${error.message}`);
    },
  });

  // Unresolve incident mutation
  const unresolveMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const { error } = await supabase
        .from('security_events')
        .update({
          resolved_at: null,
          resolved_by: null,
          resolution_notes: null,
        })
        .eq('id', id);
      if (error) throw error;

      // Log to audit logs
      await supabase.rpc('log_admin_action', {
        _action: 'incident_reopened',
        _target_type: 'security_events',
        _target_id: id,
        _details: { reopen_reason: reason || null },
      });
    },
    onSuccess: () => {
      toast.success('Incident reopened');
      queryClient.invalidateQueries({ queryKey: ['admin-incidents'] });
      queryClient.invalidateQueries({ queryKey: ['admin-incident-stats'] });
      setUnresolveDialogOpen(false);
      setSelectedForAction(null);
    },
    onError: (error: Error) => {
      toast.error(`Failed to reopen: ${error.message}`);
    },
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

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'ddos':
        return <ShieldAlert className="h-4 w-4 text-red-400" />;
      case 'api_abuse':
        return <Server className="h-4 w-4 text-orange-400" />;
      case 'auto_ban':
        return <AlertTriangle className="h-4 w-4 text-amber-400" />;
      default:
        return <Activity className="h-4 w-4 text-slate-400" />;
    }
  };

  const handleRowClick = (incident: SecurityEvent) => {
    setSelectedEvent(incident);
    setDetailModalOpen(true);
  };

  const handleResolveClick = (e: React.MouseEvent, incident: SecurityEvent) => {
    e.stopPropagation();
    setSelectedForAction(incident);
    setResolveDialogOpen(true);
  };

  const handleUnresolveClick = (e: React.MouseEvent, incident: SecurityEvent) => {
    e.stopPropagation();
    setSelectedForAction(incident);
    setUnresolveDialogOpen(true);
  };

  // Calculate resolution rate
  const resolutionRate = stats?.total ? Math.round((stats.resolved / stats.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">DDoS & Incidents</h1>
          <p className="text-slate-400 text-sm mt-1">Monitor active threats and security incidents</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-[160px] bg-admin-surface border-admin-border text-white">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent className="bg-admin-surface border-admin-border">
              <SelectItem value="all">All Incidents</SelectItem>
              <SelectItem value="unresolved">Unresolved Only</SelectItem>
              <SelectItem value="resolved">Resolved Only</SelectItem>
            </SelectContent>
          </Select>
          <Select value={severityFilter} onValueChange={(v) => setSeverityFilter(v as SeverityFilter)}>
            <SelectTrigger className="w-[150px] bg-admin-surface border-admin-border text-white">
              <SelectValue placeholder="Filter severity" />
            </SelectTrigger>
            <SelectContent className="bg-admin-surface border-admin-border">
              <SelectItem value="all">All Severities</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="bg-admin-surface border-admin-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">System Status</p>
                <p className="text-xl font-bold text-emerald-400 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Operational
                </p>
              </div>
              <div className="p-3 rounded-lg bg-emerald-500/10">
                <Shield className="h-6 w-6 text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-admin-surface border-admin-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Critical Incidents</p>
                <p className="text-xl font-bold text-red-400">{stats?.critical || 0}</p>
                <p className="text-xs text-slate-500">unresolved</p>
              </div>
              <div className="p-3 rounded-lg bg-red-500/10">
                <AlertTriangle className="h-6 w-6 text-red-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-admin-surface border-admin-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">High Severity</p>
                <p className="text-xl font-bold text-orange-400">{stats?.high || 0}</p>
                <p className="text-xs text-slate-500">unresolved</p>
              </div>
              <div className="p-3 rounded-lg bg-orange-500/10">
                <ShieldAlert className="h-6 w-6 text-orange-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-admin-surface border-admin-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Blocked IPs</p>
                <p className="text-xl font-bold text-purple-400">{stats?.blockedIPs || 0}</p>
              </div>
              <div className="p-3 rounded-lg bg-purple-500/10">
                <Server className="h-6 w-6 text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-admin-surface border-admin-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Resolution Rate</p>
                <p className={cn(
                  "text-xl font-bold",
                  resolutionRate > 80 ? "text-emerald-400" : 
                  resolutionRate > 50 ? "text-amber-400" : "text-red-400"
                )}>
                  {resolutionRate}%
                </p>
                <p className="text-xs text-slate-500">
                  {stats?.resolved || 0} of {stats?.total || 0} resolved
                </p>
              </div>
              <div className="p-3 rounded-lg bg-emerald-500/10">
                <TrendingUp className="h-6 w-6 text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* DDoS Protection Status */}
      <Card className="bg-admin-surface border-admin-border">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/20">
              <Shield className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <CardTitle className="text-white">DDoS Protection</CardTitle>
              <CardDescription className="text-slate-400">
                Automatic protection against distributed attacks
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-admin-background border border-admin-border">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-emerald-400" />
                <span className="text-sm font-medium text-white">Rate Limiting</span>
              </div>
              <p className="text-xs text-slate-400">Active - Enforced on all endpoints</p>
            </div>
            <div className="p-4 rounded-lg bg-admin-background border border-admin-border">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-emerald-400" />
                <span className="text-sm font-medium text-white">IP Blocking</span>
              </div>
              <p className="text-xs text-slate-400">Active - {stats?.blockedIPs || 0} IPs blocked</p>
            </div>
            <div className="p-4 rounded-lg bg-admin-background border border-admin-border">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-emerald-400" />
                <span className="text-sm font-medium text-white">Auto-Ban</span>
              </div>
              <p className="text-xs text-slate-400">Active - Threshold-based blocking</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Incidents */}
      <Card className="bg-admin-surface border-admin-border">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-admin-warning/20">
              <AlertTriangle className="h-5 w-5 text-admin-warning" />
            </div>
            <div>
              <CardTitle className="text-white">Recent Incidents</CardTitle>
              <CardDescription className="text-slate-400">
                Click on an incident to view details and take action
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-admin-accent" />
            </div>
          ) : incidents && incidents.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="border-admin-border hover:bg-transparent">
                  <TableHead className="text-slate-400">Type</TableHead>
                  <TableHead className="text-slate-400">Severity</TableHead>
                  <TableHead className="text-slate-400">IP Address</TableHead>
                  <TableHead className="text-slate-400">Time</TableHead>
                  <TableHead className="text-slate-400">Status</TableHead>
                  {!isReadOnly && <TableHead className="text-slate-400 text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {incidents.map((incident) => (
                  <TableRow 
                    key={incident.id} 
                    className={cn(
                      "border-admin-border hover:bg-admin-surface-hover cursor-pointer",
                      incident.resolved_at && "bg-emerald-500/5",
                      !incident.resolved_at && incident.severity === 'critical' && "bg-red-500/5"
                    )}
                    onClick={() => handleRowClick(incident)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getEventIcon(incident.event_type)}
                        <span className="text-white capitalize">{incident.event_type.replace(/_/g, ' ')}</span>
                      </div>
                    </TableCell>
                    <TableCell>{getSeverityBadge(incident.severity)}</TableCell>
                    <TableCell className="font-mono text-slate-400">{incident.ip_address || '-'}</TableCell>
                    <TableCell className="text-slate-300">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(incident.created_at).toLocaleString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      {incident.resolved_at ? (
                        <div>
                          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Resolved
                          </Badge>
                          <p className="text-xs text-slate-500 mt-1">
                            {new Date(incident.resolved_at).toLocaleDateString()}
                          </p>
                        </div>
                      ) : (
                        <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Open
                        </Badge>
                      )}
                    </TableCell>
                    {!isReadOnly && (
                      <TableCell className="text-right">
                        {incident.resolved_at ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => handleUnresolveClick(e, incident)}
                            className="text-slate-400 hover:text-white hover:bg-admin-surface-hover"
                          >
                            <RotateCcw className="h-4 w-4 mr-1" />
                            Reopen
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => handleResolveClick(e, incident)}
                            className="text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-300"
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Resolve
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-slate-400">
              <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No incidents recorded</p>
              <p className="text-sm">System is running smoothly</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security Event Detail Modal */}
      <SecurityEventDetailModal
        event={selectedEvent}
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
        onBlockIP={(ip) => blockIPMutation.mutate(ip)}
        onBanUser={(userId) => banUserMutation.mutate(userId)}
        onResolve={(notes) => {
          if (selectedEvent) {
            resolveMutation.mutate({ id: selectedEvent.id, notes, severity: selectedEvent.severity });
          }
        }}
        onUnresolve={(reason) => {
          if (selectedEvent) {
            unresolveMutation.mutate({ id: selectedEvent.id, reason });
          }
        }}
        blockedIPs={blockedIPsList || []}
        isReadOnly={isReadOnly}
        isResolving={resolveMutation.isPending}
        isUnresolving={unresolveMutation.isPending}
      />

      {/* Resolve Incident Dialog */}
      <ResolveIncidentDialog
        incident={selectedForAction}
        open={resolveDialogOpen}
        onOpenChange={setResolveDialogOpen}
        onResolve={(notes) => {
          if (selectedForAction) {
            resolveMutation.mutate({ id: selectedForAction.id, notes, severity: selectedForAction.severity });
          }
        }}
        isResolving={resolveMutation.isPending}
      />

      {/* Unresolve Incident Dialog */}
      <UnresolveIncidentDialog
        open={unresolveDialogOpen}
        onOpenChange={setUnresolveDialogOpen}
        onConfirm={(reason) => {
          if (selectedForAction) {
            unresolveMutation.mutate({ id: selectedForAction.id, reason });
          }
        }}
        isUnresolving={unresolveMutation.isPending}
      />
    </div>
  );
}
