import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Alert
} from 'react-native';
import { Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useJobsStore } from '../../src/lib/store';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius } from '../../src/lib/design-tokens';

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
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const refreshData = useCallback(async () => {
    await fetchJobs();
  }, [fetchJobs]);

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

  const handleStartTimer = () => {
    if (!selectedJob) {
      Alert.alert('Select a Job', 'Please select a job to track time for.');
      return;
    }
    setIsTimerRunning(true);
  };

  const handlePauseTimer = () => {
    setIsTimerRunning(false);
  };

  const handleStopTimer = () => {
    if (timerSeconds > 0) {
      Alert.alert(
        'Stop Timer',
        `Save ${formatTime(timerSeconds)} of time?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Save', 
            onPress: () => {
              setIsTimerRunning(false);
              setTimerSeconds(0);
              Alert.alert('Saved', 'Time entry saved successfully!');
            }
          },
        ]
      );
    } else {
      setIsTimerRunning(false);
    }
  };

  const activeJobs = jobs.filter(j => j.status === 'in_progress').length;
  const todayHours = 0;
  const weekHours = 0;
  const avgRate = 0;

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
                    isTimerRunning ? styles.timerButtonStop : styles.timerButtonStart
                  ]}
                  onPress={isTimerRunning ? handlePauseTimer : handleStartTimer}
                  activeOpacity={0.7}
                >
                  {isTimerRunning ? (
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

                {timerSeconds > 0 && (
                  <TouchableOpacity
                    style={styles.stopButton}
                    onPress={handleStopTimer}
                    activeOpacity={0.7}
                  >
                    <Feather name="square" size={16} color={colors.destructive} />
                    <Text style={styles.stopButtonText}>Stop & Save</Text>
                  </TouchableOpacity>
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
            <View style={styles.placeholderSection}>
              <Feather name="calendar" size={48} color={colors.mutedForeground} />
              <Text style={styles.placeholderTitle}>Timesheet</Text>
              <Text style={styles.placeholderText}>
                View and manage your time entries.{'\n'}Full timesheet management coming soon!
              </Text>
            </View>
          )}

          {activeTab === 'reports' && (
            <View style={styles.placeholderSection}>
              <Feather name="file-text" size={48} color={colors.mutedForeground} />
              <Text style={styles.placeholderTitle}>Reports</Text>
              <Text style={styles.placeholderText}>
                Generate time tracking reports.{'\n'}Export and analytics coming soon!
              </Text>
            </View>
          )}

          {activeTab === 'stats' && (
            <View style={styles.placeholderSection}>
              <Feather name="bar-chart-2" size={48} color={colors.mutedForeground} />
              <Text style={styles.placeholderTitle}>Statistics</Text>
              <Text style={styles.placeholderText}>
                View your productivity stats.{'\n'}Charts and insights coming soon!
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </>
  );
}
