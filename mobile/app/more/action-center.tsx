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
    label: 'FIX NOW',
    sectionLabel: 'FIX NOW',
    icon: 'alert-triangle' as const,
    color: '#ef4444',
    bgColor: 'rgba(239,68,68,0.12)',
  },
  this_week: {
    label: 'THIS WEEK',
    sectionLabel: 'THIS WEEK',
    icon: 'clock' as const,
    color: '#f59e0b',
    bgColor: 'rgba(245,158,11,0.12)',
  },
  suggestions: {
    label: 'SUGGESTIONS',
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
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
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
    } else if (url.startsWith('/')) {
      const routeMap: Record<string, string> = {
        '/work': '/more/work',
        '/schedule': '/schedule',
        '/documents': '/more/documents',
      };
      const basePath = url.split('?')[0];
      const mappedRoute = routeMap[basePath];
      if (mappedRoute) {
        router.push(mappedRoute as any);
      }
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
        <View style={styles.statCard}>
          <View style={styles.statHeader}>
            <View style={[styles.statIconContainer, { backgroundColor: PRIORITY_CONFIG.fix_now.bgColor }]}>
              <Feather name="alert-triangle" size={22} color={PRIORITY_CONFIG.fix_now.color} />
            </View>
            {fixNowCount > 0 && (
              <View style={[styles.trendBadge, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
                <Feather name="alert-circle" size={12} color="#ef4444" />
              </View>
            )}
          </View>
          <Text style={styles.statValue}>{fixNowCount}</Text>
          <Text style={styles.statLabel}>FIX NOW</Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statHeader}>
            <View style={[styles.statIconContainer, { backgroundColor: PRIORITY_CONFIG.this_week.bgColor }]}>
              <Feather name="clock" size={22} color={PRIORITY_CONFIG.this_week.color} />
            </View>
            {thisWeekCount > 0 && (
              <View style={[styles.trendBadge, { backgroundColor: 'rgba(245,158,11,0.12)' }]}>
                <Feather name="arrow-right" size={12} color="#f59e0b" />
              </View>
            )}
          </View>
          <Text style={styles.statValue}>{thisWeekCount}</Text>
          <Text style={styles.statLabel}>THIS WEEK</Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statHeader}>
            <View style={[styles.statIconContainer, { backgroundColor: PRIORITY_CONFIG.suggestions.bgColor }]}>
              <Feather name="zap" size={22} color={PRIORITY_CONFIG.suggestions.color} />
            </View>
            {suggestionsCount > 0 && (
              <View style={[styles.trendBadge, { backgroundColor: 'rgba(34,197,94,0.12)' }]}>
                <Feather name="trending-up" size={12} color="#22c55e" />
              </View>
            )}
          </View>
          <Text style={styles.statValue}>{suggestionsCount}</Text>
          <Text style={styles.statLabel}>SUGGESTIONS</Text>
        </View>
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
