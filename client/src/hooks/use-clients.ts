import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

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
      const response = await apiRequest("POST", "/api/clients", clientData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
    },
  });
}