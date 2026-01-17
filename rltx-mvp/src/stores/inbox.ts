import { create } from "zustand";
import { persist } from "zustand/middleware";

// =============================================================================
// NOTIFICATION TYPES
// =============================================================================

export type NotificationType =
  | "simulation_complete"
  | "simulation_failed"
  | "data_sync"
  | "insight"
  | "threshold_alert";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
  // Optional metadata
  workflowId?: string;
  sourceId?: string;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// STORE
// =============================================================================

interface InboxState {
  notifications: Notification[];
  isLoading: boolean;

  // Actions
  fetchNotifications: () => Promise<void>;
  addNotification: (notification: Omit<Notification, "id" | "timestamp" | "read">) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  deleteNotification: (id: string) => void;
  clearAll: () => void;

  // Computed
  unreadCount: () => number;
}

export const useInboxStore = create<InboxState>()(
  persist(
    (set, get) => ({
      notifications: [],
      isLoading: false,

      fetchNotifications: async () => {
        set({ isLoading: true });
        try {
          const response = await fetch("/api/inbox");
          if (response.ok) {
            const data = await response.json();
            set({ notifications: data.notifications, isLoading: false });
          } else {
            set({ isLoading: false });
          }
        } catch {
          set({ isLoading: false });
        }
      },

      addNotification: (notification) => {
        const newNotification: Notification = {
          ...notification,
          id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          timestamp: new Date().toISOString(),
          read: false,
        };
        set((state) => ({
          notifications: [newNotification, ...state.notifications],
        }));
      },

      markAsRead: (id) => {
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        }));
      },

      markAllAsRead: () => {
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
        }));
      },

      deleteNotification: (id) => {
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        }));
      },

      clearAll: () => {
        set({ notifications: [] });
      },

      unreadCount: () => {
        return get().notifications.filter((n) => !n.read).length;
      },
    }),
    {
      name: "rltx-inbox-store",
      partialize: (state) => ({
        notifications: state.notifications,
      }),
    }
  )
);

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

export function getNotificationIcon(type: NotificationType): string {
  switch (type) {
    case "simulation_complete":
      return "CheckCircle";
    case "simulation_failed":
      return "XCircle";
    case "data_sync":
      return "RefreshCw";
    case "insight":
      return "Lightbulb";
    case "threshold_alert":
      return "AlertTriangle";
    default:
      return "Bell";
  }
}

export function getNotificationColor(type: NotificationType): string {
  switch (type) {
    case "simulation_complete":
      return "hsl(142, 70%, 45%)"; // Green
    case "simulation_failed":
      return "hsl(0, 70%, 55%)"; // Red
    case "data_sync":
      return "hsl(210, 70%, 55%)"; // Blue
    case "insight":
      return "hsl(38, 90%, 50%)"; // Amber
    case "threshold_alert":
      return "hsl(0, 70%, 55%)"; // Red
    default:
      return "hsl(0, 0%, 50%)"; // Gray
  }
}

export function formatNotificationTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function groupNotificationsByDate(notifications: Notification[]): {
  label: string;
  notifications: Notification[];
}[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  const groups: { label: string; notifications: Notification[] }[] = [
    { label: "Today", notifications: [] },
    { label: "Yesterday", notifications: [] },
    { label: "This Week", notifications: [] },
    { label: "Earlier", notifications: [] },
  ];

  for (const notification of notifications) {
    const date = new Date(notification.timestamp);
    if (date >= today) {
      groups[0].notifications.push(notification);
    } else if (date >= yesterday) {
      groups[1].notifications.push(notification);
    } else if (date >= thisWeek) {
      groups[2].notifications.push(notification);
    } else {
      groups[3].notifications.push(notification);
    }
  }

  return groups.filter((g) => g.notifications.length > 0);
}
