import { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router, Stack, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useInvoicesStore, useClientsStore, useAuthStore } from '../../src/lib/store';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { api, API_URL } from '../../src/lib/api';
import { spacing, radius, shadows, typography, sizes, pageShell, iconSizes } from '../../src/lib/design-tokens';
import { StatusBadge } from '../../src/components/ui/StatusBadge';
import { AnimatedCardPressable } from '../../src/components/ui/AnimatedPressable';
import { EmailComposeModal } from '../../src/components/EmailComposeModal';

type FilterKey = 'all' | 'draft' | 'sent' | 'paid' | 'overdue' | 'recurring' | 'archived';

const FILTERS: { key: FilterKey; label: string; icon?: string }[] = [
  { key: 'all', label: 'All', icon: 'file-text' },
  { key: 'draft', label: 'Draft', icon: 'clock' },
  { key: 'sent', label: 'Sent', icon: 'send' },
  { key: 'paid', label: 'Paid', icon: 'check-circle' },
  { key: 'overdue', label: 'Overdue', icon: 'alert-circle' },
  { key: 'recurring', label: 'Recurring', icon: 'repeat' },
  { key: 'archived', label: 'Archived', icon: 'archive' },
];

const navigateToCreateInvoice = () => {
  router.push('/more/invoice/new');
};

function InvoiceCard({ 
  invoice, 
  clientName,
  onPress,
  onSend,
  onMarkPaid,
}: { 
  invoice: any;
  clientName: string;
  onPress: () => void;
  onSend?: () => void;
  onMarkPaid?: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const formatCurrency = (amount: number) => {
    return `$${(amount / 100).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
    });
  };

  const getAccentColor = () => {
    switch (invoice.status) {
      case 'draft': return colors.warning;
      case 'sent': return colors.info;
      case 'paid': return colors.success;
      case 'overdue': return colors.destructive;
      default: return colors.primary;
    }
  };

  const getQuickAction = () => {
    switch (invoice.status) {
      case 'draft':
        return { 
          label: 'Send', 
          icon: 'send' as const, 
          color: colors.primary,
          action: onSend,
        };
      case 'sent':
        return { 
          label: 'Paid', 
          icon: 'check-circle' as const, 
          color: colors.success,
          action: onMarkPaid,
        };
      case 'overdue':
        return { 
          label: 'Paid', 
          icon: 'check-circle' as const, 
          color: colors.success,
          action: onMarkPaid,
        };
      default:
        return null;
    }
  };

  const quickAction = getQuickAction();
  const gstAmount = (invoice.total || 0) / 11;
  const subtotal = (invoice.total || 0) - gstAmount;

  return (
    <View style={styles.invoiceCard}>
      {/* Main card content - tappable to view details */}
      <TouchableOpacity 
        style={styles.cardPressable}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View style={styles.invoiceCardContent}>
          {/* Web-style horizontal layout: Icon + Info on left, Amount on right */}
          <View style={styles.cardRow}>
            {/* Left: Icon circle + Info */}
            <View style={styles.cardLeft}>
              <View style={[styles.iconCircle, { backgroundColor: `${getAccentColor()}20` }]}>
                <Feather name="file-text" size={20} color={getAccentColor()} />
              </View>
              <View style={styles.cardInfo}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.invoiceNumber} numberOfLines={1}>{invoice.invoiceNumber || 'Draft'}</Text>
                  <StatusBadge status={invoice.status || 'draft'} size="sm" />
                </View>
                <View style={styles.cardSubtitle}>
                  <Feather name="user" size={12} color={colors.mutedForeground} />
                  <Text style={styles.clientName} numberOfLines={1}>{clientName || 'No client'}</Text>
                </View>
              </View>
            </View>
            
            {/* Right: Amount + Chevron */}
            <View style={styles.cardRight}>
              <Text style={styles.invoiceTotal}>{formatCurrency(invoice.total || 0)}</Text>
              <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
            </View>
          </View>
          
          {/* Details row */}
          <View style={styles.detailsRow}>
            <Feather name="calendar" size={12} color={colors.mutedForeground} />
            <Text style={[
              styles.invoiceDetailText,
              invoice.status === 'overdue' && { color: colors.destructive }
            ]} numberOfLines={1}>
              {invoice.dueDate ? `Due ${formatDate(invoice.dueDate)}` : 'No due date'}
            </Text>
            {invoice.isRecurring && (
              <View style={styles.recurringBadge}>
                <Feather name="repeat" size={10} color={colors.info} />
                <Text style={styles.recurringBadgeText}>Recurring</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
      
      {/* Quick action button - separate touch target */}
      {quickAction && (
        <View style={styles.quickActionContainer}>
          <TouchableOpacity
            style={[styles.quickActionButton, { backgroundColor: quickAction.color }]}
            onPress={quickAction.action}
            activeOpacity={0.7}
          >
            <Feather name={quickAction.icon} size={14} color={colors.white} />
            <Text style={styles.quickActionText}>{quickAction.label}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default function InvoicesScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { invoices, fetchInvoices, isLoading } = useInvoicesStore();
  const { clients, fetchClients } = useClientsStore();
  const { user, businessSettings } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  
  // Inline email compose state
  const [showEmailCompose, setShowEmailCompose] = useState(false);
  const [selectedInvoiceForEmail, setSelectedInvoiceForEmail] = useState<any>(null);

  const refreshData = useCallback(async () => {
    await Promise.all([fetchInvoices(), fetchClients()]);
  }, [fetchInvoices, fetchClients]);

  useEffect(() => {
    refreshData();
  }, []);

  // Refresh data when screen gains focus (syncs with web app)
  useFocusEffect(
    useCallback(() => {
      refreshData();
    }, [refreshData])
  );

  const getClientName = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    return client?.name || 'Unknown Client';
  };

  const formatCurrency = (amount: number) => {
    return `$${(amount / 100).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`;
  };

  const totalOutstanding = invoices
    .filter(i => i.status === 'sent' || i.status === 'overdue')
    .reduce((sum, i) => sum + (i.total || 0), 0);

  const totalPaid = invoices
    .filter(i => i.status === 'paid')
    .reduce((sum, i) => sum + (i.total || 0), 0);

  const totalOverdue = invoices
    .filter(i => i.status === 'overdue')
    .reduce((sum, i) => sum + (i.total || 0), 0);

  const totalAll = invoices
    .filter(i => !i.archived)
    .reduce((sum, i) => sum + (i.total || 0), 0);

  const filterCounts = {
    all: invoices.filter(i => !i.archived).length,
    draft: invoices.filter(i => i.status === 'draft' && !i.archived).length,
    sent: invoices.filter(i => i.status === 'sent' && !i.archived).length,
    paid: invoices.filter(i => i.status === 'paid' && !i.archived).length,
    overdue: invoices.filter(i => i.status === 'overdue' && !i.archived).length,
    recurring: invoices.filter(i => (i as any).isRecurring && !i.archived).length,
    archived: invoices.filter(i => i.archived).length,
  };

  const filteredInvoices = invoices.filter(invoice => {
    const searchLower = searchQuery.toLowerCase();
    const clientName = getClientName(invoice.clientId);
    const matchesSearch = 
      invoice.invoiceNumber?.toLowerCase().includes(searchLower) ||
      clientName.toLowerCase().includes(searchLower);
    
    let matchesFilter = false;
    if (activeFilter === 'all') {
      matchesFilter = !invoice.archived;
    } else if (activeFilter === 'archived') {
      matchesFilter = !!invoice.archived;
    } else if (activeFilter === 'recurring') {
      matchesFilter = (invoice as any).isRecurring === true && !invoice.archived;
    } else {
      matchesFilter = invoice.status === activeFilter && !invoice.archived;
    }
    
    return matchesSearch && matchesFilter;
  });

  const sortedInvoices = [...filteredInvoices].sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const handleSendInvoice = async (invoiceId: string) => {
    const invoice = invoices.find(i => i.id === invoiceId);
    const client = clients.find(c => c.id === invoice?.clientId);
    
    if (!client?.email) {
      Alert.alert(
        'No Email Address',
        'This client does not have an email address. Would you like to view the invoice and add one?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'View Invoice', onPress: () => router.push(`/more/invoice/${invoiceId}`) }
        ]
      );
      return;
    }
    
    // Show inline email compose modal
    setSelectedInvoiceForEmail({ ...invoice, client });
    setShowEmailCompose(true);
  };
  
  const handleSendEmail = async (customSubject: string, customMessage: string) => {
    if (!selectedInvoiceForEmail) return;
    
    try {
      const response = await api.post<{ success?: boolean; error?: string }>(
        `/api/invoices/${selectedInvoiceForEmail.id}/send`, 
        { customSubject, customMessage }
      );
      
      // Check for API error response
      if (response.error) {
        throw new Error(response.error);
      }
      
      // Check for backend-returned error in data
      if (response.data?.error) {
        throw new Error(response.data.error);
      }
      
      setShowEmailCompose(false);
      setSelectedInvoiceForEmail(null);
      await refreshData();
      Alert.alert('Success', 'Invoice sent successfully');
    } catch (error) {
      console.error('Error sending invoice:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to send invoice');
    }
  };

  const handleMarkPaid = async (invoiceId: string) => {
    const invoice = invoices.find(i => i.id === invoiceId);
    
    Alert.alert(
      'Mark as Paid',
      `Record payment of ${formatCurrency(invoice?.total || 0)} received?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Mark Paid', 
          onPress: async () => {
            try {
              const response = await api.patch<{ error?: string }>(`/api/invoices/${invoiceId}`, {
                status: 'paid',
                paidAt: new Date().toISOString(),
                amountPaid: invoice?.total?.toString(),
                paymentMethod: 'on_site',
              });
              
              // Check for API error response
              if (response.error) {
                throw new Error(response.error);
              }
              
              // Check for backend-returned error in data
              if (response.data?.error) {
                throw new Error(response.data.error);
              }
              
              await refreshData();
              Alert.alert('Success', 'Payment recorded successfully');
            } catch (error) {
              console.error('Error marking paid:', error);
              Alert.alert('Error', error instanceof Error ? error.message : 'Failed to record payment');
            }
          }
        }
      ]
    );
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
              <Text style={styles.pageTitle}>Invoices</Text>
              <Text style={styles.pageSubtitle}>{invoices.length} total</Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.newButton}
              onPress={navigateToCreateInvoice}
            >
              <Feather name="plus" size={iconSizes.lg} color={colors.white} />
              <Text style={styles.newButtonText}>New Invoice</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.kpiGrid}>
            <TouchableOpacity 
              style={styles.kpiCard}
              onPress={() => setActiveFilter('all')}
              activeOpacity={0.7}
            >
              <View style={[styles.kpiIconContainer, { backgroundColor: colors.primaryLight }]}>
                <Feather name="dollar-sign" size={16} color={colors.primary} />
              </View>
              <Text style={styles.kpiLabel}>Total Value</Text>
              <Text style={styles.kpiValue}>{formatCurrency(totalAll)}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.kpiCard}
              onPress={() => setActiveFilter('sent')}
              activeOpacity={0.7}
            >
              <View style={[styles.kpiIconContainer, { backgroundColor: colors.warningLight }]}>
                <Feather name="alert-circle" size={16} color={colors.warning} />
              </View>
              <Text style={styles.kpiLabel}>Unpaid</Text>
              <Text style={styles.kpiValue}>{formatCurrency(totalOutstanding)}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.kpiCard}
              onPress={() => setActiveFilter('paid')}
              activeOpacity={0.7}
            >
              <View style={[styles.kpiIconContainer, { backgroundColor: colors.successLight }]}>
                <Feather name="check-circle" size={16} color={colors.success} />
              </View>
              <Text style={styles.kpiLabel}>Paid</Text>
              <Text style={[styles.kpiValue, { color: colors.success }]}>{formatCurrency(totalPaid)}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.kpiCard}
              onPress={() => setActiveFilter('overdue')}
              activeOpacity={0.7}
            >
              <View style={[styles.kpiIconContainer, { backgroundColor: colors.destructiveLight }]}>
                <Feather name="clock" size={16} color={colors.destructive} />
              </View>
              <Text style={styles.kpiLabel}>Overdue</Text>
              <Text style={[styles.kpiValue, { color: colors.destructive }]}>{formatCurrency(totalOverdue)}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchBar}>
            <Feather name="search" size={iconSizes.xl} color={colors.mutedForeground} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search invoices..."
              placeholderTextColor={colors.mutedForeground}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.filtersScroll}
            contentContainerStyle={styles.filtersContent}
          >
            {FILTERS.map((filter) => {
              const count = filterCounts[filter.key];
              const isActive = activeFilter === filter.key;
              
              return (
                <TouchableOpacity
                  key={filter.key}
                  onPress={() => setActiveFilter(filter.key)}
                  activeOpacity={0.7}
                  style={[
                    styles.filterPill,
                    isActive && styles.filterPillActive
                  ]}
                >
                  <Text style={[
                    styles.filterPillText,
                    isActive && styles.filterPillTextActive
                  ]}>
                    {filter.label}
                  </Text>
                  <View style={[
                    styles.filterCount,
                    isActive && styles.filterCountActive
                  ]}>
                    <Text style={[
                      styles.filterCountText,
                      isActive && styles.filterCountTextActive
                    ]}>
                      {count}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="file-text" size={iconSizes.md} color={colors.primary} />
              <Text style={styles.sectionTitle}>ALL INVOICES</Text>
            </View>
            
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : sortedInvoices.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyStateIcon}>
                  <Feather name="file-text" size={iconSizes['4xl']} color={colors.mutedForeground} />
                </View>
                <Text style={styles.emptyStateTitle}>No invoices found</Text>
                <Text style={styles.emptyStateSubtitle}>
                  {searchQuery || activeFilter !== 'all'
                    ? 'Try adjusting your search or filters'
                    : 'Create your first invoice to get started'}
                </Text>
              </View>
            ) : (
              <View style={styles.invoicesList}>
                {sortedInvoices.map((invoice) => (
                  <InvoiceCard
                    key={invoice.id}
                    invoice={invoice}
                    clientName={getClientName(invoice.clientId)}
                    onPress={() => router.push(`/more/invoice/${invoice.id}`)}
                    onSend={() => handleSendInvoice(invoice.id)}
                    onMarkPaid={() => handleMarkPaid(invoice.id)}
                  />
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </View>
      
      {/* Inline Email Compose Modal */}
      {selectedInvoiceForEmail && (
        <EmailComposeModal
          visible={showEmailCompose}
          onClose={() => {
            setShowEmailCompose(false);
            setSelectedInvoiceForEmail(null);
          }}
          type="invoice"
          documentId={selectedInvoiceForEmail.id}
          clientName={selectedInvoiceForEmail.client?.name || 'Client'}
          clientEmail={selectedInvoiceForEmail.client?.email || ''}
          documentNumber={selectedInvoiceForEmail.invoiceNumber || ''}
          documentTitle={selectedInvoiceForEmail.description || 'Services'}
          total={`$${((selectedInvoiceForEmail.total || 0) / 100).toFixed(2)}`}
          businessName={businessSettings?.businessName || user?.businessName || 'Your Business'}
          publicUrl={`${API_URL}/public/invoice/${selectedInvoiceForEmail.id}`}
          onSend={handleSendEmail}
        />
      )}
    </>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
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
    paddingBottom: pageShell.paddingBottom,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
  headerLeft: {
    flex: 1,
  },
  pageTitle: {
    ...typography.pageTitle,
    color: colors.foreground,
  },
  pageSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.xs,
    ...shadows.sm,
  },
  newButtonText: {
    color: colors.primaryForeground,
    ...typography.caption,
    fontWeight: '600',
  },

  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  kpiCard: {
    width: '48%',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  kpiIconContainer: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  kpiLabel: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginBottom: spacing.xs,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
  },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    height: sizes.searchBarHeight,
    marginBottom: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.foreground,
  },

  filtersScroll: {
    marginBottom: spacing.lg,
    marginHorizontal: -pageShell.paddingHorizontal,
  },
  filtersContent: {
    paddingHorizontal: pageShell.paddingHorizontal,
    gap: spacing.sm,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: spacing.xs,
  },
  filterPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterPillText: {
    ...typography.captionSmall,
    fontWeight: '500',
    color: colors.foreground,
  },
  filterPillTextActive: {
    color: colors.white,
  },
  filterCount: {
    backgroundColor: colors.muted,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.sm,
    minWidth: sizes.filterCountMin,
    alignItems: 'center',
  },
  filterCountActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  filterCountText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.foreground,
  },
  filterCountTextActive: {
    color: colors.white,
  },

  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.foreground,
    letterSpacing: 0.5,
  },

  loadingContainer: {
    paddingVertical: spacing['3xl'],
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing['4xl'],
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  emptyStateIcon: {
    marginBottom: spacing.lg,
  },
  emptyStateTitle: {
    ...typography.subtitle,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  emptyStateSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },

  invoicesList: {
    gap: spacing.md,
  },
  invoiceCard: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
    ...shadows.sm,
  },
  cardPressable: {
    flex: 1,
  },
  invoiceCardContent: {
    padding: spacing.md,
  },
  quickActionContainer: {
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    padding: spacing.sm,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  // Web-style horizontal layout
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    flex: 1,
    minWidth: 0,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  cardSubtitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  clientName: {
    fontSize: 13,
    color: colors.mutedForeground,
    flex: 1,
  },
  cardRight: {
    alignItems: 'flex-end',
    gap: spacing.sm,
    flexShrink: 0,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingLeft: 52, // Align with text after icon
  },
  invoiceNumber: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
  },
  invoiceTotal: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  invoiceDetailText: {
    fontSize: 12,
    color: colors.mutedForeground,
    flex: 1,
  },
  recurringBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.infoLight || colors.muted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: spacing.sm,
  },
  recurringBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.info,
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    minHeight: 36,
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
