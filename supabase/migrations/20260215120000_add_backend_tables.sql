-- Migration: Add backend configuration and job tracking tables
-- Date: 2026-02-15

-- Table for backend configuration (admin-controlled settings)
CREATE TABLE IF NOT EXISTS backend_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for generation job tracking
CREATE TABLE IF NOT EXISTS generation_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id VARCHAR(100) UNIQUE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending',
    prompt TEXT NOT NULL,
    negative_prompt TEXT,
    model_id VARCHAR(100),
    size VARCHAR(20) DEFAULT '1024x1024',
    num_images INTEGER DEFAULT 1,
    r2_keys TEXT[],
    signed_urls JSONB,
    expires_at TIMESTAMPTZ,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE backend_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for backend_config
CREATE POLICY "Service role can manage backend config" 
ON backend_config FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- RLS Policies for generation_jobs
CREATE POLICY "Users can view own jobs" 
ON generation_jobs FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage jobs" 
ON generation_jobs FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- Insert default backend configuration
INSERT INTO backend_config (key, value, description) 
VALUES 
    ('image_ttl_minutes', '60', 'Default image expiry time in minutes'),
    ('max_concurrent_jobs', '2', 'Maximum concurrent jobs per user'),
    ('rate_limit_rpm', '60', 'Default requests per minute'),
    ('rate_limit_rpd', '1000', 'Default requests per day'),
    ('max_images_per_generation', '4', 'Maximum images per generation request'),
    ('max_image_size', '2048', 'Maximum image dimension in pixels')
ON CONFLICT (key) DO NOTHING;

-- Create index for faster job lookups
CREATE INDEX IF NOT EXISTS idx_generation_jobs_user_id ON generation_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_status ON generation_jobs(status);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_job_id ON generation_jobs(job_id);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_expires_at ON generation_jobs(expires_at);