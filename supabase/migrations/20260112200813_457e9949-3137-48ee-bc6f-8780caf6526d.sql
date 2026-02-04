-- Update assign_user_role to allow owner to create super_admins (but not modify owner)
CREATE OR REPLACE FUNCTION public.assign_user_role(_target_user_id uuid, _role app_role)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_target_is_owner boolean;
  v_caller_is_owner boolean;
  v_existing_role record;
BEGIN
  -- Verify caller is super_admin
  IF NOT has_role(auth.uid(), 'super_admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Only super_admin can assign roles');
  END IF;
  
  -- Check if caller is the owner
  SELECT is_owner INTO v_caller_is_owner
  FROM public.user_roles
  WHERE user_id = auth.uid() AND is_owner = true;
  
  v_caller_is_owner := COALESCE(v_caller_is_owner, false);
  
  -- Only the owner can assign super_admin role
  IF _role = 'super_admin' AND NOT v_caller_is_owner THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the system owner can create super_admins');
  END IF;
  
  -- Check if target is the owner (is_owner = true)
  SELECT is_owner INTO v_target_is_owner
  FROM public.user_roles
  WHERE user_id = _target_user_id AND is_owner = true;
  
  IF v_target_is_owner THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot modify the system owner role');
  END IF;
  
  -- Non-owner super_admins cannot modify other super_admins
  IF NOT v_caller_is_owner THEN
    IF EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = _target_user_id AND role = 'super_admin'
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Only the owner can modify super_admin roles');
    END IF;
  END IF;
  
  -- Remove existing role
  DELETE FROM public.user_roles
  WHERE user_id = _target_user_id AND is_owner = false;
  
  -- Insert new role (unless it's 'user' which means no entry needed)
  IF _role != 'user' THEN
    INSERT INTO public.user_roles (user_id, role, is_owner, created_by)
    VALUES (_target_user_id, _role, false, auth.uid());
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Role assigned successfully',
    'role', _role
  );
END;
$function$;

-- Also update RLS policy to allow non-owner super_admins to view roles
-- (already exists, just ensuring it's correct)