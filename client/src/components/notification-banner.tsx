import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { X, Bell, AlertTriangle, AlertCircle, Shield, FolderKanban, Workflow, CalendarClock, DollarSign } from "lucide-react";

interface Notification {
  type: string;
  message: string;
  link: string;
  priority: number;
}

export function NotificationBanner() {
  const [, navigate] = useLocation();
  const [dismissedMessage, setDismissedMessage] = useState<string | null>(null);

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    refetchInterval: 10000,
  });

  const topNotification = notifications[0];

  if (!topNotification || topNotification.message === dismissedMessage) return null;

  const colorMap: Record<string, string> = {
    proposals: "bg-blue-500/10 border-blue-500/30 text-blue-400",
    blocked: "bg-orange-500/10 border-orange-500/30 text-orange-400",
    overloaded: "bg-red-500/10 border-red-500/30 text-red-400",
    risks: "bg-red-500/10 border-red-500/30 text-red-400",
    project_complete: "bg-green-500/10 border-green-500/30 text-green-400",
    stalled_workflow: "bg-yellow-500/10 border-yellow-500/30 text-yellow-400",
    scheduled_upcoming: "bg-purple-500/10 border-purple-500/30 text-purple-400",
    budget_alert: "bg-red-500/10 border-red-500/30 text-red-400",
  };

  const iconMap: Record<string, React.ReactNode> = {
    proposals: <Bell className="h-3.5 w-3.5" />,
    blocked: <AlertTriangle className="h-3.5 w-3.5" />,
    overloaded: <AlertCircle className="h-3.5 w-3.5" />,
    risks: <Shield className="h-3.5 w-3.5" />,
    project_complete: <FolderKanban className="h-3.5 w-3.5" />,
    stalled_workflow: <Workflow className="h-3.5 w-3.5" />,
    scheduled_upcoming: <CalendarClock className="h-3.5 w-3.5" />,
    budget_alert: <DollarSign className="h-3.5 w-3.5" />,
  };

  const colors = colorMap[topNotification.type] || colorMap.proposals;
  const icon = iconMap[topNotification.type] || iconMap.proposals;

  return (
    <div className={`flex items-center gap-2 px-4 py-2 border-b text-sm ${colors}`}>
      {icon}
      <button
        className="flex-1 text-left hover:underline cursor-pointer"
        onClick={() => navigate(topNotification.link)}
      >
        {topNotification.message}
      </button>
      {notifications.length > 1 && (
        <span className="text-xs opacity-70">+{notifications.length - 1} more</span>
      )}
      <button
        onClick={() => setDismissedMessage(topNotification.message)}
        className="p-0.5 rounded hover:bg-white/10 transition-colors"
        aria-label="Dismiss notification"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
