import { useQuery, useMutation } from "@tanstack/react-query";
import { offlineAwareApiRequest, safeInvalidateQueries } from "@/lib/queryClient";

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
      const response = await offlineAwareApiRequest("POST", "/api/clients", clientData);
      return response.json();
    },
    onSuccess: () => {
      safeInvalidateQueries({ queryKey: ["/api/clients"] });
    },
  });
}