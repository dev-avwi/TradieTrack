import { google, calendar_v3 } from 'googleapis';
import { randomBytes } from 'crypto';
import { storage } from './storage';
import { Job, CalendarSyncEvent, InsertCalendarSyncEvent } from '@shared/schema';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REPLIT_DOMAIN = process.env.REPLIT_DOMAINS?.split(',')[0];
const BASE_URL = REPLIT_DOMAIN ? `https://${REPLIT_DOMAIN}` : 'http://localhost:5000';

const oauthStateMap = new Map<string, { userId: string; expires: number }>();
const STATE_EXPIRY_MS = 10 * 60 * 1000;

function generateSecureState(userId: string): string {
  const stateToken = randomBytes(32).toString('hex');
  oauthStateMap.set(stateToken, { 
    userId, 
    expires: Date.now() + STATE_EXPIRY_MS 
  });
  
  for (const [key, value] of oauthStateMap.entries()) {
    if (value.expires < Date.now()) {
      oauthStateMap.delete(key);
    }
  }
  
  return stateToken;
}

export function verifyOAuthState(stateToken: string): string | null {
  const stateData = oauthStateMap.get(stateToken);
  if (!stateData) {
    return null;
  }
  
  if (stateData.expires < Date.now()) {
    oauthStateMap.delete(stateToken);
    return null;
  }
  
  oauthStateMap.delete(stateToken);
  return stateData.userId;
}

export interface CalendarEvent {
  id?: string;
  title: string;
  description?: string;
  location?: string;
  startTime: Date;
  endTime: Date;
  allDay?: boolean;
}

export interface CalendarSyncStatus {
  provider: 'google' | 'outlook';
  connected: boolean;
  calendarId?: string;
  calendarName?: string;
  lastSyncAt?: Date;
  syncDirection: 'to_calendar' | 'from_calendar' | 'both';
  email?: string;
}

export interface SyncResult {
  success: boolean;
  created: number;
  updated: number;
  deleted: number;
  errors: string[];
}

function getOAuth2Client() {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error('Google Calendar credentials not configured');
  }

  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    `${BASE_URL}/api/calendar/google/callback`
  );
}

export async function getGoogleCalendarAuthUrl(userId: string): Promise<string> {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error('Google Calendar credentials not configured. Please contact support.');
  }
  
  const oauth2Client = getOAuth2Client();
  const secureState = generateSecureState(userId);
  
  const scopes = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/userinfo.email'
  ];

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
    state: secureState
  });
}

export async function handleGoogleCalendarCallback(
  code: string, 
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    
    if (!tokens.access_token) {
      return { success: false, error: 'No access token received' };
    }

    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const email = userInfo.data.email;

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const calendarList = await calendar.calendarList.list();
    const primaryCalendar = calendarList.data.items?.find(cal => cal.primary) || calendarList.data.items?.[0];
    
    await storage.updateIntegrationSettings(userId, {
      googleCalendarSyncEnabled: true,
      googleCalendarId: primaryCalendar?.id || 'primary',
      googleCalendarAccessToken: tokens.access_token,
      googleCalendarRefreshToken: tokens.refresh_token || undefined,
      googleCalendarTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
      googleCalendarSyncDirection: 'both',
    });

    console.log(`[Calendar] Google Calendar connected for user ${userId}, email: ${email}`);
    return { success: true };
  } catch (error: any) {
    console.error('[Calendar] Google auth callback error:', error);
    return { success: false, error: error.message };
  }
}

async function getGoogleCalendarClient(userId: string): Promise<calendar_v3.Calendar | null> {
  try {
    const settings = await storage.getIntegrationSettings(userId);
    if (!settings?.googleCalendarAccessToken) {
      return null;
    }

    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({
      access_token: settings.googleCalendarAccessToken,
      refresh_token: settings.googleCalendarRefreshToken || undefined,
      expiry_date: settings.googleCalendarTokenExpiry?.getTime()
    });

    if (settings.googleCalendarTokenExpiry && new Date(settings.googleCalendarTokenExpiry) < new Date()) {
      if (settings.googleCalendarRefreshToken) {
        const { credentials } = await oauth2Client.refreshAccessToken();
        await storage.updateIntegrationSettings(userId, {
          googleCalendarAccessToken: credentials.access_token || undefined,
          googleCalendarTokenExpiry: credentials.expiry_date ? new Date(credentials.expiry_date) : undefined,
        });
        oauth2Client.setCredentials(credentials);
      } else {
        console.log('[Calendar] Token expired and no refresh token available');
        return null;
      }
    }

    return google.calendar({ version: 'v3', auth: oauth2Client });
  } catch (error) {
    console.error('[Calendar] Error getting calendar client:', error);
    return null;
  }
}

export async function getGoogleCalendarStatus(userId: string): Promise<CalendarSyncStatus> {
  const settings = await storage.getIntegrationSettings(userId);
  
  if (!settings?.googleCalendarSyncEnabled || !settings.googleCalendarAccessToken) {
    return {
      provider: 'google',
      connected: false,
      syncDirection: 'both'
    };
  }

  try {
    const calendar = await getGoogleCalendarClient(userId);
    if (!calendar) {
      return { provider: 'google', connected: false, syncDirection: 'both' };
    }

    const calendarInfo = await calendar.calendars.get({ 
      calendarId: settings.googleCalendarId || 'primary' 
    });

    return {
      provider: 'google',
      connected: true,
      calendarId: settings.googleCalendarId || undefined,
      calendarName: calendarInfo.data.summary || 'Primary Calendar',
      lastSyncAt: settings.googleCalendarLastSyncAt || undefined,
      syncDirection: (settings.googleCalendarSyncDirection as 'to_calendar' | 'from_calendar' | 'both') || 'both',
    };
  } catch (error) {
    console.error('[Calendar] Error getting status:', error);
    return { provider: 'google', connected: false, syncDirection: 'both' };
  }
}

export async function getGoogleCalendarList(userId: string): Promise<Array<{ id: string; name: string; primary: boolean }>> {
  const calendar = await getGoogleCalendarClient(userId);
  if (!calendar) return [];

  try {
    const list = await calendar.calendarList.list();
    return (list.data.items || []).map(cal => ({
      id: cal.id || '',
      name: cal.summary || 'Unknown',
      primary: cal.primary || false
    }));
  } catch (error) {
    console.error('[Calendar] Error listing calendars:', error);
    return [];
  }
}

function jobToCalendarEvent(job: Job, client?: { name: string; address?: string | null }): CalendarEvent {
  const startTime = job.scheduledAt ? new Date(job.scheduledAt) : new Date();
  const durationHours = parseFloat(job.estimatedHours?.toString() || '2');
  const endTime = new Date(startTime.getTime() + durationHours * 60 * 60 * 1000);

  let description = job.description || '';
  if (client) {
    description = `Client: ${client.name}\n${description}`;
  }
  if (job.priority) {
    description += `\nPriority: ${job.priority}`;
  }

  return {
    title: job.title,
    description,
    location: job.address || client?.address || undefined,
    startTime,
    endTime,
    allDay: false
  };
}

export async function syncJobToGoogleCalendar(
  userId: string, 
  job: Job,
  client?: { name: string; address?: string | null }
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  const calendar = await getGoogleCalendarClient(userId);
  if (!calendar) {
    return { success: false, error: 'Google Calendar not connected' };
  }

  const settings = await storage.getIntegrationSettings(userId);
  const calendarId = settings?.googleCalendarId || 'primary';
  const event = jobToCalendarEvent(job, client);

  try {
    const existingSync = await storage.getCalendarSyncEventByJobId(job.id, 'google');

    if (existingSync) {
      const result = await calendar.events.update({
        calendarId,
        eventId: existingSync.externalEventId,
        requestBody: {
          summary: event.title,
          description: event.description,
          location: event.location,
          start: {
            dateTime: event.startTime.toISOString(),
            timeZone: 'Australia/Sydney'
          },
          end: {
            dateTime: event.endTime.toISOString(),
            timeZone: 'Australia/Sydney'
          }
        }
      });

      await storage.updateCalendarSyncEvent(existingSync.id, {
        syncStatus: 'synced',
        eventData: { title: event.title, start: event.startTime, end: event.endTime }
      });

      return { success: true, eventId: result.data.id || undefined };
    } else {
      const result = await calendar.events.insert({
        calendarId,
        requestBody: {
          summary: event.title,
          description: event.description,
          location: event.location,
          start: {
            dateTime: event.startTime.toISOString(),
            timeZone: 'Australia/Sydney'
          },
          end: {
            dateTime: event.endTime.toISOString(),
            timeZone: 'Australia/Sydney'
          },
          reminders: {
            useDefault: true
          }
        }
      });

      await storage.createCalendarSyncEvent({
        userId,
        jobId: job.id,
        calendarProvider: 'google',
        externalEventId: result.data.id!,
        externalCalendarId: calendarId,
        syncStatus: 'synced',
        eventData: { title: event.title, start: event.startTime, end: event.endTime }
      });

      return { success: true, eventId: result.data.id || undefined };
    }
  } catch (error: any) {
    console.error('[Calendar] Error syncing job to Google Calendar:', error);
    return { success: false, error: error.message };
  }
}

export async function syncAllJobsToGoogleCalendar(userId: string): Promise<SyncResult> {
  const result: SyncResult = { success: true, created: 0, updated: 0, deleted: 0, errors: [] };

  const jobs = await storage.getJobs(userId);
  const scheduledJobs = jobs.filter(job => 
    job.scheduledAt && 
    job.status !== 'done' && 
    job.status !== 'invoiced'
  );

  for (const job of scheduledJobs) {
    let client = undefined;
    if (job.clientId) {
      client = await storage.getClient(job.clientId, userId) || undefined;
    }

    const syncResult = await syncJobToGoogleCalendar(userId, job, client);
    if (syncResult.success) {
      const existing = await storage.getCalendarSyncEventByJobId(job.id, 'google');
      if (existing) {
        result.updated++;
      } else {
        result.created++;
      }
    } else {
      result.errors.push(`Job "${job.title}": ${syncResult.error}`);
    }
  }

  await storage.updateIntegrationSettings(userId, {
    googleCalendarLastSyncAt: new Date()
  });

  result.success = result.errors.length === 0;
  return result;
}

export async function importEventsFromGoogleCalendar(
  userId: string,
  timeMin?: Date,
  timeMax?: Date
): Promise<Array<CalendarEvent & { eventId: string }>> {
  const calendar = await getGoogleCalendarClient(userId);
  if (!calendar) return [];

  const settings = await storage.getIntegrationSettings(userId);
  const calendarId = settings?.googleCalendarId || 'primary';

  try {
    const now = new Date();
    const defaultTimeMin = timeMin || now;
    const defaultTimeMax = timeMax || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const result = await calendar.events.list({
      calendarId,
      timeMin: defaultTimeMin.toISOString(),
      timeMax: defaultTimeMax.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 100
    });

    return (result.data.items || []).map(event => ({
      eventId: event.id || '',
      title: event.summary || 'Untitled',
      description: event.description || undefined,
      location: event.location || undefined,
      startTime: new Date(event.start?.dateTime || event.start?.date || ''),
      endTime: new Date(event.end?.dateTime || event.end?.date || ''),
      allDay: !!event.start?.date
    }));
  } catch (error) {
    console.error('[Calendar] Error importing events:', error);
    return [];
  }
}

export async function deleteJobFromGoogleCalendar(
  userId: string,
  jobId: string
): Promise<{ success: boolean; error?: string }> {
  const calendar = await getGoogleCalendarClient(userId);
  if (!calendar) {
    return { success: false, error: 'Google Calendar not connected' };
  }

  try {
    const syncEvent = await storage.getCalendarSyncEventByJobId(jobId, 'google');
    if (!syncEvent) {
      return { success: true };
    }

    await calendar.events.delete({
      calendarId: syncEvent.externalCalendarId,
      eventId: syncEvent.externalEventId
    });

    await storage.deleteCalendarSyncEvent(syncEvent.id);
    return { success: true };
  } catch (error: any) {
    console.error('[Calendar] Error deleting event:', error);
    return { success: false, error: error.message };
  }
}

export async function disconnectGoogleCalendar(userId: string): Promise<void> {
  await storage.updateIntegrationSettings(userId, {
    googleCalendarSyncEnabled: false,
    googleCalendarId: null as any,
    googleCalendarAccessToken: null as any,
    googleCalendarRefreshToken: null as any,
    googleCalendarTokenExpiry: null as any,
    googleCalendarLastSyncAt: null as any
  });

  console.log(`[Calendar] Google Calendar disconnected for user ${userId}`);
}

export async function updateCalendarSyncSettings(
  userId: string,
  settings: {
    calendarId?: string;
    syncDirection?: 'to_calendar' | 'from_calendar' | 'both';
  }
): Promise<void> {
  const updates: any = {};
  if (settings.calendarId) {
    updates.googleCalendarId = settings.calendarId;
  }
  if (settings.syncDirection) {
    updates.googleCalendarSyncDirection = settings.syncDirection;
  }
  await storage.updateIntegrationSettings(userId, updates);
}
