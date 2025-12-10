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
  | 'payment_received'
  | 'quote_accepted'
  | 'quote_rejected'
  | 'team_message'
  | 'invoice_overdue'
  | 'general';

interface SendNotificationOptions {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
}

/**
 * Send push notification to a single user
 */
export async function sendPushNotification(options: SendNotificationOptions): Promise<boolean> {
  const { userId, type, title, body, data } = options;
  
  try {
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
    
    // Also create an in-app notification
    await storage.createNotification({
      userId,
      type,
      title,
      message: body,
      relatedId: data?.jobId || data?.invoiceId || data?.quoteId,
      relatedType: data?.relatedType,
    });
    
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
      return 'jobs';
    case 'payment_received':
    case 'invoice_overdue':
      return 'payments';
    case 'quote_accepted':
    case 'quote_rejected':
      return 'quotes';
    case 'team_message':
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
