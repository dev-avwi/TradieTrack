import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, StyleSheet, ActivityIndicator } from 'react-native';
import { Stack, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../src/lib/theme';
import { api } from '../../src/lib/api';
import { format } from 'date-fns';

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
    padding: 16,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingTop: 8,
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
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.mutedForeground,
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.foreground,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.mutedForeground,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  quickAccessSection: {
    marginBottom: 24,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  categoryContent: {
    flex: 1,
  },
  categoryTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
  },
  categoryCount: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  recentSection: {
    marginBottom: 24,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  viewAllText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  documentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  documentIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  documentInfo: {
    flex: 1,
  },
  documentTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
  },
  documentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  documentType: {
    fontSize: 12,
    color: colors.mutedForeground,
    flex: 1,
  },
  documentRight: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  documentDate: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  documentExpiry: {
    fontSize: 11,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 24,
  },
  emptyIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  emptyText: {
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: 8,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginTop: 12,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 24,
  },
  errorText: {
    fontSize: 14,
    color: colors.destructive,
    textAlign: 'center',
    marginTop: 12,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '500',
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
              <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
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
                    <Feather name="camera" size={22} color={CATEGORY_COLORS.photos.color} />
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
                    <Feather name="mic" size={22} color={CATEGORY_COLORS.voiceNotes.color} />
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
                    <Feather name="shield" size={22} color={CATEGORY_COLORS.compliance.color} />
                  </View>
                  <Text style={styles.statValue}>{complianceCount}</Text>
                  <Text style={styles.statLabel}>COMPLIANCE</Text>
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
                    <Feather name="camera" size={22} color={CATEGORY_COLORS.photos.color} />
                  </View>
                  <View style={styles.categoryContent}>
                    <Text style={styles.categoryTitle}>Job Photos</Text>
                    <Text style={styles.categoryCount}>View photos across {activeJobs} jobs</Text>
                  </View>
                  <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.categoryCard}
                  onPress={() => router.push('/more/compliance' as any)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.categoryIconContainer, { backgroundColor: CATEGORY_COLORS.compliance.bg }]}>
                    <Feather name="shield" size={22} color={CATEGORY_COLORS.compliance.color} />
                  </View>
                  <View style={styles.categoryContent}>
                    <Text style={styles.categoryTitle}>Compliance Documents</Text>
                    <Text style={styles.categoryCount}>{complianceCount} documents</Text>
                  </View>
                  <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.categoryCard}
                  onPress={() => router.push('/(tabs)/work' as any)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.categoryIconContainer, { backgroundColor: CATEGORY_COLORS.voiceNotes.bg }]}>
                    <Feather name="mic" size={22} color={CATEGORY_COLORS.voiceNotes.color} />
                  </View>
                  <View style={styles.categoryContent}>
                    <Text style={styles.categoryTitle}>Voice Notes</Text>
                    <Text style={styles.categoryCount}>Attached to jobs</Text>
                  </View>
                  <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.categoryCard}
                  onPress={() => router.push('/(tabs)/work' as any)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.categoryIconContainer, { backgroundColor: CATEGORY_COLORS.sitePhotos.bg }]}>
                    <Feather name="image" size={22} color={CATEGORY_COLORS.sitePhotos.color} />
                  </View>
                  <View style={styles.categoryContent}>
                    <Text style={styles.categoryTitle}>Site Photos</Text>
                    <Text style={styles.categoryCount}>Before & after shots</Text>
                  </View>
                  <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
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
                      <Feather name="folder" size={28} color={colors.mutedForeground} />
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
