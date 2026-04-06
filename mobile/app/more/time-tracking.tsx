import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
  Platform,
  Share,
  FlatList,
  ActivityIndicator
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Stack, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useJobsStore, useTimeTrackingStore } from '../../src/lib/store';
import api from '../../src/lib/api';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, shadows, typography, pageShell, iconSizes, sizes } from '../../src/lib/design-tokens';

type TabKey = 'timer' | 'sheet' | 'stats';

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'timer', label: 'Timer', icon: 'clock' },
  { key: 'sheet', label: 'Sheet', icon: 'calendar' },
  { key: 'stats', label: 'Stats', icon: 'bar-chart-2' },
];

interface TimeEntry {
  id: string;
  jobId: string;
  userId: string;
  startTime: string;
  endTime: string | null;
  duration: number | null;
  description: string | null;
  isBreak?: boolean;
  isBillable?: boolean;
  category?: string;
  createdAt?: string;
  isDisputed?: boolean;
  disputeReason?: string | null;
  disputedAt?: string | null;
  disputeResolvedAt?: string | null;
  disputeResolution?: string | null;
}

interface WeeklyStats {
  day: string;
  dayLabel: string;
  hours: number;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: pageShell.paddingHorizontal,
    paddingTop: pageShell.paddingTop,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  headerLeft: {
    flex: 1,
  },
  pageTitle: {
    ...typography.largeTitle,
    color: colors.foreground,
  },
  pageSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
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
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: spacing.xs,
  },
  headerButtonText: {
    ...typography.caption,
    color: colors.foreground,
    fontWeight: '500',
  },
  statsGrid: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.foreground,
    letterSpacing: -0.5,
  },
  statTitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
    fontSize: 11,
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.xs,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.xl,
    gap: spacing.xs,
  },
  tabActive: {
    backgroundColor: colors.primary + '15',
  },
  tabText: {
    ...typography.caption,
    color: colors.mutedForeground,
    fontWeight: '500',
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  timerSection: {
    gap: spacing.md,
  },
  timerCard: {
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  timerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  timerHeaderText: {
    ...typography.cardTitle,
    color: colors.foreground,
  },
  timerDisplay: {
    fontSize: 52,
    fontWeight: '200',
    color: colors.foreground,
    fontVariant: ['tabular-nums'],
    letterSpacing: 2,
  },
  timerStatus: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  timerJobName: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  timerButtonsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
  },
  timerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.xl,
    gap: spacing.sm,
  },
  timerButtonStart: {
    backgroundColor: colors.primary,
  },
  timerButtonStop: {
    backgroundColor: '#ef4444',
  },
  timerButtonPause: {
    backgroundColor: '#f59e0b',
  },
  timerButtonResume: {
    backgroundColor: '#22c55e',
  },
  timerButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  breakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#f59e0b18',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    marginTop: spacing.sm,
  },
  breakBadgeText: {
    ...typography.badge,
    color: '#f59e0b',
    fontWeight: '600',
  },
  currentTime: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.md,
  },
  quickActionsSection: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.mutedForeground,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: spacing.sm,
    ...shadows.sm,
  },
  quickActionText: {
    ...typography.caption,
    color: colors.foreground,
    fontWeight: '500',
  },
  jobSelectSection: {
    gap: spacing.sm,
  },
  jobSelectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: spacing.md,
    ...shadows.sm,
  },
  jobSelectCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '08',
  },
  jobSelectRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jobSelectRadioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  jobSelectContent: {
    flex: 1,
  },
  jobSelectTitle: {
    ...typography.body,
    fontWeight: '500',
    color: colors.foreground,
  },
  jobSelectStatus: {
    ...typography.caption,
    color: colors.mutedForeground,
    textTransform: 'capitalize',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  emptyStateIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
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
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 20,
  },
  sheetDateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sheetDateText: {
    ...typography.cardTitle,
    color: colors.foreground,
  },
  sheetDateNav: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  sheetDateButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryCard: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: spacing.md,
    ...shadows.sm,
  },
  entryTimeline: {
    alignItems: 'center',
    width: 48,
  },
  entryTimelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  entryTimelineLine: {
    width: 2,
    flex: 1,
    marginTop: 4,
  },
  entryContent: {
    flex: 1,
  },
  entryJobName: {
    ...typography.body,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 2,
  },
  entryDescription: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginBottom: spacing.xs,
  },
  entryTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  entryTimeText: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  entryDuration: {
    ...typography.badge,
    color: colors.primary,
    fontWeight: '700',
  },
  entryBillableBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  entryBillableText: {
    fontSize: 10,
    fontWeight: '600',
  },
  entryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dayTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primary + '10',
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  dayTotalLabel: {
    ...typography.body,
    fontWeight: '600',
    color: colors.foreground,
  },
  dayTotalValue: {
    ...typography.body,
    fontWeight: '700',
    color: colors.primary,
  },
  weeklyChart: {
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  chartTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
    marginBottom: spacing.md,
  },
  chartBarsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 120,
    gap: spacing.xs,
  },
  chartBarColumn: {
    flex: 1,
    alignItems: 'center',
  },
  chartBar: {
    width: '70%',
    borderRadius: radius.md,
    minHeight: 4,
  },
  chartBarLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  chartBarValue: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.foreground,
    marginBottom: 4,
  },
  statsSection: {
    gap: spacing.md,
  },
  statsCard: {
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  statsCardTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
    marginBottom: spacing.md,
  },
  statsMetricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '40',
  },
  statsMetricLabel: {
    ...typography.body,
    color: colors.mutedForeground,
  },
  statsMetricValue: {
    ...typography.body,
    fontWeight: '700',
    color: colors.foreground,
  },
  statsProgressBarContainer: {
    height: 8,
    backgroundColor: colors.border + '40',
    borderRadius: 4,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  statsProgressBar: {
    height: '100%',
    borderRadius: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalCloseButton: {
    padding: spacing.xs,
  },
  modalTitle: {
    ...typography.cardTitle,
    fontSize: 18,
  },
  modalSaveButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
  },
  modalSaveButtonDisabled: {
    backgroundColor: colors.muted,
  },
  modalSaveText: {
    ...typography.button,
    color: colors.primaryForeground,
  },
  modalSaveTextDisabled: {
    color: colors.mutedForeground,
  },
  modalContent: {
    flex: 1,
    padding: spacing.lg,
  },
  formGroup: {
    marginBottom: spacing.lg,
  },
  formLabel: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  formInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.md,
  },
  formInputText: {
    ...typography.body,
    color: colors.foreground,
  },
  formTextArea: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.md,
    ...typography.body,
    color: colors.foreground,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  durationPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary + '12',
    padding: spacing.md,
    borderRadius: radius.xl,
    marginBottom: spacing.lg,
  },
  durationPreviewText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.primary,
  },
  billableToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.md,
  },
  billableToggleLabel: {
    ...typography.body,
    color: colors.foreground,
    fontWeight: '500',
  },
  exportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: spacing.md,
    ...shadows.sm,
  },
  exportCardText: {
    flex: 1,
  },
  exportCardTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.foreground,
  },
  exportCardSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
});

function StatCard({ 
  title, value, icon, colors, accentColor
}: { 
  title: string; value: string | number; icon: React.ReactNode; colors: ThemeColors; accentColor?: string;
}) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIconContainer, { backgroundColor: (accentColor || colors.primary) + '15' }]}>
        {icon}
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
    </View>
  );
}

interface TimeStats {
  todayHours: number;
  weekHours: number;
  totalEntries: number;
  billableHours: number;
  breakHours: number;
}

function formatDurationHM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatTimeShort(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function getWeekDates(): { start: Date; end: Date } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const start = new Date(now);
  start.setDate(now.getDate() + mondayOffset);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export default function TimeTrackingScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { jobs, fetchJobs, isLoading: isLoadingJobs } = useJobsStore();
  const { activeTimer, isLoading: isTimerLoading, startTimer, stopTimer, pauseTimer, resumeTimer, fetchActiveTimer } = useTimeTrackingStore();
  const [activeTab, setActiveTab] = useState<TabKey>('timer');
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [timeStats, setTimeStats] = useState<TimeStats>({ todayHours: 0, weekHours: 0, totalEntries: 0, billableHours: 0, breakHours: 0 });
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isPausing, setIsPausing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [isLoadingEntries, setIsLoadingEntries] = useState(false);
  const [sheetDate, setSheetDate] = useState(new Date());
  const [weeklyData, setWeeklyData] = useState<WeeklyStats[]>([]);

  const [showAddEntryModal, setShowAddEntryModal] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeEntryId, setDisputeEntryId] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [isSubmittingDispute, setIsSubmittingDispute] = useState(false);
  const [entryDate, setEntryDate] = useState(new Date());
  const [entryStartTime, setEntryStartTime] = useState(new Date());
  const [entryEndTime, setEntryEndTime] = useState(new Date());
  const [entryDescription, setEntryDescription] = useState('');
  const [entryJobId, setEntryJobId] = useState<string | null>(null);
  const [showEntryDatePicker, setShowEntryDatePicker] = useState(false);
  const [showEntryStartPicker, setShowEntryStartPicker] = useState(false);
  const [showEntryEndPicker, setShowEntryEndPicker] = useState(false);
  const [isAddingEntry, setIsAddingEntry] = useState(false);
  const [entryIsBillable, setEntryIsBillable] = useState(true);

  const isLoading = isLoadingJobs || isTimerLoading;
  const isTimerRunning = !!activeTimer;
  const isOnBreak = activeTimer?.isBreak === true;
  const isPaused = activeTimer?.isPaused === true;

  const fetchTimeEntries = useCallback(async (date?: Date) => {
    setIsLoadingEntries(true);
    try {
      const targetDate = date || sheetDate;
      const dateStr = targetDate.toISOString().split('T')[0];
      const response = await api.get<any[]>(`/api/time-entries?startDate=${dateStr}&endDate=${dateStr}`);
      if (response.data) {
        setTimeEntries(response.data);
      }
    } catch (error) {
      if (__DEV__) console.log('Failed to fetch time entries:', error);
    } finally {
      setIsLoadingEntries(false);
    }
  }, [sheetDate]);

  const fetchWeeklyData = useCallback(async () => {
    try {
      const { start, end } = getWeekDates();
      const startStr = start.toISOString().split('T')[0];
      const endStr = end.toISOString().split('T')[0];
      const response = await api.get<any[]>(`/api/time-entries?startDate=${startStr}&endDate=${endStr}`);
      if (response.data) {
        const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const weekly: WeeklyStats[] = dayNames.map((dayLabel, i) => {
          const d = new Date(start);
          d.setDate(start.getDate() + i);
          const dayStr = d.toISOString().split('T')[0];
          const dayEntries = response.data!.filter((e: any) => {
            const entryDay = new Date(e.startTime).toISOString().split('T')[0];
            return entryDay === dayStr;
          });
          const totalMinutes = dayEntries.reduce((sum: number, e: any) => sum + (e.duration || 0), 0);
          return { day: dayStr, dayLabel, hours: Math.round((totalMinutes / 60) * 10) / 10 };
        });
        setWeeklyData(weekly);
      }
    } catch (error) {
      if (__DEV__) console.log('Failed to fetch weekly data:', error);
    }
  }, []);

  const fetchTimeStats = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { start } = getWeekDates();
      const weekStartStr = start.toISOString().split('T')[0];
      
      const response = await api.get<any[]>(`/api/time-entries?startDate=${weekStartStr}&endDate=${today}`);
      if (response.data) {
        const entries = response.data;
        let todayMinutes = 0;
        let weekMinutes = 0;
        let billableMinutes = 0;
        let breakMinutes = 0;
        
        entries.forEach((entry: any) => {
          if (entry.duration) {
            weekMinutes += entry.duration;
            if (entry.isBreak) {
              breakMinutes += entry.duration;
            } else if (entry.isBillable !== false) {
              billableMinutes += entry.duration;
            }
            const entryDate = new Date(entry.startTime).toISOString().split('T')[0];
            if (entryDate === today) {
              todayMinutes += entry.duration;
            }
          }
        });
        
        setTimeStats({
          todayHours: Math.round((todayMinutes / 60) * 10) / 10,
          weekHours: Math.round((weekMinutes / 60) * 10) / 10,
          totalEntries: entries.length,
          billableHours: Math.round((billableMinutes / 60) * 10) / 10,
          breakHours: Math.round((breakMinutes / 60) * 10) / 10,
        });
      }
    } catch (error) {
      if (__DEV__) console.log('Failed to fetch time stats:', error);
    }
  }, []);

  const refreshData = useCallback(async () => {
    await Promise.all([fetchJobs(), fetchActiveTimer(), fetchTimeStats(), fetchWeeklyData()]);
  }, [fetchJobs, fetchActiveTimer, fetchTimeStats, fetchWeeklyData]);

  useEffect(() => {
    refreshData();
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshData();
    }, [refreshData])
  );

  useEffect(() => {
    if (activeTab === 'sheet') {
      fetchTimeEntries();
    }
  }, [activeTab, sheetDate]);

  useEffect(() => {
    if (activeTimer) {
      setSelectedJob(activeTimer.jobId ?? null);
      const startTime = new Date(activeTimer.startTime).getTime();
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setTimerSeconds(Math.max(0, elapsed));
      
      timerRef.current = setInterval(() => {
        const now = Date.now();
        const start = new Date(activeTimer.startTime).getTime();
        setTimerSeconds(Math.floor((now - start) / 1000));
      }, 1000);
    } else {
      setTimerSeconds(0);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [activeTimer]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartTimer = async () => {
    if (!selectedJob) {
      Alert.alert('Select a Job', 'Please select a job to track time for.');
      return;
    }
    setIsStarting(true);
    try {
      const selectedJobData = jobs.find(j => j.id === selectedJob);
      const description = selectedJobData ? `Working on: ${selectedJobData.title}` : 'Working on job';
      const success = await startTimer(selectedJob, description);
      if (!success) {
        Alert.alert('Error', 'Failed to start timer. Please try again.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to start timer. Please try again.');
    } finally {
      setIsStarting(false);
    }
  };

  const handleStopTimer = async () => {
    if (!activeTimer) return;
    Alert.alert(
      'Stop Timer',
      `Save ${formatTime(timerSeconds)} of tracked time?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Save', 
          onPress: async () => {
            setIsStopping(true);
            try {
              const success = await stopTimer();
              if (success) {
                await Promise.all([fetchTimeStats(), fetchWeeklyData()]);
              } else {
                Alert.alert('Error', 'Failed to save time entry.');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to save time entry.');
            } finally {
              setIsStopping(false);
            }
          }
        },
      ]
    );
  };

  const handlePauseTimer = async () => {
    setIsPausing(true);
    try {
      const success = await pauseTimer();
      if (!success) {
        Alert.alert('Error', 'Failed to pause timer.');
      }
    } catch {
      Alert.alert('Error', 'Failed to pause timer.');
    } finally {
      setIsPausing(false);
    }
  };

  const handleResumeTimer = async () => {
    setIsPausing(true);
    try {
      const success = await resumeTimer();
      if (!success) {
        Alert.alert('Error', 'Failed to resume timer.');
      }
    } catch {
      Alert.alert('Error', 'Failed to resume timer.');
    } finally {
      setIsPausing(false);
    }
  };

  const handleDeleteEntry = (entry: TimeEntry) => {
    Alert.alert(
      'Delete Entry',
      'Are you sure you want to delete this time entry?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/time-entries/${entry.id}`);
              await Promise.all([fetchTimeEntries(), fetchTimeStats(), fetchWeeklyData()]);
            } catch {
              Alert.alert('Error', 'Failed to delete entry.');
            }
          }
        }
      ]
    );
  };

  const handleOpenDispute = (entryId: string) => {
    setDisputeEntryId(entryId);
    setDisputeReason('');
    setShowDisputeModal(true);
  };

  const handleSubmitDispute = async () => {
    if (!disputeEntryId || !disputeReason.trim()) {
      Alert.alert('Required', 'Please provide a reason for the dispute.');
      return;
    }
    setIsSubmittingDispute(true);
    try {
      await api.post(`/api/time-entries/${disputeEntryId}/dispute`, { reason: disputeReason.trim() });
      setShowDisputeModal(false);
      setDisputeEntryId(null);
      setDisputeReason('');
      await fetchTimeEntries();
      Alert.alert('Dispute Filed', 'Your dispute has been submitted for review.');
    } catch (error: any) {
      const msg = error?.response?.data?.error || 'Failed to submit dispute.';
      Alert.alert('Error', msg);
    } finally {
      setIsSubmittingDispute(false);
    }
  };

  const handleOpenAddEntry = () => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 17, 0, 0);
    setEntryDate(now);
    setEntryStartTime(startOfToday);
    setEntryEndTime(endOfToday);
    setEntryDescription('');
    setEntryJobId(null);
    setEntryIsBillable(true);
    setShowAddEntryModal(true);
  };

  const handleAddEntry = async () => {
    if (!entryJobId) {
      Alert.alert('Select a Job', 'Please select a job for this time entry.');
      return;
    }
    const startDateTime = new Date(entryDate);
    startDateTime.setHours(entryStartTime.getHours(), entryStartTime.getMinutes(), 0, 0);
    const endDateTime = new Date(entryDate);
    endDateTime.setHours(entryEndTime.getHours(), entryEndTime.getMinutes(), 0, 0);
    if (endDateTime <= startDateTime) {
      Alert.alert('Invalid Time', 'End time must be after start time.');
      return;
    }
    const durationMinutes = Math.round((endDateTime.getTime() - startDateTime.getTime()) / 60000);
    setIsAddingEntry(true);
    try {
      await api.post('/api/time-entries', {
        jobId: entryJobId,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        duration: durationMinutes,
        description: entryDescription || undefined,
        isBillable: entryIsBillable,
      });
      setShowAddEntryModal(false);
      await Promise.all([fetchTimeStats(), fetchTimeEntries(), fetchWeeklyData()]);
      Alert.alert('Saved', 'Time entry added.');
    } catch (error) {
      Alert.alert('Error', 'Failed to add time entry.');
    } finally {
      setIsAddingEntry(false);
    }
  };

  const handleExportTimesheet = async () => {
    const dateStr = sheetDate.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const totalMinutes = timeEntries.reduce((sum, e) => sum + (e.duration || 0), 0);
    let text = `Timesheet - ${dateStr}\n`;
    text += `Total: ${formatDurationHM(totalMinutes)}\n\n`;
    timeEntries.forEach(entry => {
      const jobData = jobs.find(j => j.id === entry.jobId);
      const start = formatTimeShort(entry.startTime);
      const end = entry.endTime ? formatTimeShort(entry.endTime) : 'Running';
      const dur = entry.duration ? formatDurationHM(entry.duration) : '--';
      text += `${start} - ${end} (${dur})\n`;
      text += `Job: ${jobData?.title || 'Unknown'}\n`;
      if (entry.description) text += `Notes: ${entry.description}\n`;
      text += '\n';
    });
    try {
      await Share.share({ message: text, title: `Timesheet ${dateStr}` });
    } catch {}
  };

  const navigateSheetDate = (direction: number) => {
    const newDate = new Date(sheetDate);
    newDate.setDate(newDate.getDate() + direction);
    setSheetDate(newDate);
  };

  const inProgressJobs = jobs.filter(j => j.status === 'in_progress' || j.status === 'scheduled');
  const activeJobName = activeTimer ? jobs.find(j => j.id === activeTimer.jobId)?.title : null;
  const dayTotalMinutes = timeEntries.reduce((sum, e) => sum + (e.duration || 0), 0);
  const maxWeeklyHours = Math.max(8, ...weeklyData.map(d => d.hours));

  const renderTimerTab = () => (
    <View style={styles.timerSection}>
      <View style={styles.timerCard}>
        <View style={styles.timerHeader}>
          {isTimerRunning && (
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: isOnBreak ? '#f59e0b' : '#22c55e', marginRight: 4 }} />
          )}
          <Feather name="clock" size={20} color={colors.foreground} />
          <Text style={styles.timerHeaderText}>
            {isOnBreak ? 'On Break' : 'Time Tracker'}
          </Text>
        </View>
        
        <Text style={[styles.timerDisplay, isOnBreak && { color: '#f59e0b' }]}>
          {formatTime(timerSeconds)}
        </Text>
        
        {activeJobName && (
          <Text style={styles.timerJobName} numberOfLines={1}>{activeJobName}</Text>
        )}
        
        <Text style={styles.timerStatus}>
          {isOnBreak 
            ? 'Taking a break...' 
            : isTimerRunning 
              ? 'Timer running...' 
              : 'Ready to start tracking'}
        </Text>

        {isOnBreak && (
          <View style={styles.breakBadge}>
            <Feather name="coffee" size={12} color="#f59e0b" />
            <Text style={styles.breakBadgeText}>Break Time</Text>
          </View>
        )}

        {!isTimerRunning ? (
          <TouchableOpacity
            style={[styles.timerButton, styles.timerButtonStart, { width: '100%' }]}
            onPress={handleStartTimer}
            disabled={isStarting}
            activeOpacity={0.7}
          >
            {isStarting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Feather name="play" size={20} color="#fff" />
                <Text style={styles.timerButtonText}>Start Timer</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <View style={[styles.timerButtonsRow, { marginTop: spacing.xs }]}>
            {isOnBreak ? (
              <TouchableOpacity
                style={[styles.timerButton, styles.timerButtonResume]}
                onPress={handleResumeTimer}
                disabled={isPausing}
                activeOpacity={0.7}
              >
                {isPausing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Feather name="play" size={18} color="#fff" />
                    <Text style={styles.timerButtonText}>Resume</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.timerButton, styles.timerButtonPause]}
                onPress={handlePauseTimer}
                disabled={isPausing}
                activeOpacity={0.7}
              >
                {isPausing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Feather name="coffee" size={18} color="#fff" />
                    <Text style={styles.timerButtonText}>Break</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.timerButton, styles.timerButtonStop]}
              onPress={handleStopTimer}
              disabled={isStopping}
              activeOpacity={0.7}
            >
              {isStopping ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Feather name="square" size={18} color="#fff" />
                  <Text style={styles.timerButtonText}>Stop</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.currentTime}>
          {new Date().toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })}
        </Text>
      </View>

      <View style={styles.quickActionsSection}>
        <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
        <View style={styles.quickActionsGrid}>
          <TouchableOpacity 
            style={styles.quickActionCard} 
            activeOpacity={0.7}
            onPress={handleOpenAddEntry}
          >
            <Feather name="plus-circle" size={20} color={colors.primary} />
            <Text style={styles.quickActionText}>Add Entry</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.quickActionCard} 
            activeOpacity={0.7}
            onPress={() => setActiveTab('sheet')}
          >
            <Feather name="file-text" size={20} color={colors.primary} />
            <Text style={styles.quickActionText}>View Sheet</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.quickActionCard} 
            activeOpacity={0.7}
            onPress={() => setActiveTab('stats')}
          >
            <Feather name="bar-chart-2" size={20} color={colors.primary} />
            <Text style={styles.quickActionText}>Stats</Text>
          </TouchableOpacity>
        </View>
      </View>

      {!isTimerRunning && (
        <View style={styles.jobSelectSection}>
          <Text style={styles.sectionTitle}>SELECT JOB</Text>
          {inProgressJobs.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No active or scheduled jobs to track</Text>
            </View>
          ) : (
            inProgressJobs.slice(0, 6).map(job => (
              <TouchableOpacity
                key={job.id}
                style={[
                  styles.jobSelectCard,
                  selectedJob === job.id && styles.jobSelectCardActive
                ]}
                onPress={() => setSelectedJob(job.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.jobSelectRadio, selectedJob === job.id && { borderColor: colors.primary }]}>
                  {selectedJob === job.id && <View style={styles.jobSelectRadioInner} />}
                </View>
                <View style={styles.jobSelectContent}>
                  <Text style={styles.jobSelectTitle} numberOfLines={1}>{job.title}</Text>
                  <Text style={styles.jobSelectStatus}>{(job.status || '').replace('_', ' ')}</Text>
                </View>
                <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            ))
          )}
        </View>
      )}
    </View>
  );

  const renderSheetTab = () => {
    const dateLabel = sheetDate.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });
    const isToday = sheetDate.toISOString().split('T')[0] === new Date().toISOString().split('T')[0];

    return (
      <View style={{ gap: spacing.md }}>
        <View style={styles.sheetDateHeader}>
          <View>
            <Text style={styles.sheetDateText}>{dateLabel}</Text>
            {isToday && (
              <Text style={[styles.emptyStateText, { textAlign: 'left', marginTop: 2 }]}>Today</Text>
            )}
          </View>
          <View style={styles.sheetDateNav}>
            <TouchableOpacity style={styles.sheetDateButton} onPress={() => navigateSheetDate(-1)} activeOpacity={0.7}>
              <Feather name="chevron-left" size={18} color={colors.foreground} />
            </TouchableOpacity>
            {!isToday && (
              <TouchableOpacity 
                style={[styles.sheetDateButton, { backgroundColor: colors.primary + '15' }]} 
                onPress={() => setSheetDate(new Date())} 
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary }}>Today</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.sheetDateButton} onPress={() => navigateSheetDate(1)} activeOpacity={0.7}>
              <Feather name="chevron-right" size={18} color={colors.foreground} />
            </TouchableOpacity>
          </View>
        </View>

        {dayTotalMinutes > 0 && (
          <View style={styles.dayTotalRow}>
            <Text style={styles.dayTotalLabel}>Day Total</Text>
            <Text style={styles.dayTotalValue}>{formatDurationHM(dayTotalMinutes)}</Text>
          </View>
        )}

        {isLoadingEntries ? (
          <View style={[styles.emptyState, { paddingVertical: spacing['2xl'] }]}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.emptyStateText, { marginTop: spacing.md }]}>Loading entries...</Text>
          </View>
        ) : timeEntries.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyStateIcon, { backgroundColor: colors.primary + '12' }]}>
              <Feather name="calendar" size={28} color={colors.primary} />
            </View>
            <Text style={styles.emptyStateTitle}>No Entries</Text>
            <Text style={styles.emptyStateText}>
              No time tracked on this day. Use the timer or add a manual entry.
            </Text>
          </View>
        ) : (
          timeEntries.map((entry, index) => {
            const jobData = jobs.find(j => j.id === entry.jobId);
            const startStr = formatTimeShort(entry.startTime);
            const endStr = entry.endTime ? formatTimeShort(entry.endTime) : 'Running';
            const durationStr = entry.duration ? formatDurationHM(entry.duration) : '--';
            const isBreakEntry = entry.isBreak;
            const isBillable = entry.isBillable !== false && !isBreakEntry;

            return (
              <View key={entry.id} style={styles.entryCard}>
                <View style={styles.entryTimeline}>
                  <Text style={{ fontSize: 10, fontWeight: '600', color: colors.mutedForeground, marginBottom: 4 }}>
                    {startStr}
                  </Text>
                  <View style={[styles.entryTimelineDot, { backgroundColor: isBreakEntry ? '#f59e0b' : colors.primary }]} />
                  {index < timeEntries.length - 1 && (
                    <View style={[styles.entryTimelineLine, { backgroundColor: colors.border + '60' }]} />
                  )}
                </View>
                <View style={styles.entryContent}>
                  <Text style={styles.entryJobName} numberOfLines={1}>
                    {isBreakEntry ? 'Break' : (jobData?.title || 'Unknown Job')}
                  </Text>
                  {entry.description && !isBreakEntry && (
                    <Text style={styles.entryDescription} numberOfLines={2}>{entry.description}</Text>
                  )}
                  <View style={styles.entryTimeRow}>
                    <Feather name="clock" size={12} color={colors.mutedForeground} />
                    <Text style={styles.entryTimeText}>{startStr} — {endStr}</Text>
                    <Text style={styles.entryDuration}>{durationStr}</Text>
                  </View>
                  <View style={[styles.entryTimeRow, { marginTop: 4 }]}>
                    {isBreakEntry ? (
                      <View style={[styles.entryBillableBadge, { backgroundColor: '#f59e0b18' }]}>
                        <Text style={[styles.entryBillableText, { color: '#f59e0b' }]}>Break</Text>
                      </View>
                    ) : isBillable ? (
                      <View style={[styles.entryBillableBadge, { backgroundColor: '#22c55e18' }]}>
                        <Text style={[styles.entryBillableText, { color: '#22c55e' }]}>Billable</Text>
                      </View>
                    ) : (
                      <View style={[styles.entryBillableBadge, { backgroundColor: colors.border + '40' }]}>
                        <Text style={[styles.entryBillableText, { color: colors.mutedForeground }]}>Non-billable</Text>
                      </View>
                    )}
                    {entry.isDisputed && (
                      <View style={[styles.entryBillableBadge, { backgroundColor: '#ef444418', flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                        <Feather name="alert-triangle" size={10} color="#ef4444" />
                        <Text style={[styles.entryBillableText, { color: '#ef4444' }]}>
                          {entry.disputeResolvedAt ? 'Resolved' : 'Disputed'}
                        </Text>
                      </View>
                    )}
                  </View>
                  {entry.isDisputed && entry.disputeReason && !entry.disputeResolvedAt && (
                    <Text style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }} numberOfLines={2}>
                      Reason: {entry.disputeReason}
                    </Text>
                  )}
                  {entry.isDisputed && entry.disputeResolution && (
                    <Text style={{ fontSize: 11, color: '#22c55e', marginTop: 4 }} numberOfLines={2}>
                      Resolution: {entry.disputeResolution}
                    </Text>
                  )}
                </View>
                <View style={[styles.entryActions, { flexDirection: 'column', gap: spacing.sm }]}>
                  {!entry.isDisputed && !isBreakEntry && (
                    <TouchableOpacity onPress={() => handleOpenDispute(entry.id)} activeOpacity={0.7} hitSlop={8}>
                      <Feather name="flag" size={16} color="#f59e0b" />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => handleDeleteEntry(entry)} activeOpacity={0.7} hitSlop={8}>
                    <Feather name="trash-2" size={16} color={colors.destructive || '#ef4444'} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}

        {timeEntries.length > 0 && (
          <TouchableOpacity style={styles.exportCard} onPress={handleExportTimesheet} activeOpacity={0.7}>
            <View style={[styles.emptyStateIcon, { backgroundColor: colors.primary + '12', width: 44, height: 44 }]}>
              <Feather name="share" size={20} color={colors.primary} />
            </View>
            <View style={styles.exportCardText}>
              <Text style={styles.exportCardTitle}>Export Timesheet</Text>
              <Text style={styles.exportCardSubtitle}>Share this day's entries as text</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderStatsTab = () => {
    const billablePercent = timeStats.weekHours > 0 
      ? Math.round((timeStats.billableHours / timeStats.weekHours) * 100)
      : 0;
    const avgDailyHours = timeStats.weekHours > 0 
      ? Math.round((timeStats.weekHours / Math.max(1, weeklyData.filter(d => d.hours > 0).length)) * 10) / 10
      : 0;

    return (
      <View style={styles.statsSection}>
        <View style={styles.weeklyChart}>
          <Text style={styles.chartTitle}>This Week</Text>
          <View style={styles.chartBarsContainer}>
            {weeklyData.map((day) => {
              const barHeight = maxWeeklyHours > 0 ? (day.hours / maxWeeklyHours) * 100 : 0;
              const isToday = day.day === new Date().toISOString().split('T')[0];
              return (
                <View key={day.day} style={styles.chartBarColumn}>
                  {day.hours > 0 && (
                    <Text style={styles.chartBarValue}>{day.hours}h</Text>
                  )}
                  <View
                    style={[
                      styles.chartBar,
                      { 
                        height: Math.max(4, barHeight),
                        backgroundColor: isToday ? colors.primary : (day.hours > 0 ? colors.primary + '60' : colors.border + '40'),
                      }
                    ]}
                  />
                  <Text style={[styles.chartBarLabel, isToday && { color: colors.primary, fontWeight: '700' }]}>
                    {day.dayLabel}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.statsCard}>
          <Text style={styles.statsCardTitle}>Weekly Summary</Text>
          <View style={styles.statsMetricRow}>
            <Text style={styles.statsMetricLabel}>Total Hours</Text>
            <Text style={styles.statsMetricValue}>{timeStats.weekHours}h</Text>
          </View>
          <View style={styles.statsMetricRow}>
            <Text style={styles.statsMetricLabel}>Billable Hours</Text>
            <Text style={[styles.statsMetricValue, { color: '#22c55e' }]}>{timeStats.billableHours}h</Text>
          </View>
          <View style={styles.statsMetricRow}>
            <Text style={styles.statsMetricLabel}>Break Time</Text>
            <Text style={[styles.statsMetricValue, { color: '#f59e0b' }]}>{timeStats.breakHours}h</Text>
          </View>
          <View style={styles.statsMetricRow}>
            <Text style={styles.statsMetricLabel}>Total Entries</Text>
            <Text style={styles.statsMetricValue}>{timeStats.totalEntries}</Text>
          </View>
          <View style={[styles.statsMetricRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.statsMetricLabel}>Avg Daily</Text>
            <Text style={styles.statsMetricValue}>{avgDailyHours}h</Text>
          </View>
        </View>

        <View style={styles.statsCard}>
          <Text style={styles.statsCardTitle}>Billable Rate</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginBottom: spacing.sm }}>
            <Text style={{ fontSize: 36, fontWeight: '700', color: colors.primary }}>{billablePercent}%</Text>
            <Text style={styles.statsMetricLabel}>of hours are billable</Text>
          </View>
          <View style={styles.statsProgressBarContainer}>
            <View style={[styles.statsProgressBar, { width: `${billablePercent}%`, backgroundColor: '#22c55e' }]} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm }}>
            <Text style={{ fontSize: 11, color: '#22c55e', fontWeight: '600' }}>
              {timeStats.billableHours}h billable
            </Text>
            <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
              {Math.round((timeStats.weekHours - timeStats.billableHours) * 10) / 10}h non-billable
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.exportCard} onPress={handleExportTimesheet} activeOpacity={0.7}>
          <View style={[styles.emptyStateIcon, { backgroundColor: colors.primary + '12', width: 44, height: 44 }]}>
            <Feather name="download" size={20} color={colors.primary} />
          </View>
          <View style={styles.exportCardText}>
            <Text style={styles.exportCardTitle}>Export Weekly Report</Text>
            <Text style={styles.exportCardSubtitle}>Share your weekly timesheet summary</Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>
    );
  };

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
              colors={[colors.primary]}
            />
          }
        >
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.pageTitle}>Time Tracking</Text>
              <Text style={styles.pageSubtitle}>Track hours, breaks, and timesheets</Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.headerButton} onPress={handleOpenAddEntry} activeOpacity={0.7}>
                <Feather name="plus" size={16} color={colors.foreground} />
                <Text style={styles.headerButtonText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statsRow}>
              <StatCard
                title="TODAY"
                value={`${timeStats.todayHours.toFixed(1)}h`}
                icon={<Feather name="sun" size={18} color={colors.primary} />}
                colors={colors}
              />
              <StatCard
                title="THIS WEEK"
                value={`${timeStats.weekHours.toFixed(1)}h`}
                icon={<Feather name="calendar" size={18} color="#3b82f6" />}
                colors={colors}
                accentColor="#3b82f6"
              />
            </View>
            <View style={styles.statsRow}>
              <StatCard
                title="BILLABLE"
                value={`${timeStats.billableHours.toFixed(1)}h`}
                icon={<Feather name="dollar-sign" size={18} color="#22c55e" />}
                colors={colors}
                accentColor="#22c55e"
              />
              <StatCard
                title="ENTRIES"
                value={timeStats.totalEntries}
                icon={<Feather name="list" size={18} color="#8b5cf6" />}
                colors={colors}
                accentColor="#8b5cf6"
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
                    size={16} 
                    color={isActive ? colors.primary : colors.mutedForeground} 
                  />
                  <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {activeTab === 'timer' && renderTimerTab()}
          {activeTab === 'sheet' && renderSheetTab()}
          {activeTab === 'stats' && renderStatsTab()}
        </ScrollView>
      </View>
      
      <Modal
        visible={showAddEntryModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddEntryModal(false)}
      >
        <View style={[styles.container, { paddingTop: spacing.lg }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity 
              onPress={() => setShowAddEntryModal(false)}
              style={styles.modalCloseButton}
            >
              <Feather name="x" size={24} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Add Time Entry</Text>
            <TouchableOpacity 
              onPress={handleAddEntry}
              disabled={isAddingEntry || !entryJobId}
              style={[styles.modalSaveButton, (!entryJobId || isAddingEntry) && styles.modalSaveButtonDisabled]}
            >
              <Text style={[styles.modalSaveText, (!entryJobId || isAddingEntry) && styles.modalSaveTextDisabled]}>
                {isAddingEntry ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent} contentContainerStyle={{ paddingBottom: 100 }}>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Date</Text>
              <TouchableOpacity 
                style={styles.formInput}
                onPress={() => setShowEntryDatePicker(true)}
              >
                <Feather name="calendar" size={18} color={colors.mutedForeground} />
                <Text style={styles.formInputText}>
                  {entryDate.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                </Text>
              </TouchableOpacity>
              {showEntryDatePicker && (
                <DateTimePicker
                  value={entryDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, date) => {
                    setShowEntryDatePicker(Platform.OS === 'ios');
                    if (date) setEntryDate(date);
                  }}
                />
              )}
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Start Time</Text>
              <TouchableOpacity 
                style={styles.formInput}
                onPress={() => setShowEntryStartPicker(true)}
              >
                <Feather name="clock" size={18} color={colors.mutedForeground} />
                <Text style={styles.formInputText}>
                  {entryStartTime.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })}
                </Text>
              </TouchableOpacity>
              {showEntryStartPicker && (
                <DateTimePicker
                  value={entryStartTime}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, time) => {
                    setShowEntryStartPicker(Platform.OS === 'ios');
                    if (time) setEntryStartTime(time);
                  }}
                />
              )}
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>End Time</Text>
              <TouchableOpacity 
                style={styles.formInput}
                onPress={() => setShowEntryEndPicker(true)}
              >
                <Feather name="clock" size={18} color={colors.mutedForeground} />
                <Text style={styles.formInputText}>
                  {entryEndTime.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })}
                </Text>
              </TouchableOpacity>
              {showEntryEndPicker && (
                <DateTimePicker
                  value={entryEndTime}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, time) => {
                    setShowEntryEndPicker(Platform.OS === 'ios');
                    if (time) setEntryEndTime(time);
                  }}
                />
              )}
            </View>
            
            <View style={styles.durationPreview}>
              <Feather name="trending-up" size={16} color={colors.primary} />
              <Text style={styles.durationPreviewText}>
                Duration: {(() => {
                  const diffMs = entryEndTime.getTime() - entryStartTime.getTime();
                  if (diffMs <= 0) return '--:--';
                  const hours = Math.floor(diffMs / 3600000);
                  const mins = Math.floor((diffMs % 3600000) / 60000);
                  return `${hours}h ${mins}m`;
                })()}
              </Text>
            </View>

            <View style={styles.formGroup}>
              <TouchableOpacity 
                style={styles.billableToggle}
                onPress={() => setEntryIsBillable(!entryIsBillable)}
                activeOpacity={0.7}
              >
                <Text style={styles.billableToggleLabel}>Billable</Text>
                <Feather 
                  name={entryIsBillable ? 'check-square' : 'square'} 
                  size={22} 
                  color={entryIsBillable ? '#22c55e' : colors.mutedForeground} 
                />
              </TouchableOpacity>
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Job</Text>
              {inProgressJobs.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>No active jobs available</Text>
                </View>
              ) : (
                inProgressJobs.map(job => (
                  <TouchableOpacity
                    key={job.id}
                    style={[
                      styles.jobSelectCard,
                      entryJobId === job.id && styles.jobSelectCardActive
                    ]}
                    onPress={() => setEntryJobId(job.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.jobSelectRadio, entryJobId === job.id && { borderColor: colors.primary }]}>
                      {entryJobId === job.id && <View style={styles.jobSelectRadioInner} />}
                    </View>
                    <View style={styles.jobSelectContent}>
                      <Text style={styles.jobSelectTitle}>{job.title}</Text>
                      <Text style={styles.jobSelectStatus}>{(job.status || '').replace('_', ' ')}</Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Notes (optional)</Text>
              <TextInput
                style={styles.formTextArea}
                placeholder="What did you work on?"
                placeholderTextColor={colors.mutedForeground}
                value={entryDescription}
                onChangeText={setEntryDescription}
                multiline
                numberOfLines={3}
              />
            </View>
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={showDisputeModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDisputeModal(false)}
      >
        <View style={[styles.container, { paddingTop: spacing.lg }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity 
              onPress={() => setShowDisputeModal(false)}
              style={styles.modalCloseButton}
            >
              <Feather name="x" size={24} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Flag Entry</Text>
            <TouchableOpacity 
              onPress={handleSubmitDispute}
              disabled={isSubmittingDispute || !disputeReason.trim()}
              style={[styles.modalSaveButton, (!disputeReason.trim() || isSubmittingDispute) && styles.modalSaveButtonDisabled]}
            >
              <Text style={[styles.modalSaveText, (!disputeReason.trim() || isSubmittingDispute) && styles.modalSaveTextDisabled]}>
                {isSubmittingDispute ? 'Submitting...' : 'Submit'}
              </Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent} contentContainerStyle={{ paddingBottom: 100 }}>
            <View style={{ 
              flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
              backgroundColor: '#f59e0b18', padding: spacing.md, borderRadius: radius.xl, marginBottom: spacing.lg 
            }}>
              <Feather name="alert-triangle" size={18} color="#f59e0b" />
              <Text style={{ flex: 1, color: colors.foreground, fontSize: 13, lineHeight: 18 }}>
                Flag this entry if you believe it was edited incorrectly. Your employer will be notified to review it.
              </Text>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Reason for Dispute</Text>
              <TextInput
                style={styles.formTextArea}
                placeholder="e.g., I worked until 5pm not 4pm"
                placeholderTextColor={colors.mutedForeground}
                value={disputeReason}
                onChangeText={setDisputeReason}
                multiline
                numberOfLines={4}
              />
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}
