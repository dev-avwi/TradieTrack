import { storage } from './storage';
import type { BusinessSettings, InsertAiReceptionistCall, InsertAiReceptionistConfig, InsertNotification, AiReceptionistConfig } from '@shared/schema';
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

interface VapiAssistantConfig {
  businessName: string;
  businessPhone?: string;
  tradeType?: string;
  greeting?: string;
  voice?: string;
  transferNumbers?: Array<{ name: string; phone: string; priority: number }>;
  businessHours?: { start: string; end: string; timezone: string; days: number[] };
  webhookUrl: string;
  services?: string[];
  teamInfo?: Array<{ name: string; role: string }>;
  knownClientCount?: number;
  knowledgeBank?: KnowledgeBankContent;
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

  return `You are a friendly, professional AI receptionist for ${businessName}, an Australian ${tradeType} business.
${servicesSection}${teamSection}${clientContextSection}

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
${(config.transferNumbers && config.transferNumbers.length > 0) || (config.teamInfo && config.teamInfo.length > 0) ? '5. "transfer_call" - Transfer the call to an available team member when the caller wants to speak with someone directly.' : ''}

Workflow:
1. First, greet the caller and ask how you can help
2. Use "lookup_client" if they mention being an existing client
3. Gather their details and reason for calling
4. Use "check_availability" if they ask about scheduling
5. Use "capture_lead" to save their details
6. If they want to book, use "create_booking"
7. If they insist on speaking with someone, use "transfer_call" (if available)${knowledgeBankSection}`;
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
      return { success: false, error: 'A dedicated phone number is required. Please contact support to provision one.' };
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

    const catalogItems = await storage.getLineItemCatalog(userId);
    const services = catalogItems.map(item => item.name).filter(Boolean).slice(0, 20);

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
  businessHours?: { start: string; end: string; timezone: string; days: number[] };
  knowledgeBank?: KnowledgeBankContent;
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

    await storage.updateAiReceptionistConfig(userId, configUpdates);

    if (config.vapiAssistantId && (updates.voice || updates.greeting || updates.transferNumbers || updates.businessHours || updates.knowledgeBank)) {
      try {
        const settings = await storage.getBusinessSettings(userId);
        const webhookUrl = getWebhookUrl();

        const teamMembers = await storage.getTeamMembers(userId);
        const teamInfo = teamMembers
          .filter(m => m.isActive)
          .map(m => ({ name: `${m.firstName || ''} ${m.lastName || ''}`.trim() || m.email, role: m.role || 'team member' }));

        const clients = await storage.getClients(userId);
        const knownClientCount = clients.length;

        const catalogItems = await storage.getLineItemCatalog(userId);
        const services = catalogItems.map(item => item.name).filter(Boolean).slice(0, 20);

        const resolvedKB = updates.knowledgeBank || (config.knowledgeBank as KnowledgeBankContent | null) || undefined;

        await updateAssistant(config.vapiAssistantId, {
          businessName: settings?.businessName || '',
          tradeType: settings?.industry || undefined,
          voice: updates.voice || config.voiceName || 'Jess',
          greeting: updates.greeting || config.greeting || undefined,
          transferNumbers: updates.transferNumbers || (config.transferNumbers as TransferNumber[]) || [],
          businessHours: updates.businessHours || (config.businessHours as BusinessHoursConfig | null) || undefined,
          webhookUrl,
          services,
          teamInfo,
          knownClientCount,
          knowledgeBank: resolvedKB,
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
    return match;
  }

  const allConfigs = await storage.getAllAiReceptionistConfigs();
  const configMatch = allConfigs.find(c => c.vapiAssistantId === assistantId);
  if (configMatch) {
    assistantCache.set(assistantId, { userId: configMatch.userId, timestamp: Date.now() });
    return storage.getBusinessSettings(configMatch.userId);
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

    let client = null;
    if (callerPhone) {
      client = await storage.getClientByPhone(userId, callerPhone);
    }
    if (!client) {
      client = await storage.createClient({
        userId,
        name: callerName,
        email: callerEmail || undefined,
        phone: callerPhone || undefined,
        referralSource: 'AI Receptionist',
        notes: `Auto-created from AI Receptionist call`,
      });
      console.log(`[Vapi] Auto-created client: ${client.id} for ${callerName}`);
    }

    const jobTitle = jobType !== 'General enquiry'
      ? `${jobType} - ${callerName}`
      : `New enquiry - ${callerName}`;

    const jobDescription = [
      notes,
      address ? `Address: ${address}` : null,
      urgency ? `Urgency: ${urgency}` : null,
      `Received via AI Receptionist`,
    ].filter(Boolean).join('\n');

    const job = await storage.createJob({
      userId,
      clientId: client.id,
      title: jobTitle,
      description: jobDescription,
      address: address || undefined,
      status: 'pending',
      leadSource: 'ai_receptionist',
      leadId: lead.id,
    });

    await storage.updateLead(lead.id, userId, {
      clientId: client.id,
      status: 'won',
      wonLostReason: 'Auto-converted to job from AI Receptionist',
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
        autoCreatedJobId: job.id,
        autoCreatedClientId: client.id,
      },
    });

    try {
      await storage.createNotification({
        userId,
        type: 'new_lead',
        title: 'New Job from AI Receptionist',
        message: `${callerName} called about "${jobType}". Job created automatically.`,
        relatedId: job.id,
        relatedType: 'job',
        priority: 'important',
        actionUrl: `/jobs/${job.id}`,
        actionLabel: 'View Job',
      });
    } catch (e) {
      console.error('[Vapi] Failed to create notification:', e);
    }

    console.log(`[Vapi] Lead ${lead.id} + Job ${job.id} created for call ${callId}`);
    return { result: `Job request created successfully. Reference number: ${job.id.slice(0, 8)}` };
  } catch (error: any) {
    console.error('[Vapi] Failed to capture lead and create job:', error);
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
      return { result: 'Unable to transfer at this time. I\'ll make sure someone calls you back.' };
    }

    const target = await getAvailableTransferTarget(userId, settings, callerPhone || args.caller_phone);
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

    const config = await storage.getAiReceptionistConfig(userId);
    const businessHours = (config?.businessHours || null) as BusinessHoursConfig | null;
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

  const endedReason = message.endedReason || call.endedReason || null;
  const callOutcome = existingCall?.transferredTo ? 'transferred'
    : existingCall?.leadId ? 'booked'
    : endedReason === 'missed' || endedReason === 'no-answer' ? 'missed'
    : 'message_taken';

  const updates: Partial<InsertAiReceptionistCall> = {
    status: 'completed',
    duration: message.durationSeconds || call.duration || null,
    summary: message.summary || null,
    transcript: message.transcript || null,
    recordingUrl: message.recordingUrl || call.recordingUrl || null,
    endedReason,
    cost: message.cost ? String(message.cost) : null,
    outcome: callOutcome,
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

    const configForNotify = await storage.getAiReceptionistConfig(userId);
    const transferNumbers = (configForNotify?.transferNumbers || []) as TransferNumber[];
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
