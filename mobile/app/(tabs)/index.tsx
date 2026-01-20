import { useEffect, useCallback, useState, useMemo, useRef } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  Linking,
  ActivityIndicator,
  Alert,
  Platform,
  AppState,
  AppStateStatus
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useAuthStore, useJobsStore, useDashboardStore, useClientsStore, useTimeTrackingStore } from '../../src/lib/store';
import offlineStorage, { useOfflineStore } from '../../src/lib/offline-storage';
import { api } from '../../src/lib/api';
import { StatusBadge } from '../../src/components/ui/StatusBadge';
import { XeroBadge } from '../../src/components/ui/XeroBadge';
import { useTheme, ThemeColors, colorWithOpacity } from '../../src/lib/theme';
import { spacing, radius, shadows, typography, iconSizes, sizes, pageShell } from '../../src/lib/design-tokens';
import { NotificationBell, NotificationsPanel } from '../../src/components/NotificationsPanel';
import { TrustBanner } from '../../src/components/ui/TrustBanner';
import { useScrollToTop } from '../../src/contexts/ScrollContext';

// Activity Feed Component - matches web Recent Activity section
function ActivityFeed({ 
  activities, 
  onActivityPress,
  isLoading 
}: { 
  activities: any[]; 
  onActivityPress?: (activity: any) => void;
  isLoading?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const getActivityIcon = (type: string): keyof typeof Feather.glyphMap => {
    switch (type) {
      case 'job_created':
      case 'job_status_change':
      case 'job_scheduled':
      case 'job_started':
      case 'job_completed':
      case 'job':
        return 'briefcase';
      case 'quote_created':
      case 'quote_sent':
      case 'quote':
        return 'file-text';
      case 'invoice_created':
      case 'invoice_sent':
      case 'invoice':
        return 'dollar-sign';
      case 'invoice_paid':
      case 'payment_received':
      case 'payment':
        return 'credit-card';
      case 'client':
        return 'user';
      default:
        return 'activity';
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'job_created':
      case 'job_scheduled':
      case 'job':
        return colors.primary;
      case 'job_started':
      case 'job_status_change':
        return colors.warning;
      case 'job_completed':
        return colors.success;
      case 'quote_created':
      case 'quote_sent':
      case 'quote':
        return colors.info;
      case 'invoice_created':
      case 'invoice_sent':
      case 'invoice':
        return colors.warning;
      case 'invoice_paid':
      case 'payment_received':
      case 'payment':
        return colors.success;
      case 'client':
        return colors.mutedForeground;
      default:
        return colors.mutedForeground;
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
  
  if (isLoading) {
    return (
      <View style={[styles.activityEmpty, { paddingVertical: spacing.xl }]}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

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
      {activities.slice(0, 5).map((activity, index) => {
        const isClickable = activity.navigationPath || activity.entityId;
        
        return (
          <TouchableOpacity 
            key={activity.id || index} 
            style={styles.activityItem}
            onPress={() => isClickable && onActivityPress?.(activity)}
            activeOpacity={isClickable ? 0.7 : 1}
            disabled={!isClickable}
          >
            <View style={[styles.activityIcon, { backgroundColor: `${getActivityColor(activity.type)}12` }]}>
              <Feather 
                name={getActivityIcon(activity.type)} 
                size={iconSizes.md} 
                color={getActivityColor(activity.type)} 
              />
            </View>
            <View style={styles.activityContent}>
              <Text style={styles.activityTitle} numberOfLines={1}>{activity.title}</Text>
              <Text style={styles.activityDescription} numberOfLines={1}>{activity.description}</Text>
              <Text style={styles.activityTime}>{formatTimeAgo(activity.timestamp || activity.createdAt)}</Text>
            </View>
            {isClickable && (
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// Time Tracking Widget - Enhanced with job info and manual controls
// Uses global useTimeTrackingStore for unified state with Time Tracking page
function TimeTrackingWidget() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  // Use global store for activeTimer - synced with Time Tracking page
  const { 
    activeTimer, 
    fetchActiveTimer, 
    startTimer: storeStartTimer, 
    stopTimer: storeStopTimer 
  } = useTimeTrackingStore();
  
  // Local state only for UI concerns
  const [elapsedTime, setElapsedTime] = useState('00:00:00');
  const [totalMinutesToday, setTotalMinutesToday] = useState(0);
  const [todayEntries, setTodayEntries] = useState<any[]>([]);
  const [todaysJobs, setTodaysJobs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStopping, setIsStopping] = useState(false);
  const [isPausing, setIsPausing] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isStartingTimer, setIsStartingTimer] = useState<string | null>(null);
  const appStateRef = useRef(AppState.currentState);

  // Fetch active timer when screen gains focus - keeps dashboard and time tracking page in sync
  useFocusEffect(
    useCallback(() => {
      fetchActiveTimer();
      loadDashboardData();
      loadTodaysJobs();
    }, [])
  );

  useEffect(() => {
    loadDashboardData();
    loadTodaysJobs();
    // Refresh dashboard data every 15 seconds
    const interval = setInterval(loadDashboardData, 15000);
    
    // Auto-refresh when app comes to foreground
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        // App has come to the foreground - refresh data
        fetchActiveTimer();
        loadDashboardData();
        loadTodaysJobs();
      }
      appStateRef.current = nextAppState;
    });
    
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, []);

  const loadTodaysJobs = async () => {
    try {
      const { default: api } = await import('../../src/lib/api');
      const response = await api.get('/api/jobs/today');
      if (response.data) {
        // Filter to scheduled and in_progress jobs only
        const activeJobs = (response.data as any[]).filter(
          (job: any) => job.status === 'scheduled' || job.status === 'in_progress' || job.status === 'pending'
        );
        setTodaysJobs(activeJobs);
      }
    } catch (error) {
      console.log('Error loading todays jobs for timer:', error);
      setTodaysJobs([]);
    }
  };

  const handleStartTimerForJob = async (job: any) => {
    setIsStartingTimer(job.id);
    try {
      const { isOnline } = useOfflineStore.getState();
      
      if (!isOnline) {
        Alert.alert('Offline', 'Cannot start timer while offline');
        setIsStartingTimer(null);
        return;
      }
      
      // Use the store's startTimer - it will update activeTimer globally
      // Pass job.title as description so it shows in the timer widget
      const success = await storeStartTimer(job.id, job.title);
      
      if (success) {
        Alert.alert('Timer Started', `Tracking time for "${job.title}"`);
        loadDashboardData();
      } else {
        Alert.alert('Error', 'Failed to start timer');
      }
    } catch (error: any) {
      Alert.alert('Error', 'Failed to start timer');
    } finally {
      setIsStartingTimer(null);
    }
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (activeTimer && !activeTimer.isPaused) {
      timer = setInterval(() => {
        const startTime = new Date(activeTimer.startTime).getTime();
        const pausedDuration = activeTimer.pausedDuration || 0;
        const elapsed = Date.now() - startTime - (pausedDuration * 60000);
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

  // Load dashboard data (today's entries and stats) - activeTimer comes from the store
  const loadDashboardData = async () => {
    try {
      const { default: api } = await import('../../src/lib/api');
      const dashboardResponse = await api.get('/api/time-tracking/dashboard');
      
      if (dashboardResponse.data) {
        const entries = (dashboardResponse.data as any).recentEntries || [];
        // Store completed entries for display
        const completedEntries = entries.filter((e: any) => e.endTime);
        setTodayEntries(completedEntries.slice(0, 5)); // Show last 5 entries
        
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
      console.log('Error loading dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePauseResume = async () => {
    if (!activeTimer) return;
    setIsPausing(true);
    try {
      const { isOnline } = useOfflineStore.getState();
      
      if (!isOnline) {
        Alert.alert('Offline', 'Cannot pause/resume timer while offline');
        setIsPausing(false);
        return;
      }
      
      const { default: api } = await import('../../src/lib/api');
      const endpoint = activeTimer.isPaused 
        ? `/api/time-entries/${activeTimer.id}/resume`
        : `/api/time-entries/${activeTimer.id}/pause`;
      
      await api.post(endpoint, {});
      
      // Refresh from store to get updated state
      fetchActiveTimer();
    } catch (error: any) {
      Alert.alert('Error', `Failed to ${activeTimer.isPaused ? 'resume' : 'pause'} timer`);
    } finally {
      setIsPausing(false);
    }
  };

  const handleCancelTimer = async () => {
    if (!activeTimer) return;
    
    Alert.alert(
      'Cancel Timer',
      'Are you sure you want to cancel this timer? Time will not be saved.',
      [
        { text: 'Keep Tracking', style: 'cancel' },
        { 
          text: 'Cancel Timer', 
          style: 'destructive',
          onPress: async () => {
            setIsCancelling(true);
            try {
              const { isOnline } = useOfflineStore.getState();
              
              if (!isOnline) {
                Alert.alert('Offline', 'Cannot cancel timer while offline');
                setIsCancelling(false);
                return;
              }
              
              const { default: api } = await import('../../src/lib/api');
              await api.delete(`/api/time-entries/${activeTimer.id}`);
              
              // Refresh from store to clear activeTimer
              fetchActiveTimer();
              Alert.alert('Timer Cancelled', 'Time was not recorded');
              loadDashboardData();
            } catch (error: any) {
              Alert.alert('Error', 'Failed to cancel timer');
            } finally {
              setIsCancelling(false);
            }
          }
        }
      ]
    );
  };

  const handleStopTimer = async () => {
    if (!activeTimer) return;
    setIsStopping(true);
    try {
      const { isOnline } = useOfflineStore.getState();
      
      if (!isOnline) {
        await offlineStorage.stopTimeEntryOffline(activeTimer.id);
        // Refresh from store to update state
        fetchActiveTimer();
        Alert.alert('Saved Offline', 'Time entry will sync when online');
        loadDashboardData();
        return;
      }
      
      // Use the store's stopTimer - it will update activeTimer globally
      const success = await storeStopTimer();
      
      if (success) {
        Alert.alert('Timer Stopped', 'Time has been recorded');
        loadDashboardData();
      } else {
        Alert.alert('Error', 'Failed to stop timer');
      }
    } catch (error: any) {
      if (error.message?.includes('Network')) {
        await offlineStorage.stopTimeEntryOffline(activeTimer.id);
        fetchActiveTimer();
        Alert.alert('Saved Offline', 'Changes will sync when connection restored');
        loadDashboardData();
      } else {
        Alert.alert('Error', 'Failed to stop timer');
      }
    } finally {
      setIsStopping(false);
    }
  };

  const handleViewJob = () => {
    if (activeTimer?.jobId) {
      router.push(`/job/${activeTimer.jobId}`);
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
  const isPaused = activeTimer?.isPaused;

  // Helper to format duration for entries
  const formatEntryDuration = (entry: any) => {
    let mins = 0;
    if (entry.duration) {
      mins = entry.duration;
    } else if (entry.endTime) {
      const start = new Date(entry.startTime).getTime();
      const end = new Date(entry.endTime).getTime();
      mins = Math.floor((end - start) / 60000);
    }
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  // Today's entries list component - shows active timer first if running
  const renderTodayEntries = () => {
    // Show section if there's an active timer or completed entries
    if (!activeTimer && todayEntries.length === 0) return null;
    
    return (
      <View style={styles.todayEntriesContainer}>
        <Text style={styles.todayEntriesTitle}>Today's Work</Text>
        
        {/* Show active timer at the top with tracking indicator */}
        {activeTimer && (
          <TouchableOpacity
            style={styles.todayEntryRow}
            onPress={() => activeTimer.jobId && router.push(`/job/${activeTimer.jobId}`)}
            disabled={!activeTimer.jobId}
            activeOpacity={0.7}
          >
            <View style={[styles.todayEntryDot, { backgroundColor: colors.success }]} />
            <Text style={[styles.todayEntryJobTitle, { color: colors.success }]} numberOfLines={1}>
              {activeTimer.description || activeTimer.jobTitle || 'General time'}
            </Text>
            <Text style={[styles.todayEntryDuration, { color: colors.success }]}>tracking</Text>
          </TouchableOpacity>
        )}
        
        {/* Show completed entries */}
        {todayEntries.map((entry, index) => (
          <TouchableOpacity
            key={entry.id || index}
            style={styles.todayEntryRow}
            onPress={() => entry.jobId && router.push(`/job/${entry.jobId}`)}
            disabled={!entry.jobId}
            activeOpacity={0.7}
          >
            <View style={styles.todayEntryDot} />
            <Text style={styles.todayEntryJobTitle} numberOfLines={1}>
              {entry.description || entry.jobTitle || 'General time'}
            </Text>
            <Text style={styles.todayEntryDuration}>{formatEntryDuration(entry)}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  // Jobs available to start a timer for (not already being tracked)
  const availableJobs = todaysJobs.filter((job: any) => !activeTimer || activeTimer.jobId !== job.id);

  if (!activeTimer) {
    return (
      <View style={styles.timerWidgetContainer}>
        <View style={styles.timeTrackingWidget}>
          <View style={styles.timeTrackingContent}>
            <View style={styles.timerIconContainer}>
              <Feather name="clock" size={24} color={colors.mutedForeground} />
            </View>
            <View style={styles.timerTextContent}>
              <Text style={styles.totalTimeToday}>{hours}h {mins}m today</Text>
              <Text style={styles.timerSubtext}>No active timer</Text>
            </View>
          </View>
        </View>
        
        {/* Job list to start timer */}
        {availableJobs.length > 0 && (
          <View style={styles.timerJobListContainer}>
            <Text style={styles.timerJobListLabel}>Start Timer</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.timerJobListScroll}
            >
              {availableJobs.map((job: any) => (
                <TouchableOpacity
                  key={job.id}
                  style={styles.timerJobItem}
                  onPress={() => handleStartTimerForJob(job)}
                  disabled={isStartingTimer !== null}
                  activeOpacity={0.8}
                  data-testid={`button-start-timer-${job.id}`}
                >
                  {isStartingTimer === job.id ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <>
                      <View style={styles.timerJobItemHeader}>
                        <View style={[
                          styles.timerJobStatusDot, 
                          { backgroundColor: job.status === 'in_progress' ? colors.warning : colors.info }
                        ]} />
                        <Text style={styles.timerJobItemTitle} numberOfLines={1}>{job.title}</Text>
                      </View>
                      {job.clientName && (
                        <Text style={styles.timerJobItemMeta} numberOfLines={1}>{job.clientName}</Text>
                      )}
                      <View style={styles.timerJobItemAction}>
                        <Feather name="play-circle" size={14} color={colors.primary} />
                        <Text style={styles.timerJobItemActionText}>Start</Text>
                      </View>
                    </>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
        
        {renderTodayEntries()}
      </View>
    );
  }

  return (
    <View style={[styles.timerActiveContainer]}>
      <View style={[styles.timeTrackingWidget, styles.timeTrackingWidgetActive]}>
        <View style={styles.timeTrackingContent}>
          <View style={[styles.timerIconContainer, styles.timerIconContainerActive, isPaused && styles.timerIconContainerPaused]}>
            {isPaused ? (
              <Feather name="pause" size={24} color={colors.warning} />
            ) : (
              <View style={styles.pulsingDot} />
            )}
          </View>
          <View style={styles.timerTextContent}>
            <View style={styles.timerTimeRow}>
              <Text style={[styles.elapsedTime, isPaused && styles.elapsedTimePaused]}>{elapsedTime}</Text>
              {isPaused && (
                <View style={styles.pausedBadge}>
                  <Text style={styles.pausedBadgeText}>PAUSED</Text>
                </View>
              )}
            </View>
            <TouchableOpacity 
              onPress={handleViewJob}
              disabled={!activeTimer.jobId}
              activeOpacity={0.7}
            >
              <Text style={[styles.timerJobTitle, activeTimer.jobId && styles.timerJobTitleLink]} numberOfLines={1}>
                {activeTimer.description || activeTimer.jobTitle || 'General time'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      
      <View style={styles.timerControlsRow}>
        <TouchableOpacity
          style={[styles.timerControlButton, styles.pauseResumeButton, isPaused && styles.resumeButton]}
          onPress={handlePauseResume}
          disabled={isPausing}
          activeOpacity={0.8}
          data-testid="button-pause-resume-timer"
        >
          {isPausing ? (
            <ActivityIndicator size="small" color={isPaused ? colors.white : colors.foreground} />
          ) : (
            <>
              <Feather 
                name={isPaused ? 'play' : 'pause'} 
                size={16} 
                color={isPaused ? colors.white : colors.foreground} 
              />
              <Text style={[styles.timerControlText, isPaused && styles.resumeButtonText]}>
                {isPaused ? 'Resume' : 'Pause'}
              </Text>
            </>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.timerControlButton, styles.stopButton]}
          onPress={handleStopTimer}
          disabled={isStopping}
          activeOpacity={0.8}
          data-testid="button-stop-timer"
        >
          {isStopping ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <>
              <Feather name="check-circle" size={16} color={colors.white} />
              <Text style={styles.stopButtonText}>Save</Text>
            </>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.timerControlButton, styles.cancelButton]}
          onPress={handleCancelTimer}
          disabled={isCancelling}
          activeOpacity={0.8}
          data-testid="button-cancel-timer"
        >
          {isCancelling ? (
            <ActivityIndicator size="small" color={colors.destructive} />
          ) : (
            <Feather name="x" size={18} color={colors.destructive} />
          )}
        </TouchableOpacity>
      </View>
      {renderTodayEntries()}
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

// KPI Stat Card Component - matches web feed-card styling
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
      activeOpacity={0.95}
    >
      <View style={styles.kpiCardContent}>
        <View style={[styles.kpiIconContainer, { backgroundColor: iconBg }]}>
          <Feather name={icon} size={20} color={iconColor} />
        </View>
        <View style={styles.kpiTextContainer}>
          <Text style={styles.kpiValue}>{value}</Text>
          <Text style={styles.kpiTitle}>{title}</Text>
        </View>
      </View>
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
  onOnMyWay,
  isUpdating,
  onGetDirections,
  orderNumber
}: { 
  job: any;
  clients: any[];
  isFirst: boolean;
  onPress: () => void;
  onStartJob: (id: string) => void;
  onCompleteJob: (id: string) => void;
  onOnMyWay: (id: string, clientId?: string) => void;
  isUpdating: boolean;
  onGetDirections?: (job: any) => void;
  orderNumber?: number;
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
    if (job.latitude && job.longitude) {
      const { openMapsWithPreference } = require('../../src/lib/maps-store');
      openMapsWithPreference(job.latitude, job.longitude, job.address);
    } else if (job.address) {
      const { openMapsWithAddress } = require('../../src/lib/maps-store');
      openMapsWithAddress(job.address);
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
    if (job.status === 'scheduled') {
      return (
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity 
            style={[styles.secondaryActionButton, { backgroundColor: colors.info }]}
            onPress={() => onOnMyWay(job.id, job.clientId)}
            disabled={isUpdating}
            activeOpacity={0.8}
          >
            <Feather name="navigation" size={iconSizes.sm} color={colors.white} />
            <Text style={styles.secondaryActionButtonText}>On My Way</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.primaryActionButton}
            onPress={() => onStartJob(job.id)}
            disabled={isUpdating}
            activeOpacity={0.8}
          >
            <Feather name="play" size={iconSizes.sm} color={colors.white} />
            <Text style={styles.primaryActionButtonText}>Start Job</Text>
          </TouchableOpacity>
        </View>
      );
    } else if (job.status === 'pending') {
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
      style={[styles.jobCard, job.isXeroImport && { overflow: 'visible' }]}
    >
      {job.isXeroImport && <XeroBadge size="sm" />}
      {/* Left Accent Bar */}
      <View style={[styles.jobCardAccent, { backgroundColor: getAccentColor() }]} />
      
      {/* Card Content */}
      <View style={styles.jobCardContent}>
        {/* Job Header */}
        <View style={styles.jobCardHeader}>
          <View style={styles.jobCardHeaderLeft}>
            {orderNumber ? (
              <View style={styles.orderBadge}>
                <Text style={styles.orderBadgeText}>{orderNumber}</Text>
              </View>
            ) : (
              <View style={styles.timeBox}>
                <Text style={styles.timeBoxText}>{time.hour}</Text>
              </View>
            )}
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
                  data-testid={`button-call-${job.id}`}
                >
                  <Feather name="phone" size={iconSizes.md} color={colors.foreground} />
                  <Text style={styles.quickContactText}>Call</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.quickContactButton}
                  onPress={handleSMS}
                  activeOpacity={0.7}
                  data-testid={`button-sms-${job.id}`}
                >
                  <Feather name="message-square" size={iconSizes.md} color={colors.foreground} />
                  <Text style={styles.quickContactText}>SMS</Text>
                </TouchableOpacity>
              </>
            )}
            {job.address && (
              <TouchableOpacity 
                style={[styles.quickContactButton, styles.directionsButton]}
                onPress={() => onGetDirections?.(job)}
                activeOpacity={0.7}
                data-testid={`button-directions-${job.id}`}
              >
                <Feather name="navigation" size={iconSizes.md} color={colors.primary} />
                <Text style={[styles.quickContactText, { color: colors.primary }]}>Directions</Text>
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
  const scrollRef = useRef<ScrollView | null>(null);
  const { scrollToTopTrigger } = useScrollToTop();
  
  useEffect(() => {
    if (scrollToTopTrigger > 0) {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }
  }, [scrollToTopTrigger]);
  
  const { user, businessSettings, roleInfo, isOwner, isStaff, teamState, fetchTeamState, hasActiveTeam: storeHasActiveTeam } = useAuthStore();
  const { todaysJobs, fetchTodaysJobs, fetchJobs, isLoading: jobsLoading, updateJobStatus } = useJobsStore();
  const { stats, fetchStats, isLoading: statsLoading } = useDashboardStore();
  const { clients, fetchClients } = useClientsStore();
  const [isUpdating, setIsUpdating] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  
  // Job Scheduler state for team owners
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [isTeamDataLoading, setIsTeamDataLoading] = useState(true);
  const [unassignedJobs, setUnassignedJobs] = useState<any[]>([]);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [allJobs, setAllJobs] = useState<any[]>([]);
  const [myAllJobs, setMyAllJobs] = useState<any[]>([]); // All jobs assigned to staff (for My Stats)
  const [schedulerY, setSchedulerY] = useState(0);
  
  // Scroll to job scheduler section
  const scrollToScheduler = useCallback(() => {
    if (schedulerY > 0) {
      scrollRef.current?.scrollTo({ y: schedulerY - 20, animated: true });
    }
  }, [schedulerY]);
  
  // Route optimization state
  const [optimizedJobs, setOptimizedJobs] = useState<any[]>([]);
  const [isRouteOptimized, setIsRouteOptimized] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  
  // Activity feed state
  const [activities, setActivities] = useState<any[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  
  const fetchActivities = useCallback(async () => {
    setActivitiesLoading(true);
    try {
      const { default: api } = await import('../../src/lib/api');
      const response = await api.get('/api/activity/recent/5');
      if (response.data) {
        setActivities(response.data);
      }
    } catch (error) {
      console.log('Error fetching activities:', error);
      setActivities([]);
    } finally {
      setActivitiesLoading(false);
    }
  }, []);

  // Haversine formula to calculate distance between two coordinates in km
  const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Jobs with valid coordinates for route optimization
  const jobsWithCoords = useMemo(() => {
    return todaysJobs.filter((job: any) => 
      job.latitude && job.longitude && job.address
    );
  }, [todaysJobs]);

  // Nearest-neighbor route optimization
  const optimizeRoute = async () => {
    if (jobsWithCoords.length < 2) {
      Alert.alert('Not Enough Jobs', 'You need at least 2 jobs with addresses to optimize the route.');
      return;
    }

    setIsOptimizing(true);
    
    try {
      // Get current location as starting point
      const { status } = await Location.requestForegroundPermissionsAsync();
      let startLat: number, startLon: number;
      
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        startLat = location.coords.latitude;
        startLon = location.coords.longitude;
        setUserLocation({ latitude: startLat, longitude: startLon });
      } else {
        // Use first job as starting point
        startLat = jobsWithCoords[0].latitude;
        startLon = jobsWithCoords[0].longitude;
      }

      // Nearest-neighbor algorithm
      const unvisited = [...jobsWithCoords];
      const route: any[] = [];
      let currentLat = startLat;
      let currentLon = startLon;

      while (unvisited.length > 0) {
        let nearestIndex = 0;
        let nearestDistance = Infinity;

        for (let i = 0; i < unvisited.length; i++) {
          const dist = haversineDistance(
            currentLat, currentLon,
            unvisited[i].latitude, unvisited[i].longitude
          );
          if (dist < nearestDistance) {
            nearestDistance = dist;
            nearestIndex = i;
          }
        }

        const nearest = unvisited.splice(nearestIndex, 1)[0];
        route.push(nearest);
        currentLat = nearest.latitude;
        currentLon = nearest.longitude;
      }

      // Add jobs without coordinates at the end (maintain original order)
      const jobsWithoutCoords = todaysJobs.filter((job: any) => !job.latitude || !job.longitude);
      setOptimizedJobs([...route, ...jobsWithoutCoords]);
      setIsRouteOptimized(true);
      Alert.alert('Route Optimized', `Your ${route.length} jobs have been reordered for the most efficient route.`);
    } catch (error) {
      console.log('Error optimizing route:', error);
      Alert.alert('Error', 'Failed to optimize route. Please try again.');
    } finally {
      setIsOptimizing(false);
    }
  };

  // Reset to original order
  const resetRouteOrder = () => {
    setOptimizedJobs([]);
    setIsRouteOptimized(false);
  };

  // Open directions to a single job
  const openDirections = (job: any) => {
    if (!job.latitude || !job.longitude) {
      if (job.address) {
        const { openMapsWithAddress } = require('../../src/lib/maps-store');
        openMapsWithAddress(job.address);
      } else {
        Alert.alert('No Address', 'This job has no address to navigate to.');
      }
      return;
    }

    const { openMapsWithPreference } = require('../../src/lib/maps-store');
    openMapsWithPreference(job.latitude, job.longitude, job.address);
  };

  // Start multi-stop route
  const startRoute = () => {
    const jobs = isRouteOptimized ? optimizedJobs : todaysJobs;
    const validJobs = jobs.filter((job: any) => job.latitude && job.longitude);
    
    if (validJobs.length === 0) {
      Alert.alert('No Valid Jobs', 'No jobs with valid coordinates to create a route.');
      return;
    }

    // Build Google Maps multi-stop URL
    let waypoints: string[] = [];
    
    // Start with user location if available
    if (userLocation) {
      waypoints.push(`${userLocation.latitude},${userLocation.longitude}`);
    }
    
    // Add all job coordinates
    validJobs.forEach((job: any) => {
      waypoints.push(`${job.latitude},${job.longitude}`);
    });

    if (waypoints.length < 2) {
      openDirections(validJobs[0]);
      return;
    }

    const routeUrl = `https://www.google.com/maps/dir/${waypoints.join('/')}`;
    Linking.openURL(routeUrl);
  };

  // Get display jobs (optimized or original)
  const displayJobs = isRouteOptimized ? optimizedJobs : todaysJobs;
  
  // Determine if user is staff (team member with limited permissions)
  const isStaffUser = isStaff();
  const isOwnerUser = isOwner();
  // Match web's canViewMap logic: only owners and managers can see the map
  const isManager = roleInfo?.roleName?.toLowerCase() === 'manager';
  const canViewMap = isOwnerUser || isManager;
  // Use store's hasActiveTeam OR local teamMembers for the check (store may be ready before local fetch)
  const hasActiveTeam = storeHasActiveTeam() || teamMembers.length > 0 || teamState.hasActiveTeam;
  
  
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

  // Fetch all assigned jobs for staff users (for My Stats)
  const fetchMyAllJobs = useCallback(async () => {
    if (!isStaffUser) return;
    try {
      const { default: api } = await import('../../src/lib/api');
      const response = await api.get('/api/jobs/my-jobs');
      if (response.data) {
        setMyAllJobs(response.data);
      }
    } catch (error) {
      console.log('Error fetching my jobs:', error);
    }
  }, [isStaffUser]);

  // Use refs to maintain stable function references and prevent re-render loops
  const fetchTodaysJobsRef = useRef(fetchTodaysJobs);
  const fetchStatsRef = useRef(fetchStats);
  const fetchClientsRef = useRef(fetchClients);
  const fetchActivitiesRef = useRef(fetchActivities);
  const fetchTeamStateRef = useRef(fetchTeamState);
  const fetchMyAllJobsRef = useRef(fetchMyAllJobs);
  
  // Keep refs updated
  fetchTodaysJobsRef.current = fetchTodaysJobs;
  fetchStatsRef.current = fetchStats;
  fetchClientsRef.current = fetchClients;
  fetchActivitiesRef.current = fetchActivities;
  fetchTeamStateRef.current = fetchTeamState;
  fetchMyAllJobsRef.current = fetchMyAllJobs;

  const refreshData = useCallback(async () => {
    await Promise.all([
      fetchTodaysJobsRef.current(),
      fetchStatsRef.current(),
      fetchClientsRef.current(),
      fetchActivitiesRef.current(),
      fetchMyAllJobsRef.current(), // Also refresh staff's all jobs for My Stats
    ]);
  }, []); // Empty deps - uses refs

  // Initial load only once on mount
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      refreshData();
    }
  }, [refreshData]);

  // Refresh data when screen gains focus (syncs with web app)
  useFocusEffect(
    useCallback(() => {
      refreshData();
    }, []) // Empty dependency - refreshData uses refs internally
  );

  // Fetch team data for job scheduler (owners only)
  const fetchTeamData = useCallback(async () => {
    if (!isOwnerUser) {
      setIsTeamDataLoading(false);
      return;
    }
    setIsTeamDataLoading(true);
    try {
      const { default: api } = await import('../../src/lib/api');
      const [teamRes, jobsRes, unassignedRes] = await Promise.all([
        api.get('/api/team/members'),
        api.get('/api/jobs'),
        api.get('/api/jobs?unassigned=true'),
        fetchTeamStateRef.current(), // Use ref for stable reference
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
    } finally {
      setIsTeamDataLoading(false);
    }
  }, [isOwnerUser]); // Only depends on isOwnerUser

  // Fetch team data once on mount and when owner status changes
  const teamDataFetchedRef = useRef(false);
  useEffect(() => {
    if (!teamDataFetchedRef.current || isOwnerUser) {
      teamDataFetchedRef.current = true;
      fetchTeamData();
    }
  }, [isOwnerUser]);

  const handleAssignJob = async (jobId: string, userId: string) => {
    setIsAssigning(true);
    try {
      const { isOnline } = useOfflineStore.getState();
      
      if (!isOnline) {
        await offlineStorage.updateJobOffline(jobId, { assignedTo: userId });
        Alert.alert('Saved Offline', 'Assignment will sync when online');
        setSelectedJob(null);
        await Promise.all([
          fetchTeamData(),
          fetchTodaysJobs(),
          fetchJobs(),
        ]);
        return;
      }
      
      const { default: api } = await import('../../src/lib/api');
      await api.post(`/api/jobs/${jobId}/assign`, { assignedTo: userId });
      Alert.alert('Success', 'Job assigned successfully');
      setSelectedJob(null);
      // Refresh all job data across screens for proper sync
      await Promise.all([
        fetchTeamData(),
        fetchTodaysJobs(),
        fetchJobs(), // Sync with Jobs tab
      ]);
    } catch (error: any) {
      if (error.message?.includes('Network')) {
        await offlineStorage.updateJobOffline(jobId, { assignedTo: userId });
        Alert.alert('Saved Offline', 'Changes will sync when connection restored');
        setSelectedJob(null);
        await Promise.all([
          fetchTeamData(),
          fetchTodaysJobs(),
          fetchJobs(),
        ]);
      } else {
        Alert.alert('Error', 'Failed to assign job');
      }
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
              const { isOnline } = useOfflineStore.getState();
              
              if (!isOnline) {
                await offlineStorage.updateJobOffline(job.id, { assignedTo: undefined });
                Alert.alert('Saved Offline', 'Unassignment will sync when online');
                await Promise.all([
                  fetchTeamData(),
                  fetchTodaysJobs(),
                  fetchJobs(),
                ]);
                return;
              }
              
              const { default: api } = await import('../../src/lib/api');
              await api.post(`/api/jobs/${job.id}/assign`, { assignedTo: null });
              Alert.alert('Success', 'Job unassigned');
              await Promise.all([
                fetchTeamData(),
                fetchTodaysJobs(),
                fetchJobs(),
              ]);
            } catch (error: any) {
              if (error.message?.includes('Network')) {
                await offlineStorage.updateJobOffline(job.id, { assignedTo: undefined });
                Alert.alert('Saved Offline', 'Changes will sync when connection restored');
                await Promise.all([
                  fetchTeamData(),
                  fetchTodaysJobs(),
                  fetchJobs(),
                ]);
              } else {
                Alert.alert('Error', 'Failed to unassign job');
              }
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
    Alert.alert(
      'Start Job?',
      'This will mark the job as in progress and start the time tracker.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start Job',
          onPress: async () => {
            setIsUpdating(true);
            try {
              await updateJobStatus(jobId, 'in_progress');
              router.push(`/job/${jobId}`);
            } catch (error) {
              Alert.alert('Error', 'Failed to start job');
            } finally {
              setIsUpdating(false);
            }
          }
        }
      ]
    );
  };

  const handleOnMyWay = async (jobId: string, clientId?: string) => {
    Alert.alert(
      'On My Way?',
      'Notify the client that you\'re heading to the job site?',
      [
        { text: 'Just View Job', onPress: () => router.push(`/job/${jobId}`) },
        {
          text: 'Send & View Job',
          onPress: async () => {
            setIsUpdating(true);
            try {
              const { isOnline } = useOfflineStore.getState();
              
              if (!isOnline) {
                if (clientId) {
                  // Queue the on-my-way notification as a special action type
                  // Don't update status to invalid 'en_route' - just queue the notification
                  await offlineStorage.queueOnMyWayNotification(jobId);
                  Alert.alert('Saved Offline', 'On my way notification will be sent when online');
                }
                router.push(`/job/${jobId}`);
                return;
              }
              
              if (clientId) {
                const response = await api.post(`/api/jobs/${jobId}/on-my-way`);
                if (response.demoMode) {
                  Alert.alert(
                    'SMS Not Configured',
                    'Twilio SMS is not set up. The "On My Way" action was logged but no message was sent to the client.\n\nSet up Twilio in Settings > Integrations to enable real SMS notifications.',
                    [{ text: 'OK' }]
                  );
                } else {
                  Alert.alert('Sent!', 'Client has been notified via SMS.');
                }
              }
              router.push(`/job/${jobId}`);
            } catch (error: any) {
              if (error.message?.includes('Network') && clientId) {
                // Queue the notification for later sync instead of invalid status update
                await offlineStorage.queueOnMyWayNotification(jobId);
                Alert.alert('Saved Offline', 'Notification will be sent when connection restored');
              }
              router.push(`/job/${jobId}`);
            } finally {
              setIsUpdating(false);
            }
          }
        }
      ]
    );
  };

  const handleCompleteJob = async (jobId: string) => {
    // Show confirmation then navigate to job for final review
    Alert.alert(
      'Complete Job?',
      'This will mark the job as done. You can add final notes or photos before completing.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Review & Complete',
          onPress: async () => {
            setIsUpdating(true);
            try {
              await updateJobStatus(jobId, 'done');
              // Navigate to job detail page for final review
              router.push(`/job/${jobId}`);
            } catch (error) {
              Alert.alert('Error', 'Failed to complete job');
            } finally {
              setIsUpdating(false);
            }
          }
        }
      ]
    );
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
  <>
    <ScrollView 
      ref={scrollRef}
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Text style={styles.headerTitle}>{getGreeting()}, {userName}</Text>
              <View style={[styles.roleBadge, { backgroundColor: colorWithOpacity(colors.primary, 0.1) }]}>
                <Text style={[styles.roleBadgeText, { color: colors.primary }]}>
                  {isOwner() ? 'Owner' : roleInfo?.roleName || 'Team'}
                </Text>
              </View>
            </View>
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
      <TrustBanner />

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
                value={myAllJobs.filter(j => j.status === 'scheduled' || j.status === 'pending').length}
                icon="clipboard"
                iconBg={colors.muted}
                iconColor={colors.mutedForeground}
                onPress={() => router.push('/(tabs)/jobs')}
              />
              <KPICard
                title="In Progress"
                value={myAllJobs.filter(j => j.status === 'in_progress').length}
                icon="clock"
                iconBg={colors.warningLight}
                iconColor={colors.warning}
                onPress={() => router.push('/(tabs)/jobs')}
              />
              <KPICard
                title="Completed"
                value={myAllJobs.filter(j => j.status === 'done' || j.status === 'invoiced').length}
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
                onPress={() => router.push('/more/documents?tab=invoices&filter=overdue')}
              />
              {hasActiveTeam ? (
                <KPICard
                  title="Team Members"
                  value={teamMembers.length}
                  icon="users"
                  iconBg={colors.infoLight}
                  iconColor={colors.info}
                  onPress={() => router.push('/more/team-operations')}
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
                onPress={() => router.push('/more/money-hub')}
              />
            </>
          )}
        </View>
      </View>

      {/* Job Scheduler - Team Owners Only (show loading state or content) */}
      {isOwnerUser && (hasActiveTeam || isTeamDataLoading) && (
        <View 
          style={styles.section}
          onLayout={(event) => setSchedulerY(event.nativeEvent.layout.y)}
        >
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionTitleIcon, { backgroundColor: `${colors.info}15` }]}>
                <Feather name="users" size={iconSizes.md} color={colors.info} />
              </View>
              <Text style={styles.sectionTitle}>Job Scheduler</Text>
            </View>
            <TouchableOpacity 
              style={styles.viewAllButton}
              onPress={() => router.push('/more/team-operations')}
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
                    <Feather name="briefcase" size={iconSizes.md} color={colors.primary} />
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
                            <Feather name="x-circle" size={iconSizes.md} color={colors.mutedForeground} style={{ marginLeft: 6 }} />
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
            {isRouteOptimized && (
              <View style={styles.optimizedBadge}>
                <Feather name="check" size={12} color={colors.success} />
                <Text style={styles.optimizedBadgeText}>Optimized</Text>
              </View>
            )}
          </View>
          <View style={styles.headerActions}>
            {jobsWithCoords.length >= 2 && (
              <TouchableOpacity 
                style={[
                  styles.optimizeButton,
                  isRouteOptimized && styles.optimizeButtonActive
                ]}
                onPress={isRouteOptimized ? resetRouteOrder : optimizeRoute}
                activeOpacity={0.7}
                disabled={isOptimizing}
                data-testid="button-optimize-route"
              >
                {isOptimizing ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <Feather 
                      name={isRouteOptimized ? "x" : "navigation"} 
                      size={iconSizes.sm} 
                      color={isRouteOptimized ? colors.mutedForeground : colors.primary} 
                    />
                    <Text style={[
                      styles.optimizeButtonText,
                      isRouteOptimized && styles.optimizeButtonTextActive
                    ]}>
                      {isRouteOptimized ? 'Reset' : 'Optimize'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
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
        </View>

        {/* Start Route Button - shown when jobs exist */}
        {jobsWithCoords.length >= 1 && (
          <TouchableOpacity 
            style={styles.startRouteButton}
            onPress={startRoute}
            activeOpacity={0.8}
            data-testid="button-start-route"
          >
            <View style={styles.startRouteIcon}>
              <Feather name="map" size={18} color={colors.white} />
            </View>
            <Text style={styles.startRouteText}>
              Start Route ({jobsWithCoords.length} stop{jobsWithCoords.length !== 1 ? 's' : ''})
            </Text>
            <Feather name="chevron-right" size={18} color={colors.white} />
          </TouchableOpacity>
        )}

        {todaysJobs.length === 0 ? (
          <EmptyTodayState onCreateJob={() => router.push('/more/create-job')} />
        ) : (
          <View style={styles.jobsList}>
            {displayJobs.map((job: any, index: number) => (
              <TodayJobCard
                key={job.id}
                job={job}
                clients={clients}
                isFirst={index === 0}
                onPress={() => router.push(`/job/${job.id}`)}
                onStartJob={handleStartJob}
                onCompleteJob={handleCompleteJob}
                onOnMyWay={handleOnMyWay}
                isUpdating={isUpdating}
                onGetDirections={openDirections}
                orderNumber={isRouteOptimized ? index + 1 : undefined}
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
          activities={activities}
          isLoading={activitiesLoading}
          onActivityPress={(activity) => {
            if (activity.entityType && activity.entityId) {
              handleNavigateToItem(activity.entityType, activity.entityId);
            }
          }}
        />
      </View>

      {/* Bottom Spacing */}
      <View style={{ height: spacing['4xl'] + 80 }} />
    </ScrollView>
  </>
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
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
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
  roleBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.md,
  },
  roleBadgeText: {
    ...typography.captionSmall,
    fontWeight: '600',
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
  activityDescription: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
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
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  sectionTitleIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.md,
    backgroundColor: `${colors.primary}12`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    ...typography.subtitle,
    color: colors.foreground,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    minHeight: 44,
  },
  viewAllText: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
  },

  // KPI Grid - matches web grid-cols-2 gap-3
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  kpiCard: {
    flex: 1,
    minWidth: '46%',
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  kpiCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  kpiIconContainer: {
    width: 44,
    height: 44,
    borderRadius: radius.xl,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiTextContainer: {
    flex: 1,
  },
  kpiValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.foreground,
    letterSpacing: -0.5,
  },
  kpiTitle: {
    ...typography.label,
    color: colors.mutedForeground,
    marginTop: 2,
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
    gap: spacing.md,
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
    padding: spacing.lg,
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
    gap: spacing.sm,
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
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.muted,
    minHeight: 44,
  },
  quickContactButtonFull: {
    flex: 1,
  },
  quickContactText: {
    ...typography.captionSmall,
    fontWeight: '500',
    color: colors.foreground,
  },
  directionsButton: {
    borderColor: `${colors.primary}30`,
    backgroundColor: `${colors.primary}10`,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  optimizeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: `${colors.primary}10`,
    borderWidth: 1,
    borderColor: `${colors.primary}30`,
  },
  optimizeButtonActive: {
    backgroundColor: colors.muted,
    borderColor: colors.cardBorder,
  },
  optimizeButtonText: {
    ...typography.captionSmall,
    fontWeight: '600',
    color: colors.primary,
  },
  optimizeButtonTextActive: {
    color: colors.mutedForeground,
  },
  optimizedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: `${colors.success}15`,
  },
  optimizedBadgeText: {
    ...typography.captionSmall,
    fontWeight: '500',
    color: colors.success,
  },
  startRouteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    marginBottom: spacing.md,
    minHeight: 48,
  },
  startRouteIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  startRouteText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.white,
    flex: 1,
  },
  orderBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderBadgeText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  primaryActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.success,
    minHeight: 44,
  },
  secondaryActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.info,
    minHeight: 44,
  },
  secondaryActionButtonText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.primaryForeground,
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
    minHeight: 44,
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
    minHeight: 44,
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
    backgroundColor: `${colors.primary}05`,
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
  timerIconContainerPaused: {
    backgroundColor: `${colors.warning}15`,
  },
  timerTextContent: {
    flex: 1,
  },
  timerTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  elapsedTime: {
    fontSize: 24,
    fontWeight: '700',
    fontFamily: 'monospace',
    color: colors.primary,
  },
  elapsedTimePaused: {
    color: colors.warning,
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
  timerJobTitle: {
    ...typography.body,
    fontWeight: '500',
    color: colors.foreground,
    marginTop: 2,
  },
  timerJobTitleLink: {
    color: colors.primary,
  },
  pausedBadge: {
    backgroundColor: `${colors.warning}20`,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  pausedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.warning,
    letterSpacing: 0.5,
  },
  pulsingDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  timerWidgetContainer: {
    gap: spacing.sm,
  },
  timerActiveContainer: {
    gap: spacing.sm,
  },
  timerJobListContainer: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    ...shadows.sm,
  },
  timerJobListLabel: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timerJobListScroll: {
    gap: spacing.sm,
    paddingRight: spacing.sm,
  },
  timerJobItem: {
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    padding: spacing.md,
    minWidth: 140,
    maxWidth: 180,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timerJobItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  timerJobStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  timerJobItemTitle: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.foreground,
    flex: 1,
  },
  timerJobItemMeta: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
  },
  timerJobItemAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  timerJobItemActionText: {
    ...typography.captionSmall,
    fontWeight: '600',
    color: colors.primary,
  },
  todayEntriesContainer: {
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    padding: spacing.sm,
  },
  todayEntriesTitle: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.mutedForeground,
    marginBottom: spacing.xs,
    marginLeft: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  todayEntryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  todayEntryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
    marginRight: spacing.sm,
  },
  todayEntryJobTitle: {
    ...typography.caption,
    flex: 1,
    color: colors.foreground,
  },
  todayEntryDuration: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.mutedForeground,
  },
  timerControlsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  timerControlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    minHeight: 44,
  },
  timerControlText: {
    ...typography.button,
    color: colors.foreground,
  },
  pauseResumeButton: {
    flex: 1,
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  resumeButton: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  resumeButtonText: {
    color: colors.white,
  },
  stopButton: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  stopButtonText: {
    ...typography.button,
    color: colors.white,
  },
  cancelButton: {
    backgroundColor: `${colors.destructive}10`,
    borderWidth: 1,
    borderColor: `${colors.destructive}30`,
    paddingHorizontal: spacing.md,
  },
  stopTimerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.destructive,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    minHeight: 44,
  },
  stopTimerText: {
    ...typography.button,
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
    ...typography.label,
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
    minHeight: 44,
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
    minHeight: 44,
  },
  viewAllWeekText: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
});
