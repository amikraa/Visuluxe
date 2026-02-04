-- Remove public access from announcements table (use announcements_public view instead)
DROP POLICY IF EXISTS "Anyone can view active announcements public fields" ON public.announcements;

-- Remove public access from feature_flags table (use feature_flags_public view instead)  
DROP POLICY IF EXISTS "Anyone can view enabled flags basic info" ON public.feature_flags;

-- Add authenticated-only policy for feature_flags (admins already have ALL access)
-- This allows authenticated users to see enabled flags via the base table if needed
CREATE POLICY "Authenticated users can view enabled flags"
ON public.feature_flags
FOR SELECT
USING (is_enabled = true AND auth.uid() IS NOT NULL);

-- Grant access to the public views for anonymous and authenticated users
GRANT SELECT ON public.announcements_public TO anon, authenticated;
GRANT SELECT ON public.feature_flags_public TO anon, authenticated;