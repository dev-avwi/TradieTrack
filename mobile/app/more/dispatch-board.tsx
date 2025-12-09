import { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Alert,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../src/lib/theme';
import { spacing, radius, shadows, typography, statusColors } from '../../src/lib/design-tokens';
import { useJobsStore, useClientsStore } from '../../src/lib/store';
import { api } from '../../src/lib/api';

interface ScheduleSuggestion {
  jobId: string;
  jobTitle: string;
  clientName: string;
  suggestedDate: string;
  suggestedTime: string;
  suggestedAssignee?: string;
  suggestedAssigneeName?: string;
  reason: string;
  priority: number;
}

interface ScheduleSuggestionsResponse {
  suggestions: ScheduleSuggestion[];
  summary: string;
  optimizationNotes?: string[];
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const HOURS = Array.from({ length: 12 }, (_, i) => i + 7);

interface TeamMember {
  id: string;
  userId: string;
  user?: {
    firstName: string;
    lastName: string;
  };
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing['3xl'],
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    marginRight: spacing.md,
    padding: spacing.xs,
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
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dateNavButton: {
    padding: spacing.sm,
  },
  dateCenterButton: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  dateText: {
    ...typography.subtitle,
    color: colors.foreground,
  },
  jobCountText: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: spacing['3xl'],
  },
  timeGrid: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.foreground,
    marginBottom: spacing.md,
  },
  timeSlot: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minHeight: 60,
  },
  currentTimeSlot: {
    backgroundColor: colors.primaryLight,
  },
  timeLabel: {
    width: 60,
    paddingVertical: spacing.sm,
    paddingRight: spacing.sm,
    alignItems: 'flex-end',
    position: 'relative',
  },
  timeLabelText: {
    ...typography.caption,
    color: colors.foreground,
    fontWeight: '500',
  },
  timeLabelPast: {
    color: colors.mutedForeground,
  },
  currentIndicator: {
    position: 'absolute',
    right: 0,
    top: '50%',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: -4,
  },
  timeSlotContent: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.sm,
    gap: spacing.xs,
  },
  emptySlot: {
    paddingVertical: spacing.sm,
  },
  emptySlotText: {
    ...typography.caption,
    color: colors.muted,
  },
  compactJobCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.sm,
    borderLeftWidth: 3,
    ...shadows.sm,
  },
  compactJobTitle: {
    ...typography.caption,
    color: colors.foreground,
    fontWeight: '500',
  },
  compactClientName: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
  },
  compactTime: {
    ...typography.captionSmall,
    color: colors.primary,
    fontWeight: '500',
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  badge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  badgeText: {
    ...typography.captionSmall,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  jobCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  jobTitle: {
    ...typography.body,
    color: colors.foreground,
    fontWeight: '600',
    flex: 1,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: spacing.sm,
  },
  jobRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  jobRowText: {
    ...typography.caption,
    color: colors.mutedForeground,
    flex: 1,
  },
  scheduleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  scheduleButtonText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '500',
  },
  emptyUnscheduled: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    backgroundColor: colors.successLight,
    borderRadius: radius.xl,
  },
  emptyUnscheduledText: {
    ...typography.body,
    color: colors.success,
  },
  teamMemberChip: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
    borderRadius: radius.xl,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  teamMemberChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  teamMemberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  teamMemberInitials: {
    ...typography.caption,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  teamMemberName: {
    ...typography.captionSmall,
    color: colors.foreground,
  },
  aiSection: {
    marginTop: spacing.lg,
    marginHorizontal: spacing.lg,
  },
  aiCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: colors.primary,
    ...shadows.md,
  },
  aiCardInactive: {
    borderColor: colors.border,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  aiTitle: {
    ...typography.subtitle,
    color: colors.foreground,
    flex: 1,
  },
  aiButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  aiButtonText: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  aiDescription: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginBottom: spacing.md,
  },
  aiSummary: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
  },
  aiSuggestionCard: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  aiSuggestionApplied: {
    backgroundColor: colors.successLight,
    borderColor: colors.success,
  },
  aiSuggestionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  aiSuggestionInfo: {
    flex: 1,
  },
  aiSuggestionTitle: {
    ...typography.body,
    color: colors.foreground,
    fontWeight: '500',
  },
  aiSuggestionClient: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  aiSuggestionDetails: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  aiSuggestionDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  aiSuggestionDetailText: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  aiSuggestionReason: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  aiApplyButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  aiApplyButtonText: {
    ...typography.caption,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  aiAppliedBadge: {
    backgroundColor: colors.success,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  aiAppliedText: {
    ...typography.caption,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  aiButtonsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  aiSecondaryButton: {
    flex: 1,
    backgroundColor: colors.muted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  aiSecondaryButtonText: {
    ...typography.caption,
    color: colors.foreground,
    fontWeight: '500',
  },
  aiBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  aiBadgeText: {
    ...typography.captionSmall,
    color: colors.primary,
    fontWeight: '600',
  },
  loadingCenter: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  loadingText: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.sm,
  },
});

export default function DispatchBoardScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const STATUS_COLORS: Record<string, string> = useMemo(() => ({
    pending: statusColors.pending.dot,
    scheduled: statusColors.scheduled.dot,
    in_progress: statusColors.in_progress.dot,
    done: statusColors.done.dot,
    invoiced: statusColors.invoiced.dot,
  }), []);

  const { jobs, fetchJobs, isLoading } = useJobsStore();
  const { clients, fetchClients } = useClientsStore();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  
  // AI Scheduling state
  const [showAISuggestions, setShowAISuggestions] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<ScheduleSuggestionsResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [appliedSuggestions, setAppliedSuggestions] = useState<Set<string>>(new Set());
  const [applyingJobId, setApplyingJobId] = useState<string | null>(null);

  const refreshData = useCallback(async () => {
    await Promise.all([
      fetchJobs(),
      fetchClients(),
    ]);
    try {
      const response = await api.get<TeamMember[]>('/api/team/members');
      if (response.data) {
        setTeamMembers(response.data);
      }
    } catch (error) {
      console.log('Error fetching team:', error);
    }
  }, [fetchJobs, fetchClients]);

  useEffect(() => {
    refreshData();
  }, []);

  const clientsMap = useMemo(() => 
    new Map(clients.map(c => [c.id, c])),
    [clients]
  );

  const dateStr = currentDate.toISOString().split('T')[0];

  const scheduledJobsForDate = useMemo(() => {
    return jobs.filter(job => {
      if (!job.scheduledDate) return false;
      const jobDate = job.scheduledDate.split('T')[0];
      return jobDate === dateStr;
    });
  }, [jobs, dateStr]);

  const unscheduledJobs = useMemo(() => {
    return jobs.filter(job => 
      !job.scheduledDate && 
      ['pending', 'scheduled'].includes(job.status)
    );
  }, [jobs]);

  const getJobsForHour = (hour: number) => {
    return scheduledJobsForDate.filter(job => {
      if (!job.scheduledTime) return false;
      const jobHour = parseInt(job.scheduledTime.split(':')[0]);
      return jobHour === hour;
    });
  };

  const handleScheduleJob = async (jobId: string, hour: number) => {
    try {
      const scheduledTime = `${hour.toString().padStart(2, '0')}:00`;
      await api.patch(`/api/jobs/${jobId}`, {
        scheduledDate: dateStr,
        scheduledTime,
        status: 'scheduled'
      });
      await fetchJobs();
      Alert.alert('Scheduled', `Job scheduled for ${scheduledTime}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to schedule job');
    }
  };

  // Fetch AI scheduling suggestions
  const fetchAISuggestions = useCallback(async () => {
    setAiLoading(true);
    try {
      const response = await api.post<ScheduleSuggestionsResponse>('/api/ai/schedule-suggestions', {
        targetDate: dateStr
      });
      if (response.data) {
        setAiSuggestions(response.data);
        setShowAISuggestions(true);
      }
    } catch (error) {
      console.error('Error fetching AI suggestions:', error);
      Alert.alert('Error', 'Failed to get AI scheduling suggestions');
    } finally {
      setAiLoading(false);
    }
  }, [dateStr]);

  // Apply a single AI suggestion
  const applyAISuggestion = useCallback(async (suggestion: ScheduleSuggestion) => {
    setApplyingJobId(suggestion.jobId);
    try {
      const scheduledAt = new Date(`${suggestion.suggestedDate}T${suggestion.suggestedTime}:00`);
      await api.patch(`/api/jobs/${suggestion.jobId}`, {
        scheduledDate: scheduledAt.toISOString(),
        scheduledTime: suggestion.suggestedTime,
        assignedTo: suggestion.suggestedAssignee === 'owner' ? null : suggestion.suggestedAssignee,
        status: 'scheduled'
      });
      setAppliedSuggestions(prev => new Set(prev).add(suggestion.jobId));
      await fetchJobs();
      Alert.alert('Scheduled', `${suggestion.jobTitle} scheduled for ${suggestion.suggestedTime}`);
    } catch (error) {
      console.error('Error applying suggestion:', error);
      Alert.alert('Error', 'Failed to apply suggestion');
    } finally {
      setApplyingJobId(null);
    }
  }, [fetchJobs]);

  const closeAISuggestions = useCallback(() => {
    setShowAISuggestions(false);
    setAiSuggestions(null);
    setAppliedSuggestions(new Set());
  }, []);

  const handleJobPress = (job: any) => {
    router.push(`/job/${job.id}`);
  };

  const navigateDay = (direction: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + direction);
    setCurrentDate(newDate);
  };

  const formatDate = (date: Date) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    }
    if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    }
    return date.toLocaleDateString('en-AU', { 
      weekday: 'short', 
      day: 'numeric', 
      month: 'short' 
    });
  };

  const renderJobCard = (job: any, compact = false, onSchedule?: (hour: number) => void) => {
    const statusColor = STATUS_COLORS[job.status] || colors.mutedForeground;
    const clientName = clientsMap.get(job.clientId)?.name;

    if (compact) {
      return (
        <TouchableOpacity 
          key={job.id}
          style={[styles.compactJobCard, { borderLeftColor: statusColor }]}
          onPress={() => handleJobPress(job)}
          activeOpacity={0.8}
        >
          <Text style={styles.compactJobTitle} numberOfLines={1}>{job.title}</Text>
          {clientName && <Text style={styles.compactClientName} numberOfLines={1}>{clientName}</Text>}
          {job.scheduledTime && (
            <Text style={styles.compactTime}>{job.scheduledTime}</Text>
          )}
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity 
        key={job.id}
        style={[styles.jobCard, { borderLeftColor: statusColor }]}
        onPress={() => handleJobPress(job)}
        activeOpacity={0.8}
      >
        <View style={styles.jobHeader}>
          <Text style={styles.jobTitle} numberOfLines={1}>{job.title}</Text>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        </View>
        {clientName && (
          <View style={styles.jobRow}>
            <Feather name="user" size={12} color={colors.mutedForeground} />
            <Text style={styles.jobRowText} numberOfLines={1}>{clientName}</Text>
          </View>
        )}
        {job.address && (
          <View style={styles.jobRow}>
            <Feather name="map-pin" size={12} color={colors.mutedForeground} />
            <Text style={styles.jobRowText} numberOfLines={1}>{job.address}</Text>
          </View>
        )}
        {onSchedule && (
          <TouchableOpacity 
            style={styles.scheduleButton}
            onPress={() => {
              Alert.alert(
                'Schedule Job',
                'Select time slot',
                HOURS.map(h => ({
                  text: `${h}:00`,
                  onPress: () => onSchedule(h)
                })).concat([{ text: 'Cancel', style: 'cancel', onPress: () => {} }])
              );
            }}
          >
            <Feather name="calendar" size={14} color={colors.primary} />
            <Text style={styles.scheduleButtonText}>Schedule</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  const renderTimeSlot = (hour: number) => {
    const slotJobs = getJobsForHour(hour);
    const timeLabel = `${hour}:00`;
    const isPast = new Date().getHours() > hour;
    const isCurrent = new Date().getHours() === hour;

    return (
      <View key={hour} style={[styles.timeSlot, isCurrent && styles.currentTimeSlot]}>
        <View style={styles.timeLabel}>
          <Text style={[styles.timeLabelText, isPast && styles.timeLabelPast]}>
            {timeLabel}
          </Text>
          {isCurrent && (
            <View style={styles.currentIndicator} />
          )}
        </View>
        <View style={styles.timeSlotContent}>
          {slotJobs.length > 0 ? (
            slotJobs.map(job => renderJobCard(job, true))
          ) : (
            <View style={styles.emptySlot}>
              <Text style={styles.emptySlotText}>—</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Dispatch Board</Text>
            <Text style={styles.headerSubtitle}>Schedule and assign jobs</Text>
          </View>
        </View>

        <View style={styles.dateNav}>
          <TouchableOpacity onPress={() => navigateDay(-1)} style={styles.dateNavButton}>
            <Feather name="chevron-left" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => setCurrentDate(new Date())}
            style={styles.dateCenterButton}
          >
            <Text style={styles.dateText}>{formatDate(currentDate)}</Text>
            <Text style={styles.jobCountText}>
              {scheduledJobsForDate.length} scheduled
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigateDay(1)} style={styles.dateNavButton}>
            <Feather name="chevron-right" size={24} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={refreshData} tintColor={colors.primary} />
          }
        >
          <View style={styles.timeGrid}>
            <Text style={styles.sectionTitle}>Today's Schedule</Text>
            {HOURS.map(renderTimeSlot)}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Unscheduled Jobs</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unscheduledJobs.length}</Text>
              </View>
            </View>
            {unscheduledJobs.length > 0 ? (
              unscheduledJobs.map(job => renderJobCard(job, false, (hour) => handleScheduleJob(job.id, hour)))
            ) : (
              <View style={styles.emptyUnscheduled}>
                <Feather name="check-circle" size={24} color={colors.success} />
                <Text style={styles.emptyUnscheduledText}>All jobs scheduled!</Text>
              </View>
            )}
          </View>

          {/* AI Scheduling Section */}
          <View style={styles.aiSection}>
            <View style={[styles.aiCard, !showAISuggestions && styles.aiCardInactive]}>
              <View style={styles.aiHeader}>
                <Feather name="zap" size={20} color={colors.primary} />
                <Text style={styles.aiTitle}>AI Scheduling</Text>
                {unscheduledJobs.length > 0 && !showAISuggestions && (
                  <View style={styles.aiBadge}>
                    <Text style={styles.aiBadgeText}>{unscheduledJobs.length}</Text>
                  </View>
                )}
              </View>
              
              {!showAISuggestions ? (
                <>
                  <Text style={styles.aiDescription}>
                    Let AI suggest optimal times and assignments for your unscheduled jobs
                  </Text>
                  <TouchableOpacity
                    style={[styles.aiButton, unscheduledJobs.length === 0 && { opacity: 0.5 }]}
                    onPress={fetchAISuggestions}
                    disabled={unscheduledJobs.length === 0 || aiLoading}
                    activeOpacity={0.8}
                  >
                    {aiLoading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Feather name="zap" size={16} color="#FFFFFF" />
                        <Text style={styles.aiButtonText}>Get AI Suggestions</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  {unscheduledJobs.length === 0 && (
                    <Text style={[styles.aiDescription, { marginTop: spacing.sm, marginBottom: 0 }]}>
                      No unscheduled jobs to optimize
                    </Text>
                  )}
                </>
              ) : aiLoading ? (
                <View style={styles.loadingCenter}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={styles.loadingText}>Analyzing jobs and team availability...</Text>
                </View>
              ) : aiSuggestions?.suggestions && aiSuggestions.suggestions.length > 0 ? (
                <>
                  <Text style={styles.aiSummary}>{aiSuggestions.summary}</Text>
                  
                  {aiSuggestions.suggestions.map((suggestion, index) => {
                    const isApplied = appliedSuggestions.has(suggestion.jobId);
                    const isApplying = applyingJobId === suggestion.jobId;
                    
                    return (
                      <View
                        key={suggestion.jobId}
                        style={[styles.aiSuggestionCard, isApplied && styles.aiSuggestionApplied]}
                      >
                        <View style={styles.aiSuggestionHeader}>
                          <View style={styles.aiSuggestionInfo}>
                            <Text style={styles.aiSuggestionTitle}>
                              #{index + 1} {suggestion.jobTitle}
                            </Text>
                            <Text style={styles.aiSuggestionClient}>{suggestion.clientName}</Text>
                          </View>
                          
                          {isApplied ? (
                            <View style={styles.aiAppliedBadge}>
                              <Feather name="check" size={12} color="#FFFFFF" />
                              <Text style={styles.aiAppliedText}>Applied</Text>
                            </View>
                          ) : (
                            <TouchableOpacity
                              style={styles.aiApplyButton}
                              onPress={() => applyAISuggestion(suggestion)}
                              disabled={isApplying}
                              activeOpacity={0.8}
                            >
                              {isApplying ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                              ) : (
                                <Text style={styles.aiApplyButtonText}>Apply</Text>
                              )}
                            </TouchableOpacity>
                          )}
                        </View>
                        
                        <View style={styles.aiSuggestionDetails}>
                          <View style={styles.aiSuggestionDetail}>
                            <Feather name="clock" size={12} color={colors.mutedForeground} />
                            <Text style={styles.aiSuggestionDetailText}>{suggestion.suggestedTime}</Text>
                          </View>
                          {suggestion.suggestedAssigneeName && (
                            <View style={styles.aiSuggestionDetail}>
                              <Feather name="user" size={12} color={colors.mutedForeground} />
                              <Text style={styles.aiSuggestionDetailText}>{suggestion.suggestedAssigneeName}</Text>
                            </View>
                          )}
                        </View>
                        
                        <Text style={styles.aiSuggestionReason}>{suggestion.reason}</Text>
                      </View>
                    );
                  })}
                  
                  <View style={styles.aiButtonsRow}>
                    <TouchableOpacity
                      style={styles.aiSecondaryButton}
                      onPress={closeAISuggestions}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.aiSecondaryButtonText}>Close</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.aiSecondaryButton}
                      onPress={fetchAISuggestions}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.aiSecondaryButtonText}>Refresh</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.emptyUnscheduled}>
                    <Feather name="check-circle" size={24} color={colors.success} />
                    <Text style={styles.emptyUnscheduledText}>
                      {aiSuggestions?.summary || 'All jobs are scheduled!'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.aiSecondaryButton, { marginTop: spacing.sm }]}
                    onPress={closeAISuggestions}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.aiSecondaryButtonText}>Close</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>

          {teamMembers.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Team Availability</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {teamMembers.map(member => (
                  <TouchableOpacity
                    key={member.id}
                    style={[
                      styles.teamMemberChip,
                      selectedMember === member.id && styles.teamMemberChipSelected
                    ]}
                    onPress={() => setSelectedMember(
                      selectedMember === member.id ? null : member.id
                    )}
                  >
                    <View style={styles.teamMemberAvatar}>
                      <Text style={styles.teamMemberInitials}>
                        {member.user?.firstName?.[0]}{member.user?.lastName?.[0]}
                      </Text>
                    </View>
                    <Text style={styles.teamMemberName}>
                      {member.user?.firstName}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </ScrollView>
      </View>
    </>
  );
}
