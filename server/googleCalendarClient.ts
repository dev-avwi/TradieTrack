// Google Calendar Client for TradieTrack
// Uses Replit Connector integration for secure OAuth management
// Manages calendar operations for syncing jobs to Google Calendar

import { google, calendar_v3 } from 'googleapis';

// Cache for connection settings to avoid repeated API calls
let connectionSettingsCache: any = null;

// Get access token from Replit Connector (handles refresh automatically)
async function getAccessToken(): Promise<string> {
  // Check if cached token is still valid
  if (connectionSettingsCache?.settings?.expires_at && 
      new Date(connectionSettingsCache.settings.expires_at).getTime() > Date.now()) {
    return connectionSettingsCache.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken || !hostname) {
    throw new Error('Replit connector environment not available');
  }

  const response = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-calendar',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  );
  
  const data = await response.json();
  connectionSettingsCache = data.items?.[0];

  const accessToken = connectionSettingsCache?.settings?.access_token || 
                      connectionSettingsCache?.settings?.oauth?.credentials?.access_token;

  if (!connectionSettingsCache || !accessToken) {
    throw new Error('Google Calendar not connected via Replit connector');
  }
  
  return accessToken;
}

// Check if Google Calendar is connected via Replit connector
export async function isGoogleCalendarConnected(): Promise<boolean> {
  try {
    await getAccessToken();
    return true;
  } catch (error) {
    return false;
  }
}

// Get calendar client using Replit connector (platform-level auth)
// WARNING: Never cache this client - access tokens expire
export async function getCalendarClient(): Promise<calendar_v3.Calendar> {
  const accessToken = await getAccessToken();
  
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.calendar({ version: 'v3', auth: oauth2Client });
}

// Get connected calendar info
export async function getCalendarInfo(): Promise<{
  connected: boolean;
  email?: string;
  calendarId?: string;
} | null> {
  try {
    const calendar = await getCalendarClient();
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
export async function syncJobToCalendar(job: {
  id: string;
  title: string;
  description?: string | null;
  notes?: string | null;
  address?: string | null;
  scheduledAt: Date;
  estimatedDuration?: number; // in hours
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  status?: string;
  calendarEventId?: string | null;
}): Promise<{ eventId: string; eventLink: string }> {
  const calendar = await getCalendarClient();
  
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
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 60 },
        { method: 'popup', minutes: 15 }
      ]
    },
    colorId: getEventColorByStatus(job.status)
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
export async function deleteCalendarEvent(eventId: string): Promise<void> {
  try {
    const calendar = await getCalendarClient();
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
export async function listUpcomingEvents(maxResults: number = 10): Promise<calendar_v3.Schema$Event[]> {
  const calendar = await getCalendarClient();
  
  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin: new Date().toISOString(),
    maxResults: maxResults,
    singleEvents: true,
    orderBy: 'startTime'
  });

  return response.data.items || [];
}

// Helper function to build event summary (calendar title)
function buildEventSummary(job: {
  title: string;
  clientName?: string;
}): string {
  if (job.clientName) {
    return `${job.title} - ${job.clientName}`;
  }
  return job.title || 'TradieTrack Job';
}

// Helper function to build comprehensive event description for tradie workflows
function buildEventDescription(job: {
  description?: string | null;
  notes?: string | null;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  address?: string | null;
  status?: string;
  id: string;
}): string {
  const parts: string[] = [];
  
  // Client contact section
  if (job.clientName || job.clientPhone || job.clientEmail) {
    parts.push('📋 CLIENT DETAILS');
    if (job.clientName) parts.push(`Name: ${job.clientName}`);
    if (job.clientPhone) parts.push(`Phone: ${job.clientPhone}`);
    if (job.clientEmail) parts.push(`Email: ${job.clientEmail}`);
    parts.push('');
  }
  
  // Address for navigation
  if (job.address) {
    parts.push('📍 ADDRESS');
    parts.push(job.address);
    parts.push('');
  }
  
  // Job status
  if (job.status) {
    const statusEmoji = getStatusEmoji(job.status);
    parts.push(`${statusEmoji} Status: ${job.status.toUpperCase()}`);
    parts.push('');
  }
  
  // Job description/scope of work
  if (job.description) {
    parts.push('🔧 JOB DETAILS');
    parts.push(job.description);
    parts.push('');
  }
  
  // Notes (important for tradies)
  if (job.notes) {
    parts.push('📝 NOTES');
    parts.push(job.notes);
    parts.push('');
  }
  
  // Footer
  parts.push('---');
  parts.push('Managed by TradieTrack');
  parts.push(`Job ID: ${job.id}`);
  
  return parts.join('\n');
}

// Get status emoji for visual identification
function getStatusEmoji(status: string): string {
  const statusMap: Record<string, string> = {
    'pending': '⏳',
    'scheduled': '📅',
    'in_progress': '🔨',
    'done': '✅',
    'invoiced': '💰',
    'cancelled': '❌'
  };
  return statusMap[status?.toLowerCase()] || '📋';
}

// Get Google Calendar color ID by job status
function getEventColorByStatus(status?: string): string {
  // Google Calendar color IDs:
  // 1 = Lavender, 2 = Sage, 3 = Grape, 4 = Flamingo, 5 = Banana
  // 6 = Tangerine, 7 = Peacock, 8 = Graphite, 9 = Blueberry, 10 = Basil, 11 = Tomato
  const colorMap: Record<string, string> = {
    'pending': '5',      // Banana (yellow) - needs attention
    'scheduled': '9',    // Blueberry (blue) - scheduled
    'in_progress': '6',  // Tangerine (orange) - active work
    'done': '10',        // Basil (green) - completed
    'invoiced': '2',     // Sage (light green) - billed
    'cancelled': '8'     // Graphite (grey) - cancelled
  };
  return colorMap[status?.toLowerCase() || ''] || '7'; // Default to Peacock (teal)
}
