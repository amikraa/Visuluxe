import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ImageDetails {
  id: string;
  prompt: string;
  negative_prompt: string | null;
  image_url: string | null;
  thumbnail_url: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  error: string | null;
  credits_used: number;
  generation_time_ms: number | null;
  created_at: string;
  width: number | null;
  height: number | null;
  model_id: string | null;
  provider_id: string | null;
  metadata: {
    steps?: number;
    seed?: number;
    cfg_scale?: number;
    num_images?: number;
  } | null;
  model_name?: string;
  provider_name?: string;
}

export function useImageDetails(imageId: string | null) {
  return useQuery({
    queryKey: ['image-details', imageId],
    queryFn: async (): Promise<ImageDetails | null> => {
      if (!imageId) return null;

      const { data, error } = await supabase
        .from('images')
        .select(`
          id,
          prompt,
          negative_prompt,
          image_url,
          thumbnail_url,
          status,
          error,
          credits_used,
          generation_time_ms,
          created_at,
          width,
          height,
          model_id,
          provider_id,
          metadata,
          ai_models(name),
          providers(name)
        `)
        .eq('id', imageId)
        .single();

      if (error) {
        console.error('Error fetching image details:', error);
        throw error;
      }

      // Transform the response to flatten model and provider names
      return {
        ...data,
        model_name: (data.ai_models as any)?.name || null,
        provider_name: (data.providers as any)?.name || null,
      } as ImageDetails;
    },
    enabled: !!imageId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });
}
