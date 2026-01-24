import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, safeInvalidateQueries } from "@/lib/queryClient";

export function useBusinessSettings() {
  return useQuery({
    queryKey: ['/api/business-settings'],
    queryFn: async () => {
      const response = await fetch('/api/business-settings');
      if (!response.ok) {
        if (response.status === 404) {
          // Return default values if no business settings exist yet
          return {
            businessName: 'TradieTrack Business',
            email: null,
            phone: null,
            gstEnabled: false,
            emailSendingMode: 'manual'
          };
        }
        throw new Error('Failed to fetch business settings');
      }
      return response.json();
    },
    // Use a reasonable stale time to prevent constant refetching while still enabling sync
    staleTime: 30000, // 30 seconds - balances freshness with stability
    refetchOnMount: true,
    refetchOnWindowFocus: true, // Enables cross-platform sync when switching tabs/apps
  });
}

export function useUpdateBusinessSettings() {
  return useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const response = await apiRequest('PATCH', '/api/business-settings', data);
      return response.json();
    },
    onSuccess: () => {
      safeInvalidateQueries({ queryKey: ['/api/business-settings'] });
    }
  });
}