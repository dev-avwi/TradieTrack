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
  ActivityIndicator
} from 'react-native';
import { Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuthStore } from '../../src/lib/store';
import { useTheme } from '../../src/lib/theme';
import api from '../../src/lib/api';

interface StripeConnectStatus {
  connected: boolean;
  stripeAvailable: boolean;
  connectEnabled?: boolean;
  accountId?: string;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  detailsSubmitted?: boolean;
  message?: string;
}

interface IntegrationHealth {
  stripeConnectStatus?: {
    connected: boolean;
    accountId?: string;
    chargesEnabled?: boolean;
    payoutsEnabled?: boolean;
    detailsSubmitted?: boolean;
    businessName?: string;
    email?: string;
  };
  emailVerified?: boolean;
  emailError?: string;
  gmailConnected?: boolean;
  gmailEmail?: string;
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
    padding: 16,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 20,
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
    marginTop: 4,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.mutedForeground,
    marginBottom: 12,
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  integrationIconText: {
    fontSize: 20,
    fontWeight: 'bold',
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
    marginTop: 2,
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
  integrationBadgeDisabled: {
    backgroundColor: colors.muted,
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
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 8,
  },
  actionButtonPrimary: {
    backgroundColor: colors.primary,
  },
  actionButtonSecondary: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  actionButtonTextPrimary: {
    color: colors.primaryForeground,
  },
  actionButtonTextSecondary: {
    color: colors.foreground,
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
    padding: 20,
    marginTop: 8,
    alignItems: 'center',
    opacity: 0.8,
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
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  featureList: {
    marginTop: 8,
    gap: 6,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningLight,
    padding: 12,
    borderRadius: 10,
    gap: 10,
    marginBottom: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: colors.warning,
  },
});

export default function IntegrationsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const { businessSettings, fetchBusinessSettings } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [stripeStatus, setStripeStatus] = useState<StripeConnectStatus | null>(null);
  const [integrationHealth, setIntegrationHealth] = useState<IntegrationHealth | null>(null);

  const fetchIntegrationStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      const [stripeResponse, healthResponse] = await Promise.all([
        api.get<StripeConnectStatus>('/api/stripe-connect/status'),
        api.get<IntegrationHealth>('/api/integrations/health')
      ]);
      
      if (stripeResponse.data) {
        setStripeStatus(stripeResponse.data);
      }
      if (healthResponse.data) {
        setIntegrationHealth(healthResponse.data);
      }
      
      await fetchBusinessSettings();
    } catch (error) {
      console.error('Error fetching integration status:', error);
    } finally {
      setIsLoading(false);
    }
  }, [fetchBusinessSettings]);

  useEffect(() => {
    fetchIntegrationStatus();
  }, []);

  const handleConnectStripe = async () => {
    setIsConnecting(true);
    try {
      if (!stripeStatus?.connected) {
        const response = await api.post<{ url: string; accountId: string }>('/api/stripe-connect/create-account');
        if (response.data?.url) {
          await Linking.openURL(response.data.url);
        } else if (response.error) {
          Alert.alert('Connection Error', response.error);
        }
      } else if (!stripeStatus.chargesEnabled) {
        const response = await api.post<{ url: string }>('/api/stripe-connect/account-link', { type: 'account_onboarding' });
        if (response.data?.url) {
          await Linking.openURL(response.data.url);
        } else if (response.error) {
          Alert.alert('Setup Error', response.error);
        }
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to connect Stripe');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleOpenStripeDashboard = async () => {
    try {
      const response = await api.get<{ url: string }>('/api/stripe-connect/dashboard-link');
      if (response.data?.url) {
        await Linking.openURL(response.data.url);
      } else {
        await Linking.openURL('https://dashboard.stripe.com');
      }
    } catch (error) {
      await Linking.openURL('https://dashboard.stripe.com');
    }
  };

  const isStripeFullyConnected = stripeStatus?.connected && stripeStatus?.chargesEnabled;
  const isStripePartiallyConnected = stripeStatus?.connected && !stripeStatus?.chargesEnabled;
  const hasEmailService = integrationHealth?.emailVerified || integrationHealth?.gmailConnected;

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
              onRefresh={fetchIntegrationStatus}
              tintColor={colors.primary}
            />
          }
        >
          <View style={styles.header}>
            <Text style={styles.pageTitle} data-testid="text-page-title">Integrations</Text>
            <Text style={styles.pageSubtitle}>
              Connect your business tools to streamline your workflow
            </Text>
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.detailSubtext, { marginTop: 12 }]}>Checking integration status...</Text>
            </View>
          ) : (
            <>
              <View style={[
                styles.statusCard,
                isStripeFullyConnected ? styles.statusCardSuccess : styles.statusCardWarning
              ]}>
                <View style={styles.statusCardHeader}>
                  <Text style={styles.statusCardTitle}>
                    {isStripeFullyConnected ? 'Ready to Accept Payments' : 'Set Up Payments'}
                  </Text>
                  <View style={[
                    styles.statusBadge,
                    isStripeFullyConnected ? styles.statusBadgeSuccess : styles.statusBadgeWarning
                  ]}>
                    {isStripeFullyConnected ? (
                      <Feather name="check-circle" size={12} color={colors.success} />
                    ) : (
                      <Feather name="alert-circle" size={12} color={colors.warning} />
                    )}
                    <Text style={[
                      styles.statusBadgeText,
                      { color: isStripeFullyConnected ? colors.success : colors.warning }
                    ]}>
                      {isStripeFullyConnected ? 'Live' : 'Setup Required'}
                    </Text>
                  </View>
                </View>
                <View style={styles.statusCardContent}>
                  <Feather 
                    name={isStripeFullyConnected ? "check-circle" : "credit-card"} 
                    size={24} 
                    color={isStripeFullyConnected ? colors.success : colors.warning} 
                  />
                  <Text style={styles.statusCardText}>
                    {isStripeFullyConnected 
                      ? 'Your Stripe account is connected. You can send invoices and collect payments online!'
                      : stripeStatus?.message || 'Connect Stripe to accept online payments from your customers.'
                    }
                  </Text>
                </View>
              </View>

              <Text style={styles.sectionTitle}>Payment Processing</Text>

              <View style={styles.integrationCard} data-testid="card-stripe-integration">
                <View style={styles.integrationHeader}>
                  <View style={[styles.integrationIconContainer, { backgroundColor: '#635bff20' }]}>
                    <Text style={[styles.integrationIconText, { color: '#635bff' }]}>S</Text>
                  </View>
                  <View style={styles.integrationInfo}>
                    <Text style={styles.integrationTitle}>Stripe Connect</Text>
                    <Text style={styles.integrationSubtitle}>Accept online payments</Text>
                  </View>
                  <View style={[
                    styles.integrationBadge,
                    isStripeFullyConnected 
                      ? styles.integrationBadgeSuccess 
                      : isStripePartiallyConnected 
                        ? styles.integrationBadgeWarning 
                        : styles.integrationBadgeDisabled
                  ]}>
                    <Text style={[
                      styles.integrationBadgeText,
                      { color: isStripeFullyConnected ? colors.success : isStripePartiallyConnected ? colors.warning : colors.mutedForeground }
                    ]}>
                      {isStripeFullyConnected ? 'Connected' : isStripePartiallyConnected ? 'Incomplete' : 'Not Connected'}
                    </Text>
                  </View>
                </View>

                <View style={styles.integrationDetails}>
                  {isStripePartiallyConnected && (
                    <View style={styles.warningBanner}>
                      <Feather name="alert-triangle" size={18} color={colors.warning} />
                      <Text style={styles.warningText}>
                        Complete your Stripe setup to start accepting payments
                      </Text>
                    </View>
                  )}

                  {isStripeFullyConnected && (
                    <>
                      <View style={styles.detailRow}>
                        <View style={styles.detailIconContainer}>
                          <Feather name="credit-card" size={16} color={colors.primary} />
                        </View>
                        <Text style={styles.detailText}>
                          {integrationHealth?.stripeConnectStatus?.businessName || businessSettings?.businessName || 'Your Business'}
                        </Text>
                      </View>
                      {integrationHealth?.stripeConnectStatus?.email && (
                        <View style={styles.detailRow}>
                          <View style={styles.detailIconContainer}>
                            <Feather name="mail" size={16} color={colors.primary} />
                          </View>
                          <Text style={styles.detailText}>
                            {integrationHealth.stripeConnectStatus.email}
                          </Text>
                        </View>
                      )}
                      <Text style={styles.detailSubtext}>
                        Payments are processed and deposited directly to your bank account. Stripe's standard fees apply.
                      </Text>
                    </>
                  )}

                  {!isStripeFullyConnected && !isStripePartiallyConnected && (
                    <>
                      <Text style={styles.detailSubtext}>
                        Accept credit cards, Apple Pay, and Google Pay. Funds are deposited directly to your bank.
                      </Text>
                      <View style={styles.featureList}>
                        <View style={styles.featureItem}>
                          <Feather name="check" size={14} color={colors.success} />
                          <Text style={styles.featureText}>Send payment links via invoice</Text>
                        </View>
                        <View style={styles.featureItem}>
                          <Feather name="check" size={14} color={colors.success} />
                          <Text style={styles.featureText}>Get paid faster with online payments</Text>
                        </View>
                        <View style={styles.featureItem}>
                          <Feather name="check" size={14} color={colors.success} />
                          <Text style={styles.featureText}>Automatic payment confirmations</Text>
                        </View>
                      </View>
                    </>
                  )}

                  {isStripeFullyConnected ? (
                    <TouchableOpacity 
                      style={[styles.actionButton, styles.actionButtonSecondary]}
                      onPress={handleOpenStripeDashboard}
                      data-testid="button-stripe-dashboard"
                    >
                      <Feather name="external-link" size={16} color={colors.foreground} />
                      <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>
                        View Stripe Dashboard
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity 
                      style={[styles.actionButton, styles.actionButtonPrimary]}
                      onPress={handleConnectStripe}
                      disabled={isConnecting || !stripeStatus?.stripeAvailable}
                      data-testid="button-connect-stripe"
                    >
                      {isConnecting ? (
                        <ActivityIndicator size="small" color={colors.primaryForeground} />
                      ) : (
                        <Feather name="link" size={16} color={colors.primaryForeground} />
                      )}
                      <Text style={[styles.actionButtonText, styles.actionButtonTextPrimary]}>
                        {isConnecting ? 'Connecting...' : isStripePartiallyConnected ? 'Complete Setup' : 'Connect Stripe'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <Text style={styles.sectionTitle}>Email & Communication</Text>

              <View style={styles.integrationCard} data-testid="card-email-integration">
                <View style={styles.integrationHeader}>
                  <View style={[styles.integrationIconContainer, { backgroundColor: colors.destructiveLight }]}>
                    <Feather name="mail" size={22} color={colors.destructive} />
                  </View>
                  <View style={styles.integrationInfo}>
                    <Text style={styles.integrationTitle}>Email Service</Text>
                    <Text style={styles.integrationSubtitle}>
                      {integrationHealth?.gmailConnected ? 'Gmail' : 'SendGrid'}
                    </Text>
                  </View>
                  <View style={styles.integrationBadgeBuiltIn}>
                    <Text style={styles.integrationBadgeBuiltInText}>
                      {hasEmailService ? 'Active' : 'Demo Mode'}
                    </Text>
                  </View>
                </View>

                <View style={styles.integrationDetails}>
                  {hasEmailService ? (
                    <>
                      {integrationHealth?.gmailEmail && (
                        <View style={styles.detailRow}>
                          <View style={styles.detailIconContainer}>
                            <Feather name="user" size={16} color={colors.primary} />
                          </View>
                          <Text style={styles.detailText}>{integrationHealth.gmailEmail}</Text>
                        </View>
                      )}
                      <Text style={styles.detailSubtext}>
                        Quotes and invoices are sent via email to your customers. Professional templates are included.
                      </Text>
                      <View style={styles.builtInInfo}>
                        <Feather name="check-circle" size={16} color={colors.success} />
                        <Text style={styles.builtInText}>Email service is active and ready</Text>
                      </View>
                    </>
                  ) : (
                    <>
                      <Text style={styles.detailSubtext}>
                        Running in demo mode - emails are logged to console. Contact support to enable email sending.
                      </Text>
                      <View style={styles.builtInInfo}>
                        <Feather name="info" size={16} color={colors.mutedForeground} />
                        <Text style={[styles.builtInText, { color: colors.mutedForeground }]}>
                          Platform-managed integration
                        </Text>
                      </View>
                    </>
                  )}
                </View>
              </View>

              <Text style={styles.sectionTitle}>Coming Soon</Text>

              <View style={[styles.integrationCard, { opacity: 0.7 }]} data-testid="card-calendar-integration">
                <View style={styles.integrationHeader}>
                  <View style={[styles.integrationIconContainer, { backgroundColor: '#4285f420' }]}>
                    <Feather name="calendar" size={22} color="#4285f4" />
                  </View>
                  <View style={styles.integrationInfo}>
                    <Text style={styles.integrationTitle}>Google Calendar</Text>
                    <Text style={styles.integrationSubtitle}>Sync job schedules</Text>
                  </View>
                  <View style={styles.integrationBadgeDisabled}>
                    <Text style={[styles.integrationBadgeText, { color: colors.mutedForeground }]}>
                      Coming Soon
                    </Text>
                  </View>
                </View>
                <View style={styles.integrationDetails}>
                  <Text style={styles.detailSubtext}>
                    Automatically sync your job schedules with Google Calendar. See all appointments in one place.
                  </Text>
                </View>
              </View>

              <View style={[styles.integrationCard, { opacity: 0.7 }]} data-testid="card-accounting-integration">
                <View style={styles.integrationHeader}>
                  <View style={[styles.integrationIconContainer, { backgroundColor: '#13b5ea20' }]}>
                    <Feather name="book" size={22} color="#13b5ea" />
                  </View>
                  <View style={styles.integrationInfo}>
                    <Text style={styles.integrationTitle}>Xero / MYOB</Text>
                    <Text style={styles.integrationSubtitle}>Accounting sync</Text>
                  </View>
                  <View style={styles.integrationBadgeDisabled}>
                    <Text style={[styles.integrationBadgeText, { color: colors.mutedForeground }]}>
                      Coming Soon
                    </Text>
                  </View>
                </View>
                <View style={styles.integrationDetails}>
                  <Text style={styles.detailSubtext}>
                    Sync invoices and payments with your accounting software. Keep your books up to date automatically.
                  </Text>
                </View>
              </View>

              <View style={[styles.integrationCard, { opacity: 0.7 }]} data-testid="card-sms-integration">
                <View style={styles.integrationHeader}>
                  <View style={[styles.integrationIconContainer, { backgroundColor: '#25d36620' }]}>
                    <Feather name="message-circle" size={22} color="#25d366" />
                  </View>
                  <View style={styles.integrationInfo}>
                    <Text style={styles.integrationTitle}>SMS Notifications</Text>
                    <Text style={styles.integrationSubtitle}>Text message alerts</Text>
                  </View>
                  <View style={styles.integrationBadgeDisabled}>
                    <Text style={[styles.integrationBadgeText, { color: colors.mutedForeground }]}>
                      Coming Soon
                    </Text>
                  </View>
                </View>
                <View style={styles.integrationDetails}>
                  <Text style={styles.detailSubtext}>
                    Send appointment reminders and job updates via SMS. Keep customers informed automatically.
                  </Text>
                </View>
              </View>

              <View style={styles.comingSoonCard}>
                <Feather name="zap" size={24} color={colors.mutedForeground} style={{ marginBottom: 8 }} />
                <Text style={styles.comingSoonTitle}>More Integrations Coming</Text>
                <Text style={styles.comingSoonText}>
                  We're working on integrations with more tools to help you run your business. Got a request? Let us know!
                </Text>
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </>
  );
}
