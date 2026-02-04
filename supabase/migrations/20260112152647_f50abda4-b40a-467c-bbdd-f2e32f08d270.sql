-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'moderator', 'user');

-- Create enum for account types (separate from roles)
CREATE TYPE public.account_type AS ENUM ('normal', 'partner');

-- Create enum for model access levels
CREATE TYPE public.model_access_level AS ENUM ('public', 'partner_only', 'admin_only');

-- Create enum for model status
CREATE TYPE public.model_status AS ENUM ('active', 'beta', 'disabled', 'offline');

-- Create user_roles table (separate from profiles per security requirements)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role app_role NOT NULL DEFAULT 'user',
    is_owner BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    UNIQUE (user_id, role)
);

-- Add account_type to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS account_type account_type NOT NULL DEFAULT 'normal';

-- Create ai_models table
CREATE TABLE public.ai_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    model_id TEXT NOT NULL UNIQUE,
    engine_type TEXT NOT NULL,
    category TEXT NOT NULL,
    status model_status NOT NULL DEFAULT 'active',
    credits_cost DECIMAL(10, 6) NOT NULL DEFAULT 0.001,
    access_level model_access_level NOT NULL DEFAULT 'public',
    rpm INTEGER NOT NULL DEFAULT 60,
    rpd INTEGER NOT NULL DEFAULT 1000,
    usage_count BIGINT NOT NULL DEFAULT 0,
    api_endpoint TEXT,
    api_key_encrypted TEXT,
    description TEXT,
    is_partner_only BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_models ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to check if user is admin or above
CREATE OR REPLACE FUNCTION public.is_admin_or_above(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin', 'admin')
  )
$$;

-- Create function to check if user is moderator or above
CREATE OR REPLACE FUNCTION public.is_moderator_or_above(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin', 'admin', 'moderator')
  )
$$;

-- Create function to check if user is owner
CREATE OR REPLACE FUNCTION public.is_owner(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'super_admin'
      AND is_owner = true
  )
$$;

-- Create function to get user's highest role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY 
    CASE role
      WHEN 'super_admin' THEN 1
      WHEN 'admin' THEN 2
      WHEN 'moderator' THEN 3
      WHEN 'user' THEN 4
    END
  LIMIT 1
$$;

-- Create function to get user's account type
CREATE OR REPLACE FUNCTION public.get_account_type(_user_id UUID)
RETURNS account_type
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(account_type, 'normal'::account_type)
  FROM public.profiles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- RLS Policies for user_roles

-- Users can view their own roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all roles
CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
USING (public.is_admin_or_above(auth.uid()));

-- Only super_admin can insert roles
CREATE POLICY "Super admins can insert roles"
ON public.user_roles
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Only super_admin can update roles (with owner protection)
CREATE POLICY "Super admins can update roles"
ON public.user_roles
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'super_admin')
  AND NOT (is_owner = true AND user_id != auth.uid()) -- Cannot modify owner unless you are the owner
  AND NOT (is_owner = true AND auth.uid() = user_id) -- Owner cannot demote themselves
);

-- Only super_admin can delete roles (owner can never be deleted)
CREATE POLICY "Super admins can delete roles except owner"
ON public.user_roles
FOR DELETE
USING (
  public.has_role(auth.uid(), 'super_admin')
  AND is_owner = false -- Owner role can never be deleted
);

-- RLS Policies for ai_models

-- Public models visible to all authenticated users
CREATE POLICY "Users can view public models"
ON public.ai_models
FOR SELECT
USING (
  access_level = 'public' 
  OR (access_level = 'partner_only' AND (
    public.get_account_type(auth.uid()) = 'partner' 
    OR public.is_admin_or_above(auth.uid())
  ))
  OR (access_level = 'admin_only' AND public.is_admin_or_above(auth.uid()))
);

-- Only admins can insert models
CREATE POLICY "Admins can insert models"
ON public.ai_models
FOR INSERT
WITH CHECK (public.is_admin_or_above(auth.uid()));

-- Only admins can update models
CREATE POLICY "Admins can update models"
ON public.ai_models
FOR UPDATE
USING (public.is_admin_or_above(auth.uid()));

-- Only super_admins can delete models
CREATE POLICY "Super admins can delete models"
ON public.ai_models
FOR DELETE
USING (public.has_role(auth.uid(), 'super_admin'));

-- Create trigger for updated_at on user_roles
CREATE TRIGGER update_user_roles_updated_at
BEFORE UPDATE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for updated_at on ai_models
CREATE TRIGGER update_ai_models_updated_at
BEFORE UPDATE ON public.ai_models
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create constraint to ensure at least one owner exists
-- This is enforced at application level since SQL constraints can't easily do this

-- Create index for faster role lookups
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_role ON public.user_roles(role);
CREATE INDEX idx_ai_models_status ON public.ai_models(status);
CREATE INDEX idx_ai_models_access_level ON public.ai_models(access_level);