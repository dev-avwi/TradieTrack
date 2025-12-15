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
} from 'react-native';
import { router, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useInvoicesStore, useClientsStore } from '../../src/lib/store';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, shadows, typography, sizes, pageShell, iconSizes } from '../../src/lib/design-tokens';
import { StatusBadge } from '../../src/components/ui/StatusBadge';
import { AnimatedCardPressable } from '../../src/components/ui/AnimatedPressable';

type FilterKey = 'all' | 'draft' | 'sent' | 'paid' | 'overdue';

const FILTERS: { key: FilterKey; label: string; icon?: string }[] = [
  { key: 'all', label: 'All', icon: 'file-text' },
  { key: 'draft', label: 'Draft', icon: 'clock' },
  { key: 'sent', label: 'Sent', icon: 'send' },
  { key: 'paid', label: 'Paid', icon: 'check-circle' },
  { key: 'overdue', label: 'Overdue', icon: 'alert-circle' },
];

const navigateToCreateInvoice = () => {
  router.push('/more/invoice/new');
};

function InvoiceCard({ 
  invoice, 
  clientName,
  onPress 
}: { 
  invoice: any;
  clientName: string;
  onPress: () => void;
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

  const getNextAction = () => {
    switch (invoice.status) {
      case 'draft':
        return { 
          label: 'Send', 
          icon: 'send' as const, 
          color: colors.primary,
        };
      case 'sent':
        return { 
          label: 'Collect', 
          icon: 'credit-card' as const, 
          color: colors.success,
        };
      case 'overdue':
        return { 
          label: 'Remind', 
          icon: 'bell' as const, 
          color: colors.destructive,
        };
      default:
        return { 
          label: 'View', 
          icon: 'eye' as const, 
          color: colors.primary,
        };
    }
  };

  const nextAction = getNextAction();
  const gstAmount = (invoice.total || 0) / 11;
  const subtotal = (invoice.total || 0) - gstAmount;

  return (
    <AnimatedCardPressable
      onPress={onPress}
      style={styles.invoiceCard}
    >
      <View style={[styles.invoiceCardAccent, { backgroundColor: getAccentColor() }]} />
      <View style={styles.invoiceCardContent}>
        <View style={styles.invoiceCardHeader}>
          <Text style={styles.invoiceNumber} numberOfLines={1}>{invoice.invoiceNumber || 'Draft'}</Text>
          <StatusBadge status={invoice.status || 'draft'} size="sm" />
        </View>

        <View style={styles.invoiceAmountRow}>
          <Text style={styles.invoiceTotal}>{formatCurrency(invoice.total || 0)}</Text>
          <Text style={styles.invoiceGst}>inc. GST</Text>
        </View>

        <View style={styles.invoiceMetaRow}>
          <View style={styles.invoiceDetailRow}>
            <Feather name="user" size={12} color={colors.mutedForeground} />
            <Text style={styles.invoiceDetailText} numberOfLines={1}>{clientName}</Text>
          </View>
          <View style={styles.invoiceDetailRow}>
            <Feather name="calendar" size={12} color={colors.mutedForeground} />
            <Text style={styles.invoiceDetailText} numberOfLines={1}>
              Due: {formatDate(invoice.dueDate || invoice.createdAt)}
            </Text>
          </View>
        </View>

        <View style={styles.inlineActionsRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: nextAction.color }]}
            onPress={onPress}
            activeOpacity={0.8}
          >
            <Feather name={nextAction.icon} size={12} color={colors.white} />
            <Text style={styles.actionBtnText}>{nextAction.label}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </AnimatedCardPressable>
  );
}

export default function InvoicesScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { invoices, fetchInvoices, isLoading } = useInvoicesStore();
  const { clients, fetchClients } = useClientsStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');

  const refreshData = useCallback(async () => {
    await Promise.all([fetchInvoices(), fetchClients()]);
  }, [fetchInvoices, fetchClients]);

  useEffect(() => {
    refreshData();
  }, []);

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

  const filterCounts = {
    all: invoices.length,
    draft: invoices.filter(i => i.status === 'draft').length,
    sent: invoices.filter(i => i.status === 'sent').length,
    paid: invoices.filter(i => i.status === 'paid').length,
    overdue: invoices.filter(i => i.status === 'overdue').length,
  };

  const filteredInvoices = invoices.filter(invoice => {
    const searchLower = searchQuery.toLowerCase();
    const clientName = getClientName(invoice.clientId);
    const matchesSearch = 
      invoice.invoiceNumber?.toLowerCase().includes(searchLower) ||
      clientName.toLowerCase().includes(searchLower);
    
    const matchesFilter = activeFilter === 'all' || invoice.status === activeFilter;
    
    return matchesSearch && matchesFilter;
  });

  const sortedInvoices = [...filteredInvoices].sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

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

          <View style={styles.summaryCard}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Outstanding</Text>
              <Text style={styles.summaryValue}>{formatCurrency(totalOutstanding)}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Paid</Text>
              <Text style={[styles.summaryValue, { color: colors.success }]}>{formatCurrency(totalPaid)}</Text>
            </View>
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
                  />
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </View>
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

  summaryCard: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginBottom: spacing.xs,
  },
  summaryValue: {
    ...typography.statValue,
    color: colors.foreground,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: colors.cardBorder,
    marginHorizontal: spacing.lg,
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
    flexDirection: 'column',
    gap: spacing.md,
  },
  invoiceCard: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  invoiceCardAccent: {
    height: 3,
    width: '100%',
  },
  invoiceCardContent: {
    flex: 1,
    padding: spacing.md,
  },
  invoiceCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  invoiceNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
    flex: 1,
  },
  invoiceAmountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  invoiceTotal: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
  },
  invoiceGst: {
    fontSize: 10,
    color: colors.mutedForeground,
    fontWeight: '500',
  },
  invoiceMetaRow: {
    flexDirection: 'column',
    gap: 2,
    marginBottom: spacing.sm,
  },
  invoiceDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  invoiceDetailText: {
    fontSize: 11,
    color: colors.mutedForeground,
    flex: 1,
  },
  inlineActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.md,
    gap: 4,
  },
  actionBtnText: {
    fontSize: 11,
    color: colors.white,
    fontWeight: '600',
  },
});
