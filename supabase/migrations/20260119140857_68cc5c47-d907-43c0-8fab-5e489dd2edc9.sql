-- Insert default system settings
INSERT INTO public.system_settings (key, value, description) VALUES
  ('maintenance_mode', 'false', 'Enable/disable maintenance mode'),
  ('maintenance_message', '"System is under maintenance. Please try again later."', 'Message shown during maintenance'),
  ('default_rpm', '60', 'Default requests per minute limit'),
  ('default_rpd', '1000', 'Default requests per day limit'),
  ('daily_free_credits', '10', 'Free daily credits for new users'),
  ('vpn_detection_enabled', 'false', 'Enable VPN/proxy detection'),
  ('prompt_filtering_enabled', 'true', 'Enable content filtering for prompts'),
  ('auto_ban_threshold', '100', 'Number of violations before auto-ban'),
  ('emergency_shutdown', 'false', 'Emergency shutdown flag'),
  ('read_only_mode', 'false', 'Enable read-only mode')
ON CONFLICT (key) DO NOTHING;

-- Create trigger to automatically create user_credits when profile is created
CREATE OR REPLACE FUNCTION public.handle_new_user_credits()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_credits (user_id, balance, daily_credits)
  VALUES (NEW.user_id, 0, 10)  -- Start with 10 daily credits
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_profile_created_add_credits ON public.profiles;
CREATE TRIGGER on_profile_created_add_credits
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_credits();

-- Create credits for existing users who don't have them
INSERT INTO public.user_credits (user_id, balance, daily_credits)
SELECT p.user_id, 0, 10
FROM public.profiles p
LEFT JOIN public.user_credits uc ON p.user_id = uc.user_id
WHERE uc.id IS NULL;