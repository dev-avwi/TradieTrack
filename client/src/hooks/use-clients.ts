import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, offlineAwareApiRequest, isOfflineQueueResult } from "@/lib/queryClient";

export function useClients() {
  return useQuery({
    queryKey: ["/api/clients"],
  });
}

export function useClient(clientId: string) {
  return useQuery({
    queryKey: ["/api/clients", clientId],
    enabled: !!clientId,
  });
}

export function useCreateClient() {
  return useMutation({
    mutationFn: async (clientData: any) => {
      const result = await offlineAwareApiRequest("POST", "/api/clients", clientData, { 
        mutationType: 'create_client' 
      });
      
      // If queued offline, return a temporary client object
      if (isOfflineQueueResult(result)) {
        return {
          id: `offline-${result.mutationId}`,
          ...clientData,
          isOffline: true,
          offlineMessage: result.message,
        };
      }
      
      return result.json();
    },
    onSuccess: (data) => {
      // Only invalidate if not offline (otherwise we'd try to fetch while offline)
      if (!data.isOffline) {
        queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      }
    },
  });
}