import { useQuery } from "@tanstack/react-query";

export interface FreemiumLimits {
  jobsPerMonth: number;
  canUploadLogo: boolean;
  canCustomizeBranding: boolean;
  canAddTeamMembers: boolean;
  canUseAIFeatures: boolean;
}

export interface UsageCounts {
  jobsCreatedThisMonth: number;
  remainingJobs: number;
  subscriptionTier: 'free' | 'pro' | 'business';
  canCreateJob: boolean;
  nextResetDate: Date;
}

/**
 * Hook to fetch user's subscription usage information
 */
export function useSubscriptionUsage() {
  return useQuery<UsageCounts>({
    queryKey: ['/api/subscription/usage'],
    queryFn: async () => {
      const response = await fetch('/api/subscription/usage', { credentials: 'include' });
      if (!response.ok) {
        throw new Error('Failed to fetch subscription usage');
      }
      return response.json();
    },
    staleTime: 30000, // 30 seconds - refresh usage counts regularly
    refetchOnWindowFocus: true,
  });
}

/**
 * Hook to check if user can access a specific feature
 * Returns isLoading to allow callers to avoid flicker during initial load
 */
export function useFeatureAccess() {
  const { data: usage, isLoading } = useSubscriptionUsage();
  
  return {
    // While loading, optimistically enable features to avoid flicker for Pro users
    // Once loaded, the real tier determines access
    canUploadLogo: isLoading ? true : usage?.subscriptionTier !== 'free',
    canCustomizeBranding: isLoading ? true : usage?.subscriptionTier !== 'free',
    canAddTeamMembers: isLoading ? false : usage?.subscriptionTier === 'business',
    canUseAIFeatures: isLoading ? true : usage?.subscriptionTier !== 'free',
    canCreateJob: usage?.canCreateJob ?? true,
    subscriptionTier: usage?.subscriptionTier ?? 'free',
    jobsRemaining: usage?.remainingJobs ?? 5,
    jobsUsed: usage?.jobsCreatedThisMonth ?? 0,
    isLoading,
  };
}