import { useEffect, useState, useCallback, useMemo } from 'react';
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
} from 'react-native';
import { router, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, shadows, typography } from '../../src/lib/design-tokens';
import { api } from '../../src/lib/api';
import { formatDistanceToNow } from 'date-fns';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const STATUS_CONFIG: Record<string, { color: string; label: string; icon: keyof typeof Feather.glyphMap }> = {
  online: { color: '#22c55e', label: 'Online', icon: 'wifi' },
  driving: { color: '#3b82f6', label: 'Driving', icon: 'truck' },
  working: { color: '#8B5CF6', label: 'Working', icon: 'tool' },
  offline: { color: '#6b7280', label: 'Offline', icon: 'wifi-off' },
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

type ViewMode = 'status' | 'activity';

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    ...typography.pageTitle,
    color: colors.foreground,
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  refreshButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    backgroundColor: colors.muted,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.lg,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: colors.primary,
  },
  tabButtonText: {
    ...typography.caption,
    color: colors.mutedForeground,
    fontWeight: '500',
  },
  tabButtonTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing['3xl'],
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
    backgroundColor: colors.warningLight,
  },
  importantBadgeText: {
    ...typography.captionSmall,
    color: colors.warning,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    maxHeight: SCREEN_HEIGHT * 0.85,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalAvatarContainer: {
    position: 'relative',
  },
  modalAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalAvatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
  },
  modalStatusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 3,
    borderColor: colors.card,
  },
  modalInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  modalName: {
    ...typography.headline,
    color: colors.foreground,
  },
  modalRoleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  modalRoleBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: colors.muted,
  },
  modalStatusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  modalStatusText: {
    ...typography.captionSmall,
    fontWeight: '600',
  },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    backgroundColor: colors.muted,
  },
  modalBody: {
    padding: spacing.lg,
  },
  quickActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing['2xl'],
  },
  quickActionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    gap: spacing.xs,
  },
  quickActionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: {
    ...typography.caption,
    color: colors.foreground,
    fontWeight: '500',
  },
  sectionTitleModal: {
    ...typography.label,
    color: colors.mutedForeground,
    marginBottom: spacing.md,
  },
  jobCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  jobInfo: {
    flex: 1,
  },
  jobTitle: {
    ...typography.body,
    color: colors.foreground,
    fontWeight: '500',
  },
  jobClient: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  jobStatusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  jobStatusText: {
    ...typography.captionSmall,
    fontWeight: '600',
  },
  unassignedSection: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  unassignedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  assignButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
  },
  assignButtonText: {
    ...typography.caption,
    color: '#ffffff',
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing['3xl'],
  },
  emptyStateTitle: {
    ...typography.subtitle,
    color: colors.foreground,
    marginTop: spacing.lg,
  },
  emptyStateText: {
    ...typography.body,
    color: colors.mutedForeground,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  confirmContent: {
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.xl,
    width: '100%',
    maxWidth: 340,
    ...shadows.xl,
  },
  confirmTitle: {
    ...typography.headline,
    color: colors.foreground,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  confirmText: {
    ...typography.body,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  confirmHighlight: {
    color: colors.foreground,
    fontWeight: '600',
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  confirmButtonCancel: {
    backgroundColor: colors.muted,
  },
  confirmButtonConfirm: {
    backgroundColor: colors.primary,
  },
  confirmButtonText: {
    ...typography.body,
    fontWeight: '600',
  },
});

export default function TeamHubScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  const [viewMode, setViewMode] = useState<ViewMode>('status');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMemberData[]>([]);
  const [presence, setPresence] = useState<TeamPresenceData[]>([]);
  const [activities, setActivities] = useState<ActivityFeedItem[]>([]);
  const [jobs, setJobs] = useState<JobData[]>([]);
  const [selectedMember, setSelectedMember] = useState<MemberWithDetails | null>(null);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [pendingAssignment, setPendingAssignment] = useState<{ worker: TeamMemberData; job: JobData } | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [membersRes, presenceRes, activityRes, jobsRes] = await Promise.all([
        api.get<TeamMemberData[]>('/api/team/members'),
        api.get<TeamPresenceData[]>('/api/team/presence'),
        api.get<ActivityFeedItem[]>('/api/activity-feed?limit=30'),
        api.get<JobData[]>('/api/jobs'),
      ]);

      // Debug logging for team members API response
      console.log('[TeamHub] Members API response:', JSON.stringify(membersRes, null, 2));
      
      // Handle team members response - check for errors first
      if (membersRes.error) {
        console.error('[TeamHub] Error fetching team members:', membersRes.error);
      } else if (membersRes.data) {
        // Ensure we have an array - handle both array and object with members property
        const membersArray = Array.isArray(membersRes.data) 
          ? membersRes.data 
          : (membersRes.data as any).members || [];
        console.log('[TeamHub] Setting team members:', membersArray.length, 'members');
        setTeamMembers(membersArray);
      } else {
        console.log('[TeamHub] No team members data received, setting empty array');
        setTeamMembers([]);
      }
      
      // Handle presence response
      if (presenceRes.error) {
        console.error('[TeamHub] Error fetching presence:', presenceRes.error);
      } else if (presenceRes.data) {
        const presenceArray = Array.isArray(presenceRes.data) 
          ? presenceRes.data 
          : [];
        setPresence(presenceArray);
      }
      
      // Handle activities response
      if (activityRes.error) {
        console.error('[TeamHub] Error fetching activities:', activityRes.error);
      } else if (activityRes.data) {
        const activitiesArray = Array.isArray(activityRes.data) 
          ? activityRes.data 
          : (activityRes.data as any).activities || [];
        setActivities(activitiesArray);
      }
      
      // Handle jobs response
      if (jobsRes.error) {
        console.error('[TeamHub] Error fetching jobs:', jobsRes.error);
      } else if (jobsRes.data) {
        const jobsArray = Array.isArray(jobsRes.data) 
          ? jobsRes.data 
          : (jobsRes.data as any).jobs || [];
        setJobs(jobsArray);
      }
    } catch (error) {
      console.error('[TeamHub] Failed to fetch team data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchData();
  }, [fetchData]);

  const getMemberPresence = useCallback((userId: string) => {
    return presence.find(p => p.userId === userId);
  }, [presence]);

  const getMemberAssignedJobs = useCallback((userId: string) => {
    return jobs.filter(job => job.assignedTo === userId);
  }, [jobs]);

  const unassignedJobs = useMemo(() => {
    return jobs.filter(job => !job.assignedTo && job.status !== 'done' && job.status !== 'invoiced');
  }, [jobs]);

  const sortedMembers = useMemo(() => {
    const statusOrder = ['online', 'working', 'driving', 'offline'];
    const members = Array.isArray(teamMembers) ? teamMembers : [];
    return [...members].sort((a, b) => {
      const aStatus = getMemberPresence(a.userId)?.status || 'offline';
      const bStatus = getMemberPresence(b.userId)?.status || 'offline';
      return statusOrder.indexOf(aStatus) - statusOrder.indexOf(bStatus);
    });
  }, [teamMembers, getMemberPresence]);

  const handleMemberTap = useCallback((member: TeamMemberData) => {
    const memberPresence = getMemberPresence(member.userId);
    const assignedJobs = getMemberAssignedJobs(member.userId);
    setSelectedMember({
      ...member,
      presence: memberPresence,
      assignedJobs,
    });
    setShowMemberModal(true);
  }, [getMemberPresence, getMemberAssignedJobs]);

  const handleCall = useCallback((phone?: string) => {
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    }
  }, []);

  const handleEmail = useCallback((email?: string) => {
    if (email) {
      Linking.openURL(`mailto:${email}`);
    }
  }, []);

  const handleMessage = useCallback((userId: string) => {
    Alert.alert('Message', `Opening chat with team member...`);
  }, []);

  const handleAssignJob = useCallback(async (jobId: string, userId: string) => {
    try {
      setIsAssigning(true);
      const response = await api.post(`/api/jobs/${jobId}/assign`, { assignedTo: userId });
      if (response.error) {
        Alert.alert('Error', response.error);
      } else {
        fetchData();
        Alert.alert('Success', 'Job assigned successfully');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to assign job');
    } finally {
      setIsAssigning(false);
      setPendingAssignment(null);
    }
  }, [fetchData]);

  const getStatusColor = (status: string) => {
    return STATUS_CONFIG[status]?.color || STATUS_CONFIG.offline.color;
  };

  const getJobStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#f59e0b';
      case 'scheduled': return '#3b82f6';
      case 'in_progress': return '#22c55e';
      case 'done': return '#10b981';
      case 'invoiced': return '#8b5cf6';
      default: return '#6b7280';
    }
  };

  const getInitials = (firstName?: string, lastName?: string, email?: string) => {
    if (firstName || lastName) {
      return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
    }
    return email?.[0]?.toUpperCase() || '?';
  };

  const renderTeamStatusBoard = () => (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
      }
    >
      <Text style={styles.sectionTitle}>TEAM STATUS</Text>
      {sortedMembers.map(member => {
        const memberPresence = getMemberPresence(member.userId);
        const status = memberPresence?.status || 'offline';
        const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.offline;
        const fullName = `${member.firstName || ''} ${member.lastName || ''}`.trim() || member.email || 'Team Member';

        return (
          <TouchableOpacity
            key={member.id}
            style={styles.memberCard}
            onPress={() => handleMemberTap(member)}
            activeOpacity={0.7}
            data-testid={`team-member-${member.id}`}
          >
            <View style={styles.avatarContainer}>
              <View style={[styles.avatar, { backgroundColor: getStatusColor(status) }]}>
                <Text style={styles.avatarText}>
                  {getInitials(member.firstName, member.lastName, member.email)}
                </Text>
              </View>
              <View style={[styles.statusDot, { backgroundColor: statusConfig.color }]} />
            </View>
            <View style={styles.memberInfo}>
              <View style={styles.memberNameRow}>
                <Text style={styles.memberName}>{fullName}</Text>
                {member.roleName && (
                  <View style={styles.roleBadge}>
                    <Text style={styles.roleBadgeText}>{member.roleName}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.memberStatus}>
                {memberPresence?.currentJob
                  ? `Working on: ${memberPresence.currentJob.title}`
                  : memberPresence?.statusMessage || statusConfig.label}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.messageButton}
              onPress={() => handleMessage(member.userId)}
            >
              <Feather name="message-circle" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          </TouchableOpacity>
        );
      })}
      {sortedMembers.length === 0 && (
        <View style={styles.emptyState}>
          <Feather name="users" size={48} color={colors.mutedForeground} />
          <Text style={styles.emptyStateTitle}>No Team Members</Text>
          <Text style={styles.emptyStateText}>
            Invite team members to see their status here
          </Text>
        </View>
      )}
    </ScrollView>
  );

  const renderActivityFeed = () => (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
      }
    >
      <Text style={styles.sectionTitle}>RECENT ACTIVITY</Text>
      {activities.map(activity => {
        const config = ACTIVITY_CONFIG[activity.activityType] || {
          icon: 'activity' as const,
          color: colors.mutedForeground,
          bgColor: colors.muted,
        };

        return (
          <View key={activity.id} style={styles.activityItem} data-testid={`activity-${activity.id}`}>
            <View style={[styles.activityIcon, { backgroundColor: config.bgColor }]}>
              <Feather name={config.icon} size={18} color={config.color} />
            </View>
            <View style={styles.activityContent}>
              <Text style={styles.activityTitle}>{activity.actorName || 'Team Member'}</Text>
              <Text style={styles.activityDescription}>
                {activity.description || activity.entityTitle || activity.activityType.replace(/_/g, ' ')}
              </Text>
              <Text style={styles.activityTime}>
                {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
              </Text>
            </View>
            {activity.isImportant && (
              <View style={styles.importantBadge}>
                <Text style={styles.importantBadgeText}>Important</Text>
              </View>
            )}
          </View>
        );
      })}
      {activities.length === 0 && (
        <View style={styles.emptyState}>
          <Feather name="activity" size={48} color={colors.mutedForeground} />
          <Text style={styles.emptyStateTitle}>No Recent Activity</Text>
          <Text style={styles.emptyStateText}>
            Team activity will appear here
          </Text>
        </View>
      )}
    </ScrollView>
  );

  const renderMemberModal = () => {
    if (!selectedMember) return null;
    const status = selectedMember.presence?.status || 'offline';
    const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.offline;
    const fullName = `${selectedMember.firstName || ''} ${selectedMember.lastName || ''}`.trim() || selectedMember.email || 'Team Member';

    return (
      <Modal
        visible={showMemberModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMemberModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowMemberModal(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalAvatarContainer}>
                <View style={[styles.modalAvatar, { backgroundColor: getStatusColor(status) }]}>
                  <Text style={styles.modalAvatarText}>
                    {getInitials(selectedMember.firstName, selectedMember.lastName, selectedMember.email)}
                  </Text>
                </View>
                <View style={[styles.modalStatusDot, { backgroundColor: statusConfig.color }]} />
              </View>
              <View style={styles.modalInfo}>
                <Text style={styles.modalName}>{fullName}</Text>
                <View style={styles.modalRoleRow}>
                  {selectedMember.roleName && (
                    <View style={styles.modalRoleBadge}>
                      <Text style={styles.roleBadgeText}>{selectedMember.roleName}</Text>
                    </View>
                  )}
                  <View style={[styles.modalStatusBadge, { backgroundColor: `${statusConfig.color}20` }]}>
                    <Text style={[styles.modalStatusText, { color: statusConfig.color }]}>
                      {statusConfig.label}
                    </Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowMemberModal(false)}
              >
                <Feather name="x" size={20} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.quickActions}>
                {selectedMember.phone && (
                  <TouchableOpacity
                    style={styles.quickActionButton}
                    onPress={() => handleCall(selectedMember.phone)}
                    data-testid="button-call"
                  >
                    <View style={[styles.quickActionIcon, { backgroundColor: '#dcfce7' }]}>
                      <Feather name="phone" size={18} color="#22c55e" />
                    </View>
                    <Text style={styles.quickActionLabel}>Call</Text>
                  </TouchableOpacity>
                )}
                {selectedMember.email && (
                  <TouchableOpacity
                    style={styles.quickActionButton}
                    onPress={() => handleEmail(selectedMember.email)}
                    data-testid="button-email"
                  >
                    <View style={[styles.quickActionIcon, { backgroundColor: '#dbeafe' }]}>
                      <Feather name="mail" size={18} color="#3b82f6" />
                    </View>
                    <Text style={styles.quickActionLabel}>Email</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.quickActionButton}
                  onPress={() => handleMessage(selectedMember.userId)}
                  data-testid="button-message"
                >
                  <View style={[styles.quickActionIcon, { backgroundColor: '#f3e8ff' }]}>
                    <Feather name="message-circle" size={18} color="#a855f7" />
                  </View>
                  <Text style={styles.quickActionLabel}>Message</Text>
                </TouchableOpacity>
              </View>

              {selectedMember.presence?.currentJob && (
                <>
                  <Text style={styles.sectionTitleModal}>CURRENTLY WORKING ON</Text>
                  <TouchableOpacity
                    style={[styles.jobCard, { backgroundColor: `${colors.primary}10`, borderColor: colors.primary }]}
                    onPress={() => {
                      setShowMemberModal(false);
                      router.push(`/job/${selectedMember.presence?.currentJob?.id}`);
                    }}
                  >
                    <Feather name="tool" size={18} color={colors.primary} />
                    <View style={[styles.jobInfo, { marginLeft: spacing.md }]}>
                      <Text style={styles.jobTitle}>{selectedMember.presence.currentJob.title}</Text>
                    </View>
                  </TouchableOpacity>
                </>
              )}

              <Text style={styles.sectionTitleModal}>ASSIGNED JOBS ({selectedMember.assignedJobs.length})</Text>
              {selectedMember.assignedJobs.slice(0, 5).map(job => (
                <TouchableOpacity
                  key={job.id}
                  style={styles.jobCard}
                  onPress={() => {
                    setShowMemberModal(false);
                    router.push(`/job/${job.id}`);
                  }}
                  data-testid={`job-${job.id}`}
                >
                  <View style={styles.jobInfo}>
                    <Text style={styles.jobTitle}>{job.title}</Text>
                    {job.clientName && (
                      <Text style={styles.jobClient}>{job.clientName}</Text>
                    )}
                  </View>
                  <View style={[styles.jobStatusBadge, { backgroundColor: `${getJobStatusColor(job.status)}20` }]}>
                    <Text style={[styles.jobStatusText, { color: getJobStatusColor(job.status) }]}>
                      {job.status.replace(/_/g, ' ')}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
              {selectedMember.assignedJobs.length === 0 && (
                <View style={[styles.emptyState, { paddingVertical: spacing.lg }]}>
                  <Feather name="inbox" size={32} color={colors.mutedForeground} />
                  <Text style={[styles.emptyStateText, { marginTop: spacing.sm }]}>
                    No jobs assigned
                  </Text>
                </View>
              )}

              {unassignedJobs.length > 0 && (
                <View style={styles.unassignedSection}>
                  <View style={styles.unassignedHeader}>
                    <Text style={styles.sectionTitleModal}>QUICK ASSIGN</Text>
                  </View>
                  {unassignedJobs.slice(0, 3).map(job => (
                    <View key={job.id} style={styles.jobCard}>
                      <View style={styles.jobInfo}>
                        <Text style={styles.jobTitle}>{job.title}</Text>
                        {job.clientName && (
                          <Text style={styles.jobClient}>{job.clientName}</Text>
                        )}
                      </View>
                      <TouchableOpacity
                        style={styles.assignButton}
                        onPress={() => handleAssignJob(job.id, selectedMember.userId)}
                        disabled={isAssigning}
                      >
                        {isAssigning ? (
                          <ActivityIndicator size="small" color="#ffffff" />
                        ) : (
                          <>
                            <Feather name="plus" size={14} color="#ffffff" />
                            <Text style={styles.assignButtonText}>Assign</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    );
  };

  const renderConfirmModal = () => {
    if (!pendingAssignment) return null;
    const { worker, job } = pendingAssignment;
    const workerName = `${worker.firstName || ''} ${worker.lastName || ''}`.trim() || worker.email;

    return (
      <Modal visible={!!pendingAssignment} transparent animationType="fade">
        <View style={styles.confirmModal}>
          <View style={styles.confirmContent}>
            <Text style={styles.confirmTitle}>Assign Job?</Text>
            <Text style={styles.confirmText}>
              Assign <Text style={styles.confirmHighlight}>"{job.title}"</Text> to{' '}
              <Text style={styles.confirmHighlight}>{workerName}</Text>?
            </Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={[styles.confirmButton, styles.confirmButtonCancel]}
                onPress={() => setPendingAssignment(null)}
              >
                <Text style={[styles.confirmButtonText, { color: colors.foreground }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, styles.confirmButtonConfirm]}
                onPress={() => handleAssignJob(job.id, worker.userId)}
                disabled={isAssigning}
              >
                {isAssigning ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={[styles.confirmButtonText, { color: '#ffffff' }]}>Assign</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Feather name="arrow-left" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Team Hub</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Team Hub</Text>
          <Text style={styles.headerSubtitle}>
            {Array.isArray(teamMembers) ? teamMembers.length : 0} member{(Array.isArray(teamMembers) ? teamMembers.length : 0) !== 1 ? 's' : ''} • {Array.isArray(presence) ? presence.filter(p => p.status === 'online' || p.status === 'working' || p.status === 'driving').length : 0} active
          </Text>
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
          <Feather
            name="refresh-cw"
            size={18}
            color={colors.mutedForeground}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabButton, viewMode === 'status' && styles.tabButtonActive]}
          onPress={() => setViewMode('status')}
        >
          <Feather
            name="users"
            size={16}
            color={viewMode === 'status' ? colors.primary : colors.mutedForeground}
          />
          <Text style={[styles.tabButtonText, viewMode === 'status' && styles.tabButtonTextActive]}>
            Status
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, viewMode === 'activity' && styles.tabButtonActive]}
          onPress={() => setViewMode('activity')}
        >
          <Feather
            name="activity"
            size={16}
            color={viewMode === 'activity' ? colors.primary : colors.mutedForeground}
          />
          <Text style={[styles.tabButtonText, viewMode === 'activity' && styles.tabButtonTextActive]}>
            Activity
          </Text>
        </TouchableOpacity>
      </View>

      {viewMode === 'status' && renderTeamStatusBoard()}
      {viewMode === 'activity' && renderActivityFeed()}

      {renderMemberModal()}
      {renderConfirmModal()}
    </View>
  );
}
