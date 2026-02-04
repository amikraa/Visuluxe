-- Add database-level constraints for profile validation
-- Username: 3-30 chars, alphanumeric + underscore/dash only
ALTER TABLE public.profiles 
ADD CONSTRAINT username_length 
CHECK (username IS NULL OR (length(username) >= 3 AND length(username) <= 30));

ALTER TABLE public.profiles 
ADD CONSTRAINT username_format 
CHECK (username IS NULL OR username ~ '^[a-zA-Z0-9_-]+$');

-- Display name: max 100 chars
ALTER TABLE public.profiles 
ADD CONSTRAINT display_name_length 
CHECK (display_name IS NULL OR length(display_name) <= 100);

-- Avatar URL: max 2048 chars (standard URL length limit)
ALTER TABLE public.profiles 
ADD CONSTRAINT avatar_url_length 
CHECK (avatar_url IS NULL OR length(avatar_url) <= 2048);

-- Update handle_new_user function to validate OAuth metadata with length limits
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = 'public'
AS $$
DECLARE
  v_display_name text;
  v_avatar_url text;
BEGIN
  -- Safely extract and truncate display_name (max 100 chars)
  v_display_name := NULLIF(TRIM(SUBSTRING(
    COALESCE(
      new.raw_user_meta_data ->> 'full_name', 
      new.raw_user_meta_data ->> 'name'
    ), 1, 100
  )), '');
  
  -- Safely extract and truncate avatar_url (max 2048 chars)
  -- Also validate it looks like a URL (starts with http:// or https://)
  v_avatar_url := COALESCE(
    new.raw_user_meta_data ->> 'avatar_url', 
    new.raw_user_meta_data ->> 'picture'
  );
  
  IF v_avatar_url IS NOT NULL THEN
    v_avatar_url := TRIM(v_avatar_url);
    -- Validate URL format and length
    IF length(v_avatar_url) > 2048 OR NOT (v_avatar_url ~ '^https?://') THEN
      v_avatar_url := NULL;
    END IF;
  END IF;

  INSERT INTO public.profiles (user_id, display_name, avatar_url)
  VALUES (
    new.id,
    v_display_name,
    v_avatar_url
  );
  RETURN new;
EXCEPTION
  WHEN others THEN
    -- Log error but don't fail user creation
    RAISE WARNING 'Failed to create profile for user %: %', new.id, SQLERRM;
    RETURN new;
END;
$$;