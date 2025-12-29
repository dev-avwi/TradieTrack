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
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, shadows, typography, iconSizes } from '../../src/lib/design-tokens';
import { api } from '../../src/lib/api';
import { format, formatDistanceToNow } from 'date-fns';

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
  quoteId?: string;
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

interface Receipt {
  id: string;
  receiptNumber: string;
  invoiceId: string;
  amount: number;
  paymentMethod: string;
  paidAt: string;
  clientId: string;
}

interface Client {
  id: string;
  name: string;
}

type TabType = 'quotes' | 'invoices' | 'receipts';
type QuoteFilterType = 'all' | 'draft' | 'sent' | 'accepted' | 'rejected';
type InvoiceFilterType = 'all' | 'draft' | 'sent' | 'paid' | 'overdue';
type ReceiptFilterType = 'all' | 'bank_transfer' | 'card' | 'cash';

const formatCurrency = (amount: number) => {
  const normalizedAmount = amount > 1000 ? amount / 100 : amount;
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(normalizedAmount);
};

const getQuoteStatusConfig = (status: string) => {
  switch (status) {
    case 'draft':
      return { label: 'Draft', icon: 'clock' as const, color: '#6b7280', bgColor: 'rgba(107,114,128,0.1)' };
    case 'sent':
      return { label: 'Sent', icon: 'send' as const, color: '#3b82f6', bgColor: 'rgba(59,130,246,0.1)' };
    case 'accepted':
      return { label: 'Accepted', icon: 'check-circle' as const, color: '#22c55e', bgColor: 'rgba(34,197,94,0.1)' };
    case 'rejected':
      return { label: 'Rejected', icon: 'x-circle' as const, color: '#ef4444', bgColor: 'rgba(239,68,68,0.1)' };
    default:
      return { label: status, icon: 'clock' as const, color: '#6b7280', bgColor: 'rgba(107,114,128,0.1)' };
  }
};

const getInvoiceStatusConfig = (status: string) => {
  switch (status) {
    case 'draft':
      return { label: 'Draft', icon: 'clock' as const, color: '#6b7280', bgColor: 'rgba(107,114,128,0.1)' };
    case 'sent':
      return { label: 'Sent', icon: 'send' as const, color: '#3b82f6', bgColor: 'rgba(59,130,246,0.1)' };
    case 'paid':
      return { label: 'Paid', icon: 'check-circle' as const, color: '#22c55e', bgColor: 'rgba(34,197,94,0.1)' };
    case 'overdue':
      return { label: 'Overdue', icon: 'alert-circle' as const, color: '#ef4444', bgColor: 'rgba(239,68,68,0.1)' };
    default:
      return { label: status, icon: 'clock' as const, color: '#6b7280', bgColor: 'rgba(107,114,128,0.1)' };
  }
};

const getPaymentMethodLabel = (method: string) => {
  switch (method) {
    case 'bank_transfer': return 'Bank Transfer';
    case 'card': return 'Card';
    case 'cash': return 'Cash';
    case 'tap_to_pay': return 'Tap to Pay';
    case 'payment_link': return 'Payment Link';
    case 'qr_code': return 'QR Code';
    default: return method;
  }
};

export default function DocumentsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  // Read URL parameters for initial tab and filter
  const params = useLocalSearchParams<{ tab?: string; filter?: string }>();
  const initialTab = (params.tab as TabType) || 'quotes';
  const initialFilter = params.filter || 'all';
  
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [quoteFilter, setQuoteFilter] = useState<QuoteFilterType>(
    initialTab === 'quotes' ? (initialFilter as QuoteFilterType) : 'all'
  );
  const [invoiceFilter, setInvoiceFilter] = useState<InvoiceFilterType>(
    initialTab === 'invoices' ? (initialFilter as InvoiceFilterType) : 'all'
  );
  const [receiptFilter, setReceiptFilter] = useState<ReceiptFilterType>(
    initialTab === 'receipts' ? (initialFilter as ReceiptFilterType) : 'all'
  );

  const clientMap = useMemo(() => {
    return new Map(clients.map(c => [c.id, c]));
  }, [clients]);

  const fetchData = useCallback(async () => {
    try {
      const [quotesRes, invoicesRes, receiptsRes, clientsRes] = await Promise.all([
        api.get('/quotes'),
        api.get('/invoices'),
        api.get('/receipts').catch(() => ({ data: [] })),
        api.get('/clients'),
      ]);
      
      setQuotes(quotesRes.data || []);
      setInvoices(invoicesRes.data || []);
      setReceipts(receiptsRes.data || []);
      setClients(clientsRes.data || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
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

  const filteredQuotes = useMemo(() => {
    if (quoteFilter === 'all') return quotes;
    return quotes.filter(q => q.status === quoteFilter);
  }, [quotes, quoteFilter]);

  const filteredInvoices = useMemo(() => {
    if (invoiceFilter === 'all') return invoices;
    return invoices.filter(inv => inv.status === invoiceFilter);
  }, [invoices, invoiceFilter]);

  const filteredReceipts = useMemo(() => {
    if (receiptFilter === 'all') return receipts;
    return receipts.filter(r => r.paymentMethod === receiptFilter);
  }, [receipts, receiptFilter]);

  const stats = useMemo(() => {
    const totalQuotes = quotes.length;
    const pendingQuotes = quotes.filter(q => q.status === 'sent').length;
    const totalInvoices = invoices.length;
    const outstandingInvoices = invoices.filter(i => i.status === 'sent' || i.status === 'overdue');
    const outstandingAmount = outstandingInvoices.reduce((sum, i) => sum + (i.total > 1000 ? i.total / 100 : i.total), 0);
    const totalReceived = receipts.reduce((sum, r) => sum + r.amount, 0);
    
    return {
      totalQuotes,
      pendingQuotes,
      totalInvoices,
      outstandingCount: outstandingInvoices.length,
      outstandingAmount,
      totalReceived,
    };
  }, [quotes, invoices, receipts]);

  const renderKPICard = (title: string, value: string, subtitle: string, icon: keyof typeof Feather.glyphMap, iconColor: string, iconBg: string) => (
    <View style={styles.kpiCard}>
      <View style={[styles.kpiIconContainer, { backgroundColor: iconBg }]}>
        <Feather name={icon} size={iconSizes.lg} color={iconColor} />
      </View>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiTitle}>{title}</Text>
      <Text style={styles.kpiSubtitle}>{subtitle}</Text>
    </View>
  );

  const renderTabs = () => (
    <View style={styles.tabContainer}>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'quotes' && styles.activeTab]}
        onPress={() => setActiveTab('quotes')}
        activeOpacity={0.7}
      >
        <Feather 
          name="file-text" 
          size={iconSizes.md} 
          color={activeTab === 'quotes' ? colors.primary : colors.mutedForeground} 
        />
        <Text style={[styles.tabText, activeTab === 'quotes' && styles.activeTabText]}>
          Quotes
        </Text>
        <View style={[styles.tabIndicator, { backgroundColor: '#3b82f6' }]}>
          <Text style={styles.tabCount}>{quotes.length}</Text>
        </View>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[styles.tab, activeTab === 'invoices' && styles.activeTab]}
        onPress={() => setActiveTab('invoices')}
        activeOpacity={0.7}
      >
        <Feather 
          name="file" 
          size={iconSizes.md} 
          color={activeTab === 'invoices' ? colors.primary : colors.mutedForeground} 
        />
        <Text style={[styles.tabText, activeTab === 'invoices' && styles.activeTabText]}>
          Invoices
        </Text>
        <View style={[styles.tabIndicator, { backgroundColor: '#f59e0b' }]}>
          <Text style={styles.tabCount}>{invoices.length}</Text>
        </View>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[styles.tab, activeTab === 'receipts' && styles.activeTab]}
        onPress={() => setActiveTab('receipts')}
        activeOpacity={0.7}
      >
        <Feather 
          name="credit-card" 
          size={iconSizes.md} 
          color={activeTab === 'receipts' ? colors.primary : colors.mutedForeground} 
        />
        <Text style={[styles.tabText, activeTab === 'receipts' && styles.activeTabText]}>
          Receipts
        </Text>
        <View style={[styles.tabIndicator, { backgroundColor: '#22c55e' }]}>
          <Text style={styles.tabCount}>{receipts.length}</Text>
        </View>
      </TouchableOpacity>
    </View>
  );

  const renderQuoteFilters = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
      <View style={styles.filterContainer}>
        {(['all', 'draft', 'sent', 'accepted', 'rejected'] as QuoteFilterType[]).map((filter) => (
          <TouchableOpacity
            key={filter}
            style={[styles.filterChip, quoteFilter === filter && styles.activeFilterChip]}
            onPress={() => setQuoteFilter(filter)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterText, quoteFilter === filter && styles.activeFilterText]}>
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );

  const renderInvoiceFilters = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
      <View style={styles.filterContainer}>
        {(['all', 'draft', 'sent', 'paid', 'overdue'] as InvoiceFilterType[]).map((filter) => (
          <TouchableOpacity
            key={filter}
            style={[styles.filterChip, invoiceFilter === filter && styles.activeFilterChip]}
            onPress={() => setInvoiceFilter(filter)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterText, invoiceFilter === filter && styles.activeFilterText]}>
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );

  const renderReceiptFilters = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
      <View style={styles.filterContainer}>
        {(['all', 'bank_transfer', 'card', 'cash'] as ReceiptFilterType[]).map((filter) => (
          <TouchableOpacity
            key={filter}
            style={[styles.filterChip, receiptFilter === filter && styles.activeFilterChip]}
            onPress={() => setReceiptFilter(filter)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterText, receiptFilter === filter && styles.activeFilterText]}>
              {getPaymentMethodLabel(filter === 'all' ? 'All' : filter)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );

  const renderQuoteCard = (quote: Quote) => {
    const statusConfig = getQuoteStatusConfig(quote.status);
    const client = clientMap.get(quote.clientId);
    
    return (
      <TouchableOpacity
        key={quote.id}
        style={[styles.documentCard, { borderLeftColor: statusConfig.color }]}
        onPress={() => router.push(`/more/quote/${quote.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.documentHeader}>
          <View style={styles.documentTitleRow}>
            <Text style={styles.documentNumber}>
              {quote.number || `Q-${quote.id.slice(0, 6)}`}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
              <Feather name={statusConfig.icon} size={12} color={statusConfig.color} />
              <Text style={[styles.statusText, { color: statusConfig.color }]}>
                {statusConfig.label}
              </Text>
            </View>
          </View>
          <Text style={styles.documentAmount}>{formatCurrency(quote.total)}</Text>
        </View>
        
        <View style={styles.documentMeta}>
          <View style={styles.metaRow}>
            <Feather name="user" size={14} color={colors.mutedForeground} />
            <Text style={styles.metaText}>{client?.name || 'Unknown Client'}</Text>
          </View>
          {quote.createdAt && (
            <Text style={styles.metaDate}>
              {formatDistanceToNow(new Date(quote.createdAt), { addSuffix: true })}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderInvoiceCard = (invoice: Invoice) => {
    const statusConfig = getInvoiceStatusConfig(invoice.status);
    const client = clientMap.get(invoice.clientId);
    
    return (
      <TouchableOpacity
        key={invoice.id}
        style={[styles.documentCard, { borderLeftColor: statusConfig.color }]}
        onPress={() => router.push(`/more/invoice/${invoice.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.documentHeader}>
          <View style={styles.documentTitleRow}>
            <Text style={styles.documentNumber}>
              {invoice.number || `INV-${invoice.id.slice(0, 6)}`}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
              <Feather name={statusConfig.icon} size={12} color={statusConfig.color} />
              <Text style={[styles.statusText, { color: statusConfig.color }]}>
                {statusConfig.label}
              </Text>
            </View>
          </View>
          <Text style={styles.documentAmount}>{formatCurrency(invoice.total)}</Text>
        </View>
        
        <View style={styles.documentMeta}>
          <View style={styles.metaRow}>
            <Feather name="user" size={14} color={colors.mutedForeground} />
            <Text style={styles.metaText}>{client?.name || 'Unknown Client'}</Text>
          </View>
          {invoice.quoteId && (
            <View style={styles.linkBadge}>
              <Feather name="link-2" size={12} color={colors.primary} />
              <Text style={styles.linkText}>From Quote</Text>
            </View>
          )}
          {invoice.createdAt && (
            <Text style={styles.metaDate}>
              {formatDistanceToNow(new Date(invoice.createdAt), { addSuffix: true })}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderReceiptCard = (receipt: Receipt) => {
    const client = clientMap.get(receipt.clientId);
    
    return (
      <TouchableOpacity
        key={receipt.id}
        style={[styles.documentCard, { borderLeftColor: '#22c55e' }]}
        onPress={() => router.push(`/more/receipt/${receipt.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.documentHeader}>
          <View style={styles.documentTitleRow}>
            <Text style={styles.documentNumber}>{receipt.receiptNumber}</Text>
            <View style={[styles.statusBadge, { backgroundColor: 'rgba(34,197,94,0.1)' }]}>
              <Feather name="check-circle" size={12} color="#22c55e" />
              <Text style={[styles.statusText, { color: '#22c55e' }]}>Paid</Text>
            </View>
          </View>
          <Text style={styles.documentAmount}>{formatCurrency(receipt.amount)}</Text>
        </View>
        
        <View style={styles.documentMeta}>
          <View style={styles.metaRow}>
            <Feather name="user" size={14} color={colors.mutedForeground} />
            <Text style={styles.metaText}>{client?.name || 'Unknown Client'}</Text>
          </View>
          <View style={styles.metaRow}>
            <Feather name="credit-card" size={14} color={colors.mutedForeground} />
            <Text style={styles.metaText}>{getPaymentMethodLabel(receipt.paymentMethod)}</Text>
          </View>
          {receipt.paidAt && (
            <Text style={styles.metaDate}>
              {format(new Date(receipt.paidAt), 'dd MMM yyyy')}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading documents...</Text>
        </View>
      );
    }

    switch (activeTab) {
      case 'quotes':
        return (
          <>
            {renderQuoteFilters()}
            {filteredQuotes.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="file-text" size={48} color={colors.mutedForeground} />
                <Text style={styles.emptyTitle}>No quotes found</Text>
                <Text style={styles.emptySubtitle}>Create your first quote to get started</Text>
                <TouchableOpacity 
                  style={styles.emptyButton}
                  onPress={() => router.push('/more/create-quote')}
                >
                  <Feather name="plus" size={16} color={colors.primary} />
                  <Text style={styles.emptyButtonText}>Create Quote</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.documentList}>
                {filteredQuotes.map(renderQuoteCard)}
              </View>
            )}
          </>
        );

      case 'invoices':
        return (
          <>
            {renderInvoiceFilters()}
            {filteredInvoices.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="file" size={48} color={colors.mutedForeground} />
                <Text style={styles.emptyTitle}>No invoices found</Text>
                <Text style={styles.emptySubtitle}>Create your first invoice to get started</Text>
                <TouchableOpacity 
                  style={styles.emptyButton}
                  onPress={() => router.push('/more/create-invoice')}
                >
                  <Feather name="plus" size={16} color={colors.primary} />
                  <Text style={styles.emptyButtonText}>Create Invoice</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.documentList}>
                {filteredInvoices.map(renderInvoiceCard)}
              </View>
            )}
          </>
        );

      case 'receipts':
        return (
          <>
            {renderReceiptFilters()}
            {filteredReceipts.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="credit-card" size={48} color={colors.mutedForeground} />
                <Text style={styles.emptyTitle}>No receipts found</Text>
                <Text style={styles.emptySubtitle}>Receipts are created when payments are collected</Text>
              </View>
            ) : (
              <View style={styles.documentList}>
                {filteredReceipts.map(renderReceiptCard)}
              </View>
            )}
          </>
        );
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: 'Documents',
          headerLargeTitle: true,
        }}
      />
      <ScrollView
        style={styles.container}
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
        <View style={styles.kpiRow}>
          {renderKPICard(
            'Total Quotes',
            stats.totalQuotes.toString(),
            `${stats.pendingQuotes} pending`,
            'file-text',
            '#3b82f6',
            'rgba(59,130,246,0.1)'
          )}
          {renderKPICard(
            'Outstanding',
            formatCurrency(stats.outstandingAmount),
            `${stats.outstandingCount} invoices`,
            'alert-circle',
            '#f59e0b',
            'rgba(245,158,11,0.1)'
          )}
          {renderKPICard(
            'Total Received',
            formatCurrency(stats.totalReceived),
            `${receipts.length} receipts`,
            'check-circle',
            '#22c55e',
            'rgba(34,197,94,0.1)'
          )}
        </View>

        {renderTabs()}
        {renderContent()}
        
        <View style={{ height: spacing['4xl'] }} />
      </ScrollView>
    </>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    padding: spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['4xl'],
  },
  loadingText: {
    ...typography.body,
    color: colors.mutedForeground,
    marginTop: spacing.md,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  kpiIconContainer: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  kpiValue: {
    ...typography.subtitle,
    fontWeight: '700',
    color: colors.foreground,
  },
  kpiTitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  kpiSubtitle: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.xs,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    gap: spacing.xs,
  },
  activeTab: {
    backgroundColor: colors.primaryLight,
  },
  tabText: {
    ...typography.caption,
    fontWeight: '500',
    color: colors.mutedForeground,
  },
  activeTabText: {
    color: colors.primary,
  },
  tabIndicator: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    minWidth: 24,
    alignItems: 'center',
  },
  tabCount: {
    ...typography.captionSmall,
    fontWeight: '600',
    color: '#fff',
  },
  filterScroll: {
    marginBottom: spacing.md,
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  filterContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
  },
  activeFilterChip: {
    backgroundColor: colors.primary,
  },
  filterText: {
    ...typography.caption,
    fontWeight: '500',
    color: colors.mutedForeground,
  },
  activeFilterText: {
    color: '#fff',
  },
  documentList: {
    gap: spacing.md,
  },
  documentCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderLeftWidth: 4,
    ...shadows.sm,
  },
  documentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  documentTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  documentNumber: {
    ...typography.body,
    fontWeight: '600',
    color: colors.foreground,
  },
  documentAmount: {
    ...typography.subtitle,
    fontWeight: '700',
    color: colors.foreground,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  statusText: {
    ...typography.captionSmall,
    fontWeight: '600',
  },
  documentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaText: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  metaDate: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    marginLeft: 'auto',
  },
  linkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryLight,
  },
  linkText: {
    ...typography.captionSmall,
    fontWeight: '500',
    color: colors.primary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing['4xl'],
  },
  emptyTitle: {
    ...typography.subtitle,
    color: colors.foreground,
    marginTop: spacing.md,
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
    marginTop: spacing.lg,
  },
  emptyButtonText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.primary,
  },
});
