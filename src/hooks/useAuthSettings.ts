import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface AuthSettings {
  otpEnabled: boolean;
  magicLinkEnabled: boolean;
  dailyFreeCredits: number;
  defaultRpm: number;
  defaultRpd: number;
}

export function useAuthSettings() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['auth-settings'],
    queryFn: async (): Promise<AuthSettings> => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', [
          'otp_auth_enabled',
          'magic_link_enabled',
          'daily_free_credits',
          'default_rpm',
          'default_rpd'
        ]);
      
      if (error) throw error;
      
      const settings: Record<string, unknown> = {};
      data?.forEach(s => {
        try {
          // Handle both string "true"/"false" and actual booleans
          const val = s.value;
          if (typeof val === 'string') {
            if (val === 'true') settings[s.key] = true;
            else if (val === 'false') settings[s.key] = false;
            else if (val === 'null') settings[s.key] = null;
            else if (!isNaN(Number(val))) settings[s.key] = Number(val);
            else settings[s.key] = val;
          } else {
            settings[s.key] = val;
          }
        } catch {
          settings[s.key] = s.value;
        }
      });
      
      return {
        otpEnabled: settings.otp_auth_enabled === true,
        magicLinkEnabled: settings.magic_link_enabled === true,
        dailyFreeCredits: Number(settings.daily_free_credits) || 10,
        defaultRpm: Number(settings.default_rpm) || 60,
        defaultRpd: Number(settings.default_rpd) || 1000,
      };
    },
    staleTime: 30000, // Cache for 30 seconds
  });

  return {
    otpEnabled: data?.otpEnabled ?? false,
    magicLinkEnabled: data?.magicLinkEnabled ?? false,
    dailyFreeCredits: data?.dailyFreeCredits ?? 10,
    defaultRpm: data?.defaultRpm ?? 60,
    defaultRpd: data?.defaultRpd ?? 1000,
    isLoading,
    error,
  };
}
