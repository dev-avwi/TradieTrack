import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, StyleSheet, ActivityIndicator, Linking } from 'react-native';
import { Stack, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme, colorWithOpacity } from '../../src/lib/theme';
import { spacing, radius, shadows, typography, pageShell, iconSizes, sizes, componentStyles } from '../../src/lib/design-tokens';
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

const getPriorityConfig = (colors: any) => ({
  fix_now: {
    label: 'Fix Now',
    shortLabel: 'Fix Now',
    sectionLabel: 'FIX NOW',
    icon: 'alert-triangle' as const,
    color: colors.destructive,
    bgColor: colorWithOpacity(colors.destructive, 0.12),
  },
  this_week: {
    label: 'This Week',
    shortLabel: 'This Week',
    sectionLabel: 'THIS WEEK',
    icon: 'clock' as const,
    color: colors.warning,
    bgColor: colorWithOpacity(colors.warning, 0.12),
  },
  suggestions: {
    label: 'Tips',
    shortLabel: 'Tips',
    sectionLabel: 'SUGGESTIONS',
    icon: 'zap' as const,
    color: colors.success,
    bgColor: colorWithOpacity(colors.success, 0.12),
  },
});

const getCategoryColors = (colors: any): Record<string, string> => ({
  scheduling: colors.info,
  invoicing: colors.warning,
  quoting: colors.primary,
  clients: colors.info,
  jobs: colors.success,
  revenue: colors.destructive,
  default: colors.mutedForeground,
});

const getCategoryIcon = (category: string): string => {
  const iconMap: Record<string, string> = {
    scheduling: 'calendar',
    invoicing: 'file-text',
    quoting: 'send',
    clients: 'users',
    jobs: 'briefcase',
    revenue: 'dollar-sign',
  };
  return iconMap[category.toLowerCase()] || 'activity';
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
    marginBottom: spacing.sm,
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
    marginBottom: spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
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
  },
  statLabel: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
    fontSize: 11,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.mutedForeground,
  },
  sectionContainer: {
    marginBottom: spacing.sm,
  },
  actionCard: {
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    marginBottom: spacing.sm,
    overflow: 'hidden',
    flexDirection: 'row',
    ...shadows.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  actionAccentBar: {
    width: 4,
  },
  actionCardContent: {
    flex: 1,
    padding: spacing.md,
  },
  actionTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  categoryIconContainer: {
    width: 40,
    height: 40,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  actionTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  actionDescription: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginBottom: spacing.md,
  },
  actionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  metricText: {
    ...typography.caption,
    color: colors.mutedForeground,
    fontWeight: '500',
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  ctaText: {
    ...typography.button,
    color: colors.primaryForeground,
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
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colorWithOpacity(colors.success, 0.1),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
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
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
  },
  retryButtonText: {
    ...typography.button,
    color: colors.primaryForeground,
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

    const [basePath, queryString] = url.split('?');
    const params = new URLSearchParams(queryString || '');
    const tab = params.get('tab');

    if (basePath === '/documents' || basePath.startsWith('/documents')) {
      if (tab === 'invoices') {
        router.push('/more/invoices' as any);
      } else if (tab === 'quotes') {
        router.push('/more/quotes' as any);
      } else {
        router.push('/more/documents' as any);
      }
    } else if (basePath === '/schedule' || basePath.startsWith('/schedule')) {
      router.push('/more/calendar' as any);
    } else if (basePath === '/work' || basePath.startsWith('/work')) {
      router.push('/(tabs)/jobs' as any);
    } else if (basePath.startsWith('/jobs/')) {
      const jobId = basePath.split('/jobs/')[1];
      router.push(`/job/${jobId}` as any);
    } else if (basePath === '/clients' || basePath.startsWith('/clients')) {
      router.push('/more/clients' as any);
    } else if (basePath === '/chat' || basePath.startsWith('/chat')) {
      router.push('/more/chat-hub' as any);
    } else if (basePath === '/quotes' || basePath.startsWith('/quotes')) {
      router.push('/more/quotes' as any);
    } else if (basePath === '/invoices' || basePath.startsWith('/invoices')) {
      router.push('/more/invoices' as any);
    } else if (basePath === '/time-tracking' || basePath.startsWith('/time-tracking')) {
      router.push('/more/time-tracking' as any);
    } else if (basePath === '/team' || basePath.startsWith('/team')) {
      router.push('/more/team-management' as any);
    } else if (basePath === '/reports' || basePath.startsWith('/reports')) {
      router.push('/more/reports' as any);
    } else {
      router.push('/(tabs)/jobs' as any);
    }
  };

  const PRIORITY_CONFIG = getPriorityConfig(colors);
  const CATEGORY_COLORS = getCategoryColors(colors);

  const getCategoryColor = (category: string) => {
    return CATEGORY_COLORS[category.toLowerCase()] || CATEGORY_COLORS.default;
  };

  const renderStatCards = () => {
    if (!data?.summary) return null;
    const { fixNowCount, thisWeekCount, suggestionsCount } = data.summary;

    return (
      <View style={styles.statsRow}>
        <TouchableOpacity style={[styles.statCard, { backgroundColor: colorWithOpacity(colors.destructive, 0.04) }]} onPress={() => {}} activeOpacity={0.7}>
          <View style={[styles.statIconContainer, { backgroundColor: colorWithOpacity(colors.destructive, 0.12) }]}>
            <Feather name="alert-triangle" size={16} color={colors.destructive} />
          </View>
          <Text style={[styles.statValue, { color: colors.destructive }]}>{fixNowCount}</Text>
          <Text style={styles.statLabel}>Fix Now</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.statCard} onPress={() => {}} activeOpacity={0.7}>
          <View style={[styles.statIconContainer, { backgroundColor: colorWithOpacity(colors.warning, 0.12) }]}>
            <Feather name="clock" size={16} color={colors.warning} />
          </View>
          <Text style={[styles.statValue, { color: colors.foreground }]}>{thisWeekCount}</Text>
          <Text style={styles.statLabel}>This Week</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.statCard} onPress={() => {}} activeOpacity={0.7}>
          <View style={[styles.statIconContainer, { backgroundColor: colorWithOpacity(colors.success, 0.12) }]}>
            <Feather name="zap" size={16} color={colors.success} />
          </View>
          <Text style={[styles.statValue, { color: colors.foreground }]}>{suggestionsCount}</Text>
          <Text style={styles.statLabel}>Tips</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderActionCard = (action: ActionItem) => {
    const config = PRIORITY_CONFIG[action.priority];
    const catColor = getCategoryColor(action.category);
    const catIcon = getCategoryIcon(action.category);

    return (
      <View key={action.id} style={styles.actionCard}>
        <View style={[styles.actionAccentBar, { backgroundColor: config.color }]} />
        <View style={styles.actionCardContent}>
          <View style={styles.actionTopRow}>
            <View style={[styles.categoryIconContainer, { backgroundColor: colorWithOpacity(catColor, 0.1) }]}>
              <Feather name={catIcon as any} size={iconSizes.xl} color={catColor} />
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
                <Feather name="bar-chart-2" size={iconSizes.sm} color={colors.mutedForeground} />
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
              <Feather name="chevron-right" size={iconSizes.sm} color={colors.primaryForeground} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderSection = (priority: 'fix_now' | 'this_week' | 'suggestions', actions: ActionItem[]) => {
    if (!actions || actions.length === 0) return null;
    const config = PRIORITY_CONFIG[priority];

    return (
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionDot, { backgroundColor: config.color }]} />
          <Text style={styles.sectionTitle}>{config.sectionLabel}</Text>
        </View>
        {actions.map(renderActionCard)}
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Feather name="check-circle" size={40} color={colors.success} />
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
              <Text style={styles.pageTitle}>Action Center</Text>
              <Text style={styles.pageSubtitle}>Items that need your attention</Text>
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
