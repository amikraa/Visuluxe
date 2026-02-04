-- Add RLS policy to allow any authenticated user to SELECT an invite by token
-- This is needed for invite validation before redemption
CREATE POLICY "Users can view invites by token"
ON public.admin_invites
FOR SELECT
TO authenticated
USING (true);

-- Also add a policy for unauthenticated users to validate invites
-- They need to see if an invite is valid before signing in
CREATE POLICY "Anyone can validate invites by token"
ON public.admin_invites
FOR SELECT
TO anon
USING (true);