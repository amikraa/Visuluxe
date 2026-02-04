import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious
} from '@/components/ui/pagination';
import {
  Activity, TrendingUp, TrendingDown, Zap, DollarSign, Search, Download, ExternalLink, RefreshCw,
  ArrowUpDown, ChevronUp, ChevronDown, GitCompare
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import type { DateRange } from '@/hooks/useAdminAnalytics';
import { downloadCSV, calculatePercentChange } from '@/hooks/useAdminAnalytics';
import {
  useProvidersSummary,
  useProviderSummaryCards,
  generateProviderAnalyticsCSV,
  type ProviderAnalyticsSummary,
} from '@/hooks/useProviderAnalytics';
import ProviderDetailModal from '@/components/admin/analytics/ProviderDetailModal';
import ComparisonModal from '@/components/admin/analytics/ComparisonModal';
import AnalyticsAlert, { generateProviderInsights } from '@/components/admin/analytics/AnalyticsAlert';

interface ProvidersTabProps {
  dateRange: DateRange;
  previousPeriod?: DateRange | null;
  showComparison?: boolean;
}

type SortField = 'total_requests' | 'successful_requests' | 'failed_requests' | 'success_rate' | 'total_cost' | 'avg_response_time';
type SortDirection = 'asc' | 'desc';

const PAGE_SIZE = 20;

function getSuccessRateColor(rate: number): string {
  if (rate >= 95) return 'text-emerald-400';
  if (rate >= 85) return 'text-yellow-400';
  return 'text-red-400';
}

// Change indicator component for period comparison
function ChangeIndicator({ current, previous, inverse = false }: { current: number; previous: number | undefined; inverse?: boolean }) {
  if (previous === undefined) return null;
  
  const change = calculatePercentChange(current, previous);
  if (change === null) return null;
  
  // For metrics like response time or cost, lower is better (inverse = true)
  const isPositive = inverse ? change < 0 : change >= 0;
  const Icon = change >= 0 ? TrendingUp : TrendingDown;
  
  return (
    <span className={cn(
      "inline-flex items-center text-xs ml-2",
      isPositive ? "text-emerald-400" : "text-red-400"
    )}>
      <Icon className="h-3 w-3 mr-0.5" />
      {Math.abs(change)}%
    </span>
  );
}

export default function ProvidersTab({ dateRange, previousPeriod, showComparison }: ProvidersTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('total_requests');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [showComparisonModal, setShowComparisonModal] = useState(false);

  const { data: providers, isLoading } = useProvidersSummary(dateRange);
  const { data: summaryCards, isLoading: cardsLoading } = useProviderSummaryCards(dateRange);
  
  // Fetch previous period data when comparison is enabled
  const { data: previousProviders } = useProvidersSummary(
    previousPeriod || { start: new Date(), end: new Date() }
  );
  const { data: previousCards } = useProviderSummaryCards(
    previousPeriod || { start: new Date(), end: new Date() }
  );
  
  // Get previous period values for comparison (only used when showComparison is true)
  const getPreviousValue = (providerId: string, field: keyof ProviderAnalyticsSummary): number | undefined => {
    if (!showComparison || !previousPeriod || !previousProviders) return undefined;
    const prevProvider = previousProviders.find(p => p.provider_id === providerId);
    return prevProvider ? Number(prevProvider[field]) : undefined;
  };

  // Generate insights from provider data
  const insights = useMemo(() => {
    if (!providers) return [];
    return generateProviderInsights(providers);
  }, [providers]);

  // Prepare data for comparison modal
  const comparisonItems = useMemo(() => {
    if (!providers) return [];
    return providers.map(p => ({
      id: p.provider_id,
      name: p.provider_display_name,
      totalRequests: p.total_requests,
      successRate: p.success_rate,
      totalCost: p.total_cost,
      avgResponseTime: p.avg_response_time,
    }));
  }, [providers]);

  // Filter and sort providers
  const filteredAndSortedProviders = useMemo(() => {
    if (!providers) return [];

    let result = [...providers];

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p => 
        p.provider_name.toLowerCase().includes(query) ||
        p.provider_display_name.toLowerCase().includes(query)
      );
    }

    // Sort
    result.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      const diff = Number(aVal) - Number(bVal);
      return sortDirection === 'asc' ? diff : -diff;
    });

    return result;
  }, [providers, searchQuery, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedProviders.length / PAGE_SIZE);
  const paginatedProviders = filteredAndSortedProviders.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleExportCSV = () => {
    if (!providers) return;
    const csv = generateProviderAnalyticsCSV(providers, dateRange);
    downloadCSV(csv, `provider-analytics-${dateRange.start.toISOString().split('T')[0]}-to-${dateRange.end.toISOString().split('T')[0]}.csv`);
  };

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead 
      className="cursor-pointer hover:bg-admin-border/30 transition-colors"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field ? (
          sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
        ) : (
          <ArrowUpDown className="h-4 w-4 opacity-30" />
        )}
      </div>
    </TableHead>
  );

  if (isLoading || cardsLoading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-admin-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Alerts/Insights */}
      <AnalyticsAlert insights={insights} storageKey="providers" />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Most Active */}
        <Card className="bg-admin-surface border-admin-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">Most Active</span>
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Activity className="h-4 w-4 text-blue-400" />
              </div>
            </div>
            {summaryCards?.mostActive ? (
              <>
                <p className="text-lg font-semibold text-white truncate">{summaryCards.mostActive.name}</p>
                <div className="flex items-center">
                  <p className="text-2xl font-bold text-white">{summaryCards.mostActive.requests.toLocaleString()}</p>
                  {showComparison && previousCards?.mostActive && (
                    <ChangeIndicator 
                      current={summaryCards.mostActive.requests} 
                      previous={previousCards.mostActive.requests} 
                    />
                  )}
                </div>
                <p className="text-xs text-slate-400">{summaryCards.mostActive.percentage}% of traffic</p>
              </>
            ) : (
              <p className="text-slate-500">No data</p>
            )}
          </CardContent>
        </Card>

        {/* Most Reliable */}
        <Card className="bg-admin-surface border-admin-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">Most Reliable</span>
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <TrendingUp className="h-4 w-4 text-emerald-400" />
              </div>
            </div>
            {summaryCards?.mostReliable ? (
              <>
                <p className="text-lg font-semibold text-white truncate">{summaryCards.mostReliable.name}</p>
                <div className="flex items-center">
                  <p className="text-2xl font-bold text-emerald-400">{summaryCards.mostReliable.successRate}%</p>
                  {showComparison && previousCards?.mostReliable && (
                    <ChangeIndicator 
                      current={summaryCards.mostReliable.successRate} 
                      previous={previousCards.mostReliable.successRate} 
                    />
                  )}
                </div>
                <p className="text-xs text-slate-400">success rate</p>
              </>
            ) : (
              <p className="text-slate-500">No data</p>
            )}
          </CardContent>
        </Card>

        {/* Fastest */}
        <Card className="bg-admin-surface border-admin-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">Fastest Provider</span>
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Zap className="h-4 w-4 text-purple-400" />
              </div>
            </div>
            {summaryCards?.fastest ? (
              <>
                <p className="text-lg font-semibold text-white truncate">{summaryCards.fastest.name}</p>
                <div className="flex items-center">
                  <p className="text-2xl font-bold text-white">{summaryCards.fastest.avgTime}ms</p>
                  {showComparison && previousCards?.fastest && (
                    <ChangeIndicator 
                      current={summaryCards.fastest.avgTime} 
                      previous={previousCards.fastest.avgTime}
                      inverse={true} // Lower response time is better
                    />
                  )}
                </div>
                <p className="text-xs text-slate-400 truncate">{summaryCards.fastest.comparison}</p>
              </>
            ) : (
              <p className="text-slate-500">No data</p>
            )}
          </CardContent>
        </Card>

        {/* Total Cost */}
        <Card className="bg-admin-surface border-admin-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">Total Cost</span>
              <div className="p-2 rounded-lg bg-amber-500/10">
                <DollarSign className="h-4 w-4 text-amber-400" />
              </div>
            </div>
            {summaryCards?.totalCost ? (
              <>
                <div className="flex items-center">
                  <p className="text-2xl font-bold text-white">${summaryCards.totalCost.total.toFixed(4)}</p>
                  {showComparison && previousCards?.totalCost && (
                    <ChangeIndicator 
                      current={summaryCards.totalCost.total} 
                      previous={previousCards.totalCost.total}
                      inverse={true} // Lower cost is better
                    />
                  )}
                </div>
                <p className="text-xs text-slate-400">Most expensive: {summaryCards.totalCost.mostExpensive}</p>
              </>
            ) : (
              <p className="text-slate-500">No data</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Analytics Table */}
      <Card className="bg-admin-surface border-admin-border">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-white">Provider Analytics</CardTitle>
              <CardDescription className="text-slate-400">
                Performance metrics for all AI providers
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search providers..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-9 w-64 bg-admin-background border-admin-border text-white"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => setShowComparisonModal(true)}
                className="bg-admin-background border-admin-border text-white hover:bg-admin-border"
              >
                <GitCompare className="h-4 w-4 mr-2" />
                Compare
              </Button>
              <Button
                variant="outline"
                onClick={handleExportCSV}
                className="bg-admin-background border-admin-border text-white hover:bg-admin-border"
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-admin-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-admin-border hover:bg-transparent">
                  <TableHead className="text-slate-400">Provider</TableHead>
                  <SortableHeader field="total_requests">Requests</SortableHeader>
                  <SortableHeader field="successful_requests">Successful</SortableHeader>
                  <SortableHeader field="failed_requests">Failed</SortableHeader>
                  <SortableHeader field="success_rate">Success %</SortableHeader>
                  <SortableHeader field="total_cost">Total Cost</SortableHeader>
                  <SortableHeader field="avg_response_time">Avg Time</SortableHeader>
                  <TableHead className="text-slate-400">Last Used</TableHead>
                  <TableHead className="text-slate-400">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedProviders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-slate-400 py-8">
                      {searchQuery ? 'No providers match your search' : 'No provider data available'}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedProviders.map((provider) => (
                    <TableRow key={provider.provider_id} className="border-admin-border hover:bg-admin-border/30">
                      <TableCell>
                        <div>
                          <div className="font-medium text-white">{provider.provider_display_name}</div>
                          <div className="text-xs text-slate-500">{provider.provider_name}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-300">
                        {provider.total_requests.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-emerald-400">
                        {provider.successful_requests.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-red-400">
                        {provider.failed_requests.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {provider.total_requests > 0 ? (
                          <Badge 
                            className={cn(
                              "font-mono",
                              provider.success_rate >= 95 && "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
                              provider.success_rate >= 85 && provider.success_rate < 95 && "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
                              provider.success_rate < 85 && "bg-red-500/20 text-red-400 border-red-500/30"
                            )}
                          >
                            {provider.success_rate}%
                          </Badge>
                        ) : (
                          <span className="text-slate-500">N/A</span>
                        )}
                      </TableCell>
                      <TableCell className="text-slate-300 font-mono">
                        ${provider.total_cost.toFixed(4)}
                      </TableCell>
                      <TableCell className="text-slate-300">
                        {provider.avg_response_time > 0 ? `${Math.round(provider.avg_response_time)}ms` : '-'}
                      </TableCell>
                      <TableCell className="text-slate-400 text-sm">
                        {provider.last_used 
                          ? formatDistanceToNow(new Date(provider.last_used), { addSuffix: true })
                          : 'Never'
                        }
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedProviderId(provider.provider_id)}
                          className="text-admin-accent hover:text-admin-accent/80 hover:bg-admin-accent/10"
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-slate-400">
                Showing {((currentPage - 1) * PAGE_SIZE) + 1} to {Math.min(currentPage * PAGE_SIZE, filteredAndSortedProviders.length)} of {filteredAndSortedProviders.length} providers
              </p>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      className={cn(
                        "cursor-pointer",
                        currentPage === 1 && "pointer-events-none opacity-50"
                      )}
                    />
                  </PaginationItem>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <PaginationItem key={pageNum}>
                        <PaginationLink
                          onClick={() => setCurrentPage(pageNum)}
                          isActive={currentPage === pageNum}
                          className="cursor-pointer"
                        >
                          {pageNum}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}
                  <PaginationItem>
                    <PaginationNext 
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      className={cn(
                        "cursor-pointer",
                        currentPage === totalPages && "pointer-events-none opacity-50"
                      )}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Provider Detail Modal */}
      <ProviderDetailModal
        providerId={selectedProviderId}
        dateRange={dateRange}
        open={!!selectedProviderId}
        onOpenChange={(open) => !open && setSelectedProviderId(null)}
      />

      {/* Comparison Modal */}
      <ComparisonModal
        open={showComparisonModal}
        onOpenChange={setShowComparisonModal}
        type="providers"
        items={comparisonItems}
      />
    </div>
  );
}
