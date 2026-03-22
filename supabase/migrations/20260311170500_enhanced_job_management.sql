-- Migration: Enhanced Job Management System
-- Date: 2026-03-11

-- 1. Enhance generation_jobs table with new fields
ALTER TABLE generation_jobs 
ADD COLUMN IF NOT EXISTS account_type VARCHAR(20) DEFAULT 'normal',
ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS job_owner_username VARCHAR(255),
ADD COLUMN IF NOT EXISTS provider_credit_cost NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS platform_profit NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS processing_time_ms INTEGER,
ADD COLUMN IF NOT EXISTS provider_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS model_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS auto_retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cancelled_by UUID,
ADD COLUMN IF NOT EXISTS retry_after TIMESTAMPTZ;

-- 2. Create job_logs table for comprehensive logging
CREATE TABLE IF NOT EXISTS job_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id VARCHAR(100) NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    username VARCHAR(255),
    account_type VARCHAR(20),
    prompt TEXT,
    negative_prompt TEXT,
    model_name VARCHAR(255),
    model_id VARCHAR(100),
    provider_name VARCHAR(255),
    provider_id VARCHAR(100),
    credits_used NUMERIC,
    provider_credit_cost NUMERIC,
    platform_profit NUMERIC,
    status VARCHAR(20),
    image_url TEXT,
    failure_reason TEXT,
    processing_time_ms INTEGER,
    log_type VARCHAR(20) NOT NULL, -- 'created', 'started', 'completed', 'failed', 'cancelled', 'retry'
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create provider_health_checks table
CREATE TABLE IF NOT EXISTS provider_health_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id VARCHAR(100) NOT NULL,
    provider_name VARCHAR(255),
    status VARCHAR(20) NOT NULL, -- 'healthy', 'unhealthy', 'maintenance'
    response_time_ms INTEGER,
    error_message TEXT,
    consecutive_failures INTEGER DEFAULT 0,
    last_check_at TIMESTAMPTZ DEFAULT NOW(),
    next_check_at TIMESTAMPTZ,
    auto_disabled BOOLEAN DEFAULT FALSE,
    disabled_at TIMESTAMPTZ,
    disabled_by VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create user_storage_settings table
CREATE TABLE IF NOT EXISTS user_storage_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    auto_delete_after_days INTEGER DEFAULT 30,
    storage_tier VARCHAR(20) DEFAULT 'basic', -- 'basic', 'premium', 'enterprise'
    max_storage_days INTEGER DEFAULT 90,
    enable_long_term_storage BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create telegram_notifications table
CREATE TABLE IF NOT EXISTS telegram_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    telegram_chat_id VARCHAR(255),
    notification_types JSONB DEFAULT '["image_generation", "security_events", "system_alerts"]',
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Create abuse_detection table
CREATE TABLE IF NOT EXISTS abuse_detection (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    api_key_id UUID,
    ip_address VARCHAR(45),
    event_type VARCHAR(50) NOT NULL, -- 'rate_limit', 'mass_generation', 'unauthorized_access', 'domain_abuse'
    severity VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    details JSONB DEFAULT '{}',
    triggered_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID,
    is_resolved BOOLEAN DEFAULT FALSE
);

-- 7. Create provider_configurations table
CREATE TABLE IF NOT EXISTS provider_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id VARCHAR(100) NOT NULL UNIQUE,
    max_concurrent_jobs INTEGER DEFAULT 5,
    max_images_per_request INTEGER DEFAULT 4,
    supports_multi_image BOOLEAN DEFAULT TRUE,
    cost_per_generation NUMERIC DEFAULT 0,
    health_check_interval INTEGER DEFAULT 300, -- seconds
    auto_disable_on_failure BOOLEAN DEFAULT TRUE,
    failure_threshold INTEGER DEFAULT 3,
    retry_delay INTEGER DEFAULT 60, -- seconds
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Create model_catalog table
CREATE TABLE IF NOT EXISTS model_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id VARCHAR(100) NOT NULL UNIQUE,
    model_name VARCHAR(255) NOT NULL,
    description TEXT,
    capabilities JSONB DEFAULT '{}',
    supported_sizes JSONB DEFAULT '["1024x1024", "1344x768", "768x1344"]',
    max_images INTEGER DEFAULT 4,
    pricing_tiers JSONB DEFAULT '{}',
    provider_support JSONB DEFAULT '{}',
    documentation_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Create model_analytics table
CREATE TABLE IF NOT EXISTS model_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id VARCHAR(100) NOT NULL,
    date DATE NOT NULL,
    total_generations INTEGER DEFAULT 0,
    total_revenue NUMERIC DEFAULT 0,
    total_provider_cost NUMERIC DEFAULT 0,
    profit NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(model_id, date)
);

-- 9. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_generation_jobs_priority ON generation_jobs(priority DESC);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_account_type ON generation_jobs(account_type);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_status_started ON generation_jobs(status, started_at) WHERE status = 'processing';
CREATE INDEX IF NOT EXISTS idx_job_logs_job_id ON job_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_job_logs_user_id ON job_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_job_logs_created_at ON job_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_logs_log_type ON job_logs(log_type);
CREATE INDEX IF NOT EXISTS idx_provider_health_checks_provider_id ON provider_health_checks(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_health_checks_status ON provider_health_checks(status);
CREATE INDEX IF NOT EXISTS idx_user_storage_settings_user_id ON user_storage_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_notifications_user_id ON telegram_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_abuse_detection_user_id ON abuse_detection(user_id);
CREATE INDEX IF NOT EXISTS idx_abuse_detection_event_type ON abuse_detection(event_type);
CREATE INDEX IF NOT EXISTS idx_abuse_detection_triggered_at ON abuse_detection(triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_provider_configurations_provider_id ON provider_configurations(provider_id);

-- 10. Enable RLS on new tables
ALTER TABLE job_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_health_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_storage_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE abuse_detection ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_catalog ENABLE ROW LEVEL SECURITY;

-- 11. RLS Policies for job_logs
CREATE POLICY "Admins can view all job logs" ON job_logs
  FOR SELECT USING (is_admin_or_above(auth.uid()));

CREATE POLICY "System can insert job logs" ON job_logs
  FOR INSERT WITH CHECK (true);

-- 12. RLS Policies for provider_health_checks
CREATE POLICY "Admins can view provider health" ON provider_health_checks
  FOR SELECT USING (is_admin_or_above(auth.uid()));

CREATE POLICY "System can manage health checks" ON provider_health_checks
  FOR ALL USING (is_admin_or_above(auth.uid()));

-- 13. RLS Policies for user_storage_settings
CREATE POLICY "Users can view their own storage settings" ON user_storage_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own storage settings" ON user_storage_settings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all storage settings" ON user_storage_settings
  FOR SELECT USING (is_admin_or_above(auth.uid()));

-- 14. RLS Policies for telegram_notifications
CREATE POLICY "Users can manage their own telegram settings" ON telegram_notifications
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can view telegram settings" ON telegram_notifications
  FOR SELECT USING (is_admin_or_above(auth.uid()));

-- 15. RLS Policies for abuse_detection
CREATE POLICY "Admins can view abuse detection" ON abuse_detection
  FOR SELECT USING (is_admin_or_above(auth.uid()));

CREATE POLICY "System can insert abuse detection" ON abuse_detection
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can update abuse detection" ON abuse_detection
  FOR UPDATE USING (is_admin_or_above(auth.uid()));

-- 16. RLS Policies for provider_configurations
CREATE POLICY "Admins can manage provider configurations" ON provider_configurations
  FOR ALL USING (is_admin_or_above(auth.uid()));

-- 17. RLS Policies for model_catalog
CREATE POLICY "Anyone can view model catalog" ON model_catalog
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage model catalog" ON model_catalog
  FOR ALL USING (is_admin_or_above(auth.uid()));

-- 18. Create trigger for updated_at on new tables
CREATE TRIGGER update_user_storage_settings_updated_at
  BEFORE UPDATE ON user_storage_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_telegram_notifications_updated_at
  BEFORE UPDATE ON telegram_notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_provider_configurations_updated_at
  BEFORE UPDATE ON provider_configurations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_model_catalog_updated_at
  BEFORE UPDATE ON model_catalog
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 19. Insert default provider configurations
INSERT INTO provider_configurations (provider_id, max_concurrent_jobs, max_images_per_request, supports_multi_image, cost_per_generation, health_check_interval, auto_disable_on_failure, failure_threshold, retry_delay)
VALUES 
  ('flux', 5, 4, true, 2.0, 300, true, 3, 60),
  ('openai', 10, 1, false, 5.0, 300, true, 3, 60),
  ('stability', 3, 4, true, 3.0, 300, true, 3, 60)
ON CONFLICT (provider_id) DO NOTHING;

-- 20. Insert default model catalog entries
INSERT INTO model_catalog (model_id, model_name, description, capabilities, supported_sizes, max_images, pricing_tiers, provider_support, documentation_url)
VALUES 
  ('flux-dev', 'Flux Dev', 'High-quality image generation model', '{"text_to_image": true, "image_to_image": false, "inpainting": false}', '["1024x1024", "1344x768", "768x1344"]', 4, '{"flux": 2.0, "openai": 5.0}', '{"flux": true, "openai": false}', 'https://flux.dev/docs'),
  ('flux-schnell', 'Flux Schnell', 'Fast image generation model', '{"text_to_image": true, "image_to_image": false, "inpainting": false}', '["1024x1024"]', 1, '{"flux": 1.0}', '{"flux": true}', 'https://flux.dev/docs'),
  ('dall-e-3', 'DALL-E 3', 'OpenAI advanced image model', '{"text_to_image": true, "image_to_image": true, "inpainting": true}', '["1024x1024", "1792x1024", "1024x1792"]', 1, '{"openai": 5.0}', '{"openai": true}', 'https://openai.com/dall-e-3')
ON CONFLICT (model_id) DO NOTHING;

-- 21. Update existing generation_jobs to set priority based on user account type
UPDATE generation_jobs gj
SET
  account_type = COALESCE(
    (SELECT p.account_type FROM profiles p WHERE p.user_id = gj.user_id),
    'normal'
  ),
  priority = CASE
    WHEN (SELECT p.account_type FROM profiles p WHERE p.user_id = gj.user_id) = 'partner' THEN 5
    ELSE 1
  END;

-- 22. Create function to update job priority based on account type
CREATE OR REPLACE FUNCTION update_job_priority_on_account_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update priority for pending and processing jobs when account type changes
  UPDATE generation_jobs 
  SET 
    priority = CASE 
      WHEN NEW.account_type = 'partner' THEN 5
      ELSE 1
    END,
    account_type = NEW.account_type
  WHERE user_id = NEW.user_id 
    AND status IN ('pending', 'processing');
    
  RETURN NEW;
END;
$$;

-- 23. Create trigger to update job priority when account type changes
CREATE TRIGGER update_job_priority_trigger
  AFTER UPDATE ON profiles
  FOR EACH ROW
  WHEN (OLD.account_type IS DISTINCT FROM NEW.account_type)
  EXECUTE FUNCTION update_job_priority_on_account_change();

-- 24. Create function to log job events
CREATE OR REPLACE FUNCTION log_job_event(
  p_job_id VARCHAR(100),
  p_user_id UUID,
  p_username VARCHAR(255),
  p_account_type VARCHAR(20),
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
    job_id, user_id, username, account_type, prompt, negative_prompt, model_name, model_id,
    provider_name, provider_id, credits_used, provider_credit_cost, platform_profit,
    status, image_url, failure_reason, processing_time_ms, log_type, metadata
  ) VALUES (
    p_job_id, p_user_id, p_username, p_account_type, p_prompt, p_negative_prompt, p_model_name, p_model_id,
    p_provider_name, p_provider_id, p_credits_used, p_provider_credit_cost, p_platform_profit,
    p_status, p_image_url, p_failure_reason, p_processing_time_ms, p_log_type, p_metadata
  );
END;
$$;