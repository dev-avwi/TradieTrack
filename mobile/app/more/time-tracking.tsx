import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Alert,
  ActivityIndicator
} from 'react-native';
import { Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useJobsStore } from '../../src/lib/store';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius } from '../../src/lib/design-tokens';
import api from '../../src/lib/api';

interface TimeEntry {
  id: string;
  userId: string;
  jobId?: string;
  description?: string;
  startTime: string;
  endTime?: string;
  durationMinutes?: number;
  notes?: string;
}

type TabKey = 'timer' | 'sheet' | 'reports' | 'stats';

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'timer', label: 'Timer', icon: 'clock' },
  { key: 'sheet', label: 'Sheet', icon: 'calendar' },
  { key: 'reports', label: 'Reports', icon: 'file-text' },
  { key: 'stats', label: 'Stats', icon: 'bar-chart-2' },
];

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
  headerLeft: {
    flex: 1,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.foreground,
  },
  pageSubtitle: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  headerButtonText: {
    fontSize: 13,
    color: colors.foreground,
  },
  statsGrid: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statIconContainer: {
    width: 44,
    height: 44,
    borderRadius: radius.xl,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.foreground,
  },
  statTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.mutedForeground,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: 4,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    gap: spacing.xs,
  },
  tabActive: {
    backgroundColor: colors.primaryLight,
  },
  tabText: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: '500',
  },
  timerSection: {
    gap: spacing.xl,
  },
  timerCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  timerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  timerHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  timerDisplay: {
    fontSize: 48,
    fontWeight: '300',
    color: colors.foreground,
    fontVariant: ['tabular-nums'],
    letterSpacing: 2,
  },
  timerStatus: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  timerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: spacing.md + 2,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  timerButtonStart: {
    backgroundColor: colors.primary,
  },
  timerButtonStop: {
    backgroundColor: colors.warning,
  },
  timerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  stopButtonText: {
    fontSize: 14,
    color: colors.destructive,
  },
  timerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  currentTime: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginTop: spacing.lg,
  },
  quickActionsSection: {
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  quickActionText: {
    fontSize: 13,
    color: colors.foreground,
  },
  jobSelectSection: {
    gap: spacing.md,
  },
  jobSelectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  jobSelectCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  jobSelectRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jobSelectRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  jobSelectContent: {
    flex: 1,
  },
  jobSelectTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.foreground,
  },
  jobSelectStatus: {
    fontSize: 13,
    color: colors.mutedForeground,
    textTransform: 'capitalize',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyStateText: {
    fontSize: 14,
    color: colors.mutedForeground,
  },
  placeholderSection: {
    alignItems: 'center',
    paddingVertical: spacing['2xl'] + 16,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  placeholderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
    marginTop: spacing.lg,
  },
  placeholderText: {
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  timesheetSection: {
    gap: spacing.md,
  },
  dateGroupHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  timeEntryCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  timeEntryLeft: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeEntryContent: {
    flex: 1,
    gap: 2,
  },
  timeEntryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
  },
  timeEntryMeta: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  timeEntryDuration: {
    alignItems: 'flex-end',
  },
  timeEntryDurationText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  timeEntryTime: {
    fontSize: 11,
    color: colors.mutedForeground,
  },
  reportsSection: {
    gap: spacing.md,
  },
  reportCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  reportPeriod: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  reportStatsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  reportStat: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.muted,
    borderRadius: radius.md,
  },
  reportStatValue: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.foreground,
  },
  reportStatLabel: {
    fontSize: 11,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  reportExportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  reportExportButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  statsSection: {
    gap: spacing.md,
  },
  statsCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statsCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: spacing.md,
  },
  statsBarContainer: {
    gap: spacing.sm,
  },
  statsBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statsBarLabel: {
    width: 40,
    fontSize: 11,
    color: colors.mutedForeground,
    textAlign: 'right',
  },
  statsBarTrack: {
    flex: 1,
    height: 24,
    backgroundColor: colors.muted,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  statsBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
  },
  statsBarValue: {
    width: 50,
    fontSize: 12,
    fontWeight: '600',
    color: colors.foreground,
    textAlign: 'right',
  },
  insightCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  insightIconContainer: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightContent: {
    flex: 1,
  },
  insightTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.foreground,
  },
  insightText: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 2,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
    marginTop: spacing.md,
  },
  emptyStateText: {
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});

function StatCard({ 
  title, 
  value, 
  icon,
  colors
}: { 
  title: string; 
  value: string | number; 
  icon: React.ReactNode;
  colors: ThemeColors;
}) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  return (
    <View style={styles.statCard}>
      <View style={styles.statIconContainer}>
        {icon}
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
    </View>
  );
}

export default function TimeTrackingScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { jobs, fetchJobs, isLoading } = useJobsStore();
  const [activeTab, setActiveTab] = useState<TabKey>('timer');
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [activeTimeEntry, setActiveTimeEntry] = useState<TimeEntry | null>(null);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerStartRef = useRef<Date | null>(null);

  const fetchTimeEntries = useCallback(async () => {
    try {
      const response = await api.get<TimeEntry[]>('/api/time-entries');
      if (response.data) {
        setTimeEntries(response.data);
      }
    } catch (error) {
      console.error('[TimeTracking] Failed to fetch time entries:', error);
    }
  }, []);

  const checkActiveTimer = useCallback(async () => {
    try {
      const response = await api.get<TimeEntry | null>('/api/time-entries/active');
      if (response.data) {
        setActiveTimeEntry(response.data);
        setSelectedJob(response.data.jobId || null);
        setIsTimerRunning(true);
        timerStartRef.current = new Date(response.data.startTime);
        const elapsed = Math.floor((Date.now() - new Date(response.data.startTime).getTime()) / 1000);
        setTimerSeconds(elapsed);
      }
    } catch (error) {
      console.error('[TimeTracking] Failed to check active timer:', error);
    }
  }, []);

  const refreshData = useCallback(async () => {
    await Promise.all([fetchJobs(), fetchTimeEntries(), checkActiveTimer()]);
  }, [fetchJobs, fetchTimeEntries, checkActiveTimer]);

  useEffect(() => {
    refreshData();
  }, []);

  useEffect(() => {
    if (isTimerRunning) {
      timerRef.current = setInterval(() => {
        setTimerSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isTimerRunning]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatCurrentTime = () => {
    const now = new Date();
    return now.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
  };

  const handleStartTimer = async () => {
    if (!selectedJob) {
      Alert.alert('Select a Job', 'Please select a job to track time for.');
      return;
    }
    
    setIsSaving(true);
    try {
      const response = await api.post<TimeEntry>('/api/time-entries', {
        jobId: selectedJob,
        startTime: new Date().toISOString(),
        description: `Time tracked for job`
      });
      
      if (response.error) {
        Alert.alert('Error', response.error);
        return;
      }
      
      if (response.data) {
        setActiveTimeEntry(response.data);
        timerStartRef.current = new Date();
        setTimerSeconds(0);
        setIsTimerRunning(true);
      }
    } catch (error) {
      console.error('[TimeTracking] Failed to start timer:', error);
      Alert.alert('Error', 'Failed to start timer. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePauseTimer = () => {
    setIsTimerRunning(false);
  };

  const handleStopTimer = () => {
    if (timerSeconds > 0 || activeTimeEntry) {
      Alert.alert(
        'Stop Timer',
        `Save ${formatTime(timerSeconds)} of time?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Save', 
            onPress: async () => {
              if (!activeTimeEntry) {
                setIsTimerRunning(false);
                setTimerSeconds(0);
                return;
              }
              
              setIsSaving(true);
              try {
                const response = await api.patch<TimeEntry>(`/api/time-entries/${activeTimeEntry.id}`, {
                  endTime: new Date().toISOString(),
                  durationMinutes: Math.ceil(timerSeconds / 60)
                });
                
                if (response.error) {
                  Alert.alert('Error', response.error);
                  return;
                }
                
                setIsTimerRunning(false);
                setTimerSeconds(0);
                setActiveTimeEntry(null);
                timerStartRef.current = null;
                await fetchTimeEntries();
                Alert.alert('Saved', 'Time entry saved successfully!');
              } catch (error) {
                console.error('[TimeTracking] Failed to save time entry:', error);
                Alert.alert('Error', 'Failed to save time entry. Please try again.');
              } finally {
                setIsSaving(false);
              }
            }
          },
        ]
      );
    } else {
      setIsTimerRunning(false);
    }
  };

  const handleDiscardTimer = () => {
    if (!activeTimeEntry) return;
    
    Alert.alert(
      'Discard Timer',
      'Are you sure you want to discard this time entry?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Discard', 
          style: 'destructive',
          onPress: async () => {
            setIsSaving(true);
            try {
              await api.delete(`/api/time-entries/${activeTimeEntry.id}`);
              setIsTimerRunning(false);
              setTimerSeconds(0);
              setActiveTimeEntry(null);
              timerStartRef.current = null;
            } catch (error) {
              console.error('[TimeTracking] Failed to discard time entry:', error);
              Alert.alert('Error', 'Failed to discard time entry.');
            } finally {
              setIsSaving(false);
            }
          }
        },
      ]
    );
  };

  const activeJobs = jobs.filter(j => j.status === 'in_progress').length;
  
  // Calculate actual stats from time entries
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  
  const todayEntries = timeEntries.filter(e => {
    const entryDate = new Date(e.startTime);
    return entryDate >= today;
  });
  const weekEntries = timeEntries.filter(e => {
    const entryDate = new Date(e.startTime);
    return entryDate >= weekStart;
  });
  
  const calculateHours = (entries: TimeEntry[]) => {
    return entries.reduce((sum, e) => {
      if (e.durationMinutes) {
        return sum + (e.durationMinutes / 60);
      }
      if (e.startTime && e.endTime) {
        const diff = new Date(e.endTime).getTime() - new Date(e.startTime).getTime();
        return sum + (diff / 1000 / 60 / 60);
      }
      return sum;
    }, 0);
  };
  
  const todayHours = calculateHours(todayEntries);
  const weekHours = calculateHours(weekEntries);
  const avgRate = 0; // Would need hourly rate data

  const inProgressJobs = jobs.filter(j => j.status === 'in_progress' || j.status === 'scheduled');

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={refreshData}
              tintColor={colors.primary}
            />
          }
        >
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.pageTitle}>Time Tracking</Text>
              <Text style={styles.pageSubtitle}>Track your work hours and manage timesheets</Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.headerButton} onPress={refreshData} activeOpacity={0.7}>
                <Feather name="refresh-cw" size={18} color={colors.foreground} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerButton} activeOpacity={0.7}>
                <Feather name="filter" size={18} color={colors.foreground} />
                <Text style={styles.headerButtonText}>Filter</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statsRow}>
              <StatCard
                title="TODAY"
                value={`${todayHours.toFixed(1)}h`}
                icon={<Feather name="clock" size={22} color={colors.primary} />}
                colors={colors}
              />
              <StatCard
                title="THIS WEEK"
                value={`${weekHours.toFixed(1)}h`}
                icon={<Feather name="calendar" size={22} color={colors.primary} />}
                colors={colors}
              />
            </View>
            <View style={styles.statsRow}>
              <StatCard
                title="ACTIVE JOBS"
                value={activeJobs}
                icon={<Feather name="users" size={22} color={colors.primary} />}
                colors={colors}
              />
              <StatCard
                title="AVG RATE"
                value={`$${avgRate}/hr`}
                icon={<Feather name="dollar-sign" size={22} color={colors.primary} />}
                colors={colors}
              />
            </View>
          </View>

          <View style={styles.tabContainer}>
            {TABS.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.tab, isActive && styles.tabActive]}
                  onPress={() => setActiveTab(tab.key)}
                  activeOpacity={0.7}
                >
                  <Feather 
                    name={tab.icon as any}
                    size={18} 
                    color={isActive ? colors.primary : colors.mutedForeground} 
                  />
                  <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {activeTab === 'timer' && (
            <View style={styles.timerSection}>
              <View style={styles.timerCard}>
                <View style={styles.timerHeader}>
                  <Feather name="clock" size={20} color={colors.foreground} />
                  <Text style={styles.timerHeaderText}>Time Tracker</Text>
                </View>
                
                <Text style={styles.timerDisplay}>{formatTime(timerSeconds)}</Text>
                <Text style={styles.timerStatus}>
                  {isTimerRunning ? 'Timer running...' : 'Ready to start tracking time'}
                </Text>

                <TouchableOpacity
                  style={[
                    styles.timerButton,
                    isTimerRunning ? styles.timerButtonStop : styles.timerButtonStart,
                    isSaving && { opacity: 0.7 }
                  ]}
                  onPress={isTimerRunning ? handlePauseTimer : handleStartTimer}
                  activeOpacity={0.7}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <ActivityIndicator size="small" color={colors.primaryForeground} />
                      <Text style={styles.timerButtonText}>Saving...</Text>
                    </>
                  ) : isTimerRunning ? (
                    <>
                      <Feather name="pause" size={20} color={colors.primaryForeground} />
                      <Text style={styles.timerButtonText}>Pause Timer</Text>
                    </>
                  ) : (
                    <>
                      <Feather name="play" size={20} color={colors.primaryForeground} />
                      <Text style={styles.timerButtonText}>Start Timer</Text>
                    </>
                  )}
                </TouchableOpacity>

                {(timerSeconds > 0 || activeTimeEntry) && (
                  <View style={styles.timerActionsRow}>
                    <TouchableOpacity
                      style={styles.stopButton}
                      onPress={handleStopTimer}
                      activeOpacity={0.7}
                      disabled={isSaving}
                    >
                      <Feather name="check-circle" size={16} color={colors.success} />
                      <Text style={[styles.stopButtonText, { color: colors.success }]}>Save Time</Text>
                    </TouchableOpacity>
                    
                    {activeTimeEntry && (
                      <TouchableOpacity
                        style={styles.stopButton}
                        onPress={handleDiscardTimer}
                        activeOpacity={0.7}
                        disabled={isSaving}
                      >
                        <Feather name="trash-2" size={16} color={colors.destructive} />
                        <Text style={styles.stopButtonText}>Discard</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                <Text style={styles.currentTime}>{formatCurrentTime()}</Text>
              </View>

              <View style={styles.quickActionsSection}>
                <Text style={styles.sectionTitle}>Quick Actions</Text>
                <View style={styles.quickActionsGrid}>
                  <TouchableOpacity style={styles.quickActionCard} activeOpacity={0.7}>
                    <Feather name="calendar" size={20} color={colors.primary} />
                    <Text style={styles.quickActionText}>Add Entry</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.quickActionCard} activeOpacity={0.7}>
                    <Feather name="file-text" size={20} color={colors.primary} />
                    <Text style={styles.quickActionText}>View Sheet</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.jobSelectSection}>
                <Text style={styles.sectionTitle}>Select Job</Text>
                {inProgressJobs.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>No active jobs to track time for</Text>
                  </View>
                ) : (
                  inProgressJobs.slice(0, 5).map(job => (
                    <TouchableOpacity
                      key={job.id}
                      style={[
                        styles.jobSelectCard,
                        selectedJob === job.id && styles.jobSelectCardActive
                      ]}
                      onPress={() => setSelectedJob(job.id)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.jobSelectRadio}>
                        {selectedJob === job.id && <View style={styles.jobSelectRadioInner} />}
                      </View>
                      <View style={styles.jobSelectContent}>
                        <Text style={styles.jobSelectTitle}>{job.title}</Text>
                        <Text style={styles.jobSelectStatus}>{job.status.replace('_', ' ')}</Text>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            </View>
          )}

          {activeTab === 'sheet' && (
            <View style={styles.timesheetSection}>
              {timeEntries.length === 0 ? (
                <View style={styles.emptyStateContainer}>
                  <Feather name="clock" size={48} color={colors.mutedForeground} />
                  <Text style={styles.emptyStateTitle}>No Time Entries Yet</Text>
                  <Text style={styles.emptyStateText}>Start tracking time using the Timer tab</Text>
                </View>
              ) : (
                <>
                  {/* Group entries by date */}
                  {(() => {
                    const groupedEntries: { [key: string]: TimeEntry[] } = {};
                    timeEntries.forEach(entry => {
                      const date = new Date(entry.startTime).toLocaleDateString('en-AU', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'short'
                      });
                      if (!groupedEntries[date]) {
                        groupedEntries[date] = [];
                      }
                      groupedEntries[date].push(entry);
                    });
                    
                    return Object.entries(groupedEntries)
                      .sort(([a], [b]) => {
                        const dateA = timeEntries.find(e => 
                          new Date(e.startTime).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' }) === a
                        );
                        const dateB = timeEntries.find(e => 
                          new Date(e.startTime).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' }) === b
                        );
                        return new Date(dateB?.startTime || 0).getTime() - new Date(dateA?.startTime || 0).getTime();
                      })
                      .map(([date, entries]) => (
                        <View key={date}>
                          <Text style={styles.dateGroupHeader}>{date}</Text>
                          {entries.map(entry => {
                            const job = entry.jobId ? jobs.find(j => String(j.id) === String(entry.jobId)) : null;
                            const duration = entry.durationMinutes || 0;
                            const hours = Math.floor(duration / 60);
                            const mins = duration % 60;
                            const startTime = new Date(entry.startTime).toLocaleTimeString('en-AU', {
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true
                            });
                            const endTime = entry.endTime ? new Date(entry.endTime).toLocaleTimeString('en-AU', {
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true
                            }) : 'ongoing';
                            
                            return (
                              <TouchableOpacity key={entry.id} style={styles.timeEntryCard} activeOpacity={0.7}>
                                <View style={styles.timeEntryLeft}>
                                  <Feather name="briefcase" size={20} color={colors.primary} />
                                </View>
                                <View style={styles.timeEntryContent}>
                                  <Text style={styles.timeEntryTitle} numberOfLines={1}>
                                    {job?.title || entry.description || 'Time Entry'}
                                  </Text>
                                  <Text style={styles.timeEntryMeta}>
                                    {startTime} - {endTime}
                                  </Text>
                                </View>
                                <View style={styles.timeEntryDuration}>
                                  <Text style={styles.timeEntryDurationText}>
                                    {hours > 0 ? `${hours}h ` : ''}{mins}m
                                  </Text>
                                  <Text style={styles.timeEntryTime}>{entry.endTime ? 'completed' : 'running'}</Text>
                                </View>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      ));
                  })()}
                </>
              )}
            </View>
          )}

          {activeTab === 'reports' && (
            <View style={styles.reportsSection}>
              <View style={styles.reportCard}>
                <View style={styles.reportHeader}>
                  <Text style={styles.reportTitle}>Weekly Summary</Text>
                  <Text style={styles.reportPeriod}>{weekStart.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} - Today</Text>
                </View>
                
                <View style={styles.reportStatsRow}>
                  <View style={styles.reportStat}>
                    <Text style={styles.reportStatValue}>{weekHours.toFixed(1)}</Text>
                    <Text style={styles.reportStatLabel}>HOURS</Text>
                  </View>
                  <View style={styles.reportStat}>
                    <Text style={styles.reportStatValue}>{weekEntries.length}</Text>
                    <Text style={styles.reportStatLabel}>ENTRIES</Text>
                  </View>
                  <View style={styles.reportStat}>
                    <Text style={styles.reportStatValue}>{weekEntries.length > 0 ? (weekHours / Math.max(weekEntries.length, 1)).toFixed(1) : '0'}</Text>
                    <Text style={styles.reportStatLabel}>AVG/ENTRY</Text>
                  </View>
                </View>

                <TouchableOpacity 
                  style={styles.reportExportButton} 
                  activeOpacity={0.7}
                  onPress={() => Alert.alert('Export', 'Time report will be exported to CSV. This feature requires the full app build.')}
                >
                  <Feather name="download" size={18} color={colors.primaryForeground} />
                  <Text style={styles.reportExportButtonText}>Export Report</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.reportCard}>
                <View style={styles.reportHeader}>
                  <Text style={styles.reportTitle}>Monthly Summary</Text>
                  <Text style={styles.reportPeriod}>{new Date().toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}</Text>
                </View>
                
                <View style={styles.reportStatsRow}>
                  <View style={styles.reportStat}>
                    <Text style={styles.reportStatValue}>{calculateHours(timeEntries).toFixed(1)}</Text>
                    <Text style={styles.reportStatLabel}>TOTAL HOURS</Text>
                  </View>
                  <View style={styles.reportStat}>
                    <Text style={styles.reportStatValue}>{timeEntries.length}</Text>
                    <Text style={styles.reportStatLabel}>TOTAL ENTRIES</Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {activeTab === 'stats' && (
            <View style={styles.statsSection}>
              <View style={styles.statsCard}>
                <Text style={styles.statsCardTitle}>Hours by Day (This Week)</Text>
                <View style={styles.statsBarContainer}>
                  {(() => {
                    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                    const dayHours: number[] = [0, 0, 0, 0, 0, 0, 0];
                    
                    weekEntries.forEach(entry => {
                      const day = new Date(entry.startTime).getDay();
                      const duration = entry.durationMinutes || 0;
                      dayHours[day] += duration / 60;
                    });
                    
                    const maxHours = Math.max(...dayHours, 8);
                    
                    return days.map((day, i) => (
                      <View key={day} style={styles.statsBarRow}>
                        <Text style={styles.statsBarLabel}>{day}</Text>
                        <View style={styles.statsBarTrack}>
                          <View style={[styles.statsBarFill, { width: `${(dayHours[i] / maxHours) * 100}%` }]} />
                        </View>
                        <Text style={styles.statsBarValue}>{dayHours[i].toFixed(1)}h</Text>
                      </View>
                    ));
                  })()}
                </View>
              </View>

              <View style={styles.statsCard}>
                <Text style={styles.statsCardTitle}>Productivity Insights</Text>
                
                <View style={styles.insightCard}>
                  <View style={styles.insightIconContainer}>
                    <Feather name="trending-up" size={20} color={colors.primaryForeground} />
                  </View>
                  <View style={styles.insightContent}>
                    <Text style={styles.insightTitle}>
                      {todayHours >= 6 ? 'Great Progress Today!' : todayHours >= 3 ? 'Good Work!' : 'Keep Going!'}
                    </Text>
                    <Text style={styles.insightText}>
                      You've logged {todayHours.toFixed(1)} hours today
                    </Text>
                  </View>
                </View>

                <View style={styles.insightCard}>
                  <View style={styles.insightIconContainer}>
                    <Feather name="clock" size={20} color={colors.primaryForeground} />
                  </View>
                  <View style={styles.insightContent}>
                    <Text style={styles.insightTitle}>Weekly Average</Text>
                    <Text style={styles.insightText}>
                      {(weekHours / 7).toFixed(1)} hours per day this week
                    </Text>
                  </View>
                </View>

                <View style={styles.insightCard}>
                  <View style={styles.insightIconContainer}>
                    <Feather name="briefcase" size={20} color={colors.primaryForeground} />
                  </View>
                  <View style={styles.insightContent}>
                    <Text style={styles.insightTitle}>Most Active Jobs</Text>
                    <Text style={styles.insightText}>
                      {activeJobs} active job{activeJobs !== 1 ? 's' : ''} being tracked
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </>
  );
}
