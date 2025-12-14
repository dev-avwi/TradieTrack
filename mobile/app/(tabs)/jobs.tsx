import { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  RefreshControl,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useJobsStore, useClientsStore } from '../../src/lib/store';
import { StatusBadge } from '../../src/components/ui/StatusBadge';
import { AnimatedCardPressable } from '../../src/components/ui/AnimatedPressable';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, shadows, sizes, pageShell, typography, iconSizes } from '../../src/lib/design-tokens';

const navigateToCreateJob = () => {
  router.push('/more/create-job');
};

type JobStatus = 'pending' | 'scheduled' | 'in_progress' | 'done' | 'invoiced';

const STATUS_FILTERS: { key: string; label: string; icon: string }[] = [
  { key: 'all', label: 'All', icon: 'briefcase' },
  { key: 'pending', label: 'Pending', icon: 'clock' },
  { key: 'scheduled', label: 'Scheduled', icon: 'calendar' },
  { key: 'in_progress', label: 'In Progress', icon: 'play' },
  { key: 'done', label: 'Done', icon: 'check-circle' },
  { key: 'invoiced', label: 'Invoiced', icon: 'file-text' },
];

function JobCard({ 
  job, 
  onPress
}: { 
  job: any;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase();
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Not scheduled';
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) {
      return `Today, ${formatTime(dateStr)}`;
    }
    if (date.toDateString() === tomorrow.toDateString()) {
      return `Tomorrow, ${formatTime(dateStr)}`;
    }
    return date.toLocaleDateString('en-AU', { 
      weekday: 'short', 
      day: 'numeric', 
      month: 'short',
    }) + ', ' + formatTime(dateStr);
  };

  const getNextAction = () => {
    // Match web behavior: all status-related actions navigate to job view
    switch (job.status) {
      case 'pending':
      case 'scheduled':
      case 'in_progress':
        return { 
          label: 'View', 
          icon: 'briefcase' as const, 
          color: colors.primary,
          action: () => onPress()
        };
      case 'done':
        return { 
          label: 'Invoice', 
          icon: 'file-text' as const, 
          color: colors.invoiced,
          action: () => router.push(`/more/create-invoice?jobId=${job.id}`)
        };
      default:
        return null;
    }
  };

  const nextAction = getNextAction();

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
    <AnimatedCardPressable
      onPress={onPress}
      style={styles.jobCard}
    >
      <View style={[styles.jobCardAccent, { backgroundColor: getAccentColor() }]} />
      <View style={styles.jobCardContent}>
        <View style={styles.jobCardHeader}>
          <Text style={styles.jobTitle} numberOfLines={1}>{job.title}</Text>
          <StatusBadge status={job.status} size="sm" />
        </View>

        {job.clientName && (
          <View style={styles.jobDetailRow}>
            <Feather name="user" size={iconSizes.sm} color={colors.mutedForeground} />
            <Text style={styles.jobDetailText}>{job.clientName}</Text>
          </View>
        )}

        <View style={styles.jobMetaRow}>
          {job.scheduledAt && (
            <View style={styles.jobDetailRow}>
              <Feather name="clock" size={iconSizes.sm} color={colors.mutedForeground} />
              <Text style={styles.jobDetailText}>{formatDate(job.scheduledAt)}</Text>
            </View>
          )}
          {job.address && (
            <View style={[styles.jobDetailRow, { flex: 1 }]}>
              <Feather name="map-pin" size={iconSizes.sm} color={colors.mutedForeground} />
              <Text style={styles.jobDetailText} numberOfLines={1}>{job.address}</Text>
            </View>
          )}
        </View>

        {nextAction && (
          <View style={styles.inlineActionsRow}>
            <TouchableOpacity
              style={[styles.statusActionBtn, { backgroundColor: nextAction.color }]}
              onPress={nextAction.action}
              activeOpacity={0.8}
            >
              <Feather name={nextAction.icon} size={iconSizes.sm} color={colors.white} />
              <Text style={styles.statusActionText}>{nextAction.label}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.jobCardChevronContainer}>
        <Feather name="chevron-right" size={iconSizes.lg} color={colors.mutedForeground} />
      </View>
    </AnimatedCardPressable>
  );
}

export default function JobsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const { jobs, fetchJobs, isLoading } = useJobsStore();
  const { clients, fetchClients } = useClientsStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

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

  const statusCounts = useMemo(() => {
    const counts = {
      all: jobs.length,
      pending: 0,
      scheduled: 0,
      in_progress: 0,
      done: 0,
      invoiced: 0,
    };
    
    jobs.forEach(job => {
      if (job.status === 'pending') counts.pending++;
      else if (job.status === 'scheduled') counts.scheduled++;
      else if (job.status === 'in_progress') counts.in_progress++;
      else if (job.status === 'done') counts.done++;
      else if (job.status === 'invoiced') counts.invoiced++;
    });
    
    return counts;
  }, [jobs]);

  const getFilteredJobs = () => {
    const searchLower = searchQuery.toLowerCase();
    const filterBySearch = (jobList: typeof jobs) => jobList.filter(job => 
      job.title.toLowerCase().includes(searchLower) ||
      (job.address?.toLowerCase().includes(searchLower)) ||
      (getClientName(job.clientId)?.toLowerCase().includes(searchLower))
    );

    if (activeFilter === 'all') {
      return filterBySearch(jobs);
    }
    
    return filterBySearch(jobs.filter(job => job.status === activeFilter));
  };

  const filteredJobs = getFilteredJobs();

  const sortedJobs = [...filteredJobs].sort((a, b) => {
    const dateA = a.createdAt || a.scheduledAt;
    const dateB = b.createdAt || b.scheduledAt;
    if (dateA && dateB) {
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    }
    if (dateA) return -1;
    if (dateB) return 1;
    return 0;
  });

  return (
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
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.pageTitle}>Work</Text>
            <Text style={styles.pageSubtitle}>{jobs.length} jobs total</Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.newJobButton}
            onPress={navigateToCreateJob}
          >
            <Feather name="plus" size={iconSizes.lg} color={colors.white} />
            <Text style={styles.newJobButtonText}>New Job</Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Feather name="search" size={iconSizes.xl} color={colors.mutedForeground} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search jobs, clients, addresses..."
            placeholderTextColor={colors.mutedForeground}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Filter Pills with Counts */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.filtersScroll}
          contentContainerStyle={styles.filtersContent}
        >
          {STATUS_FILTERS.map((filter) => {
            const count = statusCounts[filter.key as keyof typeof statusCounts] || 0;
            const isActive = activeFilter === filter.key;
            
            return (
              <TouchableOpacity
                key={filter.key}
                onPress={() => setActiveFilter(filter.key)}
                activeOpacity={0.7}
                style={[
                  styles.filterPill,
                  isActive && styles.filterPillActive
                ]}
              >
                <Text style={[
                  styles.filterPillText,
                  isActive && styles.filterPillTextActive
                ]}>
                  {filter.label}
                </Text>
                <View style={[
                  styles.filterCount,
                  isActive && styles.filterCountActive
                ]}>
                  <Text style={[
                    styles.filterCountText,
                    isActive && styles.filterCountTextActive
                  ]}>
                    {count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* All Jobs Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="briefcase" size={iconSizes.md} color={colors.primary} />
            <Text style={styles.sectionTitle}>ALL JOBS</Text>
          </View>
          
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : sortedJobs.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyStateIcon}>
                <Feather name="briefcase" size={iconSizes['4xl']} color={colors.mutedForeground} />
              </View>
              <Text style={styles.emptyStateTitle}>No jobs found</Text>
              <Text style={styles.emptyStateSubtitle}>
                {searchQuery || activeFilter !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Create your first job to get started'}
              </Text>
            </View>
          ) : (
            <View style={styles.jobsList}>
              {sortedJobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={{ ...job, clientName: job.clientName || getClientName(job.clientId) }}
                  onPress={() => router.push(`/job/${job.id}`)}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
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
    paddingBottom: pageShell.paddingBottom,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
  headerLeft: {
    flex: 1,
  },
  pageTitle: {
    ...typography.pageTitle,
    color: colors.foreground,
  },
  pageSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  newJobButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.xs,
    ...shadows.sm,
  },
  newJobButtonText: {
    color: colors.white,
    ...typography.caption,
    fontWeight: '600',
  },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    height: sizes.searchBarHeight,
    marginBottom: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.foreground,
  },

  filtersScroll: {
    marginBottom: spacing.lg,
    marginHorizontal: -pageShell.paddingHorizontal,
  },
  filtersContent: {
    paddingHorizontal: pageShell.paddingHorizontal,
    gap: spacing.sm,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: spacing.xs,
  },
  filterPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterPillText: {
    ...typography.captionSmall,
    fontWeight: '500',
    color: colors.foreground,
  },
  filterPillTextActive: {
    color: colors.white,
  },
  filterCount: {
    backgroundColor: colors.muted,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.sm,
    minWidth: sizes.filterCountMin,
    alignItems: 'center',
  },
  filterCountActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  filterCountText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.foreground,
  },
  filterCountTextActive: {
    color: colors.white,
  },

  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.foreground,
    letterSpacing: 0.5,
  },

  loadingContainer: {
    paddingVertical: spacing['3xl'],
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing['4xl'],
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  emptyStateIcon: {
    marginBottom: spacing.lg,
  },
  emptyStateTitle: {
    ...typography.subtitle,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  emptyStateSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },

  jobsList: {
    gap: spacing.md,
  },
  jobCard: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  jobCardAccent: {
    width: 4,
  },
  jobCardContent: {
    flex: 1,
    padding: spacing.lg,
  },
  jobCardChevronContainer: {
    justifyContent: 'center',
    paddingRight: spacing.md,
  },
  jobCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  jobTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
    flex: 1,
  },
  jobDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  jobDetailText: {
    ...typography.caption,
    color: colors.mutedForeground,
    flex: 1,
  },
  jobMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  inlineActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  statusActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    gap: spacing.xs,
  },
  statusActionText: {
    ...typography.captionSmall,
    color: colors.white,
    fontWeight: '600',
  },
});
