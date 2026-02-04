-- Fix: Admin invite tokens should not store plaintext after creation
-- Update create_admin_invite to immediately clear the plaintext token after returning it

CREATE OR REPLACE FUNCTION public.create_admin_invite(_role app_role, _expires_in_days integer DEFAULT 1)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  
  -- Insert invite record with ONLY the hash (not the plaintext token)
  -- The token column stores 'PENDING' as placeholder to satisfy NOT NULL constraint
  INSERT INTO public.admin_invites (token, token_hash, token_prefix, role, created_by, expires_at)
  VALUES ('PENDING', v_token_hash, v_token_prefix, _role, auth.uid(), now() + (_expires_in_days || ' days')::interval)
  RETURNING id INTO v_invite_id;
  
  -- Immediately clear the token column to prevent exposure
  UPDATE public.admin_invites 
  SET token = 'REDACTED'
  WHERE id = v_invite_id;
  
  -- Return the plaintext token only once (for display to owner)
  -- After this response, the plaintext is never stored or retrievable
  RETURN jsonb_build_object(
    'success', true,
    'invite_id', v_invite_id,
    'token', v_token,
    'role', _role,
    'expires_at', now() + (_expires_in_days || ' days')::interval
  );
END;
$function$;

-- Also update redeem_admin_invite to handle the new 'REDACTED' and 'PENDING' states
CREATE OR REPLACE FUNCTION public.redeem_admin_invite(_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  
  -- Find invite by hash only (not by plaintext token anymore)
  SELECT * INTO v_invite
  FROM public.admin_invites
  WHERE token_hash = v_token_hash;
  
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
  
  -- Mark invite as used
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
$function$;

-- Update validate_invite_token to only use hash lookup
CREATE OR REPLACE FUNCTION public.validate_invite_token(_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_invite record;
  v_token_hash text;
BEGIN
  -- Hash the provided token
  v_token_hash := hash_invite_token(_token);
  
  -- Find invite by hash only
  SELECT role, expires_at, used_at INTO v_invite
  FROM public.admin_invites
  WHERE token_hash = v_token_hash;
  
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
$function$;

-- Clean up any existing plaintext tokens that are not already marked as REDEEMED/REDACTED
-- This one-time migration redacts all existing unused plaintext tokens
UPDATE public.admin_invites
SET token = 'REDACTED'
WHERE token NOT IN ('REDEEMED', 'REDACTED', 'MIGRATED', 'PENDING')
  AND token_hash IS NOT NULL
  AND used_at IS NULL;