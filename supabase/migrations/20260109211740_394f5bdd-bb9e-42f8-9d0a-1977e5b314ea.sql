-- Add DELETE policy for profiles table to comply with GDPR/CCPA data deletion requirements
CREATE POLICY "Users can delete their own profile"
ON public.profiles
FOR DELETE
USING (auth.uid() = user_id);

-- Update handle_new_user function with stricter content validation for display_name
-- This prevents potential HTML/script injection from OAuth metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  
  -- Sanitize display_name: 
  -- 1. Trim whitespace
  -- 2. Truncate to 100 chars
  -- 3. Remove HTML tags and script-like content
  -- 4. Remove control characters and null bytes
  -- 5. Only allow printable Unicode characters
  IF v_raw_name IS NOT NULL THEN
    v_display_name := TRIM(v_raw_name);
    -- Remove HTML-like tags (including script, style, etc.)
    v_display_name := regexp_replace(v_display_name, '<[^>]*>', '', 'g');
    -- Remove javascript: and data: URI schemes
    v_display_name := regexp_replace(v_display_name, '(javascript|data|vbscript):', '', 'gi');
    -- Remove control characters (except newlines/tabs which get trimmed)
    v_display_name := regexp_replace(v_display_name, '[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g');
    -- Remove null bytes explicitly
    v_display_name := replace(v_display_name, chr(0), '');
    -- Truncate to 100 characters
    v_display_name := SUBSTRING(v_display_name, 1, 100);
    -- Trim again after sanitization
    v_display_name := NULLIF(TRIM(v_display_name), '');
  END IF;
  
  -- Safely extract and validate avatar_url
  v_avatar_url := COALESCE(
    new.raw_user_meta_data ->> 'avatar_url', 
    new.raw_user_meta_data ->> 'picture'
  );
  
  IF v_avatar_url IS NOT NULL THEN
    v_avatar_url := TRIM(v_avatar_url);
    -- Validate URL: must start with https://, reasonable length, no dangerous characters
    -- Only allow https URLs from OAuth providers for security
    IF length(v_avatar_url) > 2048 
       OR NOT (v_avatar_url ~ '^https://[a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9](/[^\s<>"'']*)?$')
       OR v_avatar_url ~ '(javascript|data|vbscript):' THEN
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