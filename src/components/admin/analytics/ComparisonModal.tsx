import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, X, TrendingUp, TrendingDown } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface ComparisonItem {
  id: string;
  name: string;
  totalRequests: number;
  successRate: number;
  totalCredits?: number;
  totalCost?: number;
  avgResponseTime: number;
}

interface ComparisonModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'models' | 'providers';
  items: ComparisonItem[];
}

export default function ComparisonModal({
  open,
  onOpenChange,
  type,
  items,
}: ComparisonModalProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.includes(item.id)),
    [items, selectedIds]
  );

  const toggleItem = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((i) => i !== id);
      }
      if (prev.length >= 5) {
        return prev; // Max 5 items
      }
      return [...prev, id];
    });
  };

  const getBestWorst = (key: keyof ComparisonItem, higher = true) => {
    if (selectedItems.length === 0) return { best: null, worst: null };
    const sorted = [...selectedItems].sort((a, b) => {
      const aVal = (a[key] as number) || 0;
      const bVal = (b[key] as number) || 0;
      return higher ? bVal - aVal : aVal - bVal;
    });
    return { best: sorted[0]?.id, worst: sorted[sorted.length - 1]?.id };
  };

  const requestsBestWorst = getBestWorst('totalRequests');
  const successBestWorst = getBestWorst('successRate');
  const revenueBestWorst = getBestWorst('totalCredits');
  const costBestWorst = getBestWorst('totalCost', false); // Lower is better
  const speedBestWorst = getBestWorst('avgResponseTime', false); // Lower is better

  const chartData = selectedItems.map((item) => ({
    name: item.name.length > 15 ? item.name.substring(0, 15) + '...' : item.name,
    requests: item.totalRequests,
    successRate: item.successRate,
    credits: item.totalCredits || 0,
    cost: item.totalCost || 0,
    responseTime: Math.round(item.avgResponseTime),
  }));

  const exportComparison = () => {
    const headers = [
      'Name',
      'Total Requests',
      'Success Rate %',
      type === 'models' ? 'Total Credits' : 'Total Cost',
      'Avg Response Time (ms)',
    ];
    const rows = selectedItems.map((item) => [
      item.name,
      item.totalRequests,
      item.successRate.toFixed(2),
      type === 'models' ? item.totalCredits || 0 : item.totalCost || 0,
      Math.round(item.avgResponseTime),
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}-comparison-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getCellStyle = (itemId: string, best: string | null, worst: string | null) => {
    if (selectedItems.length < 2) return '';
    if (itemId === best) return 'bg-emerald-500/20 text-emerald-400';
    if (itemId === worst) return 'bg-red-500/20 text-red-400';
    return '';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] bg-admin-card border-admin-border">
        <DialogHeader>
          <DialogTitle className="text-white">
            Compare {type === 'models' ? 'Models' : 'Providers'}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-6">
          {/* Selection Panel */}
          <div className="col-span-1 border-r border-admin-border pr-4">
            <p className="text-sm text-slate-400 mb-3">
              Select 2-5 {type} to compare
            </p>
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {items.map((item) => (
                  <label
                    key={item.id}
                    className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                      selectedIds.includes(item.id)
                        ? 'bg-admin-accent/20 border border-admin-accent'
                        : 'hover:bg-admin-surface border border-transparent'
                    }`}
                  >
                    <Checkbox
                      checked={selectedIds.includes(item.id)}
                      onCheckedChange={() => toggleItem(item.id)}
                      disabled={
                        !selectedIds.includes(item.id) && selectedIds.length >= 5
                      }
                    />
                    <span className="text-white text-sm truncate">{item.name}</span>
                  </label>
                ))}
              </div>
            </ScrollArea>
            <p className="text-xs text-slate-500 mt-2">
              {selectedIds.length}/5 selected
            </p>
          </div>

          {/* Comparison Content */}
          <div className="col-span-2 space-y-6">
            {selectedItems.length < 2 ? (
              <div className="flex items-center justify-center h-[400px] text-slate-400">
                Select at least 2 {type} to compare
              </div>
            ) : (
              <>
                {/* Comparison Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-admin-border">
                        <th className="text-left py-2 text-slate-400 font-medium">
                          Metric
                        </th>
                        {selectedItems.map((item) => (
                          <th
                            key={item.id}
                            className="text-center py-2 text-white font-medium"
                          >
                            {item.name.length > 12
                              ? item.name.substring(0, 12) + '...'
                              : item.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-admin-border/50">
                        <td className="py-2 text-slate-400">Total Requests</td>
                        {selectedItems.map((item) => (
                          <td
                            key={item.id}
                            className={`text-center py-2 ${getCellStyle(
                              item.id,
                              requestsBestWorst.best,
                              requestsBestWorst.worst
                            )}`}
                          >
                            {item.totalRequests.toLocaleString()}
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b border-admin-border/50">
                        <td className="py-2 text-slate-400">Success Rate</td>
                        {selectedItems.map((item) => (
                          <td
                            key={item.id}
                            className={`text-center py-2 ${getCellStyle(
                              item.id,
                              successBestWorst.best,
                              successBestWorst.worst
                            )}`}
                          >
                            {item.successRate.toFixed(1)}%
                          </td>
                        ))}
                      </tr>
                      {type === 'models' && (
                        <tr className="border-b border-admin-border/50">
                          <td className="py-2 text-slate-400">Total Credits</td>
                          {selectedItems.map((item) => (
                            <td
                              key={item.id}
                              className={`text-center py-2 ${getCellStyle(
                                item.id,
                                revenueBestWorst.best,
                                revenueBestWorst.worst
                              )}`}
                            >
                              {(item.totalCredits || 0).toLocaleString()}
                            </td>
                          ))}
                        </tr>
                      )}
                      {type === 'providers' && (
                        <tr className="border-b border-admin-border/50">
                          <td className="py-2 text-slate-400">Total Cost</td>
                          {selectedItems.map((item) => (
                            <td
                              key={item.id}
                              className={`text-center py-2 ${getCellStyle(
                                item.id,
                                costBestWorst.worst,
                                costBestWorst.best
                              )}`}
                            >
                              ${(item.totalCost || 0).toFixed(2)}
                            </td>
                          ))}
                        </tr>
                      )}
                      <tr>
                        <td className="py-2 text-slate-400">Avg Response Time</td>
                        {selectedItems.map((item) => (
                          <td
                            key={item.id}
                            className={`text-center py-2 ${getCellStyle(
                              item.id,
                              speedBestWorst.worst,
                              speedBestWorst.best
                            )}`}
                          >
                            {Math.round(item.avgResponseTime)}ms
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Legend */}
                <div className="flex gap-4 text-xs">
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-emerald-500/50" />
                    <span className="text-slate-400">Best</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-red-500/50" />
                    <span className="text-slate-400">Worst</span>
                  </span>
                </div>

                {/* Bar Charts */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-admin-surface rounded-lg p-4">
                    <h4 className="text-sm font-medium text-white mb-3">
                      Request Volume
                    </h4>
                    <ResponsiveContainer width="100%" height={150}>
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                        <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1e293b',
                            border: '1px solid #334155',
                            borderRadius: '8px',
                          }}
                        />
                        <Bar dataKey="requests" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="bg-admin-surface rounded-lg p-4">
                    <h4 className="text-sm font-medium text-white mb-3">
                      Success Rate (%)
                    </h4>
                    <ResponsiveContainer width="100%" height={150}>
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                        <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1e293b',
                            border: '1px solid #334155',
                            borderRadius: '8px',
                          }}
                        />
                        <Bar dataKey="successRate" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Export Button */}
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    onClick={exportComparison}
                    className="bg-admin-surface border-admin-border text-white hover:bg-admin-border"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export Comparison
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
