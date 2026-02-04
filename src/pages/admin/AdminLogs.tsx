import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter, Download, Activity, AlertTriangle, Info, CheckCircle, User, Settings, Trash2, Edit } from 'lucide-react';

interface AuditLog {
  id: string;
  actor_id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  old_value: Record<string, any> | null;
  new_value: Record<string, any> | null;
  details: Record<string, any> | null;
  created_at: string;
}

export default function AdminLogs() {
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');

  const { data: logs, isLoading } = useQuery({
    queryKey: ['admin-audit-logs', actionFilter],
    queryFn: async () => {
      let query = supabase
        .from('admin_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (actionFilter !== 'all') {
        query = query.ilike('action', `%${actionFilter}%`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as AuditLog[];
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ['admin-profiles-for-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, display_name, username');
      
      if (error) throw error;
      return data;
    },
  });

  const getActorName = (actorId: string) => {
    const profile = profiles?.find(p => p.user_id === actorId);
    return profile?.display_name || profile?.username || actorId.slice(0, 8);
  };

  const filteredLogs = logs?.filter(log => {
    const actorName = getActorName(log.actor_id);
    return log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
           actorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
           log.target_type?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const getActionIcon = (action: string) => {
    if (action.includes('delete') || action.includes('removed')) {
      return <Trash2 className="h-4 w-4 text-admin-danger" />;
    }
    if (action.includes('create') || action.includes('assigned')) {
      return <CheckCircle className="h-4 w-4 text-admin-success" />;
    }
    if (action.includes('update')) {
      return <Edit className="h-4 w-4 text-admin-warning" />;
    }
    if (action.includes('role')) {
      return <User className="h-4 w-4 text-admin-accent" />;
    }
    if (action.includes('model')) {
      return <Settings className="h-4 w-4 text-admin-accent" />;
    }
    return <Info className="h-4 w-4 text-admin-accent" />;
  };

  const getActionBadgeVariant = (action: string): "default" | "secondary" | "destructive" | "outline" => {
    if (action.includes('delete') || action.includes('removed')) return 'destructive';
    if (action.includes('create') || action.includes('assigned')) return 'default';
    if (action.includes('update')) return 'secondary';
    return 'outline';
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatActionName = (action: string) => {
    return action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const renderValueChanges = (oldValue: Record<string, any> | null, newValue: Record<string, any> | null) => {
    if (!oldValue && !newValue) return null;
    
    return (
      <div className="mt-2 text-xs">
        {oldValue && (
          <div className="text-slate-500">
            <span className="text-admin-danger">-</span> {JSON.stringify(oldValue)}
          </div>
        )}
        {newValue && (
          <div className="text-slate-500">
            <span className="text-admin-success">+</span> {JSON.stringify(newValue)}
          </div>
        )}
      </div>
    );
  };

  const stats = {
    total: logs?.length || 0,
    roleChanges: logs?.filter(l => l.action.includes('role')).length || 0,
    modelChanges: logs?.filter(l => l.action.includes('model')).length || 0,
    deletions: logs?.filter(l => l.action.includes('delete') || l.action.includes('removed')).length || 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Audit Logs</h1>
          <p className="text-slate-400 text-sm mt-1">Monitor system activity and changes</p>
        </div>
        <Button variant="outline" className="border-admin-border text-slate-300 hover:bg-admin-surface-hover">
          <Download className="h-4 w-4 mr-2" />
          Export Logs
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-admin-surface border-admin-border">
          <CardContent className="p-4 flex items-center gap-3">
            <Activity className="h-5 w-5 text-admin-accent" />
            <div>
              <p className="text-xl font-bold text-white">{stats.total}</p>
              <p className="text-xs text-slate-400">Total Events</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-admin-surface border-admin-border">
          <CardContent className="p-4 flex items-center gap-3">
            <User className="h-5 w-5 text-admin-warning" />
            <div>
              <p className="text-xl font-bold text-white">{stats.roleChanges}</p>
              <p className="text-xs text-slate-400">Role Changes</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-admin-surface border-admin-border">
          <CardContent className="p-4 flex items-center gap-3">
            <Settings className="h-5 w-5 text-admin-success" />
            <div>
              <p className="text-xl font-bold text-white">{stats.modelChanges}</p>
              <p className="text-xs text-slate-400">Model Changes</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-admin-surface border-admin-border">
          <CardContent className="p-4 flex items-center gap-3">
            <Trash2 className="h-5 w-5 text-admin-danger" />
            <div>
              <p className="text-xl font-bold text-white">{stats.deletions}</p>
              <p className="text-xs text-slate-400">Deletions</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Logs List */}
      <Card className="bg-admin-surface border-admin-border">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-admin-background border-admin-border text-white"
              />
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-full sm:w-[180px] bg-admin-background border-admin-border text-white">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by action" />
              </SelectTrigger>
              <SelectContent className="bg-admin-surface border-admin-border">
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="role">Role Changes</SelectItem>
                <SelectItem value="model">Model Changes</SelectItem>
                <SelectItem value="create">Created</SelectItem>
                <SelectItem value="update">Updated</SelectItem>
                <SelectItem value="delete">Deleted</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-admin-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLogs?.map((log) => (
                <div
                  key={log.id}
                  className="p-4 rounded-lg bg-admin-background border border-admin-border hover:border-admin-accent/50 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      {getActionIcon(log.action)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={getActionBadgeVariant(log.action)}>
                            {formatActionName(log.action)}
                          </Badge>
                          {log.target_type && (
                            <code className="text-xs bg-admin-surface px-2 py-0.5 rounded text-slate-300">
                              {log.target_type}
                            </code>
                          )}
                        </div>
                        <p className="text-sm text-slate-400 mt-1">
                          by <span className="text-white">{getActorName(log.actor_id)}</span>
                          {log.target_id && (
                            <span className="text-slate-500"> • Target: {log.target_id.slice(0, 8)}...</span>
                          )}
                        </p>
                        {renderValueChanges(log.old_value, log.new_value)}
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 whitespace-nowrap">
                      {formatTimestamp(log.created_at)}
                    </p>
                  </div>
                </div>
              ))}
              {filteredLogs?.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                  <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No audit logs found</p>
                  <p className="text-sm">Logs will appear here as actions are performed</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
