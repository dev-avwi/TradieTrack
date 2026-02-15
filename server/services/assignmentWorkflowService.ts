import { storage } from '../storage';
import { sendSmsToClient } from './smsService';
import { randomBytes } from 'crypto';

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function estimateEtaMinutes(distanceKm: number): number {
  if (distanceKm <= 5) return Math.max(5, Math.round(distanceKm * 3));
  if (distanceKm <= 20) return Math.round(distanceKm * 2.5);
  if (distanceKm <= 50) return Math.round(distanceKm * 2);
  return Math.round(distanceKm * 1.5);
}

interface OnMyWayParams {
  jobId: string;
  assignmentId: string;
  actorUserId: string;
  workerLatitude?: number;
  workerLongitude?: number;
  customMessage?: string;
  baseUrl: string;
}

interface OnMyWayResult {
  success: boolean;
  portalUrl?: string;
  etaMinutes?: number;
  smsSent?: boolean;
  antiSpamBlocked?: boolean;
  error?: string;
}

export async function handleOnMyWay(params: OnMyWayParams): Promise<OnMyWayResult> {
  const { jobId, assignmentId, actorUserId, workerLatitude, workerLongitude, customMessage, baseUrl } = params;

  const assignment = await storage.getJobAssignment(assignmentId);
  if (!assignment) {
    return { success: false, error: 'Assignment not found' };
  }
  if (assignment.jobId !== jobId) {
    return { success: false, error: 'Assignment does not belong to this job' };
  }
  if (!assignment.isActive) {
    return { success: false, error: 'Assignment is not active' };
  }

  const job = await storage.getJob(jobId, assignment.userId);
  if (!job) {
    return { success: false, error: 'Job not found' };
  }

  if (assignment.userId !== actorUserId && job.userId !== actorUserId) {
    return { success: false, error: 'You do not have permission to update this assignment' };
  }
  if (job.status === 'cancelled') {
    return { success: false, error: 'Job is cancelled' };
  }
  if (!job.clientId) {
    return { success: false, error: 'Job has no associated client' };
  }

  const client = await storage.getClient(job.clientId, assignment.userId);
  if (!client) {
    return { success: false, error: 'Client not found' };
  }

  const effectiveUserId = job.userId;
  const business = await storage.getBusinessSettings(effectiveUserId);
  const businessName = business?.businessName || 'Your tradesperson';
  const ownerPhone = business?.phone || '';
  const ownerName = business?.contactName || businessName;

  const worker = await storage.getUser(assignment.userId);
  const workerName = assignment.workerDisplayNameSnapshot || 
    (worker ? [worker.firstName, worker.lastName].filter(Boolean).join(' ') : 'Your tradesperson');

  let etaMinutes: number | undefined;
  if (workerLatitude != null && workerLongitude != null && job.latitude != null && job.longitude != null) {
    const distance = haversineDistance(
      workerLatitude, workerLongitude,
      parseFloat(job.latitude), parseFloat(job.longitude)
    );
    etaMinutes = estimateEtaMinutes(distance);
  } else {
    etaMinutes = 20;
  }

  await storage.updateJobAssignment(assignmentId, {
    assignmentStatus: 'en_route',
    travelStartedAt: new Date(),
    etaMinutes,
    etaUpdatedAt: new Date(),
  });

  await storage.updateJob(jobId, effectiveUserId, {
    workerStatus: 'on_my_way',
    workerStatusUpdatedAt: new Date(),
    workerEtaMinutes: etaMinutes,
  });

  await storage.createAssignmentEvent({
    assignmentId,
    jobId,
    actorUserId,
    eventType: 'on_my_way_pressed',
    eventData: {
      etaMinutes,
      workerLatitude,
      workerLongitude,
      timestamp: new Date().toISOString(),
    },
  });

  let portalToken = await storage.getActivePortalTokenForAssignment(assignmentId);
  if (!portalToken) {
    portalToken = await storage.getActiveJobPortalToken(jobId);
  }
  if (!portalToken) {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    portalToken = await storage.createJobPortalToken({
      jobId,
      assignmentId,
      userId: effectiveUserId,
      token,
      expiresAt,
      createdBy: actorUserId,
    });
    await storage.updateJob(jobId, effectiveUserId, { portalEnabled: true });
  }

  const portalUrl = `${baseUrl}/job-portal/${portalToken.token}`;

  let smsSent = false;
  let antiSpamBlocked = false;

  if (client.phone) {
    const lastSms = await storage.getLastSmsNotification(assignmentId, 'on_my_way');
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    
    if (lastSms && new Date(lastSms.sentAt) > tenMinutesAgo) {
      antiSpamBlocked = true;
      console.log(`[OnMyWay] Anti-spam: SMS blocked for assignment ${assignmentId}, last sent ${lastSms.sentAt}`);
    } else {
      const etaText = etaMinutes ? `${etaMinutes} mins` : 'soon';
      const contactInfo = ownerPhone ? `${ownerName} on ${ownerPhone}` : ownerName;
      
      const smsBody = customMessage || 
        `JobRunner — ${businessName}: ${workerName} is on the way. ETA ${etaText}. Track live: ${portalUrl}. Questions? Call ${contactInfo}.`;

      try {
        await sendSmsToClient({
          businessOwnerId: effectiveUserId,
          clientId: job.clientId,
          clientPhone: client.phone,
          clientName: client.name,
          jobId,
          message: smsBody,
          senderUserId: actorUserId,
          isQuickAction: true,
          quickActionType: 'on_my_way',
        });

        smsSent = true;

        await storage.createSmsNotificationLog({
          jobId,
          assignmentId,
          userId: actorUserId,
          clientPhone: client.phone,
          notificationType: 'on_my_way',
          portalTokenId: portalToken.id,
          etaMinutes,
        });

        await storage.updateJobAssignment(assignmentId, {
          lastSmsSentAt: new Date(),
        });

        await storage.createAssignmentEvent({
          assignmentId,
          jobId,
          actorUserId,
          eventType: 'sms_sent',
          eventData: {
            notificationType: 'on_my_way',
            clientPhone: client.phone,
            etaMinutes,
          },
        });
      } catch (smsError: any) {
        console.error('[OnMyWay] SMS send failed:', smsError.message);
      }
    }
  }

  return {
    success: true,
    portalUrl,
    etaMinutes,
    smsSent,
    antiSpamBlocked,
  };
}

interface WorkerStatusParams {
  jobId: string;
  assignmentId: string;
  actorUserId: string;
  status: 'arrived' | 'in_progress' | 'completed';
  baseUrl: string;
}

export async function handleWorkerStatusChange(params: WorkerStatusParams): Promise<OnMyWayResult> {
  const { jobId, assignmentId, actorUserId, status, baseUrl } = params;

  const assignment = await storage.getJobAssignment(assignmentId);
  if (!assignment) {
    return { success: false, error: 'Assignment not found' };
  }
  if (assignment.jobId !== jobId) {
    return { success: false, error: 'Assignment does not belong to this job' };
  }

  const assignmentStatusMap: Record<string, string> = {
    arrived: 'arrived',
    in_progress: 'in_progress', 
    completed: 'completed',
  };

  const updateData: any = {
    assignmentStatus: assignmentStatusMap[status],
  };
  if (status === 'arrived') {
    updateData.arrivedAt = new Date();
  }

  await storage.updateJobAssignment(assignmentId, updateData);

  const effectiveUserId = assignment.userId;
  const jobUpdateData: any = {
    workerStatus: status === 'arrived' ? 'arrived' : status,
    workerStatusUpdatedAt: new Date(),
  };
  if (status === 'in_progress') {
    jobUpdateData.status = 'in_progress';
    jobUpdateData.startedAt = new Date();
  } else if (status === 'completed') {
    jobUpdateData.status = 'done';
    jobUpdateData.completedAt = new Date();
  }

  const job = await storage.getJob(jobId, effectiveUserId);
  if (job) {
    await storage.updateJob(jobId, effectiveUserId, jobUpdateData);
  }

  await storage.createAssignmentEvent({
    assignmentId,
    jobId,
    actorUserId,
    eventType: status === 'arrived' ? 'arrived' : status === 'in_progress' ? 'work_started' : 'completed',
    eventData: { timestamp: new Date().toISOString() },
  });

  if (status === 'arrived' || status === 'completed') {
    try {
      const { clearWorkerTravelLocation } = await import('../websocket');
      clearWorkerTravelLocation(jobId);
    } catch (e) {}
  }

  if (job && job.clientId) {
    const client = await storage.getClient(job.clientId, effectiveUserId);
    if (client?.phone) {
      const business = await storage.getBusinessSettings(effectiveUserId);
      const businessName = business?.businessName || 'Your tradesperson';
      const worker = await storage.getUser(assignment.userId);
      const workerName = assignment.workerDisplayNameSnapshot || 
        (worker ? [worker.firstName, worker.lastName].filter(Boolean).join(' ') : 'Your tradesperson');

      let portalToken = await storage.getActivePortalTokenForAssignment(assignmentId);
      if (!portalToken) portalToken = await storage.getActiveJobPortalToken(jobId);
      const portalUrl = portalToken ? `${baseUrl}/job-portal/${portalToken.token}` : '';

      let smsBody = '';
      if (status === 'arrived') {
        smsBody = `JobRunner — ${businessName}: ${workerName} has arrived. Updates/photos: ${portalUrl}`;
      } else if (status === 'completed') {
        smsBody = `JobRunner — ${businessName}: "${job.title}" has been completed by ${workerName}. View details + documents: ${portalUrl}`;
      }

      if (smsBody) {
        const lastSms = await storage.getLastSmsNotification(assignmentId, status);
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        
        if (!lastSms || new Date(lastSms.sentAt) <= tenMinutesAgo) {
          try {
            await sendSmsToClient({
              businessOwnerId: effectiveUserId,
              clientId: job.clientId,
              clientPhone: client.phone,
              clientName: client.name,
              jobId,
              message: smsBody,
              senderUserId: actorUserId,
              isQuickAction: true,
              quickActionType: `worker_${status}`,
            });

            await storage.createSmsNotificationLog({
              jobId,
              assignmentId,
              userId: actorUserId,
              clientPhone: client.phone,
              notificationType: status,
              portalTokenId: portalToken?.id,
            });

            await storage.updateJobAssignment(assignmentId, {
              lastSmsSentAt: new Date(),
            });
          } catch (smsError: any) {
            console.error(`[WorkerStatus] SMS send failed for ${status}:`, smsError.message);
          }
        }
      }
    }
  }

  return { success: true };
}

export async function handleDelayedNotification(params: {
  jobId: string;
  assignmentId: string;
  actorUserId: string;
  newEtaMinutes: number;
  baseUrl: string;
}): Promise<OnMyWayResult> {
  const { jobId, assignmentId, actorUserId, newEtaMinutes, baseUrl } = params;

  const assignment = await storage.getJobAssignment(assignmentId);
  if (!assignment) return { success: false, error: 'Assignment not found' };

  await storage.updateJobAssignment(assignmentId, {
    etaMinutes: newEtaMinutes,
    etaUpdatedAt: new Date(),
  });

  await storage.updateJob(jobId, assignment.userId, {
    workerEtaMinutes: newEtaMinutes,
  });

  await storage.createAssignmentEvent({
    assignmentId,
    jobId,
    actorUserId,
    eventType: 'eta_updated',
    eventData: { newEtaMinutes, timestamp: new Date().toISOString() },
  });

  const job = await storage.getJob(jobId, assignment.userId);
  if (!job || !job.clientId) return { success: true, etaMinutes: newEtaMinutes };

  const client = await storage.getClient(job.clientId, assignment.userId);
  if (!client?.phone) return { success: true, etaMinutes: newEtaMinutes };

  const business = await storage.getBusinessSettings(assignment.userId);
  const businessName = business?.businessName || 'Your tradesperson';
  const worker = await storage.getUser(assignment.userId);
  const workerName = assignment.workerDisplayNameSnapshot ||
    (worker ? [worker.firstName, worker.lastName].filter(Boolean).join(' ') : 'Your tradesperson');

  let portalToken = await storage.getActivePortalTokenForAssignment(assignmentId);
  if (!portalToken) portalToken = await storage.getActiveJobPortalToken(jobId);
  const portalUrl = portalToken ? `${baseUrl}/job-portal/${portalToken.token}` : '';

  const smsBody = `JobRunner — ${businessName}: ${workerName} is delayed ~${newEtaMinutes} mins. Track here: ${portalUrl}`;

  const lastSms = await storage.getLastSmsNotification(assignmentId, 'delayed');
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

  if (!lastSms || new Date(lastSms.sentAt) <= tenMinutesAgo) {
    try {
      await sendSmsToClient({
        businessOwnerId: assignment.userId,
        clientId: job.clientId,
        clientPhone: client.phone,
        clientName: client.name,
        jobId,
        message: smsBody,
        senderUserId: actorUserId,
        isQuickAction: true,
        quickActionType: 'worker_delayed',
      });

      await storage.createSmsNotificationLog({
        jobId,
        assignmentId,
        userId: actorUserId,
        clientPhone: client.phone,
        notificationType: 'delayed',
        etaMinutes: newEtaMinutes,
      });
    } catch (e: any) {
      console.error('[Delayed] SMS send failed:', e.message);
    }
  }

  return { success: true, etaMinutes: newEtaMinutes };
}
