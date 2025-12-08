import { useEffect, useState, useMemo, useCallback } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  StyleSheet, 
  TextInput,
  Alert,
  ActivityIndicator
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius } from '../../src/lib/design-tokens';
import api from '../../src/lib/api';

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  header: {
    marginBottom: spacing.xl,
    paddingTop: spacing.sm,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.foreground,
  },
  pageSubtitle: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginTop: 4,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  cardIconContainer: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
  },
  cardSubtitle: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  amountInput: {
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    fontSize: 32,
    fontWeight: '700',
    color: colors.foreground,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  amountLabel: {
    fontSize: 12,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  descriptionInput: {
    backgroundColor: colors.muted,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 14,
    color: colors.foreground,
    marginBottom: spacing.lg,
  },
  collectButton: {
    backgroundColor: colors.success,
    borderRadius: radius.lg,
    paddingVertical: spacing.md + 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  collectButtonDisabled: {
    backgroundColor: colors.muted,
  },
  collectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.successForeground,
  },
  collectButtonTextDisabled: {
    color: colors.mutedForeground,
  },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  infoIconContainer: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
  },
  infoText: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 2,
    lineHeight: 18,
  },
  setupCard: {
    backgroundColor: colors.warningLight,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  setupIconContainer: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setupContent: {
    flex: 1,
  },
  setupTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
  },
  setupText: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 4,
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: spacing.md,
    marginTop: spacing.md,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  featureText: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
});

export default function TapToPayScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasStripeConnect, setHasStripeConnect] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkStripeStatus();
  }, []);

  const checkStripeStatus = async () => {
    try {
      const response = await api.get('/api/stripe-connect/status');
      if (response.data?.connected) {
        setHasStripeConnect(true);
      }
    } catch (error) {
      console.error('[TapToPay] Failed to check Stripe status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCollectPayment = useCallback(async () => {
    const amountNum = parseFloat(amount);
    
    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid payment amount.');
      return;
    }

    if (amountNum < 0.50) {
      Alert.alert('Minimum Amount', 'Minimum payment amount is $0.50.');
      return;
    }

    if (!hasStripeConnect) {
      Alert.alert(
        'Stripe Not Connected',
        'You need to connect your Stripe account first to collect payments.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Setup Stripe', onPress: () => router.push('/more/payments') }
        ]
      );
      return;
    }

    Alert.alert(
      'Tap to Pay',
      `Ready to collect $${amountNum.toFixed(2)} AUD.\n\nNote: Tap to Pay requires a standalone app build with Stripe Terminal SDK. Please build the app using "eas build" for full NFC payment functionality.`,
      [
        { text: 'OK' }
      ]
    );
  }, [amount, hasStripeConnect, router]);

  const formatAmount = (text: string) => {
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      return parts[0] + '.' + parts[1];
    }
    if (parts[1] && parts[1].length > 2) {
      return parts[0] + '.' + parts[1].slice(0, 2);
    }
    return cleaned;
  };

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.pageTitle}>Tap to Pay</Text>
            <Text style={styles.pageSubtitle}>Accept contactless payments with your phone</Text>
          </View>

          {!hasStripeConnect && (
            <View style={styles.setupCard}>
              <View style={styles.setupIconContainer}>
                <Feather name="alert-triangle" size={20} color={colors.primaryForeground} />
              </View>
              <View style={styles.setupContent}>
                <Text style={styles.setupTitle}>Stripe Not Connected</Text>
                <Text style={styles.setupText}>
                  Connect your Stripe account to start accepting payments. Go to Payments settings to complete setup.
                </Text>
              </View>
            </View>
          )}

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIconContainer, { backgroundColor: colors.successLight }]}>
                <Feather name="credit-card" size={22} color={colors.success} />
              </View>
              <View>
                <Text style={styles.cardTitle}>Collect Payment</Text>
                <Text style={styles.cardSubtitle}>Enter amount and tap card</Text>
              </View>
            </View>

            <TextInput
              style={styles.amountInput}
              placeholder="0.00"
              placeholderTextColor={colors.mutedForeground}
              value={amount}
              onChangeText={(text) => setAmount(formatAmount(text))}
              keyboardType="decimal-pad"
              maxLength={10}
            />
            <Text style={styles.amountLabel}>Amount in AUD</Text>

            <TextInput
              style={styles.descriptionInput}
              placeholder="Payment description (optional)"
              placeholderTextColor={colors.mutedForeground}
              value={description}
              onChangeText={setDescription}
              maxLength={100}
            />

            <TouchableOpacity
              style={[
                styles.collectButton,
                (!amount || isProcessing || !hasStripeConnect) && styles.collectButtonDisabled
              ]}
              onPress={handleCollectPayment}
              disabled={!amount || isProcessing || !hasStripeConnect}
              activeOpacity={0.7}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color={colors.mutedForeground} />
              ) : (
                <Feather 
                  name="smartphone" 
                  size={20} 
                  color={(!amount || !hasStripeConnect) ? colors.mutedForeground : colors.successForeground} 
                />
              )}
              <Text style={[
                styles.collectButtonText,
                (!amount || !hasStripeConnect) && styles.collectButtonTextDisabled
              ]}>
                {isProcessing ? 'Processing...' : !hasStripeConnect ? 'Connect Stripe First' : 'Collect Payment'}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>How It Works</Text>
          
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={styles.infoIconContainer}>
                <Feather name="dollar-sign" size={16} color={colors.primary} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>1. Enter Amount</Text>
                <Text style={styles.infoText}>Type the payment amount in AUD</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoIconContainer}>
                <Feather name="smartphone" size={16} color={colors.primary} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>2. Customer Taps Card</Text>
                <Text style={styles.infoText}>Hold customer's card near your phone's NFC reader</Text>
              </View>
            </View>

            <View style={[styles.infoRow, { marginBottom: 0 }]}>
              <View style={styles.infoIconContainer}>
                <Feather name="check-circle" size={16} color={colors.primary} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>3. Payment Complete</Text>
                <Text style={styles.infoText}>Payment is processed instantly and deposited to your account</Text>
              </View>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Features</Text>
          
          <View style={styles.infoCard}>
            <View style={styles.featureItem}>
              <Feather name="check" size={16} color={colors.success} />
              <Text style={styles.featureText}>Accept Visa, Mastercard, Amex, and more</Text>
            </View>
            <View style={styles.featureItem}>
              <Feather name="check" size={16} color={colors.success} />
              <Text style={styles.featureText}>Apple Pay & Google Pay supported</Text>
            </View>
            <View style={styles.featureItem}>
              <Feather name="check" size={16} color={colors.success} />
              <Text style={styles.featureText}>No additional hardware required</Text>
            </View>
            <View style={styles.featureItem}>
              <Feather name="check" size={16} color={colors.success} />
              <Text style={styles.featureText}>Instant receipts via SMS or email</Text>
            </View>
            <View style={styles.featureItem}>
              <Feather name="check" size={16} color={colors.success} />
              <Text style={styles.featureText}>Same-day payouts available</Text>
            </View>
          </View>

          <View style={styles.setupCard}>
            <View style={[styles.setupIconContainer, { backgroundColor: colors.primary }]}>
              <Feather name="info" size={20} color={colors.primaryForeground} />
            </View>
            <View style={styles.setupContent}>
              <Text style={styles.setupTitle}>Standalone App Required</Text>
              <Text style={styles.setupText}>
                Tap to Pay requires a standalone app build with Stripe Terminal SDK. Build your app using EAS Build to enable full NFC payment functionality.
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </>
  );
}
