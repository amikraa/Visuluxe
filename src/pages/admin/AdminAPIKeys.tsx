import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAdminReadOnly } from '@/components/admin/AdminProtectedRoute';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { Key, Search, Power, Edit2, Trash2, RefreshCw, Activity, Clock, Shield, CalendarIcon } from 'lucide-react';
import { toast } from 'sonner';
import { format, addDays } from 'date-fns';
import { cn } from '@/lib/utils';

type APIKeyStatus = 'active' | 'suspended' | 'expired' | 'revoked' | 'rate_limited';

interface APIKey {
  id: string;
  user_id: string;
  name: string;
  key_prefix: string;
  status: APIKeyStatus;
  custom_rpm: number | null;
  custom_rpd: number | null;
  usage_count: number;
  last_used_at: string | null;
  last_used_ip: string | null;
  created_at: string;
  expires_at: string | null;
  profiles: {
    display_name: string | null;
    email: string | null;
  } | null;
}

interface ValidationErrors {
  rpm?: string;
  rpd?: string;
}

export default function AdminAPIKeys() {
  const queryClient = useQueryClient();
  const { isReadOnly } = useAdminReadOnly();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<APIKey | null>(null);
  const [editForm, setEditForm] = useState({ 
    custom_rpm: '', 
    custom_rpd: '',
    expires_at: null as Date | null,
    never_expires: false
  });
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});

  // Confirmation dialogs state
  const [rotateDialogOpen, setRotateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [keyToAction, setKeyToAction] = useState<APIKey | null>(null);

  const { data: apiKeys, isLoading } = useQuery({
    queryKey: ['admin-api-keys', searchTerm, statusFilter],
    queryFn: async () => {
      const { data: keys, error } = await supabase
        .from('api_keys')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      const userIds = [...new Set(keys.map(k => k.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, email')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      
      let result = keys.map(k => ({
        ...k,
        profiles: profileMap.get(k.user_id) || null
      })) as APIKey[];

      if (statusFilter !== 'all') {
        result = result.filter(k => k.status === statusFilter);
      }

      if (searchTerm) {
        result = result.filter(key =>
          key.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          key.key_prefix.toLowerCase().includes(searchTerm.toLowerCase()) ||
          key.profiles?.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          key.profiles?.email?.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }

      return result;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['admin-api-keys-stats'],
    queryFn: async () => {
      const { data: allKeys } = await supabase
        .from('api_keys')
        .select('status, usage_count');

      if (!allKeys) return { total: 0, active: 0, totalUsage: 0 };

      return {
        total: allKeys.length,
        active: allKeys.filter(k => k.status === 'active').length,
        totalUsage: allKeys.reduce((sum, k) => sum + (k.usage_count || 0), 0),
      };
    },
  });

  // Rate limit validation constants
  const MIN_RATE_LIMIT = 1;
  const MAX_RATE_LIMIT = 10000;

  const getValidationErrors = (form: typeof editForm): ValidationErrors => {
    const errors: ValidationErrors = {};

    if (form.custom_rpm) {
      const rpm = parseInt(form.custom_rpm);
      if (isNaN(rpm) || rpm < MIN_RATE_LIMIT) {
        errors.rpm = `RPM must be at least ${MIN_RATE_LIMIT}`;
      } else if (rpm > MAX_RATE_LIMIT) {
        errors.rpm = `RPM must not exceed ${MAX_RATE_LIMIT.toLocaleString()}`;
      }
    }

    if (form.custom_rpd) {
      const rpd = parseInt(form.custom_rpd);
      if (isNaN(rpd) || rpd < MIN_RATE_LIMIT) {
        errors.rpd = `RPD must be at least ${MIN_RATE_LIMIT}`;
      } else if (rpd > MAX_RATE_LIMIT) {
        errors.rpd = `RPD must not exceed ${MAX_RATE_LIMIT.toLocaleString()}`;
      }
    }

    return errors;
  };

  // Validate form inputs
  const validateForm = (): boolean => {
    const errors = getValidationErrors(editForm);
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Update status mutation (for activate only - no confirmation needed)
  const activateMutation = useMutation({
    mutationFn: async (key: APIKey) => {
      const { error } = await supabase
        .from('api_keys')
        .update({ status: 'active' })
        .eq('id', key.id);
      if (error) throw error;

      await supabase.rpc('log_admin_action', {
        _action: 'api_key_activated',
        _target_type: 'api_keys',
        _target_id: key.id,
        _old_value: { status: key.status },
        _new_value: { status: 'active' }
      });
    },
    onSuccess: () => {
      toast.success('API key activated');
      queryClient.invalidateQueries({ queryKey: ['admin-api-keys'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to activate key');
    },
  });

  // Suspend mutation (with confirmation)
  const suspendMutation = useMutation({
    mutationFn: async (key: APIKey) => {
      const { error } = await supabase
        .from('api_keys')
        .update({ status: 'suspended' })
        .eq('id', key.id);
      if (error) throw error;

      await supabase.rpc('log_admin_action', {
        _action: 'api_key_suspended',
        _target_type: 'api_keys',
        _target_id: key.id,
        _old_value: { status: key.status },
        _new_value: { status: 'suspended' }
      });
    },
    onSuccess: () => {
      toast.success('API key suspended');
      queryClient.invalidateQueries({ queryKey: ['admin-api-keys'] });
      setSuspendDialogOpen(false);
      setKeyToAction(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to suspend key');
    },
  });

  // Update limits mutation (with expiry + audit logging)
  const updateLimitsMutation = useMutation({
    mutationFn: async ({ 
      id, 
      custom_rpm, 
      custom_rpd, 
      expires_at,
      oldValues 
    }: { 
      id: string; 
      custom_rpm: number | null; 
      custom_rpd: number | null;
      expires_at: string | null;
      oldValues: { custom_rpm: number | null; custom_rpd: number | null; expires_at: string | null };
    }) => {
      const { error } = await supabase
        .from('api_keys')
        .update({ custom_rpm, custom_rpd, expires_at })
        .eq('id', id);
      if (error) throw error;

      await supabase.rpc('log_admin_action', {
        _action: 'api_key_limits_updated',
        _target_type: 'api_keys',
        _target_id: id,
        _old_value: oldValues,
        _new_value: { custom_rpm, custom_rpd, expires_at }
      });
    },
    onSuccess: () => {
      toast.success('API key settings updated');
      queryClient.invalidateQueries({ queryKey: ['admin-api-keys'] });
      setEditDialogOpen(false);
      setValidationErrors({});
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update settings');
    },
  });

  // Rotate key mutation
  const rotateKeyMutation = useMutation({
    mutationFn: async (key: APIKey) => {
      const { error: revokeError } = await supabase
        .from('api_keys')
        .update({ status: 'revoked' })
        .eq('id', key.id);
      if (revokeError) throw revokeError;

      const { error: notifyError } = await supabase
        .from('notifications')
        .insert({
          user_id: key.user_id,
          type: 'warning',
          title: 'API Key Rotated',
          message: `Your API key "${key.name}" (${key.key_prefix}...) has been revoked by an administrator. Please create a new key.`,
          action_url: '/dashboard'
        });
      
      if (notifyError) console.error('Failed to send notification:', notifyError);

      await supabase.rpc('log_admin_action', {
        _action: 'api_key_rotated',
        _target_type: 'api_keys',
        _target_id: key.id,
        _old_value: { status: key.status },
        _new_value: { status: 'revoked' },
        _details: { user_notified: !notifyError, key_name: key.name }
      });
    },
    onSuccess: () => {
      toast.success('API key rotated and user notified');
      queryClient.invalidateQueries({ queryKey: ['admin-api-keys'] });
      setRotateDialogOpen(false);
      setConfirmText('');
      setKeyToAction(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to rotate key');
    },
  });

  // Delete mutation (with confirmation + audit)
  const deleteMutation = useMutation({
    mutationFn: async (key: APIKey) => {
      await supabase.rpc('log_admin_action', {
        _action: 'api_key_deleted',
        _target_type: 'api_keys',
        _target_id: key.id,
        _old_value: { 
          name: key.name, 
          key_prefix: key.key_prefix,
          status: key.status,
          user_id: key.user_id
        }
      });

      const { error } = await supabase
        .from('api_keys')
        .delete()
        .eq('id', key.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('API key deleted');
      queryClient.invalidateQueries({ queryKey: ['admin-api-keys'] });
      setDeleteDialogOpen(false);
      setConfirmText('');
      setKeyToAction(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete key');
    },
  });

  const handleEdit = (key: APIKey) => {
    setSelectedKey(key);
    const expiresAt = key.expires_at ? new Date(key.expires_at) : null;
    setEditForm({
      custom_rpm: key.custom_rpm?.toString() || '',
      custom_rpd: key.custom_rpd?.toString() || '',
      expires_at: expiresAt,
      never_expires: !key.expires_at
    });
    setValidationErrors({});
    setEditDialogOpen(true);
  };

  const handleSaveLimits = () => {
    if (!selectedKey) return;
    if (!validateForm()) {
      toast.error('Please fix validation errors');
      return;
    }

    const newRpm = editForm.custom_rpm ? parseInt(editForm.custom_rpm) : null;
    const newRpd = editForm.custom_rpd ? parseInt(editForm.custom_rpd) : null;
    const newExpiry = editForm.never_expires ? null : (editForm.expires_at?.toISOString() || null);

    updateLimitsMutation.mutate({
      id: selectedKey.id,
      custom_rpm: newRpm,
      custom_rpd: newRpd,
      expires_at: newExpiry,
      oldValues: {
        custom_rpm: selectedKey.custom_rpm,
        custom_rpd: selectedKey.custom_rpd,
        expires_at: selectedKey.expires_at
      }
    });
  };

  const handleStatusToggle = (key: APIKey) => {
    if (key.status === 'active') {
      setKeyToAction(key);
      setSuspendDialogOpen(true);
    } else {
      activateMutation.mutate(key);
    }
  };

  const getStatusBadge = (status: APIKeyStatus) => {
    const styles: Record<APIKeyStatus, string> = {
      active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      suspended: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      expired: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
      revoked: 'bg-red-500/10 text-red-400 border-red-500/20',
      rate_limited: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    };
    return <Badge className={styles[status]}>{status.replace('_', ' ')}</Badge>;
  };

  const formatExpiry = (expiresAt: string | null) => {
    if (!expiresAt) return { text: 'Never', className: 'text-slate-400' };
    
    const expiry = new Date(expiresAt);
    const now = new Date();
    const daysRemaining = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysRemaining < 0) {
      return { text: 'Expired', className: 'text-red-400 font-medium' };
    } else if (daysRemaining <= 30) {
      return { text: `${daysRemaining} days`, className: 'text-amber-400' };
    } else {
      return { text: format(expiry, 'MMM d, yyyy'), className: 'text-slate-300' };
    }
  };

  const isFormValid = Object.keys(validationErrors).length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">API Keys</h1>
        <p className="text-slate-400 text-sm mt-1">Manage user API keys and rate limits</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-admin-surface border-admin-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Total Keys</p>
                <p className="text-2xl font-bold text-white">{stats?.total || 0}</p>
              </div>
              <div className="p-3 rounded-lg bg-purple-500/10">
                <Key className="h-6 w-6 text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-admin-surface border-admin-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Active Keys</p>
                <p className="text-2xl font-bold text-emerald-400">{stats?.active || 0}</p>
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
                <p className="text-sm text-slate-400">Total Usage</p>
                <p className="text-2xl font-bold text-white">{stats?.totalUsage?.toLocaleString() || 0}</p>
              </div>
              <div className="p-3 rounded-lg bg-blue-500/10">
                <Activity className="h-6 w-6 text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-admin-surface border-admin-border">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-admin-accent/20">
                <Key className="h-5 w-5 text-admin-accent" />
              </div>
              <div>
                <CardTitle className="text-white">All API Keys</CardTitle>
                <CardDescription className="text-slate-400">
                  {apiKeys?.length || 0} keys found
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px] bg-admin-background border-admin-border text-white">
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent className="bg-admin-surface border-admin-border">
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="revoked">Revoked</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search keys..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 bg-admin-background border-admin-border text-white w-[200px]"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-admin-accent" />
            </div>
          ) : apiKeys && apiKeys.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="border-admin-border hover:bg-transparent">
                  <TableHead className="text-slate-400">User</TableHead>
                  <TableHead className="text-slate-400">Key</TableHead>
                  <TableHead className="text-slate-400">Status</TableHead>
                  <TableHead className="text-slate-400">Usage</TableHead>
                  <TableHead className="text-slate-400">Limits</TableHead>
                  <TableHead className="text-slate-400">Expires</TableHead>
                  <TableHead className="text-slate-400">Last Used</TableHead>
                  <TableHead className="text-slate-400 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.map((key) => {
                  const expiry = formatExpiry(key.expires_at);
                  return (
                    <TableRow key={key.id} className="border-admin-border hover:bg-admin-surface-hover">
                      <TableCell>
                        <div>
                          <p className="font-medium text-white">{key.profiles?.display_name || 'Unknown'}</p>
                          <p className="text-xs text-slate-500">{key.profiles?.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-mono text-white">{key.key_prefix}...</p>
                          <p className="text-xs text-slate-500">{key.name}</p>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(key.status)}</TableCell>
                      <TableCell className="text-slate-300">{key.usage_count.toLocaleString()}</TableCell>
                      <TableCell className="text-slate-300">
                        {key.custom_rpm || key.custom_rpd ? (
                          <span className="text-xs">
                            {key.custom_rpm && `${key.custom_rpm} RPM`}
                            {key.custom_rpm && key.custom_rpd && ' / '}
                            {key.custom_rpd && `${key.custom_rpd} RPD`}
                          </span>
                        ) : (
                          <span className="text-slate-500">Default</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={expiry.className}>{expiry.text}</span>
                      </TableCell>
                      <TableCell className="text-slate-400">
                        {key.last_used_at ? (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(key.last_used_at).toLocaleDateString()}
                          </div>
                        ) : (
                          'Never'
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {!isReadOnly ? (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleStatusToggle(key)}
                              className="text-slate-400 hover:text-white"
                              title={key.status === 'active' ? 'Suspend' : 'Activate'}
                            >
                              <Power className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setKeyToAction(key);
                                setRotateDialogOpen(true);
                              }}
                              className="text-slate-400 hover:text-amber-400"
                              title="Rotate Key"
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(key)}
                              className="text-slate-400 hover:text-white"
                              title="Edit Settings"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setKeyToAction(key);
                                setDeleteDialogOpen(true);
                              }}
                              className="text-slate-400 hover:text-red-400"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-slate-500 text-sm">View only</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-slate-400">
              <Key className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No API keys found</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Settings Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-admin-surface border-admin-border text-white">
          <DialogHeader>
            <DialogTitle>Edit API Key Settings</DialogTitle>
            <DialogDescription className="text-slate-400">
              Set custom rate limits and expiry for this API key
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedKey && (
              <div className="p-3 rounded-lg bg-admin-background border border-admin-border">
                <p className="text-sm text-slate-400">API Key</p>
                <p className="font-mono text-white">{selectedKey.key_prefix}... ({selectedKey.name})</p>
              </div>
            )}
            
            {/* Rate Limits */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm text-slate-300">Custom RPM</label>
                <Input
                  type="number"
                  value={editForm.custom_rpm}
                  onChange={(e) => {
                    const nextForm = { ...editForm, custom_rpm: e.target.value };
                    setEditForm(nextForm);
                    setValidationErrors(getValidationErrors(nextForm));
                  }}
                  placeholder="Leave empty for default"
                  min={1}
                  max={10000}
                  className={cn(
                    "bg-admin-background border-admin-border text-white",
                    validationErrors.rpm && "border-red-500"
                  )}
                />
                {validationErrors.rpm ? (
                  <p className="text-xs text-red-400">{validationErrors.rpm}</p>
                ) : (
                  <p className="text-xs text-slate-500">Must be between 1 and 10,000</p>
                )}
              </div>
              <div className="grid gap-2">
                <label className="text-sm text-slate-300">Custom RPD</label>
                <Input
                  type="number"
                  value={editForm.custom_rpd}
                  onChange={(e) => {
                    const nextForm = { ...editForm, custom_rpd: e.target.value };
                    setEditForm(nextForm);
                    setValidationErrors(getValidationErrors(nextForm));
                  }}
                  placeholder="Leave empty for default"
                  min={1}
                  max={10000}
                  className={cn(
                    "bg-admin-background border-admin-border text-white",
                    validationErrors.rpd && "border-red-500"
                  )}
                />
                {validationErrors.rpd ? (
                  <p className="text-xs text-red-400">{validationErrors.rpd}</p>
                ) : (
                  <p className="text-xs text-slate-500">Must be between 1 and 10,000</p>
                )}
              </div>
            </div>

            {/* Expiry Date */}
            <div className="space-y-3">
              <label className="text-sm text-slate-300">Expiry Date</label>
              <div className="flex items-center gap-3">
                <Checkbox
                  id="never-expires"
                  checked={editForm.never_expires}
                  onCheckedChange={(checked) => setEditForm({
                    ...editForm,
                    never_expires: !!checked,
                    expires_at: checked ? null : addDays(new Date(), 90)
                  })}
                />
                <label htmlFor="never-expires" className="text-sm text-slate-400 cursor-pointer">
                  Never expires
                </label>
              </div>
              {!editForm.never_expires && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal bg-admin-background border-admin-border",
                        !editForm.expires_at && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {editForm.expires_at 
                        ? format(editForm.expires_at, "PPP") 
                        : "Select expiry date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-admin-surface border-admin-border" align="start">
                    <Calendar
                      mode="single"
                      selected={editForm.expires_at || undefined}
                      onSelect={(date) => setEditForm({ ...editForm, expires_at: date || null })}
                      disabled={(date) => date < new Date()}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setEditDialogOpen(false)} 
              className="border-admin-border text-slate-300"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSaveLimits} 
              className="bg-admin-accent hover:bg-admin-accent-hover"
              disabled={!isFormValid || updateLimitsMutation.isPending}
            >
              {updateLimitsMutation.isPending ? 'Saving...' : 'Save Settings'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rotate Confirmation Dialog */}
      <Dialog open={rotateDialogOpen} onOpenChange={(open) => {
        setRotateDialogOpen(open);
        if (!open) { setConfirmText(''); setKeyToAction(null); }
      }}>
        <DialogContent className="bg-admin-surface border-admin-border text-white">
          <DialogHeader>
            <DialogTitle className="text-red-400">Rotate API Key</DialogTitle>
            <DialogDescription className="text-slate-400">
              This will invalidate the current key. The user must create a new one.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-sm text-red-300">
                Key: <span className="font-mono">{keyToAction?.key_prefix}...</span> ({keyToAction?.name})
              </p>
              <p className="text-sm text-red-300 mt-1">
                User: {keyToAction?.profiles?.display_name || keyToAction?.profiles?.email || 'Unknown'}
              </p>
            </div>
            <div>
              <label className="text-sm text-slate-300">Type ROTATE to confirm:</label>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="ROTATE"
                className="mt-2 bg-admin-background border-admin-border text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => { setRotateDialogOpen(false); setConfirmText(''); }}
              className="border-admin-border text-slate-300"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={confirmText !== 'ROTATE' || rotateKeyMutation.isPending}
              onClick={() => keyToAction && rotateKeyMutation.mutate(keyToAction)}
            >
              {rotateKeyMutation.isPending ? 'Rotating...' : 'Rotate Key'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={(open) => {
        setDeleteDialogOpen(open);
        if (!open) { setConfirmText(''); setKeyToAction(null); }
      }}>
        <DialogContent className="bg-admin-surface border-admin-border text-white">
          <DialogHeader>
            <DialogTitle className="text-red-400">Delete API Key</DialogTitle>
            <DialogDescription className="text-slate-400">
              This action cannot be undone. The key will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-sm text-red-300">
                Key: <span className="font-mono">{keyToAction?.key_prefix}...</span> ({keyToAction?.name})
              </p>
              <p className="text-sm text-red-300 mt-1">
                User: {keyToAction?.profiles?.display_name || keyToAction?.profiles?.email || 'Unknown'}
              </p>
            </div>
            <div>
              <label className="text-sm text-slate-300">Type DELETE to confirm:</label>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
                className="mt-2 bg-admin-background border-admin-border text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => { setDeleteDialogOpen(false); setConfirmText(''); }}
              className="border-admin-border text-slate-300"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={confirmText !== 'DELETE' || deleteMutation.isPending}
              onClick={() => keyToAction && deleteMutation.mutate(keyToAction)}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Key'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspend Confirmation Dialog */}
      <Dialog open={suspendDialogOpen} onOpenChange={(open) => {
        setSuspendDialogOpen(open);
        if (!open) setKeyToAction(null);
      }}>
        <DialogContent className="bg-admin-surface border-admin-border text-white">
          <DialogHeader>
            <DialogTitle className="text-amber-400">Suspend API Key</DialogTitle>
            <DialogDescription className="text-slate-400">
              This will temporarily disable the API key. The user will not be able to make requests.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <p className="text-sm text-amber-300">
                Key: <span className="font-mono">{keyToAction?.key_prefix}...</span> ({keyToAction?.name})
              </p>
              <p className="text-sm text-amber-300 mt-1">
                User: {keyToAction?.profiles?.display_name || keyToAction?.profiles?.email || 'Unknown'}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setSuspendDialogOpen(false)}
              className="border-admin-border text-slate-300"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="bg-amber-600 hover:bg-amber-700"
              disabled={suspendMutation.isPending}
              onClick={() => keyToAction && suspendMutation.mutate(keyToAction)}
            >
              {suspendMutation.isPending ? 'Suspending...' : 'Confirm Suspend'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
