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
import { Platform, Alert, Linking } from 'react-native';
import api from './api';

const LOCATION_TASK_NAME = 'jobrunner-location-tracking';
const GEOFENCE_TASK_NAME = 'jobrunner-geofence-monitoring';

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
  | 'foreground_only'
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
        if (__DEV__) console.log('[Location] Foreground permission denied');
        Alert.alert(
          'Location Permission Required',
          'JobRunner needs location access for team tracking, job navigation, and On My Way notifications. Please enable location access in Settings.',
          [
            { text: 'Not Now', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() }
          ]
        );
        return false;
      }

      // Request background permissions for tracking while app is closed
      const { status: backgroundStatus } = 
        await Location.requestBackgroundPermissionsAsync();
      
      if (backgroundStatus !== 'granted') {
        if (__DEV__) console.log('[Location] Background permission denied');
        Alert.alert(
          'Background Location',
          'For best results, allow "Always" location access so your team can see your location even when the app is in the background.',
          [
            { text: 'Continue Without', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() }
          ]
        );
      }

      if (__DEV__) console.log('[Location] Initialized successfully');
      return true;
    } catch (error: any) {
      // In Expo Go, location permissions may not be fully available
      // This is expected - full location tracking requires a native build
      if (error?.message?.includes('NSLocation') || error?.message?.includes('Info.plist')) {
        if (__DEV__) console.log('[Location] Running in Expo Go - location tracking requires native build');
      } else {
        if (__DEV__) console.log('[Location] Initialization skipped:', error?.message || 'Unknown error');
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
        if (__DEV__) console.log('[Location] Already tracking');
        this.updateStatus('tracking');
        return true;
      }

      // Try to start background location updates
      try {
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 30000, // Update every 30 seconds
          distanceInterval: 50, // Or when moved 50 meters
          showsBackgroundLocationIndicator: true,
          foregroundService: {
            notificationTitle: 'JobRunner',
            notificationBody: 'Location tracking active for team visibility',
            notificationColor: '#E8862E',
          },
          pausesUpdatesAutomatically: true,
          activityType: Location.ActivityType.AutomotiveNavigation,
        });

        if (__DEV__) console.log('[Location] Background tracking started');
        this.updateStatus('tracking');
        return true;
      } catch (bgError: any) {
        const errorMessage = bgError?.message || '';
        if (errorMessage.includes('UIBackgroundModes') || errorMessage.includes('Background location')) {
          if (__DEV__) console.warn('[Location] Background location not configured in Info.plist, using foreground tracking only');
          const location = await this.getCurrentLocation();
          if (location) {
            this.updateStatus('foreground_only');
            return true;
          }
        }
        throw bgError;
      }
    } catch (error) {
      if (__DEV__) console.error('[Location] Failed to start tracking:', error);
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
      
      if (__DEV__) console.log('[Location] Tracking stopped');
      this.updateStatus('stopped');
    } catch (error) {
      if (__DEV__) console.error('[Location] Failed to stop tracking:', error);
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
      if (__DEV__) console.error('[Location] Failed to get current location:', error);
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
      
      if (__DEV__) console.log(`[Location] Added geofence for job ${jobId}`);
      return true;
    } catch (error) {
      if (__DEV__) console.error('[Location] Failed to add geofence:', error);
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
      
      if (__DEV__) console.log(`[Location] Removed geofence for job ${jobId}`);
    } catch (error) {
      if (__DEV__) console.error('[Location] Failed to remove geofence:', error);
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
      if (__DEV__) console.error('[Location] Failed to send location to server:', error);
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

  /**
   * Sync geofences for all assigned jobs that have geofencing enabled.
   * Call on app startup after location is initialized.
   */
  async syncJobGeofences(): Promise<void> {
    try {
      const response = await api.get('/api/jobs?status=pending,scheduled,in_progress');
      const jobs = response.data || response || [];
      
      if (!Array.isArray(jobs)) return;
      
      const geofenceJobs = jobs.filter((j: any) => 
        j.geofenceEnabled && j.latitude && j.longitude
      );

      if (geofenceJobs.length === 0) return;

      // Clear existing geofences and re-register
      this.geofences = [];
      
      for (const job of geofenceJobs) {
        this.geofences.push({
          identifier: `job_${job.id}`,
          latitude: Number(job.latitude),
          longitude: Number(job.longitude),
          radius: job.geofenceRadius || 100,
          notifyOnEnter: true,
          notifyOnExit: true,
        });
      }

      if (this.geofences.length > 0) {
        const isMonitoring = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK_NAME);
        if (isMonitoring) {
          await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
        }
        await Location.startGeofencingAsync(GEOFENCE_TASK_NAME, this.geofences);
        if (__DEV__) console.log(`[Location] Synced ${this.geofences.length} job geofences`);
      }
    } catch (error) {
      if (__DEV__) console.log('[Location] Geofence sync skipped:', (error as any)?.message || 'Not available');
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
    if (__DEV__) console.error('[Location Task] Error:', error);
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
    if (__DEV__) console.error('[Geofence Task] Error:', error);
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
