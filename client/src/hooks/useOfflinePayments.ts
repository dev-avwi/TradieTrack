import { useState, useCallback, useEffect } from 'react';
import {
  saveDraftPayment,
  getAllDraftPayments,
  getPendingDraftPayments,
  deleteDraftPayment,
  markPaymentAsSynced,
  addToSyncQueue,
  generateOfflineId,
  isOnline,
  type DraftPayment,
} from '@/lib/offlineStorage';
import { useNetwork } from '@/contexts/NetworkContext';
import { apiRequest, queryClient } from '@/lib/queryClient';

export type PaymentMethod = 'cash' | 'eftpos' | 'bank_transfer' | 'card' | 'cheque' | 'other';

export interface RecordPaymentParams {
  invoiceId?: number;
  clientId?: number;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentDate?: string;
  reference?: string;
  notes?: string;
}

export interface UseOfflinePaymentsReturn {
  draftPayments: DraftPayment[];
  pendingPayments: DraftPayment[];
  isLoading: boolean;
  error: string | null;
  recordPayment: (params: RecordPaymentParams) => Promise<DraftPayment>;
  getPendingPayments: () => Promise<DraftPayment[]>;
  syncPayment: (paymentId: string | number) => Promise<boolean>;
  syncAllPayments: () => Promise<{ synced: number; failed: number }>;
  deleteDraft: (paymentId: string | number) => Promise<void>;
  refreshPayments: () => Promise<void>;
}

export function useOfflinePayments(): UseOfflinePaymentsReturn {
  const [draftPayments, setDraftPayments] = useState<DraftPayment[]>([]);
  const [pendingPayments, setPendingPayments] = useState<DraftPayment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isOnline: networkOnline, sync: triggerNetworkSync } = useNetwork();

  const refreshPayments = useCallback(async () => {
    try {
      setIsLoading(true);
      const [allPayments, pending] = await Promise.all([
        getAllDraftPayments(),
        getPendingDraftPayments(),
      ]);
      setDraftPayments(allPayments);
      setPendingPayments(pending);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payments');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshPayments();
  }, [refreshPayments]);

  useEffect(() => {
    if (networkOnline && pendingPayments.length > 0) {
      syncAllPayments();
    }
  }, [networkOnline]);

  const recordPayment = useCallback(async (params: RecordPaymentParams): Promise<DraftPayment> => {
    const paymentId = generateOfflineId();
    const now = new Date().toISOString();
    
    const payment: DraftPayment = {
      id: paymentId,
      invoiceId: params.invoiceId,
      clientId: params.clientId,
      amount: params.amount,
      paymentMethod: params.paymentMethod,
      paymentDate: params.paymentDate || now,
      reference: params.reference,
      notes: params.notes,
      status: 'pending',
      createdAt: now,
    };

    const savedPayment = await saveDraftPayment(payment);

    await addToSyncQueue({
      type: 'create',
      storeName: 'payments',
      data: savedPayment,
      endpoint: '/api/payments',
      method: 'POST',
    });

    await refreshPayments();

    if (isOnline()) {
      triggerNetworkSync();
    }

    return savedPayment;
  }, [refreshPayments, triggerNetworkSync]);

  const getPendingPaymentsAsync = useCallback(async (): Promise<DraftPayment[]> => {
    const pending = await getPendingDraftPayments();
    setPendingPayments(pending);
    return pending;
  }, []);

  const syncPayment = useCallback(async (paymentId: string | number): Promise<boolean> => {
    if (!isOnline()) {
      setError('Cannot sync while offline');
      return false;
    }

    try {
      const payments = await getAllDraftPayments();
      const payment = payments.find(p => p.id === paymentId);
      
      if (!payment) {
        setError('Payment not found');
        return false;
      }

      if (payment.status === 'synced') {
        return true;
      }

      const payloadData: Record<string, any> = {
        amount: payment.amount,
        paymentMethod: payment.paymentMethod,
        paymentDate: payment.paymentDate,
        reference: payment.reference,
        notes: payment.notes,
      };

      if (payment.invoiceId) {
        payloadData.invoiceId = payment.invoiceId;
      }
      if (payment.clientId) {
        payloadData.clientId = payment.clientId;
      }

      await apiRequest('POST', '/api/payments', payloadData);

      await markPaymentAsSynced(paymentId);
      
      queryClient.invalidateQueries({ queryKey: ['/api/payments'] });
      if (payment.invoiceId) {
        queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      }
      
      await refreshPayments();
      setError(null);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sync payment';
      setError(errorMessage);
      return false;
    }
  }, [refreshPayments]);

  const syncAllPayments = useCallback(async (): Promise<{ synced: number; failed: number }> => {
    const pending = await getPendingDraftPayments();
    let synced = 0;
    let failed = 0;

    for (const payment of pending) {
      const success = await syncPayment(payment.id);
      if (success) {
        synced++;
      } else {
        failed++;
      }
    }

    return { synced, failed };
  }, [syncPayment]);

  const deleteDraft = useCallback(async (paymentId: string | number): Promise<void> => {
    await deleteDraftPayment(paymentId);
    await refreshPayments();
  }, [refreshPayments]);

  return {
    draftPayments,
    pendingPayments,
    isLoading,
    error,
    recordPayment,
    getPendingPayments: getPendingPaymentsAsync,
    syncPayment,
    syncAllPayments,
    deleteDraft,
    refreshPayments,
  };
}

export default useOfflinePayments;
