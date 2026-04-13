import { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius } from '../../src/lib/design-tokens';
import { useAuthStore } from '../../src/lib/store';
import api from '../../src/lib/api';

const FEATURES = [
  { icon: 'layout' as const, title: 'Custom Design', desc: 'Tailored to your trade and brand' },
  { icon: 'search' as const, title: 'Local SEO', desc: 'Rank in your suburb and trade' },
  { icon: 'edit-3' as const, title: 'Quote Form', desc: 'JobRunner quote integration built in' },
  { icon: 'smartphone' as const, title: 'Mobile-First', desc: 'Looks great on every device' },
  { icon: 'server' as const, title: 'Hosting Included', desc: 'Fast, secure hosting and SSL' },
  { icon: 'headphones' as const, title: 'Ongoing Support', desc: 'Updates and maintenance included' },
];

const PROCESS_STEPS = [
  { step: '1', title: 'Request a Quote', desc: 'Fill out the form below with your details' },
  { step: '2', title: 'Design & Build', desc: 'We create your site with your branding and content' },
  { step: '3', title: 'Review & Launch', desc: 'You approve the design and we go live' },
];

const WEBSITE_TYPES = [
  'Single Page (Landing)',
  'Multi-Page Business Site',
  'Portfolio / Gallery',
  'Booking / Quote Site',
  'Other',
];

const FEATURE_OPTIONS = [
  'Online Booking',
  'Contact Form',
  'Quote Request Form',
  'Photo Gallery',
  'Testimonials',
  'Google Maps',
  'Social Media Links',
  'Live Chat',
  'Blog',
  'Before & After Photos',
];

const PRICING_TIERS = [
  { name: 'Portfolio', pages: 'Up to 3 pages', price: '$500', desc: 'Perfect for tradies who want an online presence', features: ['Responsive design', 'Contact form', 'Google Maps', 'Social links'] },
  { name: '5-Page Business', pages: 'Up to 5 pages', price: '$1,000', desc: 'Full business site with all the essentials', features: ['Everything in Portfolio', 'Photo gallery', 'Testimonials', 'Quote request form', 'Local SEO'] },
  { name: 'Premium Custom', pages: '6+ pages', price: 'From $1,500', desc: 'Enterprise-grade with advanced features', features: ['Everything in Business', 'Blog', 'Online booking', 'Before & after gallery', 'Live chat'] },
];

const BUDGET_OPTIONS = [
  'Portfolio (~$500)',
  'Business (~$1,000)',
  'Premium ($1,500+)',
  'Not sure yet',
];

const TIMELINE_OPTIONS = [
  'ASAP',
  'Within 2 weeks',
  'Within a month',
  'No rush',
];

export default function CustomWebsitePage() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user, businessSettings } = useAuthStore();
  const [showForm, setShowForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [businessName, setBusinessName] = useState(businessSettings?.businessName || '');
  const [tradeType, setTradeType] = useState(businessSettings?.tradeType || '');
  const [location, setLocation] = useState(businessSettings?.businessAddress || '');
  const [websiteType, setWebsiteType] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [hasExistingSite, setHasExistingSite] = useState(false);
  const [existingUrl, setExistingUrl] = useState('');
  const [budget, setBudget] = useState('');
  const [timeline, setTimeline] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');

  const toggleFeature = (feat: string) => {
    setSelectedFeatures(prev =>
      prev.includes(feat) ? prev.filter(f => f !== feat) : [...prev, feat]
    );
  };

  const handleSubmit = async () => {
    if (!businessName.trim()) {
      Alert.alert('Required', 'Please enter your business name.');
      return;
    }
    if (!tradeType.trim()) {
      Alert.alert('Required', 'Please enter your trade type.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.post('/api/website-request', {
        businessName: businessName.trim(),
        tradeType: tradeType.trim(),
        location: location.trim(),
        websiteType,
        description: description.trim(),
        features: selectedFeatures,
        hasExistingWebsite: hasExistingSite,
        existingWebsiteUrl: existingUrl.trim(),
        budget,
        timeline,
        additionalNotes: additionalNotes.trim(),
      });

      if (response.error) {
        Alert.alert('Error', response.error);
      } else {
        setSubmitted(true);
        setShowForm(false);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to submit request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.pageTitle}>Custom Website</Text>
        <Text style={styles.pageSubtitle}>
          Professional website built for your trade business — mobile-friendly, SEO optimised, and integrated with JobRunner.
        </Text>

        <Text style={styles.sectionTitle}>Pricing</Text>
        {PRICING_TIERS.map((tier, i) => (
          <View key={i} style={[styles.pricingCard, i === 1 && { borderColor: colors.primary, borderWidth: 2 }]}>
            {i === 1 && (
              <View style={{ position: 'absolute', top: -10, alignSelf: 'center', backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 3, borderRadius: radius.full }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primaryForeground }}>MOST POPULAR</Text>
              </View>
            )}
            <View style={styles.pricingHeader}>
              <Text style={styles.pricingLabel}>{tier.name}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
                <Text style={styles.pricingAmount}>{tier.price}</Text>
              </View>
              <Text style={styles.pricingNote}>{tier.pages} — {tier.desc}</Text>
            </View>
            <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md }}>
              {tier.features.map((feat, j) => (
                <View key={j} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 }}>
                  <Feather name="check" size={14} color={colors.success} />
                  <Text style={{ fontSize: 13, color: colors.foreground }}>{feat}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}

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

        {submitted ? (
          <View style={styles.successCard}>
            <Feather name="check-circle" size={32} color={colors.success} />
            <Text style={styles.successTitle}>Request Submitted!</Text>
            <Text style={styles.successDesc}>
              We've received your website request and will be in touch within 1-2 business days to discuss your project.
            </Text>
          </View>
        ) : !showForm ? (
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={() => setShowForm(true)}
            activeOpacity={0.7}
          >
            <Feather name="send" size={18} color={colors.primaryForeground} />
            <Text style={styles.ctaText}>Request a Quote</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.formContainer}>
            <Text style={styles.formTitle}>Tell Us About Your Project</Text>

            <Text style={styles.fieldLabel}>Business Name *</Text>
            <TextInput
              style={styles.textInput}
              value={businessName}
              onChangeText={setBusinessName}
              placeholder="e.g. Mike's Plumbing Services"
              placeholderTextColor={colors.mutedForeground}
            />

            <Text style={styles.fieldLabel}>Trade Type *</Text>
            <TextInput
              style={styles.textInput}
              value={tradeType}
              onChangeText={setTradeType}
              placeholder="e.g. Plumber, Electrician, Builder"
              placeholderTextColor={colors.mutedForeground}
            />

            <Text style={styles.fieldLabel}>Location / Service Area</Text>
            <TextInput
              style={styles.textInput}
              value={location}
              onChangeText={setLocation}
              placeholder="e.g. Cairns, QLD"
              placeholderTextColor={colors.mutedForeground}
            />

            <Text style={styles.fieldLabel}>Website Type</Text>
            <View style={styles.chipRow}>
              {WEBSITE_TYPES.map(type => (
                <TouchableOpacity
                  key={type}
                  style={[styles.chip, websiteType === type && styles.chipSelected]}
                  onPress={() => setWebsiteType(websiteType === type ? '' : type)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, websiteType === type && styles.chipTextSelected]}>{type}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>What do you want your website to achieve?</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="e.g. Generate more leads, showcase our work, make it easy for customers to book..."
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <Text style={styles.fieldLabel}>Desired Features</Text>
            <View style={styles.chipRow}>
              {FEATURE_OPTIONS.map(feat => (
                <TouchableOpacity
                  key={feat}
                  style={[styles.chip, selectedFeatures.includes(feat) && styles.chipSelected]}
                  onPress={() => toggleFeature(feat)}
                  activeOpacity={0.7}
                >
                  {selectedFeatures.includes(feat) && (
                    <Feather name="check" size={12} color={colors.primaryForeground} style={{ marginRight: 4 }} />
                  )}
                  <Text style={[styles.chipText, selectedFeatures.includes(feat) && styles.chipTextSelected]}>{feat}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Do you have an existing website?</Text>
              <Switch
                value={hasExistingSite}
                onValueChange={setHasExistingSite}
                trackColor={{ false: colors.muted, true: `${colors.primary}60` }}
                thumbColor={hasExistingSite ? colors.primary : colors.mutedForeground}
              />
            </View>

            {hasExistingSite && (
              <>
                <Text style={styles.fieldLabel}>Current Website URL</Text>
                <TextInput
                  style={styles.textInput}
                  value={existingUrl}
                  onChangeText={setExistingUrl}
                  placeholder="e.g. www.mybusiness.com.au"
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="none"
                  keyboardType="url"
                />
              </>
            )}

            <Text style={styles.fieldLabel}>Budget</Text>
            <View style={styles.chipRow}>
              {BUDGET_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.chip, budget === opt && styles.chipSelected]}
                  onPress={() => setBudget(budget === opt ? '' : opt)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, budget === opt && styles.chipTextSelected]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Timeline</Text>
            <View style={styles.chipRow}>
              {TIMELINE_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.chip, timeline === opt && styles.chipSelected]}
                  onPress={() => setTimeline(timeline === opt ? '' : opt)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, timeline === opt && styles.chipTextSelected]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Additional Notes</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={additionalNotes}
              onChangeText={setAdditionalNotes}
              placeholder="Anything else we should know? Branding colours, logo details, specific requirements..."
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.ctaButton, submitting && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.7}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <Feather name="send" size={18} color={colors.primaryForeground} />
              )}
              <Text style={styles.ctaText}>
                {submitting ? 'Submitting...' : 'Submit Request'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowForm(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

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
  ctaText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  formContainer: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 8,
    marginTop: spacing.lg,
  },
  textInput: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 15,
    color: colors.foreground,
  },
  textArea: {
    minHeight: 90,
    paddingTop: spacing.sm + 2,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.muted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.foreground,
  },
  chipTextSelected: {
    color: colors.primaryForeground,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  switchLabel: {
    fontSize: 14,
    color: colors.foreground,
    flex: 1,
    marginRight: spacing.sm,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: spacing.xs,
  },
  cancelText: {
    fontSize: 14,
    color: colors.mutedForeground,
    fontWeight: '500',
  },
  successCard: {
    backgroundColor: `${colors.success}10`,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: `${colors.success}30`,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.success,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  successDesc: {
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: 20,
  },
});
