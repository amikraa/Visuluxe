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
  Crown, TrendingUp, TrendingDown, Zap, Shield, Search, Download, ExternalLink, RefreshCw,
  ArrowUpDown, ChevronUp, ChevronDown, GitCompare
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import type { DateRange } from '@/hooks/useAdminAnalytics';
import { downloadCSV, calculatePercentChange } from '@/hooks/useAdminAnalytics';
import {
  useModelsSummary,
  useModelSummaryCards,
  generateModelAnalyticsCSV,
  type ModelAnalyticsSummary,
} from '@/hooks/useModelAnalytics';
import ModelDetailModal from '@/components/admin/analytics/ModelDetailModal';
import ComparisonModal from '@/components/admin/analytics/ComparisonModal';
import AnalyticsAlert, { generateModelInsights } from '@/components/admin/analytics/AnalyticsAlert';

interface ModelsTabProps {
  dateRange: DateRange;
  previousPeriod?: DateRange | null;
  showComparison?: boolean;
}

type SortField = 'total_requests' | 'successful_requests' | 'failed_requests' | 'success_rate' | 'total_credits' | 'avg_credits_per_gen' | 'avg_response_time';
type SortDirection = 'asc' | 'desc';

const PAGE_SIZE = 20;

function getSuccessRateColor(rate: number): string {
  if (rate >= 95) return 'text-emerald-400';
  if (rate >= 85) return 'text-yellow-400';
  return 'text-red-400';
}

function getSuccessRateBadgeVariant(rate: number): 'default' | 'secondary' | 'destructive' {
  if (rate >= 95) return 'default';
  if (rate >= 85) return 'secondary';
  return 'destructive';
}

// Change indicator component for period comparison
function ChangeIndicator({ current, previous, inverse = false }: { current: number; previous: number | undefined; inverse?: boolean }) {
  if (previous === undefined) return null;
  
  const change = calculatePercentChange(current, previous);
  if (change === null) return null;
  
  // For metrics like response time, lower is better (inverse = true)
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

export default function ModelsTab({ dateRange, previousPeriod, showComparison }: ModelsTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('total_requests');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [showComparisonModal, setShowComparisonModal] = useState(false);

  const { data: models, isLoading } = useModelsSummary(dateRange);
  const { data: summaryCards, isLoading: cardsLoading } = useModelSummaryCards(dateRange);
  
  // Fetch previous period data when comparison is enabled
  const { data: previousModels } = useModelsSummary(
    previousPeriod || { start: new Date(), end: new Date() }
  );
  const { data: previousCards } = useModelSummaryCards(
    previousPeriod || { start: new Date(), end: new Date() }
  );
  
  // Get previous period values for comparison (only used when showComparison is true)
  const getPreviousValue = (modelId: string, field: keyof ModelAnalyticsSummary): number | undefined => {
    if (!showComparison || !previousPeriod || !previousModels) return undefined;
    const prevModel = previousModels.find(m => m.model_id === modelId);
    return prevModel ? Number(prevModel[field]) : undefined;
  };

  // Generate insights from model data
  const insights = useMemo(() => {
    if (!models) return [];
    return generateModelInsights(models);
  }, [models]);

  // Prepare data for comparison modal
  const comparisonItems = useMemo(() => {
    if (!models) return [];
    return models.map(m => ({
      id: m.model_id,
      name: m.model_name,
      totalRequests: m.total_requests,
      successRate: m.success_rate,
      totalCredits: m.total_credits,
      avgResponseTime: m.avg_response_time,
    }));
  }, [models]);

  // Filter and sort models
  const filteredAndSortedModels = useMemo(() => {
    if (!models) return [];

    let result = [...models];

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(m => m.model_name.toLowerCase().includes(query));
    }

    // Sort
    result.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      const diff = Number(aVal) - Number(bVal);
      return sortDirection === 'asc' ? diff : -diff;
    });

    return result;
  }, [models, searchQuery, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedModels.length / PAGE_SIZE);
  const paginatedModels = filteredAndSortedModels.slice(
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
    if (!models) return;
    const csv = generateModelAnalyticsCSV(models, dateRange);
    downloadCSV(csv, `model-analytics-${dateRange.start.toISOString().split('T')[0]}-to-${dateRange.end.toISOString().split('T')[0]}.csv`);
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
      <AnalyticsAlert insights={insights} storageKey="models" />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Most Popular */}
        <Card className="bg-admin-surface border-admin-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">Most Popular</span>
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Crown className="h-4 w-4 text-amber-400" />
              </div>
            </div>
            {summaryCards?.mostPopular ? (
              <>
                <p className="text-lg font-semibold text-white truncate">{summaryCards.mostPopular.name}</p>
                <div className="flex items-center">
                  <p className="text-2xl font-bold text-white">{summaryCards.mostPopular.requests.toLocaleString()}</p>
                  {showComparison && previousCards?.mostPopular && (
                    <ChangeIndicator 
                      current={summaryCards.mostPopular.requests} 
                      previous={previousCards.mostPopular.requests} 
                    />
                  )}
                </div>
                <p className="text-xs text-slate-400">requests this period</p>
              </>
            ) : (
              <p className="text-slate-500">No data</p>
            )}
          </CardContent>
        </Card>

        {/* Highest Revenue */}
        <Card className="bg-admin-surface border-admin-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">Highest Revenue</span>
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <TrendingUp className="h-4 w-4 text-emerald-400" />
              </div>
            </div>
            {summaryCards?.highestRevenue ? (
              <>
                <p className="text-lg font-semibold text-white truncate">{summaryCards.highestRevenue.name}</p>
                <div className="flex items-center">
                  <p className="text-2xl font-bold text-white">{summaryCards.highestRevenue.credits.toFixed(2)}</p>
                  {showComparison && previousCards?.highestRevenue && (
                    <ChangeIndicator 
                      current={summaryCards.highestRevenue.credits} 
                      previous={previousCards.highestRevenue.credits} 
                    />
                  )}
                </div>
                <p className="text-xs text-slate-400">credits earned</p>
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
              <span className="text-sm text-slate-400">Fastest Model</span>
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Zap className="h-4 w-4 text-blue-400" />
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
                <p className="text-xs text-slate-400">{summaryCards.fastest.successRate}% success rate</p>
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
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Shield className="h-4 w-4 text-purple-400" />
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
                <p className="text-xs text-slate-400">{summaryCards.mostReliable.failures} failures</p>
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
              <CardTitle className="text-white">Model Analytics</CardTitle>
              <CardDescription className="text-slate-400">
                Performance metrics for all AI models
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search models..."
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
                  <TableHead className="text-slate-400">Model Name</TableHead>
                  <SortableHeader field="total_requests">Requests</SortableHeader>
                  <SortableHeader field="successful_requests">Successful</SortableHeader>
                  <SortableHeader field="failed_requests">Failed</SortableHeader>
                  <SortableHeader field="success_rate">Success %</SortableHeader>
                  <SortableHeader field="total_credits">Credits</SortableHeader>
                  <SortableHeader field="avg_credits_per_gen">Avg/Gen</SortableHeader>
                  <SortableHeader field="avg_response_time">Avg Time</SortableHeader>
                  <TableHead className="text-slate-400">Last Used</TableHead>
                  <TableHead className="text-slate-400">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedModels.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-slate-400 py-8">
                      {searchQuery ? 'No models match your search' : 'No model data available'}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedModels.map((model) => (
                    <TableRow key={model.model_id} className="border-admin-border hover:bg-admin-border/30">
                      <TableCell>
                        <div className="font-medium text-white">{model.model_name}</div>
                      </TableCell>
                      <TableCell className="text-slate-300">
                        {model.total_requests.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-emerald-400">
                        {model.successful_requests.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-red-400">
                        {model.failed_requests.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {model.total_requests > 0 ? (
                          <Badge 
                            variant={getSuccessRateBadgeVariant(model.success_rate)}
                            className={cn(
                              "font-mono",
                              model.success_rate >= 95 && "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
                              model.success_rate >= 85 && model.success_rate < 95 && "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
                              model.success_rate < 85 && "bg-red-500/20 text-red-400 border-red-500/30"
                            )}
                          >
                            {model.success_rate}%
                          </Badge>
                        ) : (
                          <span className="text-slate-500">N/A</span>
                        )}
                      </TableCell>
                      <TableCell className="text-slate-300 font-mono">
                        {model.total_credits.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-slate-300 font-mono">
                        {model.avg_credits_per_gen.toFixed(4)}
                      </TableCell>
                      <TableCell className="text-slate-300">
                        {model.avg_response_time > 0 ? `${Math.round(model.avg_response_time)}ms` : '-'}
                      </TableCell>
                      <TableCell className="text-slate-400 text-sm">
                        {model.last_used 
                          ? formatDistanceToNow(new Date(model.last_used), { addSuffix: true })
                          : 'Never'
                        }
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedModelId(model.model_id)}
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
                Showing {((currentPage - 1) * PAGE_SIZE) + 1} to {Math.min(currentPage * PAGE_SIZE, filteredAndSortedModels.length)} of {filteredAndSortedModels.length} models
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

      {/* Model Detail Modal */}
      <ModelDetailModal
        modelId={selectedModelId}
        dateRange={dateRange}
        open={!!selectedModelId}
        onOpenChange={(open) => !open && setSelectedModelId(null)}
      />

      {/* Comparison Modal */}
      <ComparisonModal
        open={showComparisonModal}
        onOpenChange={setShowComparisonModal}
        type="models"
        items={comparisonItems}
      />
    </div>
  );
}
