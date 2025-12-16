/**
 * SMS Service for TradieTrack
 * Handles two-way SMS communication with clients via Twilio
 * 
 * Integration: connection:conn_twilio_01KB17KVHYEAGTVK0VVR1H47AA
 */

import twilio from 'twilio';
import { sendSMS, getTwilioPhoneNumber, isTwilioInitialized, smsTemplates } from '../twilioClient';
import { storage } from '../storage';
import type { SmsConversation, SmsMessage, InsertSmsConversation, InsertSmsMessage, BusinessSettings } from '@shared/schema';
import { broadcastSmsNotification } from '../websocket';
import { detectSmsJobIntent } from '../ai';

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
  mediaUrls?: string[]; // MMS media URLs (max 10, each up to 5MB)
}

interface QuickActionOptions {
  conversationId: string;
  senderUserId: string;
  actionType: 'on_my_way' | 'just_arrived' | 'job_finished' | 'running_late' | 'need_materials';
  jobTitle?: string;
  businessName?: string;
  estimatedTime?: string;
  includeTrackingLink?: boolean;
  trackingLinkUrl?: string;
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
 * Send SMS using business's custom Twilio credentials if configured
 */
async function sendSmsWithBusinessSettings(
  to: string,
  message: string,
  businessSettings: BusinessSettings | null | undefined,
  mediaUrls?: string[]
): Promise<{ success: boolean; messageId?: string; error?: string; simulated?: boolean }> {
  // Format phone number
  let formattedTo = to.replace(/\s+/g, '').replace(/^0/, '+61');
  if (!formattedTo.startsWith('+')) {
    formattedTo = '+61' + formattedTo.replace(/^61/, '');
  }
  
  const validMediaUrls = mediaUrls?.slice(0, 10) || [];
  const isMMS = validMediaUrls.length > 0;
  
  // Check if business has custom Twilio settings
  if (businessSettings?.twilioAccountSid && businessSettings?.twilioAuthToken) {
    try {
      const client = twilio(businessSettings.twilioAccountSid, businessSettings.twilioAuthToken);
      
      // Determine the "from" value - use sender ID or phone number
      // Note: Alphanumeric sender IDs don't support MMS, so use phone number for MMS
      let fromValue: string;
      if (isMMS || !businessSettings.twilioSenderId) {
        // Use phone number for MMS or if no sender ID configured
        fromValue = businessSettings.twilioPhoneNumber || getTwilioPhoneNumber() || '';
      } else {
        // Use alphanumeric sender ID for SMS (max 11 chars, alphanumeric only)
        fromValue = businessSettings.twilioSenderId.slice(0, 11);
      }
      
      if (!fromValue) {
        throw new Error('No Twilio phone number or sender ID configured');
      }
      
      const messageOptions: any = {
        body: message,
        from: fromValue,
        to: formattedTo
      };
      
      if (isMMS) {
        messageOptions.mediaUrl = validMediaUrls;
      }
      
      const result = await client.messages.create(messageOptions);
      console.log(`✅ ${isMMS ? 'MMS' : 'SMS'} sent via business Twilio (${fromValue}) to ${formattedTo}: ${result.sid}`);
      return { success: true, messageId: result.sid };
    } catch (error: any) {
      console.error(`❌ Failed to send ${isMMS ? 'MMS' : 'SMS'} via business Twilio:`, error.message);
      // Fall back to platform Twilio
      console.log('Falling back to platform Twilio...');
    }
  }
  
  // Fall back to platform Twilio
  return sendSMS({ to: formattedTo, message, mediaUrls: validMediaUrls.length > 0 ? validMediaUrls : undefined });
}

/**
 * Send an SMS/MMS message to a client
 */
export async function sendSmsToClient(options: SendSmsOptions): Promise<SmsMessage> {
  const conversation = await getOrCreateConversation({
    businessOwnerId: options.businessOwnerId,
    clientId: options.clientId,
    clientPhone: options.clientPhone,
    clientName: options.clientName,
    jobId: options.jobId,
  });
  
  // Fetch business settings for custom Twilio configuration
  const businessSettings = await storage.getBusinessSettings(options.businessOwnerId);
  
  // Validate and limit media URLs (max 10 per Twilio MMS)
  const validMediaUrls = options.mediaUrls?.slice(0, 10) || [];
  
  // Create message record first (pending status)
  const message = await storage.createSmsMessage({
    conversationId: conversation.id,
    direction: 'outbound',
    body: options.message,
    senderUserId: options.senderUserId,
    status: 'pending',
    isQuickAction: options.isQuickAction || false,
    quickActionType: options.quickActionType || null,
    mediaUrls: validMediaUrls,
    readAt: null,
    twilioSid: null,
    errorMessage: null,
  });
  
  // Send via Twilio using business settings if available
  const result = await sendSmsWithBusinessSettings(
    conversation.clientPhone,
    options.message,
    businessSettings,
    validMediaUrls.length > 0 ? validMediaUrls : undefined
  );
  
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
      message = `Hi! ${businessName} here. I'm on my way to ${jobTitle}. ${options.estimatedTime ? `ETA: ${options.estimatedTime}` : 'See you soon!'}`;
      if (options.includeTrackingLink && options.trackingLinkUrl) {
        message += ` Track my arrival: ${options.trackingLinkUrl}`;
      }
      message += ` (${timeString})`;
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
 * Handle incoming SMS/MMS from Twilio webhook
 * 
 * Multi-tenant safety: When multiple businesses serve the same client,
 * we resolve to the most recent conversation that has had an outbound message.
 * This ensures replies go to the business that most recently contacted the client.
 * 
 * MMS support: Extracts media URLs from Twilio webhook (MediaUrl0, MediaUrl1, etc.)
 */
export async function handleIncomingSms(
  fromPhone: string,
  toPhone: string,
  body: string,
  twilioSid: string,
  mediaUrls?: string[] // MMS media URLs from Twilio webhook
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
  
  const isMMS = mediaUrls && mediaUrls.length > 0;
  const messageBody = body || (isMMS ? '[Media message]' : '');
  
  // AI Intent Detection - detect if message is a job/quote request
  let intentData: {
    isJobRequest: boolean;
    intentConfidence?: string;
    intentType?: string;
    suggestedJobTitle?: string;
    suggestedDescription?: string;
  } = { isJobRequest: false };
  
  try {
    // Only run intent detection on inbound messages with actual content
    if (messageBody && messageBody !== '[Media message]') {
      const intentResult = await detectSmsJobIntent(
        messageBody,
        targetConversation.clientName || undefined,
        isMMS
      );
      
      intentData = {
        isJobRequest: intentResult.isJobRequest,
        intentConfidence: intentResult.confidence,
        intentType: intentResult.intentType,
        suggestedJobTitle: intentResult.suggestedJobTitle,
        suggestedDescription: intentResult.suggestedDescription,
      };
      
      if (intentResult.isJobRequest) {
        console.log(`[SMS AI] Detected job request (${intentResult.confidence} confidence): "${intentResult.suggestedJobTitle}"`);
      }
    }
  } catch (aiError) {
    console.error('[SMS AI] Intent detection failed (non-blocking):', aiError);
  }
  
  // Create inbound message (with MMS media URLs and AI intent data)
  const message = await storage.createSmsMessage({
    conversationId: targetConversation.id,
    direction: 'inbound',
    body: messageBody,
    senderUserId: null,
    status: 'received',
    twilioSid,
    isQuickAction: false,
    quickActionType: null,
    mediaUrls: mediaUrls || [],
    isJobRequest: intentData.isJobRequest,
    intentConfidence: intentData.intentConfidence || null,
    intentType: intentData.intentType || null,
    suggestedJobTitle: intentData.suggestedJobTitle || null,
    suggestedDescription: intentData.suggestedDescription || null,
    jobCreatedFromSms: null,
    readAt: null,
    errorMessage: null,
  });
  
  // Update conversation
  const newUnreadCount = (targetConversation.unreadCount || 0) + 1;
  await storage.updateSmsConversation(targetConversation.id, {
    lastMessageAt: new Date(),
    unreadCount: newUnreadCount,
  });
  
  console.log(`[${isMMS ? 'MMS' : 'SMS'}] Inbound message routed to conversation ${targetConversation.id} (business: ${targetConversation.businessOwnerId})${isMMS ? ` with ${mediaUrls.length} media attachment(s)` : ''}${intentData.isJobRequest ? ' [JOB REQUEST DETECTED]' : ''}`);
  
  // Broadcast WebSocket notification to business owner and team members
  try {
    broadcastSmsNotification(targetConversation.businessOwnerId, {
      conversationId: targetConversation.id,
      senderPhone: formattedFromPhone,
      senderName: targetConversation.clientName,
      messagePreview: messageBody.slice(0, 100),
      jobId: targetConversation.jobId,
      unreadCount: newUnreadCount,
      // Include job request flag for UI to show action button
      isJobRequest: intentData.isJobRequest,
      suggestedJobTitle: intentData.suggestedJobTitle,
    });
  } catch (wsError) {
    console.error('[SMS] Error broadcasting WebSocket notification:', wsError);
  }
  
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

/**
 * Merge field context for SMS template parsing
 */
export interface MergeContext {
  client_name?: string;
  client_first_name?: string;
  job_title?: string;
  job_address?: string;
  scheduled_date?: string;
  scheduled_time?: string;
  business_name?: string;
  quote_amount?: string;
  invoice_amount?: string;
  invoice_due_date?: string;
  booking_link?: string;
  tracking_link?: string;
}

/**
 * Available merge fields for SMS templates
 */
export const AVAILABLE_MERGE_FIELDS = [
  { field: '{client_name}', description: 'Full client name' },
  { field: '{client_first_name}', description: 'Client first name' },
  { field: '{job_title}', description: 'Job title' },
  { field: '{job_address}', description: 'Job address' },
  { field: '{scheduled_date}', description: 'Scheduled date (e.g., Mon 15 Jan)' },
  { field: '{scheduled_time}', description: 'Scheduled time (e.g., 9:00 AM)' },
  { field: '{business_name}', description: 'Your business name' },
  { field: '{quote_amount}', description: 'Quote total amount' },
  { field: '{invoice_amount}', description: 'Invoice total amount' },
  { field: '{invoice_due_date}', description: 'Invoice due date' },
  { field: '{booking_link}', description: 'Booking confirmation link' },
  { field: '{tracking_link}', description: 'Job tracking link' },
] as const;

/**
 * Parse an SMS template by replacing merge fields with actual values
 * 
 * @param template - The template string with merge fields like {client_name}
 * @param context - The context object containing values for merge fields
 * @returns The parsed template with merge fields replaced
 */
export function parseSmsTemplate(template: string, context: MergeContext): string {
  let parsed = template;
  
  // Replace each merge field with its value or empty string if not provided
  const replacements: Record<string, string | undefined> = {
    '{client_name}': context.client_name,
    '{client_first_name}': context.client_first_name,
    '{job_title}': context.job_title,
    '{job_address}': context.job_address,
    '{scheduled_date}': context.scheduled_date,
    '{scheduled_time}': context.scheduled_time,
    '{business_name}': context.business_name,
    '{quote_amount}': context.quote_amount,
    '{invoice_amount}': context.invoice_amount,
    '{invoice_due_date}': context.invoice_due_date,
    '{booking_link}': context.booking_link,
    '{tracking_link}': context.tracking_link,
  };
  
  for (const [field, value] of Object.entries(replacements)) {
    // Replace field with value, or remove it if value is undefined/empty
    parsed = parsed.replace(new RegExp(field.replace(/[{}]/g, '\\$&'), 'g'), value || '');
  }
  
  // Clean up any double spaces that might result from removed fields
  parsed = parsed.replace(/\s{2,}/g, ' ').trim();
  
  return parsed;
}

/**
 * Default SMS templates to seed for new users
 */
export const DEFAULT_SMS_TEMPLATES = [
  {
    name: 'Booking Confirmation',
    category: 'booking',
    body: 'Hi {client_name}, your booking with {business_name} is confirmed for {scheduled_date} at {scheduled_time}. Address: {job_address}. Reply YES to confirm or call us to reschedule.',
    isDefault: true,
  },
  {
    name: 'On My Way',
    category: 'arrival',
    body: 'Hi {client_first_name}, {business_name} here. I\'m on my way for {job_title}. ETA approximately 15 minutes. See you soon!',
    isDefault: true,
  },
  {
    name: 'Quote Follow-up',
    category: 'quote',
    body: 'Hi {client_name}, just following up on the quote for {job_title} ({quote_amount}). Let me know if you have any questions or are ready to proceed. - {business_name}',
    isDefault: true,
  },
  {
    name: 'Invoice Reminder',
    category: 'invoice',
    body: 'Hi {client_name}, friendly reminder that invoice for {job_title} ({invoice_amount}) is due on {invoice_due_date}. Please let us know if you have any questions. - {business_name}',
    isDefault: true,
  },
  {
    name: 'Job Completion',
    category: 'general',
    body: 'Hi {client_name}, {business_name} has completed work on {job_title}. Thanks for having us! An invoice will follow shortly. Please let us know if you need anything else.',
    isDefault: true,
  },
] as const;

/**
 * Seed default SMS templates for a new user
 */
export async function seedDefaultSmsTemplates(userId: string): Promise<void> {
  for (const template of DEFAULT_SMS_TEMPLATES) {
    await storage.createSmsTemplate({
      userId,
      name: template.name,
      category: template.category,
      body: template.body,
      isDefault: template.isDefault,
    });
  }
}

/**
 * Generate a tracking link for a job
 * Used when sending "On My Way" SMS to include live location tracking
 */
export async function generateTrackingLink(
  jobId: string,
  teamMemberId: string,
  businessOwnerId: string
): Promise<{ url: string; token: string } | null> {
  try {
    const { randomBytes } = await import('crypto');
    
    // Check if there's already an active tracking link
    const existingLink = await storage.getSmsTrackingLinkByJobId(jobId);
    if (existingLink && existingLink.isActive && new Date(existingLink.expiresAt) > new Date()) {
      const baseUrl = process.env.REPLIT_DOMAIN 
        ? `https://${process.env.REPLIT_DOMAIN}`
        : process.env.BASE_URL || 'http://localhost:5000';
      return {
        url: `${baseUrl}/track/${existingLink.token}`,
        token: existingLink.token,
      };
    }
    
    // Deactivate any existing links
    if (existingLink) {
      await storage.deactivateSmsTrackingLink(existingLink.id);
    }
    
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // Expires in 24 hours
    
    await storage.createSmsTrackingLink({
      jobId,
      teamMemberId,
      businessOwnerId,
      token,
      expiresAt,
      estimatedArrival: null,
    });
    
    const baseUrl = process.env.REPLIT_DOMAIN 
      ? `https://${process.env.REPLIT_DOMAIN}`
      : process.env.BASE_URL || 'http://localhost:5000';
    
    return {
      url: `${baseUrl}/track/${token}`,
      token,
    };
  } catch (error) {
    console.error('Error generating tracking link:', error);
    return null;
  }
}

export { smsTemplates };
