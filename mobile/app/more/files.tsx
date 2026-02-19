import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, StyleSheet, ActivityIndicator } from 'react-native';
import { Stack, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../src/lib/theme';
import { api } from '../../src/lib/api';
import { format } from 'date-fns';

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
  jobId?: string;
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

interface RecentDocument {
  id: string;
  title: string;
  type: 'quote' | 'invoice' | 'receipt';
  clientName: string;
  amount: number;
  date: string;
  routePath: string;
}

const TYPE_COLORS = {
  quote: { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  invoice: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  receipt: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
};

const formatCurrency = (amount: number) => {
  const safeAmount = isNaN(amount) ? 0 : amount;
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(safeAmount);
};

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '';
  try {
    return format(new Date(dateStr), 'dd MMM yyyy');
  } catch {
    return '';
  }
};

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
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.mutedForeground,
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.foreground,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.mutedForeground,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  categoryContent: {
    flex: 1,
  },
  categoryTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
  },
  categoryCount: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  quickAccessSection: {
    marginBottom: 24,
  },
  recentSection: {
    marginBottom: 24,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  viewAllText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  documentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  documentIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  documentInfo: {
    flex: 1,
  },
  documentTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
  },
  documentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  documentClient: {
    fontSize: 12,
    color: colors.mutedForeground,
    flex: 1,
  },
  documentRight: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  documentAmount: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
  },
  documentDate: {
    fontSize: 11,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 24,
  },
  emptyIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  emptyText: {
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: 8,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginTop: 12,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 24,
  },
  errorText: {
    fontSize: 14,
    color: colors.destructive,
    textAlign: 'center',
    marginTop: 12,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.primaryForeground,
  },
});

export default function FilesScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientMap = useMemo(() => new Map(clients.map(c => [c.id, c])), [clients]);

  const getClientName = useCallback((clientId: string) => {
    return clientMap.get(clientId)?.name || 'Unknown Client';
  }, [clientMap]);

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      const [quotesRes, invoicesRes, receiptsRes, clientsRes] = await Promise.all([
        api.get<Quote[]>('/api/quotes'),
        api.get<Invoice[]>('/api/invoices'),
        api.get<Receipt[]>('/api/receipts').catch(() => ({ data: [] as Receipt[] })),
        api.get<Client[]>('/api/clients'),
      ]);

      if (quotesRes.error && invoicesRes.error) {
        setError('Failed to load documents. Pull down to retry.');
        return;
      }

      setQuotes(quotesRes.data || []);
      setInvoices(invoicesRes.data || []);
      setReceipts(receiptsRes.data || []);
      setClients(clientsRes.data || []);
    } catch (err) {
      setError('Failed to load documents. Pull down to retry.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const recentDocuments = useMemo((): RecentDocument[] => {
    const items: RecentDocument[] = [];

    quotes.forEach(q => {
      items.push({
        id: `quote-${q.id}`,
        title: q.title || `Quote ${q.number || q.id}`,
        type: 'quote',
        clientName: getClientName(q.clientId),
        amount: q.total,
        date: q.createdAt || '',
        routePath: `/more/quote/${q.id}`,
      });
    });

    invoices.forEach(inv => {
      items.push({
        id: `invoice-${inv.id}`,
        title: inv.title || `Invoice ${inv.number || inv.id}`,
        type: 'invoice',
        clientName: getClientName(inv.clientId),
        amount: inv.total,
        date: inv.createdAt || '',
        routePath: `/more/invoice/${inv.id}`,
      });
    });

    receipts.forEach(r => {
      items.push({
        id: `receipt-${r.id}`,
        title: `Receipt ${r.receiptNumber}`,
        type: 'receipt',
        clientName: getClientName(r.clientId),
        amount: r.amount,
        date: r.paidAt || '',
        routePath: `/more/receipt/${r.id}`,
      });
    });

    items.sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    return items.slice(0, 10);
  }, [quotes, invoices, receipts, getClientName]);

  const totalDocuments = quotes.length + invoices.length + receipts.length;

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
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
        >
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.pageTitle}>Files</Text>
              <Text style={styles.pageSubtitle}>All your documents in one place</Text>
            </View>
          </View>

          {isLoading && totalDocuments === 0 && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Loading documents...</Text>
            </View>
          )}

          {error && (
            <View style={styles.errorContainer}>
              <Feather name="alert-circle" size={40} color={colors.destructive} />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
                <Text style={styles.retryButtonText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          )}

          {!isLoading && !error && totalDocuments === 0 && (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconContainer}>
                <Feather name="folder" size={28} color={colors.mutedForeground} />
              </View>
              <Text style={styles.emptyTitle}>No Documents Yet</Text>
              <Text style={styles.emptyText}>Create a quote or invoice to get started</Text>
            </View>
          )}

          {!isLoading && !error && totalDocuments > 0 && (
            <>
              <View style={styles.statsRow}>
                <TouchableOpacity
                  style={styles.statCard}
                  onPress={() => router.push('/more/documents')}
                  activeOpacity={0.7}
                >
                  <View style={[styles.statIconContainer, { backgroundColor: TYPE_COLORS.quote.bg }]}>
                    <Feather name="file-text" size={22} color={TYPE_COLORS.quote.color} />
                  </View>
                  <Text style={styles.statValue}>{quotes.length}</Text>
                  <Text style={styles.statLabel}>QUOTES</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.statCard}
                  onPress={() => router.push('/more/documents')}
                  activeOpacity={0.7}
                >
                  <View style={[styles.statIconContainer, { backgroundColor: TYPE_COLORS.invoice.bg }]}>
                    <Feather name="file" size={22} color={TYPE_COLORS.invoice.color} />
                  </View>
                  <Text style={styles.statValue}>{invoices.length}</Text>
                  <Text style={styles.statLabel}>INVOICES</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.statCard}
                  onPress={() => router.push('/more/documents')}
                  activeOpacity={0.7}
                >
                  <View style={[styles.statIconContainer, { backgroundColor: TYPE_COLORS.receipt.bg }]}>
                    <Feather name="check-square" size={22} color={TYPE_COLORS.receipt.color} />
                  </View>
                  <Text style={styles.statValue}>{receipts.length}</Text>
                  <Text style={styles.statLabel}>RECEIPTS</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.quickAccessSection}>
                <Text style={styles.sectionTitle}>QUICK ACCESS</Text>

                <TouchableOpacity
                  style={styles.categoryCard}
                  onPress={() => router.push('/more/documents')}
                  activeOpacity={0.7}
                >
                  <View style={[styles.categoryIconContainer, { backgroundColor: TYPE_COLORS.quote.bg }]}>
                    <Feather name="file-text" size={22} color={TYPE_COLORS.quote.color} />
                  </View>
                  <View style={styles.categoryContent}>
                    <Text style={styles.categoryTitle}>Quotes</Text>
                    <Text style={styles.categoryCount}>{quotes.length} documents</Text>
                  </View>
                  <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.categoryCard}
                  onPress={() => router.push('/more/documents')}
                  activeOpacity={0.7}
                >
                  <View style={[styles.categoryIconContainer, { backgroundColor: TYPE_COLORS.invoice.bg }]}>
                    <Feather name="file" size={22} color={TYPE_COLORS.invoice.color} />
                  </View>
                  <View style={styles.categoryContent}>
                    <Text style={styles.categoryTitle}>Invoices</Text>
                    <Text style={styles.categoryCount}>{invoices.length} documents</Text>
                  </View>
                  <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.categoryCard}
                  onPress={() => router.push('/more/documents')}
                  activeOpacity={0.7}
                >
                  <View style={[styles.categoryIconContainer, { backgroundColor: TYPE_COLORS.receipt.bg }]}>
                    <Feather name="check-square" size={22} color={TYPE_COLORS.receipt.color} />
                  </View>
                  <View style={styles.categoryContent}>
                    <Text style={styles.categoryTitle}>Receipts</Text>
                    <Text style={styles.categoryCount}>{receipts.length} documents</Text>
                  </View>
                  <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>

              <View style={styles.recentSection}>
                <View style={styles.recentHeader}>
                  <Text style={styles.sectionTitle}>RECENT DOCUMENTS</Text>
                  <TouchableOpacity onPress={() => router.push('/more/documents')} activeOpacity={0.7}>
                    <Text style={styles.viewAllText}>View All</Text>
                  </TouchableOpacity>
                </View>

                {recentDocuments.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <View style={styles.emptyIconContainer}>
                      <Feather name="folder" size={28} color={colors.mutedForeground} />
                    </View>
                    <Text style={styles.emptyTitle}>No Documents Yet</Text>
                    <Text style={styles.emptyText}>Create a quote or invoice to get started</Text>
                  </View>
                ) : (
                  recentDocuments.map((doc) => {
                    const typeColor = TYPE_COLORS[doc.type];
                    const typeLabel = doc.type.charAt(0).toUpperCase() + doc.type.slice(1);
                    return (
                      <TouchableOpacity
                        key={doc.id}
                        style={styles.documentRow}
                        onPress={() => router.push(doc.routePath as any)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.documentIcon, { backgroundColor: typeColor.bg }]}>
                          <Feather
                            name={doc.type === 'quote' ? 'file-text' : doc.type === 'invoice' ? 'file' : 'check-square'}
                            size={16}
                            color={typeColor.color}
                          />
                        </View>
                        <View style={styles.documentInfo}>
                          <Text style={styles.documentTitle} numberOfLines={1}>{doc.title}</Text>
                          <View style={styles.documentMeta}>
                            <View style={[styles.typeBadge, { backgroundColor: typeColor.bg }]}>
                              <Text style={[styles.typeBadgeText, { color: typeColor.color }]}>{typeLabel}</Text>
                            </View>
                            <Text style={styles.documentClient} numberOfLines={1}>{doc.clientName}</Text>
                          </View>
                        </View>
                        <View style={styles.documentRight}>
                          <Text style={styles.documentAmount}>{formatCurrency(doc.amount)}</Text>
                          <Text style={styles.documentDate}>{formatDate(doc.date)}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </>
  );
}
