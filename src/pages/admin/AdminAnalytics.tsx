import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  BarChart3, Cpu, Server, Users, CalendarIcon, Download
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getDateRangeFromPreset,
  getPreviousPeriod,
  generateCSV,
  downloadCSV,
  type DatePreset,
} from '@/hooks/useAdminAnalytics';
import { useAnalyticsStats, useRequestsOverTime, useCreditsOverTime, useImagesPerDay } from '@/hooks/useAdminAnalytics';
import OverviewTab from './analytics/OverviewTab';
import ModelsTab from './analytics/ModelsTab';
import ProvidersTab from './analytics/ProvidersTab';

const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '24h', label: '24H' },
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: '3m', label: '3M' },
  { value: '12m', label: '12M' },
  { value: 'all', label: 'All Time' },
  { value: 'custom', label: 'Custom' },
];

export default function AdminAnalytics() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'overview';
  
  const [datePreset, setDatePreset] = useState<DatePreset>('7d');
  const [customRange, setCustomRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [showComparison, setShowComparison] = useState(false);

  const dateRange = useMemo(
    () => getDateRangeFromPreset(datePreset, customRange),
    [datePreset, customRange]
  );

  const previousPeriod = useMemo(
    () => showComparison ? getPreviousPeriod(dateRange) : null,
    [dateRange, showComparison]
  );

  // For CSV export
  const { data: stats } = useAnalyticsStats(dateRange);
  const { data: requestsOverTime } = useRequestsOverTime(dateRange);
  const { data: creditsOverTime } = useCreditsOverTime(dateRange);
  const { data: imagesPerDay } = useImagesPerDay(dateRange);

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  const handleExportCSV = () => {
    const csvContent = generateCSV({
      dateRange,
      stats,
      requestsOverTime,
      creditsOverTime,
      imagesPerDay,
    });
    downloadCSV(csvContent, `analytics-${format(new Date(), 'yyyy-MM-dd')}.csv`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="text-slate-400 text-sm mt-1">Platform usage and performance metrics</p>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex bg-admin-surface border border-admin-border rounded-lg p-1">
          {DATE_PRESETS.map((preset) => (
            <button
              key={preset.value}
              onClick={() => setDatePreset(preset.value)}
              className={cn(
                "px-3 py-1.5 text-sm rounded-md transition-colors font-medium",
                datePreset === preset.value
                  ? "bg-admin-accent text-white"
                  : "text-slate-400 hover:text-white hover:bg-admin-border/50"
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {datePreset === 'custom' && (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="bg-admin-surface border-admin-border text-white hover:bg-admin-border"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {customRange.from && customRange.to
                  ? `${format(customRange.from, 'MMM d')} - ${format(customRange.to, 'MMM d')}`
                  : 'Select dates'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-admin-surface border-admin-border" align="start">
              <Calendar
                mode="range"
                selected={{ from: customRange.from, to: customRange.to }}
                onSelect={(range) => setCustomRange({ from: range?.from, to: range?.to })}
                className="pointer-events-auto"
                disabled={(date) => date > new Date()}
              />
            </PopoverContent>
          </Popover>
        )}

        <div className="flex items-center gap-2 ml-auto">
          <Checkbox 
            id="compare-period"
            checked={showComparison}
            onCheckedChange={(checked) => setShowComparison(checked === true)}
            className="border-admin-border data-[state=checked]:bg-admin-accent"
          />
          <Label htmlFor="compare-period" className="text-sm text-slate-400 cursor-pointer">
            Compare with previous period
          </Label>
        </div>

        <Button
          variant="outline"
          onClick={handleExportCSV}
          className="bg-admin-surface border-admin-border text-white hover:bg-admin-border"
        >
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Main Tab Navigation */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="bg-admin-surface border border-admin-border">
          <TabsTrigger value="overview" className="data-[state=active]:bg-admin-accent">
            <BarChart3 className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="models" className="data-[state=active]:bg-admin-accent">
            <Cpu className="h-4 w-4 mr-2" />
            Models
          </TabsTrigger>
          <TabsTrigger value="providers" className="data-[state=active]:bg-admin-accent">
            <Server className="h-4 w-4 mr-2" />
            Providers
          </TabsTrigger>
          <TabsTrigger value="users" disabled className="data-[state=active]:bg-admin-accent opacity-50">
            <Users className="h-4 w-4 mr-2" />
            Users
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab dateRange={dateRange} previousPeriod={previousPeriod} showComparison={showComparison} />
        </TabsContent>

        <TabsContent value="models">
          <ModelsTab dateRange={dateRange} previousPeriod={previousPeriod} showComparison={showComparison} />
        </TabsContent>

        <TabsContent value="providers">
          <ProvidersTab dateRange={dateRange} previousPeriod={previousPeriod} showComparison={showComparison} />
        </TabsContent>

        <TabsContent value="users">
          <div className="flex items-center justify-center h-[400px]">
            <div className="text-center">
              <Users className="h-12 w-12 mx-auto mb-4 text-slate-500" />
              <h3 className="text-lg font-semibold text-white mb-2">User Analytics Coming Soon</h3>
              <p className="text-slate-400 max-w-md">
                Track user retention, top users by credits, geographic distribution, and more.
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
