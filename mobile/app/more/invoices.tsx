import { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  TextInput,
  Alert
} from 'react-native';
import { router, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useInvoicesStore, useClientsStore } from '../../src/lib/store';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, shadows, typography, iconSizes, sizes } from '../../src/lib/design-tokens';
import { StatusBadge } from '../../src/components/ui/StatusBadge';

type FilterKey = 'all' | 'draft' | 'sent' | 'paid' | 'overdue';

const FILTERS: { key: FilterKey; label: string; icon?: string }[] = [
  { key: 'all', label: 'All', icon: 'file-text' },
  { key: 'draft', label: 'Draft', icon: 'clock' },
  { key: 'sent', label: 'Sent', icon: 'send' },
  { key: 'paid', label: 'Paid', icon: 'check-circle' },
  { key: 'overdue', label: 'Overdue', icon: 'alert-circle' },
];

function StatCard({ 
  title, 
  value, 
  icon,
  onPress,
  styles
}: { 
  title: string; 
  value: number | string; 
  icon: React.ReactNode;
  onPress?: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={styles.statCard}
    >
      <View style={styles.statIconContainer}>
        {icon}
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
    </TouchableOpacity>
  );
}

function RecentInvoiceItem({ 
  invoice, 
  clientName,
  onPress,
  styles,
  colors
}: { 
  invoice: any;
  clientName: string;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
}) {
  const formatCurrency = (amount: number) => {
    return `$${(amount / 100).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`;
  };
  
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={styles.recentItem}
    >
      <View style={[styles.recentDot, { backgroundColor: colors.primary }]} />
      <View style={styles.recentContent}>
        <Text style={styles.recentTitle} numberOfLines={1}>{invoice.invoiceNumber || 'Draft Invoice'}</Text>
        <Text style={styles.recentSubtitle}>{clientName} • {formatCurrency(invoice.total || 0)}</Text>
      </View>
      <StatusBadge status={invoice.status || 'draft'} size="sm" />
    </TouchableOpacity>
  );
}

const navigateToCreateInvoice = () => {
  router.push('/more/invoice/new');
};

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

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Calculate totals
  const totalOutstanding = invoices
    .filter(i => i.status === 'sent' || i.status === 'overdue')
    .reduce((sum, i) => sum + (i.total || 0), 0);

  const totalPaid = invoices
    .filter(i => i.status === 'paid')
    .reduce((sum, i) => sum + (i.total || 0), 0);

  // Calculate filter counts
  const filterCounts = {
    all: invoices.length,
    draft: invoices.filter(i => i.status === 'draft').length,
    sent: invoices.filter(i => i.status === 'sent').length,
    paid: invoices.filter(i => i.status === 'paid').length,
    overdue: invoices.filter(i => i.status === 'overdue').length,
  };

  // Filter invoices
  const filteredInvoices = invoices.filter(invoice => {
    const searchLower = searchQuery.toLowerCase();
    const clientName = getClientName(invoice.clientId);
    const matchesSearch = 
      invoice.invoiceNumber?.toLowerCase().includes(searchLower) ||
      clientName.toLowerCase().includes(searchLower);
    
    const matchesFilter = activeFilter === 'all' || invoice.status === activeFilter;
    
    return matchesSearch && matchesFilter;
  });

  // Get recent invoices (last 7 days)
  const getRecentInvoices = () => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    return invoices
      .filter(invoice => new Date(invoice.createdAt) >= sevenDaysAgo)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  };

  const recentInvoices = getRecentInvoices();

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
          {/* Header Section */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.pageTitle}>Invoices</Text>
              <Text style={styles.pageSubtitle}>Send and track invoices</Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.newButton}
              onPress={navigateToCreateInvoice}
            >
              <Feather name="plus" size={18} color={colors.white} />
              <Text style={styles.newButtonText}>New Invoice</Text>
            </TouchableOpacity>
          </View>

          {/* Summary Card */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Outstanding</Text>
              <Text style={styles.summaryValue}>{formatCurrency(totalOutstanding)}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Paid This Month</Text>
              <Text style={[styles.summaryValue, { color: colors.success }]}>{formatCurrency(totalPaid)}</Text>
            </View>
          </View>

          {/* Search Bar */}
          <View style={styles.searchBar}>
            <Feather name="search" size={20} color={colors.mutedForeground} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search invoices by number, client..."
              placeholderTextColor={colors.mutedForeground}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Filter Pills with Counts */}
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.filtersScroll}
            contentContainerStyle={styles.filtersContent}
          >
            {FILTERS.map((filter) => {
              const count = filterCounts[filter.key];
              const isActive = activeFilter === filter.key;
              const IconComponent = filter.icon;
              
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
                  {filter.icon && (
                    <Feather 
                      name={filter.icon as any}
                      size={14} 
                      color={isActive ? colors.white : colors.foreground} 
                    />
                  )}
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

          {/* Stats Grid - 2x2 */}
          <View style={styles.statsGrid}>
            <View style={styles.statsRow}>
              <StatCard
                title="TOTAL INVOICES"
                value={filterCounts.all}
                icon={<Feather name="file-text" size={22} color={colors.primary} />}
                onPress={() => setActiveFilter('all')}
                styles={styles}
              />
              <StatCard
                title="DRAFT"
                value={filterCounts.draft}
                icon={<Feather name="clock" size={22} color={colors.mutedForeground} />}
                onPress={() => setActiveFilter('draft')}
                styles={styles}
              />
            </View>
            <View style={styles.statsRow}>
              <StatCard
                title="SENT"
                value={filterCounts.sent}
                icon={<Feather name="send" size={22} color={colors.info} />}
                onPress={() => setActiveFilter('sent')}
                styles={styles}
              />
              <StatCard
                title="PAID"
                value={filterCounts.paid}
                icon={<Feather name="check-circle" size={22} color={colors.success} />}
                onPress={() => setActiveFilter('paid')}
                styles={styles}
              />
            </View>
          </View>

          {/* Recent Invoices Section */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeaderRow}>
              <Feather name="clock" size={18} color={colors.foreground} />
              <Text style={styles.sectionTitle}>Recent Invoices</Text>
            </View>
            {recentInvoices.length === 0 ? (
              <View style={styles.emptySection}>
                <Feather name="file-text" size={32} color={colors.mutedForeground} />
                <Text style={styles.emptySectionText}>No recent invoices</Text>
              </View>
            ) : (
              recentInvoices.map((invoice) => (
                <RecentInvoiceItem
                  key={invoice.id}
                  invoice={invoice}
                  clientName={getClientName(invoice.clientId)}
                  onPress={() => router.push(`/more/invoice/${invoice.id}`)}
                  styles={styles}
                  colors={colors}
                />
              ))
            )}
          </View>

          {/* All Invoices Section */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>All Invoices</Text>
              <Text style={styles.sectionCount}>{filteredInvoices.length} invoices</Text>
            </View>
            
            {filteredInvoices.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="file-text" size={48} color={colors.mutedForeground} />
                <Text style={styles.emptyTitle}>No invoices found</Text>
                <Text style={styles.emptySubtitle}>
                  {searchQuery ? 'Try a different search' : 'Create your first invoice to get started'}
                </Text>
              </View>
            ) : (
              filteredInvoices.map(invoice => {
                const getAccentColor = () => {
                  switch (invoice.status) {
                    case 'draft': return colors.mutedForeground;
                    case 'sent': return colors.info;
                    case 'paid': return colors.success;
                    case 'overdue': return colors.destructive;
                    default: return colors.primary;
                  }
                };
                return (
                  <TouchableOpacity
                    key={invoice.id}
                    style={styles.invoiceCard}
                    activeOpacity={0.7}
                    onPress={() => router.push(`/more/invoice/${invoice.id}`)}
                  >
                    <View style={[styles.invoiceCardAccent, { backgroundColor: getAccentColor() }]} />
                    <View style={styles.invoiceCardContent}>
                      <View style={styles.invoiceHeader}>
                        <View style={styles.invoiceInfo}>
                          <Text style={styles.invoiceNumber}>{invoice.invoiceNumber || 'Draft'}</Text>
                          <StatusBadge status={invoice.status || 'draft'} size="sm" />
                        </View>
                        <Text style={styles.invoiceTotal}>{formatCurrency(invoice.total || 0)}</Text>
                      </View>
                      <Text style={styles.clientName}>{getClientName(invoice.clientId)}</Text>
                      <View style={styles.invoiceFooter}>
                        <View style={styles.dateRow}>
                          <Feather name="clock" size={14} color={colors.mutedForeground} />
                          <Text style={styles.dateText}>Due: {formatDate(invoice.dueDate || invoice.createdAt)}</Text>
                        </View>
                        <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
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
    padding: 16,
    paddingBottom: 100,
  },

  // Header
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
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  newButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },

  // Summary Card
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.foreground,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginHorizontal: 16,
  },

  // Search Bar
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.foreground,
  },

  // Filter Pills - pill shape with primary active
  filtersScroll: {
    marginBottom: 16,
    marginHorizontal: -16,
  },
  filtersContent: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: 'row',
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  filterPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.foreground,
  },
  filterPillTextActive: {
    color: colors.primaryForeground,
  },
  filterCount: {
    backgroundColor: colors.muted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    minWidth: 20,
    alignItems: 'center',
  },
  filterCountActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  filterCountText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.mutedForeground,
  },
  filterCountTextActive: {
    color: colors.primaryForeground,
  },

  // Stats Grid - compact
  statsGrid: {
    gap: 10,
    marginBottom: spacing.xl,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.foreground,
  },
  statTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.mutedForeground,
    marginTop: 2,
  },

  // Section Container - compact
  sectionContainer: {
    marginBottom: spacing.xl,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
  },
  sectionCount: {
    fontSize: 12,
    color: colors.mutedForeground,
  },

  // Recent Invoice Item - compact
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  recentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: spacing.md,
  },
  recentContent: {
    flex: 1,
  },
  recentTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.foreground,
  },
  recentSubtitle: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 1,
  },

  // Empty Section - compact
  emptySection: {
    alignItems: 'center',
    paddingVertical: spacing['2xl'],
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  emptySectionText: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: spacing.sm,
  },

  // Invoice Card - compact with left accent
  invoiceCard: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  invoiceCardAccent: {
    width: 4,
  },
  invoiceCardContent: {
    flex: 1,
    padding: 16,
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  invoiceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  invoiceNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  invoiceTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.foreground,
  },
  clientName: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginBottom: spacing.md,
  },
  invoiceFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dateText: {
    fontSize: 11,
    color: colors.mutedForeground,
  },

  // Empty State - compact
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing['3xl'],
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
    marginTop: spacing.md,
  },
  emptySubtitle: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
    textAlign: 'center',
  },

  // FAB - 56px as per design spec
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing['2xl'],
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
  },
});
