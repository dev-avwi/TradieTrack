import { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Linking
} from 'react-native';
import { Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuthStore } from '../../src/lib/store';
import { useTheme } from '../../src/lib/theme';

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 16,
    paddingTop: 8,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.foreground,
  },
  pageSubtitle: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  statusCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  statusCardSuccess: {
    backgroundColor: colors.successLight,
    borderColor: colors.success,
  },
  statusCardWarning: {
    backgroundColor: colors.warningLight,
    borderColor: colors.warning,
  },
  statusCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusBadgeSuccess: {
    backgroundColor: colors.successLight,
  },
  statusBadgeWarning: {
    backgroundColor: colors.warningLight,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusCardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  statusCardText: {
    flex: 1,
    fontSize: 14,
    color: colors.mutedForeground,
    lineHeight: 20,
  },
  integrationCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  integrationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  integrationIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  integrationIconText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
  },
  integrationInfo: {
    flex: 1,
  },
  integrationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  integrationSubtitle: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  integrationBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  integrationBadgeSuccess: {
    backgroundColor: colors.successLight,
  },
  integrationBadgeWarning: {
    backgroundColor: colors.warningLight,
  },
  integrationBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  integrationBadgeBuiltIn: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  integrationBadgeBuiltInText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  integrationDetails: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  detailText: {
    fontSize: 14,
    color: colors.foreground,
    fontWeight: '500',
  },
  detailSubtext: {
    fontSize: 13,
    color: colors.mutedForeground,
    lineHeight: 20,
    marginBottom: 12,
  },
  dashboardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  dashboardButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.foreground,
  },
  setupText: {
    fontSize: 14,
    color: colors.mutedForeground,
    lineHeight: 20,
  },
  builtInInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  builtInText: {
    fontSize: 13,
    color: colors.success,
  },
  comingSoonCard: {
    backgroundColor: colors.muted,
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
    alignItems: 'center',
  },
  comingSoonTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 4,
  },
  comingSoonText: {
    fontSize: 13,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
});

export default function IntegrationsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const { businessSettings } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);

  const isStripeConnected = businessSettings?.stripeAccountId;

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refreshData();
  }, []);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={refreshData}
              tintColor={colors.primary}
            />
          }
        >
          <View style={styles.header}>
            <Text style={styles.pageTitle}>Integrations</Text>
            <Text style={styles.pageSubtitle}>Connect your payment and communication services</Text>
          </View>

          <View style={[
            styles.statusCard,
            isStripeConnected ? styles.statusCardSuccess : styles.statusCardWarning
          ]}>
            <View style={styles.statusCardHeader}>
              <Text style={styles.statusCardTitle}>
                {isStripeConnected ? 'Ready to Accept Payments' : 'Set Up Payments'}
              </Text>
              <View style={[
                styles.statusBadge,
                isStripeConnected ? styles.statusBadgeSuccess : styles.statusBadgeWarning
              ]}>
                {isStripeConnected ? (
                  <Feather name="zap" size={12} color={colors.success} />
                ) : (
                  <Feather name="alert-circle" size={12} color={colors.warning} />
                )}
                <Text style={[
                  styles.statusBadgeText,
                  { color: isStripeConnected ? colors.success : colors.warning }
                ]}>
                  {isStripeConnected ? 'Live' : 'Setup Required'}
                </Text>
              </View>
            </View>
            <View style={styles.statusCardContent}>
              <Feather name="check-circle" size={24} color={isStripeConnected ? colors.success : colors.mutedForeground} />
              <Text style={styles.statusCardText}>
                {isStripeConnected 
                  ? 'Your Stripe account is connected and ready. You can send invoices and collect payments!'
                  : 'Connect your Stripe account to start accepting payments from customers.'
                }
              </Text>
            </View>
          </View>

          <View style={styles.integrationCard}>
            <View style={styles.integrationHeader}>
              <View style={styles.integrationIconContainer}>
                <Text style={styles.integrationIconText}>S</Text>
              </View>
              <View style={styles.integrationInfo}>
                <Text style={styles.integrationTitle}>Payment Processing</Text>
                <Text style={styles.integrationSubtitle}>Accept payments via Stripe</Text>
              </View>
              <View style={[
                styles.integrationBadge,
                isStripeConnected ? styles.integrationBadgeSuccess : styles.integrationBadgeWarning
              ]}>
                <Text style={[
                  styles.integrationBadgeText,
                  { color: isStripeConnected ? colors.success : colors.warning }
                ]}>
                  {isStripeConnected ? 'Connected' : 'Not Connected'}
                </Text>
              </View>
            </View>

            {isStripeConnected && (
              <View style={styles.integrationDetails}>
                <View style={styles.detailRow}>
                  <View style={styles.detailIconContainer}>
                    <Feather name="credit-card" size={16} color={colors.primary} />
                  </View>
                  <Text style={styles.detailText}>
                    {businessSettings?.businessName || 'Your Business'}
                  </Text>
                </View>
                <Text style={styles.detailSubtext}>
                  Payments are processed and deposited directly to your bank account.
                </Text>
                
                <TouchableOpacity 
                  style={styles.dashboardButton}
                  onPress={() => Linking.openURL('https://dashboard.stripe.com')}
                >
                  <Feather name="external-link" size={16} color={colors.foreground} />
                  <Text style={styles.dashboardButtonText}>View Stripe Dashboard</Text>
                </TouchableOpacity>
              </View>
            )}

            {!isStripeConnected && (
              <View style={styles.integrationDetails}>
                <Text style={styles.setupText}>
                  Connect Stripe on the web app to start accepting payments.
                </Text>
              </View>
            )}
          </View>

          <View style={styles.integrationCard}>
            <View style={styles.integrationHeader}>
              <View style={[styles.integrationIconContainer, { backgroundColor: colors.destructiveLight }]}>
                <Text style={[styles.integrationIconText, { color: colors.destructive }]}>M</Text>
              </View>
              <View style={styles.integrationInfo}>
                <Text style={styles.integrationTitle}>Email via Gmail</Text>
                <Text style={styles.integrationSubtitle}>Send quotes and invoices via your Gmail</Text>
              </View>
              <View style={styles.integrationBadgeBuiltIn}>
                <Text style={styles.integrationBadgeBuiltInText}>Built-in</Text>
              </View>
            </View>

            <View style={styles.integrationDetails}>
              <Text style={styles.detailSubtext}>
                When you send a quote or invoice, it opens your Gmail with a professional email ready to send. Emails come from your address and appear in your Sent folder.
              </Text>
              <View style={styles.builtInInfo}>
                <Feather name="check-circle" size={16} color={colors.success} />
                <Text style={styles.builtInText}>No setup required - works with any Gmail account</Text>
              </View>
            </View>
          </View>

          <View style={styles.comingSoonCard}>
            <Text style={styles.comingSoonTitle}>More Integrations Coming</Text>
            <Text style={styles.comingSoonText}>
              We're working on integrations with accounting software, SMS providers, and more.
            </Text>
          </View>
        </ScrollView>
      </View>
    </>
  );
}
