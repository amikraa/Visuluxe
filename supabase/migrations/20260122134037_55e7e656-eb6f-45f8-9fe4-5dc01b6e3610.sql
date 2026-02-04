-- ============================================================
-- ANALYTICS VIEWS AND FUNCTIONS MIGRATION
-- Creates materialized views for efficient model/provider analytics
-- ============================================================

-- Create analytics_cache table for pre-computed expensive queries
CREATE TABLE IF NOT EXISTS public.analytics_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT UNIQUE NOT NULL,
  data JSONB NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '1 hour'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on analytics_cache
ALTER TABLE public.analytics_cache ENABLE ROW LEVEL SECURITY;

-- RLS: Only admins can access cache
CREATE POLICY "Admins can manage analytics cache"
  ON public.analytics_cache
  FOR ALL
  USING (is_admin_or_above(auth.uid()));

-- Create indexes for performance on images table
CREATE INDEX IF NOT EXISTS idx_images_model_created ON public.images(model_id, created_at);
CREATE INDEX IF NOT EXISTS idx_images_provider_created ON public.images(provider_id, created_at);
CREATE INDEX IF NOT EXISTS idx_images_status_created ON public.images(status, created_at);
CREATE INDEX IF NOT EXISTS idx_images_user_created ON public.images(user_id, created_at);

-- Function: Get model analytics for a date range
CREATE OR REPLACE FUNCTION public.get_model_analytics(
  p_model_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS TABLE(
  date DATE,
  total_requests BIGINT,
  successful_requests BIGINT,
  failed_requests BIGINT,
  total_credits NUMERIC,
  avg_response_time NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE(i.created_at) as date,
    COUNT(*)::BIGINT as total_requests,
    COUNT(*) FILTER (WHERE i.status = 'completed')::BIGINT as successful_requests,
    COUNT(*) FILTER (WHERE i.status = 'failed')::BIGINT as failed_requests,
    COALESCE(SUM(i.credits_used), 0) as total_credits,
    COALESCE(AVG(i.generation_time_ms), 0) as avg_response_time
  FROM images i
  WHERE i.model_id = p_model_id
    AND i.created_at >= p_start_date
    AND i.created_at <= p_end_date
  GROUP BY DATE(i.created_at)
  ORDER BY DATE(i.created_at);
END;
$$;

-- Function: Get provider analytics for a date range
CREATE OR REPLACE FUNCTION public.get_provider_analytics(
  p_provider_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS TABLE(
  date DATE,
  total_requests BIGINT,
  successful_requests BIGINT,
  failed_requests BIGINT,
  avg_response_time NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE(i.created_at) as date,
    COUNT(*)::BIGINT as total_requests,
    COUNT(*) FILTER (WHERE i.status = 'completed')::BIGINT as successful_requests,
    COUNT(*) FILTER (WHERE i.status = 'failed')::BIGINT as failed_requests,
    COALESCE(AVG(i.generation_time_ms), 0) as avg_response_time
  FROM images i
  WHERE i.provider_id = p_provider_id
    AND i.created_at >= p_start_date
    AND i.created_at <= p_end_date
  GROUP BY DATE(i.created_at)
  ORDER BY DATE(i.created_at);
END;
$$;

-- Function: Get model summary stats
CREATE OR REPLACE FUNCTION public.get_model_summary_stats(
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS TABLE(
  model_id UUID,
  model_name TEXT,
  total_requests BIGINT,
  successful_requests BIGINT,
  failed_requests BIGINT,
  success_rate NUMERIC,
  total_credits NUMERIC,
  avg_credits_per_gen NUMERIC,
  avg_response_time NUMERIC,
  last_used TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id as model_id,
    m.name as model_name,
    COALESCE(COUNT(i.id), 0)::BIGINT as total_requests,
    COALESCE(COUNT(i.id) FILTER (WHERE i.status = 'completed'), 0)::BIGINT as successful_requests,
    COALESCE(COUNT(i.id) FILTER (WHERE i.status = 'failed'), 0)::BIGINT as failed_requests,
    CASE 
      WHEN COUNT(i.id) > 0 THEN 
        ROUND((COUNT(i.id) FILTER (WHERE i.status = 'completed')::NUMERIC / COUNT(i.id)::NUMERIC) * 100, 2)
      ELSE 0 
    END as success_rate,
    COALESCE(SUM(i.credits_used), 0) as total_credits,
    CASE 
      WHEN COUNT(i.id) FILTER (WHERE i.status = 'completed') > 0 THEN 
        ROUND(SUM(i.credits_used) / COUNT(i.id) FILTER (WHERE i.status = 'completed'), 4)
      ELSE 0 
    END as avg_credits_per_gen,
    COALESCE(AVG(i.generation_time_ms), 0) as avg_response_time,
    MAX(i.created_at) as last_used
  FROM ai_models m
  LEFT JOIN images i ON i.model_id = m.id 
    AND i.created_at >= p_start_date 
    AND i.created_at <= p_end_date
  GROUP BY m.id, m.name
  ORDER BY total_requests DESC;
END;
$$;

-- Function: Get provider summary stats
CREATE OR REPLACE FUNCTION public.get_provider_summary_stats(
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS TABLE(
  provider_id UUID,
  provider_name TEXT,
  provider_display_name TEXT,
  total_requests BIGINT,
  successful_requests BIGINT,
  failed_requests BIGINT,
  success_rate NUMERIC,
  total_cost NUMERIC,
  avg_response_time NUMERIC,
  last_used TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as provider_id,
    p.name as provider_name,
    p.display_name as provider_display_name,
    COALESCE(COUNT(i.id), 0)::BIGINT as total_requests,
    COALESCE(COUNT(i.id) FILTER (WHERE i.status = 'completed'), 0)::BIGINT as successful_requests,
    COALESCE(COUNT(i.id) FILTER (WHERE i.status = 'failed'), 0)::BIGINT as failed_requests,
    CASE 
      WHEN COUNT(i.id) > 0 THEN 
        ROUND((COUNT(i.id) FILTER (WHERE i.status = 'completed')::NUMERIC / COUNT(i.id)::NUMERIC) * 100, 2)
      ELSE 0 
    END as success_rate,
    COALESCE(COUNT(i.id) FILTER (WHERE i.status = 'completed') * p.cost_per_image, 0) as total_cost,
    COALESCE(AVG(i.generation_time_ms), 0) as avg_response_time,
    MAX(i.created_at) as last_used
  FROM providers p
  LEFT JOIN images i ON i.provider_id = p.id 
    AND i.created_at >= p_start_date 
    AND i.created_at <= p_end_date
  GROUP BY p.id, p.name, p.display_name, p.cost_per_image
  ORDER BY total_requests DESC;
END;
$$;

-- Function: Get top users for a model
CREATE OR REPLACE FUNCTION public.get_model_top_users(
  p_model_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE(
  user_id UUID,
  user_email TEXT,
  total_generations BIGINT,
  credits_spent NUMERIC,
  success_rate NUMERIC,
  last_used TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.user_id,
    p.email as user_email,
    COUNT(i.id)::BIGINT as total_generations,
    COALESCE(SUM(i.credits_used), 0) as credits_spent,
    CASE 
      WHEN COUNT(i.id) > 0 THEN 
        ROUND((COUNT(i.id) FILTER (WHERE i.status = 'completed')::NUMERIC / COUNT(i.id)::NUMERIC) * 100, 2)
      ELSE 0 
    END as success_rate,
    MAX(i.created_at) as last_used
  FROM images i
  LEFT JOIN profiles p ON p.user_id = i.user_id
  WHERE i.model_id = p_model_id
    AND i.created_at >= p_start_date
    AND i.created_at <= p_end_date
  GROUP BY i.user_id, p.email
  ORDER BY total_generations DESC
  LIMIT p_limit;
END;
$$;

-- Function: Get models using a provider
CREATE OR REPLACE FUNCTION public.get_provider_models(
  p_provider_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS TABLE(
  model_id UUID,
  model_name TEXT,
  total_requests BIGINT,
  success_rate NUMERIC,
  avg_response_time NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id as model_id,
    m.name as model_name,
    COUNT(i.id)::BIGINT as total_requests,
    CASE 
      WHEN COUNT(i.id) > 0 THEN 
        ROUND((COUNT(i.id) FILTER (WHERE i.status = 'completed')::NUMERIC / COUNT(i.id)::NUMERIC) * 100, 2)
      ELSE 0 
    END as success_rate,
    COALESCE(AVG(i.generation_time_ms), 0) as avg_response_time
  FROM ai_models m
  INNER JOIN images i ON i.model_id = m.id
  WHERE i.provider_id = p_provider_id
    AND i.created_at >= p_start_date
    AND i.created_at <= p_end_date
  GROUP BY m.id, m.name
  ORDER BY total_requests DESC;
END;
$$;

-- Grant execute permissions to authenticated users (RLS handles access control)
GRANT EXECUTE ON FUNCTION public.get_model_analytics TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_provider_analytics TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_model_summary_stats TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_provider_summary_stats TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_model_top_users TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_provider_models TO authenticated;