import { storage } from './storage';
import type { BusinessSettings, InsertAiReceptionistCall } from '@shared/schema';
import crypto from 'crypto';

const VAPI_API_BASE = 'https://api.vapi.ai';
const VAPI_API_KEY = process.env.VAPI_PRIVATE_KEY || '';

export function verifyVapiWebhook(rawBody: string | Buffer, signature: string | undefined): boolean {
  if (!VAPI_API_KEY || !signature) {
    return !VAPI_API_KEY;
  }
  try {
    const hmac = crypto.createHmac('sha256', VAPI_API_KEY);
    hmac.update(typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8'));
    const expected = hmac.digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
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

After collecting the caller's information, use the "capture_lead" tool to save their details.
${config.transferNumbers && config.transferNumbers.length > 0 ? 'If the caller requests to speak with someone directly, use the "transfer_call" tool.' : 'Let callers know that someone from the team will call them back shortly.'}`;
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
  ];

  if (config.transferNumbers && config.transferNumbers.length > 0) {
    tools.push({
      type: 'function',
      function: {
        name: 'transfer_call',
        description: 'Transfer the call to a team member when the caller wants to speak with someone directly',
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

    const transferNumbers = (settings.aiReceptionistTransferNumbers as any[]) || [];
    const businessHours = settings.aiReceptionistBusinessHours as any;

    const assistant = await createAssistant({
      businessName: settings.businessName,
      businessPhone: settings.phone || undefined,
      tradeType: settings.industry || undefined,
      greeting: settings.aiReceptionistGreeting || undefined,
      voice: settings.aiReceptionistVoice || 'Jess',
      transferNumbers,
      businessHours,
      webhookUrl,
    });

    await storage.updateBusinessSettings(userId, {
      vapiAssistantId: assistant.id,
      aiReceptionistEnabled: true,
      aiReceptionistMode: settings.aiReceptionistMode || 'always_on_message',
      smsMode: 'ai_receptionist',
    } as any);

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
    } as any);

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
          transferNumbers: updates.transferNumbers || (settings.aiReceptionistTransferNumbers as any[]) || [],
          businessHours: updates.businessHours || (settings.aiReceptionistBusinessHours as any) || undefined,
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

  if (toolName === 'capture_lead') {
    return handleCaptureLead(toolArgs, userId, callId);
  }

  if (toolName === 'transfer_call') {
    return handleTransferCall(toolArgs, userId);
  }

  console.warn(`[Vapi] Unknown tool: ${toolName}`);
  return { result: 'Tool not recognized' };
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

async function handleTransferCall(args: any, userId: string): Promise<any> {
  try {
    const settings = await storage.getBusinessSettings(userId);
    if (!settings) {
      return { result: 'Unable to transfer at this time. I\'ll make sure someone calls you back.' };
    }

    const transferNumbers = (settings.aiReceptionistTransferNumbers as any[]) || [];
    if (transferNumbers.length === 0) {
      return { result: 'No one is available to take the call right now. I\'ll make sure someone calls you back soon.' };
    }

    const sorted = [...transferNumbers].sort((a, b) => (a.priority || 99) - (b.priority || 99));
    const target = sorted[0];

    return {
      result: `Transferring to ${target.name}...`,
      forwardingPhoneNumber: target.phone,
    };
  } catch (error: any) {
    console.error('[Vapi] Transfer failed:', error);
    return { result: 'Unable to transfer at this time. I\'ll make sure someone calls you back.' };
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

  if (existingCall) {
    await storage.updateAiReceptionistCall(existingCall.id, business.userId, updates);
  } else {
    await storage.createAiReceptionistCall({
      userId: business.userId,
      vapiCallId: callId,
      callerPhone: call.customer?.number || null,
      ...updates,
    } as any);
  }

  console.log(`[Vapi Webhook] Call ${callId} completed - duration: ${updates.duration}s`);
  return { ok: true };
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
