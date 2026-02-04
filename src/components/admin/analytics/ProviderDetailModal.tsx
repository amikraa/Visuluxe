import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { Activity, DollarSign, Zap, Layers, RefreshCw, Globe } from 'lucide-react';
import { format } from 'date-fns';
import type { DateRange } from '@/hooks/useAdminAnalytics';
import {
  useProviderInfo,
  useProviderDetail,
  useProviderModels,
  useProviderGeographicData,
} from '@/hooks/useProviderAnalytics';

interface ProviderDetailModalProps {
  providerId: string | null;
  dateRange: DateRange;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ChartLoading() {
  return (
    <div className="h-[250px] flex items-center justify-center">
      <RefreshCw className="h-6 w-6 animate-spin text-admin-accent" />
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="h-[250px] flex items-center justify-center text-slate-400">
      {message}
    </div>
  );
}

export default function ProviderDetailModal({ providerId, dateRange, open, onOpenChange }: ProviderDetailModalProps) {
  const { data: providerInfo, isLoading: infoLoading } = useProviderInfo(providerId);
  const { data: trendData, isLoading: trendLoading } = useProviderDetail(providerId, dateRange);
  const { data: providerModels, isLoading: modelsLoading } = useProviderModels(providerId, dateRange);
  const { data: geoData, isLoading: geoLoading } = useProviderGeographicData(providerId, dateRange);

  const totalRequests = trendData?.reduce((sum, d) => sum + d.total_requests, 0) || 0;
  const successfulRequests = trendData?.reduce((sum, d) => sum + d.successful_requests, 0) || 0;
  const failedRequests = trendData?.reduce((sum, d) => sum + d.failed_requests, 0) || 0;
  const avgResponseTime = trendData && trendData.length > 0
    ? Math.round(trendData.reduce((sum, d) => sum + d.avg_response_time, 0) / trendData.length)
    : 0;
  const totalCost = successfulRequests * (providerInfo?.cost_per_image || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-admin-background border-admin-border">
        <DialogHeader>
          <DialogTitle className="text-xl text-white flex items-center gap-3">
            {infoLoading ? (
              <RefreshCw className="h-5 w-5 animate-spin" />
            ) : (
              <>
                {providerInfo?.display_name || 'Provider'} - Detailed Analytics
                {providerInfo?.status && (
                  <Badge variant={providerInfo.status === 'active' ? 'default' : 'secondary'}>
                    {providerInfo.status}
                  </Badge>
                )}
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="requests" className="mt-4">
          <TabsList className="bg-admin-surface border border-admin-border">
            <TabsTrigger value="requests" className="data-[state=active]:bg-admin-accent">
              <Activity className="h-4 w-4 mr-2" />
              Request Trends
            </TabsTrigger>
            <TabsTrigger value="cost" className="data-[state=active]:bg-admin-accent">
              <DollarSign className="h-4 w-4 mr-2" />
              Cost Analysis
            </TabsTrigger>
            <TabsTrigger value="performance" className="data-[state=active]:bg-admin-accent">
              <Zap className="h-4 w-4 mr-2" />
              Performance
            </TabsTrigger>
            <TabsTrigger value="models" className="data-[state=active]:bg-admin-accent">
              <Layers className="h-4 w-4 mr-2" />
              Models
            </TabsTrigger>
            <TabsTrigger value="geography" className="data-[state=active]:bg-admin-accent">
              <Globe className="h-4 w-4 mr-2" />
              Geography
            </TabsTrigger>
          </TabsList>

          {/* Request Trends Tab */}
          <TabsContent value="requests" className="mt-4 space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <Card className="bg-admin-surface border-admin-border">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-white">{totalRequests.toLocaleString()}</p>
                  <p className="text-sm text-slate-400">Total Requests</p>
                </CardContent>
              </Card>
              <Card className="bg-admin-surface border-admin-border">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-emerald-400">{successfulRequests.toLocaleString()}</p>
                  <p className="text-sm text-slate-400">Successful</p>
                </CardContent>
              </Card>
              <Card className="bg-admin-surface border-admin-border">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-red-400">{failedRequests.toLocaleString()}</p>
                  <p className="text-sm text-slate-400">Failed</p>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-admin-surface border-admin-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-base">Requests Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                {trendLoading ? (
                  <ChartLoading />
                ) : trendData && trendData.length > 0 ? (
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
                        <YAxis stroke="#94a3b8" fontSize={11} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                          labelStyle={{ color: '#fff' }}
                        />
                        <Legend />
                        <Area type="monotone" dataKey="successful_requests" name="Successful" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.6} />
                        <Area type="monotone" dataKey="failed_requests" name="Failed" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyChart message="No request data for this period" />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Cost Analysis Tab */}
          <TabsContent value="cost" className="mt-4 space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <Card className="bg-admin-surface border-admin-border">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-white">${totalCost.toFixed(4)}</p>
                  <p className="text-sm text-slate-400">Total Cost</p>
                </CardContent>
              </Card>
              <Card className="bg-admin-surface border-admin-border">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-white">${providerInfo?.cost_per_image?.toFixed(6) || '0'}</p>
                  <p className="text-sm text-slate-400">Cost per Image</p>
                </CardContent>
              </Card>
              <Card className="bg-admin-surface border-admin-border">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-emerald-400">
                    {totalRequests > 0 ? (successfulRequests / totalRequests * 100).toFixed(1) : 0}%
                  </p>
                  <p className="text-sm text-slate-400">Cost Efficiency</p>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-admin-surface border-admin-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-base">Daily Cost</CardTitle>
                <CardDescription className="text-slate-400">
                  Estimated cost based on successful requests × cost per image
                </CardDescription>
              </CardHeader>
              <CardContent>
                {trendLoading ? (
                  <ChartLoading />
                ) : trendData && trendData.length > 0 ? (
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart 
                        data={trendData.map(d => ({
                          ...d,
                          cost: d.successful_requests * (providerInfo?.cost_per_image || 0)
                        }))}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
                        <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `$${v.toFixed(4)}`} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                          labelStyle={{ color: '#fff' }}
                          formatter={(value: number) => [`$${value.toFixed(6)}`, 'Cost']}
                        />
                        <Bar dataKey="cost" name="Cost" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyChart message="No cost data for this period" />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="mt-4 space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <Card className="bg-admin-surface border-admin-border">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-white">{avgResponseTime}ms</p>
                  <p className="text-sm text-slate-400">Avg Response Time</p>
                </CardContent>
              </Card>
              <Card className="bg-admin-surface border-admin-border">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-emerald-400">
                    {totalRequests > 0 ? (successfulRequests / totalRequests * 100).toFixed(1) : 0}%
                  </p>
                  <p className="text-sm text-slate-400">Success Rate</p>
                </CardContent>
              </Card>
              <Card className="bg-admin-surface border-admin-border">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-white">
                    {providerInfo?.last_test_status === 'success' ? '✓' : providerInfo?.last_test_status === 'failed' ? '✗' : '?'}
                  </p>
                  <p className="text-sm text-slate-400">Last Health Check</p>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-admin-surface border-admin-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-base">Response Time Trend</CardTitle>
              </CardHeader>
              <CardContent>
                {trendLoading ? (
                  <ChartLoading />
                ) : trendData && trendData.length > 0 ? (
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
                        <YAxis stroke="#94a3b8" fontSize={11} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                          labelStyle={{ color: '#fff' }}
                        />
                        <Line type="monotone" dataKey="avg_response_time" name="Avg Time (ms)" stroke="#06b6d4" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyChart message="No performance data for this period" />
                )}
              </CardContent>
            </Card>

            {providerInfo?.last_test_at && (
              <Card className="bg-admin-surface border-admin-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white text-base">Health Check Info</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Last Test:</span>
                      <span className="text-white">{format(new Date(providerInfo.last_test_at), 'MMM d, yyyy HH:mm')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Status:</span>
                      <Badge variant={providerInfo.last_test_status === 'success' ? 'default' : 'destructive'}>
                        {providerInfo.last_test_status}
                      </Badge>
                    </div>
                    {providerInfo.last_test_response_time && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Response Time:</span>
                        <span className="text-white">{providerInfo.last_test_response_time}ms</span>
                      </div>
                    )}
                    {providerInfo.last_test_message && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Message:</span>
                        <span className="text-white truncate max-w-[200px]">{providerInfo.last_test_message}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Models Using This Provider Tab */}
          <TabsContent value="models" className="mt-4">
            <Card className="bg-admin-surface border-admin-border">
              <CardHeader>
                <CardTitle className="text-white text-base">Models Using This Provider</CardTitle>
                <CardDescription className="text-slate-400">
                  AI models that have sent requests through this provider
                </CardDescription>
              </CardHeader>
              <CardContent>
                {modelsLoading ? (
                  <ChartLoading />
                ) : providerModels && providerModels.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-admin-border">
                        <TableHead className="text-slate-400">Model Name</TableHead>
                        <TableHead className="text-slate-400">Requests</TableHead>
                        <TableHead className="text-slate-400">Success Rate</TableHead>
                        <TableHead className="text-slate-400">Avg Response Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {providerModels.map((model) => (
                        <TableRow key={model.model_id} className="border-admin-border">
                          <TableCell className="text-white font-medium">{model.model_name}</TableCell>
                          <TableCell className="text-slate-300">{model.total_requests.toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge 
                              className={
                                model.success_rate >= 95 
                                  ? "bg-emerald-500/20 text-emerald-400" 
                                  : model.success_rate >= 85 
                                    ? "bg-yellow-500/20 text-yellow-400"
                                    : "bg-red-500/20 text-red-400"
                              }
                            >
                              {model.success_rate}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-300">{Math.round(model.avg_response_time)}ms</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-slate-400 text-center py-8">No models have used this provider in the selected period</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Geographic Distribution Tab */}
          <TabsContent value="geography" className="mt-4">
            <Card className="bg-admin-surface border-admin-border">
              <CardHeader>
                <CardTitle className="text-white text-base">Geographic Distribution</CardTitle>
                <CardDescription className="text-slate-400">
                  Requests by country for this provider
                </CardDescription>
              </CardHeader>
              <CardContent>
                {geoLoading ? (
                  <ChartLoading />
                ) : geoData && geoData.length > 0 ? (
                  <>
                    {/* Top 3 Countries Summary */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      {geoData.slice(0, 3).map((country, idx) => (
                        <Card key={country.country} className="bg-admin-background border-admin-border">
                          <CardContent className="p-4 text-center">
                            <p className="text-xs text-slate-500 mb-1">#{idx + 1}</p>
                            <p className="text-lg font-semibold text-white">{country.country}</p>
                            <p className="text-sm text-slate-400">{country.total_requests.toLocaleString()} requests</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    {/* Full Table */}
                    <Table>
                      <TableHeader>
                        <TableRow className="border-admin-border">
                          <TableHead className="text-slate-400">Country</TableHead>
                          <TableHead className="text-slate-400">Requests</TableHead>
                          <TableHead className="text-slate-400">Success Rate</TableHead>
                          <TableHead className="text-slate-400">Avg Response Time</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {geoData.map((row) => (
                          <TableRow key={row.country} className="border-admin-border">
                            <TableCell className="text-white font-medium">{row.country}</TableCell>
                            <TableCell className="text-slate-300">{row.total_requests.toLocaleString()}</TableCell>
                            <TableCell>
                              <Badge 
                                className={
                                  row.success_rate >= 95 
                                    ? "bg-emerald-500/20 text-emerald-400" 
                                    : row.success_rate >= 85 
                                      ? "bg-yellow-500/20 text-yellow-400"
                                      : "bg-red-500/20 text-red-400"
                                }
                              >
                                {row.success_rate}%
                              </Badge>
                            </TableCell>
                            <TableCell className="text-slate-300">{row.avg_response_time}ms</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </>
                ) : (
                  <p className="text-slate-400 text-center py-8">No geographic data available for this provider</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
