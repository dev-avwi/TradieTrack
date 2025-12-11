/**
 * Push Notifications Module
 * 
 * Handles push notifications for job updates, payment alerts, and team messages.
 * Uses Expo Notifications for cross-platform support.
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import api from './api';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export interface PushToken {
  token: string;
  platform: 'ios' | 'android';
}

export interface NotificationPayload {
  type: 
    | 'job_assigned'
    | 'job_update'
    | 'job_reminder'
    | 'payment_received'
    | 'quote_accepted'
    | 'quote_rejected'
    | 'team_message'
    | 'invoice_overdue'
    | 'general';
  title: string;
  body: string;
  data?: {
    jobId?: string;
    invoiceId?: string;
    quoteId?: string;
    messageId?: string;
    conversationId?: string;
    amount?: number;
    chatType?: 'job' | 'team' | 'direct';
    relatedType?: 'job' | 'quote' | 'invoice';
  };
}

class NotificationService {
  private pushToken: string | null = null;
  private notificationListener: Notifications.Subscription | null = null;
  private responseListener: Notifications.Subscription | null = null;
  private onNotificationReceived?: (notification: NotificationPayload) => void;
  private onNotificationTapped?: (notification: NotificationPayload, action?: string) => void;

  /**
   * Initialize push notifications
   * Requests permissions and registers for push notifications
   */
  async initialize(): Promise<string | null> {
    try {
      // Check if we're on a physical device
      if (!Device.isDevice) {
        console.log('[Notifications] Push notifications require a physical device');
        return null;
      }

      // Request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.log('[Notifications] Permission not granted');
        return null;
      }

      // Get the push token
      // Try multiple sources for projectId (varies between dev/production builds)
      const projectId = 
        Constants.expoConfig?.extra?.eas?.projectId ||
        Constants.easConfig?.projectId ||
        process.env.EXPO_PUBLIC_PROJECT_ID;
      
      // Validate projectId is a valid UUID before attempting to get push token
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!projectId || !uuidRegex.test(projectId)) {
        console.log('[Notifications] No valid projectId available - push notifications disabled in dev');
        console.log('[Notifications] To enable, add EAS projectId to app.config or run eas build');
        return null;
      }
      
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: projectId,
      });
      
      this.pushToken = tokenData.data;
      console.log('[Notifications] Push token:', this.pushToken);

      // Set up notification channels for Android
      if (Platform.OS === 'android') {
        await this.setupAndroidChannels();
      }

      // Set up listeners
      this.setupListeners();

      // Register token with backend
      await this.registerTokenWithBackend();

      return this.pushToken;
    } catch (error) {
      console.error('[Notifications] Initialization failed:', error);
      return null;
    }
  }

  /**
   * Set up Android notification channels
   */
  private async setupAndroidChannels(): Promise<void> {
    await Notifications.setNotificationChannelAsync('jobs', {
      name: 'Job Updates',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#f97316',
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('payments', {
      name: 'Payments',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 500, 250, 500],
      lightColor: '#22c55e',
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('messages', {
      name: 'Team Messages',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250],
      lightColor: '#3b82f6',
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('quotes', {
      name: 'Quotes',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#8b5cf6',
      sound: 'default',
    });
    
    await Notifications.setNotificationChannelAsync('default', {
      name: 'General',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250],
      lightColor: '#6b7280',
      sound: 'default',
    });
  }

  /**
   * Set up notification event listeners
   */
  private setupListeners(): void {
    // Listener for notifications received while app is foregrounded
    this.notificationListener = Notifications.addNotificationReceivedListener(
      notification => {
        console.log('[Notifications] Received:', notification);
        
        const payload = this.parseNotification(notification);
        if (this.onNotificationReceived && payload) {
          this.onNotificationReceived(payload);
        }
      }
    );

    // Listener for when user taps on a notification
    this.responseListener = Notifications.addNotificationResponseReceivedListener(
      response => {
        console.log('[Notifications] Tapped:', response);
        
        const payload = this.parseNotification(response.notification);
        const actionId = response.actionIdentifier;
        
        if (this.onNotificationTapped && payload) {
          this.onNotificationTapped(
            payload,
            actionId !== Notifications.DEFAULT_ACTION_IDENTIFIER ? actionId : undefined
          );
        }
      }
    );
  }

  /**
   * Parse notification into our payload format
   */
  private parseNotification(
    notification: Notifications.Notification
  ): NotificationPayload | null {
    const content = notification.request.content;
    const data = content.data as any;
    
    return {
      type: data?.type ?? 'job_update',
      title: content.title ?? '',
      body: content.body ?? '',
      data: {
        jobId: data?.jobId,
        invoiceId: data?.invoiceId,
        quoteId: data?.quoteId,
        messageId: data?.messageId,
        amount: data?.amount,
      },
    };
  }

  /**
   * Register push token with the backend
   */
  private async registerTokenWithBackend(): Promise<void> {
    if (!this.pushToken) return;
    
    try {
      await api.post('/api/push-tokens', {
        token: this.pushToken,
        platform: Platform.OS,
        deviceName: Device.deviceName,
      });
      console.log('[Notifications] Token registered with backend');
    } catch (error) {
      console.error('[Notifications] Failed to register token:', error);
    }
  }

  /**
   * Set callback for notifications received while app is open
   */
  onReceived(callback: (notification: NotificationPayload) => void): void {
    this.onNotificationReceived = callback;
  }

  /**
   * Set callback for when user taps a notification
   */
  onTapped(callback: (notification: NotificationPayload, action?: string) => void): void {
    this.onNotificationTapped = callback;
  }

  /**
   * Schedule a local notification (for testing or reminders)
   */
  async scheduleLocalNotification(
    title: string,
    body: string,
    data?: any,
    triggerSeconds?: number
  ): Promise<string> {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: 'default',
      },
      trigger: triggerSeconds ? { seconds: triggerSeconds } : null,
    });
    
    return id;
  }

  /**
   * Cancel a scheduled notification
   */
  async cancelNotification(notificationId: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  }

  /**
   * Cancel all scheduled notifications
   */
  async cancelAllNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  /**
   * Get the badge count
   */
  async getBadgeCount(): Promise<number> {
    return await Notifications.getBadgeCountAsync();
  }

  /**
   * Set the badge count
   */
  async setBadgeCount(count: number): Promise<void> {
    await Notifications.setBadgeCountAsync(count);
  }

  /**
   * Clear the badge
   */
  async clearBadge(): Promise<void> {
    await this.setBadgeCount(0);
  }

  /**
   * Get the push token
   */
  getToken(): string | null {
    return this.pushToken;
  }

  /**
   * Clean up listeners
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

export const notificationService = new NotificationService();
export default notificationService;
