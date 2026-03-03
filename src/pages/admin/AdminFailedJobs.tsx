import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Trash2, RefreshCw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface FailedJob {
  job_id: string;
  user_id: string;
  prompt: string;
  status: string;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export default function AdminFailedJobs() {
  const [failedJobs, setFailedJobs] = useState<FailedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [terminatingJobs, setTerminatingJobs] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchFailedJobs();
  }, []);

  const fetchFailedJobs = async () => {
    try {
      setLoading(true);
      
      // Call the backend API to get failed jobs
      const response = await fetch('/api/v1/admin/failed-jobs?limit=100', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`,
        },
      });
      
      if (response.ok) {
        const jobs = await response.json();
        setFailedJobs(jobs);
      } else {
        // Fallback to direct Supabase query if API fails
        const { data, error } = await supabase
          .from('generation_jobs')
          .select('*')
          .eq('status', 'failed')
          .order('created_at', { ascending: false })
          .limit(100);
        
        if (error) throw error;
        setFailedJobs(data || []);
      }
    } catch (error) {
      console.error('Error fetching failed jobs:', error);
      toast({
        title: "Error",
        description: "Failed to fetch failed jobs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const terminateJob = async (jobId: string) => {
    try {
      setTerminatingJobs(prev => new Set(prev).add(jobId));
      
      // Call the backend API to terminate the job
      const response = await fetch(`/api/v1/admin/failed-jobs/${jobId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`,
        },
      });
      
      if (response.ok) {
        // Remove the job from the list
        setFailedJobs(prev => prev.filter(job => job.job_id !== jobId));
        toast({
          title: "Success",
          description: "Failed job terminated successfully",
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to terminate job');
      }
    } catch (error) {
      console.error('Error terminating job:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to terminate job",
        variant: "destructive",
      });
    } finally {
      setTerminatingJobs(prev => {
        const newSet = new Set(prev);
        newSet.delete(jobId);
        return newSet;
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Failed Jobs Management</h1>
          <p className="text-muted-foreground">
            View and terminate failed image generation jobs
          </p>
        </div>
        <Button onClick={fetchFailedJobs} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Failed Jobs ({failedJobs.length})
          </CardTitle>
          <CardDescription>
            These jobs failed during processing and can be terminated to clean up the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          {failedJobs.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No failed jobs found</p>
              <p className="text-muted-foreground">All jobs are processing successfully</p>
            </div>
          ) : (
            <div className="space-y-4">
              {failedJobs.map((job) => (
                <div key={job.job_id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive">Failed</Badge>
                        <span className="text-sm text-muted-foreground">
                          Job ID: {job.job_id}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          User: {job.user_id}
                        </span>
                      </div>
                      
                      <p className="font-medium">{job.prompt}</p>
                      
                      {job.error && (
                        <div className="bg-destructive/10 border border-destructive/20 rounded p-3">
                          <p className="text-sm text-destructive">
                            <span className="font-medium">Error:</span> {job.error}
                          </p>
                        </div>
                      )}
                      
                      <div className="flex gap-4 text-sm text-muted-foreground">
                        <span>Created: {formatDate(job.created_at)}</span>
                        <span>Updated: {formatDate(job.updated_at)}</span>
                      </div>
                    </div>
                    
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => terminateJob(job.job_id)}
                      disabled={terminatingJobs.has(job.job_id)}
                    >
                      {terminatingJobs.has(job.job_id) ? (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          Terminating...
                        </>
                      ) : (
                        <>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Terminate
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}