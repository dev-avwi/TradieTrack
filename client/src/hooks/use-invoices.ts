import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMemo } from "react";
import { partitionByRecent } from "@shared/dateUtils";

export function useInvoices() {
  return useQuery({
    queryKey: ["/api/invoices"],
  });
}

export function useRecentInvoices() {
  const { data: invoices = [], ...rest } = useInvoices();
  
  const partitioned = useMemo(() => {
    // Ensure invoices is an array with proper typing
    const invoicesArray = Array.isArray(invoices) ? invoices as any[] : [];
    return partitionByRecent(invoicesArray, 'createdAt');
  }, [invoices]);
  
  return {
    ...rest,
    data: invoices, // Keep original data for compatibility
    recent: partitioned.recent,
    older: partitioned.older,
  };
}

export function useCreateInvoice() {
  return useMutation({
    mutationFn: async (invoiceData: any) => {
      const response = await apiRequest("POST", "/api/invoices", invoiceData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
    },
  });
}

export function useSendInvoice() {
  return useMutation({
    mutationFn: async (invoiceId: string) => {
      // Always use skipEmail: true - user will send via Gmail themselves
      const response = await fetch(`/api/invoices/${invoiceId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ skipEmail: true })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to mark invoice as sent');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
    },
  });
}

export function useCreatePaymentLink() {
  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const response = await apiRequest("POST", `/api/invoices/${invoiceId}/create-checkout-session`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
    },
  });
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: ["/api/invoices", id],
    enabled: !!id,
  });
}

export function useInvoiceWithDetails(id: string) {
  return useQuery({
    queryKey: ["/api/invoices", id],
    enabled: !!id,
  });
}

export function useMarkInvoicePaid() {
  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const response = await apiRequest("POST", `/api/invoices/${invoiceId}/mark-paid`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
    },
  });
}