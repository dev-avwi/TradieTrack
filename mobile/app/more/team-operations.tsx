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
  Linking,
  Dimensions,
  TextInput,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import MapView, { Marker, Region, PROVIDER_DEFAULT, MapStyleElement } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, shadows, typography, sizes, iconSizes } from '../../src/lib/design-tokens';
import { api } from '../../src/lib/api';
import { useAuthStore } from '../../src/lib/store';
import { formatDistanceToNow, format, isAfter, isBefore, addDays, parseISO } from 'date-fns';
import { isTablet } from '../../src/lib/device';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const IS_TABLET = isTablet();

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

type TabType = 'live' | 'admin' | 'scheduling' | 'skills' | 'performance';
type LiveViewMode = 'status' | 'activity' | 'map';

interface TeamMemberSkill {
  id: string;
  teamMemberId: string;
  skillName: string;
  skillType: string;
  licenseNumber?: string;
  issueDate?: string;
  expiryDate?: string;
  isVerified: boolean;
  notes?: string;
}

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

export default function TeamOperationsScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useAuthStore();
  const mapRef = useRef<MapView>(null);

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

  const [skills, setSkills] = useState<TeamMemberSkill[]>([]);
  const [showAddSkillModal, setShowAddSkillModal] = useState(false);
  const [skillName, setSkillName] = useState('');
  const [skillType, setSkillType] = useState('certification');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [skillNotes, setSkillNotes] = useState('');

  const isOwnerOrManager = user?.role === 'owner' || user?.role === 'admin' || user?.role === 'manager';

  const fetchData = useCallback(async () => {
    try {
      const [membersRes, presenceRes, activityRes, jobsRes, timeOffRes, skillsRes] = await Promise.all([
        api.get<TeamMemberData[]>('/api/team/members'),
        api.get<TeamPresenceData[]>('/api/team/presence'),
        api.get<ActivityFeedItem[]>('/api/activity-feed?limit=50'),
        api.get<JobData[]>('/api/jobs'),
        api.get<TeamMemberTimeOff[]>('/api/team/time-off'),
        api.get<TeamMemberSkill[]>('/api/team/skills'),
      ]);

      if (membersRes.data) setTeamMembers(membersRes.data);
      if (presenceRes.data) setTeamPresence(presenceRes.data);
      if (activityRes.data) setActivityFeed(activityRes.data);
      if (jobsRes.data) setJobs(jobsRes.data);
      if (timeOffRes.data) setTimeOffRequests(timeOffRes.data);
      if (skillsRes.data) setSkills(skillsRes.data);
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

  const expiringSkills = useMemo(() => {
    return skills.filter(s => {
      if (!s.expiryDate) return false;
      const expiry = new Date(s.expiryDate);
      const thirtyDaysFromNow = addDays(new Date(), 30);
      return isBefore(expiry, thirtyDaysFromNow) && isAfter(expiry, new Date());
    });
  }, [skills]);

  const expiredSkills = useMemo(() => {
    return skills.filter(s => {
      if (!s.expiryDate) return false;
      return isBefore(new Date(s.expiryDate), new Date());
    });
  }, [skills]);

  const memberSkills = useMemo(() => {
    if (!selectedMemberId) return [];
    return skills.filter(s => s.teamMemberId === selectedMemberId);
  }, [skills, selectedMemberId]);

  const onlineCount = useMemo(() => {
    return teamPresence.filter(p => p.status === 'online' || p.status === 'on_job').length;
  }, [teamPresence]);

  const onJobCount = useMemo(() => {
    return teamPresence.filter(p => p.status === 'on_job').length;
  }, [teamPresence]);

  const unassignedJobs = useMemo(() => {
    return jobs.filter(j => !j.assignedTo && (j.status === 'pending' || j.status === 'scheduled'));
  }, [jobs]);

  const COMMON_SKILLS = [
    "White Card (Construction Induction)",
    "Electrical License",
    "Plumbing License",
    "Gas Fitting License",
    "First Aid Certificate",
    "Working at Heights",
    "Confined Space Entry",
    "Forklift License",
    "EWP License",
    "Asbestos Awareness",
  ];

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

  const handleAddSkill = async () => {
    if (!selectedMemberId || !skillName) {
      Alert.alert('Error', 'Please select a team member and skill name');
      return;
    }

    try {
      const res = await api.post<TeamMemberSkill>('/api/team/skills', {
        teamMemberId: selectedMemberId,
        skillName,
        skillType,
        licenseNumber: licenseNumber || undefined,
        issueDate: issueDate || undefined,
        expiryDate: expiryDate || undefined,
        notes: skillNotes || undefined,
      });

      if (res.data && !res.error) {
        setShowAddSkillModal(false);
        setSkillName('');
        setSkillType('certification');
        setLicenseNumber('');
        setIssueDate('');
        setExpiryDate('');
        setSkillNotes('');
        await fetchData();
        Alert.alert('Success', 'Skill added');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to add skill');
    }
  };

  const handleVerifySkill = async (id: string, isVerified: boolean) => {
    try {
      const res = await api.patch<TeamMemberSkill>(`/api/team/skills/${id}`, { isVerified });
      if (res.data && !res.error) {
        await fetchData();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update skill');
    }
  };

  const handleDeleteSkill = async (id: string) => {
    Alert.alert(
      'Delete Skill',
      'Are you sure you want to delete this skill?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/team/skills/${id}`);
              await fetchData();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete skill');
            }
          },
        },
      ]
    );
  };

  const renderTabs = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar}>
      <TouchableOpacity
        style={[styles.tabButton, activeTab === 'live' && styles.tabButtonActive]}
        onPress={() => setActiveTab('live')}
        activeOpacity={0.7}
      >
        <Feather name="activity" size={14} color={activeTab === 'live' ? colors.primary : colors.mutedForeground} />
        <Text style={[styles.tabButtonText, activeTab === 'live' && styles.tabButtonTextActive]}>Live</Text>
      </TouchableOpacity>

      {isOwnerOrManager && (
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'admin' && styles.tabButtonActive]}
          onPress={() => setActiveTab('admin')}
          activeOpacity={0.7}
        >
          <Feather name="users" size={14} color={activeTab === 'admin' ? colors.primary : colors.mutedForeground} />
          <Text style={[styles.tabButtonText, activeTab === 'admin' && styles.tabButtonTextActive]}>Admin</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[styles.tabButton, activeTab === 'scheduling' && styles.tabButtonActive]}
        onPress={() => setActiveTab('scheduling')}
        activeOpacity={0.7}
      >
        <Feather name="calendar" size={14} color={activeTab === 'scheduling' ? colors.primary : colors.mutedForeground} />
        <Text style={[styles.tabButtonText, activeTab === 'scheduling' && styles.tabButtonTextActive]}>Schedule</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.tabButton, activeTab === 'skills' && styles.tabButtonActive]}
        onPress={() => setActiveTab('skills')}
        activeOpacity={0.7}
      >
        <Feather name="award" size={14} color={activeTab === 'skills' ? colors.primary : colors.mutedForeground} />
        <Text style={[styles.tabButtonText, activeTab === 'skills' && styles.tabButtonTextActive]}>Skills</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.tabButton, activeTab === 'performance' && styles.tabButtonActive]}
        onPress={() => setActiveTab('performance')}
        activeOpacity={0.7}
      >
        <Feather name="trending-up" size={14} color={activeTab === 'performance' ? colors.primary : colors.mutedForeground} />
        <Text style={[styles.tabButtonText, activeTab === 'performance' && styles.tabButtonTextActive]}>Stats</Text>
      </TouchableOpacity>
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
              <View style={styles.roleBadge}>
                <Text style={styles.roleBadgeText}>{member.roleName}</Text>
              </View>
            )}
          </View>
          <Text style={styles.memberStatus}>{statusConfig.label}</Text>
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

    // iPad: Show 2-column layout with Team Status + Map side by side (like web)
    if (IS_TABLET) {
      return (
        <View style={styles.tabletLiveOpsContainer}>
          {/* KPI Stats Row */}
          <View style={styles.kpiStatsRow}>
            <View style={styles.kpiStatItem}>
              <View style={[styles.kpiStatIcon, { backgroundColor: 'rgba(59,130,246,0.1)' }]}>
                <Feather name="users" size={18} color="#3b82f6" />
              </View>
              <Text style={styles.kpiStatValue}>{acceptedMembers.length}</Text>
              <Text style={styles.kpiStatLabel}>Team Members</Text>
            </View>
            <View style={styles.kpiStatItem}>
              <View style={[styles.kpiStatIcon, { backgroundColor: 'rgba(34,197,94,0.1)' }]}>
                <Feather name="circle" size={18} color="#22c55e" />
              </View>
              <Text style={styles.kpiStatValue}>{onlineCount}</Text>
              <Text style={styles.kpiStatLabel}>Online Now</Text>
            </View>
            <View style={styles.kpiStatItem}>
              <View style={[styles.kpiStatIcon, { backgroundColor: 'rgba(59,130,246,0.1)' }]}>
                <Feather name="tool" size={18} color="#3b82f6" />
              </View>
              <Text style={styles.kpiStatValue}>{onJobCount}</Text>
              <Text style={styles.kpiStatLabel}>On Job</Text>
            </View>
            <View style={styles.kpiStatItem}>
              <View style={[styles.kpiStatIcon, { backgroundColor: 'rgba(249,115,22,0.1)' }]}>
                <Feather name="briefcase" size={18} color="#f97316" />
              </View>
              <Text style={styles.kpiStatValue}>{unassignedJobs.length}</Text>
              <Text style={styles.kpiStatLabel}>Unassigned</Text>
            </View>
          </View>

          {/* Two-column layout: Team Status + Map */}
          <View style={styles.tabletTwoColumnLayout}>
            {/* Left Column: Team Status */}
            <View style={styles.tabletLeftColumn}>
              <View style={styles.tabletSectionHeader}>
                <Feather name="users" size={18} color={colors.foreground} />
                <Text style={styles.tabletSectionTitle}>Team Status</Text>
                <View style={styles.tabletBadge}>
                  <Text style={styles.tabletBadgeText}>{membersWithDetails.length}</Text>
                </View>
              </View>
              <ScrollView 
                style={styles.tabletTeamList}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
              >
                {membersWithDetails.map(renderMemberCard)}
                {membersWithDetails.length === 0 && (
                  <View style={styles.emptyState}>
                    <Feather name="users" size={32} color={colors.mutedForeground} />
                    <Text style={styles.emptyStateText}>No team members</Text>
                  </View>
                )}
              </ScrollView>
            </View>

            {/* Right Column: Map */}
            <View style={styles.tabletRightColumn}>
              <View style={styles.tabletSectionHeader}>
                <Feather name="map-pin" size={18} color={colors.foreground} />
                <Text style={styles.tabletSectionTitle}>Team Map</Text>
                <View style={styles.tabletBadge}>
                  <Text style={styles.tabletBadgeText}>{membersWithLocations.length} locations</Text>
                </View>
              </View>
              <View style={styles.tabletMapWrapper}>
                <MapView
                  ref={mapRef}
                  style={styles.tabletMap}
                  provider={PROVIDER_DEFAULT}
                  initialRegion={mapRegion}
                  region={mapRegion}
                  customMapStyle={isDark ? DARK_MAP_STYLE : undefined}
                >
                  {membersWithLocations.map(member => {
                    const statusConfig = STATUS_CONFIG[member.presence?.status || 'offline'];
                    return (
                      <Marker
                        key={member.id}
                        coordinate={{
                          latitude: member.presence!.lastLocationLat!,
                          longitude: member.presence!.lastLocationLng!,
                        }}
                        title={`${member.firstName || ''} ${member.lastName || ''}`.trim() || member.email}
                        description={statusConfig?.label}
                        pinColor={statusConfig?.color}
                      />
                    );
                  })}
                </MapView>
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
            </View>
          </View>

          {/* Activity Feed Section */}
          <View style={styles.tabletActivitySection}>
            <View style={styles.tabletSectionHeader}>
              <Feather name="activity" size={18} color={colors.foreground} />
              <Text style={styles.tabletSectionTitle}>Recent Activity</Text>
            </View>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.tabletActivityScroll}
            >
              {activityFeed.length === 0 ? (
                <View style={styles.tabletActivityEmpty}>
                  <Text style={styles.emptyStateText}>No recent activity</Text>
                </View>
              ) : (
                activityFeed.slice(0, 10).map((item) => (
                  <View key={item.id} style={styles.tabletActivityCard}>
                    <View style={styles.activityIconCircle}>
                      <Feather 
                        name={item.activityType === 'job_status_changed' ? 'briefcase' : 
                              item.activityType === 'invoice_created' ? 'file-text' :
                              item.activityType === 'quote_created' ? 'edit' : 'activity'} 
                        size={14} 
                        color={colors.primary} 
                      />
                    </View>
                    <Text style={styles.tabletActivityTitle} numberOfLines={2}>{item.description || item.activityType}</Text>
                    <Text style={styles.tabletActivityTime}>
                      {item.createdAt ? formatDistanceToNow(new Date(item.createdAt), { addSuffix: true }) : ''}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      );
    }

    // Phone: Original toggle-based layout
    if (liveViewMode === 'map') {
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
              return (
                <Marker
                  key={member.id}
                  coordinate={{
                    latitude: member.presence!.lastLocationLat!,
                    longitude: member.presence!.lastLocationLng!,
                  }}
                  title={`${member.firstName || ''} ${member.lastName || ''}`.trim() || member.email}
                  description={statusConfig?.label}
                  pinColor={statusConfig?.color}
                />
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
        <View style={styles.kpiStatsRow}>
          <View style={styles.kpiStatItem}>
            <View style={[styles.kpiStatIcon, { backgroundColor: 'rgba(59,130,246,0.1)' }]}>
              <Feather name="users" size={16} color="#3b82f6" />
            </View>
            <Text style={styles.kpiStatValue}>{acceptedMembers.length}</Text>
            <Text style={styles.kpiStatLabel}>Team</Text>
          </View>
          <View style={styles.kpiStatItem}>
            <View style={[styles.kpiStatIcon, { backgroundColor: 'rgba(34,197,94,0.1)' }]}>
              <Feather name="circle" size={16} color="#22c55e" />
            </View>
            <Text style={styles.kpiStatValue}>{onlineCount}</Text>
            <Text style={styles.kpiStatLabel}>Online</Text>
          </View>
          <View style={styles.kpiStatItem}>
            <View style={[styles.kpiStatIcon, { backgroundColor: 'rgba(59,130,246,0.1)' }]}>
              <Feather name="tool" size={16} color="#3b82f6" />
            </View>
            <Text style={styles.kpiStatValue}>{onJobCount}</Text>
            <Text style={styles.kpiStatLabel}>On Job</Text>
          </View>
          <View style={styles.kpiStatItem}>
            <View style={[styles.kpiStatIcon, { backgroundColor: 'rgba(249,115,22,0.1)' }]}>
              <Feather name="briefcase" size={16} color="#f97316" />
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
                <Feather name="clock" size={32} color={colors.mutedForeground} />
                <Text style={styles.emptyStateText}>No recent activity</Text>
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
            <Feather name="calendar" size={32} color={colors.mutedForeground} />
            <Text style={styles.emptyStateText}>Select a team member to view availability</Text>
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
                      style={[styles.timeOffButton, { backgroundColor: '#22c55e' }]}
                      onPress={() => handleApproveTimeOff(request.id, 'approved')}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.timeOffButtonText}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.timeOffButton, { backgroundColor: '#ef4444' }]}
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
            <Feather name="calendar" size={24} color={colors.mutedForeground} />
            <Text style={styles.emptyStateText}>No pending requests</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );

  const renderSkillsTab = () => (
    <ScrollView
      style={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.skillsHeader}>
        <View>
          <Text style={styles.skillsTitle}>Skills & Certifications</Text>
          <Text style={styles.skillsSubtitle}>Track qualifications and licenses</Text>
        </View>
        <TouchableOpacity
          style={styles.addSkillButton}
          onPress={() => setShowAddSkillModal(true)}
          activeOpacity={0.7}
        >
          <Feather name="plus" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {(expiredSkills.length > 0 || expiringSkills.length > 0) && (
        <View style={styles.alertsContainer}>
          {expiredSkills.length > 0 && (
            <View style={[styles.alertCard, { borderColor: '#ef4444' }]}>
              <View style={styles.alertHeader}>
                <Feather name="alert-triangle" size={16} color="#ef4444" />
                <Text style={[styles.alertTitle, { color: '#ef4444' }]}>Expired ({expiredSkills.length})</Text>
              </View>
              {expiredSkills.slice(0, 3).map(skill => {
                const member = teamMembers.find(m => m.id === skill.teamMemberId);
                return (
                  <Text key={skill.id} style={styles.alertText}>
                    {member?.firstName} - {skill.skillName}
                  </Text>
                );
              })}
            </View>
          )}

          {expiringSkills.length > 0 && (
            <View style={[styles.alertCard, { borderColor: '#f59e0b' }]}>
              <View style={styles.alertHeader}>
                <Feather name="clock" size={16} color="#f59e0b" />
                <Text style={[styles.alertTitle, { color: '#f59e0b' }]}>Expiring Soon ({expiringSkills.length})</Text>
              </View>
              {expiringSkills.slice(0, 3).map(skill => {
                const member = teamMembers.find(m => m.id === skill.teamMemberId);
                return (
                  <Text key={skill.id} style={styles.alertText}>
                    {member?.firstName} - {skill.skillName}
                  </Text>
                );
              })}
            </View>
          )}
        </View>
      )}

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Team Member Skills</Text>
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
          memberSkills.length > 0 ? (
            <View style={styles.skillsList}>
              {memberSkills.map(skill => {
                const isExpired = skill.expiryDate && isBefore(new Date(skill.expiryDate), new Date());
                const isExpiring = skill.expiryDate && !isExpired && isBefore(new Date(skill.expiryDate), addDays(new Date(), 30));

                return (
                  <View
                    key={skill.id}
                    style={[
                      styles.skillCard,
                      isExpired && styles.skillCardExpired,
                      isExpiring && styles.skillCardExpiring,
                    ]}
                  >
                    <View style={styles.skillHeader}>
                      <View style={styles.skillTitleRow}>
                        <Text style={styles.skillName}>{skill.skillName}</Text>
                        <View style={styles.skillBadges}>
                          <View style={styles.skillTypeBadge}>
                            <Text style={styles.skillTypeBadgeText}>{skill.skillType}</Text>
                          </View>
                          {skill.isVerified && (
                            <View style={[styles.skillTypeBadge, { backgroundColor: 'rgba(34,197,94,0.1)' }]}>
                              <Feather name="check-circle" size={10} color="#22c55e" />
                              <Text style={[styles.skillTypeBadgeText, { color: '#22c55e', marginLeft: 4 }]}>Verified</Text>
                            </View>
                          )}
                        </View>
                      </View>
                      {skill.licenseNumber && (
                        <Text style={styles.skillLicense}>License: {skill.licenseNumber}</Text>
                      )}
                      <View style={styles.skillDates}>
                        {skill.issueDate && (
                          <Text style={styles.skillDateText}>Issued: {format(new Date(skill.issueDate), 'MMM d, yyyy')}</Text>
                        )}
                        {skill.expiryDate && (
                          <Text style={[styles.skillDateText, isExpired && { color: '#ef4444' }, isExpiring && { color: '#f59e0b' }]}>
                            {isExpired ? 'Expired' : 'Expires'}: {format(new Date(skill.expiryDate), 'MMM d, yyyy')}
                          </Text>
                        )}
                      </View>
                    </View>
                    <View style={styles.skillActions}>
                      {!skill.isVerified && isOwnerOrManager && (
                        <TouchableOpacity
                          style={styles.verifyButton}
                          onPress={() => handleVerifySkill(skill.id, true)}
                          activeOpacity={0.7}
                        >
                          <Feather name="check" size={14} color={colors.primary} />
                          <Text style={styles.verifyButtonText}>Verify</Text>
                        </TouchableOpacity>
                      )}
                      {isOwnerOrManager && (
                        <TouchableOpacity
                          style={styles.deleteSkillButton}
                          onPress={() => handleDeleteSkill(skill.id)}
                          activeOpacity={0.7}
                        >
                          <Feather name="x" size={14} color={colors.mutedForeground} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Feather name="award" size={32} color={colors.mutedForeground} />
              <Text style={styles.emptyStateText}>No skills recorded for this team member</Text>
              <TouchableOpacity
                style={[styles.actionButton, { marginTop: spacing.md }]}
                onPress={() => setShowAddSkillModal(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.actionButtonText}>Add First Skill</Text>
              </TouchableOpacity>
            </View>
          )
        ) : (
          <View style={styles.emptyState}>
            <Feather name="award" size={32} color={colors.mutedForeground} />
            <Text style={styles.emptyStateText}>Select a team member to view skills</Text>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Team Compliance</Text>
        </View>
        {COMMON_SKILLS.slice(0, 5).map(skillName => {
          const membersWithSkill = skills.filter(s => s.skillName === skillName && s.isVerified);
          const percentage = acceptedMembers.length > 0
            ? Math.round((membersWithSkill.length / acceptedMembers.length) * 100)
            : 0;

          return (
            <View key={skillName} style={styles.complianceRow}>
              <Text style={styles.complianceSkillName} numberOfLines={1}>{skillName}</Text>
              <View style={styles.complianceBarContainer}>
                <View style={[styles.complianceBar, { width: `${percentage}%` }]} />
              </View>
              <Text style={styles.complianceCount}>{membersWithSkill.length}/{acceptedMembers.length}</Text>
            </View>
          );
        })}
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
          <Feather name="bar-chart-2" size={32} color={colors.mutedForeground} />
          <Text style={styles.emptyStateText}>No team members to display</Text>
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
          headerShown: !IS_TABLET,
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.foreground,
          headerRight: () => (
            <TouchableOpacity onPress={onRefresh} style={{ marginRight: spacing.md }}>
              <Feather name="refresh-cw" size={20} color={colors.foreground} />
            </TouchableOpacity>
          ),
        }}
      />
      <View style={[styles.container, { paddingTop: IS_TABLET ? spacing.md : 0 }]}>
        {IS_TABLET && (
          <View style={styles.tabletHeader}>
            <Text style={styles.tabletTitle}>Team Operations</Text>
            <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
              <Feather name="refresh-cw" size={20} color={colors.foreground} />
            </TouchableOpacity>
          </View>
        )}
        {renderTabs()}
        {activeTab === 'live' && renderLiveOpsTab()}
        {activeTab === 'admin' && isOwnerOrManager && renderTeamAdminTab()}
        {activeTab === 'scheduling' && renderSchedulingTab()}
        {activeTab === 'skills' && renderSkillsTab()}
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

      <Modal
        visible={showAddSkillModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddSkillModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Skill/Certification</Text>
            <TouchableOpacity onPress={() => setShowAddSkillModal(false)} activeOpacity={0.7}>
              <Feather name="x" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Team Member</Text>
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

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Skill/Certification Name</Text>
              <View style={styles.skillSelectContainer}>
                {COMMON_SKILLS.map(skill => (
                  <TouchableOpacity
                    key={skill}
                    style={[styles.skillOption, skillName === skill && styles.skillOptionActive]}
                    onPress={() => setSkillName(skill)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.skillOptionText, skillName === skill && styles.skillOptionTextActive]} numberOfLines={2}>
                      {skill}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={styles.textInput}
                placeholder="Or enter custom skill name"
                placeholderTextColor={colors.mutedForeground}
                value={skillName}
                onChangeText={setSkillName}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Type</Text>
              <View style={styles.radioGroup}>
                {['certification', 'license', 'training', 'skill'].map(type => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.radioOption, skillType === type && styles.radioOptionActive]}
                    onPress={() => setSkillType(type)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.radioOptionText, skillType === type && styles.radioOptionTextActive]}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>License Number (Optional)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter license number"
                placeholderTextColor={colors.mutedForeground}
                value={licenseNumber}
                onChangeText={setLicenseNumber}
              />
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formGroup, { flex: 1, marginRight: spacing.sm }]}>
                <Text style={styles.formLabel}>Issue Date</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.mutedForeground}
                  value={issueDate}
                  onChangeText={setIssueDate}
                />
              </View>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.formLabel}>Expiry Date</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.mutedForeground}
                  value={expiryDate}
                  onChangeText={setExpiryDate}
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Notes (Optional)</Text>
              <TextInput
                style={[styles.textInput, { height: 80, textAlignVertical: 'top' }]}
                placeholder="Enter any notes"
                placeholderTextColor={colors.mutedForeground}
                value={skillNotes}
                onChangeText={setSkillNotes}
                multiline
              />
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonSecondary]}
              onPress={() => setShowAddSkillModal(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonPrimary]}
              onPress={handleAddSkill}
              activeOpacity={0.7}
            >
              <Text style={styles.modalButtonPrimaryText}>Add Skill</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: IS_TABLET ? spacing.lg : 0,
  },
  tabletHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  tabletTitle: {
    ...typography.h2,
    color: colors.foreground,
    fontWeight: '700',
  },
  refreshButton: {
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.card,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.sm,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginRight: 2,
  },
  tabButtonActive: {
    borderBottomColor: colors.primary,
  },
  tabButtonText: {
    fontSize: 11,
    color: colors.mutedForeground,
    fontWeight: '500',
  },
  tabButtonTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  liveViewToggle: {
    flexDirection: 'row',
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
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
    borderRadius: radius.md,
  },
  liveViewButtonActive: {
    backgroundColor: colors.card,
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
    marginTop: spacing.lg,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
    ...typography.subtitle,
    color: colors.foreground,
  },
  roleBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
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
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    backgroundColor: colors.muted,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  activityTitle: {
    ...typography.body,
    color: colors.foreground,
    fontWeight: '500',
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
    borderRadius: radius.sm,
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
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  mapEmptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  mapEmptyTitle: {
    ...typography.subheading,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  mapEmptyText: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['2xl'],
  },
  emptyStateText: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.lg,
    backgroundColor: colors.card,
    marginTop: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statItem: {
    alignItems: 'center',
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  statValue: {
    ...typography.subtitle,
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
    padding: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionButtonText: {
    ...typography.subtitle,
    color: colors.primary,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  cardTitle: {
    ...typography.subtitle,
    color: colors.foreground,
  },
  selectContainer: {
    marginBottom: spacing.md,
  },
  selectLabel: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
  },
  memberChips: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  memberChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.muted,
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
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeOffCard: {
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.muted,
    marginBottom: spacing.sm,
  },
  timeOffHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  timeOffName: {
    ...typography.subtitle,
    color: colors.foreground,
  },
  pendingBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
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
    borderRadius: radius.md,
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
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  statCard: {
    width: (SCREEN_WIDTH - spacing.lg * 2 - spacing.sm) / 2,
    padding: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  statCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  statCardValue: {
    ...typography.headline,
    color: colors.foreground,
  },
  statCardLabel: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  performanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  performanceRank: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  performanceRankText: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    fontWeight: '600',
  },
  performanceInfo: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  performanceName: {
    ...typography.subtitle,
    color: colors.foreground,
  },
  performanceStats: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  performanceRate: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
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
    ...typography.pageTitle,
    color: colors.foreground,
  },
  modalContent: {
    padding: spacing.lg,
  },
  inputLabel: {
    ...typography.label,
    color: colors.foreground,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  textInput: {
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    padding: spacing.md,
    color: colors.foreground,
    ...typography.body,
  },
  reasonChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  reasonChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
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
    borderRadius: radius.xl,
    alignItems: 'center',
    marginTop: spacing['2xl'],
  },
  submitButtonText: {
    ...typography.subtitle,
    color: '#ffffff',
    fontWeight: '600',
  },
  kpiStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    gap: IS_TABLET ? spacing.md : spacing.xs,
  },
  kpiStatItem: {
    flex: 1,
    alignItems: 'center',
    padding: IS_TABLET ? spacing.lg : spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  kpiStatIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  kpiStatValue: {
    ...typography.headline,
    color: colors.foreground,
  },
  kpiStatLabel: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
  },
  tabletLiveOpsContainer: {
    flex: 1,
    padding: spacing.md,
  },
  tabletTwoColumnLayout: {
    flexDirection: 'row',
    flex: 1,
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  tabletLeftColumn: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    maxHeight: 400,
  },
  tabletRightColumn: {
    flex: 1.2,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  tabletSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabletSectionTitle: {
    ...typography.subtitle,
    color: colors.foreground,
    fontWeight: '600',
    flex: 1,
  },
  tabletBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.lg,
  },
  tabletBadgeText: {
    ...typography.captionSmall,
    color: colors.primaryForeground,
    fontWeight: '600',
  },
  tabletTeamList: {
    flex: 1,
  },
  tabletMapWrapper: {
    flex: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
    minHeight: 280,
  },
  tabletMap: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  tabletActivitySection: {
    marginTop: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  tabletActivityScroll: {
    flexDirection: 'row',
  },
  tabletActivityCard: {
    width: 160,
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginRight: spacing.sm,
  },
  tabletActivityTitle: {
    ...typography.caption,
    color: colors.foreground,
    marginTop: spacing.xs,
  },
  tabletActivityTime: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  tabletActivityEmpty: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  activityIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skillsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  skillsTitle: {
    ...typography.headline,
    color: colors.foreground,
  },
  skillsSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  addSkillButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertsContainer: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  alertCard: {
    padding: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderLeftWidth: 4,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  alertTitle: {
    ...typography.subtitle,
    fontWeight: '600',
  },
  alertText: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginLeft: 24,
    marginTop: 2,
  },
  skillsList: {
    gap: spacing.sm,
  },
  skillCard: {
    padding: spacing.md,
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    borderLeftWidth: 3,
    borderLeftColor: colors.border,
  },
  skillCardExpired: {
    borderLeftColor: '#ef4444',
    backgroundColor: 'rgba(239,68,68,0.05)',
  },
  skillCardExpiring: {
    borderLeftColor: '#f59e0b',
    backgroundColor: 'rgba(245,158,11,0.05)',
  },
  skillHeader: {
    flex: 1,
  },
  skillTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  skillName: {
    ...typography.subtitle,
    color: colors.foreground,
    fontWeight: '600',
  },
  skillBadges: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  skillTypeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(59,130,246,0.1)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  skillTypeBadgeText: {
    ...typography.captionSmall,
    color: '#3b82f6',
    textTransform: 'capitalize',
  },
  skillLicense: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginBottom: spacing.xs,
  },
  skillDates: {
    flexDirection: 'row',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  skillDateText: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  skillActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    justifyContent: 'flex-end',
  },
  verifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: 'rgba(59,130,246,0.1)',
  },
  verifyButtonText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '500',
  },
  deleteSkillButton: {
    padding: spacing.xs,
    borderRadius: radius.sm,
  },
  complianceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  complianceSkillName: {
    ...typography.caption,
    color: colors.foreground,
    flex: 1,
  },
  complianceBarContainer: {
    flex: 1,
    height: 6,
    backgroundColor: colors.muted,
    borderRadius: 3,
    overflow: 'hidden',
  },
  complianceBar: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  complianceCount: {
    ...typography.caption,
    color: colors.mutedForeground,
    width: 40,
    textAlign: 'right',
  },
  formGroup: {
    marginBottom: spacing.md,
  },
  formLabel: {
    ...typography.label,
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  formRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  skillSelectContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  skillOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  skillOptionActive: {
    backgroundColor: 'rgba(59,130,246,0.1)',
    borderColor: colors.primary,
  },
  skillOptionText: {
    ...typography.captionSmall,
    color: colors.foreground,
  },
  skillOptionTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  radioGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  radioOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  radioOptionActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  radioOptionText: {
    ...typography.caption,
    color: colors.foreground,
  },
  radioOptionTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  modalButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  modalButtonPrimary: {
    backgroundColor: colors.primary,
  },
  modalButtonSecondary: {
    backgroundColor: colors.muted,
  },
  modalButtonPrimaryText: {
    ...typography.subtitle,
    color: '#ffffff',
    fontWeight: '600',
  },
  modalButtonSecondaryText: {
    ...typography.subtitle,
    color: colors.foreground,
    fontWeight: '600',
  },
});
