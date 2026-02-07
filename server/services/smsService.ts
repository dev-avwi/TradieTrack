/**
 * SMS Service for JobRunner
 * Handles two-way SMS communication with clients via Twilio
 * 
 * Integration: connection:conn_twilio_01KB17KVHYEAGTVK0VVR1H47AA
 */

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
  businessPhone?: string;
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
 * Send SMS via the platform Twilio account
 */
async function sendSmsPlatform(
  to: string,
  message: string,
  mediaUrls?: string[]
): Promise<{ success: boolean; messageId?: string; error?: string; simulated?: boolean }> {
  const formattedTo = formatPhoneNumber(to);
  const validMediaUrls = mediaUrls?.slice(0, 10) || [];
  
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
  
  const validMediaUrls = options.mediaUrls?.slice(0, 10) || [];
  
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
  
  const result = await sendSmsPlatform(
    conversation.clientPhone,
    options.message,
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
  
  if (options.businessPhone) {
    message += `\nCall us: ${options.businessPhone}`;
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
 * Check if incoming SMS is a quote acceptance and process it
 * Detects: YES, ACCEPT, APPROVED, OK, CONFIRM, GO AHEAD, etc.
 * Returns auto-acceptance result with confirmation sent
 */
async function checkAndProcessQuoteAcceptance(
  messageBody: string,
  clientPhone: string,
  conversation: SmsConversation
): Promise<{ processed: boolean; quoteId?: string; message?: string }> {
  // Normalize the message for matching (exact match only)
  const normalized = messageBody.trim().toUpperCase();
  
  // First check for rejection/negation keywords using word boundaries
  const rejectionPattern = /\b(NOT|CAN'?T|WON'?T|DON'?T|CANNOT|DECLINE|REJECT|NOPE|NAH)\b/i;
  if (rejectionPattern.test(normalized) || normalized === 'NO') {
    return { processed: false };
  }
  
  // Keywords that indicate acceptance - EXACT MATCH ONLY (no substring matching)
  const acceptKeywords = ['YES', 'YEP', 'YEAH', 'YUP', 'Y', 'ACCEPT', 'ACCEPTED', 
    'APPROVED', 'APPROVE', 'OK', 'OKAY', 'CONFIRM', 'CONFIRMED',
    'GO AHEAD', 'SOUNDS GOOD', 'LOOKS GOOD', 'PROCEED', 'AGREED', 'DEAL', 'DONE'];
  
  // Check for explicit quote number in message (e.g., "ACCEPT 1234", "YES Q-1234", "ACCEPT #1234")
  const quoteNumberMatch = normalized.match(/(?:ACCEPT|YES|APPROVE|CONFIRM)\s*#?([A-Z]*-?\d+)/);
  const specifiedQuoteNumber = quoteNumberMatch ? quoteNumberMatch[1] : null;
  
  // Check for EXACT acceptance match (with optional quote number or punctuation)
  const isExactAcceptance = acceptKeywords.some(keyword => 
    normalized === keyword || 
    normalized === keyword + '!' ||
    normalized === keyword + '.' ||
    // Support "YES 1234" or "ACCEPT Q-1234" format
    (specifiedQuoteNumber && normalized.startsWith(keyword))
  );
  
  if (!isExactAcceptance) {
    return { processed: false };
  }
  
  // Check if there's a recent quote SMS sent to this client
  if (!conversation.clientId) {
    console.log('[SMS Quote Accept] No client linked to conversation');
    return { processed: false };
  }
  
  try {
    // Check if we recently sent a quote SMS to this conversation (within 72 hours)
    const messages = await storage.getSmsMessages(conversation.id);
    const recentQuoteMessage = messages.find(m => {
      if (m.direction !== 'outbound') return false;
      const msgAge = Date.now() - new Date(m.createdAt).getTime();
      const is72Hours = msgAge < 72 * 60 * 60 * 1000;
      const isQuoteMessage = m.body?.toLowerCase().includes('quote') && 
                             (m.body?.toLowerCase().includes('ready') || m.body?.toLowerCase().includes('reply yes'));
      return is72Hours && isQuoteMessage;
    });
    
    if (!recentQuoteMessage) {
      console.log('[SMS Quote Accept] No recent quote SMS found in conversation');
      return { processed: false };
    }
    
    // Get quotes for this client - ONLY 'sent' status (not drafts, accepted, or rejected)
    const quotes = await storage.getQuotesByClient(conversation.clientId);
    const sentQuotes = quotes.filter(q => q.status === 'sent');
    
    if (sentQuotes.length === 0) {
      console.log('[SMS Quote Accept] No sent quotes found for client');
      return { processed: false };
    }
    
    let targetQuote = null;
    const now = new Date();
    
    // If client specified a quote number, find that exact quote
    if (specifiedQuoteNumber) {
      targetQuote = sentQuotes.find(q => 
        q.number?.toUpperCase() === specifiedQuoteNumber ||
        q.number?.toUpperCase().endsWith(specifiedQuoteNumber)
      );
      
      if (!targetQuote) {
        console.log(`[SMS Quote Accept] Specified quote ${specifiedQuoteNumber} not found`);
        const businessSettings = await storage.getBusinessSettings(conversation.businessOwnerId);
        const businessName = businessSettings?.businessName || 'Your tradie';
        await sendSMS({ 
          to: clientPhone, 
          message: `Quote #${specifiedQuoteNumber} wasn't found. Available quotes: ${sentQuotes.map(q => q.number).join(', ')}. - ${businessName}`
        });
        return { processed: false };
      }
    } else if (sentQuotes.length > 1) {
      // Multiple quotes but no number specified - require clarification
      console.log('[SMS Quote Accept] Multiple quotes pending - asking for clarification');
      const businessSettings = await storage.getBusinessSettings(conversation.businessOwnerId);
      const businessName = businessSettings?.businessName || 'Your tradie';
      const quoteList = sentQuotes.map(q => `#${q.number}`).join(', ');
      await sendSMS({ 
        to: clientPhone, 
        message: `Thanks! You have multiple pending quotes (${quoteList}). Please reply with "Accept" followed by the quote number, e.g., "Accept ${sentQuotes[0].number}". - ${businessName}`
      });
      return { processed: false };
    } else {
      // Only one quote - select it
      targetQuote = sentQuotes[0];
    }
    
    // Validate the target quote
    const latestQuote = targetQuote;
    
    // Check quote validity - must be within valid period
    if (latestQuote.validUntil && new Date(latestQuote.validUntil) < now) {
      console.log('[SMS Quote Accept] Quote has expired (validUntil passed)');
      const businessSettings = await storage.getBusinessSettings(conversation.businessOwnerId);
      const businessName = businessSettings?.businessName || 'Your tradie';
      await sendSMS({ 
        to: clientPhone, 
        message: `Sorry, quote #${latestQuote.number} has expired. Please contact ${businessName} for an updated quote.`
      });
      return { processed: false };
    }
    
    // Check if quote was sent recently (within 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sentDate = latestQuote.sentAt ? new Date(latestQuote.sentAt) : new Date(latestQuote.createdAt);
    
    if (sentDate < sevenDaysAgo) {
      console.log('[SMS Quote Accept] Quote was sent more than 7 days ago');
      return { processed: false };
    }
    
    // Get client name for acceptance record
    const client = await storage.getClient(conversation.clientId, conversation.businessOwnerId);
    const clientName = client?.name || 'Client';
    
    // Re-check quote status right before accepting (optimistic concurrency guard)
    const freshQuote = await storage.getQuoteById(latestQuote.id, conversation.businessOwnerId);
    if (!freshQuote || freshQuote.status !== 'sent') {
      console.log(`[SMS Quote Accept] Quote ${latestQuote.number} status changed since check (now: ${freshQuote?.status})`);
      const businessSettings = await storage.getBusinessSettings(conversation.businessOwnerId);
      const businessName = businessSettings?.businessName || 'Your tradie';
      const statusMessage = freshQuote?.status === 'accepted' 
        ? `Quote #${latestQuote.number} has already been accepted.` 
        : `Quote #${latestQuote.number} is no longer available.`;
      await sendSMS({ to: clientPhone, message: `${statusMessage} - ${businessName}` });
      return { processed: false };
    }
    
    // Accept the quote (status verified as 'sent')
    await storage.updateQuote(latestQuote.id, conversation.businessOwnerId, {
      status: 'accepted',
      acceptedAt: new Date(),
      acceptedBy: `${clientName} (via SMS)`,
    });
    
    console.log(`[SMS Quote Accept] Quote ${latestQuote.number} accepted via SMS by ${clientName}`);
    
    // Send confirmation SMS
    const businessSettings = await storage.getBusinessSettings(conversation.businessOwnerId);
    const businessName = businessSettings?.businessName || 'Your tradie';
    const total = parseFloat(latestQuote.total || '0').toFixed(2);
    
    const confirmationMessage = `Thanks ${clientName}! Your quote #${latestQuote.number} for $${total} is now ACCEPTED. We'll be in touch soon to schedule the work. - ${businessName}`;
    
    // Send confirmation via platform Twilio
    await sendSMS({ 
      to: clientPhone, 
      message: confirmationMessage 
    });
    
    // Create outbound confirmation message in conversation
    await storage.createSmsMessage({
      conversationId: conversation.id,
      direction: 'outbound',
      body: confirmationMessage,
      senderUserId: null, // System generated
      status: 'sent',
      twilioSid: null,
      isQuickAction: false,
      quickActionType: null,
      mediaUrls: [],
      isJobRequest: false,
      intentConfidence: null,
      intentType: null,
      suggestedJobTitle: null,
      suggestedDescription: null,
      jobCreatedFromSms: null,
      readAt: null,
      errorMessage: null,
    });
    
    // Broadcast notification to tradie about quote acceptance
    broadcastSmsNotification(conversation.businessOwnerId, {
      conversationId: conversation.id,
      senderPhone: clientPhone,
      senderName: clientName,
      messagePreview: `Quote #${latestQuote.number} ACCEPTED via SMS reply!`,
      jobId: conversation.jobId,
      unreadCount: (conversation.unreadCount || 0) + 1,
      isQuoteAcceptance: true,
      quoteId: latestQuote.id,
    });
    
    return { 
      processed: true, 
      quoteId: latestQuote.id,
      message: `Quote ${latestQuote.number} accepted via SMS` 
    };
    
  } catch (error: any) {
    console.error('[SMS Quote Accept] Error processing acceptance:', error);
    return { processed: false };
  }
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
  
  let isNewConversation = false;
  let isUnknownCaller = false;
  
  if (conversations.length === 0) {
    console.log(`[SMS] No conversation found for incoming SMS from ${formattedFromPhone} - auto-creating...`);
    
    // Try to find ALL business owners and match against their clients
    // For now, we'll need to iterate through all businesses to find a client match
    // This is a necessary trade-off for handling truly unknown inbound SMS
    const allBusinessSettings = await storage.getAllBusinessSettings();
    
    let matchedClient = null;
    let matchedBusinessOwnerId = null;
    
    for (const business of allBusinessSettings) {
      const client = await storage.getClientByPhone(business.userId, formattedFromPhone);
      if (client) {
        matchedClient = client;
        matchedBusinessOwnerId = business.userId;
        console.log(`[SMS] Found matching client "${client.name}" for business ${business.businessName}`);
        break;
      }
    }
    
    if (matchedClient && matchedBusinessOwnerId) {
      // Create conversation linked to the found client
      const newConversation = await storage.createSmsConversation({
        businessOwnerId: matchedBusinessOwnerId,
        clientId: matchedClient.id,
        clientPhone: formattedFromPhone,
        clientName: matchedClient.name,
        jobId: null,
        lastMessageAt: new Date(),
        unreadCount: 0,
        isArchived: false,
        deletedAt: null,
      });
      conversations.push(newConversation);
      isNewConversation = true;
      console.log(`[SMS] Created new conversation ${newConversation.id} for existing client "${matchedClient.name}"`);
    } else {
      // No client match found - create conversation with Unknown Caller
      // Use the first business as default (or could be configured)
      if (allBusinessSettings.length > 0) {
        const defaultBusiness = allBusinessSettings[0];
        const newConversation = await storage.createSmsConversation({
          businessOwnerId: defaultBusiness.userId,
          clientId: null,
          clientPhone: formattedFromPhone,
          clientName: `Unknown Caller (${formattedFromPhone})`,
          jobId: null,
          lastMessageAt: new Date(),
          unreadCount: 0,
          isArchived: false,
          deletedAt: null,
        });
        conversations.push(newConversation);
        isNewConversation = true;
        isUnknownCaller = true;
        console.log(`[SMS] Created new conversation ${newConversation.id} for unknown caller ${formattedFromPhone}`);
      } else {
        console.log(`[SMS] No business settings found - cannot create conversation for ${formattedFromPhone}`);
        return null;
      }
    }
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
  
  // Check for quote acceptance via SMS reply (YES, ACCEPT, APPROVED, etc.)
  const quoteAcceptanceResult = await checkAndProcessQuoteAcceptance(
    messageBody,
    formattedFromPhone,
    targetConversation
  );
  
  if (quoteAcceptanceResult.processed) {
    console.log(`[SMS] Quote acceptance processed: ${quoteAcceptanceResult.message}`);
    // Continue to store the message but don't process further
  }
  
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
      // Include flags for new/unknown conversations
      isNewConversation,
      isUnknownCaller,
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

export { smsTemplates, sendSMS };
