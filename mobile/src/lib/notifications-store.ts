import { create } from 'zustand';
import { apiClient } from './api';
import notificationService from './notifications';

// Unified notification interface matching web implementation
interface UnifiedNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  relatedId?: string;
  relatedType?: string;
  read: boolean;
  dismissed: boolean;
  createdAt: string;
  notificationType: 'system' | 'sms' | 'chat';
  unreadCount?: number;
}

interface UnifiedNotificationsResponse {
  notifications: UnifiedNotification[];
  unreadCount: number;
}

interface NotificationsState {
  notifications: UnifiedNotification[];
  isLoading: boolean;
  error: string | null;
  unreadCount: number;
  pushToken: string | null;
  pushPermissionGranted: boolean;
  lastFetchTime: number;
  
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string, notificationType?: 'system' | 'sms' | 'chat') => Promise<void>;
  markAllAsRead: () => Promise<void>;
  dismissNotification: (id: string) => Promise<void>;
  getUnreadCount: () => number;
  setPushToken: (token: string | null) => void;
  setPushPermission: (granted: boolean) => void;
  updateBadgeCount: () => Promise<void>;
  startPolling: () => () => void;
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  notifications: [],
  isLoading: false,
  error: null,
  unreadCount: 0,
  pushToken: null,
  pushPermissionGranted: false,
  lastFetchTime: 0,

  fetchNotifications: async () => {
    // Debounce: don't fetch if we fetched in the last 5 seconds
    const now = Date.now();
    if (now - get().lastFetchTime < 5000 && get().notifications.length > 0) {
      return;
    }
    
    set({ isLoading: true, error: null, lastFetchTime: now });
    try {
      // Use unified endpoint like web - includes system, SMS, and chat notifications
      const response = await apiClient.get<UnifiedNotificationsResponse>('/api/notifications/unified');
      const data = response.data;
      set({ 
        notifications: data.notifications || [], 
        unreadCount: data.unreadCount || 0,
        isLoading: false 
      });
      // Update badge count
      get().updateBadgeCount();
    } catch (error: any) {
      // Fallback to basic notifications endpoint if unified fails
      try {
        const fallbackResponse = await apiClient.get('/api/notifications');
        const notifications = (fallbackResponse.data as any[]).map(n => ({
          ...n,
          id: String(n.id),
          notificationType: 'system' as const,
        }));
        const unreadCount = notifications.filter(n => !n.read && !n.dismissed).length;
        set({ 
          notifications, 
          unreadCount,
          isLoading: false 
        });
        get().updateBadgeCount();
      } catch (fallbackError) {
        set({ 
          error: error.message || 'Failed to fetch notifications',
          isLoading: false 
        });
      }
    }
  },

  markAsRead: async (id: string, notificationType: 'system' | 'sms' | 'chat' = 'system') => {
    try {
      // Use appropriate endpoint based on notification type (matching web behavior)
      if (notificationType === 'sms') {
        await apiClient.patch(`/api/notifications/sms/${id}/read`);
      } else if (notificationType === 'chat') {
        await apiClient.patch(`/api/notifications/chat/${id}/read`);
      } else {
        await apiClient.patch(`/api/notifications/${id}/read`);
      }
      
      const notifications = get().notifications.map(n => 
        n.id === id ? { ...n, read: true } : n
      );
      const unreadCount = notifications.filter(n => !n.read && !n.dismissed).length;
      set({ notifications, unreadCount });
      get().updateBadgeCount();
    } catch (error: any) {
      console.error('Failed to mark notification as read:', error);
    }
  },

  markAllAsRead: async () => {
    try {
      // Use batch endpoint to mark all as read in one request
      await apiClient.patch('/api/notifications/read-all');
      const notifications = get().notifications.map(n => ({ ...n, read: true }));
      set({ notifications, unreadCount: 0 });
      get().updateBadgeCount();
    } catch (error: any) {
      console.error('Failed to mark all notifications as read:', error);
      // Optimistically update UI anyway
      const notifications = get().notifications.map(n => ({ ...n, read: true }));
      set({ notifications, unreadCount: 0 });
      get().updateBadgeCount();
    }
  },

  dismissNotification: async (id: string) => {
    try {
      await apiClient.patch(`/api/notifications/${id}/dismiss`);
      const notifications = get().notifications.map(n => 
        n.id === id ? { ...n, dismissed: true } : n
      );
      const unreadCount = notifications.filter(n => !n.read && !n.dismissed).length;
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

  // Start polling for new notifications (returns cleanup function)
  startPolling: () => {
    // Fetch immediately
    get().fetchNotifications();
    
    // Poll every 30 seconds for new notifications
    const intervalId = setInterval(() => {
      get().fetchNotifications();
    }, 30000);
    
    return () => clearInterval(intervalId);
  },
}));

// Export the notification type for use in components
export type { UnifiedNotification };
