import { storage, db } from './storage';
import { processOverdueReminders } from './reminderService';
import { processRecurringForUser } from './recurringService';
import { checkAndExpireTrials } from './subscriptionService';
import { processTimeBasedAutomations } from './automationService';
import { runDailyBillingReminders } from './billingReminderService';
import { notifyInstallmentDue } from './notifications';
import { jobs, quotes, invoices, smsAutomationRules, paymentSchedules, paymentInstallments } from '@shared/schema';
import { and, or, eq, lt, isNull, gte, lte, not } from 'drizzle-orm';

let reminderInterval: NodeJS.Timeout | null = null;
let recurringInterval: NodeJS.Timeout | null = null;
let trialInterval: NodeJS.Timeout | null = null;
let automationInterval: NodeJS.Timeout | null = null;
let archiveInterval: NodeJS.Timeout | null = null;
let smsAutomationInterval: NodeJS.Timeout | null = null;
let billingReminderInterval: NodeJS.Timeout | null = null;
let installmentReminderInterval: NodeJS.Timeout | null = null;

const REMINDER_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const RECURRING_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const TRIAL_CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const AUTOMATION_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const ARCHIVE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours (daily)
const SMS_AUTOMATION_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const BILLING_REMINDER_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours (daily)
const INSTALLMENT_REMINDER_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 hours (twice daily)

async function processAllUserReminders(): Promise<void> {
  console.log('[Scheduler] Processing automatic reminders...');
  
  try {
    const results = await processOverdueReminders();
    
    if (results.length > 0) {
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      console.log(`[Scheduler] Reminders processed: ${successful} sent, ${failed} failed`);
    } else {
      console.log('[Scheduler] No reminders to send');
    }
  } catch (error) {
    console.error('[Scheduler] Error processing reminders:', error);
  }
}

async function processAllRecurring(): Promise<void> {
  console.log('[Scheduler] Processing recurring jobs/invoices...');
  
  try {
    const usersWithRecurring = await storage.getUsersWithRecurringItems();
    let totalJobs = 0;
    let totalInvoices = 0;
    
    for (const user of usersWithRecurring) {
      const results = await processRecurringForUser(user.id);
      totalJobs += results.jobs.filter(r => r.success).length;
      totalInvoices += results.invoices.filter(r => r.success).length;
    }
    
    if (totalJobs > 0 || totalInvoices > 0) {
      console.log(`[Scheduler] Recurring processed: ${totalJobs} jobs, ${totalInvoices} invoices`);
    } else if (usersWithRecurring.length === 0) {
      console.log('[Scheduler] No users with recurring items');
    }
  } catch (error) {
    console.error('[Scheduler] Error processing recurring:', error);
  }
}

async function processTrialExpirations(): Promise<void> {
  console.log('[Scheduler] Checking trial expirations...');
  
  try {
    const expiredCount = await checkAndExpireTrials();
    
    if (expiredCount > 0) {
      console.log(`[Scheduler] ${expiredCount} trials expired`);
    }
  } catch (error) {
    console.error('[Scheduler] Error checking trial expirations:', error);
  }
}

export function startReminderScheduler(): void {
  console.log('[Scheduler] Starting automatic reminder scheduler...');
  
  if (reminderInterval) {
    clearInterval(reminderInterval);
  }
  
  processAllUserReminders();
  
  reminderInterval = setInterval(processAllUserReminders, REMINDER_INTERVAL_MS);
  
  console.log(`[Scheduler] Reminder scheduler running every ${REMINDER_INTERVAL_MS / 60000} minutes`);
}

export function startRecurringScheduler(): void {
  console.log('[Scheduler] Starting recurring jobs/invoices scheduler...');
  
  if (recurringInterval) {
    clearInterval(recurringInterval);
  }
  
  processAllRecurring();
  
  recurringInterval = setInterval(processAllRecurring, RECURRING_INTERVAL_MS);
  
  console.log(`[Scheduler] Recurring scheduler running every ${RECURRING_INTERVAL_MS / 60000} minutes`);
}

export function startTrialScheduler(): void {
  console.log('[Scheduler] Starting trial expiration scheduler...');
  
  if (trialInterval) {
    clearInterval(trialInterval);
  }
  
  processTrialExpirations();
  
  trialInterval = setInterval(processTrialExpirations, TRIAL_CHECK_INTERVAL_MS);
  
  console.log(`[Scheduler] Trial scheduler running every ${TRIAL_CHECK_INTERVAL_MS / 60000} minutes`);
}

async function processAllAutomations(): Promise<void> {
  console.log('[Scheduler] Processing automation rules...');
  
  try {
    const { processed, errors } = await processTimeBasedAutomations();
    
    if (processed > 0 || errors > 0) {
      console.log(`[Scheduler] Automations processed: ${processed} successful, ${errors} failed`);
    } else {
      console.log('[Scheduler] No automation rules to process');
    }
  } catch (error) {
    console.error('[Scheduler] Error processing automations:', error);
  }
}

export function startAutomationScheduler(): void {
  console.log('[Scheduler] Starting automation rules scheduler...');
  
  if (automationInterval) {
    clearInterval(automationInterval);
  }
  
  // Run first time after a short delay to allow server startup
  setTimeout(processAllAutomations, 5000);
  
  automationInterval = setInterval(processAllAutomations, AUTOMATION_INTERVAL_MS);
  
  console.log(`[Scheduler] Automation scheduler running every ${AUTOMATION_INTERVAL_MS / 60000} minutes`);
}

async function processAutoArchive(): Promise<void> {
  console.log('[Scheduler] Processing auto-archive for old completed items...');
  
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Archive jobs that are done/invoiced and updated more than 30 days ago
    const archivedJobs = await db
      .update(jobs)
      .set({ archivedAt: new Date() })
      .where(
        and(
          isNull(jobs.archivedAt),
          or(eq(jobs.status, 'done'), eq(jobs.status, 'invoiced')),
          lt(jobs.updatedAt, thirtyDaysAgo)
        )
      )
      .returning();
    
    // Archive invoices that are paid and updated more than 30 days ago
    const archivedInvoices = await db
      .update(invoices)
      .set({ archivedAt: new Date() })
      .where(
        and(
          isNull(invoices.archivedAt),
          eq(invoices.status, 'paid'),
          lt(invoices.updatedAt, thirtyDaysAgo)
        )
      )
      .returning();
    
    // Archive quotes that are accepted/declined/expired and updated more than 30 days ago
    const archivedQuotes = await db
      .update(quotes)
      .set({ archivedAt: new Date() })
      .where(
        and(
          isNull(quotes.archivedAt),
          or(
            eq(quotes.status, 'accepted'),
            eq(quotes.status, 'declined'),
            eq(quotes.status, 'expired')
          ),
          lt(quotes.updatedAt, thirtyDaysAgo)
        )
      )
      .returning();
    
    const totalArchived = archivedJobs.length + archivedInvoices.length + archivedQuotes.length;
    if (totalArchived > 0) {
      console.log(`[Scheduler] Auto-archived: ${archivedJobs.length} jobs, ${archivedInvoices.length} invoices, ${archivedQuotes.length} quotes`);
    } else {
      console.log('[Scheduler] No items to auto-archive');
    }
  } catch (error) {
    console.error('[Scheduler] Error auto-archiving:', error);
  }
}

export function startArchiveScheduler(): void {
  console.log('[Scheduler] Starting auto-archive scheduler...');
  
  if (archiveInterval) {
    clearInterval(archiveInterval);
  }
  
  // Run first time after a delay
  setTimeout(processAutoArchive, 10000);
  
  archiveInterval = setInterval(processAutoArchive, ARCHIVE_INTERVAL_MS);
  
  console.log(`[Scheduler] Archive scheduler running every ${ARCHIVE_INTERVAL_MS / 3600000} hours`);
}

async function processSmsAutomations(): Promise<void> {
  console.log('[Scheduler] Processing SMS automation rules...');
  
  try {
    const now = new Date();
    let processed = 0;
    let errors = 0;
    
    // Get all active SMS automation rules
    const allRules = await db.select().from(smsAutomationRules)
      .where(eq(smsAutomationRules.isActive, true));
    
    for (const rule of allRules) {
      try {
        switch (rule.triggerType) {
          case 'quote_follow_up': {
            // Process quotes sent 3+ days ago without response
            const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
            const userQuotes = await db.select().from(quotes)
              .where(and(
                eq(quotes.userId, rule.userId),
                eq(quotes.status, 'sent'),
                lt(quotes.sentAt, threeDaysAgo)
              ));
            
            for (const quote of userQuotes) {
              const alreadyProcessed = await storage.getSmsAutomationLog(rule.id, 'quote', quote.id);
              if (!alreadyProcessed) {
                await processQuoteFollowUp(rule, quote);
                processed++;
              }
            }
            break;
          }
          
          case 'invoice_overdue': {
            // Process invoices 1+ days past due date
            const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            const overdueInvoices = await db.select().from(invoices)
              .where(and(
                eq(invoices.userId, rule.userId),
                or(eq(invoices.status, 'sent'), eq(invoices.status, 'overdue')),
                lt(invoices.dueDate, yesterday)
              ));
            
            for (const invoice of overdueInvoices) {
              const alreadyProcessed = await storage.getSmsAutomationLog(rule.id, 'invoice', invoice.id);
              if (!alreadyProcessed) {
                await processInvoiceOverdue(rule, invoice);
                processed++;
              }
            }
            break;
          }
          
          case 'job_day_before': {
            // Process jobs scheduled for tomorrow
            const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            const tomorrowStart = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
            const tomorrowEnd = new Date(tomorrowStart.getTime() + 24 * 60 * 60 * 1000);
            
            const upcomingJobs = await db.select().from(jobs)
              .where(and(
                eq(jobs.userId, rule.userId),
                or(eq(jobs.status, 'scheduled'), eq(jobs.status, 'confirmed')),
                gte(jobs.scheduledDate, tomorrowStart),
                lt(jobs.scheduledDate, tomorrowEnd)
              ));
            
            for (const job of upcomingJobs) {
              const alreadyProcessed = await storage.getSmsAutomationLog(rule.id, 'job', job.id);
              if (!alreadyProcessed) {
                await processJobDayBefore(rule, job);
                processed++;
              }
            }
            break;
          }
        }
      } catch (ruleError) {
        console.error(`[SMS Automation] Error processing rule ${rule.id}:`, ruleError);
        errors++;
      }
    }
    
    if (processed > 0 || errors > 0) {
      console.log(`[Scheduler] SMS automations processed: ${processed} successful, ${errors} failed`);
    } else {
      console.log('[Scheduler] No SMS automations to process');
    }
  } catch (error) {
    console.error('[Scheduler] Error processing SMS automations:', error);
  }
}

async function processQuoteFollowUp(rule: any, quote: any): Promise<void> {
  try {
    const { sendSmsToClient } = await import('./services/smsService');
    const client = await storage.getClientById(quote.clientId);
    if (!client?.phone) {
      await storage.createSmsAutomationLog({
        ruleId: rule.id,
        entityType: 'quote',
        entityId: quote.id,
        status: 'skipped',
        errorMessage: 'Client has no phone number',
      });
      return;
    }
    
    const message = rule.customMessage || `Hi ${client.name || 'there'}, just following up on the quote we sent for "${quote.title || 'your project'}". Let us know if you have any questions!`;
    
    await sendSmsToClient({
      businessOwnerId: rule.userId,
      clientPhone: client.phone,
      clientName: client.name,
      message,
    });
    
    await storage.createSmsAutomationLog({
      ruleId: rule.id,
      entityType: 'quote',
      entityId: quote.id,
      status: 'sent',
    });
    
    await storage.updateSmsAutomationRule(rule.id, rule.userId, {
      lastTriggeredAt: new Date(),
      triggerCount: (rule.triggerCount || 0) + 1,
    });
  } catch (error: any) {
    console.error(`[SMS Automation] Error sending quote follow-up:`, error);
    await storage.createSmsAutomationLog({
      ruleId: rule.id,
      entityType: 'quote',
      entityId: quote.id,
      status: 'failed',
      errorMessage: error.message,
    });
  }
}

async function processInvoiceOverdue(rule: any, invoice: any): Promise<void> {
  try {
    const { sendSmsToClient } = await import('./services/smsService');
    const client = await storage.getClientById(invoice.clientId);
    if (!client?.phone) {
      await storage.createSmsAutomationLog({
        ruleId: rule.id,
        entityType: 'invoice',
        entityId: invoice.id,
        status: 'skipped',
        errorMessage: 'Client has no phone number',
      });
      return;
    }
    
    const message = rule.customMessage || `Hi ${client.name || 'there'}, this is a friendly reminder that invoice #${invoice.invoiceNumber || invoice.id} for $${invoice.total} is now overdue. Please let us know if you have any questions.`;
    
    await sendSmsToClient({
      businessOwnerId: rule.userId,
      clientPhone: client.phone,
      clientName: client.name,
      message,
    });
    
    await storage.createSmsAutomationLog({
      ruleId: rule.id,
      entityType: 'invoice',
      entityId: invoice.id,
      status: 'sent',
    });
    
    await storage.updateSmsAutomationRule(rule.id, rule.userId, {
      lastTriggeredAt: new Date(),
      triggerCount: (rule.triggerCount || 0) + 1,
    });
  } catch (error: any) {
    console.error(`[SMS Automation] Error sending invoice overdue:`, error);
    await storage.createSmsAutomationLog({
      ruleId: rule.id,
      entityType: 'invoice',
      entityId: invoice.id,
      status: 'failed',
      errorMessage: error.message,
    });
  }
}

async function processJobDayBefore(rule: any, job: any): Promise<void> {
  try {
    const { sendSmsToClient } = await import('./services/smsService');
    const client = await storage.getClientById(job.clientId);
    if (!client?.phone) {
      await storage.createSmsAutomationLog({
        ruleId: rule.id,
        entityType: 'job',
        entityId: job.id,
        status: 'skipped',
        errorMessage: 'Client has no phone number',
      });
      return;
    }
    
    const scheduledDate = new Date(job.scheduledDate);
    const dateStr = scheduledDate.toLocaleDateString('en-AU', { weekday: 'long', month: 'long', day: 'numeric' });
    const timeStr = job.scheduledTime || 'as scheduled';
    
    const message = rule.customMessage || `Hi ${client.name || 'there'}, just a reminder about your appointment tomorrow (${dateStr}) at ${timeStr} for "${job.title || 'your job'}". See you then!`;
    
    await sendSmsToClient({
      businessOwnerId: rule.userId,
      clientPhone: client.phone,
      clientName: client.name,
      message,
    });
    
    await storage.createSmsAutomationLog({
      ruleId: rule.id,
      entityType: 'job',
      entityId: job.id,
      status: 'sent',
    });
    
    await storage.updateSmsAutomationRule(rule.id, rule.userId, {
      lastTriggeredAt: new Date(),
      triggerCount: (rule.triggerCount || 0) + 1,
    });
  } catch (error: any) {
    console.error(`[SMS Automation] Error sending job day before reminder:`, error);
    await storage.createSmsAutomationLog({
      ruleId: rule.id,
      entityType: 'job',
      entityId: job.id,
      status: 'failed',
      errorMessage: error.message,
    });
  }
}

export function startSmsAutomationScheduler(): void {
  console.log('[Scheduler] Starting SMS automation scheduler...');
  
  if (smsAutomationInterval) {
    clearInterval(smsAutomationInterval);
  }
  
  // Run first time after a short delay
  setTimeout(processSmsAutomations, 10000);
  
  smsAutomationInterval = setInterval(processSmsAutomations, SMS_AUTOMATION_INTERVAL_MS);
  
  console.log(`[Scheduler] SMS automation scheduler running every ${SMS_AUTOMATION_INTERVAL_MS / 60000} minutes`);
}

export function startBillingReminderScheduler(): void {
  console.log('[Scheduler] Starting billing reminder scheduler...');
  
  if (billingReminderInterval) {
    clearInterval(billingReminderInterval);
  }
  
  // Run first time after a delay
  setTimeout(async () => {
    console.log('[Scheduler] Processing billing reminders...');
    try {
      const stats = await runDailyBillingReminders();
      console.log(`[Scheduler] Billing reminders: ${stats.emailsSent} emails, ${stats.smsSent} SMS, ${stats.errors} errors`);
    } catch (error) {
      console.error('[Scheduler] Error processing billing reminders:', error);
    }
  }, 15000);
  
  billingReminderInterval = setInterval(async () => {
    console.log('[Scheduler] Processing billing reminders...');
    try {
      const stats = await runDailyBillingReminders();
      console.log(`[Scheduler] Billing reminders: ${stats.emailsSent} emails, ${stats.smsSent} SMS, ${stats.errors} errors`);
    } catch (error) {
      console.error('[Scheduler] Error processing billing reminders:', error);
    }
  }, BILLING_REMINDER_INTERVAL_MS);
  
  console.log(`[Scheduler] Billing reminder scheduler running every ${BILLING_REMINDER_INTERVAL_MS / 3600000} hours`);
}

async function processInstallmentReminders(): Promise<void> {
  console.log('[Scheduler] Processing installment reminders...');
  
  try {
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    
    // Get all active payment schedules
    const allSchedules = await db.select().from(paymentSchedules)
      .where(eq(paymentSchedules.isActive, true));
    
    let remindersCreated = 0;
    
    for (const schedule of allSchedules) {
      // Get pending installments for this schedule
      const pendingInstallments = await db.select().from(paymentInstallments)
        .where(and(
          eq(paymentInstallments.scheduleId, schedule.id),
          eq(paymentInstallments.status, 'pending'),
          lte(paymentInstallments.dueDate, threeDaysFromNow),
          gte(paymentInstallments.dueDate, now)
        ));
      
      for (const installment of pendingInstallments) {
        // Check if we already sent a reminder today
        const existingNotifications = await storage.getNotifications(schedule.userId);
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        
        const alreadyNotified = existingNotifications.some(n => 
          n.type === 'installment_due' && 
          n.relatedId === schedule.invoiceId &&
          new Date(n.createdAt) >= todayStart &&
          n.message.includes(`Installment ${installment.installmentNumber}`)
        );
        
        if (!alreadyNotified) {
          const daysUntilDue = Math.ceil((new Date(installment.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          const client = await storage.getClient(schedule.clientId, schedule.userId);
          
          await notifyInstallmentDue(
            storage,
            schedule.userId,
            installment,
            schedule,
            client?.name || 'Customer',
            daysUntilDue
          );
          remindersCreated++;
        }
      }
    }
    
    console.log(`[Scheduler] Installment reminders: ${remindersCreated} created`);
  } catch (error) {
    console.error('[Scheduler] Error processing installment reminders:', error);
  }
}

export function startInstallmentReminderScheduler(): void {
  console.log('[Scheduler] Starting installment reminder scheduler...');
  
  if (installmentReminderInterval) {
    clearInterval(installmentReminderInterval);
  }
  
  // Run first time after a delay
  setTimeout(processInstallmentReminders, 20000);
  
  installmentReminderInterval = setInterval(processInstallmentReminders, INSTALLMENT_REMINDER_INTERVAL_MS);
  
  console.log(`[Scheduler] Installment reminder scheduler running every ${INSTALLMENT_REMINDER_INTERVAL_MS / 3600000} hours`);
}

export function startAllSchedulers(): void {
  startReminderScheduler();
  startRecurringScheduler();
  startTrialScheduler();
  startAutomationScheduler();
  startArchiveScheduler();
  startSmsAutomationScheduler();
  startBillingReminderScheduler();
  startInstallmentReminderScheduler();
}

export function stopAllSchedulers(): void {
  if (reminderInterval) {
    clearInterval(reminderInterval);
    reminderInterval = null;
  }
  
  if (recurringInterval) {
    clearInterval(recurringInterval);
    recurringInterval = null;
  }
  
  if (trialInterval) {
    clearInterval(trialInterval);
    trialInterval = null;
  }
  
  if (automationInterval) {
    clearInterval(automationInterval);
    automationInterval = null;
  }
  
  if (archiveInterval) {
    clearInterval(archiveInterval);
    archiveInterval = null;
  }
  
  if (smsAutomationInterval) {
    clearInterval(smsAutomationInterval);
    smsAutomationInterval = null;
  }
  
  if (billingReminderInterval) {
    clearInterval(billingReminderInterval);
    billingReminderInterval = null;
  }
  
  if (installmentReminderInterval) {
    clearInterval(installmentReminderInterval);
    installmentReminderInterval = null;
  }
  
  console.log('[Scheduler] All schedulers stopped');
}
