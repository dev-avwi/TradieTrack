import { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Alert,
} from 'react-native';
import { Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius } from '../../src/lib/design-tokens';
import { useAuthStore } from '../../src/lib/store';

const FEATURES = [
  { icon: 'layout' as const, title: 'Custom Design', desc: 'Tailored to your trade and brand' },
  { icon: 'search' as const, title: 'Local SEO', desc: 'Rank in your suburb and trade' },
  { icon: 'edit-3' as const, title: 'Quote Form', desc: 'JobRunner quote integration built in' },
  { icon: 'smartphone' as const, title: 'Mobile-First', desc: 'Looks great on every device' },
  { icon: 'server' as const, title: 'Hosting Included', desc: 'Fast, secure hosting and SSL' },
  { icon: 'headphones' as const, title: 'Ongoing Support', desc: 'Updates and maintenance included' },
];

const PROCESS_STEPS = [
  { step: '1', title: 'Request a Quote', desc: 'Tell us about your business and what you need' },
  { step: '2', title: 'Design & Build', desc: 'We create your site with your branding and content' },
  { step: '3', title: 'Review & Launch', desc: 'You approve the design and we go live' },
];

export default function CustomWebsitePage() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user, businessSettings } = useAuthStore();
  const [requested, setRequested] = useState(false);

  const handleRequestQuote = () => {
    const businessName = businessSettings?.businessName || '';
    const trade = businessSettings?.tradeType || '';
    const location = businessSettings?.businessAddress || '';
    const email = user?.email || '';

    const subject = encodeURIComponent('Custom Website Enquiry');
    const body = encodeURIComponent(
      `Hi JobRunner Team,\n\nI'm interested in a custom website for my trade business.\n\nBusiness Name: ${businessName}\nTrade: ${trade}\nLocation: ${location}\nEmail: ${email}\n\nThanks!`
    );

    Linking.openURL(`mailto:admin@avwebinnovation.com?subject=${subject}&body=${body}`);
    setRequested(true);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.pageTitle}>Custom Website</Text>
        <Text style={styles.pageSubtitle}>
          Professional website built for your trade business — mobile-friendly, SEO optimised, and integrated with JobRunner.
        </Text>

        <View style={styles.pricingCard}>
          <View style={styles.pricingHeader}>
            <Text style={styles.pricingLabel}>Starting from</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
              <Text style={styles.pricingAmount}>$499</Text>
              <Text style={styles.pricingPeriod}>one-time</Text>
            </View>
            <Text style={styles.pricingNote}>+ $29/month hosting & support</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>What's Included</Text>
        <View style={styles.featuresGrid}>
          {FEATURES.map((feat, i) => (
            <View key={i} style={styles.featureCard}>
              <View style={styles.featureIcon}>
                <Feather name={feat.icon} size={18} color={colors.primary} />
              </View>
              <Text style={styles.featureTitle}>{feat.title}</Text>
              <Text style={styles.featureDesc}>{feat.desc}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>How It Works</Text>
        {PROCESS_STEPS.map((step, i) => (
          <View key={i} style={styles.stepRow}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>{step.step}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepDesc}>{step.desc}</Text>
            </View>
          </View>
        ))}

        <TouchableOpacity
          style={[styles.ctaButton, requested && styles.ctaButtonRequested]}
          onPress={handleRequestQuote}
          activeOpacity={0.7}
        >
          <Feather name={requested ? 'check' : 'mail'} size={18} color={requested ? colors.success : colors.primaryForeground} />
          <Text style={[styles.ctaText, requested && { color: colors.success }]}>
            {requested ? 'Quote Requested' : 'Request a Quote'}
          </Text>
        </TouchableOpacity>

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  pageSubtitle: {
    fontSize: 15,
    color: colors.mutedForeground,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  pricingCard: {
    backgroundColor: `${colors.primary}10`,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  pricingHeader: {
    alignItems: 'center',
  },
  pricingLabel: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginBottom: 4,
  },
  pricingAmount: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.primary,
  },
  pricingPeriod: {
    fontSize: 14,
    color: colors.mutedForeground,
  },
  pricingNote: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
    marginBottom: spacing.md,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  featureCard: {
    width: '47%',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 2,
  },
  featureDesc: {
    fontSize: 12,
    color: colors.mutedForeground,
    lineHeight: 17,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primaryForeground,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
  },
  stepDesc: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    marginTop: spacing.md,
  },
  ctaButtonRequested: {
    backgroundColor: `${colors.success}15`,
    borderWidth: 1,
    borderColor: `${colors.success}40`,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
});
