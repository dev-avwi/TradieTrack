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
import { Stack, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
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

interface XeroStatus {
  configured: boolean;
  connected: boolean;
  tenantName?: string;
  tenantId?: string;
  lastSyncAt?: string;
  status?: string;
  message?: string;
}

interface TwilioStatus {
  configured: boolean;
  platformConfigured: boolean;
  userConfigured: boolean;
  phoneNumber?: string;
  senderId?: string;
  demoMode: boolean;
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
  services?: {
    twilio?: {
      status: 'ready' | 'demo' | 'not_connected';
      description?: string;
    };
  };
}

interface GoogleCalendarStatus {
  connected: boolean;
  calendarEmail?: string;
  calendarName?: string;
  lastSyncAt?: string;
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
  const [isSyncingContacts, setIsSyncingContacts] = useState(false);
  const [isPushingInvoices, setIsPushingInvoices] = useState(false);
  const [isSendingTestSms, setIsSendingTestSms] = useState(false);
  const [stripeStatus, setStripeStatus] = useState<StripeConnectStatus | null>(null);
  const [integrationHealth, setIntegrationHealth] = useState<IntegrationHealth | null>(null);
  const [xeroStatus, setXeroStatus] = useState<XeroStatus | null>(null);
  const [googleCalendarStatus, setGoogleCalendarStatus] = useState<GoogleCalendarStatus | null>(null);
  const [isConnectingCalendar, setIsConnectingCalendar] = useState(false);
  const [showSmsPreview, setShowSmsPreview] = useState(false);
  const [isSyncingAllJobs, setIsSyncingAllJobs] = useState(false);

  const fetchIntegrationStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      const [stripeResponse, healthResponse, xeroResponse, calendarResponse] = await Promise.all([
        api.get<StripeConnectStatus>('/api/stripe-connect/status'),
        api.get<IntegrationHealth>('/api/integrations/health'),
        api.get<XeroStatus>('/api/integrations/xero/status'),
        api.get<GoogleCalendarStatus>('/api/integrations/google-calendar/status')
      ]);
      
      if (stripeResponse.data) {
        setStripeStatus(stripeResponse.data);
      }
      if (healthResponse.data) {
        setIntegrationHealth(healthResponse.data);
      }
      if (xeroResponse.data) {
        setXeroStatus(xeroResponse.data);
      }
      if (calendarResponse.data) {
        setGoogleCalendarStatus(calendarResponse.data);
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
  }, [fetchIntegrationStatus]);

  // Refresh data when screen gains focus (syncs with web app)
  useFocusEffect(
    useCallback(() => {
      fetchIntegrationStatus();
    }, [fetchIntegrationStatus])
  );

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

  const handleConnectXero = async () => {
    try {
      setIsConnecting(true);
      
      // Get auth URL from backend (this creates a mobile-specific state)
      const response = await api.post<{ authUrl: string; state: string }>('/api/integrations/xero/mobile-connect');
      if (!response.data?.authUrl) {
        Alert.alert('Error', response.error || 'Could not initiate Xero connection');
        return;
      }
      
      // Open Xero OAuth in in-app browser
      const result = await WebBrowser.openAuthSessionAsync(
        response.data.authUrl,
        'tradietrack://xero-callback'
      );
      
      if (result.type === 'success') {
        // Parse the callback URL to check success
        const url = new URL(result.url);
        const success = url.searchParams.get('success') === 'true';
        const error = url.searchParams.get('error');
        
        if (success) {
          Alert.alert('Success', 'Xero account connected successfully!');
          fetchIntegrationStatus();
        } else {
          Alert.alert('Connection Failed', error || 'Failed to connect Xero account');
        }
      } else if (result.type === 'cancel') {
        // User cancelled - no alert needed
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to connect Xero');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectXero = async () => {
    Alert.alert(
      'Disconnect Xero',
      'Are you sure you want to disconnect your Xero account? Invoice sync will stop working.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post('/api/integrations/xero/disconnect');
              Alert.alert('Success', 'Xero has been disconnected');
              fetchIntegrationStatus();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to disconnect Xero');
            }
          }
        }
      ]
    );
  };

  const handleSyncXeroContacts = async () => {
    setIsSyncingContacts(true);
    try {
      const response = await api.post<{ 
        success: boolean;
        imported?: number;
        updated?: number;
        skipped?: number;
        message?: string;
      }>('/api/integrations/xero/sync-contacts');
      
      if (response.data?.success) {
        const { imported = 0, updated = 0, skipped = 0 } = response.data;
        Alert.alert(
          'Contacts Synced',
          `Successfully synced contacts from Xero.\n\n${imported} imported\n${updated} updated\n${skipped} skipped (duplicates)`
        );
      } else {
        Alert.alert('Sync Complete', response.data?.message || 'Contacts synced from Xero');
      }
      fetchIntegrationStatus();
    } catch (error: any) {
      Alert.alert('Sync Failed', error.response?.data?.error || error.message || 'Failed to sync contacts from Xero');
    } finally {
      setIsSyncingContacts(false);
    }
  };

  const handlePushXeroInvoices = async () => {
    setIsPushingInvoices(true);
    try {
      const response = await api.post<{
        success: boolean;
        pushed?: number;
        skipped?: number;
        failed?: number;
        message?: string;
      }>('/api/integrations/xero/push-invoices');
      
      if (response.data?.success) {
        const { pushed = 0, skipped = 0, failed = 0 } = response.data;
        Alert.alert(
          'Invoices Pushed',
          `Successfully pushed invoices to Xero.\n\n${pushed} pushed\n${skipped} skipped (already synced)\n${failed} failed`
        );
      } else {
        Alert.alert('Push Complete', response.data?.message || 'Invoices pushed to Xero');
      }
      fetchIntegrationStatus();
    } catch (error: any) {
      Alert.alert('Push Failed', error.response?.data?.error || error.message || 'Failed to push invoices to Xero');
    } finally {
      setIsPushingInvoices(false);
    }
  };

  const handleTestSms = async () => {
    setIsSendingTestSms(true);
    try {
      const response = await api.post<{ success: boolean; message: string; preview?: any }>('/api/integrations/test-sms-preview');
      if (response.data?.success) {
        setShowSmsPreview(true);
        Alert.alert(
          'SMS Preview',
          `This is how your SMS notifications will appear:\n\n"Hi [Client Name], reminder: Your appointment with ${businessSettings?.businessName || 'Your Business'} is scheduled for tomorrow at 9:00 AM. Reply YES to confirm."\n\nNote: In demo mode, SMS messages are logged but not actually sent.`,
          [{ text: 'Got it', onPress: () => setShowSmsPreview(false) }]
        );
      } else {
        Alert.alert('Demo Mode', response.data?.message || 'SMS preview shown in demo mode');
      }
    } catch (error: any) {
      Alert.alert(
        'SMS Demo Preview',
        `This is how your SMS notifications will appear:\n\n"Hi [Client Name], reminder: Your appointment with ${businessSettings?.businessName || 'Your Business'} is scheduled for tomorrow at 9:00 AM. Reply YES to confirm."\n\nNote: SMS is currently in demo mode. Connect Twilio credentials to send real messages.`
      );
    } finally {
      setIsSendingTestSms(false);
    }
  };

  const handleConnectGoogleCalendar = async () => {
    setIsConnectingCalendar(true);
    try {
      // Pass source: 'mobile' so server prefixes state with 'mobile_' for deep link redirect
      const response = await api.post<{ authUrl: string }>('/api/integrations/google-calendar/connect', { source: 'mobile' });
      if (response.data?.authUrl) {
        const result = await WebBrowser.openAuthSessionAsync(
          response.data.authUrl,
          'tradietrack://google-calendar-callback'
        );
        
        if (result.type === 'success') {
          // Parse the callback URL to check success
          const url = new URL(result.url);
          const success = url.searchParams.get('success') === 'true';
          const error = url.searchParams.get('error');
          
          if (success) {
            // Refresh status to get the connected email
            const statusCheck = await api.get<GoogleCalendarStatus>('/api/integrations/google-calendar/status');
            if (statusCheck.data?.connected) {
              setGoogleCalendarStatus(statusCheck.data);
            }
            Alert.alert('Success', 'Google Calendar connected successfully!');
            fetchIntegrationStatus();
          } else {
            Alert.alert('Connection Failed', error || 'Failed to connect Google Calendar');
          }
        } else if (result.type === 'dismiss' || result.type === 'cancel') {
          // User cancelled OAuth flow - no action needed
        }
      } else {
        Alert.alert('Error', 'Could not initiate Google Calendar connection');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to connect Google Calendar');
    } finally {
      setIsConnectingCalendar(false);
    }
  };

  const handleDisconnectGoogleCalendar = async () => {
    Alert.alert(
      'Disconnect Google Calendar',
      'Are you sure you want to disconnect your Google Calendar? Job sync will stop working.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post('/api/integrations/google-calendar/disconnect');
              Alert.alert('Success', 'Google Calendar has been disconnected');
              fetchIntegrationStatus();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to disconnect Google Calendar');
            }
          }
        }
      ]
    );
  };

  const handleSyncAllJobs = async () => {
    setIsSyncingAllJobs(true);
    try {
      const response = await api.post<{
        success: boolean;
        synced?: number;
        skipped?: number;
        failed?: number;
        message?: string;
      }>('/api/integrations/google-calendar/sync-all-jobs');
      
      if (response.data?.success) {
        const { synced = 0, skipped = 0, failed = 0 } = response.data;
        Alert.alert(
          'Jobs Synced to Calendar',
          `Successfully synced your jobs to Google Calendar.\n\n${synced} synced\n${skipped} skipped (already synced or no date)\n${failed} failed`
        );
      } else {
        Alert.alert('Sync Complete', response.data?.message || 'Jobs synced to Google Calendar');
      }
      fetchIntegrationStatus();
    } catch (error: any) {
      Alert.alert('Sync Failed', error.response?.data?.error || error.message || 'Failed to sync jobs to Google Calendar');
    } finally {
      setIsSyncingAllJobs(false);
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

              <Text style={styles.sectionTitle}>Accounting</Text>

              <View style={styles.integrationCard} data-testid="card-xero-integration">
                <View style={styles.integrationHeader}>
                  <View style={[styles.integrationIconContainer, { backgroundColor: '#13b5ea20' }]}>
                    <Feather name="book" size={22} color="#13b5ea" />
                  </View>
                  <View style={styles.integrationInfo}>
                    <Text style={styles.integrationTitle}>Xero</Text>
                    <Text style={styles.integrationSubtitle}>
                      {xeroStatus?.connected ? xeroStatus.tenantName : 'Accounting sync'}
                    </Text>
                  </View>
                  <View style={[
                    styles.integrationBadge,
                    xeroStatus?.connected ? styles.integrationBadgeSuccess : 
                    xeroStatus?.configured ? styles.integrationBadgeWarning : styles.integrationBadgeDisabled
                  ]}>
                    <Text style={[
                      styles.integrationBadgeText,
                      { color: xeroStatus?.connected ? colors.success : 
                        xeroStatus?.configured ? colors.warning : colors.mutedForeground }
                    ]}>
                      {xeroStatus?.connected ? 'Connected' : 
                       xeroStatus?.configured ? 'Not Connected' : 'Not Configured'}
                    </Text>
                  </View>
                </View>

                <View style={styles.integrationDetails}>
                  {xeroStatus?.connected ? (
                    <>
                      <View style={styles.detailRow}>
                        <View style={styles.detailIconContainer}>
                          <Feather name="check-circle" size={16} color={colors.success} />
                        </View>
                        <Text style={styles.detailText}>
                          Connected to {xeroStatus.tenantName}
                        </Text>
                      </View>
                      {xeroStatus.lastSyncAt && (
                        <View style={styles.detailRow}>
                          <View style={styles.detailIconContainer}>
                            <Feather name="clock" size={16} color={colors.primary} />
                          </View>
                          <Text style={styles.detailText}>
                            Last synced: {new Date(xeroStatus.lastSyncAt).toLocaleDateString()}
                          </Text>
                        </View>
                      )}
                      <Text style={styles.detailSubtext}>
                        Invoices are automatically synced to Xero when sent. Contacts can be imported from Xero.
                      </Text>
                      <View style={{ gap: 8, marginTop: 8 }}>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <TouchableOpacity 
                            style={[styles.actionButton, styles.actionButtonPrimary, { flex: 1 }]}
                            onPress={handleSyncXeroContacts}
                            disabled={isSyncingContacts || isPushingInvoices}
                            data-testid="button-sync-xero-contacts"
                          >
                            {isSyncingContacts ? (
                              <ActivityIndicator size="small" color={colors.primaryForeground} />
                            ) : (
                              <Feather name="download" size={16} color={colors.primaryForeground} />
                            )}
                            <Text style={[styles.actionButtonText, styles.actionButtonTextPrimary]}>
                              {isSyncingContacts ? 'Syncing...' : 'Sync Contacts'}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity 
                            style={[styles.actionButton, styles.actionButtonPrimary, { flex: 1 }]}
                            onPress={handlePushXeroInvoices}
                            disabled={isSyncingContacts || isPushingInvoices}
                            data-testid="button-push-xero-invoices"
                          >
                            {isPushingInvoices ? (
                              <ActivityIndicator size="small" color={colors.primaryForeground} />
                            ) : (
                              <Feather name="upload" size={16} color={colors.primaryForeground} />
                            )}
                            <Text style={[styles.actionButtonText, styles.actionButtonTextPrimary]}>
                              {isPushingInvoices ? 'Pushing...' : 'Push Invoices'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                        <TouchableOpacity 
                          style={[styles.actionButton, styles.actionButtonSecondary]}
                          onPress={handleDisconnectXero}
                          data-testid="button-disconnect-xero"
                        >
                          <Feather name="link-2" size={16} color={colors.destructive} />
                          <Text style={[styles.actionButtonText, { color: colors.destructive }]}>
                            Disconnect Xero
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  ) : (
                    <>
                      <Text style={styles.detailSubtext}>
                        {xeroStatus?.configured 
                          ? 'Connect your Xero account to automatically sync invoices and import contacts.'
                          : 'Xero integration is not configured. Contact support to enable this feature.'}
                      </Text>
                      <View style={styles.featureList}>
                        <View style={styles.featureItem}>
                          <Feather name="check" size={14} color={colors.success} />
                          <Text style={styles.featureText}>Auto-sync invoices when sent</Text>
                        </View>
                        <View style={styles.featureItem}>
                          <Feather name="check" size={14} color={colors.success} />
                          <Text style={styles.featureText}>Import contacts from Xero</Text>
                        </View>
                        <View style={styles.featureItem}>
                          <Feather name="check" size={14} color={colors.success} />
                          <Text style={styles.featureText}>Keep your books up to date</Text>
                        </View>
                      </View>
                      {xeroStatus?.configured && (
                        <TouchableOpacity 
                          style={[styles.actionButton, styles.actionButtonPrimary]}
                          onPress={handleConnectXero}
                          data-testid="button-connect-xero"
                        >
                          <Feather name="link" size={16} color={colors.primaryForeground} />
                          <Text style={[styles.actionButtonText, styles.actionButtonTextPrimary]}>
                            Connect Xero
                          </Text>
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </View>
              </View>

              <Text style={styles.sectionTitle}>SMS Notifications</Text>

              <View style={styles.integrationCard} data-testid="card-sms-integration">
                <View style={styles.integrationHeader}>
                  <View style={[styles.integrationIconContainer, { backgroundColor: '#25d36620' }]}>
                    <Feather name="message-circle" size={22} color="#25d366" />
                  </View>
                  <View style={styles.integrationInfo}>
                    <Text style={styles.integrationTitle}>SMS Notifications</Text>
                    <Text style={styles.integrationSubtitle}>Twilio-powered messaging</Text>
                  </View>
                  <View style={[
                    styles.integrationBadge,
                    integrationHealth?.services?.twilio?.status === 'ready' 
                      ? styles.integrationBadgeSuccess 
                      : styles.integrationBadgeWarning
                  ]}>
                    <Text style={[
                      styles.integrationBadgeText,
                      { color: integrationHealth?.services?.twilio?.status === 'ready' 
                          ? colors.success 
                          : colors.warning }
                    ]}>
                      {integrationHealth?.services?.twilio?.status === 'ready' ? 'Connected' : 'Demo Mode'}
                    </Text>
                  </View>
                </View>

                <View style={styles.integrationDetails}>
                  {integrationHealth?.services?.twilio?.status !== 'ready' && (
                    <View style={styles.warningBanner}>
                      <Feather name="info" size={18} color={colors.warning} />
                      <Text style={styles.warningText}>
                        SMS is in demo mode during beta. Messages are logged but not sent.
                      </Text>
                    </View>
                  )}
                  <Text style={styles.detailSubtext}>
                    {integrationHealth?.services?.twilio?.status === 'ready'
                      ? 'SMS notifications are active. Send appointment reminders and job updates via SMS.'
                      : 'Send appointment reminders and job updates via SMS. Keep customers informed automatically.'}
                  </Text>
                  <View style={styles.featureList}>
                    <View style={styles.featureItem}>
                      <Feather name="check" size={14} color={colors.success} />
                      <Text style={styles.featureText}>Appointment reminders</Text>
                    </View>
                    <View style={styles.featureItem}>
                      <Feather name="check" size={14} color={colors.success} />
                      <Text style={styles.featureText}>Job status updates</Text>
                    </View>
                    <View style={styles.featureItem}>
                      <Feather name="check" size={14} color={colors.success} />
                      <Text style={styles.featureText}>Payment confirmations</Text>
                    </View>
                  </View>
                  <TouchableOpacity 
                    style={[styles.actionButton, styles.actionButtonSecondary]}
                    onPress={handleTestSms}
                    disabled={isSendingTestSms}
                    data-testid="button-test-sms"
                  >
                    {isSendingTestSms ? (
                      <ActivityIndicator size="small" color={colors.foreground} />
                    ) : (
                      <Feather name="eye" size={16} color={colors.foreground} />
                    )}
                    <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>
                      {isSendingTestSms ? 'Loading...' : 'Preview SMS Template'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.sectionTitle}>Calendar</Text>

              <View style={styles.integrationCard} data-testid="card-calendar-integration">
                <View style={styles.integrationHeader}>
                  <View style={[styles.integrationIconContainer, { backgroundColor: '#4285f420' }]}>
                    <Feather name="calendar" size={22} color="#4285f4" />
                  </View>
                  <View style={styles.integrationInfo}>
                    <Text style={styles.integrationTitle}>Google Calendar</Text>
                    <Text style={styles.integrationSubtitle}>
                      {googleCalendarStatus?.connected ? googleCalendarStatus.calendarEmail : 'Sync job schedules'}
                    </Text>
                  </View>
                  <View style={[
                    styles.integrationBadge,
                    googleCalendarStatus?.connected ? styles.integrationBadgeSuccess : styles.integrationBadgeDisabled
                  ]}>
                    <Text style={[
                      styles.integrationBadgeText,
                      { color: googleCalendarStatus?.connected ? colors.success : colors.mutedForeground }
                    ]}>
                      {googleCalendarStatus?.connected ? 'Connected' : 'Not Connected'}
                    </Text>
                  </View>
                </View>
                <View style={styles.integrationDetails}>
                  {googleCalendarStatus?.connected ? (
                    <>
                      <View style={styles.detailRow}>
                        <View style={styles.detailIconContainer}>
                          <Feather name="check-circle" size={16} color={colors.success} />
                        </View>
                        <Text style={styles.detailText}>
                          Connected to {googleCalendarStatus.calendarEmail || 'Google Calendar'}
                        </Text>
                      </View>
                      <Text style={styles.detailSubtext}>
                        Jobs with scheduled dates will automatically sync to your Google Calendar.
                      </Text>
                      <TouchableOpacity 
                        style={[styles.actionButton, styles.actionButtonPrimary, { marginBottom: 8 }]}
                        onPress={handleSyncAllJobs}
                        disabled={isSyncingAllJobs}
                        data-testid="button-sync-all-jobs"
                      >
                        {isSyncingAllJobs ? (
                          <ActivityIndicator size="small" color={colors.primaryForeground} />
                        ) : (
                          <Feather name="refresh-cw" size={16} color={colors.primaryForeground} />
                        )}
                        <Text style={[styles.actionButtonText, styles.actionButtonTextPrimary]}>
                          {isSyncingAllJobs ? 'Syncing...' : 'Sync All Jobs to Calendar'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.actionButton, styles.actionButtonSecondary]}
                        onPress={handleDisconnectGoogleCalendar}
                        data-testid="button-disconnect-google-calendar"
                      >
                        <Feather name="link-2" size={16} color={colors.destructive} />
                        <Text style={[styles.actionButtonText, { color: colors.destructive }]}>
                          Disconnect
                        </Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <Text style={styles.detailSubtext}>
                        Automatically sync your job schedules with Google Calendar. See all appointments in one place.
                      </Text>
                      <View style={styles.featureList}>
                        <View style={styles.featureItem}>
                          <Feather name="check" size={14} color={colors.success} />
                          <Text style={styles.featureText}>Auto-sync scheduled jobs</Text>
                        </View>
                        <View style={styles.featureItem}>
                          <Feather name="check" size={14} color={colors.success} />
                          <Text style={styles.featureText}>View all appointments in calendar</Text>
                        </View>
                        <View style={styles.featureItem}>
                          <Feather name="check" size={14} color={colors.success} />
                          <Text style={styles.featureText}>Get reminders on your phone</Text>
                        </View>
                      </View>
                      <TouchableOpacity 
                        style={[styles.actionButton, styles.actionButtonPrimary]}
                        onPress={handleConnectGoogleCalendar}
                        disabled={isConnectingCalendar}
                        data-testid="button-connect-google-calendar"
                      >
                        {isConnectingCalendar ? (
                          <ActivityIndicator size="small" color={colors.primaryForeground} />
                        ) : (
                          <Feather name="link" size={16} color={colors.primaryForeground} />
                        )}
                        <Text style={[styles.actionButtonText, styles.actionButtonTextPrimary]}>
                          {isConnectingCalendar ? 'Connecting...' : 'Connect Google Calendar'}
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
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
