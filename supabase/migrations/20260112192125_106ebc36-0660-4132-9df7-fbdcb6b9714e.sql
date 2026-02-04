-- =============================================
-- PHASE 1: Bootstrap Owner Function
-- =============================================

-- Function to bootstrap the first super_admin owner
-- Can only be called once when no owner exists
CREATE OR REPLACE FUNCTION public.bootstrap_owner(_user_id uuid, _bootstrap_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expected_key text;
  v_owner_exists boolean;
  v_user_exists boolean;
BEGIN
  -- Check if bootstrap key matches (stored in vault or hardcoded for initial setup)
  -- For security, this should be changed after first use
  v_expected_key := 'LOVABLE_BOOTSTRAP_2024_SECURE_KEY';
  
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
  
  RETURN jsonb_build_object('success', true, 'message', 'Owner successfully bootstrapped');
END;
$$;

-- Function to check if system has been bootstrapped
CREATE OR REPLACE FUNCTION public.is_system_bootstrapped()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE is_owner = true
  )
$$;

-- =============================================
-- PHASE 2: Invite Token System
-- =============================================

-- Create admin_invites table
CREATE TABLE public.admin_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text UNIQUE NOT NULL,
  role app_role NOT NULL,
  created_by uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  used_by uuid,
  created_at timestamptz DEFAULT now() NOT NULL,
  
  -- Constraints
  CONSTRAINT valid_invite_role CHECK (role IN ('admin', 'moderator')),
  CONSTRAINT valid_expiry CHECK (expires_at > created_at)
);

-- Enable RLS
ALTER TABLE public.admin_invites ENABLE ROW LEVEL SECURITY;

-- RLS Policies for admin_invites
CREATE POLICY "Super admins can view all invites"
ON public.admin_invites
FOR SELECT
USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can create invites"
ON public.admin_invites
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can delete unused invites"
ON public.admin_invites
FOR DELETE
USING (has_role(auth.uid(), 'super_admin') AND used_at IS NULL);

-- Function to generate secure token
CREATE OR REPLACE FUNCTION public.generate_invite_token()
RETURNS text
LANGUAGE sql
AS $$
  SELECT encode(gen_random_bytes(32), 'hex')
$$;

-- Function to create an invite (called by super_admin)
CREATE OR REPLACE FUNCTION public.create_admin_invite(_role app_role, _expires_in_days integer DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
  v_invite_id uuid;
BEGIN
  -- Verify caller is super_admin
  IF NOT has_role(auth.uid(), 'super_admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Only super_admin can create invites');
  END IF;
  
  -- Cannot create super_admin invites
  IF _role = 'super_admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot create super_admin invites');
  END IF;
  
  -- Generate token
  v_token := generate_invite_token();
  
  -- Insert invite
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

-- Function to redeem an invite
CREATE OR REPLACE FUNCTION public.redeem_admin_invite(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite record;
  v_existing_role app_role;
BEGIN
  -- Must be authenticated
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Must be authenticated');
  END IF;
  
  -- Find the invite
  SELECT * INTO v_invite
  FROM public.admin_invites
  WHERE token = _token;
  
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
  SET used_at = now(), used_by = auth.uid()
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

-- =============================================
-- PHASE 3: Role Assignment Functions
-- =============================================

-- Function to assign role to user (super_admin only)
CREATE OR REPLACE FUNCTION public.assign_user_role(_target_user_id uuid, _role app_role)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_is_owner boolean;
  v_existing_role record;
BEGIN
  -- Verify caller is super_admin
  IF NOT has_role(auth.uid(), 'super_admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Only super_admin can assign roles');
  END IF;
  
  -- Cannot assign super_admin role through this function
  IF _role = 'super_admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot assign super_admin role');
  END IF;
  
  -- Check if target is owner
  SELECT is_owner INTO v_target_is_owner
  FROM public.user_roles
  WHERE user_id = _target_user_id AND is_owner = true;
  
  IF v_target_is_owner THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot modify owner role');
  END IF;
  
  -- Remove existing role
  DELETE FROM public.user_roles
  WHERE user_id = _target_user_id AND is_owner = false;
  
  -- Insert new role (unless it's 'user' which means no entry needed)
  IF _role != 'user' THEN
    INSERT INTO public.user_roles (user_id, role, created_by)
    VALUES (_target_user_id, _role, auth.uid());
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Role assigned successfully',
    'role', _role
  );
END;
$$;

-- Function to update account type (super_admin only)
CREATE OR REPLACE FUNCTION public.update_account_type(_target_user_id uuid, _account_type account_type)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller is super_admin
  IF NOT has_role(auth.uid(), 'super_admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Only super_admin can update account types');
  END IF;
  
  -- Update account type
  UPDATE public.profiles
  SET account_type = _account_type, updated_at = now()
  WHERE user_id = _target_user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Account type updated successfully',
    'account_type', _account_type
  );
END;
$$;

-- =============================================
-- PHASE 4: Audit Logging System
-- =============================================

-- Create audit log table
CREATE TABLE public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  action text NOT NULL,
  target_type text,
  target_id uuid,
  old_value jsonb,
  new_value jsonb,
  details jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS: Only admins and above can view logs
CREATE POLICY "Admins can view audit logs"
ON public.admin_audit_logs
FOR SELECT
USING (is_admin_or_above(auth.uid()));

-- RLS: System can insert logs (via security definer functions)
CREATE POLICY "System can insert audit logs"
ON public.admin_audit_logs
FOR INSERT
WITH CHECK (true);

-- Audit logs cannot be updated or deleted
-- No UPDATE or DELETE policies = immutable logs

-- Function to log admin actions
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
SET search_path = public
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

-- Trigger function for user_roles changes
CREATE OR REPLACE FUNCTION public.audit_user_roles_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.admin_audit_logs (actor_id, action, target_type, target_id, new_value)
    VALUES (
      COALESCE(NEW.created_by, NEW.user_id),
      'role_assigned',
      'user_roles',
      NEW.user_id,
      jsonb_build_object('role', NEW.role, 'is_owner', NEW.is_owner)
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.admin_audit_logs (actor_id, action, target_type, target_id, old_value, new_value)
    VALUES (
      auth.uid(),
      'role_updated',
      'user_roles',
      NEW.user_id,
      jsonb_build_object('role', OLD.role, 'is_owner', OLD.is_owner),
      jsonb_build_object('role', NEW.role, 'is_owner', NEW.is_owner)
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.admin_audit_logs (actor_id, action, target_type, target_id, old_value)
    VALUES (
      auth.uid(),
      'role_removed',
      'user_roles',
      OLD.user_id,
      jsonb_build_object('role', OLD.role, 'is_owner', OLD.is_owner)
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Create trigger for user_roles
CREATE TRIGGER audit_user_roles
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.audit_user_roles_changes();

-- Trigger function for ai_models changes
CREATE OR REPLACE FUNCTION public.audit_ai_models_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.admin_audit_logs (actor_id, action, target_type, target_id, new_value)
    VALUES (
      COALESCE(NEW.created_by, auth.uid()),
      'model_created',
      'ai_models',
      NEW.id,
      jsonb_build_object('name', NEW.name, 'model_id', NEW.model_id, 'status', NEW.status, 'access_level', NEW.access_level)
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.admin_audit_logs (actor_id, action, target_type, target_id, old_value, new_value)
    VALUES (
      auth.uid(),
      'model_updated',
      'ai_models',
      NEW.id,
      jsonb_build_object('name', OLD.name, 'status', OLD.status, 'access_level', OLD.access_level),
      jsonb_build_object('name', NEW.name, 'status', NEW.status, 'access_level', NEW.access_level)
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.admin_audit_logs (actor_id, action, target_type, target_id, old_value)
    VALUES (
      auth.uid(),
      'model_deleted',
      'ai_models',
      OLD.id,
      jsonb_build_object('name', OLD.name, 'model_id', OLD.model_id)
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Create trigger for ai_models
CREATE TRIGGER audit_ai_models
AFTER INSERT OR UPDATE OR DELETE ON public.ai_models
FOR EACH ROW EXECUTE FUNCTION public.audit_ai_models_changes();

-- Index for faster log queries
CREATE INDEX idx_audit_logs_actor ON public.admin_audit_logs(actor_id);
CREATE INDEX idx_audit_logs_action ON public.admin_audit_logs(action);
CREATE INDEX idx_audit_logs_target ON public.admin_audit_logs(target_type, target_id);
CREATE INDEX idx_audit_logs_created ON public.admin_audit_logs(created_at DESC);

-- Allow admins to view profiles for user management
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (is_admin_or_above(auth.uid()));

-- Super admins can update account_type on any profile
CREATE POLICY "Super admins can update account type"
ON public.profiles
FOR UPDATE
USING (has_role(auth.uid(), 'super_admin'))
WITH CHECK (has_role(auth.uid(), 'super_admin'));