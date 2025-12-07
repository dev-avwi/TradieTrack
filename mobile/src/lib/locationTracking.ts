import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Battery from 'expo-battery';
import { Platform } from 'react-native';
import api from './api';
import { offlineStore } from './offlineStore';

const LOCATION_TASK_NAME = 'background-location-task';
const LOCATION_UPDATE_INTERVAL = 30000;
const LOCATION_DISTANCE_INTERVAL = 50;
const GEOFENCE_RADIUS = 100;

interface LocationUpdate {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  altitude: number | null;
  timestamp: number;
}

interface GeofenceEvent {
  type: 'enter' | 'exit';
  jobId: string;
  jobTitle: string;
  timestamp: number;
}

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
  if (error) {
    console.error('[LocationTracking] Background task error:', error);
    return;
  }

  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    
    for (const location of locations) {
      try {
        await locationTrackingService.processBackgroundLocation(location);
      } catch (err) {
        console.error('[LocationTracking] Failed to process location:', err);
      }
    }
  }
});

class LocationTrackingService {
  private userId: string | null = null;
  private isTracking: boolean = false;
  private foregroundSubscription: Location.LocationSubscription | null = null;
  private watchedGeofences: Map<string, { latitude: number; longitude: number; jobTitle: string }> = new Map();
  private lastGeofenceState: Map<string, boolean> = new Map();

  async initialize(userId: string): Promise<boolean> {
    this.userId = userId;
    console.log('[LocationTracking] Initialized for user:', userId);
    return true;
  }

  async requestPermissions(): Promise<boolean> {
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    
    if (foregroundStatus !== 'granted') {
      console.log('[LocationTracking] Foreground permission denied');
      return false;
    }

    if (Platform.OS === 'android') {
      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      if (backgroundStatus !== 'granted') {
        console.log('[LocationTracking] Background permission denied (Android)');
        return false;
      }
    }

    return true;
  }

  async hasBackgroundPermission(): Promise<boolean> {
    const { status } = await Location.getBackgroundPermissionsAsync();
    return status === 'granted';
  }

  async startBackgroundTracking(): Promise<boolean> {
    if (this.isTracking) {
      console.log('[LocationTracking] Already tracking');
      return true;
    }

    const hasPermission = await this.hasBackgroundPermission();
    if (!hasPermission) {
      const granted = await this.requestPermissions();
      if (!granted) {
        console.log('[LocationTracking] Permissions not granted');
        return false;
      }
    }

    try {
      const isTaskDefined = TaskManager.isTaskDefined(LOCATION_TASK_NAME);
      if (!isTaskDefined) {
        console.error('[LocationTracking] Background task not defined');
        return false;
      }

      const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (hasStarted) {
        console.log('[LocationTracking] Task already running');
        this.isTracking = true;
        return true;
      }

      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: LOCATION_UPDATE_INTERVAL,
        distanceInterval: LOCATION_DISTANCE_INTERVAL,
        deferredUpdatesInterval: LOCATION_UPDATE_INTERVAL,
        deferredUpdatesDistance: LOCATION_DISTANCE_INTERVAL,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: 'TradieTrack Active',
          notificationBody: 'Tracking location for team coordination',
          notificationColor: '#3b82f6',
          killServiceOnDestroy: false,
        },
        pausesUpdatesAutomatically: false,
        activityType: Location.ActivityType.AutomotiveNavigation,
      });

      this.isTracking = true;
      console.log('[LocationTracking] Background tracking started');
      return true;
    } catch (error) {
      console.error('[LocationTracking] Failed to start tracking:', error);
      return false;
    }
  }

  async loadGeofencesFromJobs(jobs: Array<{ id: string; title: string; latitude?: number; longitude?: number }>): Promise<void> {
    this.clearAllGeofences();
    
    for (const job of jobs) {
      if (job.latitude && job.longitude) {
        this.addGeofence(job.id, job.latitude, job.longitude, job.title);
      }
    }
    
    console.log(`[LocationTracking] Loaded ${this.watchedGeofences.size} job geofences`);
  }

  async stopBackgroundTracking(): Promise<void> {
    try {
      const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (hasStarted) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      }
      this.isTracking = false;
      console.log('[LocationTracking] Background tracking stopped');
    } catch (error) {
      console.error('[LocationTracking] Failed to stop tracking:', error);
    }
  }

  async startForegroundTracking(
    onLocationUpdate: (location: LocationUpdate) => void
  ): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return false;
      }

      this.foregroundSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 10000,
          distanceInterval: 10,
        },
        (location) => {
          const update: LocationUpdate = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy,
            speed: location.coords.speed,
            heading: location.coords.heading,
            altitude: location.coords.altitude,
            timestamp: location.timestamp,
          };
          onLocationUpdate(update);
        }
      );

      return true;
    } catch (error) {
      console.error('[LocationTracking] Foreground tracking failed:', error);
      return false;
    }
  }

  stopForegroundTracking(): void {
    if (this.foregroundSubscription) {
      this.foregroundSubscription.remove();
      this.foregroundSubscription = null;
    }
  }

  async getCurrentLocation(): Promise<LocationUpdate | null> {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        return null;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        speed: location.coords.speed,
        heading: location.coords.heading,
        altitude: location.coords.altitude,
        timestamp: location.timestamp,
      };
    } catch (error) {
      console.error('[LocationTracking] Failed to get current location:', error);
      return null;
    }
  }

  async processBackgroundLocation(location: Location.LocationObject): Promise<void> {
    if (!this.userId) return;

    let batteryLevel: number | null = null;
    try {
      batteryLevel = await Battery.getBatteryLevelAsync();
    } catch (e) {}

    const locationData = {
      userId: this.userId,
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
      speed: location.coords.speed,
      heading: location.coords.heading,
      altitude: location.coords.altitude,
      batteryLevel,
      activityType: this.inferActivityType(location.coords.speed),
    };

    await offlineStore.saveLocationHistory(locationData);

    this.checkGeofences(location.coords.latitude, location.coords.longitude);

    try {
      await api.post('/api/team/location', locationData);
    } catch (error) {
      console.log('[LocationTracking] Will sync location later (offline)');
    }
  }

  private inferActivityType(speed: number | null): string {
    if (speed === null || speed < 0.5) return 'stationary';
    if (speed < 2) return 'walking';
    if (speed < 8) return 'running';
    return 'driving';
  }

  addGeofence(jobId: string, latitude: number, longitude: number, jobTitle: string): void {
    this.watchedGeofences.set(jobId, { latitude, longitude, jobTitle });
    this.lastGeofenceState.set(jobId, false);
    console.log(`[LocationTracking] Added geofence for job ${jobId}`);
  }

  removeGeofence(jobId: string): void {
    this.watchedGeofences.delete(jobId);
    this.lastGeofenceState.delete(jobId);
  }

  clearAllGeofences(): void {
    this.watchedGeofences.clear();
    this.lastGeofenceState.clear();
  }

  private checkGeofences(latitude: number, longitude: number): void {
    for (const [jobId, geofence] of this.watchedGeofences.entries()) {
      const distance = this.calculateDistance(
        latitude,
        longitude,
        geofence.latitude,
        geofence.longitude
      );

      const isInside = distance <= GEOFENCE_RADIUS;
      const wasInside = this.lastGeofenceState.get(jobId) || false;

      if (isInside && !wasInside) {
        this.handleGeofenceEvent({
          type: 'enter',
          jobId,
          jobTitle: geofence.jobTitle,
          timestamp: Date.now(),
        });
      } else if (!isInside && wasInside) {
        this.handleGeofenceEvent({
          type: 'exit',
          jobId,
          jobTitle: geofence.jobTitle,
          timestamp: Date.now(),
        });
      }

      this.lastGeofenceState.set(jobId, isInside);
    }
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3;
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  private async handleGeofenceEvent(event: GeofenceEvent): Promise<void> {
    console.log(`[LocationTracking] Geofence ${event.type}: ${event.jobTitle}`);

    try {
      await api.post('/api/team/geofence-event', {
        userId: this.userId,
        jobId: event.jobId,
        eventType: event.type,
        timestamp: new Date(event.timestamp).toISOString(),
      });
    } catch (error) {
      console.error('[LocationTracking] Failed to report geofence event:', error);
    }
  }

  isTrackingActive(): boolean {
    return this.isTracking;
  }

  async cleanup(): Promise<void> {
    this.stopForegroundTracking();
    await this.stopBackgroundTracking();
    this.clearAllGeofences();
    this.userId = null;
  }
}

export const locationTrackingService = new LocationTrackingService();
export default locationTrackingService;
