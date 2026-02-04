-- Fix views to use SECURITY INVOKER instead of SECURITY DEFINER
-- This ensures the views respect RLS policies of the querying user

-- Drop and recreate announcements_public view with SECURITY INVOKER
DROP VIEW IF EXISTS public.announcements_public;
CREATE VIEW public.announcements_public 
WITH (security_invoker = true)
AS
SELECT 
  id,
  title,
  message,
  type,
  starts_at,
  ends_at,
  is_active,
  created_at
FROM public.announcements
WHERE is_active = true 
  AND (starts_at IS NULL OR starts_at <= now()) 
  AND (ends_at IS NULL OR ends_at > now());

-- Drop and recreate feature_flags_public view with SECURITY INVOKER
DROP VIEW IF EXISTS public.feature_flags_public;
CREATE VIEW public.feature_flags_public
WITH (security_invoker = true)
AS
SELECT 
  id,
  name,
  description,
  is_enabled
FROM public.feature_flags
WHERE is_enabled = true;

-- Grant SELECT on views to authenticated and anon roles
GRANT SELECT ON public.announcements_public TO authenticated, anon;
GRANT SELECT ON public.feature_flags_public TO authenticated, anon;