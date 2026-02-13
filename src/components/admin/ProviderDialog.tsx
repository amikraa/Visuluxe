import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Eye, EyeOff, ShieldAlert, Loader2, Lock, Copy, HelpCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';

type ProviderStatus = 'active' | 'inactive' | 'maintenance' | 'error';

interface Provider {
  id: string;
  name: string;
  display_name: string;
  status: ProviderStatus;
  cost_per_image: number;
  is_fallback: boolean;
  priority: number;
  base_url: string | null;
  created_at: string;
  updated_at: string;
}

interface ProviderFormData {
  name: string;
  display_name: string;
  status: ProviderStatus;
  cost_per_image: number;
  is_fallback: boolean;
  priority: number;
  base_url: string;
  api_key: string;
}

interface ProviderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingProvider: Provider | null;
  onSuccess: () => void;
}

export default function ProviderDialog({ 
  open, 
  onOpenChange, 
  editingProvider, 
  onSuccess 
}: ProviderDialogProps) {
  const [formData, setFormData] = useState<ProviderFormData>({
    name: '',
    display_name: '',
    status: 'active',
    cost_per_image: 0.01,
    is_fallback: false,
    priority: 100,
    base_url: '',
    api_key: '',
  });

  const [updateApiKey, setUpdateApiKey] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [decryptedKey, setDecryptedKey] = useState('');
  const [maskedKey, setMaskedKey] = useState<string | null>(null);
  const [showReAuthDialog, setShowReAuthDialog] = useState(false);
  const [reAuthPassword, setReAuthPassword] = useState('');
  const [autoHideTimer, setAutoHideTimer] = useState<number | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState(30);

  // Reset form when dialog opens/closes or provider changes
  useEffect(() => {
    if (open) {
      if (editingProvider) {
        setFormData({
          name: editingProvider.name,
          display_name: editingProvider.display_name,
          status: editingProvider.status,
          cost_per_image: editingProvider.cost_per_image,
          is_fallback: editingProvider.is_fallback,
          priority: editingProvider.priority,
          base_url: editingProvider.base_url || '',
          api_key: '',
        });
        setUpdateApiKey(false);
        // Fetch masked key
        fetchMaskedKey(editingProvider.id);
      } else {
        setFormData({
          name: '',
          display_name: '',
          status: 'active',
          cost_per_image: 0.01,
          is_fallback: false,
          priority: 100,
          base_url: '',
          api_key: '',
        });
        setMaskedKey(null);
      }
      setShowKey(false);
      setDecryptedKey('');
      setReAuthPassword('');
    }
    
    return () => {
      if (autoHideTimer) {
        clearInterval(autoHideTimer);
      }
    };
  }, [open, editingProvider]);

  const fetchMaskedKey = async (providerId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('manage-provider-keys', {
        body: { action: 'get_masked', provider_id: providerId }
      });
      
      if (error) throw error;
      if (data?.masked_key) {
        setMaskedKey(data.masked_key);
      } else {
        setMaskedKey(null);
      }
    } catch (err) {
      console.error('Failed to fetch masked key:', err);
      setMaskedKey(null);
    }
  };

  // Encrypt mutation
  const encryptMutation = useMutation({
    mutationFn: async (apiKey: string) => {
      const { data, error } = await supabase.functions.invoke('manage-provider-keys', {
        body: { action: 'encrypt', api_key: apiKey }
      });
      if (error) throw error;
      return data;
    },
  });

  // Decrypt mutation
  const decryptMutation = useMutation({
    mutationFn: async ({ providerId, password }: { providerId: string; password: string }) => {
      const { data, error } = await supabase.functions.invoke('manage-provider-keys', {
        body: { action: 'decrypt', provider_id: providerId, password }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setDecryptedKey(data.api_key);
      setShowKey(true);
      setShowReAuthDialog(false);
      setReAuthPassword('');
      setSecondsRemaining(30);
      
      // Start countdown timer
      const timer = window.setInterval(() => {
        setSecondsRemaining(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            setShowKey(false);
            setDecryptedKey('');
            return 30;
          }
          return prev - 1;
        });
      }, 1000);
      setAutoHideTimer(timer);
      
      toast.success('API key decrypted. Auto-hiding in 30 seconds.');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to decrypt API key');
    },
  });

  // Create provider mutation
  const createMutation = useMutation({
    mutationFn: async (data: ProviderFormData) => {
      let encryptedKey: string | null = null;
      
      if (data.api_key) {
        const encryptResult = await encryptMutation.mutateAsync(data.api_key);
        encryptedKey = encryptResult.encrypted_key;
      }

      const { error } = await supabase.from('providers').insert({
        name: data.name,
        display_name: data.display_name,
        status: data.status,
        cost_per_image: data.cost_per_image,
        is_fallback: data.is_fallback,
        priority: data.priority,
        base_url: data.base_url || null,
        api_key_encrypted: encryptedKey,
        key_encrypted_at: encryptedKey ? new Date().toISOString() : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Provider created successfully');
      onSuccess();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create provider');
    },
  });

  // Update provider mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ProviderFormData }) => {
      const updateData: Record<string, unknown> = {
        name: data.name,
        display_name: data.display_name,
        status: data.status,
        cost_per_image: data.cost_per_image,
        is_fallback: data.is_fallback,
        priority: data.priority,
        base_url: data.base_url || null,
      };

      // Only encrypt and update if user wants to change the key
      if (updateApiKey && data.api_key) {
        const encryptResult = await encryptMutation.mutateAsync(data.api_key);
        updateData.api_key_encrypted = encryptResult.encrypted_key;
        updateData.key_encrypted_at = new Date().toISOString();
      }

      const { error } = await supabase.from('providers').update(updateData).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Provider updated successfully');
      onSuccess();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update provider');
    },
  });

  const handleSubmit = () => {
    if (!formData.name || !formData.display_name) {
      toast.error('Name and display name are required');
      return;
    }

    if (editingProvider) {
      updateMutation.mutate({ id: editingProvider.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleShowKey = () => {
    setShowReAuthDialog(true);
  };

  const handleReAuthenticate = () => {
    if (!reAuthPassword) {
      toast.error('Please enter your password');
      return;
    }
    if (editingProvider) {
      decryptMutation.mutate({ providerId: editingProvider.id, password: reAuthPassword });
    }
  };

  const handleHideKey = () => {
    if (autoHideTimer) {
      clearInterval(autoHideTimer);
      setAutoHideTimer(null);
    }
    setShowKey(false);
    setDecryptedKey('');
    setSecondsRemaining(30);
  };

  const handleCopyKey = async () => {
    try {
      await navigator.clipboard.writeText(decryptedKey);
      toast.success('API key copied to clipboard');
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending || encryptMutation.isPending;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-admin-surface border-admin-border text-white max-w-md">
          <DialogHeader>
            <DialogTitle>{editingProvider ? 'Edit Provider' : 'Add Provider'}</DialogTitle>
            <DialogDescription className="text-slate-400">
              Configure AI provider settings
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label className="text-slate-300">Name (unique identifier)</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="openai"
                className="bg-admin-background border-admin-border text-white"
              />
            </div>
            
            <div className="grid gap-2">
              <Label className="text-slate-300">Display Name</Label>
              <Input
                value={formData.display_name}
                onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                placeholder="OpenAI"
                className="bg-admin-background border-admin-border text-white"
              />
            </div>
            
            <div className="grid gap-2">
              <Label className="text-slate-300">Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v as ProviderStatus })}>
                <SelectTrigger className="bg-admin-background border-admin-border text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-admin-surface border-admin-border">
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-slate-300">Cost per Image ($)</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={formData.cost_per_image}
                  onChange={(e) => setFormData({ ...formData, cost_per_image: parseFloat(e.target.value) })}
                  className="bg-admin-background border-admin-border text-white"
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-slate-300">Priority</Label>
                <Input
                  type="number"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                  className="bg-admin-background border-admin-border text-white"
                />
              </div>
            </div>
            
            <div className="grid gap-2">
              <Label className="text-slate-300">Base URL (optional)</Label>
              <Input
                value={formData.base_url}
                onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
                placeholder="https://api.openai.com/v1"
                className="bg-admin-background border-admin-border text-white"
              />
            </div>
            
            {/* API Key Section */}
            <div className="grid gap-2">
              <Label className="text-slate-300 flex items-center gap-2">
                <Lock className="h-4 w-4" />
                API Key
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-4 w-4 text-slate-500 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs bg-admin-surface border-admin-border text-slate-200">
                    API keys are encrypted using AES-256-GCM encryption before storage. 
                    Only admins can decrypt keys, and all decryption operations are logged 
                    for security compliance.
                  </TooltipContent>
                </Tooltip>
              </Label>
              
              {editingProvider ? (
                <div className="space-y-3">
                  {/* Visible key warning banner */}
                  {showKey && (
                    <Alert className="bg-amber-500/20 border-amber-500/50">
                      <Clock className="h-4 w-4 text-amber-400" />
                      <AlertDescription className="text-amber-200">
                        <strong>Key visible!</strong> Auto-hiding in {secondsRemaining}s. Copy it now if needed.
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {/* Current key display */}
                  {maskedKey && (
                    <div className="flex items-center gap-2">
                      <Input
                        value={showKey ? decryptedKey : maskedKey}
                        readOnly
                        className="bg-admin-background border-admin-border text-white font-mono"
                      />
                      {showKey ? (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleCopyKey}
                            className="border-admin-border text-slate-300"
                            title="Copy to clipboard"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleHideKey}
                            className="border-admin-border text-slate-300 whitespace-nowrap"
                          >
                            <EyeOff className="h-4 w-4 mr-1" />
                            Hide ({secondsRemaining}s)
                          </Button>
                        </>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleShowKey}
                          disabled={decryptMutation.isPending}
                          className="border-admin-border text-slate-300 whitespace-nowrap"
                        >
                          {decryptMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Eye className="h-4 w-4 mr-1" />
                              Show Key
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  )}
                  
                  {/* Update key checkbox */}
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="update-key"
                      checked={updateApiKey}
                      onCheckedChange={(checked) => setUpdateApiKey(!!checked)}
                    />
                    <Label htmlFor="update-key" className="text-slate-400 text-sm cursor-pointer">
                      Update API key
                    </Label>
                  </div>
                  
                  {/* New key input */}
                  {updateApiKey && (
                    <Input
                      type="password"
                      value={formData.api_key}
                      onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                      placeholder="Enter new API key"
                      className="bg-admin-background border-admin-border text-white"
                    />
                  )}
                </div>
              ) : (
                <Input
                  type="password"
                  value={formData.api_key}
                  onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                  placeholder="sk-..."
                  className="bg-admin-background border-admin-border text-white"
                />
              )}
            </div>
            
            <div className="flex items-center justify-between">
              <Label className="text-slate-300">Use as Fallback</Label>
              <Switch
                checked={formData.is_fallback}
                onCheckedChange={(v) => setFormData({ ...formData, is_fallback: v })}
              />
            </div>
            
            {/* Security Notice */}
            <Alert className="bg-amber-500/10 border-amber-500/30">
              <ShieldAlert className="h-4 w-4 text-amber-400" />
              <AlertDescription className="text-amber-200 text-sm">
                API keys are encrypted with AES-256-GCM. All decryption operations are logged for security.
              </AlertDescription>
            </Alert>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)} 
              className="border-admin-border text-slate-300"
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              className="bg-admin-accent hover:bg-admin-accent-hover"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {editingProvider ? 'Saving...' : 'Creating...'}
                </>
              ) : (
                editingProvider ? 'Save Changes' : 'Create Provider'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Re-Authentication Dialog */}
      <Dialog open={showReAuthDialog} onOpenChange={setShowReAuthDialog}>
        <DialogContent className="bg-admin-surface border-admin-border text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-400" />
              Re-authentication Required
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              For security, please enter your password to view the API key. This action will be logged.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <Label className="text-slate-300">Password</Label>
            <Input
              type="password"
              value={reAuthPassword}
              onChange={(e) => setReAuthPassword(e.target.value)}
              placeholder="Enter your password"
              className="bg-admin-background border-admin-border text-white mt-2"
              onKeyDown={(e) => e.key === 'Enter' && handleReAuthenticate()}
            />
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowReAuthDialog(false);
                setReAuthPassword('');
              }}
              className="border-admin-border text-slate-300"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleReAuthenticate}
              disabled={decryptMutation.isPending || !reAuthPassword}
              className="bg-amber-500 hover:bg-amber-600 text-black"
            >
              {decryptMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Confirm & Show Key'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
