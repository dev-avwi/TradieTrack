import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  RefreshControl,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert
} from 'react-native';

import { router, useFocusEffect } from 'expo-router';
import { useContentWidth, isTablet, isIOS } from '../../src/lib/device';
import { Feather } from '@expo/vector-icons';
import { useJobsStore, useClientsStore } from '../../src/lib/store';
import { api } from '../../src/lib/api';
import { StatusBadge } from '../../src/components/ui/StatusBadge';
import { XeroBadge } from '../../src/components/ui/XeroBadge';
import { AnimatedCardPressable } from '../../src/components/ui/AnimatedPressable';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, shadows, sizes, pageShell, typography, iconSizes } from '../../src/lib/design-tokens';
import { useScrollToTop } from '../../src/contexts/ScrollContext';
import { getJobUrgency, type JobUrgency } from '../../src/lib/jobUrgency';
import { useIOSStyles, IOSCorners, IOSShadows, IOSSystemColors } from '../../src/lib/ios-design';
import { LiquidGlassScrollView } from '../../src/components/ui/LiquidGlassScrollView';
import { GlassSection } from '../../src/components/ui/GlassSection';
import { GlassChip } from '../../src/components/ui/GlassChip';
import { GlassJobCard } from '../../src/components/ui/GlassJobCard';
import { GlassFAB } from '../../src/components/ui/GlassFAB';
import { GlassSearchBar } from '../../src/components/ui/GlassSearchBar';

const navigateToCreateJob = () => {
  router.push('/more/create-job');
};

type JobStatus = 'pending' | 'scheduled' | 'in_progress' | 'done' | 'invoiced';
type GlassJobStatus = 'pending' | 'confirmed' | 'in-progress' | 'done' | 'invoiced';

const mapToGlassStatus = (status: JobStatus): GlassJobStatus => {
  switch (status) {
    case 'scheduled': return 'confirmed';
    case 'in_progress': return 'in-progress';
    default: return status as GlassJobStatus;
  }
};

const formatScheduledTime = (dateStr?: string): string | undefined => {
  if (!dateStr) return undefined;
  const date = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const timeStr = date.toLocaleTimeString('en-AU', { 
    hour: 'numeric', 
    minute: '2-digit', 
    hour12: true 
  }).toUpperCase();
  
  if (date.toDateString() === today.toDateString()) {
    return `Today, ${timeStr}`;
  }
  if (date.toDateString() === tomorrow.toDateString()) {
    return `Tomorrow, ${timeStr}`;
  }
  return date.toLocaleDateString('en-AU', { 
    weekday: 'short', 
    day: 'numeric', 
    month: 'short',
  }) + ', ' + timeStr;
};

const STATUS_FILTERS: { key: string; label: string; icon: string }[] = [
  { key: 'all', label: 'All', icon: 'briefcase' },
  { key: 'recurring', label: 'Recurring', icon: 'repeat' },
  { key: 'pending', label: 'Pending', icon: 'clock' },
  { key: 'scheduled', label: 'Scheduled', icon: 'calendar' },
  { key: 'in_progress', label: 'In Progress', icon: 'play' },
  { key: 'done', label: 'Done', icon: 'check-circle' },
  { key: 'invoiced', label: 'Invoiced', icon: 'file-text' },
];

function JobListRow({ 
  job, 
  onPress,
  onDelete,
  onQuickAction,
}: { 
  job: any;
  onPress: () => void;
  onDelete: (jobId: string) => void;
  onQuickAction?: (action: string, jobId: string) => void;
}) {
  const { colors } = useTheme();
  const contentWidth = useContentWidth();
  const styles = useMemo(() => createStyles(colors, contentWidth), [colors, contentWidth]);
  
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-AU', { 
      day: 'numeric', 
      month: 'short',
    });
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Job',
      `Are you sure you want to delete "${job.title || 'Untitled Job'}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => onDelete(job.id)
        }
      ]
    );
  };

  const handleMorePress = () => {
    const actions: { text: string; onPress?: () => void; style?: 'cancel' | 'destructive' }[] = [];
    
    actions.push({ text: 'View Details', onPress: () => router.push(`/job/${job.id}`) });
    
    if (job.status === 'pending') {
      actions.push({ text: 'Schedule Job', onPress: () => onQuickAction?.('schedule', job.id) });
    }
    if (job.status === 'scheduled') {
      actions.push({ text: 'Start Job', onPress: () => onQuickAction?.('start', job.id) });
    }
    if (job.status === 'in_progress') {
      actions.push({ text: 'Complete Job', onPress: () => onQuickAction?.('complete', job.id) });
    }
    if (job.status !== 'invoiced') {
      actions.push({ text: 'Create Quote', onPress: () => router.push(`/more/quote/new?jobId=${job.id}`) });
    }
    if (job.status === 'done') {
      actions.push({ text: 'Create Invoice', onPress: () => router.push(`/more/invoice/new?jobId=${job.id}`) });
    }
    
    actions.push({ 
      text: 'Delete Job', 
      style: 'destructive',
      onPress: handleDelete
    });
    
    actions.push({ text: 'Cancel', style: 'cancel' });
    
    Alert.alert('Job Actions', job.title || 'Untitled Job', actions);
  };

  return (
    <AnimatedCardPressable
      onPress={onPress}
      style={styles.jobListRow}
    >
      <View style={styles.jobListRowContent}>
        <View style={styles.jobListRowLeft}>
          <Text style={styles.jobListRowTitle} numberOfLines={1}>{job.title || 'Untitled Job'}</Text>
          <Text style={styles.jobListRowAddress} numberOfLines={1}>{job.address?.split(',')[0] || 'No address'}</Text>
        </View>
        <View style={styles.jobListRowCenter}>
          <StatusBadge status={job.status} size="sm" />
        </View>
        <Text style={styles.jobListRowDate}>
          {formatDate(job.scheduledAt)}
        </Text>
        <TouchableOpacity 
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={handleDelete}
          style={styles.jobListRowAction}
        >
          <Feather name="trash-2" size={iconSizes.sm} color={colors.destructive} />
        </TouchableOpacity>
        <TouchableOpacity 
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={handleMorePress}
          style={styles.jobListRowAction}
        >
          <Feather name="more-vertical" size={iconSizes.md} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>
    </AnimatedCardPressable>
  );
}

function JobCard({ 
  job, 
  onPress,
  onQuickAction
}: { 
  job: any;
  onPress: () => void;
  onQuickAction?: (action: string, jobId: string) => void;
}) {
  const { colors } = useTheme();
  const contentWidth = useContentWidth();
  const styles = useMemo(() => createStyles(colors, contentWidth), [colors, contentWidth]);
  
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

  const urgency = getJobUrgency(job.scheduledAt, job.status);

  const handleMorePress = () => {
    const actions: { text: string; onPress?: () => void; style?: 'cancel' | 'destructive' }[] = [];
    
    actions.push({ text: 'View Details', onPress: () => router.push(`/job/${job.id}`) });
    
    if (job.status === 'pending') {
      actions.push({ text: 'Schedule Job', onPress: () => onQuickAction?.('schedule', job.id) });
    }
    if (job.status === 'scheduled') {
      actions.push({ text: 'Start Job', onPress: () => onQuickAction?.('start', job.id) });
    }
    if (job.status === 'in_progress') {
      actions.push({ text: 'Complete Job', onPress: () => onQuickAction?.('complete', job.id) });
    }
    if (job.status !== 'invoiced') {
      actions.push({ text: 'Create Quote', onPress: () => router.push(`/more/quote/new?jobId=${job.id}`) });
    }
    if (job.status === 'done') {
      actions.push({ text: 'Create Invoice', onPress: () => router.push(`/more/invoice/new?jobId=${job.id}`) });
    }
    
    actions.push({ text: 'Cancel', style: 'cancel' });
    
    Alert.alert('Job Actions', job.title || 'Untitled Job', actions);
  };

  return (
    <AnimatedCardPressable
      onPress={onPress}
      style={[styles.jobCard, job.isXeroImport && { overflow: 'visible' }]}
    >
      {job.isXeroImport && <XeroBadge size="sm" />}
      <View style={styles.jobCardContent}>
        <View style={styles.jobCardStatusRow}>
          <StatusBadge status={job.status} size="sm" />
          {job.isRecurring && (
            <View style={styles.recurringBadge}>
              <Feather name="repeat" size={10} color={colors.primary} />
              <Text style={styles.recurringBadgeText}>Recurring</Text>
            </View>
          )}
          {urgency && (
            <View style={[styles.urgencyBadge, { backgroundColor: urgency.bgColor }]}>
              {urgency.animate && (
                <View style={[styles.urgencyDot, { backgroundColor: urgency.color }]} />
              )}
              <Text style={[styles.urgencyBadgeText, { color: urgency.color }]} numberOfLines={1}>
                {urgency.shortLabel}
              </Text>
            </View>
          )}
          <TouchableOpacity 
            style={styles.moreButton}
            onPress={handleMorePress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather name="more-horizontal" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        <Text style={styles.jobTitle} numberOfLines={2}>{job.title || 'Untitled Job'}</Text>
        
        {job.isRecurring && job.nextRecurrenceDate && (
          <Text style={styles.nextRecurrenceText}>
            Next: {new Date(job.nextRecurrenceDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
          </Text>
        )}

        <View style={styles.jobCardDetails}>
          {job.clientName && (
            <View style={styles.jobDetailRow}>
              <Feather name="user" size={iconSizes.sm} color={colors.mutedForeground} />
              <Text style={styles.jobDetailText} numberOfLines={1}>{job.clientName}</Text>
            </View>
          )}
          {job.address && (
            <View style={styles.jobDetailRow}>
              <Feather name="map-pin" size={iconSizes.sm} color={colors.mutedForeground} />
              <Text style={styles.jobDetailText} numberOfLines={1}>{job.address.split(',')[0]}</Text>
            </View>
          )}
          <View style={styles.jobDetailRow}>
            <Feather name="calendar" size={iconSizes.sm} color={colors.mutedForeground} />
            <Text style={styles.jobDetailText} numberOfLines={1}>
              {job.scheduledAt ? formatDate(job.scheduledAt) : 'Not scheduled'}
            </Text>
          </View>
        </View>

        {job.status === 'done' && (
          <TouchableOpacity
            style={styles.invoiceBtn}
            onPress={(e) => {
              e.stopPropagation?.();
              router.push(`/more/invoice/new?jobId=${job.id}`);
            }}
            activeOpacity={0.8}
          >
            <Feather name="file-text" size={iconSizes.sm} color={colors.white} />
            <Text style={styles.invoiceBtnText}>Invoice</Text>
          </TouchableOpacity>
        )}
      </View>
    </AnimatedCardPressable>
  );
}

export default function JobsScreen() {
  const { colors, isDark } = useTheme();
  const contentWidth = useContentWidth();
  const isTabletDevice = isTablet();
  const iosStyles = useIOSStyles(isDark);
  const styles = useMemo(() => createStyles(colors, contentWidth, isDark), [colors, contentWidth, isDark]);
  const scrollRef = useRef<ScrollView | null>(null);
  const { scrollToTopTrigger } = useScrollToTop();
  
  useEffect(() => {
    if (scrollToTopTrigger > 0) {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }
  }, [scrollToTopTrigger]);
  
  const { jobs, fetchJobs, isLoading, updateJobStatus } = useJobsStore();
  const { clients, fetchClients } = useClientsStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Sort state matching Documents page pattern
  type SortField = 'title' | 'status' | 'date';
  type SortDirection = 'asc' | 'desc';
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSortChange = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }, [sortField]);

  // Sort indicator with stacked up/down chevrons (matching Documents page)
  const SortIndicator = ({ field, isActive }: { field: SortField; isActive: boolean }) => (
    <View style={styles.sortIndicator}>
      <Feather 
        name="chevron-up" 
        size={10} 
        color={isActive ? colors.primary : colors.mutedForeground} 
        style={{ marginBottom: -3 }}
      />
      <Feather 
        name="chevron-down" 
        size={10} 
        color={isActive ? colors.primary : colors.mutedForeground} 
        style={{ marginTop: -3 }}
      />
    </View>
  );

  const refreshData = useCallback(async () => {
    await Promise.all([fetchJobs(), fetchClients()]);
  }, [fetchJobs, fetchClients]);

  const handleQuickAction = useCallback(async (action: string, jobId: string) => {
    if (action === 'schedule') {
      router.push(`/job/${jobId}?action=schedule`);
    } else if (action === 'start') {
      Alert.alert(
        'Start Job',
        'Are you sure you want to start this job?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Start', 
            onPress: async () => {
              await updateJobStatus(jobId, 'in_progress');
              refreshData();
            }
          }
        ]
      );
    } else if (action === 'complete') {
      router.push(`/job/${jobId}?action=complete`);
    }
  }, [updateJobStatus, refreshData]);

  const handleDeleteJob = useCallback(async (jobId: string) => {
    try {
      const response = await api.delete(`/api/jobs/${jobId}`);
      if (response.error) {
        Alert.alert('Error', 'Failed to delete job. Please try again.');
        return;
      }
      refreshData();
    } catch (error) {
      Alert.alert('Error', 'Failed to delete job. Please try again.');
    }
  }, [refreshData]);

  useEffect(() => {
    refreshData();
  }, []);

  // Refresh data when screen gains focus (syncs with web app)
  useFocusEffect(
    useCallback(() => {
      refreshData();
    }, [refreshData])
  );

  const getClientName = (clientId?: string) => {
    if (!clientId) return undefined;
    const client = clients.find(c => c.id === clientId);
    return client?.name;
  };

  const statusCounts = useMemo(() => {
    const counts = {
      all: jobs.length,
      recurring: 0,
      pending: 0,
      scheduled: 0,
      in_progress: 0,
      done: 0,
      invoiced: 0,
    };
    
    jobs.forEach(job => {
      if (job.isRecurring) counts.recurring++;
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
    
    if (activeFilter === 'recurring') {
      return filterBySearch(jobs.filter(job => job.isRecurring));
    }
    
    return filterBySearch(jobs.filter(job => job.status === activeFilter));
  };

  const filteredJobs = getFilteredJobs();

  // Get the canonical date for a job (scheduled > completed > created)
  const getJobDate = (job: any): Date | null => {
    const dateStr = job.scheduledAt || job.completedAt || job.createdAt;
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
  };

  // Sort jobs based on current sort field and direction
  const sortedJobs = useMemo(() => {
    const jobsCopy = [...filteredJobs];
    
    // For grid view, use the original upcoming/past date-based sorting
    if (viewMode === 'grid') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const upcomingJobs: typeof jobsCopy = [];
      const pastJobs: typeof jobsCopy = [];
      
      jobsCopy.forEach(job => {
        const jobDate = getJobDate(job);
        if (!jobDate || jobDate < today) {
          pastJobs.push(job);
        } else {
          upcomingJobs.push(job);
        }
      });
      
      const sortAscending = (a: any, b: any) => {
        const dateA = getJobDate(a);
        const dateB = getJobDate(b);
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        return dateA.getTime() - dateB.getTime();
      };
      
      upcomingJobs.sort(sortAscending);
      pastJobs.sort(sortAscending);
      
      return [...upcomingJobs, ...pastJobs];
    }
    
    // For list view, use the selected sort field and direction
    return jobsCopy.sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'title':
          comparison = (a.title || '').localeCompare(b.title || '');
          break;
        case 'status':
          comparison = (a.status || '').localeCompare(b.status || '');
          break;
        case 'date':
          const dateA = getJobDate(a);
          const dateB = getJobDate(b);
          if (!dateA && !dateB) comparison = 0;
          else if (!dateA) comparison = 1;
          else if (!dateB) comparison = -1;
          else comparison = dateA.getTime() - dateB.getTime();
          break;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredJobs, viewMode, sortField, sortDirection]);

  return (
    <View style={styles.container}>
      <LiquidGlassScrollView 
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        hasTabBar={true}
        hasHeader={true}
        showBackground={true}
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
          <View style={styles.headerRight}>
            <View style={styles.viewToggle}>
              <TouchableOpacity
                activeOpacity={0.8}
                style={[styles.viewToggleBtn, viewMode === 'grid' && styles.viewToggleBtnActive]}
                onPress={() => setViewMode('grid')}
              >
                <Feather name="grid" size={iconSizes.md} color={viewMode === 'grid' ? colors.primary : colors.mutedForeground} />
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.8}
                style={[styles.viewToggleBtn, viewMode === 'list' && styles.viewToggleBtnActive]}
                onPress={() => setViewMode('list')}
              >
                <Feather name="list" size={iconSizes.md} color={viewMode === 'list' ? colors.primary : colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.newJobButton}
              onPress={navigateToCreateJob}
            >
              <Feather name="plus" size={iconSizes.lg} color={colors.white} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar */}
        {isIOS ? (
          <View style={styles.glassSearchContainer}>
            <GlassSearchBar
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search jobs, clients, addresses..."
              showCancel={false}
            />
          </View>
        ) : (
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
        )}

        {/* Filter Pills with Counts */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.filtersScroll}
          contentContainerStyle={styles.filtersContent}
        >
          {isIOS ? (
            STATUS_FILTERS.map((filter) => {
              const count = statusCounts[filter.key as keyof typeof statusCounts] || 0;
              return (
                <GlassChip
                  key={filter.key}
                  label={filter.label}
                  selected={activeFilter === filter.key}
                  onPress={() => setActiveFilter(filter.key)}
                  icon={filter.icon}
                  count={count}
                  size="medium"
                />
              );
            })
          ) : (
            STATUS_FILTERS.map((filter) => {
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
            })
          )}
        </ScrollView>

        {/* KPI Stats Grid */}
        <View style={styles.kpiGrid}>
          <TouchableOpacity 
            style={styles.kpiCard} 
            onPress={() => setActiveFilter('all')}
            activeOpacity={0.8}
          >
            <View style={[styles.kpiIcon, { backgroundColor: `${colors.primary}15` }]}>
              <Feather name="briefcase" size={iconSizes.lg} color={colors.primary} />
            </View>
            <View>
              <Text style={styles.kpiValue}>{statusCounts.all}</Text>
              <Text style={styles.kpiLabel}>Total Jobs</Text>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.kpiCard} 
            onPress={() => setActiveFilter('scheduled')}
            activeOpacity={0.8}
          >
            <View style={[styles.kpiIcon, { backgroundColor: `${colors.scheduled}15` }]}>
              <Feather name="calendar" size={iconSizes.lg} color={colors.scheduled} />
            </View>
            <View>
              <Text style={styles.kpiValue}>{statusCounts.scheduled}</Text>
              <Text style={styles.kpiLabel}>Scheduled</Text>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.kpiCard} 
            onPress={() => setActiveFilter('in_progress')}
            activeOpacity={0.8}
          >
            <View style={[styles.kpiIcon, { backgroundColor: `${colors.inProgress}15` }]}>
              <Feather name="play" size={iconSizes.lg} color={colors.inProgress} />
            </View>
            <View>
              <Text style={styles.kpiValue}>{statusCounts.in_progress}</Text>
              <Text style={styles.kpiLabel}>In Progress</Text>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.kpiCard} 
            onPress={() => setActiveFilter('done')}
            activeOpacity={0.8}
          >
            <View style={[styles.kpiIcon, { backgroundColor: `${colors.done}15` }]}>
              <Feather name="check-circle" size={iconSizes.lg} color={colors.done} />
            </View>
            <View>
              <Text style={styles.kpiValue}>{statusCounts.done}</Text>
              <Text style={styles.kpiLabel}>Completed</Text>
            </View>
          </TouchableOpacity>
        </View>

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
          ) : viewMode === 'grid' ? (
            isIOS ? (
              <GlassSection title="Jobs" subtitle={`${sortedJobs.length} found`} padding="small">
                <View style={styles.glassJobsGrid}>
                  {sortedJobs.map((job, index) => (
                    <GlassJobCard
                      key={job.id}
                      title={job.title || 'Untitled Job'}
                      client={job.clientName || getClientName(job.clientId) || 'No client'}
                      status={mapToGlassStatus(job.status)}
                      scheduledTime={formatScheduledTime(job.scheduledAt)}
                      address={job.address?.split(',')[0]}
                      onPress={() => router.push(`/job/${job.id}`)}
                      isFirst={index === 0}
                      isLast={index === sortedJobs.length - 1}
                    />
                  ))}
                </View>
              </GlassSection>
            ) : (
              <View style={styles.jobsGrid}>
                {sortedJobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={{ ...job, clientName: job.clientName || getClientName(job.clientId) }}
                    onPress={() => router.push(`/job/${job.id}`)}
                    onQuickAction={handleQuickAction}
                  />
                ))}
              </View>
            )
          ) : (
            <View style={styles.jobsList}>
              <View style={styles.listHeader}>
                <TouchableOpacity
                  style={styles.sortHeaderTitleColumn}
                  onPress={() => handleSortChange('title')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.listHeaderCol, sortField === 'title' && styles.listHeaderColActive]}>Job</Text>
                  <SortIndicator field="title" isActive={sortField === 'title'} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sortHeaderStatusColumn, { width: 80 }]}
                  onPress={() => handleSortChange('status')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.listHeaderCol, styles.listHeaderColStatus, sortField === 'status' && styles.listHeaderColActive]}>Status</Text>
                  <SortIndicator field="status" isActive={sortField === 'status'} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sortHeaderDateColumn, { width: 70 }]}
                  onPress={() => handleSortChange('date')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.listHeaderCol, styles.listHeaderColDate, sortField === 'date' && styles.listHeaderColActive]}>Date</Text>
                  <SortIndicator field="date" isActive={sortField === 'date'} />
                </TouchableOpacity>
              </View>
              {sortedJobs.map((job) => (
                <JobListRow
                  key={job.id}
                  job={{ ...job, clientName: job.clientName || getClientName(job.clientId) }}
                  onPress={() => router.push(`/job/${job.id}`)}
                  onDelete={handleDeleteJob}
                  onQuickAction={handleQuickAction}
                />
              ))}
            </View>
          )}
        </View>
      </LiquidGlassScrollView>
      
      {/* Floating Action Button for iOS */}
      {isIOS && (
        <GlassFAB
          onPress={navigateToCreateJob}
          icon="plus"
          variant="primary"
          position="bottom-right"
        />
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors, contentWidth: number, isDark: boolean = false) => {
  const iosColors = isDark ? IOSSystemColors.dark : IOSSystemColors.light;
  
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: isIOS ? 'transparent' : colors.background,
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: colors.muted,
    borderRadius: radius.md,
    padding: 2,
  },
  viewToggleBtn: {
    padding: spacing.sm,
    borderRadius: radius.sm,
  },
  viewToggleBtnActive: {
    backgroundColor: colors.card,
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.xs,
    ...shadows.sm,
  },
  newJobButtonText: {
    color: colors.primaryForeground,
    ...typography.caption,
    fontWeight: '600',
  },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isIOS ? iosColors.secondarySystemGroupedBackground : colors.card,
    borderRadius: isIOS ? IOSCorners.card : radius.xl,
    paddingHorizontal: spacing.lg,
    height: sizes.searchBarHeight,
    marginBottom: spacing.lg,
    gap: spacing.md,
    borderWidth: isIOS ? 0 : 1,
    borderColor: colors.cardBorder,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.foreground,
  },
  glassSearchContainer: {
    marginHorizontal: -pageShell.paddingHorizontal,
    marginBottom: spacing.sm,
  },

  filtersScroll: {
    marginBottom: spacing.md,
    marginHorizontal: -pageShell.paddingHorizontal,
  },
  filtersContent: {
    paddingHorizontal: pageShell.paddingHorizontal,
    gap: spacing.sm,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    minHeight: sizes.filterChipHeight,
    borderRadius: radius.xl,
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
    ...typography.caption,
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
    ...typography.captionSmall,
    fontWeight: '600',
    color: colors.foreground,
  },
  filterCountTextActive: {
    color: colors.white,
  },

  section: {
    marginBottom: spacing['2xl'],
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.label,
    letterSpacing: 0.5,
    color: colors.foreground,
  },

  loadingContainer: {
    paddingVertical: spacing['3xl'],
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing['4xl'],
    backgroundColor: isIOS ? iosColors.secondarySystemGroupedBackground : colors.card,
    borderRadius: isIOS ? IOSCorners.card : radius.xl,
    borderWidth: isIOS ? 0 : 1,
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

  jobsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  glassJobsGrid: {
    gap: spacing.xs,
  },
  jobsList: {
    gap: spacing.sm,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  listHeaderCol: {
    flex: 1,
    ...typography.captionSmall,
    color: colors.mutedForeground,
    fontWeight: '600',
  },
  listHeaderColStatus: {
    textAlign: 'center',
    flex: 0,
    width: 80,
  },
  listHeaderColDate: {
    textAlign: 'right',
    flex: 0,
    width: 70,
  },
  listHeaderColActive: {
    color: colors.primary,
  },
  sortIndicator: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  sortHeaderTitleColumn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  sortHeaderStatusColumn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortHeaderDateColumn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  jobListRow: {
    backgroundColor: isIOS ? iosColors.secondarySystemGroupedBackground : colors.card,
    borderRadius: isIOS ? IOSCorners.card : radius.lg,
    borderWidth: isIOS ? 0 : 1,
    borderColor: colors.cardBorder,
  },
  jobListRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  jobListRowLeft: {
    flex: 1,
    minWidth: 0,
  },
  jobListRowCenter: {
    width: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jobListRowTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 2,
  },
  jobListRowAddress: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  jobListRowDate: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    width: 70,
    textAlign: 'right',
  },
  jobListRowAction: {
    padding: spacing.xs,
  },
  jobCard: {
    width: (contentWidth - pageShell.paddingHorizontal * 2 - spacing.sm) / 2,
    backgroundColor: isIOS ? iosColors.secondarySystemGroupedBackground : colors.card,
    borderRadius: isIOS ? IOSCorners.card : radius.xl,
    borderWidth: isIOS ? 0 : 1,
    borderColor: colors.cardBorder,
    ...(isIOS ? IOSShadows.card : shadows.sm),
  },
  jobCardAccent: {
    display: 'none',
  },
  jobCardContent: {
    padding: spacing.md,
  },
  jobCardStatusRow: {
    marginBottom: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  recurringBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.sm,
    gap: 3,
  },
  recurringBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.primary,
  },
  nextRecurrenceText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '500',
    marginBottom: spacing.xs,
  },
  jobTitle: {
    ...typography.bodySemibold,
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  jobCardDetails: {
    gap: spacing.xs,
  },
  jobDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  jobDetailText: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    flex: 1,
  },
  invoiceBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 32,
  },
  invoiceBtnText: {
    ...typography.captionSmall,
    fontWeight: '600',
    color: colors.white,
  },

  urgencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    gap: 4,
  },
  urgencyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  urgencyBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  moreButton: {
    marginLeft: 'auto',
    padding: spacing.xs,
  },

  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  kpiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    width: (contentWidth - pageShell.paddingHorizontal * 2 - spacing.sm) / 2,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  kpiIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
  },
  kpiLabel: {
    fontSize: 11,
    color: colors.mutedForeground,
  },
});};
