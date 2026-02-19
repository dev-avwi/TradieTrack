import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, StyleSheet, ActivityIndicator, Linking } from 'react-native';
import { Stack, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../src/lib/theme';
import { api } from '../../src/lib/api';

interface ActionItem {
  id: string;
  priority: 'fix_now' | 'this_week' | 'suggestions';
  title: string;
  description: string;
  impact: string;
  cta: string;
  ctaUrl: string;
  metric?: string;
  category: string;
}

interface ActionCenterData {
  actions: ActionItem[];
  summary: {
    fixNowCount: number;
    thisWeekCount: number;
    suggestionsCount: number;
    totalCount: number;
  };
  sections: {
    fix_now: ActionItem[];
    this_week: ActionItem[];
    suggestions: ActionItem[];
  };
}

const PRIORITY_CONFIG = {
  fix_now: {
    label: 'Fix Now',
    shortLabel: 'Fix Now',
    sectionLabel: 'FIX NOW',
    icon: 'alert-triangle' as const,
    color: '#ef4444',
    bgColor: 'rgba(239,68,68,0.12)',
  },
  this_week: {
    label: 'This Week',
    shortLabel: 'This Week',
    sectionLabel: 'THIS WEEK',
    icon: 'clock' as const,
    color: '#f59e0b',
    bgColor: 'rgba(245,158,11,0.12)',
  },
  suggestions: {
    label: 'Tips',
    shortLabel: 'Tips',
    sectionLabel: 'SUGGESTIONS',
    icon: 'zap' as const,
    color: '#22c55e',
    bgColor: 'rgba(34,197,94,0.12)',
  },
};

const CATEGORY_COLORS: Record<string, string> = {
  scheduling: '#3b82f6',
  invoicing: '#f59e0b',
  quoting: '#8b5cf6',
  clients: '#06b6d4',
  jobs: '#22c55e',
  revenue: '#ef4444',
  default: '#6b7280',
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
    borderWidth: 1,
    borderColor: colors.border,
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.foreground,
    textAlign: 'center',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.mutedForeground,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.mutedForeground,
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  actionCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.mutedForeground,
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 4,
  },
  actionDescription: {
    fontSize: 13,
    color: colors.mutedForeground,
    lineHeight: 18,
    marginBottom: 12,
  },
  actionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  metricText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.mutedForeground,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  ctaText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  sectionContainer: {
    marginBottom: 24,
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
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 20,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(34,197,94,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
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
    color: '#fff',
  },
});

export default function ActionCenterScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [data, setData] = useState<ActionCenterData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const response = await api.get<ActionCenterData>('/api/bi/action-center');
      if (response.error) {
        setError(response.error);
      } else {
        setData(response.data || null);
      }
    } catch (err) {
      setError('Failed to load action center');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const handleCTA = (url: string) => {
    if (url.startsWith('http')) {
      Linking.openURL(url);
      return;
    }
    if (!url.startsWith('/')) return;

    // Parse the URL to extract path and query params
    const [basePath, queryString] = url.split('?');
    const params = new URLSearchParams(queryString || '');
    const tab = params.get('tab');

    // Map web routes to mobile routes
    if (basePath === '/documents' || basePath.startsWith('/documents')) {
      // Documents hub -> route to the specific document type
      if (tab === 'invoices') {
        router.push('/more/documents' as any);
      } else if (tab === 'quotes') {
        router.push('/more/documents' as any);
      } else {
        router.push('/more/documents' as any);
      }
    } else if (basePath === '/schedule' || basePath.startsWith('/schedule')) {
      router.push('/(tabs)/schedule' as any);
    } else if (basePath === '/work' || basePath.startsWith('/work')) {
      router.push('/(tabs)/work' as any);
    } else if (basePath.startsWith('/jobs/')) {
      const jobId = basePath.split('/jobs/')[1];
      router.push(`/job/${jobId}` as any);
    } else if (basePath === '/clients' || basePath.startsWith('/clients')) {
      router.push('/more/clients' as any);
    } else if (basePath === '/chat' || basePath.startsWith('/chat')) {
      router.push('/(tabs)/chat' as any);
    } else {
      // Fallback: try navigating to work tab
      router.push('/(tabs)/work' as any);
    }
  };

  const getCategoryColor = (category: string) => {
    return CATEGORY_COLORS[category.toLowerCase()] || CATEGORY_COLORS.default;
  };

  const renderStatCards = () => {
    if (!data?.summary) return null;
    const { fixNowCount, thisWeekCount, suggestionsCount } = data.summary;

    return (
      <View style={styles.statsRow}>
        <TouchableOpacity style={styles.statCard} onPress={() => {}} activeOpacity={0.7}>
          <View style={[styles.statIconContainer, { backgroundColor: PRIORITY_CONFIG.fix_now.bgColor }]}>
            <Feather name="alert-triangle" size={24} color={PRIORITY_CONFIG.fix_now.color} />
          </View>
          <Text style={styles.statValue}>{fixNowCount}</Text>
          <Text style={styles.statLabel}>{PRIORITY_CONFIG.fix_now.shortLabel}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.statCard} onPress={() => {}} activeOpacity={0.7}>
          <View style={[styles.statIconContainer, { backgroundColor: PRIORITY_CONFIG.this_week.bgColor }]}>
            <Feather name="clock" size={24} color={PRIORITY_CONFIG.this_week.color} />
          </View>
          <Text style={styles.statValue}>{thisWeekCount}</Text>
          <Text style={styles.statLabel}>{PRIORITY_CONFIG.this_week.shortLabel}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.statCard} onPress={() => {}} activeOpacity={0.7}>
          <View style={[styles.statIconContainer, { backgroundColor: PRIORITY_CONFIG.suggestions.bgColor }]}>
            <Feather name="zap" size={24} color={PRIORITY_CONFIG.suggestions.color} />
          </View>
          <Text style={styles.statValue}>{suggestionsCount}</Text>
          <Text style={styles.statLabel}>{PRIORITY_CONFIG.suggestions.shortLabel}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderActionCard = (action: ActionItem) => {
    const config = PRIORITY_CONFIG[action.priority];
    const catColor = getCategoryColor(action.category);

    return (
      <View key={action.id} style={styles.actionCard}>
        <View style={styles.actionTopRow}>
          <View style={styles.categoryBadge}>
            <View style={[styles.categoryDot, { backgroundColor: catColor }]} />
            <Text style={styles.categoryText}>{action.category}</Text>
          </View>
          <View style={[styles.priorityBadge, { backgroundColor: config.bgColor }]}>
            <Feather name={config.icon} size={10} color={config.color} />
            <Text style={[styles.priorityText, { color: config.color }]}>{config.label}</Text>
          </View>
        </View>
        <Text style={styles.actionTitle} numberOfLines={2}>{action.title}</Text>
        <Text style={styles.actionDescription} numberOfLines={3}>{action.description}</Text>
        <View style={styles.actionFooter}>
          {action.metric ? (
            <View style={styles.metricRow}>
              <Feather name="bar-chart-2" size={14} color={colors.mutedForeground} />
              <Text style={styles.metricText}>{action.metric}</Text>
            </View>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={() => handleCTA(action.ctaUrl)}
            activeOpacity={0.7}
          >
            <Text style={styles.ctaText}>{action.cta}</Text>
            <Feather name="chevron-right" size={14} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderSection = (priority: 'fix_now' | 'this_week' | 'suggestions', actions: ActionItem[]) => {
    if (!actions || actions.length === 0) return null;
    const config = PRIORITY_CONFIG[priority];

    return (
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>{config.sectionLabel}</Text>
        {actions.map(renderActionCard)}
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Feather name="check-circle" size={32} color="#22c55e" />
      </View>
      <Text style={styles.emptyTitle}>All clear!</Text>
      <Text style={styles.emptySubtitle}>No actions needed right now. Keep up the great work.</Text>
    </View>
  );

  const renderErrorState = () => (
    <View style={styles.errorContainer}>
      <Feather name="alert-circle" size={40} color={colors.destructive} />
      <Text style={styles.errorText}>{error}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={fetchData}>
        <Text style={styles.retryButtonText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );

  const hasActions = data && data.summary && data.summary.totalCount > 0;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        {isLoading && !data ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading action center...</Text>
          </View>
        ) : (
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
                <Text style={styles.pageTitle}>Action Center</Text>
                <Text style={styles.pageSubtitle}>Items that need your attention</Text>
              </View>
            </View>

            {error ? renderErrorState() : !hasActions ? renderEmptyState() : (
              <>
                {renderStatCards()}
                {renderSection('fix_now', data!.sections.fix_now)}
                {renderSection('this_week', data!.sections.this_week)}
                {renderSection('suggestions', data!.sections.suggestions)}
              </>
            )}
          </ScrollView>
        )}
      </View>
    </>
  );
}
