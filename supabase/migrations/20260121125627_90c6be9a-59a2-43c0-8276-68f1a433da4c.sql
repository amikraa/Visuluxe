-- Add custom rate limit columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS custom_rpm integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS custom_rpd integer DEFAULT NULL;

-- Add check constraints for validation (drop first if exists to avoid errors)
DO $$ BEGIN
  ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_custom_rpm_positive;
  ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_custom_rpd_positive;
  ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_max_images_per_day_positive;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_custom_rpm_positive CHECK (custom_rpm IS NULL OR custom_rpm > 0),
ADD CONSTRAINT profiles_custom_rpd_positive CHECK (custom_rpd IS NULL OR custom_rpd > 0),
ADD CONSTRAINT profiles_max_images_per_day_positive CHECK (max_images_per_day IS NULL OR max_images_per_day > 0);

-- Add comments for documentation
COMMENT ON COLUMN public.profiles.custom_rpm IS 'Custom requests per minute limit. NULL = use system default';
COMMENT ON COLUMN public.profiles.custom_rpd IS 'Custom requests per day limit. NULL = use system default';