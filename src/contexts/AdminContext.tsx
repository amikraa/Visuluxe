import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { devLog } from '@/lib/logger';

export type AppRole = 'super_admin' | 'admin' | 'moderator' | 'support' | 'analyst' | 'user';
export type AccountType = 'normal' | 'partner';

interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  is_owner: boolean;
  created_at: string;
  updated_at: string;
}

interface AdminContextType {
  userRole: AppRole | null;
  isOwner: boolean;
  accountType: AccountType;
  loading: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isModerator: boolean;
  isSupport: boolean;
  isAnalyst: boolean;
  canAccessAdmin: boolean;
  refreshRole: () => Promise<void>;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [accountType, setAccountType] = useState<AccountType>('normal');
  const [loading, setLoading] = useState(true);

  const fetchUserRole = useCallback(async () => {
    if (!user) {
      setUserRole(null);
      setIsOwner(false);
      setAccountType('normal');
      setLoading(false);
      return;
    }

    try {
      // Fetch user's role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', user.id)
        .order('role')
        .limit(1)
        .maybeSingle();

      if (roleError) {
        devLog.error('Error fetching user role:', roleError);
      }

      if (roleData) {
        setUserRole(roleData.role as AppRole);
        setIsOwner(roleData.is_owner || false);
      } else {
        // Default to 'user' if no role assigned
        setUserRole('user');
        setIsOwner(false);
      }

      // Fetch account type from profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('account_type')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError) {
        devLog.error('Error fetching account type:', profileError);
      }

      if (profileData?.account_type) {
        setAccountType(profileData.account_type as AccountType);
      } else {
        setAccountType('normal');
      }
    } catch (error) {
      devLog.error('Error in fetchUserRole:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchUserRole();
  }, [fetchUserRole]);

  const isSuperAdmin = userRole === 'super_admin';
  const isAdmin = userRole === 'super_admin' || userRole === 'admin';
  const isModerator = userRole === 'super_admin' || userRole === 'admin' || userRole === 'moderator';
  const isSupport = isModerator || userRole === 'support';
  const isAnalyst = isModerator || userRole === 'analyst';
  const canAccessAdmin = isModerator || userRole === 'support' || userRole === 'analyst';

  const value: AdminContextType = {
    userRole,
    isOwner,
    accountType,
    loading,
    isSuperAdmin,
    isAdmin,
    isModerator,
    isSupport,
    isAnalyst,
    canAccessAdmin,
    refreshRole: fetchUserRole,
  };

  return (
    <AdminContext.Provider value={value}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
}
