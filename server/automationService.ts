import { storage } from './storage';

interface AutomationTrigger {
  type: 'status_change' | 'time_delay' | 'no_response' | 'payment_received';
  entityType: 'job' | 'quote' | 'invoice';
  fromStatus?: string;
  toStatus?: string;
  delayDays?: number;
}

interface AutomationAction {
  type: 'send_email' | 'send_sms' | 'create_job' | 'create_invoice' | 'notification' | 'update_status';
  template?: string;
  message?: string;
  newStatus?: string;
}

interface Automation {
  id: string;
  userId: string;
  name: string;
  isActive: boolean;
  trigger: AutomationTrigger;
  actions: AutomationAction[];
}

export async function processTimeBasedAutomations(): Promise<{ processed: number; errors: number }> {
  console.log('[Automations] Processing time-based automation rules...');
  
  let processed = 0;
  let errors = 0;
  
  try {
    const allUsers = await storage.getAllUsersWithAutomations();
    
    for (const userId of allUsers) {
      try {
        const automations = await storage.getAutomations(userId);
        const activeAutomations = automations.filter((a: any) => a.isActive);
        
        for (const automation of activeAutomations) {
          const trigger = automation.trigger as AutomationTrigger;
          
          if (trigger.type === 'no_response') {
            const result = await processNoResponseAutomation(userId, automation as Automation);
            processed += result.processed;
            errors += result.errors;
          } else if (trigger.type === 'time_delay') {
            const result = await processTimeDelayAutomation(userId, automation as Automation);
            processed += result.processed;
            errors += result.errors;
          }
        }
      } catch (userError) {
        console.error(`[Automations] Error processing user ${userId}:`, userError);
        errors++;
      }
    }
    
  } catch (error) {
    console.error('[Automations] Error in time-based processing:', error);
    errors++;
  }
  
  return { processed, errors };
}

async function processNoResponseAutomation(
  userId: string, 
  automation: Automation
): Promise<{ processed: number; errors: number }> {
  let processed = 0;
  let errors = 0;
  
  const trigger = automation.trigger;
  const delayDays = trigger.delayDays || 3;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - delayDays);
  
  try {
    if (trigger.entityType === 'quote') {
      const quotes = await storage.getQuotes(userId);
      
      for (const quote of quotes) {
        const status = (quote as any).status?.toLowerCase();
        const sentDate = (quote as any).sentAt ? new Date((quote as any).sentAt) : 
                        ((quote as any).createdAt ? new Date((quote as any).createdAt) : null);
        
        if ((status === 'sent' || status === 'viewed') && sentDate && sentDate < cutoffDate) {
          const alreadyProcessed = await storage.hasAutomationProcessed(automation.id, 'quote', quote.id);
          
          if (!alreadyProcessed) {
            try {
              await executeAutomationActions(userId, automation.actions, { quote });
              await storage.logAutomationProcessed(automation.id, 'quote', quote.id, 'success');
              processed++;
              console.log(`[Automations] Processed quote ${quote.id} with automation ${automation.name}`);
            } catch (actionError: any) {
              console.error(`[Automations] Error executing actions for quote ${quote.id}:`, actionError);
              await storage.logAutomationProcessed(automation.id, 'quote', quote.id, 'error', actionError.message);
              errors++;
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('[Automations] Error in no_response processing:', error);
    errors++;
  }
  
  return { processed, errors };
}

async function processTimeDelayAutomation(
  userId: string,
  automation: Automation
): Promise<{ processed: number; errors: number }> {
  let processed = 0;
  let errors = 0;
  
  const trigger = automation.trigger;
  const delayDays = trigger.delayDays || 1;
  
  try {
    if (trigger.entityType === 'job') {
      const jobs = await storage.getJobs(userId);
      
      if (delayDays < 0) {
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + Math.abs(delayDays));
        targetDate.setHours(0, 0, 0, 0);
        const nextDay = new Date(targetDate);
        nextDay.setDate(nextDay.getDate() + 1);
        
        for (const job of jobs) {
          if (!(job as any).scheduledAt) continue;
          const scheduledDate = new Date((job as any).scheduledAt);
          scheduledDate.setHours(0, 0, 0, 0);
          
          if (scheduledDate >= targetDate && scheduledDate < nextDay && (job as any).status === 'scheduled') {
            const alreadyProcessed = await storage.hasAutomationProcessed(automation.id, 'job', job.id);
            
            if (!alreadyProcessed) {
              try {
                await executeAutomationActions(userId, automation.actions, { job });
                await storage.logAutomationProcessed(automation.id, 'job', job.id, 'success');
                processed++;
                console.log(`[Automations] Processed upcoming job ${job.id} with automation ${automation.name}`);
              } catch (actionError: any) {
                console.error(`[Automations] Error executing actions for job ${job.id}:`, actionError);
                await storage.logAutomationProcessed(automation.id, 'job', job.id, 'error', actionError.message);
                errors++;
              }
            }
          }
        }
      } else {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - delayDays);
        
        for (const job of jobs) {
          if (!(job as any).scheduledAt) continue;
          const scheduledDate = new Date((job as any).scheduledAt);
          const status = (job as any).status;
          
          if (scheduledDate < cutoffDate && (status === 'scheduled' || status === 'in_progress')) {
            const alreadyProcessed = await storage.hasAutomationProcessed(automation.id, 'job', job.id);
            
            if (!alreadyProcessed) {
              try {
                await executeAutomationActions(userId, automation.actions, { job });
                await storage.logAutomationProcessed(automation.id, 'job', job.id, 'success');
                processed++;
                console.log(`[Automations] Processed overdue job ${job.id} with automation ${automation.name}`);
              } catch (actionError: any) {
                console.error(`[Automations] Error executing actions for job ${job.id}:`, actionError);
                await storage.logAutomationProcessed(automation.id, 'job', job.id, 'error', actionError.message);
                errors++;
              }
            }
          }
        }
      }
    } else if (trigger.entityType === 'invoice') {
      const invoices = await storage.getInvoices(userId);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - delayDays);
      
      for (const invoice of invoices) {
        const dueDate = (invoice as any).dueDate ? new Date((invoice as any).dueDate) : null;
        const status = (invoice as any).status;
        
        if (dueDate && dueDate < cutoffDate && 
            (status === 'sent' || status === 'viewed' || status === 'overdue') && 
            status !== 'paid') {
          const alreadyProcessed = await storage.hasAutomationProcessed(automation.id, 'invoice', invoice.id);
          
          if (!alreadyProcessed) {
            try {
              await executeAutomationActions(userId, automation.actions, { invoice });
              await storage.logAutomationProcessed(automation.id, 'invoice', invoice.id, 'success');
              processed++;
              console.log(`[Automations] Processed overdue invoice ${invoice.id} with automation ${automation.name}`);
            } catch (actionError: any) {
              console.error(`[Automations] Error executing actions for invoice ${invoice.id}:`, actionError);
              await storage.logAutomationProcessed(automation.id, 'invoice', invoice.id, 'error', actionError.message);
              errors++;
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('[Automations] Error in time_delay processing:', error);
    errors++;
  }
  
  return { processed, errors };
}

async function executeAutomationActions(
  userId: string,
  actions: AutomationAction[],
  context: { quote?: any; job?: any; invoice?: any }
): Promise<void> {
  const user = await storage.getUser(userId);
  const businessSettings = await storage.getBusinessSettings(userId);
  
  let client = null;
  const clientId = context.quote?.clientId || context.job?.clientId || context.invoice?.clientId;
  if (clientId) {
    client = await storage.getClient(clientId, userId);
  }
  
  for (const action of actions) {
    try {
      switch (action.type) {
        case 'notification':
          await createNotification(userId, action.message || 'Automation triggered', context);
          break;
          
        case 'send_email':
          if (client?.email) {
            if (context.quote && action.template?.includes('quote')) {
              console.log(`[Automations] Would send quote follow-up email to ${client.email}`);
            } else if (context.invoice && action.template?.includes('invoice')) {
              console.log(`[Automations] Would send invoice reminder email to ${client.email}`);
            } else if (context.job && action.template?.includes('job')) {
              console.log(`[Automations] Would send job email to ${client.email}`);
            }
          }
          break;
          
        case 'send_sms':
          if (client?.phone) {
            console.log(`[Automations] Would send SMS to ${client.phone}: ${replaceVariables(action.message || '', context, client)}`);
          }
          break;
          
        case 'create_job':
          if (context.quote) {
            console.log(`[Automations] Would create job from quote ${context.quote.id}`);
          }
          break;
          
        case 'create_invoice':
          if (context.job) {
            console.log(`[Automations] Would create invoice from job ${context.job.id}`);
          }
          break;
          
        case 'update_status':
          if (action.newStatus) {
            if (context.invoice) {
              await storage.updateInvoice(context.invoice.id, userId, { status: action.newStatus });
            } else if (context.job) {
              await storage.updateJob(context.job.id, userId, { status: action.newStatus });
            } else if (context.quote) {
              await storage.updateQuote(context.quote.id, userId, { status: action.newStatus });
            }
          }
          break;
      }
    } catch (actionError) {
      console.error(`[Automations] Error executing action ${action.type}:`, actionError);
    }
  }
}

function replaceVariables(template: string, context: any, client: any): string {
  let result = template;
  
  if (client) {
    result = result.replace(/{client_name}/g, client.name || 'there');
    result = result.replace(/{client_email}/g, client.email || '');
  }
  
  if (context.quote) {
    result = result.replace(/{quote_number}/g, context.quote.quoteNumber || '');
    result = result.replace(/{quote_total}/g, `$${(context.quote.total / 100).toFixed(2)}`);
  }
  
  if (context.invoice) {
    result = result.replace(/{invoice_number}/g, context.invoice.invoiceNumber || '');
    result = result.replace(/{invoice_total}/g, `$${(context.invoice.total / 100).toFixed(2)}`);
  }
  
  if (context.job) {
    result = result.replace(/{job_title}/g, context.job.title || '');
    result = result.replace(/{job_address}/g, context.job.address || '');
    result = result.replace(/{scheduled_date}/g, context.job.scheduledAt ? new Date(context.job.scheduledAt).toLocaleDateString('en-AU') : '');
  }
  
  return result;
}

async function createNotification(
  userId: string,
  message: string,
  context: any
): Promise<void> {
  const client = context.quote?.clientId || context.job?.clientId || context.invoice?.clientId
    ? await storage.getClient(context.quote?.clientId || context.job?.clientId || context.invoice?.clientId, userId)
    : null;
  
  const formattedMessage = replaceVariables(message, context, client);
  
  await storage.createNotification({
    userId,
    type: 'automation',
    title: 'Automation Alert',
    message: formattedMessage,
    entityType: context.quote ? 'quote' : context.job ? 'job' : 'invoice',
    entityId: context.quote?.id || context.job?.id || context.invoice?.id,
  });
}

export async function processStatusChangeAutomation(
  userId: string,
  entityType: 'job' | 'quote' | 'invoice',
  entityId: string,
  fromStatus: string,
  toStatus: string
): Promise<void> {
  try {
    const automations = await storage.getAutomations(userId);
    const matchingAutomations = automations.filter((a: any) => {
      if (!a.isActive) return false;
      const trigger = a.trigger as AutomationTrigger;
      return trigger.type === 'status_change' &&
             trigger.entityType === entityType &&
             (!trigger.fromStatus || trigger.fromStatus === fromStatus) &&
             (!trigger.toStatus || trigger.toStatus === toStatus);
    });
    
    for (const automation of matchingAutomations) {
      const context: any = {};
      
      if (entityType === 'quote') {
        context.quote = await storage.getQuote(entityId, userId);
      } else if (entityType === 'job') {
        context.job = await storage.getJob(entityId, userId);
      } else if (entityType === 'invoice') {
        context.invoice = await storage.getInvoice(entityId, userId);
      }
      
      await executeAutomationActions(userId, automation.actions as AutomationAction[], context);
    }
  } catch (error) {
    console.error('[Automations] Error processing status change:', error);
  }
}

export async function processPaymentReceivedAutomation(
  userId: string,
  invoiceId: string
): Promise<void> {
  try {
    const automations = await storage.getAutomations(userId);
    const matchingAutomations = automations.filter((a: any) => {
      if (!a.isActive) return false;
      const trigger = a.trigger as AutomationTrigger;
      return trigger.type === 'payment_received' && trigger.entityType === 'invoice';
    });
    
    const invoice = await storage.getInvoice(invoiceId, userId);
    
    for (const automation of matchingAutomations) {
      await executeAutomationActions(userId, automation.actions as AutomationAction[], { invoice });
    }
  } catch (error) {
    console.error('[Automations] Error processing payment received:', error);
  }
}
