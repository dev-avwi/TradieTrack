import { useState, useCallback, useEffect } from 'react';
import {
  saveDraftPayment,
  getAllDraftPayments,
  getPendingDraftPayments,
  deleteDraftPayment,
  addToSyncQueue,
  generateOfflineId,
  isOnline,
  type DraftPayment,
} from '@/lib/offlineStorage';
import { useNetwork } from '@/contexts/NetworkContext';
import { syncManager } from '@/lib/syncManager';

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
  const { isOnline: networkOnline } = useNetwork();

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
      syncManager.triggerSync();
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
      syncManager.triggerSync();
    }

    return savedPayment;
  }, [refreshPayments]);

  const getPendingPaymentsAsync = useCallback(async (): Promise<DraftPayment[]> => {
    const pending = await getPendingDraftPayments();
    setPendingPayments(pending);
    return pending;
  }, []);

  const syncPayment = useCallback(async (_paymentId: string | number): Promise<boolean> => {
    if (!isOnline()) {
      setError('Cannot sync while offline');
      return false;
    }

    try {
      await syncManager.triggerSync();
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
    if (!isOnline()) {
      return { synced: 0, failed: 0 };
    }
    
    const pendingBefore = await getPendingDraftPayments();
    await syncManager.triggerSync();
    const pendingAfter = await getPendingDraftPayments();
    
    const synced = pendingBefore.length - pendingAfter.length;
    const failed = pendingAfter.length;
    
    await refreshPayments();
    return { synced: Math.max(0, synced), failed };
  }, [refreshPayments]);

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
