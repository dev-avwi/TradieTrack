import { useQuery } from "@tanstack/react-query";

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
            gstEnabled: false
          };
        }
        throw new Error('Failed to fetch business settings');
      }
      return response.json();
    }
  });
}