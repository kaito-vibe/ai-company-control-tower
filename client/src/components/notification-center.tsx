import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/utils";
import type { Notification } from "@shared/schema";
import { Bell, Check, CheckCheck, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

const TYPE_ICONS: Record<string, string> = {
  task_completed: "✅",
  proposal_ready: "📋",
  agent_overloaded: "⚠️",
  meeting_scheduled: "📅",
  workflow_completed: "🔄",
  general: "ℹ️",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "border-l-blue-400",
  medium: "border-l-yellow-400",
  high: "border-l-red-400",
};

export function NotificationCenter() {
  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/notifications/stored"],
    refetchInterval: 5000,
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const markReadMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/notifications/stored/${id}`, { read: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications/stored"] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/notifications/stored/mark-all-read"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications/stored"] }),
  });

  const clearAllMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/notifications/stored/clear"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications/stored"] }),
  });

  const sorted = [...notifications].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="p-2 rounded-md hover:bg-muted transition-colors relative"
          aria-label="Notifications"
          data-testid="button-notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <h4 className="text-sm font-semibold">Notifications</h4>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px]"
                onClick={() => markAllReadMutation.mutate()}
                data-testid="button-mark-all-read"
              >
                <CheckCheck className="h-3 w-3 mr-1" />
                Read all
              </Button>
            )}
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px] text-destructive hover:text-destructive"
                onClick={() => clearAllMutation.mutate()}
                data-testid="button-clear-notifications"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </div>
        <ScrollArea className="max-h-80">
          {sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">No notifications</p>
            </div>
          ) : (
            <div className="divide-y">
              {sorted.slice(0, 50).map(n => (
                <div
                  key={n.id}
                  className={`px-3 py-2 flex gap-2 border-l-2 ${PRIORITY_COLORS[n.priority] || ""} ${!n.read ? "bg-muted/30" : ""}`}
                  data-testid={`notification-${n.id}`}
                >
                  <span className="text-sm mt-0.5">{TYPE_ICONS[n.type] || "ℹ️"}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs ${!n.read ? "font-semibold" : ""}`}>{n.title}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{n.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(n.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {!n.read && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 shrink-0 mt-0.5"
                      onClick={() => markReadMutation.mutate(n.id)}
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
