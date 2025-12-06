/**
 * Notification Service - Centralized notification creation
 * This is the hub where all events in the app create notifications
 */

interface CreateNotificationParams {
  userId: string;
  type: string;
  title: string;
  message: string;
  relatedType?: string;
  relatedId?: string;
}

/**
 * Create a notification in the database
 * This is called whenever an important event happens in the system
 */
export async function createNotification(
  storage: any,
  params: CreateNotificationParams
): Promise<void> {
  try {
    await storage.createNotification({
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      relatedType: params.relatedType || null,
      relatedId: params.relatedId || null,
      read: false,
      dismissed: false,
    });
    
    console.log(`✅ Notification created: ${params.type} for user ${params.userId}`);
  } catch (error) {
    console.error('❌ Failed to create notification:', error);
    // Don't throw - notifications should never break the main flow
  }
}

/**
 * Event-driven notification creators
 * These are helper functions that create standardized notifications for common events
 */

export async function notifyJobAssigned(
  storage: any,
  assignedUserId: string,
  job: any,
  assignedBy: any
) {
  await createNotification(storage, {
    userId: assignedUserId,
    type: 'job_assigned',
    title: 'New Job Assigned',
    message: `${assignedBy.firstName || assignedBy.username} assigned you to: ${job.title}`,
    relatedType: 'job',
    relatedId: job.id,
  });
}

export async function notifyJobCompleted(
  storage: any,
  ownerId: string,
  job: any,
  completedBy: any
) {
  await createNotification(storage, {
    userId: ownerId,
    type: 'job_completed',
    title: 'Job Completed',
    message: `${completedBy.firstName || completedBy.username} completed: ${job.title}`,
    relatedType: 'job',
    relatedId: job.id,
  });
}

export async function notifyQuoteSent(
  storage: any,
  userId: string,
  quote: any,
  clientName: string
) {
  await createNotification(storage, {
    userId,
    type: 'quote_sent',
    title: 'Quote Sent',
    message: `Quote "${quote.title}" sent to ${clientName} for $${Number(quote.total).toFixed(2)}`,
    relatedType: 'quote',
    relatedId: quote.id,
  });
}

export async function notifyQuoteAccepted(
  storage: any,
  userId: string,
  quote: any,
  clientName: string
) {
  await createNotification(storage, {
    userId,
    type: 'quote_accepted',
    title: 'Quote Accepted! 🎉',
    message: `${clientName} accepted your quote for $${Number(quote.total).toFixed(2)}`,
    relatedType: 'quote',
    relatedId: quote.id,
  });
}

export async function notifyInvoiceSent(
  storage: any,
  userId: string,
  invoice: any,
  clientName: string
) {
  await createNotification(storage, {
    userId,
    type: 'invoice_sent',
    title: 'Invoice Sent',
    message: `Invoice "${invoice.title}" sent to ${clientName} for $${Number(invoice.total).toFixed(2)}`,
    relatedType: 'invoice',
    relatedId: invoice.id,
  });
}

export async function notifyInvoicePaid(
  storage: any,
  userId: string,
  invoice: any,
  clientName: string
) {
  await createNotification(storage, {
    userId,
    type: 'payment_received',
    title: 'Payment Received! 💰',
    message: `${clientName} paid invoice for $${Number(invoice.total).toFixed(2)}`,
    relatedType: 'invoice',
    relatedId: invoice.id,
  });
}

export async function notifyInvoiceOverdue(
  storage: any,
  userId: string,
  invoice: any,
  clientName: string,
  daysOverdue: number
) {
  await createNotification(storage, {
    userId,
    type: 'overdue_invoice',
    title: 'Invoice Overdue',
    message: `Invoice to ${clientName} is ${daysOverdue} days overdue ($${Number(invoice.total).toFixed(2)})`,
    relatedType: 'invoice',
    relatedId: invoice.id,
  });
}

export async function notifyTeamMemberInvited(
  storage: any,
  invitedUserId: string,
  businessName: string,
  roleName: string
) {
  await createNotification(storage, {
    userId: invitedUserId,
    type: 'team_invite',
    title: 'Team Invitation',
    message: `You've been invited to join ${businessName} as ${roleName}`,
    relatedType: 'team',
    relatedId: invitedUserId,
  });
}

export async function notifyUpcomingJob(
  storage: any,
  userId: string,
  job: any,
  hoursUntil: number
) {
  await createNotification(storage, {
    userId,
    type: 'job_reminder',
    title: 'Upcoming Job',
    message: `"${job.title}" scheduled in ${hoursUntil} hours`,
    relatedType: 'job',
    relatedId: job.id,
  });
}

export async function notifyJobScheduled(
  storage: any,
  userId: string,
  job: any,
  clientName: string
) {
  const scheduledDate = job.scheduledAt ? new Date(job.scheduledAt).toLocaleDateString('en-AU') : 'soon';
  await createNotification(storage, {
    userId,
    type: 'job_scheduled',
    title: 'Job Scheduled',
    message: `"${job.title}" for ${clientName} scheduled for ${scheduledDate}`,
    relatedType: 'job',
    relatedId: job.id,
  });
}

export async function notifyJobStarted(
  storage: any,
  userId: string,
  job: any,
  clientName: string
) {
  await createNotification(storage, {
    userId,
    type: 'job_started',
    title: 'Job Started',
    message: `"${job.title}" for ${clientName} is now in progress`,
    relatedType: 'job',
    relatedId: job.id,
  });
}
