-- Security Correction: Owner-Only Invite System
-- Only the Owner (is_owner = true) can create, view, and delete invites

-- First, drop the existing super_admin policies
DROP POLICY IF EXISTS "Super admins can create invites" ON public.admin_invites;
DROP POLICY IF EXISTS "Super admins can delete unused invites" ON public.admin_invites;
DROP POLICY IF EXISTS "Super admins can view all invites" ON public.admin_invites;

-- Create new Owner-only policies
CREATE POLICY "Owner can create invites"
ON public.admin_invites
FOR INSERT
TO authenticated
WITH CHECK (is_owner(auth.uid()));

CREATE POLICY "Owner can delete unused invites"
ON public.admin_invites
FOR DELETE
TO authenticated
USING (is_owner(auth.uid()) AND used_at IS NULL);

CREATE POLICY "Owner can view all invites"
ON public.admin_invites
FOR SELECT
TO authenticated
USING (is_owner(auth.uid()));

-- Update the create_admin_invite function to check is_owner instead of has_role
CREATE OR REPLACE FUNCTION public.create_admin_invite(_role app_role, _expires_in_days integer DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_token text;
  v_invite_id uuid;
BEGIN
  -- SECURITY: Only Owner can create invites (not all super_admins)
  IF NOT is_owner(auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Only the Owner can create invites');
  END IF;
  
  -- Cannot create super_admin invites
  IF _role = 'super_admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot create super_admin invites');
  END IF;
  
  -- Generate secure token
  v_token := generate_invite_token();
  
  -- Insert invite record
  INSERT INTO public.admin_invites (token, role, created_by, expires_at)
  VALUES (v_token, _role, auth.uid(), now() + (_expires_in_days || ' days')::interval)
  RETURNING id INTO v_invite_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'invite_id', v_invite_id,
    'token', v_token,
    'role', _role,
    'expires_at', now() + (_expires_in_days || ' days')::interval
  );
END;
$$;