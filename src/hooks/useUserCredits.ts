import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface UserCredits {
  balance: number;
  daily_credits: number;
  last_daily_reset: string | null;
}

interface NextReset {
  hours: number;
  minutes: number;
}

// Calculate time until next daily credit reset (midnight UTC)
const calculateNextReset = (lastReset: string | null): NextReset | null => {
  // Calculate next midnight UTC
  const now = new Date();
  const nextReset = new Date(now);
  nextReset.setUTCHours(24, 0, 0, 0); // Next midnight UTC
  
  const diffMs = nextReset.getTime() - now.getTime();
  if (diffMs <= 0) return { hours: 0, minutes: 0 };
  
  const hours = Math.floor(diffMs / 3600000);
  const minutes = Math.floor((diffMs % 3600000) / 60000);
  return { hours, minutes };
};

export function useUserCredits() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['user-credits', user?.id],
    queryFn: async (): Promise<UserCredits | null> => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('user_credits')
        .select('balance, daily_credits, last_daily_reset')
        .eq('user_id', user.id)
        .single();

      if (error) {
        // If no credits record exists, return defaults
        if (error.code === 'PGRST116') {
          return { balance: 0, daily_credits: 10, last_daily_reset: null };
        }
        throw error;
      }

      return data;
    },
    enabled: !!user?.id,
    staleTime: 30000, // 30 seconds
  });

  // Calculate next reset countdown
  const nextReset = calculateNextReset(query.data?.last_daily_reset ?? null);

  return {
    ...query,
    nextReset,
  };
}

export function useUserStats() {
  const { user } = useAuth();

  const { data: imageStats } = useQuery({
    queryKey: ['user-image-stats', user?.id],
    queryFn: async () => {
      if (!user?.id) return { total: 0, today: 0 };

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [totalResult, todayResult] = await Promise.all([
        supabase
          .from('images')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id),
        supabase
          .from('images')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('created_at', today.toISOString()),
      ]);

      return {
        total: totalResult.count || 0,
        today: todayResult.count || 0,
      };
    },
    enabled: !!user?.id,
    staleTime: 60000,
  });

  const { data: requestStats } = useQuery({
    queryKey: ['user-request-stats', user?.id],
    queryFn: async () => {
      if (!user?.id) return { total: 0, today: 0 };

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [totalResult, todayResult] = await Promise.all([
        supabase
          .from('request_logs')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id),
        supabase
          .from('request_logs')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('created_at', today.toISOString()),
      ]);

      return {
        total: totalResult.count || 0,
        today: todayResult.count || 0,
      };
    },
    enabled: !!user?.id,
    staleTime: 60000,
  });

  return { imageStats, requestStats };
}

interface RecentImage {
  id: string;
  prompt: string;
  image_url: string | null;
  thumbnail_url: string | null;
  status: string;
  credits_used: number;
  created_at: string;
  model_id: string | null;
}

export function useRecentImages(limit = 10) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-recent-images', user?.id, limit],
    queryFn: async (): Promise<RecentImage[]> => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('images')
        .select('id, prompt, image_url, thumbnail_url, status, credits_used, created_at, model_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as RecentImage[];
    },
    enabled: !!user?.id,
    staleTime: 30000,
  });
}
