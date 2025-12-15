import { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Linking,
  Switch
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../../src/lib/store';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, typography } from '../../src/lib/design-tokens';
import AppTour from '../../src/components/AppTour';
import { Slider } from '../../src/components/ui/Slider';

const PLAN_FEATURES = [
  { icon: 'briefcase', text: 'Unlimited jobs, quotes & invoices', pro: true },
  { icon: 'star', text: 'AI-powered suggestions', pro: true },
  { icon: 'sliders', text: 'Custom branding & theming', pro: true },
  { icon: 'users', text: 'Team management & permissions', pro: true },
  { icon: 'mail', text: 'Automated email reminders', pro: true },
  { icon: 'help-circle', text: 'Priority support', pro: true },
];

const SETTINGS_TABS = [
  { key: 'jobs', label: 'Jobs', icon: 'briefcase' },
  { key: 'pay', label: 'Pay', icon: 'credit-card' },
  { key: 'apps', label: 'Apps', icon: 'smartphone' },
  { key: 'alerts', label: 'Alerts', icon: 'bell' },
  { key: 'plan', label: 'Plan', icon: 'award' },
  { key: 'help', label: 'Help', icon: 'help-circle' },
];

const GEOFENCE_STORAGE_KEY = '@tradietrack/global_geofence_settings';
const NOTIFICATION_SETTINGS_KEY = '@tradietrack/notification_settings';

interface NotificationSettings {
  push: {
    newJobAssignments: boolean;
    jobStatusChanges: boolean;
    paymentReceived: boolean;
    quoteAccepted: boolean;
    teamMessages: boolean;
  };
  email: {
    dailyDigest: boolean;
    weeklySummary: boolean;
    paymentReceipts: boolean;
    overdueReminders: boolean;
  };
  sms: {
    urgentJobAlerts: boolean;
    paymentConfirmations: boolean;
  };
}

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  push: {
    newJobAssignments: true,
    jobStatusChanges: true,
    paymentReceived: true,
    quoteAccepted: true,
    teamMessages: true,
  },
  email: {
    dailyDigest: false,
    weeklySummary: true,
    paymentReceipts: true,
    overdueReminders: true,
  },
  sms: {
    urgentJobAlerts: false,
    paymentConfirmations: false,
  },
};

interface IntegrationStatus {
  stripe: boolean;
  gmail: boolean;
  calendar: boolean;
}

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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
  headerLeft: {
    flex: 1,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.foreground,
  },
  pageSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  saveButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
  },
  saveButtonText: {
    color: colors.primaryForeground,
    fontSize: 14,
    fontWeight: '600',
  },
  subscriptionLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  subscriptionLinkContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  subscriptionLinkText: {
    flex: 1,
  },
  subscriptionLinkTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.foreground,
  },
  subscriptionLinkSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  tabsScroll: {
    marginBottom: spacing.lg,
    marginHorizontal: -spacing.lg,
  },
  tabsContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  tabActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  tabText: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: '500',
  },
  planSection: {
    gap: spacing.lg,
  },
  subscriptionCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  subscriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  subscriptionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
  },
  planInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primaryLight,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  planIconContainer: {
    width: 44,
    height: 44,
    borderRadius: radius.xl,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planName: {
    ...typography.body,
    fontWeight: '600',
    color: colors.foreground,
  },
  planDescription: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  planPriceBadge: {
    backgroundColor: colors.muted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.lg,
  },
  planPriceText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.foreground,
  },
  proFeaturesTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.mutedForeground,
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  featureText: {
    flex: 1,
    ...typography.body,
    color: colors.foreground,
  },
  proBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  proBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
  upgradeButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  upgradeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  manageBillingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  manageBillingText: {
    ...typography.body,
    color: colors.foreground,
  },
  tabContentSection: {
    gap: spacing.lg,
  },
  settingsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  settingsCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
  },
  settingsCardInfo: {
    flex: 1,
  },
  settingsCardTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.foreground,
  },
  settingsCardSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  settingsInfoCard: {
    backgroundColor: colors.muted,
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  settingsInfoTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  settingsInfoText: {
    ...typography.body,
    color: colors.mutedForeground,
    lineHeight: 20,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.mutedForeground,
    letterSpacing: 0.5,
    marginBottom: spacing.md,
    marginTop: spacing.lg,
    textTransform: 'uppercase',
  },
  integrationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  integrationRowLast: {
    borderBottomWidth: 0,
  },
  integrationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  integrationIconContainer: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  integrationInfo: {
    flex: 1,
  },
  integrationName: {
    ...typography.body,
    fontWeight: '600',
    color: colors.foreground,
  },
  integrationStatus: {
    ...typography.caption,
    marginTop: 2,
  },
  statusConnected: {
    color: colors.success || '#22c55e',
  },
  statusNotConnected: {
    color: colors.mutedForeground,
  },
  connectButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
  },
  connectButtonText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.primary,
  },
  appStoreCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: spacing.md,
  },
  appStoreBadges: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  storeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.foreground,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
  storeBadgeText: {
    ...typography.caption,
    color: colors.background,
    fontWeight: '600',
  },
  qrCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  qrPlaceholder: {
    width: 120,
    height: 120,
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.md,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    marginTop: spacing.md,
  },
  shareButtonText: {
    ...typography.body,
    color: colors.primaryForeground,
    fontWeight: '600',
  },
  notificationToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  notificationToggleRowLast: {
    borderBottomWidth: 0,
  },
  notificationToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  notificationToggleIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationToggleInfo: {
    flex: 1,
  },
  notificationToggleTitle: {
    ...typography.body,
    fontWeight: '500',
    color: colors.foreground,
  },
  notificationToggleSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
});

export default function SettingsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { businessSettings } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('jobs');
  const [showTour, setShowTour] = useState(false);
  
  // Global geofence settings
  const [geofenceEnabled, setGeofenceEnabled] = useState(false);
  const [geofenceRadius, setGeofenceRadius] = useState(100);
  const [autoClockIn, setAutoClockIn] = useState(true);
  const [autoClockOut, setAutoClockOut] = useState(true);

  // Notification settings
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);

  // Integration status (mock - would come from API in production)
  const [integrationStatus, setIntegrationStatus] = useState<IntegrationStatus>({
    stripe: false,
    gmail: false,
    calendar: false,
  });

  const loadGeofenceSettings = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(GEOFENCE_STORAGE_KEY);
      if (stored) {
        const settings = JSON.parse(stored);
        setGeofenceEnabled(settings.enabled ?? false);
        setGeofenceRadius(settings.radius ?? 100);
        setAutoClockIn(settings.autoClockIn ?? true);
        setAutoClockOut(settings.autoClockOut ?? true);
      }
    } catch (error) {
      console.error('Failed to load geofence settings:', error);
    }
  }, []);

  const saveGeofenceSettings = useCallback(async (settings: {
    enabled: boolean;
    radius: number;
    autoClockIn: boolean;
    autoClockOut: boolean;
  }) => {
    try {
      await AsyncStorage.setItem(GEOFENCE_STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save geofence settings:', error);
    }
  }, []);

  const handleGeofenceEnabledChange = useCallback((value: boolean) => {
    setGeofenceEnabled(value);
    setGeofenceRadius(prev => {
      setAutoClockIn(prevIn => {
        setAutoClockOut(prevOut => {
          saveGeofenceSettings({ enabled: value, radius: prev, autoClockIn: prevIn, autoClockOut: prevOut });
          return prevOut;
        });
        return prevIn;
      });
      return prev;
    });
  }, [saveGeofenceSettings]);

  const handleRadiusChange = useCallback((value: number | number[]) => {
    // Slider can return array or single value, normalize to number
    const numValue = Array.isArray(value) ? value[0] : value;
    setGeofenceRadius(numValue);
  }, []);

  const handleRadiusChangeComplete = useCallback((value: number | number[]) => {
    const numValue = Array.isArray(value) ? value[0] : value;
    setGeofenceEnabled(prev => {
      setAutoClockIn(prevIn => {
        setAutoClockOut(prevOut => {
          saveGeofenceSettings({ enabled: prev, radius: numValue, autoClockIn: prevIn, autoClockOut: prevOut });
          return prevOut;
        });
        return prevIn;
      });
      return prev;
    });
  }, [saveGeofenceSettings]);

  const handleAutoClockInChange = useCallback((value: boolean) => {
    setAutoClockIn(value);
    setGeofenceEnabled(prev => {
      setGeofenceRadius(prevRadius => {
        setAutoClockOut(prevOut => {
          saveGeofenceSettings({ enabled: prev, radius: prevRadius, autoClockIn: value, autoClockOut: prevOut });
          return prevOut;
        });
        return prevRadius;
      });
      return prev;
    });
  }, [saveGeofenceSettings]);

  const handleAutoClockOutChange = useCallback((value: boolean) => {
    setAutoClockOut(value);
    setGeofenceEnabled(prev => {
      setGeofenceRadius(prevRadius => {
        setAutoClockIn(prevIn => {
          saveGeofenceSettings({ enabled: prev, radius: prevRadius, autoClockIn: prevIn, autoClockOut: value });
          return prevIn;
        });
        return prevRadius;
      });
      return prev;
    });
  }, [saveGeofenceSettings]);

  // Notification settings handlers
  const loadNotificationSettings = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
      if (stored) {
        const settings = JSON.parse(stored) as NotificationSettings;
        setNotificationSettings(settings);
      }
    } catch (error) {
      console.error('Failed to load notification settings:', error);
    }
  }, []);

  const saveNotificationSettings = useCallback(async (settings: NotificationSettings) => {
    try {
      await AsyncStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save notification settings:', error);
    }
  }, []);

  const updatePushSetting = useCallback((key: keyof NotificationSettings['push'], value: boolean) => {
    setNotificationSettings(prev => {
      const updated = { ...prev, push: { ...prev.push, [key]: value } };
      saveNotificationSettings(updated);
      return updated;
    });
  }, [saveNotificationSettings]);

  const updateEmailSetting = useCallback((key: keyof NotificationSettings['email'], value: boolean) => {
    setNotificationSettings(prev => {
      const updated = { ...prev, email: { ...prev.email, [key]: value } };
      saveNotificationSettings(updated);
      return updated;
    });
  }, [saveNotificationSettings]);

  const updateSmsSetting = useCallback((key: keyof NotificationSettings['sms'], value: boolean) => {
    setNotificationSettings(prev => {
      const updated = { ...prev, sms: { ...prev.sms, [key]: value } };
      saveNotificationSettings(updated);
      return updated;
    });
  }, [saveNotificationSettings]);

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([loadGeofenceSettings(), loadNotificationSettings()]);
    setIsLoading(false);
  }, [loadGeofenceSettings, loadNotificationSettings]);

  useEffect(() => {
    refreshData();
  }, []);

  const currentPlan = 'free';

  return (
    <>
      <Stack.Screen 
        options={{ 
          headerShown: false,
        }} 
      />
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
            <View style={styles.headerLeft}>
              <Text style={styles.pageTitle}>Settings</Text>
              <Text style={styles.pageSubtitle}>Manage your business profile and preferences</Text>
            </View>
            <TouchableOpacity style={styles.saveButton}>
              <Text style={styles.saveButtonText}>Save Changes</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={styles.subscriptionLink}
            onPress={() => {}}
          >
            <View style={styles.subscriptionLinkContent}>
              <Feather name="award" size={20} color={colors.primary} />
              <View style={styles.subscriptionLinkText}>
                <Text style={styles.subscriptionLinkTitle}>Manage Subscription</Text>
                <Text style={styles.subscriptionLinkSubtitle}>View plan details, usage & billing</Text>
              </View>
            </View>
            <Feather name="external-link" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>

          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.tabsScroll}
            contentContainerStyle={styles.tabsContent}
          >
            {SETTINGS_TABS.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.tab, isActive && styles.tabActive]}
                  onPress={() => setActiveTab(tab.key)}
                >
                  <Feather 
                    name={tab.icon as any}
                    size={16} 
                    color={isActive ? colors.primary : colors.mutedForeground} 
                  />
                  <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {activeTab === 'jobs' && (
            <View style={styles.tabContentSection}>
              <View style={styles.subscriptionCard}>
                <View style={styles.subscriptionHeader}>
                  <Feather name="map-pin" size={20} color={colors.primary} />
                  <Text style={styles.subscriptionTitle}>Geofence Settings</Text>
                </View>

                <View style={[styles.featureRow, { justifyContent: 'space-between' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 }}>
                    <Feather name="target" size={16} color={colors.mutedForeground} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.featureText}>Enable Geofence for New Jobs</Text>
                      <Text style={[styles.planDescription, { marginTop: 2 }]}>Auto-enable location tracking on new jobs</Text>
                    </View>
                  </View>
                  <Switch
                    value={geofenceEnabled}
                    onValueChange={handleGeofenceEnabledChange}
                    trackColor={{ false: colors.muted, true: colors.primaryLight }}
                    thumbColor={geofenceEnabled ? colors.primary : colors.mutedForeground}
                  />
                </View>

                {geofenceEnabled && (
                  <>
                    <View style={{ marginTop: spacing.lg, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border }}>
                      <Text style={styles.featureText}>Default Radius: {geofenceRadius}m</Text>
                      <View style={{ marginTop: spacing.md }}>
                        <Slider
                          minimumValue={50}
                          maximumValue={500}
                          step={25}
                          value={geofenceRadius}
                          onValueChange={handleRadiusChange}
                          onSlidingComplete={handleRadiusChangeComplete}
                          minimumTrackTintColor={colors.primary}
                          maximumTrackTintColor={colors.muted}
                          thumbTintColor={colors.primary}
                        />
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs }}>
                        <Text style={styles.planDescription}>50m</Text>
                        <Text style={styles.planDescription}>500m</Text>
                      </View>
                    </View>

                    <View style={[styles.featureRow, { justifyContent: 'space-between', marginTop: spacing.md }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 }}>
                        <Feather name="log-in" size={16} color={colors.mutedForeground} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.featureText}>Auto Clock-In</Text>
                          <Text style={[styles.planDescription, { marginTop: 2 }]}>Start timer when entering job site</Text>
                        </View>
                      </View>
                      <Switch
                        value={autoClockIn}
                        onValueChange={handleAutoClockInChange}
                        trackColor={{ false: colors.muted, true: colors.primaryLight }}
                        thumbColor={autoClockIn ? colors.primary : colors.mutedForeground}
                      />
                    </View>

                    <View style={[styles.featureRow, { justifyContent: 'space-between', marginTop: spacing.sm }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 }}>
                        <Feather name="log-out" size={16} color={colors.mutedForeground} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.featureText}>Auto Clock-Out</Text>
                          <Text style={[styles.planDescription, { marginTop: 2 }]}>Stop timer when leaving job site</Text>
                        </View>
                      </View>
                      <Switch
                        value={autoClockOut}
                        onValueChange={handleAutoClockOutChange}
                        trackColor={{ false: colors.muted, true: colors.primaryLight }}
                        thumbColor={autoClockOut ? colors.primary : colors.mutedForeground}
                      />
                    </View>
                  </>
                )}
              </View>

              <View style={styles.settingsInfoCard}>
                <Text style={styles.settingsInfoTitle}>About Geofencing</Text>
                <Text style={styles.settingsInfoText}>
                  Geofencing uses your phone's location to automatically track when you arrive at and leave job sites. These settings apply as defaults for all new jobs you create.
                </Text>
              </View>
            </View>
          )}

          {activeTab === 'plan' && (
            <View style={styles.planSection}>
              <View style={styles.subscriptionCard}>
                <View style={styles.subscriptionHeader}>
                  <Feather name="award" size={20} color={colors.primary} />
                  <Text style={styles.subscriptionTitle}>Your Subscription</Text>
                </View>

                <View style={styles.planInfo}>
                  <View style={styles.planBadge}>
                    <View style={styles.planIconContainer}>
                      <Feather name="award" size={20} color={colors.primary} />
                    </View>
                    <View>
                      <Text style={styles.planName}>Free Plan</Text>
                      <Text style={styles.planDescription}>Limited features</Text>
                    </View>
                  </View>
                  <View style={styles.planPriceBadge}>
                    <Text style={styles.planPriceText}>Free</Text>
                  </View>
                </View>

                <Text style={styles.proFeaturesTitle}>PRO FEATURES INCLUDE</Text>

                {PLAN_FEATURES.map((feature, index) => {
                  return (
                    <View key={index} style={styles.featureRow}>
                      <Feather name={feature.icon as any} size={16} color={colors.mutedForeground} />
                      <Text style={styles.featureText}>{feature.text}</Text>
                      {feature.pro && (
                        <View style={styles.proBadge}>
                          <Text style={styles.proBadgeText}>Pro</Text>
                        </View>
                      )}
                    </View>
                  );
                })}

                <TouchableOpacity style={styles.upgradeButton}>
                  <Text style={styles.upgradeButtonText}>Upgrade to Pro - $39/month</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.manageBillingButton}>
                  <Feather name="dollar-sign" size={16} color={colors.foreground} />
                  <Text style={styles.manageBillingText}>Manage Billing</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {activeTab === 'pay' && (
            <View style={styles.tabContentSection}>
              <TouchableOpacity 
                style={styles.settingsCard}
                onPress={() => router.push('/more/payments')}
              >
                <View style={styles.settingsCardHeader}>
                  <Feather name="credit-card" size={20} color={colors.primary} />
                  <View style={styles.settingsCardInfo}>
                    <Text style={styles.settingsCardTitle}>Payment Settings</Text>
                    <Text style={styles.settingsCardSubtitle}>Stripe connection, fees, payout settings</Text>
                  </View>
                </View>
                <Feather name="external-link" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>

              <View style={styles.settingsInfoCard}>
                <Text style={styles.settingsInfoTitle}>Payment Processing</Text>
                <Text style={styles.settingsInfoText}>
                  Accept payments directly from your invoices. Customers can pay by card through secure Stripe links.
                </Text>
              </View>
            </View>
          )}

          {activeTab === 'apps' && (
            <View style={styles.tabContentSection}>
              {/* Connected Apps Card */}
              <View style={styles.subscriptionCard}>
                <View style={styles.subscriptionHeader}>
                  <Feather name="link" size={20} color={colors.primary} />
                  <Text style={styles.subscriptionTitle}>Connected Apps</Text>
                </View>

                {/* Stripe Integration */}
                <View style={styles.integrationRow}>
                  <View style={styles.integrationLeft}>
                    <View style={[styles.integrationIconContainer, { backgroundColor: '#635bff20' }]}>
                      <Feather name="credit-card" size={20} color="#635bff" />
                    </View>
                    <View style={styles.integrationInfo}>
                      <Text style={styles.integrationName}>Stripe Connect</Text>
                      <Text style={[
                        styles.integrationStatus,
                        integrationStatus.stripe ? styles.statusConnected : styles.statusNotConnected
                      ]}>
                        {integrationStatus.stripe ? 'Connected' : 'Not connected'}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity 
                    style={styles.connectButton}
                    onPress={() => router.push('/more/payments')}
                    data-testid="button-stripe-connect"
                  >
                    <Text style={styles.connectButtonText}>
                      {integrationStatus.stripe ? 'Manage' : 'Connect'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Gmail Integration */}
                <View style={styles.integrationRow}>
                  <View style={styles.integrationLeft}>
                    <View style={[styles.integrationIconContainer, { backgroundColor: '#ea433520' }]}>
                      <Feather name="mail" size={20} color="#ea4335" />
                    </View>
                    <View style={styles.integrationInfo}>
                      <Text style={styles.integrationName}>Gmail / Email</Text>
                      <Text style={[
                        styles.integrationStatus,
                        integrationStatus.gmail ? styles.statusConnected : styles.statusNotConnected
                      ]}>
                        {integrationStatus.gmail ? 'Connected' : 'Not connected'}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity 
                    style={styles.connectButton}
                    onPress={() => router.push('/more/integrations')}
                    data-testid="button-gmail-connect"
                  >
                    <Text style={styles.connectButtonText}>
                      {integrationStatus.gmail ? 'Manage' : 'Connect'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Google Calendar Integration */}
                <View style={[styles.integrationRow, styles.integrationRowLast]}>
                  <View style={styles.integrationLeft}>
                    <View style={[styles.integrationIconContainer, { backgroundColor: '#4285f420' }]}>
                      <Feather name="calendar" size={20} color="#4285f4" />
                    </View>
                    <View style={styles.integrationInfo}>
                      <Text style={styles.integrationName}>Google Calendar</Text>
                      <Text style={[
                        styles.integrationStatus,
                        integrationStatus.calendar ? styles.statusConnected : styles.statusNotConnected
                      ]}>
                        {integrationStatus.calendar ? 'Connected' : 'Not connected'}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity 
                    style={styles.connectButton}
                    onPress={() => router.push('/more/integrations')}
                    data-testid="button-calendar-connect"
                  >
                    <Text style={styles.connectButtonText}>
                      {integrationStatus.calendar ? 'Manage' : 'Connect'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* App Store Links */}
              <View style={styles.appStoreCard}>
                <Feather name="download" size={24} color={colors.primary} />
                <Text style={styles.settingsCardTitle}>Get the App</Text>
                <Text style={[styles.settingsCardSubtitle, { textAlign: 'center' }]}>
                  Download TradieTrack on your mobile device
                </Text>
                <View style={styles.appStoreBadges}>
                  <TouchableOpacity 
                    style={styles.storeBadge}
                    onPress={() => Linking.openURL('https://apps.apple.com')}
                    data-testid="button-app-store"
                  >
                    <Feather name="smartphone" size={16} color={colors.background} />
                    <Text style={styles.storeBadgeText}>App Store</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.storeBadge}
                    onPress={() => Linking.openURL('https://play.google.com')}
                    data-testid="button-play-store"
                  >
                    <Feather name="play" size={16} color={colors.background} />
                    <Text style={styles.storeBadgeText}>Google Play</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* QR Code for App Share */}
              <View style={styles.qrCard}>
                <Text style={styles.settingsCardTitle}>Share App</Text>
                <Text style={[styles.settingsCardSubtitle, { textAlign: 'center' }]}>
                  Scan to download TradieTrack
                </Text>
                <View style={styles.qrPlaceholder}>
                  <Feather name="grid" size={48} color={colors.mutedForeground} />
                </View>
                <TouchableOpacity 
                  style={styles.shareButton}
                  onPress={() => {}}
                  data-testid="button-share-app"
                >
                  <Feather name="share-2" size={18} color={colors.primaryForeground} />
                  <Text style={styles.shareButtonText}>Share Download Link</Text>
                </TouchableOpacity>
              </View>

              {/* More Integrations Link */}
              <TouchableOpacity 
                style={styles.settingsCard}
                onPress={() => router.push('/more/integrations')}
                data-testid="button-more-integrations"
              >
                <View style={styles.settingsCardHeader}>
                  <Feather name="plus-circle" size={20} color={colors.primary} />
                  <View style={styles.settingsCardInfo}>
                    <Text style={styles.settingsCardTitle}>More Integrations</Text>
                    <Text style={styles.settingsCardSubtitle}>Browse all available integrations</Text>
                  </View>
                </View>
                <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          )}

          {activeTab === 'alerts' && (
            <View style={styles.tabContentSection}>
              {/* Push Notifications Section */}
              <View style={styles.subscriptionCard}>
                <View style={styles.subscriptionHeader}>
                  <Feather name="smartphone" size={20} color={colors.primary} />
                  <Text style={styles.subscriptionTitle}>Push Notifications</Text>
                </View>

                {/* New Job Assignments */}
                <View style={styles.notificationToggleRow}>
                  <View style={styles.notificationToggleLeft}>
                    <View style={[styles.notificationToggleIcon, { backgroundColor: colors.primaryLight }]}>
                      <Feather name="briefcase" size={16} color={colors.primary} />
                    </View>
                    <View style={styles.notificationToggleInfo}>
                      <Text style={styles.notificationToggleTitle}>New Job Assignments</Text>
                      <Text style={styles.notificationToggleSubtitle}>Get notified when assigned to a job</Text>
                    </View>
                  </View>
                  <Switch
                    value={notificationSettings.push.newJobAssignments}
                    onValueChange={(value) => updatePushSetting('newJobAssignments', value)}
                    trackColor={{ false: colors.muted, true: colors.primaryLight }}
                    thumbColor={notificationSettings.push.newJobAssignments ? colors.primary : colors.mutedForeground}
                    data-testid="switch-push-new-job"
                  />
                </View>

                {/* Job Status Changes */}
                <View style={styles.notificationToggleRow}>
                  <View style={styles.notificationToggleLeft}>
                    <View style={[styles.notificationToggleIcon, { backgroundColor: colors.primaryLight }]}>
                      <Feather name="refresh-cw" size={16} color={colors.primary} />
                    </View>
                    <View style={styles.notificationToggleInfo}>
                      <Text style={styles.notificationToggleTitle}>Job Status Changes</Text>
                      <Text style={styles.notificationToggleSubtitle}>Updates when job status changes</Text>
                    </View>
                  </View>
                  <Switch
                    value={notificationSettings.push.jobStatusChanges}
                    onValueChange={(value) => updatePushSetting('jobStatusChanges', value)}
                    trackColor={{ false: colors.muted, true: colors.primaryLight }}
                    thumbColor={notificationSettings.push.jobStatusChanges ? colors.primary : colors.mutedForeground}
                    data-testid="switch-push-job-status"
                  />
                </View>

                {/* Payment Received */}
                <View style={styles.notificationToggleRow}>
                  <View style={styles.notificationToggleLeft}>
                    <View style={[styles.notificationToggleIcon, { backgroundColor: '#22c55e20' }]}>
                      <Feather name="dollar-sign" size={16} color="#22c55e" />
                    </View>
                    <View style={styles.notificationToggleInfo}>
                      <Text style={styles.notificationToggleTitle}>Payment Received</Text>
                      <Text style={styles.notificationToggleSubtitle}>Alert when a payment is received</Text>
                    </View>
                  </View>
                  <Switch
                    value={notificationSettings.push.paymentReceived}
                    onValueChange={(value) => updatePushSetting('paymentReceived', value)}
                    trackColor={{ false: colors.muted, true: colors.primaryLight }}
                    thumbColor={notificationSettings.push.paymentReceived ? colors.primary : colors.mutedForeground}
                    data-testid="switch-push-payment"
                  />
                </View>

                {/* Quote Accepted */}
                <View style={styles.notificationToggleRow}>
                  <View style={styles.notificationToggleLeft}>
                    <View style={[styles.notificationToggleIcon, { backgroundColor: '#f59e0b20' }]}>
                      <Feather name="check-circle" size={16} color="#f59e0b" />
                    </View>
                    <View style={styles.notificationToggleInfo}>
                      <Text style={styles.notificationToggleTitle}>Quote Accepted</Text>
                      <Text style={styles.notificationToggleSubtitle}>Notify when client accepts a quote</Text>
                    </View>
                  </View>
                  <Switch
                    value={notificationSettings.push.quoteAccepted}
                    onValueChange={(value) => updatePushSetting('quoteAccepted', value)}
                    trackColor={{ false: colors.muted, true: colors.primaryLight }}
                    thumbColor={notificationSettings.push.quoteAccepted ? colors.primary : colors.mutedForeground}
                    data-testid="switch-push-quote"
                  />
                </View>

                {/* Team Messages */}
                <View style={[styles.notificationToggleRow, styles.notificationToggleRowLast]}>
                  <View style={styles.notificationToggleLeft}>
                    <View style={[styles.notificationToggleIcon, { backgroundColor: '#8b5cf620' }]}>
                      <Feather name="message-circle" size={16} color="#8b5cf6" />
                    </View>
                    <View style={styles.notificationToggleInfo}>
                      <Text style={styles.notificationToggleTitle}>Team Messages</Text>
                      <Text style={styles.notificationToggleSubtitle}>Notifications for team chat messages</Text>
                    </View>
                  </View>
                  <Switch
                    value={notificationSettings.push.teamMessages}
                    onValueChange={(value) => updatePushSetting('teamMessages', value)}
                    trackColor={{ false: colors.muted, true: colors.primaryLight }}
                    thumbColor={notificationSettings.push.teamMessages ? colors.primary : colors.mutedForeground}
                    data-testid="switch-push-team"
                  />
                </View>
              </View>

              {/* Email Notifications Section */}
              <View style={styles.subscriptionCard}>
                <View style={styles.subscriptionHeader}>
                  <Feather name="mail" size={20} color={colors.primary} />
                  <Text style={styles.subscriptionTitle}>Email Notifications</Text>
                </View>

                {/* Daily Digest */}
                <View style={styles.notificationToggleRow}>
                  <View style={styles.notificationToggleLeft}>
                    <View style={[styles.notificationToggleIcon, { backgroundColor: colors.primaryLight }]}>
                      <Feather name="sun" size={16} color={colors.primary} />
                    </View>
                    <View style={styles.notificationToggleInfo}>
                      <Text style={styles.notificationToggleTitle}>Daily Digest</Text>
                      <Text style={styles.notificationToggleSubtitle}>Daily summary of activity</Text>
                    </View>
                  </View>
                  <Switch
                    value={notificationSettings.email.dailyDigest}
                    onValueChange={(value) => updateEmailSetting('dailyDigest', value)}
                    trackColor={{ false: colors.muted, true: colors.primaryLight }}
                    thumbColor={notificationSettings.email.dailyDigest ? colors.primary : colors.mutedForeground}
                    data-testid="switch-email-daily"
                  />
                </View>

                {/* Weekly Summary */}
                <View style={styles.notificationToggleRow}>
                  <View style={styles.notificationToggleLeft}>
                    <View style={[styles.notificationToggleIcon, { backgroundColor: colors.primaryLight }]}>
                      <Feather name="calendar" size={16} color={colors.primary} />
                    </View>
                    <View style={styles.notificationToggleInfo}>
                      <Text style={styles.notificationToggleTitle}>Weekly Summary</Text>
                      <Text style={styles.notificationToggleSubtitle}>Weekly business overview email</Text>
                    </View>
                  </View>
                  <Switch
                    value={notificationSettings.email.weeklySummary}
                    onValueChange={(value) => updateEmailSetting('weeklySummary', value)}
                    trackColor={{ false: colors.muted, true: colors.primaryLight }}
                    thumbColor={notificationSettings.email.weeklySummary ? colors.primary : colors.mutedForeground}
                    data-testid="switch-email-weekly"
                  />
                </View>

                {/* Payment Receipts */}
                <View style={styles.notificationToggleRow}>
                  <View style={styles.notificationToggleLeft}>
                    <View style={[styles.notificationToggleIcon, { backgroundColor: '#22c55e20' }]}>
                      <Feather name="file-text" size={16} color="#22c55e" />
                    </View>
                    <View style={styles.notificationToggleInfo}>
                      <Text style={styles.notificationToggleTitle}>Payment Receipts</Text>
                      <Text style={styles.notificationToggleSubtitle}>Email receipt when payment received</Text>
                    </View>
                  </View>
                  <Switch
                    value={notificationSettings.email.paymentReceipts}
                    onValueChange={(value) => updateEmailSetting('paymentReceipts', value)}
                    trackColor={{ false: colors.muted, true: colors.primaryLight }}
                    thumbColor={notificationSettings.email.paymentReceipts ? colors.primary : colors.mutedForeground}
                    data-testid="switch-email-receipts"
                  />
                </View>

                {/* Overdue Reminders */}
                <View style={[styles.notificationToggleRow, styles.notificationToggleRowLast]}>
                  <View style={styles.notificationToggleLeft}>
                    <View style={[styles.notificationToggleIcon, { backgroundColor: '#ef444420' }]}>
                      <Feather name="alert-circle" size={16} color="#ef4444" />
                    </View>
                    <View style={styles.notificationToggleInfo}>
                      <Text style={styles.notificationToggleTitle}>Overdue Reminders</Text>
                      <Text style={styles.notificationToggleSubtitle}>Reminders for overdue invoices</Text>
                    </View>
                  </View>
                  <Switch
                    value={notificationSettings.email.overdueReminders}
                    onValueChange={(value) => updateEmailSetting('overdueReminders', value)}
                    trackColor={{ false: colors.muted, true: colors.primaryLight }}
                    thumbColor={notificationSettings.email.overdueReminders ? colors.primary : colors.mutedForeground}
                    data-testid="switch-email-overdue"
                  />
                </View>
              </View>

              {/* SMS Notifications Section */}
              <View style={styles.subscriptionCard}>
                <View style={styles.subscriptionHeader}>
                  <Feather name="message-square" size={20} color={colors.primary} />
                  <Text style={styles.subscriptionTitle}>SMS Notifications</Text>
                </View>

                {/* Urgent Job Alerts */}
                <View style={styles.notificationToggleRow}>
                  <View style={styles.notificationToggleLeft}>
                    <View style={[styles.notificationToggleIcon, { backgroundColor: '#ef444420' }]}>
                      <Feather name="alert-triangle" size={16} color="#ef4444" />
                    </View>
                    <View style={styles.notificationToggleInfo}>
                      <Text style={styles.notificationToggleTitle}>Urgent Job Alerts</Text>
                      <Text style={styles.notificationToggleSubtitle}>SMS for urgent job notifications</Text>
                    </View>
                  </View>
                  <Switch
                    value={notificationSettings.sms.urgentJobAlerts}
                    onValueChange={(value) => updateSmsSetting('urgentJobAlerts', value)}
                    trackColor={{ false: colors.muted, true: colors.primaryLight }}
                    thumbColor={notificationSettings.sms.urgentJobAlerts ? colors.primary : colors.mutedForeground}
                    data-testid="switch-sms-urgent"
                  />
                </View>

                {/* Payment Confirmations */}
                <View style={[styles.notificationToggleRow, styles.notificationToggleRowLast]}>
                  <View style={styles.notificationToggleLeft}>
                    <View style={[styles.notificationToggleIcon, { backgroundColor: '#22c55e20' }]}>
                      <Feather name="check-square" size={16} color="#22c55e" />
                    </View>
                    <View style={styles.notificationToggleInfo}>
                      <Text style={styles.notificationToggleTitle}>Payment Confirmations</Text>
                      <Text style={styles.notificationToggleSubtitle}>SMS when payments are confirmed</Text>
                    </View>
                  </View>
                  <Switch
                    value={notificationSettings.sms.paymentConfirmations}
                    onValueChange={(value) => updateSmsSetting('paymentConfirmations', value)}
                    trackColor={{ false: colors.muted, true: colors.primaryLight }}
                    thumbColor={notificationSettings.sms.paymentConfirmations ? colors.primary : colors.mutedForeground}
                    data-testid="switch-sms-payment"
                  />
                </View>
              </View>

              {/* Link to full notification settings */}
              <TouchableOpacity 
                style={styles.settingsCard}
                onPress={() => router.push('/more/notifications')}
                data-testid="button-notification-settings"
              >
                <View style={styles.settingsCardHeader}>
                  <Feather name="settings" size={20} color={colors.primary} />
                  <View style={styles.settingsCardInfo}>
                    <Text style={styles.settingsCardTitle}>Advanced Settings</Text>
                    <Text style={styles.settingsCardSubtitle}>Manage device permissions and inbox</Text>
                  </View>
                </View>
                <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>

              <View style={styles.settingsInfoCard}>
                <Text style={styles.settingsInfoTitle}>Stay Informed</Text>
                <Text style={styles.settingsInfoText}>
                  Configure how and when you receive notifications about jobs, payments, and team activity. SMS notifications may incur additional charges.
                </Text>
              </View>
            </View>
          )}

          {activeTab === 'help' && (
            <View style={styles.tabContentSection}>
              <TouchableOpacity 
                style={[styles.settingsCard, { borderColor: colors.primary, borderWidth: 2 }]}
                onPress={() => setShowTour(true)}
              >
                <View style={styles.settingsCardHeader}>
                  <Feather name="compass" size={20} color={colors.primary} />
                  <View style={styles.settingsCardInfo}>
                    <Text style={styles.settingsCardTitle}>Start App Tour</Text>
                    <Text style={styles.settingsCardSubtitle}>Quick walkthrough of the app</Text>
                  </View>
                </View>
                <Feather name="play-circle" size={18} color={colors.primary} />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.settingsCard}
                onPress={() => Linking.openURL('mailto:support@tradietrack.com.au')}
              >
                <View style={styles.settingsCardHeader}>
                  <Feather name="mail" size={20} color={colors.primary} />
                  <View style={styles.settingsCardInfo}>
                    <Text style={styles.settingsCardTitle}>Contact Support</Text>
                    <Text style={styles.settingsCardSubtitle}>support@tradietrack.com.au</Text>
                  </View>
                </View>
                <Feather name="external-link" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.settingsCard}
                onPress={() => Linking.openURL('https://tradietrack.com.au/help')}
              >
                <View style={styles.settingsCardHeader}>
                  <Feather name="help-circle" size={20} color={colors.primary} />
                  <View style={styles.settingsCardInfo}>
                    <Text style={styles.settingsCardTitle}>Help Centre</Text>
                    <Text style={styles.settingsCardSubtitle}>Guides, FAQs, and tutorials</Text>
                  </View>
                </View>
                <Feather name="external-link" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>

              <View style={styles.settingsInfoCard}>
                <Text style={styles.settingsInfoTitle}>Need Help?</Text>
                <Text style={styles.settingsInfoText}>
                  Our support team is available Monday to Friday, 9am-5pm AEST. We typically respond within 24 hours.
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        <AppTour 
          visible={showTour} 
          onClose={() => setShowTour(false)} 
        />
      </View>
    </>
  );
}
