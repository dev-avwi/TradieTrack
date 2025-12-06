import { useMemo } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  StyleSheet, 
  TouchableOpacity,
  Linking
} from 'react-native';
import { Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { useAuthStore } from '../../src/lib/store';
import { spacing, radius, shadows, typography, iconSizes } from '../../src/lib/design-tokens';

interface FeatureItem {
  name: string;
  free: boolean;
  pro: boolean;
  icon: keyof typeof Feather.glyphMap;
}

const FEATURES: FeatureItem[] = [
  { name: 'Job Management', free: true, pro: true, icon: 'briefcase' },
  { name: 'Client CRM', free: true, pro: true, icon: 'users' },
  { name: 'Quotes & Invoices', free: true, pro: true, icon: 'file-text' },
  { name: 'Basic Reports', free: true, pro: true, icon: 'bar-chart-2' },
  { name: 'GST Calculation', free: true, pro: true, icon: 'percent' },
  { name: '5 Jobs/Month', free: true, pro: false, icon: 'layers' },
  { name: 'Unlimited Jobs', free: false, pro: true, icon: 'layers' },
  { name: 'Custom Branding', free: false, pro: true, icon: 'palette' },
  { name: 'AI Assistant', free: false, pro: true, icon: 'zap' },
  { name: 'PDF Export', free: false, pro: true, icon: 'download' },
  { name: 'Email Integration', free: false, pro: true, icon: 'mail' },
  { name: 'Team Members', free: false, pro: true, icon: 'user-plus' },
  { name: 'Priority Support', free: false, pro: true, icon: 'headphones' },
  { name: 'Map View', free: false, pro: true, icon: 'map' },
  { name: 'Time Tracking', free: false, pro: true, icon: 'clock' },
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
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  headerTitle: {
    ...typography.pageTitle,
    color: colors.foreground,
    textAlign: 'center',
  },
  headerSubtitle: {
    ...typography.body,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  betaBanner: {
    backgroundColor: colors.successLight,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.success,
  },
  betaBadge: {
    backgroundColor: colors.success,
    paddingVertical: 4,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    marginBottom: spacing.sm,
  },
  betaBadgeText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  betaTitle: {
    ...typography.subtitle,
    color: colors.success,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  betaText: {
    ...typography.caption,
    color: colors.foreground,
    textAlign: 'center',
  },
  plansRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  planCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 2,
    ...shadows.sm,
  },
  planCardFree: {
    borderColor: colors.border,
  },
  planCardPro: {
    borderColor: colors.primary,
  },
  planBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    marginBottom: spacing.md,
  },
  planBadgeFree: {
    backgroundColor: colors.muted,
  },
  planBadgePro: {
    backgroundColor: colors.primaryLight,
  },
  planBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  planBadgeTextFree: {
    color: colors.mutedForeground,
  },
  planBadgeTextPro: {
    color: colors.primary,
  },
  planName: {
    ...typography.subtitle,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  planPrice: {
    ...typography.pageTitle,
    color: colors.primary,
  },
  planPeriod: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  featuresCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.sm,
  },
  featuresHeader: {
    flexDirection: 'row',
    padding: spacing.md,
    backgroundColor: colors.muted,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  featuresHeaderCell: {
    flex: 1,
  },
  featuresHeaderText: {
    ...typography.label,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  featureRowLast: {
    borderBottomWidth: 0,
  },
  featureNameCell: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  featureName: {
    ...typography.body,
    color: colors.foreground,
  },
  featureCheckCell: {
    flex: 1,
    alignItems: 'center',
  },
  checkIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkIconEnabled: {
    backgroundColor: colors.successLight,
  },
  checkIconDisabled: {
    backgroundColor: colors.muted,
  },
  ctaButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.lg,
    borderRadius: radius.xl,
    alignItems: 'center',
    marginTop: spacing.xl,
    ...shadows.md,
  },
  ctaButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  ctaSubtext: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  infoSection: {
    marginTop: spacing.xl,
    paddingTop: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  infoTitle: {
    ...typography.subtitle,
    color: colors.foreground,
    marginBottom: spacing.md,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: {
    flex: 1,
    ...typography.caption,
    color: colors.mutedForeground,
    lineHeight: 20,
  },
});

export default function SubscriptionScreen() {
  const { colors } = useTheme();
  const { user, businessSettings } = useAuthStore();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const isBeta = true;
  const currentPlan = businessSettings?.subscriptionTier || 'free';

  const handleUpgrade = () => {
    Linking.openURL('https://tradietrack.com.au/pricing');
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
      <ScrollView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Feather name="star" size={28} color={colors.primary} />
            </View>
            <Text style={styles.headerTitle}>Your Plan</Text>
            <Text style={styles.headerSubtitle}>
              Choose the plan that works for your business
            </Text>
          </View>

          {isBeta && (
            <View style={styles.betaBanner}>
              <View style={styles.betaBadge}>
                <Text style={styles.betaBadgeText}>BETA</Text>
              </View>
              <Text style={styles.betaTitle}>Free During Beta!</Text>
              <Text style={styles.betaText}>
                All Pro features are unlocked while we're in beta. Enjoy full access!
              </Text>
            </View>
          )}

          <View style={styles.plansRow}>
            <View style={[styles.planCard, styles.planCardFree]}>
              <View style={[styles.planBadge, styles.planBadgeFree]}>
                <Text style={[styles.planBadgeText, styles.planBadgeTextFree]}>FREE</Text>
              </View>
              <Text style={styles.planName}>Starter</Text>
              <Text style={[styles.planPrice, { color: colors.mutedForeground }]}>$0</Text>
              <Text style={styles.planPeriod}>forever</Text>
            </View>

            <View style={[styles.planCard, styles.planCardPro]}>
              <View style={[styles.planBadge, styles.planBadgePro]}>
                <Text style={[styles.planBadgeText, styles.planBadgeTextPro]}>PRO</Text>
              </View>
              <Text style={styles.planName}>Professional</Text>
              <Text style={styles.planPrice}>$49</Text>
              <Text style={styles.planPeriod}>/month</Text>
            </View>
          </View>

          <View style={styles.featuresCard}>
            <View style={styles.featuresHeader}>
              <View style={[styles.featuresHeaderCell, { flex: 2 }]}>
                <Text style={[styles.featuresHeaderText, { textAlign: 'left' }]}>Feature</Text>
              </View>
              <View style={styles.featuresHeaderCell}>
                <Text style={styles.featuresHeaderText}>Free</Text>
              </View>
              <View style={styles.featuresHeaderCell}>
                <Text style={styles.featuresHeaderText}>Pro</Text>
              </View>
            </View>

            {FEATURES.map((feature, index) => (
              <View 
                key={feature.name} 
                style={[
                  styles.featureRow,
                  index === FEATURES.length - 1 && styles.featureRowLast
                ]}
              >
                <View style={styles.featureNameCell}>
                  <Feather name={feature.icon} size={16} color={colors.mutedForeground} />
                  <Text style={styles.featureName}>{feature.name}</Text>
                </View>
                <View style={styles.featureCheckCell}>
                  <View style={[
                    styles.checkIcon,
                    feature.free ? styles.checkIconEnabled : styles.checkIconDisabled
                  ]}>
                    <Feather 
                      name={feature.free ? 'check' : 'x'} 
                      size={14} 
                      color={feature.free ? colors.success : colors.mutedForeground} 
                    />
                  </View>
                </View>
                <View style={styles.featureCheckCell}>
                  <View style={[
                    styles.checkIcon,
                    feature.pro ? styles.checkIconEnabled : styles.checkIconDisabled
                  ]}>
                    <Feather 
                      name={feature.pro ? 'check' : 'x'} 
                      size={14} 
                      color={feature.pro ? colors.success : colors.mutedForeground} 
                    />
                  </View>
                </View>
              </View>
            ))}
          </View>

          {!isBeta && currentPlan === 'free' && (
            <>
              <TouchableOpacity 
                style={styles.ctaButton}
                onPress={handleUpgrade}
                activeOpacity={0.8}
              >
                <Text style={styles.ctaButtonText}>Upgrade to Pro</Text>
              </TouchableOpacity>
              <Text style={styles.ctaSubtext}>
                Cancel anytime. 14-day money-back guarantee.
              </Text>
            </>
          )}

          <View style={styles.infoSection}>
            <Text style={styles.infoTitle}>Why Pro?</Text>
            
            <View style={styles.infoItem}>
              <View style={styles.infoIcon}>
                <Feather name="zap" size={16} color={colors.primary} />
              </View>
              <Text style={styles.infoText}>
                Unlimited jobs and clients. Grow your business without limits.
              </Text>
            </View>
            
            <View style={styles.infoItem}>
              <View style={styles.infoIcon}>
                <Feather name="palette" size={16} color={colors.primary} />
              </View>
              <Text style={styles.infoText}>
                Custom branding on all quotes and invoices. Look professional.
              </Text>
            </View>
            
            <View style={styles.infoItem}>
              <View style={styles.infoIcon}>
                <Feather name="users" size={16} color={colors.primary} />
              </View>
              <Text style={styles.infoText}>
                Add team members with role-based access control.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </>
  );
}
