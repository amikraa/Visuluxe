-- ============================================================
-- PROFILE RELIABILITY NOTICE
-- ============================================================
-- This migration does NOT create or manage auth.users triggers.
-- Profile creation is guaranteed by:
--   1. Client-side fallback (AuthContext.tsx)
--   2. Admin sync tools (sync_missing_profiles RPC)
--   3. Scheduled auto-healing (scheduled-profile-sync function)
-- ============================================================

-- RPC for scheduled job (no auth check - called by service role)
CREATE OR REPLACE FUNCTION public.sync_missing_profiles_system()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  -- This function is for system use only (service role)
  -- No auth check - caller must use service role key
  
  INSERT INTO public.profiles (user_id, email, display_name, avatar_url)
  SELECT 
    au.id,
    au.email,
    COALESCE(
      au.raw_user_meta_data ->> 'full_name',
      au.raw_user_meta_data ->> 'name',
      split_part(au.email, '@', 1)
    ),
    CASE 
      WHEN (au.raw_user_meta_data ->> 'avatar_url') ~ '^https://'
      THEN au.raw_user_meta_data ->> 'avatar_url'
      WHEN (au.raw_user_meta_data ->> 'picture') ~ '^https://'
      THEN au.raw_user_meta_data ->> 'picture'
      ELSE NULL
    END
  FROM auth.users au
  LEFT JOIN public.profiles p ON au.id = p.user_id
  WHERE p.user_id IS NULL
  ON CONFLICT (user_id) DO NOTHING;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  -- Also sync user_credits
  INSERT INTO public.user_credits (user_id, balance, daily_credits)
  SELECT p.user_id, 0, 10
  FROM public.profiles p
  LEFT JOIN public.user_credits uc ON p.user_id = uc.user_id
  WHERE uc.id IS NULL
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN v_count;
END;
$$;

-- Add documentation comments
COMMENT ON FUNCTION get_orphaned_user_count() IS 
  'ADMIN RECOVERY ONLY: Counts auth.users without matching profiles. DO NOT use auth.users for business logic.';

COMMENT ON FUNCTION sync_missing_profiles() IS 
  'ADMIN RECOVERY ONLY: Creates missing profile records from auth.users. Primary profile creation happens via client fallback.';

COMMENT ON FUNCTION sync_missing_profiles_system() IS 
  'SYSTEM USE ONLY: Called by scheduled job for auto-healing. Uses service role key - no auth check.';