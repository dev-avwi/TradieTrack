import { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Alert,
  Modal,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../src/lib/theme';
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

interface TeamMember {
  id: string;
  userId: string;
  user?: {
    firstName: string;
    lastName: string;
  };
}

const TIME_SLOTS = [
  '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
  '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30', '18:00'
];

const createStyles = (colors: ThemeColors) => StyleSheet.create({
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
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.foreground,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  aiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    gap: spacing.xs,
  },
  aiButtonText: {
    color: colors.primaryForeground,
    fontSize: 13,
    fontWeight: '600',
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
    borderRadius: radius.md,
    backgroundColor: colors.muted,
  },
  dateCenter: {
    alignItems: 'center',
  },
  dateText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  jobCountText: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  todayButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  todayButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  summaryCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.lg,
    alignItems: 'center',
    backgroundColor: colors.muted,
  },
  summaryNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.foreground,
  },
  summaryLabel: {
    fontSize: 11,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
    marginLeft: spacing.sm,
  },
  badge: {
    marginLeft: spacing.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  badgeText: {
    fontSize: 11,
    color: colors.primaryForeground,
    fontWeight: '600',
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
    marginTop: spacing.sm,
  },
  jobCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  jobCardScheduled: {
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  jobCardUnscheduled: {
    borderLeftWidth: 4,
    borderLeftColor: statusColors.pending.bg,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  jobTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  jobDetails: {
    gap: spacing.xs,
  },
  jobDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  jobDetailText: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  scheduleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    marginTop: spacing.sm,
    gap: spacing.xs,
    alignSelf: 'flex-start',
  },
  scheduleChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  scheduledTime: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.md,
    gap: spacing.xs,
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
  },
  scheduledTimeText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  // Bottom Sheet Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    maxHeight: '80%',
    paddingBottom: spacing['2xl'],
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.muted,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  sheetHeader: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.foreground,
  },
  sheetSubtitle: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  sheetContent: {
    padding: spacing.lg,
  },
  sheetSection: {
    marginBottom: spacing.lg,
  },
  sheetSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  timeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timeChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  timeChipText: {
    fontSize: 13,
    color: colors.foreground,
  },
  timeChipTextSelected: {
    color: colors.primaryForeground,
    fontWeight: '600',
  },
  teamScroll: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  teamChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    minWidth: 80,
  },
  teamChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  teamChipText: {
    fontSize: 13,
    color: colors.foreground,
  },
  teamChipTextSelected: {
    color: colors.primaryForeground,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  // AI Suggestions Modal
  aiModalContent: {
    padding: spacing.lg,
  },
  aiSummary: {
    fontSize: 14,
    color: colors.foreground,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  suggestionCard: {
    backgroundColor: colors.muted,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  suggestionCardApplied: {
    backgroundColor: colors.successLight,
    borderWidth: 1,
    borderColor: colors.success,
  },
  suggestionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  suggestionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
    flex: 1,
  },
  suggestionClient: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginBottom: spacing.xs,
  },
  suggestionDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  suggestionDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  suggestionDetailText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '500',
  },
  suggestionReason: {
    fontSize: 12,
    color: colors.mutedForeground,
    fontStyle: 'italic',
  },
  applyButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
  },
  applyButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  appliedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.success,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.md,
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
  },
  appliedBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  applyAllButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  applyAllButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  closeButton: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  closeButtonText: {
    fontSize: 14,
    color: colors.mutedForeground,
  },
});

export default function DispatchBoardScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const { jobs, fetchJobs, isLoading } = useJobsStore();
  const { clients, fetchClients } = useClientsStore();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  
  // Schedule modal state
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedTeamMember, setSelectedTeamMember] = useState<string | null>(null);
  const [isScheduling, setIsScheduling] = useState(false);
  
  // AI Suggestions state
  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<ScheduleSuggestionsResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [appliedSuggestions, setAppliedSuggestions] = useState<Set<string>>(new Set());
  const [applyingJobId, setApplyingJobId] = useState<string | null>(null);

  const refreshData = useCallback(async () => {
    await Promise.all([fetchJobs(), fetchClients()]);
    try {
      const response = await api.get<TeamMember[]>('/api/team/members');
      if (response.data) {
        setTeamMembers(response.data);
      }
    } catch (error) {
      console.log('Team fetch error:', error);
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
  const isToday = dateStr === new Date().toISOString().split('T')[0];

  const scheduledJobsForDate = useMemo(() => {
    return jobs.filter(job => {
      if (!job.scheduledAt) return false;
      const jobDate = job.scheduledAt.split('T')[0];
      return jobDate === dateStr;
    }).sort((a, b) => {
      const timeA = (a as any).scheduledTime || '00:00';
      const timeB = (b as any).scheduledTime || '00:00';
      return timeA.localeCompare(timeB);
    });
  }, [jobs, dateStr]);

  const unscheduledJobs = useMemo(() => {
    return jobs.filter(job => 
      !job.scheduledAt && 
      ['pending', 'scheduled'].includes(job.status)
    );
  }, [jobs]);

  const navigateDay = (direction: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + direction);
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const formatDate = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'short', 
      day: 'numeric', 
      month: 'short' 
    };
    return date.toLocaleDateString('en-AU', options);
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const h = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    return `${h}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  };

  const getClientName = (clientId?: string) => {
    if (!clientId) return 'No client';
    const client = clientsMap.get(clientId);
    return client?.name || 'Unknown client';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return statusColors.pending;
      case 'scheduled': return statusColors.scheduled;
      case 'in_progress': return statusColors.in_progress;
      case 'done': return statusColors.done;
      case 'invoiced': return statusColors.invoiced;
      default: return statusColors.pending;
    }
  };

  // Open schedule modal for a job
  const openScheduleModal = (job: any) => {
    setSelectedJob(job);
    setSelectedTime(job.scheduledTime || null);
    setSelectedTeamMember(job.assignedTo || null);
    setScheduleModalVisible(true);
  };

  // Schedule a job
  const scheduleJob = async () => {
    if (!selectedJob || !selectedTime) return;
    
    setIsScheduling(true);
    try {
      const scheduledAt = new Date(`${dateStr}T${selectedTime}:00`);
      await api.patch(`/api/jobs/${selectedJob.id}`, {
        scheduledAt: scheduledAt.toISOString(),
        scheduledTime: selectedTime,
        assignedTo: selectedTeamMember || undefined,
        status: 'scheduled'
      });
      await fetchJobs();
      setScheduleModalVisible(false);
      setSelectedJob(null);
      setSelectedTime(null);
      setSelectedTeamMember(null);
      Alert.alert('Scheduled', `Job scheduled for ${formatTime(selectedTime)}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to schedule job');
    } finally {
      setIsScheduling(false);
    }
  };

  // Fetch AI suggestions
  const fetchAISuggestions = async () => {
    setAiLoading(true);
    setAiModalVisible(true);
    setAppliedSuggestions(new Set());
    
    try {
      const response = await api.post<ScheduleSuggestionsResponse>('/api/ai/schedule-suggestions', {
        targetDate: dateStr
      });
      if (response.data) {
        setAiSuggestions(response.data);
      }
    } catch (error) {
      console.error('AI suggestions error:', error);
      Alert.alert('Error', 'Failed to get AI scheduling suggestions');
      setAiModalVisible(false);
    } finally {
      setAiLoading(false);
    }
  };

  // Apply single AI suggestion
  const applySuggestion = async (suggestion: ScheduleSuggestion, skipRefetch = false) => {
    setApplyingJobId(suggestion.jobId);
    try {
      const scheduledAt = new Date(`${suggestion.suggestedDate}T${suggestion.suggestedTime}:00`);
      await api.patch(`/api/jobs/${suggestion.jobId}`, {
        scheduledAt: scheduledAt.toISOString(),
        scheduledTime: suggestion.suggestedTime,
        assignedTo: suggestion.suggestedAssignee || undefined,
        status: 'scheduled'
      });
      setAppliedSuggestions(prev => new Set(prev).add(suggestion.jobId));
      if (!skipRefetch) {
        await fetchJobs();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to apply suggestion');
    } finally {
      setApplyingJobId(null);
    }
  };

  // Apply all AI suggestions - batch mode with single refetch
  const applyAllSuggestions = async () => {
    if (!aiSuggestions?.suggestions) return;
    
    const unapplied = aiSuggestions.suggestions.filter(s => !appliedSuggestions.has(s.jobId));
    if (unapplied.length === 0) return;
    
    setApplyingJobId('batch');
    
    try {
      // Apply all in parallel, skip individual refetches
      await Promise.all(unapplied.map(async (suggestion) => {
        const scheduledAt = new Date(`${suggestion.suggestedDate}T${suggestion.suggestedTime}:00`);
        await api.patch(`/api/jobs/${suggestion.jobId}`, {
          scheduledAt: scheduledAt.toISOString(),
          scheduledTime: suggestion.suggestedTime,
          assignedTo: suggestion.suggestedAssignee || undefined,
          status: 'scheduled'
        });
        setAppliedSuggestions(prev => new Set(prev).add(suggestion.jobId));
      }));
      
      // Single refetch after all applied
      await fetchJobs();
      Alert.alert('Done', `Applied ${unapplied.length} scheduling suggestions`);
    } catch (error) {
      Alert.alert('Error', 'Some suggestions failed to apply');
    } finally {
      setApplyingJobId(null);
    }
  };

  const closeAiModal = () => {
    setAiModalVisible(false);
    setAiSuggestions(null);
    setAppliedSuggestions(new Set());
  };

  const renderJobCard = (job: any, isScheduled: boolean) => {
    const statusColor = getStatusColor(job.status);
    
    return (
      <TouchableOpacity
        key={job.id}
        style={[
          styles.jobCard,
          isScheduled ? styles.jobCardScheduled : styles.jobCardUnscheduled
        ]}
        onPress={() => isScheduled ? router.push(`/job/${job.id}`) : openScheduleModal(job)}
        activeOpacity={0.7}
      >
        <View style={styles.jobHeader}>
          <Text style={styles.jobTitle} numberOfLines={1}>{job.title}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
            <Text style={[styles.statusText, { color: statusColor.text }]}>
              {job.status.replace('_', ' ')}
            </Text>
          </View>
        </View>
        
        <View style={styles.jobDetails}>
          <View style={styles.jobDetailRow}>
            <Feather name="user" size={12} color={colors.mutedForeground} />
            <Text style={styles.jobDetailText}>{getClientName(job.clientId)}</Text>
          </View>
          
          {job.address && (
            <View style={styles.jobDetailRow}>
              <Feather name="map-pin" size={12} color={colors.mutedForeground} />
              <Text style={styles.jobDetailText} numberOfLines={1}>{job.address}</Text>
            </View>
          )}
        </View>
        
        {isScheduled && (job as any).scheduledTime ? (
          <View style={styles.scheduledTime}>
            <Feather name="clock" size={14} color={colors.primary} />
            <Text style={styles.scheduledTimeText}>{formatTime((job as any).scheduledTime)}</Text>
          </View>
        ) : (
          <View style={styles.scheduleChip}>
            <Feather name="calendar" size={14} color={colors.primaryForeground} />
            <Text style={styles.scheduleChipText}>Tap to Schedule</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => router.back()}
          >
            <Feather name="arrow-left" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Dispatch Board</Text>
            <Text style={styles.headerSubtitle}>Schedule and manage jobs</Text>
          </View>
          <TouchableOpacity 
            style={styles.aiButton}
            onPress={fetchAISuggestions}
            disabled={unscheduledJobs.length === 0}
          >
            <Feather name="zap" size={16} color={colors.primaryForeground} />
            <Text style={styles.aiButtonText}>AI</Text>
          </TouchableOpacity>
        </View>

        {/* Date Navigation */}
        <View style={styles.dateNav}>
          <TouchableOpacity style={styles.dateNavButton} onPress={() => navigateDay(-1)}>
            <Feather name="chevron-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          
          <View style={styles.dateCenter}>
            <Text style={styles.dateText}>{formatDate(currentDate)}</Text>
            <Text style={styles.jobCountText}>
              {scheduledJobsForDate.length} job{scheduledJobsForDate.length !== 1 ? 's' : ''} scheduled
            </Text>
          </View>
          
          <TouchableOpacity style={styles.dateNavButton} onPress={() => navigateDay(1)}>
            <Feather name="chevron-right" size={20} color={colors.foreground} />
          </TouchableOpacity>
          
          {!isToday && (
            <TouchableOpacity style={styles.todayButton} onPress={goToToday}>
              <Text style={styles.todayButtonText}>Today</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryNumber}>{scheduledJobsForDate.length}</Text>
            <Text style={styles.summaryLabel}>Scheduled</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryNumber}>{unscheduledJobs.length}</Text>
            <Text style={styles.summaryLabel}>Unscheduled</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryNumber}>{teamMembers.length || 1}</Text>
            <Text style={styles.summaryLabel}>Team</Text>
          </View>
        </View>

        {/* Content */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={refreshData}
              tintColor={colors.primary}
            />
          }
        >
          {/* Scheduled Jobs */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="calendar" size={18} color={colors.primary} />
              <Text style={styles.sectionTitle}>Today's Schedule</Text>
              {scheduledJobsForDate.length > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{scheduledJobsForDate.length}</Text>
                </View>
              )}
            </View>
            
            {scheduledJobsForDate.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="calendar" size={32} color={colors.mutedForeground} />
                <Text style={styles.emptyStateText}>No jobs scheduled for this day</Text>
              </View>
            ) : (
              scheduledJobsForDate.map(job => renderJobCard(job, true))
            )}
          </View>

          {/* Unscheduled Jobs */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="inbox" size={18} color={statusColors.pending.text} />
              <Text style={styles.sectionTitle}>Unscheduled Jobs</Text>
              {unscheduledJobs.length > 0 && (
                <View style={[styles.badge, { backgroundColor: statusColors.pending.bg }]}>
                  <Text style={[styles.badgeText, { color: statusColors.pending.text }]}>
                    {unscheduledJobs.length}
                  </Text>
                </View>
              )}
            </View>
            
            {unscheduledJobs.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="check-circle" size={32} color={colors.success} />
                <Text style={styles.emptyStateText}>All jobs are scheduled!</Text>
              </View>
            ) : (
              unscheduledJobs.map(job => renderJobCard(job, false))
            )}
          </View>
        </ScrollView>

        {/* Schedule Modal */}
        <Modal
          visible={scheduleModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setScheduleModalVisible(false)}
        >
          <Pressable 
            style={styles.modalOverlay}
            onPress={() => setScheduleModalVisible(false)}
          >
            <Pressable style={styles.bottomSheet} onPress={(e) => e.stopPropagation()}>
              <View style={styles.sheetHandle} />
              
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Schedule Job</Text>
                <Text style={styles.sheetSubtitle}>{selectedJob?.title}</Text>
              </View>
              
              <ScrollView style={styles.sheetContent}>
                {/* Time Selection */}
                <View style={styles.sheetSection}>
                  <Text style={styles.sheetSectionTitle}>Select Time</Text>
                  <View style={styles.timeGrid}>
                    {TIME_SLOTS.map(time => (
                      <TouchableOpacity
                        key={time}
                        style={[
                          styles.timeChip,
                          selectedTime === time && styles.timeChipSelected
                        ]}
                        onPress={() => setSelectedTime(time)}
                      >
                        <Text style={[
                          styles.timeChipText,
                          selectedTime === time && styles.timeChipTextSelected
                        ]}>
                          {formatTime(time)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Team Member Selection */}
                {teamMembers.length > 0 && (
                  <View style={styles.sheetSection}>
                    <Text style={styles.sheetSectionTitle}>Assign To (Optional)</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={styles.teamScroll}>
                        <TouchableOpacity
                          style={[
                            styles.teamChip,
                            !selectedTeamMember && styles.teamChipSelected
                          ]}
                          onPress={() => setSelectedTeamMember(null)}
                        >
                          <Text style={[
                            styles.teamChipText,
                            !selectedTeamMember && styles.teamChipTextSelected
                          ]}>
                            Owner
                          </Text>
                        </TouchableOpacity>
                        {teamMembers.map(member => (
                          <TouchableOpacity
                            key={member.id}
                            style={[
                              styles.teamChip,
                              selectedTeamMember === member.id && styles.teamChipSelected
                            ]}
                            onPress={() => setSelectedTeamMember(member.id)}
                          >
                            <Text style={[
                              styles.teamChipText,
                              selectedTeamMember === member.id && styles.teamChipTextSelected
                            ]}>
                              {member.user?.firstName || 'Team Member'}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>
                  </View>
                )}

                {/* Confirm Button */}
                <TouchableOpacity
                  style={[
                    styles.confirmButton,
                    (!selectedTime || isScheduling) && styles.confirmButtonDisabled
                  ]}
                  onPress={scheduleJob}
                  disabled={!selectedTime || isScheduling}
                >
                  {isScheduling ? (
                    <ActivityIndicator color={colors.primaryForeground} />
                  ) : (
                    <Text style={styles.confirmButtonText}>
                      Schedule for {selectedTime ? formatTime(selectedTime) : '...'}
                    </Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>

        {/* AI Suggestions Modal */}
        <Modal
          visible={aiModalVisible}
          transparent
          animationType="slide"
          onRequestClose={closeAiModal}
        >
          <Pressable 
            style={styles.modalOverlay}
            onPress={closeAiModal}
          >
            <Pressable style={styles.bottomSheet} onPress={(e) => e.stopPropagation()}>
              <View style={styles.sheetHandle} />
              
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>AI Schedule Suggestions</Text>
                <Text style={styles.sheetSubtitle}>Optimized scheduling for {formatDate(currentDate)}</Text>
              </View>
              
              <ScrollView style={styles.aiModalContent}>
                {aiLoading ? (
                  <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={{ marginTop: 16, color: colors.mutedForeground }}>
                      Analyzing jobs and availability...
                    </Text>
                  </View>
                ) : aiSuggestions ? (
                  <>
                    <Text style={styles.aiSummary}>{aiSuggestions.summary}</Text>
                    
                    {aiSuggestions.suggestions.length === 0 ? (
                      <View style={styles.emptyState}>
                        <Feather name="check-circle" size={32} color={colors.success} />
                        <Text style={styles.emptyStateText}>No scheduling needed!</Text>
                      </View>
                    ) : (
                      <>
                        {aiSuggestions.suggestions.map(suggestion => {
                          const isApplied = appliedSuggestions.has(suggestion.jobId);
                          const isApplying = applyingJobId === suggestion.jobId;
                          
                          return (
                            <View 
                              key={suggestion.jobId}
                              style={[
                                styles.suggestionCard,
                                isApplied && styles.suggestionCardApplied
                              ]}
                            >
                              <View style={styles.suggestionHeader}>
                                <Text style={styles.suggestionTitle} numberOfLines={1}>
                                  {suggestion.jobTitle}
                                </Text>
                              </View>
                              <Text style={styles.suggestionClient}>{suggestion.clientName}</Text>
                              
                              <View style={styles.suggestionDetails}>
                                <View style={styles.suggestionDetailItem}>
                                  <Feather name="clock" size={12} color={colors.primary} />
                                  <Text style={styles.suggestionDetailText}>
                                    {formatTime(suggestion.suggestedTime)}
                                  </Text>
                                </View>
                                {suggestion.suggestedAssigneeName && (
                                  <View style={styles.suggestionDetailItem}>
                                    <Feather name="user" size={12} color={colors.primary} />
                                    <Text style={styles.suggestionDetailText}>
                                      {suggestion.suggestedAssigneeName}
                                    </Text>
                                  </View>
                                )}
                              </View>
                              
                              <Text style={styles.suggestionReason}>{suggestion.reason}</Text>
                              
                              {isApplied ? (
                                <View style={styles.appliedBadge}>
                                  <Feather name="check" size={12} color="#FFFFFF" />
                                  <Text style={styles.appliedBadgeText}>Scheduled</Text>
                                </View>
                              ) : (
                                <TouchableOpacity
                                  style={styles.applyButton}
                                  onPress={() => applySuggestion(suggestion)}
                                  disabled={isApplying}
                                >
                                  {isApplying ? (
                                    <ActivityIndicator size="small" color={colors.primaryForeground} />
                                  ) : (
                                    <Text style={styles.applyButtonText}>Apply</Text>
                                  )}
                                </TouchableOpacity>
                              )}
                            </View>
                          );
                        })}
                        
                        {appliedSuggestions.size < aiSuggestions.suggestions.length && (
                          <TouchableOpacity
                            style={[
                              styles.applyAllButton,
                              applyingJobId === 'batch' && { opacity: 0.7 }
                            ]}
                            onPress={applyAllSuggestions}
                            disabled={applyingJobId === 'batch'}
                          >
                            {applyingJobId === 'batch' ? (
                              <ActivityIndicator color={colors.primaryForeground} />
                            ) : (
                              <Text style={styles.applyAllButtonText}>
                                Apply All ({aiSuggestions.suggestions.length - appliedSuggestions.size} remaining)
                              </Text>
                            )}
                          </TouchableOpacity>
                        )}
                      </>
                    )}
                    
                    <TouchableOpacity style={styles.closeButton} onPress={closeAiModal}>
                      <Text style={styles.closeButtonText}>Close</Text>
                    </TouchableOpacity>
                  </>
                ) : null}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    </>
  );
}
