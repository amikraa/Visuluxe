import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAdmin } from '@/contexts/AdminContext';
import { useToast } from '@/hooks/use-toast';
import { ModelDialog } from '@/components/admin/ModelDialog';
import { devLog } from '@/lib/logger';
import { format, formatDistanceToNow } from 'date-fns';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';

export interface AIModel {
  id: string;
  name: string;
  model_id: string;
  engine_type: string;
  category: string;
  status: 'active' | 'beta' | 'disabled' | 'offline';
  credits_cost: number;
  access_level: 'public' | 'partner_only' | 'admin_only';
  rpm: number;
  rpd: number;
  usage_count: number;
  api_endpoint: string | null;
  description: string | null;
  is_partner_only: boolean;
  fallback_model_id: string | null;
  is_soft_disabled: boolean;
  soft_disable_message: string | null;
  cooldown_until: string | null;
  created_at: string;
  updated_at: string;
}

export default function AdminModels() {
  const { isAdmin, isSuperAdmin } = useAdmin();
  const { toast } = useToast();
  
  const [models, setModels] = useState<AIModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<AIModel | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [modelToDelete, setModelToDelete] = useState<AIModel | null>(null);

  const fetchModels = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_models')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setModels((data as AIModel[]) || []);
    } catch (error) {
      devLog.error('Error fetching models:', error);
      toast({
        title: 'Error',
        description: 'Failed to load models',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModels();
  }, []);

  const handleToggleStatus = async (model: AIModel) => {
    if (!isAdmin) return;

    const newStatus = model.status === 'active' ? 'disabled' : 'active';
    
    try {
      const { error } = await supabase
        .from('ai_models')
        .update({ status: newStatus })
        .eq('id', model.id);

      if (error) throw error;

      setModels(models.map(m => 
        m.id === model.id ? { ...m, status: newStatus } : m
      ));

      toast({
        title: 'Model Updated',
        description: `${model.name} is now ${newStatus}`,
      });
    } catch (error) {
      devLog.error('Error updating model:', error);
      toast({
        title: 'Error',
        description: 'Failed to update model status',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (model: AIModel) => {
    setEditingModel(model);
    setDialogOpen(true);
  };

  const handleDelete = (model: AIModel) => {
    setModelToDelete(model);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!modelToDelete || !isSuperAdmin) return;

    try {
      const { error } = await supabase
        .from('ai_models')
        .delete()
        .eq('id', modelToDelete.id);

      if (error) throw error;

      setModels(models.filter(m => m.id !== modelToDelete.id));
      toast({
        title: 'Model Deleted',
        description: `${modelToDelete.name} has been removed`,
      });
    } catch (error) {
      devLog.error('Error deleting model:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete model',
        variant: 'destructive',
      });
    } finally {
      setDeleteDialogOpen(false);
      setModelToDelete(null);
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingModel(null);
  };

  const handleSave = () => {
    fetchModels();
    handleDialogClose();
  };

  const getStatusBadge = (model: AIModel) => {
    // Check cooldown first
    if (model.cooldown_until && new Date(model.cooldown_until) > new Date()) {
      const remaining = formatDistanceToNow(new Date(model.cooldown_until), { addSuffix: false });
      return (
        <Tooltip>
          <TooltipTrigger>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium border bg-blue-500/20 text-blue-400 border-blue-500/20">
              Cooldown
            </span>
          </TooltipTrigger>
          <TooltipContent className="bg-admin-surface border-admin-border text-white">
            Ends in {remaining}
          </TooltipContent>
        </Tooltip>
      );
    }
    
    // Check soft-disabled
    if (model.is_soft_disabled) {
      return (
        <Tooltip>
          <TooltipTrigger>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium border bg-amber-500/20 text-amber-400 border-amber-500/20">
              Soft Disabled
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs bg-admin-surface border-admin-border text-white">
            {model.soft_disable_message || 'Temporarily unavailable'}
          </TooltipContent>
        </Tooltip>
      );
    }
    
    // Standard status badges
    const styles: Record<string, string> = {
      active: 'bg-admin-success/20 text-admin-success border-admin-success/20',
      beta: 'bg-admin-warning/20 text-admin-warning border-admin-warning/20',
      disabled: 'bg-admin-border text-slate-400 border-admin-border',
      offline: 'bg-admin-danger/20 text-admin-danger border-admin-danger/20',
    };

    return (
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${styles[model.status] || styles.disabled}`}>
        {model.status.charAt(0).toUpperCase() + model.status.slice(1)}
      </span>
    );
  };

  const getFallbackDisplay = (model: AIModel) => {
    if (!model.fallback_model_id) {
      return <span className="text-xs text-slate-500">None</span>;
    }
    const fallbackModel = models.find(m => m.id === model.fallback_model_id);
    return (
      <span className="text-xs text-slate-400">
        → {fallbackModel?.name || 'Unknown'}
      </span>
    );
  };

  const getAccessBadge = (level: string) => {
    const styles: Record<string, string> = {
      public: 'bg-blue-700/30 text-blue-300 border-blue-700/50',
      partner_only: 'bg-purple-700/30 text-purple-300 border-purple-700/50',
      admin_only: 'bg-admin-danger/30 text-admin-danger border-admin-danger/50',
    };

    const labels: Record<string, string> = {
      public: 'Public',
      partner_only: 'Partner',
      admin_only: 'Admin',
    };

    return (
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${styles[level] || styles.public}`}>
        {labels[level] || level}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-admin-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <TooltipProvider>
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-1">Models</h2>
          <p className="text-slate-400 text-sm">Manage AI models, pricing, limits, and API connections</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {isAdmin && (
            <button
              onClick={() => setDialogOpen(true)}
              className="bg-admin-primary hover:bg-admin-primary/80 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-lg shadow-admin-primary/20"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Add Model
            </button>
          )}
          <button
            onClick={fetchModels}
            className="border border-admin-primary text-admin-primary hover:bg-admin-primary/20 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span>
            Refresh
          </button>
        </div>
      </div>

      {/* Models Table - Desktop */}
      <div className="hidden lg:block bg-admin-surface/70 backdrop-blur-xl border border-admin-border rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-400">
            <thead className="bg-admin-border/30 text-xs uppercase font-semibold text-slate-300 tracking-wider">
              <tr>
                <th className="px-4 py-3">Model Name</th>
                <th className="px-2 py-3">Engine</th>
                <th className="px-2 py-3">Category</th>
                <th className="px-2 py-3 text-center">Status</th>
                <th className="px-2 py-3">Fallback</th>
                <th className="px-2 py-3 text-center">Credits Cost</th>
                <th className="px-2 py-3 text-center">Access</th>
                <th className="px-2 py-3 text-center">RPM / RPD</th>
                <th className="px-2 py-3 text-center">Usage</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-border/50">
              {models.map((model) => (
                <tr key={model.id} className="hover:bg-white/5 transition-colors group">
                  <td className="px-4 py-3">
                    <div className="font-bold text-white">{model.name}</div>
                    <div className="text-xs text-slate-500">ID: {model.model_id}</div>
                  </td>
                  <td className="px-2 py-3">
                    <span className="px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 text-[10px] font-medium border border-slate-600">
                      {model.engine_type}
                    </span>
                  </td>
                  <td className="px-2 py-3">
                    <span className="px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 text-[10px] font-medium border border-slate-600">
                      {model.category}
                    </span>
                  </td>
                  <td className="px-2 py-3 text-center">
                    {getStatusBadge(model)}
                  </td>
                  <td className="px-2 py-3">
                    {getFallbackDisplay(model)}
                  </td>
                  <td className="px-2 py-3 text-center font-mono text-slate-300 text-xs">
                    {model.credits_cost} credits
                  </td>
                  <td className="px-2 py-3 text-center">
                    {getAccessBadge(model.access_level)}
                  </td>
                  <td className="px-2 py-3 text-center text-slate-300 text-xs">
                    {model.rpm} / {model.rpd}
                  </td>
                  <td className="px-2 py-3 text-center text-slate-300 text-xs">
                    {model.usage_count >= 1000000 
                      ? `${(model.usage_count / 1000000).toFixed(1)}M`
                      : model.usage_count >= 1000
                      ? `${(model.usage_count / 1000).toFixed(1)}K`
                      : model.usage_count}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {isAdmin && (
                        <button
                          onClick={() => handleEdit(model)}
                          className="text-slate-500 hover:text-admin-primary p-1 rounded-full hover:bg-admin-border transition-colors"
                        >
                          <span className="material-symbols-outlined text-base">edit</span>
                        </button>
                      )}
                      {isAdmin && (
                        <Switch
                          checked={model.status === 'active'}
                          onCheckedChange={() => handleToggleStatus(model)}
                          className="data-[state=checked]:bg-admin-success"
                        />
                      )}
                      {isSuperAdmin && (
                        <button
                          onClick={() => handleDelete(model)}
                          className="text-slate-500 hover:text-admin-danger p-1 rounded-full hover:bg-admin-border transition-colors"
                        >
                          <span className="material-symbols-outlined text-base">delete</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {models.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                    No models found. {isAdmin && 'Click "Add Model" to create one.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Models Cards - Mobile/Tablet */}
      <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-4">
        {models.map((model) => (
          <div
            key={model.id}
            className="bg-admin-surface/70 backdrop-blur-xl border border-admin-border rounded-xl p-4 space-y-4"
          >
            <div className="flex justify-between items-start">
              <div>
                <h4 className="text-lg font-bold text-white">{model.name}</h4>
                <p className="text-xs text-slate-500 font-mono">ID: {model.model_id}</p>
              </div>
              {getStatusBadge(model)}
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-slate-500 text-xs">Engine</p>
                <p className="text-white">{model.engine_type}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs">Category</p>
                <p className="text-white">{model.category}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs">Credits Cost</p>
                <p className="text-white font-mono">{model.credits_cost}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs">Access</p>
                {getAccessBadge(model.access_level)}
              </div>
              <div>
                <p className="text-slate-500 text-xs">RPM / RPD</p>
                <p className="text-white">{model.rpm} / {model.rpd}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs">Usage</p>
                <p className="text-white">
                  {model.usage_count >= 1000000 
                    ? `${(model.usage_count / 1000000).toFixed(1)}M`
                    : model.usage_count >= 1000
                    ? `${(model.usage_count / 1000).toFixed(1)}K`
                    : model.usage_count}
                </p>
              </div>
            </div>

            {isAdmin && (
              <div className="flex items-center justify-between pt-2 border-t border-admin-border">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Enabled</span>
                  <Switch
                    checked={model.status === 'active'}
                    onCheckedChange={() => handleToggleStatus(model)}
                    className="data-[state=checked]:bg-admin-success"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(model)}
                    className="text-admin-primary hover:text-admin-primary/80 p-2 rounded-lg hover:bg-admin-border transition-colors"
                  >
                    <span className="material-symbols-outlined">edit</span>
                  </button>
                  {isSuperAdmin && (
                    <button
                      onClick={() => handleDelete(model)}
                      className="text-admin-danger hover:text-admin-danger/80 p-2 rounded-lg hover:bg-admin-border transition-colors"
                    >
                      <span className="material-symbols-outlined">delete</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        {models.length === 0 && (
          <div className="col-span-full text-center py-8 text-slate-500">
            No models found. {isAdmin && 'Click "Add Model" to create one.'}
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <ModelDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        model={editingModel}
        onSave={handleSave}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-admin-surface border-admin-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Model</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Are you sure you want to delete <span className="text-white font-medium">{modelToDelete?.name}</span>? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-admin-border text-white hover:bg-admin-border/80 border-admin-border">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-admin-danger text-white hover:bg-admin-danger/80"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </TooltipProvider>
  );
}
