import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import type { DateRange } from './useAdminAnalytics';

export interface ModelAnalyticsSummary {
  model_id: string;
  model_name: string;
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  success_rate: number;
  total_credits: number;
  avg_credits_per_gen: number;
  avg_response_time: number;
  last_used: string | null;
}

export interface ModelTrendData {
  date: string;
  fullDate: string;
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  total_credits: number;
  avg_response_time: number;
}

export interface ModelTopUser {
  user_id: string;
  user_email: string | null;
  total_generations: number;
  credits_spent: number;
  success_rate: number;
  last_used: string;
}

export interface ModelSummaryCards {
  mostPopular: { name: string; requests: number; change: number } | null;
  highestRevenue: { name: string; credits: number; avgPerGen: number; change: number } | null;
  fastest: { name: string; avgTime: number; successRate: number } | null;
  mostReliable: { name: string; successRate: number; failures: number } | null;
}

// Fetch model summary stats using the database function
export function useModelsSummary(dateRange: DateRange) {
  return useQuery({
    queryKey: ['model-analytics-summary', dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_model_summary_stats', {
        p_start_date: dateRange.start.toISOString(),
        p_end_date: dateRange.end.toISOString(),
      });

      if (error) throw error;
      return (data || []) as ModelAnalyticsSummary[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes (formerly cacheTime)
    refetchOnWindowFocus: false,
  });
}

// Calculate summary cards from model data
export function useModelSummaryCards(dateRange: DateRange) {
  const { data: models, isLoading, error } = useModelsSummary(dateRange);

  const cards: ModelSummaryCards = {
    mostPopular: null,
    highestRevenue: null,
    fastest: null,
    mostReliable: null,
  };

  if (models && models.length > 0) {
    // Most Popular (highest total requests)
    const sortedByRequests = [...models].sort((a, b) => b.total_requests - a.total_requests);
    if (sortedByRequests[0]?.total_requests > 0) {
      cards.mostPopular = {
        name: sortedByRequests[0].model_name,
        requests: sortedByRequests[0].total_requests,
        change: 0, // Would need previous period data
      };
    }

    // Highest Revenue (total credits)
    const sortedByCredits = [...models].sort((a, b) => b.total_credits - a.total_credits);
    if (sortedByCredits[0]?.total_credits > 0) {
      cards.highestRevenue = {
        name: sortedByCredits[0].model_name,
        credits: sortedByCredits[0].total_credits,
        avgPerGen: sortedByCredits[0].avg_credits_per_gen,
        change: 0,
      };
    }

    // Fastest (lowest avg response time, with at least some usage)
    const modelsWithUsage = models.filter(m => m.total_requests > 0 && m.avg_response_time > 0);
    const sortedBySpeed = [...modelsWithUsage].sort((a, b) => a.avg_response_time - b.avg_response_time);
    if (sortedBySpeed[0]) {
      cards.fastest = {
        name: sortedBySpeed[0].model_name,
        avgTime: Math.round(sortedBySpeed[0].avg_response_time),
        successRate: sortedBySpeed[0].success_rate,
      };
    }

    // Most Reliable (highest success rate, with at least 10 requests)
    const modelsWithEnoughData = models.filter(m => m.total_requests >= 10);
    const sortedByReliability = [...modelsWithEnoughData].sort((a, b) => b.success_rate - a.success_rate);
    if (sortedByReliability[0]) {
      cards.mostReliable = {
        name: sortedByReliability[0].model_name,
        successRate: sortedByReliability[0].success_rate,
        failures: sortedByReliability[0].failed_requests,
      };
    }
  }

  return { data: cards, isLoading, error };
}

// Fetch detailed analytics for a single model
export function useModelDetail(modelId: string | null, dateRange: DateRange) {
  return useQuery({
    queryKey: ['model-detail-analytics', modelId, dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: async () => {
      if (!modelId) return null;

      const { data, error } = await supabase.rpc('get_model_analytics', {
        p_model_id: modelId,
        p_start_date: dateRange.start.toISOString(),
        p_end_date: dateRange.end.toISOString(),
      });

      if (error) throw error;

      return (data || []).map((row: any) => ({
        date: format(new Date(row.date), 'MMM d'),
        fullDate: row.date,
        total_requests: Number(row.total_requests),
        successful_requests: Number(row.successful_requests),
        failed_requests: Number(row.failed_requests),
        total_credits: Number(row.total_credits),
        avg_response_time: Math.round(Number(row.avg_response_time)),
      })) as ModelTrendData[];
    },
    enabled: !!modelId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

// Fetch top users for a model
export function useModelTopUsers(modelId: string | null, dateRange: DateRange) {
  return useQuery({
    queryKey: ['model-top-users', modelId, dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: async () => {
      if (!modelId) return [];

      const { data, error } = await supabase.rpc('get_model_top_users', {
        p_model_id: modelId,
        p_start_date: dateRange.start.toISOString(),
        p_end_date: dateRange.end.toISOString(),
        p_limit: 10,
      });

      if (error) throw error;
      return (data || []) as ModelTopUser[];
    },
    enabled: !!modelId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

// Fetch model configuration history from audit logs
export function useModelConfigHistory(modelId: string | null) {
  return useQuery({
    queryKey: ['model-config-history', modelId],
    queryFn: async () => {
      if (!modelId) return [];

      const { data, error } = await supabase
        .from('admin_audit_logs')
        .select('*')
        .eq('target_type', 'ai_models')
        .eq('target_id', modelId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
    enabled: !!modelId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

// Fetch model info (for detail modal)
export function useModelInfo(modelId: string | null) {
  return useQuery({
    queryKey: ['model-info', modelId],
    queryFn: async () => {
      if (!modelId) return null;

      const { data, error } = await supabase
        .from('ai_models')
        .select('*')
        .eq('id', modelId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!modelId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

// Export model analytics as CSV
export function generateModelAnalyticsCSV(
  models: ModelAnalyticsSummary[],
  dateRange: DateRange
): string {
  const rows: string[][] = [];

  rows.push(['Model Analytics Export']);
  rows.push(['Date Range', `${format(dateRange.start, 'yyyy-MM-dd')} to ${format(dateRange.end, 'yyyy-MM-dd')}`]);
  rows.push(['Generated At', format(new Date(), 'yyyy-MM-dd HH:mm:ss')]);
  rows.push([]);

  rows.push([
    'Model Name',
    'Total Requests',
    'Successful',
    'Failed',
    'Success Rate %',
    'Total Credits',
    'Avg Credits/Gen',
    'Avg Response Time (ms)',
    'Last Used',
  ]);

  models.forEach((m) => {
    rows.push([
      m.model_name,
      String(m.total_requests),
      String(m.successful_requests),
      String(m.failed_requests),
      String(m.success_rate),
      String(m.total_credits),
      String(m.avg_credits_per_gen),
      String(Math.round(m.avg_response_time)),
      m.last_used || 'Never',
    ]);
  });

  return rows
    .map((row) =>
      row
        .map((cell) => {
          if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
            return `"${cell.replace(/"/g, '""')}"`;
          }
          return cell;
        })
        .join(',')
    )
    .join('\n');
}
