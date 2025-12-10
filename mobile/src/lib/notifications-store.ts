import { create } from 'zustand';
import { apiClient } from './api';
import notificationService from './notifications';

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
  pushToken: string | null;
  pushPermissionGranted: boolean;
  
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  dismissNotification: (id: number) => Promise<void>;
  getUnreadCount: () => number;
  setPushToken: (token: string | null) => void;
  setPushPermission: (granted: boolean) => void;
  updateBadgeCount: () => Promise<void>;
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  notifications: [],
  isLoading: false,
  error: null,
  unreadCount: 0,
  pushToken: null,
  pushPermissionGranted: false,

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
      // Update badge count
      get().updateBadgeCount();
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
      get().updateBadgeCount();
    } catch (error: any) {
      console.error('Failed to mark notification as read:', error);
    }
  },

  markAllAsRead: async () => {
    try {
      // Use batch endpoint to mark all as read in one request
      await apiClient.post('/api/notifications/mark-all-read');
      const notifications = get().notifications.map(n => ({ ...n, isRead: true }));
      set({ notifications, unreadCount: 0 });
      get().updateBadgeCount();
    } catch (error: any) {
      // Fallback to individual requests if batch endpoint not available
      console.error('Failed to mark all notifications as read:', error);
      const unreadNotifications = get().notifications.filter(n => !n.isRead && !n.isDismissed);
      await Promise.allSettled(
        unreadNotifications.map(n => apiClient.patch(`/api/notifications/${n.id}/read`))
      );
      const notifications = get().notifications.map(n => ({ ...n, isRead: true }));
      set({ notifications, unreadCount: 0 });
      get().updateBadgeCount();
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
      get().updateBadgeCount();
    } catch (error: any) {
      console.error('Failed to dismiss notification:', error);
    }
  },

  getUnreadCount: () => {
    return get().unreadCount;
  },

  setPushToken: (token: string | null) => {
    set({ pushToken: token, pushPermissionGranted: !!token });
  },

  setPushPermission: (granted: boolean) => {
    set({ pushPermissionGranted: granted });
  },

  updateBadgeCount: async () => {
    try {
      const unreadCount = get().unreadCount;
      await notificationService.setBadgeCount(unreadCount);
    } catch (error) {
      // Badge count update is non-critical
    }
  },
}));
