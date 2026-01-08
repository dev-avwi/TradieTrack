import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  saveItem,
  getAllItems,
  getItem,
  deleteItem,
  addToSyncQueue,
  generateOfflineId,
  isOnline,
} from '@/lib/offlineStorage';
import { processSyncQueue, resolveId } from '@/lib/syncService';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

type StoreName = 'clients' | 'jobs' | 'quotes' | 'invoices';

interface UseOfflineDataOptions<T> {
  storeName: StoreName;
  apiEndpoint: string;
  queryKey: string[];
  idField?: keyof T;
}

interface UseOfflineDataResult<T> {
  data: T[] | undefined;
  isLoading: boolean;
  isOffline: boolean;
  isSyncing: boolean;
  pendingSyncs: number;
  create: (item: Omit<T, 'id'>) => Promise<T>;
  update: (id: string | number, updates: Partial<T>) => Promise<T>;
  remove: (id: string | number) => Promise<void>;
  sync: () => Promise<void>;
  refetch: () => void;
}

export function useOfflineData<T extends { id: string | number }>(
  options: UseOfflineDataOptions<T>
): UseOfflineDataResult<T> {
  const { storeName, apiEndpoint, queryKey, idField = 'id' as keyof T } = options;
  const queryClientInstance = useQueryClient();
  const { toast } = useToast();
  
  const [isOffline, setIsOffline] = useState(!isOnline());
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingSyncs, setPendingSyncs] = useState(0);
  const [cachedData, setCachedData] = useState<T[] | undefined>(undefined);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      performSync();
    };
    
    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    loadCachedData();
    updatePendingCount();
  }, [storeName]);

  const loadCachedData = async () => {
    try {
      const items = await getAllItems<T>(storeName);
      setCachedData(items);
    } catch (error) {
      console.error('Failed to load cached data:', error);
    }
  };

  const updatePendingCount = async () => {
    try {
      const queue = await getAllItems<any>('syncQueue');
      const count = queue.filter(op => op.storeName === storeName).length;
      setPendingSyncs(count);
    } catch {
      setPendingSyncs(0);
    }
  };

  const performSync = async () => {
    if (isSyncing || !isOnline()) return;
    
    setIsSyncing(true);
    try {
      const result = await processSyncQueue();
      
      if (result.synced > 0) {
        toast({
          title: 'Synced',
          description: `${result.synced} offline change${result.synced > 1 ? 's' : ''} synced.`,
        });
        queryClientInstance.invalidateQueries({ queryKey });
      }
      
      if (result.failed > 0) {
        toast({
          title: 'Sync Issues',
          description: `${result.failed} change${result.failed > 1 ? 's' : ''} failed to sync.`,
          variant: 'destructive',
        });
      }
      
      await updatePendingCount();
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const query = useQuery<T[]>({
    queryKey,
    enabled: !isOffline,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (query.data && !isOffline) {
      cacheApiResponse(query.data);
    }
  }, [query.data, isOffline]);

  const cacheApiResponse = async (items: T[]) => {
    try {
      for (const item of items) {
        await saveItem(storeName, item);
      }
      setCachedData(items);
    } catch (error) {
      console.error('Failed to cache API response:', error);
    }
  };

  const create = useCallback(async (itemData: Omit<T, 'id'>): Promise<T> => {
    const offlineId = generateOfflineId();
    const newItem = { ...itemData, id: offlineId } as T;

    await saveItem(storeName, newItem);
    setCachedData(prev => prev ? [...prev, newItem] : [newItem]);

    if (isOnline()) {
      try {
        const response = await apiRequest('POST', apiEndpoint, itemData);
        const serverItem = await response.json();
        
        await deleteItem(storeName, offlineId);
        await saveItem(storeName, serverItem);
        
        setCachedData(prev => 
          prev ? prev.map(item => item.id === offlineId ? serverItem : item) : [serverItem]
        );
        
        queryClientInstance.invalidateQueries({ queryKey });
        return serverItem;
      } catch (error) {
        await addToSyncQueue({
          type: 'create',
          storeName,
          data: newItem,
          endpoint: apiEndpoint,
          method: 'POST',
        });
        
        await updatePendingCount();
        
        toast({
          title: 'Saved Offline',
          description: 'Changes will sync when you reconnect.',
        });
        
        return newItem;
      }
    } else {
      await addToSyncQueue({
        type: 'create',
        storeName,
        data: newItem,
        endpoint: apiEndpoint,
        method: 'POST',
      });
      
      await updatePendingCount();
      
      toast({
        title: 'Saved Offline',
        description: 'Changes will sync when you reconnect.',
      });
      
      return newItem;
    }
  }, [storeName, apiEndpoint, queryKey, isOffline, toast]);

  const update = useCallback(async (id: string | number, updates: Partial<T>): Promise<T> => {
    const resolvedId = resolveId(id);
    const existingItem = await getItem<T>(storeName, id) || await getItem<T>(storeName, resolvedId);
    
    if (!existingItem) {
      throw new Error(`Item with id ${id} not found`);
    }

    const updatedItem = { ...existingItem, ...updates } as T;
    
    await saveItem(storeName, updatedItem);
    setCachedData(prev => 
      prev ? prev.map(item => item.id === id || item.id === resolvedId ? updatedItem : item) : [updatedItem]
    );

    if (isOnline()) {
      try {
        const response = await apiRequest('PATCH', `${apiEndpoint}/${resolvedId}`, updates);
        const serverItem = await response.json();
        
        await saveItem(storeName, serverItem);
        setCachedData(prev => 
          prev ? prev.map(item => item.id === id || item.id === resolvedId ? serverItem : item) : [serverItem]
        );
        
        queryClientInstance.invalidateQueries({ queryKey });
        return serverItem;
      } catch (error) {
        await addToSyncQueue({
          type: 'update',
          storeName,
          data: updatedItem,
          endpoint: `${apiEndpoint}/${resolvedId}`,
          method: 'PATCH',
        });
        
        await updatePendingCount();
        
        toast({
          title: 'Saved Offline',
          description: 'Changes will sync when you reconnect.',
        });
        
        return updatedItem;
      }
    } else {
      await addToSyncQueue({
        type: 'update',
        storeName,
        data: updatedItem,
        endpoint: `${apiEndpoint}/${resolvedId}`,
        method: 'PATCH',
      });
      
      await updatePendingCount();
      
      toast({
        title: 'Saved Offline',
        description: 'Changes will sync when you reconnect.',
      });
      
      return updatedItem;
    }
  }, [storeName, apiEndpoint, queryKey, isOffline, toast]);

  const remove = useCallback(async (id: string | number): Promise<void> => {
    const resolvedId = resolveId(id);
    
    await deleteItem(storeName, id);
    setCachedData(prev => prev ? prev.filter(item => item.id !== id && item.id !== resolvedId) : []);

    if (isOnline()) {
      try {
        await apiRequest('DELETE', `${apiEndpoint}/${resolvedId}`);
        queryClientInstance.invalidateQueries({ queryKey });
      } catch (error) {
        await addToSyncQueue({
          type: 'delete',
          storeName,
          data: { id: resolvedId },
          endpoint: `${apiEndpoint}/${resolvedId}`,
          method: 'DELETE',
        });
        
        await updatePendingCount();
        
        toast({
          title: 'Saved Offline',
          description: 'Changes will sync when you reconnect.',
        });
      }
    } else {
      await addToSyncQueue({
        type: 'delete',
        storeName,
        data: { id: resolvedId },
        endpoint: `${apiEndpoint}/${resolvedId}`,
        method: 'DELETE',
      });
      
      await updatePendingCount();
      
      toast({
        title: 'Saved Offline',
        description: 'Changes will sync when you reconnect.',
      });
    }
  }, [storeName, apiEndpoint, queryKey, isOffline, toast]);

  const refetch = useCallback(() => {
    if (!isOffline) {
      queryClientInstance.invalidateQueries({ queryKey });
    }
    loadCachedData();
  }, [queryKey, isOffline]);

  const effectiveData = isOffline ? cachedData : (query.data ?? cachedData);

  return {
    data: effectiveData,
    isLoading: !isOffline && query.isLoading,
    isOffline,
    isSyncing,
    pendingSyncs,
    create,
    update,
    remove,
    sync: performSync,
    refetch,
  };
}

export function useOfflineClients() {
  return useOfflineData<any>({
    storeName: 'clients',
    apiEndpoint: '/api/clients',
    queryKey: ['/api/clients'],
  });
}

export function useOfflineJobs() {
  return useOfflineData<any>({
    storeName: 'jobs',
    apiEndpoint: '/api/jobs',
    queryKey: ['/api/jobs'],
  });
}

export function useOfflineQuotes() {
  return useOfflineData<any>({
    storeName: 'quotes',
    apiEndpoint: '/api/quotes',
    queryKey: ['/api/quotes'],
  });
}

export function useOfflineInvoices() {
  return useOfflineData<any>({
    storeName: 'invoices',
    apiEndpoint: '/api/invoices',
    queryKey: ['/api/invoices'],
  });
}
