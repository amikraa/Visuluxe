ALTER TABLE generation_jobs
ADD COLUMN IF NOT EXISTS retry_count integer DEFAULT 0;

ALTER TABLE generation_jobs
ADD COLUMN IF NOT EXISTS archived boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_generation_jobs_status_pending
ON generation_jobs (status)
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_generation_jobs_status_failed
ON generation_jobs (status)
WHERE status = 'failed';

CREATE INDEX IF NOT EXISTS idx_generation_jobs_failed_retry
ON generation_jobs (status, retry_count, archived)
WHERE status = 'failed';
