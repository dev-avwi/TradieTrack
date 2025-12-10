/**
 * Location Tracking Store
 * 
 * Zustand store for managing location tracking state in the mobile app.
 * Integrates with the LocationTrackingService for background location updates.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import locationTracking, { 
  LocationUpdate, 
  GeofenceEvent, 
  TrackingStatus 
} from './location-tracking';

interface LocationState {
  isEnabled: boolean;
  status: TrackingStatus;
  lastLocation: LocationUpdate | null;
  lastGeofenceEvent: GeofenceEvent | null;
  batteryLevel: number | null;
  isMoving: boolean;
  permissionGranted: boolean;
  errorMessage: string | null;
}

interface LocationActions {
  enableTracking: () => Promise<boolean>;
  disableTracking: () => Promise<void>;
  updateLocation: (location: LocationUpdate) => void;
  updateGeofenceEvent: (event: GeofenceEvent) => void;
  updateStatus: (status: TrackingStatus) => void;
  setPermissionGranted: (granted: boolean) => void;
  setError: (message: string | null) => void;
  setBatteryLevel: (level: number) => void;
  refreshCurrentLocation: () => Promise<LocationUpdate | null>;
  initializeTracking: () => Promise<void>;
}

type LocationStore = LocationState & LocationActions;

export const useLocationStore = create<LocationStore>()(
  persist(
    (set, get) => ({
      isEnabled: false,
      status: 'stopped',
      lastLocation: null,
      lastGeofenceEvent: null,
      batteryLevel: null,
      isMoving: false,
      permissionGranted: false,
      errorMessage: null,

      initializeTracking: async () => {
        try {
          const granted = await locationTracking.initialize();
          set({ permissionGranted: granted });

          if (granted) {
            locationTracking.onLocation((location) => {
              get().updateLocation(location);
            });

            locationTracking.onGeofence((event) => {
              get().updateGeofenceEvent(event);
            });

            locationTracking.onStatus((status) => {
              get().updateStatus(status);
            });

            const wasEnabled = get().isEnabled;
            if (wasEnabled) {
              await locationTracking.startTracking();
            }
          }
        } catch (error: any) {
          console.log('[LocationStore] Initialization:', error?.message || 'Skipped');
          set({ errorMessage: error?.message || 'Location tracking unavailable' });
        }
      },

      enableTracking: async () => {
        const { permissionGranted } = get();
        
        if (!permissionGranted) {
          const granted = await locationTracking.initialize();
          set({ permissionGranted: granted });
          
          if (!granted) {
            set({ errorMessage: 'Location permission not granted' });
            return false;
          }
        }

        // Register callbacks BEFORE starting tracking so we receive status updates
        locationTracking.onLocation((location) => {
          get().updateLocation(location);
        });

        locationTracking.onGeofence((event) => {
          get().updateGeofenceEvent(event);
        });

        locationTracking.onStatus((status) => {
          get().updateStatus(status);
        });

        // Set status to starting immediately
        set({ status: 'starting', isEnabled: true, errorMessage: null });

        const success = await locationTracking.startTracking();
        
        if (!success) {
          set({ isEnabled: false, status: 'error', errorMessage: 'Failed to start location tracking' });
        }

        return success;
      },

      disableTracking: async () => {
        await locationTracking.stopTracking();
        set({ isEnabled: false, status: 'stopped' });
      },

      updateLocation: (location: LocationUpdate) => {
        const { lastLocation } = get();
        
        const isMoving = location.speed !== null && location.speed > 1;
        
        set({ 
          lastLocation: location,
          isMoving,
        });
      },

      updateGeofenceEvent: (event: GeofenceEvent) => {
        set({ lastGeofenceEvent: event });
      },

      updateStatus: (status: TrackingStatus) => {
        set({ status });
      },

      setPermissionGranted: (granted: boolean) => {
        set({ permissionGranted: granted });
      },

      setError: (message: string | null) => {
        set({ errorMessage: message });
      },

      setBatteryLevel: (level: number) => {
        set({ batteryLevel: level });
      },

      refreshCurrentLocation: async () => {
        const location = await locationTracking.getCurrentLocation();
        if (location) {
          set({ lastLocation: location });
        }
        return location;
      },
    }),
    {
      name: 'tradietrack-location',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        isEnabled: state.isEnabled,
      }),
    }
  )
);

export function getActivityStatus(store: LocationState): string {
  if (!store.isEnabled || store.status !== 'tracking') {
    return 'Offline';
  }
  
  if (store.isMoving && store.lastLocation?.speed && store.lastLocation.speed > 10) {
    return 'Driving';
  }
  
  if (store.isMoving) {
    return 'Moving';
  }
  
  return 'Online';
}

export function formatSpeed(speed: number | null): string {
  if (speed === null || speed < 0.5) return '';
  const kmh = speed * 3.6;
  return `${Math.round(kmh)} km/h`;
}

export function formatAccuracy(accuracy: number | null): string {
  if (accuracy === null) return 'Unknown';
  if (accuracy < 10) return 'Excellent';
  if (accuracy < 30) return 'Good';
  if (accuracy < 100) return 'Fair';
  return 'Poor';
}

export default useLocationStore;
