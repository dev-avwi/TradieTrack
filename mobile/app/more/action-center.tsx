import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, shadows, typography, iconSizes, usePageShell } from '../../src/lib/design-tokens';
import { api } from '../../src/lib/api';
import { useContentWidth, isTablet } from '../../src/lib/device';

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

const SECTION_CONFIG = {
  fix_now: {
    label: 'Fix Now',
    icon: 'alert-circle' as const,
    color: '#ef4444',
    bgColor: 'rgba(239,68,68,0.1)',
  },
  this_week: {
    label: 'This Week',
    icon: 'clock' as const,
    color: '#f59e0b',
    bgColor: 'rgba(245,158,11,0.1)',
  },
  suggestions: {
    label: 'Suggestions',
    icon: 'info' as const,
    color: '#3b82f6',
    bgColor: 'rgba(59,130,246,0.1)',
  },
};

export default function ActionCenterScreen() {
  const { colors } = useTheme();
  const contentWidth = useContentWidth();
  const isTabletDevice = isTablet();
  const responsiveShell = usePageShell();
  const styles = useMemo(() => createStyles(colors, contentWidth, responsiveShell.paddingHorizontal), [colors, contentWidth, responsiveShell.paddingHorizontal]);

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

  const renderSummaryCards = () => {
    if (!data?.summary) return null;
    const { fixNowCount, thisWeekCount, suggestionsCount, totalCount } = data.summary;

    return (
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { borderLeftColor: '#ef4444' }]}>
          <Text style={[styles.summaryValue, { color: '#ef4444' }]}>{fixNowCount}</Text>
          <Text style={styles.summaryLabel}>Fix Now</Text>
        </View>
        <View style={[styles.summaryCard, { borderLeftColor: '#f59e0b' }]}>
          <Text style={[styles.summaryValue, { color: '#f59e0b' }]}>{thisWeekCount}</Text>
          <Text style={styles.summaryLabel}>This Week</Text>
        </View>
        <View style={[styles.summaryCard, { borderLeftColor: '#3b82f6' }]}>
          <Text style={[styles.summaryValue, { color: '#3b82f6' }]}>{suggestionsCount}</Text>
          <Text style={styles.summaryLabel}>Suggestions</Text>
        </View>
      </View>
    );
  };

  const renderActionCard = (action: ActionItem) => {
    const config = SECTION_CONFIG[action.priority];

    return (
      <View key={action.id} style={styles.actionCard}>
        <View style={styles.actionHeader}>
          <View style={styles.actionTitleRow}>
            <Text style={styles.actionTitle} numberOfLines={2}>{action.title}</Text>
          </View>
          {action.category ? (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{action.category}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.actionDescription} numberOfLines={3}>{action.description}</Text>
        {action.metric ? (
          <View style={styles.metricRow}>
            <Feather name="bar-chart-2" size={iconSizes.sm} color={colors.mutedForeground} />
            <Text style={styles.metricText}>{action.metric}</Text>
          </View>
        ) : null}
        <View style={styles.actionFooter}>
          <View style={[styles.impactBadge, { backgroundColor: config.bgColor }]}>
            <Feather name={config.icon} size={12} color={config.color} />
            <Text style={[styles.impactText, { color: config.color }]}>{action.impact}</Text>
          </View>
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
    const config = SECTION_CONFIG[priority];

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIconContainer, { backgroundColor: config.bgColor }]}>
            <Feather name={config.icon} size={iconSizes.md} color={config.color} />
          </View>
          <Text style={styles.sectionTitle}>{config.label}</Text>
          <View style={[styles.sectionCountBadge, { backgroundColor: config.bgColor }]}>
            <Text style={[styles.sectionCountText, { color: config.color }]}>{actions.length}</Text>
          </View>
        </View>
        {actions.map(renderActionCard)}
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Feather name="check-circle" size={48} color={colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>All clear!</Text>
      <Text style={styles.emptySubtitle}>No actions needed right now.</Text>
    </View>
  );

  const renderErrorState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Feather name="alert-triangle" size={48} color={colors.destructive} />
      </View>
      <Text style={styles.emptyTitle}>Something went wrong</Text>
      <Text style={styles.emptySubtitle}>{error}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={fetchData} activeOpacity={0.7}>
        <Feather name="refresh-cw" size={14} color="#fff" />
        <Text style={styles.retryText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );

  const hasActions = data && data.summary && data.summary.totalCount > 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{
        title: 'Action Center',
        headerShown: true,
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.foreground,
      }} />
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading Action Center...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
          }
          showsVerticalScrollIndicator={false}
        >
          {error ? renderErrorState() : !hasActions ? renderEmptyState() : (
            <>
              {renderSummaryCards()}
              {renderSection('fix_now', data!.sections.fix_now)}
              {renderSection('this_week', data!.sections.this_week)}
              {renderSection('suggestions', data!.sections.suggestions)}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors, contentWidth: number, paddingH: number) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: paddingH,
      paddingTop: spacing.lg,
      paddingBottom: spacing['3xl'],
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: spacing.md,
    },
    loadingText: {
      ...typography.caption,
      color: colors.mutedForeground,
    },
    summaryRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing['2xl'],
    },
    summaryCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: radius.xl,
      padding: spacing.md,
      borderLeftWidth: 3,
      ...shadows.sm,
    },
    summaryValue: {
      ...typography.statValue,
    },
    summaryLabel: {
      ...typography.caption,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    section: {
      marginBottom: spacing['2xl'],
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    sectionIconContainer: {
      width: 28,
      height: 28,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionTitle: {
      ...typography.cardTitle,
      color: colors.foreground,
      flex: 1,
    },
    sectionCountBadge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radius.pill,
    },
    sectionCountText: {
      ...typography.badge,
    },
    actionCard: {
      backgroundColor: colors.card,
      borderRadius: radius.xl,
      padding: spacing.lg,
      marginBottom: spacing.sm,
      ...shadows.sm,
    },
    actionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: spacing.sm,
      marginBottom: spacing.xs,
    },
    actionTitleRow: {
      flex: 1,
    },
    actionTitle: {
      ...typography.cardTitle,
      color: colors.foreground,
    },
    categoryBadge: {
      backgroundColor: colors.border,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radius.sm,
    },
    categoryText: {
      ...typography.badge,
      color: colors.mutedForeground,
    },
    actionDescription: {
      ...typography.body,
      color: colors.mutedForeground,
      marginBottom: spacing.md,
    },
    metricRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginBottom: spacing.md,
      backgroundColor: colors.background,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.sm,
      alignSelf: 'flex-start',
    },
    metricText: {
      ...typography.caption,
      color: colors.mutedForeground,
      fontWeight: '600',
    },
    actionFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: spacing.sm,
    },
    impactBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.sm,
      flex: 1,
    },
    impactText: {
      ...typography.badge,
      flexShrink: 1,
    },
    ctaButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
    },
    ctaText: {
      ...typography.button,
      color: '#fff',
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing['4xl'] * 2,
      gap: spacing.sm,
    },
    emptyIconContainer: {
      marginBottom: spacing.md,
    },
    emptyTitle: {
      ...typography.cardTitle,
      color: colors.foreground,
    },
    emptySubtitle: {
      ...typography.body,
      color: colors.mutedForeground,
      textAlign: 'center',
    },
    retryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      marginTop: spacing.lg,
    },
    retryText: {
      ...typography.button,
      color: '#fff',
    },
  });
