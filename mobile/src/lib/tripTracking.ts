/**
 * Trip Tracking Service - ServiceM8-style travel time tracking
 * 
 * Tracks travel time between jobs with GPS-based distance calculation,
 * billable time suggestions, and auto-detection of supply runs.
 */

import * as Location from 'expo-location';
import api from './api';

export interface Trip {
  id: string;
  userId: string;
  jobId?: string | null;
  tripType: 'travel' | 'supply_run' | 'site_visit';
  startTime: string;
  endTime?: string | null;
  duration?: number | null;
  distanceKm?: string | null;
  startLatitude?: string | null;
  startLongitude?: string | null;
  endLatitude?: string | null;
  endLongitude?: string | null;
  startAddress?: string | null;
  endAddress?: string | null;
  isBillable: boolean;
  billableRate?: string | null;
  notes?: string | null;
  status: 'in_progress' | 'completed' | 'cancelled';
  autoDetected: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TripStartData {
  jobId?: string;
  tripType?: 'travel' | 'supply_run' | 'site_visit';
  startLatitude?: number;
  startLongitude?: number;
  startAddress?: string;
  isBillable?: boolean;
  billableRate?: string;
  notes?: string;
}

export interface TripStopData {
  endLatitude?: number;
  endLongitude?: number;
  endAddress?: string;
  distanceKm?: number;
  notes?: string;
}

export type TripTrackingStatus = 
  | 'idle'
  | 'starting'
  | 'tracking'
  | 'stopping'
  | 'error';

class TripTrackingService {
  private status: TripTrackingStatus = 'idle';
  private activeTrip: Trip | null = null;
  private onStatusChange?: (status: TripTrackingStatus) => void;
  private onTripUpdate?: (trip: Trip | null) => void;
  private locationWatcher: Location.LocationSubscription | null = null;
  private cumulativeDistance: number = 0;
  private lastLocation: { latitude: number; longitude: number } | null = null;

  getStatus(): TripTrackingStatus {
    return this.status;
  }

  getActiveTrip(): Trip | null {
    return this.activeTrip;
  }

  setStatusCallback(callback: (status: TripTrackingStatus) => void): void {
    this.onStatusChange = callback;
  }

  setTripUpdateCallback(callback: (trip: Trip | null) => void): void {
    this.onTripUpdate = callback;
  }

  private updateStatus(status: TripTrackingStatus): void {
    this.status = status;
    this.onStatusChange?.(status);
  }

  private updateTrip(trip: Trip | null): void {
    this.activeTrip = trip;
    this.onTripUpdate?.(trip);
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   */
  private calculateDistance(
    lat1: number, lon1: number,
    lat2: number, lon2: number
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  /**
   * Get current location
   */
  async getCurrentLocation(): Promise<{ latitude: number; longitude: number } | null> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('[TripTracking] Location permission denied');
        return null;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
    } catch (error) {
      console.error('[TripTracking] Error getting location:', error);
      return null;
    }
  }

  /**
   * Reverse geocode coordinates to address
   */
  async getAddressFromCoords(latitude: number, longitude: number): Promise<string | null> {
    try {
      const addresses = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (addresses && addresses.length > 0) {
        const addr = addresses[0];
        const parts = [
          addr.streetNumber,
          addr.street,
          addr.city,
          addr.region,
          addr.postalCode,
        ].filter(Boolean);
        return parts.join(' ');
      }
      return null;
    } catch (error) {
      console.error('[TripTracking] Error reverse geocoding:', error);
      return null;
    }
  }

  /**
   * Check for an existing active trip
   */
  async checkActiveTrip(): Promise<Trip | null> {
    try {
      const response = await api.get('/trips/active');
      const trip = response.data;
      if (trip) {
        this.updateTrip(trip);
        this.updateStatus('tracking');
        return trip;
      }
      return null;
    } catch (error) {
      console.error('[TripTracking] Error checking active trip:', error);
      return null;
    }
  }

  /**
   * Start a new trip
   */
  async startTrip(data: TripStartData = {}): Promise<Trip | null> {
    try {
      this.updateStatus('starting');

      // Get current location if not provided
      let startLocation = { latitude: data.startLatitude, longitude: data.startLongitude };
      if (!startLocation.latitude || !startLocation.longitude) {
        const location = await this.getCurrentLocation();
        if (location) {
          startLocation = location;
        }
      }

      // Get address if we have coordinates
      let startAddress = data.startAddress;
      if (!startAddress && startLocation.latitude && startLocation.longitude) {
        startAddress = await this.getAddressFromCoords(
          startLocation.latitude,
          startLocation.longitude
        ) || undefined;
      }

      const tripData = {
        jobId: data.jobId,
        tripType: data.tripType || 'travel',
        startLatitude: startLocation.latitude?.toString(),
        startLongitude: startLocation.longitude?.toString(),
        startAddress,
        isBillable: data.isBillable !== false,
        billableRate: data.billableRate,
        notes: data.notes,
      };

      const response = await api.post('/trips', tripData);
      const trip = response.data;
      
      this.updateTrip(trip);
      this.updateStatus('tracking');
      this.cumulativeDistance = 0;
      this.lastLocation = startLocation.latitude && startLocation.longitude 
        ? { latitude: startLocation.latitude, longitude: startLocation.longitude }
        : null;

      // Start watching location for distance tracking
      this.startLocationWatch();

      return trip;
    } catch (error: any) {
      console.error('[TripTracking] Error starting trip:', error);
      this.updateStatus('error');
      throw error;
    }
  }

  /**
   * Start watching location for distance accumulation
   */
  private async startLocationWatch(): Promise<void> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return;
      }

      this.locationWatcher = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 50, // Update every 50 meters
          timeInterval: 30000, // Or every 30 seconds
        },
        (location) => {
          const newLocation = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };

          if (this.lastLocation) {
            const distance = this.calculateDistance(
              this.lastLocation.latitude,
              this.lastLocation.longitude,
              newLocation.latitude,
              newLocation.longitude
            );
            this.cumulativeDistance += distance;
          }

          this.lastLocation = newLocation;
        }
      );
    } catch (error) {
      console.error('[TripTracking] Error starting location watch:', error);
    }
  }

  /**
   * Stop location watching
   */
  private stopLocationWatch(): void {
    if (this.locationWatcher) {
      this.locationWatcher.remove();
      this.locationWatcher = null;
    }
  }

  /**
   * Stop the active trip
   */
  async stopTrip(data: TripStopData = {}): Promise<Trip | null> {
    if (!this.activeTrip) {
      console.warn('[TripTracking] No active trip to stop');
      return null;
    }

    try {
      this.updateStatus('stopping');
      this.stopLocationWatch();

      // Get current location if not provided
      let endLocation = { latitude: data.endLatitude, longitude: data.endLongitude };
      if (!endLocation.latitude || !endLocation.longitude) {
        const location = await this.getCurrentLocation();
        if (location) {
          endLocation = location;
        }
      }

      // Get address if we have coordinates
      let endAddress = data.endAddress;
      if (!endAddress && endLocation.latitude && endLocation.longitude) {
        endAddress = await this.getAddressFromCoords(
          endLocation.latitude,
          endLocation.longitude
        ) || undefined;
      }

      // Use cumulative distance or calculate from start to end
      let distanceKm = data.distanceKm || this.cumulativeDistance;
      if (!distanceKm && this.activeTrip.startLatitude && this.activeTrip.startLongitude && endLocation.latitude && endLocation.longitude) {
        distanceKm = this.calculateDistance(
          parseFloat(this.activeTrip.startLatitude),
          parseFloat(this.activeTrip.startLongitude),
          endLocation.latitude,
          endLocation.longitude
        );
      }

      const stopData = {
        endLatitude: endLocation.latitude?.toString(),
        endLongitude: endLocation.longitude?.toString(),
        endAddress,
        distanceKm: distanceKm ? distanceKm.toFixed(2) : undefined,
        notes: data.notes,
      };

      const response = await api.post(`/trips/${this.activeTrip.id}/stop`, stopData);
      const stoppedTrip = response.data;
      
      this.updateTrip(null);
      this.updateStatus('idle');
      this.cumulativeDistance = 0;
      this.lastLocation = null;

      return stoppedTrip;
    } catch (error: any) {
      console.error('[TripTracking] Error stopping trip:', error);
      this.updateStatus('error');
      throw error;
    }
  }

  /**
   * Cancel the active trip
   */
  async cancelTrip(): Promise<boolean> {
    if (!this.activeTrip) {
      return false;
    }

    try {
      this.stopLocationWatch();
      await api.delete(`/trips/${this.activeTrip.id}`);
      this.updateTrip(null);
      this.updateStatus('idle');
      this.cumulativeDistance = 0;
      this.lastLocation = null;
      return true;
    } catch (error) {
      console.error('[TripTracking] Error cancelling trip:', error);
      return false;
    }
  }

  /**
   * Get all trips for the user
   */
  async getTrips(jobId?: string): Promise<Trip[]> {
    try {
      const params = jobId ? { jobId } : {};
      const response = await api.get('/trips', { params });
      return response.data;
    } catch (error) {
      console.error('[TripTracking] Error fetching trips:', error);
      return [];
    }
  }

  /**
   * Get elapsed time for active trip in seconds
   */
  getElapsedTime(): number {
    if (!this.activeTrip) return 0;
    const startTime = new Date(this.activeTrip.startTime).getTime();
    return Math.floor((Date.now() - startTime) / 1000);
  }

  /**
   * Get current distance traveled in km
   */
  getCurrentDistance(): number {
    return this.cumulativeDistance;
  }

  /**
   * Format duration for display
   */
  formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  }

  /**
   * Format distance for display
   */
  formatDistance(km: number): string {
    if (km < 1) {
      return `${Math.round(km * 1000)}m`;
    }
    return `${km.toFixed(1)}km`;
  }

  /**
   * Calculate billable amount for a trip
   */
  calculateBillableAmount(trip: Trip): number | null {
    if (!trip.isBillable || !trip.duration || !trip.billableRate) {
      return null;
    }
    const hours = trip.duration / 60;
    return hours * parseFloat(trip.billableRate);
  }
}

export const tripTrackingService = new TripTrackingService();
export default tripTrackingService;
