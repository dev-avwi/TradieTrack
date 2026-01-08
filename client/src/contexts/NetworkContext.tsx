import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { getSyncQueue } from "@/lib/offlineStorage";
import { processSyncQueue, type SyncResult } from "@/lib/syncService";
import { triggerSync, registerSW } from "@/lib/registerServiceWorker";

interface NetworkContextValue {
  isOnline: boolean;
  isSyncing: boolean;
  pendingSyncCount: number;
  lastSyncTime: Date | null;
  lastSyncResult: SyncResult | null;
  sync: () => Promise<void>;
}

const NetworkContext = createContext<NetworkContextValue | null>(null);

export function useNetwork() {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error("useNetwork must be used within a NetworkProvider");
  }
  return context;
}

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);

  const updatePendingCount = useCallback(async () => {
    try {
      const queue = await getSyncQueue();
      setPendingSyncCount(queue.length);
    } catch (error) {
      console.error("Failed to get sync queue count:", error);
    }
  }, []);

  const sync = useCallback(async () => {
    if (isSyncing || !isOnline) return;

    setIsSyncing(true);
    try {
      const result = await processSyncQueue();
      setLastSyncResult(result);
      setLastSyncTime(new Date());
      await updatePendingCount();
    } catch (error) {
      console.error("Sync failed:", error);
      setLastSyncResult({
        success: false,
        synced: 0,
        failed: 1,
        errors: [{ operation: {} as any, error: String(error) }],
      });
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, isOnline, updatePendingCount]);

  useEffect(() => {
    registerSW();
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      sync();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [sync]);

  useEffect(() => {
    const handleSwSync = () => {
      sync();
    };

    window.addEventListener("sw-sync-triggered", handleSwSync);

    return () => {
      window.removeEventListener("sw-sync-triggered", handleSwSync);
    };
  }, [sync]);

  useEffect(() => {
    updatePendingCount();
    const interval = setInterval(updatePendingCount, 10000);
    return () => clearInterval(interval);
  }, [updatePendingCount]);

  useEffect(() => {
    if (isOnline && pendingSyncCount > 0 && !isSyncing) {
      sync();
    }
  }, [isOnline, pendingSyncCount, isSyncing, sync]);

  return (
    <NetworkContext.Provider
      value={{
        isOnline,
        isSyncing,
        pendingSyncCount,
        lastSyncTime,
        lastSyncResult,
        sync,
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
}
