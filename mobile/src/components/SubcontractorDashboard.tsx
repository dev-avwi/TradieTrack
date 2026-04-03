import { useEffect, useCallback, useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuthStore } from '../lib/store';
import { api } from '../lib/api';
import { formatCurrency as formatCurrencyUtil } from '../lib/format';
import { useTheme, ThemeColors, colorWithOpacity } from '../lib/theme';
import { spacing, radius, shadows, typography, pageShell, usePageShell } from '../lib/design-tokens';
import { useScrollToTop } from '../contexts/ScrollContext';

interface SubcontractorJob {
  id: string;
  title: string;
  description?: string;
  address?: string;
  status: string;
  scheduledAt?: string;
  scheduledTime?: string;
  estimatedDuration?: number;
  latitude?: string;
  longitude?: string;
  clientName?: string;
  businessName: string;
  businessColor: string;
  businessOwnerId: string;
  assignmentStatus: string;
  completedAt?: string;
  startedAt?: string;
}

interface DashboardData {
  availabilityStatus: string;
  todaysJobs: SubcontractorJob[];
  weekJobs: SubcontractorJob[];
  pendingRequests: SubcontractorJob[];
  activeJob: SubcontractorJob | null;
  earningsWeek: number;
  earningsMonth: number;
  earningsByBusiness: { businessName: string; amount: number }[];
  businesses: { id: string; name: string; color: string }[];
}

type ViewMode = 'today' | 'week';
type AvailabilityStatus = 'available' | 'busy' | 'unavailable';

const AVAILABILITY_CONFIG: Record<AvailabilityStatus, { label: string; icon: keyof typeof Feather.glyphMap; colorKey: string }> = {
  available: { label: 'Available', icon: 'check-circle', colorKey: 'success' },
  busy: { label: 'Busy', icon: 'clock', colorKey: 'warning' },
  unavailable: { label: 'Unavailable', icon: 'x-circle', colorKey: 'muted' },
};

export function SubcontractorDashboard() {
  const { colors } = useTheme();
  const responsiveShell = usePageShell();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scrollRef = useRef<ScrollView | null>(null);
  const { scrollToTopTrigger } = useScrollToTop();

  const { user } = useAuthStore();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('today');
  const [isUpdatingAvailability, setIsUpdatingAvailability] = useState(false);
  const [acceptingJobId, setAcceptingJobId] = useState<string | null>(null);
  const [decliningJobId, setDecliningJobId] = useState<string | null>(null);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [declineJobId, setDeclineJobId] = useState<string | null>(null);
  const [showEarningsBreakdown, setShowEarningsBreakdown] = useState(false);
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});
  const [elapsedTime, setElapsedTime] = useState('00:00:00');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (scrollToTopTrigger > 0) {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }
  }, [scrollToTopTrigger]);

  const fetchDashboard = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    try {
      const response = await api.get<DashboardData>('/api/subcontractor/dashboard');
      if (response.data) {
        setData(response.data);
      }
    } catch (error) {
      if (__DEV__) console.log('Error fetching subcontractor dashboard:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Timer for active job
  useEffect(() => {
    if (data?.activeJob?.startedAt) {
      const updateTimer = () => {
        const start = new Date(data.activeJob!.startedAt!).getTime();
        const now = Date.now();
        const diff = Math.max(0, now - start);
        const hours = Math.floor(diff / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setElapsedTime(
          `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
        );
      };
      updateTimer();
      timerRef.current = setInterval(updateTimer, 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [data?.activeJob?.startedAt]);

  const toggleAvailability = useCallback(async (newStatus: AvailabilityStatus) => {
    if (isUpdatingAvailability || !data) return;
    setIsUpdatingAvailability(true);
    try {
      await api.patch('/api/subcontractor/availability-status', { status: newStatus });
      setData(prev => prev ? { ...prev, availabilityStatus: newStatus } : prev);
    } catch (error) {
      Alert.alert('Error', 'Failed to update availability status');
    } finally {
      setIsUpdatingAvailability(false);
    }
  }, [isUpdatingAvailability, data]);

  const acceptJob = useCallback(async (jobId: string) => {
    setAcceptingJobId(jobId);
    try {
      await api.post(`/api/subcontractor/jobs/${jobId}/accept`);
      fetchDashboard();
    } catch (error) {
      Alert.alert('Error', 'Failed to accept job');
    } finally {
      setAcceptingJobId(null);
    }
  }, [fetchDashboard]);

  const startDeclineJob = useCallback((jobId: string) => {
    setDeclineJobId(jobId);
    setDeclineReason('');
    setShowDeclineModal(true);
  }, []);

  const confirmDeclineJob = useCallback(async () => {
    if (!declineJobId) return;
    setDecliningJobId(declineJobId);
    setShowDeclineModal(false);
    try {
      await api.post(`/api/subcontractor/jobs/${declineJobId}/decline`, {
        reason: declineReason || undefined,
      });
      fetchDashboard();
    } catch (error) {
      Alert.alert('Error', 'Failed to decline job');
    } finally {
      setDecliningJobId(null);
      setDeclineJobId(null);
      setDeclineReason('');
    }
  }, [declineJobId, declineReason, fetchDashboard]);

  const openDirections = useCallback((address?: string, lat?: string, lon?: string) => {
    if (lat && lon) {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`);
    } else if (address) {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`);
    }
  }, []);

  const formatTime = useCallback((dateStr?: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true });
  }, []);

  const formatDate = useCallback((dateStr?: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
  }, []);

  const getAvailabilityColor = useCallback((status: string): string => {
    switch (status) {
      case 'available': return colors.success;
      case 'busy': return colors.warning;
      case 'unavailable': return colors.mutedForeground;
      default: return colors.success;
    }
  }, [colors]);

  const toggleDay = useCallback((day: string) => {
    setExpandedDays(prev => ({ ...prev, [day]: !prev[day] }));
  }, []);

  const userName = user?.firstName || user?.email?.split('@')[0] || 'there';

  const displayJobs = viewMode === 'today' ? (data?.todaysJobs ?? []) : (data?.weekJobs ?? []);
  const currentAvailability = ((data?.availabilityStatus) || 'available') as AvailabilityStatus;

  const jobsByDay = useMemo(() => {
    if (viewMode !== 'week') return {};
    const grouped: Record<string, SubcontractorJob[]> = {};
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    for (let i = 0; i < 7; i++) {
      const day = new Date(todayStart.getTime() + i * 24 * 60 * 60 * 1000);
      const dateKey = day.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' });
      grouped[dateKey] = [];
    }
    if (data) {
      for (const job of data.weekJobs) {
        if (job.scheduledAt) {
          const d = new Date(job.scheduledAt);
          const dateKey = d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' });
          if (grouped[dateKey]) {
            grouped[dateKey].push(job);
          }
        }
      }
    }
    return grouped;
  }, [viewMode, data]);

  if (isLoading || !data) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <ScrollView
        ref={scrollRef}
        style={styles.container}
        contentContainerStyle={{
          paddingHorizontal: responsiveShell.paddingHorizontal,
          paddingTop: responsiveShell.paddingTop,
          paddingBottom: responsiveShell.paddingBottom + 40,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => fetchDashboard(true)}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Text style={styles.headerTitle}>
                G'day, {userName}
              </Text>
              <View style={[styles.roleBadge, { backgroundColor: colorWithOpacity(colors.primary, 0.1) }]}>
                <Text style={[styles.roleBadgeText, { color: colors.primary }]}>
                  Subcontractor
                </Text>
              </View>
            </View>
            <Text style={styles.headerSubtitle}>
              {new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}
              {data.todaysJobs.length > 0
                ? ` \u00b7 ${data.todaysJobs.length} job${data.todaysJobs.length > 1 ? 's' : ''} today`
                : ''}
            </Text>
          </View>
        </View>

        {/* Availability Toggle */}
        <View style={styles.availabilityCard}>
          <Text style={styles.availabilitySectionLabel}>Your Status</Text>
          <View style={styles.availabilityRow}>
            {(['available', 'busy', 'unavailable'] as AvailabilityStatus[]).map((status) => {
              const config = AVAILABILITY_CONFIG[status];
              const isActive = currentAvailability === status;
              const statusColor = getAvailabilityColor(status);
              return (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.availabilityButton,
                    {
                      backgroundColor: isActive ? colorWithOpacity(statusColor, 0.12) : colors.muted,
                      borderColor: isActive ? statusColor : colors.border,
                    },
                  ]}
                  onPress={() => toggleAvailability(status)}
                  activeOpacity={0.7}
                  disabled={isUpdatingAvailability}
                >
                  {isUpdatingAvailability && isActive ? (
                    <ActivityIndicator size="small" color={statusColor} />
                  ) : (
                    <Feather name={config.icon} size={16} color={isActive ? statusColor : colors.mutedForeground} />
                  )}
                  <Text style={[
                    styles.availabilityButtonText,
                    { color: isActive ? statusColor : colors.mutedForeground, fontWeight: isActive ? '700' : '500' },
                  ]}>
                    {config.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Active Job Card */}
        {data.activeJob && (
          <View style={[styles.activeJobCard, { borderColor: data.activeJob.businessColor }]}>
            <View style={styles.activeJobHeader}>
              <View style={[styles.activeJobPulse, { backgroundColor: colors.success }]} />
              <Text style={styles.activeJobLabel}>In Progress</Text>
              <Text style={styles.activeJobTimer}>{elapsedTime}</Text>
            </View>
            <View style={styles.activeJobContent}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
                <View style={[styles.businessDot, { backgroundColor: data.activeJob.businessColor }]} />
                <Text style={styles.activeJobBusiness}>{data.activeJob.businessName}</Text>
              </View>
              <Text style={styles.activeJobTitle}>{data.activeJob.title}</Text>
              {data.activeJob.address && (
                <TouchableOpacity
                  style={styles.activeJobAddressRow}
                  onPress={() => openDirections(data.activeJob!.address, data.activeJob!.latitude, data.activeJob!.longitude)}
                  activeOpacity={0.7}
                >
                  <Feather name="map-pin" size={14} color={colors.primary} />
                  <Text style={[styles.activeJobAddress, { color: colors.primary }]} numberOfLines={1}>
                    {data.activeJob.address}
                  </Text>
                  <Feather name="navigation" size={12} color={colors.primary} />
                </TouchableOpacity>
              )}
              {data.activeJob.clientName && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs }}>
                  <Feather name="user" size={13} color={colors.mutedForeground} />
                  <Text style={{ fontSize: 13, color: colors.mutedForeground }}>{data.activeJob.clientName}</Text>
                </View>
              )}
            </View>
            <View style={styles.activeJobLocationBanner}>
              <Feather name="radio" size={12} color={colors.info} />
              <Text style={[styles.activeJobLocationText, { color: colors.info }]}>
                Your location is visible to {data.activeJob.businessName}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.completeButton, { backgroundColor: colors.success }]}
              onPress={() => router.push(`/job/${data.activeJob!.id}`)}
              activeOpacity={0.7}
            >
              <Feather name="check-circle" size={18} color="#fff" />
              <Text style={styles.completeButtonText}>View / Complete Job</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Incoming Job Requests */}
        {data.pendingRequests.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconContainer, { backgroundColor: colorWithOpacity(colors.warning, 0.12) }]}>
                <Feather name="inbox" size={18} color={colors.warning} />
              </View>
              <Text style={styles.sectionTitle}>
                Incoming Requests ({data.pendingRequests.length})
              </Text>
            </View>
            {data.pendingRequests.map((job) => (
              <View key={job.id} style={styles.requestCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
                  <View style={[styles.businessDot, { backgroundColor: job.businessColor }]} />
                  <Text style={styles.requestBusiness}>{job.businessName}</Text>
                </View>
                <Text style={styles.requestTitle}>{job.title}</Text>
                {job.address && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs }}>
                    <Feather name="map-pin" size={13} color={colors.mutedForeground} />
                    <Text style={styles.requestMeta} numberOfLines={1}>{job.address}</Text>
                  </View>
                )}
                {job.scheduledAt && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs }}>
                    <Feather name="calendar" size={13} color={colors.mutedForeground} />
                    <Text style={styles.requestMeta}>{formatDate(job.scheduledAt)} {formatTime(job.scheduledAt)}</Text>
                  </View>
                )}
                {job.description && (
                  <Text style={[styles.requestMeta, { marginTop: spacing.xs }]} numberOfLines={2}>
                    {job.description}
                  </Text>
                )}
                <View style={styles.requestActions}>
                  <TouchableOpacity
                    style={[styles.requestButton, styles.declineButton]}
                    onPress={() => startDeclineJob(job.id)}
                    activeOpacity={0.7}
                    disabled={decliningJobId === job.id}
                  >
                    {decliningJobId === job.id ? (
                      <ActivityIndicator size="small" color={colors.destructive} />
                    ) : (
                      <>
                        <Feather name="x" size={16} color={colors.destructive} />
                        <Text style={[styles.requestButtonText, { color: colors.destructive }]}>Decline</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.requestButton, styles.acceptButton, { backgroundColor: colors.success }]}
                    onPress={() => acceptJob(job.id)}
                    activeOpacity={0.7}
                    disabled={acceptingJobId === job.id}
                  >
                    {acceptingJobId === job.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Feather name="check" size={16} color="#fff" />
                        <Text style={[styles.requestButtonText, { color: '#fff' }]}>Accept</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* View Toggle */}
        <View style={styles.viewToggleRow}>
          <TouchableOpacity
            style={[
              styles.viewToggleButton,
              viewMode === 'today' && { backgroundColor: colors.primary },
            ]}
            onPress={() => setViewMode('today')}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.viewToggleText,
              viewMode === 'today' && { color: '#fff', fontWeight: '700' },
            ]}>
              Today
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.viewToggleButton,
              viewMode === 'week' && { backgroundColor: colors.primary },
            ]}
            onPress={() => setViewMode('week')}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.viewToggleText,
              viewMode === 'week' && { color: '#fff', fontWeight: '700' },
            ]}>
              This Week
            </Text>
          </TouchableOpacity>
        </View>

        {/* Jobs List */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconContainer, { backgroundColor: colorWithOpacity(colors.primary, 0.12) }]}>
              <Feather name="briefcase" size={18} color={colors.primary} />
            </View>
            <Text style={styles.sectionTitle}>
              {viewMode === 'today' ? "Today's Schedule" : "This Week"}
            </Text>
          </View>

          {viewMode === 'today' ? (
            displayJobs.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="calendar" size={36} color={colors.mutedForeground} />
                <Text style={styles.emptyTitle}>No jobs scheduled for today</Text>
                <Text style={styles.emptySubtitle}>Your scheduled jobs will appear here</Text>
              </View>
            ) : (
              displayJobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  colors={colors}
                  styles={styles}
                  onPress={() => router.push(`/job/${job.id}`)}
                  onNavigate={() => openDirections(job.address, job.latitude, job.longitude)}
                  formatTime={formatTime}
                />
              ))
            )
          ) : (
            Object.entries(jobsByDay).map(([day, dayJobs]) => {
              const isExpanded = expandedDays[day] !== false;
              const hasJobs = dayJobs.length > 0;
              return (
                <View key={day} style={styles.dayGroup}>
                  <TouchableOpacity
                    style={styles.dayGroupHeader}
                    onPress={() => hasJobs && toggleDay(day)}
                    activeOpacity={hasJobs ? 0.7 : 1}
                  >
                    <Text style={[styles.dayGroupTitle, !hasJobs && { color: colors.mutedForeground }]}>{day}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                      {hasJobs ? (
                        <>
                          <Text style={styles.dayGroupCount}>{dayJobs.length} job{dayJobs.length !== 1 ? 's' : ''}</Text>
                          <Feather name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
                        </>
                      ) : (
                        <Text style={[styles.dayGroupCount, { fontStyle: 'italic' }]}>No jobs</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                  {hasJobs && isExpanded && dayJobs.map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      colors={colors}
                      styles={styles}
                      onPress={() => router.push(`/job/${job.id}`)}
                      onNavigate={() => openDirections(job.address, job.latitude, job.longitude)}
                      formatTime={formatTime}
                    />
                  ))}
                </View>
              );
            })
          )}
        </View>

        {/* Earnings Summary */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconContainer, { backgroundColor: colorWithOpacity(colors.success, 0.12) }]}>
              <Feather name="dollar-sign" size={18} color={colors.success} />
            </View>
            <Text style={styles.sectionTitle}>Earnings</Text>
          </View>
          <TouchableOpacity
            style={styles.earningsCard}
            onPress={() => setShowEarningsBreakdown(!showEarningsBreakdown)}
            activeOpacity={0.7}
          >
            <View style={styles.earningsRow}>
              <View style={styles.earningsStat}>
                <Text style={styles.earningsLabel}>This Week</Text>
                <Text style={styles.earningsAmount}>{formatCurrencyUtil(data.earningsWeek)}</Text>
              </View>
              <View style={[styles.earningsDivider, { backgroundColor: colors.border }]} />
              <View style={styles.earningsStat}>
                <Text style={styles.earningsLabel}>This Month</Text>
                <Text style={styles.earningsAmount}>{formatCurrencyUtil(data.earningsMonth)}</Text>
              </View>
            </View>
            {data.earningsByBusiness.length > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.sm }}>
                <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                  Tap for breakdown
                </Text>
                <Feather name={showEarningsBreakdown ? 'chevron-up' : 'chevron-down'} size={14} color={colors.mutedForeground} />
              </View>
            )}
            {showEarningsBreakdown && (
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.md, paddingVertical: spacing.sm }}
                onPress={() => router.push('/more/invoices')}
                activeOpacity={0.7}
              >
                <Feather name="file-text" size={14} color={colors.primary} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.primary }}>View Invoice History</Text>
              </TouchableOpacity>
            )}
            {showEarningsBreakdown && data.earningsByBusiness.length > 0 && (
              <View style={styles.earningsBreakdown}>
                <View style={[styles.earningsBreakdownDivider, { backgroundColor: colors.border }]} />
                <Text style={styles.earningsBreakdownTitle}>By Business</Text>
                {data.earningsByBusiness.map((biz, i) => (
                  <View key={i} style={styles.earningsBreakdownRow}>
                    <Text style={styles.earningsBreakdownName}>{biz.businessName}</Text>
                    <Text style={styles.earningsBreakdownAmount}>{formatCurrencyUtil(biz.amount)}</Text>
                  </View>
                ))}
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Connected Businesses */}
        {data.businesses.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconContainer, { backgroundColor: colorWithOpacity(colors.info, 0.12) }]}>
                <Feather name="briefcase" size={18} color={colors.info} />
              </View>
              <Text style={styles.sectionTitle}>Connected Businesses</Text>
            </View>
            <View style={styles.businessesList}>
              {data.businesses.map((biz) => (
                <View key={biz.id} style={styles.businessItem}>
                  <View style={[styles.businessDot, { backgroundColor: biz.color }]} />
                  <Text style={styles.businessItemName}>{biz.name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Decline Modal */}
      <Modal visible={showDeclineModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Decline Job</Text>
              <TouchableOpacity onPress={() => setShowDeclineModal(false)} style={{ padding: spacing.xs }}>
                <Feather name="x" size={22} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>
              Add an optional reason for declining this job. The business will be notified.
            </Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border }]}
              placeholder="Reason (optional)..."
              placeholderTextColor={colors.mutedForeground}
              value={declineReason}
              onChangeText={setDeclineReason}
              multiline
              numberOfLines={3}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.muted }]}
                onPress={() => setShowDeclineModal(false)}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalButtonText, { color: colors.foreground }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.destructive }]}
                onPress={confirmDeclineJob}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalButtonText, { color: '#fff' }]}>Decline Job</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

function JobCard({
  job,
  colors,
  styles,
  onPress,
  onNavigate,
  formatTime,
}: {
  job: SubcontractorJob;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
  onPress: () => void;
  onNavigate: () => void;
  formatTime: (dateStr?: string) => string;
}) {
  const statusConfig: Record<string, { label: string; color: string }> = {
    pending: { label: 'Pending', color: colors.warning },
    scheduled: { label: 'Scheduled', color: colors.info },
    in_progress: { label: 'In Progress', color: colors.success },
    done: { label: 'Completed', color: colors.mutedForeground },
    invoiced: { label: 'Invoiced', color: colors.mutedForeground },
  };
  const status = statusConfig[job.status] || { label: job.status, color: colors.mutedForeground };

  return (
    <TouchableOpacity style={styles.jobCard} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.jobCardBorder, { backgroundColor: job.businessColor }]} />
      <View style={styles.jobCardContent}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flex: 1 }}>
            <View style={[styles.businessDotSmall, { backgroundColor: job.businessColor }]} />
            <Text style={styles.jobCardBusiness} numberOfLines={1}>{job.businessName}</Text>
          </View>
          <View style={[styles.jobStatusBadge, { backgroundColor: colorWithOpacity(status.color, 0.12) }]}>
            <Text style={[styles.jobStatusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>
        <Text style={styles.jobCardTitle} numberOfLines={1}>{job.title}</Text>
        <View style={styles.jobCardMeta}>
          {job.scheduledAt && (
            <View style={styles.jobCardMetaItem}>
              <Feather name="clock" size={13} color={colors.mutedForeground} />
              <Text style={styles.jobCardMetaText}>{formatTime(job.scheduledAt)}</Text>
              {job.estimatedDuration && (
                <Text style={styles.jobCardMetaText}>({job.estimatedDuration}min)</Text>
              )}
            </View>
          )}
          {job.address && (
            <TouchableOpacity
              style={styles.jobCardMetaItem}
              onPress={(e) => { e.stopPropagation?.(); onNavigate(); }}
              activeOpacity={0.7}
            >
              <Feather name="map-pin" size={13} color={colors.primary} />
              <Text style={[styles.jobCardMetaText, { color: colors.primary }]} numberOfLines={1}>{job.address}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    marginBottom: spacing.lg,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.foreground,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  roleBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  // Availability Toggle
  availabilityCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  availabilitySectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },
  availabilityRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  availabilityButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
  },
  availabilityButtonText: {
    fontSize: 13,
  },

  // Active Job Card
  activeJobCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 2,
    ...shadows.md,
  },
  activeJobHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  activeJobPulse: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  activeJobLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.success,
    flex: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  activeJobTimer: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
    fontVariant: ['tabular-nums'],
  },
  activeJobContent: {
    marginBottom: spacing.md,
  },
  activeJobBusiness: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.mutedForeground,
  },
  activeJobTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
    marginTop: spacing.xs,
  },
  activeJobAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  activeJobAddress: {
    fontSize: 14,
    flex: 1,
  },
  activeJobLocationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colorWithOpacity(colors.info, 0.08),
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  activeJobLocationText: {
    fontSize: 12,
    flex: 1,
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
  completeButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },

  // Section
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  sectionIconContainer: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.foreground,
  },

  // View Toggle
  viewToggleRow: {
    flexDirection: 'row',
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    padding: 3,
    marginBottom: spacing.lg,
  },
  viewToggleButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
  },
  viewToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.mutedForeground,
  },

  // Job Card
  jobCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  jobCardBorder: {
    width: 4,
  },
  jobCardContent: {
    flex: 1,
    padding: spacing.md,
  },
  jobCardBusiness: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.mutedForeground,
    flex: 1,
  },
  jobCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  jobCardMeta: {
    gap: spacing.xs,
  },
  jobCardMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  jobCardMetaText: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  jobStatusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  jobStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Business dot
  businessDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  businessDotSmall: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Day Group
  dayGroup: {
    marginBottom: spacing.md,
  },
  dayGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  dayGroupTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.foreground,
  },
  dayGroupCount: {
    fontSize: 12,
    color: colors.mutedForeground,
  },

  // Request Card
  requestCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colorWithOpacity(colors.warning, 0.3),
    ...shadows.sm,
  },
  requestBusiness: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.mutedForeground,
  },
  requestTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.foreground,
  },
  requestMeta: {
    fontSize: 13,
    color: colors.mutedForeground,
    flex: 1,
  },
  requestActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  requestButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
  declineButton: {
    backgroundColor: colorWithOpacity(colors.destructive, 0.08),
    borderWidth: 1,
    borderColor: colorWithOpacity(colors.destructive, 0.2),
  },
  acceptButton: {},
  requestButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing['3xl'],
    gap: spacing.sm,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.mutedForeground,
  },

  // Earnings
  earningsCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  earningsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  earningsStat: {
    flex: 1,
    alignItems: 'center',
  },
  earningsLabel: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginBottom: spacing.xs,
  },
  earningsAmount: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.foreground,
  },
  earningsDivider: {
    width: 1,
    height: 40,
  },
  earningsBreakdown: {
    marginTop: spacing.md,
  },
  earningsBreakdownDivider: {
    height: 1,
    marginBottom: spacing.md,
  },
  earningsBreakdownTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  earningsBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  earningsBreakdownName: {
    fontSize: 14,
    color: colors.foreground,
  },
  earningsBreakdownAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
  },

  // Businesses List
  businessesList: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
    gap: spacing.md,
  },
  businessItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  businessItemName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.foreground,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalContent: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginBottom: spacing.lg,
  },
  modalInput: {
    borderRadius: radius.lg,
    padding: spacing.md,
    fontSize: 15,
    borderWidth: 1,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: spacing.lg,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modalButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
  modalButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },

  // Card border - reused from index for reference
  cardBorder: {
    borderColor: colors.cardBorder,
  },
});
