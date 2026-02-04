-- Fix: Restrict audit log INSERT to trusted functions only (not direct admin inserts)
-- This prevents malicious admins from creating false audit trails

-- Drop the existing insert policy that allows any admin to insert
DROP POLICY IF EXISTS "Admins can insert audit logs" ON public.admin_audit_logs;

-- Create a new restrictive policy that only allows inserts from SECURITY DEFINER functions
-- Since all our audit logging goes through log_admin_action() and trigger functions,
-- direct inserts will be blocked (RLS is applied to direct queries, not SECURITY DEFINER functions)
CREATE POLICY "Only system functions can insert audit logs"
  ON public.admin_audit_logs
  FOR INSERT
  WITH CHECK (false);  -- No direct inserts allowed - all inserts go through SECURITY DEFINER functions

-- Note: The log_admin_action() function and audit trigger functions are SECURITY DEFINER
-- so they bypass RLS and can still insert audit logs. Direct user queries cannot.