import { useState, useEffect, useCallback } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { offlineStore } from '../lib/offlineStore';

export interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: string | null;
  isWifi: boolean;
  isCellular: boolean;
}

export function useNetworkStatus() {
  const [status, setStatus] = useState<NetworkStatus>({
    isConnected: true,
    isInternetReachable: true,
    type: null,
    isWifi: false,
    isCellular: false,
  });

  const [pendingChanges, setPendingChanges] = useState<number>(0);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setStatus({
        isConnected: state.isConnected ?? false,
        isInternetReachable: state.isInternetReachable,
        type: state.type,
        isWifi: state.type === 'wifi',
        isCellular: state.type === 'cellular',
      });

      if (state.isConnected && state.isInternetReachable) {
        offlineStore.syncAll();
      }
    });

    NetInfo.fetch().then((state: NetInfoState) => {
      setStatus({
        isConnected: state.isConnected ?? false,
        isInternetReachable: state.isInternetReachable,
        type: state.type,
        isWifi: state.type === 'wifi',
        isCellular: state.type === 'cellular',
      });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const checkPendingChanges = async () => {
      const mutations = await offlineStore.getPendingMutations();
      setPendingChanges(mutations.length);
    };

    checkPendingChanges();
    const interval = setInterval(checkPendingChanges, 5000);
    return () => clearInterval(interval);
  }, []);

  const syncNow = useCallback(async () => {
    if (status.isConnected && status.isInternetReachable) {
      await offlineStore.syncAll();
      const mutations = await offlineStore.getPendingMutations();
      setPendingChanges(mutations.length);
    }
  }, [status]);

  return {
    ...status,
    isOffline: !status.isConnected || status.isInternetReachable === false,
    pendingChanges,
    syncNow,
  };
}

export default useNetworkStatus;
