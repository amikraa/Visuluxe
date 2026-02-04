import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, subHours, subMonths, startOfDay, endOfDay, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';

export type DatePreset = 'today' | 'yesterday' | '24h' | '7d' | '30d' | 'this_month' | 'last_month' | '3m' | '12m' | 'all' | 'custom';

export interface DateRange {
  start: Date;
  end: Date;
}

export function getDateRangeFromPreset(
  preset: DatePreset,
  customRange?: { from: Date | undefined; to: Date | undefined }
): DateRange {
  const now = new Date();
  switch (preset) {
    case 'today':
      return { start: startOfDay(now), end: now };
    case 'yesterday':
      const yesterday = subDays(now, 1);
      return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
    case '24h':
      return { start: subHours(now, 24), end: now };
    case '7d':
      return { start: subDays(now, 7), end: now };
    case '30d':
      return { start: subDays(now, 30), end: now };
    case 'this_month':
      return { start: startOfMonth(now), end: now };
    case 'last_month':
      const lastMonth = subMonths(now, 1);
      return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
    case '3m':
      return { start: subMonths(now, 3), end: now };
    case '12m':
      return { start: subMonths(now, 12), end: now };
    case 'all':
      return { start: new Date('2020-01-01'), end: now };
    case 'custom':
      return {
        start: customRange?.from || subDays(now, 7),
        end: customRange?.to || now,
      };
  }
}

export function getPreviousPeriod(dateRange: DateRange): DateRange {
  const duration = dateRange.end.getTime() - dateRange.start.getTime();
  return {
    start: new Date(dateRange.start.getTime() - duration),
    end: new Date(dateRange.end.getTime() - duration),
  };
}

export function calculatePercentChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

export function useAnalyticsStats(dateRange: DateRange) {
  return useQuery({
    queryKey: ['admin-analytics-stats', dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: async () => {
      // Get user count (all time)
      const { count: userCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Get images in date range
      const { count: imageCount } = await supabase
        .from('images')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', dateRange.start.toISOString())
        .lte('created_at', dateRange.end.toISOString());

      // Get requests in date range
      const { count: periodRequests } = await supabase
        .from('request_logs')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', dateRange.start.toISOString())
        .lte('created_at', dateRange.end.toISOString());

      // Get average response time in date range
      const { data: responseTimes } = await supabase
        .from('request_logs')
        .select('response_time_ms')
        .gte('created_at', dateRange.start.toISOString())
        .lte('created_at', dateRange.end.toISOString())
        .not('response_time_ms', 'is', null)
        .limit(100);

      const avgResponseTime = responseTimes?.length
        ? Math.round(responseTimes.reduce((sum, r) => sum + (r.response_time_ms || 0), 0) / responseTimes.length)
        : 0;

      return {
        totalUsers: userCount || 0,
        totalImages: imageCount || 0,
        periodRequests: periodRequests || 0,
        avgResponseTime,
      };
    },
  });
}

export function useRequestsOverTime(dateRange: DateRange) {
  return useQuery({
    queryKey: ['admin-analytics-requests-over-time', dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: async () => {
      const days = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
      const showFullDate = days.length > 14;

      const results = await Promise.all(
        days.map(async (date) => {
          const dayStart = new Date(date);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(date);
          dayEnd.setHours(23, 59, 59, 999);

          const { count } = await supabase
            .from('request_logs')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', dayStart.toISOString())
            .lte('created_at', dayEnd.toISOString());

          return {
            date: format(date, showFullDate ? 'MMM d' : 'EEE'),
            fullDate: format(date, 'yyyy-MM-dd'),
            requests: count || 0,
          };
        })
      );

      return results;
    },
  });
}

export function useCreditsOverTime(dateRange: DateRange) {
  return useQuery({
    queryKey: ['admin-analytics-credits-over-time', dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: async () => {
      const { data } = await supabase
        .from('credits_transactions')
        .select('amount, type, created_at')
        .gte('created_at', dateRange.start.toISOString())
        .lte('created_at', dateRange.end.toISOString())
        .order('created_at');

      if (!data?.length) return [];

      // Group by date and transaction type
      const grouped = data.reduce((acc, tx) => {
        const dateKey = format(new Date(tx.created_at), 'yyyy-MM-dd');
        if (!acc[dateKey]) acc[dateKey] = { spent: 0, added: 0 };

        // Deductions are negative amounts, additions are positive
        const amount = Number(tx.amount);
        if (amount < 0 || ['deduct', 'generation'].includes(tx.type)) {
          acc[dateKey].spent += Math.abs(amount);
        } else if (amount > 0 || ['add', 'refund', 'daily_reset', 'purchase'].includes(tx.type)) {
          acc[dateKey].added += Math.abs(amount);
        }
        return acc;
      }, {} as Record<string, { spent: number; added: number }>);

      return Object.entries(grouped)
        .map(([date, values]) => ({
          date: format(new Date(date), 'MMM d'),
          fullDate: date,
          spent: Number(values.spent.toFixed(2)),
          added: Number(values.added.toFixed(2)),
        }))
        .sort((a, b) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime());
    },
  });
}

export function useImagesPerDay(dateRange: DateRange) {
  return useQuery({
    queryKey: ['admin-analytics-images-per-day', dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: async () => {
      const { data } = await supabase
        .from('images')
        .select('status, created_at')
        .gte('created_at', dateRange.start.toISOString())
        .lte('created_at', dateRange.end.toISOString());

      if (!data?.length) return [];

      // Group by date
      const grouped = data.reduce((acc, img) => {
        const dateKey = format(new Date(img.created_at), 'yyyy-MM-dd');
        if (!acc[dateKey]) acc[dateKey] = { completed: 0, failed: 0 };

        if (img.status === 'completed') acc[dateKey].completed++;
        else if (img.status === 'failed') acc[dateKey].failed++;
        return acc;
      }, {} as Record<string, { completed: number; failed: number }>);

      return Object.entries(grouped)
        .map(([date, values]) => ({
          date: format(new Date(date), 'MMM d'),
          fullDate: date,
          successful: values.completed,
          failed: values.failed,
        }))
        .sort((a, b) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime());
    },
  });
}

export function useImagesByModel() {
  return useQuery({
    queryKey: ['admin-analytics-images-by-model'],
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_models')
        .select('name, usage_count')
        .order('usage_count', { ascending: false })
        .limit(5);

      return data?.map(m => ({
        name: m.name,
        value: m.usage_count || 0,
      })) || [];
    },
  });
}

export function useImagesByStatus(dateRange: DateRange) {
  return useQuery({
    queryKey: ['admin-analytics-images-by-status', dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: async () => {
      const statuses: Array<'completed' | 'failed' | 'pending' | 'processing'> = ['completed', 'failed', 'pending', 'processing'];
      const results = await Promise.all(
        statuses.map(async (status) => {
          const { count } = await supabase
            .from('images')
            .select('*', { count: 'exact', head: true })
            .eq('status', status)
            .gte('created_at', dateRange.start.toISOString())
            .lte('created_at', dateRange.end.toISOString());
          return { name: status, value: count || 0 };
        })
      );
      return results.filter(r => r.value > 0);
    },
  });
}

export function useHourlyActivity() {
  return useQuery({
    queryKey: ['admin-analytics-recent-activity'],
    queryFn: async () => {
      const last24Hours = [];
      for (let i = 23; i >= 0; i--) {
        const date = new Date();
        date.setHours(date.getHours() - i, 0, 0, 0);
        const nextHour = new Date(date);
        nextHour.setHours(nextHour.getHours() + 1);

        const { count } = await supabase
          .from('request_logs')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', date.toISOString())
          .lt('created_at', nextHour.toISOString());

        last24Hours.push({
          hour: date.toLocaleTimeString('en-US', { hour: 'numeric' }),
          requests: count || 0,
        });
      }
      return last24Hours;
    },
  });
}

export interface ExportData {
  dateRange: DateRange;
  stats: ReturnType<typeof useAnalyticsStats>['data'];
  requestsOverTime: ReturnType<typeof useRequestsOverTime>['data'];
  creditsOverTime: ReturnType<typeof useCreditsOverTime>['data'];
  imagesPerDay: ReturnType<typeof useImagesPerDay>['data'];
}

export function generateCSV(data: ExportData): string {
  const { dateRange, stats, requestsOverTime, creditsOverTime, imagesPerDay } = data;
  const csvRows: string[][] = [];

  // Header info
  csvRows.push(['Analytics Export']);
  csvRows.push(['Date Range', `${format(dateRange.start, 'yyyy-MM-dd')} to ${format(dateRange.end, 'yyyy-MM-dd')}`]);
  csvRows.push(['Generated At', format(new Date(), 'yyyy-MM-dd HH:mm:ss')]);
  csvRows.push([]);

  // Summary stats
  csvRows.push(['Summary Metrics']);
  csvRows.push(['Metric', 'Value']);
  csvRows.push(['Total Users', String(stats?.totalUsers ?? 0)]);
  csvRows.push(['Period Images', String(stats?.totalImages ?? 0)]);
  csvRows.push(['Period Requests', String(stats?.periodRequests ?? 0)]);
  csvRows.push(['Avg Response Time (ms)', String(stats?.avgResponseTime ?? 0)]);
  csvRows.push([]);

  // Requests per day
  if (requestsOverTime?.length) {
    csvRows.push(['Requests Over Time']);
    csvRows.push(['Date', 'Requests']);
    requestsOverTime.forEach(r => csvRows.push([r.fullDate, String(r.requests)]));
    csvRows.push([]);
  }

  // Credits activity
  if (creditsOverTime?.length) {
    csvRows.push(['Credits Activity']);
    csvRows.push(['Date', 'Spent', 'Added']);
    creditsOverTime.forEach(c => csvRows.push([c.fullDate, String(c.spent), String(c.added)]));
    csvRows.push([]);
  }

  // Images per day
  if (imagesPerDay?.length) {
    csvRows.push(['Images Per Day']);
    csvRows.push(['Date', 'Successful', 'Failed']);
    imagesPerDay.forEach(i => csvRows.push([i.fullDate, String(i.successful), String(i.failed)]));
  }

  // Escape CSV values and join
  return csvRows.map(row => 
    row.map(cell => {
      if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    }).join(',')
  ).join('\n');
}

export function downloadCSV(csvContent: string, filename: string) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
