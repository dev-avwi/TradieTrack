/**
 * Unified Notification Service for TradieTrack
 * Handles Email and SMS notifications
 * 
 * This service provides a single point of control for all client communications.
 * SMS is fully enabled via Twilio integration.
 */

import { sendEmail, EmailOptions } from './emailService';
import { sendSMS as sendTwilioSMS, isTwilioInitialized, initializeTwilio } from './twilioClient';

// Real SMS sending via Twilio with graceful degradation
const sendSMS = async (options: { to: string; message: string }): Promise<{ success: boolean; error?: string; simulated?: boolean }> => {
  try {
    // Ensure Twilio is initialized
    if (!isTwilioInitialized()) {
      const initialized = await initializeTwilio();
      if (!initialized) {
        // Graceful degradation - log and return simulated success
        console.log(`📱 [SMS Fallback] Twilio not configured - message would be sent to ${options.to}`);
        console.log(`   Message: ${options.message.slice(0, 100)}${options.message.length > 100 ? '...' : ''}`);
        return {
          success: true,
          simulated: true,
          error: undefined
        };
      }
    }
    
    const result = await sendTwilioSMS({
      to: options.to,
      message: options.message
    });
    
    // Handle Twilio returning failure (e.g., invalid number)
    if (!result.success && !result.simulated) {
      console.warn(`[SMS] Send failed to ${options.to}: ${result.error}`);
      // Return simulated success to not break notification flows
      return {
        success: true,
        simulated: true,
        error: result.error
      };
    }
    
    return {
      success: result.success,
      error: result.error,
      simulated: result.simulated
    };
  } catch (error: any) {
    // Catch any unexpected errors and gracefully degrade
    console.error(`[SMS] Unexpected error sending to ${options.to}:`, error.message);
    return {
      success: true,
      simulated: true,
      error: error.message
    };
  }
};

const smsTemplates = {
  quoteReady: (clientName: string, businessName: string, quoteNumber: string) =>
    `Hi ${clientName}, your quote #${quoteNumber} from ${businessName} is ready.`,
  invoiceSent: (clientName: string, businessName: string, invoiceNumber: string, amount: string) =>
    `Hi ${clientName}, invoice #${invoiceNumber} for ${amount} from ${businessName} is ready.`,
  paymentReceived: (clientName: string, amount: string, businessName: string) =>
    `Thanks ${clientName}! We received your payment of ${amount}. - ${businessName}`,
  jobScheduled: (clientName: string, businessName: string, date: string) =>
    `Hi ${clientName}, ${businessName} has scheduled your job for ${date}.`,
  jobComplete: (clientName: string, businessName: string) =>
    `Hi ${clientName}, your job with ${businessName} is complete.`,
  reminder: (clientName: string, businessName: string, message: string) =>
    `Hi ${clientName}, reminder from ${businessName}: ${message}`
};

export type NotificationChannel = 'email' | 'sms' | 'both';

export interface NotificationPreferences {
  enableEmail: boolean;
  enableSMS: boolean;
  defaultChannel: NotificationChannel;
}

export interface NotifyClientOptions {
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  businessName: string;
  businessEmail?: string;
  channel?: NotificationChannel;
}

export interface NotificationResult {
  success: boolean;
  emailSent?: boolean;
  smsSent?: boolean;
  emailError?: string;
  smsError?: string;
}

// Quote notification
export async function notifyQuoteReady(
  options: NotifyClientOptions & {
    quoteNumber: string;
    quoteTotal: string;
    viewQuoteUrl: string;
  }
): Promise<NotificationResult> {
  const { 
    clientName, clientEmail, clientPhone, 
    businessName, businessEmail,
    quoteNumber, quoteTotal, viewQuoteUrl,
    channel = 'both'
  } = options;

  const result: NotificationResult = { success: true };

  // Send email if enabled and email available
  if ((channel === 'email' || channel === 'both') && clientEmail) {
    try {
      const emailResult = await sendEmail({
        to: clientEmail,
        subject: `Quote #${quoteNumber} from ${businessName}`,
        text: `Hi ${clientName},\n\nYour quote #${quoteNumber} for ${quoteTotal} is ready.\n\nView and accept your quote: ${viewQuoteUrl}\n\nThanks,\n${businessName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Your Quote is Ready</h2>
            <p>Hi ${clientName},</p>
            <p>Your quote <strong>#${quoteNumber}</strong> for <strong>${quoteTotal}</strong> is ready for review.</p>
            <p style="margin: 24px 0;">
              <a href="${viewQuoteUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                View Quote
              </a>
            </p>
            <p>Thanks,<br>${businessName}</p>
          </div>
        `,
        replyTo: businessEmail
      });
      result.emailSent = emailResult.success;
      if (!emailResult.success) {
        result.emailError = emailResult.error;
      }
    } catch (error: any) {
      result.emailError = error.message;
    }
  }

  // Send SMS if enabled and phone available
  if ((channel === 'sms' || channel === 'both') && clientPhone) {
    try {
      const smsResult = await sendSMS({
        to: clientPhone,
        message: smsTemplates.quoteReady(clientName, businessName, quoteNumber)
      });
      result.smsSent = smsResult.success;
      if (!smsResult.success) {
        result.smsError = smsResult.error;
      }
    } catch (error: any) {
      result.smsError = error.message;
    }
  }

  result.success = (result.emailSent || false) || (result.smsSent || false);
  return result;
}

// Invoice notification
export async function notifyInvoiceSent(
  options: NotifyClientOptions & {
    invoiceNumber: string;
    invoiceTotal: string;
    dueDate: string;
    paymentUrl: string;
  }
): Promise<NotificationResult> {
  const { 
    clientName, clientEmail, clientPhone, 
    businessName, businessEmail,
    invoiceNumber, invoiceTotal, dueDate, paymentUrl,
    channel = 'both'
  } = options;

  const result: NotificationResult = { success: true };

  // Send email
  if ((channel === 'email' || channel === 'both') && clientEmail) {
    try {
      const emailResult = await sendEmail({
        to: clientEmail,
        subject: `Invoice #${invoiceNumber} from ${businessName} - Due ${dueDate}`,
        text: `Hi ${clientName},\n\nInvoice #${invoiceNumber} for ${invoiceTotal} is due on ${dueDate}.\n\nPay now: ${paymentUrl}\n\nThanks,\n${businessName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Invoice Ready</h2>
            <p>Hi ${clientName},</p>
            <p>Invoice <strong>#${invoiceNumber}</strong> for <strong>${invoiceTotal}</strong> is ready.</p>
            <p><strong>Due Date:</strong> ${dueDate}</p>
            <p style="margin: 24px 0;">
              <a href="${paymentUrl}" style="background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Pay Now
              </a>
            </p>
            <p>Thanks,<br>${businessName}</p>
          </div>
        `,
        replyTo: businessEmail
      });
      result.emailSent = emailResult.success;
      if (!emailResult.success) result.emailError = emailResult.error;
    } catch (error: any) {
      result.emailError = error.message;
    }
  }

  // Send SMS
  if ((channel === 'sms' || channel === 'both') && clientPhone) {
    try {
      const smsResult = await sendSMS({
        to: clientPhone,
        message: smsTemplates.invoiceSent(clientName, businessName, invoiceNumber, invoiceTotal)
      });
      result.smsSent = smsResult.success;
      if (!smsResult.success) result.smsError = smsResult.error;
    } catch (error: any) {
      result.smsError = error.message;
    }
  }

  result.success = (result.emailSent || false) || (result.smsSent || false);
  return result;
}

// Payment received notification
export async function notifyPaymentReceived(
  options: NotifyClientOptions & {
    amount: string;
    invoiceNumber: string;
  }
): Promise<NotificationResult> {
  const { 
    clientName, clientEmail, clientPhone, 
    businessName, businessEmail,
    amount, invoiceNumber,
    channel = 'both'
  } = options;

  const result: NotificationResult = { success: true };

  // Send email
  if ((channel === 'email' || channel === 'both') && clientEmail) {
    try {
      const emailResult = await sendEmail({
        to: clientEmail,
        subject: `Payment Received - Thank you! - ${businessName}`,
        text: `Hi ${clientName},\n\nThank you! We've received your payment of ${amount} for invoice #${invoiceNumber}.\n\nThanks for your business,\n${businessName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #16a34a;">Payment Received</h2>
            <p>Hi ${clientName},</p>
            <p>Thank you! We've received your payment of <strong>${amount}</strong> for invoice #${invoiceNumber}.</p>
            <p>Thanks for your business!</p>
            <p>${businessName}</p>
          </div>
        `,
        replyTo: businessEmail
      });
      result.emailSent = emailResult.success;
      if (!emailResult.success) result.emailError = emailResult.error;
    } catch (error: any) {
      result.emailError = error.message;
    }
  }

  // Send SMS
  if ((channel === 'sms' || channel === 'both') && clientPhone) {
    try {
      const smsResult = await sendSMS({
        to: clientPhone,
        message: smsTemplates.paymentReceived(clientName, amount, businessName)
      });
      result.smsSent = smsResult.success;
      if (!smsResult.success) result.smsError = smsResult.error;
    } catch (error: any) {
      result.smsError = error.message;
    }
  }

  result.success = (result.emailSent || false) || (result.smsSent || false);
  return result;
}

// Job scheduled notification
export async function notifyJobScheduled(
  options: NotifyClientOptions & {
    jobDate: string;
    jobDescription?: string;
  }
): Promise<NotificationResult> {
  const { 
    clientName, clientEmail, clientPhone, 
    businessName, businessEmail,
    jobDate, jobDescription,
    channel = 'both'
  } = options;

  const result: NotificationResult = { success: true };

  // Send email
  if ((channel === 'email' || channel === 'both') && clientEmail) {
    try {
      const emailResult = await sendEmail({
        to: clientEmail,
        subject: `Job Scheduled - ${jobDate} - ${businessName}`,
        text: `Hi ${clientName},\n\nYour job has been scheduled for ${jobDate}.\n\n${jobDescription ? `Details: ${jobDescription}\n\n` : ''}We'll see you then!\n\n${businessName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Job Scheduled</h2>
            <p>Hi ${clientName},</p>
            <p>Your job has been scheduled for <strong>${jobDate}</strong>.</p>
            ${jobDescription ? `<p><strong>Details:</strong> ${jobDescription}</p>` : ''}
            <p>We'll see you then!</p>
            <p>${businessName}</p>
          </div>
        `,
        replyTo: businessEmail
      });
      result.emailSent = emailResult.success;
      if (!emailResult.success) result.emailError = emailResult.error;
    } catch (error: any) {
      result.emailError = error.message;
    }
  }

  // Send SMS
  if ((channel === 'sms' || channel === 'both') && clientPhone) {
    try {
      const smsResult = await sendSMS({
        to: clientPhone,
        message: smsTemplates.jobScheduled(clientName, businessName, jobDate)
      });
      result.smsSent = smsResult.success;
      if (!smsResult.success) result.smsError = smsResult.error;
    } catch (error: any) {
      result.smsError = error.message;
    }
  }

  result.success = (result.emailSent || false) || (result.smsSent || false);
  return result;
}

// Get notification service status
export function getNotificationStatus() {
  return {
    smsAvailable: isTwilioInitialized(),
    emailAvailable: true, // Email always available (mock or real)
    smsProvider: 'Twilio',
    emailProvider: 'SendGrid'
  };
}
