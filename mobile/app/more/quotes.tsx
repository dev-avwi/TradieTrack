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
import { useQuotesStore, useClientsStore } from '../../src/lib/store';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, shadows, typography, iconSizes, sizes } from '../../src/lib/design-tokens';
import { StatusBadge } from '../../src/components/ui/StatusBadge';

type FilterKey = 'all' | 'draft' | 'sent' | 'accepted' | 'rejected';

const FILTERS: { key: FilterKey; label: string; icon?: string }[] = [
  { key: 'all', label: 'All', icon: 'file-text' },
  { key: 'draft', label: 'Draft', icon: 'clock' },
  { key: 'sent', label: 'Sent', icon: 'send' },
  { key: 'accepted', label: 'Accepted', icon: 'check-circle' },
  { key: 'rejected', label: 'Rejected', icon: 'x-circle' },
];

function StatCard({ 
  title, 
  value, 
  icon,
  onPress,
  colors,
}: { 
  title: string; 
  value: number; 
  icon: React.ReactNode;
  onPress?: () => void;
  colors: ThemeColors;
}) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  
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

function RecentQuoteItem({ 
  quote, 
  clientName,
  onPress,
  colors,
}: { 
  quote: any;
  clientName: string;
  onPress: () => void;
  colors: ThemeColors;
}) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={styles.recentItem}
    >
      <View style={[styles.recentDot, { backgroundColor: colors.primary }]} />
      <View style={styles.recentContent}>
        <Text style={styles.recentTitle} numberOfLines={1}>{quote.quoteNumber || 'Draft Quote'}</Text>
        <Text style={styles.recentSubtitle}>{clientName}</Text>
      </View>
      <StatusBadge status={quote.status} size="sm" />
    </TouchableOpacity>
  );
}

const navigateToCreateQuote = () => {
  router.push('/more/quote/new');
};

export default function QuotesScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const { quotes, fetchQuotes, isLoading } = useQuotesStore();
  const { clients, fetchClients } = useClientsStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');

  const refreshData = useCallback(async () => {
    await Promise.all([fetchQuotes(), fetchClients()]);
  }, [fetchQuotes, fetchClients]);

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

  // Calculate filter counts
  const filterCounts = {
    all: quotes.length,
    draft: quotes.filter(q => q.status === 'draft').length,
    sent: quotes.filter(q => q.status === 'sent').length,
    accepted: quotes.filter(q => q.status === 'accepted').length,
    rejected: quotes.filter(q => q.status === 'rejected').length,
  };

  // Filter quotes
  const filteredQuotes = quotes.filter(quote => {
    const searchLower = searchQuery.toLowerCase();
    const clientName = getClientName(quote.clientId);
    const matchesSearch = 
      quote.quoteNumber?.toLowerCase().includes(searchLower) ||
      clientName.toLowerCase().includes(searchLower);
    
    const matchesFilter = activeFilter === 'all' || quote.status === activeFilter;
    
    return matchesSearch && matchesFilter;
  });

  // Get recent quotes (last 7 days)
  const getRecentQuotes = () => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    return quotes
      .filter(quote => new Date(quote.createdAt) >= sevenDaysAgo)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  };

  const recentQuotes = getRecentQuotes();

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
              <Text style={styles.pageTitle}>Quotes</Text>
              <Text style={styles.pageSubtitle}>Manage your quotes and proposals</Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.newButton}
              onPress={navigateToCreateQuote}
            >
              <Feather name="plus" size={18} color={colors.white} />
              <Text style={styles.newButtonText}>New Quote</Text>
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchBar}>
            <Feather name="search" size={20} color={colors.mutedForeground} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search quotes by number, client, or job..."
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
                title="TOTAL QUOTES"
                value={filterCounts.all}
                icon={<Feather name="file-text" size={22} color={colors.primary} />}
                onPress={() => setActiveFilter('all')}
                colors={colors}
              />
              <StatCard
                title="DRAFT"
                value={filterCounts.draft}
                icon={<Feather name="clock" size={22} color={colors.mutedForeground} />}
                onPress={() => setActiveFilter('draft')}
                colors={colors}
              />
            </View>
            <View style={styles.statsRow}>
              <StatCard
                title="SENT"
                value={filterCounts.sent}
                icon={<Feather name="send" size={22} color={colors.info} />}
                onPress={() => setActiveFilter('sent')}
                colors={colors}
              />
              <StatCard
                title="ACCEPTED"
                value={filterCounts.accepted}
                icon={<Feather name="check-circle" size={22} color={colors.success} />}
                onPress={() => setActiveFilter('accepted')}
                colors={colors}
              />
            </View>
          </View>

          {/* Recent Quotes Section */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeaderRow}>
              <Feather name="clock" size={18} color={colors.foreground} />
              <Text style={styles.sectionTitle}>Recent Quotes</Text>
            </View>
            {recentQuotes.length === 0 ? (
              <View style={styles.emptySection}>
                <Feather name="file-text" size={32} color={colors.mutedForeground} />
                <Text style={styles.emptySectionText}>No recent quotes</Text>
              </View>
            ) : (
              recentQuotes.map((quote) => (
                <RecentQuoteItem
                  key={quote.id}
                  quote={quote}
                  clientName={getClientName(quote.clientId)}
                  onPress={() => router.push(`/more/quote/${quote.id}`)}
                  colors={colors}
                />
              ))
            )}
          </View>

          {/* All Quotes Section */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>All Quotes</Text>
              <Text style={styles.sectionCount}>{filteredQuotes.length} quotes</Text>
            </View>
            
            {filteredQuotes.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="file-text" size={48} color={colors.mutedForeground} />
                <Text style={styles.emptyTitle}>No quotes found</Text>
                <Text style={styles.emptySubtitle}>
                  {searchQuery ? 'Try a different search' : 'Create your first quote to get started'}
                </Text>
              </View>
            ) : (
              filteredQuotes.map(quote => (
                <TouchableOpacity
                  key={quote.id}
                  style={styles.quoteCard}
                  activeOpacity={0.7}
                  onPress={() => router.push(`/more/quote/${quote.id}`)}
                >
                  <View style={styles.quoteHeader}>
                    <View style={styles.quoteInfo}>
                      <Text style={styles.quoteNumber}>{quote.quoteNumber || 'Draft'}</Text>
                      <StatusBadge status={quote.status} size="sm" />
                    </View>
                    <Text style={styles.quoteTotal}>{formatCurrency(quote.total || 0)}</Text>
                  </View>
                  <Text style={styles.clientName}>{getClientName(quote.clientId)}</Text>
                  <View style={styles.quoteFooter}>
                    <View style={styles.dateRow}>
                      <Feather name="clock" size={14} color={colors.mutedForeground} />
                      <Text style={styles.dateText}>{formatDate(quote.createdAt)}</Text>
                    </View>
                    <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
                  </View>
                </TouchableOpacity>
              ))
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
    fontSize: 24,
    fontWeight: '700',
    color: colors.foreground,
  },
  pageSubtitle: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  newButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },

  // Search Bar
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
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

  // Filter Pills - pill shaped
  filtersScroll: {
    marginBottom: 16,
    marginHorizontal: -16,
  },
  filtersContent: {
    paddingHorizontal: 16,
    gap: 8,
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
    color: colors.white,
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
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
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

  // Recent Quote Item - compact
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
    backgroundColor: colors.primary,
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

  // Quote Card - matches web Card p-4 (16px)
  quoteCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.xl,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  quoteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  quoteInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  quoteNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  quoteTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.foreground,
  },
  clientName: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginBottom: spacing.md,
  },
  quoteFooter: {
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
