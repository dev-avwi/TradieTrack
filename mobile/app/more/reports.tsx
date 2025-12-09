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
  Alert
} from 'react-native';
import { Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useJobsStore, useInvoicesStore, useQuotesStore } from '../../src/lib/store';
import { useTheme } from '../../src/lib/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type ReportPeriod = 'week' | 'month' | 'quarter' | 'year';

const PERIODS: { key: ReportPeriod; label: string }[] = [
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'quarter', label: 'This Quarter' },
  { key: 'year', label: 'This Year' },
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
});

export default function ReportsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const { jobs, fetchJobs, isLoading: jobsLoading } = useJobsStore();
  const { invoices, fetchInvoices, isLoading: invoicesLoading } = useInvoicesStore();
  const { quotes, fetchQuotes, isLoading: quotesLoading } = useQuotesStore();
  const [period, setPeriod] = useState<ReportPeriod>('month');
  const [showPeriodPicker, setShowPeriodPicker] = useState(false);

  const refreshData = useCallback(async () => {
    await Promise.all([fetchJobs(), fetchInvoices(), fetchQuotes()]);
  }, [fetchJobs, fetchInvoices, fetchQuotes]);

  useEffect(() => {
    refreshData();
  }, []);

  const formatCurrency = (amount: number) => {
    return `$${(amount / 100).toLocaleString('en-AU', { minimumFractionDigits: 0 })}`;
  };

  const totalRevenue = invoices
    .filter(i => i.status === 'paid')
    .reduce((sum, i) => sum + (i.total || 0), 0);

  const outstandingAmount = invoices
    .filter(i => i.status === 'sent' || i.status === 'overdue')
    .reduce((sum, i) => sum + ((i.total || 0) - (i.amountPaid || 0)), 0);

  const completedJobs = jobs.filter(j => j.status === 'done' || j.status === 'invoiced').length;
  const acceptedQuotes = quotes.filter(q => q.status === 'accepted').length;
  const conversionRate = quotes.length > 0 ? Math.round((acceptedQuotes / quotes.length) * 100) : 0;

  const generateMonthlyData = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const now = new Date();
    
    return months.map((label, index) => {
      const monthInvoices = invoices.filter(inv => {
        if (!inv.createdAt) return false;
        const invDate = new Date(inv.createdAt);
        return invDate.getMonth() === index && inv.status === 'paid';
      });
      const value = monthInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
      return {
        label,
        value: value / 100,
        amount: value > 0 ? `$${(value / 100 / 1000).toFixed(1)}k` : '$0'
      };
    });
  };

  const monthlyData = generateMonthlyData();
  const maxValue = Math.max(...monthlyData.map(d => d.value), 1);

  const isLoading = jobsLoading || invoicesLoading || quotesLoading;

  const handleExport = async () => {
    const reportText = `TradieTrack Report - ${PERIODS.find(p => p.key === period)?.label}

Total Revenue: ${formatCurrency(totalRevenue)}
Outstanding: ${formatCurrency(outstandingAmount)}
Jobs Completed: ${completedJobs}
Quote Conversion: ${conversionRate}% (${acceptedQuotes}/${quotes.length})

Generated: ${new Date().toLocaleDateString('en-AU')}`;

    try {
      await Share.share({
        message: reportText,
        title: 'TradieTrack Report'
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to share report');
    }
  };

  const handleReportDownload = (reportType: string) => {
    let reportData = '';
    
    switch (reportType) {
      case 'income':
        const paidInvoices = invoices.filter(i => i.status === 'paid');
        reportData = `Income Report\n\nTotal Paid Invoices: ${paidInvoices.length}\nTotal Revenue: ${formatCurrency(totalRevenue)}\n\nDetails:\n${paidInvoices.map(i => `- Invoice #${i.invoiceNumber}: ${formatCurrency(i.total || 0)}`).join('\n')}`;
        break;
      case 'jobs':
        reportData = `Jobs Report\n\nTotal Jobs: ${jobs.length}\nCompleted: ${completedJobs}\nIn Progress: ${jobs.filter(j => j.status === 'in_progress').length}\nPending: ${jobs.filter(j => j.status === 'pending').length}`;
        break;
      case 'time':
        reportData = `Time Tracking Report\n\nTotal Jobs with Time: ${jobs.filter(j => j.totalHours).length}\nTotal Hours: ${jobs.reduce((sum, j) => sum + (j.totalHours || 0), 0).toFixed(1)}`;
        break;
      case 'tax':
        const gstCollected = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + (i.gstAmount || 0), 0);
        reportData = `Tax Summary\n\nGST Collected: ${formatCurrency(gstCollected)}\nTotal Taxable Revenue: ${formatCurrency(totalRevenue)}`;
        break;
    }

    Share.share({
      message: reportData,
      title: `TradieTrack ${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`
    }).catch(() => Alert.alert('Error', 'Failed to share report'));
  };

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
            <TouchableOpacity style={styles.exportButton} onPress={handleExport}>
              <Feather name="share" size={18} color={colors.foreground} />
              <Text style={styles.exportButtonText}>Share</Text>
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
            <Feather name="chevron-down" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>

          {showPeriodPicker && (
            <View style={styles.periodPicker}>
              {PERIODS.map((p) => (
                <TouchableOpacity
                  key={p.key}
                  style={[
                    styles.periodOption,
                    period === p.key && styles.periodOptionActive
                  ]}
                  onPress={() => {
                    setPeriod(p.key);
                    setShowPeriodPicker(false);
                  }}
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

          <Text style={styles.sectionTitle}>KEY METRICS</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <View style={styles.statHeader}>
                  <View style={styles.statIconContainer}>
                    <Feather name="dollar-sign" size={22} color={colors.success} />
                  </View>
                  <View style={[styles.trendBadge, styles.trendBadgeUp]}>
                    <Feather name="trending-up" size={12} color={colors.success} />
                  </View>
                </View>
                <Text style={styles.statValue}>{formatCurrency(totalRevenue)}</Text>
                <Text style={styles.statTitle}>TOTAL REVENUE</Text>
              </View>
              <View style={styles.statCard}>
                <View style={styles.statHeader}>
                  <View style={styles.statIconContainer}>
                    <Feather name="clock" size={22} color={colors.warning} />
                  </View>
                  <View style={styles.trendBadge}>
                    <Feather name="minus" size={12} color={colors.mutedForeground} />
                  </View>
                </View>
                <Text style={styles.statValue}>{formatCurrency(outstandingAmount)}</Text>
                <Text style={styles.statTitle}>OUTSTANDING</Text>
              </View>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <View style={styles.statHeader}>
                  <View style={styles.statIconContainer}>
                    <Feather name="briefcase" size={22} color={colors.primary} />
                  </View>
                  <View style={[styles.trendBadge, styles.trendBadgeUp]}>
                    <Feather name="trending-up" size={12} color={colors.success} />
                  </View>
                </View>
                <Text style={styles.statValue}>{completedJobs}</Text>
                <Text style={styles.statTitle}>JOBS COMPLETED</Text>
              </View>
              <View style={styles.statCard}>
                <View style={styles.statHeader}>
                  <View style={styles.statIconContainer}>
                    <Feather name="file-text" size={22} color={colors.info} />
                  </View>
                  <View style={[styles.trendBadge, conversionRate >= 50 ? styles.trendBadgeUp : styles.trendBadgeDown]}>
                    <Feather 
                      name="trending-up" 
                      size={12} 
                      color={conversionRate >= 50 ? colors.success : colors.destructive}
                      style={conversionRate < 50 ? { transform: [{ rotate: '180deg' }] } : undefined}
                    />
                  </View>
                </View>
                <Text style={styles.statValue}>{conversionRate}%</Text>
                <Text style={styles.statTitle}>QUOTE CONVERSION</Text>
                <Text style={styles.statSubValue}>{acceptedQuotes} of {quotes.length}</Text>
              </View>
            </View>
          </View>

          <View style={styles.chartSection}>
            <View style={styles.chartHeader}>
              <Feather name="bar-chart-2" size={20} color={colors.foreground} />
              <Text style={styles.chartTitle}>Revenue Overview</Text>
            </View>
            <View style={styles.chartContainer}>
              {monthlyData.map((data, index) => (
                <View key={index} style={styles.chartBarContainer}>
                  <View style={styles.chartBarWrapper}>
                    <View style={[styles.chartBar, { height: `${maxValue > 0 ? (data.value / maxValue) * 100 : 0}%` }]} />
                  </View>
                  <Text style={styles.chartBarLabel}>{data.label}</Text>
                  <Text style={styles.chartBarAmount}>{data.amount}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.quickReportsSection}>
            <Text style={styles.sectionTitle}>QUICK REPORTS</Text>
            
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

            <TouchableOpacity style={styles.reportCard} onPress={() => handleReportDownload('time')}>
              <View style={[styles.reportCardIcon, { backgroundColor: colors.warningLight }]}>
                <Feather name="clock" size={20} color={colors.warning} />
              </View>
              <View style={styles.reportCardContent}>
                <Text style={styles.reportCardTitle}>Time Tracking Report</Text>
                <Text style={styles.reportCardSubtitle}>Hours worked and billable time</Text>
              </View>
              <Feather name="share" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.reportCard} onPress={() => handleReportDownload('tax')}>
              <View style={[styles.reportCardIcon, { backgroundColor: colors.infoLight }]}>
                <Feather name="file-text" size={20} color={colors.info} />
              </View>
              <View style={styles.reportCardContent}>
                <Text style={styles.reportCardTitle}>Tax Summary</Text>
                <Text style={styles.reportCardSubtitle}>GST collected and payable</Text>
              </View>
              <Feather name="share" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <View style={styles.insightsCard}>
            <Feather name="zap" size={32} color={colors.primary} />
            <Text style={styles.insightsTitle}>AI Business Insights</Text>
            <Text style={styles.insightsText}>
              Smart analytics powered by AI will analyze your business trends and provide actionable recommendations.
            </Text>
          </View>
        </ScrollView>
      </View>
    </>
  );
}
