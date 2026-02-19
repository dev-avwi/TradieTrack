import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, shadows, typography, iconSizes, usePageShell } from '../../src/lib/design-tokens';
import { api } from '../../src/lib/api';
import { useContentWidth, isTablet } from '../../src/lib/device';

const formatCurrency = (amount: number) => {
  const safeAmount = isNaN(amount) ? 0 : amount;
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(safeAmount);
};

const formatPercent = (value: number) => {
  const safeValue = isNaN(value) ? 0 : value;
  return `${Math.round(safeValue)}%`;
};

interface SummaryData {
  totalJobs?: number;
  pendingJobs?: number;
  scheduledJobs?: number;
  inProgressJobs?: number;
  completedJobs?: number;
  invoicedJobs?: number;
  totalClients?: number;
  totalQuotes?: number;
  acceptedQuotes?: number;
  rejectedQuotes?: number;
  pendingQuotes?: number;
  totalInvoices?: number;
  paidInvoices?: number;
  overdueInvoices?: number;
  outstandingInvoices?: number;
  [key: string]: any;
}

interface RevenueData {
  totalRevenue?: number;
  totalOutstanding?: number;
  totalOverdue?: number;
  totalPaid?: number;
  monthlyRevenue?: Array<{ month: string; revenue: number }>;
  [key: string]: any;
}

interface ProfitabilityData {
  totalRevenue?: number;
  totalCosts?: number;
  grossProfit?: number;
  profitMargin?: number;
  averageJobValue?: number;
  averageJobProfit?: number;
  [key: string]: any;
}

export default function InsightsScreen() {
  const { colors } = useTheme();
  const contentWidth = useContentWidth();
  const isTabletDevice = isTablet();
  const responsiveShell = usePageShell();
  const styles = useMemo(() => createStyles(colors, contentWidth, responsiveShell.paddingHorizontal), [colors, contentWidth, responsiveShell.paddingHorizontal]);

  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [profitability, setProfitability] = useState<ProfitabilityData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [summaryRes, revenueRes, profitabilityRes] = await Promise.all([
        api.get<SummaryData>('/api/reports/summary'),
        api.get<RevenueData>('/api/reports/revenue'),
        api.get<ProfitabilityData>('/api/reports/profitability'),
      ]);

      if (summaryRes.error && revenueRes.error && profitabilityRes.error) {
        setError(summaryRes.error || 'Failed to load insights data');
        return;
      }

      setSummary(summaryRes.data || null);
      setRevenue(revenueRes.data || null);
      setProfitability(profitabilityRes.data || null);
    } catch (err) {
      setError('Failed to load insights data. Please try again.');
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

  const handleRetry = useCallback(() => {
    setIsLoading(true);
    setError(null);
    fetchData();
  }, [fetchData]);

  const quoteConversionRate = useMemo(() => {
    if (!summary) return 0;
    const total = (summary.totalQuotes || 0);
    if (total === 0) return 0;
    return ((summary.acceptedQuotes || 0) / total) * 100;
  }, [summary]);

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Stack.Screen options={{
          title: 'Insights',
          headerShown: true,
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.foreground,
        }} />
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading Insights...</Text>
      </View>
    );
  }

  if (error && !summary && !revenue && !profitability) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Stack.Screen options={{
          title: 'Insights',
          headerShown: true,
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.foreground,
        }} />
        <Feather name="alert-circle" size={48} color={colors.mutedForeground} />
        <Text style={styles.errorTitle}>Unable to Load Insights</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleRetry} activeOpacity={0.7}>
          <Feather name="refresh-cw" size={16} color="#fff" />
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const hasNoData = !summary && !revenue && !profitability;

  if (hasNoData) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Stack.Screen options={{
          title: 'Insights',
          headerShown: true,
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.foreground,
        }} />
        <Feather name="bar-chart-2" size={48} color={colors.mutedForeground} />
        <Text style={styles.emptyTitle}>No Data Yet</Text>
        <Text style={styles.emptyMessage}>Start creating jobs, quotes, and invoices to see your business insights here.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{
        title: 'Insights',
        headerShown: true,
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.foreground,
      }} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionHeader}>
          <Feather name="dollar-sign" size={iconSizes.lg} color={colors.primary} />
          <Text style={styles.sectionTitle}>Revenue</Text>
        </View>
        <View style={styles.cardRow}>
          <View style={styles.card}>
            <View style={[styles.cardIconCircle, { backgroundColor: 'rgba(34,197,94,0.1)' }]}>
              <Feather name="trending-up" size={iconSizes.md} color="#22c55e" />
            </View>
            <Text style={styles.cardLabel}>Total Revenue</Text>
            <Text style={[styles.cardValue, { color: '#22c55e' }]}>
              {formatCurrency(revenue?.totalRevenue || revenue?.totalPaid || 0)}
            </Text>
          </View>
          <View style={styles.card}>
            <View style={[styles.cardIconCircle, { backgroundColor: 'rgba(245,158,11,0.1)' }]}>
              <Feather name="clock" size={iconSizes.md} color="#f59e0b" />
            </View>
            <Text style={styles.cardLabel}>Outstanding</Text>
            <Text style={[styles.cardValue, { color: '#f59e0b' }]}>
              {formatCurrency(revenue?.totalOutstanding || 0)}
            </Text>
          </View>
        </View>
        <View style={styles.cardRow}>
          <View style={styles.card}>
            <View style={[styles.cardIconCircle, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
              <Feather name="alert-circle" size={iconSizes.md} color="#ef4444" />
            </View>
            <Text style={styles.cardLabel}>Overdue</Text>
            <Text style={[styles.cardValue, { color: '#ef4444' }]}>
              {formatCurrency(revenue?.totalOverdue || 0)}
            </Text>
          </View>
          <View style={styles.card}>
            <View style={[styles.cardIconCircle, { backgroundColor: 'rgba(59,130,246,0.1)' }]}>
              <Feather name="check-circle" size={iconSizes.md} color="#3b82f6" />
            </View>
            <Text style={styles.cardLabel}>Paid</Text>
            <Text style={[styles.cardValue, { color: '#3b82f6' }]}>
              {formatCurrency(revenue?.totalPaid || 0)}
            </Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Feather name="briefcase" size={iconSizes.lg} color={colors.primary} />
          <Text style={styles.sectionTitle}>Jobs</Text>
        </View>
        <View style={styles.card}>
          <View style={styles.jobStatsGrid}>
            <JobStatItem label="Total" value={summary?.totalJobs || 0} color="#3b82f6" icon="layers" />
            <JobStatItem label="Pending" value={summary?.pendingJobs || 0} color="#f59e0b" icon="clock" />
            <JobStatItem label="Scheduled" value={summary?.scheduledJobs || 0} color="#6366f1" icon="calendar" />
            <JobStatItem label="In Progress" value={summary?.inProgressJobs || 0} color="#22c55e" icon="play-circle" />
            <JobStatItem label="Completed" value={summary?.completedJobs || 0} color="#10b981" icon="check-circle" />
            <JobStatItem label="Invoiced" value={summary?.invoicedJobs || 0} color="#8b5cf6" icon="file-text" />
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Feather name="file-text" size={iconSizes.lg} color={colors.primary} />
          <Text style={styles.sectionTitle}>Quote Conversion</Text>
        </View>
        <View style={styles.cardRow}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Total Quotes</Text>
            <Text style={[styles.cardValue, { color: '#3b82f6' }]}>
              {summary?.totalQuotes || 0}
            </Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Conversion Rate</Text>
            <Text style={[styles.cardValue, { color: '#22c55e' }]}>
              {formatPercent(quoteConversionRate)}
            </Text>
          </View>
        </View>
        <View style={styles.cardRow}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Accepted</Text>
            <Text style={[styles.cardValue, { color: '#22c55e' }]}>
              {summary?.acceptedQuotes || 0}
            </Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Pending</Text>
            <Text style={[styles.cardValue, { color: '#f59e0b' }]}>
              {summary?.pendingQuotes || 0}
            </Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Feather name="pie-chart" size={iconSizes.lg} color={colors.primary} />
          <Text style={styles.sectionTitle}>Profitability</Text>
        </View>
        <View style={styles.cardRow}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Gross Profit</Text>
            <Text style={[styles.cardValue, { color: '#22c55e' }]}>
              {formatCurrency(profitability?.grossProfit || 0)}
            </Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Profit Margin</Text>
            <Text style={[styles.cardValue, { color: profitability?.profitMargin && profitability.profitMargin > 0 ? '#22c55e' : '#ef4444' }]}>
              {formatPercent(profitability?.profitMargin || 0)}
            </Text>
          </View>
        </View>
        <View style={styles.cardRow}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Avg Job Value</Text>
            <Text style={[styles.cardValue, { color: '#6366f1' }]}>
              {formatCurrency(profitability?.averageJobValue || 0)}
            </Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Total Costs</Text>
            <Text style={[styles.cardValue, { color: '#ef4444' }]}>
              {formatCurrency(profitability?.totalCosts || 0)}
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function JobStatItem({ label, value, color, icon }: { label: string; value: number; color: string; icon: string }) {
  return (
    <View style={jobStatStyles.item}>
      <Feather name={icon as any} size={14} color={color} />
      <Text style={jobStatStyles.value}>{value}</Text>
      <Text style={jobStatStyles.label}>{label}</Text>
    </View>
  );
}

const jobStatStyles = StyleSheet.create({
  item: {
    alignItems: 'center',
    width: '33%' as any,
    paddingVertical: spacing.sm,
  },
  value: {
    ...typography.cardTitle,
    marginTop: 4,
  },
  label: {
    ...typography.caption,
    marginTop: 2,
    opacity: 0.7,
  },
});

const createStyles = (colors: ThemeColors, contentWidth: number, paddingH: number) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    centered: {
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: spacing['2xl'],
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: paddingH,
      paddingTop: spacing.lg,
      paddingBottom: spacing['3xl'],
    },
    loadingText: {
      ...typography.body,
      color: colors.mutedForeground,
      marginTop: spacing.md,
    },
    errorTitle: {
      ...typography.cardTitle,
      color: colors.foreground,
      marginTop: spacing.lg,
    },
    errorMessage: {
      ...typography.body,
      color: colors.mutedForeground,
      marginTop: spacing.sm,
      textAlign: 'center',
    },
    retryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      marginTop: spacing.lg,
    },
    retryButtonText: {
      ...typography.button,
      color: '#fff',
    },
    emptyTitle: {
      ...typography.cardTitle,
      color: colors.foreground,
      marginTop: spacing.lg,
    },
    emptyMessage: {
      ...typography.body,
      color: colors.mutedForeground,
      marginTop: spacing.sm,
      textAlign: 'center',
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing['2xl'],
      marginBottom: spacing.md,
    },
    sectionTitle: {
      ...typography.cardTitle,
      color: colors.foreground,
    },
    cardRow: {
      flexDirection: 'row',
      gap: spacing.md,
      marginBottom: spacing.md,
    },
    card: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: radius.xl,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.sm,
    },
    cardIconCircle: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    cardLabel: {
      ...typography.caption,
      color: colors.mutedForeground,
      marginBottom: 4,
    },
    cardValue: {
      ...typography.statValue,
      color: colors.foreground,
    },
    jobStatsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
  });
