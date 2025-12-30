import { useQuery } from "@tanstack/react-query";

interface DashboardKPIs {
  jobsToday: number;
  unpaidInvoicesTotal: number;
  unpaidInvoicesCount: number;
  quotesAwaiting: number;
  monthlyEarnings: number;
  jobsToInvoice: number;
}

interface RecentActivity {
  id: number;
  action: string;
  time: string;
  type: "success" | "info" | "warning";
}

export function useDashboardKPIs() {
  return useQuery<DashboardKPIs>({
    queryKey: ["/api/dashboard/kpis"],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useTodaysJobs() {
  return useQuery<any[]>({
    queryKey: ["/api/jobs/today"],
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useRecentActivity() {
  return useQuery<RecentActivity[]>({
    queryKey: ["/api/dashboard/activity"],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}