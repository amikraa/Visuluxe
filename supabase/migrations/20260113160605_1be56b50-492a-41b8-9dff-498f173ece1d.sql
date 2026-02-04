
-- Add email column to profiles table for admin visibility
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

-- Update the handle_new_user function to also capture email
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

  INSERT INTO public.profiles (user_id, display_name, avatar_url, email)
  VALUES (
    new.id,
    v_display_name,
    v_avatar_url,
    new.email
  );
  RETURN new;
EXCEPTION
  WHEN others THEN
    RAISE WARNING 'Failed to create profile for user %: %', new.id, SQLERRM;
    RETURN new;
END;
$function$;
