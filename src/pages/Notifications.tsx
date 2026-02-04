import { useState, useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Check,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  Coins,
  Shield,
  Settings,
  Trash2,
  Paperclip,
  Download,
  Loader2,
} from "lucide-react";
import { GlobalNavbar } from "@/components/GlobalNavbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LoadingSkeleton, EmptyNotifications } from "@/components/shared";
import { useNotifications } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Notification = Tables<"notifications">;
type StatusFilter = "all" | "unread" | "read";
type TypeFilter = Notification["type"] | "all";

const ITEMS_PER_PAGE = 50;

function getNotificationIcon(type: Notification["type"]) {
  const iconClass = "w-5 h-5";
  switch (type) {
    case "success":
      return <CheckCircle2 className={cn(iconClass, "text-emerald-500")} />;
    case "warning":
      return <AlertTriangle className={cn(iconClass, "text-amber-500")} />;
    case "error":
      return <XCircle className={cn(iconClass, "text-destructive")} />;
    case "credit":
      return <Coins className={cn(iconClass, "text-purple-500")} />;
    case "security":
      return <Shield className={cn(iconClass, "text-blue-500")} />;
    case "system":
      return <Settings className={cn(iconClass, "text-muted-foreground")} />;
    default:
      return <Info className={cn(iconClass, "text-primary")} />;
  }
}

function getTypeBadgeVariant(type: Notification["type"]) {
  switch (type) {
    case "success":
      return "default";
    case "warning":
      return "secondary";
    case "error":
      return "destructive";
    default:
      return "outline";
  }
}

interface NotificationRowProps {
  notification: Notification;
  selected: boolean;
  onSelect: (selected: boolean) => void;
  onMarkAsRead: () => void;
  onDelete: () => void;
}

function NotificationRow({
  notification,
  selected,
  onSelect,
  onMarkAsRead,
  onDelete,
}: NotificationRowProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const isUnread = !notification.read_at;

  const handleDownloadAttachment = async () => {
    if (!notification.attachment_url) return;
    
    setIsDownloading(true);
    try {
      const { data, error } = await supabase.storage
        .from('notification-attachments')
        .download(notification.attachment_url);
      
      if (error) throw error;
      
      // Create download link
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = notification.attachment_name || 'attachment';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Attachment downloaded');
    } catch (error: any) {
      console.error('Failed to download attachment:', error);
      toast.error('Failed to download attachment');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <>
      <div
        className={cn(
          "flex items-start gap-4 p-4 border-b last:border-0 transition-colors",
          isUnread && "bg-primary/5"
        )}
      >
        <Checkbox
          checked={selected}
          onCheckedChange={(checked) => onSelect(!!checked)}
          className="mt-1"
        />

        <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center flex-shrink-0">
          {getNotificationIcon(notification.type)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className={cn("font-medium", isUnread && "text-foreground")}>
              {notification.title}
            </h4>
            <Badge
              variant={getTypeBadgeVariant(notification.type)}
              className="text-xs capitalize"
            >
              {notification.type}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {notification.message}
          </p>
          
          {/* Attachment indicator */}
          {notification.attachment_url && notification.attachment_name && (
            <button
              onClick={handleDownloadAttachment}
              disabled={isDownloading}
              className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-muted/50 hover:bg-muted text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {isDownloading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Paperclip className="w-3.5 h-3.5" />
              )}
              <span className="truncate max-w-[200px]">{notification.attachment_name}</span>
              <Download className="w-3 h-3 ml-1" />
            </button>
          )}
          
          <p className="text-xs text-muted-foreground mt-2">
            {formatDistanceToNow(new Date(notification.created_at), {
              addSuffix: true,
            })}
          </p>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {isUnread && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onMarkAsRead}
              title="Mark as read"
            >
              <Check className="w-4 h-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowDeleteConfirm(true)}
            title="Delete notification"
          >
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      </div>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Notification</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this notification? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onDelete();
                setShowDeleteConfirm(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default function Notifications() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);

  const {
    notifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    isLoading,
  } = useNotifications();

  // Filter notifications
  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      // Status filter
      if (statusFilter === "unread" && n.read_at) return false;
      if (statusFilter === "read" && !n.read_at) return false;
      // Type filter
      if (typeFilter !== "all" && n.type !== typeFilter) return false;
      return true;
    });
  }, [notifications, statusFilter, typeFilter]);

  // Paginate
  const paginatedNotifications = filteredNotifications.slice(
    0,
    page * ITEMS_PER_PAGE
  );
  const hasMore = paginatedNotifications.length < filteredNotifications.length;

  // Bulk mark as read
  const handleBulkMarkAsRead = async () => {
    await Promise.all([...selectedIds].map((id) => markAsRead(id)));
    setSelectedIds(new Set());
  };

  // Toggle selection
  const toggleSelection = (id: string, selected: boolean) => {
    const newSet = new Set(selectedIds);
    if (selected) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedIds(newSet);
  };

  // Select all visible
  const selectAll = () => {
    if (selectedIds.size === paginatedNotifications.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedNotifications.map((n) => n.id)));
    }
  };

  const allSelected =
    paginatedNotifications.length > 0 &&
    selectedIds.size === paginatedNotifications.length;

  return (
    <>
      <GlobalNavbar />
      <main className="min-h-screen pt-24 pb-12 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">Notifications</h1>
            <Button variant="outline" onClick={() => markAllAsRead()}>
              Mark All as Read
            </Button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4 mb-6">
            {/* Status Tabs */}
            <Tabs
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as StatusFilter)}
            >
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="unread">Unread</TabsTrigger>
                <TabsTrigger value="read">Read</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Type Filter */}
            <Select
              value={typeFilter}
              onValueChange={(v) => setTypeFilter(v as TypeFilter)}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="credit">Credit</SelectItem>
                <SelectItem value="security">Security</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>

            {/* Bulk Actions */}
            {selectedIds.size > 0 && (
              <Button onClick={handleBulkMarkAsRead} size="sm">
                Mark {selectedIds.size} as Read
              </Button>
            )}
          </div>

          {/* Notification List */}
          <div className="bg-card/40 backdrop-blur-xl rounded-xl border border-border overflow-hidden">
            {isLoading ? (
              <div className="p-4">
                <LoadingSkeleton variant="list" count={5} />
              </div>
            ) : paginatedNotifications.length > 0 ? (
              <>
                {/* Select all header */}
                <div className="flex items-center gap-3 p-3 border-b bg-muted/30">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={() => selectAll()}
                  />
                  <span className="text-sm text-muted-foreground">
                    {allSelected
                      ? "Deselect all"
                      : `Select all (${paginatedNotifications.length})`}
                  </span>
                </div>

                {paginatedNotifications.map((notification) => (
                  <NotificationRow
                    key={notification.id}
                    notification={notification}
                    selected={selectedIds.has(notification.id)}
                    onSelect={(selected) =>
                      toggleSelection(notification.id, selected)
                    }
                    onMarkAsRead={() => markAsRead(notification.id)}
                    onDelete={() => deleteNotification(notification.id)}
                  />
                ))}

                {hasMore && (
                  <div className="p-4 text-center border-t">
                    <Button
                      variant="outline"
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Load More ({filteredNotifications.length - paginatedNotifications.length} remaining)
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="p-8">
                <EmptyNotifications />
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
