-- Fix 1: Analytics functions - Add admin authorization checks

-- Fix get_model_top_users - Add admin check
CREATE OR REPLACE FUNCTION public.get_model_top_users(p_model_id uuid, p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_limit integer DEFAULT 10)
 RETURNS TABLE(user_id uuid, user_email text, total_generations bigint, credits_spent numeric, success_rate numeric, last_used timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Authorization check: Only admins can access user analytics
  IF NOT is_admin_or_above(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

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
$function$;

-- Fix get_model_analytics - Add admin check
CREATE OR REPLACE FUNCTION public.get_model_analytics(p_model_id uuid, p_start_date timestamp with time zone, p_end_date timestamp with time zone)
 RETURNS TABLE(date date, total_requests bigint, successful_requests bigint, failed_requests bigint, total_credits numeric, avg_response_time numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Authorization check: Only admins can access analytics
  IF NOT is_admin_or_above(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

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
$function$;

-- Fix get_provider_analytics - Add admin check
CREATE OR REPLACE FUNCTION public.get_provider_analytics(p_provider_id uuid, p_start_date timestamp with time zone, p_end_date timestamp with time zone)
 RETURNS TABLE(date date, total_requests bigint, successful_requests bigint, failed_requests bigint, avg_response_time numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Authorization check: Only admins can access analytics
  IF NOT is_admin_or_above(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

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
$function$;

-- Fix get_model_summary_stats - Add admin check
CREATE OR REPLACE FUNCTION public.get_model_summary_stats(p_start_date timestamp with time zone, p_end_date timestamp with time zone)
 RETURNS TABLE(model_id uuid, model_name text, total_requests bigint, successful_requests bigint, failed_requests bigint, success_rate numeric, total_credits numeric, avg_credits_per_gen numeric, avg_response_time numeric, last_used timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Authorization check: Only admins can access analytics
  IF NOT is_admin_or_above(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

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
$function$;

-- Fix get_provider_summary_stats - Add admin check
CREATE OR REPLACE FUNCTION public.get_provider_summary_stats(p_start_date timestamp with time zone, p_end_date timestamp with time zone)
 RETURNS TABLE(provider_id uuid, provider_name text, provider_display_name text, total_requests bigint, successful_requests bigint, failed_requests bigint, success_rate numeric, total_cost numeric, avg_response_time numeric, last_used timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Authorization check: Only admins can access analytics
  IF NOT is_admin_or_above(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

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
$function$;

-- Fix get_provider_models - Add admin check
CREATE OR REPLACE FUNCTION public.get_provider_models(p_provider_id uuid, p_start_date timestamp with time zone, p_end_date timestamp with time zone)
 RETURNS TABLE(model_id uuid, model_name text, total_requests bigint, success_rate numeric, avg_response_time numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Authorization check: Only admins can access analytics
  IF NOT is_admin_or_above(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

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
$function$;

-- Fix 2: Storage policies - Replace LIKE patterns with safe substring matching
-- Drop existing vulnerable policies
DROP POLICY IF EXISTS "Users can view their notification attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their invoice files" ON storage.objects;

-- Recreate with safe exact path matching using position/substring instead of LIKE
CREATE POLICY "Users can view their notification attachments" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'notification-attachments' 
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.user_id = auth.uid()
    AND n.attachment_url IS NOT NULL
    AND n.attachment_url = 'notification-attachments/' || name
  )
);

CREATE POLICY "Users can view their invoice files" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'invoice-files' 
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.user_id = auth.uid()
    AND i.file_url IS NOT NULL
    AND i.file_url = 'invoice-files/' || name
  )
);