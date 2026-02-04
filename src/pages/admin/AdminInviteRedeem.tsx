import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, Shield, UserPlus, Crown, Eye, Clock, Link } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useAdmin } from '@/contexts/AdminContext';
import { formatDistanceToNow } from 'date-fns';
import { devLog } from '@/lib/logger';

interface InviteData {
  role: string;
  expires_at: string;
  used_at: string | null;
}

export default function AdminInviteRedeem() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { refreshRole } = useAdmin();
  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid' | 'success' | 'error'>('loading');
  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [redeeming, setRedeeming] = useState(false);

  useEffect(() => {
    if (token) {
      validateInvite();
    } else {
      setStatus('invalid');
      setErrorMessage('No invite token provided');
    }
  }, [token]);

  const validateInvite = async () => {
    try {
      // Use secure RPC function to validate token without exposing all tokens
      const { data, error } = await supabase.rpc('validate_invite_token', {
        _token: token
      });

      if (error) throw error;

      const result = data as { valid: boolean; error?: string; role?: string; expires_at?: string };

      if (!result.valid) {
        setStatus('invalid');
        setErrorMessage(result.error || 'Invalid invite token');
        return;
      }

      setInviteData({
        role: result.role!,
        expires_at: result.expires_at!,
        used_at: null
      });
      setStatus('valid');
    } catch (error: any) {
      devLog.error('Error validating invite:', error);
      setStatus('error');
      setErrorMessage('Failed to validate invite');
    }
  };

  const handleRedeem = async () => {
    if (!user) {
      toast.error('Please sign in to redeem this invite');
      navigate('/signin', { state: { returnTo: `/admin/invite/${token}` } });
      return;
    }

    setRedeeming(true);
    try {
      const { data, error } = await supabase.rpc('redeem_admin_invite', {
        _token: token
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; role?: string };

      if (result.success) {
        setStatus('success');
        const roleDisplay = result.role === 'super_admin' ? 'Super Admin' : result.role;
        toast.success(`You are now ${result.role === 'admin' ? 'an' : 'a'} ${roleDisplay}!`);
        await refreshRole();
        setTimeout(() => navigate('/admin'), 2000);
      } else {
        setStatus('error');
        setErrorMessage(result.error || 'Failed to redeem invite');
        toast.error(result.error || 'Failed to redeem invite');
      }
    } catch (error: any) {
      devLog.error('Redeem error:', error);
      setStatus('error');
      setErrorMessage('Failed to redeem invite');
      toast.error('Failed to redeem invite');
    } finally {
      setRedeeming(false);
    }
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-400 border-amber-500/30';
      case 'admin':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'moderator':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'super_admin':
        return <Crown className="h-4 w-4" />;
      case 'admin':
        return <Shield className="h-4 w-4" />;
      case 'moderator':
        return <Eye className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'Super Admin';
      case 'admin':
        return 'Admin';
      case 'moderator':
        return 'Moderator';
      default:
        return role;
    }
  };

  const getRoleDescription = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'As a Super Admin, you\'ll have full system control including user management, model configuration, system settings, and the ability to create other admins.';
      case 'admin':
        return 'As an Admin, you\'ll be able to manage AI models, view system stats, and handle user management.';
      case 'moderator':
        return 'As a Moderator, you\'ll be able to view user activity, flag abuse, and review content.';
      default:
        return '';
    }
  };

  const getExpiryDisplay = (expiresAt: string) => {
    try {
      return formatDistanceToNow(new Date(expiresAt), { addSuffix: true });
    } catch {
      return new Date(expiresAt).toLocaleDateString();
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Validating invite...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'invalid' || status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle>Invalid Invite</CardTitle>
            <CardDescription>{errorMessage}</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button variant="outline" onClick={() => navigate('/')}>
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
            <CardTitle>Welcome to the Team!</CardTitle>
            <CardDescription>
              Your role has been successfully assigned. Redirecting to admin panel...
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Badge className={`${getRoleBadgeClass(inviteData?.role || '')} flex items-center gap-1.5 px-3 py-1`}>
              {getRoleIcon(inviteData?.role || '')}
              {getRoleDisplayName(inviteData?.role || '')}
            </Badge>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Valid invite - show redemption UI
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className={`mx-auto mb-4 h-16 w-16 rounded-full flex items-center justify-center ${
            inviteData?.role === 'super_admin' 
              ? 'bg-gradient-to-br from-amber-500/20 to-yellow-500/20' 
              : 'bg-primary/10'
          }`}>
            {inviteData?.role === 'super_admin' ? (
              <Crown className="h-8 w-8 text-amber-500" />
            ) : (
              <Shield className="h-8 w-8 text-primary" />
            )}
          </div>
          <CardTitle>Admin Invite</CardTitle>
          <CardDescription>
            You've been invited to join the admin team
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Invite Details */}
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Invited Role</span>
              <Badge className={`${getRoleBadgeClass(inviteData?.role || '')} flex items-center gap-1.5 px-3 py-1`}>
                {getRoleIcon(inviteData?.role || '')}
                {getRoleDisplayName(inviteData?.role || '')}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Expires
              </span>
              <span className="text-sm font-medium">
                {inviteData?.expires_at ? getExpiryDisplay(inviteData.expires_at) : 'Unknown'}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Link className="h-3.5 w-3.5" />
                Usage
              </span>
              <Badge variant="outline" className="text-xs">One-time</Badge>
            </div>
          </div>

          <Alert>
            <AlertTitle>What this means</AlertTitle>
            <AlertDescription>
              {getRoleDescription(inviteData?.role || '')}
            </AlertDescription>
          </Alert>

          {!user ? (
            <div className="space-y-3">
              <Alert variant="destructive">
                <AlertDescription>
                  Please sign in to accept this invite.
                </AlertDescription>
              </Alert>
              <Button 
                className="w-full" 
                onClick={() => navigate('/signin', { state: { returnTo: `/admin/invite/${token}` } })}
              >
                Sign In to Continue
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleRedeem}
              disabled={redeeming}
              className={`w-full ${inviteData?.role === 'super_admin' ? 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-black' : ''}`}
              size="lg"
            >
              {redeeming ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Accepting Invite...
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Accept Invite
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
