/**
 * Background Location Tracking Module
 * 
 * Provides Life360-style real-time location tracking for team members.
 * Sends location updates to the server for team visibility on the map.
 * 
 * Features:
 * - Background location updates
 * - Battery-efficient tracking
 * - Geofence alerts for job site arrivals/departures
 * - Speed and heading tracking
 */

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import api from './api';

const LOCATION_TASK_NAME = 'tradietrack-location-tracking';
const GEOFENCE_TASK_NAME = 'tradietrack-geofence-monitoring';

export interface LocationUpdate {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  altitude: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

export interface GeofenceRegion {
  identifier: string;
  latitude: number;
  longitude: number;
  radius: number;
  notifyOnEnter: boolean;
  notifyOnExit: boolean;
}

export interface GeofenceEvent {
  identifier: string;
  action: 'enter' | 'exit';
  timestamp: number;
}

export type TrackingStatus = 
  | 'stopped'
  | 'starting'
  | 'tracking'
  | 'paused'
  | 'error';

class LocationTrackingService {
  private status: TrackingStatus = 'stopped';
  private currentLocation: LocationUpdate | null = null;
  private geofences: GeofenceRegion[] = [];
  private onLocationUpdate?: (location: LocationUpdate) => void;
  private onGeofenceEvent?: (event: GeofenceEvent) => void;
  private onStatusChange?: (status: TrackingStatus) => void;

  /**
   * Initialize location tracking
   * Note: In Expo Go, location permissions require NSLocationUsageDescription 
   * keys in Info.plist which are only set during native build (EAS Build).
   */
  async initialize(): Promise<boolean> {
    try {
      // Request foreground permissions first
      const { status: foregroundStatus } = 
        await Location.requestForegroundPermissionsAsync();
      
      if (foregroundStatus !== 'granted') {
        console.log('[Location] Foreground permission denied');
        return false;
      }

      // Request background permissions for tracking while app is closed
      const { status: backgroundStatus } = 
        await Location.requestBackgroundPermissionsAsync();
      
      if (backgroundStatus !== 'granted') {
        console.log('[Location] Background permission denied');
        // Can still work with foreground only
      }

      console.log('[Location] Initialized successfully');
      return true;
    } catch (error: any) {
      // In Expo Go, location permissions may not be fully available
      // This is expected - full location tracking requires a native build
      if (error?.message?.includes('NSLocation') || error?.message?.includes('Info.plist')) {
        console.log('[Location] Running in Expo Go - location tracking requires native build');
      } else {
        console.log('[Location] Initialization skipped:', error?.message || 'Unknown error');
      }
      return false;
    }
  }

  /**
   * Start background location tracking
   */
  async startTracking(): Promise<boolean> {
    try {
      this.updateStatus('starting');

      // Check if already tracking
      const isTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (isTracking) {
        console.log('[Location] Already tracking');
        this.updateStatus('tracking');
        return true;
      }

      // Start background location updates
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 30000, // Update every 30 seconds
        distanceInterval: 50, // Or when moved 50 meters
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: 'TradieTrack',
          notificationBody: 'Location tracking active for team visibility',
          notificationColor: '#f97316',
        },
        pausesUpdatesAutomatically: true,
        activityType: Location.ActivityType.AutomotiveNavigation,
      });

      console.log('[Location] Background tracking started');
      this.updateStatus('tracking');
      return true;
    } catch (error) {
      console.error('[Location] Failed to start tracking:', error);
      this.updateStatus('error');
      return false;
    }
  }

  /**
   * Stop background location tracking
   */
  async stopTracking(): Promise<void> {
    try {
      const isTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (isTracking) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      }
      
      console.log('[Location] Tracking stopped');
      this.updateStatus('stopped');
    } catch (error) {
      console.error('[Location] Failed to stop tracking:', error);
    }
  }

  /**
   * Get current location (one-time)
   */
  async getCurrentLocation(): Promise<LocationUpdate | null> {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const update: LocationUpdate = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        altitude: location.coords.altitude,
        heading: location.coords.heading,
        speed: location.coords.speed,
        timestamp: location.timestamp,
      };

      this.currentLocation = update;
      return update;
    } catch (error) {
      console.error('[Location] Failed to get current location:', error);
      return null;
    }
  }

  /**
   * Add a geofence for a job site
   */
  async addJobGeofence(
    jobId: string,
    latitude: number,
    longitude: number,
    radius: number = 100 // 100 meter radius
  ): Promise<boolean> {
    try {
      const region: GeofenceRegion = {
        identifier: `job_${jobId}`,
        latitude,
        longitude,
        radius,
        notifyOnEnter: true,
        notifyOnExit: true,
      };

      // Check if geofencing is already started
      const isMonitoring = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK_NAME);
      
      if (isMonitoring) {
        await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
      }

      this.geofences.push(region);

      await Location.startGeofencingAsync(GEOFENCE_TASK_NAME, this.geofences);
      
      console.log(`[Location] Added geofence for job ${jobId}`);
      return true;
    } catch (error) {
      console.error('[Location] Failed to add geofence:', error);
      return false;
    }
  }

  /**
   * Remove a job geofence
   */
  async removeJobGeofence(jobId: string): Promise<void> {
    try {
      this.geofences = this.geofences.filter(g => g.identifier !== `job_${jobId}`);
      
      if (this.geofences.length > 0) {
        await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
        await Location.startGeofencingAsync(GEOFENCE_TASK_NAME, this.geofences);
      } else {
        const isMonitoring = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK_NAME);
        if (isMonitoring) {
          await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
        }
      }
      
      console.log(`[Location] Removed geofence for job ${jobId}`);
    } catch (error) {
      console.error('[Location] Failed to remove geofence:', error);
    }
  }

  /**
   * Send location update to the server
   */
  async sendLocationToServer(location: LocationUpdate): Promise<void> {
    try {
      await api.post('/api/team-locations', {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        heading: location.heading,
        speed: location.speed,
        timestamp: new Date(location.timestamp).toISOString(),
      });
    } catch (error) {
      console.error('[Location] Failed to send location to server:', error);
    }
  }

  /**
   * Set callback for location updates
   */
  onLocation(callback: (location: LocationUpdate) => void): void {
    this.onLocationUpdate = callback;
  }

  /**
   * Set callback for geofence events
   */
  onGeofence(callback: (event: GeofenceEvent) => void): void {
    this.onGeofenceEvent = callback;
  }

  /**
   * Set callback for status changes
   */
  onStatus(callback: (status: TrackingStatus) => void): void {
    this.onStatusChange = callback;
  }

  private updateStatus(status: TrackingStatus): void {
    this.status = status;
    if (this.onStatusChange) {
      this.onStatusChange(status);
    }
  }

  getStatus(): TrackingStatus {
    return this.status;
  }

  getLastLocation(): LocationUpdate | null {
    return this.currentLocation;
  }

  /**
   * Handle location update from background task
   */
  handleLocationUpdate(location: LocationUpdate): void {
    this.currentLocation = location;
    
    if (this.onLocationUpdate) {
      this.onLocationUpdate(location);
    }
    
    // Send to server
    this.sendLocationToServer(location);
  }

  /**
   * Handle geofence event from background task
   */
  handleGeofenceEvent(event: GeofenceEvent): void {
    if (this.onGeofenceEvent) {
      this.onGeofenceEvent(event);
    }
    
    // Notify server of arrival/departure
    api.post('/api/geofence-events', event);
  }
}

// Define the background task for location updates
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('[Location Task] Error:', error);
    return;
  }
  
  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    const location = locations[0];
    
    if (location) {
      const update: LocationUpdate = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        altitude: location.coords.altitude,
        heading: location.coords.heading,
        speed: location.coords.speed,
        timestamp: location.timestamp,
      };
      
      locationTracking.handleLocationUpdate(update);
    }
  }
});

// Define the background task for geofence events
TaskManager.defineTask(GEOFENCE_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('[Geofence Task] Error:', error);
    return;
  }
  
  if (data) {
    const { eventType, region } = data as { 
      eventType: Location.GeofencingEventType;
      region: Location.LocationRegion;
    };
    
    const event: GeofenceEvent = {
      identifier: region.identifier ?? 'unknown',
      action: eventType === Location.GeofencingEventType.Enter ? 'enter' : 'exit',
      timestamp: Date.now(),
    };
    
    locationTracking.handleGeofenceEvent(event);
  }
});

export const locationTracking = new LocationTrackingService();
export default locationTracking;
