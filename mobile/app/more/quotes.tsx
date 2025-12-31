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
import { useQuotesStore, useClientsStore, useAuthStore } from '../../src/lib/store';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { api, API_URL } from '../../src/lib/api';
import { spacing, radius, shadows, typography, sizes, pageShell, iconSizes } from '../../src/lib/design-tokens';
import { StatusBadge } from '../../src/components/ui/StatusBadge';
import { AnimatedCardPressable } from '../../src/components/ui/AnimatedPressable';
import { EmailComposeModal } from '../../src/components/EmailComposeModal';

type FilterKey = 'all' | 'draft' | 'sent' | 'accepted' | 'rejected' | 'archived';

const FILTERS: { key: FilterKey; label: string; icon: string }[] = [
  { key: 'all', label: 'All', icon: 'file-text' },
  { key: 'draft', label: 'Draft', icon: 'clock' },
  { key: 'sent', label: 'Sent', icon: 'send' },
  { key: 'accepted', label: 'Accepted', icon: 'check-circle' },
  { key: 'rejected', label: 'Rejected', icon: 'x-circle' },
  { key: 'archived', label: 'Archived', icon: 'archive' },
];

const navigateToCreateQuote = () => {
  router.push('/more/quote/new');
};

function KPICard({ 
  title, 
  value, 
  icon, 
  onPress,
  colors 
}: { 
  title: string;
  value: number;
  icon: string;
  onPress: () => void;
  colors: ThemeColors;
}) {
  return (
    <TouchableOpacity 
      style={{
        flex: 1,
        backgroundColor: colors.card,
        borderRadius: radius.lg,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        minWidth: '45%',
      }}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
        <Feather name={icon as any} size={16} color={colors.primary} />
        <Text style={{ fontSize: 12, color: colors.mutedForeground, fontWeight: '500' }}>{title}</Text>
      </View>
      <Text style={{ fontSize: 24, fontWeight: '700', color: colors.foreground }}>{value}</Text>
    </TouchableOpacity>
  );
}

function QuoteCard({ 
  quote, 
  clientName,
  onPress,
  onSend,
  onConvertToInvoice,
}: { 
  quote: any;
  clientName: string;
  onPress: () => void;
  onSend?: () => void;
  onConvertToInvoice?: () => void;
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

  const getQuickAction = () => {
    switch (quote.status) {
      case 'draft':
        return { label: 'Send', icon: 'send' as const, color: colors.primary, action: onSend };
      case 'sent':
        return { label: 'Resend', icon: 'refresh-cw' as const, color: colors.info, action: onSend };
      case 'accepted':
        return { label: 'Invoice', icon: 'arrow-right' as const, color: colors.success, action: onConvertToInvoice };
      default:
        return null;
    }
  };

  const quickAction = getQuickAction();

  return (
    <View style={styles.quoteCard}>
      {/* Main card content - tappable to view details */}
      <TouchableOpacity 
        style={styles.cardPressable}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View style={styles.quoteCardContent}>
          {/* Web-style horizontal layout: Icon + Info on left, Amount on right */}
          <View style={styles.cardRow}>
            {/* Left: Icon circle + Info */}
            <View style={styles.cardLeft}>
              <View style={[styles.iconCircle, { backgroundColor: `${getAccentColor()}20` }]}>
                <Feather name="file-text" size={20} color={getAccentColor()} />
              </View>
              <View style={styles.cardInfo}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.quoteNumber} numberOfLines={1}>{quote.quoteNumber || 'Draft'}</Text>
                  <StatusBadge status={quote.status} size="sm" />
                </View>
                <View style={styles.cardSubtitle}>
                  <Feather name="user" size={12} color={colors.mutedForeground} />
                  <Text style={styles.clientName} numberOfLines={1}>{clientName || 'No client'}</Text>
                </View>
              </View>
            </View>
            
            {/* Right: Amount + Chevron */}
            <View style={styles.cardRight}>
              <Text style={styles.quoteTotal}>{formatCurrency(quote.total || 0)}</Text>
              <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
            </View>
          </View>
          
          {/* Details row */}
          <View style={styles.detailsRow}>
            <Feather name="calendar" size={12} color={colors.mutedForeground} />
            <Text style={styles.quoteDetailText} numberOfLines={1}>
              {quote.createdAt ? formatDate(quote.createdAt) : 'No date'}
              {quote.expiryDate && ` • Expires ${formatDate(quote.expiryDate)}`}
            </Text>
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

export default function QuotesScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const { quotes, fetchQuotes, isLoading } = useQuotesStore();
  const { clients, fetchClients } = useClientsStore();
  const { user, businessSettings } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  
  // Inline email compose state
  const [showEmailCompose, setShowEmailCompose] = useState(false);
  const [selectedQuoteForEmail, setSelectedQuoteForEmail] = useState<any>(null);

  const refreshData = useCallback(async () => {
    await Promise.all([fetchQuotes(), fetchClients()]);
  }, [fetchQuotes, fetchClients]);

  useEffect(() => {
    refreshData();
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshData();
    }, [refreshData])
  );

  const getClientName = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    return client?.name || 'Unknown Client';
  };

  const filterCounts = {
    all: quotes.filter(q => q.status !== 'archived').length,
    draft: quotes.filter(q => q.status === 'draft').length,
    sent: quotes.filter(q => q.status === 'sent').length,
    accepted: quotes.filter(q => q.status === 'accepted').length,
    rejected: quotes.filter(q => q.status === 'rejected').length,
    archived: quotes.filter(q => q.status === 'archived' || q.archived).length,
  };

  const filteredQuotes = quotes.filter(quote => {
    const searchLower = searchQuery.toLowerCase();
    const clientName = getClientName(quote.clientId);
    const matchesSearch = 
      quote.quoteNumber?.toLowerCase().includes(searchLower) ||
      clientName.toLowerCase().includes(searchLower) ||
      quote.title?.toLowerCase().includes(searchLower);
    
    if (activeFilter === 'archived') {
      return matchesSearch && (quote.status === 'archived' || quote.archived);
    }
    
    const matchesFilter = activeFilter === 'all' 
      ? quote.status !== 'archived' && !quote.archived
      : quote.status === activeFilter;
    
    return matchesSearch && matchesFilter;
  });

  const sortedQuotes = [...filteredQuotes].sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const getSectionTitle = () => {
    switch (activeFilter) {
      case 'all': return 'ALL QUOTES';
      case 'draft': return 'DRAFT QUOTES';
      case 'sent': return 'SENT QUOTES';
      case 'accepted': return 'ACCEPTED QUOTES';
      case 'rejected': return 'REJECTED QUOTES';
      case 'archived': return 'ARCHIVED QUOTES';
      default: return 'QUOTES';
    }
  };

  const handleSendQuote = async (quoteId: string) => {
    const quote = quotes.find(q => q.id === quoteId);
    const client = clients.find(c => c.id === quote?.clientId);
    
    if (!client?.email) {
      Alert.alert(
        'No Email Address',
        'This client does not have an email address. Would you like to view the quote and add one?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'View Quote', onPress: () => router.push(`/more/quote/${quoteId}`) }
        ]
      );
      return;
    }
    
    // Show inline email compose modal
    setSelectedQuoteForEmail({ ...quote, client });
    setShowEmailCompose(true);
  };
  
  const handleSendEmail = async (customSubject: string, customMessage: string) => {
    if (!selectedQuoteForEmail) return;
    
    try {
      const response = await api.post<{ success?: boolean; error?: string }>(
        `/api/quotes/${selectedQuoteForEmail.id}/send`, 
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
      setSelectedQuoteForEmail(null);
      await refreshData();
      Alert.alert('Success', 'Quote sent successfully');
    } catch (error) {
      console.error('Error sending quote:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to send quote');
    }
  };

  const handleConvertToInvoice = async (quoteId: string) => {
    const quote = quotes.find(q => q.id === quoteId);
    
    Alert.alert(
      'Create Invoice',
      `Create an invoice from quote ${quote?.quoteNumber}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Create Invoice', 
          onPress: () => {
            router.push({
              pathname: '/more/invoice/new',
              params: { fromQuoteId: quoteId }
            });
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
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Feather name="x" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
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
                  <Feather 
                    name={filter.icon as any} 
                    size={12} 
                    color={isActive ? colors.white : colors.foreground} 
                  />
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

          {/* KPI Stats Cards - 2x2 grid like web */}
          <View style={styles.kpiGrid}>
            <KPICard
              title="Total Quotes"
              value={filterCounts.all}
              icon="file-text"
              onPress={() => setActiveFilter('all')}
              colors={colors}
            />
            <KPICard
              title="Draft"
              value={filterCounts.draft}
              icon="clock"
              onPress={() => setActiveFilter('draft')}
              colors={colors}
            />
            <KPICard
              title="Sent"
              value={filterCounts.sent}
              icon="send"
              onPress={() => setActiveFilter('sent')}
              colors={colors}
            />
            <KPICard
              title="Accepted"
              value={filterCounts.accepted}
              icon="check-circle"
              onPress={() => setActiveFilter('accepted')}
              colors={colors}
            />
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="file-text" size={iconSizes.md} color={colors.primary} />
              <Text style={styles.sectionTitle}>{getSectionTitle()}</Text>
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
                    : 'Send professional quotes that clients can accept online. GST calculated automatically.'}
                </Text>
                {!searchQuery && activeFilter === 'all' && (
                  <>
                    <TouchableOpacity 
                      style={styles.emptyStateButton}
                      onPress={navigateToCreateQuote}
                    >
                      <Feather name="plus" size={16} color={colors.white} />
                      <Text style={styles.emptyStateButtonText}>Create Your First Quote</Text>
                    </TouchableOpacity>
                    <Text style={styles.emptyStateTip}>
                      Tip: Accepted quotes can be converted to invoices with one tap
                    </Text>
                  </>
                )}
              </View>
            ) : (
              <View style={styles.quotesList}>
                {sortedQuotes.map((quote) => (
                  <QuoteCard
                    key={quote.id}
                    quote={quote}
                    clientName={getClientName(quote.clientId)}
                    onPress={() => router.push(`/more/quote/${quote.id}`)}
                    onSend={() => handleSendQuote(quote.id)}
                    onConvertToInvoice={() => handleConvertToInvoice(quote.id)}
                  />
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </View>
      
      {/* Inline Email Compose Modal */}
      {selectedQuoteForEmail && (
        <EmailComposeModal
          visible={showEmailCompose}
          onClose={() => {
            setShowEmailCompose(false);
            setSelectedQuoteForEmail(null);
          }}
          type="quote"
          documentId={selectedQuoteForEmail.id}
          clientName={selectedQuoteForEmail.client?.name || 'Client'}
          clientEmail={selectedQuoteForEmail.client?.email || ''}
          documentNumber={selectedQuoteForEmail.quoteNumber || ''}
          documentTitle={selectedQuoteForEmail.title || 'Services'}
          total={`$${((selectedQuoteForEmail.total || 0) / 100).toFixed(2)}`}
          businessName={businessSettings?.businessName || user?.businessName || 'Your Business'}
          publicUrl={`${API_URL}/public/quote/${selectedQuoteForEmail.id}`}
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
    paddingHorizontal: spacing.md,
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

  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.xl,
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
    paddingHorizontal: spacing.lg,
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
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  emptyStateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  emptyStateButtonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 14,
  },
  emptyStateTip: {
    fontSize: 12,
    color: colors.mutedForeground,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  quotesList: {
    gap: spacing.md,
  },
  quoteCard: {
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
  quoteCardContent: {
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
  quoteNumber: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
  },
  quoteTotal: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  quoteDetailText: {
    fontSize: 12,
    color: colors.mutedForeground,
    flex: 1,
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
