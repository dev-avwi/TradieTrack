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
  RefreshControl,
  Platform,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { useAuthStore } from '../../src/lib/store';
import { api } from '../../src/lib/api';
import { spacing, radius, shadows, typography } from '../../src/lib/design-tokens';
import {
  initIAP,
  cleanupIAP,
  fetchSubscriptions,
  purchaseSubscription,
  restorePurchases,
  setupPurchaseListeners,
  isIAPAvailable,
  IAP_PRODUCT_IDS,
  productIdToTier,
} from '../../src/lib/iap';

interface SubscriptionStatus {
  tier: 'free' | 'pro' | 'team' | 'business' | 'trial';
  status: string;
  trialEndsAt?: string | null;
  nextBillingDate?: string | null;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionSource?: 'apple' | 'stripe' | 'manual' | null;
  seats?: number;
  teamMemberCount?: number;
  totalBillableUsers?: number;
  isBeta?: boolean;
  betaUser?: boolean;
  paymentMethod?: {
    last4: string;
    brand: string;
  } | null;
}

interface UsageData {
  jobs: { used: number; limit: number | null };
  invoices: { used: number; limit: number | null };
  clients: { used: number; limit: number | null };
}

const PLAN_DETAILS: Record<string, { name: string; icon: string; color: string; features: string[] }> = {
  free: {
    name: 'Starter',
    icon: 'zap',
    color: '#6B7280',
    features: ['25 jobs/month', '25 invoices/month', '50 clients', 'Unlimited quotes'],
  },
  pro: {
    name: 'Pro',
    icon: 'award',
    color: '#2563EB',
    features: ['Unlimited jobs & invoices', 'AI-powered features', 'Custom templates', 'Email integration', 'Priority support'],
  },
  team: {
    name: 'Team',
    icon: 'users',
    color: '#7C3AED',
    features: ['Everything in Pro', 'Up to 5 workers', 'Team management', 'GPS & live tracking', 'Time tracking', 'Team chat'],
  },
  business: {
    name: 'Business',
    icon: 'briefcase',
    color: '#059669',
    features: ['Everything in Team', 'Up to 15 workers', 'Role-based permissions', 'Advanced reporting', 'Priority support'],
  },
  trial: {
    name: 'Trial',
    icon: 'clock',
    color: '#F59E0B',
    features: ['Full access to all features', 'Try before you commit'],
  },
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  planCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    borderWidth: 2,
    borderColor: colors.primary,
    ...shadows.md,
  },
  planIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  planIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planName: {
    ...typography.title,
    color: colors.foreground,
  },
  planStatus: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  planFeatures: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  planFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  planFeatureText: {
    ...typography.body,
    color: colors.mutedForeground,
  },
  infoSection: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  infoSectionTitle: {
    ...typography.subtitle,
    color: colors.foreground,
    marginBottom: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  infoLabel: {
    ...typography.body,
    color: colors.mutedForeground,
  },
  infoValue: {
    ...typography.body,
    color: colors.foreground,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  usageBar: {
    height: 6,
    backgroundColor: colors.muted,
    borderRadius: 3,
    marginTop: spacing.xs,
    overflow: 'hidden',
  },
  usageFill: {
    height: '100%',
    borderRadius: 3,
  },
  usageRow: {
    paddingVertical: spacing.sm,
  },
  usageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  manageButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  manageButtonText: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  manageDescription: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  trialBanner: {
    backgroundColor: '#FEF3C7',
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  trialBannerDark: {
    backgroundColor: '#78350F20',
  },
  trialBannerText: {
    flex: 1,
  },
  trialBannerTitle: {
    ...typography.subtitle,
    color: '#92400E',
    marginBottom: 4,
  },
  trialBannerSubtitle: {
    ...typography.caption,
    color: '#A16207',
  },
  betaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B98120',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    gap: spacing.xs,
    alignSelf: 'flex-start',
    marginBottom: spacing.md,
  },
  betaBadgeText: {
    ...typography.caption,
    color: '#10B981',
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
  },
  addOnSection: {
    marginTop: spacing.md,
  },
  addOnCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addOnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  addOnIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addOnName: {
    ...typography.subtitle,
    color: colors.foreground,
  },
  addOnPrice: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  addOnDescription: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  webNote: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    lineHeight: 18,
  },
  comparePlansSection: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  comparePlansTitle: {
    ...typography.title,
    color: colors.foreground,
    marginBottom: 4,
  },
  comparePlansSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginBottom: spacing.md,
  },
  comparePlanCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  comparePlanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  comparePlanIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  comparePlanName: {
    ...typography.body,
    fontWeight: '700',
    color: colors.foreground,
  },
  comparePlanDesc: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  comparePlanFeatures: {
    gap: spacing.sm,
  },
  comparePlanFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  comparePlanFeatureText: {
    ...typography.caption,
    color: colors.foreground,
  },
  comparePlanPrice: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: colors.foreground,
  },
  comparePlanPriceUnit: {
    fontSize: 13,
    fontWeight: '400' as const,
    color: colors.mutedForeground,
  },
  upgradePlanButton: {
    marginTop: spacing.md,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  upgradePlanButtonText: {
    color: '#FFFFFF',
    fontWeight: '600' as const,
    fontSize: 15,
  },
  restoreButton: {
    alignItems: 'center' as const,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  restoreButtonText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '500' as const,
  },
  webNoteCard: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.xl,
    gap: spacing.md,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border,
  },
  webNoteTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 4,
  },
  webNoteText: {
    ...typography.caption,
    color: colors.mutedForeground,
    lineHeight: 18,
  },
  webNoteSupport: {
    ...typography.caption,
    color: colors.primary,
    marginTop: 6,
  },
});

export default function SubscriptionPage() {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const user = useAuthStore(state => state.user);

  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [managingSubscription, setManagingSubscription] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [applePrices, setApplePrices] = useState<Record<string, string>>({});

  const fetchSubscriptionStatus = useCallback(async () => {
    try {
      const [subResponse, usageResponse] = await Promise.all([
        api.get<SubscriptionStatus>('/api/subscription/status'),
        api.get<UsageData>('/api/subscription/usage').catch(() => ({ data: null, error: null })),
      ]);

      if (subResponse.data) {
        setSubscriptionStatus(subResponse.data);
      }
      if (usageResponse.data) {
        setUsage(usageResponse.data);
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

  useEffect(() => {
    if (isIAPAvailable()) {
      initIAP().then(async () => {
        setupPurchaseListeners(
          async (purchase) => {
            const tier = productIdToTier(purchase.productId);
            if (tier && purchase.transactionReceipt) {
              try {
                await api.post('/api/subscription/verify-apple-receipt', {
                  receiptData: purchase.transactionReceipt,
                  productId: purchase.productId,
                });
                Alert.alert('Upgrade Successful', `You're now on the ${tier.charAt(0).toUpperCase() + tier.slice(1)} plan.`);
                fetchSubscriptionStatus();
              } catch (error) {
                console.error('[IAP] Failed to verify receipt:', error);
                Alert.alert('Verification Issue', 'Your purchase was successful but verification failed. Please try restoring your purchase.');
              }
            }
            setPurchasing(false);
          },
          (error) => {
            console.error('[IAP] Purchase error listener:', JSON.stringify(error, null, 2));
            const errorMsg = error?.message || error?.code || 'Unknown error';
            if (errorMsg.toLowerCase().includes('invalid') || errorMsg.includes('E_DEVELOPER_ERROR') || errorMsg.includes('E_ITEM_UNAVAILABLE')) {
              Alert.alert(
                'Not Available Yet',
                'This subscription is being finalised in the App Store. Visit jobrunner.com.au/pricing to subscribe now.',
                [
                  { text: 'OK', style: 'cancel' },
                  { text: 'Open Website', onPress: () => Linking.openURL('https://jobrunner.com.au/pricing') },
                ]
              );
            } else {
              Alert.alert('Purchase Failed', `${errorMsg}\n\nPlease try again.`);
            }
            setPurchasing(false);
          }
        );
        try {
          const subs = await fetchSubscriptions();
          const prices: Record<string, string> = {};
          subs.forEach((sub) => {
            const tier = productIdToTier(sub.productId);
            if (tier && sub.localizedPrice) {
              prices[tier] = sub.localizedPrice;
            }
          });
          if (Object.keys(prices).length > 0) {
            setApplePrices(prices);
          }
        } catch (err) {
          console.log('[IAP] Could not fetch store prices, using defaults');
        }
      });
    }
    return () => { cleanupIAP(); };
  }, []);

  const handleUpgrade = async (tier: 'pro' | 'team' | 'business') => {
    const tierNames = { pro: 'Pro', team: 'Team', business: 'Business' };
    const defaultPrices = { pro: '$49', team: '$99', business: '$199' };
    const productIds = {
      pro: IAP_PRODUCT_IDS.pro,
      team: IAP_PRODUCT_IDS.team,
      business: IAP_PRODUCT_IDS.business,
    };

    if (Platform.OS === 'ios') {
      const storePrice = applePrices[tier];
      if (!storePrice) {
        Alert.alert(
          'Coming Soon',
          `In-app subscriptions for the ${tierNames[tier]} plan are being set up. Visit jobrunner.com.au/pricing to subscribe now, or check back shortly.`,
          [
            { text: 'OK', style: 'cancel' },
            { text: 'Open Website', onPress: () => Linking.openURL('https://jobrunner.com.au/pricing') },
          ]
        );
        return;
      }
      setPurchasing(true);
      try {
        await purchaseSubscription(productIds[tier]);
      } catch (error: any) {
        console.error('[IAP] Purchase error details:', JSON.stringify(error, null, 2));
        if (error?.code !== 'E_USER_CANCELLED') {
          const errorMsg = error?.message || error?.code || 'Unknown error';
          if (errorMsg.toLowerCase().includes('invalid') || errorMsg.includes('E_DEVELOPER_ERROR')) {
            Alert.alert(
              'Not Available Yet',
              `This subscription is being finalised in the App Store. Visit jobrunner.com.au/pricing to subscribe now.`,
              [
                { text: 'OK', style: 'cancel' },
                { text: 'Open Website', onPress: () => Linking.openURL('https://jobrunner.com.au/pricing') },
              ]
            );
          } else {
            Alert.alert('Purchase Failed', `${errorMsg}\n\nPlease try again.`);
          }
        }
        setPurchasing(false);
      }
    } else if (Platform.OS === 'android') {
      const price = applePrices[tier] || defaultPrices[tier];
      Alert.alert(
        `Upgrade to ${tierNames[tier]}`,
        `${price}/month. Visit jobrunner.com.au to subscribe.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Website', onPress: () => Linking.openURL('https://jobrunner.com.au/pricing') },
        ]
      );
    }
  };

  const handleRestorePurchases = async () => {
    setRestoring(true);
    try {
      const purchases = await restorePurchases();
      if (purchases.length > 0) {
        const latestPurchase = purchases[purchases.length - 1];
        const tier = productIdToTier(latestPurchase.productId);
        if (tier) {
          await api.post('/api/subscription/restore-apple', {
            receiptData: (latestPurchase as any).transactionReceipt,
            productId: latestPurchase.productId,
          });
          Alert.alert('Purchases Restored', `Your ${tier.charAt(0).toUpperCase() + tier.slice(1)} plan has been restored.`);
          fetchSubscriptionStatus();
        }
      } else {
        Alert.alert('No Purchases Found', 'No previous subscriptions were found for this Apple ID.');
      }
    } catch (error) {
      console.error('[IAP] Restore failed:', error);
      Alert.alert('Restore Failed', 'Could not restore purchases. Please try again.');
    } finally {
      setRestoring(false);
    }
  };

  const handleManageBilling = async () => {
    const source = subscriptionStatus?.subscriptionSource;
    if (source === 'apple') {
      await Linking.openURL('https://apps.apple.com/account/subscriptions');
      return;
    }
    if (subscriptionStatus?.isBeta || subscriptionStatus?.betaUser) {
      Alert.alert(
        'Founding Member',
        'As a Founding Member, your plan is managed directly by the JobRunner team. No action needed!\n\nFor any questions, contact admin@avwebinnovation.com'
      );
      return;
    }
    if (source === 'stripe' || subscriptionStatus?.stripeSubscriptionId) {
      setManagingSubscription(true);
      try {
        const response = await api.post<{ url: string }>('/api/subscription/manage');
        if (response.data?.url) {
          await Linking.openURL(response.data.url);
        }
      } catch {
        Alert.alert('Unable to open billing', 'Please contact admin@avwebinnovation.com for billing assistance.');
      } finally {
        setManagingSubscription(false);
      }
      return;
    }
    Alert.alert('Manage Subscription', 'Contact admin@avwebinnovation.com for billing assistance.');
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const currentTier = subscriptionStatus?.tier || 'free';
  const planInfo = PLAN_DETAILS[currentTier] || PLAN_DETAILS.free;
  const hasActiveSubscription = currentTier === 'pro' || currentTier === 'team' || currentTier === 'business' || currentTier === 'trial';
  const isBeta = subscriptionStatus?.isBeta || subscriptionStatus?.betaUser;

  const getUsagePercent = (used: number, limit: number | null) => {
    if (!limit) return 0;
    return Math.min((used / limit) * 100, 100);
  };

  const getUsageColor = (percent: number) => {
    if (percent >= 90) return '#EF4444';
    if (percent >= 70) return '#F59E0B';
    return colors.primary;
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Business Plan', headerBackTitle: 'Back' }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Business Plan', headerBackTitle: 'Back' }} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {isBeta && (
          <View style={styles.betaBadge}>
            <Feather name="star" size={14} color="#10B981" />
            <Text style={styles.betaBadgeText}>Founding Member</Text>
          </View>
        )}

        {currentTier === 'trial' && subscriptionStatus?.trialEndsAt && (
          <View style={[styles.trialBanner, isDark && styles.trialBannerDark]}>
            <Feather name="clock" size={20} color="#92400E" />
            <View style={styles.trialBannerText}>
              <Text style={styles.trialBannerTitle}>Trial Active</Text>
              <Text style={styles.trialBannerSubtitle}>
                Your business trial ends {formatDate(subscriptionStatus.trialEndsAt)}.
              </Text>
            </View>
          </View>
        )}

        <View style={styles.planCard}>
          <View style={styles.planIconRow}>
            <View style={styles.planIconCircle}>
              <Feather name={planInfo.icon as any} size={22} color={colors.primary} />
            </View>
            <View>
              <Text style={styles.planName}>{planInfo.name} Plan</Text>
              <Text style={styles.planStatus}>
                {isBeta ? 'Lifetime Access' : 
                 subscriptionStatus?.cancelAtPeriodEnd ? 'Cancels at period end' : 
                 'Active'}
              </Text>
            </View>
          </View>
          <View style={styles.planFeatures}>
            {planInfo.features.map((feature, i) => (
              <View key={i} style={styles.planFeatureItem}>
                <Feather name="check" size={16} color={colors.primary} />
                <Text style={styles.planFeatureText}>{feature}</Text>
              </View>
            ))}
          </View>
        </View>

        {hasActiveSubscription && (
          <View style={styles.infoSection}>
            <Text style={styles.infoSectionTitle}>Billing Details</Text>
            {subscriptionStatus?.nextBillingDate && (
              <>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Next billing date</Text>
                  <Text style={styles.infoValue}>{formatDate(subscriptionStatus.nextBillingDate)}</Text>
                </View>
                <View style={styles.divider} />
              </>
            )}
            {subscriptionStatus?.currentPeriodEnd && (
              <>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Current period ends</Text>
                  <Text style={styles.infoValue}>{formatDate(subscriptionStatus.currentPeriodEnd)}</Text>
                </View>
                <View style={styles.divider} />
              </>
            )}
            {subscriptionStatus?.paymentMethod && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Payment method</Text>
                <Text style={styles.infoValue}>
                  {subscriptionStatus.paymentMethod.brand} ****{subscriptionStatus.paymentMethod.last4}
                </Text>
              </View>
            )}
            {currentTier === 'team' && subscriptionStatus?.teamMemberCount != null && (
              <>
                <View style={styles.divider} />
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Team members</Text>
                  <Text style={styles.infoValue}>{subscriptionStatus.teamMemberCount} seats</Text>
                </View>
              </>
            )}
          </View>
        )}

        {usage && currentTier === 'free' && (
          <View style={styles.infoSection}>
            <Text style={styles.infoSectionTitle}>Usage This Month</Text>
            {[
              { label: 'Jobs', data: usage.jobs },
              { label: 'Invoices', data: usage.invoices },
              { label: 'Clients', data: usage.clients },
            ].map((item, i) => {
              const percent = getUsagePercent(item.data.used, item.data.limit);
              const usageColor = getUsageColor(percent);
              return (
                <View key={i} style={styles.usageRow}>
                  <View style={styles.usageHeader}>
                    <Text style={styles.infoLabel}>{item.label}</Text>
                    <Text style={styles.infoValue}>
                      {item.data.used}{item.data.limit ? ` / ${item.data.limit}` : ''}
                    </Text>
                  </View>
                  {item.data.limit && (
                    <View style={styles.usageBar}>
                      <View style={[styles.usageFill, { width: `${percent}%`, backgroundColor: usageColor }]} />
                    </View>
                  )}
                  {i < 2 && <View style={[styles.divider, { marginTop: spacing.sm }]} />}
                </View>
              );
            })}
          </View>
        )}

        {hasActiveSubscription && (
          <TouchableOpacity 
            style={styles.manageButton}
            onPress={handleManageBilling}
            disabled={managingSubscription}
            activeOpacity={0.8}
          >
            {managingSubscription ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Feather name="settings" size={18} color="#FFFFFF" />
                <Text style={styles.manageButtonText}>
                  {subscriptionStatus?.subscriptionSource === 'apple' ? 'Manage in App Store' : 'Manage Billing'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {hasActiveSubscription && (
          <Text style={styles.manageDescription}>
            {subscriptionStatus?.subscriptionSource === 'apple'
              ? 'Manage, upgrade, or cancel your subscription through the App Store.'
              : 'View invoices and update payment details for your business subscription.'}
          </Text>
        )}

        {(currentTier === 'free' || currentTier === 'pro' || currentTier === 'team') && (
          <View style={styles.comparePlansSection}>
            <Text style={styles.comparePlansTitle}>
              {currentTier === 'free' ? 'Upgrade Your Plan' : 'Available Upgrades'}
            </Text>
            <Text style={styles.comparePlansSubtitle}>
              {currentTier === 'free' ? 'Unlock more features for your business' : 'Take your business to the next level'}
            </Text>

            {currentTier === 'free' && (
              <View style={[styles.comparePlanCard, { borderColor: '#2563EB', borderWidth: 2 }]}>
                <View style={styles.comparePlanHeader}>
                  <View style={[styles.comparePlanIcon, { backgroundColor: '#2563EB15' }]}>  
                    <Feather name="award" size={20} color="#2563EB" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.comparePlanName}>Pro</Text>
                    <Text style={styles.comparePlanDesc}>For solo tradies ready to grow</Text>
                  </View>
                  <Text style={styles.comparePlanPrice}>{applePrices.pro || '$49'}<Text style={styles.comparePlanPriceUnit}>/mo</Text></Text>
                </View>
                <View style={styles.comparePlanFeatures}>
                  {['Unlimited jobs & invoices', 'AI-powered features', 'Custom templates', 'Email integration', 'Priority support'].map((f, i) => (
                    <View key={i} style={styles.comparePlanFeatureRow}>
                      <Feather name="check" size={14} color="#2563EB" />
                      <Text style={styles.comparePlanFeatureText}>{f}</Text>
                    </View>
                  ))}
                </View>
                <TouchableOpacity 
                  style={[styles.upgradePlanButton, { backgroundColor: '#2563EB' }, purchasing && { opacity: 0.6 }]}
                  onPress={() => handleUpgrade('pro')}
                  activeOpacity={0.8}
                  disabled={purchasing}
                >
                  {purchasing ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.upgradePlanButtonText}>Upgrade to Pro</Text>}
                </TouchableOpacity>
              </View>
            )}

            {(currentTier === 'free' || currentTier === 'pro') && (
              <View style={[styles.comparePlanCard, currentTier === 'pro' ? { borderColor: '#7C3AED', borderWidth: 2 } : {}]}>
                <View style={styles.comparePlanHeader}>
                  <View style={[styles.comparePlanIcon, { backgroundColor: '#7C3AED15' }]}>
                    <Feather name="users" size={20} color="#7C3AED" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.comparePlanName}>Team</Text>
                    <Text style={styles.comparePlanDesc}>For businesses with workers</Text>
                  </View>
                  <Text style={styles.comparePlanPrice}>{applePrices.team || '$99'}<Text style={styles.comparePlanPriceUnit}>/mo</Text></Text>
                </View>
                <View style={styles.comparePlanFeatures}>
                  {['Everything in Pro', 'Up to 5 workers', 'GPS & live tracking', 'Time tracking & timesheets', 'Team chat'].map((f, i) => (
                    <View key={i} style={styles.comparePlanFeatureRow}>
                      <Feather name="check" size={14} color="#7C3AED" />
                      <Text style={styles.comparePlanFeatureText}>{f}</Text>
                    </View>
                  ))}
                </View>
                <TouchableOpacity 
                  style={[styles.upgradePlanButton, { backgroundColor: '#7C3AED' }, purchasing && { opacity: 0.6 }]}
                  onPress={() => handleUpgrade('team')}
                  activeOpacity={0.8}
                  disabled={purchasing}
                >
                  {purchasing ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.upgradePlanButtonText}>Upgrade to Team</Text>}
                </TouchableOpacity>
              </View>
            )}

            {(currentTier === 'free' || currentTier === 'pro' || currentTier === 'team') && (
              <View style={[styles.comparePlanCard, currentTier === 'team' ? { borderColor: '#059669', borderWidth: 2 } : {}]}>
                <View style={styles.comparePlanHeader}>
                  <View style={[styles.comparePlanIcon, { backgroundColor: '#05966915' }]}>
                    <Feather name="briefcase" size={20} color="#059669" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.comparePlanName}>Business</Text>
                    <Text style={styles.comparePlanDesc}>For larger crews</Text>
                  </View>
                  <Text style={styles.comparePlanPrice}>{applePrices.business || '$199'}<Text style={styles.comparePlanPriceUnit}>/mo</Text></Text>
                </View>
                <View style={styles.comparePlanFeatures}>
                  {['Everything in Team', 'Up to 15 workers', 'Role-based permissions', 'Advanced reporting', 'Priority support'].map((f, i) => (
                    <View key={i} style={styles.comparePlanFeatureRow}>
                      <Feather name="check" size={14} color="#059669" />
                      <Text style={styles.comparePlanFeatureText}>{f}</Text>
                    </View>
                  ))}
                </View>
                <TouchableOpacity 
                  style={[styles.upgradePlanButton, { backgroundColor: '#059669' }, purchasing && { opacity: 0.6 }]}
                  onPress={() => handleUpgrade('business')}
                  activeOpacity={0.8}
                  disabled={purchasing}
                >
                  {purchasing ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.upgradePlanButtonText}>Upgrade to Business</Text>}
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        <View style={styles.addOnSection}>
          <Text style={[styles.infoSectionTitle, { marginBottom: spacing.md }]}>Available Add-Ons</Text>
          
          <TouchableOpacity 
            style={styles.addOnCard} 
            onPress={() => router.push('/more/ai-receptionist')}
            activeOpacity={0.8}
          >
            <View style={styles.addOnHeader}>
              <View style={styles.addOnIconCircle}>
                <Feather name="phone" size={16} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.addOnName}>AI Receptionist</Text>
                <Text style={styles.addOnPrice}>{Platform.OS === 'ios' ? 'Managed Service' : '$60/mo'}</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </View>
            <Text style={styles.addOnDescription}>
              {Platform.OS === 'ios' 
                ? 'Professional AI phone answering service with a dedicated Australian number. Contact us to set up.'
                : 'AI-powered phone answering with a dedicated Australian number. Captures leads and transfers calls.'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.addOnCard} 
            onPress={() => router.push('/more/phone-numbers')}
            activeOpacity={0.8}
          >
            <View style={styles.addOnHeader}>
              <View style={styles.addOnIconCircle}>
                <Feather name="smartphone" size={16} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.addOnName}>Dedicated Number</Text>
                <Text style={styles.addOnPrice}>$10/mo</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </View>
            <Text style={styles.addOnDescription}>
              Your own Australian mobile number for sending SMS and receiving calls. A real telecommunications service.
            </Text>
          </TouchableOpacity>
        </View>

        {Platform.OS === 'ios' && (
          <TouchableOpacity
            style={styles.restoreButton}
            onPress={handleRestorePurchases}
            disabled={restoring}
            activeOpacity={0.8}
          >
            {restoring ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <Text style={styles.restoreButtonText}>Restore Purchases</Text>
            )}
          </TouchableOpacity>
        )}

        <View style={styles.webNoteCard}>
          <Feather name="message-circle" size={18} color={colors.mutedForeground} />
          <View style={{ flex: 1 }}>
            <Text style={styles.webNoteTitle}>Need Help?</Text>
            <Text style={styles.webNoteText}>
              Have questions about your business account or need support?
            </Text>
            <Text style={styles.webNoteSupport}>
              admin@avwebinnovation.com
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
