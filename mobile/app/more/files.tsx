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
import { spacing, radius, shadows, typography, iconSizes, usePageShell } from '../../src/lib/design-tokens';
import { api } from '../../src/lib/api';
import { format } from 'date-fns';
import { useContentWidth, isTablet } from '../../src/lib/device';

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

interface FileItem {
  id: string;
  name: string;
  type: 'quote' | 'invoice' | 'receipt';
  status: string;
  date: string;
  clientName: string;
  amount: number;
  routePath: string;
}

const formatCurrency = (amount: number) => {
  const safeAmount = isNaN(amount) ? 0 : amount;
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(safeAmount);
};

const getTypeBadgeConfig = (type: 'quote' | 'invoice' | 'receipt') => {
  switch (type) {
    case 'quote':
      return { label: 'Quote', icon: 'file-text' as const, color: '#3b82f6', bgColor: 'rgba(59,130,246,0.1)' };
    case 'invoice':
      return { label: 'Invoice', icon: 'file' as const, color: '#f59e0b', bgColor: 'rgba(245,158,11,0.1)' };
    case 'receipt':
      return { label: 'Receipt', icon: 'credit-card' as const, color: '#22c55e', bgColor: 'rgba(34,197,94,0.1)' };
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'draft': return '#6b7280';
    case 'sent': return '#3b82f6';
    case 'accepted': case 'paid': return '#22c55e';
    case 'rejected': case 'overdue': return '#ef4444';
    default: return '#6b7280';
  }
};

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '';
  try {
    return format(new Date(dateStr), 'dd MMM yyyy');
  } catch {
    return '';
  }
};

export default function FilesScreen() {
  const { colors } = useTheme();
  const contentWidth = useContentWidth();
  const isTabletDevice = isTablet();
  const responsiveShell = usePageShell();
  const styles = useMemo(() => createStyles(colors, contentWidth, responsiveShell.paddingHorizontal), [colors, contentWidth, responsiveShell.paddingHorizontal]);

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
        setError('Failed to load files. Pull down to retry.');
        return;
      }

      setQuotes(quotesRes.data || []);
      setInvoices(invoicesRes.data || []);
      setReceipts(receiptsRes.data || []);
      setClients(clientsRes.data || []);
    } catch (err) {
      setError('Failed to load files. Pull down to retry.');
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

  const allFiles = useMemo((): FileItem[] => {
    const items: FileItem[] = [];

    quotes.forEach(q => {
      items.push({
        id: `quote-${q.id}`,
        name: q.title || `Quote ${q.number || q.id}`,
        type: 'quote',
        status: q.status,
        date: q.createdAt || '',
        clientName: getClientName(q.clientId),
        amount: q.total,
        routePath: `/more/quote/${q.id}`,
      });
    });

    invoices.forEach(inv => {
      items.push({
        id: `invoice-${inv.id}`,
        name: inv.title || `Invoice ${inv.number || inv.id}`,
        type: 'invoice',
        status: inv.status,
        date: inv.createdAt || '',
        clientName: getClientName(inv.clientId),
        amount: inv.total,
        routePath: `/more/invoice/${inv.id}`,
      });
    });

    receipts.forEach(r => {
      items.push({
        id: `receipt-${r.id}`,
        name: `Receipt ${r.receiptNumber}`,
        type: 'receipt',
        status: 'paid',
        date: r.paidAt || '',
        clientName: getClientName(r.clientId),
        amount: r.amount,
        routePath: `/more/receipt/${r.id}`,
      });
    });

    items.sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    return items;
  }, [quotes, invoices, receipts, getClientName]);

  const recentFiles = useMemo(() => allFiles.slice(0, 10), [allFiles]);

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Stack.Screen options={{
          title: 'Files',
          headerShown: true,
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.foreground,
        }} />
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading files...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{
        title: 'Files',
        headerShown: true,
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.foreground,
      }} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {error ? (
          <View style={styles.errorContainer}>
            <Feather name="alert-circle" size={48} color={colors.destructive} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={handleRefresh} activeOpacity={0.7}>
              <Feather name="refresh-cw" size={16} color="#fff" />
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.summaryRow}>
              <TouchableOpacity
                style={styles.summaryCard}
                onPress={() => router.push('/more/documents?tab=quotes')}
                activeOpacity={0.7}
              >
                <View style={[styles.summaryIconContainer, { backgroundColor: 'rgba(59,130,246,0.1)' }]}>
                  <Feather name="file-text" size={iconSizes['2xl']} color="#3b82f6" />
                </View>
                <Text style={styles.summaryCount}>{quotes.length}</Text>
                <Text style={styles.summaryLabel}>Quotes</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.summaryCard}
                onPress={() => router.push('/more/documents?tab=invoices')}
                activeOpacity={0.7}
              >
                <View style={[styles.summaryIconContainer, { backgroundColor: 'rgba(245,158,11,0.1)' }]}>
                  <Feather name="file" size={iconSizes['2xl']} color="#f59e0b" />
                </View>
                <Text style={styles.summaryCount}>{invoices.length}</Text>
                <Text style={styles.summaryLabel}>Invoices</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.summaryCard}
                onPress={() => router.push('/more/documents?tab=receipts')}
                activeOpacity={0.7}
              >
                <View style={[styles.summaryIconContainer, { backgroundColor: 'rgba(34,197,94,0.1)' }]}>
                  <Feather name="credit-card" size={iconSizes['2xl']} color="#22c55e" />
                </View>
                <Text style={styles.summaryCount}>{receipts.length}</Text>
                <Text style={styles.summaryLabel}>Receipts</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.categorySection}>
              <Text style={styles.sectionTitle}>Categories</Text>

              <TouchableOpacity
                style={styles.categoryRow}
                onPress={() => router.push('/more/documents?tab=quotes')}
                activeOpacity={0.7}
              >
                <View style={[styles.categoryIcon, { backgroundColor: 'rgba(59,130,246,0.1)' }]}>
                  <Feather name="file-text" size={iconSizes.xl} color="#3b82f6" />
                </View>
                <View style={styles.categoryInfo}>
                  <Text style={styles.categoryName}>Quotes</Text>
                  <Text style={styles.categoryDesc}>{quotes.length} documents</Text>
                </View>
                <Feather name="chevron-right" size={iconSizes.lg} color={colors.mutedForeground} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.categoryRow}
                onPress={() => router.push('/more/documents?tab=invoices')}
                activeOpacity={0.7}
              >
                <View style={[styles.categoryIcon, { backgroundColor: 'rgba(245,158,11,0.1)' }]}>
                  <Feather name="file" size={iconSizes.xl} color="#f59e0b" />
                </View>
                <View style={styles.categoryInfo}>
                  <Text style={styles.categoryName}>Invoices</Text>
                  <Text style={styles.categoryDesc}>{invoices.length} documents</Text>
                </View>
                <Feather name="chevron-right" size={iconSizes.lg} color={colors.mutedForeground} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.categoryRow}
                onPress={() => router.push('/more/documents?tab=receipts')}
                activeOpacity={0.7}
              >
                <View style={[styles.categoryIcon, { backgroundColor: 'rgba(34,197,94,0.1)' }]}>
                  <Feather name="credit-card" size={iconSizes.xl} color="#22c55e" />
                </View>
                <View style={styles.categoryInfo}>
                  <Text style={styles.categoryName}>Receipts</Text>
                  <Text style={styles.categoryDesc}>{receipts.length} documents</Text>
                </View>
                <Feather name="chevron-right" size={iconSizes.lg} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            <View style={styles.recentSection}>
              <View style={styles.recentHeader}>
                <Text style={styles.sectionTitle}>Recent Documents</Text>
                <TouchableOpacity onPress={() => router.push('/more/documents')} activeOpacity={0.7}>
                  <Text style={styles.viewAllText}>View All</Text>
                </TouchableOpacity>
              </View>

              {recentFiles.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Feather name="folder" size={48} color={colors.mutedForeground} />
                  <Text style={styles.emptyTitle}>No documents yet</Text>
                  <Text style={styles.emptySubtitle}>Create a quote or invoice to get started</Text>
                </View>
              ) : (
                recentFiles.map((file) => {
                  const badge = getTypeBadgeConfig(file.type);
                  return (
                    <TouchableOpacity
                      key={file.id}
                      style={styles.fileRow}
                      onPress={() => router.push(file.routePath as any)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.fileIcon, { backgroundColor: badge.bgColor }]}>
                        <Feather name={badge.icon} size={iconSizes.lg} color={badge.color} />
                      </View>
                      <View style={styles.fileInfo}>
                        <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
                        <View style={styles.fileMeta}>
                          <View style={[styles.typeBadge, { backgroundColor: badge.bgColor }]}>
                            <Text style={[styles.typeBadgeText, { color: badge.color }]}>{badge.label}</Text>
                          </View>
                          <Text style={styles.fileClient} numberOfLines={1}>{file.clientName}</Text>
                        </View>
                      </View>
                      <View style={styles.fileRight}>
                        <Text style={styles.fileAmount}>{formatCurrency(file.amount)}</Text>
                        <Text style={styles.fileDate}>{formatDate(file.date)}</Text>
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
  );
}

const createStyles = (colors: ThemeColors, contentWidth: number, horizontalPadding: number) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: horizontalPadding,
    paddingTop: spacing.lg,
    paddingBottom: spacing['3xl'],
  },
  loadingText: {
    marginTop: spacing.md,
    ...typography.body,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['4xl'],
    gap: spacing.md,
  },
  errorText: {
    ...typography.body,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    marginTop: spacing.sm,
  },
  retryButtonText: {
    ...typography.button,
    color: '#fff',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing['2xl'],
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  summaryIconContainer: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCount: {
    ...typography.statValue,
    color: colors.foreground,
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  categorySection: {
    marginBottom: spacing['2xl'],
  },
  sectionTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
    marginBottom: spacing.md,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  categoryIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    ...typography.bodySemibold,
    color: colors.foreground,
  },
  categoryDesc: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  recentSection: {
    marginBottom: spacing['2xl'],
  },
  recentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  viewAllText: {
    ...typography.body,
    color: colors.primary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['4xl'],
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  emptyTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
  },
  emptySubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  fileIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  fileName: {
    ...typography.bodySemibold,
    color: colors.foreground,
  },
  fileMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  typeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  typeBadgeText: {
    ...typography.badge,
  },
  fileClient: {
    ...typography.caption,
    color: colors.mutedForeground,
    flex: 1,
  },
  fileRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  fileAmount: {
    ...typography.bodySemibold,
    color: colors.foreground,
  },
  fileDate: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
  },
});
