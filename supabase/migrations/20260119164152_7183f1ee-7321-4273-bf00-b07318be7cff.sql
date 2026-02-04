-- Add token_hash column and token_prefix for admin_invites
ALTER TABLE public.admin_invites 
ADD COLUMN IF NOT EXISTS token_hash text,
ADD COLUMN IF NOT EXISTS token_prefix text;

-- Create hash function for invite tokens (using SHA-256)
CREATE OR REPLACE FUNCTION public.hash_invite_token(token text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT encode(extensions.digest(token, 'sha256'), 'hex')
$$;

-- Update create_admin_invite to store hashed tokens
CREATE OR REPLACE FUNCTION public.create_admin_invite(
  _role app_role,
  _expires_in_days integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
  v_token_hash text;
  v_token_prefix text;
  v_invite_id uuid;
BEGIN
  -- SECURITY: Only Owner can create invites (not all super_admins)
  IF NOT is_owner(auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Only the Owner can create invites');
  END IF;
  
  -- Generate secure token
  v_token := generate_invite_token();
  
  -- Hash the token for storage
  v_token_hash := hash_invite_token(v_token);
  
  -- Store first 8 chars as prefix for identification
  v_token_prefix := left(v_token, 8);
  
  -- Insert invite record with hashed token
  INSERT INTO public.admin_invites (token, token_hash, token_prefix, role, created_by, expires_at)
  VALUES (v_token, v_token_hash, v_token_prefix, _role, auth.uid(), now() + (_expires_in_days || ' days')::interval)
  RETURNING id INTO v_invite_id;
  
  -- Return the plaintext token only once (for display to owner)
  RETURN jsonb_build_object(
    'success', true,
    'invite_id', v_invite_id,
    'token', v_token,
    'role', _role,
    'expires_at', now() + (_expires_in_days || ' days')::interval
  );
END;
$$;

-- Update validate_invite_token to use hashed comparison
CREATE OR REPLACE FUNCTION public.validate_invite_token(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite record;
  v_token_hash text;
BEGIN
  -- Hash the provided token
  v_token_hash := hash_invite_token(_token);
  
  -- First try to find by hash (new tokens)
  SELECT role, expires_at, used_at INTO v_invite
  FROM public.admin_invites
  WHERE token_hash = v_token_hash;
  
  -- Fallback to plaintext comparison for legacy tokens
  IF v_invite IS NULL THEN
    SELECT role, expires_at, used_at INTO v_invite
    FROM public.admin_invites
    WHERE token = _token AND token_hash IS NULL;
  END IF;
  
  IF v_invite IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid invite token');
  END IF;
  
  IF v_invite.used_at IS NOT NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This invite has already been used');
  END IF;
  
  IF v_invite.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This invite has expired');
  END IF;
  
  RETURN jsonb_build_object(
    'valid', true,
    'role', v_invite.role,
    'expires_at', v_invite.expires_at
  );
END;
$$;

-- Update redeem_admin_invite to use hashed comparison
CREATE OR REPLACE FUNCTION public.redeem_admin_invite(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite record;
  v_existing_role app_role;
  v_token_hash text;
BEGIN
  -- Must be authenticated
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Must be authenticated');
  END IF;
  
  -- Hash the provided token
  v_token_hash := hash_invite_token(_token);
  
  -- First try to find by hash (new tokens)
  SELECT * INTO v_invite
  FROM public.admin_invites
  WHERE token_hash = v_token_hash;
  
  -- Fallback to plaintext comparison for legacy tokens
  IF v_invite IS NULL THEN
    SELECT * INTO v_invite
    FROM public.admin_invites
    WHERE token = _token AND token_hash IS NULL;
  END IF;
  
  IF v_invite IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid invite token');
  END IF;
  
  -- Check if already used
  IF v_invite.used_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invite has already been used');
  END IF;
  
  -- Check if expired
  IF v_invite.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invite has expired');
  END IF;
  
  -- Check if user already has this or higher role
  SELECT role INTO v_existing_role
  FROM public.user_roles
  WHERE user_id = auth.uid()
  ORDER BY 
    CASE role
      WHEN 'super_admin' THEN 1
      WHEN 'admin' THEN 2
      WHEN 'moderator' THEN 3
      WHEN 'user' THEN 4
    END
  LIMIT 1;
  
  IF v_existing_role IN ('super_admin', 'admin') AND v_invite.role = 'moderator' THEN
    RETURN jsonb_build_object('success', false, 'error', 'You already have a higher role');
  END IF;
  
  IF v_existing_role = v_invite.role THEN
    RETURN jsonb_build_object('success', false, 'error', 'You already have this role');
  END IF;
  
  -- Mark invite as used and clear plaintext token for security
  UPDATE public.admin_invites
  SET used_at = now(), used_by = auth.uid(), token = 'REDEEMED'
  WHERE id = v_invite.id;
  
  -- Remove existing role if any (except owner)
  DELETE FROM public.user_roles
  WHERE user_id = auth.uid() AND is_owner = false;
  
  -- Insert new role
  INSERT INTO public.user_roles (user_id, role, created_by)
  VALUES (auth.uid(), v_invite.role, v_invite.created_by);
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Role assigned successfully',
    'role', v_invite.role
  );
END;
$$;

-- Migrate existing unused tokens: hash them and clear plaintext
UPDATE public.admin_invites
SET 
  token_hash = hash_invite_token(token),
  token_prefix = left(token, 8),
  token = 'MIGRATED'
WHERE used_at IS NULL AND token_hash IS NULL AND token != 'REDEEMED' AND token != 'MIGRATED';