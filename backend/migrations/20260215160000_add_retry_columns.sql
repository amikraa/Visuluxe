-- Add retry columns to generation_jobs table for proper failed job handling
ALTER TABLE generation_jobs ADD COLUMN retry_count integer DEFAULT 0;
ALTER TABLE generation_jobs ADD COLUMN archived boolean DEFAULT false;

-- Create index for efficient querying of pending jobs
CREATE INDEX IF NOT EXISTS idx_generation_jobs_status_pending 
ON generation_jobs (status) 
WHERE status = 'pending';

-- Create index for efficient querying of failed jobs
CREATE INDEX IF NOT EXISTS idx_generation_jobs_status_failed 
ON generation_jobs (status) 
WHERE status = 'failed';

-- Create index for efficient querying of failed jobs with retry logic
CREATE INDEX IF NOT EXISTS idx_generation_jobs_failed_retry 
ON generation_jobs (status, retry_count, archived) 
WHERE status = 'failed';