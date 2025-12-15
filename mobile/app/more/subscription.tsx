import { useMemo, useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  StyleSheet, 
  TouchableOpacity,
  Linking,
  ActivityIndicator,
  Alert,
  RefreshControl
} from 'react-native';
import { Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { useAuthStore } from '../../src/lib/store';
import { api } from '../../src/lib/api';
import { spacing, radius, shadows, typography } from '../../src/lib/design-tokens';

interface FeatureItem {
  name: string;
  free: boolean;
  pro: boolean;
  icon: keyof typeof Feather.glyphMap;
}

interface SubscriptionStatus {
  tier: 'free' | 'pro' | 'trial';
  status: 'active' | 'past_due' | 'canceled' | 'none';
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

interface CheckoutResponse {
  success: boolean;
  sessionUrl?: string;
  sessionId?: string;
  error?: string;
  publishableKey?: string;
}

const PRO_PRICE = 39;
const BETA_MODE = true;

const FEATURES: FeatureItem[] = [
  { name: 'Job Management', free: true, pro: true, icon: 'briefcase' },
  { name: 'Client CRM', free: true, pro: true, icon: 'users' },
  { name: 'Quotes & Invoices', free: true, pro: true, icon: 'file-text' },
  { name: 'Basic Reports', free: true, pro: true, icon: 'bar-chart-2' },
  { name: 'GST Calculation', free: true, pro: true, icon: 'percent' },
  { name: '5 Jobs/Month', free: true, pro: false, icon: 'layers' },
  { name: 'Unlimited Jobs', free: false, pro: true, icon: 'layers' },
  { name: 'Custom Branding', free: false, pro: true, icon: 'droplet' },
  { name: 'AI Assistant', free: false, pro: true, icon: 'zap' },
  { name: 'PDF Export', free: false, pro: true, icon: 'download' },
  { name: 'Email Integration', free: false, pro: true, icon: 'mail' },
  { name: 'Team Members', free: false, pro: true, icon: 'user-plus' },
  { name: 'Priority Support', free: false, pro: true, icon: 'headphones' },
  { name: 'Map View', free: false, pro: true, icon: 'map' },
  { name: 'Time Tracking', free: false, pro: true, icon: 'clock' },
];

const PRO_FEATURES_LOST = [
  'Unlimited Jobs',
  'Custom Branding',
  'AI Assistant',
  'PDF Export',
  'Email Integration',
  'Team Members',
  'Priority Support',
  'Map View',
  'Time Tracking',
];

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  headerTitle: {
    ...typography.pageTitle,
    color: colors.foreground,
    textAlign: 'center',
  },
  headerSubtitle: {
    ...typography.body,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  currentPlanCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderWidth: 2,
    borderColor: colors.primary,
    ...shadows.sm,
  },
  currentPlanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  currentPlanBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  currentPlanIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentPlanInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  currentPlanLabel: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  currentPlanName: {
    ...typography.subtitle,
    color: colors.foreground,
  },
  statusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  statusBadgeActive: {
    backgroundColor: colors.successLight,
  },
  statusBadgePastDue: {
    backgroundColor: colors.warningLight,
  },
  statusBadgeCanceled: {
    backgroundColor: colors.destructiveLight,
  },
  statusBadgeText: {
    ...typography.label,
    fontWeight: '600',
  },
  statusBadgeTextActive: {
    color: colors.success,
  },
  statusBadgeTextPastDue: {
    color: colors.warning,
  },
  statusBadgeTextCanceled: {
    color: colors.destructive,
  },
  billingInfo: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    marginTop: spacing.md,
  },
  billingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  billingLabel: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  billingValue: {
    ...typography.caption,
    color: colors.foreground,
    fontWeight: '500',
  },
  cancelWarning: {
    backgroundColor: colors.warningLight,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cancelWarningText: {
    ...typography.caption,
    color: colors.warning,
    flex: 1,
  },
  betaBanner: {
    backgroundColor: colors.successLight,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.success,
  },
  betaBadge: {
    backgroundColor: colors.success,
    paddingVertical: 4,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    marginBottom: spacing.sm,
  },
  betaBadgeText: {
    color: colors.primaryForeground,
    fontWeight: '700',
    fontSize: 12,
  },
  betaTitle: {
    ...typography.subtitle,
    color: colors.success,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  betaText: {
    ...typography.caption,
    color: colors.foreground,
    textAlign: 'center',
  },
  plansRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  planCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 2,
    ...shadows.sm,
  },
  planCardFree: {
    borderColor: colors.border,
  },
  planCardPro: {
    borderColor: colors.primary,
  },
  planCardCurrent: {
    borderColor: colors.success,
  },
  planBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    marginBottom: spacing.md,
  },
  planBadgeFree: {
    backgroundColor: colors.muted,
  },
  planBadgePro: {
    backgroundColor: colors.primaryLight,
  },
  planBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  planBadgeTextFree: {
    color: colors.mutedForeground,
  },
  planBadgeTextPro: {
    color: colors.primary,
  },
  planName: {
    ...typography.subtitle,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  planPrice: {
    ...typography.pageTitle,
    color: colors.primary,
  },
  planPeriod: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  currentPlanIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  currentPlanIndicatorText: {
    ...typography.caption,
    color: colors.success,
    fontWeight: '600',
  },
  featuresCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.sm,
  },
  featuresHeader: {
    flexDirection: 'row',
    padding: spacing.md,
    backgroundColor: colors.muted,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  featuresHeaderCell: {
    flex: 1,
  },
  featuresHeaderText: {
    ...typography.label,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  featureRowLast: {
    borderBottomWidth: 0,
  },
  featureNameCell: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  featureName: {
    ...typography.body,
    color: colors.foreground,
  },
  featureCheckCell: {
    flex: 1,
    alignItems: 'center',
  },
  checkIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkIconEnabled: {
    backgroundColor: colors.successLight,
  },
  checkIconDisabled: {
    backgroundColor: colors.muted,
  },
  ctaButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.lg,
    borderRadius: radius.xl,
    alignItems: 'center',
    marginTop: spacing.xl,
    ...shadows.md,
  },
  ctaButtonDisabled: {
    backgroundColor: colors.muted,
  },
  ctaButtonText: {
    color: colors.primaryForeground,
    fontWeight: '700',
    fontSize: 16,
  },
  ctaSubtext: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  secondaryButton: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    borderRadius: radius.xl,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  secondaryButtonText: {
    color: colors.foreground,
    fontWeight: '600',
    fontSize: 14,
  },
  dangerButton: {
    backgroundColor: colors.destructiveLight,
    borderWidth: 1,
    borderColor: colors.destructive,
    paddingVertical: spacing.md,
    borderRadius: radius.xl,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  dangerButtonText: {
    color: colors.destructive,
    fontWeight: '600',
    fontSize: 14,
  },
  infoSection: {
    marginTop: spacing.xl,
    paddingTop: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  infoTitle: {
    ...typography.subtitle,
    color: colors.foreground,
    marginBottom: spacing.md,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: {
    flex: 1,
    ...typography.caption,
    color: colors.mutedForeground,
    lineHeight: 20,
  },
});

export default function SubscriptionScreen() {
  const { colors } = useTheme();
  const { user, businessSettings } = useAuthStore();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);

  const fetchSubscriptionStatus = useCallback(async () => {
    try {
      const response = await api.get<SubscriptionStatus>('/api/billing/status');
      if (response.data) {
        setSubscriptionStatus(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch subscription status:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSubscriptionStatus();
  }, [fetchSubscriptionStatus]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchSubscriptionStatus();
  }, [fetchSubscriptionStatus]);

  const handleUpgrade = async () => {
    if (BETA_MODE) {
      Alert.alert(
        'Beta Mode',
        'All Pro features are currently free during beta! No payment required.',
        [{ text: 'OK' }]
      );
      return;
    }

    setUpgrading(true);
    try {
      const response = await api.post<CheckoutResponse>('/api/billing/checkout', {
        priceId: 'pro_monthly',
        successUrl: 'tradietrack://subscription?success=true',
        cancelUrl: 'tradietrack://subscription?canceled=true',
      });

      if (response.data?.success && response.data?.sessionUrl) {
        const canOpen = await Linking.canOpenURL(response.data.sessionUrl);
        if (canOpen) {
          await Linking.openURL(response.data.sessionUrl);
        } else {
          Alert.alert('Error', 'Unable to open payment page. Please try again.');
        }
      } else {
        Alert.alert(
          'Error',
          response.data?.error || response.error || 'Failed to create checkout session'
        );
      }
    } catch (error) {
      console.error('Upgrade error:', error);
      Alert.alert('Error', 'Failed to start upgrade process. Please try again.');
    } finally {
      setUpgrading(false);
    }
  };

  const handleCancelSubscription = () => {
    Alert.alert(
      'Cancel Subscription',
      `Are you sure you want to cancel your Pro subscription?\n\nYou'll lose access to:\n• ${PRO_FEATURES_LOST.slice(0, 5).join('\n• ')}\n• ...and more\n\nYour subscription will remain active until the end of your billing period.`,
      [
        { text: 'Keep Subscription', style: 'cancel' },
        {
          text: 'Cancel Subscription',
          style: 'destructive',
          onPress: confirmCancelSubscription,
        },
      ]
    );
  };

  const confirmCancelSubscription = async () => {
    setCanceling(true);
    try {
      const response = await api.post<{ success: boolean; error?: string }>('/api/billing/cancel');
      if (response.data?.success) {
        Alert.alert(
          'Subscription Canceled',
          'Your subscription has been canceled. You will retain access to Pro features until the end of your current billing period.',
          [{ text: 'OK', onPress: fetchSubscriptionStatus }]
        );
      } else {
        Alert.alert('Error', response.data?.error || response.error || 'Failed to cancel subscription');
      }
    } catch (error) {
      console.error('Cancel error:', error);
      Alert.alert('Error', 'Failed to cancel subscription. Please try again.');
    } finally {
      setCanceling(false);
    }
  };

  const handleResumeSubscription = async () => {
    setCanceling(true);
    try {
      const response = await api.post<{ success: boolean; error?: string }>('/api/billing/resume');
      if (response.data?.success) {
        Alert.alert(
          'Subscription Resumed',
          'Your subscription has been resumed. You will continue to be billed at the regular rate.',
          [{ text: 'OK', onPress: fetchSubscriptionStatus }]
        );
      } else {
        Alert.alert('Error', response.data?.error || response.error || 'Failed to resume subscription');
      }
    } catch (error) {
      console.error('Resume error:', error);
      Alert.alert('Error', 'Failed to resume subscription. Please try again.');
    } finally {
      setCanceling(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-AU', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
  };

  const currentTier = BETA_MODE ? 'pro' : (subscriptionStatus?.tier || 'free');
  const isProUser = currentTier === 'pro' || currentTier === 'trial';
  const isCanceledButActive = subscriptionStatus?.cancelAtPeriodEnd && subscriptionStatus?.status === 'active';

  const getStatusBadgeStyle = () => {
    if (subscriptionStatus?.status === 'past_due') {
      return { container: styles.statusBadgePastDue, text: styles.statusBadgeTextPastDue };
    }
    if (subscriptionStatus?.cancelAtPeriodEnd) {
      return { container: styles.statusBadgeCanceled, text: styles.statusBadgeTextCanceled };
    }
    return { container: styles.statusBadgeActive, text: styles.statusBadgeTextActive };
  };

  const getStatusText = () => {
    if (BETA_MODE) return 'BETA';
    if (subscriptionStatus?.status === 'past_due') return 'PAST DUE';
    if (subscriptionStatus?.cancelAtPeriodEnd) return 'CANCELING';
    if (subscriptionStatus?.tier === 'trial') return 'TRIAL';
    if (subscriptionStatus?.status === 'active') return 'ACTIVE';
    return 'FREE';
  };

  return (
    <>
      <Stack.Screen 
        options={{ 
          title: 'Subscription',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.foreground,
        }} 
      />
      <ScrollView 
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Feather name="star" size={28} color={colors.primary} />
            </View>
            <Text style={styles.headerTitle}>Your Plan</Text>
            <Text style={styles.headerSubtitle}>
              Choose the plan that works for your business
            </Text>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.headerSubtitle, { marginTop: spacing.md }]}>
                Loading subscription details...
              </Text>
            </View>
          ) : (
            <>
              {BETA_MODE && (
                <View style={styles.betaBanner}>
                  <View style={styles.betaBadge}>
                    <Text style={styles.betaBadgeText}>BETA</Text>
                  </View>
                  <Text style={styles.betaTitle}>Free During Beta!</Text>
                  <Text style={styles.betaText}>
                    All Pro features are unlocked while we're in beta. Enjoy full access!
                  </Text>
                </View>
              )}

              {isProUser && !BETA_MODE && (
                <View style={styles.currentPlanCard}>
                  <View style={styles.currentPlanHeader}>
                    <View style={styles.currentPlanBadge}>
                      <View style={styles.currentPlanIcon}>
                        <Feather name="award" size={20} color={colors.primary} />
                      </View>
                      <View style={styles.currentPlanInfo}>
                        <Text style={styles.currentPlanLabel}>CURRENT PLAN</Text>
                        <Text style={styles.currentPlanName}>
                          {currentTier === 'trial' ? 'Pro Trial' : 'Professional'}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.statusBadge, getStatusBadgeStyle().container]}>
                      <Text style={[styles.statusBadgeText, getStatusBadgeStyle().text]}>
                        {getStatusText()}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.billingInfo}>
                    <View style={styles.billingRow}>
                      <Text style={styles.billingLabel}>Monthly Price</Text>
                      <Text style={styles.billingValue}>${PRO_PRICE} AUD</Text>
                    </View>
                    {subscriptionStatus?.currentPeriodEnd && (
                      <View style={styles.billingRow}>
                        <Text style={styles.billingLabel}>
                          {isCanceledButActive ? 'Access Until' : 'Next Billing Date'}
                        </Text>
                        <Text style={styles.billingValue}>
                          {formatDate(subscriptionStatus.currentPeriodEnd)}
                        </Text>
                      </View>
                    )}
                  </View>

                  {isCanceledButActive && (
                    <View style={styles.cancelWarning}>
                      <Feather name="alert-circle" size={16} color={colors.warning} />
                      <Text style={styles.cancelWarningText}>
                        Your subscription will end on {formatDate(subscriptionStatus?.currentPeriodEnd)}. 
                        Resume to continue access.
                      </Text>
                    </View>
                  )}
                </View>
              )}

              <View style={styles.plansRow}>
                <View style={[
                  styles.planCard, 
                  styles.planCardFree,
                  !isProUser && styles.planCardCurrent
                ]}>
                  <View style={[styles.planBadge, styles.planBadgeFree]}>
                    <Text style={[styles.planBadgeText, styles.planBadgeTextFree]}>FREE</Text>
                  </View>
                  <Text style={styles.planName}>Starter</Text>
                  <Text style={[styles.planPrice, { color: colors.mutedForeground }]}>$0</Text>
                  <Text style={styles.planPeriod}>forever</Text>
                  {!isProUser && !BETA_MODE && (
                    <View style={styles.currentPlanIndicator}>
                      <Feather name="check-circle" size={14} color={colors.success} />
                      <Text style={styles.currentPlanIndicatorText}>Current Plan</Text>
                    </View>
                  )}
                </View>

                <View style={[
                  styles.planCard, 
                  styles.planCardPro,
                  isProUser && styles.planCardCurrent
                ]}>
                  <View style={[styles.planBadge, styles.planBadgePro]}>
                    <Text style={[styles.planBadgeText, styles.planBadgeTextPro]}>PRO</Text>
                  </View>
                  <Text style={styles.planName}>Professional</Text>
                  <Text style={styles.planPrice}>${PRO_PRICE}</Text>
                  <Text style={styles.planPeriod}>/month</Text>
                  {(isProUser || BETA_MODE) && (
                    <View style={styles.currentPlanIndicator}>
                      <Feather name="check-circle" size={14} color={colors.success} />
                      <Text style={styles.currentPlanIndicatorText}>
                        {BETA_MODE ? 'Beta Access' : 'Current Plan'}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.featuresCard}>
                <View style={styles.featuresHeader}>
                  <View style={[styles.featuresHeaderCell, { flex: 2 }]}>
                    <Text style={[styles.featuresHeaderText, { textAlign: 'left' }]}>Feature</Text>
                  </View>
                  <View style={styles.featuresHeaderCell}>
                    <Text style={styles.featuresHeaderText}>Free</Text>
                  </View>
                  <View style={styles.featuresHeaderCell}>
                    <Text style={styles.featuresHeaderText}>Pro</Text>
                  </View>
                </View>

                {FEATURES.map((feature, index) => (
                  <View 
                    key={feature.name} 
                    style={[
                      styles.featureRow,
                      index === FEATURES.length - 1 && styles.featureRowLast
                    ]}
                  >
                    <View style={styles.featureNameCell}>
                      <Feather name={feature.icon} size={16} color={colors.mutedForeground} />
                      <Text style={styles.featureName}>{feature.name}</Text>
                    </View>
                    <View style={styles.featureCheckCell}>
                      <View style={[
                        styles.checkIcon,
                        feature.free ? styles.checkIconEnabled : styles.checkIconDisabled
                      ]}>
                        <Feather 
                          name={feature.free ? 'check' : 'x'} 
                          size={14} 
                          color={feature.free ? colors.success : colors.mutedForeground} 
                        />
                      </View>
                    </View>
                    <View style={styles.featureCheckCell}>
                      <View style={[
                        styles.checkIcon,
                        feature.pro ? styles.checkIconEnabled : styles.checkIconDisabled
                      ]}>
                        <Feather 
                          name={feature.pro ? 'check' : 'x'} 
                          size={14} 
                          color={feature.pro ? colors.success : colors.mutedForeground} 
                        />
                      </View>
                    </View>
                  </View>
                ))}
              </View>

              {!isProUser && !BETA_MODE && (
                <>
                  <TouchableOpacity 
                    style={[styles.ctaButton, upgrading && styles.ctaButtonDisabled]}
                    onPress={handleUpgrade}
                    activeOpacity={0.8}
                    disabled={upgrading}
                  >
                    {upgrading ? (
                      <ActivityIndicator color={colors.primaryForeground} />
                    ) : (
                      <Text style={styles.ctaButtonText}>Upgrade to Pro</Text>
                    )}
                  </TouchableOpacity>
                  <Text style={styles.ctaSubtext}>
                    Cancel anytime. 14-day money-back guarantee.
                  </Text>
                </>
              )}

              {BETA_MODE && (
                <>
                  <TouchableOpacity 
                    style={styles.ctaButton}
                    onPress={handleUpgrade}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.ctaButtonText}>Enjoying Beta Access</Text>
                  </TouchableOpacity>
                  <Text style={styles.ctaSubtext}>
                    All Pro features are free during beta. We'll notify you before billing begins.
                  </Text>
                </>
              )}

              {isProUser && !BETA_MODE && (
                <>
                  {isCanceledButActive ? (
                    <TouchableOpacity 
                      style={[styles.ctaButton, canceling && styles.ctaButtonDisabled]}
                      onPress={handleResumeSubscription}
                      activeOpacity={0.8}
                      disabled={canceling}
                    >
                      {canceling ? (
                        <ActivityIndicator color={colors.primaryForeground} />
                      ) : (
                        <Text style={styles.ctaButtonText}>Resume Subscription</Text>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity 
                      style={[styles.dangerButton, canceling && styles.ctaButtonDisabled]}
                      onPress={handleCancelSubscription}
                      activeOpacity={0.8}
                      disabled={canceling}
                    >
                      {canceling ? (
                        <ActivityIndicator color={colors.destructive} />
                      ) : (
                        <Text style={styles.dangerButtonText}>Cancel Subscription</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </>
              )}

              <View style={styles.infoSection}>
                <Text style={styles.infoTitle}>Why Pro?</Text>
                
                <View style={styles.infoItem}>
                  <View style={styles.infoIcon}>
                    <Feather name="zap" size={16} color={colors.primary} />
                  </View>
                  <Text style={styles.infoText}>
                    Unlimited jobs and clients. Grow your business without limits.
                  </Text>
                </View>
                
                <View style={styles.infoItem}>
                  <View style={styles.infoIcon}>
                    <Feather name="droplet" size={16} color={colors.primary} />
                  </View>
                  <Text style={styles.infoText}>
                    Custom branding on all quotes and invoices. Look professional.
                  </Text>
                </View>
                
                <View style={styles.infoItem}>
                  <View style={styles.infoIcon}>
                    <Feather name="users" size={16} color={colors.primary} />
                  </View>
                  <Text style={styles.infoText}>
                    Add team members with role-based access control.
                  </Text>
                </View>

                <View style={styles.infoItem}>
                  <View style={styles.infoIcon}>
                    <Feather name="shield" size={16} color={colors.primary} />
                  </View>
                  <Text style={styles.infoText}>
                    Secure payments powered by Stripe. Cancel anytime with no hassle.
                  </Text>
                </View>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </>
  );
}
