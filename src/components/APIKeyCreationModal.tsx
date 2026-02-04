import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle, Copy, CheckCircle2, Key, Loader2, Download } from 'lucide-react';
import { toast } from 'sonner';

interface APIKeyCreationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function APIKeyCreationModal({ open, onOpenChange }: APIKeyCreationModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [keyName, setKeyName] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [hasCopied, setHasCopied] = useState(false);
  const [hasSavedConfirmation, setHasSavedConfirmation] = useState(false);

  const createKeyMutation = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase.functions.invoke('create-api-key', {
        body: { name },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to create API key');
      
      return data;
    },
    onSuccess: (data) => {
      setGeneratedKey(data.api_key);
      queryClient.invalidateQueries({ queryKey: ['user-api-keys'] });
      toast.success('API key created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create API key');
    },
  });

  const handleCreate = () => {
    if (!keyName.trim()) {
      toast.error('Please enter a name for your API key');
      return;
    }
    createKeyMutation.mutate(keyName);
  };

  const handleCopy = async () => {
    if (!generatedKey) return;
    
    try {
      await navigator.clipboard.writeText(generatedKey);
      setHasCopied(true);
      toast.success('API key copied to clipboard');
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleDownload = () => {
    if (!generatedKey) return;
    
    const content = `API Key: ${generatedKey}\nName: ${keyName}\nCreated: ${new Date().toISOString()}\n\nKeep this key secure and never share it publicly!`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `api-key-${keyName.replace(/\s+/g, '-').toLowerCase()}.txt`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
    toast.success('API key downloaded');
  };

  const handleClose = () => {
    if (generatedKey && !hasSavedConfirmation) {
      toast.error('Please confirm you have saved your API key');
      return;
    }
    
    // Reset state
    setKeyName('');
    setGeneratedKey(null);
    setHasCopied(false);
    setHasSavedConfirmation(false);
    onOpenChange(false);
  };

  const isCreating = createKeyMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Key className="h-5 w-5 text-primary" />
            {generatedKey ? 'API Key Created' : 'Create New API Key'}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {generatedKey 
              ? 'Your API key has been created. Copy it now — you will not be able to see it again.'
              : 'Give your API key a descriptive name to identify its usage.'}
          </DialogDescription>
        </DialogHeader>

        {!generatedKey ? (
          <>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="key-name" className="text-foreground">Key Name</Label>
                <Input
                  id="key-name"
                  placeholder="e.g., Production App, Development"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  className="bg-background border-border text-foreground"
                  disabled={isCreating}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose} disabled={isCreating}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={isCreating || !keyName.trim()}>
                {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Key
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-4 py-4">
              {/* Warning */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-300">
                  <strong>Important:</strong> This key will only be shown once. Make sure to copy and save it in a secure location.
                </p>
              </div>

              {/* Key Display */}
              <div className="space-y-2">
                <Label className="text-foreground">Your API Key</Label>
                <div className="relative">
                  <code className="block w-full p-3 pr-24 rounded-lg bg-surface border border-border font-mono text-sm text-foreground break-all">
                    {generatedKey}
                  </code>
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleDownload}
                      title="Download as file"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleCopy}
                      title="Copy to clipboard"
                    >
                      {hasCopied ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Confirmation Checkbox */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="saved-confirmation"
                  checked={hasSavedConfirmation}
                  onCheckedChange={(checked) => setHasSavedConfirmation(checked === true)}
                />
                <label
                  htmlFor="saved-confirmation"
                  className="text-sm font-medium leading-none text-muted-foreground cursor-pointer"
                >
                  I have saved this API key securely
                </label>
              </div>
            </div>
            <DialogFooter>
              <Button 
                onClick={handleClose} 
                disabled={!hasSavedConfirmation}
                className="w-full"
              >
                Done
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
