import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  id: string;
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  account_type: 'normal' | 'partner';
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (
    userId: string, 
    userEmail?: string, 
    userMeta?: Record<string, any>,
    appMetadata?: Record<string, any>
  ) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (!error && data) {
      // Check if Google user and sync profile if metadata changed
      const isGoogleUser = appMetadata?.provider === 'google' || 
                           appMetadata?.providers?.includes('google');
      
      if (isGoogleUser && userMeta) {
        const googleName = userMeta.full_name || userMeta.name;
        const googleAvatar = userMeta.avatar_url || userMeta.picture;
        
        // Compare with current profile values
        const nameChanged = googleName && googleName !== data.display_name;
        const avatarChanged = googleAvatar && googleAvatar !== data.avatar_url;
        
        if (nameChanged || avatarChanged) {
          // Validate avatar URL
          let validatedAvatar = googleAvatar;
          if (validatedAvatar && (validatedAvatar.length > 2048 || !validatedAvatar.startsWith('https://'))) {
            validatedAvatar = data.avatar_url; // Keep existing if invalid
          }
          
          const updates: Record<string, string> = {};
          if (nameChanged) updates.display_name = googleName;
          if (avatarChanged && validatedAvatar) updates.avatar_url = validatedAvatar;
          
          const { data: updatedProfile, error: updateError } = await supabase
            .from('profiles')
            .update(updates)
            .eq('user_id', userId)
            .select()
            .single();
          
          if (!updateError && updatedProfile) {
            setProfile(updatedProfile as Profile);
            console.log('Google profile re-synced for user:', userId, { nameChanged, avatarChanged });
            return;
          }
        }
      }
      
      setProfile(data as Profile);
      return;
    }
    
    // Profile doesn't exist - create it as fallback (defense in depth)
    // This is the PRIMARY guarantee for profile creation
    if (!data && userEmail) {
      const displayName = userMeta?.full_name || userMeta?.name || userEmail.split('@')[0];
      let avatarUrl = userMeta?.avatar_url || userMeta?.picture || null;
      
      // Validate avatar URL
      if (avatarUrl && (avatarUrl.length > 2048 || !avatarUrl.startsWith('https://'))) {
        avatarUrl = null;
      }
      
      const { data: newProfile, error: insertError } = await supabase
        .from('profiles')
        .upsert({
          user_id: userId,
          email: userEmail,
          display_name: displayName,
          avatar_url: avatarUrl
        }, { onConflict: 'user_id' })
        .select()
        .single();
      
      if (!insertError && newProfile) {
        setProfile(newProfile as Profile);
        console.log('Profile created via client fallback for user:', userId);
        
        // Also ensure user_credits exist
        await supabase
          .from('user_credits')
          .upsert({ user_id: userId, balance: 0, daily_credits: 10 }, { onConflict: 'user_id' });

        // Log fallback usage to audit trail via SECURITY DEFINER RPC
        supabase.rpc('log_profile_fallback_event', {
          _action: 'profile_created_via_fallback',
          _target_id: userId,
          _details: {
            source: 'client_fallback',
            email: userEmail,
            trigger_status: 'skipped_or_failed'
          }
        }).then(({ error: auditError }) => {
          if (auditError) {
            console.warn('Failed to log fallback audit entry:', auditError);
          }
        });
      } else if (insertError) {
        console.error('Failed to create profile via fallback:', insertError);
        
        // Log failure to audit trail via SECURITY DEFINER RPC
        supabase.rpc('log_profile_fallback_event', {
          _action: 'profile_creation_failed',
          _target_id: userId,
          _details: {
            source: 'client_fallback',
            error: insertError.message,
            email: userEmail
          }
        }).then(({ error: auditError }) => {
          if (auditError) {
            console.warn('Failed to log failure audit entry:', auditError);
          }
        });
      }
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer profile fetch with setTimeout to avoid deadlock
        // Pass user metadata for fallback profile creation
        if (session?.user) {
          setTimeout(() => {
            fetchProfile(
              session.user.id,
              session.user.email,
              session.user.user_metadata,
              session.user.app_metadata
            );
          }, 0);
        } else {
          setProfile(null);
        }
        
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchProfile(
          session.user.id,
          session.user.email,
          session.user.user_metadata,
          session.user.app_metadata
        );
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
