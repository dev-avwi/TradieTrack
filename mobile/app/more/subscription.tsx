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
import { Stack, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { useAuthStore } from '../../src/lib/store';
import { api } from '../../src/lib/api';
import { spacing, radius, shadows, typography } from '../../src/lib/design-tokens';

interface SubscriptionStatus {
  tier: 'free' | 'pro' | 'team' | 'trial';
  status: string;
  trialEndsAt?: string | null;
  nextBillingDate?: string | null;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
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
    name: 'Free',
    icon: 'zap',
    color: '#6B7280',
    features: ['25 jobs/month', '25 invoices/month', '50 clients', 'Unlimited quotes'],
  },
  pro: {
    name: 'Pro',
    icon: 'award',
    color: '#2563EB',
    features: ['Unlimited jobs', 'Unlimited invoices', 'AI features', 'Custom templates', 'Email integration'],
  },
  team: {
    name: 'Team',
    icon: 'users',
    color: '#2563EB',
    features: ['Everything in Pro', 'Team management', 'GPS tracking', 'Time tracking', 'Team chat', 'Role-based permissions'],
  },
  trial: {
    name: 'Trial',
    icon: 'clock',
    color: '#F59E0B',
    features: ['Full access to all features', 'Try before you commit'],
  },
};

const WEB_BILLING_URL = 'https://jobrunner.com.au/settings?tab=billing';

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
  secondaryButton: {
    backgroundColor: colors.muted,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  secondaryButtonText: {
    ...typography.body,
    color: colors.foreground,
    fontWeight: '600',
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
    flex: 1,
  },
  addOnPrice: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  addOnDescription: {
    ...typography.caption,
    color: colors.mutedForeground,
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

  const handleManageBilling = async () => {
    setManagingSubscription(true);
    try {
      const response = await api.post<{ url: string }>('/api/subscription/manage');
      if (response.data?.url) {
        await Linking.openURL(response.data.url);
      } else {
        await Linking.openURL(WEB_BILLING_URL);
      }
    } catch {
      await Linking.openURL(WEB_BILLING_URL);
    } finally {
      setManagingSubscription(false);
    }
  };

  const handleUpgradeOnWeb = async () => {
    await Linking.openURL(WEB_BILLING_URL);
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
  const hasActiveSubscription = currentTier === 'pro' || currentTier === 'team' || currentTier === 'trial';
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
        <Stack.Screen options={{ title: 'Subscription', headerBackTitle: 'Back' }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Subscription', headerBackTitle: 'Back' }} />
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
              <Text style={styles.trialBannerTitle}>Free Trial Active</Text>
              <Text style={styles.trialBannerSubtitle}>
                Ends {formatDate(subscriptionStatus.trialEndsAt)}. Upgrade on the web to keep your features.
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
                <Feather name="external-link" size={18} color="#FFFFFF" />
                <Text style={styles.manageButtonText}>Manage Billing</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {!hasActiveSubscription && !isBeta && (
          <>
            <TouchableOpacity 
              style={styles.manageButton}
              onPress={handleUpgradeOnWeb}
              activeOpacity={0.8}
            >
              <Feather name="external-link" size={18} color="#FFFFFF" />
              <Text style={styles.manageButtonText}>Manage Plan on Web</Text>
            </TouchableOpacity>
            <Text style={styles.manageDescription}>
              Manage your subscription, change plans, and update billing details on the web.
            </Text>
          </>
        )}

        {hasActiveSubscription && (
          <Text style={styles.manageDescription}>
            Change plans, update payment details, and view invoices on the web.
          </Text>
        )}

        <View style={styles.addOnSection}>
          <Text style={[styles.infoSectionTitle, { marginBottom: spacing.md }]}>Power Add-Ons</Text>
          
          <View style={styles.addOnCard}>
            <View style={styles.addOnHeader}>
              <View style={styles.addOnIconCircle}>
                <Feather name="phone" size={16} color={colors.primary} />
              </View>
              <Text style={styles.addOnName}>AI Receptionist</Text>
            </View>
            <Text style={styles.addOnDescription}>
              AI-powered phone answering with a dedicated Australian number. Captures leads and transfers calls to your team.
            </Text>
          </View>

          <View style={styles.addOnCard}>
            <View style={styles.addOnHeader}>
              <View style={styles.addOnIconCircle}>
                <Feather name="smartphone" size={16} color={colors.primary} />
              </View>
              <Text style={styles.addOnName}>Dedicated Number</Text>
            </View>
            <Text style={styles.addOnDescription}>
              Your own Australian mobile number for sending SMS. Clients see your number, not JobRunner's.
            </Text>
          </View>

          <TouchableOpacity 
            style={styles.secondaryButton}
            onPress={handleUpgradeOnWeb}
            activeOpacity={0.8}
          >
            <Feather name="external-link" size={16} color={colors.foreground} />
            <Text style={styles.secondaryButtonText}>Manage Add-Ons on Web</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
