/**
 * Push Notifications Service
 * 
 * Handles push notification registration, token management, and deep linking.
 * Tests end-to-end push notification flow from server to device.
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import api from './api';

export interface PushToken {
  token: string;
  platform: 'ios' | 'android' | 'web';
  deviceId?: string;
}

export interface NotificationData {
  type?: string;
  screen?: string;
  params?: Record<string, string>;
  jobId?: string;
  invoiceId?: string;
  quoteId?: string;
  chatId?: string;
}

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

class PushNotificationService {
  private expoPushToken: string | null = null;
  private notificationListener: Notifications.Subscription | null = null;
  private responseListener: Notifications.Subscription | null = null;
  private isInitialized = false;

  getToken(): string | null {
    return this.expoPushToken;
  }

  /**
   * Initialize push notifications
   * Call this once when the app starts
   */
  async initialize(): Promise<string | null> {
    if (this.isInitialized) {
      return this.expoPushToken;
    }

    try {
      // Register for push notifications
      const token = await this.registerForPushNotifications();
      
      if (token) {
        this.expoPushToken = token;
        
        // Register token with backend
        await this.registerTokenWithBackend(token);
      }

      // Set up notification listeners
      this.setupListeners();
      
      this.isInitialized = true;
      console.log('[PushNotifications] Initialized with token:', token);
      
      return token;
    } catch (error) {
      console.error('[PushNotifications] Initialization error:', error);
      return null;
    }
  }

  /**
   * Register for push notifications and get the Expo push token
   */
  private async registerForPushNotifications(): Promise<string | null> {
    if (!Device.isDevice) {
      console.log('[PushNotifications] Push notifications require a physical device');
      return null;
    }

    // Check current permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permissions if not already granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[PushNotifications] Permission not granted');
      return null;
    }

    // Get the Expo push token
    try {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
      
      if (!projectId) {
        console.warn('[PushNotifications] No projectId found - using fallback');
      }

      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: projectId || 'development',
      });

      // Set up Android notification channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#3B82F6',
        });

        await Notifications.setNotificationChannelAsync('jobs', {
          name: 'Job Updates',
          importance: Notifications.AndroidImportance.HIGH,
          description: 'Notifications about job assignments and updates',
        });

        await Notifications.setNotificationChannelAsync('payments', {
          name: 'Payment Alerts',
          importance: Notifications.AndroidImportance.HIGH,
          description: 'Notifications about payments and invoices',
        });

        await Notifications.setNotificationChannelAsync('chat', {
          name: 'Messages',
          importance: Notifications.AndroidImportance.DEFAULT,
          description: 'Chat and team message notifications',
        });
      }

      return tokenData.data;
    } catch (error) {
      console.error('[PushNotifications] Error getting push token:', error);
      return null;
    }
  }

  /**
   * Register the push token with the backend
   */
  private async registerTokenWithBackend(token: string): Promise<void> {
    try {
      await api.post('/notifications/register-device', {
        pushToken: token,
        platform: Platform.OS,
        deviceId: Constants.sessionId,
      });
      console.log('[PushNotifications] Token registered with backend');
    } catch (error) {
      console.error('[PushNotifications] Failed to register token with backend:', error);
    }
  }

  /**
   * Set up notification and response listeners
   */
  private setupListeners(): void {
    // Handle notifications received while app is in foreground
    this.notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('[PushNotifications] Notification received:', notification);
      // You can update app state here, show in-app notification banner, etc.
    });

    // Handle notification interactions (user tapped notification)
    this.responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('[PushNotifications] Notification response:', response);
      this.handleNotificationResponse(response);
    });
  }

  /**
   * Handle deep linking from notification taps
   */
  private handleNotificationResponse(response: Notifications.NotificationResponse): void {
    const data = response.notification.request.content.data as NotificationData;
    
    if (!data) return;

    // Route to the appropriate screen based on notification data
    if (data.screen) {
      router.push(data.screen as any);
    } else if (data.type) {
      switch (data.type) {
        case 'job':
          if (data.jobId) {
            router.push(`/job/${data.jobId}`);
          }
          break;
        case 'invoice':
          if (data.invoiceId) {
            router.push(`/more/invoice/${data.invoiceId}`);
          }
          break;
        case 'quote':
          if (data.quoteId) {
            router.push(`/more/quote/${data.quoteId}`);
          }
          break;
        case 'chat':
          router.push('/more/chat-hub');
          break;
        case 'payment':
          router.push('/collect');
          break;
        default:
          console.log('[PushNotifications] Unknown notification type:', data.type);
      }
    }
  }

  /**
   * Send a test notification (for verification purposes)
   */
  async sendTestNotification(): Promise<boolean> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'TradieTrack Test',
          body: 'Push notifications are working correctly!',
          data: { type: 'test' },
          sound: 'default',
        },
        trigger: { seconds: 1 },
      });
      console.log('[PushNotifications] Test notification scheduled');
      return true;
    } catch (error) {
      console.error('[PushNotifications] Test notification failed:', error);
      return false;
    }
  }

  /**
   * Request server to send a test push notification
   */
  async requestServerTestNotification(): Promise<boolean> {
    if (!this.expoPushToken) {
      console.warn('[PushNotifications] No push token available');
      return false;
    }

    try {
      await api.post('/notifications/test-push', {
        token: this.expoPushToken,
      });
      console.log('[PushNotifications] Server test notification requested');
      return true;
    } catch (error) {
      console.error('[PushNotifications] Server test notification failed:', error);
      return false;
    }
  }

  /**
   * Get current badge count
   */
  async getBadgeCount(): Promise<number> {
    return await Notifications.getBadgeCountAsync();
  }

  /**
   * Set badge count
   */
  async setBadgeCount(count: number): Promise<void> {
    await Notifications.setBadgeCountAsync(count);
  }

  /**
   * Clear all notifications
   */
  async clearAllNotifications(): Promise<void> {
    await Notifications.dismissAllNotificationsAsync();
    await this.setBadgeCount(0);
  }

  /**
   * Get all pending notifications
   */
  async getPendingNotifications(): Promise<Notifications.NotificationRequest[]> {
    return await Notifications.getAllScheduledNotificationsAsync();
  }

  /**
   * Cancel all scheduled notifications
   */
  async cancelAllScheduledNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  /**
   * Check if notifications are enabled
   */
  async areNotificationsEnabled(): Promise<boolean> {
    const settings = await Notifications.getPermissionsAsync();
    return settings.granted;
  }

  /**
   * Get detailed permission status
   */
  async getPermissionStatus(): Promise<{
    granted: boolean;
    canAskAgain: boolean;
    status: string;
  }> {
    const settings = await Notifications.getPermissionsAsync();
    return {
      granted: settings.granted,
      canAskAgain: settings.canAskAgain,
      status: settings.status,
    };
  }

  /**
   * Cleanup listeners when app closes
   */
  cleanup(): void {
    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener);
    }
    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
    }
  }
}

export const pushNotificationService = new PushNotificationService();
export default pushNotificationService;
