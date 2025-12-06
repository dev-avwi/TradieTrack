import { storage } from './storage';
import { TIER_LIMITS } from '@shared/schema';
import { IS_BETA } from './freemiumService';

export type SubscriptionTier = 'free' | 'pro' | 'trial' | 'beta';

export interface UsageStatus {
  tier: SubscriptionTier;
  isTrialActive: boolean;
  trialDaysRemaining: number | null;
  usage: {
    jobs: { used: number; limit: number; remaining: number };
    invoices: { used: number; limit: number; remaining: number };
    quotes: { used: number; limit: number; remaining: number };
  };
  canCreate: {
    job: boolean;
    invoice: boolean;
    quote: boolean;
  };
  features: string[];
  upgradeRequired: boolean;
}

export interface LimitCheckResult {
  allowed: boolean;
  reason?: string;
  upgradeRequired?: boolean;
  usage?: { used: number; limit: number };
}

function getEffectiveTier(user: any): SubscriptionTier {
  if (user.subscriptionTier === 'pro') {
    return 'pro';
  }
  
  if (user.trialStatus === 'active' && user.trialEndsAt) {
    const trialEnd = new Date(user.trialEndsAt);
    if (trialEnd > new Date()) {
      return 'pro'; // Trial users get Pro features
    }
  }
  
  return 'free';
}

function getTierLimits(tier: SubscriptionTier) {
  if (tier === 'pro' || tier === 'trial') {
    return TIER_LIMITS.pro;
  }
  return TIER_LIMITS.free;
}

export async function getUserUsageStatus(userId: string): Promise<UsageStatus> {
  // Beta mode: all features unlocked, no limits
  if (IS_BETA) {
    return {
      tier: 'beta',
      isTrialActive: false,
      trialDaysRemaining: null,
      usage: {
        jobs: { used: 0, limit: -1, remaining: -1 },
        invoices: { used: 0, limit: -1, remaining: -1 },
        quotes: { used: 0, limit: -1, remaining: -1 },
      },
      canCreate: {
        job: true,
        invoice: true,
        quote: true,
      },
      features: TIER_LIMITS.pro.features as unknown as string[],
      upgradeRequired: false,
    };
  }

  const user = await storage.getUser(userId);
  if (!user) {
    throw new Error('User not found');
  }
  
  await resetUsageIfNeeded(userId, user);
  
  const effectiveTier = getEffectiveTier(user);
  const limits = getTierLimits(effectiveTier);
  
  let trialDaysRemaining: number | null = null;
  let isTrialActive = false;
  
  if (user.trialStatus === 'active' && user.trialEndsAt) {
    const trialEnd = new Date(user.trialEndsAt);
    const now = new Date();
    if (trialEnd > now) {
      isTrialActive = true;
      trialDaysRemaining = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    }
  }
  
  const jobsUsed = user.jobsCreatedThisMonth || 0;
  const invoicesUsed = user.invoicesCreatedThisMonth || 0;
  const quotesUsed = user.quotesCreatedThisMonth || 0;
  
  const jobsLimit = limits.jobsPerMonth;
  const invoicesLimit = limits.invoicesPerMonth;
  const quotesLimit = limits.quotesPerMonth;
  
  const canCreateJob = jobsLimit === -1 || jobsUsed < jobsLimit;
  const canCreateInvoice = invoicesLimit === -1 || invoicesUsed < invoicesLimit;
  const canCreateQuote = quotesLimit === -1 || quotesUsed < quotesLimit;
  
  return {
    tier: effectiveTier === 'pro' && isTrialActive ? 'trial' : effectiveTier,
    isTrialActive,
    trialDaysRemaining,
    usage: {
      jobs: {
        used: jobsUsed,
        limit: jobsLimit,
        remaining: jobsLimit === -1 ? -1 : Math.max(0, jobsLimit - jobsUsed),
      },
      invoices: {
        used: invoicesUsed,
        limit: invoicesLimit,
        remaining: invoicesLimit === -1 ? -1 : Math.max(0, invoicesLimit - invoicesUsed),
      },
      quotes: {
        used: quotesUsed,
        limit: quotesLimit,
        remaining: quotesLimit === -1 ? -1 : Math.max(0, quotesLimit - quotesUsed),
      },
    },
    canCreate: {
      job: canCreateJob,
      invoice: canCreateInvoice,
      quote: canCreateQuote,
    },
    features: limits.features as unknown as string[],
    upgradeRequired: !canCreateJob || !canCreateInvoice || !canCreateQuote,
  };
}

export async function checkCanCreateJob(userId: string): Promise<LimitCheckResult> {
  // Beta mode: always allowed
  if (IS_BETA) {
    return { allowed: true };
  }

  const user = await storage.getUser(userId);
  if (!user) {
    return { allowed: false, reason: 'User not found' };
  }
  
  await resetUsageIfNeeded(userId, user);
  
  const effectiveTier = getEffectiveTier(user);
  const limits = getTierLimits(effectiveTier);
  
  if (limits.jobsPerMonth === -1) {
    return { allowed: true };
  }
  
  const used = user.jobsCreatedThisMonth || 0;
  if (used >= limits.jobsPerMonth) {
    return {
      allowed: false,
      reason: `You've reached your limit of ${limits.jobsPerMonth} jobs this month. Upgrade to Pro for unlimited jobs.`,
      upgradeRequired: true,
      usage: { used, limit: limits.jobsPerMonth },
    };
  }
  
  return { allowed: true, usage: { used, limit: limits.jobsPerMonth } };
}

export async function checkCanCreateInvoice(userId: string): Promise<LimitCheckResult> {
  // Beta mode: always allowed
  if (IS_BETA) {
    return { allowed: true };
  }

  const user = await storage.getUser(userId);
  if (!user) {
    return { allowed: false, reason: 'User not found' };
  }
  
  await resetUsageIfNeeded(userId, user);
  
  const effectiveTier = getEffectiveTier(user);
  const limits = getTierLimits(effectiveTier);
  
  if (limits.invoicesPerMonth === -1) {
    return { allowed: true };
  }
  
  const used = user.invoicesCreatedThisMonth || 0;
  if (used >= limits.invoicesPerMonth) {
    return {
      allowed: false,
      reason: `You've reached your limit of ${limits.invoicesPerMonth} invoices this month. Upgrade to Pro for unlimited invoices.`,
      upgradeRequired: true,
      usage: { used, limit: limits.invoicesPerMonth },
    };
  }
  
  return { allowed: true, usage: { used, limit: limits.invoicesPerMonth } };
}

export async function checkCanCreateQuote(userId: string): Promise<LimitCheckResult> {
  // Beta mode: always allowed
  if (IS_BETA) {
    return { allowed: true };
  }

  const user = await storage.getUser(userId);
  if (!user) {
    return { allowed: false, reason: 'User not found' };
  }
  
  await resetUsageIfNeeded(userId, user);
  
  const effectiveTier = getEffectiveTier(user);
  const limits = getTierLimits(effectiveTier);
  
  if (limits.quotesPerMonth === -1) {
    return { allowed: true };
  }
  
  const used = user.quotesCreatedThisMonth || 0;
  if (used >= limits.quotesPerMonth) {
    return {
      allowed: false,
      reason: `You've reached your limit of ${limits.quotesPerMonth} quotes this month. Upgrade to Pro for unlimited quotes.`,
      upgradeRequired: true,
      usage: { used, limit: limits.quotesPerMonth },
    };
  }
  
  return { allowed: true, usage: { used, limit: limits.quotesPerMonth } };
}

export async function incrementJobUsage(userId: string): Promise<void> {
  await storage.incrementUserUsage(userId, 'jobs');
}

export async function incrementInvoiceUsage(userId: string): Promise<void> {
  await storage.incrementUserUsage(userId, 'invoices');
}

export async function incrementQuoteUsage(userId: string): Promise<void> {
  await storage.incrementUserUsage(userId, 'quotes');
}

async function resetUsageIfNeeded(userId: string, user: any): Promise<void> {
  const resetDate = user.usageResetDate ? new Date(user.usageResetDate) : null;
  const now = new Date();
  
  if (!resetDate || (now.getMonth() !== resetDate.getMonth() || now.getFullYear() !== resetDate.getFullYear())) {
    await storage.resetUserUsage(userId);
  }
}

export async function startTrial(userId: string): Promise<{ success: boolean; endsAt?: Date; error?: string }> {
  const user = await storage.getUser(userId);
  if (!user) {
    return { success: false, error: 'User not found' };
  }
  
  if (user.subscriptionTier === 'pro') {
    return { success: false, error: 'Already subscribed to Pro' };
  }
  
  if (user.trialStatus === 'active' || user.trialStatus === 'expired' || user.trialStatus === 'converted') {
    return { success: false, error: 'Trial already used' };
  }
  
  const now = new Date();
  const endsAt = new Date(now.getTime() + (TIER_LIMITS.trial.durationDays * 24 * 60 * 60 * 1000));
  
  await storage.updateUser(userId, {
    trialStartedAt: now,
    trialEndsAt: endsAt,
    trialStatus: 'active',
  });
  
  return { success: true, endsAt };
}

export async function checkAndExpireTrials(): Promise<number> {
  const usersWithActiveTrial = await storage.getUsersWithActiveTrial();
  let expiredCount = 0;
  
  const now = new Date();
  for (const user of usersWithActiveTrial) {
    if (user.trialEndsAt && new Date(user.trialEndsAt) <= now) {
      await storage.updateUser(user.id, {
        trialStatus: 'expired',
      });
      expiredCount++;
    }
  }
  
  return expiredCount;
}

export async function upgradeToPro(userId: string): Promise<{ success: boolean; error?: string }> {
  const user = await storage.getUser(userId);
  if (!user) {
    return { success: false, error: 'User not found' };
  }
  
  await storage.updateUser(userId, {
    subscriptionTier: 'pro',
    trialStatus: user.trialStatus === 'active' ? 'converted' : user.trialStatus,
  });
  
  return { success: true };
}

export async function downgradeToFree(userId: string): Promise<{ success: boolean; error?: string }> {
  const user = await storage.getUser(userId);
  if (!user) {
    return { success: false, error: 'User not found' };
  }
  
  await storage.updateUser(userId, {
    subscriptionTier: 'free',
  });
  
  return { success: true };
}

export function hasFeature(features: string[], feature: string): boolean {
  return features.includes(feature);
}
