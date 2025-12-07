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
import { router } from 'expo-router';
import api from './api';
import { offlineStore } from './offlineStore';

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
  type: 'job_update' | 'payment_received' | 'team_message' | 'job_assigned' | 'quote_accepted';
  title: string;
  body: string;
  data?: {
    jobId?: string;
    invoiceId?: string;
    quoteId?: string;
    messageId?: string;
    amount?: number;
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
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: projectId,
      });
      
      this.pushToken = tokenData.data;
      console.log('[Notifications] Push token:', this.pushToken);

      // Set up platform-specific notification configuration
      if (Platform.OS === 'android') {
        await this.setupAndroidChannels();
      } else if (Platform.OS === 'ios') {
        await this.setupIOSCategories();
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
   * Required for Android 8.0+ (API 26+) for all notifications
   */
  private async setupAndroidChannels(): Promise<void> {
    await Notifications.setNotificationChannelAsync('jobs', {
      name: 'Job Updates',
      description: 'Notifications about job status changes and assignments',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#f97316',
      sound: 'default',
      enableVibrate: true,
      enableLights: true,
    });

    await Notifications.setNotificationChannelAsync('payments', {
      name: 'Payments',
      description: 'Payment received and invoice notifications',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 500, 250, 500],
      lightColor: '#22c55e',
      sound: 'default',
      enableVibrate: true,
      enableLights: true,
    });

    await Notifications.setNotificationChannelAsync('messages', {
      name: 'Team Messages',
      description: 'Chat messages from your team',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250],
      lightColor: '#3b82f6',
      sound: 'default',
      enableVibrate: true,
      enableLights: true,
    });

    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Reminders',
      description: 'Job reminders and scheduled alerts',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 500, 250, 500],
      lightColor: '#eab308',
      sound: 'default',
      enableVibrate: true,
      enableLights: true,
    });

    console.log('[Notifications] Android channels configured');
  }

  /**
   * Set up iOS notification categories with actions
   * Categories define what actions users can take directly from notifications
   */
  private async setupIOSCategories(): Promise<void> {
    await Notifications.setNotificationCategoryAsync('JOB_UPDATE', [
      {
        identifier: 'VIEW_JOB',
        buttonTitle: 'View Job',
        options: { opensAppToForeground: true },
      },
      {
        identifier: 'MARK_COMPLETE',
        buttonTitle: 'Mark Complete',
        options: { opensAppToForeground: false },
      },
    ]);

    await Notifications.setNotificationCategoryAsync('PAYMENT', [
      {
        identifier: 'VIEW_INVOICE',
        buttonTitle: 'View Invoice',
        options: { opensAppToForeground: true },
      },
    ]);

    await Notifications.setNotificationCategoryAsync('MESSAGE', [
      {
        identifier: 'VIEW_CHAT',
        buttonTitle: 'View Chat',
        options: { opensAppToForeground: true },
      },
      {
        identifier: 'REPLY',
        buttonTitle: 'Reply',
        options: { opensAppToForeground: true },
        textInput: {
          submitButtonTitle: 'Send',
          placeholder: 'Type a reply...',
        },
      },
    ]);

    await Notifications.setNotificationCategoryAsync('REMINDER', [
      {
        identifier: 'VIEW_JOB',
        buttonTitle: 'View Job',
        options: { opensAppToForeground: true },
      },
      {
        identifier: 'SNOOZE',
        buttonTitle: 'Snooze 15min',
        options: { opensAppToForeground: false },
      },
    ]);

    console.log('[Notifications] iOS categories configured');
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
   * Handle deep linking when notification is tapped
   */
  navigateToNotification(payload: NotificationPayload): void {
    try {
      switch (payload.type) {
        case 'job_update':
        case 'job_assigned':
          if (payload.data?.jobId) {
            router.push(`/job/${payload.data.jobId}`);
          } else {
            router.push('/jobs');
          }
          break;
        case 'quote_accepted':
          if (payload.data?.quoteId) {
            router.push(`/more/quote/${payload.data.quoteId}`);
          } else {
            router.push('/more/quotes');
          }
          break;
        case 'payment_received':
          if (payload.data?.invoiceId) {
            router.push(`/more/invoice/${payload.data.invoiceId}`);
          } else {
            router.push('/more/invoices');
          }
          break;
        case 'team_message':
          router.push('/more/chat-hub');
          break;
        default:
          router.push('/');
      }
    } catch (error) {
      console.error('[Notifications] Navigation failed:', error);
      router.push('/');
    }
  }

  /**
   * Schedule a job reminder notification
   * Works on both iOS and Android with appropriate channels/categories
   */
  async scheduleJobReminder(
    jobId: string,
    jobTitle: string,
    scheduledAt: Date,
    minutesBefore: number = 30
  ): Promise<string | null> {
    const reminderTime = new Date(scheduledAt.getTime() - minutesBefore * 60 * 1000);
    
    if (reminderTime <= new Date()) {
      console.log('[Notifications] Reminder time is in the past, skipping');
      return null;
    }

    const secondsUntilReminder = Math.floor((reminderTime.getTime() - Date.now()) / 1000);
    
    return await this.scheduleLocalNotification(
      'Job Reminder',
      `${jobTitle} starts in ${minutesBefore} minutes`,
      { type: 'job_reminder', jobId },
      secondsUntilReminder
    );
  }

  /**
   * Send a notification for specific events
   * Convenience methods for common notification types
   */
  async notifyJobAssigned(jobId: string, jobTitle: string, clientName: string): Promise<string> {
    return this.scheduleLocalNotification(
      'New Job Assigned',
      `${jobTitle} for ${clientName}`,
      { type: 'job_assigned', jobId }
    );
  }

  async notifyPaymentReceived(invoiceId: string, amount: number, clientName: string): Promise<string> {
    const formattedAmount = new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(amount);
    
    return this.scheduleLocalNotification(
      'Payment Received',
      `${formattedAmount} from ${clientName}`,
      { type: 'payment_received', invoiceId, amount }
    );
  }

  async notifyQuoteAccepted(quoteId: string, quoteName: string, clientName: string): Promise<string> {
    return this.scheduleLocalNotification(
      'Quote Accepted',
      `${clientName} accepted your quote for ${quoteName}`,
      { type: 'quote_accepted', quoteId }
    );
  }

  async notifyNewMessage(senderId: string, senderName: string, preview: string): Promise<string> {
    return this.scheduleLocalNotification(
      `Message from ${senderName}`,
      preview.length > 50 ? `${preview.substring(0, 50)}...` : preview,
      { type: 'team_message', messageId: senderId }
    );
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
   * Automatically assigns correct Android channel and iOS category based on notification type
   */
  async scheduleLocalNotification(
    title: string,
    body: string,
    data?: any,
    triggerSeconds?: number
  ): Promise<string> {
    const notificationType = data?.type || 'job_update';
    
    // Determine Android channel and iOS category based on notification type
    let androidChannelId = 'jobs';
    let iosCategoryIdentifier = 'JOB_UPDATE';
    
    switch (notificationType) {
      case 'payment_received':
        androidChannelId = 'payments';
        iosCategoryIdentifier = 'PAYMENT';
        break;
      case 'team_message':
        androidChannelId = 'messages';
        iosCategoryIdentifier = 'MESSAGE';
        break;
      case 'job_reminder':
        androidChannelId = 'reminders';
        iosCategoryIdentifier = 'REMINDER';
        break;
      case 'job_update':
      case 'job_assigned':
      case 'quote_accepted':
      default:
        androidChannelId = 'jobs';
        iosCategoryIdentifier = 'JOB_UPDATE';
        break;
    }

    const content: Notifications.NotificationContentInput = {
      title,
      body,
      data,
      sound: 'default',
    };

    // Add platform-specific settings
    if (Platform.OS === 'android') {
      (content as any).channelId = androidChannelId;
    } else if (Platform.OS === 'ios') {
      content.categoryIdentifier = iosCategoryIdentifier;
    }

    const id = await Notifications.scheduleNotificationAsync({
      content,
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
