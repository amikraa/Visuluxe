-- SECURITY HARDENING MIGRATION
-- 1. Drop vulnerable RLS policies that expose all invite tokens
DROP POLICY IF EXISTS "Users can view invites by token" ON public.admin_invites;
DROP POLICY IF EXISTS "Anyone can validate invites by token" ON public.admin_invites;

-- 2. Create secure validation function that only returns info for exact token provided
CREATE OR REPLACE FUNCTION public.validate_invite_token(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite record;
BEGIN
  SELECT role, expires_at, used_at INTO v_invite
  FROM public.admin_invites
  WHERE token = _token;
  
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

-- Grant execute to both anon and authenticated users for validation
GRANT EXECUTE ON FUNCTION public.validate_invite_token(text) TO anon, authenticated;

-- 3. Invalidate all existing unused invite tokens (they are compromised)
DELETE FROM public.admin_invites WHERE used_at IS NULL;

-- 4. Add audit log immutability policies
CREATE POLICY "No updates allowed on audit logs"
ON public.admin_audit_logs FOR UPDATE
TO authenticated USING (false);

CREATE POLICY "No deletes allowed on audit logs"
ON public.admin_audit_logs FOR DELETE
TO authenticated USING (false);