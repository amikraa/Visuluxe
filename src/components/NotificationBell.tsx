import { useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import {
  Bell,
  Check,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  Coins,
  Shield,
  Settings,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LoadingSkeleton, EmptyNotifications } from "@/components/shared";
import { useNotifications } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type Notification = Tables<"notifications">;

interface NotificationBellProps {
  className?: string;
}

function getNotificationIcon(type: Notification["type"]) {
  switch (type) {
    case "success":
      return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    case "warning":
      return <AlertTriangle className="w-4 h-4 text-amber-500" />;
    case "error":
      return <XCircle className="w-4 h-4 text-destructive" />;
    case "credit":
      return <Coins className="w-4 h-4 text-purple-500" />;
    case "security":
      return <Shield className="w-4 h-4 text-blue-500" />;
    case "system":
      return <Settings className="w-4 h-4 text-muted-foreground" />;
    default:
      return <Info className="w-4 h-4 text-primary" />;
  }
}

function NotificationItem({
  notification,
  onMarkAsRead,
}: {
  notification: Notification;
  onMarkAsRead: () => void;
}) {
  const isUnread = !notification.read_at;

  return (
    <div
      className={cn(
        "flex gap-3 p-3 hover:bg-muted/50 transition-colors border-b last:border-0",
        isUnread && "bg-primary/5"
      )}
    >
      <div className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center flex-shrink-0">
        {getNotificationIcon(notification.type)}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm", isUnread && "font-medium")}>
          {notification.title}
        </p>
        <p className="text-xs text-muted-foreground line-clamp-2">
          {notification.message}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {formatDistanceToNow(new Date(notification.created_at), {
            addSuffix: true,
          })}
        </p>
      </div>
      {isUnread && (
        <Button
          variant="ghost"
          size="icon"
          className="flex-shrink-0 h-6 w-6"
          onClick={(e) => {
            e.stopPropagation();
            onMarkAsRead();
          }}
        >
          <Check className="w-3 h-3" />
        </Button>
      )}
    </div>
  );
}

export function NotificationBell({ className }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead, isLoading } =
    useNotifications();

  // Get recent 5 notifications
  const recentNotifications = notifications.slice(0, 5);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "relative p-2 rounded-xl hover:bg-muted/50 transition-all",
            className
          )}
        >
          <Bell className="w-5 h-5 text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h4 className="font-semibold">Notifications</h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllAsRead()}
              className="text-xs"
            >
              Mark all read
            </Button>
          )}
        </div>

        {/* Notification List */}
        <ScrollArea className="max-h-[300px]">
          {isLoading ? (
            <div className="p-3">
              <LoadingSkeleton variant="list" count={3} />
            </div>
          ) : recentNotifications.length > 0 ? (
            recentNotifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkAsRead={() => markAsRead(notification.id)}
              />
            ))
          ) : (
            <div className="p-4">
              <EmptyNotifications />
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="p-2 border-t">
          <Link
            to="/notifications"
            onClick={() => setIsOpen(false)}
            className="block text-center text-sm text-primary hover:underline py-2"
          >
            View All Notifications
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
