import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Shield, AlertTriangle, CheckCircle2, Loader2, Crown } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { devLog } from '@/lib/logger';

interface UserProfile {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

export default function AdminBootstrap() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isBootstrapped, setIsBootstrapped] = useState<boolean | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [bootstrapKey, setBootstrapKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    checkBootstrapStatus();
  }, []);

  const checkBootstrapStatus = async () => {
    try {
      const { data, error } = await supabase.rpc('is_system_bootstrapped');
      
      if (error) throw error;
      
      setIsBootstrapped(data);
      
      if (!data) {
        // System not bootstrapped, fetch users
        await fetchUsers();
      }
    } catch (error) {
      devLog.error('Error checking bootstrap status:', error);
      toast.error('Failed to check system status');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, display_name, username, avatar_url')
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      setUsers(data || []);
    } catch (error) {
      devLog.error('Error fetching users:', error);
      toast.error('Failed to load users');
    }
  };

  const handleBootstrap = async () => {
    if (!selectedUserId || !bootstrapKey) {
      toast.error('Please select a user and enter the bootstrap key');
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('bootstrap_owner', {
        _user_id: selectedUserId,
        _bootstrap_key: bootstrapKey
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; message?: string };

      if (result.success) {
        toast.success('Owner bootstrapped successfully!');
        setIsBootstrapped(true);
        
        // If current user is the new owner, redirect to admin
        if (selectedUserId === user?.id) {
          setTimeout(() => navigate('/admin'), 1500);
        }
      } else {
        toast.error(result.error || 'Bootstrap failed');
      }
    } catch (error: any) {
      devLog.error('Bootstrap error:', error);
      toast.error('Failed to bootstrap owner');
    } finally {
      setSubmitting(false);
    }
  };

  const getInitials = (profile: UserProfile) => {
    if (profile.display_name) {
      return profile.display_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    if (profile.username) {
      return profile.username.slice(0, 2).toUpperCase();
    }
    return 'U';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isBootstrapped) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
            <CardTitle>System Already Bootstrapped</CardTitle>
            <CardDescription>
              The system owner has already been designated. This page is no longer accessible.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button onClick={() => navigate('/admin/login')}>
              Go to Admin Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-2xl w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">System Bootstrap</CardTitle>
          <CardDescription>
            One-time setup to designate the system owner (super_admin)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Critical Security Action</AlertTitle>
            <AlertDescription>
              This action can only be performed once. The selected user will become the permanent system owner with full administrative privileges. This cannot be undone.
            </AlertDescription>
          </Alert>

          {users.length === 0 ? (
            <Alert>
              <AlertDescription>
                No users found. Please ensure at least one user has signed up before bootstrapping.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="space-y-3">
                <Label>Select User to Become Owner</Label>
                <div className="grid gap-2 max-h-64 overflow-y-auto border rounded-lg p-2">
                  {users.map((profile) => (
                    <button
                      key={profile.user_id}
                      onClick={() => setSelectedUserId(profile.user_id)}
                      className={`flex items-center gap-3 p-3 rounded-lg transition-colors text-left w-full ${
                        selectedUserId === profile.user_id
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted'
                      }`}
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={profile.avatar_url || undefined} />
                        <AvatarFallback>{getInitials(profile)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {profile.display_name || profile.username || 'Unnamed User'}
                        </p>
                        {profile.username && profile.display_name && (
                          <p className={`text-sm truncate ${
                            selectedUserId === profile.user_id 
                              ? 'text-primary-foreground/70' 
                              : 'text-muted-foreground'
                          }`}>
                            @{profile.username}
                          </p>
                        )}
                      </div>
                      {selectedUserId === profile.user_id && (
                        <Crown className="h-5 w-5 flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bootstrap-key">Bootstrap Key</Label>
                <Input
                  id="bootstrap-key"
                  type="password"
                  placeholder="Enter the secure bootstrap key"
                  value={bootstrapKey}
                  onChange={(e) => setBootstrapKey(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  This key was set during system configuration for security.
                </p>
              </div>

              <Button
                onClick={handleBootstrap}
                disabled={!selectedUserId || !bootstrapKey || submitting}
                className="w-full"
                size="lg"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Bootstrapping...
                  </>
                ) : (
                  <>
                    <Shield className="mr-2 h-4 w-4" />
                    Designate as System Owner
                  </>
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
