import { storage } from './storage';
import type { BusinessSettings, InsertAiReceptionistCall, InsertNotification } from '@shared/schema';
import crypto from 'crypto';

interface TransferNumber {
  name: string;
  phone: string;
  priority: number;
}

interface BusinessHoursConfig {
  start: string;
  end: string;
  timezone: string;
  days: number[];
}

const VAPI_API_BASE = 'https://api.vapi.ai';
const VAPI_API_KEY = process.env.VAPI_PRIVATE_KEY || '';

export function verifyVapiWebhook(rawBody: Buffer, signature: string | undefined): boolean {
  if (!VAPI_API_KEY) {
    console.error('[Vapi] VAPI_PRIVATE_KEY not configured — rejecting webhook (fail-closed)');
    return false;
  }
  if (!signature) {
    console.error('[Vapi] Missing x-vapi-signature header — rejecting webhook');
    return false;
  }
  try {
    const hmac = crypto.createHmac('sha256', VAPI_API_KEY);
    hmac.update(rawBody);
    const expected = hmac.digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature, 'utf8'), Buffer.from(expected, 'utf8'));
  } catch {
    return false;
  }
}

interface VapiAssistantConfig {
  businessName: string;
  businessPhone?: string;
  tradeType?: string;
  greeting?: string;
  voice?: string;
  transferNumbers?: Array<{ name: string; phone: string; priority: number }>;
  businessHours?: { start: string; end: string; timezone: string; days: number[] };
  webhookUrl: string;
}

interface VapiResponse {
  id: string;
  [key: string]: any;
}

const AUSTRALIAN_VOICES: Record<string, { voiceId: string; provider: string }> = {
  'Jess': { voiceId: '21m00Tcm4TlvDq8ikWAM', provider: '11labs' },
  'Harry': { voiceId: 'SOYHLrjzK2X1ezoPC6cr', provider: '11labs' },
  'Chris': { voiceId: 'iP95p4xoKVk53GoZ742B', provider: '11labs' },
};

async function vapiRequest(method: string, path: string, body?: any): Promise<any> {
  if (!VAPI_API_KEY) {
    throw new Error('VAPI_PRIVATE_KEY is not configured');
  }

  const url = `${VAPI_API_BASE}${path}`;
  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${VAPI_API_KEY}`,
      'Content-Type': 'application/json',
    },
  };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Vapi] ${method} ${path} failed:`, response.status, errorText);
    throw new Error(`Vapi API error: ${response.status} - ${errorText}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

function buildSystemPrompt(config: VapiAssistantConfig): string {
  const businessName = config.businessName || 'the business';
  const tradeType = config.tradeType || 'trades';

  return `You are a friendly, professional AI receptionist for ${businessName}, an Australian ${tradeType} business.

Your role:
- Answer incoming calls in a warm, natural Australian tone
- Collect the caller's name, phone number, and reason for calling
- Determine the nature of the call (quote request, job enquiry, follow-up, complaint, or general enquiry)
- For quote/job requests, ask about the type of work needed, the address/suburb, and urgency
- Take a detailed message if you cannot transfer the call

Important guidelines:
- Always introduce yourself: "${config.greeting || `G'day, thanks for calling ${businessName}. How can I help you today?`}"
- Be conversational and natural — avoid sounding robotic
- Use Australian English (favour, colour, organise)
- If the caller asks for a quote, gather: type of work, location/suburb, preferred timing, and any specific requirements
- If the caller is upset, be empathetic and assure them someone will follow up promptly
- Never make commitments about pricing, availability, or scheduling — say "I'll make sure the team gets back to you"
- If asked about business hours, refer to: ${config.businessHours ? `${config.businessHours.start} to ${config.businessHours.end}` : 'standard business hours'}
- At the end of the call, confirm you've captured their details and let them know someone will be in touch

Available tools:
1. "capture_lead" - Save the caller's contact details and reason for calling. Use this after collecting their information.
2. "check_availability" - Check if team members are available to take a call or handle a job. Use when the caller asks about availability.
3. "lookup_client" - Look up an existing client by phone number or name. Use when a returning client calls to find their history.
4. "create_booking" - Create a tentative booking/appointment. Use when the caller wants to schedule work.
${config.transferNumbers && config.transferNumbers.length > 0 ? '5. "transfer_call" - Transfer the call to a team member when the caller wants to speak with someone directly.' : ''}

Workflow:
1. First, greet the caller and ask how you can help
2. Use "lookup_client" if they mention being an existing client
3. Gather their details and reason for calling
4. Use "check_availability" if they ask about scheduling
5. Use "capture_lead" to save their details
6. If they want to book, use "create_booking"
7. If they insist on speaking with someone, use "transfer_call" (if available)`;
}

function buildToolDefinitions(config: VapiAssistantConfig): any[] {
  const tools: any[] = [
    {
      type: 'function',
      function: {
        name: 'capture_lead',
        description: 'Save the caller\'s contact details and reason for calling as a new lead',
        parameters: {
          type: 'object',
          properties: {
            caller_name: { type: 'string', description: 'The caller\'s full name' },
            caller_phone: { type: 'string', description: 'The caller\'s phone number' },
            caller_email: { type: 'string', description: 'The caller\'s email address (if provided)' },
            intent: {
              type: 'string',
              enum: ['quote_request', 'job_request', 'enquiry', 'complaint', 'follow_up'],
              description: 'The nature of the call',
            },
            job_type: { type: 'string', description: 'Type of work needed (e.g., plumbing repair, electrical inspection)' },
            address: { type: 'string', description: 'The job site address or suburb' },
            urgency: {
              type: 'string',
              enum: ['urgent', 'this_week', 'this_month', 'flexible'],
              description: 'How urgent the work is',
            },
            notes: { type: 'string', description: 'Any additional details from the caller' },
          },
          required: ['caller_name', 'intent'],
        },
      },
      server: { url: config.webhookUrl },
    },
    {
      type: 'function',
      function: {
        name: 'check_availability',
        description: 'Check team member availability for calls or jobs',
        parameters: {
          type: 'object',
          properties: {
            date: { type: 'string', description: 'Date to check availability for (YYYY-MM-DD format, optional)' },
            urgency: { type: 'string', enum: ['urgent', 'this_week', 'this_month', 'flexible'], description: 'Urgency level' },
          },
        },
      },
      server: { url: config.webhookUrl },
    },
    {
      type: 'function',
      function: {
        name: 'lookup_client',
        description: 'Look up an existing client by phone number or name to find their details and job history',
        parameters: {
          type: 'object',
          properties: {
            phone: { type: 'string', description: 'Client phone number to search for' },
            name: { type: 'string', description: 'Client name to search for' },
          },
        },
      },
      server: { url: config.webhookUrl },
    },
    {
      type: 'function',
      function: {
        name: 'create_booking',
        description: 'Create a tentative booking/appointment for the caller',
        parameters: {
          type: 'object',
          properties: {
            caller_name: { type: 'string', description: 'Name of the person requesting the booking' },
            caller_phone: { type: 'string', description: 'Phone number for the booking contact' },
            job_type: { type: 'string', description: 'Type of work to be done' },
            address: { type: 'string', description: 'Address/suburb for the work' },
            preferred_date: { type: 'string', description: 'Preferred date for the booking (YYYY-MM-DD)' },
            preferred_time: { type: 'string', description: 'Preferred time (morning, afternoon, or specific time)' },
            notes: { type: 'string', description: 'Additional notes about the booking' },
          },
          required: ['caller_name', 'job_type'],
        },
      },
      server: { url: config.webhookUrl },
    },
  ];

  if (config.transferNumbers && config.transferNumbers.length > 0) {
    tools.push({
      type: 'function',
      function: {
        name: 'transfer_call',
        description: 'Transfer the call to an available team member when the caller wants to speak with someone directly',
        parameters: {
          type: 'object',
          properties: {
            reason: { type: 'string', description: 'Why the caller wants to be transferred' },
          },
          required: ['reason'],
        },
      },
      server: { url: config.webhookUrl },
    });
  }

  return tools;
}

export async function createAssistant(config: VapiAssistantConfig): Promise<VapiResponse> {
  const voiceConfig = AUSTRALIAN_VOICES[config.voice || 'Jess'] || AUSTRALIAN_VOICES['Jess'];

  const assistantPayload = {
    name: `${config.businessName} AI Receptionist`,
    model: {
      provider: 'openai',
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: buildSystemPrompt(config),
        },
      ],
      tools: buildToolDefinitions(config),
    },
    voice: {
      provider: voiceConfig.provider,
      voiceId: voiceConfig.voiceId,
    },
    firstMessage: config.greeting || `G'day, thanks for calling ${config.businessName}. How can I help you today?`,
    endCallMessage: 'Thanks for calling! Someone from the team will be in touch soon. Have a great day!',
    serverUrl: config.webhookUrl,
    silenceTimeoutSeconds: 30,
    maxDurationSeconds: 600,
    backgroundSound: 'off',
    recordingEnabled: true,
    hipaaEnabled: false,
    clientMessages: ['transcript', 'hang', 'tool-calls', 'speech-update', 'metadata', 'conversation-update'],
    serverMessages: ['end-of-call-report', 'status-update', 'hang', 'tool-calls'],
  };

  console.log(`[Vapi] Creating assistant for ${config.businessName}`);
  return vapiRequest('POST', '/assistant', assistantPayload);
}

export async function updateAssistant(assistantId: string, config: Partial<VapiAssistantConfig>): Promise<VapiResponse> {
  const updates: any = {};

  if (config.voice) {
    const voiceConfig = AUSTRALIAN_VOICES[config.voice] || AUSTRALIAN_VOICES['Jess'];
    updates.voice = {
      provider: voiceConfig.provider,
      voiceId: voiceConfig.voiceId,
    };
  }

  if (config.greeting) {
    updates.firstMessage = config.greeting;
  }

  if (config.businessName || config.greeting || config.transferNumbers || config.businessHours || config.tradeType) {
    const fullConfig: VapiAssistantConfig = {
      businessName: config.businessName || '',
      tradeType: config.tradeType,
      greeting: config.greeting,
      voice: config.voice,
      transferNumbers: config.transferNumbers,
      businessHours: config.businessHours,
      webhookUrl: config.webhookUrl || '',
    };
    updates.model = {
      provider: 'openai',
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: buildSystemPrompt(fullConfig) }],
      tools: buildToolDefinitions(fullConfig),
    };
  }

  if (config.webhookUrl) {
    updates.serverUrl = config.webhookUrl;
  }

  console.log(`[Vapi] Updating assistant ${assistantId}`);
  return vapiRequest('PATCH', `/assistant/${assistantId}`, updates);
}

export async function deleteAssistant(assistantId: string): Promise<void> {
  console.log(`[Vapi] Deleting assistant ${assistantId}`);
  await vapiRequest('DELETE', `/assistant/${assistantId}`);
}

export async function getAssistant(assistantId: string): Promise<VapiResponse> {
  return vapiRequest('GET', `/assistant/${assistantId}`);
}

export async function listPhoneNumbers(): Promise<any[]> {
  return vapiRequest('GET', '/phone-number');
}

export async function importPhoneNumber(phoneNumber: string, twilioAccountSid: string, twilioAuthToken: string, assistantId: string): Promise<VapiResponse> {
  console.log(`[Vapi] Importing phone number ${phoneNumber}`);
  return vapiRequest('POST', '/phone-number', {
    provider: 'twilio',
    number: phoneNumber,
    twilioAccountSid,
    twilioAuthToken,
    assistantId,
  });
}

export async function assignPhoneToAssistant(phoneNumberId: string, assistantId: string): Promise<VapiResponse> {
  console.log(`[Vapi] Assigning phone ${phoneNumberId} to assistant ${assistantId}`);
  return vapiRequest('PATCH', `/phone-number/${phoneNumberId}`, {
    assistantId,
  });
}

export async function releasePhoneNumber(phoneNumberId: string): Promise<void> {
  console.log(`[Vapi] Releasing phone number ${phoneNumberId}`);
  await vapiRequest('DELETE', `/phone-number/${phoneNumberId}`);
}

export async function getCallDetails(callId: string): Promise<any> {
  return vapiRequest('GET', `/call/${callId}`);
}

export function getWebhookUrl(): string {
  const domain = process.env.REPLIT_DOMAINS?.split(',')[0] || process.env.REPL_SLUG + '.repl.co';
  return `https://${domain}/api/vapi/webhook`;
}

export async function enableAiReceptionist(userId: string): Promise<{
  success: boolean;
  assistantId?: string;
  phoneNumberId?: string;
  phoneNumber?: string;
  error?: string;
}> {
  try {
    const settings = await storage.getBusinessSettings(userId);
    if (!settings) {
      return { success: false, error: 'Business settings not found. Please complete your business profile first.' };
    }

    if (settings.vapiAssistantId) {
      return { success: false, error: 'AI Receptionist is already configured. Disable it first to reconfigure.' };
    }

    if (!settings.businessName) {
      return { success: false, error: 'Business name is required to set up the AI Receptionist.' };
    }

    if (!settings.dedicatedPhoneNumber) {
      return { success: false, error: 'A dedicated phone number is required. Please contact support to provision one.' };
    }

    const webhookUrl = getWebhookUrl();

    const transferNumbers = (settings.aiReceptionistTransferNumbers || []) as TransferNumber[];
    const businessHours = settings.aiReceptionistBusinessHours as BusinessHoursConfig | null;

    const assistant = await createAssistant({
      businessName: settings.businessName,
      businessPhone: settings.phone || undefined,
      tradeType: settings.industry || undefined,
      greeting: settings.aiReceptionistGreeting || undefined,
      voice: settings.aiReceptionistVoice || 'Jess',
      transferNumbers,
      businessHours: businessHours || undefined,
      webhookUrl,
    });

    await storage.updateBusinessSettings(userId, {
      vapiAssistantId: assistant.id,
      aiReceptionistEnabled: true,
      aiReceptionistMode: settings.aiReceptionistMode || 'always_on_message',
      smsMode: 'ai_receptionist',
    });

    console.log(`[Vapi] AI Receptionist enabled for user ${userId} - assistant: ${assistant.id}`);

    return {
      success: true,
      assistantId: assistant.id,
    };
  } catch (error: any) {
    console.error(`[Vapi] Failed to enable AI Receptionist for user ${userId}:`, error);
    return { success: false, error: error.message || 'Failed to enable AI Receptionist' };
  }
}

export async function disableAiReceptionist(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const settings = await storage.getBusinessSettings(userId);
    if (!settings) {
      return { success: false, error: 'Business settings not found' };
    }

    if (settings.vapiAssistantId) {
      try {
        await deleteAssistant(settings.vapiAssistantId);
      } catch (e: any) {
        console.warn(`[Vapi] Failed to delete assistant ${settings.vapiAssistantId}:`, e.message);
      }
    }

    if (settings.vapiPhoneNumberId) {
      try {
        await releasePhoneNumber(settings.vapiPhoneNumberId);
      } catch (e: any) {
        console.warn(`[Vapi] Failed to release phone number ${settings.vapiPhoneNumberId}:`, e.message);
      }
    }

    await storage.updateBusinessSettings(userId, {
      vapiAssistantId: null,
      vapiPhoneNumberId: null,
      aiReceptionistEnabled: false,
      aiReceptionistMode: 'off',
      smsMode: 'standard',
    });

    console.log(`[Vapi] AI Receptionist disabled for user ${userId}`);
    return { success: true };
  } catch (error: any) {
    console.error(`[Vapi] Failed to disable AI Receptionist for user ${userId}:`, error);
    return { success: false, error: error.message || 'Failed to disable AI Receptionist' };
  }
}

export async function updateReceptionistConfig(userId: string, updates: {
  voice?: string;
  greeting?: string;
  mode?: string;
  transferNumbers?: Array<{ name: string; phone: string; priority: number }>;
  businessHours?: { start: string; end: string; timezone: string; days: number[] };
}): Promise<{ success: boolean; error?: string }> {
  try {
    const settings = await storage.getBusinessSettings(userId);
    if (!settings) {
      return { success: false, error: 'Business settings not found' };
    }

    const dbUpdates: any = {};
    if (updates.voice) dbUpdates.aiReceptionistVoice = updates.voice;
    if (updates.greeting) dbUpdates.aiReceptionistGreeting = updates.greeting;
    if (updates.mode) dbUpdates.aiReceptionistMode = updates.mode;
    if (updates.transferNumbers) dbUpdates.aiReceptionistTransferNumbers = updates.transferNumbers;
    if (updates.businessHours) dbUpdates.aiReceptionistBusinessHours = updates.businessHours;

    await storage.updateBusinessSettings(userId, dbUpdates);

    if (settings.vapiAssistantId && (updates.voice || updates.greeting || updates.transferNumbers || updates.businessHours)) {
      try {
        const webhookUrl = getWebhookUrl();
        await updateAssistant(settings.vapiAssistantId, {
          businessName: settings.businessName || '',
          tradeType: settings.industry || undefined,
          voice: updates.voice || settings.aiReceptionistVoice || 'Jess',
          greeting: updates.greeting || settings.aiReceptionistGreeting || undefined,
          transferNumbers: updates.transferNumbers || (settings.aiReceptionistTransferNumbers as TransferNumber[]) || [],
          businessHours: updates.businessHours || (settings.aiReceptionistBusinessHours as BusinessHoursConfig | null) || undefined,
          webhookUrl,
        });
      } catch (e: any) {
        console.error(`[Vapi] Failed to sync assistant update:`, e.message);
      }
    }

    return { success: true };
  } catch (error: any) {
    console.error(`[Vapi] Failed to update config for user ${userId}:`, error);
    return { success: false, error: error.message };
  }
}

const assistantCache = new Map<string, { userId: string; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000;

export async function findBusinessByVapiAssistant(assistantId: string): Promise<BusinessSettings | undefined> {
  const cached = assistantCache.get(assistantId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return storage.getBusinessSettings(cached.userId);
  }

  const allSettings = await storage.getAllBusinessSettings();
  const match = allSettings.find(s => s.vapiAssistantId === assistantId);
  if (match) {
    assistantCache.set(assistantId, { userId: match.userId, timestamp: Date.now() });
  }
  return match;
}

export async function handleToolCall(
  toolName: string,
  toolArgs: any,
  userId: string,
  callId: string,
): Promise<any> {
  console.log(`[Vapi] Tool call: ${toolName} for user ${userId}, call ${callId}`);

  switch (toolName) {
    case 'capture_lead':
      return handleCaptureLead(toolArgs, userId, callId);
    case 'transfer_call':
      return handleTransferCall(toolArgs, userId);
    case 'check_availability':
      return handleCheckAvailability(toolArgs, userId);
    case 'lookup_client':
      return handleLookupClient(toolArgs, userId);
    case 'create_booking':
      return handleCreateBooking(toolArgs, userId, callId);
    default:
      console.warn(`[Vapi] Unknown tool: ${toolName}`);
      return { result: 'Tool not recognized' };
  }
}

async function handleCaptureLead(args: any, userId: string, callId: string): Promise<any> {
  try {
    const lead = await storage.createLead({
      userId,
      name: args.caller_name || 'Unknown Caller',
      phone: args.caller_phone || null,
      email: args.caller_email || null,
      source: 'phone',
      status: 'new',
      description: args.notes || `${args.intent || 'General enquiry'} - ${args.job_type || 'Not specified'}`,
      estimatedValue: null,
      notes: [
        args.job_type ? `Work type: ${args.job_type}` : null,
        args.address ? `Location: ${args.address}` : null,
        args.urgency ? `Urgency: ${args.urgency}` : null,
        `Source: AI Receptionist call (${callId})`,
      ].filter(Boolean).join('\n'),
      followUpDate: null,
      wonLostReason: null,
    });

    await storage.updateAiReceptionistCall(callId, userId, {
      leadId: lead.id,
      callerName: args.caller_name || null,
      callerIntent: args.intent || null,
      extractedInfo: {
        name: args.caller_name,
        email: args.caller_email,
        phone: args.caller_phone,
        address: args.address,
        jobType: args.job_type,
        urgency: args.urgency,
        notes: args.notes,
      },
    });

    console.log(`[Vapi] Lead created: ${lead.id} for call ${callId}`);
    return { result: `Lead captured successfully. Reference number: ${lead.id.slice(0, 8)}` };
  } catch (error: any) {
    console.error('[Vapi] Failed to capture lead:', error);
    return { result: 'I\'ve noted down the details. Someone will follow up shortly.' };
  }
}

function isWithinBusinessHours(businessHours: any): boolean {
  if (!businessHours) return true;
  try {
    const tz = businessHours.timezone || 'Australia/Brisbane';
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-AU', {
      timeZone: tz,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
      weekday: 'short',
    });
    const parts = formatter.formatToParts(now);
    const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
    const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
    const dayName = parts.find(p => p.type === 'weekday')?.value || '';
    const dayMap: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 };
    const dayNumber = dayMap[dayName] ?? new Date().getDay();

    const activeDays = businessHours.days || [1, 2, 3, 4, 5];
    if (!activeDays.includes(dayNumber)) return false;

    const [startH, startM] = (businessHours.start || '08:00').split(':').map(Number);
    const [endH, endM] = (businessHours.end || '17:00').split(':').map(Number);
    const nowMinutes = hour * 60 + minute;
    const startMinutes = startH * 60 + (startM || 0);
    const endMinutes = endH * 60 + (endM || 0);
    return nowMinutes >= startMinutes && nowMinutes <= endMinutes;
  } catch {
    return true;
  }
}

async function getAvailableTransferTarget(userId: string, settings: BusinessSettings, callerPhone?: string | null): Promise<{ name: string; phone: string } | null> {
  const mode = settings.aiReceptionistMode || 'always_on_message';
  const transferNumbers = (settings.aiReceptionistTransferNumbers || []) as TransferNumber[];
  const businessHours = settings.aiReceptionistBusinessHours as BusinessHoursConfig | null;

  if (mode === 'off') return null;
  if (mode === 'always_on_message') return null;

  if (mode === 'after_hours') {
    if (isWithinBusinessHours(businessHours)) {
      const sorted = [...transferNumbers].sort((a, b) => (a.priority || 99) - (b.priority || 99));
      return sorted[0] || null;
    }
    return null;
  }

  if (mode === 'always_on_transfer') {
    const sorted = [...transferNumbers].sort((a, b) => (a.priority || 99) - (b.priority || 99));
    return sorted[0] || null;
  }

  if (mode === 'selective') {
    const isKnownClient = await shouldTransferSelectiveByClient(userId, callerPhone);

    if (isKnownClient) {
      try {
        const teamMembers = await storage.getTeamMembers(userId);
        const availableMembers = teamMembers.filter(m =>
          m.isActive && m.aiReceptionistAvailability && m.phone
        );

        if (availableMembers.length > 0) {
          const member = availableMembers[0];
          return { name: member.firstName || member.email, phone: member.phone! };
        }

        const sorted = [...transferNumbers].sort((a, b) => (a.priority || 99) - (b.priority || 99));
        return sorted[0] || null;
      } catch {
        const sorted = [...transferNumbers].sort((a, b) => (a.priority || 99) - (b.priority || 99));
        return sorted[0] || null;
      }
    }

    return null;
  }

  return null;
}

async function shouldTransferSelectiveByClient(userId: string, callerPhone: string | null): Promise<boolean> {
  if (!callerPhone) return false;
  try {
    const clients = await storage.getClientsByPhone(callerPhone);
    return clients.length > 0;
  } catch {
    return false;
  }
}

async function handleTransferCall(args: any, userId: string): Promise<any> {
  try {
    const settings = await storage.getBusinessSettings(userId);
    if (!settings) {
      return { result: 'Unable to transfer at this time. I\'ll make sure someone calls you back.' };
    }

    const target = await getAvailableTransferTarget(userId, settings);
    if (!target) {
      return { result: 'No one is available to take the call right now. I\'ll make sure someone calls you back soon.' };
    }

    return {
      result: `Transferring to ${target.name}...`,
      forwardingPhoneNumber: target.phone,
    };
  } catch (error: any) {
    console.error('[Vapi] Transfer failed:', error);
    return { result: 'Unable to transfer at this time. I\'ll make sure someone calls you back.' };
  }
}

async function handleCheckAvailability(args: any, userId: string): Promise<any> {
  try {
    const settings = await storage.getBusinessSettings(userId);
    if (!settings) {
      return { result: 'I\'m not able to check availability right now. Someone from the team will get back to you.' };
    }

    const businessHours = settings.aiReceptionistBusinessHours as BusinessHoursConfig | null;
    const withinHours = isWithinBusinessHours(businessHours);

    const teamMembers = await storage.getTeamMembers(userId);
    const availableCount = teamMembers.filter(m => m.isActive && m.aiReceptionistAvailability).length;

    const hoursStr = businessHours
      ? `${businessHours.start || '8:00'} to ${businessHours.end || '5:00 PM'}`
      : 'standard business hours';

    if (withinHours && availableCount > 0) {
      return { result: `The team is currently available during business hours (${hoursStr}). ${availableCount} team member${availableCount > 1 ? 's are' : ' is'} available. Would you like me to transfer you or take a message?` };
    } else if (withinHours) {
      return { result: `We're within business hours (${hoursStr}), but the team is currently busy. I can take your details and have someone call you back.` };
    } else {
      return { result: `We're currently outside business hours (${hoursStr}). I'll take your details and someone will get back to you during business hours.` };
    }
  } catch (error: any) {
    console.error('[Vapi] Check availability failed:', error);
    return { result: 'I\'m not able to check availability right now. I\'ll make sure someone gets back to you.' };
  }
}

async function handleLookupClient(args: any, userId: string): Promise<any> {
  try {
    const clients = await storage.getClients(userId);
    let match = null;

    if (args.phone) {
      const normalizedPhone = args.phone.replace(/\D/g, '');
      match = clients.find(c => {
        const clientPhone = (c.phone || '').replace(/\D/g, '');
        return clientPhone && (clientPhone === normalizedPhone || clientPhone.endsWith(normalizedPhone) || normalizedPhone.endsWith(clientPhone));
      });
    }

    if (!match && args.name) {
      const searchName = args.name.toLowerCase();
      match = clients.find(c => {
        const fullName = `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase().trim();
        return fullName.includes(searchName) || searchName.includes(fullName);
      });
    }

    if (match) {
      return {
        result: `I found the client: ${match.firstName || ''} ${match.lastName || ''}. They're already in our system. I'll note this as a returning client.`,
        clientFound: true,
        clientName: `${match.firstName || ''} ${match.lastName || ''}`.trim(),
      };
    }

    return {
      result: 'I wasn\'t able to find that in our records. No worries — I\'ll take your details as a new enquiry.',
      clientFound: false,
    };
  } catch (error: any) {
    console.error('[Vapi] Client lookup failed:', error);
    return { result: 'I\'ll take your details and the team can check our records.', clientFound: false };
  }
}

async function handleCreateBooking(args: any, userId: string, callId: string): Promise<any> {
  try {
    const lead = await storage.createLead({
      userId,
      name: args.caller_name || 'Unknown Caller',
      phone: args.caller_phone || null,
      email: null,
      source: 'phone',
      status: 'new',
      description: `Booking request: ${args.job_type || 'Not specified'}${args.preferred_date ? ` for ${args.preferred_date}` : ''}${args.preferred_time ? ` (${args.preferred_time})` : ''}`,
      estimatedValue: null,
      notes: [
        args.job_type ? `Work type: ${args.job_type}` : null,
        args.address ? `Location: ${args.address}` : null,
        args.preferred_date ? `Preferred date: ${args.preferred_date}` : null,
        args.preferred_time ? `Preferred time: ${args.preferred_time}` : null,
        args.notes || null,
        `Source: AI Receptionist booking (${callId})`,
      ].filter(Boolean).join('\n'),
      followUpDate: args.preferred_date || null,
      wonLostReason: null,
    });

    await storage.updateAiReceptionistCall(callId, userId, {
      leadId: lead.id,
      callerName: args.caller_name || null,
      callerIntent: 'booking_request',
    });

    console.log(`[Vapi] Booking lead created: ${lead.id} for call ${callId}`);
    return {
      result: `I've created a tentative booking for ${args.job_type || 'the requested work'}${args.preferred_date ? ` on ${args.preferred_date}` : ''}. Reference: ${lead.id.slice(0, 8)}. Someone from the team will confirm the details with you.`,
    };
  } catch (error: any) {
    console.error('[Vapi] Create booking failed:', error);
    return { result: 'I\'ve noted your booking request. Someone from the team will call you to confirm.' };
  }
}

export async function processWebhookEvent(event: any): Promise<any> {
  const eventType = event.message?.type || event.type;
  console.log(`[Vapi Webhook] Event type: ${eventType}`);

  switch (eventType) {
    case 'status-update':
      return handleStatusUpdate(event);
    case 'end-of-call-report':
      return handleEndOfCallReport(event);
    case 'tool-calls':
      return handleToolCalls(event);
    case 'hang':
      return handleHang(event);
    default:
      console.log(`[Vapi Webhook] Unhandled event type: ${eventType}`);
      return { ok: true };
  }
}

async function handleStatusUpdate(event: any): Promise<any> {
  const call = event.message?.call || event.call;
  if (!call) return { ok: true };

  const assistantId = call.assistantId;
  if (!assistantId) return { ok: true };

  const business = await findBusinessByVapiAssistant(assistantId);
  if (!business) {
    console.warn(`[Vapi Webhook] No business found for assistant ${assistantId}`);
    return { ok: true };
  }

  const status = event.message?.status || event.status;
  const callId = call.id;

  const existingCall = await storage.getAiReceptionistCallByVapiId(callId);

  if (!existingCall) {
    await storage.createAiReceptionistCall({
      userId: business.userId,
      vapiCallId: callId,
      callerPhone: call.customer?.number || null,
      status: status === 'in-progress' ? 'in_progress' : status || 'ringing',
    });
  } else {
    const mappedStatus = status === 'in-progress' ? 'in_progress' : status;
    await storage.updateAiReceptionistCall(existingCall.id, business.userId, {
      status: mappedStatus || existingCall.status,
    });
  }

  return { ok: true };
}

async function handleEndOfCallReport(event: any): Promise<any> {
  const message = event.message || event;
  const call = message.call;
  if (!call) return { ok: true };

  const assistantId = call.assistantId;
  if (!assistantId) return { ok: true };

  const business = await findBusinessByVapiAssistant(assistantId);
  if (!business) return { ok: true };

  const callId = call.id;
  const existingCall = await storage.getAiReceptionistCallByVapiId(callId);

  const updates: Partial<InsertAiReceptionistCall> = {
    status: 'completed',
    duration: message.durationSeconds || call.duration || null,
    summary: message.summary || null,
    transcript: message.transcript || null,
    recordingUrl: message.recordingUrl || call.recordingUrl || null,
    endedReason: message.endedReason || call.endedReason || null,
    cost: message.cost ? String(message.cost) : null,
  };

  let callRecord: any;
  if (existingCall) {
    await storage.updateAiReceptionistCall(existingCall.id, business.userId, updates);
    callRecord = existingCall;
  } else {
    const createPayload: InsertAiReceptionistCall = {
      userId: business.userId,
      vapiCallId: callId,
      callerPhone: call.customer?.number || null,
      status: updates.status || 'completed',
      duration: updates.duration || null,
      summary: updates.summary || null,
      transcript: updates.transcript || null,
      recordingUrl: updates.recordingUrl || null,
      endedReason: updates.endedReason || null,
      cost: updates.cost || null,
    };
    callRecord = await storage.createAiReceptionistCall(createPayload);
  }

  const hasLead = callRecord?.leadId || existingCall?.leadId;
  if (!hasLead && call.customer?.number) {
    try {
      const callerPhone = call.customer.number;
      const lead = await storage.createLead({
        userId: business.userId,
        name: existingCall?.callerName || 'Caller',
        phone: callerPhone,
        email: null,
        source: 'phone',
        status: 'new',
        description: message.summary || 'AI Receptionist call — no lead was explicitly captured during the call',
        estimatedValue: null,
        notes: `Auto-created from AI Receptionist call ${callId}\nDuration: ${updates.duration || 0}s`,
        followUpDate: null,
        wonLostReason: null,
      });

      const recordId = existingCall?.id || callRecord?.id;
      if (recordId) {
        await storage.updateAiReceptionistCall(recordId, business.userId, { leadId: lead.id });
      }
      console.log(`[Vapi] Auto-created lead ${lead.id} for call ${callId}`);
    } catch (e: any) {
      console.error(`[Vapi] Failed to auto-create lead for call ${callId}:`, e.message);
    }
  }

  await sendCallNotifications(business, callId, call.customer?.number, message.summary, updates.duration as number | null);

  console.log(`[Vapi Webhook] Call ${callId} completed - duration: ${updates.duration}s`);
  return { ok: true };
}

async function sendCallNotifications(
  business: BusinessSettings,
  callId: string,
  callerPhone: string | null,
  summary: string | null,
  duration: number | null,
): Promise<void> {
  try {
    const userId = business.userId;
    const businessName = business.businessName || 'Your business';
    const callerDisplay = callerPhone || 'Unknown number';
    const summaryText = summary || 'No summary available';
    const durationText = duration ? `${Math.ceil(duration / 60)} min` : 'Unknown';

    const smsBody = `AI Receptionist: New call from ${callerDisplay} (${durationText}). ${summaryText.slice(0, 120)}`;

    const transferNumbers = (business.aiReceptionistTransferNumbers || []) as TransferNumber[];
    for (const contact of transferNumbers) {
      if (contact.phone) {
        try {
          await storage.createSmsMessage({
            businessOwnerId: userId,
            to: contact.phone,
            from: business.dedicatedPhoneNumber || '',
            body: smsBody,
            direction: 'outbound',
            status: 'queued',
          });
          console.log(`[Vapi] Notification queued for ${contact.name} (${contact.phone})`);
        } catch (e: any) {
          console.error(`[Vapi] SMS notification failed for ${contact.phone}:`, e.message);
        }
      }
    }

    try {
      const user = await storage.getUser(userId);
      if (user?.phone && !transferNumbers.some(t => t.phone === user.phone)) {
        await storage.createSmsMessage({
          businessOwnerId: userId,
          to: user.phone,
          from: business.dedicatedPhoneNumber || '',
          body: smsBody,
          direction: 'outbound',
          status: 'queued',
        });
        console.log(`[Vapi] Owner notification queued for ${userId}`);
      }
    } catch (e: any) {
      console.error(`[Vapi] Owner SMS notification failed:`, e.message);
    }

    try {
      const notificationPayload: InsertNotification = {
        userId,
        type: 'ai_receptionist_call',
        title: `New AI Receptionist Call`,
        message: `Call from ${callerDisplay} (${durationText}). ${summaryText.slice(0, 200)}`,
        data: { callId, callerPhone, duration, source: 'ai_receptionist' },
      };
      await storage.createNotification(notificationPayload);
      console.log(`[Vapi] Push notification created for user ${userId}`);
    } catch (e: any) {
      console.error(`[Vapi] Push notification failed:`, e.message);
    }
  } catch (e: any) {
    console.error(`[Vapi] sendCallNotifications error:`, e.message);
  }
}

async function handleToolCalls(event: any): Promise<any> {
  const message = event.message || event;
  const call = message.call;
  if (!call) return { ok: true };

  const assistantId = call.assistantId;
  if (!assistantId) return { ok: true };

  const business = await findBusinessByVapiAssistant(assistantId);
  if (!business) return { ok: true };

  let existingCall = await storage.getAiReceptionistCallByVapiId(call.id);
  if (!existingCall) {
    existingCall = await storage.createAiReceptionistCall({
      userId: business.userId,
      vapiCallId: call.id,
      callerPhone: call.customer?.number || null,
      status: 'in_progress',
    });
  }

  const toolCalls = message.toolCallList || message.toolCalls || [];
  const results: any[] = [];

  for (const toolCall of toolCalls) {
    const toolName = toolCall.function?.name || toolCall.name;
    const toolArgs = toolCall.function?.arguments
      ? (typeof toolCall.function.arguments === 'string' ? JSON.parse(toolCall.function.arguments) : toolCall.function.arguments)
      : toolCall.arguments || {};

    const result = await handleToolCall(toolName, toolArgs, business.userId, existingCall.id);

    results.push({
      toolCallId: toolCall.id,
      result: typeof result === 'string' ? result : JSON.stringify(result),
    });
  }

  return { results };
}

async function handleHang(event: any): Promise<any> {
  const call = event.message?.call || event.call;
  if (!call) return { ok: true };

  const assistantId = call.assistantId;
  if (!assistantId) return { ok: true };

  const business = await findBusinessByVapiAssistant(assistantId);
  if (!business) return { ok: true };

  const existingCall = await storage.getAiReceptionistCallByVapiId(call.id);
  if (existingCall) {
    await storage.updateAiReceptionistCall(existingCall.id, business.userId, {
      status: existingCall.duration ? 'completed' : 'missed',
      endedReason: 'caller_hangup',
    });
  }

  return { ok: true };
}
