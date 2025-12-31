import { useState, useMemo, useCallback, useEffect } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Dimensions,
} from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, shadows, typography, iconSizes } from '../../src/lib/design-tokens';
import { api } from '../../src/lib/api';
import { format, formatDistanceToNow } from 'date-fns';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_GAP = spacing.sm;
const GRID_CARD_WIDTH = (SCREEN_WIDTH - spacing.lg * 2 - CARD_GAP) / 2;

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
  jobId?: string;
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
type ViewMode = 'grid' | 'list';

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
  
  const params = useLocalSearchParams<{ tab?: string; filter?: string }>();
  const initialTab = (params.tab as TabType) || 'quotes';
  const initialFilter = params.filter || 'all';
  
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
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
        api.get<Quote[]>('/api/quotes'),
        api.get<Invoice[]>('/api/invoices'),
        api.get<Receipt[]>('/api/receipts').catch(() => ({ data: [] as Receipt[] })),
        api.get<Client[]>('/api/clients'),
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

  const getClientName = (clientId: string) => {
    return clientMap.get(clientId)?.name || 'Unknown Client';
  };

  const filteredQuotes = useMemo(() => {
    let filtered = quotes;
    if (quoteFilter !== 'all') {
      filtered = filtered.filter(q => q.status === quoteFilter);
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(q => 
        (q.number || '').toLowerCase().includes(query) ||
        (q.title || '').toLowerCase().includes(query) ||
        getClientName(q.clientId).toLowerCase().includes(query)
      );
    }
    return filtered;
  }, [quotes, quoteFilter, searchQuery, clientMap]);

  const filteredInvoices = useMemo(() => {
    let filtered = invoices;
    if (invoiceFilter !== 'all') {
      filtered = filtered.filter(inv => inv.status === invoiceFilter);
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(inv => 
        (inv.number || '').toLowerCase().includes(query) ||
        (inv.title || '').toLowerCase().includes(query) ||
        getClientName(inv.clientId).toLowerCase().includes(query)
      );
    }
    return filtered;
  }, [invoices, invoiceFilter, searchQuery, clientMap]);

  const filteredReceipts = useMemo(() => {
    let filtered = receipts;
    if (receiptFilter !== 'all') {
      filtered = filtered.filter(r => r.paymentMethod === receiptFilter);
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(r => 
        (r.receiptNumber || '').toLowerCase().includes(query) ||
        getClientName(r.clientId).toLowerCase().includes(query)
      );
    }
    return filtered;
  }, [receipts, receiptFilter, searchQuery, clientMap]);

  const stats = useMemo(() => {
    const totalQuotes = quotes.reduce((sum, q) => sum + (q.total > 1000 ? q.total / 100 : q.total), 0);
    const pendingQuotes = quotes.filter(q => q.status === 'sent').length;
    const wonQuotes = quotes.filter(q => q.status === 'accepted').reduce((sum, q) => sum + (q.total > 1000 ? q.total / 100 : q.total), 0);
    const outstandingInvoices = invoices.filter(i => i.status === 'sent' || i.status === 'overdue');
    const outstandingAmount = outstandingInvoices.reduce((sum, i) => sum + (i.total > 1000 ? i.total / 100 : i.total), 0);
    const totalReceived = receipts.reduce((sum, r) => sum + r.amount, 0);
    
    return {
      totalQuotes,
      pendingQuotes,
      wonQuotes,
      outstandingCount: outstandingInvoices.length,
      outstandingAmount,
      totalReceived,
    };
  }, [quotes, invoices, receipts]);

  const renderHeader = () => (
    <View style={styles.headerRow}>
      <View>
        <Text style={styles.pageTitle}>Documents</Text>
        <Text style={styles.pageSubtitle}>
          {activeTab === 'quotes' ? `${quotes.length} total quotes` :
           activeTab === 'invoices' ? `${invoices.length} total invoices` :
           `${receipts.length} total receipts`}
        </Text>
      </View>
      <View style={styles.headerActions}>
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.viewToggleButton, viewMode === 'grid' && styles.viewToggleButtonActive]}
            onPress={() => setViewMode('grid')}
            activeOpacity={0.7}
          >
            <Feather name="grid" size={18} color={viewMode === 'grid' ? colors.primary : colors.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewToggleButton, viewMode === 'list' && styles.viewToggleButtonActive]}
            onPress={() => setViewMode('list')}
            activeOpacity={0.7}
          >
            <Feather name="list" size={18} color={viewMode === 'list' ? colors.primary : colors.mutedForeground} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            if (activeTab === 'quotes') router.push('/more/quote/new');
            else if (activeTab === 'invoices') router.push('/more/invoice/new');
          }}
          activeOpacity={0.7}
        >
          <Feather name="plus" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderKPICards = () => (
    <View style={styles.kpiRow}>
      <View style={styles.kpiCard}>
        <Text style={styles.kpiLabel}>TOTAL</Text>
        <Text style={[styles.kpiValue, { color: '#3b82f6' }]}>
          {formatCurrency(stats.totalQuotes)}
        </Text>
      </View>
      <View style={styles.kpiCard}>
        <Text style={styles.kpiLabel}>PENDING</Text>
        <Text style={[styles.kpiValue, { color: '#f59e0b' }]}>
          {stats.pendingQuotes}
        </Text>
      </View>
      <View style={styles.kpiCard}>
        <Text style={styles.kpiLabel}>WON</Text>
        <Text style={[styles.kpiValue, { color: '#22c55e' }]}>
          {formatCurrency(stats.wonQuotes)}
        </Text>
      </View>
    </View>
  );

  const renderSearchBar = () => (
    <View style={styles.searchContainer}>
      <Feather name="search" size={18} color={colors.mutedForeground} />
      <TextInput
        style={styles.searchInput}
        placeholder="Search by title, client, or number..."
        placeholderTextColor={colors.mutedForeground}
        value={searchQuery}
        onChangeText={setSearchQuery}
      />
      {searchQuery.length > 0 && (
        <TouchableOpacity onPress={() => setSearchQuery('')}>
          <Feather name="x" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>
      )}
    </View>
  );

  const handleViewAll = () => {
    switch (activeTab) {
      case 'quotes':
        router.push('/more/quotes');
        break;
      case 'invoices':
        router.push('/more/invoices');
        break;
      case 'receipts':
        router.push('/more/receipts');
        break;
    }
  };

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
        <View style={[styles.tabBadge, { backgroundColor: '#3b82f6' }]}>
          <Text style={styles.tabBadgeText}>{quotes.length}</Text>
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
        <View style={[styles.tabBadge, { backgroundColor: '#f59e0b' }]}>
          <Text style={styles.tabBadgeText}>{invoices.length}</Text>
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
        <View style={[styles.tabBadge, { backgroundColor: '#22c55e' }]}>
          <Text style={styles.tabBadgeText}>{receipts.length}</Text>
        </View>
      </TouchableOpacity>
    </View>
  );

  const renderViewAllButton = () => (
    <TouchableOpacity
      style={styles.viewAllButton}
      onPress={handleViewAll}
      activeOpacity={0.7}
    >
      <Feather name="maximize-2" size={16} color={colors.primary} />
      <Text style={styles.viewAllText}>
        View All {activeTab === 'quotes' ? 'Quotes' : activeTab === 'invoices' ? 'Invoices' : 'Receipts'}
      </Text>
      <Feather name="chevron-right" size={16} color={colors.primary} />
    </TouchableOpacity>
  );

  const renderQuoteFilters = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
      <View style={styles.filterContainer}>
        {(['all', 'draft', 'sent', 'accepted', 'rejected'] as QuoteFilterType[]).map((filter) => {
          const config = filter === 'all' ? null : getQuoteStatusConfig(filter);
          const count = filter === 'all' ? quotes.length : quotes.filter(q => q.status === filter).length;
          return (
            <TouchableOpacity
              key={filter}
              style={[styles.filterChip, quoteFilter === filter && styles.activeFilterChip]}
              onPress={() => setQuoteFilter(filter)}
              activeOpacity={0.7}
            >
              {config && <Feather name={config.icon} size={14} color={quoteFilter === filter ? '#fff' : config.color} />}
              <Text style={[styles.filterText, quoteFilter === filter && styles.activeFilterText]}>
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
              </Text>
              <View style={[styles.filterBadge, quoteFilter === filter && styles.activeFilterBadge]}>
                <Text style={[styles.filterBadgeText, quoteFilter === filter && styles.activeFilterBadgeText]}>
                  {count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );

  const renderInvoiceFilters = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
      <View style={styles.filterContainer}>
        {(['all', 'draft', 'sent', 'paid', 'overdue'] as InvoiceFilterType[]).map((filter) => {
          const config = filter === 'all' ? null : getInvoiceStatusConfig(filter);
          const count = filter === 'all' ? invoices.length : invoices.filter(i => i.status === filter).length;
          return (
            <TouchableOpacity
              key={filter}
              style={[styles.filterChip, invoiceFilter === filter && styles.activeFilterChip]}
              onPress={() => setInvoiceFilter(filter)}
              activeOpacity={0.7}
            >
              {config && <Feather name={config.icon} size={14} color={invoiceFilter === filter ? '#fff' : config.color} />}
              <Text style={[styles.filterText, invoiceFilter === filter && styles.activeFilterText]}>
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
              </Text>
              <View style={[styles.filterBadge, invoiceFilter === filter && styles.activeFilterBadge]}>
                <Text style={[styles.filterBadgeText, invoiceFilter === filter && styles.activeFilterBadgeText]}>
                  {count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );

  const renderReceiptFilters = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
      <View style={styles.filterContainer}>
        {(['all', 'bank_transfer', 'card', 'cash'] as ReceiptFilterType[]).map((filter) => {
          const count = filter === 'all' ? receipts.length : receipts.filter(r => r.paymentMethod === filter).length;
          return (
            <TouchableOpacity
              key={filter}
              style={[styles.filterChip, receiptFilter === filter && styles.activeFilterChip]}
              onPress={() => setReceiptFilter(filter)}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterText, receiptFilter === filter && styles.activeFilterText]}>
                {getPaymentMethodLabel(filter === 'all' ? 'All' : filter)}
              </Text>
              <View style={[styles.filterBadge, receiptFilter === filter && styles.activeFilterBadge]}>
                <Text style={[styles.filterBadgeText, receiptFilter === filter && styles.activeFilterBadgeText]}>
                  {count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );

  const renderQuoteGridCard = (quote: Quote) => {
    const statusConfig = getQuoteStatusConfig(quote.status);
    const client = clientMap.get(quote.clientId);
    
    return (
      <TouchableOpacity
        key={quote.id}
        style={[styles.gridCard, { borderLeftColor: statusConfig.color }]}
        onPress={() => router.push(`/more/quote/${quote.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.gridCardHeader}>
          <Text style={styles.gridCardTitle} numberOfLines={1}>
            {quote.title || quote.number || `Q-${quote.id.slice(0, 6)}`}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
          </View>
        </View>
        <Text style={styles.gridCardClient} numberOfLines={1}>{client?.name || 'Unknown Client'}</Text>
        <View style={styles.gridCardFooter}>
          <Text style={styles.gridCardAmount}>{formatCurrency(quote.total)}</Text>
          <Text style={styles.gridCardDate}>
            {quote.createdAt ? formatDistanceToNow(new Date(quote.createdAt), { addSuffix: true }) : ''}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderQuoteListCard = (quote: Quote) => {
    const statusConfig = getQuoteStatusConfig(quote.status);
    const client = clientMap.get(quote.clientId);
    
    return (
      <TouchableOpacity
        key={quote.id}
        style={[styles.listCard, { borderLeftColor: statusConfig.color }]}
        onPress={() => router.push(`/more/quote/${quote.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.listCardContent}>
          <View style={styles.listCardHeader}>
            <Text style={styles.listCardTitle} numberOfLines={1}>
              {quote.title || quote.number || `Q-${quote.id.slice(0, 6)}`}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
              <Feather name={statusConfig.icon} size={12} color={statusConfig.color} />
              <Text style={[styles.statusText, { color: statusConfig.color }]}>
                {statusConfig.label}
              </Text>
            </View>
          </View>
          <View style={styles.listCardMeta}>
            <View style={styles.metaRow}>
              <Feather name="user" size={14} color={colors.mutedForeground} />
              <Text style={styles.metaText}>{client?.name || 'Unknown Client'}</Text>
            </View>
            <Text style={styles.listCardAmount}>{formatCurrency(quote.total)}</Text>
          </View>
          <Text style={styles.listCardDate}>
            {quote.createdAt ? formatDistanceToNow(new Date(quote.createdAt), { addSuffix: true }) : ''}
          </Text>
        </View>
        <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
      </TouchableOpacity>
    );
  };

  const renderInvoiceGridCard = (invoice: Invoice) => {
    const statusConfig = getInvoiceStatusConfig(invoice.status);
    const client = clientMap.get(invoice.clientId);
    const linkedReceipt = receipts.find(r => r.invoiceId === invoice.id);
    
    return (
      <TouchableOpacity
        key={invoice.id}
        style={[styles.gridCard, { borderLeftColor: statusConfig.color }]}
        onPress={() => router.push(`/more/invoice/${invoice.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.gridCardHeader}>
          <Text style={styles.gridCardTitle} numberOfLines={1}>
            {invoice.title || invoice.number || `INV-${invoice.id.slice(0, 6)}`}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
          </View>
        </View>
        <Text style={styles.gridCardClient} numberOfLines={1}>{client?.name || 'Unknown Client'}</Text>
        <View style={styles.gridCardFooter}>
          <Text style={styles.gridCardAmount}>{formatCurrency(invoice.total)}</Text>
          <Text style={styles.gridCardDate}>
            {invoice.createdAt ? formatDistanceToNow(new Date(invoice.createdAt), { addSuffix: true }) : ''}
          </Text>
        </View>
        {linkedReceipt && (
          <View style={styles.linkedBadge}>
            <Feather name="link-2" size={10} color="#22c55e" />
            <Text style={styles.linkedBadgeText}>Receipt</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderInvoiceListCard = (invoice: Invoice) => {
    const statusConfig = getInvoiceStatusConfig(invoice.status);
    const client = clientMap.get(invoice.clientId);
    const linkedReceipt = receipts.find(r => r.invoiceId === invoice.id);
    
    return (
      <TouchableOpacity
        key={invoice.id}
        style={[styles.listCard, { borderLeftColor: statusConfig.color }]}
        onPress={() => router.push(`/more/invoice/${invoice.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.listCardContent}>
          <View style={styles.listCardHeader}>
            <Text style={styles.listCardTitle} numberOfLines={1}>
              {invoice.title || invoice.number || `INV-${invoice.id.slice(0, 6)}`}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
              <Feather name={statusConfig.icon} size={12} color={statusConfig.color} />
              <Text style={[styles.statusText, { color: statusConfig.color }]}>
                {statusConfig.label}
              </Text>
            </View>
          </View>
          <View style={styles.listCardMeta}>
            <View style={styles.metaRow}>
              <Feather name="user" size={14} color={colors.mutedForeground} />
              <Text style={styles.metaText}>{client?.name || 'Unknown Client'}</Text>
            </View>
            <Text style={styles.listCardAmount}>{formatCurrency(invoice.total)}</Text>
          </View>
          <View style={styles.listCardBottomRow}>
            <Text style={styles.listCardDate}>
              {invoice.createdAt ? formatDistanceToNow(new Date(invoice.createdAt), { addSuffix: true }) : ''}
            </Text>
            {linkedReceipt && (
              <View style={styles.linkedBadgeInline}>
                <Feather name="link-2" size={12} color="#22c55e" />
                <Text style={styles.linkedBadgeTextInline}>Receipt</Text>
              </View>
            )}
          </View>
        </View>
        <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
      </TouchableOpacity>
    );
  };

  const renderReceiptGridCard = (receipt: Receipt) => {
    const client = clientMap.get(receipt.clientId);
    
    return (
      <TouchableOpacity
        key={receipt.id}
        style={[styles.gridCard, { borderLeftColor: '#22c55e' }]}
        onPress={() => router.push(`/more/receipt/${receipt.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.gridCardHeader}>
          <Text style={styles.gridCardTitle} numberOfLines={1}>
            {receipt.receiptNumber}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: 'rgba(34,197,94,0.1)' }]}>
            <Text style={[styles.statusText, { color: '#22c55e' }]}>Paid</Text>
          </View>
        </View>
        <Text style={styles.gridCardClient} numberOfLines={1}>{client?.name || 'Unknown Client'}</Text>
        <View style={styles.gridCardFooter}>
          <Text style={styles.gridCardAmount}>{formatCurrency(receipt.amount)}</Text>
          <Text style={styles.gridCardDate}>
            {format(new Date(receipt.paidAt), 'dd MMM')}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderReceiptListCard = (receipt: Receipt) => {
    const client = clientMap.get(receipt.clientId);
    
    return (
      <TouchableOpacity
        key={receipt.id}
        style={[styles.listCard, { borderLeftColor: '#22c55e' }]}
        onPress={() => router.push(`/more/receipt/${receipt.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.listCardContent}>
          <View style={styles.listCardHeader}>
            <Text style={styles.listCardTitle} numberOfLines={1}>
              {receipt.receiptNumber}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: 'rgba(34,197,94,0.1)' }]}>
              <Feather name="check-circle" size={12} color="#22c55e" />
              <Text style={[styles.statusText, { color: '#22c55e' }]}>Paid</Text>
            </View>
          </View>
          <View style={styles.listCardMeta}>
            <View style={styles.metaRow}>
              <Feather name="user" size={14} color={colors.mutedForeground} />
              <Text style={styles.metaText}>{client?.name || 'Unknown Client'}</Text>
            </View>
            <Text style={styles.listCardAmount}>{formatCurrency(receipt.amount)}</Text>
          </View>
          <View style={styles.listCardBottomRow}>
            <View style={styles.metaRow}>
              <Feather name="credit-card" size={12} color={colors.mutedForeground} />
              <Text style={styles.metaTextSmall}>{getPaymentMethodLabel(receipt.paymentMethod)}</Text>
            </View>
            <Text style={styles.listCardDate}>
              {format(new Date(receipt.paidAt), 'dd MMM yyyy')}
            </Text>
          </View>
        </View>
        <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
      </TouchableOpacity>
    );
  };

  const renderEmptyState = (type: TabType) => {
    const config = {
      quotes: { icon: 'file-text' as const, title: 'No quotes found', subtitle: 'Create your first quote to get started', action: () => router.push('/more/quote/new'), actionText: 'Create Quote' },
      invoices: { icon: 'file' as const, title: 'No invoices found', subtitle: 'Create your first invoice to get started', action: () => router.push('/more/invoice/new'), actionText: 'Create Invoice' },
      receipts: { icon: 'credit-card' as const, title: 'No receipts found', subtitle: 'Receipts are created when payments are collected', action: undefined, actionText: '' },
    };
    const { icon, title, subtitle, action, actionText } = config[type];
    
    return (
      <View style={styles.emptyState}>
        <Feather name={icon} size={48} color={colors.mutedForeground} />
        <Text style={styles.emptyTitle}>{title}</Text>
        <Text style={styles.emptySubtitle}>{subtitle}</Text>
        {action && (
          <TouchableOpacity style={styles.emptyButton} onPress={action}>
            <Feather name="plus" size={16} color={colors.primary} />
            <Text style={styles.emptyButtonText}>{actionText}</Text>
          </TouchableOpacity>
        )}
      </View>
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
            {filteredQuotes.length === 0 ? renderEmptyState('quotes') : (
              <View style={viewMode === 'grid' ? styles.gridContainer : styles.listContainer}>
                {filteredQuotes.map(quote => 
                  viewMode === 'grid' ? renderQuoteGridCard(quote) : renderQuoteListCard(quote)
                )}
              </View>
            )}
          </>
        );

      case 'invoices':
        return (
          <>
            {renderInvoiceFilters()}
            {filteredInvoices.length === 0 ? renderEmptyState('invoices') : (
              <View style={viewMode === 'grid' ? styles.gridContainer : styles.listContainer}>
                {filteredInvoices.map(invoice => 
                  viewMode === 'grid' ? renderInvoiceGridCard(invoice) : renderInvoiceListCard(invoice)
                )}
              </View>
            )}
          </>
        );

      case 'receipts':
        return (
          <>
            {renderReceiptFilters()}
            {filteredReceipts.length === 0 ? renderEmptyState('receipts') : (
              <View style={viewMode === 'grid' ? styles.gridContainer : styles.listContainer}>
                {filteredReceipts.map(receipt => 
                  viewMode === 'grid' ? renderReceiptGridCard(receipt) : renderReceiptListCard(receipt)
                )}
              </View>
            )}
          </>
        );
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
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
        {renderHeader()}
        {renderKPICards()}
        {renderSearchBar()}
        {renderTabs()}
        {renderViewAllButton()}
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
    paddingTop: spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  pageTitle: {
    ...typography.title,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  pageSubtitle: {
    ...typography.body,
    color: colors.mutedForeground,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
  },
  viewToggleButton: {
    padding: spacing.sm,
  },
  viewToggleButtonActive: {
    backgroundColor: colors.primaryLight,
  },
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.sm,
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
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  kpiLabel: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  kpiValue: {
    ...typography.subtitle,
    fontWeight: '700',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.foreground,
    paddingVertical: 0,
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
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
    gap: 4,
  },
  activeTab: {
    backgroundColor: colors.primaryLight,
  },
  tabText: {
    ...typography.captionSmall,
    fontWeight: '500',
    color: colors.mutedForeground,
  },
  activeTabText: {
    color: colors.primary,
  },
  tabBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
    minWidth: 20,
    alignItems: 'center',
  },
  tabBadgeText: {
    ...typography.captionSmall,
    fontWeight: '600',
    color: '#fff',
    fontSize: 10,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  viewAllText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.primary,
    flex: 1,
    textAlign: 'center',
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: spacing.xs,
  },
  activeFilterChip: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    ...typography.caption,
    fontWeight: '500',
    color: colors.foreground,
  },
  activeFilterText: {
    color: '#fff',
  },
  filterBadge: {
    backgroundColor: colors.muted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
    minWidth: 20,
    alignItems: 'center',
  },
  activeFilterBadge: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  filterBadgeText: {
    ...typography.captionSmall,
    fontWeight: '600',
    color: colors.mutedForeground,
    fontSize: 10,
  },
  activeFilterBadgeText: {
    color: '#fff',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
  },
  listContainer: {
    gap: spacing.sm,
  },
  gridCard: {
    width: GRID_CARD_WIDTH,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderLeftWidth: 3,
    ...shadows.sm,
  },
  gridCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
    gap: spacing.xs,
  },
  gridCardTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.foreground,
    flex: 1,
    fontSize: 13,
  },
  gridCardClient: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
  },
  gridCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gridCardAmount: {
    ...typography.body,
    fontWeight: '700',
    color: colors.foreground,
  },
  gridCardDate: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    fontSize: 10,
  },
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderLeftWidth: 3,
    ...shadows.sm,
  },
  listCardContent: {
    flex: 1,
  },
  listCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  listCardTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.foreground,
    flex: 1,
    marginRight: spacing.sm,
  },
  listCardMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  listCardAmount: {
    ...typography.body,
    fontWeight: '700',
    color: colors.foreground,
  },
  listCardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listCardDate: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  statusText: {
    ...typography.captionSmall,
    fontWeight: '600',
    fontSize: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  metaTextSmall: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
  },
  linkedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(34,197,94,0.1)',
    alignSelf: 'flex-start',
  },
  linkedBadgeText: {
    ...typography.captionSmall,
    fontWeight: '500',
    color: '#22c55e',
    fontSize: 10,
  },
  linkedBadgeInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(34,197,94,0.1)',
  },
  linkedBadgeTextInline: {
    ...typography.captionSmall,
    fontWeight: '500',
    color: '#22c55e',
    fontSize: 10,
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
