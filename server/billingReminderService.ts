import { storage } from './storage';
import { sendEmail } from './emailService';
import { sendSMS as sendSms } from './twilioClient';
import Stripe from 'stripe';
import { PRICING } from '@shared/schema';
import type { User, BusinessSettings } from '@shared/schema';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-06-20',
});

const getBaseUrl = () => {
  if (process.env.VITE_APP_URL) {
    return process.env.VITE_APP_URL;
  }
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  return 'http://localhost:5000';
};

function calculateAmount(subscriptionTier: string, seatCount: number = 0): number {
  if (subscriptionTier === 'pro') {
    return PRICING.pro.monthly / 100;
  }
  if (subscriptionTier === 'team') {
    const baseAmount = PRICING.team.baseMonthly / 100;
    const seatsAmount = (seatCount * PRICING.team.seatMonthly) / 100;
    return baseAmount + seatsAmount;
  }
  return 0;
}

function formatCardBrand(brand: string | null | undefined): string {
  if (!brand) return 'Card';
  const brands: Record<string, string> = {
    visa: 'Visa',
    mastercard: 'Mastercard',
    amex: 'American Express',
    discover: 'Discover',
    diners: 'Diners Club',
    jcb: 'JCB',
    unionpay: 'UnionPay',
  };
  return brands[brand.toLowerCase()] || brand;
}

async function sendBillingReminderEmail(
  user: User,
  settings: BusinessSettings,
  daysUntilBilling: number
): Promise<boolean> {
  if (!user.email) {
    console.log(`[BillingReminder] Skipping email for user ${user.id}: No email address`);
    return false;
  }

  const subscriptionTier = user.subscriptionTier || 'free';
  const subscriptionStatus = settings.subscriptionStatus || 'none';
  const amount = calculateAmount(subscriptionTier, settings.seatCount || 0);
  const cardBrand = formatCardBrand(settings.paymentMethodBrand);
  const cardLast4 = settings.paymentMethodLast4 || '****';
  const manageUrl = `${getBaseUrl()}/settings?tab=subscription`;
  const brandColor = settings.brandColor || '#2563eb';

  const isTrialing = subscriptionStatus === 'trialing';
  const planName = subscriptionTier === 'team' ? 'TradieTrack Team' : 'TradieTrack Pro';

  const subject = isTrialing
    ? `Your TradieTrack trial ends in ${daysUntilBilling} day${daysUntilBilling !== 1 ? 's' : ''}`
    : `Your TradieTrack billing is coming up in ${daysUntilBilling} day${daysUntilBilling !== 1 ? 's' : ''}`;

  const headerMessage = isTrialing
    ? `Your free trial of ${planName} ends in ${daysUntilBilling} day${daysUntilBilling !== 1 ? 's' : ''}.`
    : `Your ${planName} subscription will renew in ${daysUntilBilling} day${daysUntilBilling !== 1 ? 's' : ''}.`;

  const actionMessage = isTrialing
    ? 'After your trial ends, your subscription will automatically continue and your saved payment method will be charged.'
    : 'Your saved payment method will be charged automatically.';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h1 style="color: ${brandColor}; margin: 0;">TradieTrack</h1>
        <p style="margin: 5px 0 0 0; color: #666;">Billing Reminder</p>
      </div>

      <div style="margin-bottom: 20px;">
        <p style="font-size: 16px;">Hi ${user.firstName || 'there'},</p>
        <p>${headerMessage}</p>
        <p>${actionMessage}</p>
      </div>

      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h3 style="margin: 0 0 15px 0; color: #333;">Billing Summary</h3>
        <table style="width: 100%;">
          <tr>
            <td style="padding: 8px 0; color: #666;">Plan:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: bold;">${planName}</td>
          </tr>
          ${subscriptionTier === 'team' && (settings.seatCount || 0) > 0 ? `
          <tr>
            <td style="padding: 8px 0; color: #666;">Team Seats:</td>
            <td style="padding: 8px 0; text-align: right;">${settings.seatCount} additional</td>
          </tr>
          ` : ''}
          <tr>
            <td style="padding: 8px 0; color: #666;">Payment Method:</td>
            <td style="padding: 8px 0; text-align: right;">${cardBrand} ending in ${cardLast4}</td>
          </tr>
          <tr style="border-top: 2px solid ${brandColor};">
            <td style="padding: 12px 0; font-weight: bold; font-size: 18px;">Amount:</td>
            <td style="padding: 12px 0; text-align: right; font-weight: bold; font-size: 18px; color: ${brandColor};">$${amount.toFixed(2)} AUD</td>
          </tr>
        </table>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${manageUrl}" style="background-color: ${brandColor}; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-size: 16px; font-weight: bold;">
          Manage Subscription
        </a>
        <p style="margin-top: 12px; color: #666; font-size: 14px;">Update your payment method or change your plan</p>
      </div>

      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #666; font-size: 12px;">
        <p style="margin: 0;">Powered by <strong>TradieTrack</strong> | The business management platform for Australian tradies</p>
        <p style="margin: 10px 0 0 0; font-size: 11px; color: #888;">
          This is a transactional email regarding your subscription billing.
        </p>
      </div>
    </body>
    </html>
  `;

  try {
    const result = await sendEmail({
      to: user.email,
      subject,
      html,
    });

    if (result.success) {
      console.log(`[BillingReminder] Email sent to ${user.email} (${daysUntilBilling} days before billing)`);
      return true;
    } else {
      console.error(`[BillingReminder] Failed to send email to ${user.email}:`, result.error);
      return false;
    }
  } catch (error: any) {
    console.error(`[BillingReminder] Error sending email to ${user.email}:`, error.message);
    return false;
  }
}

async function sendBillingReminderSms(
  user: User,
  settings: BusinessSettings,
  daysUntilBilling: number
): Promise<boolean> {
  const phone = settings.phone;
  if (!phone) {
    console.log(`[BillingReminder] Skipping SMS for user ${user.id}: No phone number`);
    return false;
  }

  const subscriptionTier = user.subscriptionTier || 'free';
  const subscriptionStatus = settings.subscriptionStatus || 'none';
  const amount = calculateAmount(subscriptionTier, settings.seatCount || 0);
  const isTrialing = subscriptionStatus === 'trialing';

  const message = isTrialing
    ? `TradieTrack: Your free trial ends in ${daysUntilBilling} day${daysUntilBilling !== 1 ? 's' : ''}. You'll be charged $${amount.toFixed(2)} AUD. Manage at ${getBaseUrl()}/settings`
    : `TradieTrack: Your subscription renews in ${daysUntilBilling} day${daysUntilBilling !== 1 ? 's' : ''} ($${amount.toFixed(2)} AUD). Manage at ${getBaseUrl()}/settings`;

  try {
    const result = await sendSms({
      to: phone,
      message,
    });

    if (result.success) {
      console.log(`[BillingReminder] SMS sent to ${phone} (${daysUntilBilling} days before billing)${result.simulated ? ' [SIMULATED]' : ''}`);
      return true;
    } else {
      console.error(`[BillingReminder] Failed to send SMS to ${phone}:`, result.error);
      return false;
    }
  } catch (error: any) {
    console.error(`[BillingReminder] Error sending SMS to ${phone}:`, error.message);
    return false;
  }
}

export async function processBillingReminders(): Promise<{
  processed: number;
  emailsSent: number;
  smsSent: number;
  errors: number;
}> {
  console.log('[BillingReminder] Starting billing reminder processing...');
  
  const stats = {
    processed: 0,
    emailsSent: 0,
    smsSent: 0,
    errors: 0,
  };

  try {
    const allBusinessSettings = await storage.getAllBusinessSettings();
    
    if (!allBusinessSettings || allBusinessSettings.length === 0) {
      console.log('[BillingReminder] No business settings found');
      return stats;
    }

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    for (const settings of allBusinessSettings) {
      try {
        const subscriptionStatus = settings.subscriptionStatus;
        if (subscriptionStatus !== 'active' && subscriptionStatus !== 'trialing') {
          continue;
        }

        if (!settings.billingRemindersEnabled) {
          continue;
        }

        const nextBillingDate = settings.nextBillingDate;
        if (!nextBillingDate) {
          continue;
        }

        const billingDate = new Date(nextBillingDate);
        billingDate.setHours(0, 0, 0, 0);
        const timeDiff = billingDate.getTime() - now.getTime();
        const daysUntilBilling = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

        if (daysUntilBilling < 0) {
          continue;
        }

        const billingReminderDays = (settings.billingReminderDays as number[]) || [3, 1];
        if (!billingReminderDays.includes(daysUntilBilling)) {
          continue;
        }

        const lastReminderSent = settings.lastBillingReminderSentAt;
        if (lastReminderSent) {
          const lastReminderDate = new Date(lastReminderSent);
          lastReminderDate.setHours(0, 0, 0, 0);
          if (lastReminderDate.getTime() === now.getTime()) {
            console.log(`[BillingReminder] Skipping user ${settings.userId}: Already sent reminder today`);
            continue;
          }
        }

        const user = await storage.getUser(settings.userId);
        if (!user || !user.isActive) {
          continue;
        }

        stats.processed++;
        console.log(`[BillingReminder] Processing reminder for user ${user.id} (${daysUntilBilling} days until billing)`);

        const emailSent = await sendBillingReminderEmail(user, settings, daysUntilBilling);
        if (emailSent) {
          stats.emailsSent++;
        }

        const smsSent = await sendBillingReminderSms(user, settings, daysUntilBilling);
        if (smsSent) {
          stats.smsSent++;
        }

        if (emailSent || smsSent) {
          await storage.updateBusinessSettings(settings.userId, {
            lastBillingReminderSentAt: new Date(),
          });
        }

      } catch (error: any) {
        console.error(`[BillingReminder] Error processing settings ${settings.id}:`, error.message);
        stats.errors++;
      }
    }

    console.log(`[BillingReminder] Completed. Processed: ${stats.processed}, Emails: ${stats.emailsSent}, SMS: ${stats.smsSent}, Errors: ${stats.errors}`);
    return stats;

  } catch (error: any) {
    console.error('[BillingReminder] Fatal error:', error.message);
    stats.errors++;
    return stats;
  }
}

export async function runDailyBillingReminders(): Promise<void> {
  console.log('[BillingReminder] Running daily billing reminder check...');
  const stats = await processBillingReminders();
  console.log('[BillingReminder] Daily check complete:', stats);
}
