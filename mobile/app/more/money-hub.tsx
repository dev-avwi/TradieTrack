import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Alert,
  AppState,
  AppStateStatus,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { router, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, shadows, typography, iconSizes } from '../../src/lib/design-tokens';
import { isIOS } from '../../src/lib/device';
import { useIOSStyles, IOSCorners, IOSShadows } from '../../src/lib/ios-design';
import { LiquidGlassScrollView } from '../../src/components/ui/LiquidGlassScrollView';
import { api } from '../../src/lib/api';
import { format, isAfter, isBefore, subDays, differenceInDays } from 'date-fns';
import { XeroRibbon } from '../../src/components/XeroRibbon';

interface Invoice {
  id: string;
  number?: string;
  title?: string;
  clientId: string;
  total: number | string;
  status: string;
  dueDate?: string;
  paidAt?: string;
  createdAt?: string;
  xeroInvoiceId?: string;
}

interface Quote {
  id: string;
  number?: string;
  title?: string;
  clientId: string;
  total: number | string;
  status: string;
  validUntil?: string;
  createdAt?: string;
}

interface Client {
  id: string;
  name: string;
}

interface StripeConnectStatus {
  connected: boolean;
  stripeAvailable?: boolean;
  connectEnabled?: boolean;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  onboardingStatus?: string;
  message?: string;
  error?: string;
}

interface StripeBalance {
  available: number;
  pending: number;
  error?: string;
}

interface ExpenseSummary {
  totalExpenses: number;
  thisMonthExpenses: number;
  expenseCount: number;
}

interface StripePayout {
  id: string;
  amount: number;
  status: string;
  arrivalDate: string | null;
  created: string;
  method?: string;
  destination?: string | null;
}

type TabType = 'overview' | 'invoices' | 'quotes' | 'payments';
type InvoiceFilterType = 'all' | 'outstanding' | 'overdue' | 'paid' | 'draft';
type TimeRangeType = '7d' | '30d' | '90d' | 'all';

// Format currency from dollar amounts (database values and server-converted Stripe values)
const formatCurrency = (amount: number | string) => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '$0';
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
};

export default function MoneyHubScreen() {
  const { colors, isDark } = useTheme();
  const iosStyles = useIOSStyles(isDark);
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const containerStyle = isIOS 
    ? { backgroundColor: iosStyles.colors.systemGroupedBackground }
    : { backgroundColor: colors.background };
  
  const cardStyle = isIOS 
    ? {
        backgroundColor: iosStyles.colors.secondarySystemGroupedBackground,
        borderRadius: IOSCorners.card,
        borderWidth: 0,
        ...IOSShadows.card,
      }
    : {
        backgroundColor: colors.card,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        ...shadows.sm,
      };
  
  const iosHeaderStyle = isIOS 
    ? { color: iosStyles.colors.label }
    : {};
  
  const iosSectionTitleStyle = isIOS
    ? { color: iosStyles.colors.secondaryLabel, textTransform: 'uppercase' as const }
    : {};
  
  const iosAmountStyle = isIOS
    ? { color: iosStyles.colors.label }
    : {};
  
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [stripeStatus, setStripeStatus] = useState<StripeConnectStatus | null>(null);
  const [stripeBalance, setStripeBalance] = useState<StripeBalance | null>(null);
  const [stripePayouts, setStripePayouts] = useState<StripePayout[]>([]);
  const [stripeLoading, setStripeLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  
  const [invoiceFilter, setInvoiceFilter] = useState<InvoiceFilterType>('all');
  const [timeRange, setTimeRange] = useState<TimeRangeType>('30d');
  const [expenseSummary, setExpenseSummary] = useState<ExpenseSummary>({ totalExpenses: 0, thisMonthExpenses: 0, expenseCount: 0 });

  const clientMap = useMemo(() => {
    return new Map(clients.map(c => [c.id, c]));
  }, [clients]);

  const fetchStripeData = useCallback(async () => {
    try {
      const statusRes = await api.get('/api/stripe-connect/status');
      setStripeStatus(statusRes.data);
      
      if (statusRes.data?.connected && statusRes.data?.chargesEnabled) {
        const [balanceRes, payoutsRes] = await Promise.all([
          api.get('/api/stripe-connect/balance').catch(() => ({ data: null })),
          api.get('/api/stripe-connect/payouts').catch(() => ({ data: { payouts: [] } })),
        ]);
        setStripeBalance(balanceRes.data);
        setStripePayouts(payoutsRes.data?.payouts || []);
      }
    } catch (error) {
      console.error('Failed to fetch Stripe data:', error);
    } finally {
      setStripeLoading(false);
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [invoicesRes, quotesRes, clientsRes, expensesRes] = await Promise.all([
        api.get('/api/invoices'),
        api.get('/api/quotes'),
        api.get('/api/clients'),
        api.get('/api/expenses').catch(() => ({ data: [] })),
      ]);
      setInvoices(invoicesRes.data || []);
      setQuotes(quotesRes.data || []);
      setClients(clientsRes.data || []);
      
      const expenses = expensesRes.data || [];
      const now = new Date();
      const thisMonth = now.getMonth();
      const thisYear = now.getFullYear();
      const totalExpenses = expenses.reduce((sum: number, e: any) => sum + (parseFloat(e.amount) || 0), 0);
      const thisMonthExpenses = expenses
        .filter((e: any) => {
          const d = new Date(e.expenseDate);
          return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
        })
        .reduce((sum: number, e: any) => sum + (parseFloat(e.amount) || 0), 0);
      setExpenseSummary({
        totalExpenses,
        thisMonthExpenses,
        expenseCount: expenses.length,
      });
    } catch (error) {
      console.error('Failed to fetch money hub data:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  const appState = useRef(AppState.currentState);
  const wasConnecting = useRef(false);

  useEffect(() => {
    fetchData();
    fetchStripeData();
  }, [fetchData, fetchStripeData]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) && 
        nextAppState === 'active' && 
        wasConnecting.current
      ) {
        console.log('App has come to the foreground after Stripe connect - refreshing status');
        setStripeLoading(true);
        fetchStripeData();
        wasConnecting.current = false;
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [fetchStripeData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
    fetchStripeData();
  }, [fetchData, fetchStripeData]);

  const handleConnectStripe = useCallback(async () => {
    setIsConnecting(true);
    try {
      const response = await api.post('/api/stripe-connect/onboard');
      const url = response.data?.onboardingUrl || response.data?.url;
      
      if (url) {
        wasConnecting.current = true;
        try {
          await WebBrowser.openBrowserAsync(url);
          setStripeLoading(true);
          fetchStripeData();
        } catch (browserError) {
          console.log('WebBrowser failed, trying Linking:', browserError);
          const canOpen = await Linking.canOpenURL(url);
          if (canOpen) {
            await Linking.openURL(url);
          } else {
            Alert.alert('Error', 'Unable to open Stripe onboarding. Please check your browser settings.');
            wasConnecting.current = false;
          }
        }
      } else if (response.data?.error) {
        Alert.alert('Error', response.data.error);
      } else {
        Alert.alert('Error', 'Could not start Stripe onboarding. Please try again.');
      }
    } catch (error: any) {
      console.error('Failed to connect Stripe:', error);
      const errorMessage = error?.response?.data?.error || error?.message || 'Failed to connect Stripe. Please try again.';
      Alert.alert('Error', errorMessage);
      wasConnecting.current = false;
    } finally {
      setIsConnecting(false);
    }
  }, [fetchStripeData]);

  const handleOpenStripeDashboard = useCallback(async () => {
    try {
      const response = await api.get('/api/stripe-connect/dashboard');
      const url = response.data?.url;
      
      if (url) {
        if (response.data?.isOnboarding) {
          wasConnecting.current = true;
        }
        
        try {
          await WebBrowser.openBrowserAsync(url);
          if (response.data?.isOnboarding) {
            setStripeLoading(true);
            fetchStripeData();
          }
        } catch (browserError) {
          console.log('WebBrowser failed, trying Linking:', browserError);
          const canOpen = await Linking.canOpenURL(url);
          if (canOpen) {
            await Linking.openURL(url);
          } else {
            Alert.alert('Error', 'Unable to open Stripe dashboard. Please check your browser settings.');
          }
        }
      } else if (response.data?.error) {
        Alert.alert('Error', response.data.error);
      } else {
        Alert.alert('Error', 'Could not open Stripe dashboard. Please try again.');
      }
    } catch (error: any) {
      console.error('Failed to open Stripe dashboard:', error);
      const errorMessage = error?.response?.data?.error || error?.message || 'Failed to open Stripe dashboard. Please try again.';
      Alert.alert('Error', errorMessage);
    }
  }, [fetchStripeData]);

  const stats = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = subDays(now, 30);
    
    // Helper to safely parse total (handles string or number)
    const parseTotal = (total: number | string | undefined): number => {
      if (total === undefined || total === null) return 0;
      const num = typeof total === 'string' ? parseFloat(total) : total;
      return isNaN(num) ? 0 : num;
    };

    const outstanding = invoices.filter(
      inv => inv.status !== 'paid' && inv.status !== 'draft'
    );
    const outstandingTotal = outstanding.reduce((sum, inv) => sum + parseTotal(inv.total), 0);

    const overdue = outstanding.filter(
      inv => inv.dueDate && isBefore(new Date(inv.dueDate), now)
    );
    const overdueTotal = overdue.reduce((sum, inv) => sum + parseTotal(inv.total), 0);

    const paid = invoices.filter(inv => inv.status === 'paid');
    const paidTotal = paid.reduce((sum, inv) => sum + parseTotal(inv.total), 0);

    const recentPaid = paid.filter(
      inv => inv.paidAt && isAfter(new Date(inv.paidAt), thirtyDaysAgo)
    );
    const recentPaidTotal = recentPaid.reduce((sum, inv) => sum + parseTotal(inv.total), 0);

    const pendingQuotes = quotes.filter(q => q.status === 'sent' || q.status === 'viewed');
    const pendingQuotesTotal = pendingQuotes.reduce((sum, q) => sum + parseTotal(q.total), 0);

    return {
      outstandingTotal,
      outstandingCount: outstanding.length,
      overdueTotal,
      overdueCount: overdue.length,
      recentPaidTotal,
      recentPaidCount: recentPaid.length,
      pendingQuotesTotal,
      pendingQuotesCount: pendingQuotes.length,
    };
  }, [invoices, quotes]);

  const renderQuickActions = () => (
    <View style={styles.quickActionsContainer}>
      <Text style={[styles.quickActionsTitle, isIOS && iosSectionTitleStyle]}>Quick Actions</Text>
      <View style={styles.quickActionsGrid}>
        <TouchableOpacity 
          style={[styles.quickActionCard, isIOS && cardStyle]}
          onPress={() => router.push('/more/invoice/new')}
          activeOpacity={0.7}
        >
          <View style={[styles.quickActionIcon, { backgroundColor: `${colors.primary}15` }]}>
            <Feather name="file-plus" size={iconSizes.lg} color={colors.primary} />
          </View>
          <Text style={styles.quickActionLabel}>Create Invoice</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.quickActionCard, isIOS && cardStyle]}
          onPress={() => router.push('/more/quote/new')}
          activeOpacity={0.7}
        >
          <View style={[styles.quickActionIcon, { backgroundColor: `${colors.scheduled}15` }]}>
            <Feather name="file-text" size={iconSizes.lg} color={colors.scheduled} />
          </View>
          <Text style={styles.quickActionLabel}>Create Quote</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.quickActionCard, isIOS && cardStyle]}
          onPress={() => router.push('/more/collect-payment')}
          activeOpacity={0.7}
        >
          <View style={[styles.quickActionIcon, { backgroundColor: `${colors.success}15` }]}>
            <Feather name="credit-card" size={iconSizes.lg} color={colors.success} />
          </View>
          <Text style={styles.quickActionLabel}>Collect Payment</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderKPICard = (
    title: string, 
    value: string, 
    subtitle: string, 
    iconName: keyof typeof Feather.glyphMap, 
    iconColor: string,
    variant: 'default' | 'success' | 'warning' | 'danger' = 'default'
  ) => {
    const variantStyles = {
      default: { bg: colors.card, border: colors.cardBorder },
      success: { bg: `${colors.success}15`, border: `${colors.success}30` },
      warning: { bg: `${colors.warning}15`, border: `${colors.warning}30` },
      danger: { bg: `${colors.destructive}15`, border: `${colors.destructive}30` },
    };
    const style = variantStyles[variant];
    
    const kpiCardStyle = isIOS 
      ? {
          ...cardStyle,
          backgroundColor: variant === 'default' 
            ? iosStyles.colors.secondarySystemGroupedBackground 
            : style.bg,
        }
      : { backgroundColor: style.bg, borderColor: style.border };

    return (
      <View style={[styles.kpiCard, kpiCardStyle]}>
        <View style={styles.kpiHeader}>
          <Text style={[styles.kpiTitle, isIOS && { color: iosStyles.colors.secondaryLabel }]}>{title}</Text>
          <View style={[styles.kpiIcon, { backgroundColor: `${iconColor}15` }]}>
            <Feather name={iconName} size={iconSizes.md} color={iconColor} />
          </View>
        </View>
        <Text style={[styles.kpiValue, isIOS && { color: iosStyles.colors.label }]}>{value}</Text>
        <Text style={[styles.kpiSubtitle, isIOS && { color: iosStyles.colors.secondaryLabel }]}>{subtitle}</Text>
      </View>
    );
  };

  const renderStripeConnectCard = () => {
    if (stripeLoading) {
      return (
        <View style={[styles.stripeCard, isIOS && cardStyle]}>
          <View style={styles.stripeCardHeader}>
            <View style={[styles.stripeLoadingIcon, { backgroundColor: colors.muted }]} />
            <View style={{ flex: 1, gap: spacing.xs }}>
              <View style={{ width: 80, height: 14, backgroundColor: colors.muted, borderRadius: radius.sm }} />
              <View style={{ width: 120, height: 18, backgroundColor: colors.muted, borderRadius: radius.sm }} />
            </View>
          </View>
        </View>
      );
    }

    const isConnected = stripeStatus?.connected && stripeStatus?.chargesEnabled;
    const needsSetup = stripeStatus?.connected && !stripeStatus?.chargesEnabled;
    const availableBalance = stripeBalance?.available || 0;
    const pendingBalance = stripeBalance?.pending || 0;

    return (
      <View style={[
        styles.stripeCard,
        isIOS && cardStyle,
        isConnected && styles.stripeCardConnected,
        needsSetup && styles.stripeCardWarning,
      ]}>
        <View style={styles.stripeCardHeader}>
          <View style={[
            styles.stripeIconWrapper,
            { backgroundColor: isConnected ? `${colors.success}15` : needsSetup ? `${colors.warning}15` : colors.muted }
          ]}>
            <Feather 
              name={isConnected ? 'credit-card' : needsSetup ? 'alert-circle' : 'link-2'} 
              size={iconSizes.lg} 
              color={isConnected ? colors.success : needsSetup ? colors.warning : colors.mutedForeground} 
            />
          </View>
          <View style={styles.stripeCardContent}>
            <View style={styles.stripeCardTitleRow}>
              <Text style={styles.stripeCardTitle}>Stripe Connect</Text>
              <View style={[
                styles.stripeCardBadge,
                { backgroundColor: isConnected ? `${colors.success}20` : needsSetup ? `${colors.warning}20` : `${colors.mutedForeground}20` }
              ]}>
                <Text style={[
                  styles.stripeCardBadgeText,
                  { color: isConnected ? colors.success : needsSetup ? colors.warning : colors.mutedForeground }
                ]}>
                  {isConnected ? 'Connected' : needsSetup ? 'Setup Required' : 'Not Connected'}
                </Text>
              </View>
            </View>
            {isConnected ? (
              <View style={styles.balanceRow}>
                <View style={styles.balanceItem}>
                  <Text style={styles.balanceLabel}>Available</Text>
                  <Text style={[styles.balanceValue, { color: colors.success }]}>
                    ${availableBalance.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>
                <View style={styles.balanceItem}>
                  <Text style={styles.balanceLabel}>Pending</Text>
                  <Text style={styles.balanceValueMuted}>
                    ${pendingBalance.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>
              </View>
            ) : needsSetup ? (
              <Text style={styles.stripeCardDescription}>
                Complete your Stripe account setup to start accepting payments
              </Text>
            ) : (
              <Text style={styles.stripeCardDescription}>
                Connect your Stripe account to accept online payments
              </Text>
            )}
          </View>
        </View>
        <View style={styles.stripeCardActions}>
          {isConnected ? (
            <TouchableOpacity 
              style={styles.stripeButton}
              onPress={handleOpenStripeDashboard}
              activeOpacity={0.7}
            >
              <Feather name="external-link" size={iconSizes.sm} color={colors.primary} />
              <Text style={styles.stripeButtonText}>Dashboard</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={[styles.stripeButton, styles.stripeButtonPrimary]}
              onPress={handleConnectStripe}
              activeOpacity={0.7}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <>
                  <Feather name="link-2" size={iconSizes.sm} color={colors.primaryForeground} />
                  <Text style={styles.stripeButtonTextPrimary}>
                    {needsSetup ? 'Complete Setup' : 'Connect Stripe'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderInvoiceRow = (invoice: Invoice) => {
    const client = clientMap.get(invoice.clientId);
    const isOverdue = invoice.dueDate && isBefore(new Date(invoice.dueDate), new Date()) && invoice.status !== 'paid';
    const daysOverdue = invoice.dueDate ? Math.abs(differenceInDays(new Date(), new Date(invoice.dueDate))) : 0;

    const statusColors: Record<string, string> = {
      draft: colors.warning,
      sent: colors.info,
      viewed: colors.info,
      partial: colors.warning,
      paid: colors.success,
      overdue: colors.destructive,
    };
    const status = isOverdue ? 'overdue' : invoice.status;
    const statusColor = statusColors[status] || colors.mutedForeground;

    return (
      <View key={invoice.id} style={{ position: 'relative', overflow: 'hidden', borderRadius: radius.md }}>
        {invoice.xeroInvoiceId && <XeroRibbon size="small" />}
        <TouchableOpacity 
          style={styles.documentRow}
          onPress={() => router.push(`/more/invoice/${invoice.id}`)}
          activeOpacity={0.7}
        >
          <View style={[styles.documentIcon, { backgroundColor: `${colors.primary}15` }]}>
            <Feather name="file-text" size={iconSizes.md} color={colors.primary} />
          </View>
          <View style={styles.documentInfo}>
            <View style={styles.documentTitleRow}>
              <Text style={styles.documentTitle} numberOfLines={1}>
                #{invoice.number || invoice.id.slice(0, 8)}
              </Text>
              <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
                <Text style={[styles.statusText, { color: statusColor }]}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </Text>
              </View>
            </View>
            <Text style={styles.documentSubtitle} numberOfLines={1}>
              {client?.name || 'Unknown Client'}
            </Text>
          </View>
          <View style={styles.documentRight}>
            <Text style={styles.documentAmount}>{formatCurrency(invoice.total)}</Text>
            {invoice.dueDate && (
              <Text style={[styles.documentDue, isOverdue && { color: colors.destructive }]}>
                {isOverdue ? `${daysOverdue}d overdue` : `Due ${format(new Date(invoice.dueDate), 'dd MMM')}`}
              </Text>
            )}
          </View>
          <Feather name="chevron-right" size={iconSizes.md} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>
    );
  };

  const renderQuoteRow = (quote: Quote) => {
    const client = clientMap.get(quote.clientId);
    const statusColors: Record<string, string> = {
      draft: colors.warning,
      sent: colors.info,
      viewed: colors.info,
      accepted: colors.success,
      declined: colors.destructive,
      expired: colors.mutedForeground,
    };
    const statusColor = statusColors[quote.status] || colors.mutedForeground;

    return (
      <TouchableOpacity 
        key={quote.id}
        style={styles.documentRow}
        onPress={() => router.push(`/more/quote/${quote.id}`)}
        activeOpacity={0.7}
      >
        <View style={[styles.documentIcon, { backgroundColor: `${colors.scheduled}15` }]}>
          <Feather name="file" size={iconSizes.md} color={colors.scheduled} />
        </View>
        <View style={styles.documentInfo}>
          <View style={styles.documentTitleRow}>
            <Text style={styles.documentTitle} numberOfLines={1}>
              #{quote.number || quote.id.slice(0, 8)}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>
                {quote.status.charAt(0).toUpperCase() + quote.status.slice(1)}
              </Text>
            </View>
          </View>
          <Text style={styles.documentSubtitle} numberOfLines={1}>
            {client?.name || 'Unknown Client'}
          </Text>
        </View>
        <View style={styles.documentRight}>
          <Text style={styles.documentAmount}>{formatCurrency(quote.total)}</Text>
          {quote.validUntil && (
            <Text style={styles.documentDue}>
              Valid until {format(new Date(quote.validUntil), 'dd MMM')}
            </Text>
          )}
        </View>
        <Feather name="chevron-right" size={iconSizes.md} color={colors.mutedForeground} />
      </TouchableOpacity>
    );
  };

  const renderTab = (tab: TabType, label: string, count?: number) => {
    const isActive = activeTab === tab;
    return (
      <TouchableOpacity
        style={[styles.tab, isActive && styles.tabActive]}
        onPress={() => setActiveTab(tab)}
        activeOpacity={0.7}
      >
        <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{label}</Text>
        {count !== undefined && count > 0 && (
          <View style={[styles.tabBadge, isActive && styles.tabBadgeActive]}>
            <Text style={[styles.tabBadgeText, isActive && styles.tabBadgeTextActive]}>
              {count}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderOverview = () => (
    <View style={styles.overviewContainer}>
      <View style={styles.sectionHeader}>
        <Feather name="alert-triangle" size={iconSizes.md} color={colors.destructive} />
        <Text style={[styles.sectionTitle, isIOS && { color: iosStyles.colors.label }]}>Needs Attention</Text>
      </View>
      <View style={[styles.sectionContent, isIOS && cardStyle]}>
        {invoices
          .filter(inv => inv.status !== 'paid' && inv.status !== 'draft')
          .slice(0, 5)
          .map(renderInvoiceRow)}
        {invoices.filter(inv => inv.status !== 'paid' && inv.status !== 'draft').length === 0 && (
          <View style={styles.emptyState}>
            <Feather name="check-circle" size={32} color={colors.success} />
            <Text style={[styles.emptyText, isIOS && { color: iosStyles.colors.label }]}>All caught up!</Text>
            <Text style={[styles.emptySubtext, isIOS && { color: iosStyles.colors.secondaryLabel }]}>No outstanding invoices</Text>
          </View>
        )}
      </View>

      <View style={styles.sectionHeader}>
        <Feather name="file" size={iconSizes.md} color={colors.scheduled} />
        <Text style={[styles.sectionTitle, isIOS && { color: iosStyles.colors.label }]}>Pending Quotes</Text>
      </View>
      <View style={[styles.sectionContent, isIOS && cardStyle]}>
        {quotes
          .filter(q => q.status === 'sent' || q.status === 'viewed')
          .slice(0, 5)
          .map(renderQuoteRow)}
        {quotes.filter(q => q.status === 'sent' || q.status === 'viewed').length === 0 && (
          <View style={styles.emptyState}>
            <Feather name="file-text" size={32} color={isIOS ? iosStyles.colors.tertiaryLabel : colors.mutedForeground} />
            <Text style={[styles.emptyText, isIOS && { color: iosStyles.colors.label }]}>No pending quotes</Text>
          </View>
        )}
      </View>

      <View style={styles.sectionHeader}>
        <Feather name="trending-up" size={iconSizes.md} color={colors.success} />
        <Text style={[styles.sectionTitle, isIOS && { color: iosStyles.colors.label }]}>Recent Payments</Text>
      </View>
      <View style={[styles.sectionContent, isIOS && cardStyle]}>
        {invoices
          .filter(inv => inv.status === 'paid')
          .sort((a, b) => new Date(b.paidAt || 0).getTime() - new Date(a.paidAt || 0).getTime())
          .slice(0, 5)
          .map(renderInvoiceRow)}
        {invoices.filter(inv => inv.status === 'paid').length === 0 && (
          <View style={styles.emptyState}>
            <Feather name="dollar-sign" size={32} color={isIOS ? iosStyles.colors.tertiaryLabel : colors.mutedForeground} />
            <Text style={[styles.emptyText, isIOS && { color: iosStyles.colors.label }]}>No payments yet</Text>
          </View>
        )}
      </View>

      <View style={styles.sectionHeader}>
        <Feather name="credit-card" size={iconSizes.md} color={colors.destructive} />
        <Text style={[styles.sectionTitle, isIOS && { color: iosStyles.colors.label }]}>Expenses Summary</Text>
      </View>
      <View style={[styles.sectionContent, isIOS && cardStyle]}>
        <TouchableOpacity 
          style={[styles.expenseSummaryCard, isIOS && { borderWidth: 0, backgroundColor: 'transparent' }]}
          onPress={() => router.push('/more/expense-tracking')}
          activeOpacity={0.7}
        >
          <View style={styles.expenseSummaryRow}>
            <View>
              <Text style={[styles.expenseSummaryLabel, isIOS && { color: iosStyles.colors.secondaryLabel }]}>This Month</Text>
              <Text style={[styles.expenseSummaryValue, isIOS && { color: iosStyles.colors.label }]}>{formatCurrency(expenseSummary.thisMonthExpenses)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.expenseSummaryLabel, isIOS && { color: iosStyles.colors.secondaryLabel }]}>All Time</Text>
              <Text style={[styles.expenseSummaryValue, isIOS && { color: iosStyles.colors.label }]}>{formatCurrency(expenseSummary.totalExpenses)}</Text>
            </View>
          </View>
          <View style={[styles.expenseSummaryFooter, isIOS && { borderTopColor: iosStyles.colors.separator }]}>
            <Text style={[styles.expenseSummaryCount, isIOS && { color: iosStyles.colors.secondaryLabel }]}>{expenseSummary.expenseCount} expenses recorded</Text>
            <Feather name="chevron-right" size={16} color={isIOS ? iosStyles.colors.tertiaryLabel : colors.mutedForeground} />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );

  const filteredInvoices = useMemo(() => {
    let filtered = [...invoices];
    const now = new Date();
    
    if (invoiceFilter === 'outstanding') {
      filtered = filtered.filter(inv => inv.status !== 'paid' && inv.status !== 'draft');
    } else if (invoiceFilter === 'overdue') {
      filtered = filtered.filter(inv => 
        inv.dueDate && 
        isBefore(new Date(inv.dueDate), now) && 
        inv.status !== 'paid'
      );
    } else if (invoiceFilter === 'paid') {
      filtered = filtered.filter(inv => inv.status === 'paid');
    } else if (invoiceFilter === 'draft') {
      filtered = filtered.filter(inv => inv.status === 'draft');
    }

    return filtered.sort((a, b) => {
      if (a.status === 'draft' && b.status !== 'draft') return -1;
      if (a.status !== 'draft' && b.status === 'draft') return 1;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }, [invoices, invoiceFilter]);

  const filteredPayouts = useMemo(() => {
    const now = new Date();
    return stripePayouts.filter(payout => {
      const createdDate = new Date(payout.created);
      if (timeRange === '7d') return isAfter(createdDate, subDays(now, 7));
      if (timeRange === '30d') return isAfter(createdDate, subDays(now, 30));
      if (timeRange === '90d') return isAfter(createdDate, subDays(now, 90));
      return true;
    });
  }, [stripePayouts, timeRange]);

  const filteredPaidInvoices = useMemo(() => {
    const now = new Date();
    return invoices
      .filter(inv => inv.status === 'paid')
      .filter(inv => {
        if (!inv.paidAt) return true;
        const paidDate = new Date(inv.paidAt);
        if (timeRange === '7d') return isAfter(paidDate, subDays(now, 7));
        if (timeRange === '30d') return isAfter(paidDate, subDays(now, 30));
        if (timeRange === '90d') return isAfter(paidDate, subDays(now, 90));
        return true;
      })
      .sort((a, b) => new Date(b.paidAt || 0).getTime() - new Date(a.paidAt || 0).getTime());
  }, [invoices, timeRange]);

  const renderFilterChip = (
    label: string, 
    value: string, 
    currentValue: string, 
    onPress: (value: string) => void
  ) => {
    const isActive = currentValue === value;
    return (
      <TouchableOpacity
        key={value}
        style={[styles.filterChip, isActive && styles.filterChipActive]}
        onPress={() => onPress(value)}
        activeOpacity={0.7}
      >
        <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderPayoutRow = (payout: StripePayout) => {
    const statusColors: Record<string, string> = {
      paid: colors.success,
      pending: colors.warning,
      in_transit: colors.scheduled,
      canceled: colors.destructive,
      failed: colors.destructive,
    };
    const statusLabels: Record<string, string> = {
      paid: 'Completed',
      pending: 'Pending',
      in_transit: 'In Transit',
      canceled: 'Cancelled',
      failed: 'Failed',
    };
    const statusColor = statusColors[payout.status] || colors.mutedForeground;
    const statusLabel = statusLabels[payout.status] || payout.status;

    const formatPayoutDate = (dateStr: string | null) => {
      if (!dateStr) return 'Unknown date';
      try {
        return format(new Date(dateStr), 'dd MMM yyyy');
      } catch {
        return 'Unknown date';
      }
    };

    return (
      <View key={payout.id} style={styles.payoutRow}>
        <View style={[styles.payoutIcon, { backgroundColor: `${colors.success}15` }]}>
          <Feather name="dollar-sign" size={iconSizes.md} color={colors.success} />
        </View>
        <View style={styles.payoutInfo}>
          <View style={styles.documentTitleRow}>
            <Text style={styles.documentTitle}>Bank Transfer</Text>
            <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>
                {statusLabel}
              </Text>
            </View>
          </View>
          <Text style={styles.documentSubtitle}>
            {payout.destination ? `To account ${payout.destination}` : `Payout ${payout.id.slice(-8)}`}
          </Text>
        </View>
        <View style={styles.documentRight}>
          <Text style={styles.payoutAmount}>
            +${payout.amount.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
          <Text style={styles.documentDue}>
            {payout.status === 'paid' 
              ? `Arrived ${formatPayoutDate(payout.arrivalDate)}`
              : `Expected ${formatPayoutDate(payout.arrivalDate)}`
            }
          </Text>
        </View>
      </View>
    );
  };

  const renderInvoices = () => (
    <View style={[styles.listContainer, isIOS && cardStyle]}>
      <View style={[styles.filterRow, isIOS && { borderBottomColor: iosStyles.colors.separator }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {renderFilterChip('All', 'all', invoiceFilter, setInvoiceFilter)}
          {renderFilterChip('Outstanding', 'outstanding', invoiceFilter, setInvoiceFilter)}
          {renderFilterChip('Overdue', 'overdue', invoiceFilter, setInvoiceFilter)}
          {renderFilterChip('Paid', 'paid', invoiceFilter, setInvoiceFilter)}
          {renderFilterChip('Drafts', 'draft', invoiceFilter, setInvoiceFilter)}
        </ScrollView>
      </View>
      <View style={styles.sectionContent}>
        {filteredInvoices.map(renderInvoiceRow)}
        {filteredInvoices.length === 0 && (
          <View style={styles.emptyState}>
            <Feather name="file-text" size={48} color={isIOS ? iosStyles.colors.tertiaryLabel : colors.mutedForeground} />
            <Text style={[styles.emptyText, isIOS && { color: iosStyles.colors.label }]}>No invoices found</Text>
            {invoiceFilter === 'all' && (
              <TouchableOpacity 
                style={[styles.createButton, isIOS && { borderRadius: IOSCorners.button }]}
                onPress={() => router.push('/more/invoice/new')}
              >
                <Text style={styles.createButtonText}>Create Invoice</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </View>
  );

  const renderQuotes = () => (
    <View style={[styles.listContainer, isIOS && cardStyle]}>
      {quotes
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .map(renderQuoteRow)}
      {quotes.length === 0 && (
        <View style={styles.emptyState}>
          <Feather name="file" size={48} color={isIOS ? iosStyles.colors.tertiaryLabel : colors.mutedForeground} />
          <Text style={[styles.emptyText, isIOS && { color: iosStyles.colors.label }]}>No quotes yet</Text>
          <TouchableOpacity 
            style={[styles.createButton, isIOS && { borderRadius: IOSCorners.button }]}
            onPress={() => router.push('/more/quote/new')}
          >
            <Text style={styles.createButtonText}>Create Quote</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderPayments = () => (
    <View style={[styles.listContainer, isIOS && { borderWidth: 0, backgroundColor: 'transparent' }]}>
      <View style={[styles.filterRow, isIOS && { borderBottomColor: iosStyles.colors.separator }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {renderFilterChip('7d', '7d', timeRange, setTimeRange)}
          {renderFilterChip('30d', '30d', timeRange, setTimeRange)}
          {renderFilterChip('90d', '90d', timeRange, setTimeRange)}
          {renderFilterChip('All', 'all', timeRange, setTimeRange)}
        </ScrollView>
      </View>

      {stripeStatus?.connected && stripeStatus?.chargesEnabled && (
        <View style={styles.payoutsSection}>
          <View style={styles.sectionHeader}>
            <Feather name="dollar-sign" size={iconSizes.md} color={colors.success} />
            <Text style={[styles.sectionTitle, isIOS && { color: iosStyles.colors.label }]}>Bank Payouts</Text>
          </View>
          <View style={[styles.sectionContent, isIOS && cardStyle]}>
            {filteredPayouts.length > 0 ? (
              filteredPayouts.map(renderPayoutRow)
            ) : (
              <View style={styles.emptyState}>
                <Feather name="inbox" size={32} color={isIOS ? iosStyles.colors.tertiaryLabel : colors.mutedForeground} />
                <Text style={[styles.emptyText, isIOS && { color: iosStyles.colors.label }]}>No payouts in this period</Text>
              </View>
            )}
          </View>
        </View>
      )}

      <View style={styles.sectionHeader}>
        <Feather name="check-circle" size={iconSizes.md} color={colors.success} />
        <Text style={[styles.sectionTitle, isIOS && { color: iosStyles.colors.label }]}>Paid Invoices</Text>
      </View>
      <View style={[styles.sectionContent, isIOS && cardStyle]}>
        {filteredPaidInvoices.map(renderInvoiceRow)}
        {filteredPaidInvoices.length === 0 && (
          <View style={styles.emptyState}>
            <Feather name="credit-card" size={48} color={isIOS ? iosStyles.colors.tertiaryLabel : colors.mutedForeground} />
            <Text style={[styles.emptyText, isIOS && { color: iosStyles.colors.label }]}>No payments in this period</Text>
          </View>
        )}
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, isIOS && containerStyle]}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={[styles.header, isIOS && { backgroundColor: iosStyles.colors.secondarySystemGroupedBackground, borderBottomColor: iosStyles.colors.separator }]}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={24} color={isIOS ? iosStyles.colors.label : colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={[styles.headerTitle, isIOS && { color: iosStyles.colors.label }]}>Money Hub</Text>
          <Text style={[styles.headerSubtitle, isIOS && { color: iosStyles.colors.secondaryLabel }]}>Invoices, quotes & payments</Text>
        </View>
      </View>

      <LiquidGlassScrollView
        style={[styles.scrollView, isIOS && containerStyle]}
        contentContainerStyle={styles.scrollContent}
        hasTabBar={true}
        hasHeader={true}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {renderStripeConnectCard()}
        
        {renderQuickActions()}
        
        <View style={styles.kpiGrid}>
          {renderKPICard(
            'Outstanding',
            formatCurrency(stats.outstandingTotal),
            `${stats.outstandingCount} invoices`,
            'clock',
            colors.warning,
            stats.outstandingCount > 0 ? 'warning' : 'default'
          )}
          {renderKPICard(
            'Overdue',
            formatCurrency(stats.overdueTotal),
            `${stats.overdueCount} invoices`,
            'alert-triangle',
            colors.destructive,
            stats.overdueCount > 0 ? 'danger' : 'default'
          )}
          {renderKPICard(
            'Paid (30d)',
            formatCurrency(stats.recentPaidTotal),
            `${stats.recentPaidCount} invoices`,
            'check-circle',
            colors.success,
            'success'
          )}
          {renderKPICard(
            'Pending Quotes',
            formatCurrency(stats.pendingQuotesTotal),
            `${stats.pendingQuotesCount} awaiting`,
            'file',
            colors.scheduled,
            'default'
          )}
        </View>

        <View style={styles.tabsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {renderTab('overview', 'Overview')}
            {renderTab('invoices', 'Invoices', stats.outstandingCount)}
            {renderTab('quotes', 'Quotes', stats.pendingQuotesCount)}
            {renderTab('payments', 'Payments')}
          </ScrollView>
        </View>

        <View style={styles.tabContent}>
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'invoices' && renderInvoices()}
          {activeTab === 'quotes' && renderQuotes()}
          {activeTab === 'payments' && renderPayments()}
        </View>
      </LiquidGlassScrollView>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.mutedForeground,
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing['3xl'],
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    marginRight: spacing.md,
    padding: spacing.xs,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.foreground,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  quickActionsContainer: {
    marginBottom: spacing.lg,
  },
  quickActionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.foreground,
    textAlign: 'center',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  kpiCard: {
    width: '48%',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    ...shadows.sm,
  },
  kpiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  kpiTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.mutedForeground,
  },
  kpiIcon: {
    padding: spacing.xs,
    borderRadius: radius.md,
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.foreground,
    marginBottom: 2,
  },
  kpiSubtitle: {
    fontSize: 11,
    color: colors.mutedForeground,
  },
  tabsContainer: {
    marginBottom: spacing.md,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.muted,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.mutedForeground,
  },
  tabTextActive: {
    color: colors.primaryForeground,
  },
  tabBadge: {
    marginLeft: spacing.xs,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: colors.mutedForeground,
  },
  tabBadgeActive: {
    backgroundColor: colors.primaryForeground,
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.background,
  },
  tabBadgeTextActive: {
    color: colors.primary,
  },
  tabContent: {
    minHeight: 200,
  },
  overviewContainer: {
    gap: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  sectionContent: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
    ...shadows.sm,
  },
  listContainer: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
    ...shadows.sm,
  },
  documentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  documentIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  documentInfo: {
    flex: 1,
    minWidth: 0,
  },
  documentTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 2,
  },
  documentTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
  },
  statusBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  documentSubtitle: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  documentRight: {
    alignItems: 'flex-end',
  },
  documentAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
  },
  documentDue: {
    fontSize: 11,
    color: colors.mutedForeground,
  },
  emptyState: {
    padding: spacing['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.foreground,
    marginTop: spacing.md,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  createButton: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
  },
  createButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  expenseSummaryCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  expenseSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  expenseSummaryLabel: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginBottom: spacing.xs,
  },
  expenseSummaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
  },
  expenseSummaryFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  expenseSummaryCount: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  stripeCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  stripeCardConnected: {
    borderColor: `${colors.success}40`,
  },
  stripeCardWarning: {
    borderColor: `${colors.warning}40`,
  },
  stripeCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  stripeIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stripeLoadingIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
  },
  stripeCardContent: {
    flex: 1,
  },
  stripeCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  stripeCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  stripeCardBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  stripeCardBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  stripeCardDescription: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.lg,
    marginTop: spacing.xs,
  },
  balanceItem: {
    gap: 2,
  },
  balanceLabel: {
    fontSize: 11,
    color: colors.mutedForeground,
  },
  balanceValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  balanceValueMuted: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.mutedForeground,
  },
  stripeCardActions: {
    marginTop: spacing.md,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  stripeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  stripeButtonPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stripeButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.primary,
  },
  stripeButtonTextPrimary: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.primaryForeground,
  },
  filterRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginRight: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.mutedForeground,
  },
  filterChipTextActive: {
    color: colors.primaryForeground,
  },
  payoutsSection: {
    marginBottom: spacing.lg,
  },
  payoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  payoutIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payoutInfo: {
    flex: 1,
    minWidth: 0,
  },
  payoutAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.success,
  },
});
