import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, StyleSheet, ActivityIndicator } from 'react-native';
import { Stack, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../src/lib/theme';
import { api } from '../../src/lib/api';
import { format } from 'date-fns';
import { spacing, radius, shadows, typography, pageShell, iconSizes, sizes, componentStyles } from '../../src/lib/design-tokens';

interface ComplianceDocument {
  id: string;
  type: string;
  documentName: string;
  status: string;
  expiryDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface Job {
  id: string;
  title?: string;
  status?: string;
}

const CATEGORY_COLORS = {
  photos: { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  voiceNotes: { color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
  compliance: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  sitePhotos: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
};

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '';
  try {
    return format(new Date(dateStr), 'dd MMM yyyy');
  } catch {
    return '';
  }
};

const getStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'valid':
    case 'active':
    case 'approved':
      return { color: '#22c55e', bg: 'rgba(34,197,94,0.1)' };
    case 'expired':
    case 'rejected':
      return { color: '#ef4444', bg: 'rgba(239,68,68,0.1)' };
    case 'pending':
    case 'expiring_soon':
      return { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' };
    default:
      return { color: '#6b7280', bg: 'rgba(107,114,128,0.1)' };
  }
};

const createStyles = (colors: any) => StyleSheet.create({
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
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.md,
    alignItems: 'center',
    ...shadows.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  statIconContainer: {
    width: 32,
    height: 32,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: colors.foreground,
  },
  statLabel: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
    fontSize: 11,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
  },
  quickAccessSection: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  categoryIconContainer: {
    width: 40,
    height: 40,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  categoryContent: {
    flex: 1,
  },
  categoryTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
  },
  categoryCount: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  recentSection: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  recentHeader: {
    ...componentStyles.sectionHeader,
  },
  viewAllText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '500',
  },
  documentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  documentIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  documentInfo: {
    flex: 1,
  },
  documentTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
  },
  documentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  documentType: {
    ...typography.caption,
    color: colors.mutedForeground,
    flex: 1,
  },
  documentRight: {
    alignItems: 'flex-end',
    marginLeft: spacing.sm,
  },
  documentDate: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  documentExpiry: {
    ...typography.label,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    ...shadows.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: spacing.sm,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
  },
  emptyText: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  loadingText: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.md,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    ...shadows.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: spacing.sm,
  },
  errorText: {
    ...typography.caption,
    color: colors.destructive,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  retryButton: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
  },
  retryButtonText: {
    ...typography.button,
    color: colors.primaryForeground,
  },
});

export default function FilesScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [complianceDocs, setComplianceDocs] = useState<ComplianceDocument[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      const [complianceRes, jobsRes] = await Promise.all([
        api.get<ComplianceDocument[]>('/api/compliance-documents').catch(() => ({ data: [] as ComplianceDocument[], error: null })),
        api.get<Job[]>('/api/jobs').catch(() => ({ data: [] as Job[], error: null })),
      ]);

      setComplianceDocs(complianceRes.data || []);
      setJobs(jobsRes.data || []);
    } catch (err) {
      setError('Failed to load files. Pull down to retry.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const activeJobs = jobs.filter(j => j.status !== 'cancelled').length;
  const complianceCount = complianceDocs.length;
  const totalFiles = activeJobs + complianceCount;

  const recentComplianceDocs = useMemo(() => {
    return [...complianceDocs]
      .sort((a, b) => {
        const dateA = a.updatedAt || a.createdAt || '';
        const dateB = b.updatedAt || b.createdAt || '';
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      })
      .slice(0, 8);
  }, [complianceDocs]);

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
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
        >
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.pageTitle}>Files</Text>
              <Text style={styles.pageSubtitle}>Photos, documents & media</Text>
            </View>
          </View>

          {isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Loading files...</Text>
            </View>
          )}

          {error && (
            <View style={styles.errorContainer}>
              <Feather name="alert-circle" size={40} color={colors.destructive} />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={handleRefresh} activeOpacity={0.7}>
                <Text style={styles.retryButtonText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          )}

          {!isLoading && !error && (
            <>
              <View style={styles.statsRow}>
                <TouchableOpacity
                  style={styles.statCard}
                  onPress={() => router.push('/(tabs)/work' as any)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.statIconContainer, { backgroundColor: CATEGORY_COLORS.photos.bg }]}>
                    <Feather name="folder" size={16} color={CATEGORY_COLORS.photos.color} />
                  </View>
                  <Text style={styles.statValue}>{totalFiles}</Text>
                  <Text style={styles.statLabel}>TOTAL</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.statCard}
                  onPress={() => router.push('/(tabs)/work' as any)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.statIconContainer, { backgroundColor: CATEGORY_COLORS.photos.bg }]}>
                    <Feather name="camera" size={16} color={CATEGORY_COLORS.photos.color} />
                  </View>
                  <Text style={styles.statValue}>{activeJobs}</Text>
                  <Text style={styles.statLabel}>JOBS</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.statCard}
                  onPress={() => router.push('/(tabs)/work' as any)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.statIconContainer, { backgroundColor: CATEGORY_COLORS.voiceNotes.bg }]}>
                    <Feather name="mic" size={16} color={CATEGORY_COLORS.voiceNotes.color} />
                  </View>
                  <Text style={styles.statValue}>{activeJobs}</Text>
                  <Text style={styles.statLabel}>MEDIA</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.statCard}
                  onPress={() => router.push('/more/compliance' as any)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.statIconContainer, { backgroundColor: CATEGORY_COLORS.compliance.bg }]}>
                    <Feather name="shield" size={16} color={CATEGORY_COLORS.compliance.color} />
                  </View>
                  <Text style={styles.statValue}>{complianceCount}</Text>
                  <Text style={styles.statLabel}>DOCS</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.quickAccessSection}>
                <Text style={styles.sectionTitle}>QUICK ACCESS</Text>

                <TouchableOpacity
                  style={styles.categoryCard}
                  onPress={() => router.push('/(tabs)/work' as any)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.categoryIconContainer, { backgroundColor: CATEGORY_COLORS.photos.bg }]}>
                    <Feather name="camera" size={16} color={CATEGORY_COLORS.photos.color} />
                  </View>
                  <View style={styles.categoryContent}>
                    <Text style={styles.categoryTitle}>Job Photos</Text>
                    <Text style={styles.categoryCount}>View photos across {activeJobs} jobs</Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.categoryCard}
                  onPress={() => router.push('/more/compliance' as any)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.categoryIconContainer, { backgroundColor: CATEGORY_COLORS.compliance.bg }]}>
                    <Feather name="shield" size={16} color={CATEGORY_COLORS.compliance.color} />
                  </View>
                  <View style={styles.categoryContent}>
                    <Text style={styles.categoryTitle}>Compliance Documents</Text>
                    <Text style={styles.categoryCount}>{complianceCount} documents</Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.categoryCard}
                  onPress={() => router.push('/(tabs)/work' as any)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.categoryIconContainer, { backgroundColor: CATEGORY_COLORS.voiceNotes.bg }]}>
                    <Feather name="mic" size={16} color={CATEGORY_COLORS.voiceNotes.color} />
                  </View>
                  <View style={styles.categoryContent}>
                    <Text style={styles.categoryTitle}>Voice Notes</Text>
                    <Text style={styles.categoryCount}>Attached to jobs</Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.categoryCard}
                  onPress={() => router.push('/(tabs)/work' as any)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.categoryIconContainer, { backgroundColor: CATEGORY_COLORS.sitePhotos.bg }]}>
                    <Feather name="image" size={16} color={CATEGORY_COLORS.sitePhotos.color} />
                  </View>
                  <View style={styles.categoryContent}>
                    <Text style={styles.categoryTitle}>Site Photos</Text>
                    <Text style={styles.categoryCount}>Before & after shots</Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>

              <View style={styles.recentSection}>
                <View style={styles.recentHeader}>
                  <Text style={styles.sectionTitle}>RECENT COMPLIANCE DOCUMENTS</Text>
                  {complianceCount > 0 && (
                    <TouchableOpacity onPress={() => router.push('/more/compliance' as any)} activeOpacity={0.7}>
                      <Text style={styles.viewAllText}>View All</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {recentComplianceDocs.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <View style={styles.emptyIconContainer}>
                      <Feather name="folder" size={40} color={colors.mutedForeground} />
                    </View>
                    <Text style={styles.emptyTitle}>No Files Yet</Text>
                    <Text style={styles.emptyText}>Upload compliance documents or take job photos to get started</Text>
                  </View>
                ) : (
                  recentComplianceDocs.map((doc) => {
                    const statusStyle = getStatusColor(doc.status);
                    const statusLabel = doc.status ? doc.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Unknown';
                    return (
                      <TouchableOpacity
                        key={doc.id}
                        style={styles.documentRow}
                        onPress={() => router.push('/more/compliance' as any)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.documentIcon, { backgroundColor: CATEGORY_COLORS.compliance.bg }]}>
                          <Feather name="file-text" size={16} color={CATEGORY_COLORS.compliance.color} />
                        </View>
                        <View style={styles.documentInfo}>
                          <Text style={styles.documentTitle} numberOfLines={1}>{doc.documentName || doc.type}</Text>
                          <View style={styles.documentMeta}>
                            <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                              <Text style={[styles.statusBadgeText, { color: statusStyle.color }]}>{statusLabel}</Text>
                            </View>
                            <Text style={styles.documentType} numberOfLines={1}>{doc.type?.replace(/_/g, ' ')}</Text>
                          </View>
                        </View>
                        <View style={styles.documentRight}>
                          {doc.expiryDate && (
                            <>
                              <Text style={styles.documentDate}>{formatDate(doc.expiryDate)}</Text>
                              <Text style={styles.documentExpiry}>Expires</Text>
                            </>
                          )}
                          {!doc.expiryDate && doc.createdAt && (
                            <Text style={styles.documentDate}>{formatDate(doc.createdAt)}</Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </>
  );
}
