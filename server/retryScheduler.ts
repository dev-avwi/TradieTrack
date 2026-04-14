import { db } from "./storage";
import { smsMessages, smsConversations } from "@shared/schema";
import { eq, and, lte, lt, sql, isNotNull } from "drizzle-orm";
import { sendSMS } from "./twilioClient";
import { logger } from "./logger";

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [60_000, 300_000, 900_000]; // 1min, 5min, 15min

let isProcessing = false;

export function scheduleRetry(retryCount: number): Date {
  const delayMs = RETRY_DELAYS_MS[Math.min(retryCount, RETRY_DELAYS_MS.length - 1)];
  return new Date(Date.now() + delayMs);
}

async function processFailedSmsMessages() {
  if (isProcessing) return;
  isProcessing = true;
  try {
    const now = new Date();

    const failedMessages = await db
      .select({
        id: smsMessages.id,
        body: smsMessages.body,
        retryCount: smsMessages.retryCount,
        conversationId: smsMessages.conversationId,
        clientPhone: smsConversations.clientPhone,
        businessOwnerId: smsConversations.businessOwnerId,
      })
      .from(smsMessages)
      .innerJoin(smsConversations, eq(smsMessages.conversationId, smsConversations.id))
      .where(and(
        eq(smsMessages.status, 'failed'),
        eq(smsMessages.direction, 'outbound'),
        lt(sql`coalesce(${smsMessages.retryCount}, 0)`, MAX_RETRY_ATTEMPTS),
        isNotNull(smsMessages.nextRetryAt),
        lte(smsMessages.nextRetryAt, now),
      ))
      .limit(10);

    if (failedMessages.length === 0) return;

    logger.info('background', `Processing ${failedMessages.length} failed SMS for retry`);

    for (const msg of failedMessages) {
      const currentRetry = (msg.retryCount ?? 0) + 1;

      const claimed = await db.update(smsMessages).set({
        status: 'retrying' as any,
        retryCount: currentRetry,
      }).where(and(
        eq(smsMessages.id, msg.id),
        eq(smsMessages.status, 'failed'),
      )).returning({ id: smsMessages.id });

      if (claimed.length === 0) continue;

      try {
        const result = await sendSMS({
          to: msg.clientPhone,
          message: msg.body,
        });

        if (result.success) {
          await db.update(smsMessages).set({
            status: 'sent',
            twilioSid: result.messageId,
            errorMessage: null,
            nextRetryAt: null,
          }).where(eq(smsMessages.id, msg.id));

          logger.info('sms', `SMS retry #${currentRetry} succeeded`, { metadata: { messageId: msg.id } });
        } else {
          const nextRetryAt = currentRetry < MAX_RETRY_ATTEMPTS ? scheduleRetry(currentRetry) : null;
          await db.update(smsMessages).set({
            status: 'failed',
            nextRetryAt,
            errorMessage: result.error || 'Retry failed',
          }).where(eq(smsMessages.id, msg.id));

          if (currentRetry >= MAX_RETRY_ATTEMPTS) {
            logger.warn('sms', `SMS permanently failed after ${MAX_RETRY_ATTEMPTS} attempts`, {
              metadata: { messageId: msg.id, error: result.error },
            });
          }
        }
      } catch (error) {
        logger.error('sms', `SMS retry error for message ${msg.id}`, { error });
        const nextRetryAt = currentRetry < MAX_RETRY_ATTEMPTS ? scheduleRetry(currentRetry) : null;
        await db.update(smsMessages).set({
          status: 'failed',
          nextRetryAt,
          errorMessage: error instanceof Error ? error.message : 'Unknown retry error',
        }).where(eq(smsMessages.id, msg.id));
      }
    }
  } catch (error: any) {
    const msg = error?.message || '';
    if (msg.includes('does not exist') || msg.includes('relation')) {
      // Table not yet created — skip silently
    } else {
      logger.error('background', 'Failed SMS retry scheduler error', { error });
    }
  } finally {
    isProcessing = false;
  }
}

async function recoverStrandedMessages() {
  try {
    const recovered = await db.update(smsMessages).set({
      status: 'failed',
    }).where(
      eq(smsMessages.status, 'retrying' as any),
    ).returning({ id: smsMessages.id });

    if (recovered.length > 0) {
      logger.warn('background', `Recovered ${recovered.length} stranded SMS messages from 'retrying' state`);
    }
  } catch (error: any) {
    const m = error?.message || '';
    if (!m.includes('does not exist') && !m.includes('relation')) {
      logger.error('background', 'Failed to recover stranded SMS messages', { error });
    }
  }
}

let retryInterval: NodeJS.Timeout | null = null;

export async function startRetryScheduler() {
  if (retryInterval) return;
  await recoverStrandedMessages();
  retryInterval = setInterval(processFailedSmsMessages, 60_000);
  logger.info('background', 'SMS retry scheduler started (60s interval)');
}

export function stopRetryScheduler() {
  if (retryInterval) {
    clearInterval(retryInterval);
    retryInterval = null;
  }
}
