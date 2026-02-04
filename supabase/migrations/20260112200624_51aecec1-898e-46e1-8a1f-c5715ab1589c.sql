-- Update bootstrap_owner function to use environment secret instead of hardcoded key
CREATE OR REPLACE FUNCTION public.bootstrap_owner(_user_id uuid, _bootstrap_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_expected_key text;
  v_owner_exists boolean;
  v_user_exists boolean;
BEGIN
  -- Get bootstrap key from environment variable (set via Supabase secrets)
  v_expected_key := current_setting('app.settings.bootstrap_key', true);
  
  -- If not set via app.settings, try to get from vault
  IF v_expected_key IS NULL OR v_expected_key = '' THEN
    -- Check vault (if available)
    BEGIN
      SELECT decrypted_secret INTO v_expected_key 
      FROM vault.decrypted_secrets 
      WHERE name = 'BOOTSTRAP_KEY'
      LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
      -- Vault not available or secret not found
      NULL;
    END;
  END IF;
  
  -- If still no key configured, return error
  IF v_expected_key IS NULL OR v_expected_key = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bootstrap key not configured on server');
  END IF;
  
  IF _bootstrap_key != v_expected_key THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid bootstrap key');
  END IF;
  
  -- Check if an owner already exists
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE is_owner = true
  ) INTO v_owner_exists;
  
  IF v_owner_exists THEN
    RETURN jsonb_build_object('success', false, 'error', 'Owner already exists. Bootstrap can only be run once.');
  END IF;
  
  -- Check if user exists in profiles
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE user_id = _user_id
  ) INTO v_user_exists;
  
  IF NOT v_user_exists THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;
  
  -- Insert the owner role
  INSERT INTO public.user_roles (user_id, role, is_owner, created_by)
  VALUES (_user_id, 'super_admin', true, _user_id);
  
  -- Log bootstrap attempt for security auditing
  INSERT INTO public.admin_audit_logs (actor_id, action, target_type, target_id, details)
  VALUES (_user_id, 'system_bootstrapped', 'system', _user_id, jsonb_build_object('event', 'owner_designated'));
  
  RETURN jsonb_build_object('success', true, 'message', 'Owner successfully bootstrapped');
END;
$function$;