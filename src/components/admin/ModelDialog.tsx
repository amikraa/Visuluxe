import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { devLog } from '@/lib/logger';
import { format } from 'date-fns';
import { CalendarIcon, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import type { AIModel } from '@/pages/admin/AdminModels';

const modelSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  model_id: z.string().min(1, 'Model ID is required').max(50).regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers, and hyphens allowed'),
  engine_type: z.string().min(1, 'Engine type is required'),
  category: z.string().min(1, 'Category is required'),
  credits_cost: z.number().min(0, 'Credits cost must be positive'),
  access_level: z.enum(['public', 'partner_only', 'admin_only']),
  rpm: z.number().int().min(1, 'RPM must be at least 1'),
  rpd: z.number().int().min(1, 'RPD must be at least 1'),
  api_endpoint: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  description: z.string().max(500).optional(),
  // Advanced configuration fields
  is_soft_disabled: z.boolean(),
  soft_disable_message: z.string().max(200, 'Message must be 200 characters or less'),
  cooldown_until: z.date().nullable(),
}).refine(
  (data) => !data.is_soft_disabled || (data.soft_disable_message && data.soft_disable_message.trim().length > 0),
  {
    message: 'Unavailability message is required when soft disable is enabled',
    path: ['soft_disable_message'],
  }
).refine(
  (data) => !data.cooldown_until || data.cooldown_until > new Date(),
  {
    message: 'Cooldown date must be in the future',
    path: ['cooldown_until'],
  }
);

interface ModelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  model: AIModel | null;
  onSave: () => void;
}

interface AvailableModel {
  id: string;
  name: string;
}

export function ModelDialog({ open, onOpenChange, model, onSave }: ModelDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [availableModels, setAvailableModels] = useState<AvailableModel[]>([]);

  const [formData, setFormData] = useState({
    name: '',
    model_id: '',
    engine_type: 'SDXL',
    category: 'Realistic',
    status: true,
    credits_cost: 0.001,
    access_level: 'public' as 'public' | 'partner_only' | 'admin_only',
    rpm: 60,
    rpd: 1000,
    api_endpoint: '',
    description: '',
    // Advanced configuration
    fallback_model_id: null as string | null,
    is_soft_disabled: false,
    soft_disable_message: '',
    cooldown_until: null as Date | null,
    cooldown_hour: '12',
    cooldown_minute: '00',
  });

  // Fetch available models for fallback dropdown
  useEffect(() => {
    const fetchModels = async () => {
      const { data } = await supabase
        .from('ai_models')
        .select('id, name')
        .order('name');
      
      // Filter out current model if editing
      const filtered = (data || []).filter(m => m.id !== model?.id);
      setAvailableModels(filtered);
    };
    
    if (open) {
      fetchModels();
    }
  }, [open, model?.id]);

  // Reset form when dialog opens/closes or model changes
  useEffect(() => {
    if (open) {
      if (model) {
        const cooldownDate = model.cooldown_until ? new Date(model.cooldown_until) : null;
        setFormData({
          name: model.name,
          model_id: model.model_id,
          engine_type: model.engine_type,
          category: model.category,
          status: model.status === 'active',
          credits_cost: model.credits_cost,
          access_level: model.access_level,
          rpm: model.rpm,
          rpd: model.rpd,
          api_endpoint: model.api_endpoint || '',
          description: model.description || '',
          fallback_model_id: model.fallback_model_id || null,
          is_soft_disabled: model.is_soft_disabled,
          soft_disable_message: model.soft_disable_message || '',
          cooldown_until: cooldownDate,
          cooldown_hour: cooldownDate ? format(cooldownDate, 'HH') : '12',
          cooldown_minute: cooldownDate ? format(cooldownDate, 'mm') : '00',
        });
      } else {
        setFormData({
          name: '',
          model_id: '',
          engine_type: 'SDXL',
          category: 'Realistic',
          status: true,
          credits_cost: 0.001,
          access_level: 'public',
          rpm: 60,
          rpd: 1000,
          api_endpoint: '',
          description: '',
          fallback_model_id: null,
          is_soft_disabled: false,
          soft_disable_message: '',
          cooldown_until: null,
          cooldown_hour: '12',
          cooldown_minute: '00',
        });
      }
      setErrors({});
    }
  }, [open, model]);

  const handleChange = (field: string, value: string | number | boolean | Date | null) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when field changes
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const getCooldownDateTime = (): Date | null => {
    if (!formData.cooldown_until) return null;
    
    const date = new Date(formData.cooldown_until);
    date.setHours(parseInt(formData.cooldown_hour) || 0);
    date.setMinutes(parseInt(formData.cooldown_minute) || 0);
    date.setSeconds(0);
    date.setMilliseconds(0);
    return date;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    // Check if fallback model is the same as current model
    if (model && formData.fallback_model_id === model.id) {
      setErrors({ fallback_model_id: 'Fallback model cannot be the model itself' });
      setLoading(false);
      return;
    }

    const cooldownDateTime = getCooldownDateTime();

    try {
      // Validate form data
      const validationResult = modelSchema.safeParse({
        ...formData,
        credits_cost: Number(formData.credits_cost),
        rpm: Number(formData.rpm),
        rpd: Number(formData.rpd),
        is_soft_disabled: formData.is_soft_disabled,
        soft_disable_message: formData.soft_disable_message,
        cooldown_until: cooldownDateTime,
      });

      if (!validationResult.success) {
        const fieldErrors: Record<string, string> = {};
        validationResult.error.errors.forEach(err => {
          if (err.path[0]) {
            fieldErrors[err.path[0].toString()] = err.message;
          }
        });
        setErrors(fieldErrors);
        setLoading(false);
        return;
      }

      const modelData = {
        name: formData.name,
        model_id: formData.model_id,
        engine_type: formData.engine_type,
        category: formData.category,
        status: (formData.status ? 'active' : 'disabled') as 'active' | 'beta' | 'disabled' | 'offline',
        credits_cost: Number(formData.credits_cost),
        access_level: formData.access_level,
        rpm: Number(formData.rpm),
        rpd: Number(formData.rpd),
        api_endpoint: formData.api_endpoint || null,
        description: formData.description || null,
        is_partner_only: formData.access_level === 'partner_only',
        // Advanced configuration
        fallback_model_id: formData.fallback_model_id || null,
        is_soft_disabled: formData.is_soft_disabled,
        soft_disable_message: formData.is_soft_disabled ? formData.soft_disable_message : null,
        cooldown_until: cooldownDateTime?.toISOString() || null,
      };

      if (model) {
        // Update existing model
        const { error } = await supabase
          .from('ai_models')
          .update(modelData)
          .eq('id', model.id);

        if (error) throw error;

        toast({
          title: 'Model Updated',
          description: `${formData.name} has been updated successfully.`,
        });
      } else {
        // Create new model
        const { error } = await supabase
          .from('ai_models')
          .insert([modelData]);

        if (error) throw error;

        toast({
          title: 'Model Created',
          description: `${formData.name} has been created successfully.`,
        });
      }

      onSave();
    } catch (error: any) {
      devLog.error('Error saving model:', error);
      
      if (error.code === '23505') {
        setErrors({ model_id: 'This Model ID already exists' });
      } else {
        toast({
          title: 'Error',
          description: error.message || 'Failed to save model',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-admin-surface border-admin-border text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            {model ? 'Edit Model' : 'Add New AI Model'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {/* Basic Info */}
          <div>
            <h4 className="text-lg font-semibold text-white mb-3">Basic Info</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Model Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="e.g., SDXL 1.0"
                  className={`w-full px-4 py-2 rounded-lg bg-admin-background border ${errors.name ? 'border-admin-danger' : 'border-admin-border'} text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-admin-primary focus:border-admin-primary`}
                />
                {errors.name && <p className="text-admin-danger text-xs mt-1">{errors.name}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Internal Model ID
                </label>
                <input
                  type="text"
                  value={formData.model_id}
                  onChange={(e) => handleChange('model_id', e.target.value.toLowerCase())}
                  placeholder="e.g., sdxl-v1-prod"
                  disabled={!!model}
                  className={`w-full px-4 py-2 rounded-lg bg-admin-background border ${errors.model_id ? 'border-admin-danger' : 'border-admin-border'} text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-admin-primary focus:border-admin-primary disabled:opacity-50`}
                />
                {errors.model_id && <p className="text-admin-danger text-xs mt-1">{errors.model_id}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Engine Type
                </label>
                <select
                  value={formData.engine_type}
                  onChange={(e) => handleChange('engine_type', e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-admin-background border border-admin-border text-white focus:outline-none focus:ring-1 focus:ring-admin-primary focus:border-admin-primary"
                >
                  <option value="SDXL">SDXL</option>
                  <option value="Flux">Flux</option>
                  <option value="DALL-E">DALL-E</option>
                  <option value="Midjourney">Midjourney</option>
                  <option value="Custom">Custom</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => handleChange('category', e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-admin-background border border-admin-border text-white focus:outline-none focus:ring-1 focus:ring-admin-primary focus:border-admin-primary"
                >
                  <option value="Realistic">Realistic</option>
                  <option value="Anime">Anime</option>
                  <option value="Illustration">Illustration</option>
                  <option value="Abstract">Abstract</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="col-span-full flex items-center justify-between pt-2">
                <label className="text-sm font-medium text-slate-400">Status</label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">{formData.status ? 'Active' : 'Disabled'}</span>
                  <Switch
                    checked={formData.status}
                    onCheckedChange={(checked) => handleChange('status', checked)}
                    className="data-[state=checked]:bg-admin-success"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Pricing & Access */}
          <div>
            <h4 className="text-lg font-semibold text-white mb-3">Pricing & Access</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Credits Cost / Image
                </label>
                <input
                  type="number"
                  value={formData.credits_cost}
                  onChange={(e) => handleChange('credits_cost', parseFloat(e.target.value) || 0)}
                  step="0.001"
                  min="0"
                  placeholder="0.005"
                  className={`w-full px-4 py-2 rounded-lg bg-admin-background border ${errors.credits_cost ? 'border-admin-danger' : 'border-admin-border'} text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-admin-primary focus:border-admin-primary`}
                />
                {errors.credits_cost && <p className="text-admin-danger text-xs mt-1">{errors.credits_cost}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Access Level
                </label>
                <select
                  value={formData.access_level}
                  onChange={(e) => handleChange('access_level', e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-admin-background border border-admin-border text-white focus:outline-none focus:ring-1 focus:ring-admin-primary focus:border-admin-primary"
                >
                  <option value="public">Public (All Users)</option>
                  <option value="partner_only">Partner Only</option>
                  <option value="admin_only">Admin Only</option>
                </select>
              </div>
            </div>
          </div>

          {/* Limits */}
          <div>
            <h4 className="text-lg font-semibold text-white mb-3">Limits</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  RPM (Requests Per Minute)
                </label>
                <input
                  type="number"
                  value={formData.rpm}
                  onChange={(e) => handleChange('rpm', parseInt(e.target.value) || 0)}
                  min="1"
                  placeholder="60"
                  className={`w-full px-4 py-2 rounded-lg bg-admin-background border ${errors.rpm ? 'border-admin-danger' : 'border-admin-border'} text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-admin-primary focus:border-admin-primary`}
                />
                {errors.rpm && <p className="text-admin-danger text-xs mt-1">{errors.rpm}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  RPD (Requests Per Day)
                </label>
                <input
                  type="number"
                  value={formData.rpd}
                  onChange={(e) => handleChange('rpd', parseInt(e.target.value) || 0)}
                  min="1"
                  placeholder="5000"
                  className={`w-full px-4 py-2 rounded-lg bg-admin-background border ${errors.rpd ? 'border-admin-danger' : 'border-admin-border'} text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-admin-primary focus:border-admin-primary`}
                />
                {errors.rpd && <p className="text-admin-danger text-xs mt-1">{errors.rpd}</p>}
              </div>
            </div>
          </div>

          {/* Fallback Configuration */}
          <div>
            <h4 className="text-lg font-semibold text-white mb-3">Fallback Configuration</h4>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                Fallback Model
              </label>
              <p className="text-xs text-slate-500 mb-2">
                If this model fails, requests will automatically route to the fallback
              </p>
              <Select
                value={formData.fallback_model_id || 'none'}
                onValueChange={(value) => handleChange('fallback_model_id', value === 'none' ? null : value)}
              >
                <SelectTrigger className={`w-full bg-admin-background ${errors.fallback_model_id ? 'border-admin-danger' : 'border-admin-border'} text-white`}>
                  <SelectValue placeholder="Select fallback model" />
                </SelectTrigger>
                <SelectContent className="bg-admin-surface border-admin-border">
                  <SelectItem value="none" className="text-slate-400">None (No fallback)</SelectItem>
                  {availableModels.map((m) => (
                    <SelectItem key={m.id} value={m.id} className="text-white">
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.fallback_model_id && <p className="text-admin-danger text-xs mt-1">{errors.fallback_model_id}</p>}
            </div>
          </div>

          {/* Availability Controls (Soft Disable) */}
          <div>
            <h4 className="text-lg font-semibold text-white mb-3">Availability Controls</h4>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-slate-400">Soft Disable</label>
                  <p className="text-xs text-slate-500">Show model as unavailable with custom message</p>
                </div>
                <Switch
                  checked={formData.is_soft_disabled}
                  onCheckedChange={(checked) => handleChange('is_soft_disabled', checked)}
                  className="data-[state=checked]:bg-amber-500"
                />
              </div>
              {formData.is_soft_disabled && (
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">
                    Unavailability Message
                  </label>
                  <textarea
                    value={formData.soft_disable_message}
                    onChange={(e) => handleChange('soft_disable_message', e.target.value.slice(0, 200))}
                    placeholder="This model is temporarily unavailable..."
                    maxLength={200}
                    rows={2}
                    className={`w-full px-4 py-2 rounded-lg bg-admin-background border ${errors.soft_disable_message ? 'border-admin-danger' : 'border-admin-border'} text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-admin-primary focus:border-admin-primary resize-none`}
                  />
                  <div className="flex justify-between mt-1">
                    {errors.soft_disable_message ? (
                      <p className="text-admin-danger text-xs">{errors.soft_disable_message}</p>
                    ) : (
                      <span></span>
                    )}
                    <p className="text-xs text-slate-500">{formData.soft_disable_message.length}/200</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Cooldown */}
          <div>
            <h4 className="text-lg font-semibold text-white mb-3">Cooldown</h4>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button 
                      type="button"
                      variant="outline" 
                      className="bg-admin-background border-admin-border text-white hover:bg-admin-border"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.cooldown_until 
                        ? format(formData.cooldown_until, "MMM d, yyyy") 
                        : "Set cooldown date..."}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-admin-surface border-admin-border" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.cooldown_until || undefined}
                      onSelect={(date) => handleChange('cooldown_until', date || null)}
                      disabled={(date) => date < new Date()}
                      className="pointer-events-auto"
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                
                {formData.cooldown_until && (
                  <>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="0"
                        max="23"
                        value={formData.cooldown_hour}
                        onChange={(e) => handleChange('cooldown_hour', e.target.value.padStart(2, '0'))}
                        className="w-16 bg-admin-background border-admin-border text-white text-center"
                        placeholder="HH"
                      />
                      <span className="text-slate-400">:</span>
                      <Input
                        type="number"
                        min="0"
                        max="59"
                        value={formData.cooldown_minute}
                        onChange={(e) => handleChange('cooldown_minute', e.target.value.padStart(2, '0'))}
                        className="w-16 bg-admin-background border-admin-border text-white text-center"
                        placeholder="MM"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        handleChange('cooldown_until', null);
                        handleChange('cooldown_hour', '12');
                        handleChange('cooldown_minute', '00');
                      }}
                      className="text-slate-400 hover:text-white"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Clear
                    </Button>
                  </>
                )}
              </div>
            {formData.cooldown_until && (
              <p className="text-xs text-amber-400">
                Model will be on cooldown until {format(formData.cooldown_until, "MMM d, yyyy")} at {formData.cooldown_hour}:{formData.cooldown_minute}
              </p>
            )}
            {errors.cooldown_until && (
              <p className="text-admin-danger text-xs mt-1">{errors.cooldown_until}</p>
            )}
          </div>
          </div>

          {/* API Connection */}
          <div>
            <h4 className="text-lg font-semibold text-white mb-3">API Connection</h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  API Endpoint URL
                </label>
                <input
                  type="url"
                  value={formData.api_endpoint}
                  onChange={(e) => handleChange('api_endpoint', e.target.value)}
                  placeholder="https://api.example.com/model/v1"
                  className={`w-full px-4 py-2 rounded-lg bg-admin-background border ${errors.api_endpoint ? 'border-admin-danger' : 'border-admin-border'} text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-admin-primary focus:border-admin-primary`}
                />
                {errors.api_endpoint && <p className="text-admin-danger text-xs mt-1">{errors.api_endpoint}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder="Brief description of the model..."
                  rows={3}
                  className="w-full px-4 py-2 rounded-lg bg-admin-background border border-admin-border text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-admin-primary focus:border-admin-primary resize-none"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-admin-border">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="text-slate-400 hover:text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-admin-primary hover:bg-admin-primary/80 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-admin-primary/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Saving...
                </>
              ) : (
                model ? 'Save Changes' : 'Create Model'
              )}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
