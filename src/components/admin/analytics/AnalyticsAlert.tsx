import { useState, useEffect, useMemo } from 'react';
import { X, TrendingDown, TrendingUp, AlertTriangle, Lightbulb, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface AnalyticsInsight {
  id: string;
  type: 'warning' | 'success' | 'info' | 'recommendation';
  title: string;
  message: string;
  actionLabel?: string;
  actionUrl?: string;
  dismissable?: boolean;
}

interface AnalyticsAlertProps {
  insights: AnalyticsInsight[];
  storageKey: string;
}

const ICON_MAP = {
  warning: TrendingDown,
  success: TrendingUp,
  info: Clock,
  recommendation: Lightbulb,
};

const STYLE_MAP = {
  warning: {
    bg: 'bg-amber-500/10 border-amber-500/30',
    icon: 'text-amber-400',
    title: 'text-amber-300',
  },
  success: {
    bg: 'bg-emerald-500/10 border-emerald-500/30',
    icon: 'text-emerald-400',
    title: 'text-emerald-300',
  },
  info: {
    bg: 'bg-blue-500/10 border-blue-500/30',
    icon: 'text-blue-400',
    title: 'text-blue-300',
  },
  recommendation: {
    bg: 'bg-purple-500/10 border-purple-500/30',
    icon: 'text-purple-400',
    title: 'text-purple-300',
  },
};

export default function AnalyticsAlert({ insights, storageKey }: AnalyticsAlertProps) {
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(`analytics-dismissed-${storageKey}`);
    if (stored) {
      try {
        setDismissedIds(JSON.parse(stored));
      } catch {
        // Invalid JSON, ignore
      }
    }
  }, [storageKey]);

  const dismiss = (id: string) => {
    const newDismissed = [...dismissedIds, id];
    setDismissedIds(newDismissed);
    localStorage.setItem(
      `analytics-dismissed-${storageKey}`,
      JSON.stringify(newDismissed)
    );
  };

  const visibleInsights = useMemo(
    () => insights.filter((i) => !dismissedIds.includes(i.id)),
    [insights, dismissedIds]
  );

  if (visibleInsights.length === 0) return null;

  return (
    <div className="space-y-3 mb-6">
      {visibleInsights.map((insight) => {
        const Icon = ICON_MAP[insight.type];
        const style = STYLE_MAP[insight.type];

        return (
          <div
            key={insight.id}
            className={cn(
              'flex items-start gap-3 p-4 rounded-lg border',
              style.bg
            )}
          >
            <Icon className={cn('h-5 w-5 mt-0.5 flex-shrink-0', style.icon)} />
            <div className="flex-1 min-w-0">
              <h4 className={cn('font-medium text-sm', style.title)}>
                {insight.title}
              </h4>
              <p className="text-sm text-slate-300 mt-0.5">{insight.message}</p>
              {insight.actionLabel && insight.actionUrl && (
                <Button
                  variant="link"
                  size="sm"
                  className="p-0 h-auto mt-1 text-white hover:text-admin-accent"
                  onClick={() => window.location.href = insight.actionUrl!}
                >
                  {insight.actionLabel} →
                </Button>
              )}
            </div>
            {insight.dismissable !== false && (
              <button
                onClick={() => dismiss(insight.id)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Helper function to generate insights from analytics data
export function generateModelInsights(
  models: Array<{
    model_id: string;
    model_name: string;
    success_rate: number;
    total_requests: number;
    last_used: string | null;
  }>,
  previousPeriodModels?: Array<{
    model_id: string;
    success_rate: number;
    total_requests: number;
  }>
): AnalyticsInsight[] {
  const insights: AnalyticsInsight[] = [];

  // Check for success rate drops
  if (previousPeriodModels) {
    models.forEach((model) => {
      const prev = previousPeriodModels.find((p) => p.model_id === model.model_id);
      if (prev && model.success_rate < prev.success_rate - 5) {
        insights.push({
          id: `success-drop-${model.model_id}`,
          type: 'warning',
          title: `${model.model_name} Success Rate Dropped`,
          message: `Success rate dropped from ${prev.success_rate.toFixed(1)}% to ${model.success_rate.toFixed(1)}%`,
          actionLabel: 'View Details',
          actionUrl: `?tab=models&model=${model.model_id}`,
        });
      }
    });
  }

  // Check for unused models (no usage in 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  models.forEach((model) => {
    if (model.last_used) {
      const lastUsed = new Date(model.last_used);
      if (lastUsed < thirtyDaysAgo && model.total_requests > 0) {
        insights.push({
          id: `unused-${model.model_id}`,
          type: 'info',
          title: `${model.model_name} Not Used Recently`,
          message: 'This model hasn\'t been used in over 30 days. Consider disabling it.',
          actionLabel: 'View Model',
          actionUrl: `?tab=models&model=${model.model_id}`,
        });
      }
    }
  });

  // Check for low success rates
  models.forEach((model) => {
    if (model.success_rate < 85 && model.total_requests > 10) {
      insights.push({
        id: `low-success-${model.model_id}`,
        type: 'warning',
        title: `${model.model_name} Has Low Success Rate`,
        message: `Only ${model.success_rate.toFixed(1)}% of requests are successful. Check for issues.`,
        actionLabel: 'View Details',
        actionUrl: `?tab=models&model=${model.model_id}`,
      });
    }
  });

  return insights.slice(0, 5); // Max 5 insights
}

export function generateProviderInsights(
  providers: Array<{
    provider_id: string;
    provider_name: string;
    provider_display_name: string;
    success_rate: number;
    total_requests: number;
    avg_response_time: number;
    total_cost: number;
  }>
): AnalyticsInsight[] {
  const insights: AnalyticsInsight[] = [];

  // Find slowest provider
  const sortedBySpeed = [...providers].sort(
    (a, b) => b.avg_response_time - a.avg_response_time
  );
  const avgSpeed = providers.reduce((sum, p) => sum + p.avg_response_time, 0) / providers.length;
  
  if (sortedBySpeed[0] && sortedBySpeed[0].avg_response_time > avgSpeed * 2) {
    const slowest = sortedBySpeed[0];
    insights.push({
      id: `slow-provider-${slowest.provider_id}`,
      type: 'warning',
      title: `${slowest.provider_display_name} Is Slower Than Average`,
      message: `Average response time is ${Math.round(slowest.avg_response_time)}ms, which is ${Math.round(slowest.avg_response_time / avgSpeed)}x slower than other providers.`,
      actionLabel: 'View Provider',
      actionUrl: `?tab=providers&provider=${slowest.provider_id}`,
    });
  }

  // Cost comparison recommendation
  const sortedByCost = [...providers]
    .filter((p) => p.total_requests > 0)
    .sort((a, b) => (b.total_cost / b.total_requests) - (a.total_cost / a.total_requests));
  
  if (sortedByCost.length >= 2) {
    const mostExpensive = sortedByCost[0];
    const cheapest = sortedByCost[sortedByCost.length - 1];
    const potentialSavings = mostExpensive.total_cost - 
      (mostExpensive.total_requests * (cheapest.total_cost / cheapest.total_requests));
    
    if (potentialSavings > 10) {
      insights.push({
        id: 'cost-savings',
        type: 'recommendation',
        title: 'Potential Cost Savings',
        message: `Switching from ${mostExpensive.provider_display_name} to ${cheapest.provider_display_name} could save ~$${potentialSavings.toFixed(2)}.`,
        dismissable: true,
      });
    }
  }

  // Low reliability warning
  providers.forEach((provider) => {
    if (provider.success_rate < 90 && provider.total_requests > 50) {
      insights.push({
        id: `reliability-${provider.provider_id}`,
        type: 'warning',
        title: `${provider.provider_display_name} Reliability Issues`,
        message: `Success rate is only ${provider.success_rate.toFixed(1)}%. Consider switching to a fallback.`,
        actionLabel: 'View Provider',
        actionUrl: `?tab=providers&provider=${provider.provider_id}`,
      });
    }
  });

  return insights.slice(0, 5);
}
