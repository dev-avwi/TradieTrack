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
import { Stack, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuthStore } from '../../src/lib/store';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, typography } from '../../src/lib/design-tokens';

const PLAN_FEATURES = [
  { icon: 'briefcase', text: 'Unlimited jobs, quotes & invoices', pro: true },
  { icon: 'star', text: 'AI-powered suggestions', pro: true },
  { icon: 'sliders', text: 'Custom branding & theming', pro: true },
  { icon: 'users', text: 'Team management & permissions', pro: true },
  { icon: 'mail', text: 'Automated email reminders', pro: true },
  { icon: 'help-circle', text: 'Priority support', pro: true },
];

const SETTINGS_TABS = [
  { key: 'pay', label: 'Pay', icon: 'credit-card' },
  { key: 'apps', label: 'Apps', icon: 'smartphone' },
  { key: 'alerts', label: 'Alerts', icon: 'bell' },
  { key: 'plan', label: 'Plan', icon: 'award' },
  { key: 'help', label: 'Help', icon: 'help-circle' },
];

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
    color: '#FFFFFF',
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
    backgroundColor: '#FFFFFF',
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
    color: '#FFFFFF',
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
});

export default function SettingsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { businessSettings } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('plan');

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    setIsLoading(false);
  }, []);

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
              <TouchableOpacity 
                style={styles.settingsCard}
                onPress={() => router.push('/more/integrations')}
              >
                <View style={styles.settingsCardHeader}>
                  <Feather name="smartphone" size={20} color={colors.primary} />
                  <View style={styles.settingsCardInfo}>
                    <Text style={styles.settingsCardTitle}>Integrations</Text>
                    <Text style={styles.settingsCardSubtitle}>Connect Stripe, Gmail, and more</Text>
                  </View>
                </View>
                <Feather name="external-link" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>

              <View style={styles.settingsInfoCard}>
                <Text style={styles.settingsInfoTitle}>Connected Apps</Text>
                <Text style={styles.settingsInfoText}>
                  Manage your connected services and integrations. Add payment processing, email automation, and more.
                </Text>
              </View>
            </View>
          )}

          {activeTab === 'alerts' && (
            <View style={styles.tabContentSection}>
              <TouchableOpacity 
                style={styles.settingsCard}
                onPress={() => router.push('/more/notifications')}
              >
                <View style={styles.settingsCardHeader}>
                  <Feather name="bell" size={20} color={colors.primary} />
                  <View style={styles.settingsCardInfo}>
                    <Text style={styles.settingsCardTitle}>Notification Settings</Text>
                    <Text style={styles.settingsCardSubtitle}>Push, email, SMS alerts</Text>
                  </View>
                </View>
                <Feather name="external-link" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>

              <View style={styles.settingsInfoCard}>
                <Text style={styles.settingsInfoTitle}>Stay Informed</Text>
                <Text style={styles.settingsInfoText}>
                  Configure how and when you receive notifications about jobs, payments, and team activity.
                </Text>
              </View>
            </View>
          )}

          {activeTab === 'help' && (
            <View style={styles.tabContentSection}>
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
      </View>
    </>
  );
}
