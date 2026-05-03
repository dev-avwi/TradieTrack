import { storage } from './storage';

const TIER_MAP: Record<string, string> = {
  'com.jobrunner.pro.monthly': 'pro',
  'com.jobrunner.team.monthly': 'team',
  'com.jobrunner.business.monthly': 'business',
};

/**
 * Apply a verified Apple App Store Server Notification V2 to subscription state.
 * Called only after the outer JWS + nested JWS payloads have been
 * cryptographically verified by appleIapVerify.ts.
 */
export async function applyAppleNotification(args: {
  notification: any;
  transactionInfo: any | null;
  renewalInfo: any | null;
}): Promise<void> {
  const { notification, transactionInfo, renewalInfo } = args;
  const { notificationType, subtype, data } = notification;
  const environment = data?.environment;

  const originalTransactionId =
    transactionInfo?.originalTransactionId || renewalInfo?.originalTransactionId;
  const productId =
    transactionInfo?.productId ||
    renewalInfo?.productId ||
    renewalInfo?.autoRenewProductId;

  console.log(
    `[AppleWebhook] type=${notificationType} subtype=${subtype || '-'} env=${environment} txn=${originalTransactionId} product=${productId}`,
  );

  if (!originalTransactionId) {
    console.warn('[AppleWebhook] No originalTransactionId — cannot route notification');
    return;
  }

  const user = await storage.getUserByAppleOriginalTransactionId(originalTransactionId);
  if (!user) {
    console.warn(
      `[AppleWebhook] No user found for txn ${originalTransactionId} (notification: ${notificationType})`,
    );
    return;
  }

  switch (notificationType) {
    case 'SUBSCRIBED':
    case 'DID_RENEW':
    case 'DID_CHANGE_RENEWAL_PREF': {
      const newTier = TIER_MAP[productId] || user.subscriptionTier;
      await storage.updateUser(user.id, {
        subscriptionTier: newTier,
        subscriptionStatus: 'active',
        subscriptionSource: 'apple',
        appleProductId: productId,
      } as any);
      console.log(`[AppleWebhook] User ${user.id} subscription active: ${newTier}`);
      break;
    }
    case 'EXPIRED':
    case 'GRACE_PERIOD_EXPIRED': {
      await storage.updateUser(user.id, {
        subscriptionTier: 'free',
        subscriptionStatus: 'expired',
      } as any);
      console.log(`[AppleWebhook] User ${user.id} subscription expired — downgraded to free`);
      break;
    }
    case 'DID_FAIL_TO_RENEW': {
      await storage.updateUser(user.id, {
        subscriptionStatus: 'past_due',
      } as any);
      console.log(`[AppleWebhook] User ${user.id} renewal failed — marked past_due`);
      break;
    }
    case 'DID_CHANGE_RENEWAL_STATUS': {
      const willAutoRenew = renewalInfo?.autoRenewStatus === 1;
      console.log(`[AppleWebhook] User ${user.id} auto-renew set to ${willAutoRenew}`);
      break;
    }
    case 'REFUND':
    case 'REVOKE': {
      await storage.updateUser(user.id, {
        subscriptionTier: 'free',
        subscriptionStatus: 'canceled',
      } as any);
      console.log(`[AppleWebhook] User ${user.id} subscription refunded/revoked — downgraded to free`);
      break;
    }
    case 'PRICE_INCREASE':
    case 'OFFER_REDEEMED':
    case 'TEST':
    default: {
      console.log(`[AppleWebhook] Notification type ${notificationType} acknowledged (no action)`);
      break;
    }
  }
}
