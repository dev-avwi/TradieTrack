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
import { useQuotesStore, useClientsStore } from '../../src/lib/store';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, shadows, typography, sizes, pageShell, iconSizes } from '../../src/lib/design-tokens';
import { StatusBadge } from '../../src/components/ui/StatusBadge';
import { AnimatedCardPressable } from '../../src/components/ui/AnimatedPressable';

type FilterKey = 'all' | 'draft' | 'sent' | 'accepted' | 'rejected';

const FILTERS: { key: FilterKey; label: string; icon?: string }[] = [
  { key: 'all', label: 'All', icon: 'file-text' },
  { key: 'draft', label: 'Draft', icon: 'clock' },
  { key: 'sent', label: 'Sent', icon: 'send' },
  { key: 'accepted', label: 'Accepted', icon: 'check-circle' },
  { key: 'rejected', label: 'Rejected', icon: 'x-circle' },
];

const navigateToCreateQuote = () => {
  router.push('/more/quote/new');
};

function QuoteCard({ 
  quote, 
  clientName,
  onPress 
}: { 
  quote: any;
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
    switch (quote.status) {
      case 'draft': return colors.warning;
      case 'sent': return colors.info;
      case 'accepted': return colors.success;
      case 'rejected': return colors.destructive;
      default: return colors.primary;
    }
  };

  const getNextAction = () => {
    switch (quote.status) {
      case 'draft':
        return { 
          label: 'Send', 
          icon: 'send' as const, 
          color: colors.primary,
        };
      case 'sent':
        return { 
          label: 'View', 
          icon: 'eye' as const, 
          color: colors.info,
        };
      case 'accepted':
        return { 
          label: 'Job', 
          icon: 'briefcase' as const, 
          color: colors.success,
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

  return (
    <AnimatedCardPressable
      onPress={onPress}
      style={styles.quoteCard}
    >
      <View style={[styles.quoteCardAccent, { backgroundColor: getAccentColor() }]} />
      <View style={styles.quoteCardContent}>
        <View style={styles.quoteCardHeader}>
          <Text style={styles.quoteNumber} numberOfLines={1}>{quote.quoteNumber || 'Draft'}</Text>
          <StatusBadge status={quote.status} size="sm" />
        </View>

        <View style={styles.quoteAmountRow}>
          <Text style={styles.quoteTotal}>{formatCurrency(quote.total || 0)}</Text>
        </View>
      </View>
    </AnimatedCardPressable>
  );
}

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

  const filterCounts = {
    all: quotes.length,
    draft: quotes.filter(q => q.status === 'draft').length,
    sent: quotes.filter(q => q.status === 'sent').length,
    accepted: quotes.filter(q => q.status === 'accepted').length,
    rejected: quotes.filter(q => q.status === 'rejected').length,
  };

  const filteredQuotes = quotes.filter(quote => {
    const searchLower = searchQuery.toLowerCase();
    const clientName = getClientName(quote.clientId);
    const matchesSearch = 
      quote.quoteNumber?.toLowerCase().includes(searchLower) ||
      clientName.toLowerCase().includes(searchLower);
    
    const matchesFilter = activeFilter === 'all' || quote.status === activeFilter;
    
    return matchesSearch && matchesFilter;
  });

  const sortedQuotes = [...filteredQuotes].sort((a, b) => {
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
              <Text style={styles.pageTitle}>Quotes</Text>
              <Text style={styles.pageSubtitle}>{quotes.length} total</Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.newButton}
              onPress={navigateToCreateQuote}
            >
              <Feather name="plus" size={iconSizes.lg} color={colors.white} />
              <Text style={styles.newButtonText}>New Quote</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchBar}>
            <Feather name="search" size={iconSizes.xl} color={colors.mutedForeground} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search quotes..."
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
              <Text style={styles.sectionTitle}>ALL QUOTES</Text>
            </View>
            
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : sortedQuotes.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyStateIcon}>
                  <Feather name="file-text" size={iconSizes['4xl']} color={colors.mutedForeground} />
                </View>
                <Text style={styles.emptyStateTitle}>No quotes found</Text>
                <Text style={styles.emptyStateSubtitle}>
                  {searchQuery || activeFilter !== 'all'
                    ? 'Try adjusting your search or filters'
                    : 'Create your first quote to get started'}
                </Text>
              </View>
            ) : (
              <View style={styles.quotesList}>
                {sortedQuotes.map((quote) => (
                  <QuoteCard
                    key={quote.id}
                    quote={quote}
                    clientName={getClientName(quote.clientId)}
                    onPress={() => router.push(`/more/quote/${quote.id}`)}
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

  quotesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  quoteCard: {
    width: '48%',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  quoteCardAccent: {
    height: 3,
    width: '100%',
  },
  quoteCardContent: {
    flex: 1,
    padding: spacing.md,
  },
  quoteCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  quoteNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
    flex: 1,
  },
  quoteAmountRow: {},
  quoteTotal: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
  },
});
