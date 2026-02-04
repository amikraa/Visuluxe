-- Add columns for tracking health check results on providers table
ALTER TABLE providers ADD COLUMN IF NOT EXISTS last_test_at TIMESTAMPTZ;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS last_test_status TEXT DEFAULT 'never_tested';
ALTER TABLE providers ADD COLUMN IF NOT EXISTS last_test_message TEXT;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS last_test_response_time INTEGER;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS status_page_url TEXT;

-- Add constraint for valid status values
ALTER TABLE providers ADD CONSTRAINT providers_last_test_status_check 
  CHECK (last_test_status IS NULL OR last_test_status IN ('success', 'failed', 'never_tested'));