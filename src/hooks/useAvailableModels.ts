import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AIModel {
  id: string;
  name: string;
  model_id: string;
  description: string | null;
  tier: 'Free' | 'Pro' | 'Enterprise';
  max_images: number;
  supports_i2i: boolean;
  processing_type: 'Async' | 'Sync';
  max_wait_time: string;
  capabilities: Record<string, any>;
  supported_sizes: string[];
  status: 'active' | 'maintenance' | 'disabled';
}

export function useAvailableModels() {
  return useQuery({
    queryKey: ['available-models'],
    queryFn: async (): Promise<AIModel[]> => {
      const { data, error } = await supabase
        .from('models')
        .select('id, name, model_id, description, tier, max_images, supports_i2i, processing_type, max_wait_time, capabilities, supported_sizes, status')
        .eq('status', 'active')
        .order('name');

      if (error) throw error;
      
      // Calculate credits_cost based on tier (Free=0, Pro=5, Enterprise=10 as placeholder)
      // In production this should come from model_providers table or a pricing config
      return (data || []).map(model => ({
        ...model,
        credits_cost: model.tier === 'Free' ? 0 : model.tier === 'Pro' ? 5 : 10, // Placeholder - wire up real pricing
        access_level: 'public' as const,
      })) as AIModel[];
    },
    staleTime: 60000, // 1 minute
  });
}
