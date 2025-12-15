import { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Alert
} from 'react-native';
import { router, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useJobsStore, useClientsStore } from '../../src/lib/store';
import { StatusBadge } from '../../src/components/ui/StatusBadge';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, shadows } from '../../src/lib/design-tokens';

type ViewMode = 'week' | 'month' | 'today';

const SCHEDULE_TABS = [
  { key: 'week', label: 'Week', icon: 'calendar' },
  { key: 'month', label: 'Month', icon: 'grid' },
  { key: 'dispatch', label: 'Dispatch', icon: 'clipboard' },
  { key: 'today', label: 'Today', icon: 'sun' },
] as const;

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const handleScheduleJob = () => {
  router.push('/more/create-job');
};

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
  scheduleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.lg,
    gap: spacing.xs,
  },
  scheduleButtonText: {
    color: colors.primaryForeground,
    fontSize: 14,
    fontWeight: '600',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    padding: 4,
    marginBottom: spacing.lg,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    gap: spacing.xs,
  },
  tabButtonActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.foreground,
  },
  tabTextActive: {
    color: colors.primaryForeground,
  },
  dateNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateRangeContainer: {
    alignItems: 'center',
  },
  dateRangeText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  jobsCountText: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  weekView: {
    marginBottom: spacing.xl,
  },
  weekDays: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weekDay: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginHorizontal: 2,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  weekDayToday: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  weekDaySelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  weekDayName: {
    fontSize: 11,
    color: colors.mutedForeground,
    marginBottom: 4,
  },
  weekDayNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  weekDayTextActive: {
    color: colors.primaryForeground,
  },
  jobDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginTop: 4,
  },
  monthView: {
    marginBottom: spacing.xl,
  },
  monthHeader: {
    marginBottom: spacing.md,
  },
  monthJobsCount: {
    fontSize: 14,
    color: colors.mutedForeground,
  },
  monthDaysHeader: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  monthDayHeader: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '500',
    color: colors.mutedForeground,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  monthDay: {
    width: '14.28%',
    aspectRatio: 1,
    padding: 2,
    alignItems: 'center',
  },
  monthDayToday: {
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: radius.md,
  },
  monthDaySelected: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
  },
  monthDayNumber: {
    fontSize: 14,
    color: colors.foreground,
    marginBottom: 2,
  },
  monthDayNumberToday: {
    fontWeight: '700',
    color: colors.primary,
  },
  monthDayNumberSelected: {
    fontWeight: '600',
  },
  monthJobIndicator: {
    width: '100%',
    gap: 1,
  },
  monthJobText: {
    fontSize: 8,
    color: colors.primary,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 2,
    borderRadius: 2,
  },
  monthJobMore: {
    fontSize: 8,
    color: colors.mutedForeground,
  },
  selectedDayContainer: {
    marginBottom: spacing.xl,
  },
  selectedDayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  selectedDayTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  selectedDayTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  todayBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.lg,
  },
  todayBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  noJobsCard: {
    alignItems: 'center',
    paddingVertical: spacing['2xl'],
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noJobsText: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginTop: spacing.sm,
  },
  jobCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  jobCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  jobTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.md,
    gap: 4,
  },
  jobTime: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  jobCardContent: {
    gap: 4,
  },
  jobTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  jobDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  jobDetailText: {
    fontSize: 13,
    color: colors.mutedForeground,
    flex: 1,
  },
  todayViewContainer: {
    marginBottom: spacing.xl,
  },
  todayViewHeader: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  todayViewDate: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.foreground,
  },
  todayViewWeekday: {
    fontSize: 18,
    color: colors.primary,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  todayViewSubtitle: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginTop: spacing.sm,
  },
  todayJobsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  todayJobsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
  },
  todayJobsCount: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.lg,
  },
});

export default function CalendarScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const { jobs, fetchJobs, isLoading } = useJobsStore();
  const { clients, fetchClients } = useClientsStore();
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  const refreshData = useCallback(async () => {
    await Promise.all([fetchJobs(), fetchClients()]);
  }, [fetchJobs, fetchClients]);

  useEffect(() => {
    refreshData();
  }, []);

  const getClientName = (clientId?: string) => {
    if (!clientId) return undefined;
    const client = clients.find(c => c.id === clientId);
    return client?.name;
  };

  const getWeekStart = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    return d;
  };

  const getWeekDates = (date: Date) => {
    const weekStart = getWeekStart(date);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  };

  const getMonthDates = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();
    const dates: (Date | null)[] = [];
    
    for (let i = 0; i < startPadding; i++) {
      dates.push(null);
    }
    
    for (let i = 1; i <= lastDay.getDate(); i++) {
      dates.push(new Date(year, month, i));
    }
    
    return dates;
  };

  const getJobsForDate = (date: Date) => {
    return jobs.filter(job => {
      if (!job.scheduledAt) return false;
      const jobDate = new Date(job.scheduledAt);
      return jobDate.toDateString() === date.toDateString();
    });
  };

  const goToPrevious = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setMonth(newDate.getMonth() - 1);
    }
    setCurrentDate(newDate);
  };

  const goToNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  const getDateRangeLabel = () => {
    if (viewMode === 'week') {
      const weekDates = getWeekDates(currentDate);
      const start = weekDates[0];
      const end = weekDates[6];
      return `${start.getDate()} ${MONTHS[start.getMonth()].slice(0, 3)} - ${end.getDate()} ${MONTHS[end.getMonth()].slice(0, 3)}`;
    }
    return `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  };

  const scheduledJobsCount = jobs.filter(job => {
    if (!job.scheduledAt) return false;
    const jobDate = new Date(job.scheduledAt);
    if (viewMode === 'week') {
      const weekDates = getWeekDates(currentDate);
      return jobDate >= weekDates[0] && jobDate <= weekDates[6];
    } else {
      return jobDate.getMonth() === currentDate.getMonth() && jobDate.getFullYear() === currentDate.getFullYear();
    }
  }).length;

  const today = new Date();
  const isToday = (date: Date) => date.toDateString() === today.toDateString();
  const isSelected = (date: Date) => date.toDateString() === selectedDate.toDateString();

  const weekDates = getWeekDates(currentDate);
  const monthDates = getMonthDates(currentDate);
  const selectedDateJobs = getJobsForDate(selectedDate);

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true });
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
            />
          }
        >
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.pageTitle}>Schedule</Text>
              <Text style={styles.pageSubtitle}>Schedule and track your jobs</Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.scheduleButton}
              onPress={handleScheduleJob}
            >
              <Feather name="plus" size={18} color={colors.primaryForeground} />
              <Text style={styles.scheduleButtonText}>New Job</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.tabsContainer}>
            {SCHEDULE_TABS.map(tab => (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tabButton, viewMode === tab.key && styles.tabButtonActive]}
                onPress={() => {
                  if (tab.key === 'dispatch') {
                    router.push('/more/dispatch-board');
                  } else if (tab.key === 'today') {
                    setViewMode('today');
                    setCurrentDate(new Date());
                    setSelectedDate(new Date());
                  } else {
                    setViewMode(tab.key as ViewMode);
                  }
                }}
                activeOpacity={0.7}
              >
                <Feather 
                  name={tab.icon as any} 
                  size={14} 
                  color={viewMode === tab.key ? colors.primaryForeground : colors.foreground} 
                />
                <Text style={[styles.tabText, viewMode === tab.key && styles.tabTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {viewMode !== 'today' && (
            <View style={styles.dateNavigation}>
              <TouchableOpacity onPress={goToPrevious} style={styles.navButton} activeOpacity={0.7}>
                <Feather name="chevron-left" size={20} color={colors.foreground} />
              </TouchableOpacity>
              <View style={styles.dateRangeContainer}>
                <Text style={styles.dateRangeText}>{getDateRangeLabel()}</Text>
                <Text style={styles.jobsCountText}>{scheduledJobsCount} jobs scheduled</Text>
              </View>
              <TouchableOpacity onPress={goToNext} style={styles.navButton} activeOpacity={0.7}>
                <Feather name="chevron-right" size={20} color={colors.foreground} />
              </TouchableOpacity>
            </View>
          )}

          {viewMode === 'today' && (
            <View style={styles.todayViewContainer}>
              <View style={styles.todayViewHeader}>
                <Text style={styles.todayViewDate}>
                  {today.toLocaleDateString('en-AU', { day: 'numeric', month: 'long' })}
                </Text>
                <Text style={styles.todayViewWeekday}>
                  {today.toLocaleDateString('en-AU', { weekday: 'long' })}
                </Text>
                <Text style={styles.todayViewSubtitle}>
                  {selectedDateJobs.length} job{selectedDateJobs.length !== 1 ? 's' : ''} scheduled today
                </Text>
              </View>

              {selectedDateJobs.length === 0 ? (
                <View style={styles.noJobsCard}>
                  <Feather name="sun" size={32} color={colors.mutedForeground} />
                  <Text style={styles.noJobsText}>No jobs scheduled for today</Text>
                </View>
              ) : (
                selectedDateJobs.map(job => (
                  <TouchableOpacity
                    key={job.id}
                    style={styles.jobCard}
                    activeOpacity={0.7}
                    onPress={() => router.push(`/job/${job.id}`)}
                  >
                    <View style={styles.jobCardLeft}>
                      <View style={styles.jobTimeContainer}>
                        <Feather name="clock" size={14} color={colors.primary} />
                        <Text style={styles.jobTime}>{formatTime(job.scheduledAt)}</Text>
                      </View>
                      <StatusBadge status={job.status} size="sm" />
                    </View>
                    <View style={styles.jobCardContent}>
                      <Text style={styles.jobTitle}>{job.title}</Text>
                      {getClientName(job.clientId) && (
                        <View style={styles.jobDetailRow}>
                          <Feather name="user" size={12} color={colors.mutedForeground} />
                          <Text style={styles.jobDetailText}>{getClientName(job.clientId)}</Text>
                        </View>
                      )}
                      {job.address && (
                        <View style={styles.jobDetailRow}>
                          <Feather name="map-pin" size={12} color={colors.mutedForeground} />
                          <Text style={styles.jobDetailText} numberOfLines={1}>{job.address}</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}

          {viewMode === 'week' && (
            <View style={styles.weekView}>
              <View style={styles.weekDays}>
                {weekDates.map((date, index) => {
                  const dateJobs = getJobsForDate(date);
                  return (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.weekDay,
                        isToday(date) && styles.weekDayToday,
                        isSelected(date) && styles.weekDaySelected,
                      ]}
                      onPress={() => setSelectedDate(date)}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.weekDayName,
                        (isToday(date) || isSelected(date)) && styles.weekDayTextActive
                      ]}>
                        {DAYS[date.getDay()]}
                      </Text>
                      <Text style={[
                        styles.weekDayNumber,
                        (isToday(date) || isSelected(date)) && styles.weekDayTextActive
                      ]}>
                        {date.getDate()}
                      </Text>
                      {dateJobs.length > 0 && (
                        <View style={styles.jobDot} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {viewMode === 'month' && (
            <View style={styles.monthView}>
              <View style={styles.monthHeader}>
                <Text style={styles.monthJobsCount}>{scheduledJobsCount} jobs this month</Text>
              </View>
              <View style={styles.monthDaysHeader}>
                {DAYS.map(day => (
                  <Text key={day} style={styles.monthDayHeader}>{day}</Text>
                ))}
              </View>
              <View style={styles.monthGrid}>
                {monthDates.map((date, index) => {
                  if (!date) {
                    return <View key={`empty-${index}`} style={styles.monthDay} />;
                  }
                  const dateJobs = getJobsForDate(date);
                  return (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.monthDay,
                        isToday(date) && styles.monthDayToday,
                        isSelected(date) && styles.monthDaySelected,
                      ]}
                      onPress={() => setSelectedDate(date)}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.monthDayNumber,
                        isToday(date) && styles.monthDayNumberToday,
                        isSelected(date) && styles.monthDayNumberSelected,
                      ]}>
                        {date.getDate()}
                      </Text>
                      {dateJobs.length > 0 && (
                        <View style={styles.monthJobIndicator}>
                          {dateJobs.slice(0, 2).map((job, i) => (
                            <Text key={i} style={styles.monthJobText} numberOfLines={1}>
                              {job.title.slice(0, 6)}...
                            </Text>
                          ))}
                          {dateJobs.length > 2 && (
                            <Text style={styles.monthJobMore}>+{dateJobs.length - 2} more</Text>
                          )}
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {viewMode !== 'today' && (
            <View style={styles.selectedDayContainer}>
              <View style={styles.selectedDayHeader}>
                <View style={styles.selectedDayTitleRow}>
                  <Feather name="calendar" size={18} color={colors.foreground} />
                  <Text style={styles.selectedDayTitle}>
                    {selectedDate.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' })}
                  </Text>
                </View>
                {isToday(selectedDate) && (
                  <View style={styles.todayBadge}>
                    <Text style={styles.todayBadgeText}>Today</Text>
                  </View>
                )}
              </View>

              {selectedDateJobs.length === 0 ? (
                <View style={styles.noJobsCard}>
                  <Feather name="calendar" size={32} color={colors.mutedForeground} />
                  <Text style={styles.noJobsText}>No jobs scheduled</Text>
                </View>
              ) : (
                selectedDateJobs.map(job => (
                  <TouchableOpacity
                    key={job.id}
                    style={styles.jobCard}
                    activeOpacity={0.7}
                    onPress={() => router.push(`/job/${job.id}`)}
                  >
                    <View style={styles.jobCardLeft}>
                      <View style={styles.jobTimeContainer}>
                        <Feather name="clock" size={14} color={colors.primary} />
                        <Text style={styles.jobTime}>{formatTime(job.scheduledAt)}</Text>
                      </View>
                      <StatusBadge status={job.status} size="sm" />
                    </View>
                    <View style={styles.jobCardContent}>
                      <Text style={styles.jobTitle}>{job.title}</Text>
                      {getClientName(job.clientId) && (
                        <View style={styles.jobDetailRow}>
                          <Feather name="user" size={12} color={colors.mutedForeground} />
                          <Text style={styles.jobDetailText}>{getClientName(job.clientId)}</Text>
                        </View>
                      )}
                      {job.address && (
                        <View style={styles.jobDetailRow}>
                          <Feather name="map-pin" size={12} color={colors.mutedForeground} />
                          <Text style={styles.jobDetailText} numberOfLines={1}>{job.address}</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}
        </ScrollView>
      </View>
    </>
  );
}
