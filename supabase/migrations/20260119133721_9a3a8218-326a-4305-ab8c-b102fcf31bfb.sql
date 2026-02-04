-- Phase 1: Core Infrastructure Database Schema

-- 1. Add new roles to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'support';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'analyst';

-- 2. User Credits Table
CREATE TABLE public.user_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  balance numeric NOT NULL DEFAULT 0 CHECK (balance >= 0),
  daily_credits numeric NOT NULL DEFAULT 0,
  last_daily_reset timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 3. Credits Transactions Table
CREATE TYPE public.credit_transaction_type AS ENUM ('add', 'deduct', 'refund', 'expire', 'daily_reset', 'generation');

CREATE TABLE public.credits_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount numeric NOT NULL,
  type credit_transaction_type NOT NULL,
  reason text,
  related_image_id uuid,
  admin_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 4. API Keys Table
CREATE TYPE public.api_key_status AS ENUM ('active', 'suspended', 'expired', 'revoked', 'rate_limited');

CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  key_prefix text NOT NULL,
  status api_key_status NOT NULL DEFAULT 'active',
  custom_rpm integer,
  custom_rpd integer,
  allowed_models uuid[],
  last_used_at timestamp with time zone,
  last_used_ip text,
  usage_count bigint NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone
);

-- 5. Providers Table
CREATE TYPE public.provider_status AS ENUM ('active', 'inactive', 'maintenance', 'error');

CREATE TABLE public.providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  display_name text NOT NULL,
  api_key_encrypted text,
  base_url text,
  status provider_status NOT NULL DEFAULT 'active',
  cost_per_image numeric NOT NULL DEFAULT 0,
  is_fallback boolean NOT NULL DEFAULT false,
  priority integer NOT NULL DEFAULT 100,
  config jsonb DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid
);

-- 6. Images Table (Generated Images History)
CREATE TYPE public.image_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');

CREATE TABLE public.images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  api_key_id uuid,
  prompt text NOT NULL,
  negative_prompt text,
  model_id uuid,
  provider_id uuid,
  image_url text,
  thumbnail_url text,
  width integer,
  height integer,
  credits_used numeric NOT NULL DEFAULT 0,
  generation_time_ms integer,
  status image_status NOT NULL DEFAULT 'pending',
  error text,
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 7. Request Logs Table
CREATE TABLE public.request_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  api_key_id uuid,
  image_id uuid,
  endpoint text NOT NULL,
  method text NOT NULL,
  status_code integer,
  response_time_ms integer,
  ip_address text,
  user_agent text,
  country text,
  request_body jsonb,
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 8. System Settings Table
CREATE TABLE public.system_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  description text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);

-- 9. Notifications Table
CREATE TYPE public.notification_type AS ENUM ('info', 'warning', 'error', 'success', 'credit', 'security', 'system');

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type notification_type NOT NULL DEFAULT 'info',
  title text NOT NULL,
  message text NOT NULL,
  action_url text,
  read_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 10. Announcements Table (Global Banners)
CREATE TYPE public.announcement_type AS ENUM ('info', 'warning', 'error', 'success', 'maintenance');

CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  type announcement_type NOT NULL DEFAULT 'info',
  target_roles app_role[],
  is_active boolean NOT NULL DEFAULT true,
  starts_at timestamp with time zone DEFAULT now(),
  ends_at timestamp with time zone,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 11. IP Blocklist Table
CREATE TYPE public.block_reason AS ENUM ('abuse', 'spam', 'ddos', 'vpn', 'proxy', 'manual', 'country');

CREATE TABLE public.ip_blocklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  cidr_range text,
  reason block_reason NOT NULL DEFAULT 'manual',
  notes text,
  blocked_by uuid,
  expires_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 12. Security Events Table
CREATE TYPE public.security_event_type AS ENUM ('login_failed', 'rate_limit', 'suspicious_activity', 'api_abuse', 'blocked_ip', 'auto_ban', 'prompt_filter', 'vpn_detected');

CREATE TABLE public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  api_key_id uuid,
  event_type security_event_type NOT NULL,
  severity text NOT NULL DEFAULT 'low',
  ip_address text,
  user_agent text,
  details jsonb DEFAULT '{}',
  resolved_at timestamp with time zone,
  resolved_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 13. Feature Flags Table
CREATE TABLE public.feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  is_enabled boolean NOT NULL DEFAULT false,
  rollout_percentage integer DEFAULT 100 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  target_roles app_role[],
  target_account_types account_type[],
  config jsonb DEFAULT '{}',
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 14. Add columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS ban_reason text,
ADD COLUMN IF NOT EXISTS banned_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS banned_by uuid,
ADD COLUMN IF NOT EXISTS force_password_reset boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS max_images_per_day integer DEFAULT 100,
ADD COLUMN IF NOT EXISTS last_login_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS last_login_ip text;

-- 15. Add provider_id to ai_models for linking
ALTER TABLE public.ai_models
ADD COLUMN IF NOT EXISTS provider_id uuid REFERENCES public.providers(id),
ADD COLUMN IF NOT EXISTS is_soft_disabled boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS soft_disable_message text,
ADD COLUMN IF NOT EXISTS cooldown_until timestamp with time zone,
ADD COLUMN IF NOT EXISTS fallback_model_id uuid;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_credits_user_id ON public.user_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_credits_transactions_user_id ON public.credits_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credits_transactions_created_at ON public.credits_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON public.api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON public.api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_status ON public.api_keys(status);
CREATE INDEX IF NOT EXISTS idx_images_user_id ON public.images(user_id);
CREATE INDEX IF NOT EXISTS idx_images_created_at ON public.images(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_images_status ON public.images(status);
CREATE INDEX IF NOT EXISTS idx_request_logs_user_id ON public.request_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_request_logs_created_at ON public.request_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_request_logs_api_key_id ON public.request_logs(api_key_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON public.notifications(read_at);
CREATE INDEX IF NOT EXISTS idx_ip_blocklist_ip_address ON public.ip_blocklist(ip_address);
CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON public.security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON public.security_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON public.security_events(event_type);

-- Enable RLS on all new tables
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credits_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ip_blocklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_credits
CREATE POLICY "Users can view their own credits" ON public.user_credits
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all credits" ON public.user_credits
  FOR SELECT USING (is_admin_or_above(auth.uid()));

CREATE POLICY "System can insert credits" ON public.user_credits
  FOR INSERT WITH CHECK (auth.uid() = user_id OR is_admin_or_above(auth.uid()));

CREATE POLICY "Admins can update credits" ON public.user_credits
  FOR UPDATE USING (is_admin_or_above(auth.uid()));

-- RLS Policies for credits_transactions
CREATE POLICY "Users can view their own transactions" ON public.credits_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all transactions" ON public.credits_transactions
  FOR SELECT USING (is_admin_or_above(auth.uid()));

CREATE POLICY "System can insert transactions" ON public.credits_transactions
  FOR INSERT WITH CHECK (true);

-- RLS Policies for api_keys
CREATE POLICY "Users can view their own API keys" ON public.api_keys
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own API keys" ON public.api_keys
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own API keys" ON public.api_keys
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own API keys" ON public.api_keys
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all API keys" ON public.api_keys
  FOR SELECT USING (is_admin_or_above(auth.uid()));

CREATE POLICY "Admins can update all API keys" ON public.api_keys
  FOR UPDATE USING (is_admin_or_above(auth.uid()));

-- RLS Policies for providers
CREATE POLICY "Anyone can view active providers" ON public.providers
  FOR SELECT USING (status = 'active' OR is_admin_or_above(auth.uid()));

CREATE POLICY "Admins can manage providers" ON public.providers
  FOR ALL USING (is_admin_or_above(auth.uid()));

-- RLS Policies for images
CREATE POLICY "Users can view their own images" ON public.images
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own images" ON public.images
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all images" ON public.images
  FOR SELECT USING (is_admin_or_above(auth.uid()));

-- RLS Policies for request_logs
CREATE POLICY "Users can view their own logs" ON public.request_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all logs" ON public.request_logs
  FOR SELECT USING (is_admin_or_above(auth.uid()));

CREATE POLICY "System can insert logs" ON public.request_logs
  FOR INSERT WITH CHECK (true);

-- RLS Policies for system_settings
CREATE POLICY "Anyone can view non-sensitive settings" ON public.system_settings
  FOR SELECT USING (key NOT LIKE '%_secret%' AND key NOT LIKE '%_key%');

CREATE POLICY "Admins can view all settings" ON public.system_settings
  FOR SELECT USING (is_admin_or_above(auth.uid()));

CREATE POLICY "Super admins can manage settings" ON public.system_settings
  FOR ALL USING (has_role(auth.uid(), 'super_admin'));

-- RLS Policies for notifications
CREATE POLICY "Users can view their own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage notifications" ON public.notifications
  FOR ALL USING (is_admin_or_above(auth.uid()));

-- RLS Policies for announcements
CREATE POLICY "Anyone can view active announcements" ON public.announcements
  FOR SELECT USING (is_active = true AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at > now()));

CREATE POLICY "Admins can manage announcements" ON public.announcements
  FOR ALL USING (is_admin_or_above(auth.uid()));

-- RLS Policies for ip_blocklist
CREATE POLICY "Admins can manage blocklist" ON public.ip_blocklist
  FOR ALL USING (is_admin_or_above(auth.uid()));

-- RLS Policies for security_events
CREATE POLICY "Admins can view security events" ON public.security_events
  FOR SELECT USING (is_admin_or_above(auth.uid()));

CREATE POLICY "System can insert security events" ON public.security_events
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can update security events" ON public.security_events
  FOR UPDATE USING (is_admin_or_above(auth.uid()));

-- RLS Policies for feature_flags
CREATE POLICY "Anyone can view enabled flags" ON public.feature_flags
  FOR SELECT USING (is_enabled = true OR is_admin_or_above(auth.uid()));

CREATE POLICY "Admins can manage feature flags" ON public.feature_flags
  FOR ALL USING (is_admin_or_above(auth.uid()));

-- Create trigger for updated_at on new tables
CREATE TRIGGER update_user_credits_updated_at
  BEFORE UPDATE ON public.user_credits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_providers_updated_at
  BEFORE UPDATE ON public.providers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_feature_flags_updated_at
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to create user credits on profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user_credits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_credits (user_id, balance, daily_credits)
  VALUES (NEW.user_id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Trigger to auto-create credits record when profile is created
CREATE TRIGGER on_profile_created_create_credits
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_credits();

-- Insert default system settings
INSERT INTO public.system_settings (key, value, description) VALUES
  ('maintenance_mode', 'false', 'Enable/disable maintenance mode'),
  ('maintenance_message', '"System is under maintenance. Please try again later."', 'Message shown during maintenance'),
  ('read_only_mode', 'false', 'Enable/disable read-only mode'),
  ('default_rpm', '60', 'Default requests per minute limit'),
  ('default_rpd', '1000', 'Default requests per day limit'),
  ('daily_free_credits', '10', 'Free credits given daily to users'),
  ('new_user_credits', '50', 'Credits given to new users'),
  ('emergency_shutdown', 'false', 'Emergency shutdown flag'),
  ('max_prompt_length', '1000', 'Maximum prompt character length'),
  ('enable_vpn_detection', 'false', 'Enable VPN/Proxy detection'),
  ('enable_prompt_filtering', 'true', 'Enable NSFW prompt filtering'),
  ('auto_ban_threshold', '10', 'Number of violations before auto-ban')
ON CONFLICT (key) DO NOTHING;