import { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Dimensions,
  Share,
  Alert,
  ActivityIndicator
} from 'react-native';
import { Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useReportsStore } from '../../src/lib/store';
import { useTheme } from '../../src/lib/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type ReportPeriod = 'week' | 'month' | 'quarter' | 'year';
type ReportTab = 'overview' | 'revenue' | 'clients' | 'export';

const PERIODS: { key: ReportPeriod; label: string }[] = [
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'quarter', label: 'This Quarter' },
  { key: 'year', label: 'This Year' },
];

const REPORT_TABS: { key: ReportTab; label: string; icon: string }[] = [
  { key: 'overview', label: 'Overview', icon: 'bar-chart-2' },
  { key: 'revenue', label: 'Revenue', icon: 'dollar-sign' },
  { key: 'clients', label: 'Clients', icon: 'users' },
  { key: 'export', label: 'Export', icon: 'share' },
];

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
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  exportButtonText: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: '500',
  },
  periodSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
    gap: 8,
  },
  periodSelectorText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: colors.foreground,
  },
  periodPicker: {
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
    overflow: 'hidden',
  },
  periodOption: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  periodOptionActive: {
    backgroundColor: colors.primaryLight,
  },
  periodOptionText: {
    fontSize: 15,
    color: colors.foreground,
  },
  periodOptionTextActive: {
    color: colors.primary,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.mutedForeground,
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  statsGrid: {
    gap: 12,
    marginBottom: 24,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
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
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.muted,
  },
  trendBadgeUp: {
    backgroundColor: colors.successLight,
  },
  trendBadgeDown: {
    backgroundColor: colors.destructiveLight,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.foreground,
  },
  statTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.mutedForeground,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  statSubValue: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 4,
  },
  chartSection: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  chartSubtitle: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginLeft: 'auto',
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 150,
  },
  chartBarContainer: {
    flex: 1,
    alignItems: 'center',
  },
  chartBarWrapper: {
    width: 24,
    height: 100,
    backgroundColor: colors.muted,
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  chartBar: {
    width: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  chartBarLabel: {
    fontSize: 11,
    color: colors.mutedForeground,
    marginTop: 8,
  },
  chartBarAmount: {
    fontSize: 10,
    color: colors.foreground,
    fontWeight: '500',
    marginTop: 2,
  },
  chartYearTotal: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  chartYearLabel: {
    fontSize: 14,
    color: colors.mutedForeground,
  },
  chartYearValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  topClientsSection: {
    marginBottom: 24,
  },
  clientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  clientRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  clientRankText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  clientInfo: {
    flex: 1,
  },
  clientName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
  },
  clientMeta: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  clientRevenue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.success,
  },
  quickReportsSection: {
    marginBottom: 24,
  },
  reportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reportCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  reportCardContent: {
    flex: 1,
  },
  reportCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
  },
  reportCardSubtitle: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  insightsCard: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  insightsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
    marginTop: 12,
  },
  insightsText: {
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
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
  emptyText: {
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: 12,
  },
  reportTabContainer: {
    marginBottom: 16,
  },
  reportTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 8,
    borderRadius: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  reportTabActive: {
    backgroundColor: `${colors.primary}15`,
    borderColor: colors.primary,
  },
  reportTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.mutedForeground,
  },
  reportTabTextActive: {
    color: colors.primary,
  },
  overviewSummarySection: {
    marginBottom: 24,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  summaryItem: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryLabel: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.foreground,
  },
  revenueBreakdownSection: {
    marginBottom: 24,
  },
  breakdownCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  breakdownDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  breakdownLabel: {
    flex: 1,
    fontSize: 14,
    color: colors.foreground,
  },
  breakdownValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
  },
});

export default function ReportsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const { 
    summary, 
    revenueReport, 
    clientReport,
    period, 
    setPeriod,
    fetchAllReports, 
    isLoading,
    error 
  } = useReportsStore();
  
  const [showPeriodPicker, setShowPeriodPicker] = useState(false);
  const [activeReportTab, setActiveReportTab] = useState<ReportTab>('overview');

  const refreshData = useCallback(async () => {
    await fetchAllReports();
  }, [fetchAllReports]);

  useEffect(() => {
    refreshData();
  }, []);

  const formatCurrency = (amount: number) => {
    return `$${amount.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const formatCurrencyShort = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(1)}k`;
    }
    return `$${amount.toFixed(0)}`;
  };

  const handlePeriodChange = (newPeriod: ReportPeriod) => {
    setPeriod(newPeriod);
    setShowPeriodPicker(false);
  };

  const handleExport = async () => {
    if (!summary) {
      Alert.alert('No Data', 'Please wait for the report to load');
      return;
    }

    const reportText = `JobRunner Report - ${PERIODS.find(p => p.key === period)?.label}

REVENUE
Total Revenue: ${formatCurrency(summary.revenue.total)}
Pending Revenue: ${formatCurrency(summary.revenue.pending)}
Overdue: ${formatCurrency(summary.revenue.overdue)}
GST Collected: ${formatCurrency(summary.revenue.gstCollected)}

JOBS
Total Jobs: ${summary.jobs.total}
Completed: ${summary.jobs.completed}
In Progress: ${summary.jobs.inProgress}

QUOTES
Total Quotes: ${summary.quotes.total}
Accepted: ${summary.quotes.accepted}
Pending: ${summary.quotes.pending}
Conversion Rate: ${summary.quotes.conversionRate.toFixed(1)}%

INVOICES
Total Invoices: ${summary.invoices.total}
Paid: ${summary.invoices.paid}
Unpaid: ${summary.invoices.unpaid}
Overdue: ${summary.invoices.overdue}

Generated: ${new Date().toLocaleDateString('en-AU')}`;

    try {
      await Share.share({
        message: reportText,
        title: 'JobRunner Report'
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to share report');
    }
  };

  const handleReportDownload = (reportType: string) => {
    if (!summary) {
      Alert.alert('No Data', 'Please wait for the report to load');
      return;
    }
    
    Alert.alert(
      'Export Format',
      'Choose export format for your report',
      [
        {
          text: 'Spreadsheet (CSV)',
          onPress: () => shareReportAsCSV(reportType),
        },
        {
          text: 'Text Report',
          onPress: () => shareReportAsText(reportType),
        },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };
  
  const shareReportAsCSV = (reportType: string) => {
    if (!summary) return;
    
    let csvData = '';
    const periodLabel = PERIODS.find(p => p.key === period)?.label;
    
    switch (reportType) {
      case 'income':
        csvData = `JobRunner Income Report - ${periodLabel}\n\n`;
        csvData += `Metric,Amount\n`;
        csvData += `Total Revenue,$${summary.revenue.total.toFixed(2)}\n`;
        csvData += `Pending Revenue,$${summary.revenue.pending.toFixed(2)}\n`;
        csvData += `Overdue Revenue,$${summary.revenue.overdue.toFixed(2)}\n`;
        csvData += `GST Collected,$${summary.revenue.gstCollected.toFixed(2)}\n`;
        csvData += `Invoices Paid,${summary.invoices.paid}\n`;
        csvData += `Invoices Outstanding,${summary.invoices.unpaid + summary.invoices.overdue}\n`;
        csvData += `\nGenerated,${new Date().toLocaleDateString('en-AU')}`;
        break;
      case 'jobs':
        csvData = `JobRunner Jobs Report - ${periodLabel}\n\n`;
        csvData += `Metric,Value\n`;
        csvData += `Total Jobs,${summary.jobs.total}\n`;
        csvData += `Completed,${summary.jobs.completed}\n`;
        csvData += `In Progress,${summary.jobs.inProgress}\n`;
        csvData += `Completion Rate,${summary.jobs.total > 0 ? ((summary.jobs.completed / summary.jobs.total) * 100).toFixed(1) : 0}%\n`;
        csvData += `\nGenerated,${new Date().toLocaleDateString('en-AU')}`;
        break;
      case 'quotes':
        csvData = `JobRunner Quotes Report - ${periodLabel}\n\n`;
        csvData += `Metric,Value\n`;
        csvData += `Total Quotes,${summary.quotes.total}\n`;
        csvData += `Accepted,${summary.quotes.accepted}\n`;
        csvData += `Pending,${summary.quotes.pending}\n`;
        csvData += `Conversion Rate,${summary.quotes.conversionRate.toFixed(1)}%\n`;
        csvData += `\nGenerated,${new Date().toLocaleDateString('en-AU')}`;
        break;
      case 'tax':
        csvData = `JobRunner Tax Summary - ${periodLabel}\n\n`;
        csvData += `Metric,Amount\n`;
        csvData += `GST Collected,$${summary.revenue.gstCollected.toFixed(2)}\n`;
        csvData += `Total Revenue (incl GST),$${summary.revenue.total.toFixed(2)}\n`;
        csvData += `\nNote: GST calculations are estimates based on 10% GST.\n`;
        csvData += `Generated,${new Date().toLocaleDateString('en-AU')}`;
        break;
    }
    
    Share.share({
      message: csvData,
      title: `${reportType}_report_${period}.csv`
    }).catch(() => Alert.alert('Error', 'Failed to export CSV'));
  };
  
  const shareReportAsText = (reportType: string) => {
    if (!summary) return;
    
    let reportData = '';
    const periodLabel = PERIODS.find(p => p.key === period)?.label;
    
    switch (reportType) {
      case 'income':
        reportData = `Income Report - ${periodLabel}\n\nTotal Revenue: ${formatCurrency(summary.revenue.total)}\nPending Revenue: ${formatCurrency(summary.revenue.pending)}\nOverdue Revenue: ${formatCurrency(summary.revenue.overdue)}\n\nInvoices Paid: ${summary.invoices.paid}\nInvoices Outstanding: ${summary.invoices.unpaid + summary.invoices.overdue}\n\nGenerated: ${new Date().toLocaleDateString('en-AU')}`;
        break;
      case 'jobs':
        reportData = `Jobs Report - ${periodLabel}\n\nTotal Jobs: ${summary.jobs.total}\nCompleted: ${summary.jobs.completed}\nIn Progress: ${summary.jobs.inProgress}\nCompletion Rate: ${summary.jobs.total > 0 ? ((summary.jobs.completed / summary.jobs.total) * 100).toFixed(1) : 0}%\n\nGenerated: ${new Date().toLocaleDateString('en-AU')}`;
        break;
      case 'quotes':
        reportData = `Quotes Report - ${periodLabel}\n\nTotal Quotes: ${summary.quotes.total}\nAccepted: ${summary.quotes.accepted}\nPending: ${summary.quotes.pending}\nConversion Rate: ${summary.quotes.conversionRate.toFixed(1)}%\n\nGenerated: ${new Date().toLocaleDateString('en-AU')}`;
        break;
      case 'tax':
        reportData = `Tax Summary - ${periodLabel}\n\nGST Collected: ${formatCurrency(summary.revenue.gstCollected)}\nTotal Revenue (incl GST): ${formatCurrency(summary.revenue.total)}\n\nNote: GST calculations are estimates based on 10% GST.\nConsult your accountant for accurate tax reporting.\n\nGenerated: ${new Date().toLocaleDateString('en-AU')}`;
        break;
    }

    Share.share({
      message: reportData,
      title: `JobRunner ${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`
    }).catch(() => Alert.alert('Error', 'Failed to share report'));
  };

  const monthlyData = useMemo(() => {
    if (!revenueReport?.months) return [];
    return revenueReport.months.slice(0, 6).map(m => ({
      label: m.month.substring(0, 3),
      value: m.revenue,
      amount: formatCurrencyShort(m.revenue)
    }));
  }, [revenueReport]);

  const maxChartValue = useMemo(() => {
    return Math.max(...monthlyData.map(d => d.value), 1);
  }, [monthlyData]);

  const conversionRate = summary?.quotes.conversionRate || 0;

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
              refreshing={isLoading}
              onRefresh={refreshData}
              tintColor={colors.primary}
            />
          }
        >
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.pageTitle}>Reports</Text>
              <Text style={styles.pageSubtitle}>Business analytics and insights</Text>
            </View>
            <TouchableOpacity 
              style={styles.exportButton} 
              onPress={handleExport}
              disabled={!summary}
            >
              <Feather name="share" size={18} color={summary ? colors.foreground : colors.mutedForeground} />
              <Text style={[styles.exportButtonText, !summary && { color: colors.mutedForeground }]}>Share</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.periodSelector}
            onPress={() => setShowPeriodPicker(!showPeriodPicker)}
          >
            <Feather name="calendar" size={18} color={colors.primary} />
            <Text style={styles.periodSelectorText}>
              {PERIODS.find(p => p.key === period)?.label}
            </Text>
            <Feather name={showPeriodPicker ? "chevron-up" : "chevron-down"} size={18} color={colors.mutedForeground} />
          </TouchableOpacity>

          {showPeriodPicker && (
            <View style={styles.periodPicker}>
              {PERIODS.map((p, index) => (
                <TouchableOpacity
                  key={p.key}
                  style={[
                    styles.periodOption,
                    period === p.key && styles.periodOptionActive,
                    index === PERIODS.length - 1 && { borderBottomWidth: 0 }
                  ]}
                  onPress={() => handlePeriodChange(p.key)}
                >
                  <Text style={[
                    styles.periodOptionText,
                    period === p.key && styles.periodOptionTextActive
                  ]}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {error && (
            <View style={styles.errorContainer}>
              <Feather name="alert-circle" size={40} color={colors.destructive} />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={refreshData}>
                <Text style={styles.retryButtonText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.reportTabContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {REPORT_TABS.map((tab) => {
                const isActive = activeReportTab === tab.key;
                return (
                  <TouchableOpacity
                    key={tab.key}
                    style={[styles.reportTab, isActive && styles.reportTabActive]}
                    onPress={() => setActiveReportTab(tab.key)}
                    activeOpacity={0.7}
                  >
                    <Feather
                      name={tab.icon as any}
                      size={16}
                      color={isActive ? colors.primary : colors.mutedForeground}
                    />
                    <Text style={[styles.reportTabText, isActive && styles.reportTabTextActive]}>
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {isLoading && !summary && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Loading reports...</Text>
            </View>
          )}

          {activeReportTab === 'overview' && summary && (
            <>
              <Text style={styles.sectionTitle}>KEY METRICS</Text>
              <View style={styles.statsGrid}>
                <View style={styles.statsRow}>
                  <View style={styles.statCard}>
                    <View style={styles.statHeader}>
                      <View style={[styles.statIconContainer, { backgroundColor: colors.successLight }]}>
                        <Feather name="dollar-sign" size={22} color={colors.success} />
                      </View>
                      {summary.revenue.total > 0 && (
                        <View style={[styles.trendBadge, styles.trendBadgeUp]}>
                          <Feather name="trending-up" size={12} color={colors.success} />
                        </View>
                      )}
                    </View>
                    <Text style={styles.statValue}>{formatCurrency(summary.revenue.total)}</Text>
                    <Text style={styles.statTitle}>TOTAL REVENUE</Text>
                    {summary.revenue.gstCollected > 0 && (
                      <Text style={styles.statSubValue}>GST: {formatCurrency(summary.revenue.gstCollected)}</Text>
                    )}
                  </View>
                  <View style={styles.statCard}>
                    <View style={styles.statHeader}>
                      <View style={[styles.statIconContainer, { backgroundColor: colors.warningLight }]}>
                        <Feather name="clock" size={22} color={colors.warning} />
                      </View>
                      {summary.revenue.overdue > 0 && (
                        <View style={[styles.trendBadge, styles.trendBadgeDown]}>
                          <Feather name="alert-circle" size={12} color={colors.destructive} />
                        </View>
                      )}
                    </View>
                    <Text style={styles.statValue}>{formatCurrency(summary.revenue.pending + summary.revenue.overdue)}</Text>
                    <Text style={styles.statTitle}>OUTSTANDING</Text>
                    {summary.invoices.overdue > 0 && (
                      <Text style={styles.statSubValue}>{summary.invoices.overdue} overdue</Text>
                    )}
                  </View>
                </View>
                <View style={styles.statsRow}>
                  <View style={styles.statCard}>
                    <View style={styles.statHeader}>
                      <View style={styles.statIconContainer}>
                        <Feather name="briefcase" size={22} color={colors.primary} />
                      </View>
                      <View style={[styles.trendBadge, summary.jobs.completed > 0 ? styles.trendBadgeUp : {}]}>
                        <Feather name="check" size={12} color={summary.jobs.completed > 0 ? colors.success : colors.mutedForeground} />
                      </View>
                    </View>
                    <Text style={styles.statValue}>{summary.jobs.completed}</Text>
                    <Text style={styles.statTitle}>JOBS COMPLETED</Text>
                    <Text style={styles.statSubValue}>{summary.jobs.inProgress} in progress</Text>
                  </View>
                  <View style={styles.statCard}>
                    <View style={styles.statHeader}>
                      <View style={[styles.statIconContainer, { backgroundColor: colors.infoLight }]}>
                        <Feather name="file-text" size={22} color={colors.info} />
                      </View>
                      <View style={[styles.trendBadge, conversionRate >= 50 ? styles.trendBadgeUp : conversionRate > 0 ? styles.trendBadgeDown : {}]}>
                        <Feather 
                          name={conversionRate >= 50 ? "trending-up" : "trending-down"} 
                          size={12} 
                          color={conversionRate >= 50 ? colors.success : conversionRate > 0 ? colors.destructive : colors.mutedForeground}
                        />
                      </View>
                    </View>
                    <Text style={styles.statValue}>{conversionRate.toFixed(0)}%</Text>
                    <Text style={styles.statTitle}>QUOTE CONVERSION</Text>
                    <Text style={styles.statSubValue}>{summary.quotes.accepted} of {summary.quotes.total}</Text>
                  </View>
                </View>
              </View>

              {summary.jobs.total === 0 && summary.quotes.total === 0 && summary.invoices.total === 0 && (
                <View style={styles.emptyCard}>
                  <Feather name="bar-chart" size={40} color={colors.mutedForeground} />
                  <Text style={styles.emptyText}>
                    No data available for this period.{'\n'}
                    Create jobs, quotes, and invoices to see your business insights.
                  </Text>
                </View>
              )}

              <View style={styles.overviewSummarySection}>
                <Text style={styles.sectionTitle}>SUMMARY</Text>
                <View style={styles.summaryRow}>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Invoices Paid</Text>
                    <Text style={styles.summaryValue}>{summary.invoices.paid}</Text>
                  </View>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Invoices Unpaid</Text>
                    <Text style={styles.summaryValue}>{summary.invoices.unpaid}</Text>
                  </View>
                </View>
                <View style={styles.summaryRow}>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Total Jobs</Text>
                    <Text style={styles.summaryValue}>{summary.jobs.total}</Text>
                  </View>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Total Quotes</Text>
                    <Text style={styles.summaryValue}>{summary.quotes.total}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.insightsCard}>
                <Feather name="zap" size={32} color={colors.primary} />
                <Text style={styles.insightsTitle}>AI Business Insights</Text>
                <Text style={styles.insightsText}>
                  Smart analytics powered by AI will analyze your business trends and provide actionable recommendations.
                </Text>
              </View>
            </>
          )}

          {activeReportTab === 'revenue' && (
            <>
              {revenueReport && monthlyData.length > 0 ? (
                <View style={styles.chartSection}>
                  <View style={styles.chartHeader}>
                    <Feather name="bar-chart-2" size={20} color={colors.foreground} />
                    <Text style={styles.chartTitle}>Revenue Overview</Text>
                    <Text style={styles.chartSubtitle}>{revenueReport.year}</Text>
                  </View>
                  <View style={styles.chartContainer}>
                    {monthlyData.map((data, index) => (
                      <View key={index} style={styles.chartBarContainer}>
                        <View style={styles.chartBarWrapper}>
                          <View style={[styles.chartBar, { height: `${maxChartValue > 0 ? (data.value / maxChartValue) * 100 : 0}%` }]} />
                        </View>
                        <Text style={styles.chartBarLabel}>{data.label}</Text>
                        <Text style={styles.chartBarAmount}>{data.amount}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={styles.chartYearTotal}>
                    <Text style={styles.chartYearLabel}>Year Total</Text>
                    <Text style={styles.chartYearValue}>{formatCurrency(revenueReport.yearTotal)}</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.emptyCard}>
                  <Feather name="bar-chart" size={40} color={colors.mutedForeground} />
                  <Text style={styles.emptyText}>No revenue data available yet</Text>
                </View>
              )}

              {summary && (
                <View style={styles.revenueBreakdownSection}>
                  <Text style={styles.sectionTitle}>REVENUE BREAKDOWN</Text>
                  <View style={styles.breakdownCard}>
                    <View style={styles.breakdownRow}>
                      <View style={styles.breakdownDot} />
                      <Text style={styles.breakdownLabel}>Collected Revenue</Text>
                      <Text style={[styles.breakdownValue, { color: colors.success }]}>{formatCurrency(summary.revenue.total)}</Text>
                    </View>
                    <View style={styles.breakdownRow}>
                      <View style={[styles.breakdownDot, { backgroundColor: colors.warning }]} />
                      <Text style={styles.breakdownLabel}>Pending Revenue</Text>
                      <Text style={[styles.breakdownValue, { color: colors.warning }]}>{formatCurrency(summary.revenue.pending)}</Text>
                    </View>
                    <View style={styles.breakdownRow}>
                      <View style={[styles.breakdownDot, { backgroundColor: colors.destructive }]} />
                      <Text style={styles.breakdownLabel}>Overdue Revenue</Text>
                      <Text style={[styles.breakdownValue, { color: colors.destructive }]}>{formatCurrency(summary.revenue.overdue)}</Text>
                    </View>
                    {summary.revenue.gstCollected > 0 && (
                      <View style={[styles.breakdownRow, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, marginTop: 4 }]}>
                        <View style={[styles.breakdownDot, { backgroundColor: colors.info }]} />
                        <Text style={styles.breakdownLabel}>GST Collected</Text>
                        <Text style={styles.breakdownValue}>{formatCurrency(summary.revenue.gstCollected)}</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}
            </>
          )}

          {activeReportTab === 'clients' && (
            <>
              {clientReport && clientReport.clients.length > 0 ? (
                <View style={styles.topClientsSection}>
                  <Text style={styles.sectionTitle}>TOP CLIENTS BY REVENUE</Text>
                  {clientReport.clients.slice(0, 10).map((client, index) => (
                    <View key={client.id} style={styles.clientCard}>
                      <View style={styles.clientRank}>
                        <Text style={styles.clientRankText}>{index + 1}</Text>
                      </View>
                      <View style={styles.clientInfo}>
                        <Text style={styles.clientName} numberOfLines={1}>{client.name}</Text>
                        <Text style={styles.clientMeta}>
                          {client.jobsCompleted} jobs  {client.invoicesPaid} invoices paid
                        </Text>
                      </View>
                      <Text style={styles.clientRevenue}>{formatCurrency(client.totalRevenue)}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyCard}>
                  <Feather name="users" size={40} color={colors.mutedForeground} />
                  <Text style={styles.emptyText}>No client data available yet</Text>
                </View>
              )}
            </>
          )}

          {activeReportTab === 'export' && (
            <View style={styles.quickReportsSection}>
              <Text style={styles.sectionTitle}>EXPORT REPORTS</Text>
              <Text style={[styles.emptyText, { marginBottom: 16, textAlign: 'left' }]}>
                Choose a report to share or export as CSV or text.
              </Text>
              
              <TouchableOpacity style={styles.reportCard} onPress={() => handleReportDownload('income')}>
                <View style={[styles.reportCardIcon, { backgroundColor: colors.successLight }]}>
                  <Feather name="dollar-sign" size={20} color={colors.success} />
                </View>
                <View style={styles.reportCardContent}>
                  <Text style={styles.reportCardTitle}>Income Report</Text>
                  <Text style={styles.reportCardSubtitle}>Detailed breakdown of all income</Text>
                </View>
                <Feather name="share" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.reportCard} onPress={() => handleReportDownload('jobs')}>
                <View style={styles.reportCardIcon}>
                  <Feather name="briefcase" size={20} color={colors.primary} />
                </View>
                <View style={styles.reportCardContent}>
                  <Text style={styles.reportCardTitle}>Jobs Report</Text>
                  <Text style={styles.reportCardSubtitle}>Jobs by status and completion rate</Text>
                </View>
                <Feather name="share" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.reportCard} onPress={() => handleReportDownload('quotes')}>
                <View style={[styles.reportCardIcon, { backgroundColor: colors.infoLight }]}>
                  <Feather name="file-text" size={20} color={colors.info} />
                </View>
                <View style={styles.reportCardContent}>
                  <Text style={styles.reportCardTitle}>Quotes Report</Text>
                  <Text style={styles.reportCardSubtitle}>Quote conversion and acceptance rates</Text>
                </View>
                <Feather name="share" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.reportCard} onPress={() => handleReportDownload('tax')}>
                <View style={[styles.reportCardIcon, { backgroundColor: colors.warningLight }]}>
                  <Feather name="percent" size={20} color={colors.warning} />
                </View>
                <View style={styles.reportCardContent}>
                  <Text style={styles.reportCardTitle}>Tax Summary</Text>
                  <Text style={styles.reportCardSubtitle}>GST collected and payable</Text>
                </View>
                <Feather name="share" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>

              <TouchableOpacity style={[styles.reportCard, { marginTop: 8 }]} onPress={handleExport}>
                <View style={[styles.reportCardIcon, { backgroundColor: `${colors.primary}15` }]}>
                  <Feather name="share-2" size={20} color={colors.primary} />
                </View>
                <View style={styles.reportCardContent}>
                  <Text style={styles.reportCardTitle}>Full Summary</Text>
                  <Text style={styles.reportCardSubtitle}>Share complete business summary</Text>
                </View>
                <Feather name="share" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>
    </>
  );
}
