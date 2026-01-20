import { storage } from "./storage";

// Beta mode - set to true during beta phase (first 10 users get lifetime free with testimonial)
export const IS_BETA = true;

// Beta configuration
export const BETA_CONFIG = {
  maxLifetimeUsers: 10,         // First 10 users get lifetime free
  requiresTestimonialConsent: true,
  betaEndDate: null as Date | null, // Set to a date to auto-end beta
};

export interface FreemiumLimits {
  jobsPerMonth: number;
  invoicesPerMonth: number;
  quotesPerMonth: number;
  maxClients: number;
  maxTemplates: number;
  canUploadLogo: boolean;
  canCustomizeBranding: boolean;
  canAddTeamMembers: boolean;
  canUseAIFeatures: boolean;
}

export interface FullUsageInfo {
  jobs: { used: number; limit: number; remaining: number };
  invoices: { used: number; limit: number; remaining: number };
  quotes: { used: number; limit: number; remaining: number };
  clients: { used: number; limit: number; remaining: number };
  templates: { used: number; limit: number; remaining: number };
  isUnlimited: boolean;
}

export interface UsageCounts {
  jobsCreatedThisMonth: number;
  remainingJobs: number;
  subscriptionTier: 'free' | 'pro' | 'business';
  canCreateJob: boolean;
  nextResetDate: Date;
}

// Define subscription tier limits - matches TIER_LIMITS in shared/schema.ts
export const SUBSCRIPTION_LIMITS: Record<string, FreemiumLimits> = {
  free: {
    jobsPerMonth: 25,
    invoicesPerMonth: 25,
    quotesPerMonth: -1, // unlimited quotes - key sales tool
    maxClients: 50,
    maxTemplates: 5,
    canUploadLogo: false,
    canCustomizeBranding: false,
    canAddTeamMembers: false,
    canUseAIFeatures: false,
  },
  pro: {
    jobsPerMonth: -1, // unlimited
    invoicesPerMonth: -1,
    quotesPerMonth: -1,
    maxClients: -1,
    maxTemplates: -1,
    canUploadLogo: true,
    canCustomizeBranding: true,
    canAddTeamMembers: false,
    canUseAIFeatures: true,
  },
  business: {
    jobsPerMonth: -1, // unlimited
    invoicesPerMonth: -1,
    quotesPerMonth: -1,
    maxClients: -1,
    maxTemplates: -1,
    canUploadLogo: true,
    canCustomizeBranding: true,
    canAddTeamMembers: true,
    canUseAIFeatures: true,
  },
  team: {
    jobsPerMonth: -1, // unlimited
    invoicesPerMonth: -1,
    quotesPerMonth: -1,
    maxClients: -1,
    maxTemplates: -1,
    canUploadLogo: true,
    canCustomizeBranding: true,
    canAddTeamMembers: true,
    canUseAIFeatures: true,
  },
};

export class FreemiumService {
  /**
   * Check if user can create a new job based on their subscription limits
   */
  static async canUserCreateJob(userId: string): Promise<{ canCreate: boolean; reason?: string; usageInfo: UsageCounts }> {
    try {
      const user = await storage.getUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const usageInfo = await this.getUserUsageCounts(userId);
      
      // Beta mode: all users get unlimited access
      if (IS_BETA) {
        return {
          canCreate: true,
          usageInfo: {
            ...usageInfo,
            canCreateJob: true
          }
        };
      }

      // If user is on pro, business, or team plan, they have unlimited jobs
      if (user.subscriptionTier === 'pro' || user.subscriptionTier === 'business' || user.subscriptionTier === 'team') {
        return {
          canCreate: true,
          usageInfo: {
            ...usageInfo,
            canCreateJob: true
          }
        };
      }

      // For free users, check if they've exceeded their monthly limit
      const limits = SUBSCRIPTION_LIMITS[user.subscriptionTier || 'free'];
      const hasExceededLimit = usageInfo.jobsCreatedThisMonth >= limits.jobsPerMonth;

      if (hasExceededLimit) {
        return {
          canCreate: false,
          reason: `You've reached your monthly limit of ${limits.jobsPerMonth} jobs. Upgrade to Pro for unlimited jobs!`,
          usageInfo: {
            ...usageInfo,
            canCreateJob: false
          }
        };
      }

      return {
        canCreate: true,
        usageInfo: {
          ...usageInfo,
          canCreateJob: true
        }
      };

    } catch (error) {
      console.error('Error checking job creation limits:', error);
      return {
        canCreate: false,
        reason: 'Unable to verify subscription limits',
        usageInfo: {
          jobsCreatedThisMonth: 0,
          remainingJobs: 0,
          subscriptionTier: 'free',
          canCreateJob: false,
          nextResetDate: new Date()
        }
      };
    }
  }

  /**
   * Get current usage counts for a user
   */
  static async getUserUsageCounts(userId: string): Promise<UsageCounts> {
    try {
      const user = await storage.getUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const now = new Date();
      const subscriptionTier = user.subscriptionTier || 'free';
      const limits = SUBSCRIPTION_LIMITS[subscriptionTier];

      // Check if we need to reset the monthly count
      await this.maybeResetMonthlyCount(userId);

      // Refresh user data after potential reset
      const updatedUser = await storage.getUserById(userId);
      if (!updatedUser) {
        throw new Error('User not found after refresh');
      }

      const jobsCreatedThisMonth = updatedUser.jobsCreatedThisMonth || 0;
      const remainingJobs = limits.jobsPerMonth === -1 ? -1 : Math.max(0, limits.jobsPerMonth - jobsCreatedThisMonth);
      const canCreateJob = limits.jobsPerMonth === -1 || jobsCreatedThisMonth < limits.jobsPerMonth;

      // Calculate next reset date (first day of next month)
      const nextResetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      return {
        jobsCreatedThisMonth,
        remainingJobs,
        subscriptionTier: subscriptionTier as 'free' | 'pro' | 'business',
        canCreateJob,
        nextResetDate,
      };

    } catch (error) {
      console.error('Error getting usage counts:', error);
      // Return safe defaults
      return {
        jobsCreatedThisMonth: 0,
        remainingJobs: 5,
        subscriptionTier: 'free',
        canCreateJob: true,
        nextResetDate: new Date(),
      };
    }
  }

  /**
   * Increment job count after successful job creation
   */
  static async incrementJobCount(userId: string): Promise<void> {
    try {
      const user = await storage.getUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Only increment for free users (pro/business have unlimited)
      if (user.subscriptionTier === 'free' || !user.subscriptionTier) {
        const currentCount = user.jobsCreatedThisMonth || 0;
        await storage.updateUserJobCount(userId, currentCount + 1);
      }

    } catch (error) {
      console.error('Error incrementing job count:', error);
      // Don't throw here - job creation should still succeed even if count fails to update
    }
  }

  /**
   * Reset monthly job count if we're in a new month
   */
  static async maybeResetMonthlyCount(userId: string): Promise<void> {
    try {
      const user = await storage.getUserById(userId);
      if (!user) {
        return;
      }

      const now = new Date();
      const resetDate = user.subscriptionResetDate;

      // If no reset date set, or it's past the reset date, reset the count
      if (!resetDate || now >= resetDate) {
        // Calculate next reset date (first day of next month)
        const nextResetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        
        // Reset count and update reset date
        await storage.resetUserJobCount(userId, nextResetDate);
      }

    } catch (error) {
      console.error('Error resetting monthly count:', error);
    }
  }

  /**
   * Get subscription limits for a tier
   */
  static getSubscriptionLimits(tier: string): FreemiumLimits {
    return SUBSCRIPTION_LIMITS[tier] || SUBSCRIPTION_LIMITS.free;
  }

  /**
   * Check if user can access a specific feature
   */
  static async canUserAccessFeature(userId: string, feature: keyof FreemiumLimits): Promise<boolean> {
    // Beta mode: all features unlocked
    if (IS_BETA) {
      return true;
    }

    try {
      const user = await storage.getUserById(userId);
      if (!user) {
        return false;
      }

      const tier = user.subscriptionTier || 'free';
      const limits = SUBSCRIPTION_LIMITS[tier];
      return limits[feature] === true || limits[feature] === -1;

    } catch (error) {
      console.error('Error checking feature access:', error);
      return false;
    }
  }

  /**
   * Get full usage information for billing display
   */
  static async getFullUsageInfo(userId: string): Promise<FullUsageInfo> {
    // Beta mode: everything is unlimited
    if (IS_BETA) {
      return {
        jobs: { used: 0, limit: -1, remaining: -1 },
        invoices: { used: 0, limit: -1, remaining: -1 },
        quotes: { used: 0, limit: -1, remaining: -1 },
        clients: { used: 0, limit: -1, remaining: -1 },
        templates: { used: 0, limit: -1, remaining: -1 },
        isUnlimited: true
      };
    }

    try {
      const user = await storage.getUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const tier = user.subscriptionTier || 'free';
      const limits = SUBSCRIPTION_LIMITS[tier];
      const isUnlimited = tier === 'pro' || tier === 'business';

      // Get actual counts from database
      const jobs = await storage.getJobs(userId);
      const invoices = await storage.getInvoices(userId);
      const quotes = await storage.getQuotes(userId);
      const clients = await storage.getClients(userId);
      const templates = await storage.getDocumentTemplates(userId);

      // For monthly counts, we use the jobs created this month from user record
      const jobsUsed = user.jobsCreatedThisMonth || 0;
      
      // For invoices and quotes, count this month's creations
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const invoicesThisMonth = invoices.filter((i: any) => 
        i.createdAt && new Date(i.createdAt) >= startOfMonth
      ).length;
      
      const quotesThisMonth = quotes.filter((q: any) => 
        q.createdAt && new Date(q.createdAt) >= startOfMonth
      ).length;

      const calcRemaining = (used: number, limit: number) => 
        limit === -1 ? -1 : Math.max(0, limit - used);

      return {
        jobs: {
          used: jobsUsed,
          limit: limits.jobsPerMonth,
          remaining: calcRemaining(jobsUsed, limits.jobsPerMonth)
        },
        invoices: {
          used: invoicesThisMonth,
          limit: limits.invoicesPerMonth,
          remaining: calcRemaining(invoicesThisMonth, limits.invoicesPerMonth)
        },
        quotes: {
          used: quotesThisMonth,
          limit: limits.quotesPerMonth,
          remaining: calcRemaining(quotesThisMonth, limits.quotesPerMonth)
        },
        clients: {
          used: clients.length,
          limit: limits.maxClients,
          remaining: calcRemaining(clients.length, limits.maxClients)
        },
        templates: {
          used: templates.length,
          limit: limits.maxTemplates,
          remaining: calcRemaining(templates.length, limits.maxTemplates)
        },
        isUnlimited
      };

    } catch (error) {
      console.error('Error getting full usage info:', error);
      // Return safe defaults
      return {
        jobs: { used: 0, limit: 5, remaining: 5 },
        invoices: { used: 0, limit: 5, remaining: 5 },
        quotes: { used: 0, limit: 10, remaining: 10 },
        clients: { used: 0, limit: 10, remaining: 10 },
        templates: { used: 0, limit: 3, remaining: 3 },
        isUnlimited: false
      };
    }
  }
}