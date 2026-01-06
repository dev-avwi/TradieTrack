import { storage } from './storage';
import { sendInvoiceEmail } from './emailService';
import { notifyInvoiceOverdue } from './pushNotifications';

// SMS disabled for beta - stub function
const sendSMS = async (options: { to: string; message: string }) => {
  console.log('[BETA] SMS disabled - would send to:', options.to);
  return { success: true, simulated: true };
};

interface ReminderResult {
  invoiceId: string;
  success: boolean;
  emailSent: boolean;
  smsSent: boolean;
  error?: string;
}

// Validate Australian mobile number format
function isValidAustralianMobile(phone: string): boolean {
  if (!phone) return false;
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  // Australian mobiles: 04xx xxx xxx or +614xx xxx xxx
  return /^(04\d{8}|614\d{8})$/.test(cleaned);
}

// Format phone to E.164 for SMS
function formatPhoneForSMS(phone: string): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('04') && cleaned.length === 10) {
    return '+61' + cleaned.substring(1);
  }
  if (cleaned.startsWith('614') && cleaned.length === 11) {
    return '+' + cleaned;
  }
  return null;
}

const REMINDER_TEMPLATES = {
  friendly: {
    7: (clientName: string, invoiceNumber: string, amount: string, businessName: string) => ({
      subject: `Friendly Reminder: Invoice ${invoiceNumber} from ${businessName}`,
      emailBody: `Hi ${clientName},\n\nJust a friendly reminder that invoice ${invoiceNumber} for $${amount} was due a week ago. If you've already paid, thank you and please disregard this message!\n\nIf you have any questions, just reply to this email.\n\nCheers,\n${businessName}`,
      smsBody: `Hi ${clientName}, friendly reminder that invoice ${invoiceNumber} for $${amount} is now overdue. Thanks! - ${businessName}`
    }),
    14: (clientName: string, invoiceNumber: string, amount: string, businessName: string) => ({
      subject: `Payment Reminder: Invoice ${invoiceNumber} - 2 Weeks Overdue`,
      emailBody: `Hi ${clientName},\n\nThis is a reminder that invoice ${invoiceNumber} for $${amount} is now 2 weeks overdue. We'd appreciate it if you could arrange payment at your earliest convenience.\n\nIf there are any issues or you'd like to discuss payment options, please get in touch.\n\nThanks,\n${businessName}`,
      smsBody: `Hi ${clientName}, invoice ${invoiceNumber} for $${amount} is 2 weeks overdue. Please arrange payment. Thanks - ${businessName}`
    }),
    30: (clientName: string, invoiceNumber: string, amount: string, businessName: string) => ({
      subject: `Urgent: Invoice ${invoiceNumber} - 30 Days Overdue`,
      emailBody: `Hi ${clientName},\n\nInvoice ${invoiceNumber} for $${amount} is now 30 days overdue. Please arrange payment as soon as possible to avoid any further action.\n\nIf you're experiencing difficulties, please contact us immediately to discuss options.\n\nRegards,\n${businessName}`,
      smsBody: `URGENT: Invoice ${invoiceNumber} for $${amount} is 30 days overdue. Please contact us immediately. - ${businessName}`
    }),
  },
  professional: {
    7: (clientName: string, invoiceNumber: string, amount: string, businessName: string) => ({
      subject: `Payment Reminder: Invoice ${invoiceNumber}`,
      emailBody: `Dear ${clientName},\n\nPlease be advised that invoice ${invoiceNumber} for $${amount} is now 7 days past due. We kindly request payment at your earliest convenience.\n\nShould you have any queries regarding this invoice, please do not hesitate to contact us.\n\nKind regards,\n${businessName}`,
      smsBody: `Payment reminder: Invoice ${invoiceNumber} for $${amount} is 7 days overdue. - ${businessName}`
    }),
    14: (clientName: string, invoiceNumber: string, amount: string, businessName: string) => ({
      subject: `Second Notice: Invoice ${invoiceNumber} - Payment Required`,
      emailBody: `Dear ${clientName},\n\nThis is a second notice regarding invoice ${invoiceNumber} for $${amount}, which is now 14 days past due.\n\nImmediate attention to this matter would be appreciated.\n\nRegards,\n${businessName}`,
      smsBody: `Second notice: Invoice ${invoiceNumber} for $${amount} is 14 days overdue. Immediate payment requested. - ${businessName}`
    }),
    30: (clientName: string, invoiceNumber: string, amount: string, businessName: string) => ({
      subject: `Final Notice: Invoice ${invoiceNumber} - Immediate Payment Required`,
      emailBody: `Dear ${clientName},\n\nThis is a final notice regarding invoice ${invoiceNumber} for $${amount}, which is now 30 days past due.\n\nImmediate payment is required to avoid escalation of this matter.\n\nPlease contact us immediately if there are circumstances preventing payment.\n\nRegards,\n${businessName}`,
      smsBody: `FINAL NOTICE: Invoice ${invoiceNumber} for $${amount} is 30 days overdue. Immediate payment required. - ${businessName}`
    }),
  },
  firm: {
    7: (clientName: string, invoiceNumber: string, amount: string, businessName: string) => ({
      subject: `Overdue Notice: Invoice ${invoiceNumber}`,
      emailBody: `${clientName},\n\nInvoice ${invoiceNumber} for $${amount} is now overdue. Payment is required within 7 days.\n\n${businessName}`,
      smsBody: `Invoice ${invoiceNumber} for $${amount} is overdue. Payment required. - ${businessName}`
    }),
    14: (clientName: string, invoiceNumber: string, amount: string, businessName: string) => ({
      subject: `Second Overdue Notice: Invoice ${invoiceNumber}`,
      emailBody: `${clientName},\n\nInvoice ${invoiceNumber} for $${amount} is now 14 days overdue. Immediate payment is required.\n\nFailure to pay may result in late fees or suspension of services.\n\n${businessName}`,
      smsBody: `Invoice ${invoiceNumber} - $${amount} - 14 days overdue. Pay immediately. - ${businessName}`
    }),
    30: (clientName: string, invoiceNumber: string, amount: string, businessName: string) => ({
      subject: `Final Demand: Invoice ${invoiceNumber}`,
      emailBody: `${clientName},\n\nFINAL DEMAND: Invoice ${invoiceNumber} for $${amount} is 30 days overdue.\n\nUnless payment is received within 7 days, this matter will be escalated for collection.\n\n${businessName}`,
      smsBody: `FINAL DEMAND: Invoice ${invoiceNumber} - $${amount} - 30 days overdue. Collection action pending. - ${businessName}`
    }),
  },
};

export async function processOverdueReminders(): Promise<ReminderResult[]> {
  const results: ReminderResult[] = [];
  
  try {
    const allUsers = await storage.getAllUsersWithSettings();
    
    for (const user of allUsers) {
      if (!user.businessSettings?.autoRemindersEnabled) {
        continue;
      }

      const reminderDays = (user.businessSettings.reminderDays as number[]) || [7, 14, 30];
      const tone = (user.businessSettings.reminderTone as keyof typeof REMINDER_TEMPLATES) || 'friendly';
      
      const overdueInvoices = await storage.getOverdueInvoicesForReminders(user.id);
      
      for (const invoice of overdueInvoices) {
        if (!invoice.dueDate) continue;
        
        const daysPastDue = Math.floor(
          (Date.now() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24)
        );
        
        const applicableDay = reminderDays.find(d => daysPastDue >= d && daysPastDue < d + 1);
        if (!applicableDay) continue;
        
        const alreadySent = await storage.hasReminderBeenSent(invoice.id, `${applicableDay}day`);
        if (alreadySent) continue;
        
        const client = await storage.getClient(invoice.clientId, user.id);
        if (!client) continue;
        
        const template = REMINDER_TEMPLATES[tone]?.[applicableDay as 7 | 14 | 30];
        if (!template) continue;
        
        const amount = Number(invoice.total).toFixed(2);
        const content = template(
          client.name.split(' ')[0],
          invoice.number,
          amount,
          user.businessSettings.businessName || 'Your Service Provider'
        );
        
        let emailSent = false;
        let smsSent = false;
        let error: string | undefined;
        
        if (client.email) {
          try {
            await sendInvoiceEmail(
              { ...invoice, lineItems: [] },
              client,
              user.businessSettings,
              null
            );
            emailSent = true;
          } catch (e: any) {
            error = e.message;
          }
        }
        
        // Only send SMS if client has valid Australian mobile and hasn't opted out
        if (client.phone && isValidAustralianMobile(client.phone)) {
          const formattedPhone = formatPhoneForSMS(client.phone);
          if (formattedPhone) {
            try {
              await sendSMS({ to: formattedPhone, message: content.smsBody });
              smsSent = true;
            } catch (e: any) {
              if (!error) error = e.message;
            }
          }
        }
        
        await storage.createInvoiceReminderLog({
          invoiceId: invoice.id,
          userId: user.id,
          reminderType: `${applicableDay}day`,
          daysPastDue,
          sentVia: emailSent && smsSent ? 'both' : emailSent ? 'email' : smsSent ? 'sms' : null,
          emailSent,
          smsSent,
        });
        
        // Send push notification for overdue invoice
        try {
          await notifyInvoiceOverdue(user.id, invoice.number, invoice.id, daysPastDue);
          console.log(`[PushNotification] Sent overdue invoice notification for invoice ${invoice.number} to user ${user.id}`);
        } catch (pushError) {
          console.error('[PushNotification] Error sending overdue invoice notification:', pushError);
        }
        
        results.push({
          invoiceId: invoice.id,
          success: emailSent || smsSent,
          emailSent,
          smsSent,
          error,
        });
      }
    }
  } catch (error: any) {
    console.error('Error processing overdue reminders:', error);
  }
  
  return results;
}

export async function sendManualReminder(
  invoiceId: string,
  userId: string,
  tone: 'friendly' | 'professional' | 'firm' = 'friendly'
): Promise<ReminderResult> {
  try {
    const invoice = await storage.getInvoice(invoiceId, userId);
    if (!invoice) {
      return { invoiceId, success: false, emailSent: false, smsSent: false, error: 'Invoice not found' };
    }
    
    const client = await storage.getClient(invoice.clientId, userId);
    if (!client) {
      return { invoiceId, success: false, emailSent: false, smsSent: false, error: 'Client not found' };
    }
    
    const businessSettings = await storage.getBusinessSettings(userId);
    if (!businessSettings) {
      return { invoiceId, success: false, emailSent: false, smsSent: false, error: 'Business settings not found' };
    }
    
    const daysPastDue = invoice.dueDate 
      ? Math.floor((Date.now() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    
    const templateDay = daysPastDue >= 30 ? 30 : daysPastDue >= 14 ? 14 : 7;
    const template = REMINDER_TEMPLATES[tone][templateDay];
    
    const amount = Number(invoice.total).toFixed(2);
    const content = template(
      client.name.split(' ')[0],
      invoice.number,
      amount,
      businessSettings.businessName || 'Your Service Provider'
    );
    
    let emailSent = false;
    let smsSent = false;
    let error: string | undefined;
    
    if (client.email) {
      try {
        await sendInvoiceEmail(
          { ...invoice, lineItems: [] },
          client,
          businessSettings,
          null
        );
        emailSent = true;
      } catch (e: any) {
        error = e.message;
      }
    }
    
    // Only send SMS if client has valid Australian mobile
    if (client.phone && isValidAustralianMobile(client.phone)) {
      const formattedPhone = formatPhoneForSMS(client.phone);
      if (formattedPhone) {
        try {
          await sendSMS({ to: formattedPhone, message: content.smsBody });
          smsSent = true;
        } catch (e: any) {
          if (!error) error = e.message;
        }
      }
    }
    
    await storage.createInvoiceReminderLog({
      invoiceId,
      userId,
      reminderType: 'manual',
      daysPastDue,
      sentVia: emailSent && smsSent ? 'both' : emailSent ? 'email' : smsSent ? 'sms' : null,
      emailSent,
      smsSent,
    });
    
    return { invoiceId, success: emailSent || smsSent, emailSent, smsSent, error };
  } catch (error: any) {
    return { invoiceId, success: false, emailSent: false, smsSent: false, error: error.message };
  }
}
