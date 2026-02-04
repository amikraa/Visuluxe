import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { devLog } from '@/lib/logger';

/**
 * Hook to generate and manage signed URLs for avatar images
 * Signed URLs expire after 1 hour and are automatically refreshed
 */
export function useSignedAvatarUrl(avatarPath: string | null | undefined) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!avatarPath) {
      setSignedUrl(null);
      return;
    }

    // Check if it's already a full URL (legacy data) - if so, use it directly
    if (avatarPath.startsWith('http://') || avatarPath.startsWith('https://')) {
      setSignedUrl(avatarPath);
      return;
    }

    const generateSignedUrl = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: signError } = await supabase.storage
          .from('avatars')
          .createSignedUrl(avatarPath, 3600); // 1 hour expiry

        if (signError) {
          throw signError;
        }

        setSignedUrl(data?.signedUrl || null);
      } catch (err) {
        devLog.error('Failed to generate signed URL:', err);
        setError('Failed to load avatar');
        setSignedUrl(null);
      } finally {
        setLoading(false);
      }
    };

    generateSignedUrl();

    // Refresh the signed URL every 50 minutes (before it expires)
    const refreshInterval = setInterval(generateSignedUrl, 50 * 60 * 1000);

    return () => clearInterval(refreshInterval);
  }, [avatarPath]);

  return { signedUrl, loading, error };
}

/**
 * Utility function to generate a one-time signed URL
 * Use this for non-reactive scenarios
 */
export async function getSignedAvatarUrl(avatarPath: string | null | undefined): Promise<string | null> {
  if (!avatarPath) return null;

  // Check if it's already a full URL (legacy data)
  if (avatarPath.startsWith('http://') || avatarPath.startsWith('https://')) {
    return avatarPath;
  }

  try {
    const { data, error } = await supabase.storage
      .from('avatars')
      .createSignedUrl(avatarPath, 3600); // 1 hour expiry

    if (error) {
      devLog.error('Failed to generate signed URL:', error);
      return null;
    }

    return data?.signedUrl || null;
  } catch (err) {
    devLog.error('Failed to generate signed URL:', err);
    return null;
  }
}
