-- Sync profiles for auth users that are missing profiles
INSERT INTO public.profiles (user_id, email, display_name, avatar_url)
SELECT 
  au.id as user_id,
  au.email,
  COALESCE(
    au.raw_user_meta_data ->> 'full_name',
    au.raw_user_meta_data ->> 'name',
    split_part(au.email, '@', 1)
  ) as display_name,
  COALESCE(
    au.raw_user_meta_data ->> 'avatar_url',
    au.raw_user_meta_data ->> 'picture'
  ) as avatar_url
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.user_id
WHERE p.user_id IS NULL;

-- Create user_credits for any profiles that don't have them
INSERT INTO public.user_credits (user_id, balance, daily_credits)
SELECT p.user_id, 0, 10
FROM public.profiles p
LEFT JOIN public.user_credits uc ON p.user_id = uc.user_id
WHERE uc.id IS NULL;

-- Update the handle_new_user trigger to be more resilient with ON CONFLICT
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_display_name text;
  v_avatar_url text;
  v_raw_name text;
BEGIN
  -- Safely extract raw name from OAuth metadata
  v_raw_name := COALESCE(
    new.raw_user_meta_data ->> 'full_name', 
    new.raw_user_meta_data ->> 'name'
  );
  
  -- Sanitize display_name
  IF v_raw_name IS NOT NULL THEN
    v_display_name := TRIM(v_raw_name);
    v_display_name := regexp_replace(v_display_name, '<[^>]*>', '', 'g');
    v_display_name := regexp_replace(v_display_name, '(javascript|data|vbscript):', '', 'gi');
    v_display_name := regexp_replace(v_display_name, '[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g');
    v_display_name := replace(v_display_name, chr(0), '');
    v_display_name := SUBSTRING(v_display_name, 1, 100);
    v_display_name := NULLIF(TRIM(v_display_name), '');
  END IF;
  
  -- Fallback to email prefix if no display name
  IF v_display_name IS NULL THEN
    v_display_name := split_part(new.email, '@', 1);
  END IF;
  
  -- Safely extract and validate avatar_url
  v_avatar_url := COALESCE(
    new.raw_user_meta_data ->> 'avatar_url', 
    new.raw_user_meta_data ->> 'picture'
  );
  
  IF v_avatar_url IS NOT NULL THEN
    v_avatar_url := TRIM(v_avatar_url);
    IF length(v_avatar_url) > 2048 
       OR NOT (v_avatar_url ~ '^https://[a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9](/[^\s<>"'']*)?$')
       OR v_avatar_url ~ '(javascript|data|vbscript):' THEN
      v_avatar_url := NULL;
    END IF;
  END IF;

  -- Insert profile with ON CONFLICT to handle edge cases
  INSERT INTO public.profiles (user_id, display_name, avatar_url, email)
  VALUES (new.id, v_display_name, v_avatar_url, new.email)
  ON CONFLICT (user_id) DO UPDATE SET
    display_name = COALESCE(EXCLUDED.display_name, profiles.display_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    email = COALESCE(EXCLUDED.email, profiles.email),
    updated_at = now();
    
  RETURN new;
EXCEPTION
  WHEN others THEN
    RAISE WARNING 'Failed to create profile for user %: %', new.id, SQLERRM;
    RETURN new;
END;
$function$;