import { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Linking,
  Alert,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../src/lib/theme';
import { spacing, radius, shadows, typography, iconSizes } from '../../src/lib/design-tokens';
import { api } from '../../src/lib/api';

interface PayoutSummary {
  availableBalance: number;
  pendingBalance: number;
  totalPaid: number;
  lastPayoutDate?: string;
  lastPayoutAmount?: number;
  stripeConnected: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
}

interface Payout {
  id: string;
  amount: number;
  status: 'pending' | 'in_transit' | 'paid' | 'failed';
  arrivalDate: string | null;
  created: string;
  method?: string;
  destination?: string | null;
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: spacing['3xl'],
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
    ...typography.pageTitle,
    color: colors.foreground,
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  dashboardButton: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.warningLight,
    borderRadius: radius.xl,
    gap: spacing.md,
  },
  warningContent: {
    flex: 1,
  },
  warningTitle: {
    ...typography.body,
    color: colors.warning,
    fontWeight: '600',
  },
  warningText: {
    ...typography.caption,
    color: colors.warning,
  },
  connectButton: {
    backgroundColor: colors.warning,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
  },
  connectButtonText: {
    ...typography.caption,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  statIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  statValue: {
    ...typography.pageTitle,
    color: colors.foreground,
    fontSize: 24,
  },
  statTitle: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  statSubtitle: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  infoCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  infoTitle: {
    ...typography.subtitle,
    color: colors.foreground,
  },
  infoText: {
    ...typography.body,
    color: colors.mutedForeground,
    lineHeight: 22,
  },
  infoRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  infoItemText: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.foreground,
    marginBottom: spacing.md,
  },
  payoutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  payoutIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  payoutInfo: {
    flex: 1,
  },
  payoutAmount: {
    ...typography.subtitle,
    color: colors.foreground,
  },
  payoutDate: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  statusBadgeText: {
    ...typography.captionSmall,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing['3xl'],
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyStateTitle: {
    ...typography.subtitle,
    color: colors.foreground,
    marginTop: spacing.md,
  },
  emptyStateText: {
    ...typography.body,
    color: colors.mutedForeground,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  actionCard: {
    width: '48%',
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  actionTitle: {
    ...typography.body,
    color: colors.foreground,
    fontWeight: '600',
  },
  actionSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
});

export default function PayoutsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const STATUS_CONFIG = useMemo(() => ({
    pending: { label: 'Pending', color: colors.warning, icon: 'clock' },
    in_transit: { label: 'In Transit', color: colors.info, icon: 'truck' },
    paid: { label: 'Paid', color: colors.success, icon: 'check-circle' },
    failed: { label: 'Failed', color: colors.destructive, icon: 'x-circle' },
  }), [colors]);

  const [summary, setSummary] = useState<PayoutSummary | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [summaryRes, payoutsRes] = await Promise.all([
        api.get<any>('/api/stripe-connect/balance'),
        api.get<{ payouts: Payout[]; error?: string }>('/api/stripe-connect/payouts'),
      ]);
      
      if (summaryRes.data) {
        setSummary({
          availableBalance: summaryRes.data.available?.[0]?.amount || 0,
          pendingBalance: summaryRes.data.pending?.[0]?.amount || 0,
          totalPaid: 0,
          stripeConnected: true,
          chargesEnabled: true,
          payoutsEnabled: true,
        });
      }
      
      setPayouts(payoutsRes.data?.payouts || []);
    } catch (error) {
      console.log('Error fetching payouts:', error);
      setSummary({
        availableBalance: 0,
        pendingBalance: 0,
        totalPaid: 0,
        stripeConnected: false,
        chargesEnabled: false,
        payoutsEnabled: false,
      });
      setPayouts([]);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  const openStripeDashboard = async () => {
    try {
      const response = await api.get<{ url: string }>('/api/stripe-connect/dashboard');
      if (response.data?.url) {
        await Linking.openURL(response.data.url);
      }
    } catch (error) {
      Alert.alert('Error', 'Could not open Stripe dashboard');
    }
  };

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`;
  };

  const renderStatCard = ({ title, value, icon, color, subtitle }: { 
    title: string; 
    value: string; 
    icon: string; 
    color: string;
    subtitle?: string;
  }) => (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: color + '20' }]}>
        <Feather name={icon as any} size={20} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
      {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
    </View>
  );

  const renderPayoutItem = (payout: Payout) => {
    const config = STATUS_CONFIG[payout.status] || STATUS_CONFIG.pending;
    const arrivalDate = payout.arrivalDate ? new Date(payout.arrivalDate) : null;
    
    return (
      <View key={payout.id} style={styles.payoutItem}>
        <View style={[styles.payoutIcon, { backgroundColor: config.color + '20' }]}>
          <Feather name={config.icon as any} size={16} color={config.color} />
        </View>
        <View style={styles.payoutInfo}>
          <Text style={styles.payoutAmount}>
            ${payout.amount.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
          </Text>
          <Text style={styles.payoutDate}>
            {arrivalDate ? arrivalDate.toLocaleDateString('en-AU', {
              day: 'numeric',
              month: 'short',
              year: 'numeric'
            }) : 'Processing'}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: config.color + '20' }]}>
          <Text style={[styles.statusBadgeText, { color: config.color }]}>
            {config.label}
          </Text>
        </View>
      </View>
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
            <RefreshControl refreshing={isLoading} onRefresh={fetchData} tintColor={colors.primary} />
          }
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Feather name="arrow-left" size={24} color={colors.foreground} />
            </TouchableOpacity>
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>Payouts</Text>
              <Text style={styles.headerSubtitle}>Your earnings and transfers</Text>
            </View>
            <TouchableOpacity 
              style={styles.dashboardButton}
              onPress={openStripeDashboard}
            >
              <Feather name="external-link" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {!summary?.stripeConnected && (
            <View style={styles.warningBanner}>
              <Feather name="alert-triangle" size={20} color={colors.warning} />
              <View style={styles.warningContent}>
                <Text style={styles.warningTitle}>Stripe Not Connected</Text>
                <Text style={styles.warningText}>
                  Connect your Stripe account to receive payouts
                </Text>
              </View>
              <TouchableOpacity 
                style={styles.connectButton}
                onPress={() => router.push('/more/payments')}
              >
                <Text style={styles.connectButtonText}>Connect</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.statsRow}>
            {renderStatCard({
              title: 'Available',
              value: formatCurrency(summary?.availableBalance || 0),
              icon: 'dollar-sign',
              color: colors.success,
              subtitle: 'Ready for payout'
            })}
            {renderStatCard({
              title: 'Pending',
              value: formatCurrency(summary?.pendingBalance || 0),
              icon: 'clock',
              color: colors.warning,
              subtitle: 'Processing'
            })}
          </View>

          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <Feather name="info" size={20} color={colors.primary} />
              <Text style={styles.infoTitle}>Payout Schedule</Text>
            </View>
            <Text style={styles.infoText}>
              Payouts are processed automatically every 2-3 business days. 
              Funds typically arrive in your bank account within 1-2 additional business days.
            </Text>
            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Feather name="calendar" size={16} color={colors.mutedForeground} />
                <Text style={styles.infoItemText}>Daily schedule</Text>
              </View>
              <View style={styles.infoItem}>
                <Feather name="credit-card" size={16} color={colors.mutedForeground} />
                <Text style={styles.infoItemText}>2.5% + 30c fee</Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Payouts</Text>
            {payouts.length > 0 ? (
              payouts.map(renderPayoutItem)
            ) : (
              <View style={styles.emptyState}>
                <Feather name="inbox" size={48} color={colors.mutedForeground} />
                <Text style={styles.emptyStateTitle}>No Payouts Yet</Text>
                <Text style={styles.emptyStateText}>
                  When you receive payments, your payouts will appear here
                </Text>
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.actionsGrid}>
              <TouchableOpacity 
                style={styles.actionCard}
                onPress={openStripeDashboard}
              >
                <View style={[styles.actionIcon, { backgroundColor: colors.primaryLight }]}>
                  <Feather name="bar-chart-2" size={20} color={colors.primary} />
                </View>
                <Text style={styles.actionTitle}>View Analytics</Text>
                <Text style={styles.actionSubtitle}>Full reports in Stripe</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.actionCard}
                onPress={() => router.push('/more/invoices')}
              >
                <View style={[styles.actionIcon, { backgroundColor: colors.successLight }]}>
                  <Feather name="file-text" size={20} color={colors.success} />
                </View>
                <Text style={styles.actionTitle}>Invoices</Text>
                <Text style={styles.actionSubtitle}>View all invoices</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.actionCard}
                onPress={() => router.push('/more/payments')}
              >
                <View style={[styles.actionIcon, { backgroundColor: colors.infoLight }]}>
                  <Feather name="settings" size={20} color={colors.info} />
                </View>
                <Text style={styles.actionTitle}>Settings</Text>
                <Text style={styles.actionSubtitle}>Payment settings</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.actionCard}
                onPress={() => Linking.openURL('https://support.stripe.com')}
              >
                <View style={[styles.actionIcon, { backgroundColor: colors.warningLight }]}>
                  <Feather name="help-circle" size={20} color={colors.warning} />
                </View>
                <Text style={styles.actionTitle}>Help</Text>
                <Text style={styles.actionSubtitle}>Stripe support</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    </>
  );
}
