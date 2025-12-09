import { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  RefreshControl,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useJobsStore, useClientsStore, useQuotesStore } from '../../src/lib/store';
import { StatusBadge } from '../../src/components/ui/StatusBadge';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, shadows, sizes, pageShell, typography, iconSizes } from '../../src/lib/design-tokens';
import { JobsListSkeleton, SkeletonStatCard } from '../../src/components/ui/Skeleton';
import { EmptyState } from '../../src/components/ui/EmptyState';
import api from '../../src/lib/api';

type ViewMode = 'cards' | 'table';

const navigateToCreateJob = () => {
  router.push('/more/create-job');
};

type JobStatus = 'pending' | 'scheduled' | 'in_progress' | 'done' | 'invoiced';

const STATUS_FILTERS: { key: string; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'New' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'done', label: 'Completed' },
  { key: 'invoiced', label: 'Invoiced' },
];

function StatCard({ 
  title, 
  value, 
  icon,
  iconColor,
  onPress
}: { 
  title: string; 
  value: number; 
  icon: React.ReactNode;
  iconColor: string;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={styles.statCard}
    >
      <View style={[styles.statIconContainer, { backgroundColor: `${iconColor}15` }]}>
        {icon}
      </View>
      <View style={styles.statTextContainer}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statTitle}>{title}</Text>
      </View>
    </TouchableOpacity>
  );
}

function RecentActivityItem({ 
  job, 
  onPress 
}: { 
  job: any;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const getRelativeDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    return date.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={styles.activityItem}
    >
      <View style={styles.activityDot} />
      <View style={styles.activityContent}>
        <Text style={styles.activityTitle} numberOfLines={1}>{job.title}</Text>
        <Text style={styles.activityDate}>· {getRelativeDate(job.createdAt || job.scheduledAt)}</Text>
      </View>
      <StatusBadge status={job.status} size="sm" />
    </TouchableOpacity>
  );
}

function JobTableRow({ 
  job, 
  onPress 
}: { 
  job: any;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-AU');
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={styles.tableRow}
    >
      <View style={styles.tableCell}>
        <Text style={styles.tableCellTitle} numberOfLines={1}>{job.title || 'Untitled'}</Text>
      </View>
      <View style={styles.tableCellClient}>
        <Text style={styles.tableCellText} numberOfLines={1}>{job.clientName || '—'}</Text>
      </View>
      <View style={styles.tableCellStatus}>
        <StatusBadge status={job.status} size="sm" />
      </View>
      <View style={styles.tableCellDate}>
        <Text style={styles.tableCellText}>{formatDate(job.scheduledAt)}</Text>
      </View>
      <View style={styles.tableCellChevron}>
        <Feather name="chevron-right" size={iconSizes.md} color={colors.mutedForeground} />
      </View>
    </TouchableOpacity>
  );
}

function JobCard({ 
  job, 
  onPress,
  onUpdateStatus,
  onGenerateQuote,
  clientPhone
}: { 
  job: any;
  onPress: () => void;
  onUpdateStatus?: (status: string) => void;
  onGenerateQuote?: () => void;
  clientPhone?: string;
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
    switch (job.status) {
      case 'pending':
        return { label: 'Schedule', status: 'scheduled', icon: 'calendar' as const, color: colors.scheduled };
      case 'scheduled':
        return { label: 'Start Job', status: 'in_progress', icon: 'play' as const, color: colors.inProgress };
      case 'in_progress':
        return { label: 'Complete', status: 'done', icon: 'check' as const, color: colors.done };
      case 'done':
        return { label: 'Invoice', status: 'invoiced', icon: 'file-text' as const, color: colors.invoiced };
      default:
        return null;
    }
  };

  const handleCall = () => {
    if (clientPhone) {
      Linking.openURL(`tel:${clientPhone}`);
    }
  };

  const handleSMS = () => {
    if (clientPhone) {
      Linking.openURL(`sms:${clientPhone}`);
    }
  };

  const handleNavigate = () => {
    if (job.address) {
      const url = `https://maps.google.com/?q=${encodeURIComponent(job.address)}`;
      Linking.openURL(url);
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
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
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

        {/* Inline Actions Row */}
        <View style={styles.inlineActionsRow}>
          {/* Quick Actions */}
          <View style={styles.quickActionsRow}>
            {clientPhone && (
              <TouchableOpacity 
                style={styles.quickActionBtn} 
                onPress={handleCall}
                activeOpacity={0.7}
              >
                <Feather name="phone" size={iconSizes.sm} color={colors.primary} />
              </TouchableOpacity>
            )}
            {clientPhone && (
              <TouchableOpacity 
                style={styles.quickActionBtn} 
                onPress={handleSMS}
                activeOpacity={0.7}
              >
                <Feather name="message-square" size={iconSizes.sm} color={colors.primary} />
              </TouchableOpacity>
            )}
            {job.address && (
              <TouchableOpacity 
                style={styles.quickActionBtn} 
                onPress={handleNavigate}
                activeOpacity={0.7}
              >
                <Feather name="navigation" size={iconSizes.sm} color={colors.primary} />
              </TouchableOpacity>
            )}
            {onGenerateQuote && (
              <TouchableOpacity 
                style={styles.quickActionBtn} 
                onPress={onGenerateQuote}
                activeOpacity={0.7}
              >
                <Feather name="file-text" size={iconSizes.sm} color={colors.primary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Status Action Button */}
          {nextAction && onUpdateStatus && (
            <TouchableOpacity
              style={[styles.statusActionBtn, { backgroundColor: nextAction.color }]}
              onPress={() => onUpdateStatus(nextAction.status)}
              activeOpacity={0.8}
            >
              <Feather name={nextAction.icon} size={iconSizes.sm} color={colors.white} />
              <Text style={styles.statusActionText}>{nextAction.label}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.jobCardChevronContainer}>
        <Feather name="chevron-right" size={iconSizes.lg} color={colors.mutedForeground} />
      </View>
    </TouchableOpacity>
  );
}

export default function JobsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const { jobs, fetchJobs, updateJobStatus, isLoading } = useJobsStore();
  const { clients, fetchClients } = useClientsStore();
  const { fetchQuotes } = useQuotesStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [isGeneratingQuote, setIsGeneratingQuote] = useState(false);

  const refreshData = useCallback(async () => {
    await Promise.all([fetchJobs(), fetchClients()]);
  }, [fetchJobs, fetchClients]);

  useEffect(() => {
    refreshData().finally(() => setIsInitialLoad(false));
  }, []);

  const handleGenerateQuote = async (jobId: string) => {
    try {
      setIsGeneratingQuote(true);
      const response = await api.post<any>(`/api/quotes/from-job/${jobId}`);
      
      if (response.data) {
        Alert.alert(
          'Quote Generated',
          `Quote ${response.data.number || response.data.quoteNumber || ''} has been created successfully.`,
          [
            { text: 'View Quote', onPress: () => router.push(`/more/quote/${response.data.id}`) },
            { text: 'OK', style: 'cancel' }
          ]
        );
        await fetchQuotes();
      } else if (response.error) {
        Alert.alert('Error', response.error || 'Failed to generate quote');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to generate quote from job');
    } finally {
      setIsGeneratingQuote(false);
    }
  };

  const getClientName = (clientId?: string) => {
    if (!clientId) return undefined;
    const client = clients.find(c => c.id === clientId);
    return client?.name;
  };

  const getClientPhone = (clientId?: string) => {
    if (!clientId) return undefined;
    const client = clients.find(c => c.id === clientId);
    return client?.phone;
  };

  const handleUpdateStatus = async (jobId: string, newStatus: string) => {
    try {
      await updateJobStatus(jobId, newStatus);
    } catch (error) {
      Alert.alert('Error', 'Failed to update job status');
    }
  };

  const statusCounts = {
    all: jobs.length,
    pending: jobs.filter(j => j.status === 'pending').length,
    scheduled: jobs.filter(j => j.status === 'scheduled').length,
    in_progress: jobs.filter(j => j.status === 'in_progress').length,
    done: jobs.filter(j => j.status === 'done').length,
    invoiced: jobs.filter(j => j.status === 'invoiced').length
  };

  const filteredJobs = jobs.filter(job => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      job.title.toLowerCase().includes(searchLower) ||
      (job.address?.toLowerCase().includes(searchLower)) ||
      (getClientName(job.clientId)?.toLowerCase().includes(searchLower));
    const matchesFilter = activeFilter === 'all' || job.status === activeFilter;
    return matchesSearch && matchesFilter;
  });

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

  const getThisWeekJobs = () => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    return jobs
      .filter(job => {
        const jobDate = job.createdAt || job.scheduledAt;
        if (!jobDate) return false;
        return new Date(jobDate) >= sevenDaysAgo;
      })
      .sort((a, b) => {
        const dateA = a.createdAt || a.scheduledAt;
        const dateB = b.createdAt || b.scheduledAt;
        if (dateA && dateB) {
          return new Date(dateB).getTime() - new Date(dateA).getTime();
        }
        return 0;
      })
      .slice(0, 5);
  };

  const recentJobs = getThisWeekJobs();

  return (
    <View style={styles.container}>
      {/* Sticky Header Section */}
      <View style={styles.stickyHeader}>
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.pageTitle}>Jobs</Text>
            <Text style={styles.pageSubtitle}>{jobs.length} total</Text>
          </View>
          <View style={styles.headerActions}>
            {/* View Mode Toggle */}
            <View style={styles.viewModeToggle}>
              <TouchableOpacity
                activeOpacity={0.8}
                style={[
                  styles.viewModeBtn,
                  viewMode === 'cards' && styles.viewModeBtnActive
                ]}
                onPress={() => setViewMode('cards')}
              >
                <Feather 
                  name="grid" 
                  size={iconSizes.md} 
                  color={viewMode === 'cards' ? colors.foreground : colors.mutedForeground} 
                />
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.8}
                style={[
                  styles.viewModeBtn,
                  viewMode === 'table' && styles.viewModeBtnActive
                ]}
                onPress={() => setViewMode('table')}
              >
                <Feather 
                  name="list" 
                  size={iconSizes.md} 
                  color={viewMode === 'table' ? colors.foreground : colors.mutedForeground} 
                />
              </TouchableOpacity>
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
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Feather name="x-circle" size={iconSizes.md} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
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
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refreshData}
            tintColor={colors.primary}
          />
        }
      >
        {/* Stats Cards Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statsRow}>
            <StatCard
              title="Total Jobs"
              value={statusCounts.all}
              icon={<Feather name="briefcase" size={iconSizes.xl} color={colors.primary} />}
              iconColor={colors.primary}
              onPress={() => setActiveFilter('all')}
            />
            <StatCard
              title="Scheduled"
              value={statusCounts.scheduled}
              icon={<Feather name="clock" size={iconSizes.xl} color={colors.scheduled} />}
              iconColor={colors.scheduled}
              onPress={() => setActiveFilter('scheduled')}
            />
          </View>
          <View style={styles.statsRow}>
            <StatCard
              title="In Progress"
              value={statusCounts.in_progress}
              icon={<Feather name="play" size={iconSizes.xl} color={colors.inProgress} />}
              iconColor={colors.inProgress}
              onPress={() => setActiveFilter('in_progress')}
            />
            <StatCard
              title="Completed"
              value={statusCounts.done}
              icon={<Feather name="check-circle" size={iconSizes.xl} color={colors.done} />}
              iconColor={colors.done}
              onPress={() => setActiveFilter('done')}
            />
          </View>
        </View>

        {/* Recent Activity Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="clock" size={iconSizes.md} color={colors.primary} />
            <Text style={styles.sectionTitle}>RECENT ACTIVITY</Text>
          </View>
          
          <View style={styles.activityCard}>
            <Text style={styles.activityLabel}>THIS WEEK</Text>
            
            {isLoading && isInitialLoad ? (
              <View style={styles.loadingContainer}>
                <JobsListSkeleton />
              </View>
            ) : isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : recentJobs.length > 0 ? (
              <View style={styles.activityList}>
                {recentJobs.map((job) => (
                  <RecentActivityItem
                    key={job.id}
                    job={{ ...job, clientName: job.clientName || getClientName(job.clientId) }}
                    onPress={() => router.push(`/job/${job.id}`)}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.emptyActivity}>
                <Text style={styles.emptyActivityText}>No recent activity</Text>
              </View>
            )}
          </View>
        </View>

        {/* All Jobs Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="briefcase" size={iconSizes.md} color={colors.primary} />
            <Text style={styles.sectionTitle}>ALL JOBS</Text>
          </View>
          
          {isLoading && isInitialLoad ? (
            <JobsListSkeleton />
          ) : isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : sortedJobs.length === 0 ? (
            searchQuery || activeFilter !== 'all' ? (
              <EmptyState
                type="search"
                title="No matching jobs"
                subtitle="Try adjusting your search or filters to find what you're looking for."
              />
            ) : (
              <EmptyState
                type="jobs"
                actionLabel="Create Job"
                onAction={navigateToCreateJob}
              />
            )
          ) : viewMode === 'table' ? (
            <View style={styles.tableContainer}>
              {/* Table Header */}
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Job</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Client</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Status</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Scheduled</Text>
                <View style={{ width: 24 }} />
              </View>
              {/* Table Rows */}
              {sortedJobs.map((job) => (
                <JobTableRow
                  key={job.id}
                  job={{ ...job, clientName: job.clientName || getClientName(job.clientId) }}
                  onPress={() => router.push(`/job/${job.id}`)}
                />
              ))}
            </View>
          ) : (
            <View style={styles.jobsList}>
              {sortedJobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={{ ...job, clientName: job.clientName || getClientName(job.clientId) }}
                  onPress={() => router.push(`/job/${job.id}`)}
                  onUpdateStatus={(status) => handleUpdateStatus(job.id, status)}
                  onGenerateQuote={() => handleGenerateQuote(job.id)}
                  clientPhone={getClientPhone(job.clientId)}
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
  stickyHeader: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    zIndex: 10,
  },
  scrollView: {
    flex: 1,
  },
  scrollContentContainer: {
    padding: spacing.lg,
    paddingBottom: pageShell.paddingBottom,
  },
  contentContainer: {
    padding: spacing.lg,
    paddingBottom: pageShell.paddingBottom,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  headerLeft: {},
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pageTitle: {
    ...typography.largeTitle,
    color: colors.foreground,
  },
  pageSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.xs / 2,
  },
  viewModeToggle: {
    flexDirection: 'row',
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  viewModeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.md,
  },
  viewModeBtnActive: {
    backgroundColor: colors.card,
    ...shadows.xs,
  },
  newJobButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.xs,
  },
  newJobButtonText: {
    ...typography.button,
    color: colors.white,
  },

  // Search Bar
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    height: sizes.inputHeight,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    marginLeft: spacing.md,
    color: colors.foreground,
    ...typography.cardTitle,
    fontWeight: '400',
  },

  // Filter Pills - pill-shaped with rounded ends
  filtersScroll: {
    marginBottom: spacing.lg,
    marginHorizontal: -spacing.lg,
  },
  filtersContent: {
    paddingHorizontal: spacing.lg,
    gap: 8,
    flexDirection: 'row',
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  filterPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.foreground,
  },
  filterPillTextActive: {
    color: colors.primaryForeground,
  },
  filterCount: {
    backgroundColor: colors.muted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    minWidth: 20,
    alignItems: 'center',
  },
  filterCountActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  filterCountText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.mutedForeground,
  },
  filterCountTextActive: {
    color: colors.primaryForeground,
  },

  // Stats Grid
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: spacing.md,
    ...shadows.sm,
  },
  statIconContainer: {
    width: 28,
    height: 28,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statTextContainer: {},
  statValue: {
    ...typography.statValue,
    color: colors.foreground,
  },
  statTitle: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
  },

  // Section
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.mutedForeground,
  },

  // Recent Activity - matches web Card p-4 (16px)
  activityCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  activityLabel: {
    ...typography.badge,
    color: colors.mutedForeground,
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },
  activityList: {
    gap: spacing.xs,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  activityDot: {
    width: sizes.dotSm,
    height: sizes.dotSm,
    borderRadius: sizes.dotSm / 2,
    backgroundColor: colors.primary,
  },
  activityContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  activityTitle: {
    ...typography.bodySemibold,
    color: colors.foreground,
    flex: 1,
  },
  activityDate: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  emptyActivity: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  emptyActivityText: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  loadingContainer: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },

  // Jobs List - compact with left accent bar
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
  },
  jobCardContent: {
    flex: 1,
    padding: 16,
  },
  jobCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.sm,
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
    marginTop: spacing.xs,
  },
  jobDetailText: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  jobMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    flexWrap: 'wrap',
    marginTop: spacing.xs,
  },
  inlineActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quickActionBtn: {
    width: 28,
    height: 28,
    borderRadius: radius.md,
    backgroundColor: `${colors.primary}10`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  statusActionText: {
    ...typography.captionSmall,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  jobCardChevronContainer: {
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
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
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyStateTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.foreground,
  },
  emptyStateSubtitle: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xl,
  },

  // FAB - 56px as per design spec
  fab: {
    position: 'absolute',
    bottom: pageShell.paddingBottom,
    right: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
  },

  // Table View Styles
  tableContainer: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
    ...shadows.sm,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.muted,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableHeaderCell: {
    ...typography.captionSmall,
    fontWeight: '600',
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableCell: {
    flex: 2,
  },
  tableCellClient: {
    flex: 1.5,
  },
  tableCellStatus: {
    flex: 1,
  },
  tableCellDate: {
    flex: 1,
  },
  tableCellChevron: {
    width: 24,
    alignItems: 'flex-end',
  },
  tableCellTitle: {
    ...typography.bodySemibold,
    color: colors.foreground,
  },
  tableCellText: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
});
