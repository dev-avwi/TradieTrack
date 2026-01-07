import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Dimensions,
  Modal,
  Alert,
  Linking,
  ScrollView,
  Animated,
} from 'react-native';
import MapView, { Marker, Callout, PROVIDER_GOOGLE, Region, MapStyleElement, Camera } from 'react-native-maps';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../../src/lib/store';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUserRole } from '../../src/hooks/use-user-role';
import { api } from '../../src/lib/api';
import { statusColors, spacing, radius, shadows } from '../../src/lib/design-tokens';
import { getBottomNavHeight } from '../../src/components/BottomNav';

// Real-time polling interval for team locations (10 seconds)
const LOCATION_POLL_INTERVAL = 10000;

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
  assignedTo?: string;
}

interface TeamMember {
  id: string;
  userId: string;
  role: string;
  themeColor?: string | null;
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

type StatusFilter = 'all' | 'pending' | 'scheduled' | 'in_progress' | 'done' | 'invoiced';

interface GeofenceAlert {
  id: string;
  userId: string;
  jobId: string;
  userName: string;
  userAvatar?: string | null;
  jobTitle: string;
  alertType: 'arrival' | 'departure' | 'late' | 'speed_warning';
  address?: string | null;
  createdAt: string;
  isRead: boolean;
}

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
        zIndex: 30,
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
        flexWrap: 'wrap',
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
      toggleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.lg,
        gap: spacing.xs,
        borderWidth: 1,
        borderColor: colors.border,
      },
      toggleButtonActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
      },
      toggleButtonInactive: {
        backgroundColor: colors.muted,
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
        borderRadius: radius['2xl'],
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
        ...shadows.lg,
        minWidth: 130,
        zIndex: 25,
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
      // Life360-style team marker - compact bubble with subtle shadow
      teamMarkerOuter: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2.5,
        borderColor: 'rgba(255,255,255,0.95)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 4,
      },
      teamMarkerSelected: {
        width: 42,
        height: 42,
        borderRadius: 21,
        borderWidth: 3,
        borderColor: 'rgba(255,255,255,1)',
      },
      // Life360-style activity indicator - small dot at bottom right
      activityDot: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        width: 11,
        height: 11,
        borderRadius: 5.5,
        borderWidth: 2,
        borderColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.15,
        shadowRadius: 1,
        elevation: 2,
      },
      teamMarkerText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#ffffff',
        textShadowColor: 'rgba(0,0,0,0.15)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 1,
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
        zIndex: 20,
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
      assignModeBanner: {
        position: 'absolute',
        left: spacing.md,
        right: spacing.md,
        backgroundColor: colors.primary,
        borderRadius: radius.xl,
        padding: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        ...shadows.lg,
        zIndex: 25,
      },
      assignModeBannerText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
        flex: 1,
      },
      assignModeBannerSubtext: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 12,
        marginTop: 2,
      },
      cancelButton: {
        backgroundColor: 'rgba(255,255,255,0.25)',
        paddingHorizontal: spacing.md + 2,
        paddingVertical: spacing.sm + 2,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
      },
      cancelButtonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 14,
      },
      modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.lg,
      },
      modalContent: {
        backgroundColor: colors.card,
        borderRadius: radius['2xl'],
        padding: spacing.xl,
        width: '100%',
        maxWidth: 340,
        ...shadows.xl,
      },
      modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.foreground,
        textAlign: 'center',
        marginBottom: spacing.md,
      },
      modalText: {
        fontSize: 14,
        color: colors.mutedForeground,
        textAlign: 'center',
        marginBottom: spacing.lg,
        lineHeight: 20,
      },
      modalHighlight: {
        color: colors.foreground,
        fontWeight: '600',
      },
      modalButtons: {
        flexDirection: 'row',
        gap: spacing.md,
      },
      modalButton: {
        flex: 1,
        paddingVertical: spacing.md,
        borderRadius: radius.lg,
        alignItems: 'center',
        justifyContent: 'center',
      },
      modalButtonCancel: {
        backgroundColor: colors.muted,
      },
      modalButtonConfirm: {
        backgroundColor: colors.primary,
      },
      modalButtonText: {
        fontSize: 15,
        fontWeight: '600',
      },
      modalButtonTextCancel: {
        color: colors.foreground,
      },
      modalButtonTextConfirm: {
        color: '#fff',
      },
      // Life360-style name label - compact pill below marker
      nameLabel: {
        position: 'absolute',
        bottom: -18,
        left: '50%',
        transform: [{ translateX: -32 }],
        backgroundColor: 'rgba(255,255,255,0.92)',
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: 8,
        minWidth: 64,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 1.5,
        elevation: 2,
      },
      nameLabelText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#444',
        textAlign: 'center',
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
  
  const { user } = useAuthStore();
  const { isStaff, canAccessMap, isLoading: roleLoading, isSolo, isOwner, isManager } = useUserRole();
  
  const isAuthenticated = !!user;
  const hasMapAccess = isAuthenticated;
  // Show Team toggle for owners/managers - they should always be able to view team members
  const showTeamToggle = isAuthenticated && (isOwner || isManager || canAccessMap);
  const canViewTeamMode = isAuthenticated && (isOwner || isManager || canAccessMap);
  const canAssignJobs = isOwner || isManager;
  
  // Map jobs state - uses /api/map/jobs which geocodes addresses
  const [mapJobs, setMapJobs] = useState<JobWithLocation[]>([]);
  const [mapJobsLoading, setMapJobsLoading] = useState(false);
  
  // Filter states - both can be active simultaneously
  const [showJobs, setShowJobs] = useState(true);
  const [showTeamMembers, setShowTeamMembers] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showLegend, setShowLegend] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  
  // Tap-to-assign state
  const [selectedWorker, setSelectedWorker] = useState<TeamMember | null>(null);
  const [pendingAssignment, setPendingAssignment] = useState<{ worker: TeamMember; job: JobWithLocation } | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  
  // Job action sheet and route planning state
  const [selectedJob, setSelectedJob] = useState<JobWithLocation | null>(null);
  const [showJobActionSheet, setShowJobActionSheet] = useState(false);
  const [routeJobs, setRouteJobs] = useState<JobWithLocation[]>([]);
  const [showRoutePanel, setShowRoutePanel] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  
  // Geofence alerts state
  const [geofenceAlerts, setGeofenceAlerts] = useState<GeofenceAlert[]>([]);
  const [showAlerts, setShowAlerts] = useState(false);
  
  // Real-time location tracking state
  const [isLive, setIsLive] = useState(true);
  const [lastLocationUpdate, setLastLocationUpdate] = useState<Date | null>(null);
  const locationPollRef = useRef<NodeJS.Timeout | null>(null);
  
  // Track if user has manually interacted with map (to prevent auto-zoom)
  const userHasInteractedRef = useRef(false);
  const isInitialFitDoneRef = useRef(false);
  
  // Animation state for smooth marker transitions
  const markerScaleAnim = useRef(new Animated.Value(1)).current;

  // Fetch jobs from /api/map/jobs which geocodes addresses on-the-fly
  const fetchMapJobs = useCallback(async () => {
    try {
      setMapJobsLoading(true);
      console.log('[Map] Fetching geocoded jobs from /api/map/jobs...');
      const response = await api.get<any[]>('/api/map/jobs');
      
      if (response.error) {
        console.log('[Map] Map jobs API error:', response.error);
        setMapJobs([]);
        return;
      }
      
      const data = response.data;
      if (!Array.isArray(data)) {
        console.log('[Map] Map jobs response is not an array:', data);
        setMapJobs([]);
        return;
      }
      
      // Transform API response to JobWithLocation format
      const transformedJobs: JobWithLocation[] = data.map((job: any) => ({
        id: job.id,
        title: job.title,
        status: job.status,
        address: job.address,
        clientName: job.clientName,
        latitude: job.latitude,
        longitude: job.longitude,
        assignedTo: job.assignedTo,
      }));
      
      console.log(`[Map] Loaded ${transformedJobs.length} geocoded jobs`);
      setMapJobs(transformedJobs);
    } catch (error) {
      console.log('[Map] Failed to fetch map jobs:', error);
      setMapJobs([]);
    } finally {
      setMapJobsLoading(false);
    }
  }, []);

  const filteredJobs = useMemo(() => {
    if (statusFilter === 'all') return mapJobs;
    return mapJobs.filter(job => job.status === statusFilter);
  }, [mapJobs, statusFilter]);

  const fetchTeamLocations = useCallback(async () => {
    try {
      console.log('[Map] Fetching team locations...');
      const response = await api.get<any[]>('/api/team/locations');
      // API returns { data, error } - not a raw fetch response
      if (response.error) {
        console.log('[Map] Team locations API error:', response.error);
        setTeamMembers([]);
        return;
      }
      const data = response.data;
      console.log('[Map] Team locations response:', Array.isArray(data) ? `${data.length} members` : 'not an array');
      // Defensive check for array response
      if (!Array.isArray(data)) {
        console.log('[Map] Team locations response is not an array:', data);
        setTeamMembers([]);
        return;
      }
      // Transform API response to match TeamMember interface
      // API returns: { id, name, email, latitude, longitude, lastUpdated, currentJobId, currentJobTitle }
      // We need: { id, userId, role, user: { firstName, lastName }, lastLocation: { latitude, longitude, timestamp }, activityStatus }
      const transformedMembers: TeamMember[] = data
        .filter((m: any) => {
          // Filter out members without valid coordinates at transformation time
          // This prevents any (0,0) or null coordinates from entering state
          const lat = Number(m.latitude);
          const lng = Number(m.longitude);
          const isValidCoord = Number.isFinite(lat) && Number.isFinite(lng) && 
            (lat !== 0 || lng !== 0); // Allow (0, lng) or (lat, 0) but not (0,0)
          if (!isValidCoord) {
            console.log(`[Map] Skipping team member ${m.name} - invalid coordinates`);
          }
          return isValidCoord;
        })
        .map((m: any) => {
          const nameParts = (m.name || '').trim().split(' ');
          const firstName = nameParts[0] || '';
          const lastName = nameParts.slice(1).join(' ') || '';
          return {
            id: m.id,
            userId: m.id,
            role: 'worker',
            themeColor: m.themeColor || null,
            user: {
              firstName,
              lastName,
            },
            lastLocation: {
              latitude: Number(m.latitude),
              longitude: Number(m.longitude),
              timestamp: m.lastUpdated || new Date().toISOString(),
              speed: m.speed != null ? Number(m.speed) : undefined,
              battery: m.batteryLevel != null ? Number(m.batteryLevel) : undefined,
            },
            // Use activityStatus from API response, fallback to computed value
            activityStatus: m.activityStatus || (m.currentJobId ? 'working' : 'online'),
          };
        });
      setTeamMembers(transformedMembers);
    } catch (error) {
      console.log('Failed to fetch team locations:', error);
    }
  }, []);

  const fetchGeofenceAlerts = useCallback(async () => {
    if (!canViewTeamMode) return;
    try {
      const response = await api.get<GeofenceAlert[]>('/api/map/geofence-alerts');
      // API returns { data, error } - not a raw fetch response
      if (response.error) {
        console.log('Geofence alerts API error:', response.error);
        setGeofenceAlerts([]);
        return;
      }
      if (response.data && Array.isArray(response.data)) {
        setGeofenceAlerts(response.data);
      } else {
        setGeofenceAlerts([]);
      }
    } catch (error) {
      console.log('Failed to fetch geofence alerts:', error);
      setGeofenceAlerts([]);
    }
  }, [canViewTeamMode]);

  const markAlertRead = async (alertId: string) => {
    try {
      await api.post(`/api/map/geofence-alerts/${alertId}/read`);
      setGeofenceAlerts(prev => prev.map(a => 
        a.id === alertId ? { ...a, isRead: true } : a
      ));
    } catch (error) {
      console.log('Failed to mark alert read:', error);
    }
  };

  const unreadAlerts = useMemo(() => {
    return geofenceAlerts.filter(a => !a.isRead);
  }, [geofenceAlerts]);

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
    await fetchMapJobs();
    if (showTeamMembers && canViewTeamMode) {
      await Promise.all([fetchTeamLocations(), fetchGeofenceAlerts()]);
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
    
    if (showJobs) {
      coordinates = coordinates.concat(
        filteredJobs
          .filter(job => job.latitude && job.longitude)
          .map(job => ({ latitude: job.latitude!, longitude: job.longitude! }))
      );
    }
    
    if (showTeamMembers && canViewTeamMode) {
      coordinates = coordinates.concat(
        teamMembers
          .filter(member => member.lastLocation)
          .map(member => ({
            latitude: member.lastLocation!.latitude,
            longitude: member.lastLocation!.longitude,
          }))
      );
    }
    
    if (coordinates.length > 0) {
      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: { 
          top: headerCollapsed ? 100 : 200, 
          right: 60, 
          bottom: bottomNavHeight + 100, 
          left: 60 
        },
        animated: true,
      });
    }
  }, [showJobs, showTeamMembers, filteredJobs, teamMembers, bottomNavHeight, headerCollapsed, canViewTeamMode]);

  useEffect(() => {
    fetchMapJobs();
    requestLocation();
  }, [fetchMapJobs]);

  // Real-time team location polling - Life360 style live updates
  useEffect(() => {
    // Always clean up existing interval first to prevent overlap
    if (locationPollRef.current) {
      clearInterval(locationPollRef.current);
      locationPollRef.current = null;
    }
    
    if (showTeamMembers && canViewTeamMode && isLive) {
      // Initial fetch
      fetchTeamLocations().then(() => {
        setLastLocationUpdate(new Date());
      }).catch(err => {
        console.log('[Map] Initial location fetch failed:', err);
      });
      
      // Set up frequent polling for live tracking (every 10 seconds)
      locationPollRef.current = setInterval(() => {
        fetchTeamLocations().then(() => {
          setLastLocationUpdate(new Date());
          console.log('[Map] Live location update received');
        }).catch(err => {
          console.log('[Map] Live location poll failed:', err);
        });
      }, LOCATION_POLL_INTERVAL);
    }
    
    return () => {
      if (locationPollRef.current) {
        clearInterval(locationPollRef.current);
        locationPollRef.current = null;
      }
    };
  }, [showTeamMembers, fetchTeamLocations, canViewTeamMode, isLive]);

  // Fetch geofence alerts for owners/managers
  useEffect(() => {
    if (canViewTeamMode) {
      fetchGeofenceAlerts();
      const interval = setInterval(fetchGeofenceAlerts, 60000);
      return () => clearInterval(interval);
    }
  }, [canViewTeamMode, fetchGeofenceAlerts]);

  // Auto-fit map to markers ONLY on initial load or when user explicitly toggles filters
  // Don't auto-fit when: worker is selected, user has interacted, or just polling updates
  useEffect(() => {
    const hasData = (showJobs && filteredJobs.length > 0) || (showTeamMembers && teamMembers.length > 0);
    
    // Skip if user has interacted with map or has a worker selected
    if (userHasInteractedRef.current || selectedWorker) {
      return;
    }
    
    // Only auto-fit on initial load or when filters change (not on polling updates)
    if (hasData && mapRef.current && !isInitialFitDoneRef.current) {
      const timeout = setTimeout(() => {
        fitToMarkers();
        isInitialFitDoneRef.current = true;
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [showJobs, showTeamMembers, statusFilter, selectedWorker, fitToMarkers]);
  
  // Reset interaction flag when user explicitly toggles jobs/team visibility
  useEffect(() => {
    // When user toggles filter buttons, allow one auto-fit
    userHasInteractedRef.current = false;
    isInitialFitDoneRef.current = false;
  }, [showJobs, showTeamMembers, statusFilter]);
  
  // Handle map interaction to prevent auto-zoom after user pans/zooms
  const handleMapPanDrag = useCallback(() => {
    userHasInteractedRef.current = true;
  }, []);

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

  // Convert zoom level to region deltas (iOS uses deltas, not zoom)
  const zoomToDeltas = useCallback((zoom: number) => {
    // Approximate conversion: delta = 360 / (2^zoom)
    // zoom 15 ≈ 0.01, zoom 16 ≈ 0.005, zoom 17 ≈ 0.0025
    const delta = 360 / Math.pow(2, zoom);
    return { latitudeDelta: delta, longitudeDelta: delta };
  }, []);

  // Animate camera to a specific location with smooth zoom - Life360 style
  // Uses animateToRegion for iOS compatibility (zoom param is ignored on Apple Maps)
  const animateCameraToLocation = useCallback((
    latitude: number, 
    longitude: number, 
    options: { zoom?: number; duration?: number } = {}
  ) => {
    if (!mapRef.current) return;
    
    const { zoom = 15, duration = 600 } = options;
    
    // Use animateToRegion which works on both iOS and Android
    // iOS ignores zoom param in animateCamera, so we must use deltas
    const { latitudeDelta, longitudeDelta } = zoomToDeltas(zoom);
    
    mapRef.current.animateToRegion(
      {
        latitude,
        longitude,
        latitudeDelta,
        longitudeDelta,
      },
      duration
    );
  }, [zoomToDeltas]);

  // Handle worker selection for assignment - with smooth camera animation
  const handleWorkerTap = useCallback((member: TeamMember) => {
    // Provide haptic feedback for tap
    Haptics.selectionAsync();
    
    const memberLat = member.lastLocation?.latitude;
    const memberLng = member.lastLocation?.longitude;
    
    if (selectedWorker?.id === member.id) {
      // Deselect if tapping same worker - stay at current zoom (don't zoom out)
      setSelectedWorker(null);
      markerScaleAnim.setValue(1); // Reset scale
      // Don't zoom out - user wants to stay where they are
    } else {
      // Animate camera to the member's location with zoom
      // Use longer duration for smoother feel when zooming from far away
      const animDuration = 800; // Longer for smooth zoom from overview to street level
      const targetZoom = 17; // Street-level zoom for close-up view
      
      if (memberLat && memberLng) {
        animateCameraToLocation(memberLat, memberLng, { 
          zoom: targetZoom, 
          duration: animDuration 
        });
      }
      
      // Set selected worker after camera has moved significantly
      // Wait for most of the camera animation to complete to prevent flash
      setTimeout(() => {
        setSelectedWorker(member);
        
        // Pulse animation for selected marker
        markerScaleAnim.setValue(1);
        Animated.sequence([
          Animated.spring(markerScaleAnim, {
            toValue: 1.2,
            friction: 4,
            tension: 120,
            useNativeDriver: true,
          }),
          Animated.spring(markerScaleAnim, {
            toValue: 1,
            friction: 6,
            tension: 100,
            useNativeDriver: true,
          }),
        ]).start();
      }, animDuration * 0.5); // Wait for 50% of animation before state update
    }
  }, [selectedWorker, animateCameraToLocation, fitToMarkers, markerScaleAnim]);

  // Handle job tap when worker is selected
  const handleJobTapForAssignment = (job: JobWithLocation) => {
    if (!selectedWorker || !canAssignJobs) {
      navigateToJob(job.id);
      return;
    }
    
    // Show confirmation modal
    setPendingAssignment({ worker: selectedWorker, job });
  };

  // Confirm assignment
  const confirmAssignment = async () => {
    if (!pendingAssignment) return;
    
    setIsAssigning(true);
    
    try {
      const response = await api.post(`/api/jobs/${pendingAssignment.job.id}/assign`, {
        assignedTo: pendingAssignment.worker.userId,
      });
      
      if (response.ok) {
        Alert.alert(
          'Job Assigned',
          `${pendingAssignment.job.title} has been assigned to ${pendingAssignment.worker.user?.firstName} ${pendingAssignment.worker.user?.lastName}`,
          [{ text: 'OK' }]
        );
        // Refresh jobs to reflect the assignment
        await fetchMapJobs();
      } else {
        const errorData = await response.json().catch(() => ({}));
        Alert.alert('Assignment Failed', errorData.error || 'Failed to assign job. Please try again.');
      }
    } catch (error) {
      console.error('Assignment error:', error);
      Alert.alert('Error', 'An error occurred while assigning the job.');
    } finally {
      setIsAssigning(false);
      setPendingAssignment(null);
      setSelectedWorker(null);
    }
  };

  const cancelAssignment = () => {
    setPendingAssignment(null);
  };

  const clearWorkerSelection = () => {
    setSelectedWorker(null);
  };

  // Handle job marker press - shows action sheet instead of navigating directly
  const handleJobMarkerPress = (job: JobWithLocation) => {
    // If a worker is selected for assignment, use the assignment flow
    if (selectedWorker && canAssignJobs) {
      handleJobTapForAssignment(job);
      return;
    }
    // Otherwise show action sheet
    setSelectedJob(job);
    setShowJobActionSheet(true);
  };

  // Check if job is already in route
  const isJobInRoute = useCallback((jobId: string) => {
    return routeJobs.some(j => j.id === jobId);
  }, [routeJobs]);

  // Action sheet handlers
  const handleViewJob = () => {
    if (selectedJob) {
      setShowJobActionSheet(false);
      router.push(`/job/${selectedJob.id}`);
    }
  };

  const handleAddToRoute = () => {
    if (selectedJob && !isJobInRoute(selectedJob.id)) {
      setRouteJobs(prev => [...prev, selectedJob]);
      setShowRoutePanel(true);
      Alert.alert('Added to Route', `${selectedJob.title} has been added to your route.`);
    } else if (selectedJob) {
      Alert.alert('Already in Route', 'This job is already in your route.');
    }
    setShowJobActionSheet(false);
  };

  const handleGetDirections = () => {
    if (selectedJob?.latitude && selectedJob?.longitude) {
      const { openMapsWithPreference } = require('../../src/lib/maps-store');
      openMapsWithPreference(selectedJob.latitude, selectedJob.longitude, selectedJob.address);
    }
    setShowJobActionSheet(false);
  };

  // Route panel handlers
  const handleRemoveFromRoute = (jobId: string) => {
    setRouteJobs(prev => prev.filter(j => j.id !== jobId));
  };

  const handleClearRoute = () => {
    Alert.alert(
      'Clear Route',
      'Are you sure you want to clear all jobs from your route?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: () => {
          setRouteJobs([]);
          setShowRoutePanel(false);
        }},
      ]
    );
  };

  const handleOptimizeRoute = async () => {
    if (routeJobs.length < 2) {
      Alert.alert('Not Enough Stops', 'Add at least 2 jobs to optimize your route.');
      return;
    }
    
    setIsOptimizing(true);
    try {
      const response = await api.post('/api/routes/optimize', {
        jobIds: routeJobs.map(j => j.id),
        userLatitude: userLocation?.latitude,
        userLongitude: userLocation?.longitude,
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.optimizedJobIds) {
          // Reorder routeJobs based on optimized order
          const optimizedJobs = data.optimizedJobIds
            .map((id: string) => routeJobs.find(j => j.id === id))
            .filter(Boolean) as JobWithLocation[];
          setRouteJobs(optimizedJobs);
          Alert.alert('Route Optimized', 'Your route has been optimized for the shortest distance.');
        }
      } else {
        Alert.alert('Optimization Failed', 'Could not optimize route. Please try again.');
      }
    } catch (error) {
      console.error('Route optimization error:', error);
      Alert.alert('Error', 'An error occurred while optimizing the route.');
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleStartRoute = () => {
    if (routeJobs.length === 0) return;
    
    // Build waypoints for multi-stop navigation
    const waypoints = routeJobs
      .filter(j => j.latitude && j.longitude)
      .map(j => `${j.latitude},${j.longitude}`);
    
    if (waypoints.length === 0) return;
    
    const destination = waypoints[waypoints.length - 1];
    const waypointsParam = waypoints.slice(0, -1).join('|');
    
    // Platform-specific multi-stop navigation
    if (Platform.OS === 'ios') {
      // iOS Maps doesn't support waypoints well, use Google Maps URL
      const url = `https://www.google.com/maps/dir/?api=1&destination=${destination}&waypoints=${encodeURIComponent(waypointsParam)}&travelmode=driving`;
      Linking.openURL(url);
    } else {
      // Android Google Maps navigation with waypoints
      const url = `https://www.google.com/maps/dir/?api=1&destination=${destination}&waypoints=${encodeURIComponent(waypointsParam)}&travelmode=driving`;
      Linking.openURL(url);
    }
  };

  // Show restricted view for staff without map access
  if (!hasMapAccess && !roleLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: spacing.xl }]}>
        <View style={{ alignItems: 'center', gap: spacing.md }}>
          <View style={{ 
            width: 80, 
            height: 80, 
            borderRadius: 40, 
            backgroundColor: colors.muted, 
            alignItems: 'center', 
            justifyContent: 'center' 
          }}>
            <Feather name="map" size={40} color={colors.mutedForeground} />
          </View>
          <Text style={{ fontSize: 20, fontWeight: '600', color: colors.foreground, textAlign: 'center' }}>
            Map Access Restricted
          </Text>
          <Text style={{ fontSize: 14, color: colors.mutedForeground, textAlign: 'center', lineHeight: 20 }}>
            Team tracking is available for managers and owners.{'\n'}You can view your assigned jobs on the Jobs screen.
          </Text>
          <TouchableOpacity
            style={{ 
              backgroundColor: colors.primary, 
              paddingHorizontal: spacing.xl, 
              paddingVertical: spacing.md, 
              borderRadius: radius.md,
              marginTop: spacing.md
            }}
            onPress={() => router.push('/(tabs)/jobs')}
            activeOpacity={0.8}
          >
            <Text style={{ color: colors.white, fontWeight: '600' }}>View My Jobs</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const activeTeamCount = teamMembers.filter(m => m.activityStatus !== 'offline').length;

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
        onPanDrag={handleMapPanDrag}
        onMapReady={() => {
          if (filteredJobs.length > 0 || teamMembers.length > 0) {
            fitToMarkers();
          }
        }}
      >
        {/* Job Markers */}
        {showJobs && filteredJobs.map((job) => {
          const jobInRoute = isJobInRoute(job.id);
          return job.latitude && job.longitude && (
            <Marker
              key={`job-${job.id}`}
              coordinate={{ latitude: job.latitude, longitude: job.longitude }}
              onPress={() => handleJobMarkerPress(job)}
              onCalloutPress={() => navigateToJob(job.id)}
              calloutAnchor={{ x: 0.5, y: 0 }}
              stopPropagation={!!selectedWorker}
            >
              <View style={{ alignItems: 'center' }}>
                <View style={[
                  styles.markerContainer, 
                  { backgroundColor: getMarkerColor(job.status) },
                  selectedWorker && { opacity: 0.9 },
                  jobInRoute && { 
                    borderWidth: 3, 
                    borderColor: colors.primary,
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                  }
                ]}>
                  <Feather name="file-text" size={14} color="#fff" />
                </View>
                {jobInRoute && (
                  <View style={{
                    position: 'absolute',
                    top: -6,
                    right: -6,
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    backgroundColor: colors.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 2,
                    borderColor: '#fff',
                  }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#fff' }}>
                      {routeJobs.findIndex(j => j.id === job.id) + 1}
                    </Text>
                  </View>
                )}
              </View>
              {/* Only show callout when no worker is selected - avoids messy popup behind assign modal */}
              {!selectedWorker && (
                <Callout tooltip onPress={() => navigateToJob(job.id)}>
                  <View style={styles.callout}>
                    <Text style={styles.calloutTitle}>{job.title}</Text>
                    {job.clientName && (
                      <Text style={styles.calloutSubtitle}>{job.clientName}</Text>
                    )}
                    <View style={[styles.calloutBadge, { backgroundColor: getMarkerColor(job.status) }]}>
                      <Text style={styles.calloutBadgeText}>{STATUS_LABELS[job.status]}</Text>
                    </View>
                    {jobInRoute ? (
                      <Text style={[styles.calloutHint, { color: colors.primary }]}>
                        Stop #{routeJobs.findIndex(j => j.id === job.id) + 1} in route
                      </Text>
                    ) : (
                      <Text style={styles.calloutHint}>Tap for options</Text>
                    )}
                  </View>
                </Callout>
              )}
            </Marker>
          );
        })}

        {/* Team Member Markers - Life360 Style */}
        {/* Note: Members are pre-filtered at transformation time - all members in state have valid coords */}
        {showTeamMembers && canViewTeamMode && teamMembers.map((member) => {
          // Safety check (should never fail since we filter at transformation)
          if (!member.lastLocation) return null;
          
          // Use member's theme color as base, fallback to a nice blue
          const memberColor = member.themeColor || '#3B82F6';
          const activityColor = getActivityColor(member.activityStatus);
          const initials = `${member.user?.firstName?.[0] || '?'}${member.user?.lastName?.[0] || '?'}`;
          const isSelected = selectedWorker?.id === member.id;
          const fullName = `${member.user?.firstName || ''} ${member.user?.lastName || ''}`.trim();
          const shortName = member.user?.firstName || fullName.split(' ')[0] || 'Unknown';
          
          return (
            <Marker
              key={`team-${member.id}`}
              coordinate={{
                latitude: member.lastLocation.latitude,
                longitude: member.lastLocation.longitude,
              }}
              onPress={() => handleWorkerTap(member)}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={isSelected} // Only track when selected for animation
            >
              <Animated.View 
                style={{ 
                  alignItems: 'center', 
                  paddingBottom: 20,
                  // Apply scale animation only to selected marker
                  transform: [{ scale: isSelected ? markerScaleAnim : 1 }],
                }}
              >
                {/* Main bubble - Life360 style compact circle */}
                <View style={[
                  styles.teamMarkerOuter, 
                  { 
                    backgroundColor: memberColor,
                    borderColor: isSelected ? colors.primary : 'rgba(255,255,255,0.95)',
                  },
                  isSelected && styles.teamMarkerSelected,
                ]}>
                  <Text style={styles.teamMarkerText}>{initials}</Text>
                  {/* Activity dot - always visible, positioned at bottom-right */}
                  <View style={[styles.activityDot, { backgroundColor: activityColor }]} />
                </View>
                {/* Name label - compact pill below marker */}
                <View style={[
                  styles.nameLabel,
                  isSelected && { backgroundColor: colors.primary }
                ]}>
                  <Text style={[
                    styles.nameLabelText,
                    isSelected && { color: '#fff' }
                  ]} numberOfLines={1}>
                    {shortName}
                  </Text>
                </View>
              </Animated.View>
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
                    <Text style={[styles.calloutSubtitle, { color: getActivityColor(member.activityStatus), marginBottom: 0 }]}>
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
                  {canAssignJobs && (
                    <Text style={[styles.calloutHint, { color: colors.primary, marginTop: spacing.xs }]}>
                      Tap to select for assignment
                    </Text>
                  )}
                </View>
              </Callout>
            </Marker>
          );
        })}
      </MapView>

      {/* Floating Header Card */}
      <View style={[styles.headerCard, { top: insets.top + 8 }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerIconContainer}>
            <Feather name="map" size={20} color={colors.primary} />
          </View>
          <View style={styles.headerContent}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Text style={styles.headerTitle}>Job Map</Text>
              {/* Live indicator - shows when real-time tracking is active */}
              {isLive && showTeamMembers && canViewTeamMode && (
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  backgroundColor: 'rgba(34, 197, 94, 0.15)',
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: 10,
                }}>
                  <View style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: '#22C55E',
                  }} />
                  <Text style={{ fontSize: 10, fontWeight: '600', color: '#22C55E' }}>LIVE</Text>
                </View>
              )}
            </View>
            <Text style={styles.headerSubtitle}>
              {filteredJobs.length} jobs
              {showTeamMembers && canViewTeamMode && ` • ${activeTeamCount} active`}
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

            {/* Toggle Buttons - Both can be active */}
            <TouchableOpacity
              style={[
                styles.toggleButton, 
                showJobs ? styles.toggleButtonActive : styles.toggleButtonInactive
              ]}
              onPress={() => setShowJobs(!showJobs)}
              activeOpacity={0.7}
            >
              <Feather 
                name="briefcase" 
                size={14} 
                color={showJobs ? '#fff' : colors.foreground} 
              />
              <Text style={[
                styles.toggleButtonText,
                showJobs && styles.toggleButtonTextActive
              ]}>Jobs</Text>
            </TouchableOpacity>

            {showTeamToggle && (
              <TouchableOpacity
                style={[
                  styles.toggleButton, 
                  showTeamMembers ? styles.toggleButtonActive : styles.toggleButtonInactive,
                  showTeamMembers && { backgroundColor: colors.success }
                ]}
                onPress={() => setShowTeamMembers(!showTeamMembers)}
                activeOpacity={0.7}
              >
                <Feather 
                  name="users" 
                  size={14} 
                  color={showTeamMembers ? '#fff' : colors.foreground} 
                />
                <Text style={[
                  styles.toggleButtonText,
                  showTeamMembers && styles.toggleButtonTextActive
                ]}>Team</Text>
              </TouchableOpacity>
            )}

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

            {/* Alerts Button - Owners/Managers only */}
            {canViewTeamMode && (
              <TouchableOpacity 
                style={[
                  styles.legendButton,
                  unreadAlerts.length > 0 && { backgroundColor: `${colors.destructive}15` }
                ]}
                onPress={() => setShowAlerts(!showAlerts)}
                activeOpacity={0.7}
              >
                <Feather 
                  name="bell" 
                  size={14} 
                  color={unreadAlerts.length > 0 ? colors.destructive : colors.mutedForeground} 
                />
                {unreadAlerts.length > 0 && (
                  <View style={{
                    position: 'absolute',
                    top: 2,
                    right: 2,
                    backgroundColor: colors.destructive,
                    borderRadius: 8,
                    minWidth: 16,
                    height: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 4,
                  }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#fff' }}>
                      {unreadAlerts.length}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
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

      {/* Legend Card */}
      {showLegend && (
        <View style={[styles.legendCard, { top: insets.top + (headerCollapsed ? 80 : 180) }]}>
          <Text style={styles.legendTitle}>Job Status</Text>
          {Object.entries(STATUS_LABELS).map(([status, label]) => (
            <View key={status} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: statusColors[status as keyof typeof statusColors]?.dot }]} />
              <Text style={styles.legendLabel}>{label}</Text>
            </View>
          ))}
          {showTeamMembers && canViewTeamMode && (
            <>
              <Text style={[styles.legendTitle, { marginTop: spacing.md }]}>Team Status</Text>
              {Object.entries(activityConfig).map(([status, config]) => (
                <View key={status} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: config.color }]} />
                  <Text style={styles.legendLabel}>{config.label}</Text>
                </View>
              ))}
            </>
          )}
        </View>
      )}

      {/* Geofence Alerts Panel */}
      {showAlerts && unreadAlerts.length > 0 && (
        <View style={[styles.legendCard, { top: insets.top + (headerCollapsed ? 80 : 180), maxHeight: 280 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Feather name="bell" size={16} color={colors.destructive} />
              <Text style={styles.legendTitle}>Recent Alerts</Text>
            </View>
            <TouchableOpacity 
              onPress={() => setShowAlerts(false)}
              style={{ padding: spacing.xs }}
              activeOpacity={0.7}
            >
              <Feather name="x" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            {unreadAlerts.slice(0, 5).map((alert) => {
              const initials = alert.userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
              const alertColor = alert.alertType === 'arrival' ? colors.success :
                                alert.alertType === 'departure' ? colors.destructive :
                                alert.alertType === 'late' ? colors.warning : colors.info;
              
              const formatAlertTime = (dateStr: string) => {
                const date = new Date(dateStr);
                const now = new Date();
                const diffMs = now.getTime() - date.getTime();
                const diffMins = Math.floor(diffMs / 60000);
                const diffHours = Math.floor(diffMs / 3600000);
                if (diffMins < 1) return 'Just now';
                if (diffMins < 60) return `${diffMins}m ago`;
                if (diffHours < 24) return `${diffHours}h ago`;
                return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
              };
              
              return (
                <TouchableOpacity
                  key={alert.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    gap: spacing.sm,
                    padding: spacing.sm,
                    backgroundColor: colors.muted,
                    borderRadius: radius.lg,
                    marginBottom: spacing.xs,
                  }}
                  onPress={() => markAlertRead(alert.id)}
                  activeOpacity={0.7}
                >
                  <View style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: alertColor,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    {alert.userAvatar ? (
                      <View style={{ width: 36, height: 36, borderRadius: 18, overflow: 'hidden' }}>
                        {/* Avatar image would go here */}
                      </View>
                    ) : (
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#fff' }}>{initials}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, color: colors.foreground }}>
                      <Text style={{ fontWeight: '600' }}>{alert.userName}</Text>
                      <Text style={{ color: colors.mutedForeground }}>
                        {alert.alertType === 'arrival' ? ' arrived at ' :
                         alert.alertType === 'departure' ? ' left ' :
                         alert.alertType === 'late' ? ' is late for ' : ' alert for '}
                      </Text>
                      <Text style={{ fontWeight: '500' }}>{alert.jobTitle}</Text>
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 2 }}>
                      {formatAlertTime(alert.createdAt)}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Selected Worker Banner */}
      {selectedWorker && (
        <View style={[styles.assignModeBanner, { bottom: bottomNavHeight + spacing.md }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.assignModeBannerText}>
              {selectedWorker.user?.firstName} {selectedWorker.user?.lastName} selected
            </Text>
            <Text style={styles.assignModeBannerSubtext}>
              Tap a job to assign
            </Text>
          </View>
          <TouchableOpacity 
            style={[styles.cancelButton, { minWidth: 70, alignItems: 'center' }]}
            onPress={() => {
              console.log('[Map] Cancel button pressed - clearing selection');
              setSelectedWorker(null);
            }}
            activeOpacity={0.6}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* FAB Container */}
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

      {/* Team Member Chips - Life360 Style compact horizontal scroll */}
      {canViewTeamMode && showTeamMembers && teamMembers.length > 0 && !selectedWorker && routeJobs.length === 0 && (
        <View style={{
          position: 'absolute',
          bottom: bottomNavHeight + spacing.sm,
          left: 0,
          right: 64,
          paddingHorizontal: spacing.sm,
          zIndex: 15,
        }}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.sm }}
          >
            {teamMembers.map((member) => {
              const memberColor = member.themeColor || '#3B82F6';
              const activityColor = getActivityColor(member.activityStatus);
              const initials = `${member.user?.firstName?.[0] || '?'}${member.user?.lastName?.[0] || '?'}`;
              const firstName = member.user?.firstName || 'Unknown';
              const isWorking = member.activityStatus === 'working';
              const isDriving = member.activityStatus === 'driving';
              const isOnline = member.activityStatus === 'online';
              const speed = member.lastLocation?.speed;
              
              return (
                <TouchableOpacity
                  key={member.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.xs + 2,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: spacing.xs + 2,
                    backgroundColor: 'rgba(255,255,255,0.96)',
                    borderRadius: 20,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.12,
                    shadowRadius: 3,
                    elevation: 3,
                  }}
                  onPress={() => handleWorkerTap(member)}
                  activeOpacity={0.8}
                >
                  {/* Compact avatar with activity dot */}
                  <View style={{ position: 'relative' }}>
                    <View style={{
                      width: 30,
                      height: 30,
                      borderRadius: 15,
                      backgroundColor: memberColor,
                      borderWidth: 2,
                      borderColor: 'rgba(255,255,255,0.95)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: '#fff' }}>{initials}</Text>
                    </View>
                    {/* Activity indicator dot */}
                    <View style={{
                      position: 'absolute',
                      bottom: -1,
                      right: -1,
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: activityColor,
                      borderWidth: 1.5,
                      borderColor: '#fff',
                    }} />
                  </View>
                  <View>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#333' }} numberOfLines={1}>
                      {firstName}
                    </Text>
                    <Text style={{ fontSize: 10, color: '#666', fontWeight: '500' }}>
                      {isDriving && speed && speed > 0
                        ? `${Math.round(speed * 3.6)} km/h`
                        : isWorking 
                          ? 'Working' 
                          : isOnline 
                            ? 'Online' 
                            : 'Offline'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Loading Overlay */}
      {mapJobsLoading && !filteredJobs.length && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}

      {/* Assignment Confirmation Modal */}
      <Modal
        visible={!!pendingAssignment}
        transparent
        animationType="fade"
        onRequestClose={cancelAssignment}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Assign Job?</Text>
            <Text style={styles.modalText}>
              Assign{' '}
              <Text style={styles.modalHighlight}>{pendingAssignment?.job.title}</Text>
              {'\n'}to{' '}
              <Text style={styles.modalHighlight}>
                {pendingAssignment?.worker.user?.firstName} {pendingAssignment?.worker.user?.lastName}
              </Text>
              ?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={cancelAssignment}
                disabled={isAssigning}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextCancel]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={confirmAssignment}
                disabled={isAssigning}
                activeOpacity={0.7}
              >
                {isAssigning ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={[styles.modalButtonText, styles.modalButtonTextConfirm]}>Assign</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Job Action Sheet Modal */}
      <Modal
        visible={showJobActionSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowJobActionSheet(false)}
      >
        <TouchableOpacity 
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'flex-end',
          }}
          activeOpacity={1}
          onPress={() => setShowJobActionSheet(false)}
        >
          <View style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: radius['2xl'],
            borderTopRightRadius: radius['2xl'],
            padding: spacing.lg,
            paddingBottom: insets.bottom + spacing.lg,
            ...shadows.xl,
          }}>
            {/* Handle bar */}
            <View style={{
              width: 40,
              height: 4,
              backgroundColor: colors.border,
              borderRadius: 2,
              alignSelf: 'center',
              marginBottom: spacing.lg,
            }} />
            
            {/* Job Info Header */}
            {selectedJob && (
              <View style={{
                marginBottom: spacing.lg,
                paddingBottom: spacing.md,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}>
                <Text style={{
                  fontSize: 18,
                  fontWeight: '700',
                  color: colors.foreground,
                  marginBottom: spacing.xs,
                }}>
                  {selectedJob.title}
                </Text>
                {selectedJob.clientName && (
                  <Text style={{
                    fontSize: 14,
                    color: colors.mutedForeground,
                    marginBottom: spacing.xs,
                  }}>
                    {selectedJob.clientName}
                  </Text>
                )}
                {selectedJob.address && (
                  <Text style={{
                    fontSize: 13,
                    color: colors.mutedForeground,
                  }} numberOfLines={2}>
                    {selectedJob.address}
                  </Text>
                )}
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginTop: spacing.sm,
                  gap: spacing.sm,
                }}>
                  <View style={{
                    paddingHorizontal: spacing.sm,
                    paddingVertical: spacing.xs,
                    borderRadius: radius.sm,
                    backgroundColor: getMarkerColor(selectedJob.status),
                  }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: '#fff' }}>
                      {STATUS_LABELS[selectedJob.status]}
                    </Text>
                  </View>
                  {isJobInRoute(selectedJob.id) && (
                    <View style={{
                      paddingHorizontal: spacing.sm,
                      paddingVertical: spacing.xs,
                      borderRadius: radius.sm,
                      backgroundColor: colors.primary,
                    }}>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: '#fff' }}>
                        In Route
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}
            
            {/* Action Buttons */}
            <View style={{ gap: spacing.sm }}>
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.muted,
                  padding: spacing.md,
                  borderRadius: radius.lg,
                  gap: spacing.md,
                }}
                onPress={handleViewJob}
                activeOpacity={0.7}
              >
                <View style={{
                  width: 40,
                  height: 40,
                  borderRadius: radius.md,
                  backgroundColor: colors.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Feather name="file-text" size={20} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: colors.foreground }}>
                    View Job
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                    See full job details and journey
                  </Text>
                </View>
                <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.muted,
                  padding: spacing.md,
                  borderRadius: radius.lg,
                  gap: spacing.md,
                  opacity: selectedJob && isJobInRoute(selectedJob.id) ? 0.5 : 1,
                }}
                onPress={handleAddToRoute}
                activeOpacity={0.7}
                disabled={selectedJob ? isJobInRoute(selectedJob.id) : false}
              >
                <View style={{
                  width: 40,
                  height: 40,
                  borderRadius: radius.md,
                  backgroundColor: colors.success,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Feather name="plus-circle" size={20} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: colors.foreground }}>
                    {selectedJob && isJobInRoute(selectedJob.id) ? 'Already in Route' : 'Add to Route'}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                    Plan multi-stop navigation
                  </Text>
                </View>
                <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.muted,
                  padding: spacing.md,
                  borderRadius: radius.lg,
                  gap: spacing.md,
                }}
                onPress={handleGetDirections}
                activeOpacity={0.7}
              >
                <View style={{
                  width: 40,
                  height: 40,
                  borderRadius: radius.md,
                  backgroundColor: colors.info,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Feather name="navigation" size={20} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: colors.foreground }}>
                    Get Directions
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                    Open in Maps app
                  </Text>
                </View>
                <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            
            {/* Cancel Button */}
            <TouchableOpacity
              style={{
                alignItems: 'center',
                padding: spacing.md,
                marginTop: spacing.md,
              }}
              onPress={() => setShowJobActionSheet(false)}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.mutedForeground }}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Route Panel (Bottom Sheet) - Matches header card design */}
      {routeJobs.length > 0 && (
        <View style={{
          position: 'absolute',
          left: spacing.md,
          right: spacing.md,
          bottom: bottomNavHeight + spacing.sm,
          backgroundColor: colors.card,
          borderRadius: radius['2xl'],
          maxHeight: showRoutePanel ? SCREEN_HEIGHT * 0.45 : 56,
          ...shadows.lg,
          borderWidth: 1,
          borderColor: colors.border,
          zIndex: 18,
        }}>
          {/* Collapsed Header - Matches header card style */}
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: spacing.md,
            }}
            onPress={() => setShowRoutePanel(!showRoutePanel)}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <View style={{
                width: 36,
                height: 36,
                borderRadius: radius.lg,
                backgroundColor: colors.primaryLight,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Feather name="navigation" size={18} color={colors.primary} />
              </View>
              <View>
                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.foreground }}>
                  Route: {routeJobs.length} stop{routeJobs.length !== 1 ? 's' : ''}
                </Text>
                <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                  Tap to {showRoutePanel ? 'collapse' : 'expand'}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <TouchableOpacity
                style={{
                  backgroundColor: colors.primary,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  borderRadius: radius.lg,
                }}
                onPress={handleStartRoute}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>Start</Text>
              </TouchableOpacity>
              <View style={{
                width: 32,
                height: 32,
                borderRadius: radius.lg,
                backgroundColor: colors.muted,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Feather 
                  name={showRoutePanel ? "chevron-down" : "chevron-up"} 
                  size={18} 
                  color={colors.mutedForeground} 
                />
              </View>
            </View>
          </TouchableOpacity>
          
          {/* Expanded Content */}
          {showRoutePanel && (
            <View style={{ flex: 1 }}>
              {/* Subtle divider */}
              <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: spacing.md }} />
              <ScrollView 
                style={{ flex: 1, padding: spacing.md, paddingTop: spacing.sm }}
                showsVerticalScrollIndicator={false}
              >
                {routeJobs.map((job, index) => (
                  <View
                    key={job.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: colors.muted,
                      padding: spacing.sm,
                      borderRadius: radius.md,
                      marginBottom: spacing.sm,
                      gap: spacing.sm,
                    }}
                  >
                    <View style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: colors.primary,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>
                        {index + 1}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '500', color: colors.foreground }} numberOfLines={1}>
                        {job.title}
                      </Text>
                      {job.address && (
                        <Text style={{ fontSize: 11, color: colors.mutedForeground }} numberOfLines={1}>
                          {job.address}
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity
                      onPress={() => handleRemoveFromRoute(job.id)}
                      style={{ padding: spacing.xs }}
                      activeOpacity={0.7}
                    >
                      <Feather name="x" size={18} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
              
              {/* Route Actions - Compact button row */}
              <View style={{
                flexDirection: 'row',
                gap: spacing.sm,
                padding: spacing.md,
                paddingTop: spacing.sm,
              }}>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.muted,
                    paddingVertical: spacing.sm + 2,
                    borderRadius: radius.lg,
                    gap: spacing.xs,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                  onPress={handleClearRoute}
                  activeOpacity={0.7}
                >
                  <Feather name="trash-2" size={14} color={colors.destructive} />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.destructive }}>
                    Clear
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.muted,
                    paddingVertical: spacing.sm + 2,
                    borderRadius: radius.lg,
                    gap: spacing.xs,
                    borderWidth: 1,
                    borderColor: colors.border,
                    opacity: (isOptimizing || routeJobs.length < 2) ? 0.5 : 1,
                  }}
                  onPress={handleOptimizeRoute}
                  disabled={isOptimizing || routeJobs.length < 2}
                  activeOpacity={0.7}
                >
                  {isOptimizing ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <>
                      <Feather name="zap" size={14} color={colors.primary} />
                      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.primary }}>
                        Optimize
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={{
                    flex: 1.2,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.primary,
                    paddingVertical: spacing.sm + 2,
                    borderRadius: radius.lg,
                    gap: spacing.xs,
                  }}
                  onPress={handleStartRoute}
                  activeOpacity={0.7}
                >
                  <Feather name="navigation" size={14} color="#fff" />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>
                    Start
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}
