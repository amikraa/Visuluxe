-- Update create_admin_invite function to allow super_admin invites (Owner only)
CREATE OR REPLACE FUNCTION public.create_admin_invite(_role app_role, _expires_in_days integer DEFAULT 7)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_token text;
  v_invite_id uuid;
BEGIN
  -- SECURITY: Only Owner can create invites (not all super_admins)
  IF NOT is_owner(auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Only the Owner can create invites');
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
$function$;