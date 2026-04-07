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
 * - Privacy-aware job-scoped tracking for subcontractors
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

export interface SubcontractorJobContext {
  jobId: string;
  jobTitle: string;
  businessName: string;
}

class LocationTrackingService {
  private status: TrackingStatus = 'stopped';
  private currentLocation: LocationUpdate | null = null;
  private geofences: GeofenceRegion[] = [];
  private onLocationUpdate?: (location: LocationUpdate) => void;
  private onGeofenceEvent?: (event: GeofenceEvent) => void;
  private onStatusChange?: (status: TrackingStatus) => void;
  private _isSubcontractor: boolean = false;
  private _activeJobContext: SubcontractorJobContext | null = null;
  private _onJobContextChange?: (context: SubcontractorJobContext | null) => void;

  /**
   * Silently check current permission state WITHOUT triggering any OS prompts.
   * Use this on app startup to resume tracking if already granted.
   */
  async checkPermissions(): Promise<{ foreground: boolean; background: boolean }> {
    try {
      const fg = await Location.getForegroundPermissionsAsync();
      const bg = await Location.getBackgroundPermissionsAsync();
      return {
        foreground: fg.status === 'granted',
        background: bg.status === 'granted',
      };
    } catch (error: any) {
      if (__DEV__) console.log('[Location] Permission check failed:', error?.message);
      return { foreground: false, background: false };
    }
  }

  /**
   * Request foreground permission only. Called when user first needs GPS
   * (e.g. starting a timer, opening the map). Does NOT request background.
   */
  async requestForegroundPermission(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        if (__DEV__) console.log('[Location] Foreground permission granted');
        return true;
      }
      if (__DEV__) console.log('[Location] Foreground permission denied');
      return false;
    } catch (error: any) {
      if (__DEV__) console.log('[Location] Foreground request failed:', error?.message);
      return false;
    }
  }

  /**
   * Request background permission. Called only when user explicitly enables
   * background features like team tracking or geofencing in settings.
   */
  async requestBackgroundPermission(): Promise<boolean> {
    try {
      const fg = await Location.getForegroundPermissionsAsync();
      if (fg.status !== 'granted') {
        const fgResult = await this.requestForegroundPermission();
        if (!fgResult) return false;
      }
      const { status } = await Location.requestBackgroundPermissionsAsync();
      if (status === 'granted') {
        if (__DEV__) console.log('[Location] Background permission granted');
        return true;
      }
      if (__DEV__) console.log('[Location] Background permission denied');
      return false;
    } catch (error: any) {
      if (__DEV__) console.log('[Location] Background request failed:', error?.message);
      return false;
    }
  }

  /**
   * Initialize location tracking.
   * Now uses a lazy approach: silently checks permissions without prompting.
   * Only resumes tracking if permissions were previously granted.
   * Use requestForegroundPermission() / requestBackgroundPermission() to prompt.
   */
  async initialize(): Promise<boolean> {
    try {
      const perms = await this.checkPermissions();

      if (!perms.foreground) {
        if (__DEV__) console.log('[Location] No foreground permission — skipping init (will prompt when needed)');
        return false;
      }

      if (__DEV__) console.log('[Location] Initialized successfully (foreground=' + perms.foreground + ', background=' + perms.background + ')');
      return true;
    } catch (error: any) {
      if (error?.message?.includes('NSLocation') || error?.message?.includes('Info.plist')) {
        if (__DEV__) console.log('[Location] Running in Expo Go - location tracking requires native build');
      } else {
        if (__DEV__) console.log('[Location] Initialization skipped:', error?.message || 'Unknown error');
      }
      return false;
    }
  }

  setSubcontractorMode(isSubcontractor: boolean): void {
    this._isSubcontractor = isSubcontractor;
    if (isSubcontractor && !this._activeJobContext) {
      this.stopTracking();
    }
    if (__DEV__) console.log(`[Location] Subcontractor mode: ${isSubcontractor}`);
  }

  getIsSubcontractor(): boolean {
    return this._isSubcontractor;
  }

  getActiveJobContext(): SubcontractorJobContext | null {
    return this._activeJobContext;
  }

  onJobContextChange(callback: (context: SubcontractorJobContext | null) => void): void {
    this._onJobContextChange = callback;
  }

  async startJobTracking(jobId: string, jobTitle: string, businessName: string): Promise<boolean> {
    this._activeJobContext = { jobId, jobTitle, businessName };
    if (this._onJobContextChange) {
      this._onJobContextChange(this._activeJobContext);
    }
    if (__DEV__) console.log(`[Location] Subcontractor job tracking started for job ${jobId} (${businessName})`);
    const result = await this.startTracking();
    return result;
  }

  async stopJobTracking(): Promise<void> {
    const previousContext = this._activeJobContext;
    this._activeJobContext = null;
    if (this._onJobContextChange) {
      this._onJobContextChange(null);
    }
    if (previousContext) {
      await this.stopTracking();
      if (__DEV__) console.log(`[Location] Subcontractor job tracking stopped for job ${previousContext.jobId}`);
    }
  }

  async stopJobTrackingForJob(jobId: string): Promise<void> {
    if (this._activeJobContext?.jobId === jobId) {
      await this.stopJobTracking();
    }
  }

  isTrackingJob(jobId: string): boolean {
    return this._activeJobContext?.jobId === jobId;
  }

  /**
   * Start background location tracking
   */
  async startTracking(): Promise<boolean> {
    if (this._isSubcontractor && !this._activeJobContext) {
      if (__DEV__) console.log('[Location] Subcontractor cannot start tracking without active job context');
      return false;
    }

    try {
      this.updateStatus('starting');

      const isTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (isTracking) {
        if (__DEV__) console.log('[Location] Already tracking');
        this.updateStatus('tracking');
        return true;
      }

      try {
        const notificationBody = this._isSubcontractor && this._activeJobContext
          ? `Sharing location with ${this._activeJobContext.businessName} for: ${this._activeJobContext.jobTitle}`
          : 'Location tracking active for team visibility';

        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 30000,
          distanceInterval: 50,
          showsBackgroundLocationIndicator: true,
          foregroundService: {
            notificationTitle: 'JobRunner',
            notificationBody,
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
   * Stop all geofencing and clear all registered regions.
   * Used when GPS Privacy Mode is enabled.
   */
  async stopAllGeofencing(): Promise<void> {
    try {
      const isMonitoring = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK_NAME);
      if (isMonitoring) {
        await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
      }
      this.geofences = [];
      if (__DEV__) console.log('[Location] All geofencing stopped');
    } catch (error) {
      if (__DEV__) console.log('[Location] Stop all geofencing error:', (error as any)?.message);
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
    if (this._isSubcontractor && !this._activeJobContext) {
      if (__DEV__) console.log('[Location] Subcontractor has no active job - skipping location send');
      return;
    }

    try {
      await api.post('/api/team-locations', {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        heading: location.heading,
        speed: location.speed,
        timestamp: new Date(location.timestamp).toISOString(),
        activeJobId: this._activeJobContext?.jobId || undefined,
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
    if (this._isSubcontractor && !this._activeJobContext) {
      return;
    }

    this.currentLocation = location;
    
    if (this.onLocationUpdate) {
      this.onLocationUpdate(location);
    }
    
    this.sendLocationToServer(location);
  }

  /**
   * Handle geofence event from background task
   */
  handleGeofenceEvent(event: GeofenceEvent): void {
    if (this.onGeofenceEvent) {
      this.onGeofenceEvent(event);
    }
    
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
