-- Fix hash_invite_token function to set search_path
CREATE OR REPLACE FUNCTION public.hash_invite_token(token text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, extensions
AS $$
  SELECT encode(extensions.digest(token, 'sha256'), 'hex')
$$;