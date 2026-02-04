-- ============================================================
-- PROFILE RELIABILITY NOTICE
-- ============================================================
-- This migration does NOT create or manage auth.users triggers.
-- Profile creation is guaranteed by:
--   1. Client-side fallback (AuthContext.tsx)
--   2. Admin sync tools (sync_missing_profiles RPC)
--   3. Scheduled auto-healing (scheduled-profile-sync function)
-- ============================================================

-- Create a function that allows any authenticated user to log profile fallback events
-- This bypasses RLS via SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.log_profile_fallback_event(
  _action text,
  _target_id uuid,
  _details jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only allow specific profile-related actions
  IF _action NOT IN ('profile_created_via_fallback', 'profile_creation_failed') THEN
    RAISE EXCEPTION 'Invalid action for profile fallback logging';
  END IF;
  
  -- Insert the audit log entry
  INSERT INTO public.admin_audit_logs (actor_id, action, target_type, target_id, details)
  VALUES (auth.uid(), _action, 'profiles', _target_id, _details);
END;
$$;

-- Document the function
COMMENT ON FUNCTION log_profile_fallback_event(text, uuid, jsonb) IS 
  'PROFILE FALLBACK LOGGING: Allows any authenticated user to log profile creation fallback events. '
  'Only accepts profile_created_via_fallback and profile_creation_failed actions. '
  'This ensures observability of the client-side fallback mechanism.';