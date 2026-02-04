-- Fix overly permissive RLS policies

-- Drop and recreate the permissive INSERT policies
DROP POLICY IF EXISTS "System can insert transactions" ON public.credits_transactions;
DROP POLICY IF EXISTS "System can insert logs" ON public.request_logs;
DROP POLICY IF EXISTS "System can insert security events" ON public.security_events;

-- Recreate with proper checks (service role or authenticated user for their own data)
CREATE POLICY "Users can insert their own transactions" ON public.credits_transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can insert any transactions" ON public.credits_transactions
  FOR INSERT WITH CHECK (is_admin_or_above(auth.uid()));

CREATE POLICY "Users can insert their own logs" ON public.request_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can insert any logs" ON public.request_logs
  FOR INSERT WITH CHECK (is_admin_or_above(auth.uid()));

CREATE POLICY "Admins can insert security events" ON public.security_events
  FOR INSERT WITH CHECK (is_admin_or_above(auth.uid()));