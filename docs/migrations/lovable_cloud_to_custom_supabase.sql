-- =====================================================
-- LOVABLE CLOUD → CUSTOM SUPABASE MIGRATION
-- Project: vtudqqjmjcsgbpicjrtg
-- Generated: 2025-01-24
-- 
-- Run this in Custom Supabase Dashboard → SQL Editor
-- =====================================================

-- =====================================================
-- PART 1: ENABLE EXTENSIONS
-- =====================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- PART 2: CREATE ENUM TYPES (12 types)
-- =====================================================
DO $$ BEGIN
  CREATE TYPE public.account_type AS ENUM ('normal', 'partner');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.announcement_type AS ENUM ('info', 'warning', 'success', 'error', 'maintenance');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.api_key_status AS ENUM ('active', 'revoked', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'moderator', 'support', 'analyst', 'user');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.block_reason AS ENUM ('manual', 'rate_limit', 'abuse', 'suspicious');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.credit_transaction_type AS ENUM ('purchase', 'usage', 'refund', 'bonus', 'admin_adjustment', 'daily_reset');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.image_status AS ENUM ('pending', 'processing', 'completed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.model_access_level AS ENUM ('public', 'partner_only', 'admin_only');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.model_status AS ENUM ('active', 'inactive', 'maintenance', 'deprecated');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.notification_type AS ENUM ('info', 'warning', 'success', 'error', 'billing', 'system');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.provider_status AS ENUM ('active', 'inactive', 'maintenance', 'error');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.security_event_type AS ENUM (
    'login_success', 'login_failed', 'logout', 'password_change',
    'api_key_created', 'api_key_revoked', 'rate_limit_exceeded',
    'suspicious_activity', 'ip_blocked', 'role_changed',
    'admin_action', 'data_export', 'account_locked'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- PART 3: CREATE TABLES (19 tables)
-- =====================================================

-- Table: profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  email text,
  username text,
  display_name text,
  avatar_url text,
  account_type public.account_type NOT NULL DEFAULT 'normal',
  is_banned boolean NOT NULL DEFAULT false,
  banned_at timestamptz,
  banned_by uuid,
  ban_reason text,
  force_password_reset boolean NOT NULL DEFAULT false,
  last_login_at timestamptz,
  last_login_ip text,
  custom_rpm integer,
  custom_rpd integer,
  max_images_per_day integer DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table: providers
CREATE TABLE IF NOT EXISTS public.providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  display_name text NOT NULL,
  base_url text,
  api_key_encrypted text,
  key_encrypted_at timestamptz,
  status public.provider_status NOT NULL DEFAULT 'active',
  priority integer NOT NULL DEFAULT 100,
  is_fallback boolean NOT NULL DEFAULT false,
  cost_per_image numeric NOT NULL DEFAULT 0,
  config jsonb DEFAULT '{}'::jsonb,
  status_page_url text,
  last_test_at timestamptz,
  last_test_status text DEFAULT 'never_tested',
  last_test_message text,
  last_test_response_time integer,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table: user_roles
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  role public.app_role NOT NULL DEFAULT 'user',
  is_owner boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table: user_credits
CREATE TABLE IF NOT EXISTS public.user_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  balance numeric NOT NULL DEFAULT 0,
  daily_credits numeric NOT NULL DEFAULT 0,
  last_daily_reset timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table: system_settings
CREATE TABLE IF NOT EXISTS public.system_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  description text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table: admin_audit_logs
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
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
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Table: ip_blocklist
CREATE TABLE IF NOT EXISTS public.ip_blocklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  cidr_range text,
  reason public.block_reason NOT NULL DEFAULT 'manual',
  notes text,
  blocked_by uuid,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Table: announcements
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  type public.announcement_type NOT NULL DEFAULT 'info',
  is_active boolean NOT NULL DEFAULT true,
  target_roles public.app_role[],
  starts_at timestamptz DEFAULT now(),
  ends_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table: feature_flags
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  is_enabled boolean NOT NULL DEFAULT false,
  rollout_percentage integer DEFAULT 100,
  target_roles public.app_role[],
  target_account_types public.account_type[],
  config jsonb DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table: security_events
CREATE TABLE IF NOT EXISTS public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  api_key_id uuid,
  event_type public.security_event_type NOT NULL,
  severity text NOT NULL DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  ip_address text,
  user_agent text,
  details jsonb DEFAULT '{}'::jsonb,
  resolved_at timestamptz,
  resolved_by uuid,
  resolution_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Table: admin_invites
CREATE TABLE IF NOT EXISTS public.admin_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL,
  token_prefix text,
  token_hash text,
  role public.app_role NOT NULL,
  created_by uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  used_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Table: analytics_cache
CREATE TABLE IF NOT EXISTS public.analytics_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL UNIQUE,
  data jsonb NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '1 hour'),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Table: ai_models
CREATE TABLE IF NOT EXISTS public.ai_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid REFERENCES public.providers(id) ON DELETE SET NULL,
  name text NOT NULL,
  model_id text NOT NULL,
  description text,
  category text NOT NULL,
  engine_type text NOT NULL,
  status public.model_status NOT NULL DEFAULT 'active',
  access_level public.model_access_level NOT NULL DEFAULT 'public',
  is_partner_only boolean NOT NULL DEFAULT false,
  is_soft_disabled boolean NOT NULL DEFAULT false,
  soft_disable_message text,
  credits_cost numeric NOT NULL DEFAULT 0.001,
  rpm integer NOT NULL DEFAULT 60,
  rpd integer NOT NULL DEFAULT 1000,
  usage_count bigint NOT NULL DEFAULT 0,
  cooldown_until timestamptz,
  fallback_model_id uuid REFERENCES public.ai_models(id) ON DELETE SET NULL,
  api_key_encrypted text,
  api_endpoint text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table: api_keys
CREATE TABLE IF NOT EXISTS public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  key_prefix text NOT NULL,
  key_hash text NOT NULL,
  status public.api_key_status NOT NULL DEFAULT 'active',
  expires_at timestamptz,
  last_used_at timestamptz,
  last_used_ip text,
  usage_count bigint NOT NULL DEFAULT 0,
  custom_rpm integer,
  custom_rpd integer,
  allowed_models uuid[],
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Table: credits_transactions
CREATE TABLE IF NOT EXISTS public.credits_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount numeric NOT NULL,
  type public.credit_transaction_type NOT NULL,
  reason text,
  related_image_id uuid,
  admin_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Table: images
CREATE TABLE IF NOT EXISTS public.images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  api_key_id uuid,
  model_id uuid,
  provider_id uuid,
  prompt text NOT NULL,
  negative_prompt text,
  width integer,
  height integer,
  status public.image_status NOT NULL DEFAULT 'pending',
  image_url text,
  thumbnail_url text,
  credits_used numeric NOT NULL DEFAULT 0,
  generation_time_ms integer,
  error text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Table: notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type public.notification_type NOT NULL DEFAULT 'info',
  action_url text,
  attachment_url text,
  attachment_name text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Table: request_logs
CREATE TABLE IF NOT EXISTS public.request_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  api_key_id uuid,
  image_id uuid,
  endpoint text NOT NULL,
  method text NOT NULL,
  status_code integer,
  response_time_ms integer,
  ip_address text,
  country text,
  user_agent text,
  request_body jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Table: invoices
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  invoice_number text NOT NULL,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  description text,
  due_date date NOT NULL,
  paid_at timestamptz,
  file_url text,
  file_name text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =====================================================
-- PART 4: CREATE CORE FUNCTIONS (5 functions)
-- =====================================================

-- Function: update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Function: has_role (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Function: is_admin_or_above (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.is_admin_or_above(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin', 'admin')
  )
$$;

-- Function: is_owner (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.is_owner(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND is_owner = true
  )
$$;

-- Function: get_account_type (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_account_type(_user_id uuid)
RETURNS public.account_type
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT account_type FROM public.profiles WHERE user_id = _user_id),
    'normal'::public.account_type
  )
$$;

-- =====================================================
-- PART 5: ENABLE ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PART 6: CREATE RLS POLICIES (15 policies)
-- =====================================================

-- Drop existing policies first (if any)
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can update all profiles" ON public.profiles;

DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can delete roles except owner" ON public.user_roles;

DROP POLICY IF EXISTS "Users can view their own invoices" ON public.invoices;
DROP POLICY IF EXISTS "Admins can view all invoices" ON public.invoices;
DROP POLICY IF EXISTS "Admins can insert invoices" ON public.invoices;
DROP POLICY IF EXISTS "Admins can update invoices" ON public.invoices;
DROP POLICY IF EXISTS "Admins can delete invoices" ON public.invoices;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_admin_or_above(auth.uid()));

CREATE POLICY "Super admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING (public.has_role(auth.uid(), 'super_admin'));

-- User roles policies
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.is_admin_or_above(auth.uid()));

CREATE POLICY "Super admins can insert roles"
  ON public.user_roles FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can update roles"
  ON public.user_roles FOR UPDATE
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can delete roles except owner"
  ON public.user_roles FOR DELETE
  USING (public.has_role(auth.uid(), 'super_admin') AND is_owner = false);

-- Invoices policies
CREATE POLICY "Users can view their own invoices"
  ON public.invoices FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all invoices"
  ON public.invoices FOR SELECT
  USING (public.is_admin_or_above(auth.uid()));

CREATE POLICY "Admins can insert invoices"
  ON public.invoices FOR INSERT
  WITH CHECK (public.is_admin_or_above(auth.uid()));

CREATE POLICY "Admins can update invoices"
  ON public.invoices FOR UPDATE
  USING (public.is_admin_or_above(auth.uid()));

CREATE POLICY "Admins can delete invoices"
  ON public.invoices FOR DELETE
  USING (public.is_admin_or_above(auth.uid()));

-- =====================================================
-- PART 7: CREATE TRIGGERS
-- =====================================================

-- Drop existing triggers first
DROP TRIGGER IF EXISTS update_invoices_updated_at ON public.invoices;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS update_providers_updated_at ON public.providers;
DROP TRIGGER IF EXISTS update_user_roles_updated_at ON public.user_roles;
DROP TRIGGER IF EXISTS update_user_credits_updated_at ON public.user_credits;
DROP TRIGGER IF EXISTS update_announcements_updated_at ON public.announcements;
DROP TRIGGER IF EXISTS update_feature_flags_updated_at ON public.feature_flags;
DROP TRIGGER IF EXISTS update_ai_models_updated_at ON public.ai_models;

-- Create updated_at triggers
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_providers_updated_at
  BEFORE UPDATE ON public.providers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_roles_updated_at
  BEFORE UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_credits_updated_at
  BEFORE UPDATE ON public.user_credits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_feature_flags_updated_at
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ai_models_updated_at
  BEFORE UPDATE ON public.ai_models
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- PART 8: CREATE INDEXES
-- =====================================================

-- Unique indexes (if not already created by UNIQUE constraints)
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON public.api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON public.api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_images_user_id ON public.images(user_id);
CREATE INDEX IF NOT EXISTS idx_images_status ON public.images(status);
CREATE INDEX IF NOT EXISTS idx_images_created_at ON public.images(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON public.notifications(read_at);
CREATE INDEX IF NOT EXISTS idx_request_logs_user_id ON public.request_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_request_logs_created_at ON public.request_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_credits_transactions_user_id ON public.credits_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON public.security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON public.security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_actor_id ON public.admin_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON public.admin_audit_logs(created_at);

-- =====================================================
-- MIGRATION COMPLETE!
-- =====================================================
-- 
-- NEXT STEPS:
-- 1. Run this SQL in Custom Supabase Dashboard → SQL Editor
-- 2. Configure secrets: ENCRYPTION_KEY, BOOTSTRAP_KEY
-- 3. Create storage buckets: avatars, notification-attachments, invoice-files
-- 4. Assign owner role using assign-external-admin edge function
--
-- =====================================================
