import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import type { DateRange } from './useAdminAnalytics';

export interface ProviderAnalyticsSummary {
  provider_id: string;
  provider_name: string;
  provider_display_name: string;
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  success_rate: number;
  total_cost: number;
  avg_response_time: number;
  last_used: string | null;
}

export interface ProviderTrendData {
  date: string;
  fullDate: string;
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  avg_response_time: number;
}

export interface ProviderModel {
  model_id: string;
  model_name: string;
  total_requests: number;
  success_rate: number;
  avg_response_time: number;
}

export interface ProviderSummaryCards {
  mostActive: { name: string; requests: number; percentage: number } | null;
  mostReliable: { name: string; successRate: number; uptime: number } | null;
  fastest: { name: string; avgTime: number; comparison: string } | null;
  totalCost: { total: number; mostExpensive: string; trend: number } | null;
}

// Fetch provider summary stats using the database function
export function useProvidersSummary(dateRange: DateRange) {
  return useQuery({
    queryKey: ['provider-analytics-summary', dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_provider_summary_stats', {
        p_start_date: dateRange.start.toISOString(),
        p_end_date: dateRange.end.toISOString(),
      });

      if (error) throw error;
      return (data || []) as ProviderAnalyticsSummary[];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

// Calculate summary cards from provider data
export function useProviderSummaryCards(dateRange: DateRange) {
  const { data: providers, isLoading, error } = useProvidersSummary(dateRange);

  const cards: ProviderSummaryCards = {
    mostActive: null,
    mostReliable: null,
    fastest: null,
    totalCost: null,
  };

  if (providers && providers.length > 0) {
    const totalRequests = providers.reduce((sum, p) => sum + p.total_requests, 0);
    const totalCost = providers.reduce((sum, p) => sum + p.total_cost, 0);

    // Most Active (highest requests)
    const sortedByRequests = [...providers].sort((a, b) => b.total_requests - a.total_requests);
    if (sortedByRequests[0]?.total_requests > 0) {
      cards.mostActive = {
        name: sortedByRequests[0].provider_display_name,
        requests: sortedByRequests[0].total_requests,
        percentage: totalRequests > 0 
          ? Math.round((sortedByRequests[0].total_requests / totalRequests) * 100) 
          : 0,
      };
    }

    // Most Reliable (highest success rate with usage)
    const providersWithUsage = providers.filter(p => p.total_requests >= 10);
    const sortedByReliability = [...providersWithUsage].sort((a, b) => b.success_rate - a.success_rate);
    if (sortedByReliability[0]) {
      cards.mostReliable = {
        name: sortedByReliability[0].provider_display_name,
        successRate: sortedByReliability[0].success_rate,
        uptime: 99.9, // Placeholder - would need uptime tracking
      };
    }

    // Fastest (lowest avg response time)
    const providersWithTime = providers.filter(p => p.total_requests > 0 && p.avg_response_time > 0);
    const sortedBySpeed = [...providersWithTime].sort((a, b) => a.avg_response_time - b.avg_response_time);
    if (sortedBySpeed.length >= 2) {
      const fastest = sortedBySpeed[0];
      const secondFastest = sortedBySpeed[1];
      const diff = Math.round(((secondFastest.avg_response_time - fastest.avg_response_time) / secondFastest.avg_response_time) * 100);
      cards.fastest = {
        name: fastest.provider_display_name,
        avgTime: Math.round(fastest.avg_response_time),
        comparison: `${diff}% faster than ${secondFastest.provider_display_name}`,
      };
    } else if (sortedBySpeed[0]) {
      cards.fastest = {
        name: sortedBySpeed[0].provider_display_name,
        avgTime: Math.round(sortedBySpeed[0].avg_response_time),
        comparison: 'Only provider with data',
      };
    }

    // Total Cost
    const sortedByCost = [...providers].sort((a, b) => b.total_cost - a.total_cost);
    cards.totalCost = {
      total: totalCost,
      mostExpensive: sortedByCost[0]?.provider_display_name || 'N/A',
      trend: 0, // Would need previous period data
    };
  }

  return { data: cards, isLoading, error };
}

// Fetch detailed analytics for a single provider
export function useProviderDetail(providerId: string | null, dateRange: DateRange) {
  return useQuery({
    queryKey: ['provider-detail-analytics', providerId, dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: async () => {
      if (!providerId) return null;

      const { data, error } = await supabase.rpc('get_provider_analytics', {
        p_provider_id: providerId,
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
        avg_response_time: Math.round(Number(row.avg_response_time)),
      })) as ProviderTrendData[];
    },
    enabled: !!providerId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

// Fetch models using this provider
export function useProviderModels(providerId: string | null, dateRange: DateRange) {
  return useQuery({
    queryKey: ['provider-models', providerId, dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: async () => {
      if (!providerId) return [];

      const { data, error } = await supabase.rpc('get_provider_models', {
        p_provider_id: providerId,
        p_start_date: dateRange.start.toISOString(),
        p_end_date: dateRange.end.toISOString(),
      });

      if (error) throw error;
      return (data || []) as ProviderModel[];
    },
    enabled: !!providerId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

// Fetch provider info (for detail modal)
export function useProviderInfo(providerId: string | null) {
  return useQuery({
    queryKey: ['provider-info', providerId],
    queryFn: async () => {
      if (!providerId) return null;

      const { data, error } = await supabase
        .from('providers')
        .select('*')
        .eq('id', providerId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!providerId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

// Geographic data types
export interface ProviderGeographicData {
  country: string;
  total_requests: number;
  successful_requests: number;
  success_rate: number;
  avg_response_time: number;
}

// Fetch geographic distribution for a provider
export function useProviderGeographicData(providerId: string | null, dateRange: DateRange) {
  return useQuery({
    queryKey: ['provider-geographic', providerId, dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: async () => {
      if (!providerId) return [];

      // Query request_logs joined with images to get geographic data
      const { data, error } = await supabase
        .from('request_logs')
        .select(`
          country,
          images!inner(provider_id, status, generation_time_ms)
        `)
        .eq('images.provider_id', providerId)
        .gte('created_at', dateRange.start.toISOString())
        .lte('created_at', dateRange.end.toISOString())
        .not('country', 'is', null);

      if (error) throw error;

      // Aggregate by country
      const countryMap = new Map<string, {
        total: number;
        successful: number;
        responseTimes: number[];
      }>();

      (data || []).forEach((row: any) => {
        const country = row.country || 'Unknown';
        const existing = countryMap.get(country) || { total: 0, successful: 0, responseTimes: [] };
        existing.total++;
        if (row.images?.status === 'completed') {
          existing.successful++;
        }
        if (row.images?.generation_time_ms) {
          existing.responseTimes.push(row.images.generation_time_ms);
        }
        countryMap.set(country, existing);
      });

      const result: ProviderGeographicData[] = [];
      countryMap.forEach((stats, country) => {
        const avgTime = stats.responseTimes.length > 0
          ? stats.responseTimes.reduce((a, b) => a + b, 0) / stats.responseTimes.length
          : 0;
        result.push({
          country,
          total_requests: stats.total,
          successful_requests: stats.successful,
          success_rate: stats.total > 0 ? Math.round((stats.successful / stats.total) * 100 * 100) / 100 : 0,
          avg_response_time: Math.round(avgTime),
        });
      });

      return result.sort((a, b) => b.total_requests - a.total_requests);
    },
    enabled: !!providerId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

// Export provider analytics as CSV
export function generateProviderAnalyticsCSV(
  providers: ProviderAnalyticsSummary[],
  dateRange: DateRange
): string {
  const rows: string[][] = [];

  rows.push(['Provider Analytics Export']);
  rows.push(['Date Range', `${format(dateRange.start, 'yyyy-MM-dd')} to ${format(dateRange.end, 'yyyy-MM-dd')}`]);
  rows.push(['Generated At', format(new Date(), 'yyyy-MM-dd HH:mm:ss')]);
  rows.push([]);

  rows.push([
    'Provider Name',
    'Display Name',
    'Total Requests',
    'Successful',
    'Failed',
    'Success Rate %',
    'Total Cost',
    'Avg Response Time (ms)',
    'Last Used',
  ]);

  providers.forEach((p) => {
    rows.push([
      p.provider_name,
      p.provider_display_name,
      String(p.total_requests),
      String(p.successful_requests),
      String(p.failed_requests),
      String(p.success_rate),
      String(p.total_cost.toFixed(4)),
      String(Math.round(p.avg_response_time)),
      p.last_used || 'Never',
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
