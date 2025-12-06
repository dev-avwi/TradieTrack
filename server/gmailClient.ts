// Gmail Client using Replit's managed connector
// This provides access to Gmail API for sending emails on behalf of tradies

import { google } from 'googleapis';

let connectionSettings: any;

async function getAccessToken(): Promise<string> {
  if (connectionSettings && connectionSettings.settings?.expires_at && 
      new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!hostname) {
    throw new Error('REPLIT_CONNECTORS_HOSTNAME not set');
  }

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  const url = 'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-mail';
  console.log('[Gmail] Checking connection at:', url.replace(/token=[^&]+/, 'token=***'));
  
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'X_REPLIT_TOKEN': xReplitToken
    }
  });
  
  const data = await response.json();
  console.log('[Gmail] Connection response:', JSON.stringify({ 
    hasItems: !!data.items, 
    itemCount: data.items?.length || 0,
    firstItemName: data.items?.[0]?.name || 'none'
  }));
  
  connectionSettings = data.items?.[0];

  const accessToken = connectionSettings?.settings?.access_token || 
                      connectionSettings?.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Gmail not connected - no access token found');
  }
  return accessToken;
}

// Get Gmail client - WARNING: Never cache this, tokens expire
export async function getGmailClient() {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

// Check if Gmail is connected via Replit connector
export async function isGmailConnected(): Promise<boolean> {
  try {
    await getAccessToken();
    console.log('[Gmail] Connection check: Connected');
    return true;
  } catch (error: any) {
    console.log('[Gmail] Connection check: Not connected -', error?.message || 'Unknown error');
    return false;
  }
}

// Get the email address from the Gmail profile
export async function getGmailProfile(): Promise<{ email: string; displayName: string } | null> {
  try {
    const gmail = await getGmailClient();
    const profile = await gmail.users.getProfile({ userId: 'me' });
    
    return {
      email: profile.data.emailAddress || '',
      displayName: profile.data.emailAddress?.split('@')[0] || 'Gmail User'
    };
  } catch (error: any) {
    // Don't spam logs for expected scope limitation - connector may have send-only permissions
    if (error?.code === 403 || error?.status === 403) {
      console.log('[Gmail] Profile access not permitted (send-only connector scope is normal)');
    } else {
      console.error('[Gmail] Profile fetch failed:', error?.message || error);
    }
    return null;
  }
}

// Create a raw email message with attachments for Gmail API
function createRawMessage(options: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  fromEmail: string;
  fromName?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}): string {
  const boundary = `boundary_${Date.now()}`;
  const { to, subject, html, text, fromEmail, fromName, attachments } = options;

  const fromHeader = fromName ? `"${fromName}" <${fromEmail}>` : fromEmail;

  let message = [
    `From: ${fromHeader}`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
    'MIME-Version: 1.0',
  ];

  if (attachments && attachments.length > 0) {
    message.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
    message.push('');
    message.push(`--${boundary}`);
    message.push('Content-Type: multipart/alternative; boundary="alt_boundary"');
    message.push('');

    if (text) {
      message.push('--alt_boundary');
      message.push('Content-Type: text/plain; charset="UTF-8"');
      message.push('');
      message.push(text);
    }

    message.push('--alt_boundary');
    message.push('Content-Type: text/html; charset="UTF-8"');
    message.push('');
    message.push(html);
    message.push('--alt_boundary--');

    for (const attachment of attachments) {
      const content = Buffer.isBuffer(attachment.content) 
        ? attachment.content.toString('base64')
        : Buffer.from(attachment.content).toString('base64');
      
      message.push(`--${boundary}`);
      message.push(`Content-Type: ${attachment.contentType || 'application/octet-stream'}`);
      message.push('Content-Transfer-Encoding: base64');
      message.push(`Content-Disposition: attachment; filename="${attachment.filename}"`);
      message.push('');
      message.push(content);
    }

    message.push(`--${boundary}--`);
  } else {
    message.push('Content-Type: multipart/alternative; boundary="alt_boundary"');
    message.push('');

    if (text) {
      message.push('--alt_boundary');
      message.push('Content-Type: text/plain; charset="UTF-8"');
      message.push('');
      message.push(text);
    }

    message.push('--alt_boundary');
    message.push('Content-Type: text/html; charset="UTF-8"');
    message.push('');
    message.push(html);
    message.push('--alt_boundary--');
  }

  const rawMessage = message.join('\r\n');
  return Buffer.from(rawMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Send email via Gmail API
export async function sendViaGmailAPI(options: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  fromName?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const gmail = await getGmailClient();
    
    // Get the authenticated user's email
    const profile = await gmail.users.getProfile({ userId: 'me' });
    const fromEmail = profile.data.emailAddress;
    
    if (!fromEmail) {
      throw new Error('Could not get Gmail email address');
    }

    const raw = createRawMessage({
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      fromEmail,
      fromName: options.fromName,
      attachments: options.attachments,
    });

    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw
      }
    });

    console.log(`✅ Email sent via Gmail to ${options.to}, messageId: ${result.data.id}`);
    
    return {
      success: true,
      messageId: result.data.id || undefined
    };
  } catch (error: any) {
    console.error('Gmail send error:', error);
    return {
      success: false,
      error: error.message || 'Failed to send via Gmail'
    };
  }
}

// Create a Gmail draft with PDF attachment - tradie can review and send
export async function createGmailDraftWithAttachment(options: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  fromName?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}): Promise<{ success: boolean; draftId?: string; draftUrl?: string; error?: string }> {
  try {
    const gmail = await getGmailClient();
    
    // Get the authenticated user's email
    const profile = await gmail.users.getProfile({ userId: 'me' });
    const fromEmail = profile.data.emailAddress;
    
    if (!fromEmail) {
      throw new Error('Could not get Gmail email address');
    }

    const raw = createRawMessage({
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      fromEmail,
      fromName: options.fromName,
      attachments: options.attachments,
    });

    // Create draft instead of sending
    const result = await gmail.users.drafts.create({
      userId: 'me',
      requestBody: {
        message: {
          raw
        }
      }
    });

    const draftId = result.data.id;
    // Gmail draft URL format to open compose window with the draft
    const draftUrl = draftId 
      ? `https://mail.google.com/mail/u/0/?compose=${draftId}`
      : null;

    console.log(`✅ Gmail draft created with attachment, draftId: ${draftId}`);
    
    return {
      success: true,
      draftId: draftId || undefined,
      draftUrl: draftUrl || undefined
    };
  } catch (error: any) {
    console.error('Gmail draft creation error:', error);
    return {
      success: false,
      error: error.message || 'Failed to create Gmail draft'
    };
  }
}
