-- Fix security warnings using pgcrypto extension

-- 1. Fix function search_path for generate_invite_token using extensions schema
CREATE OR REPLACE FUNCTION public.generate_invite_token()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT encode(extensions.gen_random_bytes(32), 'hex')
$$;

-- 2. Fix the permissive RLS policy for audit logs insert
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "System can insert audit logs" ON public.admin_audit_logs;

-- Create a more restrictive policy - only authenticated users with admin access can trigger inserts
-- The triggers use SECURITY DEFINER so they bypass RLS anyway
-- For manual logging via log_admin_action, require admin access
CREATE POLICY "Admins can insert audit logs"
ON public.admin_audit_logs
FOR INSERT
WITH CHECK (is_admin_or_above(auth.uid()));