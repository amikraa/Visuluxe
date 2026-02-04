import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Bell, Send, Users, User, Paperclip, X, FileText, 
  CheckCircle2, AlertTriangle, XCircle, Info, Coins, Shield, Settings,
  Loader2, Search
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import type { Tables } from '@/integrations/supabase/types';

type NotificationType = Tables<'notifications'>['type'];

const NOTIFICATION_TYPES: { value: NotificationType; label: string; icon: React.ReactNode }[] = [
  { value: 'info', label: 'Info', icon: <Info className="h-4 w-4 text-primary" /> },
  { value: 'success', label: 'Success', icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" /> },
  { value: 'warning', label: 'Warning', icon: <AlertTriangle className="h-4 w-4 text-amber-500" /> },
  { value: 'error', label: 'Error', icon: <XCircle className="h-4 w-4 text-red-500" /> },
  { value: 'credit', label: 'Credit', icon: <Coins className="h-4 w-4 text-purple-500" /> },
  { value: 'security', label: 'Security', icon: <Shield className="h-4 w-4 text-blue-500" /> },
  { value: 'system', label: 'System', icon: <Settings className="h-4 w-4 text-slate-400" /> },
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export default function AdminNotifications() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Form state
  const [targetType, setTargetType] = useState<'all' | 'user'>('user');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [userSearch, setUserSearch] = useState('');
  const [notificationType, setNotificationType] = useState<NotificationType>('info');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [actionUrl, setActionUrl] = useState('');
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [isSending, setIsSending] = useState(false);

  // Fetch users for selection
  const { data: users = [] } = useQuery({
    queryKey: ['admin-users-simple'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, display_name, email')
        .order('display_name', { ascending: true })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  // Filter users based on search
  const filteredUsers = users.filter(u => 
    u.display_name?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email?.toLowerCase().includes(userSearch.toLowerCase())
  );

  // Fetch recent notifications
  const { data: recentNotifications = [], isLoading: notificationsLoading } = useQuery({
    queryKey: ['admin-recent-notifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*, profiles!notifications_user_id_fkey(display_name, email)')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > MAX_FILE_SIZE) {
      toast.error('File too large. Maximum size is 10MB.');
      return;
    }
    
    setAttachedFile(file);
  };

  const removeFile = () => {
    setAttachedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const sendNotification = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error('Title and message are required');
      return;
    }
    
    if (targetType === 'user' && !selectedUserId) {
      toast.error('Please select a user');
      return;
    }

    setIsSending(true);
    
    try {
      let attachmentUrl: string | null = null;
      let attachmentName: string | null = null;

      // Upload file if attached
      if (attachedFile) {
        const fileExt = attachedFile.name.split('.').pop();
        const fileName = `${Date.now()}-${crypto.randomUUID()}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('notification-attachments')
          .upload(fileName, attachedFile);
        
        if (uploadError) throw uploadError;
        
        attachmentUrl = uploadData.path;
        attachmentName = attachedFile.name;
      }

      // Prepare notifications
      const targetUsers = targetType === 'all' 
        ? users.map(u => u.user_id)
        : [selectedUserId];

      const notificationsToInsert = targetUsers.map(userId => ({
        user_id: userId,
        type: notificationType,
        title: title.trim(),
        message: message.trim(),
        action_url: actionUrl.trim() || null,
        attachment_url: attachmentUrl,
        attachment_name: attachmentName,
      }));

      const { error: insertError } = await supabase
        .from('notifications')
        .insert(notificationsToInsert);

      if (insertError) throw insertError;

      toast.success(
        targetType === 'all' 
          ? `Notification sent to ${targetUsers.length} users`
          : 'Notification sent successfully'
      );

      // Reset form
      setTitle('');
      setMessage('');
      setActionUrl('');
      setAttachedFile(null);
      setSelectedUserId('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      
      // Refresh recent notifications
      queryClient.invalidateQueries({ queryKey: ['admin-recent-notifications'] });
      
    } catch (error: any) {
      console.error('Failed to send notification:', error);
      toast.error(error.message || 'Failed to send notification');
    } finally {
      setIsSending(false);
    }
  };

  const getTypeIcon = (type: NotificationType) => {
    const found = NOTIFICATION_TYPES.find(t => t.value === type);
    return found?.icon || <Info className="h-4 w-4" />;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Notifications</h1>
        <p className="text-slate-400 text-sm mt-1">Send notifications to users with optional file attachments</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Send Notification Form */}
        <Card className="bg-admin-surface border-admin-border">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-admin-primary/20">
                <Send className="h-5 w-5 text-admin-primary" />
              </div>
              <div>
                <CardTitle className="text-white">Send Notification</CardTitle>
                <CardDescription className="text-slate-400">
                  Compose and send notifications to users
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Target Selection */}
            <div className="grid gap-2">
              <Label className="text-slate-300">Send To</Label>
              <div className="flex gap-2">
                <Button
                  variant={targetType === 'user' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTargetType('user')}
                  className={targetType === 'user' 
                    ? 'bg-admin-primary hover:bg-admin-primary/90' 
                    : 'border-admin-border text-slate-300'
                  }
                >
                  <User className="h-4 w-4 mr-1" />
                  Single User
                </Button>
                <Button
                  variant={targetType === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTargetType('all')}
                  className={targetType === 'all' 
                    ? 'bg-admin-primary hover:bg-admin-primary/90' 
                    : 'border-admin-border text-slate-300'
                  }
                >
                  <Users className="h-4 w-4 mr-1" />
                  All Users ({users.length})
                </Button>
              </div>
            </div>

            {/* User Selection (if single user) */}
            {targetType === 'user' && (
              <div className="grid gap-2">
                <Label className="text-slate-300">Select User</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <Input
                    placeholder="Search users..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="pl-9 bg-admin-background border-admin-border text-white"
                  />
                </div>
                <ScrollArea className="h-32 rounded-md border border-admin-border bg-admin-background">
                  <div className="p-2 space-y-1">
                    {filteredUsers.slice(0, 50).map((user) => (
                      <button
                        key={user.user_id}
                        onClick={() => {
                          setSelectedUserId(user.user_id);
                          setUserSearch(user.display_name || user.email || '');
                        }}
                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                          selectedUserId === user.user_id
                            ? 'bg-admin-primary/20 text-admin-primary'
                            : 'text-slate-300 hover:bg-admin-border/50'
                        }`}
                      >
                        <span className="font-medium">{user.display_name || 'No name'}</span>
                        <span className="text-slate-500 ml-2 text-xs">{user.email}</span>
                      </button>
                    ))}
                    {filteredUsers.length === 0 && (
                      <p className="text-slate-500 text-sm p-2">No users found</p>
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}

            <Separator className="bg-admin-border" />

            {/* Notification Type */}
            <div className="grid gap-2">
              <Label className="text-slate-300">Type</Label>
              <Select value={notificationType} onValueChange={(v) => setNotificationType(v as NotificationType)}>
                <SelectTrigger className="bg-admin-background border-admin-border text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NOTIFICATION_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        {type.icon}
                        <span>{type.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Title */}
            <div className="grid gap-2">
              <Label className="text-slate-300">Title</Label>
              <Input
                placeholder="Notification title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-admin-background border-admin-border text-white"
              />
            </div>

            {/* Message */}
            <div className="grid gap-2">
              <Label className="text-slate-300">Message</Label>
              <Textarea
                placeholder="Notification message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="bg-admin-background border-admin-border text-white min-h-[100px]"
              />
            </div>

            {/* Action URL (optional) */}
            <div className="grid gap-2">
              <Label className="text-slate-300">
                Action URL <span className="text-slate-500 text-xs">(optional)</span>
              </Label>
              <Input
                placeholder="/dashboard or https://..."
                value={actionUrl}
                onChange={(e) => setActionUrl(e.target.value)}
                className="bg-admin-background border-admin-border text-white"
              />
            </div>

            {/* File Attachment */}
            <div className="grid gap-2">
              <Label className="text-slate-300">
                Attachment <span className="text-slate-500 text-xs">(optional, max 10MB)</span>
              </Label>
              
              {attachedFile ? (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-admin-background border border-admin-border">
                  <FileText className="h-5 w-5 text-admin-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{attachedFile.name}</p>
                    <p className="text-xs text-slate-500">
                      {(attachedFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={removeFile}
                    className="flex-shrink-0 text-slate-400 hover:text-red-400"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="border-admin-border text-slate-300 border-dashed"
                >
                  <Paperclip className="h-4 w-4 mr-2" />
                  Attach File
                </Button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            <Separator className="bg-admin-border" />

            {/* Send Button */}
            <Button
              onClick={sendNotification}
              disabled={isSending || !title.trim() || !message.trim() || (targetType === 'user' && !selectedUserId)}
              className="w-full bg-admin-accent hover:bg-admin-accent-hover"
            >
              {isSending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Notification
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Recent Notifications */}
        <Card className="bg-admin-surface border-admin-border">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <Bell className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <CardTitle className="text-white">Recent Notifications</CardTitle>
                <CardDescription className="text-slate-400">
                  Last 20 notifications sent
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px] pr-4">
              {notificationsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                </div>
              ) : recentNotifications.length > 0 ? (
                <div className="space-y-3">
                  {recentNotifications.map((notification: any) => (
                    <div
                      key={notification.id}
                      className="p-3 rounded-lg bg-admin-background border border-admin-border"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          {getTypeIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-medium text-white truncate">
                              {notification.title}
                            </h4>
                            <Badge variant="outline" className="text-xs capitalize">
                              {notification.type}
                            </Badge>
                            {notification.attachment_name && (
                              <Badge variant="secondary" className="text-xs">
                                <Paperclip className="h-3 w-3 mr-1" />
                                Attachment
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                            {notification.message}
                          </p>
                          <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                            <span>
                              To: {notification.profiles?.display_name || notification.profiles?.email || 'Unknown'}
                            </span>
                            <span>•</span>
                            <span>
                              {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No notifications sent yet</p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
