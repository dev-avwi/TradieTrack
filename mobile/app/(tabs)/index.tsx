import { useEffect, useCallback, useState, useMemo } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  Linking,
  ActivityIndicator,
  Alert
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuthStore, useJobsStore, useDashboardStore, useClientsStore } from '../../src/lib/store';
import { StatusBadge } from '../../src/components/ui/StatusBadge';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, shadows, typography, iconSizes, sizes, pageShell } from '../../src/lib/design-tokens';
import { NotificationBell, NotificationsPanel } from '../../src/components/NotificationsPanel';
import { TrustBanner } from '../../src/components/ui/TrustBanner';

// Activity Feed Component - matches web Recent Activity section
function ActivityFeed({ activities }: { activities: any[] }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const getActivityIcon = (type: string): keyof typeof Feather.glyphMap => {
    switch (type) {
      case 'job': return 'briefcase';
      case 'quote': return 'file-text';
      case 'invoice': return 'dollar-sign';
      case 'payment': return 'credit-card';
      case 'client': return 'user';
      default: return 'activity';
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'job': return colors.primary;
      case 'quote': return colors.info;
      case 'invoice': return colors.warning;
      case 'payment': return colors.success;
      case 'client': return colors.mutedForeground;
      default: return colors.mutedForeground;
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
  };

  if (activities.length === 0) {
    return (
      <View style={styles.activityEmpty}>
        <Feather name="activity" size={sizes.emptyIconSm} color={colors.mutedForeground} />
        <Text style={styles.activityEmptyText}>No recent activity</Text>
      </View>
    );
  }

  return (
    <View style={styles.activityList}>
      {activities.slice(0, 5).map((activity, index) => (
        <View key={activity.id || index} style={styles.activityItem}>
          <View style={[styles.activityIcon, { backgroundColor: `${getActivityColor(activity.type)}12` }]}>
            <Feather 
              name={getActivityIcon(activity.type)} 
              size={12} 
              color={getActivityColor(activity.type)} 
            />
          </View>
          <View style={styles.activityContent}>
            <Text style={styles.activityTitle} numberOfLines={1}>{activity.title}</Text>
            <Text style={styles.activityTime}>{formatTimeAgo(activity.createdAt)}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// Time Tracking Widget - matches web Staff Dashboard
function TimeTrackingWidget() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [activeTimer, setActiveTimer] = useState<any>(null);
  const [elapsedTime, setElapsedTime] = useState('00:00:00');
  const [totalMinutesToday, setTotalMinutesToday] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isStopping, setIsStopping] = useState(false);

  useEffect(() => {
    loadTimeData();
    const interval = setInterval(loadTimeData, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (activeTimer) {
      timer = setInterval(() => {
        const startTime = new Date(activeTimer.startTime).getTime();
        const elapsed = Date.now() - startTime;
        const hours = Math.floor(elapsed / 3600000);
        const minutes = Math.floor((elapsed % 3600000) / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        setElapsedTime(
          `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        );
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [activeTimer]);

  const loadTimeData = async () => {
    try {
      const { default: api } = await import('../../src/lib/api');
      const [activeResponse, dashboardResponse] = await Promise.all([
        api.get('/api/time-entries/active/current'),
        api.get('/api/time-tracking/dashboard')
      ]);
      
      if (activeResponse.data) {
        setActiveTimer(activeResponse.data);
      } else {
        setActiveTimer(null);
      }
      
      if (dashboardResponse.data) {
        const entries = (dashboardResponse.data as any).recentEntries || [];
        const total = entries.reduce((sum: number, e: any) => {
          if (e.duration) return sum + e.duration;
          if (e.endTime) {
            const start = new Date(e.startTime).getTime();
            const end = new Date(e.endTime).getTime();
            return sum + Math.floor((end - start) / 60000);
          }
          return sum;
        }, 0);
        setTotalMinutesToday(total);
      }
    } catch (error) {
      console.log('Error loading time data:', error);
      setActiveTimer(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopTimer = async () => {
    if (!activeTimer) return;
    setIsStopping(true);
    try {
      const { default: api } = await import('../../src/lib/api');
      const endTime = new Date();
      const startTime = new Date(activeTimer.startTime);
      const durationMinutes = Math.floor((endTime.getTime() - startTime.getTime()) / 60000);
      
      await api.post(`/api/time-entries/${activeTimer.id}/stop`, {});
      
      setActiveTimer(null);
      Alert.alert('Timer Stopped', 'Time has been recorded');
      loadTimeData();
    } catch (error) {
      Alert.alert('Error', 'Failed to stop timer');
    } finally {
      setIsStopping(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.timeTrackingWidget, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  const hours = Math.floor(totalMinutesToday / 60);
  const mins = totalMinutesToday % 60;

  return (
    <View style={[styles.timeTrackingWidget, activeTimer && styles.timeTrackingWidgetActive]}>
      <View style={styles.timeTrackingContent}>
        <View style={[styles.timerIconContainer, activeTimer && styles.timerIconContainerActive]}>
          <Feather 
            name="clock" 
            size={24} 
            color={activeTimer ? colors.primary : colors.mutedForeground} 
          />
        </View>
        <View style={styles.timerTextContent}>
          {activeTimer ? (
            <>
              <Text style={styles.elapsedTime}>{elapsedTime}</Text>
              <Text style={styles.timerSubtext} numberOfLines={1}>
                Working on: {activeTimer.jobTitle || 'Current job'}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.totalTimeToday}>{hours}h {mins}m today</Text>
              <Text style={styles.timerSubtext}>No active timer</Text>
            </>
          )}
        </View>
      </View>
      {activeTimer && (
        <TouchableOpacity
          style={styles.stopTimerButton}
          onPress={handleStopTimer}
          disabled={isStopping}
          activeOpacity={0.8}
        >
          {isStopping ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <>
              <Feather name="square" size={16} color={colors.white} />
              <Text style={styles.stopTimerText}>Stop</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

// This Week Jobs Component - matches web Staff Dashboard
function ThisWeekSection({ jobs, onViewJob }: { jobs: any[]; onViewJob: (id: string) => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    
    return date.toLocaleDateString('en-AU', { 
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    });
  };

  if (jobs.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <View style={styles.sectionTitleIcon}>
            <Feather name="calendar" size={iconSizes.md} color={colors.primary} />
          </View>
          <Text style={styles.sectionTitle}>This Week</Text>
        </View>
        <View style={styles.weekBadge}>
          <Text style={styles.weekBadgeText}>{jobs.length} jobs</Text>
        </View>
      </View>

      <View style={styles.thisWeekCard}>
        {jobs.slice(0, 5).map((job, index) => (
          <TouchableOpacity
            key={job.id}
            style={[styles.weekJobItem, index < Math.min(jobs.length, 5) - 1 && styles.weekJobItemBorder]}
            onPress={() => onViewJob(job.id)}
            activeOpacity={0.7}
          >
            <View style={styles.weekJobContent}>
              <Text style={styles.weekJobTitle} numberOfLines={1}>{job.title}</Text>
              <Text style={styles.weekJobMeta}>
                {job.scheduledAt && formatDate(job.scheduledAt)}
                {job.clientName && ` • ${job.clientName}`}
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        ))}
        {jobs.length > 5 && (
          <TouchableOpacity
            style={styles.viewAllWeekButton}
            onPress={() => router.push('/(tabs)/jobs')}
            activeOpacity={0.7}
          >
            <Text style={styles.viewAllWeekText}>View all {jobs.length} jobs this week</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// KPI Stat Card Component - compact modern design
function KPICard({ 
  title, 
  value, 
  icon,
  iconBg,
  iconColor,
  onPress
}: { 
  title: string; 
  value: string | number; 
  icon: keyof typeof Feather.glyphMap;
  iconBg: string;
  iconColor: string;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  return (
    <TouchableOpacity
      style={styles.kpiCard}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View style={styles.kpiCardContent}>
        <View style={[styles.kpiIconContainer, { backgroundColor: iconBg }]}>
          <Feather name={icon} size={14} color={iconColor} />
        </View>
        <View>
          <Text style={styles.kpiValue}>{value}</Text>
          <Text style={styles.kpiTitle}>{title}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// Quick Action Button Component - compact
function QuickActionButton({ 
  title, 
  icon, 
  variant = 'outline',
  onPress 
}: { 
  title: string; 
  icon: keyof typeof Feather.glyphMap;
  variant?: 'primary' | 'outline';
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      style={[
        styles.quickActionButton,
        variant === 'primary' && styles.quickActionButtonPrimary
      ]}
    >
      <Feather 
        name={icon} 
        size={14} 
        color={variant === 'primary' ? colors.white : colors.foreground} 
      />
      <Text style={[
        styles.quickActionText,
        variant === 'primary' && styles.quickActionTextPrimary
      ]}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

// Job Card Component - matches web Today's Schedule cards
function TodayJobCard({ 
  job, 
  clients,
  isFirst,
  onPress,
  onStartJob,
  onCompleteJob,
  isUpdating
}: { 
  job: any;
  clients: any[];
  isFirst: boolean;
  onPress: () => void;
  onStartJob: (id: string) => void;
  onCompleteJob: (id: string) => void;
  isUpdating: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const formatTime = (dateStr?: string) => {
    if (!dateStr) return { hour: '', period: '' };
    const date = new Date(dateStr);
    const time = date.toLocaleTimeString('en-AU', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
    const parts = time.split(' ');
    return { hour: parts[0], period: parts[1]?.toUpperCase() || '' };
  };

  const getClient = (clientId?: string) => {
    if (!clientId) return null;
    return clients.find(c => c.id === clientId);
  };

  const client = getClient(job.clientId);
  const time = formatTime(job.scheduledAt);

  const handleCall = () => {
    if (client?.phone) {
      Linking.openURL(`tel:${client.phone}`);
    }
  };

  const handleSMS = () => {
    if (client?.phone) {
      Linking.openURL(`sms:${client.phone}`);
    }
  };

  const handleNavigate = () => {
    if (job.address) {
      const encodedAddress = encodeURIComponent(job.address);
      Linking.openURL(`https://maps.google.com/maps?q=${encodedAddress}`);
    }
  };

  const getStatusBadge = () => {
    if (job.status === 'done') {
      return (
        <View style={[styles.statusBadge, styles.statusBadgeComplete]}>
          <Text style={[styles.statusBadgeText, styles.statusBadgeTextComplete]}>Complete</Text>
        </View>
      );
    } else if (job.status === 'in_progress') {
      return (
        <View style={[styles.statusBadge, styles.statusBadgeProgress]}>
          <View style={styles.pulseDot} />
          <Text style={[styles.statusBadgeText, styles.statusBadgeTextProgress]}>In Progress</Text>
        </View>
      );
    }
    return (
      <View style={[styles.statusBadge, styles.statusBadgeScheduled]}>
        <Text style={styles.statusBadgeText}>Scheduled</Text>
      </View>
    );
  };

  const getActionButton = () => {
    if (job.status === 'pending' || job.status === 'scheduled') {
      return (
        <TouchableOpacity 
          style={styles.primaryActionButton}
          onPress={() => onStartJob(job.id)}
          disabled={isUpdating}
          activeOpacity={0.8}
        >
          <Feather name="play" size={iconSizes.lg} color={colors.white} />
          <Text style={styles.primaryActionButtonText}>Start Job</Text>
        </TouchableOpacity>
      );
    } else if (job.status === 'in_progress') {
      return (
        <TouchableOpacity 
          style={[styles.primaryActionButton, styles.completeActionButton]}
          onPress={() => onCompleteJob(job.id)}
          disabled={isUpdating}
          activeOpacity={0.8}
        >
          <Feather name="check-circle" size={iconSizes.lg} color={colors.white} />
          <Text style={styles.primaryActionButtonText}>Complete Job</Text>
        </TouchableOpacity>
      );
    }
    return (
      <TouchableOpacity 
        style={styles.outlineActionButton}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <Text style={styles.outlineActionButtonText}>View Details</Text>
      </TouchableOpacity>
    );
  };

  const getAccentColor = () => {
    switch (job.status) {
      case 'pending': return colors.pending;
      case 'scheduled': return colors.scheduled;
      case 'in_progress': return colors.inProgress;
      case 'done': return colors.done;
      case 'invoiced': return colors.invoiced;
      default: return colors.primary;
    }
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      style={styles.jobCard}
    >
      {/* Left Accent Bar */}
      <View style={[styles.jobCardAccent, { backgroundColor: getAccentColor() }]} />
      
      {/* Card Content */}
      <View style={styles.jobCardContent}>
        {/* Job Header */}
        <View style={styles.jobCardHeader}>
          <View style={styles.jobCardHeaderLeft}>
            <View style={styles.timeBox}>
              <Text style={styles.timeBoxText}>{time.hour}</Text>
            </View>
            <View style={styles.jobCardTitleArea}>
              <View style={styles.jobCardMetaRow}>
                <Text style={styles.timePeriod}>{time.period}</Text>
                {getStatusBadge()}
              </View>
              <Text style={styles.jobCardTitle} numberOfLines={1}>{job.title}</Text>
            </View>
          </View>
          <Feather name="chevron-right" size={iconSizes.lg} color={colors.mutedForeground} />
        </View>

        {/* Client & Address */}
        <View style={styles.jobCardDetails}>
          {client?.name && (
            <View style={styles.jobDetailRow}>
              <Feather name="user" size={iconSizes.md} color={colors.mutedForeground} />
              <Text style={styles.jobDetailText} numberOfLines={1}>{client.name}</Text>
            </View>
          )}
          {job.address && (
            <View style={styles.jobDetailRow}>
              <Feather name="map-pin" size={iconSizes.md} color={colors.mutedForeground} />
              <Text style={styles.jobDetailText} numberOfLines={1}>{job.address}</Text>
            </View>
          )}
        </View>

        {/* Quick Contact Buttons */}
        {(client?.phone || job.address) && (
          <View style={styles.quickContactRow}>
            {client?.phone && (
              <>
                <TouchableOpacity 
                  style={styles.quickContactButton}
                  onPress={handleCall}
                  activeOpacity={0.7}
                >
                  <Feather name="phone" size={iconSizes.md} color={colors.foreground} />
                  <Text style={styles.quickContactText}>Call</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.quickContactButton}
                  onPress={handleSMS}
                  activeOpacity={0.7}
                >
                  <Feather name="message-square" size={iconSizes.md} color={colors.foreground} />
                  <Text style={styles.quickContactText}>SMS</Text>
                </TouchableOpacity>
              </>
            )}
            {job.address && (
              <TouchableOpacity 
                style={[styles.quickContactButton, !client?.phone && styles.quickContactButtonFull]}
                onPress={handleNavigate}
                activeOpacity={0.7}
              >
                <Feather name="navigation" size={iconSizes.md} color={colors.foreground} />
                <Text style={styles.quickContactText}>Navigate</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Primary Action Button */}
        {getActionButton()}
      </View>
    </TouchableOpacity>
  );
}

// Empty State Component
function EmptyTodayState({ onCreateJob }: { onCreateJob: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyStateIcon}>
        <Feather name="briefcase" size={sizes.emptyIcon} color={colors.mutedForeground} />
      </View>
      <Text style={styles.emptyStateTitle}>No jobs scheduled for today</Text>
      <TouchableOpacity 
        style={styles.scheduleJobButton}
        onPress={onCreateJob}
        activeOpacity={0.8}
      >
        <Feather name="plus" size={iconSizes.md} color={colors.white} />
        <Text style={styles.scheduleJobButtonText}>Schedule a Job</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function DashboardScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const { user, businessSettings, roleInfo, isOwner, isStaff } = useAuthStore();
  const { todaysJobs, fetchTodaysJobs, isLoading: jobsLoading, updateJobStatus } = useJobsStore();
  const { stats, fetchStats, isLoading: statsLoading } = useDashboardStore();
  const { clients, fetchClients } = useClientsStore();
  const [isUpdating, setIsUpdating] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  
  // Job Scheduler state for team owners
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [unassignedJobs, setUnassignedJobs] = useState<any[]>([]);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [allJobs, setAllJobs] = useState<any[]>([]);
  
  // Determine if user is staff (team member with limited permissions)
  const isStaffUser = isStaff();
  const isOwnerUser = isOwner();
  // Match web's canViewMap logic: only owners and managers can see the map
  const isManager = roleInfo?.roleName?.toLowerCase() === 'manager';
  const canViewMap = isOwnerUser || isManager;
  const hasActiveTeam = teamMembers.length > 0;
  
  const handleNavigateToItem = (type: string, id: string) => {
    switch (type) {
      case 'job':
        router.push(`/job/${id}`);
        break;
      case 'quote':
        router.push(`/more/quote/${id}`);
        break;
      case 'invoice':
        router.push(`/more/invoice/${id}`);
        break;
      case 'client':
        router.push(`/more/client/${id}`);
        break;
      default:
        break;
    }
  };

  const refreshData = useCallback(async () => {
    await Promise.all([
      fetchTodaysJobs(),
      fetchStats(),
      fetchClients(),
    ]);
  }, [fetchTodaysJobs, fetchStats, fetchClients]);

  useEffect(() => {
    refreshData();
  }, []);

  // Fetch team data for job scheduler (owners only)
  const fetchTeamData = useCallback(async () => {
    if (!isOwnerUser) return;
    try {
      const { default: api } = await import('../../src/lib/api');
      const [teamRes, jobsRes, unassignedRes] = await Promise.all([
        api.get('/api/team/members'),
        api.get('/api/jobs'),
        api.get('/api/jobs?unassigned=true'),
      ]);
      if (teamRes.data) {
        setTeamMembers(teamRes.data.filter((m: any) => m.inviteStatus === 'accepted'));
      }
      if (jobsRes.data) {
        setAllJobs(jobsRes.data);
      }
      if (unassignedRes.data) {
        setUnassignedJobs(unassignedRes.data);
      }
    } catch (error) {
      console.log('Error fetching team data:', error);
    }
  }, [isOwnerUser]);

  useEffect(() => {
    fetchTeamData();
  }, [fetchTeamData]);

  const handleAssignJob = async (jobId: string, userId: string) => {
    setIsAssigning(true);
    try {
      const { default: api } = await import('../../src/lib/api');
      await api.post(`/api/jobs/${jobId}/assign`, { assignedTo: userId });
      Alert.alert('Success', 'Job assigned successfully');
      setSelectedJob(null);
      // Refresh team data and today's jobs (cache invalidation like web)
      await Promise.all([
        fetchTeamData(),
        fetchTodaysJobs(),
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to assign job');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleUnassignJob = async (job: any) => {
    Alert.alert(
      'Unassign Job',
      `Remove "${job.title}" from this team member?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unassign',
          style: 'destructive',
          onPress: async () => {
            setIsAssigning(true);
            try {
              const { default: api } = await import('../../src/lib/api');
              await api.post(`/api/jobs/${job.id}/assign`, { assignedTo: null });
              Alert.alert('Success', 'Job unassigned');
              await Promise.all([
                fetchTeamData(),
                fetchTodaysJobs(),
              ]);
            } catch (error) {
              Alert.alert('Error', 'Failed to unassign job');
            } finally {
              setIsAssigning(false);
            }
          },
        },
      ]
    );
  };

  const getJobsForMember = (memberId: string) => {
    return allJobs.filter((job: any) => 
      job.assignedTo === memberId && job.status !== 'done' && job.status !== 'invoiced'
    );
  };

  const getMemberName = (member: any) => {
    if (member.firstName || member.lastName) {
      return `${member.firstName || ''} ${member.lastName || ''}`.trim();
    }
    return member.email?.split('@')[0] || 'Team Member';
  };

  const getMemberInitials = (member: any) => {
    const first = member.firstName?.charAt(0) || '';
    const last = member.lastName?.charAt(0) || '';
    return (first + last).toUpperCase() || member.email?.charAt(0).toUpperCase() || 'T';
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const handleStartJob = async (jobId: string) => {
    setIsUpdating(true);
    try {
      await updateJobStatus(jobId, 'in_progress');
      Alert.alert('Job Started', 'Timer started. You\'re on the clock!');
    } catch (error) {
      Alert.alert('Error', 'Failed to start job');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCompleteJob = async (jobId: string) => {
    setIsUpdating(true);
    try {
      await updateJobStatus(jobId, 'done');
      Alert.alert('Job Complete', 'Nice work! Job marked as done.');
    } catch (error) {
      Alert.alert('Error', 'Failed to complete job');
    } finally {
      setIsUpdating(false);
    }
  };

  const userName = user?.firstName || 'there';
  const jobsToday = stats.jobsToday || todaysJobs.length;
  const overdueCount = stats.overdueJobs || 0;
  const quotesCount = stats.pendingQuotes || 0;
  const monthRevenue = formatCurrency(stats.thisMonthRevenue || 0);
  const outstandingAmount = formatCurrency(stats.outstandingAmount || 0);
  const paidLast30Days = formatCurrency(stats.paidLast30Days || 0);

  // Calculate this week's jobs (next 7 days, excluding today) for staff
  const thisWeeksJobs = useMemo(() => {
    const activeJobs = todaysJobs.filter((job: any) => 
      job.status !== 'done' && job.status !== 'invoiced'
    );
    return activeJobs.filter((job: any) => {
      if (!job.scheduledAt) return false;
      const jobDate = new Date(job.scheduledAt);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const endOfWeek = new Date(today);
      endOfWeek.setDate(endOfWeek.getDate() + 7);
      return jobDate > today && jobDate <= endOfWeek && jobDate.toDateString() !== today.toDateString();
    });
  }, [todaysJobs]);

  const isLoading = jobsLoading || statsLoading;

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl
          refreshing={isLoading}
          onRefresh={refreshData}
          colors={[colors.primary]}
          tintColor={colors.primary}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* iOS-Style Header with Notification Bell */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>{getGreeting()}, {userName}</Text>
            <Text style={styles.headerSubtitle}>
              {todaysJobs.length > 0 
                ? `You have ${todaysJobs.length} job${todaysJobs.length > 1 ? 's' : ''} scheduled today`
                : businessSettings?.businessName || "Welcome back"}
            </Text>
          </View>
          <View style={styles.headerRight}>
            {/* Map and Notifications are now in the global Header component */}
          </View>
        </View>
      </View>
      
      {/* Notifications Panel */}
      <NotificationsPanel
        visible={showNotifications}
        onClose={() => setShowNotifications(false)}
        onNavigateToItem={handleNavigateToItem}
      />

      {/* Trust Banner - Dismissible */}
      <View style={{ marginBottom: spacing.lg }}>
        <TrustBanner />
      </View>

      {/* Time Tracking Widget - Staff Only */}
      {isStaffUser && (
        <View style={styles.section}>
          <TimeTrackingWidget />
        </View>
      )}

      {/* Quick Stats - Different for staff vs owner */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>
          {isStaffUser ? 'My Stats' : 'Quick Stats'}
        </Text>
        <View style={styles.kpiGrid}>
          <KPICard
            title={isStaffUser ? "My Jobs Today" : "Jobs Today"}
            value={jobsToday}
            icon="briefcase"
            iconBg={colors.primaryLight}
            iconColor={colors.primary}
            onPress={() => router.push('/(tabs)/jobs')}
          />
          {isStaffUser ? (
            <>
              <KPICard
                title="Assigned"
                value={todaysJobs.filter(j => j.status === 'scheduled' || j.status === 'pending').length}
                icon="clipboard"
                iconBg={colors.muted}
                iconColor={colors.mutedForeground}
                onPress={() => router.push('/(tabs)/jobs')}
              />
              <KPICard
                title="In Progress"
                value={todaysJobs.filter(j => j.status === 'in_progress').length}
                icon="clock"
                iconBg={colors.warningLight}
                iconColor={colors.warning}
                onPress={() => router.push('/(tabs)/jobs')}
              />
              <KPICard
                title="Completed"
                value={todaysJobs.filter(j => j.status === 'done' || j.status === 'invoiced').length}
                icon="check-circle"
                iconBg={colors.successLight}
                iconColor={colors.success}
                onPress={() => router.push('/(tabs)/jobs')}
              />
            </>
          ) : (
            <>
              <KPICard
                title="Overdue"
                value={overdueCount}
                icon="alert-circle"
                iconBg={overdueCount > 0 ? colors.destructiveLight : colors.muted}
                iconColor={overdueCount > 0 ? colors.destructive : colors.mutedForeground}
                onPress={() => router.push('/more/invoices')}
              />
              {hasActiveTeam ? (
                <KPICard
                  title="Team Members"
                  value={teamMembers.length}
                  icon="users"
                  iconBg={colors.infoLight}
                  iconColor={colors.info}
                  onPress={() => router.push('/more/team-management')}
                />
              ) : (
                <KPICard
                  title="Quotes Pending"
                  value={quotesCount}
                  icon="file-text"
                  iconBg={colors.infoLight}
                  iconColor={colors.info}
                  onPress={() => router.push('/more/quotes')}
                />
              )}
              <KPICard
                title="Revenue"
                value={monthRevenue}
                icon="dollar-sign"
                iconBg={colors.successLight}
                iconColor={colors.success}
                onPress={() => router.push('/more/payment-hub')}
              />
            </>
          )}
        </View>
      </View>

      {/* Job Scheduler - Team Owners Only */}
      {isOwnerUser && hasActiveTeam && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionTitleIcon, { backgroundColor: `${colors.info}15` }]}>
                <Feather name="users" size={iconSizes.md} color={colors.info} />
              </View>
              <Text style={styles.sectionTitle}>Job Scheduler</Text>
            </View>
            <TouchableOpacity 
              style={styles.viewAllButton}
              onPress={() => router.push('/more/team')}
              activeOpacity={0.7}
            >
              <Text style={styles.viewAllText}>Manage Team</Text>
              <Feather name="chevron-right" size={iconSizes.sm} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <Text style={styles.schedulerCaption}>
            Tap a job, then tap a team member to assign
          </Text>

          {/* Selected Job Banner */}
          {selectedJob && (
            <View style={styles.selectionBanner}>
              <View style={styles.selectionBannerContent}>
                {isAssigning ? (
                  <>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={styles.selectionBannerText}>
                      Assigning "{selectedJob.title}"...
                    </Text>
                  </>
                ) : (
                  <>
                    <Feather name="briefcase" size={14} color={colors.primary} />
                    <Text style={styles.selectionBannerText}>
                      Tap a team member to assign "{selectedJob.title}"
                    </Text>
                  </>
                )}
              </View>
              <TouchableOpacity
                style={styles.cancelSelectionButton}
                onPress={() => setSelectedJob(null)}
                disabled={isAssigning}
              >
                <Feather name="x" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          )}

          {/* Unassigned Jobs */}
          {unassignedJobs.length > 0 && (
            <View style={styles.unassignedJobsCard}>
              <View style={styles.unassignedJobsHeader}>
                <View style={styles.unassignedBadge}>
                  <Text style={styles.unassignedBadgeText}>{unassignedJobs.length}</Text>
                </View>
                <Text style={styles.unassignedLabel}>Unassigned Jobs</Text>
              </View>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.unassignedJobsScroll}
              >
                {unassignedJobs.slice(0, 5).map((job: any) => (
                  <TouchableOpacity
                    key={job.id}
                    style={[
                      styles.unassignedJobItem,
                      selectedJob?.id === job.id && styles.unassignedJobItemSelected
                    ]}
                    onPress={() => setSelectedJob(selectedJob?.id === job.id ? null : job)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.unassignedJobTitle} numberOfLines={1}>{job.title}</Text>
                    {job.scheduledAt && (
                      <Text style={styles.unassignedJobMeta}>
                        {new Date(job.scheduledAt).toLocaleDateString('en-AU', { 
                          weekday: 'short', day: 'numeric', month: 'short' 
                        })}
                      </Text>
                    )}
                    {job.clientName && (
                      <Text style={styles.unassignedJobMeta} numberOfLines={1}>{job.clientName}</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Team Members */}
          <View style={styles.teamMembersList}>
            {teamMembers.map((member: any) => {
              const memberJobs = getJobsForMember(member.memberId);
              const isClickable = !!selectedJob && !isAssigning;
              
              return (
                <TouchableOpacity
                  key={member.id}
                  style={[
                    styles.teamMemberCard,
                    isClickable && styles.teamMemberCardClickable
                  ]}
                  onPress={() => {
                    if (isClickable && member.memberId) {
                      handleAssignJob(selectedJob.id, member.memberId);
                    }
                  }}
                  activeOpacity={isClickable ? 0.7 : 1}
                  disabled={!isClickable}
                >
                  <View style={styles.teamMemberHeader}>
                    <View style={styles.teamMemberAvatar}>
                      <Text style={styles.teamMemberAvatarText}>{getMemberInitials(member)}</Text>
                    </View>
                    <View style={styles.teamMemberInfo}>
                      <Text style={styles.teamMemberName}>{getMemberName(member)}</Text>
                      <Text style={styles.teamMemberJobCount}>
                        {memberJobs.length} active job{memberJobs.length !== 1 ? 's' : ''}
                      </Text>
                    </View>
                    {isClickable && (
                      <View style={styles.tapToAssignBadge}>
                        <Text style={styles.tapToAssignText}>Tap to assign</Text>
                      </View>
                    )}
                  </View>
                  {memberJobs.length > 0 && (
                    <View style={styles.memberJobsList}>
                      {memberJobs.slice(0, 2).map((job: any) => (
                        <TouchableOpacity 
                          key={job.id} 
                          style={styles.memberJobItem}
                          onPress={() => handleUnassignJob(job)}
                          activeOpacity={0.7}
                          disabled={isAssigning}
                        >
                          <Text style={styles.memberJobTitle} numberOfLines={1}>{job.title}</Text>
                          <View style={styles.memberJobActions}>
                            <StatusBadge status={job.status} size="small" />
                            <Feather name="x-circle" size={14} color={colors.mutedForeground} style={{ marginLeft: 6 }} />
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Today's Schedule */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <View style={styles.sectionTitleIcon}>
              <Feather name="calendar" size={iconSizes.md} color={colors.primary} />
            </View>
            <Text style={styles.sectionTitle}>Today</Text>
          </View>
          {todaysJobs.length > 0 && (
            <TouchableOpacity 
              style={styles.viewAllButton}
              onPress={() => router.push('/(tabs)/jobs')}
              activeOpacity={0.7}
            >
              <Text style={styles.viewAllText}>View All</Text>
              <Feather name="chevron-right" size={iconSizes.sm} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>

        {todaysJobs.length === 0 ? (
          <EmptyTodayState onCreateJob={() => router.push('/more/create-job')} />
        ) : (
          <View style={styles.jobsList}>
            {todaysJobs.map((job: any, index: number) => (
              <TodayJobCard
                key={job.id}
                job={job}
                clients={clients}
                isFirst={index === 0}
                onPress={() => router.push(`/job/${job.id}`)}
                onStartJob={handleStartJob}
                onCompleteJob={handleCompleteJob}
                isUpdating={isUpdating}
              />
            ))}
          </View>
        )}
      </View>

      {/* This Week Section - Staff Only */}
      {isStaffUser && thisWeeksJobs.length > 0 && (
        <ThisWeekSection 
          jobs={thisWeeksJobs} 
          onViewJob={(id) => router.push(`/job/${id}`)} 
        />
      )}

      {/* Recent Activity */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <View style={styles.sectionTitleIcon}>
              <Feather name="activity" size={iconSizes.md} color={colors.primary} />
            </View>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
          </View>
        </View>
        <ActivityFeed 
          activities={[
            // Generate sample activity from today's jobs for visual consistency
            ...todaysJobs.slice(0, 3).map((job: any) => ({
              id: job.id,
              type: 'job',
              title: `Job: ${job.title}`,
              createdAt: job.scheduledAt || new Date().toISOString()
            }))
          ]} 
        />
      </View>

      {/* Bottom Spacing */}
      <View style={{ height: spacing['4xl'] }} />
    </ScrollView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    paddingHorizontal: pageShell.paddingHorizontal,
    paddingTop: pageShell.paddingTop,
    paddingBottom: pageShell.paddingBottom,
  },

  // Header
  header: {
    marginBottom: spacing.lg,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    ...typography.pageTitle,
    color: colors.foreground,
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerMapButton: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: `${colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Activity Feed - compact
  activityList: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  activityIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    ...typography.body,
    color: colors.foreground,
  },
  activityTime: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  activityEmpty: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadows.sm,
  },
  activityEmptyText: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.sm,
  },

  // Sections - consistent 24px section gaps to match web space-y-6
  section: {
    marginBottom: spacing['3xl'],
  },
  sectionLabel: {
    ...typography.label,
    color: colors.mutedForeground,
    marginBottom: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionTitleIcon: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    backgroundColor: `${colors.primary}10`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
  },
  viewAllText: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
  },

  // KPI Grid - 2-col with 10-12px gap
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  kpiCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  kpiCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  kpiIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.foreground,
  },
  kpiTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.mutedForeground,
  },

  // Quick Actions - matches web Card p-4 (16px)
  quickActionsCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 16,
    ...shadows.sm,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quickActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.secondary,
  },
  quickActionButtonPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  quickActionText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.foreground,
  },
  quickActionTextPrimary: {
    color: colors.primaryForeground,
  },

  // Job Scheduler styles
  schedulerCaption: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginBottom: spacing.md,
  },
  selectionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: `${colors.primary}15`,
    borderWidth: 1,
    borderColor: `${colors.primary}30`,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  selectionBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  selectionBannerText: {
    ...typography.bodySmall,
    fontWeight: '500',
    color: colors.foreground,
    flex: 1,
  },
  cancelSelectionButton: {
    padding: spacing.xs,
  },
  unassignedJobsCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderStyle: 'dashed',
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  unassignedJobsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  unassignedBadge: {
    backgroundColor: colors.muted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  unassignedBadgeText: {
    ...typography.captionSmall,
    fontWeight: '600',
    color: colors.mutedForeground,
  },
  unassignedLabel: {
    ...typography.bodySmall,
    fontWeight: '500',
    color: colors.foreground,
  },
  unassignedJobsScroll: {
    gap: spacing.sm,
  },
  unassignedJobItem: {
    width: 160,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
  },
  unassignedJobItemSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: `${colors.primary}08`,
  },
  unassignedJobTitle: {
    ...typography.bodySmall,
    fontWeight: '500',
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  unassignedJobMeta: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
  },
  teamMembersList: {
    gap: spacing.sm,
  },
  teamMemberCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
  },
  teamMemberCardClickable: {
    borderColor: `${colors.primary}40`,
  },
  teamMemberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  teamMemberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamMemberAvatarText: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.primary,
  },
  teamMemberInfo: {
    flex: 1,
  },
  teamMemberName: {
    ...typography.body,
    fontWeight: '500',
    color: colors.foreground,
  },
  teamMemberJobCount: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
  },
  tapToAssignBadge: {
    backgroundColor: `${colors.primary}15`,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  tapToAssignText: {
    ...typography.captionSmall,
    fontWeight: '500',
    color: colors.primary,
  },
  memberJobsList: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  memberJobItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.muted,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  memberJobTitle: {
    ...typography.captionSmall,
    color: colors.foreground,
    flex: 1,
    marginRight: spacing.sm,
  },
  memberJobActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Job Cards - with left accent bar
  jobsList: {
    gap: 10,
  },
  jobCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: colors.card,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  jobCardAccent: {
    width: 4,
    backgroundColor: colors.primary,
  },
  jobCardContent: {
    flex: 1,
    padding: 16,
  },
  jobCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  jobCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  timeBox: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: `${colors.primary}10`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeBoxText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  jobCardTitleArea: {
    flex: 1,
  },
  jobCardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  timePeriod: {
    ...typography.label,
    color: colors.mutedForeground,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  statusBadgeComplete: {
    backgroundColor: `${colors.success}15`,
    borderColor: `${colors.success}30`,
  },
  statusBadgeProgress: {
    backgroundColor: `${colors.warning}15`,
    borderColor: `${colors.warning}30`,
  },
  statusBadgeScheduled: {
    backgroundColor: colors.background,
    borderColor: colors.border,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.mutedForeground,
  },
  statusBadgeTextComplete: {
    color: colors.success,
  },
  statusBadgeTextProgress: {
    color: colors.warning,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.warning,
  },
  jobCardTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
    marginTop: 2,
  },
  jobCardDetails: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  jobDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  jobDetailText: {
    ...typography.caption,
    color: colors.mutedForeground,
    flex: 1,
  },
  quickContactRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  quickContactButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.muted,
  },
  quickContactButtonFull: {
    flex: 1,
  },
  quickContactText: {
    ...typography.captionSmall,
    fontWeight: '500',
    color: colors.foreground,
  },
  primaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.success,
  },
  completeActionButton: {
    backgroundColor: colors.primary,
  },
  primaryActionButtonText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  outlineActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  outlineActionButtonText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.foreground,
  },

  // Empty State - compact
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['3xl'],
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  emptyStateIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyStateTitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginBottom: spacing.md,
  },
  scheduleJobButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  scheduleJobButtonText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.white,
  },

  // Time Tracking Widget
  timeTrackingWidget: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    ...shadows.sm,
  },
  timeTrackingWidgetActive: {
    borderColor: colors.primary,
  },
  timeTrackingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
  },
  timerIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerIconContainerActive: {
    backgroundColor: `${colors.primary}15`,
  },
  timerTextContent: {
    flex: 1,
  },
  elapsedTime: {
    fontSize: 24,
    fontWeight: '700',
    fontFamily: 'monospace',
    color: colors.primary,
  },
  totalTimeToday: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
  },
  timerSubtext: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  stopTimerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.destructive,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
  stopTimerText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
  },

  // This Week Section
  weekBadge: {
    backgroundColor: colors.muted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  weekBadgeText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.mutedForeground,
  },
  thisWeekCard: {
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  weekJobItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: 'transparent',
  },
  weekJobItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  weekJobContent: {
    flex: 1,
    marginRight: spacing.sm,
  },
  weekJobTitle: {
    ...typography.body,
    fontWeight: '500',
    color: colors.foreground,
  },
  weekJobMeta: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  viewAllWeekButton: {
    padding: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  viewAllWeekText: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
});
