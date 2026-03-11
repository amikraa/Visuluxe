import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAdmin } from '@/contexts/AdminContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Search, 
  RefreshCw, 
  Play, 
  Pause, 
  Trash2, 
  Eye, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  User,
  Sparkles,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';

interface Job {
  id: string;
  job_id: string;
  user_id: string;
  username: string;
  status: string;
  prompt: string;
  negative_prompt: string;
  model_name: string;
  model_id: string;
  provider_name: string;
  provider_id: string;
  credits_used: number;
  account_type: string;
  priority: number;
  created_at: string;
  started_at: string;
  completed_at: string;
  error: string;
  processing_time_ms: number;
  image_url: string;
  signed_urls: string[];
  r2_keys: string[];
}

interface JobStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  cancelled: number;
  total: number;
  today: number;
}

export default function JobsManagement() {
  const { isAdmin, isSuperAdmin } = useAdmin();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('queue');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  // Fetch jobs based on active tab
  const { data: jobs, isLoading: jobsLoading } = useQuery({
    queryKey: ['admin-jobs', activeTab, statusFilter, priorityFilter],
    queryFn: async () => {
      // Use direct fetch to bypass TypeScript issues with custom tables
      const response = await fetch('/api/v1/admin/jobs', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch jobs');
      }
      
      const data = await response.json();
      return data as Job[];
    },
    enabled: isAdmin
  });

  // Fetch job statistics
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-job-stats'],
    queryFn: async () => {
      // Use direct fetch to bypass TypeScript issues with custom tables
      const response = await fetch('/api/v1/admin/jobs/stats', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch job statistics');
      }
      
      const data = await response.json();
      return data as JobStats;
    },
    enabled: isAdmin
  });

  // Mutations
  const cancelJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const response = await fetch(`/api/v1/admin/jobs/${jobId}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`,
        },
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to cancel job');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast.success('Job cancelled successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['admin-job-stats'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const retryJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const response = await fetch(`/api/v1/admin/jobs/${jobId}/retry`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`,
        },
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to retry job');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast.success('Job retried successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['admin-job-stats'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updatePriorityMutation = useMutation({
    mutationFn: async ({ jobId, priority }: { jobId: string; priority: number }) => {
      const response = await fetch(`/api/v1/admin/jobs/${jobId}/priority?priority=${priority}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`,
        },
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to update priority');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast.success('Job priority updated successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-jobs'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-blue-500/20 text-blue-400 border-blue-500/20',
      processing: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/20',
      completed: 'bg-green-500/20 text-green-400 border-green-500/20',
      failed: 'bg-red-500/20 text-red-400 border-red-500/20',
      cancelled: 'bg-gray-500/20 text-gray-400 border-gray-500/20',
    };
    return <Badge className={styles[status] || styles.pending}>{status}</Badge>;
  };

  const getPriorityBadge = (priority: number) => {
    const getPriorityLabel = (p: number) => {
      if (p >= 8) return 'Enterprise';
      if (p >= 5) return 'Pro';
      return 'Free';
    };

    const styles = {
      10: 'bg-purple-500/20 text-purple-400 border-purple-500/20',
      5: 'bg-blue-500/20 text-blue-400 border-blue-500/20',
      1: 'bg-gray-500/20 text-gray-400 border-gray-500/20',
    };
    
    return (
      <Badge className={styles[priority] || styles[1]}>
        {priority} - {getPriorityLabel(priority)}
      </Badge>
    );
  };

  const getAccountBadge = (accountType: string) => {
    const styles = {
      enterprise: 'bg-purple-500/20 text-purple-400 border-purple-500/20',
      pro: 'bg-blue-500/20 text-blue-400 border-blue-500/20',
      free: 'bg-gray-500/20 text-gray-400 border-gray-500/20',
    };
    return <Badge className={styles[accountType] || styles.free}>{accountType}</Badge>;
  };

  const handleCancelJob = (jobId: string) => {
    if (confirm('Are you sure you want to cancel this job?')) {
      cancelJobMutation.mutate(jobId);
    }
  };

  const handleRetryJob = (jobId: string) => {
    if (confirm('Are you sure you want to retry this failed job?')) {
      retryJobMutation.mutate(jobId);
    }
  };

  const handleUpdatePriority = (jobId: string, priority: number) => {
    updatePriorityMutation.mutate({ jobId, priority });
  };

  const filteredJobs = jobs?.filter(job => {
    if (statusFilter !== 'all' && job.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && job.priority !== parseInt(priorityFilter)) return false;
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        job.job_id.toLowerCase().includes(searchLower) ||
        job.prompt.toLowerCase().includes(searchLower) ||
        job.username?.toLowerCase().includes(searchLower) ||
        job.model_name.toLowerCase().includes(searchLower)
      );
    }
    return true;
  }) || [];

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-yellow-500" />
          <h2 className="text-2xl font-bold text-white mb-2">Admin Access Required</h2>
          <p className="text-gray-400">You need admin privileges to access the Jobs Management panel.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Jobs Management</h1>
          <p className="text-gray-400 mt-1">Monitor and manage image generation jobs</p>
        </div>
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            onClick={() => queryClient.invalidateQueries()}
            disabled={jobsLoading || statsLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${jobsLoading || statsLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      {!statsLoading && stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Total Jobs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stats.total}</div>
            </CardContent>
          </Card>
          
          <Card className="bg-blue-900/50 border-blue-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-blue-400">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stats.pending}</div>
            </CardContent>
          </Card>
          
          <Card className="bg-yellow-900/50 border-yellow-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-yellow-400">Processing</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stats.processing}</div>
            </CardContent>
          </Card>
          
          <Card className="bg-green-900/50 border-green-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-400">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stats.completed}</div>
            </CardContent>
          </Card>
          
          <Card className="bg-red-900/50 border-red-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-red-400">Failed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stats.failed}</div>
            </CardContent>
          </Card>
          
          <Card className="bg-purple-900/50 border-purple-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-purple-400">Today</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stats.today}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters and Search */}
      <Card className="bg-gray-800 border-gray-700">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 flex gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search jobs by ID, prompt, or username..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                  />
                </div>
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40 bg-gray-700 border-gray-600 text-white">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-40 bg-gray-700 border-gray-600 text-white">
                  <SelectValue placeholder="Filter by priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="10">Enterprise (10)</SelectItem>
                  <SelectItem value="5">Pro (5)</SelectItem>
                  <SelectItem value="1">Free (1)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant={activeTab === 'queue' ? 'default' : 'outline'}
                onClick={() => setActiveTab('queue')}
                className="flex items-center gap-2"
              >
                <Clock className="h-4 w-4" />
                Queue
              </Button>
              <Button
                variant={activeTab === 'completed' ? 'default' : 'outline'}
                onClick={() => setActiveTab('completed')}
                className="flex items-center gap-2"
              >
                <CheckCircle className="h-4 w-4" />
                Completed
              </Button>
              <Button
                variant={activeTab === 'failed' ? 'default' : 'outline'}
                onClick={() => setActiveTab('failed')}
                className="flex items-center gap-2"
              >
                <XCircle className="h-4 w-4" />
                Failed
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Jobs Table */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Jobs</CardTitle>
          <CardDescription className="text-gray-400">
            {filteredJobs.length} job(s) found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {jobsLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin text-blue-400" />
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              No jobs found matching your criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-600">
                    <TableHead className="text-gray-400">Job ID</TableHead>
                    <TableHead className="text-gray-400">User</TableHead>
                    <TableHead className="text-gray-400">Status</TableHead>
                    <TableHead className="text-gray-400">Priority</TableHead>
                    <TableHead className="text-gray-400">Model</TableHead>
                    <TableHead className="text-gray-400">Prompt</TableHead>
                    <TableHead className="text-gray-400">Created</TableHead>
                    <TableHead className="text-gray-400">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredJobs.map((job) => (
                    <TableRow key={job.job_id} className="border-gray-600 hover:bg-gray-700/50">
                      <TableCell className="font-mono text-sm text-white">
                        {job.job_id}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-400" />
                          <div>
                            <div className="font-medium text-white">{job.username || job.user_id}</div>
                            {getAccountBadge(job.account_type)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(job.status)}
                      </TableCell>
                      <TableCell>
                        {getPriorityBadge(job.priority)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {job.model_name}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs">
                          <p className="text-sm text-gray-300 line-clamp-2">{job.prompt}</p>
                          {job.negative_prompt && (
                            <p className="text-xs text-gray-500 mt-1">Negative: {job.negative_prompt}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-400">
                        {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {job.status === 'pending' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCancelJob(job.job_id)}
                              className="text-red-400 border-red-400/30 hover:bg-red-400/10"
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Cancel
                            </Button>
                          )}
                          
                          {job.status === 'failed' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRetryJob(job.job_id)}
                              className="text-green-400 border-green-400/30 hover:bg-green-400/10"
                            >
                              <RefreshCw className="h-3 w-3 mr-1" />
                              Retry
                            </Button>
                          )}
                          
                          {job.status === 'pending' && (
                            <Select onValueChange={(value) => handleUpdatePriority(job.job_id, parseInt(value))}>
                              <SelectTrigger className="w-24 text-xs border-gray-600">
                                <SelectValue placeholder="Priority" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="10">Enterprise</SelectItem>
                                <SelectItem value="5">Pro</SelectItem>
                                <SelectItem value="1">Free</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedJob(job)}
                            className="text-blue-400 border-blue-400/30 hover:bg-blue-400/10"
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Details
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Job Details Modal */}
      {selectedJob && (
        <JobDetailsModal
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          onRetry={() => handleRetryJob(selectedJob.job_id)}
          onCancel={() => handleCancelJob(selectedJob.job_id)}
        />
      )}
    </div>
  );
}

// Job Details Modal Component
function JobDetailsModal({ 
  job, 
  onClose, 
  onRetry, 
  onCancel 
}: { 
  job: Job; 
  onClose: () => void; 
  onRetry: () => void; 
  onCancel: () => void; 
}) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 border border-gray-700 rounded-lg max-w-4xl w-full max-h-[80vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">Job Details</h2>
              <p className="text-gray-400 mt-1">Job ID: {job.job_id}</p>
            </div>
            <Button variant="ghost" onClick={onClose} className="text-gray-400 hover:text-white">
              ✕
            </Button>
          </div>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-gray-400">Status</Label>
              {getStatusBadge(job.status)}
            </div>
            <div className="space-y-2">
              <Label className="text-gray-400">Priority</Label>
              {getPriorityBadge(job.priority)}
            </div>
            <div className="space-y-2">
              <Label className="text-gray-400">User</Label>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-gray-400" />
                <span className="text-white">{job.username || job.user_id}</span>
                {getAccountBadge(job.account_type)}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-gray-400">Model</Label>
              <Badge variant="secondary">{job.model_name}</Badge>
            </div>
          </div>

          {/* Timestamps */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-gray-400">Created</Label>
              <p className="text-white">{format(new Date(job.created_at), 'PPpp')}</p>
            </div>
            <div className="space-y-2">
              <Label className="text-gray-400">Started</Label>
              <p className="text-white">{job.started_at ? format(new Date(job.started_at), 'PPpp') : 'Not started'}</p>
            </div>
            <div className="space-y-2">
              <Label className="text-gray-400">Completed</Label>
              <p className="text-white">{job.completed_at ? format(new Date(job.completed_at), 'PPpp') : 'Not completed'}</p>
            </div>
          </div>

          {/* Processing Information */}
          {job.processing_time_ms && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-400">Processing Time</Label>
                <p className="text-white">{job.processing_time_ms}ms</p>
              </div>
              <div className="space-y-2">
                <Label className="text-gray-400">Credits Used</Label>
                <p className="text-white">{job.credits_used}</p>
              </div>
            </div>
          )}

          {/* Prompt Information */}
          <div className="space-y-2">
            <Label className="text-gray-400">Prompt</Label>
            <Textarea
              value={job.prompt}
              readOnly
              className="bg-gray-700 border-gray-600 text-white"
              rows={3}
            />
          </div>

          {job.negative_prompt && (
            <div className="space-y-2">
              <Label className="text-gray-400">Negative Prompt</Label>
              <Textarea
                value={job.negative_prompt}
                readOnly
                className="bg-gray-700 border-gray-600 text-white"
                rows={2}
              />
            </div>
          )}

          {/* Error Information */}
          {job.error && (
            <div className="space-y-2">
              <Label className="text-red-400">Error</Label>
              <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3">
                <p className="text-red-300 text-sm">{job.error}</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            {job.status === 'pending' && (
              <Button
                variant="destructive"
                onClick={() => {
                  onCancel();
                  onClose();
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Cancel Job
              </Button>
            )}
            
            {job.status === 'failed' && (
              <Button
                variant="outline"
                onClick={() => {
                  onRetry();
                  onClose();
                }}
                className="text-green-400 border-green-400/30 hover:bg-green-400/10"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry Job
              </Button>
            )}
            
            <Button variant="outline" onClick={onClose} className="border-gray-600">
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper functions
function getStatusBadge(status: string) {
  const styles = {
    pending: 'bg-blue-500/20 text-blue-400 border-blue-500/20',
    processing: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/20',
    completed: 'bg-green-500/20 text-green-400 border-green-500/20',
    failed: 'bg-red-500/20 text-red-400 border-red-500/20',
    cancelled: 'bg-gray-500/20 text-gray-400 border-gray-500/20',
  };
  return <Badge className={styles[status] || styles.pending}>{status}</Badge>;
}

function getPriorityBadge(priority: number) {
  const getPriorityLabel = (p: number) => {
    if (p >= 8) return 'Enterprise';
    if (p >= 5) return 'Pro';
    return 'Free';
  };

  const styles = {
    10: 'bg-purple-500/20 text-purple-400 border-purple-500/20',
    5: 'bg-blue-500/20 text-blue-400 border-blue-500/20',
    1: 'bg-gray-500/20 text-gray-400 border-gray-500/20',
  };
  
  return (
    <Badge className={styles[priority] || styles[1]}>
      {priority} - {getPriorityLabel(priority)}
    </Badge>
  );
}

function getAccountBadge(accountType: string) {
  const styles = {
    enterprise: 'bg-purple-500/20 text-purple-400 border-purple-500/20',
    pro: 'bg-blue-500/20 text-blue-400 border-blue-500/20',
    free: 'bg-gray-500/20 text-gray-400 border-gray-500/20',
  };
  return <Badge className={styles[accountType] || styles.free}>{accountType}</Badge>;
}