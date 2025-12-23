// Google Calendar Client for TradieTrack
// Supports per-user OAuth tokens stored in businessSettings
// Each tradie connects their own Google Calendar account

import { google, calendar_v3 } from 'googleapis';
import { storage } from './storage';

// Google OAuth credentials from environment
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CALENDAR_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CALENDAR_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;

// Get the redirect URI for OAuth - consistent with Xero approach
function getRedirectUri(): string {
  const baseUrl = process.env.REPLIT_DEV_DOMAIN 
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : process.env.REPLIT_DOMAINS
      ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
      : 'http://localhost:5000';
  const redirectUri = `${baseUrl}/api/integrations/google-calendar/callback`;
  console.log('[GoogleCalendar] Using redirect URI:', redirectUri);
  return redirectUri;
}

// Get OAuth2 client configured with app credentials
function getOAuth2Client(): any {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error('Google Calendar credentials not configured');
  }
  
  const redirectUri = getRedirectUri();
  
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    redirectUri
  );
}

// Generate authorization URL for a user to connect their Google Calendar
export function getAuthorizationUrl(userId: string): string {
  const oauth2Client = getOAuth2Client();
  
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/userinfo.email'
    ],
    state: userId
  });
}

// Exchange authorization code for tokens and store them
export async function handleOAuthCallback(code: string, userId: string): Promise<{
  success: boolean;
  email?: string;
  error?: string;
}> {
  try {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    
    oauth2Client.setCredentials(tokens);
    
    // Get user's email from Google
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const email = userInfo.data.email || undefined;
    
    // Store tokens in businessSettings
    await storage.updateBusinessSettings(userId, {
      googleCalendarConnected: true,
      googleCalendarAccessToken: tokens.access_token || null,
      googleCalendarRefreshToken: tokens.refresh_token || null,
      googleCalendarTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      googleCalendarEmail: email || null,
    });
    
    console.log(`[GoogleCalendar] Connected for user ${userId}: ${email}`);
    return { success: true, email };
  } catch (error: any) {
    console.error('[GoogleCalendar] OAuth callback error:', error);
    return { success: false, error: error.message };
  }
}

// Disconnect Google Calendar for a user
export async function disconnectCalendar(userId: string): Promise<void> {
  await storage.updateBusinessSettings(userId, {
    googleCalendarConnected: false,
    googleCalendarAccessToken: null,
    googleCalendarRefreshToken: null,
    googleCalendarTokenExpiry: null,
    googleCalendarEmail: null,
  });
  console.log(`[GoogleCalendar] Disconnected for user ${userId}`);
}

// Get access token for a user, refreshing if necessary
async function getUserAccessToken(userId: string): Promise<string> {
  const settings = await storage.getBusinessSettings(userId);
  
  if (!settings?.googleCalendarConnected || !settings.googleCalendarRefreshToken) {
    throw new Error('Google Calendar not connected for this user');
  }
  
  // Check if token is expired or about to expire (within 5 minutes)
  const tokenExpiry = settings.googleCalendarTokenExpiry 
    ? new Date(settings.googleCalendarTokenExpiry).getTime() 
    : 0;
  const isExpired = tokenExpiry < Date.now() + 5 * 60 * 1000;
  
  if (!isExpired && settings.googleCalendarAccessToken) {
    return settings.googleCalendarAccessToken;
  }
  
  // Refresh the token
  try {
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({
      refresh_token: settings.googleCalendarRefreshToken
    });
    
    const { credentials } = await oauth2Client.refreshAccessToken();
    
    // Update stored tokens
    await storage.updateBusinessSettings(userId, {
      googleCalendarAccessToken: credentials.access_token || null,
      googleCalendarTokenExpiry: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
    });
    
    console.log(`[GoogleCalendar] Refreshed token for user ${userId}`);
    return credentials.access_token!;
  } catch (error: any) {
    console.error('[GoogleCalendar] Token refresh failed:', error);
    
    // If refresh fails, mark as disconnected
    await storage.updateBusinessSettings(userId, {
      googleCalendarConnected: false,
    });
    
    throw new Error('Google Calendar token expired - please reconnect');
  }
}

// Check if Google Calendar is connected for a user
export async function isGoogleCalendarConnected(userId?: string): Promise<boolean> {
  // If no userId provided, check if credentials are configured (for integration status page)
  if (!userId) {
    return !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
  }
  
  try {
    const settings = await storage.getBusinessSettings(userId);
    return !!(settings?.googleCalendarConnected && settings.googleCalendarRefreshToken);
  } catch (error) {
    return false;
  }
}

// Check if Google Calendar is configured (credentials exist)
export function isGoogleCalendarConfigured(): boolean {
  return !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
}

// Get calendar client for a specific user
export async function getCalendarClient(userId: string): Promise<calendar_v3.Calendar> {
  const accessToken = await getUserAccessToken(userId);
  
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.calendar({ version: 'v3', auth: oauth2Client });
}

// Get connected calendar info for a user
export async function getCalendarInfo(userId?: string): Promise<{
  connected: boolean;
  configured: boolean;
  email?: string;
  calendarId?: string;
} | null> {
  // Check if configured
  const configured = isGoogleCalendarConfigured();
  
  if (!userId) {
    return { connected: false, configured };
  }
  
  try {
    const settings = await storage.getBusinessSettings(userId);
    
    if (!settings?.googleCalendarConnected) {
      return { connected: false, configured, email: undefined };
    }
    
    return {
      connected: true,
      configured: true,
      email: settings.googleCalendarEmail || undefined,
      calendarId: 'primary'
    };
  } catch (error) {
    console.error('[GoogleCalendar] Failed to get calendar info:', error);
    return { connected: false, configured };
  }
}

// Status colors based on job status
const STATUS_COLORS: Record<string, string> = {
  'pending': '5',      // Yellow
  'scheduled': '1',    // Lavender/Blue
  'in_progress': '6',  // Orange
  'done': '10',        // Green
  'invoiced': '2',     // Light green/Sage
  'cancelled': '8',    // Gray
};

// Build event summary with status emoji
function buildEventSummary(job: {
  title: string;
  status?: string;
  clientName?: string;
}): string {
  const statusEmojis: Record<string, string> = {
    'pending': '⏳',
    'scheduled': '📅',
    'in_progress': '🔧',
    'done': '✅',
    'invoiced': '💰',
    'cancelled': '❌',
  };
  
  const emoji = statusEmojis[job.status || 'scheduled'] || '📅';
  const clientPart = job.clientName ? ` - ${job.clientName}` : '';
  
  return `${emoji} ${job.title}${clientPart}`;
}

// Build detailed event description with tradie workflow info
function buildEventDescription(job: {
  title: string;
  description?: string | null;
  notes?: string | null;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  address?: string | null;
  status?: string;
}): string {
  const sections: string[] = [];
  
  // Client contact info section
  if (job.clientName || job.clientPhone || job.clientEmail) {
    sections.push('📋 CLIENT DETAILS');
    if (job.clientName) sections.push(`   Name: ${job.clientName}`);
    if (job.clientPhone) sections.push(`   Phone: ${job.clientPhone}`);
    if (job.clientEmail) sections.push(`   Email: ${job.clientEmail}`);
    sections.push('');
  }
  
  // Address for navigation
  if (job.address) {
    sections.push('📍 ADDRESS');
    sections.push(`   ${job.address}`);
    sections.push(`   → Open in Maps: https://maps.google.com/?q=${encodeURIComponent(job.address)}`);
    sections.push('');
  }
  
  // Job details
  sections.push('🔧 JOB DETAILS');
  sections.push(`   Title: ${job.title}`);
  if (job.status) sections.push(`   Status: ${job.status.toUpperCase()}`);
  if (job.description) sections.push(`   Description: ${job.description}`);
  sections.push('');
  
  // Notes
  if (job.notes) {
    sections.push('📝 NOTES');
    sections.push(`   ${job.notes}`);
    sections.push('');
  }
  
  // Footer
  sections.push('─────────────────');
  sections.push('Synced from TradieTrack');
  
  return sections.join('\n');
}

// Create or update a calendar event for a job (user-specific)
export async function syncJobToCalendar(
  userId: string,
  job: {
    id: string;
    title: string;
    description?: string | null;
    notes?: string | null;
    address?: string | null;
    scheduledAt: Date;
    estimatedDuration?: number;
    clientName?: string;
    clientPhone?: string;
    clientEmail?: string;
    status?: string;
    calendarEventId?: string | null;
  }
): Promise<{ eventId: string; eventLink: string }> {
  const calendar = await getCalendarClient(userId);
  
  const startTime = new Date(job.scheduledAt);
  const endTime = new Date(startTime.getTime() + (job.estimatedDuration || 2) * 60 * 60 * 1000);
  
  const eventData: calendar_v3.Schema$Event = {
    summary: buildEventSummary(job),
    description: buildEventDescription(job),
    location: job.address || undefined,
    start: {
      dateTime: startTime.toISOString(),
      timeZone: 'Australia/Sydney'
    },
    end: {
      dateTime: endTime.toISOString(),
      timeZone: 'Australia/Sydney'
    },
    colorId: STATUS_COLORS[job.status || 'scheduled'] || '1',
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 60 },
        { method: 'popup', minutes: 15 },
      ],
    },
    extendedProperties: {
      private: {
        tradietrackJobId: job.id,
        source: 'tradietrack',
      }
    }
  };

  let event: calendar_v3.Schema$Event;
  
  // Try to update existing event, or create new one
  if (job.calendarEventId) {
    try {
      const response = await calendar.events.update({
        calendarId: 'primary',
        eventId: job.calendarEventId,
        requestBody: eventData,
      });
      event = response.data;
      console.log(`[GoogleCalendar] Updated event ${job.calendarEventId} for job ${job.id}`);
    } catch (updateError: any) {
      if (updateError.code === 404) {
        const response = await calendar.events.insert({
          calendarId: 'primary',
          requestBody: eventData,
        });
        event = response.data;
        console.log(`[GoogleCalendar] Created new event (old not found) for job ${job.id}`);
      } else {
        throw updateError;
      }
    }
  } else {
    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: eventData,
    });
    event = response.data;
    console.log(`[GoogleCalendar] Created event ${event.id} for job ${job.id}`);
  }

  return {
    eventId: event.id!,
    eventLink: event.htmlLink!,
  };
}

// Delete a calendar event
export async function deleteCalendarEvent(userId: string, eventId: string): Promise<void> {
  try {
    const calendar = await getCalendarClient(userId);
    await calendar.events.delete({
      calendarId: 'primary',
      eventId: eventId,
    });
    console.log(`[GoogleCalendar] Deleted event ${eventId}`);
  } catch (error: any) {
    if (error.code !== 404) {
      console.error('[GoogleCalendar] Failed to delete event:', error);
      throw error;
    }
  }
}

// Get upcoming calendar events
export async function getUpcomingEvents(userId: string, maxResults: number = 10): Promise<calendar_v3.Schema$Event[]> {
  const calendar = await getCalendarClient(userId);
  
  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin: new Date().toISOString(),
    maxResults,
    singleEvents: true,
    orderBy: 'startTime',
  });
  
  return response.data.items || [];
}
