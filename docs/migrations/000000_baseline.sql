-- ============================================================
-- BASELINE MIGRATION: Complete Schema Recreation
-- Generated: 2026-01-22
-- Target: Fresh Supabase/Postgres Database
-- Version: 1.0.0
-- ============================================================
--
-- This migration recreates the COMPLETE database schema from scratch.
-- Run this on a fresh Supabase project to get an identical schema.
--
-- ============================================================
-- ⚠️ WARNINGS: Objects Requiring Manual Configuration
-- ============================================================
--
-- 1. STORAGE BUCKETS (create via Dashboard or Storage API):
--    - avatars (private)
--    - notification-attachments (private)
--    - invoice-files (private)
--
-- 2. AUTH TRIGGER (run via Dashboard SQL Editor ONLY):
--    CREATE TRIGGER on_auth_user_created
--      AFTER INSERT ON auth.users
--      FOR EACH ROW
--      EXECUTE FUNCTION public.handle_new_user();
--
-- 3. SECRETS (configure via Supabase Secrets):
--    - BOOTSTRAP_KEY (required for system bootstrap)
--    - ENCRYPTION_KEY (required for provider API key encryption)
--
-- 4. AUTH SETTINGS (configure via Dashboard):
--    - Enable desired auth providers (Email, Google OAuth, etc.)
--    - Configure auto-confirm email if needed
--
-- ============================================================


-- ============================================================
-- SECTION 1: Extensions
-- ============================================================
-- Note: These are typically pre-installed in Supabase in the 'extensions' schema.
-- Included here for completeness.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;


-- ============================================================
-- SECTION 2: Custom ENUM Types
-- ============================================================

-- account_type
DO $$ BEGIN
  CREATE TYPE public.account_type AS ENUM ('normal', 'partner');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- announcement_type
DO $$ BEGIN
  CREATE TYPE public.announcement_type AS ENUM ('info', 'warning', 'error', 'success', 'maintenance');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- api_key_status
DO $$ BEGIN
  CREATE TYPE public.api_key_status AS ENUM ('active', 'suspended', 'expired', 'revoked', 'rate_limited');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- app_role
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'moderator', 'user', 'support', 'analyst');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- block_reason
DO $$ BEGIN
  CREATE TYPE public.block_reason AS ENUM ('abuse', 'spam', 'ddos', 'vpn', 'proxy', 'manual', 'country');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- credit_transaction_type
DO $$ BEGIN
  CREATE TYPE public.credit_transaction_type AS ENUM ('add', 'deduct', 'refund', 'expire', 'daily_reset', 'generation');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- image_status
DO $$ BEGIN
  CREATE TYPE public.image_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- model_access_level
DO $$ BEGIN
  CREATE TYPE public.model_access_level AS ENUM ('public', 'partner_only', 'admin_only');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- model_status
DO $$ BEGIN
  CREATE TYPE public.model_status AS ENUM ('active', 'beta', 'disabled', 'offline');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- notification_type
DO $$ BEGIN
  CREATE TYPE public.notification_type AS ENUM ('info', 'warning', 'error', 'success', 'credit', 'security', 'system');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- provider_status
DO $$ BEGIN
  CREATE TYPE public.provider_status AS ENUM ('active', 'inactive', 'maintenance', 'error');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- security_event_type
DO $$ BEGIN
  CREATE TYPE public.security_event_type AS ENUM (
    'login_failed', 'rate_limit', 'suspicious_activity', 'api_abuse',
    'blocked_ip', 'auto_ban', 'prompt_filter', 'vpn_detected'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================
-- SECTION 3: Tables
-- ============================================================
-- Tables are created in dependency order to avoid FK errors.

-- ------------------------------------------------------------
-- 3.1: profiles
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  username text,
  display_name text,
  email text,
  avatar_url text,
  account_type public.account_type NOT NULL DEFAULT 'normal'::public.account_type,
  is_banned boolean NOT NULL DEFAULT false,
  banned_at timestamp with time zone,
  banned_by uuid,
  ban_reason text,
  force_password_reset boolean NOT NULL DEFAULT false,
  max_images_per_day integer DEFAULT 100,
  custom_rpm integer,
  custom_rpd integer,
  last_login_at timestamp with time zone,
  last_login_ip text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_user_id_key UNIQUE (user_id),
  CONSTRAINT profiles_username_key UNIQUE (username)
);

-- ------------------------------------------------------------
-- 3.2: providers
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.providers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  display_name text NOT NULL,
  base_url text,
  api_key_encrypted text,
  key_encrypted_at timestamp with time zone,
  status public.provider_status NOT NULL DEFAULT 'active'::public.provider_status,
  priority integer NOT NULL DEFAULT 100,
  is_fallback boolean NOT NULL DEFAULT false,
  cost_per_image numeric NOT NULL DEFAULT 0,
  config jsonb DEFAULT '{}'::jsonb,
  status_page_url text,
  last_test_at timestamp with time zone,
  last_test_status text DEFAULT 'never_tested'::text,
  last_test_message text,
  last_test_response_time integer,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT providers_pkey PRIMARY KEY (id),
  CONSTRAINT providers_name_key UNIQUE (name)
);

-- ------------------------------------------------------------
-- 3.3: admin_audit_logs
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,
  target_type text,
  target_id uuid,
  old_value jsonb,
  new_value jsonb,
  details jsonb,
  ip_address text,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT admin_audit_logs_pkey PRIMARY KEY (id)
);

-- ------------------------------------------------------------
-- 3.4: ip_blocklist
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ip_blocklist (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  cidr_range text,
  reason public.block_reason NOT NULL DEFAULT 'manual'::public.block_reason,
  notes text,
  blocked_by uuid,
  expires_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ip_blocklist_pkey PRIMARY KEY (id),
  CONSTRAINT ip_blocklist_ip_address_key UNIQUE (ip_address)
);

-- ------------------------------------------------------------
-- 3.5: system_settings
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_settings (
  key text NOT NULL,
  value jsonb NOT NULL,
  description text,
  updated_by uuid,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT system_settings_pkey PRIMARY KEY (key)
);

-- ------------------------------------------------------------
-- 3.6: announcements
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  type public.announcement_type NOT NULL DEFAULT 'info'::public.announcement_type,
  is_active boolean NOT NULL DEFAULT true,
  target_roles public.app_role[],
  starts_at timestamp with time zone DEFAULT now(),
  ends_at timestamp with time zone,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT announcements_pkey PRIMARY KEY (id)
);

-- ------------------------------------------------------------
-- 3.7: feature_flags
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_enabled boolean NOT NULL DEFAULT false,
  target_roles public.app_role[],
  target_account_types public.account_type[],
  rollout_percentage integer DEFAULT 100,
  config jsonb DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT feature_flags_pkey PRIMARY KEY (id),
  CONSTRAINT feature_flags_name_key UNIQUE (name),
  CONSTRAINT feature_flags_rollout_percentage_check CHECK ((rollout_percentage >= 0 AND rollout_percentage <= 100))
);

-- ------------------------------------------------------------
-- 3.8: security_events
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.security_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_type public.security_event_type NOT NULL,
  severity text NOT NULL DEFAULT 'low'::text,
  user_id uuid,
  api_key_id uuid,
  ip_address text,
  user_agent text,
  details jsonb DEFAULT '{}'::jsonb,
  resolved_at timestamp with time zone,
  resolved_by uuid,
  resolution_notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT security_events_pkey PRIMARY KEY (id),
  CONSTRAINT security_events_severity_check CHECK ((severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text])))
);

-- ------------------------------------------------------------
-- 3.9: user_roles
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL DEFAULT 'user'::public.app_role,
  is_owner boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_roles_pkey PRIMARY KEY (id),
  CONSTRAINT user_roles_user_id_key UNIQUE (user_id)
);

-- ------------------------------------------------------------
-- 3.10: user_credits
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_credits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  balance numeric NOT NULL DEFAULT 0,
  daily_credits numeric NOT NULL DEFAULT 0,
  last_daily_reset timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_credits_pkey PRIMARY KEY (id),
  CONSTRAINT user_credits_user_id_key UNIQUE (user_id),
  CONSTRAINT user_credits_balance_check CHECK ((balance >= 0)),
  CONSTRAINT user_credits_daily_credits_check CHECK ((daily_credits >= 0))
);

-- ------------------------------------------------------------
-- 3.11: admin_invites
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_invites (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  token text NOT NULL,
  token_hash text,
  token_prefix text,
  role public.app_role NOT NULL,
  created_by uuid NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  used_at timestamp with time zone,
  used_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT admin_invites_pkey PRIMARY KEY (id)
);

-- ------------------------------------------------------------
-- 3.12: ai_models
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_models (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  provider_id uuid,
  name text NOT NULL,
  model_id text NOT NULL,
  description text,
  category text NOT NULL,
  engine_type text NOT NULL,
  api_endpoint text,
  api_key_encrypted text,
  status public.model_status NOT NULL DEFAULT 'active'::public.model_status,
  access_level public.model_access_level NOT NULL DEFAULT 'public'::public.model_access_level,
  is_partner_only boolean NOT NULL DEFAULT false,
  is_soft_disabled boolean NOT NULL DEFAULT false,
  soft_disable_message text,
  cooldown_until timestamp with time zone,
  fallback_model_id uuid,
  credits_cost numeric NOT NULL DEFAULT 0.001,
  rpm integer NOT NULL DEFAULT 60,
  rpd integer NOT NULL DEFAULT 1000,
  usage_count bigint NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ai_models_pkey PRIMARY KEY (id),
  CONSTRAINT ai_models_model_id_key UNIQUE (model_id),
  CONSTRAINT ai_models_credits_cost_check CHECK ((credits_cost >= 0)),
  CONSTRAINT ai_models_rpm_check CHECK ((rpm > 0)),
  CONSTRAINT ai_models_rpd_check CHECK ((rpd > 0))
);

-- Foreign key for ai_models -> providers
ALTER TABLE public.ai_models
  ADD CONSTRAINT ai_models_provider_id_fkey 
  FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE SET NULL;

-- Self-referential FK for fallback model
ALTER TABLE public.ai_models
  ADD CONSTRAINT ai_models_fallback_model_id_fkey 
  FOREIGN KEY (fallback_model_id) REFERENCES public.ai_models(id) ON DELETE SET NULL;

-- ------------------------------------------------------------
-- 3.13: api_keys
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.api_keys (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  key_prefix text NOT NULL,
  key_hash text NOT NULL,
  status public.api_key_status NOT NULL DEFAULT 'active'::public.api_key_status,
  allowed_models uuid[],
  custom_rpm integer,
  custom_rpd integer,
  usage_count bigint NOT NULL DEFAULT 0,
  last_used_at timestamp with time zone,
  last_used_ip text,
  expires_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT api_keys_pkey PRIMARY KEY (id),
  CONSTRAINT api_keys_key_hash_key UNIQUE (key_hash),
  CONSTRAINT api_keys_custom_rpm_check CHECK ((custom_rpm IS NULL OR custom_rpm > 0)),
  CONSTRAINT api_keys_custom_rpd_check CHECK ((custom_rpd IS NULL OR custom_rpd > 0))
);

-- ------------------------------------------------------------
-- 3.14: credits_transactions
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.credits_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type public.credit_transaction_type NOT NULL,
  amount numeric NOT NULL,
  reason text,
  admin_id uuid,
  related_image_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT credits_transactions_pkey PRIMARY KEY (id)
);

-- ------------------------------------------------------------
-- 3.15: images
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.images (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  api_key_id uuid,
  model_id uuid,
  provider_id uuid,
  prompt text NOT NULL,
  negative_prompt text,
  width integer,
  height integer,
  status public.image_status NOT NULL DEFAULT 'pending'::public.image_status,
  image_url text,
  thumbnail_url text,
  credits_used numeric NOT NULL DEFAULT 0,
  generation_time_ms integer,
  error text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT images_pkey PRIMARY KEY (id),
  CONSTRAINT images_width_check CHECK ((width IS NULL OR width > 0)),
  CONSTRAINT images_height_check CHECK ((height IS NULL OR height > 0)),
  CONSTRAINT images_credits_used_check CHECK ((credits_used >= 0))
);

-- ------------------------------------------------------------
-- 3.16: notifications
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type public.notification_type NOT NULL DEFAULT 'info'::public.notification_type,
  action_url text,
  attachment_url text,
  attachment_name text,
  read_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id)
);

-- ------------------------------------------------------------
-- 3.17: request_logs
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.request_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  api_key_id uuid,
  image_id uuid,
  endpoint text NOT NULL,
  method text NOT NULL,
  status_code integer,
  response_time_ms integer,
  error_message text,
  request_body jsonb,
  ip_address text,
  user_agent text,
  country text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT request_logs_pkey PRIMARY KEY (id)
);

-- ------------------------------------------------------------
-- 3.18: invoices
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  invoice_number text NOT NULL,
  amount numeric NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending'::text,
  due_date date NOT NULL,
  paid_at timestamp with time zone,
  file_url text,
  file_name text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT invoices_pkey PRIMARY KEY (id),
  CONSTRAINT invoices_invoice_number_key UNIQUE (invoice_number),
  CONSTRAINT invoices_amount_check CHECK ((amount > 0)),
  CONSTRAINT invoices_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'paid'::text, 'overdue'::text, 'cancelled'::text])))
);


-- ============================================================
-- SECTION 4: Views
-- ============================================================

-- ------------------------------------------------------------
-- 4.1: announcements_public
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public.announcements_public AS
SELECT 
  id,
  title,
  message,
  type,
  is_active,
  starts_at,
  ends_at,
  created_at
FROM public.announcements
WHERE is_active = true
  AND (starts_at IS NULL OR starts_at <= now())
  AND (ends_at IS NULL OR ends_at > now());

-- ------------------------------------------------------------
-- 4.2: feature_flags_public
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public.feature_flags_public AS
SELECT 
  id,
  name,
  description,
  is_enabled
FROM public.feature_flags
WHERE is_enabled = true;


-- ============================================================
-- SECTION 5: Functions
-- ============================================================

-- ------------------------------------------------------------
-- 5.1: update_updated_at_column
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------
-- 5.2: has_role
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- ------------------------------------------------------------
-- 5.3: is_admin_or_above
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin_or_above(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin', 'admin')
  )
$$;

-- ------------------------------------------------------------
-- 5.4: is_moderator_or_above
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_moderator_or_above(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin', 'admin', 'moderator')
  )
$$;

-- ------------------------------------------------------------
-- 5.5: is_owner
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_owner(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'super_admin'
      AND is_owner = true
  )
$$;

-- ------------------------------------------------------------
-- 5.6: get_user_role
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY 
    CASE role
      WHEN 'super_admin' THEN 1
      WHEN 'admin' THEN 2
      WHEN 'moderator' THEN 3
      WHEN 'support' THEN 4
      WHEN 'analyst' THEN 5
      WHEN 'user' THEN 6
    END
  LIMIT 1
$$;

-- ------------------------------------------------------------
-- 5.7: get_account_type
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 5.8: is_system_bootstrapped
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_system_bootstrapped()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE is_owner = true
  )
$$;

-- ------------------------------------------------------------
-- 5.9: get_orphaned_user_count
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_orphaned_user_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COUNT(*)::integer
  FROM auth.users au
  LEFT JOIN public.profiles p ON au.id = p.user_id
  WHERE p.user_id IS NULL
$$;

-- ------------------------------------------------------------
-- 5.10: hash_invite_token
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hash_invite_token(token text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public', 'extensions'
AS $$
  SELECT encode(extensions.digest(token, 'sha256'), 'hex')
$$;

-- ------------------------------------------------------------
-- 5.11: generate_invite_token
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_invite_token()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT encode(extensions.gen_random_bytes(32), 'hex')
$$;

-- ------------------------------------------------------------
-- 5.12: log_admin_action
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 5.13: log_profile_fallback_event
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_profile_fallback_event(
  _action text,
  _target_id uuid,
  _details jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only allow specific profile-related actions
  IF _action NOT IN ('profile_created_via_fallback', 'profile_creation_failed') THEN
    RAISE EXCEPTION 'Invalid action for profile fallback logging';
  END IF;
  
  -- Insert the audit log entry
  INSERT INTO public.admin_audit_logs (actor_id, action, target_type, target_id, details)
  VALUES (auth.uid(), _action, 'profiles', _target_id, _details);
END;
$$;

-- ------------------------------------------------------------
-- 5.14: handle_new_user
-- ------------------------------------------------------------
-- IMPORTANT: This function exists but the trigger on auth.users
-- must be created manually via Dashboard SQL Editor.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_display_name text;
  v_avatar_url text;
  v_raw_name text;
BEGIN
  -- Safely extract raw name from OAuth metadata
  v_raw_name := COALESCE(
    new.raw_user_meta_data ->> 'full_name', 
    new.raw_user_meta_data ->> 'name'
  );
  
  -- Sanitize display_name
  IF v_raw_name IS NOT NULL THEN
    v_display_name := TRIM(v_raw_name);
    v_display_name := regexp_replace(v_display_name, '<[^>]*>', '', 'g');
    v_display_name := regexp_replace(v_display_name, '(javascript|data|vbscript):', '', 'gi');
    v_display_name := regexp_replace(v_display_name, '[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g');
    v_display_name := replace(v_display_name, chr(0), '');
    v_display_name := SUBSTRING(v_display_name, 1, 100);
    v_display_name := NULLIF(TRIM(v_display_name), '');
  END IF;
  
  -- Fallback to email prefix if no display name
  IF v_display_name IS NULL THEN
    v_display_name := split_part(new.email, '@', 1);
  END IF;
  
  -- Safely extract and validate avatar_url
  v_avatar_url := COALESCE(
    new.raw_user_meta_data ->> 'avatar_url', 
    new.raw_user_meta_data ->> 'picture'
  );
  
  IF v_avatar_url IS NOT NULL THEN
    v_avatar_url := TRIM(v_avatar_url);
    IF length(v_avatar_url) > 2048 
       OR NOT (v_avatar_url ~ '^https://[a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9](/[^\s<>"'']*)?$')
       OR v_avatar_url ~ '(javascript|data|vbscript):' THEN
      v_avatar_url := NULL;
    END IF;
  END IF;

  -- Insert profile with ON CONFLICT to handle edge cases
  INSERT INTO public.profiles (user_id, display_name, avatar_url, email)
  VALUES (new.id, v_display_name, v_avatar_url, new.email)
  ON CONFLICT (user_id) DO UPDATE SET
    display_name = COALESCE(EXCLUDED.display_name, profiles.display_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    email = COALESCE(EXCLUDED.email, profiles.email),
    updated_at = now();
    
  RETURN new;
EXCEPTION
  WHEN others THEN
    RAISE WARNING 'Failed to create profile for user %: %', new.id, SQLERRM;
    RETURN new;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS 
'BEST-EFFORT ONLY: This trigger function may not be attached to auth.users in all environments. 
Profile creation is guaranteed by client-side fallback (AuthContext.tsx) and scheduled auto-sync.';

-- ------------------------------------------------------------
-- 5.15: handle_new_user_credits
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user_credits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.user_credits (user_id, balance, daily_credits)
  VALUES (NEW.user_id, 0, 10)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------
-- 5.16: sync_missing_profiles
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_missing_profiles()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Only admins can call this
  IF NOT is_admin_or_above(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  
  INSERT INTO public.profiles (user_id, email, display_name, avatar_url)
  SELECT 
    au.id,
    au.email,
    COALESCE(
      au.raw_user_meta_data ->> 'full_name',
      au.raw_user_meta_data ->> 'name',
      split_part(au.email, '@', 1)
    ),
    CASE 
      WHEN (au.raw_user_meta_data ->> 'avatar_url') ~ '^https://'
      THEN au.raw_user_meta_data ->> 'avatar_url'
      WHEN (au.raw_user_meta_data ->> 'picture') ~ '^https://'
      THEN au.raw_user_meta_data ->> 'picture'
      ELSE NULL
    END
  FROM auth.users au
  LEFT JOIN public.profiles p ON au.id = p.user_id
  WHERE p.user_id IS NULL
  ON CONFLICT (user_id) DO NOTHING;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  -- Also sync user_credits for any new profiles
  INSERT INTO public.user_credits (user_id, balance, daily_credits)
  SELECT p.user_id, 0, 10
  FROM public.profiles p
  LEFT JOIN public.user_credits uc ON p.user_id = uc.user_id
  WHERE uc.id IS NULL
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Log the sync action
  IF v_count > 0 THEN
    INSERT INTO admin_audit_logs (actor_id, action, target_type, details)
    VALUES (auth.uid(), 'profiles_synced', 'profiles', 
      jsonb_build_object('synced_count', v_count));
  END IF;
  
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.sync_missing_profiles() IS 
'Admin-callable function to sync profiles for orphaned auth.users. 
Returns the number of profiles created.';

-- ------------------------------------------------------------
-- 5.17: sync_missing_profiles_system
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_missing_profiles_system()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  -- This function is for system use only (service role)
  -- No auth check - caller must use service role key
  
  INSERT INTO public.profiles (user_id, email, display_name, avatar_url)
  SELECT 
    au.id,
    au.email,
    COALESCE(
      au.raw_user_meta_data ->> 'full_name',
      au.raw_user_meta_data ->> 'name',
      split_part(au.email, '@', 1)
    ),
    CASE 
      WHEN (au.raw_user_meta_data ->> 'avatar_url') ~ '^https://'
      THEN au.raw_user_meta_data ->> 'avatar_url'
      WHEN (au.raw_user_meta_data ->> 'picture') ~ '^https://'
      THEN au.raw_user_meta_data ->> 'picture'
      ELSE NULL
    END
  FROM auth.users au
  LEFT JOIN public.profiles p ON au.id = p.user_id
  WHERE p.user_id IS NULL
  ON CONFLICT (user_id) DO NOTHING;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  -- Also sync user_credits
  INSERT INTO public.user_credits (user_id, balance, daily_credits)
  SELECT p.user_id, 0, 10
  FROM public.profiles p
  LEFT JOIN public.user_credits uc ON p.user_id = uc.user_id
  WHERE uc.id IS NULL
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.sync_missing_profiles_system() IS 
'System-level function for scheduled profile sync. 
Called by edge function with service role key. No auth check.';

-- ------------------------------------------------------------
-- 5.18: bootstrap_owner
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bootstrap_owner(_user_id uuid, _bootstrap_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_expected_key text;
  v_owner_exists boolean;
  v_user_exists boolean;
BEGIN
  -- Get bootstrap key from environment variable (set via Supabase secrets)
  v_expected_key := current_setting('app.settings.bootstrap_key', true);
  
  -- If not set via app.settings, try to get from vault
  IF v_expected_key IS NULL OR v_expected_key = '' THEN
    BEGIN
      SELECT decrypted_secret INTO v_expected_key 
      FROM vault.decrypted_secrets 
      WHERE name = 'BOOTSTRAP_KEY'
      LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
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
$$;

-- ------------------------------------------------------------
-- 5.19: create_admin_invite
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_admin_invite(_role public.app_role, _expires_in_days integer DEFAULT 1)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

-- ------------------------------------------------------------
-- 5.20: validate_invite_token
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_invite_token(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

-- ------------------------------------------------------------
-- 5.21: redeem_admin_invite
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.redeem_admin_invite(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_invite record;
  v_existing_role public.app_role;
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

-- ------------------------------------------------------------
-- 5.22: assign_user_role
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assign_user_role(_target_user_id uuid, _role public.app_role)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;

-- ------------------------------------------------------------
-- 5.23: update_account_type
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_account_type(_target_user_id uuid, _account_type public.account_type)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

-- ------------------------------------------------------------
-- 5.24: audit_ai_models_changes
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_ai_models_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

-- ------------------------------------------------------------
-- 5.25: audit_user_roles_changes
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_user_roles_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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


-- ============================================================
-- SECTION 6: Indexes
-- ============================================================

-- profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_account_type ON public.profiles(account_type);
CREATE INDEX IF NOT EXISTS idx_profiles_is_banned ON public.profiles(is_banned) WHERE is_banned = true;

-- providers indexes
CREATE INDEX IF NOT EXISTS idx_providers_status ON public.providers(status);
CREATE INDEX IF NOT EXISTS idx_providers_priority ON public.providers(priority);

-- admin_audit_logs indexes
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_actor_id ON public.admin_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action ON public.admin_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_target_type ON public.admin_audit_logs(target_type);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON public.admin_audit_logs(created_at DESC);

-- ip_blocklist indexes
CREATE INDEX IF NOT EXISTS idx_ip_blocklist_ip_address ON public.ip_blocklist(ip_address);
CREATE INDEX IF NOT EXISTS idx_ip_blocklist_expires_at ON public.ip_blocklist(expires_at);

-- announcements indexes
CREATE INDEX IF NOT EXISTS idx_announcements_is_active ON public.announcements(is_active);
CREATE INDEX IF NOT EXISTS idx_announcements_starts_at ON public.announcements(starts_at);
CREATE INDEX IF NOT EXISTS idx_announcements_ends_at ON public.announcements(ends_at);

-- feature_flags indexes
CREATE INDEX IF NOT EXISTS idx_feature_flags_name ON public.feature_flags(name);
CREATE INDEX IF NOT EXISTS idx_feature_flags_is_enabled ON public.feature_flags(is_enabled);

-- security_events indexes
CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON public.security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON public.security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON public.security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_ip_address ON public.security_events(ip_address);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON public.security_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_resolved_at ON public.security_events(resolved_at);

-- user_roles indexes
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);
CREATE INDEX IF NOT EXISTS idx_user_roles_is_owner ON public.user_roles(is_owner) WHERE is_owner = true;

-- user_credits indexes
CREATE INDEX IF NOT EXISTS idx_user_credits_user_id ON public.user_credits(user_id);

-- admin_invites indexes
CREATE INDEX IF NOT EXISTS idx_admin_invites_token_hash ON public.admin_invites(token_hash);
CREATE INDEX IF NOT EXISTS idx_admin_invites_expires_at ON public.admin_invites(expires_at);
CREATE INDEX IF NOT EXISTS idx_admin_invites_used_at ON public.admin_invites(used_at);

-- ai_models indexes
CREATE INDEX IF NOT EXISTS idx_ai_models_provider_id ON public.ai_models(provider_id);
CREATE INDEX IF NOT EXISTS idx_ai_models_status ON public.ai_models(status);
CREATE INDEX IF NOT EXISTS idx_ai_models_access_level ON public.ai_models(access_level);
CREATE INDEX IF NOT EXISTS idx_ai_models_category ON public.ai_models(category);

-- api_keys indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON public.api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_status ON public.api_keys(status);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_prefix ON public.api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_expires_at ON public.api_keys(expires_at);

-- credits_transactions indexes
CREATE INDEX IF NOT EXISTS idx_credits_transactions_user_id ON public.credits_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credits_transactions_type ON public.credits_transactions(type);
CREATE INDEX IF NOT EXISTS idx_credits_transactions_created_at ON public.credits_transactions(created_at DESC);

-- images indexes
CREATE INDEX IF NOT EXISTS idx_images_user_id ON public.images(user_id);
CREATE INDEX IF NOT EXISTS idx_images_api_key_id ON public.images(api_key_id);
CREATE INDEX IF NOT EXISTS idx_images_model_id ON public.images(model_id);
CREATE INDEX IF NOT EXISTS idx_images_status ON public.images(status);
CREATE INDEX IF NOT EXISTS idx_images_created_at ON public.images(created_at DESC);

-- notifications indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON public.notifications(read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- request_logs indexes
CREATE INDEX IF NOT EXISTS idx_request_logs_user_id ON public.request_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_request_logs_api_key_id ON public.request_logs(api_key_id);
CREATE INDEX IF NOT EXISTS idx_request_logs_endpoint ON public.request_logs(endpoint);
CREATE INDEX IF NOT EXISTS idx_request_logs_status_code ON public.request_logs(status_code);
CREATE INDEX IF NOT EXISTS idx_request_logs_created_at ON public.request_logs(created_at DESC);

-- invoices indexes
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON public.invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON public.invoices(due_date);


-- ============================================================
-- SECTION 7: Triggers
-- ============================================================

-- Updated at triggers for all tables with updated_at column
CREATE OR REPLACE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_providers_updated_at
  BEFORE UPDATE ON public.providers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_feature_flags_updated_at
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_user_roles_updated_at
  BEFORE UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_user_credits_updated_at
  BEFORE UPDATE ON public.user_credits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_ai_models_updated_at
  BEFORE UPDATE ON public.ai_models
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Audit triggers
CREATE OR REPLACE TRIGGER audit_ai_models
  AFTER INSERT OR UPDATE OR DELETE ON public.ai_models
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_ai_models_changes();

CREATE OR REPLACE TRIGGER audit_user_roles
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_user_roles_changes();

-- Profile -> Credits auto-creation trigger
CREATE OR REPLACE TRIGGER on_profile_created_add_credits
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_credits();


-- ============================================================
-- SECTION 8: Enable Row Level Security
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ip_blocklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credits_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- SECTION 9: RLS Policies
-- ============================================================

-- ------------------------------------------------------------
-- 9.1: profiles policies
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" 
  ON public.profiles FOR SELECT 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" 
  ON public.profiles FOR SELECT 
  USING (is_admin_or_above(auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" 
  ON public.profiles FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" 
  ON public.profiles FOR UPDATE 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Super admins can update account type" ON public.profiles;
CREATE POLICY "Super admins can update account type" 
  ON public.profiles FOR UPDATE 
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Users can delete their own profile" ON public.profiles;
CREATE POLICY "Users can delete their own profile" 
  ON public.profiles FOR DELETE 
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 9.2: providers policies
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can view active providers" ON public.providers;
CREATE POLICY "Anyone can view active providers" 
  ON public.providers FOR SELECT 
  USING ((status = 'active'::public.provider_status) OR is_admin_or_above(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage providers" ON public.providers;
CREATE POLICY "Admins can manage providers" 
  ON public.providers FOR ALL 
  USING (is_admin_or_above(auth.uid()));

-- ------------------------------------------------------------
-- 9.3: admin_audit_logs policies
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.admin_audit_logs;
CREATE POLICY "Admins can view audit logs" 
  ON public.admin_audit_logs FOR SELECT 
  USING (is_admin_or_above(auth.uid()));

DROP POLICY IF EXISTS "Admins can insert audit logs" ON public.admin_audit_logs;
CREATE POLICY "Admins can insert audit logs" 
  ON public.admin_audit_logs FOR INSERT 
  WITH CHECK (is_admin_or_above(auth.uid()));

DROP POLICY IF EXISTS "No updates allowed on audit logs" ON public.admin_audit_logs;
CREATE POLICY "No updates allowed on audit logs" 
  ON public.admin_audit_logs FOR UPDATE 
  USING (false);

DROP POLICY IF EXISTS "No deletes allowed on audit logs" ON public.admin_audit_logs;
CREATE POLICY "No deletes allowed on audit logs" 
  ON public.admin_audit_logs FOR DELETE 
  USING (false);

-- ------------------------------------------------------------
-- 9.4: ip_blocklist policies
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can manage blocklist" ON public.ip_blocklist;
CREATE POLICY "Admins can manage blocklist" 
  ON public.ip_blocklist FOR ALL 
  USING (is_admin_or_above(auth.uid()));

-- ------------------------------------------------------------
-- 9.5: system_settings policies
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can view non-sensitive settings" ON public.system_settings;
CREATE POLICY "Anyone can view non-sensitive settings" 
  ON public.system_settings FOR SELECT 
  USING ((key !~~ '%_secret%') AND (key !~~ '%_key%'));

DROP POLICY IF EXISTS "Admins can view all settings" ON public.system_settings;
CREATE POLICY "Admins can view all settings" 
  ON public.system_settings FOR SELECT 
  USING (is_admin_or_above(auth.uid()));

DROP POLICY IF EXISTS "Super admins can manage settings" ON public.system_settings;
CREATE POLICY "Super admins can manage settings" 
  ON public.system_settings FOR ALL 
  USING (has_role(auth.uid(), 'super_admin'));

-- ------------------------------------------------------------
-- 9.6: announcements policies
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can manage announcements" ON public.announcements;
CREATE POLICY "Admins can manage announcements" 
  ON public.announcements FOR ALL 
  USING (is_admin_or_above(auth.uid()));

-- ------------------------------------------------------------
-- 9.7: feature_flags policies
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can view enabled flags" ON public.feature_flags;
CREATE POLICY "Authenticated users can view enabled flags" 
  ON public.feature_flags FOR SELECT 
  USING ((is_enabled = true) AND (auth.uid() IS NOT NULL));

DROP POLICY IF EXISTS "Admins can manage feature flags" ON public.feature_flags;
CREATE POLICY "Admins can manage feature flags" 
  ON public.feature_flags FOR ALL 
  USING (is_admin_or_above(auth.uid()));

-- ------------------------------------------------------------
-- 9.8: security_events policies
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can view security events" ON public.security_events;
CREATE POLICY "Admins can view security events" 
  ON public.security_events FOR SELECT 
  USING (is_admin_or_above(auth.uid()));

DROP POLICY IF EXISTS "Admins can insert security events" ON public.security_events;
CREATE POLICY "Admins can insert security events" 
  ON public.security_events FOR INSERT 
  WITH CHECK (is_admin_or_above(auth.uid()));

DROP POLICY IF EXISTS "Admins can update security events" ON public.security_events;
CREATE POLICY "Admins can update security events" 
  ON public.security_events FOR UPDATE 
  USING (is_admin_or_above(auth.uid()));

-- ------------------------------------------------------------
-- 9.9: user_roles policies
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles" 
  ON public.user_roles FOR SELECT 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles" 
  ON public.user_roles FOR SELECT 
  USING (is_admin_or_above(auth.uid()));

DROP POLICY IF EXISTS "Super admins can insert roles" ON public.user_roles;
CREATE POLICY "Super admins can insert roles" 
  ON public.user_roles FOR INSERT 
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Super admins can update roles" ON public.user_roles;
CREATE POLICY "Super admins can update roles" 
  ON public.user_roles FOR UPDATE 
  USING (
    has_role(auth.uid(), 'super_admin') 
    AND NOT ((is_owner = true) AND (user_id <> auth.uid()))
    AND NOT ((is_owner = true) AND (auth.uid() = user_id))
  );

DROP POLICY IF EXISTS "Super admins can delete roles except owner" ON public.user_roles;
CREATE POLICY "Super admins can delete roles except owner" 
  ON public.user_roles FOR DELETE 
  USING (has_role(auth.uid(), 'super_admin') AND (is_owner = false));

-- ------------------------------------------------------------
-- 9.10: user_credits policies
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own credits" ON public.user_credits;
CREATE POLICY "Users can view their own credits" 
  ON public.user_credits FOR SELECT 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all credits" ON public.user_credits;
CREATE POLICY "Admins can view all credits" 
  ON public.user_credits FOR SELECT 
  USING (is_admin_or_above(auth.uid()));

DROP POLICY IF EXISTS "System can insert credits" ON public.user_credits;
CREATE POLICY "System can insert credits" 
  ON public.user_credits FOR INSERT 
  WITH CHECK ((auth.uid() = user_id) OR is_admin_or_above(auth.uid()));

DROP POLICY IF EXISTS "Admins can update credits" ON public.user_credits;
CREATE POLICY "Admins can update credits" 
  ON public.user_credits FOR UPDATE 
  USING (is_admin_or_above(auth.uid()));

-- ------------------------------------------------------------
-- 9.11: admin_invites policies
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Owner can view all invites" ON public.admin_invites;
CREATE POLICY "Owner can view all invites" 
  ON public.admin_invites FOR SELECT 
  USING (is_owner(auth.uid()));

DROP POLICY IF EXISTS "Owner can create invites" ON public.admin_invites;
CREATE POLICY "Owner can create invites" 
  ON public.admin_invites FOR INSERT 
  WITH CHECK (is_owner(auth.uid()));

DROP POLICY IF EXISTS "Owner can delete unused invites" ON public.admin_invites;
CREATE POLICY "Owner can delete unused invites" 
  ON public.admin_invites FOR DELETE 
  USING (is_owner(auth.uid()) AND (used_at IS NULL));

-- ------------------------------------------------------------
-- 9.12: ai_models policies
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view public models" ON public.ai_models;
CREATE POLICY "Users can view public models" 
  ON public.ai_models FOR SELECT 
  USING (
    (access_level = 'public'::public.model_access_level) 
    OR ((access_level = 'partner_only'::public.model_access_level) 
        AND ((get_account_type(auth.uid()) = 'partner'::public.account_type) OR is_admin_or_above(auth.uid())))
    OR ((access_level = 'admin_only'::public.model_access_level) AND is_admin_or_above(auth.uid()))
  );

DROP POLICY IF EXISTS "Admins can insert models" ON public.ai_models;
CREATE POLICY "Admins can insert models" 
  ON public.ai_models FOR INSERT 
  WITH CHECK (is_admin_or_above(auth.uid()));

DROP POLICY IF EXISTS "Admins can update models" ON public.ai_models;
CREATE POLICY "Admins can update models" 
  ON public.ai_models FOR UPDATE 
  USING (is_admin_or_above(auth.uid()));

DROP POLICY IF EXISTS "Super admins can delete models" ON public.ai_models;
CREATE POLICY "Super admins can delete models" 
  ON public.ai_models FOR DELETE 
  USING (has_role(auth.uid(), 'super_admin'));

-- ------------------------------------------------------------
-- 9.13: api_keys policies
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own API keys" ON public.api_keys;
CREATE POLICY "Users can view their own API keys" 
  ON public.api_keys FOR SELECT 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all API keys" ON public.api_keys;
CREATE POLICY "Admins can view all API keys" 
  ON public.api_keys FOR SELECT 
  USING (is_admin_or_above(auth.uid()));

DROP POLICY IF EXISTS "Users can create their own API keys" ON public.api_keys;
CREATE POLICY "Users can create their own API keys" 
  ON public.api_keys FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own API keys" ON public.api_keys;
CREATE POLICY "Users can update their own API keys" 
  ON public.api_keys FOR UPDATE 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can update all API keys" ON public.api_keys;
CREATE POLICY "Admins can update all API keys" 
  ON public.api_keys FOR UPDATE 
  USING (is_admin_or_above(auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own API keys" ON public.api_keys;
CREATE POLICY "Users can delete their own API keys" 
  ON public.api_keys FOR DELETE 
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 9.14: credits_transactions policies
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.credits_transactions;
CREATE POLICY "Users can view their own transactions" 
  ON public.credits_transactions FOR SELECT 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all transactions" ON public.credits_transactions;
CREATE POLICY "Admins can view all transactions" 
  ON public.credits_transactions FOR SELECT 
  USING (is_admin_or_above(auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own transactions" ON public.credits_transactions;
CREATE POLICY "Users can insert their own transactions" 
  ON public.credits_transactions FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can insert any transactions" ON public.credits_transactions;
CREATE POLICY "Admins can insert any transactions" 
  ON public.credits_transactions FOR INSERT 
  WITH CHECK (is_admin_or_above(auth.uid()));

-- ------------------------------------------------------------
-- 9.15: images policies
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own images" ON public.images;
CREATE POLICY "Users can view their own images" 
  ON public.images FOR SELECT 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all images" ON public.images;
CREATE POLICY "Admins can view all images" 
  ON public.images FOR SELECT 
  USING (is_admin_or_above(auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own images" ON public.images;
CREATE POLICY "Users can insert their own images" 
  ON public.images FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 9.16: notifications policies
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications" 
  ON public.notifications FOR SELECT 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications" 
  ON public.notifications FOR UPDATE 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;
CREATE POLICY "Users can delete their own notifications" 
  ON public.notifications FOR DELETE 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage notifications" ON public.notifications;
CREATE POLICY "Admins can manage notifications" 
  ON public.notifications FOR ALL 
  USING (is_admin_or_above(auth.uid()));

-- ------------------------------------------------------------
-- 9.17: request_logs policies
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own logs" ON public.request_logs;
CREATE POLICY "Users can view their own logs" 
  ON public.request_logs FOR SELECT 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all logs" ON public.request_logs;
CREATE POLICY "Admins can view all logs" 
  ON public.request_logs FOR SELECT 
  USING (is_admin_or_above(auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own logs" ON public.request_logs;
CREATE POLICY "Users can insert their own logs" 
  ON public.request_logs FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can insert any logs" ON public.request_logs;
CREATE POLICY "Admins can insert any logs" 
  ON public.request_logs FOR INSERT 
  WITH CHECK (is_admin_or_above(auth.uid()));

-- ------------------------------------------------------------
-- 9.18: invoices policies
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own invoices" ON public.invoices;
CREATE POLICY "Users can view their own invoices" 
  ON public.invoices FOR SELECT 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all invoices" ON public.invoices;
CREATE POLICY "Admins can view all invoices" 
  ON public.invoices FOR SELECT 
  USING (is_admin_or_above(auth.uid()));

DROP POLICY IF EXISTS "Admins can insert invoices" ON public.invoices;
CREATE POLICY "Admins can insert invoices" 
  ON public.invoices FOR INSERT 
  WITH CHECK (is_admin_or_above(auth.uid()));

DROP POLICY IF EXISTS "Admins can update invoices" ON public.invoices;
CREATE POLICY "Admins can update invoices" 
  ON public.invoices FOR UPDATE 
  USING (is_admin_or_above(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete invoices" ON public.invoices;
CREATE POLICY "Admins can delete invoices" 
  ON public.invoices FOR DELETE 
  USING (is_admin_or_above(auth.uid()));


-- ============================================================
-- END OF BASELINE MIGRATION
-- ============================================================
-- 
-- Post-migration manual steps:
--
-- 1. Create storage buckets (via Dashboard):
--    - avatars (private)
--    - notification-attachments (private)
--    - invoice-files (private)
--
-- 2. Configure secrets (via Supabase Secrets):
--    - BOOTSTRAP_KEY
--    - ENCRYPTION_KEY
--
-- 3. Attach auth trigger (via Dashboard SQL Editor ONLY):
--    CREATE TRIGGER on_auth_user_created
--      AFTER INSERT ON auth.users
--      FOR EACH ROW
--      EXECUTE FUNCTION public.handle_new_user();
--
-- 4. Configure auth settings as needed
--
-- ============================================================
