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
let cachedAvailability: { configured: boolean; connected: boolean; hasPhoneNumber: boolean } | null = null;
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
export async function checkTwilioAvailability(): Promise<{ configured: boolean; connected: boolean; hasPhoneNumber: boolean }> {
  // Return cached result if still valid
  const now = Date.now();
  if (cachedAvailability && (now - availabilityCacheTime) < AVAILABILITY_CACHE_TTL) {
    return cachedAvailability;
  }
  
  // Also return cached result if already initialized successfully
  if (isInitialized && twilioClient && twilioPhoneNumber) {
    const result = { configured: true, connected: true, hasPhoneNumber: true };
    cachedAvailability = result;
    availabilityCacheTime = now;
    return result;
  }
  
  try {
    const credentials = await getCredentials();
    const result = {
      configured: true,
      connected: !!(credentials.accountSid && (credentials.authToken || (credentials.apiKey && credentials.apiKeySecret))),
      hasPhoneNumber: !!credentials.phoneNumber
    };
    cachedAvailability = result;
    availabilityCacheTime = now;
    return result;
  } catch (error) {
    const result = {
      configured: false,
      connected: false,
      hasPhoneNumber: false
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
}

interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
  simulated?: boolean;
}

export async function sendSMS(options: SendSMSOptions): Promise<SMSResult> {
  const { to, message, mediaUrls } = options;

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
    // Demo mode - log the SMS/MMS
    console.log(`📱 [DEMO ${isMMS ? 'MMS' : 'SMS'}]`);
    console.log(`   To: ${formattedTo}`);
    console.log(`   Message: ${message}`);
    if (isMMS) {
      console.log(`   Media URLs: ${validMediaUrls.join(', ')}`);
    }
    console.log('   (Twilio not configured - message simulated)');
    return {
      success: true,
      simulated: true,
      messageId: `demo_${Date.now()}`
    };
  }

  try {
    // Build message options
    const messageOptions: any = {
      body: message,
      from: twilioPhoneNumber,
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

// SMS Templates for TradieTrack notifications
export const smsTemplates = {
  quoteReady: (clientName: string, businessName: string, quoteNumber: string) =>
    `Hi ${clientName}, your quote #${quoteNumber} from ${businessName} is ready. Check your email for details.`,
  
  invoiceSent: (clientName: string, businessName: string, invoiceNumber: string, amount: string) =>
    `Hi ${clientName}, invoice #${invoiceNumber} for ${amount} from ${businessName} is ready. Check your email to pay online.`,
  
  paymentReceived: (clientName: string, amount: string, businessName: string) =>
    `Thanks ${clientName}! We received your payment of ${amount}. - ${businessName}`,
  
  jobScheduled: (clientName: string, businessName: string, date: string) =>
    `Hi ${clientName}, ${businessName} has scheduled your job for ${date}. We'll see you then!`,
  
  jobComplete: (clientName: string, businessName: string) =>
    `Hi ${clientName}, your job with ${businessName} is complete. Thanks for choosing us!`,
  
  reminder: (clientName: string, businessName: string, message: string) =>
    `Hi ${clientName}, reminder from ${businessName}: ${message}`
};
