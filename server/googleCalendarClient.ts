// Google Calendar Client for TradieTrack
// Manages OAuth2 flow and calendar operations for syncing jobs to Google Calendar

import { google, calendar_v3 } from 'googleapis';
import { db } from './storage';
import { integrationSettings } from '@shared/schema';
import { eq } from 'drizzle-orm';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events'
];

// Get OAuth2 client with credentials from environment
function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error('Google Calendar credentials not configured. Set GOOGLE_CALENDAR_CLIENT_ID and GOOGLE_CALENDAR_CLIENT_SECRET.');
  }

  const redirectUri = `${process.env.REPL_URL || 'http://localhost:5000'}/api/integrations/google-calendar/callback`;
  
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

// Generate OAuth authorization URL
export function getAuthUrl(state?: string): string {
  const oauth2Client = getOAuth2Client();
  
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    state: state || ''
  });
}

// Exchange authorization code for tokens
export async function exchangeCodeForTokens(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiryDate: number;
}> {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  
  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error('Failed to get tokens from Google');
  }
  
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiryDate: tokens.expiry_date || Date.now() + 3600 * 1000
  };
}

// Get calendar client for a user
export async function getCalendarClient(userId: string): Promise<calendar_v3.Calendar> {
  const settings = await db
    .select()
    .from(integrationSettings)
    .where(eq(integrationSettings.userId, userId))
    .limit(1);
  
  const userSettings = settings[0];
  
  if (!userSettings?.googleCalendarAccessToken || !userSettings?.googleCalendarRefreshToken) {
    throw new Error('Google Calendar not connected');
  }

  const oauth2Client = getOAuth2Client();
  
  oauth2Client.setCredentials({
    access_token: userSettings.googleCalendarAccessToken,
    refresh_token: userSettings.googleCalendarRefreshToken,
    expiry_date: userSettings.googleCalendarTokenExpiry ? new Date(userSettings.googleCalendarTokenExpiry).getTime() : undefined
  });

  // Handle token refresh
  oauth2Client.on('tokens', async (tokens) => {
    console.log('[GoogleCalendar] Refreshing tokens for user:', userId);
    try {
      await db
        .update(integrationSettings)
        .set({
          googleCalendarAccessToken: tokens.access_token || userSettings.googleCalendarAccessToken,
          googleCalendarTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
          updatedAt: new Date()
        })
        .where(eq(integrationSettings.userId, userId));
    } catch (error) {
      console.error('[GoogleCalendar] Failed to update tokens:', error);
    }
  });

  return google.calendar({ version: 'v3', auth: oauth2Client });
}

// Check if Google Calendar is connected for a user
export async function isGoogleCalendarConnected(userId: string): Promise<boolean> {
  try {
    const settings = await db
      .select()
      .from(integrationSettings)
      .where(eq(integrationSettings.userId, userId))
      .limit(1);
    
    const userSettings = settings[0];
    return !!(userSettings?.googleCalendarConnected && userSettings?.googleCalendarRefreshToken);
  } catch (error) {
    console.error('[GoogleCalendar] Connection check failed:', error);
    return false;
  }
}

// Get connected calendar info
export async function getCalendarInfo(userId: string): Promise<{
  connected: boolean;
  email?: string;
  calendarId?: string;
} | null> {
  try {
    const calendar = await getCalendarClient(userId);
    const calendarList = await calendar.calendarList.list();
    
    const primaryCalendar = calendarList.data.items?.find(cal => cal.primary);
    
    return {
      connected: true,
      email: primaryCalendar?.id || undefined,
      calendarId: primaryCalendar?.id || 'primary'
    };
  } catch (error) {
    console.error('[GoogleCalendar] Failed to get calendar info:', error);
    return null;
  }
}

// Create or update a calendar event for a job
export async function syncJobToCalendar(userId: string, job: {
  id: string;
  title: string;
  description?: string | null;
  address?: string | null;
  scheduledAt: Date;
  estimatedDuration?: number; // in hours
  clientName?: string;
  calendarEventId?: string | null;
}): Promise<{ eventId: string; eventLink: string }> {
  const calendar = await getCalendarClient(userId);
  
  const startTime = new Date(job.scheduledAt);
  const endTime = new Date(startTime.getTime() + (job.estimatedDuration || 2) * 60 * 60 * 1000);
  
  const eventData: calendar_v3.Schema$Event = {
    summary: job.title || 'TradieTrack Job',
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
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 60 },
        { method: 'popup', minutes: 15 }
      ]
    }
  };

  let response;
  
  if (job.calendarEventId) {
    // Update existing event
    try {
      response = await calendar.events.update({
        calendarId: 'primary',
        eventId: job.calendarEventId,
        requestBody: eventData
      });
      console.log('[GoogleCalendar] Updated event:', response.data.id);
    } catch (error: any) {
      // If event doesn't exist anymore, create a new one
      if (error.code === 404) {
        response = await calendar.events.insert({
          calendarId: 'primary',
          requestBody: eventData
        });
        console.log('[GoogleCalendar] Created new event (old one missing):', response.data.id);
      } else {
        throw error;
      }
    }
  } else {
    // Create new event
    response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: eventData
    });
    console.log('[GoogleCalendar] Created event:', response.data.id);
  }

  return {
    eventId: response.data.id || '',
    eventLink: response.data.htmlLink || ''
  };
}

// Delete a calendar event
export async function deleteCalendarEvent(userId: string, eventId: string): Promise<void> {
  try {
    const calendar = await getCalendarClient(userId);
    await calendar.events.delete({
      calendarId: 'primary',
      eventId: eventId
    });
    console.log('[GoogleCalendar] Deleted event:', eventId);
  } catch (error: any) {
    if (error.code !== 404) {
      throw error;
    }
    // Event already deleted, that's fine
  }
}

// List upcoming events
export async function listUpcomingEvents(userId: string, maxResults: number = 10): Promise<calendar_v3.Schema$Event[]> {
  const calendar = await getCalendarClient(userId);
  
  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin: new Date().toISOString(),
    maxResults: maxResults,
    singleEvents: true,
    orderBy: 'startTime'
  });

  return response.data.items || [];
}

// Store tokens for a user
export async function storeTokens(userId: string, tokens: {
  accessToken: string;
  refreshToken: string;
  expiryDate: number;
}): Promise<void> {
  const existingSettings = await db
    .select()
    .from(integrationSettings)
    .where(eq(integrationSettings.userId, userId))
    .limit(1);

  if (existingSettings.length > 0) {
    await db
      .update(integrationSettings)
      .set({
        googleCalendarConnected: true,
        googleCalendarAccessToken: tokens.accessToken,
        googleCalendarRefreshToken: tokens.refreshToken,
        googleCalendarTokenExpiry: new Date(tokens.expiryDate),
        updatedAt: new Date()
      })
      .where(eq(integrationSettings.userId, userId));
  } else {
    await db
      .insert(integrationSettings)
      .values({
        userId: userId,
        googleCalendarConnected: true,
        googleCalendarAccessToken: tokens.accessToken,
        googleCalendarRefreshToken: tokens.refreshToken,
        googleCalendarTokenExpiry: new Date(tokens.expiryDate)
      });
  }
}

// Disconnect Google Calendar
export async function disconnectGoogleCalendar(userId: string): Promise<void> {
  await db
    .update(integrationSettings)
    .set({
      googleCalendarConnected: false,
      googleCalendarAccessToken: null,
      googleCalendarRefreshToken: null,
      googleCalendarTokenExpiry: null,
      updatedAt: new Date()
    })
    .where(eq(integrationSettings.userId, userId));
  
  console.log('[GoogleCalendar] Disconnected for user:', userId);
}

// Helper function to build event description
function buildEventDescription(job: {
  description?: string | null;
  clientName?: string;
  id: string;
}): string {
  const parts: string[] = [];
  
  if (job.clientName) {
    parts.push(`Client: ${job.clientName}`);
  }
  
  if (job.description) {
    parts.push(`\nDetails:\n${job.description}`);
  }
  
  parts.push(`\n---\nManaged by TradieTrack\nJob ID: ${job.id}`);
  
  return parts.join('\n');
}
