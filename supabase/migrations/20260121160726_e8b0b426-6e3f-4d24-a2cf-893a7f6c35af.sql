-- Since we can't modify auth.users trigger, we'll rely on:
-- 1. Client-side fallback (primary defense)
-- 2. Admin sync functions (manual cleanup)

-- Task 2: Sync currently missing profiles (one-time fix)
INSERT INTO public.profiles (user_id, email, display_name, avatar_url)
SELECT 
  au.id as user_id,
  au.email,
  COALESCE(
    au.raw_user_meta_data ->> 'full_name',
    au.raw_user_meta_data ->> 'name',
    split_part(au.email, '@', 1)
  ) as display_name,
  CASE 
    WHEN (au.raw_user_meta_data ->> 'avatar_url') ~ '^https://[a-zA-Z0-9]' 
    THEN au.raw_user_meta_data ->> 'avatar_url'
    WHEN (au.raw_user_meta_data ->> 'picture') ~ '^https://[a-zA-Z0-9]'
    THEN au.raw_user_meta_data ->> 'picture'
    ELSE NULL
  END as avatar_url
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.user_id
WHERE p.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- Ensure user_credits exist for all profiles
INSERT INTO public.user_credits (user_id, balance, daily_credits)
SELECT p.user_id, 0, 10
FROM public.profiles p
LEFT JOIN public.user_credits uc ON p.user_id = uc.user_id
WHERE uc.id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- Task 5: RPC function to count orphaned users
CREATE OR REPLACE FUNCTION public.get_orphaned_user_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COUNT(*)::integer
  FROM auth.users au
  LEFT JOIN public.profiles p ON au.id = p.user_id
  WHERE p.user_id IS NULL;
$$;

-- Task 5: RPC function to sync missing profiles (admin action)
CREATE OR REPLACE FUNCTION public.sync_missing_profiles()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Only admins can call this
  IF NOT is_admin_or_above(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  
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
  
  -- Also sync user_credits for any new profiles
  INSERT INTO public.user_credits (user_id, balance, daily_credits)
  SELECT p.user_id, 0, 10
  FROM public.profiles p
  LEFT JOIN public.user_credits uc ON p.user_id = uc.user_id
  WHERE uc.id IS NULL
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Log the sync action
  IF v_count > 0 THEN
    INSERT INTO admin_audit_logs (actor_id, action, target_type, details)
    VALUES (auth.uid(), 'profiles_synced', 'profiles', 
      jsonb_build_object('synced_count', v_count));
  END IF;
  
  RETURN v_count;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_orphaned_user_count() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_missing_profiles() TO authenticated;