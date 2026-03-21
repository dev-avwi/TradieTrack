/**
 * Twilio Client for SMS notifications
 * Supports both standalone deployment and Replit's managed connector
 * 
 * Integration: connection:conn_twilio_01KB17KVHYEAGTVK0VVR1H47AA
 * 
 * For standalone deployment, set these environment variables:
 * - TWILIO_ACCOUNT_SID
 * - TWILIO_AUTH_TOKEN (or TWILIO_API_KEY + TWILIO_API_KEY_SECRET)
 * - TWILIO_PHONE_NUMBER
 */

import twilio from 'twilio';

let twilioClient: ReturnType<typeof twilio> | null = null;
let twilioPhoneNumber: string | null = null;
let isInitialized = false;
let cachedAvailability: { configured: boolean; connected: boolean; hasPhoneNumber: boolean; verified?: boolean } | null = null;
let availabilityCacheTime: number = 0;
const AVAILABILITY_CACHE_TTL = 60000; // Cache for 1 minute

interface TwilioCredentials {
  accountSid: string;
  apiKey?: string;
  apiKeySecret?: string;
  authToken?: string;
  phoneNumber: string;
}

/**
 * Check if a value looks like a placeholder rather than a real credential
 */
function isPlaceholderValue(value: string | undefined | null): boolean {
  if (!value) return true;
  const trimmed = value.trim();
  if (trimmed.length < 10) return true; // Too short to be real
  
  // Common placeholder patterns
  const placeholderPatterns = [
    /^AC[Xx]+$/i,           // ACxxxx... or ACXXXX...
    /^SK[Xx]+$/i,           // SKxxxx...
    /^your[_\s]/i,          // "your_account_sid", "Your Auth Token"
    /^placeholder/i,        // "placeholder..."
    /^test[_\s]/i,          // "test_..." but not real test keys
    /^example/i,            // "example..."
    /^enter[_\s]/i,         // "enter your..."
    /^\*+$/,                // Just asterisks
    /^\.+$/,                // Just dots
  ];
  
  return placeholderPatterns.some(pattern => pattern.test(trimmed));
}

/**
 * Check if a phone number looks valid (E.164 format)
 */
function isValidPhoneNumber(phone: string | undefined | null): boolean {
  if (!phone) return false;
  const trimmed = phone.trim();
  // E.164 format: + followed by 10-15 digits
  return /^\+[1-9]\d{9,14}$/.test(trimmed);
}

/**
 * Get Twilio credentials from multiple sources (standalone deployment support)
 * Priority:
 * 1. Direct environment variables (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, etc.)
 * 2. Replit managed connector
 */
async function getCredentials(): Promise<TwilioCredentials> {
  // Priority 1: Check for direct environment variables (standalone deployment)
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const apiKey = process.env.TWILIO_API_KEY;
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER;
  
  if (accountSid && (authToken || (apiKey && apiKeySecret))) {
    console.log('✅ Using direct Twilio environment variables');
    return {
      accountSid,
      authToken: authToken || undefined,
      apiKey: apiKey || undefined,
      apiKeySecret: apiKeySecret || undefined,
      phoneNumber: phoneNumber || ''
    };
  }

  // Priority 2: Try Replit managed connector
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken || !hostname) {
    throw new Error('No Twilio credentials available (direct env vars or Replit connector)');
  }

  const response = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=twilio`,
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  );

  const data = await response.json();
  const connectionSettings = data.items?.[0];

  if (!connectionSettings?.settings?.account_sid || 
      !connectionSettings?.settings?.api_key || 
      !connectionSettings?.settings?.api_key_secret) {
    throw new Error('Twilio not connected - missing credentials from Replit connector');
  }

  console.log('✅ Using Replit managed Twilio connector');
  // Handle both phone_number and twilio_phone_number field names
  const phoneNum = connectionSettings.settings.phone_number || 
                   connectionSettings.settings.twilio_phone_number || 
                   connectionSettings.settings.phoneNumber || '';
  return {
    accountSid: connectionSettings.settings.account_sid,
    apiKey: connectionSettings.settings.api_key,
    apiKeySecret: connectionSettings.settings.api_key_secret,
    phoneNumber: phoneNum
  };
}

export async function initializeTwilio(): Promise<boolean> {
  try {
    const credentials = await getCredentials();
    
    // Support both authToken and apiKey authentication
    if (credentials.authToken) {
      // Use account SID + auth token authentication
      twilioClient = twilio(credentials.accountSid, credentials.authToken);
    } else if (credentials.apiKey && credentials.apiKeySecret) {
      // Use API key authentication
      twilioClient = twilio(credentials.apiKey, credentials.apiKeySecret, {
        accountSid: credentials.accountSid
      });
    } else {
      throw new Error('No valid Twilio authentication method available');
    }
    
    twilioPhoneNumber = credentials.phoneNumber;
    isInitialized = true;
    console.log('✅ Twilio initialized for SMS notifications');
    return true;
  } catch (error) {
    console.log('⚠️ Twilio not available - SMS notifications will be simulated');
    isInitialized = false;
    return false;
  }
}

export function isTwilioInitialized(): boolean {
  return isInitialized && twilioClient !== null;
}

// Check if Twilio is available (async - checks connector or env vars, with caching)
// Returns connected: true only if credentials appear valid (not placeholders) and phone number is present
export async function checkTwilioAvailability(): Promise<{ configured: boolean; connected: boolean; hasPhoneNumber: boolean; verified: boolean }> {
  // Return cached result if still valid
  const now = Date.now();
  if (cachedAvailability && (now - availabilityCacheTime) < AVAILABILITY_CACHE_TTL) {
    return { ...cachedAvailability, verified: cachedAvailability.connected };
  }
  
  // If already initialized and verified, return cached positive result
  if (isInitialized && twilioClient && twilioPhoneNumber && isValidPhoneNumber(twilioPhoneNumber)) {
    const result = { configured: true, connected: true, hasPhoneNumber: true, verified: true };
    cachedAvailability = result;
    availabilityCacheTime = now;
    return result;
  }
  
  try {
    const credentials = await getCredentials();
    
    // Check if credentials look like placeholders
    const hasRealAccountSid = !isPlaceholderValue(credentials.accountSid) && 
                               credentials.accountSid.startsWith('AC') && 
                               credentials.accountSid.length >= 34;
    
    const hasRealAuthToken = credentials.authToken ? 
                              (!isPlaceholderValue(credentials.authToken) && credentials.authToken.length >= 32) : 
                              false;
    
    const hasRealApiKey = credentials.apiKey ? 
                          (!isPlaceholderValue(credentials.apiKey) && credentials.apiKey.startsWith('SK')) : 
                          false;
    
    const hasRealApiSecret = credentials.apiKeySecret ? 
                              (!isPlaceholderValue(credentials.apiKeySecret) && credentials.apiKeySecret.length >= 32) : 
                              false;
    
    const hasValidAuth = hasRealAccountSid && (hasRealAuthToken || (hasRealApiKey && hasRealApiSecret));
    const hasValidPhone = isValidPhoneNumber(credentials.phoneNumber);
    
    // configured = credentials exist (even if placeholder)
    // connected = credentials appear valid (not placeholders) AND phone number is valid
    const result = {
      configured: !!(credentials.accountSid && (credentials.authToken || (credentials.apiKey && credentials.apiKeySecret))),
      connected: hasValidAuth && hasValidPhone,
      hasPhoneNumber: hasValidPhone,
      verified: hasValidAuth && hasValidPhone
    };
    
    cachedAvailability = result;
    availabilityCacheTime = now;
    return result;
  } catch (error) {
    const result = {
      configured: false,
      connected: false,
      hasPhoneNumber: false,
      verified: false
    };
    cachedAvailability = result;
    availabilityCacheTime = now;
    return result;
  }
}

export async function getTwilioClient() {
  if (!twilioClient) {
    await initializeTwilio();
  }
  return twilioClient;
}

export function getTwilioPhoneNumber(): string | null {
  return twilioPhoneNumber;
}

interface SendSMSOptions {
  to: string;
  message: string;
  mediaUrls?: string[]; // MMS media URLs (max 10, each up to 5MB)
  alphanumericSenderId?: string; // Registered alphanumeric sender ID (e.g., "JobRunner")
  fromNumber?: string; // Override from number (e.g., dedicated AI Receptionist number)
}

interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
  simulated?: boolean;
  notConfigured?: boolean;
}

export async function sendSMS(options: SendSMSOptions): Promise<SMSResult> {
  const { to, message, mediaUrls, alphanumericSenderId } = options;

  // Format Australian phone number
  let formattedTo = to.replace(/\s+/g, '').replace(/^0/, '+61');
  if (!formattedTo.startsWith('+')) {
    formattedTo = '+61' + formattedTo.replace(/^61/, '');
  }

  // Validate media URLs (max 10 per Twilio MMS)
  const validMediaUrls = mediaUrls?.slice(0, 10) || [];
  const isMMS = validMediaUrls.length > 0;

  // Ensure Twilio is initialized before checking status
  await getTwilioClient();
  
  if (!isTwilioInitialized() || !twilioClient || !twilioPhoneNumber) {
    // SMS not configured - return error instead of pretending success
    console.log(`⚠️ [SMS NOT SENT - Twilio not configured]`);
    console.log(`   To: ${formattedTo}`);
    console.log(`   Message: ${message.substring(0, 50)}...`);
    return {
      success: false,
      notConfigured: true,
      error: 'SMS not configured. Please set up Twilio in Settings > Integrations to send text messages.'
    };
  }

  try {
    // Use alphanumeric sender ID for one-way SMS (no MMS support), dedicated number, or platform number
    const fromValue = (!isMMS && options.alphanumericSenderId) 
      ? options.alphanumericSenderId 
      : (options.fromNumber || twilioPhoneNumber);

    const messageOptions: any = {
      body: message,
      from: fromValue,
      to: formattedTo
    };

    // Add MediaUrl for MMS (Twilio accepts array of URLs)
    if (isMMS) {
      messageOptions.mediaUrl = validMediaUrls;
    }

    const result = await twilioClient.messages.create(messageOptions);

    console.log(`✅ ${isMMS ? 'MMS' : 'SMS'} sent to ${formattedTo}: ${result.sid}`);
    return {
      success: true,
      messageId: result.sid
    };
  } catch (error: any) {
    console.error(`❌ Failed to send ${isMMS ? 'MMS' : 'SMS'}:`, error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Auto-configure the Twilio phone number's incoming SMS webhook URL
 * so inbound messages route to our app instead of showing the default Twilio auto-reply.
 */
export async function configureTwilioWebhook(baseUrl: string): Promise<boolean> {
  if (!twilioClient || !twilioPhoneNumber) {
    console.log('⚠️ Cannot configure Twilio webhook - client or phone number not available');
    return false;
  }

  const webhookUrl = `${baseUrl}/api/sms/webhook/incoming`;

  try {
    const incomingNumbers = await twilioClient.incomingPhoneNumbers.list({
      phoneNumber: twilioPhoneNumber,
      limit: 1,
    });

    if (incomingNumbers.length === 0) {
      console.log(`⚠️ Twilio phone number ${twilioPhoneNumber} not found in account - webhook not configured`);
      console.log('   This may be normal if using an alphanumeric sender ID or messaging service');
      return false;
    }

    const phoneNumberSid = incomingNumbers[0].sid;
    const currentSmsUrl = incomingNumbers[0].smsUrl;

    if (currentSmsUrl === webhookUrl) {
      console.log(`✅ Twilio SMS webhook already configured: ${webhookUrl}`);
      return true;
    }

    await twilioClient.incomingPhoneNumbers(phoneNumberSid).update({
      smsUrl: webhookUrl,
      smsMethod: 'POST',
    });

    console.log(`✅ Twilio SMS webhook configured: ${webhookUrl}`);
    if (currentSmsUrl) {
      console.log(`   (was: ${currentSmsUrl})`);
    }
    return true;
  } catch (error: any) {
    console.error('❌ Failed to configure Twilio webhook:', error.message);
    console.log(`   Please manually set SMS webhook URL to: ${webhookUrl}`);
    return false;
  }
}

/**
 * Search for available Australian phone numbers to purchase
 */
export async function searchAvailableNumbers(options: {
  areaCode?: string;
  contains?: string;
  locality?: string;
  limit?: number;
  smsEnabled?: boolean;
}): Promise<{ success: boolean; numbers?: any[]; error?: string }> {
  const client = await getTwilioClient();
  if (!client) {
    return { success: false, error: 'Twilio not configured' };
  }

  try {
    const searchParams: any = {
      smsEnabled: options.smsEnabled !== false,
      voiceEnabled: true,
    };
    if (options.contains) searchParams.contains = options.contains;
    if (options.locality) searchParams.inLocality = options.locality;
    
    let numbers;
    if (options.areaCode) {
      searchParams.areaCode = options.areaCode;
      numbers = await client.availablePhoneNumbers('AU')
        .local.list({ ...searchParams, limit: options.limit || 10 });
    } else {
      numbers = await client.availablePhoneNumbers('AU')
        .mobile.list({ ...searchParams, limit: options.limit || 10 });
      
      if (numbers.length === 0) {
        numbers = await client.availablePhoneNumbers('AU')
          .local.list({ ...searchParams, limit: options.limit || 10 });
      }
    }

    return {
      success: true,
      numbers: numbers.map((n: any) => ({
        phoneNumber: n.phoneNumber,
        friendlyName: n.friendlyName,
        locality: n.locality,
        region: n.region,
        isoCountry: n.isoCountry,
        capabilities: {
          voice: n.capabilities?.voice,
          sms: n.capabilities?.sms,
          mms: n.capabilities?.mms,
        },
        monthlyPrice: '3.00',
      })),
    };
  } catch (error: any) {
    console.error('Error searching available numbers:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Purchase a Twilio phone number and configure its webhook
 */
export function parseAustralianAddress(address: string): { street: string; city: string; region: string; postalCode: string; valid: boolean } {
  if (!address || address.trim().length < 5) {
    return { street: '', city: '', region: '', postalCode: '', valid: false };
  }

  const postcodeMatch = address.match(/\b(\d{4})\b(?:\s*$|\s*,)/);
  const postalCode = postcodeMatch ? postcodeMatch[1] : '';

  const stateAbbreviations = ['QLD', 'NSW', 'VIC', 'SA', 'WA', 'TAS', 'NT', 'ACT'];
  let region = '';
  for (const state of stateAbbreviations) {
    const stateRegex = new RegExp(`\\b${state}\\b`, 'i');
    if (stateRegex.test(address)) {
      region = state;
      break;
    }
  }

  let cleaned = address;
  if (postalCode) cleaned = cleaned.replace(new RegExp(`\\s*,?\\s*${postalCode}\\s*`), ' ');
  if (region) cleaned = cleaned.replace(new RegExp(`\\s*,?\\s*\\b${region}\\b\\s*`, 'i'), ', ');
  
  const commaParts = cleaned.split(',').map(p => p.trim()).filter(Boolean);
  const street = commaParts[0] || '';
  const city = commaParts.length > 1 ? commaParts[commaParts.length - 1] : '';

  const valid = !!(street && city && region && postalCode);
  return { street, city, region, postalCode, valid };
}

export async function createOrFindTwilioAddress(businessOwnerId: string, businessInfo: {
  businessName: string;
  address: string;
  city?: string;
  region?: string;
  postalCode?: string;
  customerName?: string;
}): Promise<{ success: boolean; addressSid?: string; error?: string }> {
  const client = await getTwilioClient();
  if (!client) {
    return { success: false, error: 'Twilio not configured' };
  }

  const tenantKey = `JobRunner-${businessOwnerId}`;

  try {
    const existing = await client.addresses.list({ friendlyName: tenantKey, limit: 1 });
    if (existing.length > 0) {
      return { success: true, addressSid: existing[0].sid };
    }

    const parts = parseAustralianAddress(businessInfo.address);
    if (!parts.valid) {
      return { success: false, error: 'Business address is incomplete. Please update your business address in Settings (include street, suburb, state, and postcode).' };
    }

    const created = await client.addresses.create({
      friendlyName: tenantKey,
      customerName: businessInfo.customerName || businessInfo.businessName,
      street: parts.street,
      city: businessInfo.city || parts.city,
      region: businessInfo.region || parts.region,
      postalCode: businessInfo.postalCode || parts.postalCode,
      isoCountry: 'AU',
    });

    console.log(`[Twilio] Created address: ${created.sid} for tenant ${tenantKey}`);
    return { success: true, addressSid: created.sid };
  } catch (error: any) {
    console.error('[Twilio] Error creating address:', error.message);
    return { success: false, error: error.message };
  }
}

export async function purchasePhoneNumber(phoneNumber: string, webhookUrl: string, addressSid?: string): Promise<{ success: boolean; sid?: string; phoneNumber?: string; error?: string }> {
  const client = await getTwilioClient();
  if (!client) {
    return { success: false, error: 'Twilio not configured' };
  }

  try {
    const createParams: Record<string, string> = {
      phoneNumber: phoneNumber,
      smsUrl: webhookUrl,
      smsMethod: 'POST',
      friendlyName: `JobRunner Business Number`,
    };
    
    if (addressSid) {
      createParams.addressSid = addressSid;
    }

    const purchased = await client.incomingPhoneNumbers.create(createParams);

    console.log(`[SMS] Purchased Twilio number: ${purchased.phoneNumber} (${purchased.sid})`);
    return {
      success: true,
      sid: purchased.sid,
      phoneNumber: purchased.phoneNumber,
    };
  } catch (error: any) {
    console.error('[SMS] Error purchasing phone number:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Release (delete) a Twilio phone number
 */
export async function releasePhoneNumber(phoneNumber: string): Promise<{ success: boolean; error?: string }> {
  const client = await getTwilioClient();
  if (!client) {
    return { success: false, error: 'Twilio not configured' };
  }

  try {
    const numbers = await client.incomingPhoneNumbers.list({
      phoneNumber: phoneNumber,
      limit: 1,
    });

    if (numbers.length === 0) {
      return { success: false, error: 'Phone number not found in Twilio account' };
    }

    await client.incomingPhoneNumbers(numbers[0].sid).remove();
    console.log(`✅ Released Twilio number: ${phoneNumber}`);
    return { success: true };
  } catch (error: any) {
    console.error('Error releasing phone number:', error.message);
    return { success: false, error: error.message };
  }
}

// SMS Templates for JobRunner notifications
export const smsTemplates = {
  quoteReady: (clientName: string, businessName: string, quoteNumber: string, businessPhone?: string) =>
    `Hi ${clientName}, your quote #${quoteNumber} from ${businessName} is ready. Reply YES to accept or view details:${businessPhone ? `\nCall us: ${businessPhone}` : ''}`,
  
  quoteWithTotal: (clientName: string, businessName: string, quoteNumber: string, total: string, businessPhone?: string) =>
    `Hi ${clientName}, your quote #${quoteNumber} for $${total} from ${businessName} is ready. Reply YES to accept or view:${businessPhone ? `\nCall us: ${businessPhone}` : ''}`,
  
  invoiceSent: (clientName: string, businessName: string, invoiceNumber: string, amount: string, businessPhone?: string) =>
    `Hi ${clientName}, invoice #${invoiceNumber} for ${amount} from ${businessName} is ready. Check your email to pay online.${businessPhone ? `\nCall us: ${businessPhone}` : ''}`,
  
  paymentReceived: (clientName: string, amount: string, businessName: string, receiptUrl?: string, businessPhone?: string) =>
    receiptUrl 
      ? `Thanks ${clientName}! We received your payment of ${amount}. Your receipt: ${receiptUrl} - ${businessName}${businessPhone ? `\nCall us: ${businessPhone}` : ''}`
      : `Thanks ${clientName}! We received your payment of ${amount}. - ${businessName}${businessPhone ? `\nCall us: ${businessPhone}` : ''}`,
  
  jobScheduled: (clientName: string, businessName: string, date: string, businessPhone?: string) =>
    `Hi ${clientName}, ${businessName} has scheduled your job for ${date}. We'll see you then!${businessPhone ? `\nCall us: ${businessPhone}` : ''}`,
  
  jobComplete: (clientName: string, businessName: string, businessPhone?: string) =>
    `Hi ${clientName}, your job with ${businessName} is complete. Thanks for choosing us!${businessPhone ? `\nCall us: ${businessPhone}` : ''}`,
  
  reminder: (clientName: string, businessName: string, message: string, businessPhone?: string) =>
    `Hi ${clientName}, reminder from ${businessName}: ${message}${businessPhone ? `\nCall us: ${businessPhone}` : ''}`
};

export function validateTwilioWebhook(req: any, res: any, next: any) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[Twilio Webhook] No TWILIO_AUTH_TOKEN in production - rejecting request');
      return res.status(503).send('Service unavailable');
    }
    console.warn('[Twilio Webhook] No TWILIO_AUTH_TOKEN set, skipping signature verification (dev mode)');
    return next();
  }

  const twilioSignature = req.headers['x-twilio-signature'];
  if (!twilioSignature) {
    console.warn('[Twilio Webhook] Missing X-Twilio-Signature header');
    return res.status(403).send('Forbidden');
  }

  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.headers['host'] || req.hostname;
  const url = `${protocol}://${host}${req.originalUrl}`;

  const { validateRequest } = twilio;
  const isValid = validateRequest(authToken, twilioSignature, url, req.body || {});

  if (!isValid) {
    console.warn('[Twilio Webhook] Invalid signature - request rejected');
    return res.status(403).send('Forbidden');
  }

  next();
}
