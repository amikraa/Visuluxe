-- Migration: Fix Account Type Architecture - Separate User Roles from Subscription Plans
-- Date: 2026-03-11
-- Purpose: Fix enum conflict by creating separate plan_type for subscriptions

-- 1. Create plan_type ENUM safely (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plan_type') THEN
        CREATE TYPE plan_type AS ENUM ('free', 'pro', 'enterprise');
    END IF;
END$$;

-- 2. Create function to safely add column if it doesn't exist
CREATE OR REPLACE FUNCTION safe_add_column(
    table_name TEXT,
    column_name TEXT,
    column_type TEXT,
    default_value TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check if column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = table_name 
        AND column_name = column_name
    ) THEN
        -- Add column
        EXECUTE format('ALTER TABLE %I ADD COLUMN %I %s', table_name, column_name, column_type);
        
        -- Set default if provided
        IF default_value IS NOT NULL THEN
            EXECUTE format('UPDATE %I SET %I = %s', table_name, column_name, default_value);
        END IF;
    END IF;
END;
$$;

-- 2. Add plan_type column to profiles table (idempotent)
SELECT safe_add_column('profiles', 'plan_type', 'plan_type', '''free''::plan_type');

-- 3. Update existing profiles to have plan_type based on account_type
-- Map: normal -> free, partner -> pro (as reasonable defaults)
UPDATE profiles 
SET plan_type = CASE 
    WHEN account_type = 'partner' THEN 'pro'::plan_type
    ELSE 'free'::plan_type
END
WHERE plan_type IS NULL OR plan_type = 'free'::plan_type;

-- 4. Fix generation_jobs table to use plan_type instead of account_type for priority
-- First, add plan_type column to generation_jobs
SELECT safe_add_column('generation_jobs', 'plan_type', 'plan_type', '''free''::plan_type');

-- 5. Update existing jobs to set plan_type based on user's plan
UPDATE generation_jobs gj
SET 
  plan_type = COALESCE(
    (SELECT p.plan_type FROM profiles p WHERE p.user_id = gj.user_id),
    'free'::plan_type
  ),
  priority = CASE 
    WHEN (SELECT p.plan_type FROM profiles p WHERE p.user_id = gj.user_id) = 'enterprise'::plan_type THEN 10
    WHEN (SELECT p.plan_type FROM profiles p WHERE p.user_id = gj.user_id) = 'pro'::plan_type THEN 5
    ELSE 1
  END,
  account_type = COALESCE(
    (SELECT p.account_type FROM profiles p WHERE p.user_id = gj.user_id),
    'normal'::account_type
  );

-- 6. Update job_logs table to use plan_type
SELECT safe_add_column('job_logs', 'plan_type', 'plan_type', '''free''::plan_type');

-- 7. Update existing job logs
UPDATE job_logs jl
SET 
  plan_type = COALESCE(
    (SELECT p.plan_type FROM profiles p WHERE p.user_id = jl.user_id),
    'free'::plan_type
  ),
  account_type = COALESCE(
    (SELECT p.account_type FROM profiles p WHERE p.user_id = jl.user_id),
    'normal'::account_type
  );

-- 8. Create function to update job priority based on plan_type (not account_type)
CREATE OR REPLACE FUNCTION update_job_priority_on_plan_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update priority for pending and processing jobs when plan_type changes
  UPDATE generation_jobs 
  SET 
    priority = CASE 
      WHEN NEW.plan_type = 'enterprise'::plan_type THEN 10
      WHEN NEW.plan_type = 'pro'::plan_type THEN 5
      ELSE 1
    END,
    plan_type = NEW.plan_type,
    account_type = NEW.account_type
  WHERE user_id = NEW.user_id 
    AND status IN ('pending', 'processing');
    
  RETURN NEW;
END;
$$;

-- 9. Drop old trigger and create new one for plan_type changes
DROP TRIGGER IF EXISTS update_job_priority_trigger ON profiles;
CREATE TRIGGER update_job_priority_trigger
  AFTER UPDATE ON profiles
  FOR EACH ROW
  WHEN (OLD.plan_type IS DISTINCT FROM NEW.plan_type OR OLD.account_type IS DISTINCT FROM NEW.account_type)
  EXECUTE FUNCTION update_job_priority_on_plan_change();

-- 10. Create function to log job events with correct plan_type
CREATE OR REPLACE FUNCTION log_job_event_fixed(
  p_job_id VARCHAR(100),
  p_user_id UUID,
  p_username VARCHAR(255),
  p_plan_type plan_type,
  p_account_type account_type,
  p_prompt TEXT,
  p_negative_prompt TEXT,
  p_model_name VARCHAR(255),
  p_model_id VARCHAR(100),
  p_provider_name VARCHAR(255),
  p_provider_id VARCHAR(100),
  p_credits_used NUMERIC,
  p_provider_credit_cost NUMERIC,
  p_platform_profit NUMERIC,
  p_status VARCHAR(20),
  p_image_url TEXT,
  p_failure_reason TEXT,
  p_processing_time_ms INTEGER,
  p_log_type VARCHAR(20),
  p_metadata JSONB DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO job_logs (
    job_id, user_id, username, plan_type, account_type, prompt, negative_prompt, model_name, model_id,
    provider_name, provider_id, credits_used, provider_credit_cost, platform_profit,
    status, image_url, failure_reason, processing_time_ms, log_type, metadata
  ) VALUES (
    p_job_id, p_user_id, p_username, p_plan_type, p_account_type, p_prompt, p_negative_prompt, p_model_name, p_model_id,
    p_provider_name, p_provider_id, p_credits_used, p_provider_credit_cost, p_platform_profit,
    p_status, p_image_url, p_failure_reason, p_processing_time_ms, p_log_type, p_metadata
  );
END;
$$;

-- 11. Create indexes for new plan_type columns
CREATE INDEX IF NOT EXISTS idx_generation_jobs_plan_type ON generation_jobs(plan_type);
CREATE INDEX IF NOT EXISTS idx_job_logs_plan_type ON job_logs(plan_type);

-- 12. Add comments for documentation
COMMENT ON COLUMN profiles.plan_type IS 'Subscription plan type: free, pro, or enterprise';
COMMENT ON COLUMN profiles.account_type IS 'User relationship type: normal or partner';
COMMENT ON COLUMN generation_jobs.plan_type IS 'User plan type for priority calculation';
COMMENT ON COLUMN job_logs.plan_type IS 'User plan type at time of job execution';

-- 13. Create view for easy access to user plan information
CREATE OR REPLACE VIEW user_plan_info AS
SELECT 
  p.user_id,
  p.username,
  p.account_type,
  p.plan_type,
  p.is_super_admin,
  COALESCE(uc.balance, 0) as credits_balance,
  COALESCE(uc.daily_credits, 0) as daily_credits,
  uc.last_daily_reset
FROM profiles p
LEFT JOIN user_credits uc ON p.user_id = uc.user_id;

-- 14. Grant permissions on new view
GRANT SELECT ON user_plan_info TO authenticated;

-- 15. Create function to get user priority based on plan
CREATE OR REPLACE FUNCTION get_user_priority(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_plan plan_type;
BEGIN
  SELECT plan_type INTO user_plan 
  FROM profiles 
  WHERE user_id = p_user_id;
  
  RETURN CASE 
    WHEN user_plan = 'enterprise'::plan_type THEN 10
    WHEN user_plan = 'pro'::plan_type THEN 5
    ELSE 1
  END;
END;
$$;

-- 16. Create function to update user plan
CREATE OR REPLACE FUNCTION update_user_plan(p_user_id UUID, p_new_plan plan_type)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow updates by super admins or the user themselves (for free tier)
  IF NOT (is_super_admin_or_above(auth.uid()) OR (auth.uid() = p_user_id AND p_new_plan = 'free'::plan_type)) THEN
    RETURN FALSE;
  END IF;
  
  UPDATE profiles 
  SET plan_type = p_new_plan
  WHERE user_id = p_user_id;
  
  RETURN TRUE;
END;
$$;

-- 17. Create function to migrate old account_type logic to plan_type
CREATE OR REPLACE FUNCTION migrate_account_type_to_plan_type()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- This function can be called to ensure consistency
  -- Map account_type to plan_type for any profiles that might be inconsistent
  UPDATE profiles 
  SET plan_type = CASE 
    WHEN account_type = 'partner' AND plan_type != 'pro'::plan_type THEN 'pro'::plan_type
    WHEN account_type = 'normal' AND plan_type != 'free'::plan_type THEN 'free'::plan_type
    ELSE plan_type
  END;
END;
$$;

-- 18. Execute migration function to ensure consistency
SELECT migrate_account_type_to_plan_type();

-- 19. Create policy for user_plan_info view
CREATE POLICY "Users can view their own plan info" ON user_plan_info
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all plan info" ON user_plan_info
  FOR SELECT USING (is_admin_or_above(auth.uid()));

-- 20. Log the migration completion
INSERT INTO system_settings (key, value, description, updated_by)
VALUES (
  'migration_20260311171500_completed', 
  jsonb_build_object('completed_at', now(), 'version', '1.0'),
  'Account type architecture fix migration completed',
  auth.uid()
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_by = EXCLUDED.updated_by,
  updated_at = now();