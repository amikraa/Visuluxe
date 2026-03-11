-- Create function to get jobs with details for admin panel

CREATE OR REPLACE FUNCTION get_jobs_with_details(
    p_status TEXT DEFAULT NULL,
    p_priority INTEGER DEFAULT NULL,
    p_search TEXT DEFAULT NULL
)
RETURNS TABLE(
    id UUID,
    job_id TEXT,
    user_id UUID,
    username TEXT,
    status TEXT,
    prompt TEXT,
    negative_prompt TEXT,
    model_name TEXT,
    model_id UUID,
    provider_name TEXT,
    provider_id TEXT,
    credits_used INTEGER,
    account_type TEXT,
    priority INTEGER,
    created_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error TEXT,
    processing_time_ms INTEGER,
    image_url TEXT,
    signed_urls TEXT[],
    r2_keys TEXT[]
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT 
        gj.id,
        gj.job_id,
        gj.user_id,
        p.username,
        gj.status,
        gj.prompt,
        gj.negative_prompt,
        gj.model_name,
        gj.model_id,
        gj.provider_name,
        gj.provider_id,
        gj.credits_used,
        gj.account_type,
        gj.priority,
        gj.created_at,
        gj.started_at,
        gj.completed_at,
        gj.error,
        gj.processing_time_ms,
        gj.image_url,
        gj.signed_urls,
        gj.r2_keys
    FROM generation_jobs gj
    LEFT JOIN profiles p ON gj.user_id = p.user_id
    WHERE (p_status IS NULL OR gj.status = p_status)
    AND (p_priority IS NULL OR gj.priority = p_priority)
    AND (p_search IS NULL OR (
        gj.job_id ILIKE '%' || p_search || '%'
        OR gj.prompt ILIKE '%' || p_search || '%'
        OR p.username ILIKE '%' || p_search || '%'
        OR gj.model_name ILIKE '%' || p_search || '%'
    ))
    ORDER BY gj.created_at DESC;
$$;

-- Grant permissions for the function
GRANT EXECUTE ON FUNCTION get_jobs_with_details(TEXT, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_jobs_with_details(TEXT, INTEGER, TEXT) TO service_role;