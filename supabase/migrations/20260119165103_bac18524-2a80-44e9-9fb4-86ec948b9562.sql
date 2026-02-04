-- Fix overly permissive RLS policies on credits_transactions and request_logs tables

-- 1. Drop the overly permissive policy on credits_transactions
DROP POLICY IF EXISTS "System can insert transactions" ON public.credits_transactions;

-- 2. Drop the overly permissive policy on request_logs  
DROP POLICY IF EXISTS "System can insert logs" ON public.request_logs;

-- The remaining policies are already properly scoped:
-- credits_transactions:
--   - "Users can insert their own transactions" WITH CHECK (auth.uid() = user_id)
--   - "Admins can insert any transactions" WITH CHECK (is_admin_or_above(auth.uid()))
--   - "Users can view their own transactions" USING (auth.uid() = user_id)
--   - "Admins can view all transactions" USING (is_admin_or_above(auth.uid()))
--
-- request_logs:
--   - "Users can insert their own logs" WITH CHECK (auth.uid() = user_id)
--   - "Admins can insert any logs" WITH CHECK (is_admin_or_above(auth.uid()))
--   - "Users can view their own logs" USING (auth.uid() = user_id)
--   - "Admins can view all logs" USING (is_admin_or_above(auth.uid()))