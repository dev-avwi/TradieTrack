import { create } from 'zustand';
import { apiClient } from './api';

interface Notification {
  id: number;
  userId: number;
  businessId: number;
  type: string;
  title: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
  metadata?: Record<string, any>;
  isRead: boolean;
  isDismissed: boolean;
  createdAt: string;
}

interface NotificationsState {
  notifications: Notification[];
  isLoading: boolean;
  error: string | null;
  unreadCount: number;
  
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: number) => Promise<void>;
  dismissNotification: (id: number) => Promise<void>;
  getUnreadCount: () => number;
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  notifications: [],
  isLoading: false,
  error: null,
  unreadCount: 0,

  fetchNotifications: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.get('/api/notifications');
      const notifications = response.data as Notification[];
      const unreadCount = notifications.filter(n => !n.isRead && !n.isDismissed).length;
      set({ 
        notifications, 
        unreadCount,
        isLoading: false 
      });
    } catch (error: any) {
      set({ 
        error: error.message || 'Failed to fetch notifications',
        isLoading: false 
      });
    }
  },

  markAsRead: async (id: number) => {
    try {
      await apiClient.patch(`/api/notifications/${id}/read`);
      const notifications = get().notifications.map(n => 
        n.id === id ? { ...n, isRead: true } : n
      );
      const unreadCount = notifications.filter(n => !n.isRead && !n.isDismissed).length;
      set({ notifications, unreadCount });
    } catch (error: any) {
      console.error('Failed to mark notification as read:', error);
    }
  },

  dismissNotification: async (id: number) => {
    try {
      await apiClient.patch(`/api/notifications/${id}/dismiss`);
      const notifications = get().notifications.map(n => 
        n.id === id ? { ...n, isDismissed: true } : n
      );
      const unreadCount = notifications.filter(n => !n.isRead && !n.isDismissed).length;
      set({ notifications, unreadCount });
    } catch (error: any) {
      console.error('Failed to dismiss notification:', error);
    }
  },

  getUnreadCount: () => {
    return get().unreadCount;
  },
}));
