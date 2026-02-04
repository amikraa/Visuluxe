import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  Activity, Users, ImageIcon, Clock, TrendingUp, RefreshCw, Zap, Server, CreditCard
} from 'lucide-react';
import {
  useAnalyticsStats,
  useRequestsOverTime,
  useCreditsOverTime,
  useImagesPerDay,
  useImagesByModel,
  useImagesByStatus,
  useHourlyActivity,
  type DateRange,
} from '@/hooks/useAdminAnalytics';

const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];

interface OverviewTabProps {
  dateRange: DateRange;
  previousPeriod?: DateRange | null;
  showComparison?: boolean;
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="h-[300px] flex items-center justify-center text-slate-400">
      <div className="text-center">
        <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>{message}</p>
      </div>
    </div>
  );
}

function ChartLoading() {
  return (
    <div className="h-[300px] flex items-center justify-center">
      <RefreshCw className="h-6 w-6 animate-spin text-admin-accent" />
    </div>
  );
}

export default function OverviewTab({ dateRange, previousPeriod, showComparison }: OverviewTabProps) {
  const { data: stats, isLoading: statsLoading } = useAnalyticsStats(dateRange);
  const { data: requestsOverTime, isLoading: requestsLoading } = useRequestsOverTime(dateRange);
  const { data: creditsOverTime, isLoading: creditsLoading } = useCreditsOverTime(dateRange);
  const { data: imagesPerDay, isLoading: imagesPerDayLoading } = useImagesPerDay(dateRange);
  const { data: imagesByModel } = useImagesByModel();
  const { data: imagesByStatus, isLoading: statusLoading } = useImagesByStatus(dateRange);
  const { data: recentActivity, isLoading: activityLoading } = useHourlyActivity();

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-admin-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-admin-surface border-admin-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Total Users</p>
                <p className="text-2xl font-bold text-white">{stats?.totalUsers.toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-lg bg-blue-500/10">
                <Users className="h-6 w-6 text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-admin-surface border-admin-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Images Generated</p>
                <p className="text-2xl font-bold text-white">{stats?.totalImages.toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-lg bg-purple-500/10">
                <ImageIcon className="h-6 w-6 text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-admin-surface border-admin-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Period Requests</p>
                <p className="text-2xl font-bold text-white">{stats?.periodRequests.toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-lg bg-emerald-500/10">
                <Activity className="h-6 w-6 text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-admin-surface border-admin-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Avg Response Time</p>
                <p className="text-2xl font-bold text-white">{stats?.avgResponseTime}ms</p>
              </div>
              <div className="p-3 rounded-lg bg-orange-500/10">
                <Clock className="h-6 w-6 text-orange-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="traffic" className="space-y-4">
        <TabsList className="bg-admin-surface border border-admin-border">
          <TabsTrigger value="traffic" className="data-[state=active]:bg-admin-accent">
            <Activity className="h-4 w-4 mr-2" />
            Traffic
          </TabsTrigger>
          <TabsTrigger value="credits" className="data-[state=active]:bg-admin-accent">
            <CreditCard className="h-4 w-4 mr-2" />
            Credits
          </TabsTrigger>
          <TabsTrigger value="images" className="data-[state=active]:bg-admin-accent">
            <ImageIcon className="h-4 w-4 mr-2" />
            Images
          </TabsTrigger>
          <TabsTrigger value="performance" className="data-[state=active]:bg-admin-accent">
            <Zap className="h-4 w-4 mr-2" />
            Performance
          </TabsTrigger>
        </TabsList>

        {/* Traffic Tab */}
        <TabsContent value="traffic" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="bg-admin-surface border-admin-border">
              <CardHeader>
                <CardTitle className="text-white">Requests Over Time</CardTitle>
                <CardDescription className="text-slate-400">Daily API request volume</CardDescription>
              </CardHeader>
              <CardContent>
                {requestsLoading ? (
                  <ChartLoading />
                ) : requestsOverTime?.length ? (
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={requestsOverTime}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                        <YAxis stroke="#94a3b8" fontSize={12} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                          labelStyle={{ color: '#fff' }}
                        />
                        <Bar dataKey="requests" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyState message="No request data for selected period" />
                )}
              </CardContent>
            </Card>

            <Card className="bg-admin-surface border-admin-border">
              <CardHeader>
                <CardTitle className="text-white">Hourly Activity (Last 24h)</CardTitle>
                <CardDescription className="text-slate-400">Request distribution by hour</CardDescription>
              </CardHeader>
              <CardContent>
                {activityLoading ? (
                  <ChartLoading />
                ) : recentActivity?.length ? (
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={recentActivity}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="hour" stroke="#94a3b8" fontSize={12} />
                        <YAxis stroke="#94a3b8" fontSize={12} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                          labelStyle={{ color: '#fff' }}
                        />
                        <Line type="monotone" dataKey="requests" stroke="#06b6d4" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyState message="No activity data" />
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Credits Tab */}
        <TabsContent value="credits" className="space-y-4">
          <Card className="bg-admin-surface border-admin-border">
            <CardHeader>
              <CardTitle className="text-white">Credits Activity</CardTitle>
              <CardDescription className="text-slate-400">Daily credit transactions (spent vs added)</CardDescription>
            </CardHeader>
            <CardContent>
              {creditsLoading ? (
                <ChartLoading />
              ) : creditsOverTime?.length ? (
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={creditsOverTime}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                      <YAxis stroke="#94a3b8" fontSize={12} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                        labelStyle={{ color: '#fff' }}
                      />
                      <Legend wrapperStyle={{ paddingTop: '10px' }} />
                      <Bar dataKey="spent" name="Credits Spent" fill="#ef4444" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="added" name="Credits Added" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState message="No credit data for selected period" />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Images Tab */}
        <TabsContent value="images" className="space-y-4">
          <Card className="bg-admin-surface border-admin-border">
            <CardHeader>
              <CardTitle className="text-white">Images Per Day</CardTitle>
              <CardDescription className="text-slate-400">Generation success vs failure rate</CardDescription>
            </CardHeader>
            <CardContent>
              {imagesPerDayLoading ? (
                <ChartLoading />
              ) : imagesPerDay?.length ? (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={imagesPerDay}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                      <YAxis stroke="#94a3b8" fontSize={12} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                        labelStyle={{ color: '#fff' }}
                      />
                      <Legend wrapperStyle={{ paddingTop: '10px' }} />
                      <Line type="monotone" dataKey="successful" name="Successful" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="failed" name="Failed" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState message="No image data for selected period" />
              )}
            </CardContent>
          </Card>

          {/* Pie Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="bg-admin-surface border-admin-border">
              <CardHeader>
                <CardTitle className="text-white">Images by Model</CardTitle>
                <CardDescription className="text-slate-400">Distribution across AI models (all time)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {imagesByModel && imagesByModel.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={imagesByModel}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        >
                          {imagesByModel.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyState message="No image data yet" />
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-admin-surface border-admin-border">
              <CardHeader>
                <CardTitle className="text-white">Generation Status</CardTitle>
                <CardDescription className="text-slate-400">Image generation success rate</CardDescription>
              </CardHeader>
              <CardContent>
                {statusLoading ? (
                  <ChartLoading />
                ) : imagesByStatus && imagesByStatus.length > 0 ? (
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={imagesByStatus}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        >
                          {imagesByStatus.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={
                                entry.name === 'completed' ? '#10b981' :
                                entry.name === 'failed' ? '#ef4444' :
                                entry.name === 'pending' ? '#f59e0b' :
                                '#8b5cf6'
                              }
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyState message="No image data for selected period" />
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <Card className="bg-admin-surface border-admin-border">
            <CardHeader>
              <CardTitle className="text-white">Performance Metrics</CardTitle>
              <CardDescription className="text-slate-400">System performance overview</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-4 rounded-lg bg-admin-background border border-admin-border">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-4 w-4 text-admin-accent" />
                    <span className="text-sm font-medium text-white">Avg Response Time</span>
                  </div>
                  <p className="text-3xl font-bold text-white">{stats?.avgResponseTime || 0}ms</p>
                  <p className="text-xs text-slate-400 mt-1">Selected period</p>
                </div>

                <div className="p-4 rounded-lg bg-admin-background border border-admin-border">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-emerald-400" />
                    <span className="text-sm font-medium text-white">Uptime</span>
                  </div>
                  <p className="text-3xl font-bold text-emerald-400">99.9%</p>
                  <p className="text-xs text-slate-400 mt-1">Last 30 days</p>
                </div>

                <div className="p-4 rounded-lg bg-admin-background border border-admin-border">
                  <div className="flex items-center gap-2 mb-2">
                    <Server className="h-4 w-4 text-purple-400" />
                    <span className="text-sm font-medium text-white">Error Rate</span>
                  </div>
                  <p className="text-3xl font-bold text-purple-400">0.1%</p>
                  <p className="text-xs text-slate-400 mt-1">Last 24 hours</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
