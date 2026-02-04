import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AIModel {
  id: string;
  name: string;
  model_id: string;
  engine_type: string;
  category: string;
  status: 'active' | 'beta' | 'disabled' | 'offline';
  credits_cost: number;
  access_level: 'public' | 'partner_only' | 'admin_only';
  description: string | null;
  is_soft_disabled: boolean;
  soft_disable_message: string | null;
}

export function useAvailableModels() {
  return useQuery({
    queryKey: ['available-models'],
    queryFn: async (): Promise<AIModel[]> => {
      const { data, error } = await supabase
        .from('ai_models')
        .select('id, name, model_id, engine_type, category, status, credits_cost, access_level, description, is_soft_disabled, soft_disable_message')
        .in('status', ['active', 'beta'])
        .eq('is_soft_disabled', false)
        .order('name');

      if (error) throw error;
      return (data || []) as AIModel[];
    },
    staleTime: 60000, // 1 minute
  });
}
