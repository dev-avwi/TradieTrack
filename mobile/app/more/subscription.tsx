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
  paymentMethod?: {
    last4: string;
    brand: string;
  } | null;
}

interface CheckoutResponse {
  url?: string;
  sessionUrl?: string;
  sessionId?: string;
  error?: string;
  publishableKey?: string;
}

interface TierFeature {
  text: string;
  included: boolean;
}

interface Tier {
  id: 'free' | 'pro' | 'team';
  name: string;
  price: number;
  seatPrice?: number;
  description: string;
  features: TierFeature[];
  cta: string;
  popular: boolean;
}

const tiers: Tier[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    description: 'For solo tradies just getting started',
    features: [
      { text: '3 active jobs', included: true },
      { text: '3 invoices per month', included: true },
      { text: 'Basic quotes', included: true },
      { text: 'Client management', included: true },
      { text: 'Unlimited jobs', included: false },
      { text: 'AI-powered features', included: false },
      { text: 'Team management', included: false },
      { text: 'Priority support', included: false },
    ],
    cta: 'Current Plan',
    popular: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 39,
    description: 'For growing trade businesses',
    features: [
      { text: 'Unlimited jobs', included: true },
      { text: 'Unlimited quotes & invoices', included: true },
      { text: 'AI quote generator', included: true },
      { text: 'AI photo analysis', included: true },
      { text: 'Custom templates', included: true },
      { text: 'Email integration', included: true },
      { text: 'Team management', included: false },
      { text: 'Team seats', included: false },
    ],
    cta: 'Start 14-Day Free Trial',
    popular: true,
  },
  {
    id: 'team',
    name: 'Team',
    price: 59,
    seatPrice: 29,
    description: 'For businesses with employees',
    features: [
      { text: 'Everything in Pro', included: true },
      { text: 'Team management', included: true },
      { text: 'Role-based permissions', included: true },
      { text: 'Staff scheduling', included: true },
      { text: 'Time tracking', included: true },
      { text: 'GPS job tracking', included: true },
      { text: 'Team chat', included: true },
      { text: 'Priority support', included: true },
    ],
    cta: 'Start 14-Day Free Trial',
    popular: false,
  },
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
  heroSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    paddingVertical: spacing.lg,
  },
  trialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  trialBadgeText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  heroTitle: {
    ...typography.pageTitle,
    color: colors.foreground,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  heroSubtitle: {
    ...typography.body,
    color: colors.mutedForeground,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  trustBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.lg,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  trustBadgeText: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
  },
  loadingText: {
    ...typography.body,
    color: colors.mutedForeground,
    marginTop: spacing.md,
  },
  currentPlanCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: `${colors.primary}30`,
  },
  currentPlanContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  currentPlanInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  currentPlanIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.xl,
    backgroundColor: `${colors.primary}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentPlanDetails: {
    flex: 1,
  },
  currentPlanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 2,
  },
  currentPlanName: {
    ...typography.subtitle,
    color: colors.foreground,
    textTransform: 'capitalize',
  },
  currentPlanBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  trialBadgeStyle: {
    backgroundColor: 'transparent',
    borderColor: colors.warning,
  },
  cancelingBadgeStyle: {
    backgroundColor: 'transparent',
    borderColor: colors.destructive,
  },
  currentPlanBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  trialBadgeTextStyle: {
    color: colors.warning,
  },
  cancelingBadgeTextStyle: {
    color: colors.destructive,
  },
  currentPlanSubtext: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  manageButtonText: {
    ...typography.caption,
    color: colors.foreground,
    fontWeight: '500',
  },
  tierCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 2,
    ...shadows.sm,
  },
  tierCardDefault: {
    borderColor: colors.border,
  },
  tierCardPopular: {
    borderColor: colors.primary,
  },
  tierCardCurrent: {
    borderColor: colors.success,
  },
  popularBadge: {
    position: 'absolute',
    top: -12,
    left: '50%',
    transform: [{ translateX: -50 }],
    backgroundColor: colors.primary,
    paddingVertical: 4,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
  },
  popularBadgeText: {
    ...typography.caption,
    color: colors.primaryForeground,
    fontWeight: '700',
    fontSize: 11,
  },
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  tierIconContainer: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tierIconFree: {
    backgroundColor: colors.muted,
  },
  tierIconPro: {
    backgroundColor: colors.primaryLight,
  },
  tierIconTeam: {
    backgroundColor: colors.primaryLight,
  },
  tierName: {
    ...typography.subtitle,
    color: colors.foreground,
  },
  tierDescription: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginBottom: spacing.md,
  },
  tierPricing: {
    marginBottom: spacing.lg,
  },
  tierPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  tierPrice: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.foreground,
  },
  tierPeriod: {
    ...typography.body,
    color: colors.mutedForeground,
  },
  tierSeatPrice: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  seatSelector: {
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  seatSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  seatSelectorLabel: {
    ...typography.body,
    color: colors.foreground,
    fontWeight: '500',
  },
  seatControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  seatButton: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seatButtonDisabled: {
    opacity: 0.5,
  },
  seatCount: {
    ...typography.subtitle,
    color: colors.foreground,
    minWidth: 32,
    textAlign: 'center',
  },
  seatTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  seatTotalLabel: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  seatTotalPrice: {
    ...typography.body,
    color: colors.foreground,
    fontWeight: '600',
  },
  ctaButton: {
    paddingVertical: spacing.md,
    borderRadius: radius.xl,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  ctaButtonPrimary: {
    backgroundColor: colors.primary,
  },
  ctaButtonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  ctaButtonDisabled: {
    opacity: 0.5,
  },
  ctaButtonText: {
    fontWeight: '600',
    fontSize: 15,
  },
  ctaButtonTextPrimary: {
    color: colors.primaryForeground,
  },
  ctaButtonTextOutline: {
    color: colors.foreground,
  },
  ctaSubtext: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  featureList: {
    gap: spacing.sm,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  featureIconContainer: {
    marginTop: 2,
  },
  featureText: {
    ...typography.body,
    color: colors.foreground,
    flex: 1,
  },
  featureTextDisabled: {
    color: `${colors.mutedForeground}80`,
  },
  trialInfoCard: {
    backgroundColor: colors.muted,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  trialInfoTitle: {
    ...typography.subtitle,
    color: colors.foreground,
    marginBottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  trialSteps: {
    gap: spacing.lg,
  },
  trialStep: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  trialStepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trialStepNumberText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '700',
  },
  trialStepContent: {
    flex: 1,
  },
  trialStepTitle: {
    ...typography.body,
    color: colors.foreground,
    fontWeight: '600',
    marginBottom: 2,
  },
  trialStepText: {
    ...typography.caption,
    color: colors.mutedForeground,
    lineHeight: 18,
  },
  cardRequiredNote: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.lg,
    flexDirection: 'row',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardRequiredContent: {
    flex: 1,
  },
  cardRequiredTitle: {
    ...typography.body,
    color: colors.foreground,
    fontWeight: '600',
    marginBottom: 2,
  },
  cardRequiredText: {
    ...typography.caption,
    color: colors.mutedForeground,
    lineHeight: 18,
  },
  supportSection: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  supportText: {
    ...typography.body,
    color: colors.mutedForeground,
  },
  supportLink: {
    color: colors.primary,
  },
});

export default function SubscriptionScreen() {
  const { colors } = useTheme();
  const { user } = useAuthStore();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [managingSubscription, setManagingSubscription] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [teamSeats, setTeamSeats] = useState(2);

  const fetchSubscriptionStatus = useCallback(async () => {
    try {
      const response = await api.get<SubscriptionStatus>('/api/subscription/status');
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

  const handleStartTrial = async (tierId: string) => {
    setCheckoutLoading(tierId);
    try {
      const response = await api.post<CheckoutResponse>('/api/subscription/create-checkout', {
        tier: tierId,
        seats: tierId === 'team' ? teamSeats : undefined,
      });

      const checkoutUrl = response.data?.url || response.data?.sessionUrl;
      
      if (checkoutUrl) {
        const canOpen = await Linking.canOpenURL(checkoutUrl);
        if (canOpen) {
          await Linking.openURL(checkoutUrl);
        } else {
          Alert.alert('Error', 'Unable to open payment page. Please try again.');
        }
      } else {
        Alert.alert(
          'Error',
          response.data?.error || response.error || 'Failed to create checkout session. Please try again.'
        );
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      Alert.alert('Error', error.message || 'Failed to start checkout. Please try again.');
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    setManagingSubscription(true);
    try {
      const response = await api.post<{ url: string }>('/api/subscription/manage');
      
      if (response.data?.url) {
        const canOpen = await Linking.canOpenURL(response.data.url);
        if (canOpen) {
          await Linking.openURL(response.data.url);
        } else {
          Alert.alert('Error', 'Unable to open billing portal. Please try again.');
        }
      } else {
        Alert.alert('Error', 'Failed to open billing portal. Please try again.');
      }
    } catch (error: any) {
      console.error('Manage subscription error:', error);
      Alert.alert('Error', error.message || 'Failed to open billing portal.');
    } finally {
      setManagingSubscription(false);
    }
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const isCurrentTier = (tierId: string) => {
    if (!subscriptionStatus) return tierId === 'free';
    return subscriptionStatus.tier === tierId;
  };

  const hasActiveSubscription = subscriptionStatus && 
    (subscriptionStatus.tier === 'pro' || subscriptionStatus.tier === 'team' || subscriptionStatus.tier === 'trial');

  const getTierCardStyle = (tier: Tier) => {
    const baseStyle = [styles.tierCard];
    if (isCurrentTier(tier.id)) {
      baseStyle.push(styles.tierCardCurrent);
    } else if (tier.popular) {
      baseStyle.push(styles.tierCardPopular);
    } else {
      baseStyle.push(styles.tierCardDefault);
    }
    return baseStyle;
  };

  const getCtaButtonText = (tier: Tier) => {
    if (isCurrentTier(tier.id)) return 'Current Plan';
    if (tier.id === 'free') return 'Downgrade to Free';
    return tier.cta;
  };

  const renderTierCard = (tier: Tier) => {
    const isDisabled = isCurrentTier(tier.id) || 
      (subscriptionStatus?.tier === 'pro' && tier.id === 'pro') ||
      (subscriptionStatus?.tier === 'team' && tier.id === 'team');
    const isLoading = checkoutLoading === tier.id;
    const teamTotal = tier.price + (teamSeats * (tier.seatPrice || 0));

    return (
      <View key={tier.id} style={getTierCardStyle(tier)}>
        {tier.popular && (
          <View style={styles.popularBadge}>
            <Text style={styles.popularBadgeText}>Most Popular</Text>
          </View>
        )}

        <View style={styles.tierHeader}>
          <View style={[
            styles.tierIconContainer,
            tier.id === 'free' ? styles.tierIconFree :
            tier.id === 'pro' ? styles.tierIconPro : styles.tierIconTeam
          ]}>
            <Feather 
              name={tier.id === 'free' ? 'zap' : tier.id === 'pro' ? 'award' : 'users'} 
              size={18} 
              color={tier.id === 'free' ? colors.mutedForeground : colors.primary} 
            />
          </View>
          <Text style={styles.tierName}>{tier.name}</Text>
        </View>

        <Text style={styles.tierDescription}>{tier.description}</Text>

        <View style={styles.tierPricing}>
          <View style={styles.tierPriceRow}>
            <Text style={styles.tierPrice}>${tier.price}</Text>
            <Text style={styles.tierPeriod}>/month</Text>
          </View>
          {tier.seatPrice && (
            <Text style={styles.tierSeatPrice}>
              + ${tier.seatPrice}/seat for team members
            </Text>
          )}
        </View>

        {tier.id === 'team' && !isCurrentTier('team') && (
          <View style={styles.seatSelector}>
            <View style={styles.seatSelectorRow}>
              <Text style={styles.seatSelectorLabel}>Team seats</Text>
              <View style={styles.seatControls}>
                <TouchableOpacity
                  style={[styles.seatButton, teamSeats <= 0 && styles.seatButtonDisabled]}
                  onPress={() => setTeamSeats(Math.max(0, teamSeats - 1))}
                  disabled={teamSeats <= 0}
                  activeOpacity={0.7}
                >
                  <Feather name="minus" size={16} color={colors.foreground} />
                </TouchableOpacity>
                <Text style={styles.seatCount}>{teamSeats}</Text>
                <TouchableOpacity
                  style={[styles.seatButton, teamSeats >= 50 && styles.seatButtonDisabled]}
                  onPress={() => setTeamSeats(Math.min(50, teamSeats + 1))}
                  disabled={teamSeats >= 50}
                  activeOpacity={0.7}
                >
                  <Feather name="plus" size={16} color={colors.foreground} />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.seatTotalRow}>
              <Text style={styles.seatTotalLabel}>Total monthly</Text>
              <Text style={styles.seatTotalPrice}>${teamTotal} AUD</Text>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.ctaButton,
            tier.id === 'free' ? styles.ctaButtonOutline : styles.ctaButtonPrimary,
            (isDisabled || isLoading) && styles.ctaButtonDisabled
          ]}
          onPress={() => tier.id !== 'free' && handleStartTrial(tier.id)}
          disabled={isDisabled || isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color={tier.id === 'free' ? colors.foreground : colors.primaryForeground} />
          ) : (
            <Text style={[
              styles.ctaButtonText,
              tier.id === 'free' ? styles.ctaButtonTextOutline : styles.ctaButtonTextPrimary
            ]}>
              {getCtaButtonText(tier)}
            </Text>
          )}
        </TouchableOpacity>

        {tier.id !== 'free' && !isCurrentTier(tier.id) && (
          <Text style={styles.ctaSubtext}>
            {tier.id === 'team' 
              ? `$${teamTotal} AUD charged after 14-day trial`
              : `$${tier.price} AUD/month after trial`
            }
          </Text>
        )}

        <View style={styles.featureList}>
          {tier.features.map((feature, index) => (
            <View key={index} style={styles.featureItem}>
              <View style={styles.featureIconContainer}>
                <Feather 
                  name={feature.included ? 'check' : 'x'} 
                  size={18} 
                  color={feature.included ? colors.success : `${colors.mutedForeground}60`} 
                />
              </View>
              <Text style={[
                styles.featureText,
                !feature.included && styles.featureTextDisabled
              ]}>
                {feature.text}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
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
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Loading subscription details...</Text>
            </View>
          ) : (
            <>
              <View style={styles.heroSection}>
                <View style={styles.trialBadge}>
                  <Feather name="star" size={14} color={colors.primary} />
                  <Text style={styles.trialBadgeText}>14-Day Free Trial</Text>
                </View>
                <Text style={styles.heroTitle}>
                  Try Pro or Team free for 14 days
                </Text>
                <Text style={styles.heroSubtitle}>
                  No charges until your trial ends. Cancel anytime with one click.
                </Text>
                
                <View style={styles.trustBadges}>
                  <View style={styles.trustBadge}>
                    <Feather name="shield" size={14} color={colors.success} />
                    <Text style={styles.trustBadgeText}>Cancel anytime</Text>
                  </View>
                  <View style={styles.trustBadge}>
                    <Feather name="credit-card" size={14} color={colors.success} />
                    <Text style={styles.trustBadgeText}>No payment until trial ends</Text>
                  </View>
                  <View style={styles.trustBadge}>
                    <Feather name="clock" size={14} color={colors.success} />
                    <Text style={styles.trustBadgeText}>Full access for 14 days</Text>
                  </View>
                </View>
              </View>

              {hasActiveSubscription && (
                <View style={styles.currentPlanCard}>
                  <View style={styles.currentPlanContent}>
                    <View style={styles.currentPlanInfo}>
                      <View style={styles.currentPlanIcon}>
                        <Feather 
                          name={subscriptionStatus?.tier === 'team' ? 'users' : 'award'} 
                          size={24} 
                          color={colors.primary} 
                        />
                      </View>
                      <View style={styles.currentPlanDetails}>
                        <View style={styles.currentPlanHeader}>
                          <Text style={styles.currentPlanName}>
                            {subscriptionStatus?.tier} Plan
                          </Text>
                          {subscriptionStatus?.tier === 'trial' && (
                            <View style={[styles.currentPlanBadge, styles.trialBadgeStyle]}>
                              <Text style={[styles.currentPlanBadgeText, styles.trialBadgeTextStyle]}>
                                Trial
                              </Text>
                            </View>
                          )}
                          {subscriptionStatus?.cancelAtPeriodEnd && (
                            <View style={[styles.currentPlanBadge, styles.cancelingBadgeStyle]}>
                              <Text style={[styles.currentPlanBadgeText, styles.cancelingBadgeTextStyle]}>
                                Canceling
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.currentPlanSubtext}>
                          {subscriptionStatus?.tier === 'trial' && subscriptionStatus.trialEndsAt ? (
                            `Trial ends on ${formatDate(subscriptionStatus.trialEndsAt)}`
                          ) : subscriptionStatus?.nextBillingDate ? (
                            `Next billing: ${formatDate(subscriptionStatus.nextBillingDate)}`
                          ) : subscriptionStatus?.currentPeriodEnd ? (
                            `Active until ${formatDate(subscriptionStatus.currentPeriodEnd)}`
                          ) : (
                            'Active subscription'
                          )}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity 
                      style={styles.manageButton}
                      onPress={handleManageSubscription}
                      disabled={managingSubscription}
                      activeOpacity={0.7}
                    >
                      {managingSubscription ? (
                        <ActivityIndicator size="small" color={colors.foreground} />
                      ) : (
                        <>
                          <Text style={styles.manageButtonText}>Manage</Text>
                          <Feather name="external-link" size={14} color={colors.foreground} />
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {tiers.map(renderTierCard)}

              <View style={styles.trialInfoCard}>
                <Text style={styles.trialInfoTitle}>
                  <Feather name="calendar" size={18} color={colors.foreground} />
                  {'  '}How the 14-day trial works
                </Text>
                
                <View style={styles.trialSteps}>
                  <View style={styles.trialStep}>
                    <View style={styles.trialStepNumber}>
                      <Text style={styles.trialStepNumberText}>1</Text>
                    </View>
                    <View style={styles.trialStepContent}>
                      <Text style={styles.trialStepTitle}>Start your trial</Text>
                      <Text style={styles.trialStepText}>
                        Enter your card details to begin. You won't be charged today.
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.trialStep}>
                    <View style={styles.trialStepNumber}>
                      <Text style={styles.trialStepNumberText}>2</Text>
                    </View>
                    <View style={styles.trialStepContent}>
                      <Text style={styles.trialStepTitle}>Full access for 14 days</Text>
                      <Text style={styles.trialStepText}>
                        Explore all features with no restrictions during your trial period.
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.trialStep}>
                    <View style={styles.trialStepNumber}>
                      <Text style={styles.trialStepNumberText}>3</Text>
                    </View>
                    <View style={styles.trialStepContent}>
                      <Text style={styles.trialStepTitle}>Cancel anytime</Text>
                      <Text style={styles.trialStepText}>
                        Cancel before the trial ends and you won't be charged a cent.
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.cardRequiredNote}>
                  <Feather name="credit-card" size={18} color={colors.mutedForeground} />
                  <View style={styles.cardRequiredContent}>
                    <Text style={styles.cardRequiredTitle}>Card required upfront</Text>
                    <Text style={styles.cardRequiredText}>
                      We collect your payment details to start the trial, but you won't be charged until the 14-day period ends. You'll receive an email reminder before your first charge.
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.supportSection}>
                <Text style={styles.supportText}>
                  Have questions?{' '}
                  <Text 
                    style={styles.supportLink}
                    onPress={() => Linking.openURL('mailto:support@tradietrack.com.au')}
                  >
                    Contact our support team
                  </Text>
                </Text>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </>
  );
}
