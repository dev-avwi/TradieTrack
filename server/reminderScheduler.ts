import { storage } from './storage';
import { processOverdueReminders } from './reminderService';
import { processRecurringForUser } from './recurringService';
import { checkAndExpireTrials } from './subscriptionService';
import { processTimeBasedAutomations } from './automationService';

let reminderInterval: NodeJS.Timeout | null = null;
let recurringInterval: NodeJS.Timeout | null = null;
let trialInterval: NodeJS.Timeout | null = null;
let automationInterval: NodeJS.Timeout | null = null;

const REMINDER_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const RECURRING_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const TRIAL_CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const AUTOMATION_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

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

export function startAllSchedulers(): void {
  startReminderScheduler();
  startRecurringScheduler();
  startTrialScheduler();
  startAutomationScheduler();
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
  
  console.log('[Scheduler] All schedulers stopped');
}
