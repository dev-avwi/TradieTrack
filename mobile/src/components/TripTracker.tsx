/**
 * Trip Tracker Component - ServiceM8-style travel tracking widget
 * 
 * Shows active trip status with start/stop controls, elapsed time,
 * distance traveled, and trip type selection.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import tripTrackingService, { Trip, TripTrackingStatus } from '../lib/tripTracking';
import { useTheme, ThemeColors } from '../lib/theme';
import { spacing, radius } from '../lib/design-tokens';

interface TripTrackerProps {
  jobId?: string;
  onTripStart?: (trip: Trip) => void;
  onTripStop?: (trip: Trip) => void;
  compact?: boolean;
}

const TRIP_TYPES = [
  { value: 'travel', label: 'Travel to Job', icon: 'truck' as const },
  { value: 'supply_run', label: 'Supply Run', icon: 'shopping-bag' as const },
  { value: 'site_visit', label: 'Site Visit', icon: 'map-pin' as const },
];

export function TripTracker({ jobId, onTripStart, onTripStop, compact = false }: TripTrackerProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  
  const [status, setStatus] = useState<TripTrackingStatus>('idle');
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [distance, setDistance] = useState(0);
  const [selectedType, setSelectedType] = useState<'travel' | 'supply_run' | 'site_visit'>('travel');
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    tripTrackingService.setStatusCallback(setStatus);
    tripTrackingService.setTripUpdateCallback(setActiveTrip);
    
    // Check for existing active trip on mount
    tripTrackingService.checkActiveTrip();

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (status === 'tracking' && activeTrip) {
      timerRef.current = setInterval(() => {
        setElapsedTime(tripTrackingService.getElapsedTime());
        setDistance(tripTrackingService.getCurrentDistance());
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setElapsedTime(0);
      setDistance(0);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [status, activeTrip]);

  const handleStartTrip = useCallback(async () => {
    setLoading(true);
    try {
      const trip = await tripTrackingService.startTrip({
        jobId,
        tripType: selectedType,
        isBillable: true,
      });
      if (trip) {
        onTripStart?.(trip);
      }
    } catch (error: any) {
      Alert.alert(
        'Trip Error',
        error.response?.data?.error || 'Failed to start trip'
      );
    } finally {
      setLoading(false);
    }
  }, [jobId, selectedType, onTripStart]);

  const handleStopTrip = useCallback(async () => {
    Alert.alert(
      'Stop Trip',
      'Are you sure you want to stop tracking this trip?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Stop Trip',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const trip = await tripTrackingService.stopTrip();
              if (trip) {
                onTripStop?.(trip);
              }
            } catch (error: any) {
              Alert.alert(
                'Trip Error',
                error.response?.data?.error || 'Failed to stop trip'
              );
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  }, [onTripStop]);

  const formatTime = useCallback((seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const formatDistance = useCallback((km: number): string => {
    if (km < 1) {
      return `${Math.round(km * 1000)}m`;
    }
    return `${km.toFixed(1)}km`;
  }, []);

  // Compact version for inline display
  if (compact) {
    return (
      <View style={styles.compactContainer}>
        {status === 'tracking' && activeTrip ? (
          <TouchableOpacity 
            style={[styles.compactButton, styles.stopButton]}
            onPress={handleStopTrip}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Feather name="square" size={16} color="#fff" />
                <Text style={styles.stopButtonText}>
                  {formatTime(elapsedTime)}
                </Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={[styles.compactButton, styles.startButton]}
            onPress={handleStartTrip}
            disabled={loading || status === 'starting'}
          >
            {loading || status === 'starting' ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Feather name="navigation" size={16} color="#fff" />
                <Text style={styles.startButtonText}>Start Trip</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // Full version
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerIconContainer}>
          <Feather name="navigation" size={20} color={colors.primary} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>Trip Tracking</Text>
          <Text style={styles.subtitle}>
            {status === 'tracking' ? 'Trip in progress' : 'Track travel time'}
          </Text>
        </View>
      </View>

      {status === 'tracking' && activeTrip ? (
        <View style={styles.activeTrip}>
          <View style={styles.tripInfo}>
            <View style={styles.statItem}>
              <Feather name="clock" size={18} color={colors.primary} />
              <View style={styles.statContent}>
                <Text style={styles.statValue}>{formatTime(elapsedTime)}</Text>
                <Text style={styles.statLabel}>Duration</Text>
              </View>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Feather name="map" size={18} color={colors.primary} />
              <View style={styles.statContent}>
                <Text style={styles.statValue}>{formatDistance(distance)}</Text>
                <Text style={styles.statLabel}>Distance</Text>
              </View>
            </View>
          </View>

          <View style={styles.tripMeta}>
            <View style={styles.tripTypeIndicator}>
              <Feather 
                name={TRIP_TYPES.find(t => t.value === activeTrip.tripType)?.icon || 'truck'} 
                size={14} 
                color={colors.mutedForeground} 
              />
              <Text style={styles.tripTypeLabel}>
                {TRIP_TYPES.find(t => t.value === activeTrip.tripType)?.label || 'Travel'}
              </Text>
            </View>
            {activeTrip.startAddress && (
              <Text style={styles.addressText} numberOfLines={1}>
                From: {activeTrip.startAddress}
              </Text>
            )}
          </View>

          <TouchableOpacity 
            style={[styles.button, styles.stopButton]}
            onPress={handleStopTrip}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Feather name="square" size={18} color="#fff" />
                <Text style={styles.stopButtonText}>Stop Trip</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.startTrip}>
          <View style={styles.tripTypeSelector}>
            {TRIP_TYPES.map((type) => (
              <TouchableOpacity
                key={type.value}
                style={[
                  styles.tripTypeOption,
                  selectedType === type.value && styles.tripTypeOptionActive,
                ]}
                onPress={() => setSelectedType(type.value as typeof selectedType)}
              >
                <Feather 
                  name={type.icon} 
                  size={16} 
                  color={selectedType === type.value ? colors.primary : colors.mutedForeground} 
                />
                <Text 
                  style={[
                    styles.tripTypeText,
                    selectedType === type.value && styles.tripTypeTextActive,
                  ]}
                >
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity 
            style={[styles.button, styles.startButton]}
            onPress={handleStartTrip}
            disabled={loading || status === 'starting'}
          >
            {loading || status === 'starting' ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Feather name="navigation" size={18} color="#fff" />
                <Text style={styles.startButtonText}>Start Trip</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.helpText}>
            Track your travel time and distance to add to invoices
          </Text>
        </View>
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  compactContainer: {
    flexDirection: 'row',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  headerIconContainer: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  subtitle: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  activeTrip: {
    gap: spacing.md,
  },
  tripInfo: {
    flexDirection: 'row',
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  statItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.foreground,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontSize: 11,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  tripMeta: {
    gap: spacing.xs,
  },
  tripTypeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  tripTypeLabel: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  addressText: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  startTrip: {
    gap: spacing.md,
  },
  tripTypeSelector: {
    gap: spacing.sm,
  },
  tripTypeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tripTypeOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  tripTypeText: {
    fontSize: 14,
    color: colors.mutedForeground,
  },
  tripTypeTextActive: {
    color: colors.primary,
    fontWeight: '500',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
  compactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  startButton: {
    backgroundColor: colors.primary,
  },
  stopButton: {
    backgroundColor: '#ef4444',
  },
  startButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  stopButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  helpText: {
    fontSize: 12,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
});

export default TripTracker;
