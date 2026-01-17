import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  saveTimeEntry,
  getAllTimeEntries,
  getTimeEntriesForJob,
  deleteTimeEntry,
  getTimeEntry,
  addToSyncQueue,
  generateOfflineId,
  isOnline,
  getSyncQueue,
  type TimeEntry as BaseTimeEntry,
} from '@/lib/offlineStorage';
import { syncManager } from '@/lib/syncManager';
import { apiRequest, safeInvalidateQueries } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

const ACTIVE_TIMER_KEY = 'tradietrack_active_timer';
const HEARTBEAT_INTERVAL_MS = 30000;

export interface OfflineTimeEntry extends BaseTimeEntry {
  pendingSync?: boolean;
  syncStatus?: 'pending' | 'synced' | 'failed';
  isBreak?: boolean;
  breakTime?: number;
}

interface ActiveTimer {
  id: string;
  jobId?: number | string;
  userId?: number;
  startTime: string;
  description?: string;
  hourlyRate?: number;
  isBreak?: boolean;
  lastHeartbeat?: number;
}

interface UseOfflineTimeTrackingOptions {
  jobId?: number | string;
  userId?: number;
}

interface UseOfflineTimeTrackingReturn {
  entries: OfflineTimeEntry[];
  activeTimer: ActiveTimer | null;
  isLoading: boolean;
  isOffline: boolean;
  isSyncing: boolean;
  pendingSyncs: number;
  startTimer: (data: StartTimerData) => Promise<OfflineTimeEntry>;
  stopTimer: (timerId?: string) => Promise<OfflineTimeEntry | null>;
  pauseTimer: () => Promise<OfflineTimeEntry | null>;
  resumeTimer: (data?: StartTimerData) => Promise<OfflineTimeEntry>;
  getActiveTimer: () => ActiveTimer | null;
  getEntriesForJob: (jobId: number) => Promise<OfflineTimeEntry[]>;
  deleteEntry: (id: string | number) => Promise<void>;
  sync: () => Promise<void>;
  refetch: () => void;
}

interface StartTimerData {
  description?: string;
  hourlyRate?: number;
  isBreak?: boolean;
}

function getActiveTimerFromStorage(): ActiveTimer | null {
  try {
    const stored = localStorage.getItem(ACTIVE_TIMER_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.warn('Failed to parse active timer from storage:', error);
  }
  return null;
}

function saveActiveTimerToStorage(timer: ActiveTimer | null): void {
  try {
    if (timer) {
      localStorage.setItem(ACTIVE_TIMER_KEY, JSON.stringify(timer));
    } else {
      localStorage.removeItem(ACTIVE_TIMER_KEY);
    }
  } catch (error) {
    console.warn('Failed to save active timer to storage:', error);
  }
}

export function useOfflineTimeTracking(
  options: UseOfflineTimeTrackingOptions = {}
): UseOfflineTimeTrackingReturn {
  const { jobId, userId } = options;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [isOffline, setIsOffline] = useState(!isOnline());
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingSyncs, setPendingSyncs] = useState(0);
  const [cachedEntries, setCachedEntries] = useState<OfflineTimeEntry[]>([]);
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(getActiveTimerFromStorage);
  
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

    const unsubscribeOnline = syncManager.on('online', handleOnline);
    const unsubscribeOffline = syncManager.on('offline', handleOffline);
    const unsubscribeSyncComplete = syncManager.on('syncComplete', () => {
      updatePendingCount();
      loadCachedEntries();
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribeOnline();
      unsubscribeOffline();
      unsubscribeSyncComplete();
    };
  }, []);

  useEffect(() => {
    loadCachedEntries();
    updatePendingCount();
    const storedTimer = getActiveTimerFromStorage();
    if (storedTimer) {
      setActiveTimer(storedTimer);
    }
  }, [jobId]);

  useEffect(() => {
    if (activeTimer) {
      heartbeatIntervalRef.current = setInterval(() => {
        performHeartbeat();
      }, HEARTBEAT_INTERVAL_MS);

      performHeartbeat();

      return () => {
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
        }
      };
    } else {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    }
  }, [activeTimer?.id]);

  const performHeartbeat = useCallback(async () => {
    if (!activeTimer) return;

    const updatedTimer = {
      ...activeTimer,
      lastHeartbeat: Date.now(),
    };
    saveActiveTimerToStorage(updatedTimer);
    setActiveTimer(updatedTimer);

    const entryUpdate: OfflineTimeEntry = {
      id: activeTimer.id,
      jobId: typeof activeTimer.jobId === 'string' ? parseInt(activeTimer.jobId, 10) : activeTimer.jobId,
      userId: activeTimer.userId,
      startTime: activeTimer.startTime,
      description: activeTimer.description,
      hourlyRate: activeTimer.hourlyRate,
      isBreak: activeTimer.isBreak,
      updatedAt: new Date().toISOString(),
    };
    
    try {
      await saveTimeEntry(entryUpdate);
    } catch (error) {
      console.warn('Heartbeat save failed:', error);
    }

    if (isOnline() && !activeTimer.id.startsWith('offline_')) {
      try {
        await fetch(`/api/time-entries/${activeTimer.id}/heartbeat`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        console.debug('Server heartbeat failed (non-critical):', error);
      }
    }
  }, [activeTimer, isOnline]);

  const loadCachedEntries = async () => {
    try {
      let entries: OfflineTimeEntry[];
      if (jobId) {
        entries = await getTimeEntriesForJob(typeof jobId === 'string' ? parseInt(jobId, 10) : jobId);
      } else {
        entries = await getAllTimeEntries();
      }
      setCachedEntries(entries);
    } catch (error) {
      console.error('Failed to load cached entries:', error);
    }
  };

  const updatePendingCount = async () => {
    try {
      const queue = await getSyncQueue();
      const count = queue.filter(op => op.storeName === 'timeEntries').length;
      setPendingSyncs(count);
    } catch {
      setPendingSyncs(0);
    }
  };

  const performSync = async () => {
    if (isSyncing || !isOnline()) return;
    
    setIsSyncing(true);
    try {
      await syncManager.triggerSync();
      await updatePendingCount();
      await loadCachedEntries();
      safeInvalidateQueries({ queryKey: ['/api/time-entries'] });
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const queryFn = useCallback(async (): Promise<OfflineTimeEntry[]> => {
    if (!isOnline()) {
      return cachedEntries;
    }
    
    try {
      const endpoint = jobId ? `/api/time-entries?jobId=${jobId}` : '/api/time-entries';
      const response = await apiRequest('GET', endpoint);
      const data = await response.json();
      
      for (const item of data) {
        await saveTimeEntry({ ...item, syncStatus: 'synced' });
      }
      
      const offlineEntries = cachedEntries.filter(e => 
        e.id.toString().startsWith('offline_') && e.pendingSync
      );
      
      return [...data, ...offlineEntries];
    } catch (error) {
      return cachedEntries;
    }
  }, [jobId, cachedEntries]);

  const query = useQuery<OfflineTimeEntry[]>({
    queryKey: jobId ? ['/api/time-entries', jobId] : ['/api/time-entries'],
    queryFn,
    staleTime: 60000,
    refetchInterval: isOffline ? false : 60000,
  });

  useEffect(() => {
    if (query.data && !isOffline) {
      for (const entry of query.data) {
        saveTimeEntry({ ...entry, syncStatus: 'synced' }).catch(() => {});
      }
      setCachedEntries(query.data);
    }
  }, [query.data, isOffline]);

  const startTimer = useCallback(async (data: StartTimerData = {}): Promise<OfflineTimeEntry> => {
    if (activeTimer) {
      throw new Error('A timer is already running. Stop it before starting a new one.');
    }

    const offlineId = generateOfflineId();
    const startTime = new Date().toISOString();
    
    const newEntry: OfflineTimeEntry = {
      id: offlineId,
      jobId: typeof jobId === 'string' ? parseInt(jobId, 10) : jobId,
      userId: userId,
      startTime,
      description: data.description || (data.isBreak ? 'Break' : 'Work session'),
      hourlyRate: data.hourlyRate,
      isBreak: data.isBreak || false,
      pendingSync: true,
      syncStatus: 'pending',
      createdAt: startTime,
    };

    await saveTimeEntry(newEntry);
    setCachedEntries(prev => [...prev, newEntry]);

    const timer: ActiveTimer = {
      id: offlineId,
      jobId,
      userId,
      startTime,
      description: newEntry.description,
      hourlyRate: data.hourlyRate,
      isBreak: data.isBreak,
      lastHeartbeat: Date.now(),
    };
    saveActiveTimerToStorage(timer);
    setActiveTimer(timer);

    if (isOnline()) {
      try {
        const response = await apiRequest('POST', '/api/time-entries', {
          jobId: newEntry.jobId,
          description: newEntry.description,
          hourlyRate: newEntry.hourlyRate?.toString(),
          isBreak: newEntry.isBreak,
        });
        const serverEntry = await response.json();
        
        await deleteTimeEntry(offlineId);
        await saveTimeEntry({ ...serverEntry, syncStatus: 'synced' });
        
        const updatedTimer = { ...timer, id: serverEntry.id };
        saveActiveTimerToStorage(updatedTimer);
        setActiveTimer(updatedTimer);
        
        setCachedEntries(prev => 
          prev.map(e => e.id === offlineId ? { ...serverEntry, syncStatus: 'synced' } : e)
        );
        
        safeInvalidateQueries({ queryKey: ['/api/time-entries'] });
        
        return serverEntry;
      } catch (error) {
        await addToSyncQueue({
          type: 'create',
          storeName: 'timeEntries',
          data: newEntry,
          endpoint: '/api/time-entries',
          method: 'POST',
        });
        
        await updatePendingCount();
        
        toast({
          title: 'Timer Started (Offline)',
          description: 'Timer will sync when you reconnect.',
        });
        
        return newEntry;
      }
    } else {
      await addToSyncQueue({
        type: 'create',
        storeName: 'timeEntries',
        data: newEntry,
        endpoint: '/api/time-entries',
        method: 'POST',
      });
      
      await updatePendingCount();
      
      toast({
        title: 'Timer Started (Offline)',
        description: 'Timer will sync when you reconnect.',
      });
      
      return newEntry;
    }
  }, [activeTimer, jobId, userId, toast]);

  const stopTimer = useCallback(async (timerId?: string): Promise<OfflineTimeEntry | null> => {
    const timerToStop = timerId ? { id: timerId } : activeTimer;
    if (!timerToStop) {
      return null;
    }

    const endTime = new Date().toISOString();
    const existingEntry = await getTimeEntry(timerToStop.id);
    
    const startTime = existingEntry?.startTime || activeTimer?.startTime;
    if (!startTime) {
      throw new Error('Cannot find start time for timer');
    }
    
    const durationMs = new Date(endTime).getTime() - new Date(startTime).getTime();
    const duration = Math.floor(durationMs / 60000);

    const updatedEntry: OfflineTimeEntry = {
      ...existingEntry,
      id: timerToStop.id,
      endTime,
      duration,
      pendingSync: true,
      syncStatus: 'pending',
      updatedAt: endTime,
    };

    await saveTimeEntry(updatedEntry);
    setCachedEntries(prev => 
      prev.map(e => e.id === timerToStop.id ? updatedEntry : e)
    );

    saveActiveTimerToStorage(null);
    setActiveTimer(null);

    if (isOnline() && !timerToStop.id.toString().startsWith('offline_')) {
      try {
        const response = await apiRequest('POST', `/api/time-entries/${timerToStop.id}/stop`);
        const serverEntry = await response.json();
        
        await saveTimeEntry({ ...serverEntry, syncStatus: 'synced' });
        
        setCachedEntries(prev => 
          prev.map(e => e.id === timerToStop.id ? { ...serverEntry, syncStatus: 'synced' } : e)
        );
        
        safeInvalidateQueries({ queryKey: ['/api/time-entries'] });
        
        return serverEntry;
      } catch (error) {
        await addToSyncQueue({
          type: 'update',
          storeName: 'timeEntries',
          data: updatedEntry,
          endpoint: `/api/time-entries/${timerToStop.id}/stop`,
          method: 'POST',
        });
        
        await updatePendingCount();
        
        toast({
          title: 'Time Saved (Offline)',
          description: 'Entry will sync when you reconnect.',
        });
        
        return updatedEntry;
      }
    } else {
      if (timerToStop.id.toString().startsWith('offline_')) {
        await addToSyncQueue({
          type: 'update',
          storeName: 'timeEntries',
          data: updatedEntry,
          endpoint: `/api/time-entries/${timerToStop.id}`,
          method: 'PATCH',
        });
      }
      
      await updatePendingCount();
      
      toast({
        title: 'Time Saved (Offline)',
        description: 'Entry will sync when you reconnect.',
      });
      
      return updatedEntry;
    }
  }, [activeTimer, toast]);

  const pauseTimer = useCallback(async (): Promise<OfflineTimeEntry | null> => {
    if (!activeTimer || activeTimer.isBreak) {
      return null;
    }

    const stoppedEntry = await stopTimer();
    
    if (stoppedEntry) {
      const breakEntry = await startTimer({
        description: `Break - ${activeTimer.description || 'Work session'}`,
        isBreak: true,
      });
      return breakEntry;
    }
    
    return null;
  }, [activeTimer, stopTimer, startTimer]);

  const resumeTimer = useCallback(async (data: StartTimerData = {}): Promise<OfflineTimeEntry> => {
    if (activeTimer && !activeTimer.isBreak) {
      throw new Error('Work timer is already running.');
    }

    if (activeTimer && activeTimer.isBreak) {
      await stopTimer();
    }

    const workEntry = await startTimer({
      description: data.description || 'Work session',
      hourlyRate: data.hourlyRate,
      isBreak: false,
    });
    
    return workEntry;
  }, [activeTimer, stopTimer, startTimer]);

  const getActiveTimerFn = useCallback((): ActiveTimer | null => {
    return activeTimer;
  }, [activeTimer]);

  const getEntriesForJobFn = useCallback(async (targetJobId: number): Promise<OfflineTimeEntry[]> => {
    try {
      const entries = await getTimeEntriesForJob(targetJobId);
      return entries;
    } catch (error) {
      console.error('Failed to get entries for job:', error);
      return [];
    }
  }, []);

  const deleteEntryFn = useCallback(async (id: string | number): Promise<void> => {
    await deleteTimeEntry(id);
    setCachedEntries(prev => prev.filter(e => e.id !== id));

    if (isOnline() && !id.toString().startsWith('offline_')) {
      try {
        await apiRequest('DELETE', `/api/time-entries/${id}`);
        safeInvalidateQueries({ queryKey: ['/api/time-entries'] });
      } catch (error) {
        await addToSyncQueue({
          type: 'delete',
          storeName: 'timeEntries',
          data: { id },
          endpoint: `/api/time-entries/${id}`,
          method: 'DELETE',
        });
        
        await updatePendingCount();
        
        toast({
          title: 'Deleted (Offline)',
          description: 'Deletion will sync when you reconnect.',
        });
      }
    } else {
      if (!id.toString().startsWith('offline_')) {
        await addToSyncQueue({
          type: 'delete',
          storeName: 'timeEntries',
          data: { id },
          endpoint: `/api/time-entries/${id}`,
          method: 'DELETE',
        });
        
        await updatePendingCount();
      }
      
      toast({
        title: 'Entry Deleted',
        description: 'Changes saved locally.',
      });
    }
  }, [toast]);

  const refetch = useCallback(() => {
    if (!isOffline) {
      safeInvalidateQueries({ queryKey: ['/api/time-entries'] });
      if (jobId) {
        safeInvalidateQueries({ queryKey: ['/api/time-entries', jobId] });
      }
    }
    loadCachedEntries();
  }, [isOffline, jobId]);

  const effectiveEntries = isOffline ? cachedEntries : (query.data ?? cachedEntries);

  return {
    entries: effectiveEntries,
    activeTimer,
    isLoading: !isOffline && query.isLoading,
    isOffline,
    isSyncing,
    pendingSyncs,
    startTimer,
    stopTimer,
    pauseTimer,
    resumeTimer,
    getActiveTimer: getActiveTimerFn,
    getEntriesForJob: getEntriesForJobFn,
    deleteEntry: deleteEntryFn,
    sync: performSync,
    refetch,
  };
}

export default useOfflineTimeTracking;
