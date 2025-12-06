/**
 * React hooks for native services
 * 
 * Provides easy access to:
 * - Stripe Terminal (Tap to Pay)
 * - Push Notifications
 * - Offline Storage
 * - Location Tracking
 */

import { useEffect, useState, useCallback } from 'react';
import { Alert } from 'react-native';
import stripeTerminal, { TerminalStatus, Reader, PaymentIntent } from '../lib/stripe-terminal';
import notificationService, { NotificationPayload } from '../lib/notifications';
import offlineStorage, { OfflineStorageState, CachedJob } from '../lib/offline-storage';
import locationTracking, { TrackingStatus, LocationUpdate, GeofenceEvent } from '../lib/location-tracking';
import api from '../lib/api';

/**
 * Hook for Stripe Terminal (Tap to Pay)
 */
export function useStripeTerminal() {
  const [status, setStatus] = useState<TerminalStatus>('not_initialized');
  const [reader, setReader] = useState<Reader | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    stripeTerminal.onStatusUpdate(setStatus);
  }, []);

  const initialize = useCallback(async () => {
    try {
      setError(null);
      // Get connection token from backend
      const response = await api.post<{ secret: string }>('/api/stripe/terminal-connection-token');
      
      if (response.error || !response.data?.secret) {
        setError('Failed to get connection token');
        return false;
      }

      const success = await stripeTerminal.initialize(response.data.secret);
      if (!success) {
        setError('Failed to initialize Stripe Terminal');
      }
      return success;
    } catch (err) {
      setError('Failed to initialize Stripe Terminal');
      return false;
    }
  }, []);

  const connectReader = useCallback(async () => {
    try {
      setError(null);
      const connectedReader = await stripeTerminal.connectToLocalMobileReader();
      setReader(connectedReader);
      return connectedReader;
    } catch (err) {
      setError('Failed to connect to reader');
      return null;
    }
  }, []);

  const collectPayment = useCallback(async (
    amountInCents: number,
    description?: string
  ): Promise<PaymentIntent | null> => {
    try {
      setError(null);
      setIsProcessing(true);

      // Create payment intent on backend
      const intentResponse = await api.post<{ clientSecret: string }>('/api/stripe/create-terminal-payment-intent', {
        amount: amountInCents,
        description,
        currency: 'aud',
      });

      if (intentResponse.error || !intentResponse.data?.clientSecret) {
        setError('Failed to create payment intent');
        return null;
      }

      // Collect payment
      const result = await stripeTerminal.collectPayment(
        intentResponse.data.clientSecret,
        () => {
          // Card presented callback
          console.log('Card presented');
        }
      );

      return result;
    } catch (err) {
      setError('Payment collection failed');
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const cancelPayment = useCallback(async () => {
    await stripeTerminal.cancelCollectPayment();
    setIsProcessing(false);
  }, []);

  return {
    status,
    reader,
    isProcessing,
    error,
    initialize,
    connectReader,
    collectPayment,
    cancelPayment,
    isAvailable: stripeTerminal.isInitialized(),
  };
}

/**
 * Hook for Push Notifications
 */
export function useNotifications() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [pushToken, setPushToken] = useState<string | null>(null);

  const initialize = useCallback(async () => {
    const token = await notificationService.initialize();
    setPushToken(token);
    setIsInitialized(!!token);
    return token;
  }, []);

  const onNotification = useCallback((
    onReceived: (notification: NotificationPayload) => void,
    onTapped: (notification: NotificationPayload, action?: string) => void
  ) => {
    notificationService.onReceived(onReceived);
    notificationService.onTapped(onTapped);
  }, []);

  const scheduleReminder = useCallback(async (
    title: string,
    body: string,
    delaySeconds: number
  ) => {
    return notificationService.scheduleLocalNotification(title, body, {}, delaySeconds);
  }, []);

  const clearBadge = useCallback(async () => {
    await notificationService.clearBadge();
  }, []);

  useEffect(() => {
    return () => {
      notificationService.cleanup();
    };
  }, []);

  return {
    isInitialized,
    pushToken,
    initialize,
    onNotification,
    scheduleReminder,
    clearBadge,
  };
}

/**
 * Hook for Offline Storage
 */
export function useOfflineStorage() {
  const [state, setState] = useState<OfflineStorageState>({
    isOnline: true,
    lastSyncTime: null,
    pendingSyncCount: 0,
    isSyncing: false,
  });
  const [isInitialized, setIsInitialized] = useState(false);

  const initialize = useCallback(async () => {
    try {
      await offlineStorage.initialize();
      const currentState = await offlineStorage.getState();
      setState(currentState);
      setIsInitialized(true);
      return true;
    } catch (error) {
      console.error('Failed to initialize offline storage:', error);
      return false;
    }
  }, []);

  useEffect(() => {
    const unsubscribe = offlineStorage.subscribe(setState);
    return unsubscribe;
  }, []);

  const getCachedJobs = useCallback(async (status?: string): Promise<CachedJob[]> => {
    return offlineStorage.getCachedJobs(status);
  }, []);

  const cacheJobs = useCallback(async (jobs: any[]) => {
    await offlineStorage.cacheJobs(jobs);
  }, []);

  const updateJobOffline = useCallback(async (jobId: string, updates: Partial<CachedJob>) => {
    await offlineStorage.updateJobOffline(jobId, updates);
  }, []);

  const syncNow = useCallback(async () => {
    await offlineStorage.syncPendingChanges();
  }, []);

  const clearCache = useCallback(async () => {
    await offlineStorage.clearCache();
  }, []);

  return {
    ...state,
    isInitialized,
    initialize,
    getCachedJobs,
    cacheJobs,
    updateJobOffline,
    syncNow,
    clearCache,
  };
}

/**
 * Hook for Location Tracking
 */
export function useLocationTracking() {
  const [status, setStatus] = useState<TrackingStatus>('stopped');
  const [currentLocation, setCurrentLocation] = useState<LocationUpdate | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const initialize = useCallback(async () => {
    const success = await locationTracking.initialize();
    setIsInitialized(success);
    return success;
  }, []);

  useEffect(() => {
    locationTracking.onStatus(setStatus);
    locationTracking.onLocation(setCurrentLocation);
  }, []);

  const startTracking = useCallback(async () => {
    return locationTracking.startTracking();
  }, []);

  const stopTracking = useCallback(async () => {
    await locationTracking.stopTracking();
  }, []);

  const getCurrentLocation = useCallback(async () => {
    return locationTracking.getCurrentLocation();
  }, []);

  const addJobGeofence = useCallback(async (
    jobId: string,
    latitude: number,
    longitude: number,
    radius?: number
  ) => {
    return locationTracking.addJobGeofence(jobId, latitude, longitude, radius);
  }, []);

  const removeJobGeofence = useCallback(async (jobId: string) => {
    await locationTracking.removeJobGeofence(jobId);
  }, []);

  const onGeofenceEvent = useCallback((callback: (event: GeofenceEvent) => void) => {
    locationTracking.onGeofence(callback);
  }, []);

  return {
    status,
    currentLocation,
    isInitialized,
    isTracking: status === 'tracking',
    initialize,
    startTracking,
    stopTracking,
    getCurrentLocation,
    addJobGeofence,
    removeJobGeofence,
    onGeofenceEvent,
  };
}
