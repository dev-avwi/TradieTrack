import { useEffect, useState, useMemo } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Alert
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useClientsStore, useJobsStore, useQuotesStore, useInvoicesStore } from '../../../src/lib/store';
import { useTheme, ThemeColors } from '../../../src/lib/theme';
import { spacing, radius, shadows, typography, iconSizes, sizes } from '../../../src/lib/design-tokens';
import { StatusBadge } from '../../../src/components/ui/StatusBadge';
import { api } from '../../../src/lib/api';

type TabType = 'jobs' | 'quotes' | 'invoices';

export default function ClientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getClient, deleteClient } = useClientsStore();
  const { jobs, fetchJobs } = useJobsStore();
  const { quotes, fetchQuotes } = useQuotesStore();
  const { invoices, fetchInvoices } = useInvoicesStore();
  const [client, setClient] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingTabs, setIsLoadingTabs] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('jobs');
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    setIsLoading(true);
    setIsLoadingTabs(true);
    try {
      const clientResponse = await api.get<any>(`/api/clients/${id}`);
      if (clientResponse.data) {
        setClient(clientResponse.data);
      } else {
        const clientData = await getClient(id!);
        setClient(clientData);
      }
    } catch (error) {
      console.error('Failed to fetch client:', error);
      const clientData = await getClient(id!);
      setClient(clientData);
    }
    setIsLoading(false);
    
    try {
      await Promise.all([fetchJobs(), fetchQuotes(), fetchInvoices()]);
    } catch (error) {
      console.error('Failed to fetch client data:', error);
      Alert.alert('Error', 'Failed to load some data. Pull down to refresh.');
    } finally {
      setIsLoadingTabs(false);
    }
  };

  const clientJobs = jobs.filter(j => j.clientId === id);
  const clientQuotes = quotes.filter(q => q.clientId === id);
  const clientInvoices = invoices.filter(i => i.clientId === id);

  const paidInvoices = clientInvoices.filter((i: any) => i.status === 'paid');
  const unpaidInvoices = clientInvoices.filter((i: any) => i.status !== 'paid' && i.status !== 'cancelled');
  const overdueInvoices = clientInvoices.filter((i: any) => i.status === 'overdue');
  
  const totalPaid = paidInvoices.reduce((sum: number, i: any) => {
    const total = typeof i.total === 'string' ? parseFloat(i.total) : (i.total || 0);
    return sum + total;
  }, 0) + unpaidInvoices.reduce((sum: number, i: any) => {
    const paidAmount = typeof i.paidAmount === 'string' ? parseFloat(i.paidAmount) : (i.paidAmount || 0);
    return sum + paidAmount;
  }, 0);
  
  const totalOutstanding = unpaidInvoices.reduce((sum: number, i: any) => {
    const total = typeof i.total === 'string' ? parseFloat(i.total) : (i.total || 0);
    const paidAmount = typeof i.paidAmount === 'string' ? parseFloat(i.paidAmount) : (i.paidAmount || 0);
    return sum + (total - paidAmount);
  }, 0);

  const activeJobs = clientJobs.filter((j: any) => j.status === 'in_progress' || j.status === 'scheduled');

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const handleCall = () => {
    if (client?.phone) {
      Linking.openURL(`tel:${client.phone}`);
    }
  };

  const handleEmail = () => {
    if (client?.email) {
      Linking.openURL(`mailto:${client.email}`);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Client',
      'Are you sure you want to delete this client? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            const success = await deleteClient(id!);
            if (success) {
              router.back();
            } else {
              Alert.alert('Error', 'Failed to delete client');
            }
          }
        }
      ]
    );
  };

  const handleNewJob = () => {
    router.push(`/more/create-job?clientId=${id}`);
  };

  const handleNewQuote = () => {
    router.push(`/more/create-quote?clientId=${id}`);
  };

  const handleNewInvoice = () => {
    router.push(`/more/create-invoice?clientId=${id}`);
  };

  const handleViewJob = (jobId: string) => {
    router.push(`/job/${jobId}`);
  };

  const handleViewQuote = (quoteId: string) => {
    router.push(`/more/quote/${quoteId}`);
  };

  const handleViewInvoice = (invoiceId: string) => {
    router.push(`/more/invoice/${invoiceId}`);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Client' }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </>
    );
  }

  if (!client) {
    return (
      <>
        <Stack.Screen options={{ title: 'Client' }} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Client not found</Text>
        </View>
      </>
    );
  }

  const renderJobsList = () => (
    <View style={styles.listContainer}>
      {isLoadingTabs ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.emptyText}>Loading jobs...</Text>
        </View>
      ) : clientJobs.length === 0 ? (
        <View style={styles.emptyState}>
          <Feather name="briefcase" size={32} color={colors.mutedForeground} />
          <Text style={styles.emptyText}>No jobs yet</Text>
          <TouchableOpacity style={styles.emptyButton} onPress={handleNewJob}>
            <Feather name="plus" size={16} color={colors.primaryForeground} />
            <Text style={styles.emptyButtonText}>Create First Job</Text>
          </TouchableOpacity>
        </View>
      ) : (
        clientJobs.map((job: any) => (
          <TouchableOpacity 
            key={job.id} 
            style={styles.listItem}
            onPress={() => handleViewJob(job.id)}
          >
            <View style={styles.listItemContent}>
              <Text style={styles.listItemTitle} numberOfLines={1}>{job.title}</Text>
              <View style={styles.listItemMeta}>
                <StatusBadge status={job.status} size="sm" />
                {job.scheduledAt && (
                  <Text style={styles.listItemDate}>{formatDate(job.scheduledAt)}</Text>
                )}
              </View>
            </View>
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        ))
      )}
    </View>
  );

  const renderQuotesList = () => (
    <View style={styles.listContainer}>
      {isLoadingTabs ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.emptyText}>Loading quotes...</Text>
        </View>
      ) : clientQuotes.length === 0 ? (
        <View style={styles.emptyState}>
          <Feather name="file-text" size={32} color={colors.mutedForeground} />
          <Text style={styles.emptyText}>No quotes yet</Text>
          <TouchableOpacity style={styles.emptyButton} onPress={handleNewQuote}>
            <Feather name="plus" size={16} color={colors.primaryForeground} />
            <Text style={styles.emptyButtonText}>Create First Quote</Text>
          </TouchableOpacity>
        </View>
      ) : (
        clientQuotes.map((quote: any) => (
          <TouchableOpacity 
            key={quote.id} 
            style={styles.listItem}
            onPress={() => handleViewQuote(quote.id)}
          >
            <View style={styles.listItemContent}>
              <Text style={styles.listItemTitle} numberOfLines={1}>
                {quote.quoteNumber || `Quote #${quote.id.slice(0, 6)}`}
              </Text>
              <View style={styles.listItemMeta}>
                <StatusBadge status={quote.status} size="sm" />
                <Text style={styles.listItemAmount}>
                  {formatCurrency(typeof quote.total === 'string' ? parseFloat(quote.total) : (quote.total || 0))}
                </Text>
              </View>
              {quote.validUntil && (
                <Text style={styles.listItemSubtext}>Valid until {formatDate(quote.validUntil)}</Text>
              )}
            </View>
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        ))
      )}
    </View>
  );

  const renderInvoicesList = () => (
    <View style={styles.listContainer}>
      {isLoadingTabs ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.emptyText}>Loading invoices...</Text>
        </View>
      ) : clientInvoices.length === 0 ? (
        <View style={styles.emptyState}>
          <Feather name="file-text" size={32} color={colors.mutedForeground} />
          <Text style={styles.emptyText}>No invoices yet</Text>
          <TouchableOpacity style={styles.emptyButton} onPress={handleNewInvoice}>
            <Feather name="plus" size={16} color={colors.primaryForeground} />
            <Text style={styles.emptyButtonText}>Create First Invoice</Text>
          </TouchableOpacity>
        </View>
      ) : (
        clientInvoices.map((invoice: any) => (
          <TouchableOpacity 
            key={invoice.id} 
            style={styles.listItem}
            onPress={() => handleViewInvoice(invoice.id)}
          >
            <View style={styles.listItemContent}>
              <Text style={styles.listItemTitle} numberOfLines={1}>
                {invoice.invoiceNumber || `Invoice #${invoice.id.slice(0, 6)}`}
              </Text>
              <View style={styles.listItemMeta}>
                <StatusBadge status={invoice.status} size="sm" />
                <Text style={styles.listItemAmount}>
                  {formatCurrency(typeof invoice.total === 'string' ? parseFloat(invoice.total) : (invoice.total || 0))}
                </Text>
              </View>
              {invoice.dueDate && (
                <Text style={[
                  styles.listItemSubtext,
                  invoice.status === 'overdue' && { color: colors.destructive }
                ]}>
                  {invoice.status === 'paid' ? 'Paid' : `Due ${formatDate(invoice.dueDate)}`}
                </Text>
              )}
            </View>
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        ))
      )}
    </View>
  );

  return (
    <>
      <Stack.Screen 
        options={{ 
          title: 'Client Details',
          headerRight: () => (
            <TouchableOpacity onPress={handleDelete} style={styles.headerButton}>
              <Feather name="trash-2" size={20} color={colors.destructive} />
            </TouchableOpacity>
          ),
        }} 
      />
      <ScrollView style={styles.container}>
        <View style={styles.content}>
          {/* Profile Header */}
          <View style={styles.profileHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(client.name)}</Text>
            </View>
            <Text style={styles.clientName}>{client.name}</Text>
          </View>

          {/* Quick Actions - Call & Email */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionButton, !client.phone && styles.actionButtonDisabled]}
              onPress={handleCall}
              disabled={!client.phone}
            >
              <Feather name="phone" size={20} color={client.phone ? colors.primaryForeground : colors.mutedForeground} />
              <Text style={[styles.actionButtonText, !client.phone && styles.actionButtonTextDisabled]}>
                Call
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, !client.email && styles.actionButtonDisabled]}
              onPress={handleEmail}
              disabled={!client.email}
            >
              <Feather name="mail" size={20} color={client.email ? colors.primaryForeground : colors.mutedForeground} />
              <Text style={[styles.actionButtonText, !client.email && styles.actionButtonTextDisabled]}>
                Email
              </Text>
            </TouchableOpacity>
          </View>

          {/* AR Balance Widget */}
          <Text style={styles.sectionTitle}>Account Balance</Text>
          <View style={styles.balanceCard}>
            <View style={styles.balanceRow}>
              <View style={styles.balanceItem}>
                <View style={styles.balanceIconWrapper}>
                  <Feather name="dollar-sign" size={18} color={colors.success} />
                </View>
                <View>
                  <Text style={styles.balanceLabel}>Paid to Date</Text>
                  <Text style={[styles.balanceValue, { color: colors.success }]}>
                    {formatCurrency(totalPaid)}
                  </Text>
                </View>
              </View>
              <View style={styles.balanceDivider} />
              <View style={styles.balanceItem}>
                <View style={[
                  styles.balanceIconWrapper,
                  { backgroundColor: overdueInvoices.length > 0 ? colors.destructiveLight : colors.warningLight }
                ]}>
                  <Feather 
                    name="clock" 
                    size={18} 
                    color={overdueInvoices.length > 0 ? colors.destructive : colors.warning} 
                  />
                </View>
                <View>
                  <Text style={styles.balanceLabel}>Outstanding</Text>
                  <Text style={[
                    styles.balanceValue,
                    { color: overdueInvoices.length > 0 ? colors.destructive : colors.warning }
                  ]}>
                    {formatCurrency(totalOutstanding)}
                  </Text>
                  {overdueInvoices.length > 0 && (
                    <Text style={[styles.balanceWarning, { color: colors.destructive }]}>
                      {overdueInvoices.length} overdue
                    </Text>
                  )}
                </View>
              </View>
            </View>
          </View>

          {/* Enhanced Stats Cards */}
          <Text style={styles.sectionTitle}>Summary</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Feather name="trending-up" size={20} color={colors.success} />
              <Text style={styles.statValue}>{formatCurrency(totalPaid)}</Text>
              <Text style={styles.statLabel}>Revenue</Text>
            </View>
            <View style={styles.statItem}>
              <Feather name="briefcase" size={20} color={colors.primary} />
              <Text style={styles.statValue}>{activeJobs.length}</Text>
              <Text style={styles.statLabel}>Active Jobs</Text>
            </View>
            <View style={styles.statItem}>
              <Feather name="file-text" size={20} color={colors.info} />
              <Text style={styles.statValue}>{clientInvoices.length}</Text>
              <Text style={styles.statLabel}>Invoices</Text>
            </View>
          </View>

          {/* Quick Create Actions */}
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsRow}>
            <TouchableOpacity style={styles.quickActionButton} onPress={handleNewJob}>
              <Feather name="plus" size={16} color={colors.primary} />
              <Text style={styles.quickActionText}>New Job</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickActionButton} onPress={handleNewQuote}>
              <Feather name="plus" size={16} color={colors.primary} />
              <Text style={styles.quickActionText}>New Quote</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickActionButton} onPress={handleNewInvoice}>
              <Feather name="plus" size={16} color={colors.primary} />
              <Text style={styles.quickActionText}>New Invoice</Text>
            </TouchableOpacity>
          </View>

          {/* Contact Info */}
          <Text style={styles.sectionTitle}>Contact Info</Text>
          <View style={styles.card}>
            {client.phone || client.email || client.address ? (
              <>
                {client.phone && (
                  <View style={styles.infoRow}>
                    <Feather name="phone" size={18} color={colors.mutedForeground} />
                    <Text style={styles.infoText}>{client.phone}</Text>
                  </View>
                )}
                {client.email && (
                  <View style={styles.infoRow}>
                    <Feather name="mail" size={18} color={colors.mutedForeground} />
                    <Text style={styles.infoText}>{client.email}</Text>
                  </View>
                )}
                {client.address && (
                  <View style={styles.infoRow}>
                    <Feather name="map-pin" size={18} color={colors.mutedForeground} />
                    <Text style={styles.infoText}>{client.address}</Text>
                  </View>
                )}
              </>
            ) : (
              <Text style={styles.noInfoText}>No contact information</Text>
            )}
          </View>

          {/* Notes */}
          {client.notes && (
            <>
              <Text style={styles.sectionTitle}>Notes</Text>
              <View style={styles.card}>
                <Text style={styles.notesText}>{client.notes}</Text>
              </View>
            </>
          )}

          {/* Tabs for History */}
          <Text style={styles.sectionTitle}>History</Text>
          <View style={styles.tabsContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'jobs' && styles.tabActive]}
              onPress={() => setActiveTab('jobs')}
            >
              <Feather 
                name="briefcase" 
                size={14} 
                color={activeTab === 'jobs' ? colors.primaryForeground : colors.mutedForeground} 
              />
              <Text style={[styles.tabText, activeTab === 'jobs' && styles.tabTextActive]}>
                Jobs ({clientJobs.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'quotes' && styles.tabActive]}
              onPress={() => setActiveTab('quotes')}
            >
              <Feather 
                name="file-text" 
                size={14} 
                color={activeTab === 'quotes' ? colors.primaryForeground : colors.mutedForeground} 
              />
              <Text style={[styles.tabText, activeTab === 'quotes' && styles.tabTextActive]}>
                Quotes ({clientQuotes.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'invoices' && styles.tabActive]}
              onPress={() => setActiveTab('invoices')}
            >
              <Feather 
                name="file-text" 
                size={14} 
                color={activeTab === 'invoices' ? colors.primaryForeground : colors.mutedForeground} 
              />
              <Text style={[styles.tabText, activeTab === 'invoices' && styles.tabTextActive]}>
                Invoices ({clientInvoices.length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Tab Content */}
          {activeTab === 'jobs' && renderJobsList()}
          {activeTab === 'quotes' && renderQuotesList()}
          {activeTab === 'invoices' && renderInvoicesList()}
        </View>
      </ScrollView>
    </>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  errorText: {
    ...typography.body,
    color: colors.mutedForeground,
  },
  headerButton: {
    padding: spacing.sm,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  avatar: {
    width: sizes.avatarLg,
    height: sizes.avatarLg,
    borderRadius: sizes.avatarLg / 2,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  clientName: {
    ...typography.largeTitle,
    color: colors.foreground,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    ...shadows.sm,
  },
  actionButtonDisabled: {
    backgroundColor: colors.muted,
  },
  actionButtonText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  actionButtonTextDisabled: {
    color: colors.mutedForeground,
  },
  sectionTitle: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  balanceCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  balanceIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceLabel: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  balanceValue: {
    ...typography.cardTitle,
    fontWeight: '700',
  },
  balanceWarning: {
    ...typography.captionSmall,
    marginTop: 2,
  },
  balanceDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  infoText: {
    ...typography.body,
    color: colors.foreground,
    flex: 1,
  },
  noInfoText: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  statItem: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  statValue: {
    ...typography.cardTitle,
    color: colors.foreground,
    marginTop: spacing.sm,
  },
  statLabel: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  quickActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  quickActionText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.primary,
  },
  notesText: {
    ...typography.body,
    color: colors.foreground,
    lineHeight: 22,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    padding: spacing.xs,
    marginBottom: spacing.lg,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.mutedForeground,
  },
  tabTextActive: {
    color: colors.primaryForeground,
  },
  listContainer: {
    marginBottom: spacing.xl,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  listItemContent: {
    flex: 1,
  },
  listItemTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  listItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  listItemDate: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  listItemAmount: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.foreground,
  },
  listItemSubtext: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing['3xl'],
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  emptyText: {
    ...typography.body,
    color: colors.mutedForeground,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
  emptyButtonText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
});
