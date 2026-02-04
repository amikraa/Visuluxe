import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAdmin } from '@/contexts/AdminContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Edit2, Trash2, Power, AlertTriangle, Server, RefreshCw, Lock, LockOpen, ShieldAlert, Loader2, Plug, CheckCircle, XCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import ProviderDialog from '@/components/admin/ProviderDialog';
import ProviderTestResultsModal from '@/components/admin/ProviderTestResultsModal';
import { TypeToConfirmDialog } from '@/components/shared';
import { useTestProvider, useTestAllProviders, type TestResult } from '@/hooks/useTestProvider';
import { formatDistanceToNow } from 'date-fns';

type ProviderStatus = 'active' | 'inactive' | 'maintenance' | 'error';
type TestStatus = 'success' | 'failed' | 'never_tested';

interface Provider {
  id: string;
  name: string;
  display_name: string;
  status: ProviderStatus;
  cost_per_image: number;
  is_fallback: boolean;
  priority: number;
  base_url: string | null;
  key_encrypted_at: string | null;
  api_key_encrypted: string | null;
  created_at: string;
  updated_at: string;
  last_test_at: string | null;
  last_test_status: TestStatus | null;
  last_test_message: string | null;
  last_test_response_time: number | null;
  status_page_url: string | null;
}

export default function AdminProviders() {
  const { isSuperAdmin } = useAdmin();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Provider | null>(null);
  const [isEncryptingAll, setIsEncryptingAll] = useState(false);
  
  // Test connection state
  const [testingProviderId, setTestingProviderId] = useState<string | null>(null);
  const [testResultsModalOpen, setTestResultsModalOpen] = useState(false);
  const [selectedTestProvider, setSelectedTestProvider] = useState<Provider | null>(null);
  const [lastTestResult, setLastTestResult] = useState<TestResult | null>(null);
  const [isTestingAll, setIsTestingAll] = useState(false);
  
  const testProviderMutation = useTestProvider();
  const testAllProvidersMutation = useTestAllProviders();

  const { data: providers, isLoading } = useQuery({
    queryKey: ['admin-providers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('providers')
        .select('*')
        .order('priority', { ascending: true });
      
      if (error) throw error;
      return data as Provider[];
    },
  });

  // Count providers with unencrypted keys (has key but no key_encrypted_at)
  const unencryptedCount = providers?.filter(
    p => p.api_key_encrypted && !p.key_encrypted_at
  ).length || 0;

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('providers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Provider deleted');
      queryClient.invalidateQueries({ queryKey: ['admin-providers'] });
      setDeleteTarget(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete provider');
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ProviderStatus }) => {
      const newStatus = status === 'active' ? 'inactive' : 'active';
      const { error } = await supabase.from('providers').update({ status: newStatus }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Provider status updated');
      queryClient.invalidateQueries({ queryKey: ['admin-providers'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update status');
    },
  });

  const handleEncryptAll = async () => {
    if (!providers) return;
    
    const unencrypted = providers.filter(p => p.api_key_encrypted && !p.key_encrypted_at);
    if (unencrypted.length === 0) return;

    setIsEncryptingAll(true);
    let successCount = 0;
    let errorCount = 0;

    for (const provider of unencrypted) {
      try {
        // Call edge function to re-encrypt legacy plain-text key
        const { data, error } = await supabase.functions.invoke('manage-provider-keys', {
          body: { action: 're_encrypt_legacy', provider_id: provider.id }
        });
        
        if (error) throw error;
        if (data?.success) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch (err) {
        console.error(`Failed to encrypt key for ${provider.name}:`, err);
        errorCount++;
      }
    }

    setIsEncryptingAll(false);
    queryClient.invalidateQueries({ queryKey: ['admin-providers'] });

    if (errorCount === 0) {
      toast.success(`Successfully encrypted ${successCount} API key(s)`);
    } else {
      toast.warning(`Encrypted ${successCount} key(s), ${errorCount} failed`);
    }
  };

  const handleEdit = (provider: Provider) => {
    setEditingProvider(provider);
    setDialogOpen(true);
  };

  const handleAddNew = () => {
    setEditingProvider(null);
    setDialogOpen(true);
  };

  const handleDialogSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-providers'] });
  };

  const handleTestConnection = async (provider: Provider) => {
    setTestingProviderId(provider.id);
    try {
      const result = await testProviderMutation.mutateAsync(provider.id);
      setLastTestResult(result);
      setSelectedTestProvider(provider);
      
      if (result.success) {
        toast.success(`✓ ${provider.display_name} connection successful`, {
          description: `Response time: ${result.responseTime}ms`,
          duration: 5000,
          action: {
            label: 'View Details',
            onClick: () => setTestResultsModalOpen(true),
          },
        });
      } else {
        toast.error(`✗ ${provider.display_name} connection failed`, {
          description: result.message,
          duration: 10000,
          action: {
            label: 'View Details',
            onClick: () => setTestResultsModalOpen(true),
          },
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`✗ ${provider.display_name} connection failed`, {
        description: errorMessage,
        duration: 10000,
      });
    } finally {
      setTestingProviderId(null);
    }
  };

  const handleTestAll = async () => {
    if (!providers || providers.length === 0) return;
    
    const activeProviders = providers.filter(p => p.status === 'active');
    if (activeProviders.length === 0) {
      toast.warning('No active providers to test');
      return;
    }
    
    setIsTestingAll(true);
    const providerIds = activeProviders.map(p => p.id);
    
    try {
      const results = await testAllProvidersMutation.mutateAsync(providerIds);
      const successCount = results.filter(r => r.result.success).length;
      const failedCount = results.filter(r => !r.result.success).length;
      
      if (failedCount === 0) {
        toast.success(`All ${successCount} providers connected successfully`);
      } else if (successCount === 0) {
        toast.error(`All ${failedCount} provider tests failed`);
      } else {
        toast.warning(`${successCount} successful, ${failedCount} failed`);
      }
    } catch (err) {
      toast.error('Failed to test providers');
    } finally {
      setIsTestingAll(false);
    }
  };

  const handleViewTestDetails = (provider: Provider) => {
    setSelectedTestProvider(provider);
    setLastTestResult({
      success: provider.last_test_status === 'success',
      message: provider.last_test_message || '',
      responseTime: provider.last_test_response_time || 0,
      details: {
        statusCode: 0,
        endpoint: '',
        timestamp: provider.last_test_at || new Date().toISOString(),
      },
    });
    setTestResultsModalOpen(true);
  };

  const getTestStatusBadge = (provider: Provider) => {
    if (!provider.last_test_at || provider.last_test_status === 'never_tested') {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="border-slate-500/30 text-slate-400 cursor-pointer">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Never tested
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>Click to run a connection test</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    const timeAgo = formatDistanceToNow(new Date(provider.last_test_at), { addSuffix: true });

    if (provider.last_test_status === 'success') {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                onClick={() => handleViewTestDetails(provider)}
                className="flex items-center gap-1 cursor-pointer hover:opacity-80"
              >
                <Badge variant="outline" className="border-emerald-500/30 text-emerald-400">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {provider.last_test_response_time}ms
                </Badge>
                <span className="text-xs text-slate-500">{timeAgo}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Last tested {timeAgo}</p>
              <p>Click for details</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button 
              onClick={() => handleViewTestDetails(provider)}
              className="flex items-center gap-1 cursor-pointer hover:opacity-80"
            >
              <Badge variant="outline" className="border-red-500/30 text-red-400">
                <XCircle className="h-3 w-3 mr-1" />
                Failed
              </Badge>
              <span className="text-xs text-slate-500">{timeAgo}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{provider.last_test_message}</p>
            <p className="text-xs text-muted-foreground">Click for details</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const getStatusBadge = (status: ProviderStatus) => {
    const styles = {
      active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      inactive: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
      maintenance: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      error: 'bg-red-500/10 text-red-400 border-red-500/20',
    };
    return <Badge className={styles[status]}>{status}</Badge>;
  };

  const getKeyBadge = (provider: Provider) => {
    if (provider.key_encrypted_at) {
      return (
        <Badge variant="outline" className="border-emerald-500/30 text-emerald-400">
          <Lock className="h-3 w-3 mr-1" />
          Encrypted
        </Badge>
      );
    } else if (provider.api_key_encrypted) {
      return (
        <Badge variant="outline" className="border-red-500/30 text-red-400">
          <ShieldAlert className="h-3 w-3 mr-1" />
          Plain Text!
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline" className="border-slate-500/30 text-slate-400">
          <LockOpen className="h-3 w-3 mr-1" />
          Not Set
        </Badge>
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">AI Providers</h1>
          <p className="text-slate-400 text-sm mt-1">Manage AI service providers and their configurations</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={handleTestAll}
            disabled={isTestingAll || !providers?.length}
            className="border-admin-border text-slate-300 hover:bg-admin-surface-hover"
          >
            {isTestingAll ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Test All Active
              </>
            )}
          </Button>
          <Button onClick={handleAddNew} className="bg-admin-accent hover:bg-admin-accent-hover">
            <Plus className="h-4 w-4 mr-2" />
            Add Provider
          </Button>
        </div>
      </div>

      {/* Warning banner for unencrypted keys */}
      {unencryptedCount > 0 && (
        <Alert className="bg-red-500/10 border-red-500/30">
          <ShieldAlert className="h-4 w-4 text-red-400" />
          <AlertDescription className="text-red-200 flex items-center justify-between">
            <span>
              <strong>Security Warning:</strong> {unencryptedCount} provider(s) have unencrypted API keys stored in plain text.
            </span>
            <Button 
              size="sm" 
              onClick={handleEncryptAll}
              disabled={isEncryptingAll}
              className="ml-4 bg-red-500 hover:bg-red-600 text-white"
            >
              {isEncryptingAll ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Encrypting...
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4 mr-2" />
                  Encrypt All
                </>
              )}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card className="bg-admin-surface border-admin-border">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-admin-accent/20">
              <Server className="h-5 w-5 text-admin-accent" />
            </div>
            <div>
              <CardTitle className="text-white">Configured Providers</CardTitle>
              <CardDescription className="text-slate-400">
                {providers?.length || 0} providers configured
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-admin-accent" />
            </div>
          ) : providers && providers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="border-admin-border hover:bg-transparent">
                  <TableHead className="text-slate-400">Provider</TableHead>
                  <TableHead className="text-slate-400">Status</TableHead>
                  <TableHead className="text-slate-400">Last Test</TableHead>
                  <TableHead className="text-slate-400">Cost/Image</TableHead>
                  <TableHead className="text-slate-400">Priority</TableHead>
                  <TableHead className="text-slate-400">API Key</TableHead>
                  <TableHead className="text-slate-400">Fallback</TableHead>
                  <TableHead className="text-slate-400 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {providers.map((provider) => (
                  <TableRow key={provider.id} className="border-admin-border hover:bg-admin-surface-hover">
                    <TableCell>
                      <div>
                        <p className="font-medium text-white">{provider.display_name}</p>
                        <p className="text-xs text-slate-500">{provider.name}</p>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(provider.status)}</TableCell>
                    <TableCell>{getTestStatusBadge(provider)}</TableCell>
                    <TableCell className="text-slate-300">${provider.cost_per_image.toFixed(4)}</TableCell>
                    <TableCell className="text-slate-300">{provider.priority}</TableCell>
                    <TableCell>{getKeyBadge(provider)}</TableCell>
                    <TableCell>
                      {provider.is_fallback && (
                        <Badge variant="outline" className="border-amber-500/30 text-amber-400">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Fallback
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleTestConnection(provider)}
                                disabled={testingProviderId === provider.id || !provider.api_key_encrypted}
                                className="text-slate-400 hover:text-admin-accent"
                              >
                                {testingProviderId === provider.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Plug className="h-4 w-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{provider.api_key_encrypted ? 'Test connection' : 'No API key configured'}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleStatusMutation.mutate({ id: provider.id, status: provider.status })}
                          className="text-slate-400 hover:text-white"
                        >
                          <Power className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(provider)}
                          className="text-slate-400 hover:text-white"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        {isSuperAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTarget(provider)}
                            className="text-slate-400 hover:text-admin-danger"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-slate-400">
              <Server className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No providers configured</p>
              <p className="text-sm">Add a provider to get started</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Provider Dialog */}
      <ProviderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingProvider={editingProvider}
        onSuccess={handleDialogSuccess}
      />

      {/* Delete Confirmation Dialog */}
      <TypeToConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Provider"
        message={`Are you sure you want to delete "${deleteTarget?.display_name}"? This action cannot be undone.`}
        confirmWord="DELETE"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        isLoading={deleteMutation.isPending}
        variant="destructive"
      />

      {/* Test Results Modal */}
      <ProviderTestResultsModal
        open={testResultsModalOpen}
        onOpenChange={setTestResultsModalOpen}
        providerName={selectedTestProvider?.display_name || ''}
        providerId={selectedTestProvider?.id || ''}
        testResult={lastTestResult}
        onTestAgain={() => selectedTestProvider && handleTestConnection(selectedTestProvider)}
        onEdit={() => {
          setTestResultsModalOpen(false);
          if (selectedTestProvider) handleEdit(selectedTestProvider);
        }}
        isRetesting={testingProviderId === selectedTestProvider?.id}
      />
    </div>
  );
}
