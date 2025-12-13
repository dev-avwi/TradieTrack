import { useState, useMemo, useCallback, useEffect } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, shadows, typography, iconSizes } from '../../src/lib/design-tokens';
import { api } from '../../src/lib/api';
import { format, isAfter, isBefore, subDays, differenceInDays } from 'date-fns';

interface Invoice {
  id: string;
  number?: string;
  title?: string;
  clientId: string;
  total: number;
  status: string;
  dueDate?: string;
  paidAt?: string;
  createdAt?: string;
}

interface Quote {
  id: string;
  number?: string;
  title?: string;
  clientId: string;
  total: number;
  status: string;
  validUntil?: string;
  createdAt?: string;
}

interface Client {
  id: string;
  name: string;
}

type TabType = 'overview' | 'invoices' | 'quotes' | 'payments';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount / 100);
};

export default function MoneyHubScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const clientMap = useMemo(() => {
    return new Map(clients.map(c => [c.id, c]));
  }, [clients]);

  const fetchData = useCallback(async () => {
    try {
      const [invoicesRes, quotesRes, clientsRes] = await Promise.all([
        api.get('/api/invoices'),
        api.get('/api/quotes'),
        api.get('/api/clients'),
      ]);
      setInvoices(invoicesRes.data || []);
      setQuotes(quotesRes.data || []);
      setClients(clientsRes.data || []);
    } catch (error) {
      console.error('Failed to fetch money hub data:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const stats = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = subDays(now, 30);

    const outstanding = invoices.filter(
      inv => inv.status !== 'paid' && inv.status !== 'draft'
    );
    const outstandingTotal = outstanding.reduce((sum, inv) => sum + inv.total, 0);

    const overdue = outstanding.filter(
      inv => inv.dueDate && isBefore(new Date(inv.dueDate), now)
    );
    const overdueTotal = overdue.reduce((sum, inv) => sum + inv.total, 0);

    const paid = invoices.filter(inv => inv.status === 'paid');
    const paidTotal = paid.reduce((sum, inv) => sum + inv.total, 0);

    const recentPaid = paid.filter(
      inv => inv.paidAt && isAfter(new Date(inv.paidAt), thirtyDaysAgo)
    );
    const recentPaidTotal = recentPaid.reduce((sum, inv) => sum + inv.total, 0);

    const pendingQuotes = quotes.filter(q => q.status === 'sent' || q.status === 'viewed');
    const pendingQuotesTotal = pendingQuotes.reduce((sum, q) => sum + q.total, 0);

    return {
      outstandingTotal,
      outstandingCount: outstanding.length,
      overdueTotal,
      overdueCount: overdue.length,
      recentPaidTotal,
      recentPaidCount: recentPaid.length,
      pendingQuotesTotal,
      pendingQuotesCount: pendingQuotes.length,
    };
  }, [invoices, quotes]);

  const renderKPICard = (
    title: string, 
    value: string, 
    subtitle: string, 
    iconName: keyof typeof Feather.glyphMap, 
    iconColor: string,
    variant: 'default' | 'success' | 'warning' | 'danger' = 'default'
  ) => {
    const variantStyles = {
      default: { bg: colors.card, border: colors.cardBorder },
      success: { bg: `${colors.success}15`, border: `${colors.success}30` },
      warning: { bg: `${colors.warning}15`, border: `${colors.warning}30` },
      danger: { bg: `${colors.error}15`, border: `${colors.error}30` },
    };
    const style = variantStyles[variant];

    return (
      <View style={[styles.kpiCard, { backgroundColor: style.bg, borderColor: style.border }]}>
        <View style={styles.kpiHeader}>
          <Text style={styles.kpiTitle}>{title}</Text>
          <View style={[styles.kpiIcon, { backgroundColor: `${iconColor}15` }]}>
            <Feather name={iconName} size={iconSizes.md} color={iconColor} />
          </View>
        </View>
        <Text style={styles.kpiValue}>{value}</Text>
        <Text style={styles.kpiSubtitle}>{subtitle}</Text>
      </View>
    );
  };

  const renderInvoiceRow = (invoice: Invoice) => {
    const client = clientMap.get(invoice.clientId);
    const isOverdue = invoice.dueDate && isBefore(new Date(invoice.dueDate), new Date()) && invoice.status !== 'paid';
    const daysOverdue = invoice.dueDate ? Math.abs(differenceInDays(new Date(), new Date(invoice.dueDate))) : 0;

    const statusColors: Record<string, string> = {
      draft: colors.mutedForeground,
      sent: colors.primary,
      viewed: colors.primary,
      partial: colors.warning,
      paid: colors.success,
      overdue: colors.error,
    };
    const status = isOverdue ? 'overdue' : invoice.status;
    const statusColor = statusColors[status] || colors.mutedForeground;

    return (
      <TouchableOpacity 
        key={invoice.id}
        style={styles.documentRow}
        onPress={() => router.push(`/more/invoice/${invoice.id}`)}
        activeOpacity={0.7}
      >
        <View style={[styles.documentIcon, { backgroundColor: `${colors.primary}15` }]}>
          <Feather name="file-text" size={iconSizes.md} color={colors.primary} />
        </View>
        <View style={styles.documentInfo}>
          <View style={styles.documentTitleRow}>
            <Text style={styles.documentTitle} numberOfLines={1}>
              #{invoice.number || invoice.id.slice(0, 8)}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Text>
            </View>
          </View>
          <Text style={styles.documentSubtitle} numberOfLines={1}>
            {client?.name || 'Unknown Client'}
          </Text>
        </View>
        <View style={styles.documentRight}>
          <Text style={styles.documentAmount}>{formatCurrency(invoice.total)}</Text>
          {invoice.dueDate && (
            <Text style={[styles.documentDue, isOverdue && { color: colors.error }]}>
              {isOverdue ? `${daysOverdue}d overdue` : `Due ${format(new Date(invoice.dueDate), 'dd MMM')}`}
            </Text>
          )}
        </View>
        <Feather name="chevron-right" size={iconSizes.md} color={colors.mutedForeground} />
      </TouchableOpacity>
    );
  };

  const renderQuoteRow = (quote: Quote) => {
    const client = clientMap.get(quote.clientId);
    const statusColors: Record<string, string> = {
      draft: colors.mutedForeground,
      sent: colors.primary,
      viewed: colors.primary,
      accepted: colors.success,
      declined: colors.error,
      expired: colors.mutedForeground,
    };
    const statusColor = statusColors[quote.status] || colors.mutedForeground;

    return (
      <TouchableOpacity 
        key={quote.id}
        style={styles.documentRow}
        onPress={() => router.push(`/more/quote/${quote.id}`)}
        activeOpacity={0.7}
      >
        <View style={[styles.documentIcon, { backgroundColor: `${colors.scheduled}15` }]}>
          <Feather name="file" size={iconSizes.md} color={colors.scheduled} />
        </View>
        <View style={styles.documentInfo}>
          <View style={styles.documentTitleRow}>
            <Text style={styles.documentTitle} numberOfLines={1}>
              #{quote.number || quote.id.slice(0, 8)}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>
                {quote.status.charAt(0).toUpperCase() + quote.status.slice(1)}
              </Text>
            </View>
          </View>
          <Text style={styles.documentSubtitle} numberOfLines={1}>
            {client?.name || 'Unknown Client'}
          </Text>
        </View>
        <View style={styles.documentRight}>
          <Text style={styles.documentAmount}>{formatCurrency(quote.total)}</Text>
          {quote.validUntil && (
            <Text style={styles.documentDue}>
              Valid until {format(new Date(quote.validUntil), 'dd MMM')}
            </Text>
          )}
        </View>
        <Feather name="chevron-right" size={iconSizes.md} color={colors.mutedForeground} />
      </TouchableOpacity>
    );
  };

  const renderTab = (tab: TabType, label: string, count?: number) => {
    const isActive = activeTab === tab;
    return (
      <TouchableOpacity
        style={[styles.tab, isActive && styles.tabActive]}
        onPress={() => setActiveTab(tab)}
        activeOpacity={0.7}
      >
        <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{label}</Text>
        {count !== undefined && count > 0 && (
          <View style={[styles.tabBadge, isActive && styles.tabBadgeActive]}>
            <Text style={[styles.tabBadgeText, isActive && styles.tabBadgeTextActive]}>
              {count}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderOverview = () => (
    <View style={styles.overviewContainer}>
      <View style={styles.sectionHeader}>
        <Feather name="alert-triangle" size={iconSizes.md} color={colors.error} />
        <Text style={styles.sectionTitle}>Needs Attention</Text>
      </View>
      <View style={styles.sectionContent}>
        {invoices
          .filter(inv => inv.status !== 'paid' && inv.status !== 'draft')
          .slice(0, 5)
          .map(renderInvoiceRow)}
        {invoices.filter(inv => inv.status !== 'paid' && inv.status !== 'draft').length === 0 && (
          <View style={styles.emptyState}>
            <Feather name="check-circle" size={32} color={colors.success} />
            <Text style={styles.emptyText}>All caught up!</Text>
            <Text style={styles.emptySubtext}>No outstanding invoices</Text>
          </View>
        )}
      </View>

      <View style={styles.sectionHeader}>
        <Feather name="file" size={iconSizes.md} color={colors.scheduled} />
        <Text style={styles.sectionTitle}>Pending Quotes</Text>
      </View>
      <View style={styles.sectionContent}>
        {quotes
          .filter(q => q.status === 'sent' || q.status === 'viewed')
          .slice(0, 5)
          .map(renderQuoteRow)}
        {quotes.filter(q => q.status === 'sent' || q.status === 'viewed').length === 0 && (
          <View style={styles.emptyState}>
            <Feather name="file-text" size={32} color={colors.mutedForeground} />
            <Text style={styles.emptyText}>No pending quotes</Text>
          </View>
        )}
      </View>

      <View style={styles.sectionHeader}>
        <Feather name="trending-up" size={iconSizes.md} color={colors.success} />
        <Text style={styles.sectionTitle}>Recent Payments</Text>
      </View>
      <View style={styles.sectionContent}>
        {invoices
          .filter(inv => inv.status === 'paid')
          .sort((a, b) => new Date(b.paidAt || 0).getTime() - new Date(a.paidAt || 0).getTime())
          .slice(0, 5)
          .map(renderInvoiceRow)}
        {invoices.filter(inv => inv.status === 'paid').length === 0 && (
          <View style={styles.emptyState}>
            <Feather name="dollar-sign" size={32} color={colors.mutedForeground} />
            <Text style={styles.emptyText}>No payments yet</Text>
          </View>
        )}
      </View>
    </View>
  );

  const renderInvoices = () => (
    <View style={styles.listContainer}>
      {invoices
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .map(renderInvoiceRow)}
      {invoices.length === 0 && (
        <View style={styles.emptyState}>
          <Feather name="file-text" size={48} color={colors.mutedForeground} />
          <Text style={styles.emptyText}>No invoices yet</Text>
          <TouchableOpacity 
            style={styles.createButton}
            onPress={() => router.push('/more/create-invoice')}
          >
            <Text style={styles.createButtonText}>Create Invoice</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderQuotes = () => (
    <View style={styles.listContainer}>
      {quotes
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .map(renderQuoteRow)}
      {quotes.length === 0 && (
        <View style={styles.emptyState}>
          <Feather name="file" size={48} color={colors.mutedForeground} />
          <Text style={styles.emptyText}>No quotes yet</Text>
          <TouchableOpacity 
            style={styles.createButton}
            onPress={() => router.push('/more/create-quote')}
          >
            <Text style={styles.createButtonText}>Create Quote</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderPayments = () => (
    <View style={styles.listContainer}>
      {invoices
        .filter(inv => inv.status === 'paid')
        .sort((a, b) => new Date(b.paidAt || 0).getTime() - new Date(a.paidAt || 0).getTime())
        .map(renderInvoiceRow)}
      {invoices.filter(inv => inv.status === 'paid').length === 0 && (
        <View style={styles.emptyState}>
          <Feather name="credit-card" size={48} color={colors.mutedForeground} />
          <Text style={styles.emptyText}>No payments recorded</Text>
        </View>
      )}
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Money Hub</Text>
          <Text style={styles.headerSubtitle}>Track invoices, payments & quotes</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.kpiGrid}>
          {renderKPICard(
            'Outstanding',
            formatCurrency(stats.outstandingTotal),
            `${stats.outstandingCount} invoices`,
            'clock',
            colors.warning,
            stats.outstandingCount > 0 ? 'warning' : 'default'
          )}
          {renderKPICard(
            'Overdue',
            formatCurrency(stats.overdueTotal),
            `${stats.overdueCount} invoices`,
            'alert-triangle',
            colors.error,
            stats.overdueCount > 0 ? 'danger' : 'default'
          )}
          {renderKPICard(
            'Paid (30d)',
            formatCurrency(stats.recentPaidTotal),
            `${stats.recentPaidCount} invoices`,
            'check-circle',
            colors.success,
            'success'
          )}
          {renderKPICard(
            'Pending Quotes',
            formatCurrency(stats.pendingQuotesTotal),
            `${stats.pendingQuotesCount} awaiting`,
            'file',
            colors.scheduled,
            'default'
          )}
        </View>

        <View style={styles.tabsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {renderTab('overview', 'Overview')}
            {renderTab('invoices', 'Invoices', stats.outstandingCount)}
            {renderTab('quotes', 'Quotes', stats.pendingQuotesCount)}
            {renderTab('payments', 'Payments')}
          </ScrollView>
        </View>

        <View style={styles.tabContent}>
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'invoices' && renderInvoices()}
          {activeTab === 'quotes' && renderQuotes()}
          {activeTab === 'payments' && renderPayments()}
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.mutedForeground,
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing['3xl'],
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    marginRight: spacing.md,
    padding: spacing.xs,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.foreground,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing['3xl'],
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  kpiCard: {
    width: '48%',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    ...shadows.sm,
  },
  kpiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  kpiTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.mutedForeground,
  },
  kpiIcon: {
    padding: spacing.xs,
    borderRadius: radius.md,
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.foreground,
    marginBottom: 2,
  },
  kpiSubtitle: {
    fontSize: 11,
    color: colors.mutedForeground,
  },
  tabsContainer: {
    marginBottom: spacing.md,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.muted,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.mutedForeground,
  },
  tabTextActive: {
    color: colors.primaryForeground,
  },
  tabBadge: {
    marginLeft: spacing.xs,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: colors.mutedForeground,
  },
  tabBadgeActive: {
    backgroundColor: colors.primaryForeground,
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.background,
  },
  tabBadgeTextActive: {
    color: colors.primary,
  },
  tabContent: {
    minHeight: 200,
  },
  overviewContainer: {
    gap: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  sectionContent: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
    ...shadows.sm,
  },
  listContainer: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
    ...shadows.sm,
  },
  documentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  documentIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  documentInfo: {
    flex: 1,
    minWidth: 0,
  },
  documentTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 2,
  },
  documentTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
  },
  statusBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  documentSubtitle: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  documentRight: {
    alignItems: 'flex-end',
  },
  documentAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
  },
  documentDue: {
    fontSize: 11,
    color: colors.mutedForeground,
  },
  emptyState: {
    padding: spacing['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.foreground,
    marginTop: spacing.md,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  createButton: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
  },
  createButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
});
