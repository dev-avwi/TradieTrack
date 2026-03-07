/**
 * Push Notification Service
 * 
 * Sends push notifications to mobile devices via Expo Push Notification Service.
 * Handles token management, batch sending, and error tracking.
 */

import { storage } from './storage';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: 'default' | null;
  badge?: number;
  channelId?: string;
  priority?: 'default' | 'normal' | 'high';
  categoryId?: string;
}

export interface PushTicket {
  id: string;
  status: 'ok' | 'error';
  message?: string;
  details?: {
    error?: 'DeviceNotRegistered' | 'MessageTooBig' | 'MessageRateExceeded' | 'InvalidCredentials';
  };
}

export type NotificationType = 
  | 'job_assigned'
  | 'job_update'
  | 'job_reminder'
  | 'job_scheduled'
  | 'job_started'
  | 'job_completed'
  | 'payment_received'
  | 'payment_failed'
  | 'quote_accepted'
  | 'quote_rejected'
  | 'quote_sent'
  | 'quote_expiring'
  | 'invoice_sent'
  | 'invoice_overdue'
  | 'installment_due'
  | 'installment_received'
  | 'recurring_job_created'
  | 'recurring_invoice_created'
  | 'team_message'
  | 'chat_message'
  | 'sms_received'
  | 'team_invite'
  | 'team_location'
  | 'timesheet_submitted'
  | 'geofence_checkin'
  | 'geofence_checkout'
  | 'trial_expiring'
  | 'daily_summary'
  | 'weekly_summary'
  | 'automation'
  | 'general';

interface SendNotificationOptions {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
  skipInAppNotification?: boolean;
}

/**
 * Check if user has enabled notifications for a specific type
 */
async function shouldSendNotification(userId: string, type: NotificationType): Promise<boolean> {
  try {
    const settings = await storage.getIntegrationSettings(userId);
    if (!settings) return true; // Default to enabled if no settings
    
    // Check master toggle first
    if (settings.pushNotificationsEnabled === false) {
      return false;
    }

    switch (type) {
      case 'quote_accepted':
      case 'quote_rejected':
      case 'quote_sent':
      case 'quote_expiring':
        return settings.notifyQuoteResponses !== false;
      case 'payment_received':
      case 'payment_failed':
      case 'installment_due':
      case 'installment_received':
        return settings.notifyPaymentConfirmations !== false;
      case 'invoice_overdue':
      case 'invoice_sent':
      case 'recurring_invoice_created':
        return settings.notifyOverdueInvoices !== false;
      case 'job_assigned':
        return settings.notifyJobAssigned !== false;
      case 'job_update':
      case 'job_scheduled':
      case 'job_started':
      case 'job_completed':
      case 'recurring_job_created':
        return settings.notifyJobUpdates !== false;
      case 'job_reminder':
        return settings.notifyJobReminders !== false;
      case 'team_message':
      case 'chat_message':
      case 'sms_received':
        return settings.notifyTeamMessages !== false;
      case 'team_location':
      case 'geofence_checkin':
      case 'geofence_checkout':
        return settings.notifyTeamLocations !== false;
      case 'team_invite':
      case 'timesheet_submitted':
        return settings.notifyJobAssigned !== false;
      case 'daily_summary':
        return settings.notifyDailySummary === true;
      case 'weekly_summary':
        return settings.notifyWeeklySummary === true;
      case 'trial_expiring':
      case 'automation':
      case 'general':
      default:
        return true;
    }
  } catch (error) {
    console.error('[PushNotification] Error checking preferences:', error);
    return true; // Default to sending on error
  }
}

/**
 * Send push notification to a single user
 */
export async function sendPushNotification(options: SendNotificationOptions): Promise<boolean> {
  const { userId, type, title, body, data } = options;
  
  try {
    // Check if user has enabled this notification type
    const shouldSend = await shouldSendNotification(userId, type);
    if (!shouldSend) {
      console.log(`[PushNotification] User ${userId} has disabled ${type} notifications`);
      return false;
    }

    // Get user's active push tokens
    const tokens = await storage.getPushTokens(userId);
    const activeTokens = tokens.filter(t => t.isActive);
    
    if (activeTokens.length === 0) {
      console.log(`[PushNotification] No active tokens for user ${userId}`);
      return false;
    }
    
    // Create messages for each token
    const messages: PushMessage[] = activeTokens.map(token => ({
      to: token.token,
      title,
      body,
      data: {
        type,
        ...data,
      },
      sound: 'default',
      priority: 'high',
      channelId: getChannelId(type),
    }));
    
    // Send notifications
    const results = await sendPushMessages(messages);
    
    // Handle any token errors (e.g., DeviceNotRegistered)
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const token = activeTokens[i];
      
      if (result.status === 'error') {
        console.error(`[PushNotification] Error for token ${token.token}:`, result.message);
        
        if (result.details?.error === 'DeviceNotRegistered') {
          // Mark token as inactive (requires userId for ownership verification)
          await storage.deactivatePushToken(token.id, userId);
          console.log(`[PushNotification] Deactivated token ${token.id}`);
        }
      }
    }
    
    if (!options.skipInAppNotification) {
      await storage.createNotification({
        userId,
        type,
        title,
        message: body,
        relatedId: data?.jobId || data?.invoiceId || data?.quoteId,
        relatedType: data?.relatedType,
      });
    }
    
    return true;
  } catch (error) {
    console.error('[PushNotification] Failed to send:', error);
    return false;
  }
}

/**
 * Send push notifications to multiple users
 */
export async function sendPushNotificationToUsers(
  userIds: string[], 
  options: Omit<SendNotificationOptions, 'userId'>
): Promise<void> {
  const promises = userIds.map(userId => 
    sendPushNotification({ ...options, userId })
  );
  await Promise.allSettled(promises);
}

/**
 * Send batch of push messages to Expo
 */
async function sendPushMessages(messages: PushMessage[]): Promise<PushTicket[]> {
  if (messages.length === 0) return [];
  
  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify(messages),
    });
    
    if (!response.ok) {
      throw new Error(`Expo push service returned ${response.status}`);
    }
    
    const result = await response.json();
    return result.data || [];
  } catch (error) {
    console.error('[PushNotification] Expo API error:', error);
    return messages.map(() => ({
      id: '',
      status: 'error' as const,
      message: 'Failed to send',
    }));
  }
}

/**
 * Get Android notification channel ID for notification type
 */
function getChannelId(type: NotificationType): string {
  switch (type) {
    case 'job_assigned':
    case 'job_update':
    case 'job_reminder':
    case 'job_scheduled':
    case 'job_started':
    case 'job_completed':
    case 'recurring_job_created':
    case 'geofence_checkin':
    case 'geofence_checkout':
    case 'timesheet_submitted':
      return 'jobs';
    case 'payment_received':
    case 'payment_failed':
    case 'invoice_overdue':
    case 'invoice_sent':
    case 'installment_due':
    case 'installment_received':
    case 'recurring_invoice_created':
      return 'payments';
    case 'quote_accepted':
    case 'quote_rejected':
    case 'quote_sent':
    case 'quote_expiring':
      return 'quotes';
    case 'team_message':
    case 'chat_message':
    case 'sms_received':
    case 'team_invite':
      return 'messages';
    default:
      return 'default';
  }
}

// Convenience functions for common notification types

export async function notifyJobAssigned(userId: string, jobTitle: string, jobId: string): Promise<void> {
  await sendPushNotification({
    userId,
    type: 'job_assigned',
    title: 'New Job Assigned',
    body: `You've been assigned to: ${jobTitle}`,
    data: { jobId, relatedType: 'job' },
  });
}

export async function notifyJobUpdate(userId: string, jobTitle: string, jobId: string, updateType: string): Promise<void> {
  await sendPushNotification({
    userId,
    type: 'job_update',
    title: 'Job Updated',
    body: `${jobTitle}: ${updateType}`,
    data: { jobId, relatedType: 'job' },
  });
}

export async function notifyPaymentReceived(userId: string, amount: number, invoiceNumber: string, invoiceId: string): Promise<void> {
  const formattedAmount = `$${(amount / 100).toFixed(2)}`;
  await sendPushNotification({
    userId,
    type: 'payment_received',
    title: 'Payment Received!',
    body: `${formattedAmount} received for invoice ${invoiceNumber}`,
    data: { invoiceId, amount, relatedType: 'invoice' },
  });
}

export async function notifyQuoteAccepted(userId: string, quoteNumber: string, quoteId: string, clientName: string): Promise<void> {
  await sendPushNotification({
    userId,
    type: 'quote_accepted',
    title: 'Quote Accepted!',
    body: `${clientName} accepted quote ${quoteNumber}`,
    data: { quoteId, relatedType: 'quote' },
  });
}

export async function notifyQuoteRejected(userId: string, quoteNumber: string, quoteId: string, clientName: string): Promise<void> {
  await sendPushNotification({
    userId,
    type: 'quote_rejected',
    title: 'Quote Declined',
    body: `${clientName} declined quote ${quoteNumber}`,
    data: { quoteId, relatedType: 'quote' },
  });
}

export async function notifyTeamMessage(userId: string, senderName: string, messagePreview: string, chatType: 'job' | 'team' | 'direct'): Promise<void> {
  await sendPushNotification({
    userId,
    type: 'team_message',
    title: chatType === 'team' ? 'Team Chat' : senderName,
    body: `${senderName}: ${messagePreview.slice(0, 100)}`,
    data: { chatType },
  });
}

export async function notifyInvoiceOverdue(userId: string, invoiceNumber: string, invoiceId: string, daysOverdue: number): Promise<void> {
  await sendPushNotification({
    userId,
    type: 'invoice_overdue',
    title: 'Invoice Overdue',
    body: `Invoice ${invoiceNumber} is ${daysOverdue} days overdue`,
    data: { invoiceId, daysOverdue, relatedType: 'invoice' },
  });
}

export async function notifySmsReceived(userId: string, senderName: string, messagePreview: string, conversationId?: string): Promise<void> {
  await sendPushNotification({
    userId,
    type: 'sms_received',
    title: `SMS from ${senderName}`,
    body: messagePreview.slice(0, 120),
    data: { conversationId, relatedType: 'sms' },
    skipInAppNotification: true,
  });
}

export async function notifyGeofenceEvent(userId: string, workerName: string, jobTitle: string, jobId: string, eventType: 'checkin' | 'checkout'): Promise<void> {
  const type = eventType === 'checkin' ? 'geofence_checkin' : 'geofence_checkout';
  const action = eventType === 'checkin' ? 'arrived at' : 'left';
  await sendPushNotification({
    userId,
    type,
    title: eventType === 'checkin' ? 'Worker Arrived' : 'Worker Left Site',
    body: `${workerName} ${action} ${jobTitle}`,
    data: { jobId, workerName, relatedType: 'job' },
    skipInAppNotification: true,
  });
}

export async function notifyTimesheetSubmitted(userId: string, workerName: string, periodLabel: string): Promise<void> {
  await sendPushNotification({
    userId,
    type: 'timesheet_submitted',
    title: 'Timesheet Submitted',
    body: `${workerName} submitted their timesheet for ${periodLabel}`,
    data: { relatedType: 'timesheet' },
    skipInAppNotification: true,
  });
}

export async function notifyQuoteExpiring(userId: string, quoteNumber: string, quoteId: string, daysLeft: number): Promise<void> {
  await sendPushNotification({
    userId,
    type: 'quote_expiring',
    title: 'Quote Expiring Soon',
    body: `Quote ${quoteNumber} expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
    data: { quoteId, relatedType: 'quote' },
  });
}

export async function notifyPaymentFailed(userId: string, invoiceNumber: string, invoiceId: string): Promise<void> {
  await sendPushNotification({
    userId,
    type: 'payment_failed',
    title: 'Payment Failed',
    body: `Payment for invoice ${invoiceNumber} failed — follow up required`,
    data: { invoiceId, relatedType: 'invoice' },
  });
}

export async function notifyTrialExpiring(userId: string, daysLeft: number): Promise<void> {
  await sendPushNotification({
    userId,
    type: 'trial_expiring',
    title: 'Trial Ending Soon',
    body: `Your free trial expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}. Upgrade to keep all your features.`,
    data: { relatedType: 'subscription' },
  });
}
