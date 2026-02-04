import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useSignedAvatarUrl } from '@/hooks/useSignedAvatarUrl';
import { validateProfileUpdate } from '@/lib/validation';
import { getProfileErrorMessage, getStorageErrorMessage } from '@/lib/errorUtils';
import { Input } from '@/components/ui/input';
import { X, Check, Pencil, Camera, User } from 'lucide-react';

interface ProfilePopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProfilePopup({ isOpen, onClose }: ProfilePopupProps) {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [validationErrors, setValidationErrors] = useState<{ displayName?: string; username?: string }>({});

  const avatarPath = profile?.avatar_url || user?.user_metadata?.avatar_url;
  const { signedUrl: avatarUrl } = useSignedAvatarUrl(avatarPath);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '');
      setUsername(profile.username || '');
    }
  }, [profile]);

  // Reset editing state when popup closes
  useEffect(() => {
    if (!isOpen) {
      setEditingProfile(false);
      setValidationErrors({});
    }
  }, [isOpen]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast({ 
        title: 'Invalid file type', 
        description: 'Please upload a JPEG, PNG, GIF, or WebP image.', 
        variant: 'destructive' 
      });
      return;
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({ 
        title: 'File too large', 
        description: 'Please upload an image smaller than 5MB.', 
        variant: 'destructive' 
      });
      return;
    }

    setUploadingAvatar(true);

    try {
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const filePath = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: filePath })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      await refreshProfile();
      toast({ title: 'Avatar updated!' });
    } catch (error: unknown) {
      toast({ title: 'Upload failed', description: getStorageErrorMessage(error), variant: 'destructive' });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleProfileUpdate = async () => {
    if (!user) return;

    setValidationErrors({});

    try {
      const validatedData = validateProfileUpdate({
        displayName: displayName,
        username: username,
      });

      // Use upsert to handle cases where profile might not exist
      const { data, error } = await supabase
        .from('profiles')
        .upsert({ 
          user_id: user.id,
          display_name: validatedData.displayName,
          username: validatedData.username,
        }, {
          onConflict: 'user_id'
        })
        .select();

      if (error) throw error;

      // Check if update actually happened
      if (!data || data.length === 0) {
        throw new Error('Profile update failed - no rows affected');
      }

      await refreshProfile();
      setEditingProfile(false);
      toast({ title: 'Profile updated!' });
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes('Username') || 
          error instanceof Error && error.message.includes('Display name')) {
        const errorMessage = error instanceof Error ? error.message : '';
        if (errorMessage.includes('Username')) {
          setValidationErrors({ username: errorMessage });
        } else if (errorMessage.includes('Display name')) {
          setValidationErrors({ displayName: errorMessage });
        }
        toast({ title: 'Validation error', description: errorMessage, variant: 'destructive' });
      } else {
        toast({ title: 'Update failed', description: getProfileErrorMessage(error), variant: 'destructive' });
      }
    }
  };

  const handleCancelEdit = () => {
    setEditingProfile(false);
    setDisplayName(profile?.display_name || '');
    setUsername(profile?.username || '');
    setValidationErrors({});
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-[55]" 
        onClick={onClose}
      />
      
      {/* Popup */}
      <div className="absolute right-0 top-12 w-80 rounded-xl border border-border bg-card backdrop-blur-xl shadow-xl z-[60] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface/50">
          <h3 className="font-semibold text-foreground text-sm">Profile & Account</h3>
          <div className="flex items-center gap-1">
            {!editingProfile ? (
              <button 
                onClick={() => setEditingProfile(true)} 
                className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                title="Edit Profile"
              >
                <Pencil className="w-4 h-4" />
              </button>
            ) : (
              <>
                <button 
                  onClick={handleCancelEdit} 
                  className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-surface rounded-lg transition-colors"
                  title="Cancel"
                >
                  <X className="w-4 h-4" />
                </button>
                <button 
                  onClick={handleProfileUpdate} 
                  className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                  title="Save"
                >
                  <Check className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Avatar & Info */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-14 h-14 rounded-full bg-primary/20 border border-border overflow-hidden flex items-center justify-center">
                {uploadingAvatar ? (
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                ) : avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
              <label className="absolute bottom-0 right-0 p-1 bg-primary rounded-full cursor-pointer hover:bg-primary/90 transition-colors shadow-lg">
                <Camera className="w-3 h-3 text-primary-foreground" />
                <input 
                  type="file" 
                  accept="image/jpeg,image/png,image/gif,image/webp" 
                  onChange={handleAvatarUpload} 
                  className="hidden" 
                  disabled={uploadingAvatar}
                />
              </label>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">
                {profile?.display_name || 'Set display name'}
              </p>
              <p className="text-sm text-muted-foreground truncate">
                @{profile?.username || 'set-username'}
              </p>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {user?.email}
              </p>
            </div>
          </div>

          {/* Editable Fields */}
          {editingProfile && (
            <div className="space-y-3 pt-3 border-t border-border">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Display Name</label>
                <Input 
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your display name"
                  className="bg-surface border-border h-9 text-sm"
                />
                {validationErrors.displayName && (
                  <p className="text-xs text-destructive">{validationErrors.displayName}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Username</label>
                <Input 
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="unique-username"
                  className="bg-surface border-border h-9 text-sm"
                />
                <p className="text-xs text-muted-foreground">Must be unique across all users</p>
                {validationErrors.username && (
                  <p className="text-xs text-destructive">{validationErrors.username}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default ProfilePopup;
