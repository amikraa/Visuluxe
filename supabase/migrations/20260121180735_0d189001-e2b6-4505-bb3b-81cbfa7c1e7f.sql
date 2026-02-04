-- Add resolution_notes column to security_events
ALTER TABLE public.security_events 
ADD COLUMN IF NOT EXISTS resolution_notes text;

-- Add index on resolved_at for faster filtering
CREATE INDEX IF NOT EXISTS idx_security_events_resolved_at 
ON public.security_events(resolved_at);

-- Add comment for documentation
COMMENT ON COLUMN public.security_events.resolution_notes IS 
  'Optional notes from the admin who resolved this incident';