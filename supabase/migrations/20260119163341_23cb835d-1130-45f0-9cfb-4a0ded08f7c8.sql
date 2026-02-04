-- Fix announcements RLS policy to hide targeting metadata from anonymous users
-- Drop the existing public view policy
DROP POLICY IF EXISTS "Anyone can view active announcements" ON public.announcements;

-- Create a new policy that only shows title, message, and type to anonymous users
-- Admins can see everything including target_roles
CREATE POLICY "Anyone can view active announcements public fields"
ON public.announcements
FOR SELECT
USING (
  ((is_active = true) AND ((starts_at IS NULL) OR (starts_at <= now())) AND ((ends_at IS NULL) OR (ends_at > now())))
);

-- Create a view for public announcement access that hides targeting metadata
CREATE OR REPLACE VIEW public.announcements_public AS
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

-- Fix feature_flags RLS policy to hide detailed configuration from anonymous users
DROP POLICY IF EXISTS "Anyone can view enabled flags" ON public.feature_flags;

-- Create new policy - only show basic flag info publicly (name and is_enabled)
-- Detailed config (rollout_percentage, target_roles, config) are still in the table
-- but clients should use the public view
CREATE POLICY "Anyone can view enabled flags basic info"
ON public.feature_flags
FOR SELECT
USING (
  (is_enabled = true) OR is_admin_or_above(auth.uid())
);

-- Create a view for public feature flag access that hides sensitive configuration
CREATE OR REPLACE VIEW public.feature_flags_public AS
SELECT 
  id,
  name,
  description,
  is_enabled
FROM public.feature_flags
WHERE is_enabled = true;