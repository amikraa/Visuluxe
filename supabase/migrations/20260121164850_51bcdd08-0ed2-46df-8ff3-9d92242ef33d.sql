-- ============================================================
-- PROFILE RELIABILITY NOTICE
-- ============================================================
-- This migration does NOT create or manage auth.users triggers.
-- Profile creation is guaranteed by:
--   1. Client-side fallback (AuthContext.tsx)
--   2. Admin sync tools (sync_missing_profiles RPC)
--   3. Scheduled auto-healing (scheduled-profile-sync function)
-- ============================================================

-- Add documentation comment to handle_new_user() to clarify its role
COMMENT ON FUNCTION handle_new_user() IS 
  'BEST-EFFORT ONLY: This trigger function may not fire in all environments (e.g., Lovable Cloud). Profile creation is guaranteed by client-side fallback (AuthContext.tsx) and auto-healing (scheduled-profile-sync). DO NOT rely on this trigger for correctness.';