import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import MapView, { Marker, Callout, PROVIDER_GOOGLE, Region, MapStyleElement } from 'react-native-maps';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { useJobsStore, useClientsStore, useAuthStore } from '../../src/lib/store';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../src/lib/api';
import { statusColors, spacing, radius, shadows } from '../../src/lib/design-tokens';
import { getBottomNavHeight } from '../../src/components/BottomNav';

const DARK_MAP_STYLE: MapStyleElement[] = [
  { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
  { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#4b6878' }] },
  { featureType: 'administrative.land_parcel', elementType: 'labels.text.fill', stylers: [{ color: '#64779e' }] },
  { featureType: 'administrative.province', elementType: 'geometry.stroke', stylers: [{ color: '#4b6878' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry.stroke', stylers: [{ color: '#334e87' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#023e58' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#283d6a' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#6f9ba5' }] },
  { featureType: 'poi', elementType: 'labels.text.stroke', stylers: [{ color: '#1d2c4d' }] },
  { featureType: 'poi.park', elementType: 'geometry.fill', stylers: [{ color: '#023e58' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#3C7680' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#98a5be' }] },
  { featureType: 'road', elementType: 'labels.text.stroke', stylers: [{ color: '#1d2c4d' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2c6675' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#255763' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#b0d5ce' }] },
  { featureType: 'road.highway', elementType: 'labels.text.stroke', stylers: [{ color: '#023e58' }] },
  { featureType: 'transit', elementType: 'labels.text.fill', stylers: [{ color: '#98a5be' }] },
  { featureType: 'transit', elementType: 'labels.text.stroke', stylers: [{ color: '#1d2c4d' }] },
  { featureType: 'transit.line', elementType: 'geometry.fill', stylers: [{ color: '#283d6a' }] },
  { featureType: 'transit.station', elementType: 'geometry', stylers: [{ color: '#3a4762' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4e6d70' }] },
];

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  done: 'Done',
  invoiced: 'Invoiced',
};

interface JobWithLocation {
  id: string;
  title: string;
  status: string;
  address?: string;
  clientId?: string;
  clientName?: string;
  latitude?: number;
  longitude?: number;
}

interface TeamMember {
  id: string;
  userId: string;
  role: string;
  user?: {
    firstName: string;
    lastName: string;
  };
  lastLocation?: {
    latitude: number;
    longitude: number;
    timestamp: string;
    speed?: number;
    battery?: number;
  };
  activityStatus?: 'online' | 'driving' | 'working' | 'offline';
}

type ViewMode = 'jobs' | 'team';
type StatusFilter = 'all' | 'pending' | 'scheduled' | 'in_progress' | 'done' | 'invoiced';

const DEFAULT_REGION: Region = {
  latitude: -16.9186,
  longitude: 145.7781,
  latitudeDelta: 0.5,
  longitudeDelta: 0.5,
};

const createStyles = (colors: ThemeColors) => {
  const ACTIVITY_CONFIG: Record<string, { label: string; color: string; icon: keyof typeof Feather.glyphMap }> = {
    online: { label: 'Online', color: colors.success, icon: 'check-circle' },
    driving: { label: 'Driving', color: colors.info, icon: 'truck' },
    working: { label: 'Working', color: colors.primary, icon: 'tool' },
    offline: { label: 'Offline', color: colors.mutedForeground, icon: 'moon' },
  };
  
  return {
    activityConfig: ACTIVITY_CONFIG,
    styles: StyleSheet.create({
      container: {
        flex: 1,
        backgroundColor: colors.background,
      },
      map: {
        ...StyleSheet.absoluteFillObject,
      },
      headerCard: {
        position: 'absolute',
        left: spacing.md,
        right: spacing.md,
        backgroundColor: colors.card,
        borderRadius: radius['2xl'],
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
        ...shadows.lg,
      },
      headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
      },
      headerIconContainer: {
        width: 40,
        height: 40,
        borderRadius: radius.lg,
        backgroundColor: colors.primaryLight,
        alignItems: 'center',
        justifyContent: 'center',
      },
      headerContent: {
        flex: 1,
        marginLeft: spacing.md,
      },
      headerTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: colors.foreground,
      },
      headerSubtitle: {
        fontSize: 13,
        color: colors.mutedForeground,
        marginTop: 2,
      },
      headerButton: {
        width: 36,
        height: 36,
        borderRadius: radius.lg,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: spacing.sm,
        backgroundColor: colors.muted,
      },
      controlsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.md,
        gap: spacing.sm,
      },
      filterButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.muted,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        gap: spacing.xs,
      },
      filterButtonText: {
        fontSize: 13,
        fontWeight: '500',
        color: colors.foreground,
      },
      toggleContainer: {
        flexDirection: 'row',
        backgroundColor: colors.muted,
        borderRadius: radius.lg,
        padding: 3,
        borderWidth: 1,
        borderColor: colors.border,
      },
      toggleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: radius.md,
        gap: spacing.xs,
      },
      toggleButtonActive: {
        backgroundColor: colors.primary,
      },
      toggleButtonText: {
        fontSize: 13,
        fontWeight: '500',
        color: colors.foreground,
      },
      toggleButtonTextActive: {
        color: '#fff',
      },
      legendButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginLeft: 'auto',
      },
      legendButtonText: {
        fontSize: 13,
        color: colors.mutedForeground,
      },
      filterDropdown: {
        marginTop: spacing.sm,
        backgroundColor: colors.card,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
      },
      filterOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm + 2,
        gap: spacing.sm,
      },
      filterOptionActive: {
        backgroundColor: colors.primaryLight,
      },
      filterDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
      },
      filterOptionText: {
        flex: 1,
        fontSize: 14,
        color: colors.foreground,
      },
      filterOptionTextActive: {
        fontWeight: '600',
        color: colors.primary,
      },
      legendCard: {
        position: 'absolute',
        right: spacing.md,
        backgroundColor: colors.card,
        borderRadius: radius.xl,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
        ...shadows.md,
        minWidth: 120,
      },
      legendTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.mutedForeground,
        marginBottom: spacing.sm,
      },
      legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.xs,
      },
      legendDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
      },
      legendLabel: {
        fontSize: 13,
        color: colors.foreground,
      },
      markerContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#fff',
        ...shadows.md,
      },
      teamMarker: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.card,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        ...shadows.md,
      },
      teamMarkerText: {
        fontSize: 14,
        fontWeight: '700',
        color: colors.foreground,
      },
      callout: {
        backgroundColor: colors.card,
        borderRadius: radius.md,
        padding: spacing.md,
        minWidth: 160,
        maxWidth: 220,
        ...shadows.lg,
      },
      calloutTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.foreground,
        marginBottom: spacing.xs,
      },
      calloutSubtitle: {
        fontSize: 12,
        color: colors.mutedForeground,
        marginBottom: spacing.sm,
      },
      calloutBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: spacing.sm,
        paddingVertical: 3,
        borderRadius: radius.xs,
        marginBottom: spacing.xs,
      },
      calloutBadgeText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#fff',
      },
      calloutHint: {
        fontSize: 10,
        color: colors.mutedForeground,
        fontStyle: 'italic',
        marginTop: spacing.xs,
      },
      calloutDetail: {
        fontSize: 11,
        color: colors.mutedForeground,
        marginTop: 2,
      },
      activityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginBottom: spacing.xs,
      },
      batteryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginTop: 2,
      },
      fabContainer: {
        position: 'absolute',
        right: spacing.lg,
        gap: spacing.md,
      },
      fabPrimary: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        ...shadows.lg,
      },
      fabSecondary: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.card,
        alignItems: 'center',
        justifyContent: 'center',
        ...shadows.md,
        borderWidth: 1,
        borderColor: colors.border,
      },
      loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: colors.isDark ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.7)',
        alignItems: 'center',
        justifyContent: 'center',
      },
    }),
  };
};

export default function MapScreen() {
  const { colors, isDark } = useTheme();
  const { styles, activityConfig } = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
  
  const { jobs, fetchJobs, isLoading: jobsLoading } = useJobsStore();
  const { clients, fetchClients } = useClientsStore();
  const { user } = useAuthStore();
  
  const [viewMode, setViewMode] = useState<ViewMode>('jobs');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showLegend, setShowLegend] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);

  const getClientName = useCallback((clientId?: string) => {
    if (!clientId) return undefined;
    const client = clients.find(c => c.id === clientId);
    return client?.name;
  }, [clients]);

  const jobsWithLocations: JobWithLocation[] = useMemo(() => {
    return jobs
      .filter(job => job.latitude && job.longitude)
      .map(job => ({
        id: job.id,
        title: job.title,
        status: job.status,
        address: job.address,
        clientId: job.clientId,
        clientName: getClientName(job.clientId),
        latitude: job.latitude,
        longitude: job.longitude,
      }));
  }, [jobs, getClientName]);

  const filteredJobs = useMemo(() => {
    if (statusFilter === 'all') return jobsWithLocations;
    return jobsWithLocations.filter(job => job.status === statusFilter);
  }, [jobsWithLocations, statusFilter]);

  const fetchTeamLocations = useCallback(async () => {
    try {
      const response = await api.get('/api/team/locations');
      if (response.ok) {
        const data = await response.json();
        setTeamMembers(data);
      }
    } catch (error) {
      console.log('Failed to fetch team locations:', error);
    }
  }, []);

  const requestLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      }
    } catch (error) {
      console.log('Location error:', error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchJobs(), fetchClients()]);
    if (viewMode === 'team') {
      await fetchTeamLocations();
    }
    setIsRefreshing(false);
  };

  const centerOnUser = () => {
    if (userLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        ...userLocation,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }, 500);
    }
  };

  const fitToMarkers = useCallback(() => {
    if (!mapRef.current) return;
    
    let coordinates: { latitude: number; longitude: number }[] = [];
    
    if (viewMode === 'jobs') {
      coordinates = filteredJobs
        .filter(job => job.latitude && job.longitude)
        .map(job => ({ latitude: job.latitude!, longitude: job.longitude! }));
    } else {
      coordinates = teamMembers
        .filter(member => member.lastLocation)
        .map(member => ({
          latitude: member.lastLocation!.latitude,
          longitude: member.lastLocation!.longitude,
        }));
    }
    
    if (coordinates.length > 0) {
      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: { 
          top: headerCollapsed ? 100 : 180, 
          right: 60, 
          bottom: bottomNavHeight + 100, 
          left: 60 
        },
        animated: true,
      });
    }
  }, [viewMode, filteredJobs, teamMembers, bottomNavHeight, headerCollapsed]);

  useEffect(() => {
    fetchJobs();
    fetchClients();
    requestLocation();
  }, []);

  useEffect(() => {
    if (viewMode === 'team') {
      fetchTeamLocations();
      const interval = setInterval(fetchTeamLocations, 30000);
      return () => clearInterval(interval);
    }
  }, [viewMode, fetchTeamLocations]);

  useEffect(() => {
    const hasData = viewMode === 'jobs' ? filteredJobs.length > 0 : teamMembers.length > 0;
    if (hasData && mapRef.current) {
      const timeout = setTimeout(fitToMarkers, 300);
      return () => clearTimeout(timeout);
    }
  }, [viewMode, statusFilter, filteredJobs.length, teamMembers.length, fitToMarkers]);

  const navigateToJob = (jobId: string) => {
    router.push(`/job/${jobId}`);
  };

  const getMarkerColor = (status: string) => {
    return statusColors[status as keyof typeof statusColors]?.dot || colors.mutedForeground;
  };

  const getActivityColor = (status?: string) => {
    return activityConfig[status || 'offline']?.color || colors.mutedForeground;
  };

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={DEFAULT_REGION}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        mapType="standard"
        customMapStyle={isDark ? DARK_MAP_STYLE : undefined}
        userInterfaceStyle={isDark ? 'dark' : 'light'}
        onMapReady={() => {
          if (filteredJobs.length > 0) {
            fitToMarkers();
          }
        }}
      >
        {viewMode === 'jobs' && filteredJobs.map((job) => (
          job.latitude && job.longitude && (
            <Marker
              key={job.id}
              coordinate={{ latitude: job.latitude, longitude: job.longitude }}
              onCalloutPress={() => navigateToJob(job.id)}
            >
              <View style={[styles.markerContainer, { backgroundColor: getMarkerColor(job.status) }]}>
                <Feather name="file-text" size={14} color="#fff" />
              </View>
              <Callout tooltip onPress={() => navigateToJob(job.id)}>
                <View style={styles.callout}>
                  <Text style={styles.calloutTitle}>{job.title}</Text>
                  {job.clientName && (
                    <Text style={styles.calloutSubtitle}>{job.clientName}</Text>
                  )}
                  <View style={[styles.calloutBadge, { backgroundColor: getMarkerColor(job.status) }]}>
                    <Text style={styles.calloutBadgeText}>{STATUS_LABELS[job.status]}</Text>
                  </View>
                  <Text style={styles.calloutHint}>Tap for details</Text>
                </View>
              </Callout>
            </Marker>
          )
        ))}

        {viewMode === 'team' && teamMembers.map((member) => (
          member.lastLocation && (
            <Marker
              key={member.id}
              coordinate={{
                latitude: member.lastLocation.latitude,
                longitude: member.lastLocation.longitude,
              }}
            >
              <View style={[styles.teamMarker, { borderColor: getActivityColor(member.activityStatus) }]}>
                <Text style={styles.teamMarkerText}>
                  {member.user?.firstName?.[0] || '?'}{member.user?.lastName?.[0] || '?'}
                </Text>
              </View>
              <Callout tooltip>
                <View style={styles.callout}>
                  <Text style={styles.calloutTitle}>
                    {member.user?.firstName} {member.user?.lastName}
                  </Text>
                  <View style={styles.activityRow}>
                    <Feather 
                      name={activityConfig[member.activityStatus || 'offline'].icon} 
                      size={12} 
                      color={getActivityColor(member.activityStatus)} 
                    />
                    <Text style={[styles.calloutSubtitle, { color: getActivityColor(member.activityStatus) }]}>
                      {activityConfig[member.activityStatus || 'offline'].label}
                    </Text>
                  </View>
                  {member.lastLocation.speed !== undefined && member.lastLocation.speed > 0 && (
                    <Text style={styles.calloutDetail}>
                      {Math.round(member.lastLocation.speed * 3.6)} km/h
                    </Text>
                  )}
                  {member.lastLocation.battery !== undefined && (
                    <View style={styles.batteryRow}>
                      <Feather 
                        name={member.lastLocation.battery > 20 ? 'battery' : 'battery-charging'} 
                        size={12} 
                        color={member.lastLocation.battery > 20 ? colors.mutedForeground : colors.warning} 
                      />
                      <Text style={styles.calloutDetail}>{member.lastLocation.battery}%</Text>
                    </View>
                  )}
                  <Text style={styles.calloutHint}>
                    Last updated: {formatTime(member.lastLocation.timestamp)}
                  </Text>
                </View>
              </Callout>
            </Marker>
          )
        ))}
      </MapView>

      {/* Floating Header Card - positioned higher */}
      <View style={[styles.headerCard, { top: insets.top + 8 }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerIconContainer}>
            <Feather name="map" size={20} color={colors.primary} />
          </View>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Job Map</Text>
            <Text style={styles.headerSubtitle}>
              {filteredJobs.length} jobs
            </Text>
          </View>
          <TouchableOpacity 
            onPress={handleRefresh} 
            style={styles.headerButton}
            disabled={isRefreshing}
            activeOpacity={0.7}
          >
            {isRefreshing ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Feather name="refresh-cw" size={18} color={colors.foreground} />
            )}
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => setHeaderCollapsed(!headerCollapsed)}
            style={styles.headerButton}
            activeOpacity={0.7}
          >
            <Feather 
              name={headerCollapsed ? "chevron-down" : "chevron-up"} 
              size={18} 
              color={colors.foreground} 
            />
          </TouchableOpacity>
        </View>

        {!headerCollapsed && (
          <View style={styles.controlsRow}>
            <TouchableOpacity 
              style={styles.filterButton}
              onPress={() => setShowFilters(!showFilters)}
              activeOpacity={0.7}
            >
              <Feather name="filter" size={16} color={colors.foreground} />
              <Text style={styles.filterButtonText}>
                {statusFilter === 'all' ? 'All Jobs' : STATUS_LABELS[statusFilter]}
              </Text>
              <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>

            <View style={styles.toggleContainer}>
              <TouchableOpacity
                style={[styles.toggleButton, viewMode === 'jobs' && styles.toggleButtonActive]}
                onPress={() => setViewMode('jobs')}
                activeOpacity={0.7}
              >
                <Feather 
                  name="briefcase" 
                  size={14} 
                  color={viewMode === 'jobs' ? '#fff' : colors.foreground} 
                />
                <Text style={[
                  styles.toggleButtonText,
                  viewMode === 'jobs' && styles.toggleButtonTextActive
                ]}>Jobs</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleButton, viewMode === 'team' && styles.toggleButtonActive]}
                onPress={() => setViewMode('team')}
                activeOpacity={0.7}
              >
                <Feather 
                  name="users" 
                  size={14} 
                  color={viewMode === 'team' ? '#fff' : colors.foreground} 
                />
                <Text style={[
                  styles.toggleButtonText,
                  viewMode === 'team' && styles.toggleButtonTextActive
                ]}>Team</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={styles.legendButton}
              onPress={() => setShowLegend(!showLegend)}
              activeOpacity={0.7}
            >
              <Text style={styles.legendButtonText}>Legend</Text>
              <Feather 
                name={showLegend ? "chevron-up" : "chevron-down"} 
                size={14} 
                color={colors.mutedForeground} 
              />
            </TouchableOpacity>
          </View>
        )}

        {showFilters && (
          <View style={styles.filterDropdown}>
            {(['all', 'pending', 'scheduled', 'in_progress', 'done', 'invoiced'] as const).map((status) => (
              <TouchableOpacity
                key={status}
                style={[
                  styles.filterOption,
                  statusFilter === status && styles.filterOptionActive
                ]}
                onPress={() => {
                  setStatusFilter(status);
                  setShowFilters(false);
                }}
                activeOpacity={0.7}
              >
                {status !== 'all' && (
                  <View style={[styles.filterDot, { backgroundColor: statusColors[status]?.dot }]} />
                )}
                <Text style={[
                  styles.filterOptionText,
                  statusFilter === status && styles.filterOptionTextActive
                ]}>
                  {status === 'all' ? 'All Jobs' : STATUS_LABELS[status]}
                </Text>
                {statusFilter === status && (
                  <Feather name="check" size={16} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {showLegend && (
        <View style={[styles.legendCard, { top: insets.top + (headerCollapsed ? 80 : 150) }]}>
          <Text style={styles.legendTitle}>Job Status</Text>
          {Object.entries(STATUS_LABELS).map(([status, label]) => (
            <View key={status} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: statusColors[status as keyof typeof statusColors]?.dot }]} />
              <Text style={styles.legendLabel}>{label}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={[styles.fabContainer, { bottom: bottomNavHeight + spacing.lg }]}>
        <TouchableOpacity 
          style={styles.fabSecondary}
          onPress={fitToMarkers}
          activeOpacity={0.7}
        >
          <Feather name="maximize-2" size={20} color={colors.foreground} />
        </TouchableOpacity>
        
        {userLocation && (
          <TouchableOpacity 
            style={styles.fabSecondary}
            onPress={centerOnUser}
            activeOpacity={0.7}
          >
            <Feather name="navigation" size={20} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {jobsLoading && !filteredJobs.length && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}
    </View>
  );
}
