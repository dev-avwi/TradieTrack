import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  Dimensions,
  TextInput,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import MapView, { Marker, Region, PROVIDER_DEFAULT, MapStyleElement } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, shadows, typography, sizes, iconSizes, usePageShell, pageShell, componentStyles } from '../../src/lib/design-tokens';
import { api } from '../../src/lib/api';
import { useAuthStore } from '../../src/lib/store';
import { formatDistanceToNow, format, isAfter } from 'date-fns';
import { isTablet, useContentWidth } from '../../src/lib/device';
import { useUserRole } from '../../src/hooks/use-user-role';

const DARK_MAP_STYLE: MapStyleElement[] = [
  { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
];

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const STATUS_CONFIG: Record<string, { color: string; label: string; icon: keyof typeof Feather.glyphMap }> = {
  online: { color: '#22c55e', label: 'Online', icon: 'circle' },
  busy: { color: '#f59e0b', label: 'Busy', icon: 'circle' },
  on_job: { color: '#3b82f6', label: 'On Job', icon: 'tool' },
  break: { color: '#a855f7', label: 'On Break', icon: 'coffee' },
  offline: { color: '#6b7280', label: 'Offline', icon: 'circle' },
};

const ACTIVITY_CONFIG: Record<string, { icon: keyof typeof Feather.glyphMap; color: string; bgColor: string }> = {
  job_created: { icon: 'briefcase', color: '#3b82f6', bgColor: 'rgba(59,130,246,0.1)' },
  job_started: { icon: 'play', color: '#22c55e', bgColor: 'rgba(34,197,94,0.1)' },
  job_completed: { icon: 'check-circle', color: '#10b981', bgColor: 'rgba(16,185,129,0.1)' },
  quote_sent: { icon: 'file-text', color: '#f59e0b', bgColor: 'rgba(245,158,11,0.1)' },
  invoice_sent: { icon: 'send', color: '#ef4444', bgColor: 'rgba(239,68,68,0.1)' },
  invoice_paid: { icon: 'credit-card', color: '#10b981', bgColor: 'rgba(16,185,129,0.1)' },
  check_in: { icon: 'map-pin', color: '#3b82f6', bgColor: 'rgba(59,130,246,0.1)' },
  check_out: { icon: 'log-out', color: '#a855f7', bgColor: 'rgba(168,85,247,0.1)' },
  client_added: { icon: 'user-plus', color: '#3b82f6', bgColor: 'rgba(59,130,246,0.1)' },
  message_sent: { icon: 'message-circle', color: '#a855f7', bgColor: 'rgba(168,85,247,0.1)' },
};

interface TeamPresenceData {
  userId: string;
  status: string;
  statusMessage?: string;
  currentJobId?: string;
  lastSeenAt?: string;
  lastLocationLat?: number;
  lastLocationLng?: number;
  user?: {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    profileImageUrl?: string;
  };
  currentJob?: {
    id: string;
    title: string;
  };
}

interface TeamMemberData {
  id: string;
  userId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  profileImageUrl?: string;
  role?: string;
  roleName?: string;
  inviteStatus?: string;
  hourlyRate?: string;
}

interface ActivityFeedItem {
  id: string;
  actorName?: string;
  actorUserId?: string;
  activityType: string;
  entityType?: string;
  entityId?: string;
  entityTitle?: string;
  description?: string;
  isImportant?: boolean;
  createdAt: string;
  metadata?: Record<string, any>;
}

interface JobData {
  id: string;
  title: string;
  status: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  clientName?: string;
  assignedTo?: string;
  scheduledAt?: string;
}

interface MemberWithDetails extends TeamMemberData {
  assignedJobs: JobData[];
  presence?: TeamPresenceData;
}

interface TeamMemberAvailability {
  id: string;
  teamMemberId: string;
  dayOfWeek: number;
  isAvailable: boolean;
  startTime?: string;
  endTime?: string;
}

interface TeamMemberTimeOff {
  id: string;
  teamMemberId: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  notes?: string;
}

type TabType = 'live' | 'admin' | 'scheduling' | 'performance';
type LiveViewMode = 'status' | 'activity' | 'map';

// Cairns-area default to match demo data, but will dynamically center on team members
const DEFAULT_REGION: Region = {
  latitude: -16.9203,
  longitude: 145.7710,
  latitudeDelta: 0.1,
  longitudeDelta: 0.1,
};

function getInitials(firstName?: string, lastName?: string, email?: string): string {
  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }
  if (firstName) return firstName[0].toUpperCase();
  if (email) return email[0].toUpperCase();
  return '?';
}

function formatLastSeen(dateStr?: string): string {
  if (!dateStr) return 'Unknown';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

export default function TeamOperationsScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const responsiveShell = usePageShell();
  const contentWidth = useContentWidth();
  const isTabletDevice = isTablet();
  const styles = useMemo(() => createStyles(colors, contentWidth, responsiveShell.paddingHorizontal, isTabletDevice), [colors, contentWidth, responsiveShell.paddingHorizontal, isTabletDevice]);
  const { user } = useAuthStore();
  const mapRef = useRef<MapView>(null);
  
  // Subscription-aware access control
  const { hasTeamSubscription, hasProSubscription, subscriptionTier } = useUserRole();
  const needsUpgrade = !hasTeamSubscription && (subscriptionTier === 'pro' || subscriptionTier === 'free' || subscriptionTier === 'trial');

  const [activeTab, setActiveTab] = useState<TabType>('live');
  const [liveViewMode, setLiveViewMode] = useState<LiveViewMode>('status');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [teamMembers, setTeamMembers] = useState<TeamMemberData[]>([]);
  const [teamPresence, setTeamPresence] = useState<TeamPresenceData[]>([]);
  const [activityFeed, setActivityFeed] = useState<ActivityFeedItem[]>([]);
  const [jobs, setJobs] = useState<JobData[]>([]);
  const [availabilityMap, setAvailabilityMap] = useState<Map<string, TeamMemberAvailability[]>>(new Map());
  const [timeOffRequests, setTimeOffRequests] = useState<TeamMemberTimeOff[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);

  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [showTimeOffModal, setShowTimeOffModal] = useState(false);
  const [timeOffStart, setTimeOffStart] = useState('');
  const [timeOffEnd, setTimeOffEnd] = useState('');
  const [timeOffReason, setTimeOffReason] = useState('annual_leave');
  const [timeOffNotes, setTimeOffNotes] = useState('');

  const isOwnerOrManager = user?.role === 'owner' || user?.role === 'admin' || user?.role === 'manager';

  const fetchData = useCallback(async () => {
    try {
      const [membersRes, presenceRes, activityRes, jobsRes, timeOffRes] = await Promise.all([
        api.get<TeamMemberData[]>('/api/team/members'),
        api.get<TeamPresenceData[]>('/api/team/presence'),
        api.get<ActivityFeedItem[]>('/api/activity-feed?limit=50'),
        api.get<JobData[]>('/api/jobs'),
        api.get<TeamMemberTimeOff[]>('/api/team/time-off'),
      ]);

      if (membersRes.data) setTeamMembers(membersRes.data);
      if (presenceRes.data) setTeamPresence(presenceRes.data);
      if (activityRes.data) setActivityFeed(activityRes.data);
      if (jobsRes.data) setJobs(jobsRes.data);
      if (timeOffRes.data) setTimeOffRequests(timeOffRes.data);
    } catch (error) {
      console.error('Error fetching team data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAvailability = useCallback(async (memberId: string) => {
    setAvailabilityLoading(true);
    try {
      const res = await api.get<TeamMemberAvailability[]>(`/api/team/availability?teamMemberId=${memberId}`);
      if (res.data) {
        setAvailabilityMap(prev => new Map(prev).set(memberId, res.data!));
      }
    } catch (error) {
      console.error('Error fetching availability:', error);
    } finally {
      setAvailabilityLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (selectedMemberId) {
      fetchAvailability(selectedMemberId);
    }
  }, [selectedMemberId, fetchAvailability]);

  const selectedMemberAvailability = useMemo(() => {
    if (!selectedMemberId) return [];
    return availabilityMap.get(selectedMemberId) || [];
  }, [selectedMemberId, availabilityMap]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setAvailabilityMap(new Map());
    await fetchData();
    if (selectedMemberId) {
      await fetchAvailability(selectedMemberId);
    }
    setRefreshing(false);
  }, [fetchData, fetchAvailability, selectedMemberId]);

  const acceptedMembers = useMemo(() => 
    teamMembers.filter(m => m.inviteStatus === 'accepted'),
    [teamMembers]
  );

  const membersWithDetails = useMemo(() => {
    return acceptedMembers.map(member => {
      const presence = teamPresence.find(p => p.userId === member.userId);
      const assignedJobs = jobs.filter(j => j.assignedTo === member.userId);
      return { ...member, presence, assignedJobs };
    });
  }, [acceptedMembers, teamPresence, jobs]);

  // Animate map to center on team members when they have locations
  useEffect(() => {
    if (liveViewMode !== 'map') return;
    
    const membersWithLocations = membersWithDetails.filter(
      m => m.presence?.lastLocationLat && m.presence?.lastLocationLng
    );
    
    if (membersWithLocations.length > 0 && mapRef.current) {
      const lats = membersWithLocations.map(m => m.presence!.lastLocationLat!);
      const lngs = membersWithLocations.map(m => m.presence!.lastLocationLng!);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      const centerLat = (minLat + maxLat) / 2;
      const centerLng = (minLng + maxLng) / 2;
      const latDelta = Math.max(0.05, (maxLat - minLat) * 1.5);
      const lngDelta = Math.max(0.05, (maxLng - minLng) * 1.5);
      
      mapRef.current.animateToRegion({
        latitude: centerLat,
        longitude: centerLng,
        latitudeDelta: latDelta,
        longitudeDelta: lngDelta,
      }, 500);
    }
  }, [membersWithDetails, liveViewMode]);

  const memberStats = useMemo(() => {
    return acceptedMembers.map(member => {
      const memberJobs = jobs.filter(j => j.assignedTo === member.userId);
      const completedJobs = memberJobs.filter(j => j.status === 'completed');
      const inProgressJobs = memberJobs.filter(j => j.status === 'in_progress');
      const scheduledJobs = memberJobs.filter(j => j.status === 'scheduled');

      return {
        ...member,
        totalJobs: memberJobs.length,
        completedJobs: completedJobs.length,
        inProgressJobs: inProgressJobs.length,
        scheduledJobs: scheduledJobs.length,
        completionRate: memberJobs.length > 0 ? Math.round((completedJobs.length / memberJobs.length) * 100) : 0,
      };
    }).sort((a, b) => b.completedJobs - a.completedJobs);
  }, [acceptedMembers, jobs]);

  const totalCompleted = memberStats.reduce((sum, m) => sum + m.completedJobs, 0);
  const totalInProgress = memberStats.reduce((sum, m) => sum + m.inProgressJobs, 0);
  const avgCompletionRate = memberStats.length > 0
    ? Math.round(memberStats.reduce((sum, m) => sum + m.completionRate, 0) / memberStats.length)
    : 0;

  const pendingTimeOff = timeOffRequests.filter(t => t.status === 'pending');
  const upcomingTimeOff = timeOffRequests.filter(t => 
    t.status === 'approved' && isAfter(new Date(t.startDate), new Date())
  );

  const onlineCount = useMemo(() => {
    return teamPresence.filter(p => p.status === 'online' || p.status === 'on_job').length;
  }, [teamPresence]);

  const onJobCount = useMemo(() => {
    return teamPresence.filter(p => p.status === 'on_job').length;
  }, [teamPresence]);

  const unassignedJobs = useMemo(() => {
    return jobs.filter(j => !j.assignedTo && (j.status === 'pending' || j.status === 'scheduled'));
  }, [jobs]);

  const handleUpdateAvailability = async (dayOfWeek: number, isAvailable: boolean, startTime?: string, endTime?: string) => {
    if (!selectedMemberId) return;
    
    const newAvailabilityItem: TeamMemberAvailability = {
      id: `temp-${dayOfWeek}`,
      teamMemberId: selectedMemberId,
      dayOfWeek,
      isAvailable,
      startTime: startTime || '08:00',
      endTime: endTime || '17:00',
    };
    
    setAvailabilityMap(prev => {
      const newMap = new Map(prev);
      const memberAvailability = [...(newMap.get(selectedMemberId) || [])];
      const existingIndex = memberAvailability.findIndex(a => a.dayOfWeek === dayOfWeek);
      if (existingIndex >= 0) {
        memberAvailability[existingIndex] = newAvailabilityItem;
      } else {
        memberAvailability.push(newAvailabilityItem);
      }
      newMap.set(selectedMemberId, memberAvailability);
      return newMap;
    });
    
    try {
      const res = await api.post<TeamMemberAvailability>('/api/team/availability', {
        teamMemberId: selectedMemberId,
        dayOfWeek,
        isAvailable,
        startTime: startTime || '08:00',
        endTime: endTime || '17:00',
      });
      if (res.data) {
        setAvailabilityMap(prev => {
          const newMap = new Map(prev);
          const memberAvailability = [...(newMap.get(selectedMemberId) || [])];
          const idx = memberAvailability.findIndex(a => a.dayOfWeek === dayOfWeek);
          if (idx >= 0) {
            memberAvailability[idx] = res.data!;
          } else {
            memberAvailability.push(res.data!);
          }
          newMap.set(selectedMemberId, memberAvailability);
          return newMap;
        });
      }
    } catch (error) {
      await fetchAvailability(selectedMemberId);
      Alert.alert('Error', 'Failed to update availability');
    }
  };

  const handleRequestTimeOff = async () => {
    if (!selectedMemberId || !timeOffStart || !timeOffEnd) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      const res = await api.post<TeamMemberTimeOff>('/api/team/time-off', {
        teamMemberId: selectedMemberId,
        startDate: timeOffStart,
        endDate: timeOffEnd,
        reason: timeOffReason,
        notes: timeOffNotes || undefined,
      });

      if (res.data && !res.error) {
        setShowTimeOffModal(false);
        setTimeOffStart('');
        setTimeOffEnd('');
        setTimeOffReason('annual_leave');
        setTimeOffNotes('');
        await fetchData();
        Alert.alert('Success', 'Time off requested');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to request time off');
    }
  };

  const handleApproveTimeOff = async (id: string, status: 'approved' | 'rejected') => {
    try {
      const res = await api.patch<TeamMemberTimeOff>(`/api/team/time-off/${id}`, { status });
      if (res.data && !res.error) {
        await fetchData();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update time off request');
    }
  };

  const tabIconSize = isTabletDevice ? 18 : 16;
  
  const renderTabs = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={styles.tabBarContent}>
      {[
        { key: 'live' as TabType, icon: 'activity' as const, label: 'Live Ops' },
        ...(isOwnerOrManager ? [{ key: 'admin' as TabType, icon: 'users' as const, label: 'Team Admin' }] : []),
        { key: 'scheduling' as TabType, icon: 'calendar' as const, label: 'Scheduling' },
        { key: 'performance' as TabType, icon: 'trending-up' as const, label: 'Performance' },
      ].map(tab => {
        const isActive = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabButton, isActive && styles.tabButtonActive]}
            onPress={() => setActiveTab(tab.key)}
            activeOpacity={0.7}
          >
            <Feather name={tab.icon} size={tabIconSize} color={isActive ? '#ffffff' : colors.mutedForeground} />
            <Text style={[styles.tabButtonText, isActive && styles.tabButtonTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  const renderLiveViewToggle = () => (
    <View style={styles.liveViewToggle}>
      <TouchableOpacity
        style={[styles.liveViewButton, liveViewMode === 'status' && styles.liveViewButtonActive]}
        onPress={() => setLiveViewMode('status')}
        activeOpacity={0.7}
      >
        <Feather name="users" size={14} color={liveViewMode === 'status' ? colors.primary : colors.mutedForeground} />
        <Text style={[styles.liveViewText, liveViewMode === 'status' && styles.liveViewTextActive]}>Status</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.liveViewButton, liveViewMode === 'activity' && styles.liveViewButtonActive]}
        onPress={() => setLiveViewMode('activity')}
        activeOpacity={0.7}
      >
        <Feather name="clock" size={14} color={liveViewMode === 'activity' ? colors.primary : colors.mutedForeground} />
        <Text style={[styles.liveViewText, liveViewMode === 'activity' && styles.liveViewTextActive]}>Activity</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.liveViewButton, liveViewMode === 'map' && styles.liveViewButtonActive]}
        onPress={() => setLiveViewMode('map')}
        activeOpacity={0.7}
      >
        <Feather name="map" size={14} color={liveViewMode === 'map' ? colors.primary : colors.mutedForeground} />
        <Text style={[styles.liveViewText, liveViewMode === 'map' && styles.liveViewTextActive]}>Map</Text>
      </TouchableOpacity>
    </View>
  );

  const renderMemberCard = (member: MemberWithDetails) => {
    const status = member.presence?.status || 'offline';
    const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.offline;

    return (
      <TouchableOpacity
        key={member.id}
        style={styles.memberCard}
        onPress={() => router.push(`/more/team-management?memberId=${member.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.avatarContainer}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarText}>{getInitials(member.firstName, member.lastName, member.email)}</Text>
          </View>
          <View style={[styles.statusDot, { backgroundColor: statusConfig.color }]} />
        </View>
        <View style={styles.memberInfo}>
          <View style={styles.memberNameRow}>
            <Text style={styles.memberName}>{member.firstName} {member.lastName}</Text>
            {member.roleName && (
              <View style={[styles.roleBadge, { backgroundColor: `${statusConfig.color}15` }]}>
                <Text style={[styles.roleBadgeText, { color: statusConfig.color }]}>{member.roleName}</Text>
              </View>
            )}
          </View>
          <Text style={styles.memberStatus}>
            {statusConfig.label} · {formatLastSeen(member.presence?.lastSeenAt)}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.messageButton}
          onPress={() => router.push(`/more/direct-messages?userId=${member.userId}`)}
          activeOpacity={0.7}
        >
          <Feather name="message-circle" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderActivityItem = (item: ActivityFeedItem) => {
    const config = ACTIVITY_CONFIG[item.activityType] || { icon: 'activity', color: colors.mutedForeground, bgColor: colors.muted };

    return (
      <View key={item.id} style={styles.activityItem}>
        <View style={[styles.activityIcon, { backgroundColor: config.bgColor }]}>
          <Feather name={config.icon} size={16} color={config.color} />
        </View>
        <View style={styles.activityContent}>
          <Text style={styles.activityTitle}>{item.description || item.activityType.replace(/_/g, ' ')}</Text>
          {item.actorName && <Text style={styles.activityDescription}>{item.actorName}</Text>}
          <Text style={styles.activityTime}>{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}</Text>
        </View>
        {item.isImportant && (
          <View style={styles.importantBadge}>
            <Text style={styles.importantBadgeText}>Important</Text>
          </View>
        )}
      </View>
    );
  };

  const renderLiveOpsTab = () => {
    if (liveViewMode === 'map') {
      // Calculate region based on team members with locations
      const membersWithLocations = membersWithDetails.filter(
        m => m.presence?.lastLocationLat && m.presence?.lastLocationLng
      );
      
      let mapRegion = DEFAULT_REGION;
      if (membersWithLocations.length > 0) {
        const lats = membersWithLocations.map(m => m.presence!.lastLocationLat!);
        const lngs = membersWithLocations.map(m => m.presence!.lastLocationLng!);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);
        const centerLat = (minLat + maxLat) / 2;
        const centerLng = (minLng + maxLng) / 2;
        const latDelta = Math.max(0.05, (maxLat - minLat) * 1.5);
        const lngDelta = Math.max(0.05, (maxLng - minLng) * 1.5);
        mapRegion = {
          latitude: centerLat,
          longitude: centerLng,
          latitudeDelta: latDelta,
          longitudeDelta: lngDelta,
        };
      }
      
      return (
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_DEFAULT}
            initialRegion={mapRegion}
            region={mapRegion}
            customMapStyle={isDark ? DARK_MAP_STYLE : undefined}
          >
            {membersWithLocations.map(member => {
              const statusConfig = STATUS_CONFIG[member.presence?.status || 'offline'];
              const firstName = member.firstName || '';
              const lastName = member.lastName || '';
              const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || '?';
              const shortName = firstName || member.email?.split('@')[0] || 'Team';
              const memberColor = member.themeColor || statusConfig?.color || '#3b82f6';
              
              return (
                <Marker
                  key={member.id}
                  coordinate={{
                    latitude: member.presence!.lastLocationLat!,
                    longitude: member.presence!.lastLocationLng!,
                  }}
                  anchor={{ x: 0.5, y: 0.5 }}
                  tracksViewChanges={false}
                >
                  <View style={{ alignItems: 'center' }}>
                    <View style={[styles.teamMarkerOuter, { backgroundColor: memberColor }]}>
                      <Text style={styles.teamMarkerText}>{initials}</Text>
                      <View style={[styles.activityDot, { backgroundColor: statusConfig?.color || '#9ca3af' }]} />
                    </View>
                    <View style={styles.nameLabel}>
                      <Text style={styles.nameLabelText} numberOfLines={1}>{shortName}</Text>
                    </View>
                  </View>
                </Marker>
              );
            })}
          </MapView>
          <View style={[styles.mapOverlay, { top: insets.top + spacing.md }]}>
            {renderLiveViewToggle()}
          </View>
          {membersWithLocations.length === 0 && (
            <View style={styles.mapEmptyState}>
              <View style={styles.mapEmptyIcon}>
                <Feather name="map-pin" size={32} color={colors.mutedForeground} />
              </View>
              <Text style={styles.mapEmptyTitle}>No Team Locations</Text>
              <Text style={styles.mapEmptyText}>
                Team members will appear here when they share their location
              </Text>
            </View>
          )}
        </View>
      );
    }

    return (
      <ScrollView
        style={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.heroCard}>
          <View style={[styles.heroIconContainer, { backgroundColor: 'rgba(34,197,94,0.1)' }]}>
            <Feather name="circle" size={20} color="#22c55e" />
          </View>
          <Text style={styles.heroValue}>{onlineCount}</Text>
          <Text style={styles.heroLabel}>Online Now</Text>
        </View>

        <View style={styles.kpiStatsRow}>
          <View style={styles.kpiStatItem}>
            <View style={[styles.kpiStatIcon, { backgroundColor: 'rgba(59,130,246,0.1)' }]}>
              <Feather name="users" size={20} color="#3b82f6" />
            </View>
            <Text style={styles.kpiStatValue}>{acceptedMembers.length}</Text>
            <Text style={styles.kpiStatLabel}>Team</Text>
          </View>
          <View style={styles.kpiStatItem}>
            <View style={[styles.kpiStatIcon, { backgroundColor: 'rgba(59,130,246,0.1)' }]}>
              <Feather name="tool" size={20} color="#3b82f6" />
            </View>
            <Text style={styles.kpiStatValue}>{onJobCount}</Text>
            <Text style={styles.kpiStatLabel}>On Job</Text>
          </View>
          <View style={styles.kpiStatItem}>
            <View style={[styles.kpiStatIcon, { backgroundColor: 'rgba(249,115,22,0.1)' }]}>
              <Feather name="briefcase" size={20} color="#E8862E" />
            </View>
            <Text style={styles.kpiStatValue}>{unassignedJobs.length}</Text>
            <Text style={styles.kpiStatLabel}>Unassigned</Text>
          </View>
        </View>

        {renderLiveViewToggle()}

        {liveViewMode === 'status' && (
          <>
            <Text style={styles.sectionTitle}>Team Status ({membersWithDetails.length})</Text>
            {membersWithDetails.map(renderMemberCard)}
          </>
        )}

        {liveViewMode === 'activity' && (
          <>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            {activityFeed.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconCircle}>
                  <Feather name="clock" size={40} color={colors.mutedForeground} />
                </View>
                <Text style={styles.emptyStateTitle}>No Recent Activity</Text>
                <Text style={styles.emptyStateText}>Team activity will appear here as your team works</Text>
              </View>
            ) : (
              activityFeed.slice(0, 20).map(renderActivityItem)
            )}
          </>
        )}
      </ScrollView>
    );
  };

  const renderTeamAdminTab = () => (
    <ScrollView
      style={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <View style={[styles.statIcon, { backgroundColor: 'rgba(59,130,246,0.1)' }]}>
            <Feather name="users" size={18} color="#3b82f6" />
          </View>
          <Text style={styles.statValue}>{acceptedMembers.length}</Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.statItem}>
          <View style={[styles.statIcon, { backgroundColor: 'rgba(245,158,11,0.1)' }]}>
            <Feather name="mail" size={18} color="#f59e0b" />
          </View>
          <Text style={styles.statValue}>{teamMembers.filter(m => m.inviteStatus === 'pending').length}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push('/more/team-management')}
          activeOpacity={0.7}
        >
          <Feather name="user-plus" size={20} color={colors.primary} />
          <Text style={styles.actionButtonText}>Manage Team</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Team Members</Text>
      {acceptedMembers.map(member => (
        <TouchableOpacity
          key={member.id}
          style={styles.memberCard}
          onPress={() => router.push(`/more/team-management?memberId=${member.id}`)}
          activeOpacity={0.7}
        >
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarText}>{getInitials(member.firstName, member.lastName, member.email)}</Text>
          </View>
          <View style={styles.memberInfo}>
            <Text style={styles.memberName}>{member.firstName} {member.lastName}</Text>
            <Text style={styles.memberStatus}>{member.email}</Text>
          </View>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{member.roleName || member.role}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderSchedulingTab = () => (
    <ScrollView
      style={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Weekly Availability</Text>
        </View>

        <View style={styles.selectContainer}>
          <Text style={styles.selectLabel}>Select Team Member</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.memberChips}>
              {acceptedMembers.map(member => (
                <TouchableOpacity
                  key={member.id}
                  style={[styles.memberChip, selectedMemberId === member.id && styles.memberChipActive]}
                  onPress={() => setSelectedMemberId(member.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.memberChipText, selectedMemberId === member.id && styles.memberChipTextActive]}>
                    {member.firstName} {member.lastName}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {selectedMemberId ? (
          availabilityLoading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.emptyStateText}>Loading availability...</Text>
            </View>
          ) : (
          <View style={styles.availabilityList}>
            {DAY_NAMES.map((day, index) => {
              const dayAvailability = selectedMemberAvailability.find(a => a.dayOfWeek === index);
              const isAvailable = dayAvailability?.isAvailable ?? (index > 0 && index < 6);
              const startTime = dayAvailability?.startTime || '08:00';
              const endTime = dayAvailability?.endTime || '17:00';

              return (
                <TouchableOpacity
                  key={day}
                  style={styles.availabilityRow}
                  onPress={() => handleUpdateAvailability(index, !isAvailable, startTime, endTime)}
                  activeOpacity={0.7}
                >
                  <View style={styles.availabilityLeft}>
                    <View style={[styles.availabilityDot, { backgroundColor: isAvailable ? '#22c55e' : colors.muted }]} />
                    <Text style={[styles.availabilityDay, !isAvailable && { color: colors.mutedForeground }]}>{day}</Text>
                  </View>
                  <Text style={styles.availabilityTime}>
                    {isAvailable ? `${startTime} - ${endTime}` : 'Not available'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          )
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <Feather name="calendar" size={40} color={colors.mutedForeground} />
            </View>
            <Text style={styles.emptyStateTitle}>View Availability</Text>
            <Text style={styles.emptyStateText}>Select a team member to view their availability</Text>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Time Off Requests</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowTimeOffModal(true)}
            activeOpacity={0.7}
          >
            <Feather name="plus" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        {pendingTimeOff.length > 0 ? (
          pendingTimeOff.map(request => {
            const member = teamMembers.find(m => m.id === request.teamMemberId);
            return (
              <View key={request.id} style={styles.timeOffCard}>
                <View style={styles.timeOffHeader}>
                  <Text style={styles.timeOffName}>{member?.firstName} {member?.lastName}</Text>
                  <View style={styles.pendingBadge}>
                    <Text style={styles.pendingBadgeText}>Pending</Text>
                  </View>
                </View>
                <Text style={styles.timeOffDates}>
                  {format(new Date(request.startDate), 'MMM d')} - {format(new Date(request.endDate), 'MMM d, yyyy')}
                </Text>
                <Text style={styles.timeOffReason}>{request.reason.replace(/_/g, ' ')}</Text>
                {isOwnerOrManager && (
                  <View style={styles.timeOffActions}>
                    <TouchableOpacity
                      style={[styles.timeOffButton, { backgroundColor: colors.success }]}
                      onPress={() => handleApproveTimeOff(request.id, 'approved')}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.timeOffButtonText}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.timeOffButton, { backgroundColor: colors.destructive }]}
                      onPress={() => handleApproveTimeOff(request.id, 'rejected')}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.timeOffButtonText}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <Feather name="calendar" size={40} color={colors.mutedForeground} />
            </View>
            <Text style={styles.emptyStateTitle}>No Pending Requests</Text>
            <Text style={styles.emptyStateText}>Time off requests will appear here</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );

  const renderPerformanceTab = () => (
    <ScrollView
      style={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.sectionTitle}>Team Performance</Text>

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <View style={[styles.statCardIcon, { backgroundColor: 'rgba(34,197,94,0.1)' }]}>
            <Feather name="check-circle" size={20} color="#22c55e" />
          </View>
          <Text style={styles.statCardValue}>{totalCompleted}</Text>
          <Text style={styles.statCardLabel}>Jobs Completed</Text>
        </View>
        <View style={styles.statCard}>
          <View style={[styles.statCardIcon, { backgroundColor: 'rgba(59,130,246,0.1)' }]}>
            <Feather name="clock" size={20} color="#3b82f6" />
          </View>
          <Text style={styles.statCardValue}>{totalInProgress}</Text>
          <Text style={styles.statCardLabel}>In Progress</Text>
        </View>
        <View style={styles.statCard}>
          <View style={[styles.statCardIcon, { backgroundColor: 'rgba(168,85,247,0.1)' }]}>
            <Feather name="trending-up" size={20} color="#a855f7" />
          </View>
          <Text style={styles.statCardValue}>{avgCompletionRate}%</Text>
          <Text style={styles.statCardLabel}>Avg Completion</Text>
        </View>
        <View style={styles.statCard}>
          <View style={[styles.statCardIcon, { backgroundColor: 'rgba(245,158,11,0.1)' }]}>
            <Feather name="star" size={20} color="#f59e0b" />
          </View>
          <Text style={styles.statCardValue}>-</Text>
          <Text style={styles.statCardLabel}>Avg Rating</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Individual Performance</Text>
      {memberStats.map((member, index) => (
        <View key={member.id} style={styles.performanceCard}>
          <View style={styles.performanceRank}>
            <Text style={styles.performanceRankText}>{index + 1}</Text>
          </View>
          <View style={[styles.avatar, { backgroundColor: colors.primary, width: 36, height: 36, borderRadius: 18 }]}>
            <Text style={[styles.avatarText, { fontSize: 14 }]}>{getInitials(member.firstName, member.lastName, member.email)}</Text>
          </View>
          <View style={styles.performanceInfo}>
            <Text style={styles.performanceName}>{member.firstName} {member.lastName}</Text>
            <Text style={styles.performanceStats}>{member.completedJobs} done | {member.inProgressJobs} active</Text>
          </View>
          <View style={styles.performanceRate}>
            <Text style={styles.performanceRateText}>{member.completionRate}%</Text>
          </View>
        </View>
      ))}

      {memberStats.length === 0 && (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconCircle}>
            <Feather name="bar-chart-2" size={40} color={colors.mutedForeground} />
          </View>
          <Text style={styles.emptyStateTitle}>No Performance Data</Text>
          <Text style={styles.emptyStateText}>Team performance metrics will appear here</Text>
        </View>
      )}
    </ScrollView>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Team Operations',
          headerShown: !isTabletDevice,
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.foreground,
          headerRight: () => (
            <TouchableOpacity onPress={onRefresh} style={{ marginRight: spacing.md }}>
              <Feather name="refresh-cw" size={20} color={colors.foreground} />
            </TouchableOpacity>
          ),
        }}
      />
      <View style={[styles.container, { paddingTop: isTabletDevice ? spacing.xs : 0 }]}>
        {isTabletDevice && (
          <View style={styles.tabletHeader}>
            <View>
              <Text style={styles.tabletTitle}>Team Operations</Text>
              <Text style={styles.tabletSubtitle}>{acceptedMembers.length} team members</Text>
            </View>
            <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
              <Feather name="refresh-cw" size={20} color={colors.foreground} />
            </TouchableOpacity>
          </View>
        )}
        
        {/* Upgrade banner for non-team subscribers */}
        {needsUpgrade && (
          <TouchableOpacity 
            style={[styles.upgradeBanner, { backgroundColor: colors.primary + '15' }]}
            onPress={() => router.push('/more/subscription')}
            activeOpacity={0.8}
          >
            <Feather name="star" size={18} color={colors.primary} />
            <View style={styles.upgradeBannerContent}>
              <Text style={[styles.upgradeBannerTitle, { color: colors.foreground }]}>
                Upgrade to Team Plan
              </Text>
              <Text style={[styles.upgradeBannerText, { color: colors.mutedForeground }]}>
                Unlock team management, live tracking, and dispatch features
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color={colors.primary} />
          </TouchableOpacity>
        )}
        
        {renderTabs()}
        {activeTab === 'live' && renderLiveOpsTab()}
        {activeTab === 'admin' && isOwnerOrManager && renderTeamAdminTab()}
        {activeTab === 'scheduling' && renderSchedulingTab()}
        {activeTab === 'performance' && renderPerformanceTab()}
      </View>

      <Modal
        visible={showTimeOffModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowTimeOffModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Request Time Off</Text>
            <TouchableOpacity onPress={() => setShowTimeOffModal(false)}>
              <Feather name="x" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            <Text style={styles.inputLabel}>Team Member</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.lg }}>
              <View style={styles.memberChips}>
                {acceptedMembers.map(member => (
                  <TouchableOpacity
                    key={member.id}
                    style={[styles.memberChip, selectedMemberId === member.id && styles.memberChipActive]}
                    onPress={() => setSelectedMemberId(member.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.memberChipText, selectedMemberId === member.id && styles.memberChipTextActive]}>
                      {member.firstName} {member.lastName}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={styles.inputLabel}>Start Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.textInput}
              value={timeOffStart}
              onChangeText={setTimeOffStart}
              placeholder="2024-01-01"
              placeholderTextColor={colors.mutedForeground}
            />

            <Text style={styles.inputLabel}>End Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.textInput}
              value={timeOffEnd}
              onChangeText={setTimeOffEnd}
              placeholder="2024-01-05"
              placeholderTextColor={colors.mutedForeground}
            />

            <Text style={styles.inputLabel}>Reason</Text>
            <View style={styles.reasonChips}>
              {['annual_leave', 'sick_leave', 'personal', 'other'].map(reason => (
                <TouchableOpacity
                  key={reason}
                  style={[styles.reasonChip, timeOffReason === reason && styles.reasonChipActive]}
                  onPress={() => setTimeOffReason(reason)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.reasonChipText, timeOffReason === reason && styles.reasonChipTextActive]}>
                    {reason.replace(/_/g, ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Notes (optional)</Text>
            <TextInput
              style={[styles.textInput, { height: 80, textAlignVertical: 'top' }]}
              value={timeOffNotes}
              onChangeText={setTimeOffNotes}
              placeholder="Additional notes..."
              placeholderTextColor={colors.mutedForeground}
              multiline
            />

            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleRequestTimeOff}
              activeOpacity={0.7}
            >
              <Text style={styles.submitButtonText}>Submit Request</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const createStyles = (colors: ThemeColors, contentWidth: number, responsivePadding: number, isTabletDevice: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: isTabletDevice ? spacing.lg : 0,
  },
  tabletHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: responsivePadding,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  tabletTitle: {
    ...typography.largeTitle,
    color: colors.foreground,
  },
  tabletSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: radius.xl,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  tabBar: {
    flexGrow: 0,
    flexShrink: 0,
    marginBottom: spacing.md,
    paddingHorizontal: isTabletDevice ? spacing.sm : responsivePadding,
  },
  tabBarContent: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.muted,
    height: sizes.filterChipHeight,
  },
  tabButtonActive: {
    backgroundColor: colors.primary,
  },
  tabButtonText: {
    ...typography.caption,
    color: colors.mutedForeground,
    fontWeight: '500',
  },
  tabButtonTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: isTabletDevice ? spacing.sm : responsivePadding,
  },
  liveViewToggle: {
    flexDirection: 'row',
    backgroundColor: colors.muted,
    borderRadius: radius['2xl'],
    padding: spacing.xs,
    marginVertical: spacing.md,
  },
  liveViewButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radius.xl,
  },
  liveViewButtonActive: {
    backgroundColor: colors.card,
    ...shadows.sm,
  },
  liveViewText: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  liveViewTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  sectionTitle: {
    ...typography.label,
    color: colors.mutedForeground,
    marginBottom: spacing.md,
    marginTop: spacing['2xl'],
  },
  heroCard: {
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.xl,
    alignItems: 'center',
    marginTop: spacing.md,
    ...shadows.md,
  },
  heroIconContainer: {
    width: 40,
    height: 40,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  heroValue: {
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: -1,
    color: colors.foreground,
  },
  heroLabel: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: sizes.avatarMd,
    height: sizes.avatarMd,
    borderRadius: sizes.avatarMd / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  statusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.card,
  },
  memberInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  memberName: {
    ...typography.cardTitle,
    color: colors.foreground,
  },
  roleBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.muted,
  },
  roleBadgeText: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    textTransform: 'capitalize',
  },
  memberStatus: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  messageButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.xl,
    backgroundColor: colors.muted,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  activityTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
  },
  activityDescription: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  activityTime: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    marginTop: 4,
  },
  importantBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(245,158,11,0.1)',
  },
  importantBadgeText: {
    ...typography.captionSmall,
    color: '#f59e0b',
    fontWeight: '600',
  },
  mapContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapOverlay: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
  },
  mapEmptyState: {
    position: 'absolute',
    top: '40%',
    left: spacing.xl,
    right: spacing.xl,
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.xl,
    ...shadows.md,
  },
  mapEmptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  mapEmptyTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  mapEmptyText: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  teamMarkerOuter: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: colors.card,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  teamMarkerText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  activityDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 11,
    height: 11,
    borderRadius: 5.5,
    borderWidth: 2,
    borderColor: colors.card,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 1,
    elevation: 2,
  },
  nameLabel: {
    marginTop: spacing.xs,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.md,
    minWidth: 64,
    alignItems: 'center' as const,
    ...shadows.sm,
  },
  nameLabelText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.foreground,
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['3xl'],
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyStateTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  emptyStateText: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.lg,
    backgroundColor: colors.card,
    marginTop: spacing.md,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  statItem: {
    alignItems: 'center',
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  statValue: {
    ...typography.statValue,
    color: colors.foreground,
  },
  statLabel: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
  },
  actionRow: {
    marginTop: spacing.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  actionButtonText: {
    ...typography.cardTitle,
    color: colors.primary,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.lg,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  cardTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
  },
  selectContainer: {
    marginBottom: spacing.md,
  },
  selectLabel: {
    ...typography.label,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
  },
  memberChips: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  memberChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.muted,
    height: sizes.filterChipHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberChipActive: {
    backgroundColor: colors.primary,
  },
  memberChipText: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  memberChipTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  availabilityList: {
    marginTop: spacing.md,
  },
  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  availabilityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  availabilityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  availabilityDay: {
    ...typography.body,
    color: colors.foreground,
  },
  availabilityTime: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeOffCard: {
    padding: spacing.lg,
    borderRadius: radius['2xl'],
    backgroundColor: colors.muted,
    marginBottom: spacing.md,
  },
  timeOffHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  timeOffName: {
    ...typography.cardTitle,
    color: colors.foreground,
  },
  pendingBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(245,158,11,0.1)',
  },
  pendingBadgeText: {
    ...typography.captionSmall,
    color: '#f59e0b',
    fontWeight: '600',
  },
  timeOffDates: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  timeOffReason: {
    ...typography.caption,
    color: colors.mutedForeground,
    textTransform: 'capitalize',
    marginTop: 2,
  },
  timeOffActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  timeOffButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.xl,
    alignItems: 'center',
  },
  timeOffButtonText: {
    ...typography.caption,
    color: '#ffffff',
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  statCard: {
    width: (contentWidth - responsivePadding * 2 - spacing.md) / 2,
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    ...shadows.sm,
  },
  statCardIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  statCardValue: {
    ...typography.statValue,
    color: colors.foreground,
  },
  statCardLabel: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  performanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  performanceRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  performanceRankText: {
    ...typography.caption,
    color: colors.mutedForeground,
    fontWeight: '700',
  },
  performanceInfo: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  performanceName: {
    ...typography.cardTitle,
    color: colors.foreground,
  },
  performanceStats: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  performanceRate: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.muted,
  },
  performanceRateText: {
    ...typography.caption,
    color: colors.foreground,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    ...typography.sectionTitle,
    color: colors.foreground,
  },
  modalContent: {
    padding: spacing.lg,
  },
  inputLabel: {
    ...typography.label,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  textInput: {
    backgroundColor: colors.muted,
    borderRadius: radius.xl,
    padding: spacing.md,
    color: colors.foreground,
    ...typography.body,
    height: sizes.inputHeight,
  },
  reasonChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  reasonChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.muted,
  },
  reasonChipActive: {
    backgroundColor: colors.primary,
  },
  reasonChipText: {
    ...typography.caption,
    color: colors.mutedForeground,
    textTransform: 'capitalize',
  },
  reasonChipTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: colors.primary,
    padding: spacing.lg,
    borderRadius: radius['2xl'],
    alignItems: 'center',
    marginTop: spacing['2xl'],
  },
  submitButtonText: {
    ...typography.button,
    color: '#ffffff',
    fontWeight: '600',
  },
  kpiStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    gap: spacing.md,
  },
  kpiStatItem: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  kpiStatIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  kpiStatValue: {
    ...typography.statValue,
    color: colors.foreground,
  },
  kpiStatLabel: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  upgradeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    marginHorizontal: isTabletDevice ? spacing.sm : responsivePadding,
    marginVertical: spacing.sm,
    borderRadius: radius['2xl'],
    gap: spacing.md,
  },
  upgradeBannerContent: {
    flex: 1,
  },
  upgradeBannerTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
  },
  upgradeBannerText: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
});
