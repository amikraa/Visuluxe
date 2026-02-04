-- Create missing database helper functions

-- 1. has_role function
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 2. is_owner function
CREATE OR REPLACE FUNCTION public.is_owner(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_admin' AND is_owner = true
  )
$$;

-- 3. is_admin_or_above function
CREATE OR REPLACE FUNCTION public.is_admin_or_above(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('super_admin', 'admin')
  )
$$;

-- 4. is_moderator_or_above function
CREATE OR REPLACE FUNCTION public.is_moderator_or_above(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('super_admin', 'admin', 'moderator')
  )
$$;

-- 5. get_user_role function
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT role FROM public.user_roles 
  WHERE user_id = _user_id
  ORDER BY CASE role 
    WHEN 'super_admin' THEN 1 
    WHEN 'admin' THEN 2 
    WHEN 'moderator' THEN 3
    WHEN 'support' THEN 4
    WHEN 'analyst' THEN 5
    WHEN 'user' THEN 6 
  END
  LIMIT 1
$$;

-- 6. get_account_type function
CREATE OR REPLACE FUNCTION public.get_account_type(_user_id uuid)
RETURNS public.account_type
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(account_type, 'normal'::public.account_type) 
  FROM public.profiles 
  WHERE user_id = _user_id 
  LIMIT 1
$$;

-- 7. is_system_bootstrapped function
CREATE OR REPLACE FUNCTION public.is_system_bootstrapped()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE is_owner = true)
$$;

-- 8. log_admin_action function
CREATE OR REPLACE FUNCTION public.log_admin_action(
  _action text,
  _target_type text DEFAULT NULL,
  _target_id uuid DEFAULT NULL,
  _old_value jsonb DEFAULT NULL,
  _new_value jsonb DEFAULT NULL,
  _details jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE 
  v_log_id uuid;
BEGIN
  INSERT INTO public.admin_audit_logs (actor_id, action, target_type, target_id, old_value, new_value, details)
  VALUES (auth.uid(), _action, _target_type, _target_id, _old_value, _new_value, _details)
  RETURNING id INTO v_log_id;
  RETURN v_log_id;
END;
$$;

-- 9. bootstrap_owner function (for initial admin setup)
CREATE OR REPLACE FUNCTION public.bootstrap_owner(_user_id uuid, _bootstrap_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_expected_key text;
  v_owner_exists boolean;
BEGIN
  -- Try to get key from vault
  BEGIN
    SELECT decrypted_secret INTO v_expected_key 
    FROM vault.decrypted_secrets 
    WHERE name = 'BOOTSTRAP_KEY' 
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_expected_key := NULL;
  END;
  
  IF v_expected_key IS NULL OR v_expected_key = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bootstrap key not configured');
  END IF;
  
  IF _bootstrap_key != v_expected_key THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid bootstrap key');
  END IF;
  
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE is_owner = true) INTO v_owner_exists;
  
  IF v_owner_exists THEN
    RETURN jsonb_build_object('success', false, 'error', 'Owner already exists');
  END IF;
  
  INSERT INTO public.user_roles (user_id, role, is_owner, created_by)
  VALUES (_user_id, 'super_admin', true, _user_id);
  
  RETURN jsonb_build_object('success', true, 'message', 'Owner bootstrapped successfully');
END;
$$;