import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMemo } from "react";
import { partitionByRecent } from "@shared/dateUtils";
import { useToast } from "@/hooks/use-toast";
import { UsageCounts } from "./use-subscription";

export interface SubscriptionLimitError {
  error: string;
  type: 'SUBSCRIPTION_LIMIT';
  usageInfo: UsageCounts;
}

// Next Action types
export interface NextAction {
  action: string;
  priority: 'high' | 'medium' | 'low';
  actionType: string;
  reason: string;
}

export function useJobs() {
  return useQuery({
    queryKey: ["/api/jobs"],
  });
}

// Fetch next actions for all jobs (batch)
export function useJobNextActions() {
  const query = useQuery<Record<string, NextAction>>({
    queryKey: ["/api/jobs/next-actions"],
    staleTime: 5 * 60 * 1000, // 5 minutes - next actions don't change that frequently
  });
  
  return {
    ...query,
    data: query.data ?? {},
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

export function useRecentJobs() {
  const { data: jobs = [], ...rest } = useJobs();
  
  const partitioned = useMemo(() => {
    // Ensure jobs is an array with proper typing
    const jobsArray = Array.isArray(jobs) ? jobs as any[] : [];
    return partitionByRecent(jobsArray, 'createdAt');
  }, [jobs]);
  
  return {
    ...rest,
    data: jobs, // Keep original data for compatibility
    recent: partitioned.recent,
    older: partitioned.older,
  };
}

export function useCreateJob() {
  const { toast } = useToast();

  return useMutation<any, Error, any>({
    mutationFn: async (jobData: any) => {
      const response = await apiRequest("POST", "/api/jobs", jobData);
      
      // Handle subscription limit errors (402 status)
      if (response.status === 402) {
        const errorData = await response.json();
        const error = new Error(errorData.error) as Error & { subscriptionError: SubscriptionLimitError };
        error.subscriptionError = errorData;
        throw error;
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create job');
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Invalidate job-related queries
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/kpis"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/next-actions"] });
      
      // Invalidate subscription usage to update job counts
      queryClient.invalidateQueries({ queryKey: ["/api/subscription/usage"] });
      
      toast({
        title: "Job Created",
        description: "Your job has been created successfully.",
      });
    },
    onError: (error: any) => {
      // Handle subscription limit errors specially
      if (error.subscriptionError?.type === 'SUBSCRIPTION_LIMIT') {
        // Don't show toast for subscription errors - let the component handle it
        return;
      }
      
      // Show toast for other errors
      toast({
        title: "Error",
        description: error.message || "Failed to create job. Please try again.",
        variant: "destructive",
      });
    },
  });
}

export function useUpdateJob() {
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiRequest("PATCH", `/api/jobs/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/kpis"] });
      // Refresh next actions when job status changes
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/next-actions"] });
    },
  });
}