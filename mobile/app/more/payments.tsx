import { useMemo, useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Linking, ActivityIndicator, Alert } from 'react-native';
import { Stack, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { useAuthStore } from '../../src/lib/store';
import { spacing, radius, shadows } from '../../src/lib/design-tokens';
import { getBottomNavHeight } from '../../src/components/BottomNav';
import api from '../../src/lib/api';

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
  },
  headerRight: {
    width: 36,
  },
  content: {
    padding: spacing.lg,
  },
  heroCard: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.xl,
    borderWidth: 1,
    ...shadows.sm,
  },
  heroConnected: {
    backgroundColor: colors.successLight,
    borderColor: colors.success + '40',
  },
  heroNotConnected: {
    backgroundColor: colors.card,
    borderColor: colors.border,
  },
  stripeLogoContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  stripeLogoConnected: {
    backgroundColor: colors.success,
  },
  stripeLogoNotConnected: {
    backgroundColor: colors.muted,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.foreground,
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
    marginTop: spacing.md,
    marginLeft: 4,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  cardIconContainer: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
  },
  cardSubtitle: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  cardChevron: {
    marginLeft: spacing.sm,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  featureText: {
    fontSize: 14,
    color: colors.foreground,
    flex: 1,
  },
  featureCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feeCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    ...shadows.sm,
  },
  feeAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.foreground,
  },
  feeLabel: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginTop: 4,
  },
  feeBreakdown: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    width: '100%',
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  feeRowLabel: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  feeRowValue: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.foreground,
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    marginTop: spacing.lg,
  },
  connectButtonText: {
    color: colors.primaryForeground,
    fontSize: 16,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
    flexDirection: 'row',
    gap: spacing.md,
  },
  infoText: {
    fontSize: 13,
    color: colors.mutedForeground,
    flex: 1,
    lineHeight: 19,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
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
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.foreground,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  betaBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.md,
    marginTop: spacing.md,
  },
  betaText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 2,
  },
});

interface PaymentStats {
  totalCollected: number;
  pendingPayments: number;
  paidInvoices: number;
}

export default function PaymentsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
  const { user } = useAuthStore();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [stats, setStats] = useState<PaymentStats>({
    totalCollected: 0,
    pendingPayments: 0,
    paidInvoices: 0,
  });

  useEffect(() => {
    checkStripeStatus();
    loadPaymentStats();
  }, []);

  const checkStripeStatus = async () => {
    try {
      const response = await api.get('/api/stripe/account');
      setIsConnected(response.data?.connected || false);
    } catch (error) {
      setIsConnected(false);
    }
    setIsLoading(false);
  };

  const loadPaymentStats = async () => {
    try {
      const response = await api.get('/api/analytics/payments');
      if (response.data) {
        setStats(response.data);
      }
    } catch (error) {
      console.log('Stats not available:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleConnectStripe = async () => {
    try {
      setIsLoading(true);
      const response = await api.post('/api/stripe-connect/onboard');
      
      if (response.data?.onboardingUrl) {
        await Linking.openURL(response.data.onboardingUrl);
      } else if (response.data?.error) {
        Alert.alert('Connection Error', response.data.error);
      } else {
        Alert.alert('Error', 'Unable to start Stripe connection. Please try again.');
      }
    } catch (error: any) {
      console.error('Stripe connect error:', error);
      Alert.alert(
        'Connection Failed',
        error.response?.data?.error || 'Unable to connect to Stripe. Please check your internet connection and try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        {/* Custom Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Feather name="chevron-left" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Payments & Billing</Text>
          <View style={styles.headerRight} />
        </View>

        <ScrollView 
          style={{ flex: 1 }}
          contentContainerStyle={[styles.content, { paddingBottom: bottomNavHeight + 20 }]}
          showsVerticalScrollIndicator={false}
        >
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <>
              {/* Hero Status Card */}
              <View style={[styles.heroCard, isConnected ? styles.heroConnected : styles.heroNotConnected]}>
                <View style={[styles.stripeLogoContainer, isConnected ? styles.stripeLogoConnected : styles.stripeLogoNotConnected]}>
                  {isConnected ? (
                    <Feather name="check" size={28} color={colors.primaryForeground} />
                  ) : (
                    <Feather name="credit-card" size={28} color={colors.mutedForeground} />
                  )}
                </View>
                <Text style={styles.heroTitle}>
                  {isConnected ? 'Stripe Connected' : 'Accept Payments'}
                </Text>
                <Text style={styles.heroSubtitle}>
                  {isConnected 
                    ? 'Your business is ready to accept online payments'
                    : 'Connect Stripe to start accepting card payments'
                  }
                </Text>
                {!isConnected && (
                  <TouchableOpacity style={styles.connectButton} onPress={handleConnectStripe}>
                    <Feather name="link" size={18} color={colors.primaryForeground} />
                    <Text style={styles.connectButtonText}>Connect Stripe</Text>
                  </TouchableOpacity>
                )}
                <View style={styles.betaBadge}>
                  <Text style={styles.betaText}>Free During Beta</Text>
                </View>
              </View>

              {/* Payment Stats */}
              {isConnected && (
                <>
                  <Text style={styles.sectionTitle}>Payment Overview</Text>
                  <View style={styles.statsRow}>
                    <View style={styles.statCard}>
                      <Text style={styles.statValue}>{formatCurrency(stats.totalCollected)}</Text>
                      <Text style={styles.statLabel}>Collected</Text>
                    </View>
                    <View style={styles.statCard}>
                      <Text style={styles.statValue}>{formatCurrency(stats.pendingPayments)}</Text>
                      <Text style={styles.statLabel}>Pending</Text>
                    </View>
                  </View>
                </>
              )}

              {/* Payment Methods */}
              <Text style={styles.sectionTitle}>Payment Methods</Text>
              <View style={styles.card}>
                <View style={styles.featureRow}>
                  <View style={styles.featureCheck}>
                    <Feather name="check" size={12} color={colors.success} />
                  </View>
                  <Text style={styles.featureText}>Credit & Debit Cards</Text>
                </View>
                <View style={styles.featureRow}>
                  <View style={styles.featureCheck}>
                    <Feather name="check" size={12} color={colors.success} />
                  </View>
                  <Text style={styles.featureText}>Apple Pay & Google Pay</Text>
                </View>
                <View style={styles.featureRow}>
                  <View style={styles.featureCheck}>
                    <Feather name="check" size={12} color={colors.success} />
                  </View>
                  <Text style={styles.featureText}>Direct Bank Transfer</Text>
                </View>
              </View>

              {/* Platform Fee */}
              <Text style={styles.sectionTitle}>Pricing</Text>
              <View style={styles.feeCard}>
                <Text style={styles.feeAmount}>2.5%</Text>
                <Text style={styles.feeLabel}>Platform fee per transaction</Text>
                <View style={styles.feeBreakdown}>
                  <View style={styles.feeRow}>
                    <Text style={styles.feeRowLabel}>TradieTrack fee</Text>
                    <Text style={styles.feeRowValue}>2.5%</Text>
                  </View>
                  <View style={styles.feeRow}>
                    <Text style={styles.feeRowLabel}>Stripe processing</Text>
                    <Text style={styles.feeRowValue}>1.75% + $0.30</Text>
                  </View>
                </View>
              </View>

              {/* Invoice Payments Card */}
              <Text style={styles.sectionTitle}>How It Works</Text>
              <TouchableOpacity 
                style={styles.card}
                activeOpacity={0.7}
                onPress={() => router.push('/more/invoices')}
              >
                <View style={styles.cardRow}>
                  <View style={[styles.cardIconContainer, { backgroundColor: colors.primaryLight }]}>
                    <Feather name="file-text" size={20} color={colors.primary} />
                  </View>
                  <View style={styles.cardContent}>
                    <Text style={styles.cardTitle}>Invoice Payments</Text>
                    <Text style={styles.cardSubtitle}>Send invoices with secure payment links</Text>
                  </View>
                  <Feather name="chevron-right" size={20} color={colors.mutedForeground} style={styles.cardChevron} />
                </View>
              </TouchableOpacity>

              <View style={styles.card}>
                <View style={styles.cardRow}>
                  <View style={[styles.cardIconContainer, { backgroundColor: colors.successLight }]}>
                    <Feather name="smartphone" size={20} color={colors.success} />
                  </View>
                  <View style={styles.cardContent}>
                    <Text style={styles.cardTitle}>Tap to Pay</Text>
                    <Text style={styles.cardSubtitle}>Collect payments on-site with your phone</Text>
                  </View>
                  <View style={[styles.betaBadge, { marginTop: 0 }]}>
                    <Text style={styles.betaText}>Coming Soon</Text>
                  </View>
                </View>
              </View>

              {/* Info Note */}
              <View style={styles.infoCard}>
                <Feather name="info" size={18} color={colors.mutedForeground} />
                <Text style={styles.infoText}>
                  Advanced payment settings can be managed on the web app. Contact support if you need to change your Stripe account.
                </Text>
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </>
  );
}
