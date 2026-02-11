import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import api from '../../src/lib/api';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, iconSizes } from '../../src/lib/design-tokens';

interface TeamPresence {
  userId: string;
  status: string;
  statusMessage?: string;
  currentJobId?: string;
  lastSeenAt?: string;
  user?: {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
  };
  currentJob?: {
    id: string;
    title: string;
  };
}

interface TeamMember {
  id: string;
  userId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
  roleName?: string;
}

interface ActivityItem {
  id: string;
  actorName?: string;
  activityType: string;
  entityType?: string;
  entityTitle?: string;
  description?: string;
  isImportant?: boolean;
  createdAt: string;
}

interface UtilizationData {
  period?: { start: string; end: string };
  teamAverage?: { utilizationPercent: number };
  members?: Array<{
    userId: string;
    name: string;
    billableHours: number;
    totalHours: number;
    utilizationPercent: number;
    jobsCompleted: number;
    jobsAssigned: number;
  }>;
}

interface JobData {
  id: string;
  title: string;
  status: string;
  assignedTo?: string;
}

const STATUS_CONFIG: Record<string, { color: string; label: string; icon: string }> = {
  online: { color: '#22C55E', label: 'Online', icon: 'wifi' },
  busy: { color: '#EAB308', label: 'Busy', icon: 'clock' },
  on_job: { color: '#3B82F6', label: 'On Job', icon: 'tool' },
  break: { color: '#F97316', label: 'On Break', icon: 'coffee' },
  offline: { color: '#6B7280', label: 'Offline', icon: 'wifi-off' },
};

const ACTIVITY_ICONS: Record<string, string> = {
  job_started: 'briefcase',
  job_completed: 'check-circle',
  check_in: 'map-pin',
  check_out: 'log-out',
  quote_sent: 'file-text',
  invoice_sent: 'send',
  invoice_paid: 'credit-card',
  message_sent: 'message-circle',
  client_added: 'users',
};

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function getMemberName(member: TeamMember): string {
  return `${member.firstName || ''} ${member.lastName || ''}`.trim() || member.email || 'Team Member';
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1 },
  contentContainer: { paddingHorizontal: spacing.lg, paddingBottom: 100 },
  sectionTitle: { fontSize: 17, fontWeight: '600', color: colors.foreground, marginBottom: spacing.md, marginTop: spacing.lg },
  statusSummary: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  statusCard: {
    flex: 1, backgroundColor: colors.card,
    borderRadius: radius.xl, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center',
  },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginBottom: spacing.xs },
  statusCount: { fontSize: 22, fontWeight: '700', color: colors.foreground },
  statusLabel: { fontSize: 11, color: colors.mutedForeground, marginTop: 2 },
  memberCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
  },
  avatarContainer: { position: 'relative' as any },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 15, fontWeight: '600', color: colors.primary },
  presenceDot: {
    position: 'absolute' as any, bottom: 0, right: 0,
    width: 14, height: 14, borderRadius: 7,
    borderWidth: 2, borderColor: colors.card,
  },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 15, fontWeight: '600', color: colors.foreground },
  memberStatus: { fontSize: 13, color: colors.mutedForeground, marginTop: 2 },
  roleBadge: {
    backgroundColor: colors.muted,
    paddingHorizontal: spacing.sm, paddingVertical: 2,
    borderRadius: radius.sm,
  },
  roleBadgeText: { fontSize: 11, color: colors.mutedForeground, fontWeight: '500' },
  activityCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden',
  },
  activityItem: {
    flexDirection: 'row', alignItems: 'flex-start',
    padding: spacing.md, gap: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  activityItemLast: { borderBottomWidth: 0 },
  activityIcon: {
    width: 36, height: 36, borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  activityContent: { flex: 1 },
  activityActor: { fontSize: 14, fontWeight: '600', color: colors.foreground },
  activityDesc: { fontSize: 13, color: colors.mutedForeground, marginTop: 2 },
  activityTime: { fontSize: 11, color: colors.mutedForeground, marginTop: spacing.xs },
  importantBadge: {
    backgroundColor: colors.warningLight,
    paddingHorizontal: spacing.sm, paddingVertical: 2,
    borderRadius: radius.sm, alignSelf: 'flex-start',
  },
  importantText: { fontSize: 10, color: colors.warning, fontWeight: '600' },
  utilizationCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1, borderColor: colors.border,
    marginBottom: spacing.md,
  },
  utilizationHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  utilizationLabel: { fontSize: 14, fontWeight: '500', color: colors.foreground },
  utilizationPercent: { fontSize: 18, fontWeight: '700' },
  progressBar: {
    height: 8, backgroundColor: colors.muted,
    borderRadius: 4, overflow: 'hidden' as any,
    marginBottom: spacing.sm,
  },
  progressFill: { height: '100%', borderRadius: 4 },
  utilizationDetail: { fontSize: 12, color: colors.mutedForeground },
  jobAssignmentCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
  },
  jobIcon: {
    width: 40, height: 40, borderRadius: radius.lg,
    alignItems: 'center', justifyContent: 'center',
  },
  jobInfo: { flex: 1 },
  jobTitle: { fontSize: 14, fontWeight: '600', color: colors.foreground },
  jobMeta: { fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
  statusBadge: {
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  statusBadgeText: { fontSize: 11, fontWeight: '600' },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyIcon: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.muted,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyText: { fontSize: 14, color: colors.mutedForeground, textAlign: 'center' },
  loadingContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
});

function getUtilizationColor(percent: number): string {
  if (percent >= 70) return '#22C55E';
  if (percent >= 50) return '#EAB308';
  return '#EF4444';
}

function getJobStatusStyle(status: string, colors: ThemeColors) {
  switch (status) {
    case 'in_progress': return { bg: colors.inProgressBg, text: colors.inProgress };
    case 'scheduled': return { bg: colors.scheduledBg, text: colors.scheduled };
    case 'done': case 'completed': return { bg: colors.doneBg, text: colors.done };
    case 'pending': return { bg: colors.pendingBg, text: colors.pending };
    default: return { bg: colors.muted, text: colors.mutedForeground };
  }
}

export default function TeamDashboardScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [presence, setPresence] = useState<TeamPresence[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [utilization, setUtilization] = useState<UtilizationData | null>(null);
  const [jobs, setJobs] = useState<JobData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [presenceRes, membersRes, activityRes, utilizationRes, jobsRes] = await Promise.all([
        api.get<TeamPresence[]>('/api/team/presence'),
        api.get<TeamMember[]>('/api/team/members'),
        api.get<ActivityItem[]>('/api/activity-feed?limit=20'),
        api.get<UtilizationData>('/api/team/utilization'),
        api.get<JobData[]>('/api/jobs'),
      ]);
      if (presenceRes.data) setPresence(Array.isArray(presenceRes.data) ? presenceRes.data : []);
      if (membersRes.data) setMembers(Array.isArray(membersRes.data) ? membersRes.data : []);
      if (activityRes.data) setActivities(Array.isArray(activityRes.data) ? activityRes.data : []);
      if (utilizationRes.data) setUtilization(utilizationRes.data);
      if (jobsRes.data) setJobs(Array.isArray(jobsRes.data) ? jobsRes.data : []);
    } catch (error) {
      console.error('Error loading team dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  };

  const presenceMap = new Map(presence.map(p => [p.userId, p]));

  const onlineCount = presence.filter(p => p.status === 'online' || p.status === 'on_job').length;
  const onJobCount = presence.filter(p => p.status === 'on_job').length;
  const offlineCount = members.length - onlineCount;

  const sortedMembers = [...members].sort((a, b) => {
    const aStatus = presenceMap.get(a.userId)?.status || 'offline';
    const bStatus = presenceMap.get(b.userId)?.status || 'offline';
    const order = ['online', 'on_job', 'busy', 'break', 'offline'];
    return order.indexOf(aStatus) - order.indexOf(bStatus);
  });

  const assignedJobs = jobs.filter(j => j.assignedTo && (j.status === 'in_progress' || j.status === 'scheduled'));

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true, title: 'Team Dashboard',
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.foreground,
        }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <>
            <View style={styles.statusSummary}>
              <View style={styles.statusCard}>
                <View style={[styles.statusDot, { backgroundColor: '#22C55E' }]} />
                <Text style={styles.statusCount}>{onlineCount}</Text>
                <Text style={styles.statusLabel}>Online</Text>
              </View>
              <View style={styles.statusCard}>
                <View style={[styles.statusDot, { backgroundColor: '#3B82F6' }]} />
                <Text style={styles.statusCount}>{onJobCount}</Text>
                <Text style={styles.statusLabel}>On Job</Text>
              </View>
              <View style={styles.statusCard}>
                <View style={[styles.statusDot, { backgroundColor: '#6B7280' }]} />
                <Text style={styles.statusCount}>{offlineCount}</Text>
                <Text style={styles.statusLabel}>Offline</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Team Members</Text>
            {members.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <Feather name="users" size={24} color={colors.mutedForeground} />
                </View>
                <Text style={styles.emptyText}>No team members yet</Text>
              </View>
            ) : (
              sortedMembers.map(member => {
                const p = presenceMap.get(member.userId);
                const status = p?.status || 'offline';
                const config = STATUS_CONFIG[status] || STATUS_CONFIG.offline;
                const name = getMemberName(member);
                return (
                  <View key={member.id} style={styles.memberCard}>
                    <View style={styles.avatarContainer}>
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{getInitials(name)}</Text>
                      </View>
                      <View style={[styles.presenceDot, { backgroundColor: config.color }]} />
                    </View>
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>{name}</Text>
                      <Text style={styles.memberStatus}>
                        {p?.currentJob ? `Working on: ${p.currentJob.title}` :
                         p?.statusMessage ? p.statusMessage :
                         status === 'offline' && p?.lastSeenAt ? `Last seen ${formatTimeAgo(p.lastSeenAt)}` :
                         config.label}
                      </Text>
                    </View>
                    {member.roleName && (
                      <View style={styles.roleBadge}>
                        <Text style={styles.roleBadgeText}>{member.roleName}</Text>
                      </View>
                    )}
                  </View>
                );
              })
            )}

            {utilization && utilization.teamAverage && (
              <>
                <Text style={styles.sectionTitle}>Team Utilization</Text>
                <View style={styles.utilizationCard}>
                  <View style={styles.utilizationHeader}>
                    <Text style={styles.utilizationLabel}>Team Average</Text>
                    <Text style={[styles.utilizationPercent, { color: getUtilizationColor(utilization.teamAverage.utilizationPercent) }]}>
                      {utilization.teamAverage.utilizationPercent}%
                    </Text>
                  </View>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, {
                      width: `${Math.min(utilization.teamAverage.utilizationPercent, 100)}%`,
                      backgroundColor: getUtilizationColor(utilization.teamAverage.utilizationPercent),
                    }]} />
                  </View>
                  <Text style={styles.utilizationDetail}>
                    {utilization.teamAverage.utilizationPercent >= 80 ? 'On target' :
                     utilization.teamAverage.utilizationPercent >= 70 ? 'Near target' : 'Below target'}
                    {' \u2022 Target: 80%'}
                  </Text>
                </View>
                {utilization.members && utilization.members.map(m => (
                  <View key={m.userId} style={styles.utilizationCard}>
                    <View style={styles.utilizationHeader}>
                      <Text style={styles.utilizationLabel}>{m.name}</Text>
                      <Text style={[styles.utilizationPercent, { color: getUtilizationColor(m.utilizationPercent), fontSize: 15 }]}>
                        {m.utilizationPercent}%
                      </Text>
                    </View>
                    <View style={styles.progressBar}>
                      <View style={[styles.progressFill, {
                        width: `${Math.min(m.utilizationPercent, 100)}%`,
                        backgroundColor: getUtilizationColor(m.utilizationPercent),
                      }]} />
                    </View>
                    <Text style={styles.utilizationDetail}>
                      {m.billableHours}h / {m.totalHours}h {'\u2022'} {m.jobsCompleted} jobs done
                    </Text>
                  </View>
                ))}
              </>
            )}

            {assignedJobs.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Active Assignments</Text>
                {assignedJobs.slice(0, 10).map(job => {
                  const jobStyle = getJobStatusStyle(job.status, colors);
                  const assignedMember = members.find(m => m.userId === job.assignedTo);
                  return (
                    <View key={job.id} style={styles.jobAssignmentCard}>
                      <View style={[styles.jobIcon, { backgroundColor: jobStyle.bg }]}>
                        <Feather name="briefcase" size={iconSizes.lg} color={jobStyle.text} />
                      </View>
                      <View style={styles.jobInfo}>
                        <Text style={styles.jobTitle} numberOfLines={1}>{job.title}</Text>
                        {assignedMember && (
                          <Text style={styles.jobMeta}>{getMemberName(assignedMember)}</Text>
                        )}
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: jobStyle.bg }]}>
                        <Text style={[styles.statusBadgeText, { color: jobStyle.text, textTransform: 'capitalize' }]}>
                          {job.status.replace('_', ' ')}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </>
            )}

            <Text style={styles.sectionTitle}>Recent Activity</Text>
            {activities.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <Feather name="activity" size={24} color={colors.mutedForeground} />
                </View>
                <Text style={styles.emptyText}>No recent activity</Text>
              </View>
            ) : (
              <View style={styles.activityCard}>
                {activities.slice(0, 15).map((activity, index) => {
                  const icon = ACTIVITY_ICONS[activity.activityType] || 'briefcase';
                  const isLast = index === Math.min(activities.length, 15) - 1;
                  return (
                    <View key={activity.id} style={[styles.activityItem, isLast && styles.activityItemLast]}>
                      <View style={styles.activityIcon}>
                        <Feather name={icon as any} size={iconSizes.md} color={colors.primary} />
                      </View>
                      <View style={styles.activityContent}>
                        <Text style={styles.activityActor}>{activity.actorName || 'Team Member'}</Text>
                        <Text style={styles.activityDesc} numberOfLines={2}>
                          {activity.description || activity.entityTitle || activity.activityType.replace(/_/g, ' ')}
                        </Text>
                        <Text style={styles.activityTime}>{formatTimeAgo(activity.createdAt)}</Text>
                      </View>
                      {activity.isImportant && (
                        <View style={styles.importantBadge}>
                          <Text style={styles.importantText}>Important</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
