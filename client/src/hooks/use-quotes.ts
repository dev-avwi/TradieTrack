import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMemo } from "react";
import { partitionByRecent } from "@shared/dateUtils";

export function useQuotes() {
  return useQuery({
    queryKey: ["/api/quotes"],
  });
}

export function useRecentQuotes() {
  const { data: quotes = [], ...rest } = useQuotes();
  
  const partitioned = useMemo(() => {
    // Ensure quotes is an array with proper typing
    const quotesArray = Array.isArray(quotes) ? quotes as any[] : [];
    return partitionByRecent(quotesArray, 'createdAt');
  }, [quotes]);
  
  return {
    ...rest,
    data: quotes, // Keep original data for compatibility
    recent: partitioned.recent,
    older: partitioned.older,
  };
}

export function useCreateQuote() {
  return useMutation({
    mutationFn: async (quoteData: any) => {
      const response = await apiRequest("POST", "/api/quotes", quoteData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
    },
  });
}

export function useSendQuote() {
  return useMutation({
    mutationFn: async (quoteId: string) => {
      // Always use skipEmail: true - user will send via Gmail themselves
      const response = await fetch(`/api/quotes/${quoteId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ skipEmail: true })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to mark quote as sent');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
    },
  });
}

export function useGenerateQuoteFromJob() {
  return useMutation({
    mutationFn: async (jobId: string) => {
      const response = await apiRequest("POST", `/api/jobs/${jobId}/generate-quote`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
    },
  });
}

export function useQuote(id: string) {
  return useQuery({
    queryKey: ["/api/quotes", id],
    enabled: !!id,
  });
}

export function useQuoteWithDetails(id: string) {
  return useQuery({
    queryKey: ["/api/quotes", id],
    enabled: !!id,
  });
}

export function useConvertQuoteToInvoice() {
  return useMutation({
    mutationFn: async (quoteId: string) => {
      const response = await apiRequest("POST", `/api/quotes/${quoteId}/convert-to-invoice`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
    },
  });
}