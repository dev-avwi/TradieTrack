/**
 * SMS Service for TradieTrack
 * Handles two-way SMS communication with clients via Twilio
 * 
 * Integration: connection:conn_twilio_01KB17KVHYEAGTVK0VVR1H47AA
 */

import { sendSMS, getTwilioPhoneNumber, isTwilioInitialized, smsTemplates } from '../twilioClient';
import { storage } from '../storage';
import type { SmsConversation, SmsMessage, InsertSmsConversation, InsertSmsMessage } from '@shared/schema';

interface SendSmsOptions {
  businessOwnerId: string;
  clientId?: string;
  clientPhone: string;
  clientName?: string;
  jobId?: string;
  message: string;
  senderUserId: string;
  isQuickAction?: boolean;
  quickActionType?: string;
}

interface QuickActionOptions {
  conversationId: string;
  senderUserId: string;
  actionType: 'on_my_way' | 'just_arrived' | 'job_finished' | 'running_late' | 'need_materials';
  jobTitle?: string;
  businessName?: string;
  estimatedTime?: string;
}

/**
 * Format Australian phone number to E.164 format
 */
export function formatPhoneNumber(phone: string): string {
  let formatted = phone.replace(/\s+/g, '').replace(/^0/, '+61');
  if (!formatted.startsWith('+')) {
    formatted = '+61' + formatted.replace(/^61/, '');
  }
  return formatted;
}

/**
 * Get or create an SMS conversation
 */
export async function getOrCreateConversation(options: {
  businessOwnerId: string;
  clientId?: string;
  clientPhone: string;
  clientName?: string;
  jobId?: string;
}): Promise<SmsConversation> {
  const formattedPhone = formatPhoneNumber(options.clientPhone);
  
  // Check if conversation exists
  let conversation = await storage.getSmsConversationByPhone(
    options.businessOwnerId,
    formattedPhone
  );
  
  if (!conversation) {
    // Create new conversation
    conversation = await storage.createSmsConversation({
      businessOwnerId: options.businessOwnerId,
      clientId: options.clientId || null,
      clientPhone: formattedPhone,
      clientName: options.clientName || null,
      jobId: options.jobId || null,
      lastMessageAt: new Date(),
      unreadCount: 0,
      isArchived: false,
      deletedAt: null,
    });
  } else if (options.jobId && !conversation.jobId) {
    // Link job to existing conversation if not already linked
    conversation = await storage.updateSmsConversation(conversation.id, {
      jobId: options.jobId,
    });
  }
  
  return conversation;
}

/**
 * Send an SMS message to a client
 */
export async function sendSmsToClient(options: SendSmsOptions): Promise<SmsMessage> {
  const conversation = await getOrCreateConversation({
    businessOwnerId: options.businessOwnerId,
    clientId: options.clientId,
    clientPhone: options.clientPhone,
    clientName: options.clientName,
    jobId: options.jobId,
  });
  
  // Create message record first (pending status)
  const message = await storage.createSmsMessage({
    conversationId: conversation.id,
    direction: 'outbound',
    body: options.message,
    senderUserId: options.senderUserId,
    status: 'pending',
    isQuickAction: options.isQuickAction || false,
    quickActionType: options.quickActionType || null,
    readAt: null,
    twilioSid: null,
    errorMessage: null,
  });
  
  // Send via Twilio
  const result = await sendSMS({
    to: conversation.clientPhone,
    message: options.message,
  });
  
  // Update message with result
  const updatedMessage = await storage.updateSmsMessage(message.id, {
    status: result.success ? 'sent' : 'failed',
    twilioSid: result.messageId || null,
    errorMessage: result.error || null,
  });
  
  // Update conversation last message timestamp
  await storage.updateSmsConversation(conversation.id, {
    lastMessageAt: new Date(),
  });
  
  return updatedMessage;
}

/**
 * Send a quick action SMS
 */
export async function sendQuickAction(options: QuickActionOptions): Promise<SmsMessage> {
  const conversation = await storage.getSmsConversation(options.conversationId);
  if (!conversation) {
    throw new Error('Conversation not found');
  }
  
  const now = new Date();
  const timeString = now.toLocaleTimeString('en-AU', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  
  let message = '';
  const businessName = options.businessName || 'Your tradie';
  const jobTitle = options.jobTitle || 'your job';
  
  switch (options.actionType) {
    case 'on_my_way':
      message = `Hi! ${businessName} here. I'm on my way to ${jobTitle}. ${options.estimatedTime ? `ETA: ${options.estimatedTime}` : 'See you soon!'} (${timeString})`;
      break;
    case 'just_arrived':
      message = `Hi! ${businessName} has just arrived for ${jobTitle}. (${timeString})`;
      break;
    case 'job_finished':
      message = `Hi! ${businessName} has finished work on ${jobTitle}. Thanks for having us! (${timeString})`;
      break;
    case 'running_late':
      message = `Hi! ${businessName} here. Running a bit late for ${jobTitle}. ${options.estimatedTime ? `New ETA: ${options.estimatedTime}` : 'Apologies for the delay.'} (${timeString})`;
      break;
    case 'need_materials':
      message = `Hi! ${businessName} here. Need to pick up some materials for ${jobTitle}. Will be back shortly. (${timeString})`;
      break;
    default:
      throw new Error('Invalid quick action type');
  }
  
  return sendSmsToClient({
    businessOwnerId: conversation.businessOwnerId,
    clientId: conversation.clientId || undefined,
    clientPhone: conversation.clientPhone,
    clientName: conversation.clientName || undefined,
    jobId: conversation.jobId || undefined,
    message,
    senderUserId: options.senderUserId,
    isQuickAction: true,
    quickActionType: options.actionType,
  });
}

/**
 * Handle incoming SMS from Twilio webhook
 * 
 * Multi-tenant safety: When multiple businesses serve the same client,
 * we resolve to the most recent conversation that has had an outbound message.
 * This ensures replies go to the business that most recently contacted the client.
 */
export async function handleIncomingSms(
  fromPhone: string,
  toPhone: string,
  body: string,
  twilioSid: string
): Promise<SmsMessage | null> {
  const formattedFromPhone = formatPhoneNumber(fromPhone);
  
  // Find all conversations with this client phone number
  const conversations = await storage.getSmsConversationsByClientPhone(formattedFromPhone);
  
  if (conversations.length === 0) {
    console.log(`[SMS] No conversation found for incoming SMS from ${formattedFromPhone}`);
    return null;
  }
  
  // Multi-tenant safety: Find the conversation that most recently sent an outbound message
  // This ensures replies go to the business that last contacted the client
  let targetConversation = null;
  let latestOutboundTime = new Date(0);
  
  for (const conv of conversations) {
    // Get the most recent outbound message for this conversation
    const messages = await storage.getSmsMessages(conv.id);
    const lastOutbound = messages
      .filter(m => m.direction === 'outbound')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    
    if (lastOutbound) {
      const outboundTime = new Date(lastOutbound.createdAt);
      if (outboundTime > latestOutboundTime) {
        latestOutboundTime = outboundTime;
        targetConversation = conv;
      }
    }
  }
  
  // Fallback: if no outbound messages found, use the most recent conversation
  if (!targetConversation) {
    targetConversation = conversations.sort((a, b) => 
      new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime()
    )[0];
    console.log(`[SMS] No outbound messages found for ${formattedFromPhone}, using most recent conversation`);
  }
  
  // Create inbound message
  const message = await storage.createSmsMessage({
    conversationId: targetConversation.id,
    direction: 'inbound',
    body,
    senderUserId: null,
    status: 'received',
    twilioSid,
    isQuickAction: false,
    quickActionType: null,
    readAt: null,
    errorMessage: null,
  });
  
  // Update conversation
  await storage.updateSmsConversation(targetConversation.id, {
    lastMessageAt: new Date(),
    unreadCount: (targetConversation.unreadCount || 0) + 1,
  });
  
  console.log(`[SMS] Inbound message routed to conversation ${targetConversation.id} (business: ${targetConversation.businessOwnerId})`);
  
  return message;
}

/**
 * Get SMS conversations for a user with role-based filtering
 */
export async function getSmsConversationsForUser(
  userId: string,
  businessOwnerId: string,
  userRole: string
): Promise<SmsConversation[]> {
  if (['owner', 'admin', 'manager'].includes(userRole.toLowerCase())) {
    // Owners/admins/managers see all conversations
    return storage.getSmsConversationsByBusiness(businessOwnerId);
  } else {
    // Workers only see conversations linked to jobs they're assigned to
    const assignedJobs = await storage.getJobsByAssignee(userId);
    const jobIds = assignedJobs.map(j => j.id);
    return storage.getSmsConversationsByJobIds(jobIds);
  }
}

/**
 * Mark conversation messages as read
 */
export async function markConversationAsRead(
  conversationId: string,
  userId: string
): Promise<void> {
  await storage.markSmsMessagesAsRead(conversationId);
  await storage.updateSmsConversation(conversationId, {
    unreadCount: 0,
  });
}

/**
 * Soft delete a conversation
 */
export async function deleteConversation(conversationId: string): Promise<void> {
  await storage.updateSmsConversation(conversationId, {
    deletedAt: new Date(),
  });
}

/**
 * Get Twilio status
 */
export function getTwilioStatus(): { enabled: boolean; phoneNumber: string | null } {
  return {
    enabled: isTwilioInitialized(),
    phoneNumber: getTwilioPhoneNumber(),
  };
}

export { smsTemplates };
