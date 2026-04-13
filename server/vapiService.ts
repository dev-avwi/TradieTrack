import { storage } from './storage';
import type { BusinessSettings, InsertAiReceptionistCall, InsertAiReceptionistConfig, InsertNotification, AiReceptionistConfig } from '@shared/schema';
import crypto from 'crypto';
import { sendSMS } from './twilioClient';
import { analyzeCallSentiment } from './ai';

interface TransferNumber {
  name: string;
  phone: string;
  priority: number;
}

interface DaySchedule {
  day: number;
  enabled: boolean;
  start: string;
  end: string;
  breakStart?: string;
  breakEnd?: string;
}

interface Holiday {
  date: string;
  label: string;
}

interface BusinessHoursConfig {
  start: string;
  end: string;
  timezone: string;
  days: number[];
  schedule?: DaySchedule[];
  holidays?: Holiday[];
}

export const AUSTRALIAN_PUBLIC_HOLIDAYS: Holiday[] = [
  { date: '2026-01-01', label: "New Year's Day" },
  { date: '2026-01-26', label: 'Australia Day' },
  { date: '2026-04-03', label: 'Good Friday' },
  { date: '2026-04-04', label: 'Saturday before Easter Sunday' },
  { date: '2026-04-06', label: 'Easter Monday' },
  { date: '2026-04-25', label: 'ANZAC Day' },
  { date: '2026-06-08', label: "Queen's Birthday" },
  { date: '2026-12-25', label: 'Christmas Day' },
  { date: '2026-12-26', label: 'Boxing Day' },
  { date: '2027-01-01', label: "New Year's Day" },
  { date: '2027-01-26', label: 'Australia Day' },
  { date: '2027-03-26', label: 'Good Friday' },
  { date: '2027-03-27', label: 'Saturday before Easter Sunday' },
  { date: '2027-03-29', label: 'Easter Monday' },
  { date: '2027-04-25', label: 'ANZAC Day' },
  { date: '2027-06-14', label: "Queen's Birthday" },
  { date: '2027-12-25', label: 'Christmas Day' },
  { date: '2027-12-26', label: 'Boxing Day' },
];

const VAPI_API_BASE = 'https://api.vapi.ai';
const VAPI_API_KEY = process.env.VAPI_PRIVATE_KEY || '';

export function verifyVapiWebhook(rawBody: Buffer, signature: string | undefined): boolean {
  if (!VAPI_API_KEY) {
    console.error('[Vapi] VAPI_PRIVATE_KEY not configured — rejecting webhook (fail-closed)');
    return false;
  }

  const webhookSecret = process.env.VAPI_WEBHOOK_SECRET;

  if (webhookSecret && signature) {
    try {
      const hmac = crypto.createHmac('sha256', webhookSecret);
      hmac.update(rawBody);
      const expected = hmac.digest('hex');
      return crypto.timingSafeEqual(Buffer.from(signature, 'utf8'), Buffer.from(expected, 'utf8'));
    } catch {
      return false;
    }
  }

  if (webhookSecret && !signature) {
    console.error('[Vapi] Webhook secret configured but no signature received — rejecting');
    return false;
  }

  try {
    const parsed = JSON.parse(rawBody.toString('utf8'));
    const assistantId = parsed?.message?.call?.assistantId || parsed?.call?.assistantId;
    if (assistantId) {
      return true;
    }
    const eventType = parsed?.message?.type || parsed?.type;
    if (['status-update', 'end-of-call-report', 'tool-calls', 'hang'].includes(eventType)) {
      return true;
    }
    console.warn('[Vapi] Webhook event missing identifiable data — rejecting');
    return false;
  } catch {
    return false;
  }
}

interface KnowledgeBankContent {
  faqs?: Array<{ question: string; answer: string }>;
  serviceDescriptions?: string;
  pricingInfo?: string;
  specialInstructions?: string;
}

interface VoiceTuning {
  stability?: number;
  clarity?: number;
  speed?: number;
  styleExaggeration?: number;
  speakerBoost?: boolean;
}

interface VapiAssistantConfig {
  businessName: string;
  businessPhone?: string;
  tradeType?: string;
  greeting?: string;
  voice?: string;
  voiceTuning?: VoiceTuning;
  transferNumbers?: Array<{ name: string; phone: string; priority: number }>;
  businessHours?: BusinessHoursConfig;
  webhookUrl: string;
  services?: string[];
  teamInfo?: Array<{ name: string; role: string }>;
  knownClientCount?: number;
  knowledgeBank?: KnowledgeBankContent;
  silenceTimeoutSeconds?: number;
  maxCallDurationSeconds?: number;
  endCallMessage?: string;
  backgroundSound?: string;
  voicemailDetectionEnabled?: boolean;
  voicemailMessage?: string;
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

  const servicesSection = config.services && config.services.length > 0
    ? `\nServices offered: ${config.services.join(', ')}`
    : '';

  const teamSection = config.teamInfo && config.teamInfo.length > 0
    ? `\nTeam members: ${config.teamInfo.map(t => `${t.name} (${t.role})`).join(', ')}`
    : '';

  const clientContextSection = config.knownClientCount
    ? `\nThe business has ${config.knownClientCount} existing clients in their system. Use "lookup_client" when a returning caller identifies themselves.`
    : '';

  let knowledgeBankSection = '';
  if (config.knowledgeBank) {
    const kb = config.knowledgeBank;
    const parts: string[] = [];
    if (kb.serviceDescriptions) {
      parts.push(`Service descriptions: ${kb.serviceDescriptions}`);
    }
    if (kb.pricingInfo) {
      parts.push(`Pricing information: ${kb.pricingInfo}`);
    }
    if (kb.specialInstructions) {
      parts.push(`Special instructions: ${kb.specialInstructions}`);
    }
    if (kb.faqs && kb.faqs.length > 0) {
      const faqText = kb.faqs
        .filter(f => f.question && f.answer)
        .map(f => `Q: ${f.question}\nA: ${f.answer}`)
        .join('\n\n');
      if (faqText) {
        parts.push(`Frequently Asked Questions:\n${faqText}`);
      }
    }
    if (parts.length > 0) {
      knowledgeBankSection = `\n\nBusiness Knowledge Base:\n${parts.join('\n\n')}`;
    }
  }

  let availabilityContext = '';
  if (config.businessHours) {
    const bh = config.businessHours;
    const tz = bh.timezone || 'Australia/Sydney';
    const hasHolidays = bh.holidays && bh.holidays.length > 0;
    const hasBreaks = bh.schedule?.some(s => s.enabled && s.breakStart);
    availabilityContext = `\nIMPORTANT: At the very start of every call, you MUST silently call "check_availability" to determine the current real-time availability status (open, closed, on break, or holiday). Use the result to guide how you handle the call — if the business is closed, on break, or it's a holiday, let the caller know and offer to take a message. Do NOT guess the current availability from the schedule below — always check in real-time.`;
    if (hasHolidays) {
      availabilityContext += `\nThe business has configured holidays/days off. If "check_availability" reports a holiday, mention the holiday name and offer to take a message.`;
    }
    if (hasBreaks) {
      availabilityContext += `\nSome days have break windows configured. If "check_availability" reports the team is on break, let the caller know when they'll be back and offer to take a message.`;
    }
  }

  let hoursDescription = 'standard business hours';
  if (config.businessHours) {
    const bh = config.businessHours;
    if (bh.schedule && bh.schedule.length > 0) {
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const enabledDays = bh.schedule.filter(s => s.enabled);
      hoursDescription = enabledDays.map(s => `${dayNames[s.day]}: ${s.start}-${s.end}${s.breakStart ? ` (break ${s.breakStart}-${s.breakEnd})` : ''}`).join(', ');
    } else {
      hoursDescription = `${bh.start} to ${bh.end}`;
    }
  }

  return `You are a friendly, professional AI receptionist for ${businessName}, an Australian ${tradeType} business.
${servicesSection}${teamSection}${clientContextSection}${availabilityContext}

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
- If asked about business hours, refer to: ${hoursDescription}
- At the end of the call, confirm you've captured their details and let them know someone will be in touch

Available tools:
1. "capture_lead" - Save the caller's contact details and reason for calling. Use this after collecting their information.
2. "check_availability" - Check if team members are available to take a call or handle a job. Use when the caller asks about availability.
3. "lookup_client" - Look up an existing client by phone number or name. Use when a returning client calls to find their history.
4. "create_booking" - Create a tentative booking/appointment. Use when the caller wants to schedule work.
${(config.transferNumbers && config.transferNumbers.length > 0) || (config.teamInfo && config.teamInfo.length > 0) ? '5. "transfer_call" - Transfer the call to an available team member when the caller wants to speak with someone directly.' : ''}

Workflow:
1. FIRST, silently call "check_availability" to determine real-time business status (open/closed/break/holiday) — adapt your greeting accordingly
2. Greet the caller and ask how you can help (if closed/break/holiday, proactively let them know)
3. Use "lookup_client" if they mention being an existing client
4. Gather their details and reason for calling
5. Use "check_availability" again if they ask about scheduling or availability
6. Use "capture_lead" to save their details
7. If they want to book, use "create_booking"
8. If they insist on speaking with someone, use "transfer_call" (if available)${knowledgeBankSection}`;
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

  const hasTransferCapability = (config.transferNumbers && config.transferNumbers.length > 0) ||
    (config.teamInfo && config.teamInfo.length > 0);

  if (hasTransferCapability) {
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
      ...(voiceConfig.provider === '11labs' && config.voiceTuning ? {
        stability: config.voiceTuning.stability ?? 0.5,
        similarityBoost: config.voiceTuning.clarity ?? 0.75,
        speed: config.voiceTuning.speed ?? 1.0,
        style: config.voiceTuning.styleExaggeration ?? 0,
        useSpeakerBoost: config.voiceTuning.speakerBoost ?? false,
      } : {}),
    },
    firstMessage: config.greeting || `G'day, thanks for calling ${config.businessName}. How can I help you today?`,
    endCallMessage: config.endCallMessage || 'Thanks for calling! Someone from the team will be in touch soon. Have a great day!',
    serverUrl: config.webhookUrl,
    silenceTimeoutSeconds: config.silenceTimeoutSeconds ?? 30,
    maxDurationSeconds: config.maxCallDurationSeconds ?? 600,
    backgroundSound: config.backgroundSound || 'off',
    recordingEnabled: true,
    ...(config.voicemailDetectionEnabled !== undefined ? {
      voicemailDetection: {
        enabled: config.voicemailDetectionEnabled,
        ...(config.voicemailMessage ? { provider: '11labs', voicemailMessage: config.voicemailMessage } : {}),
      },
    } : {}),
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
      ...(voiceConfig.provider === '11labs' && config.voiceTuning ? {
        stability: config.voiceTuning.stability ?? 0.5,
        similarityBoost: config.voiceTuning.clarity ?? 0.75,
        speed: config.voiceTuning.speed ?? 1.0,
        style: config.voiceTuning.styleExaggeration ?? 0,
        useSpeakerBoost: config.voiceTuning.speakerBoost ?? false,
      } : {}),
    };
  }

  if (config.silenceTimeoutSeconds !== undefined) {
    updates.silenceTimeoutSeconds = config.silenceTimeoutSeconds;
  }
  if (config.maxCallDurationSeconds !== undefined) {
    updates.maxDurationSeconds = config.maxCallDurationSeconds;
  }
  if (config.endCallMessage) {
    updates.endCallMessage = config.endCallMessage;
  }
  if (config.backgroundSound) {
    updates.backgroundSound = config.backgroundSound;
  }
  if (config.voicemailDetectionEnabled !== undefined) {
    updates.voicemailDetection = {
      enabled: config.voicemailDetectionEnabled,
      ...(config.voicemailMessage ? { provider: '11labs', voicemailMessage: config.voicemailMessage } : {}),
    };
  }

  if (config.greeting) {
    updates.firstMessage = config.greeting;
  }

  if (config.businessName || config.greeting || config.transferNumbers || config.businessHours || config.tradeType || config.services || config.teamInfo || config.knownClientCount || config.knowledgeBank) {
    const fullConfig: VapiAssistantConfig = {
      businessName: config.businessName || '',
      tradeType: config.tradeType,
      greeting: config.greeting,
      voice: config.voice,
      transferNumbers: config.transferNumbers,
      businessHours: config.businessHours,
      webhookUrl: config.webhookUrl || '',
      services: config.services,
      teamInfo: config.teamInfo,
      knownClientCount: config.knownClientCount,
      knowledgeBank: config.knowledgeBank,
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

export async function createOutboundCall(assistantId: string, phoneNumber: string): Promise<VapiResponse> {
  console.log(`[Vapi] Creating outbound test call to ${phoneNumber} with assistant ${assistantId}`);
  return vapiRequest('POST', '/call/phone', {
    assistantId,
    customer: {
      number: phoneNumber,
    },
  });
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

export async function removePhoneNumber(phoneNumberId: string): Promise<void> {
  console.log(`[Vapi] Releasing phone number ${phoneNumberId}`);
  await vapiRequest('DELETE', `/phone-number/${phoneNumberId}`);
}

export async function getCallDetails(callId: string): Promise<Record<string, unknown>> {
  return vapiRequest('GET', `/call/${callId}`) as Promise<Record<string, unknown>>;
}

export async function getCallLogs(assistantId: string, limit: number = 50): Promise<Array<Record<string, unknown>>> {
  const result = await vapiRequest('GET', `/call?assistantId=${assistantId}&limit=${limit}`);
  return Array.isArray(result) ? result : [];
}

export function getWebhookUrl(): string {
  const domain = process.env.CUSTOM_DOMAIN || process.env.REPLIT_DOMAINS?.split(',')[0] || process.env.REPL_SLUG + '.repl.co';
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

    if (!settings.businessName) {
      return { success: false, error: 'Business name is required to set up the AI Receptionist.' };
    }

    if (!settings.dedicatedPhoneNumber) {
      return { success: false, error: 'A dedicated phone number is required. Please purchase one from the Phone Numbers screen first.' };
    }

    const { isSharedPlatformNumber } = await import('./phoneNumberUtils');
    if (isSharedPlatformNumber(settings.dedicatedPhoneNumber)) {
      return { success: false, error: 'AI Receptionist requires a dedicated number. The shared platform number cannot be used.' };
    }

    let config = await storage.getAiReceptionistConfig(userId);
    if (config?.vapiAssistantId) {
      if (!config.enabled) {
        await storage.updateAiReceptionistConfig(userId, {
          enabled: true,
          mode: config.mode === 'off' ? 'always_on_message' : config.mode,
        });
        console.log(`[Vapi] AI Receptionist re-enabled for user ${userId} (existing assistant: ${config.vapiAssistantId})`);
        return {
          success: true,
          assistantId: config.vapiAssistantId,
          phoneNumber: config.dedicatedPhoneNumber || settings.dedicatedPhoneNumber || undefined,
        };
      }
      return { success: true, assistantId: config.vapiAssistantId };
    }

    const webhookUrl = getWebhookUrl();
    const transferNumbers = (config?.transferNumbers || []) as TransferNumber[];
    const businessHours = (config?.businessHours || null) as BusinessHoursConfig | null;

    const teamMembers = await storage.getTeamMembers(userId);
    const teamInfo = teamMembers
      .filter(m => m.isActive)
      .map(m => ({ name: `${m.firstName || ''} ${m.lastName || ''}`.trim() || m.email, role: m.role || 'team member' }));

    const clients = await storage.getClients(userId);
    const knownClientCount = clients.length;

    let services: string[] = [];
    try {
      const catalogItems = await storage.getLineItemCatalog(userId);
      services = catalogItems.map(item => item.name).filter(Boolean).slice(0, 20);
    } catch (catalogErr) {
      console.warn('[Vapi] Failed to fetch catalog items for assistant, continuing without:', catalogErr);
    }

    const knowledgeBank = (config?.knowledgeBank || null) as KnowledgeBankContent | null;

    const assistant = await createAssistant({
      businessName: settings.businessName,
      businessPhone: settings.phone || undefined,
      tradeType: settings.industry || undefined,
      greeting: config?.greeting || undefined,
      voice: config?.voiceName || 'Jess',
      transferNumbers,
      businessHours: businessHours || undefined,
      webhookUrl,
      services,
      teamInfo,
      knownClientCount,
      knowledgeBank: knowledgeBank || undefined,
    });

    if (config) {
      await storage.updateAiReceptionistConfig(userId, {
        vapiAssistantId: assistant.id,
        enabled: true,
        mode: config.mode === 'off' ? 'always_on_message' : config.mode,
        dedicatedPhoneNumber: settings.dedicatedPhoneNumber,
      });
    } else {
      config = await storage.createAiReceptionistConfig({
        userId,
        vapiAssistantId: assistant.id,
        enabled: true,
        mode: 'always_on_message',
        voiceName: 'Jess',
        dedicatedPhoneNumber: settings.dedicatedPhoneNumber,
      });
    }

    console.log(`[Vapi] AI Receptionist enabled for user ${userId} - assistant: ${assistant.id}`);

    return {
      success: true,
      assistantId: assistant.id,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Vapi] Failed to enable AI Receptionist for user ${userId}:`, message);
    try {
      const { logSystemEvent } = await import('./systemEventService');
      logSystemEvent('vapi', 'error', 'ai_receptionist_enable_failed', `Failed to enable AI Receptionist for user ${userId}: ${message}`, { userId });
    } catch {}
    return { success: false, error: message };
  }
}

export async function disableAiReceptionist(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const config = await storage.getAiReceptionistConfig(userId);
    if (!config) {
      return { success: false, error: 'AI Receptionist config not found' };
    }

    await storage.updateAiReceptionistConfig(userId, {
      enabled: false,
    });

    console.log(`[Vapi] AI Receptionist disabled for user ${userId} (assistant preserved: ${config.vapiAssistantId})`);
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Vapi] Failed to disable AI Receptionist for user ${userId}:`, message);
    return { success: false, error: message };
  }
}

export async function destroyAiReceptionist(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const config = await storage.getAiReceptionistConfig(userId);
    if (!config) {
      return { success: false, error: 'AI Receptionist config not found' };
    }

    if (config.vapiAssistantId) {
      try {
        await deleteAssistant(config.vapiAssistantId);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        console.warn(`[Vapi] Failed to delete assistant ${config.vapiAssistantId}:`, msg);
      }
    }

    if (config.vapiPhoneNumberId) {
      try {
        await removePhoneNumber(config.vapiPhoneNumberId);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        console.warn(`[Vapi] Failed to release phone number ${config.vapiPhoneNumberId}:`, msg);
      }
    }

    await storage.updateAiReceptionistConfig(userId, {
      vapiAssistantId: null,
      vapiPhoneNumberId: null,
      enabled: false,
      mode: 'off',
      approvalStatus: 'none',
      dedicatedPhoneNumber: null,
    });

    console.log(`[Vapi] AI Receptionist fully destroyed for user ${userId}`);
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Vapi] Failed to destroy AI Receptionist for user ${userId}:`, message);
    return { success: false, error: message };
  }
}

export async function updateReceptionistConfig(userId: string, updates: {
  voice?: string;
  greeting?: string;
  mode?: string;
  transferNumbers?: Array<{ name: string; phone: string; priority: number }>;
  businessHours?: BusinessHoursConfig;
  knowledgeBank?: KnowledgeBankContent;
  smsNotifications?: boolean;
  voiceStability?: number;
  voiceClarity?: number;
  voiceSpeed?: number;
  voiceStyleExaggeration?: number;
  voiceSpeakerBoost?: boolean;
  voicemailDetectionEnabled?: boolean;
  voicemailMessage?: string;
  silenceTimeoutSeconds?: number;
  maxCallDurationSeconds?: number;
  endCallMessage?: string;
  backgroundSound?: string;
  autoReplyEnabled?: boolean;
  autoReplyMessage?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const config = await storage.getAiReceptionistConfig(userId);
    if (!config) {
      return { success: false, error: 'AI Receptionist config not found. Create it first.' };
    }

    const configUpdates: Partial<InsertAiReceptionistConfig> = {};
    if (updates.voice) configUpdates.voiceName = updates.voice;
    if (updates.greeting) configUpdates.greeting = updates.greeting;
    if (updates.mode) configUpdates.mode = updates.mode;
    if (updates.transferNumbers) configUpdates.transferNumbers = updates.transferNumbers;
    if (updates.businessHours) configUpdates.businessHours = updates.businessHours;
    if (updates.knowledgeBank !== undefined) configUpdates.knowledgeBank = updates.knowledgeBank;
    if (updates.smsNotifications !== undefined) configUpdates.smsNotifications = updates.smsNotifications;
    if (updates.voiceStability !== undefined) configUpdates.voiceStability = updates.voiceStability;
    if (updates.voiceClarity !== undefined) configUpdates.voiceClarity = updates.voiceClarity;
    if (updates.voiceSpeed !== undefined) configUpdates.voiceSpeed = updates.voiceSpeed;
    if (updates.voiceStyleExaggeration !== undefined) configUpdates.voiceStyleExaggeration = updates.voiceStyleExaggeration;
    if (updates.voiceSpeakerBoost !== undefined) configUpdates.voiceSpeakerBoost = updates.voiceSpeakerBoost;
    if (updates.voicemailDetectionEnabled !== undefined) configUpdates.voicemailDetectionEnabled = updates.voicemailDetectionEnabled;
    if (updates.voicemailMessage !== undefined) configUpdates.voicemailMessage = updates.voicemailMessage;
    if (updates.silenceTimeoutSeconds !== undefined) configUpdates.silenceTimeoutSeconds = updates.silenceTimeoutSeconds;
    if (updates.maxCallDurationSeconds !== undefined) configUpdates.maxCallDurationSeconds = updates.maxCallDurationSeconds;
    if (updates.endCallMessage !== undefined) configUpdates.endCallMessage = updates.endCallMessage;
    if (updates.backgroundSound !== undefined) configUpdates.backgroundSound = updates.backgroundSound;
    if (updates.autoReplyEnabled !== undefined) configUpdates.autoReplyEnabled = updates.autoReplyEnabled;
    if (updates.autoReplyMessage !== undefined) configUpdates.autoReplyMessage = updates.autoReplyMessage;

    await storage.updateAiReceptionistConfig(userId, configUpdates);

    const needsVapiSync = updates.voice || updates.greeting || updates.transferNumbers || updates.businessHours || updates.knowledgeBank ||
      updates.voiceStability !== undefined || updates.voiceClarity !== undefined || updates.voiceSpeed !== undefined ||
      updates.voiceStyleExaggeration !== undefined || updates.voiceSpeakerBoost !== undefined ||
      updates.voicemailDetectionEnabled !== undefined || updates.voicemailMessage !== undefined ||
      updates.silenceTimeoutSeconds !== undefined || updates.maxCallDurationSeconds !== undefined ||
      updates.endCallMessage !== undefined || updates.backgroundSound !== undefined;

    if (config.vapiAssistantId && needsVapiSync) {
      try {
        const settings = await storage.getBusinessSettings(userId);
        const webhookUrl = getWebhookUrl();

        const teamMembers = await storage.getTeamMembers(userId);
        const teamInfo = teamMembers
          .filter(m => m.isActive)
          .map(m => ({ name: `${m.firstName || ''} ${m.lastName || ''}`.trim() || m.email, role: m.role || 'team member' }));

        const clients = await storage.getClients(userId);
        const knownClientCount = clients.length;

        let services: string[] = [];
        try {
          const catalogItems = await storage.getLineItemCatalog(userId);
          services = catalogItems.map(item => item.name).filter(Boolean).slice(0, 20);
        } catch (catalogErr) {
          console.warn('[Vapi] Failed to fetch catalog items for update, continuing without:', catalogErr);
        }

        const resolvedKB = updates.knowledgeBank || (config.knowledgeBank as KnowledgeBankContent | null) || undefined;

        const voiceTuning: VoiceTuning = {
          stability: updates.voiceStability ?? config.voiceStability ?? 0.5,
          clarity: updates.voiceClarity ?? config.voiceClarity ?? 0.75,
          speed: updates.voiceSpeed ?? config.voiceSpeed ?? 1.0,
          styleExaggeration: updates.voiceStyleExaggeration ?? config.voiceStyleExaggeration ?? 0,
          speakerBoost: updates.voiceSpeakerBoost ?? config.voiceSpeakerBoost ?? false,
        };

        await updateAssistant(config.vapiAssistantId, {
          businessName: settings?.businessName || '',
          tradeType: settings?.industry || undefined,
          voice: updates.voice || config.voiceName || 'Jess',
          voiceTuning,
          greeting: updates.greeting || config.greeting || undefined,
          transferNumbers: updates.transferNumbers || (config.transferNumbers as TransferNumber[]) || [],
          businessHours: updates.businessHours || (config.businessHours as BusinessHoursConfig | null) || undefined,
          webhookUrl,
          services,
          teamInfo,
          knownClientCount,
          knowledgeBank: resolvedKB,
          silenceTimeoutSeconds: updates.silenceTimeoutSeconds ?? config.silenceTimeoutSeconds ?? 30,
          maxCallDurationSeconds: updates.maxCallDurationSeconds ?? config.maxCallDurationSeconds ?? 600,
          endCallMessage: updates.endCallMessage ?? config.endCallMessage ?? undefined,
          backgroundSound: updates.backgroundSound ?? config.backgroundSound ?? 'off',
          voicemailDetectionEnabled: updates.voicemailDetectionEnabled ?? config.voicemailDetectionEnabled ?? true,
          voicemailMessage: updates.voicemailMessage ?? config.voicemailMessage ?? undefined,
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        console.error(`[Vapi] Failed to sync assistant update:`, msg);
      }
    }

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Vapi] Failed to update config for user ${userId}:`, message);
    return { success: false, error: message };
  }
}

export async function updateReceptionistConfigById(configId: string, userId: string, updates: {
  voice?: string;
  greeting?: string;
  mode?: string;
  transferNumbers?: Array<{ name: string; phone: string; priority: number }>;
  businessHours?: BusinessHoursConfig;
  knowledgeBank?: KnowledgeBankContent;
  smsNotifications?: boolean;
  voiceStability?: number;
  voiceClarity?: number;
  voiceSpeed?: number;
  voiceStyleExaggeration?: number;
  voiceSpeakerBoost?: boolean;
  voicemailDetectionEnabled?: boolean;
  voicemailMessage?: string;
  silenceTimeoutSeconds?: number;
  maxCallDurationSeconds?: number;
  endCallMessage?: string;
  backgroundSound?: string;
  autoReplyEnabled?: boolean;
  autoReplyMessage?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const config = await storage.getAiReceptionistConfigById(configId);
    if (!config || config.userId !== userId) {
      return { success: false, error: 'AI Receptionist config not found.' };
    }

    if (!config.vapiAssistantId) {
      return { success: true };
    }

    const needsVapiSync = updates.voice || updates.greeting || updates.transferNumbers || updates.businessHours || updates.knowledgeBank ||
      updates.voiceStability !== undefined || updates.voiceClarity !== undefined || updates.voiceSpeed !== undefined ||
      updates.voiceStyleExaggeration !== undefined || updates.voiceSpeakerBoost !== undefined ||
      updates.voicemailDetectionEnabled !== undefined || updates.voicemailMessage !== undefined ||
      updates.silenceTimeoutSeconds !== undefined || updates.maxCallDurationSeconds !== undefined ||
      updates.endCallMessage !== undefined || updates.backgroundSound !== undefined;

    if (needsVapiSync) {
      const settings = await storage.getBusinessSettings(userId);
      const webhookUrl = getWebhookUrl();

      const teamMembers = await storage.getTeamMembers(userId);
      const teamInfo = teamMembers
        .filter(m => m.isActive)
        .map(m => ({ name: `${m.firstName || ''} ${m.lastName || ''}`.trim() || m.email, role: m.role || 'team member' }));

      const clients = await storage.getClients(userId);
      const knownClientCount = clients.length;

      let services: string[] = [];
      try {
        const catalogItems = await storage.getLineItemCatalog(userId);
        services = catalogItems.map(item => item.name).filter(Boolean).slice(0, 20);
      } catch (catalogErr) {
        services = [];
      }

      const systemPrompt = buildSmartSystemPrompt({
        businessName: settings?.businessName || 'the business',
        industry: settings?.industry || undefined,
        mode: updates.mode || config.mode || 'always_on_message',
        transferNumbers: updates.transferNumbers || (config.transferNumbers as any) || [],
        knowledgeBank: updates.knowledgeBank || (config.knowledgeBank as any) || undefined,
        team: teamInfo,
        knownClientCount,
        services,
      });

      const vapiUpdates: any = {
        model: {
          provider: 'openai',
          model: 'gpt-4o-mini',
          messages: [{ role: 'system', content: systemPrompt }],
        },
        serverUrl: webhookUrl,
      };

      if (updates.voice) {
        vapiUpdates.voice = {
          provider: '11labs',
          voiceId: updates.voice,
          stability: updates.voiceStability ?? config.voiceStability ?? 0.5,
          similarityBoost: updates.voiceClarity ?? config.voiceClarity ?? 0.75,
          speed: updates.voiceSpeed ?? config.voiceSpeed ?? 1.0,
        };
      }

      if (updates.greeting) {
        vapiUpdates.firstMessage = updates.greeting;
      }

      if (updates.voicemailDetectionEnabled !== undefined) {
        vapiUpdates.voicemailDetection = {
          enabled: updates.voicemailDetectionEnabled,
          provider: 'twilio',
        };
      }

      if (updates.silenceTimeoutSeconds !== undefined) {
        vapiUpdates.silenceTimeoutSeconds = updates.silenceTimeoutSeconds;
      }
      if (updates.maxCallDurationSeconds !== undefined) {
        vapiUpdates.maxDurationSeconds = updates.maxCallDurationSeconds;
      }
      if (updates.endCallMessage !== undefined) {
        vapiUpdates.endCallMessage = updates.endCallMessage;
      }
      if (updates.backgroundSound !== undefined) {
        vapiUpdates.backgroundSound = updates.backgroundSound === 'off' ? undefined : updates.backgroundSound;
      }

      await makeVapiRequest(`/assistant/${config.vapiAssistantId}`, 'PATCH', vapiUpdates);
      console.log(`[Vapi] Updated assistant ${config.vapiAssistantId} for config ${configId}`);
    }

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Vapi] Failed to update config ${configId}:`, message);
    return { success: false, error: message };
  }
}

const assistantCache = new Map<string, { userId: string; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000;

export async function findBusinessByVapiAssistant(assistantId: string): Promise<BusinessSettings | undefined> {
  const result = await findBusinessAndConfigByVapiAssistant(assistantId);
  return result?.business;
}

export async function findBusinessAndConfigByVapiAssistant(assistantId: string): Promise<{ business: BusinessSettings; config?: AiReceptionistConfig } | undefined> {
  const cached = assistantCache.get(assistantId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    const business = await storage.getBusinessSettings(cached.userId);
    if (!business) return undefined;
    const allConfigs = await storage.getAiReceptionistConfigsByUser(cached.userId);
    const config = allConfigs.find(c => c.vapiAssistantId === assistantId);
    return { business, config };
  }

  const allSettings = await storage.getAllBusinessSettings();
  const match = allSettings.find(s => s.vapiAssistantId === assistantId);
  if (match) {
    assistantCache.set(assistantId, { userId: match.userId, timestamp: Date.now() });
    const allConfigs = await storage.getAiReceptionistConfigsByUser(match.userId);
    const config = allConfigs.find(c => c.vapiAssistantId === assistantId);
    return { business: match, config };
  }

  const allConfigs = await storage.getAllAiReceptionistConfigs();
  const configMatch = allConfigs.find(c => c.vapiAssistantId === assistantId);
  if (configMatch) {
    assistantCache.set(assistantId, { userId: configMatch.userId, timestamp: Date.now() });
    const business = await storage.getBusinessSettings(configMatch.userId);
    if (!business) return undefined;
    return { business, config: configMatch };
  }

  return undefined;
}

export async function handleToolCall(
  toolName: string,
  toolArgs: Record<string, unknown>,
  userId: string,
  callId: string,
  callerPhone?: string,
): Promise<Record<string, unknown>> {
  console.log(`[Vapi] Tool call: ${toolName} for user ${userId}, call ${callId}`);

  switch (toolName) {
    case 'capture_lead':
      return handleCaptureLead(toolArgs, userId, callId);
    case 'transfer_call':
      return handleTransferCall(toolArgs as { reason: string; caller_phone?: string }, userId, callerPhone);
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
    const existingCall = await storage.getAiReceptionistCall(callId, userId);
    if (existingCall?.leadId) {
      console.log(`[Vapi] Lead already captured for call ${callId}, skipping duplicate`);
      return { result: `Details already recorded. Reference number: ${existingCall.leadId.slice(0, 8)}` };
    }

    const callerName = args.caller_name || 'Unknown Caller';
    const callerPhone = args.caller_phone || null;
    const callerEmail = args.caller_email || null;
    const jobType = args.job_type || args.intent || 'General enquiry';
    const address = args.address || null;
    const urgency = args.urgency || null;
    const notes = args.notes || '';

    if (callerPhone) {
      const recentLeads = await storage.getLeadsByUserAndPhone(userId, callerPhone);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentDuplicate = recentLeads?.find(l => l.createdAt && new Date(l.createdAt) > oneHourAgo);
      if (recentDuplicate) {
        console.log(`[Vapi] Spam protection: duplicate lead from ${callerPhone} within 1 hour, skipping`);
        await storage.updateAiReceptionistCall(callId, userId, {
          leadId: recentDuplicate.id,
          callerName: callerName,
          callerIntent: args.intent || jobType,
        });
        return { result: `Your details are already on file. Someone will be in touch shortly. Reference: ${recentDuplicate.id.slice(0, 8)}` };
      }
    }

    const lead = await storage.createLead({
      userId,
      name: callerName,
      phone: callerPhone,
      email: callerEmail,
      source: 'ai_receptionist',
      status: 'new',
      description: notes || `${jobType} - via AI Receptionist`,
      estimatedValue: null,
      notes: [
        jobType ? `Work type: ${jobType}` : null,
        address ? `Location: ${address}` : null,
        urgency ? `Urgency: ${urgency}` : null,
        `Source: AI Receptionist call (${callId})`,
      ].filter(Boolean).join('\n'),
      followUpDate: null,
      wonLostReason: null,
    });

    await storage.updateAiReceptionistCall(callId, userId, {
      leadId: lead.id,
      callerName: callerName,
      callerIntent: args.intent || jobType,
      extractedInfo: {
        name: callerName,
        email: callerEmail,
        phone: callerPhone,
        address,
        jobType,
        urgency,
        notes,
      },
    });

    try {
      await storage.createNotification({
        userId,
        type: 'new_lead',
        title: 'New Lead from AI Receptionist',
        message: `${callerName} called about "${jobType}". Review and convert in Leads.`,
        relatedId: lead.id,
        relatedType: 'lead',
        priority: 'important',
        actionUrl: `/leads`,
        actionLabel: 'View Lead',
      });
    } catch (e) {
      console.error('[Vapi] Failed to create notification:', e);
    }

    console.log(`[Vapi] Lead ${lead.id} created for call ${callId} (no auto-job)`);
    return { result: `I've got all your details. Someone will review your enquiry and get back to you shortly. Reference: ${lead.id.slice(0, 8)}` };
  } catch (error: any) {
    console.error('[Vapi] Failed to capture lead:', error);
    return { result: 'I\'ve noted down the details. Someone will follow up shortly.' };
  }
}

interface AvailabilityStatus {
  open: boolean;
  reason: 'open' | 'closed_day' | 'closed_hours' | 'on_break' | 'holiday';
  holidayLabel?: string;
  breakEnd?: string;
  todayHours?: string;
}

function getAvailabilityStatus(businessHours: any): AvailabilityStatus {
  if (!businessHours) return { open: true, reason: 'open' };
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
    const nowMinutes = hour * 60 + minute;
    const dayName = parts.find(p => p.type === 'weekday')?.value || '';
    const dayMap: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 };
    const dayNumber = dayMap[dayName] ?? new Date().getDay();

    const dateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
    const todayDate = dateFormatter.format(now);

    const holidays: Holiday[] = businessHours.holidays || [];
    const todayHoliday = holidays.find(h => h.date === todayDate);
    if (todayHoliday) {
      return { open: false, reason: 'holiday', holidayLabel: todayHoliday.label };
    }

    const schedule: DaySchedule[] = businessHours.schedule || [];
    if (schedule.length > 0) {
      const todaySchedule = schedule.find(s => s.day === dayNumber);
      if (!todaySchedule || !todaySchedule.enabled) {
        return { open: false, reason: 'closed_day' };
      }

      const [sH, sM] = todaySchedule.start.split(':').map(Number);
      const [eH, eM] = todaySchedule.end.split(':').map(Number);
      const startMins = sH * 60 + (sM || 0);
      const endMins = eH * 60 + (eM || 0);

      if (todaySchedule.breakStart && todaySchedule.breakEnd) {
        const [bsH, bsM] = todaySchedule.breakStart.split(':').map(Number);
        const [beH, beM] = todaySchedule.breakEnd.split(':').map(Number);
        const breakStartMins = bsH * 60 + (bsM || 0);
        const breakEndMins = beH * 60 + (beM || 0);
        if (nowMinutes >= breakStartMins && nowMinutes < breakEndMins) {
          return { open: false, reason: 'on_break', breakEnd: todaySchedule.breakEnd, todayHours: `${todaySchedule.start}-${todaySchedule.end}` };
        }
      }

      if (nowMinutes >= startMins && nowMinutes <= endMins) {
        return { open: true, reason: 'open', todayHours: `${todaySchedule.start}-${todaySchedule.end}` };
      }
      return { open: false, reason: 'closed_hours', todayHours: `${todaySchedule.start}-${todaySchedule.end}` };
    }

    const activeDays = businessHours.days || [1, 2, 3, 4, 5];
    if (!activeDays.includes(dayNumber)) return { open: false, reason: 'closed_day' };

    const [startH, startM] = (businessHours.start || '08:00').split(':').map(Number);
    const [endH, endM] = (businessHours.end || '17:00').split(':').map(Number);
    const startMinutes = startH * 60 + (startM || 0);
    const endMinutes = endH * 60 + (endM || 0);
    const hoursStr = `${businessHours.start || '08:00'}-${businessHours.end || '17:00'}`;
    if (nowMinutes >= startMinutes && nowMinutes <= endMinutes) {
      return { open: true, reason: 'open', todayHours: hoursStr };
    }
    return { open: false, reason: 'closed_hours', todayHours: hoursStr };
  } catch {
    return { open: true, reason: 'open' };
  }
}

function isWithinBusinessHours(businessHours: any): boolean {
  return getAvailabilityStatus(businessHours).open;
}

async function getAvailableTransferTarget(userId: string, _settings: BusinessSettings, callerPhone?: string | null): Promise<{ name: string; phone: string } | null> {
  const config = await storage.getAiReceptionistConfig(userId);
  const mode = config?.mode || 'always_on_message';
  const transferNumbers = (config?.transferNumbers || []) as TransferNumber[];
  const businessHours = (config?.businessHours || null) as BusinessHoursConfig | null;

  if (mode === 'off') return null;
  if (mode === 'always_on_message') return null;

  if (mode === 'after_hours') {
    if (!isWithinBusinessHours(businessHours)) {
      return null;
    }
    return findFirstAvailableTarget(userId, transferNumbers);
  }

  if (mode === 'always_on_transfer') {
    return findFirstAvailableTarget(userId, transferNumbers);
  }

  if (mode === 'selective') {
    const isKnownClient = await shouldTransferSelectiveByClient(userId, callerPhone);
    if (!isKnownClient) return null;
    return findFirstAvailableTarget(userId, transferNumbers);
  }

  return null;
}

async function findFirstAvailableTarget(userId: string, transferNumbers: TransferNumber[]): Promise<{ name: string; phone: string } | null> {
  try {
    const teamMembers = await storage.getTeamMembers(userId);
    const availableMembers = teamMembers.filter(m =>
      m.isActive && m.aiReceptionistAvailability && m.phone
    );

    if (availableMembers.length > 0) {
      const member = availableMembers[0];
      return { name: member.firstName || member.email, phone: member.phone! };
    }
  } catch {
    // fall through to transfer numbers
  }

  const sorted = [...transferNumbers].sort((a, b) => (a.priority || 99) - (b.priority || 99));
  for (const target of sorted) {
    if (target.phone) {
      return { name: target.name, phone: target.phone };
    }
  }

  return null;
}

async function shouldTransferSelectiveByClient(userId: string, callerPhone: string | null): Promise<boolean> {
  if (!callerPhone) return false;
  try {
    const allClients = await storage.getClients(userId);
    const normalizedPhone = callerPhone.replace(/\D/g, '');
    return allClients.some(c => {
      const clientPhone = (c.phone || '').replace(/\D/g, '');
      return clientPhone && (clientPhone === normalizedPhone || clientPhone.endsWith(normalizedPhone) || normalizedPhone.endsWith(clientPhone));
    });
  } catch {
    return false;
  }
}

async function handleTransferCall(args: { reason: string; caller_phone?: string }, userId: string, callerPhone?: string): Promise<{ result: string; forwardingPhoneNumber?: string }> {
  try {
    const settings = await storage.getBusinessSettings(userId);
    if (!settings) {
      return { result: 'No one is available to take the call right now, but don\'t worry — I\'ve got all your details and we\'ll call you back as soon as possible.' };
    }

    const target = await getAvailableTransferTarget(userId, settings, callerPhone || args.caller_phone);
    if (!target) {
      return { result: 'No one is available to take the call right now, but don\'t worry — I\'ve got all your details and we\'ll call you back as soon as possible.' };
    }

    return {
      result: `Transferring to ${target.name}...`,
      forwardingPhoneNumber: target.phone,
    };
  } catch (error: any) {
    console.error('[Vapi] Transfer failed:', error);
    return { result: 'No one is available to take the call right now, but don\'t worry — I\'ve got all your details and we\'ll call you back as soon as possible.' };
  }
}

async function handleCheckAvailability(args: any, userId: string): Promise<any> {
  try {
    const settings = await storage.getBusinessSettings(userId);
    if (!settings) {
      return { result: 'I\'m not able to check availability right now. Someone from the team will get back to you.' };
    }

    const config = await storage.getAiReceptionistConfig(userId);
    const businessHours = (config?.businessHours || null) as BusinessHoursConfig | null;
    const status = getAvailabilityStatus(businessHours);

    const teamMembers = await storage.getTeamMembers(userId);
    const availableCount = teamMembers.filter(m => m.isActive && m.aiReceptionistAvailability).length;

    if (status.reason === 'holiday') {
      return { result: `We're closed for the public holiday today (${status.holidayLabel}). I'll take your details and someone will get back to you on the next business day.` };
    }

    if (status.reason === 'on_break') {
      return { result: `The team is currently on a break and will be back at ${status.breakEnd}. I'm happy to take your details and have someone call you back shortly.` };
    }

    if (status.reason === 'closed_day') {
      return { result: `The business doesn't operate today. I'll take your details and someone will get back to you on the next business day.` };
    }

    const hoursStr = status.todayHours || 'standard business hours';

    if (status.open && availableCount > 0) {
      return { result: `The team is currently available during business hours (${hoursStr}). ${availableCount} team member${availableCount > 1 ? 's are' : ' is'} available. Would you like me to transfer you or take a message?` };
    } else if (status.open) {
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
      source: 'ai_receptionist',
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

  const result = await findBusinessAndConfigByVapiAssistant(assistantId);
  if (!result) {
    console.warn(`[Vapi Webhook] No business found for assistant ${assistantId}`);
    return { ok: true };
  }
  const { business, config: matchedConfig } = result;

  const status = event.message?.status || event.status;
  const callId = call.id;
  const calledNumber = call.phoneNumber?.number || matchedConfig?.dedicatedPhoneNumber || null;

  const existingCall = await storage.getAiReceptionistCallByVapiId(callId);

  if (!existingCall) {
    await storage.createAiReceptionistCall({
      userId: business.userId,
      vapiCallId: callId,
      callerPhone: call.customer?.number || null,
      status: status === 'in-progress' ? 'in_progress' : status || 'ringing',
      phoneNumberId: matchedConfig?.id || null,
      calledNumber,
    });
  } else {
    const mappedStatus = status === 'in-progress' ? 'in_progress' : status;
    await storage.updateAiReceptionistCall(existingCall.id, business.userId, {
      status: mappedStatus || existingCall.status,
      ...(matchedConfig?.id && !existingCall.phoneNumberId ? { phoneNumberId: matchedConfig.id } : {}),
      ...(calledNumber && !existingCall.calledNumber ? { calledNumber } : {}),
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

  const lookupResult = await findBusinessAndConfigByVapiAssistant(assistantId);
  if (!lookupResult) {
    console.log(`[Vapi Webhook] No business found for assistant ${assistantId} — treating as support line call`);
    await sendSupportLineNotifications(
      call.customer?.number || null,
      message.summary || null,
      message.durationSeconds || call.duration || null,
    );
    return { ok: true };
  }
  const business = lookupResult.business;
  const matchedConfig = lookupResult.config;

  const callId = call.id;
  const existingCall = await storage.getAiReceptionistCallByVapiId(callId);

  const endedReason = message.endedReason || call.endedReason || null;
  const callOutcome = existingCall?.transferredTo ? 'transferred'
    : existingCall?.leadId ? 'booked'
    : endedReason === 'missed' || endedReason === 'no-answer' ? 'missed'
    : 'message_taken';

  const transcriptText = message.transcript || null;
  const summaryText = message.summary || null;

  let sentimentResult = { sentiment: 'neutral' as string, sentimentScore: 0.5 };
  try {
    sentimentResult = await analyzeCallSentiment(transcriptText, summaryText);
    console.log(`[Vapi] Sentiment for call ${callId}: ${sentimentResult.sentiment} (${sentimentResult.sentimentScore})`);
  } catch (e: any) {
    console.error(`[Vapi] Sentiment analysis error for call ${callId}:`, e.message);
  }

  const updates: Partial<InsertAiReceptionistCall> = {
    status: 'completed',
    duration: message.durationSeconds || call.duration || null,
    summary: summaryText,
    transcript: transcriptText,
    recordingUrl: message.recordingUrl || call.recordingUrl || null,
    endedReason,
    cost: message.cost ? String(message.cost) : null,
    outcome: callOutcome,
    sentiment: sentimentResult.sentiment,
    sentimentScore: sentimentResult.sentimentScore,
  };

  let callRecord: any;
  if (existingCall) {
    if (matchedConfig?.id && !existingCall.phoneNumberId) {
      (updates as any).phoneNumberId = matchedConfig.id;
    }
    const ecrCalledNumber = call.phoneNumber?.number || matchedConfig?.dedicatedPhoneNumber || null;
    if (ecrCalledNumber && !existingCall.calledNumber) {
      (updates as any).calledNumber = ecrCalledNumber;
    }
    await storage.updateAiReceptionistCall(existingCall.id, business.userId, updates);
    callRecord = existingCall;
  } else {
    const calledNumber = call.phoneNumber?.number || matchedConfig?.dedicatedPhoneNumber || null;
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
      outcome: updates.outcome || null,
      sentiment: updates.sentiment || null,
      sentimentScore: updates.sentimentScore ?? null,
      phoneNumberId: matchedConfig?.id || null,
      calledNumber,
    };
    callRecord = await storage.createAiReceptionistCall(createPayload);
  }

  const hasLead = callRecord?.leadId || existingCall?.leadId;
  if (!hasLead && call.customer?.number) {
    try {
      const callerPhone = call.customer.number;

      const recentLeads = await storage.getLeadsByUserAndPhone(business.userId, callerPhone);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentDuplicate = recentLeads?.find(l => l.createdAt && new Date(l.createdAt) > oneHourAgo);
      if (recentDuplicate) {
        const recordId = existingCall?.id || callRecord?.id;
        if (recordId) {
          await storage.updateAiReceptionistCall(recordId, business.userId, { leadId: recentDuplicate.id });
        }
        console.log(`[Vapi] End-of-call: linked to existing lead ${recentDuplicate.id} (spam protection)`);
      } else {
      const lead = await storage.createLead({
        userId: business.userId,
        name: existingCall?.callerName || 'Caller',
        phone: callerPhone,
        email: null,
        source: 'ai_receptionist',
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
      }
    } catch (e: any) {
      console.error(`[Vapi] Failed to auto-create lead for call ${callId}:`, e.message);
    }
  }

  await sendCallNotifications(business, callId, call.customer?.number, message.summary, updates.duration as number | null);

  const callDuration = (updates.duration as number | null) || 0;
  if (callDuration > 10 && call.customer?.number && business.dedicatedPhoneNumber) {
    await sendCallerAutoReply(business, call.customer.number);
  }

  await sendCallPushNotification(
    business.userId,
    existingCall?.callerName || 'Unknown caller',
    call.customer?.number || null,
    callRecord?.callerIntent || existingCall?.callerIntent || null,
    message.summary || null,
    callDuration,
  );

  console.log(`[Vapi Webhook] Call ${callId} completed - duration: ${updates.duration}s`);
  return { ok: true };
}

async function sendCallerAutoReply(
  business: BusinessSettings,
  callerPhone: string,
): Promise<void> {
  try {
    const config = await storage.getAiReceptionistConfig(business.userId);
    if (!config || !config.autoReplyEnabled) {
      console.log(`[Vapi] Auto-reply disabled for user ${business.userId}, skipping caller SMS`);
      return;
    }

    if (!business.dedicatedPhoneNumber) {
      console.log(`[Vapi] No dedicated number for user ${business.userId}, skipping auto-reply SMS`);
      return;
    }

    const businessName = business.businessName || 'the business';
    const template = config.autoReplyMessage ||
      'Thanks for calling {{business_name}}. We got your message and will get back to you shortly. — Sent via JobRunner';
    const smsBody = template.replace(/\{\{business_name\}\}/g, businessName);

    await sendSMS({
      to: callerPhone,
      message: smsBody,
      fromNumber: business.dedicatedPhoneNumber,
    });
    console.log(`[Vapi] Auto-reply SMS sent to caller ${callerPhone} from ${business.dedicatedPhoneNumber}`);
  } catch (e: any) {
    console.error(`[Vapi] Auto-reply SMS failed for caller ${callerPhone}:`, e.message);
  }
}

async function sendCallPushNotification(
  userId: string,
  callerName: string | null,
  callerPhone: string | null,
  callerIntent: string | null,
  summary: string | null,
  duration: number,
): Promise<void> {
  if (duration <= 10) return;
  try {
    const { sendPushNotification } = await import('./pushNotifications');

    const name = callerName || callerPhone || 'Unknown caller';
    const intentLabel = callerIntent
      ? callerIntent.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      : null;
    const summarySnippet = summary ? summary.slice(0, 120) : 'No summary available';

    let body = `${name}`;
    if (intentLabel) body += ` — ${intentLabel}`;
    body += `. ${summarySnippet}`;

    await sendPushNotification({
      userId,
      type: 'ai_receptionist_call',
      title: 'AI Receptionist Call',
      body,
      data: { callerPhone, callerIntent, relatedType: 'ai_call' },
      skipInAppNotification: true,
    });
    console.log(`[Vapi] Push notification sent to tradie ${userId} for AI call`);
  } catch (e: any) {
    console.error(`[Vapi] Push notification failed for user ${userId}:`, e.message);
  }
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
    const callerDisplay = callerPhone || 'Unknown number';
    const summaryText = summary || 'No summary available';
    const durationText = duration ? `${Math.ceil(duration / 60)} min` : 'Unknown';

    try {
      const notificationPayload: InsertNotification = {
        userId,
        type: 'ai_receptionist_call',
        title: `New AI Receptionist Call`,
        message: `Call from ${callerDisplay} (${durationText}). ${summaryText.slice(0, 200)}`,
        data: { callId, callerPhone, duration, source: 'ai_receptionist' },
      };
      await storage.createNotification(notificationPayload);
      console.log(`[Vapi] In-app notification created for user ${userId}`);
    } catch (e: any) {
      console.error(`[Vapi] In-app notification failed:`, e.message);
    }

    const config = await storage.getAiReceptionistConfig(userId);
    if (config?.smsNotifications) {
      const smsBody = `AI Receptionist: ${callerDisplay} called (${durationText}).\n\n${summaryText.slice(0, 200)}\n\nOpen JobRunner to review.`;

      const fromNumber = business.dedicatedPhoneNumber || undefined;
      const notifiedNumbers = new Set<string>();

      const transferNumbers = (config.transferNumbers || []) as TransferNumber[];
      for (const contact of transferNumbers) {
        if (contact.phone && !notifiedNumbers.has(contact.phone)) {
          notifiedNumbers.add(contact.phone);
          try {
            await sendSMS({ to: contact.phone, message: smsBody, fromNumber });
            console.log(`[Vapi] SMS sent to ${contact.name} (${contact.phone})`);
          } catch (e: any) {
            console.error(`[Vapi] SMS send failed for ${contact.phone}:`, e.message);
          }
        }
      }

      try {
        const user = await storage.getUser(userId);
        if (user?.phone && !notifiedNumbers.has(user.phone)) {
          await sendSMS({ to: user.phone, message: smsBody, fromNumber });
          console.log(`[Vapi] SMS sent to owner ${user.phone}`);
        }
      } catch (e: any) {
        console.error(`[Vapi] Owner SMS send failed:`, e.message);
      }
    }
  } catch (e: any) {
    console.error(`[Vapi] sendCallNotifications error:`, e.message);
  }
}

async function sendSupportLineNotifications(
  callerPhone: string | null,
  summary: string | null,
  duration: number | null,
): Promise<void> {
  const adminPhone = process.env.ADMIN_PHONE;
  if (!adminPhone) {
    console.warn('[Vapi] No ADMIN_PHONE configured — skipping support line SMS notification');
    return;
  }

  try {
    const callerDisplay = callerPhone || 'Unknown number';
    const summaryText = summary || 'No summary available';
    const durationText = duration ? `${Math.ceil(duration / 60)} min` : 'Unknown';

    const smsBody = `JobRunner Support Line\nCaller: ${callerDisplay}\nDuration: ${durationText}\n\n${summaryText.slice(0, 200)}\n\nOpen JobRunner to review.`;

    await sendSMS({ to: adminPhone, message: smsBody });
    console.log(`[Vapi] Support line SMS sent to admin ${adminPhone}`);
  } catch (e: any) {
    console.error(`[Vapi] Support line SMS failed:`, e.message);
  }
}

async function handleToolCalls(event: any): Promise<any> {
  const message = event.message || event;
  const call = message.call;
  if (!call) return { ok: true };

  const assistantId = call.assistantId;
  if (!assistantId) return { ok: true };

  const lookupResult = await findBusinessAndConfigByVapiAssistant(assistantId);
  if (!lookupResult) return { ok: true };
  const { business, config: matchedConfig } = lookupResult;

  let existingCall = await storage.getAiReceptionistCallByVapiId(call.id);
  if (!existingCall) {
    const calledNumber = call.phoneNumber?.number || matchedConfig?.dedicatedPhoneNumber || null;
    existingCall = await storage.createAiReceptionistCall({
      userId: business.userId,
      vapiCallId: call.id,
      callerPhone: call.customer?.number || null,
      status: 'in_progress',
      phoneNumberId: matchedConfig?.id || null,
      calledNumber,
    });
  }

  const toolCalls = message.toolCallList || message.toolCalls || [];
  const results: Array<{ toolCallId: string; result: string }> = [];
  const callerPhone = call.customer?.number || existingCall.callerPhone || undefined;

  for (const toolCall of toolCalls) {
    const toolName = toolCall.function?.name || toolCall.name;
    const toolArgs = toolCall.function?.arguments
      ? (typeof toolCall.function.arguments === 'string' ? JSON.parse(toolCall.function.arguments) : toolCall.function.arguments)
      : toolCall.arguments || {};

    const result = await handleToolCall(toolName, toolArgs, business.userId, existingCall.id, callerPhone);

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

  const lookupResult = await findBusinessAndConfigByVapiAssistant(assistantId);
  if (!lookupResult) return { ok: true };
  const { business } = lookupResult;

  const existingCall = await storage.getAiReceptionistCallByVapiId(call.id);
  if (existingCall) {
    await storage.updateAiReceptionistCall(existingCall.id, business.userId, {
      status: existingCall.duration ? 'completed' : 'missed',
      endedReason: 'caller_hangup',
    });
  }

  return { ok: true };
}

export function buildWebsiteChatSystemPrompt(config: {
  businessName: string;
  tradeType?: string;
  greeting?: string;
  knowledgeBank?: {
    faqs?: Array<{ question: string; answer: string }>;
    serviceDescriptions?: string;
    pricingInfo?: string;
    specialInstructions?: string;
  };
  services?: string[];
}): string {
  const businessName = config.businessName || 'the business';
  const tradeType = config.tradeType || 'trades';

  const servicesSection = config.services && config.services.length > 0
    ? `\nServices offered: ${config.services.join(', ')}`
    : '';

  let knowledgeBankSection = '';
  if (config.knowledgeBank) {
    const kb = config.knowledgeBank;
    const parts: string[] = [];
    if (kb.serviceDescriptions) {
      parts.push(`Service descriptions: ${kb.serviceDescriptions}`);
    }
    if (kb.pricingInfo) {
      parts.push(`Pricing information: ${kb.pricingInfo}`);
    }
    if (kb.specialInstructions) {
      parts.push(`Special instructions: ${kb.specialInstructions}`);
    }
    if (kb.faqs && kb.faqs.length > 0) {
      const faqText = kb.faqs
        .filter(f => f.question && f.answer)
        .map(f => `Q: ${f.question}\nA: ${f.answer}`)
        .join('\n\n');
      if (faqText) {
        parts.push(`Frequently Asked Questions:\n${faqText}`);
      }
    }
    if (parts.length > 0) {
      knowledgeBankSection = `\n\nBusiness Knowledge Base:\n${parts.join('\n\n')}`;
    }
  }

  const greeting = config.greeting || `G'day! Thanks for visiting ${businessName}. How can I help you today?`;

  return `You are a friendly, professional AI assistant for ${businessName}, an Australian ${tradeType} business. You are embedded as a live chat widget on the business website.
${servicesSection}

Your role:
- Help website visitors with questions about the business, services, and availability
- Collect the visitor's name, phone number, and reason for contacting as naturally as possible
- Determine the nature of the enquiry (quote request, job enquiry, follow-up, complaint, or general enquiry)
- For quote/job requests, ask about the type of work needed, the location/suburb, and urgency
- Encourage visitors to leave their contact details so the team can follow up

Important guidelines:
- Start with: "${greeting}"
- Be conversational and natural — avoid sounding robotic
- Use Australian English (favour, colour, organise)
- Keep responses concise and suitable for chat (2-4 sentences max)
- If the visitor asks for a quote, gather: type of work, location/suburb, preferred timing, and any specific requirements
- Never make commitments about pricing, availability, or scheduling — say "I'll make sure the team gets back to you"
- If the visitor provides their name and phone number, confirm you've noted their details
- Be proactive about collecting contact information when the visitor shows interest in a service

When you detect that you have collected the visitor's name and/or phone number, include a JSON block at the end of your message in the following format (the visitor will not see this):
<!--LEAD_DATA:{"name":"Visitor Name","phone":"0412345678","intent":"description of what they need","jobType":"type of work"}-->
${knowledgeBankSection}`;
}
