import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell
} from 'recharts';
import { Activity, CreditCard, Zap, Users, History, RefreshCw } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import type { DateRange } from '@/hooks/useAdminAnalytics';
import {
  useModelInfo,
  useModelDetail,
  useModelTopUsers,
  useModelConfigHistory,
} from '@/hooks/useModelAnalytics';

interface ModelDetailModalProps {
  modelId: string | null;
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

export default function ModelDetailModal({ modelId, dateRange, open, onOpenChange }: ModelDetailModalProps) {
  const { data: modelInfo, isLoading: infoLoading } = useModelInfo(modelId);
  const { data: trendData, isLoading: trendLoading } = useModelDetail(modelId, dateRange);
  const { data: topUsers, isLoading: usersLoading } = useModelTopUsers(modelId, dateRange);
  const { data: configHistory, isLoading: historyLoading } = useModelConfigHistory(modelId);

  // Calculate error breakdown from trend data
  const errorBreakdown = trendData ? [
    { name: 'Successful', value: trendData.reduce((sum, d) => sum + d.successful_requests, 0), fill: '#10b981' },
    { name: 'Failed', value: trendData.reduce((sum, d) => sum + d.failed_requests, 0), fill: '#ef4444' },
  ].filter(d => d.value > 0) : [];

  const totalRequests = trendData?.reduce((sum, d) => sum + d.total_requests, 0) || 0;
  const totalCredits = trendData?.reduce((sum, d) => sum + d.total_credits, 0) || 0;
  const avgResponseTime = trendData && trendData.length > 0
    ? Math.round(trendData.reduce((sum, d) => sum + d.avg_response_time, 0) / trendData.length)
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-admin-background border-admin-border">
        <DialogHeader>
          <DialogTitle className="text-xl text-white flex items-center gap-3">
            {infoLoading ? (
              <RefreshCw className="h-5 w-5 animate-spin" />
            ) : (
              <>
                {modelInfo?.name || 'Model'} - Detailed Analytics
                {modelInfo?.status && (
                  <Badge variant={modelInfo.status === 'active' ? 'default' : 'secondary'}>
                    {modelInfo.status}
                  </Badge>
                )}
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="usage" className="mt-4">
          <TabsList className="bg-admin-surface border border-admin-border">
            <TabsTrigger value="usage" className="data-[state=active]:bg-admin-accent">
              <Activity className="h-4 w-4 mr-2" />
              Usage Trends
            </TabsTrigger>
            <TabsTrigger value="revenue" className="data-[state=active]:bg-admin-accent">
              <CreditCard className="h-4 w-4 mr-2" />
              Revenue
            </TabsTrigger>
            <TabsTrigger value="performance" className="data-[state=active]:bg-admin-accent">
              <Zap className="h-4 w-4 mr-2" />
              Performance
            </TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-admin-accent">
              <Users className="h-4 w-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-admin-accent">
              <History className="h-4 w-4 mr-2" />
              History
            </TabsTrigger>
          </TabsList>

          {/* Usage Trends Tab */}
          <TabsContent value="usage" className="mt-4 space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <Card className="bg-admin-surface border-admin-border">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-white">{totalRequests.toLocaleString()}</p>
                  <p className="text-sm text-slate-400">Total Requests</p>
                </CardContent>
              </Card>
              <Card className="bg-admin-surface border-admin-border">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-emerald-400">
                    {trendData?.reduce((sum, d) => sum + d.successful_requests, 0).toLocaleString() || 0}
                  </p>
                  <p className="text-sm text-slate-400">Successful</p>
                </CardContent>
              </Card>
              <Card className="bg-admin-surface border-admin-border">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-red-400">
                    {trendData?.reduce((sum, d) => sum + d.failed_requests, 0).toLocaleString() || 0}
                  </p>
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
                      <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
                        <YAxis stroke="#94a3b8" fontSize={11} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                          labelStyle={{ color: '#fff' }}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="successful_requests" name="Successful" stroke="#10b981" strokeWidth={2} dot={{ r: 2 }} />
                        <Line type="monotone" dataKey="failed_requests" name="Failed" stroke="#ef4444" strokeWidth={2} dot={{ r: 2 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyChart message="No usage data for this period" />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Revenue Tab */}
          <TabsContent value="revenue" className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-admin-surface border-admin-border">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-white">{totalCredits.toFixed(2)}</p>
                  <p className="text-sm text-slate-400">Total Credits Earned</p>
                </CardContent>
              </Card>
              <Card className="bg-admin-surface border-admin-border">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-white">
                    {totalRequests > 0 ? (totalCredits / totalRequests).toFixed(4) : '0'}
                  </p>
                  <p className="text-sm text-slate-400">Avg Credits/Request</p>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-admin-surface border-admin-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-base">Credits Earned Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                {trendLoading ? (
                  <ChartLoading />
                ) : trendData && trendData.length > 0 ? (
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
                        <YAxis stroke="#94a3b8" fontSize={11} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                          labelStyle={{ color: '#fff' }}
                        />
                        <Bar dataKey="total_credits" name="Credits" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyChart message="No revenue data for this period" />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-admin-surface border-admin-border">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-white">{avgResponseTime}ms</p>
                  <p className="text-sm text-slate-400">Avg Response Time</p>
                </CardContent>
              </Card>
              <Card className="bg-admin-surface border-admin-border">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-emerald-400">
                    {totalRequests > 0 
                      ? ((trendData?.reduce((sum, d) => sum + d.successful_requests, 0) || 0) / totalRequests * 100).toFixed(1)
                      : 0}%
                  </p>
                  <p className="text-sm text-slate-400">Success Rate</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-admin-surface border-admin-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white text-base">Response Time Trend</CardTitle>
                </CardHeader>
                <CardContent>
                  {trendLoading ? (
                    <ChartLoading />
                  ) : trendData && trendData.length > 0 ? (
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trendData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                          <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} />
                          <YAxis stroke="#94a3b8" fontSize={10} />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                          />
                          <Line type="monotone" dataKey="avg_response_time" name="Avg Time (ms)" stroke="#06b6d4" strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <EmptyChart message="No performance data" />
                  )}
                </CardContent>
              </Card>

              <Card className="bg-admin-surface border-admin-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white text-base">Success vs Failure</CardTitle>
                </CardHeader>
                <CardContent>
                  {errorBreakdown.length > 0 ? (
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={errorBreakdown}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={70}
                            dataKey="value"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          >
                            {errorBreakdown.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <EmptyChart message="No data" />
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="mt-4">
            <Card className="bg-admin-surface border-admin-border">
              <CardHeader>
                <CardTitle className="text-white text-base">Top Users</CardTitle>
                <CardDescription className="text-slate-400">Users with most generations on this model</CardDescription>
              </CardHeader>
              <CardContent>
                {usersLoading ? (
                  <ChartLoading />
                ) : topUsers && topUsers.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-admin-border">
                        <TableHead className="text-slate-400">User</TableHead>
                        <TableHead className="text-slate-400">Generations</TableHead>
                        <TableHead className="text-slate-400">Credits Spent</TableHead>
                        <TableHead className="text-slate-400">Success Rate</TableHead>
                        <TableHead className="text-slate-400">Last Used</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topUsers.map((user) => (
                        <TableRow key={user.user_id} className="border-admin-border">
                          <TableCell className="text-white font-mono text-sm">
                            {user.user_email || user.user_id.slice(0, 8) + '...'}
                          </TableCell>
                          <TableCell className="text-slate-300">{user.total_generations}</TableCell>
                          <TableCell className="text-slate-300">{user.credits_spent.toFixed(2)}</TableCell>
                          <TableCell className="text-emerald-400">{user.success_rate}%</TableCell>
                          <TableCell className="text-slate-400 text-sm">
                            {formatDistanceToNow(new Date(user.last_used), { addSuffix: true })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-slate-400 text-center py-8">No user data for this period</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Configuration History Tab */}
          <TabsContent value="history" className="mt-4">
            <Card className="bg-admin-surface border-admin-border">
              <CardHeader>
                <CardTitle className="text-white text-base">Configuration History</CardTitle>
                <CardDescription className="text-slate-400">Audit log of changes to this model</CardDescription>
              </CardHeader>
              <CardContent>
                {historyLoading ? (
                  <ChartLoading />
                ) : configHistory && configHistory.length > 0 ? (
                  <div className="space-y-3">
                    {configHistory.map((entry) => (
                      <div key={entry.id} className="p-3 rounded-lg bg-admin-background border border-admin-border">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline" className="text-admin-accent border-admin-accent">
                            {entry.action}
                          </Badge>
                          <span className="text-xs text-slate-400">
                            {format(new Date(entry.created_at), 'MMM d, yyyy HH:mm')}
                          </span>
                        </div>
                        {entry.old_value && entry.new_value && (
                          <div className="text-sm text-slate-300">
                            <span className="text-red-400">-</span> {JSON.stringify(entry.old_value)}
                            <br />
                            <span className="text-emerald-400">+</span> {JSON.stringify(entry.new_value)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 text-center py-8">No configuration changes recorded</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
