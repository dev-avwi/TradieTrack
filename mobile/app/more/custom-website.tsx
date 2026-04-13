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
import { Stack, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, shadows } from '../../src/lib/design-tokens';
import { useAuthStore } from '../../src/lib/store';
import api from '../../src/lib/api';

const PRICING_TIERS = [
  {
    name: 'Portfolio',
    pages: 'Up to 3 pages',
    price: '$500',
    desc: 'Online presence for your trade',
    icon: 'layout' as const,
    features: ['Responsive design', 'Contact form', 'Google Maps', 'Social links'],
  },
  {
    name: 'Business',
    pages: 'Up to 5 pages',
    price: '$1,000',
    desc: 'Full site with lead generation',
    icon: 'briefcase' as const,
    popular: true,
    features: ['Everything in Portfolio', 'Photo gallery', 'Testimonials', 'Quote request form', 'Local SEO'],
  },
  {
    name: 'Premium',
    pages: '6+ pages',
    price: 'From $1,500',
    desc: 'Enterprise-grade with advanced features',
    icon: 'star' as const,
    features: ['Everything in Business', 'Blog', 'Online booking', 'Before & after gallery', 'Live chat'],
  },
];

const HIGHLIGHTS = [
  { icon: 'smartphone' as const, label: 'Mobile-First' },
  { icon: 'search' as const, label: 'SEO Optimised' },
  { icon: 'link' as const, label: 'JobRunner Integrated' },
  { icon: 'server' as const, label: 'Hosting Included' },
];

const PROCESS_STEPS = [
  { icon: 'send' as const, title: 'Request', desc: 'Fill out the form below' },
  { icon: 'pen-tool' as const, title: 'Design', desc: 'We build your site' },
  { icon: 'check-circle' as const, title: 'Launch', desc: 'Review and go live' },
];

const WEBSITE_TYPES = ['Landing Page', 'Multi-Page', 'Portfolio', 'Booking Site', 'Other'];

const FEATURE_OPTIONS = [
  'Online Booking', 'Contact Form', 'Quote Request', 'Photo Gallery',
  'Testimonials', 'Google Maps', 'Social Links', 'Live Chat', 'Blog', 'Before & After',
];

const BUDGET_OPTIONS = ['~$500', '~$1,000', '$1,500+', 'Not sure'];
const TIMELINE_OPTIONS = ['ASAP', '2 weeks', '1 month', 'No rush'];

export default function CustomWebsitePage() {
  const { colors } = useTheme();
  const router = useRouter();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user, businessSettings } = useAuthStore();
  const [showForm, setShowForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedTier, setSelectedTier] = useState<number | null>(null);

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

  const selectTierAndStartForm = (tierIndex: number) => {
    setSelectedTier(tierIndex);
    const tier = PRICING_TIERS[tierIndex];
    setBudget(tier.price === 'From $1,500' ? '$1,500+' : tier.price === '$1,000' ? '~$1,000' : '~$500');
    setShowForm(true);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Custom Website</Text>
            <Text style={styles.headerSubtitle}>Professional site for your trade</Text>
          </View>
          <View style={styles.headerIconWrap}>
            <Feather name="globe" size={18} color={colors.primary} />
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.highlightsRow}>
            {HIGHLIGHTS.map((h, i) => (
              <View key={i} style={styles.highlightItem}>
                <View style={styles.highlightIcon}>
                  <Feather name={h.icon} size={14} color={colors.primary} />
                </View>
                <Text style={styles.highlightLabel}>{h.label}</Text>
              </View>
            ))}
          </View>

          {submitted ? (
            <View style={styles.successCard}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: `${colors.success}15`, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm }}>
                <Feather name="check-circle" size={24} color={colors.success} />
              </View>
              <Text style={styles.successTitle}>Request Submitted</Text>
              <Text style={styles.successDesc}>We'll be in touch within 1-2 business days to discuss your project.</Text>
            </View>
          ) : !showForm ? (
            <>
              <Text style={styles.sectionLabel}>Choose a Package</Text>
              {PRICING_TIERS.map((tier, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.tierCard, tier.popular && styles.tierCardPopular]}
                  onPress={() => selectTierAndStartForm(i)}
                  activeOpacity={0.7}
                >
                  {tier.popular && (
                    <View style={styles.popularBadge}>
                      <Text style={styles.popularBadgeText}>MOST POPULAR</Text>
                    </View>
                  )}
                  <View style={styles.tierHeader}>
                    <View style={[styles.tierIconWrap, tier.popular && { backgroundColor: `${colors.primary}20` }]}>
                      <Feather name={tier.icon} size={18} color={tier.popular ? colors.primary : colors.mutedForeground} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.tierName}>{tier.name}</Text>
                      <Text style={styles.tierDesc}>{tier.pages} — {tier.desc}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.tierPrice, tier.popular && { color: colors.primary }]}>{tier.price}</Text>
                    </View>
                  </View>
                  <View style={styles.tierFeatures}>
                    {tier.features.map((feat, j) => (
                      <View key={j} style={styles.tierFeatureRow}>
                        <Feather name="check" size={13} color={colors.success} />
                        <Text style={styles.tierFeatureText}>{feat}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={[styles.tierCta, tier.popular && styles.tierCtaPopular]}>
                    <Text style={[styles.tierCtaText, tier.popular && { color: '#fff' }]}>Get Started</Text>
                    <Feather name="arrow-right" size={14} color={tier.popular ? '#fff' : colors.primary} />
                  </View>
                </TouchableOpacity>
              ))}

              <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>How It Works</Text>
              <View style={styles.processRow}>
                {PROCESS_STEPS.map((step, i) => (
                  <View key={i} style={styles.processStep}>
                    <View style={styles.processIconWrap}>
                      <Feather name={step.icon} size={16} color={colors.primary} />
                    </View>
                    <Text style={styles.processTitle}>{step.title}</Text>
                    <Text style={styles.processDesc}>{step.desc}</Text>
                    {i < PROCESS_STEPS.length - 1 && (
                      <View style={styles.processArrow}>
                        <Feather name="chevron-right" size={14} color={colors.border} />
                      </View>
                    )}
                  </View>
                ))}
              </View>
            </>
          ) : (
            <View style={styles.formCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
                <Text style={styles.formTitle}>Your Project Details</Text>
                <TouchableOpacity onPress={() => setShowForm(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Feather name="x" size={20} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>

              {selectedTier !== null && (
                <View style={styles.selectedTierPill}>
                  <Feather name={PRICING_TIERS[selectedTier].icon} size={14} color={colors.primary} />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.primary }}>{PRICING_TIERS[selectedTier].name} — {PRICING_TIERS[selectedTier].price}</Text>
                </View>
              )}

              <Text style={styles.fieldLabel}>Business Name *</Text>
              <TextInput style={styles.input} value={businessName} onChangeText={setBusinessName} placeholder="e.g. Mike's Plumbing Services" placeholderTextColor={colors.mutedForeground} />

              <Text style={styles.fieldLabel}>Trade Type *</Text>
              <TextInput style={styles.input} value={tradeType} onChangeText={setTradeType} placeholder="e.g. Plumber, Electrician" placeholderTextColor={colors.mutedForeground} />

              <Text style={styles.fieldLabel}>Location</Text>
              <TextInput style={styles.input} value={location} onChangeText={setLocation} placeholder="e.g. Cairns, QLD" placeholderTextColor={colors.mutedForeground} />

              <Text style={styles.fieldLabel}>Website Type</Text>
              <View style={styles.chipRow}>
                {WEBSITE_TYPES.map(type => (
                  <TouchableOpacity key={type} style={[styles.chip, websiteType === type && styles.chipActive]} onPress={() => setWebsiteType(websiteType === type ? '' : type)} activeOpacity={0.7}>
                    <Text style={[styles.chipText, websiteType === type && styles.chipTextActive]}>{type}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Goals</Text>
              <TextInput style={[styles.input, { minHeight: 72, textAlignVertical: 'top' }]} value={description} onChangeText={setDescription} placeholder="What do you want your site to achieve?" placeholderTextColor={colors.mutedForeground} multiline numberOfLines={3} />

              <Text style={styles.fieldLabel}>Features</Text>
              <View style={styles.chipRow}>
                {FEATURE_OPTIONS.map(feat => (
                  <TouchableOpacity key={feat} style={[styles.chip, selectedFeatures.includes(feat) && styles.chipActive]} onPress={() => toggleFeature(feat)} activeOpacity={0.7}>
                    {selectedFeatures.includes(feat) && <Feather name="check" size={11} color="#fff" style={{ marginRight: 3 }} />}
                    <Text style={[styles.chipText, selectedFeatures.includes(feat) && styles.chipTextActive]}>{feat}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Existing website?</Text>
                <Switch value={hasExistingSite} onValueChange={setHasExistingSite} trackColor={{ false: colors.muted, true: `${colors.primary}60` }} thumbColor={hasExistingSite ? colors.primary : colors.mutedForeground} />
              </View>
              {hasExistingSite && (
                <TextInput style={styles.input} value={existingUrl} onChangeText={setExistingUrl} placeholder="www.mybusiness.com.au" placeholderTextColor={colors.mutedForeground} autoCapitalize="none" keyboardType="url" />
              )}

              <Text style={styles.fieldLabel}>Timeline</Text>
              <View style={styles.chipRow}>
                {TIMELINE_OPTIONS.map(opt => (
                  <TouchableOpacity key={opt} style={[styles.chip, timeline === opt && styles.chipActive]} onPress={() => setTimeline(timeline === opt ? '' : opt)} activeOpacity={0.7}>
                    <Text style={[styles.chipText, timeline === opt && styles.chipTextActive]}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Notes</Text>
              <TextInput style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]} value={additionalNotes} onChangeText={setAdditionalNotes} placeholder="Branding, logo, colours, anything else..." placeholderTextColor={colors.mutedForeground} multiline numberOfLines={2} />

              <TouchableOpacity style={[styles.submitBtn, submitting && { opacity: 0.6 }]} onPress={handleSubmit} disabled={submitting} activeOpacity={0.7}>
                {submitting ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="send" size={16} color="#fff" />}
                <Text style={styles.submitBtnText}>{submitting ? 'Submitting...' : 'Submit Request'}</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: spacing.xxl }} />
        </ScrollView>
      </View>
    </>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  headerBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm, backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { padding: spacing.xs },
  headerTitle: { fontSize: 17, fontWeight: '600', color: colors.foreground },
  headerSubtitle: { fontSize: 12, color: colors.mutedForeground },
  headerIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: `${colors.primary}12`, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.md },
  highlightsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.lg, gap: spacing.xs },
  highlightItem: { alignItems: 'center', flex: 1, gap: 4 },
  highlightIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: `${colors.primary}10`, alignItems: 'center', justifyContent: 'center' },
  highlightLabel: { fontSize: 11, fontWeight: '500', color: colors.mutedForeground, textAlign: 'center' },
  sectionLabel: { fontSize: 15, fontWeight: '600', color: colors.foreground, marginBottom: spacing.sm },
  tierCard: { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.cardBorder },
  tierCardPopular: { borderColor: colors.primary, borderWidth: 1.5 },
  popularBadge: { position: 'absolute', top: -9, alignSelf: 'center', left: '30%', backgroundColor: colors.primary, paddingHorizontal: 10, paddingVertical: 2, borderRadius: radius.full, zIndex: 1 },
  popularBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },
  tierHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  tierIconWrap: { width: 36, height: 36, borderRadius: 12, backgroundColor: `${colors.muted}`, alignItems: 'center', justifyContent: 'center' },
  tierName: { fontSize: 15, fontWeight: '600', color: colors.foreground },
  tierDesc: { fontSize: 12, color: colors.mutedForeground, marginTop: 1 },
  tierPrice: { fontSize: 18, fontWeight: '700', color: colors.foreground },
  tierFeatures: { paddingLeft: spacing.xs, marginBottom: spacing.sm },
  tierFeatureRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 },
  tierFeatureText: { fontSize: 13, color: colors.foreground },
  tierCta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: radius.md, backgroundColor: `${colors.primary}10` },
  tierCtaPopular: { backgroundColor: colors.primary },
  tierCtaText: { fontSize: 14, fontWeight: '600', color: colors.primary },
  processRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md },
  processStep: { flex: 1, alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.sm, borderWidth: 1, borderColor: colors.cardBorder },
  processIconWrap: { width: 32, height: 32, borderRadius: 16, backgroundColor: `${colors.primary}12`, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  processTitle: { fontSize: 13, fontWeight: '600', color: colors.foreground },
  processDesc: { fontSize: 11, color: colors.mutedForeground, textAlign: 'center', marginTop: 1 },
  processArrow: { position: 'absolute', right: -12, top: '40%', zIndex: 1 },
  formCard: { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.md, borderWidth: 1, borderColor: colors.cardBorder },
  formTitle: { fontSize: 17, fontWeight: '600', color: colors.foreground },
  selectedTierPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: `${colors.primary}10`, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full, alignSelf: 'flex-start', marginBottom: spacing.sm },
  fieldLabel: { fontSize: 13, fontWeight: '500', color: colors.foreground, marginBottom: 6, marginTop: spacing.md },
  input: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, fontSize: 15, color: colors.foreground, marginBottom: 2 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full, backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: '500', color: colors.foreground },
  chipTextActive: { color: '#fff' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md, marginBottom: spacing.xs },
  switchLabel: { fontSize: 14, color: colors.foreground, flex: 1, marginRight: spacing.sm },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 14, marginTop: spacing.lg },
  submitBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  successCard: { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.lg, alignItems: 'center', borderWidth: 1, borderColor: `${colors.success}30` },
  successTitle: { fontSize: 17, fontWeight: '600', color: colors.foreground, marginBottom: spacing.xs },
  successDesc: { fontSize: 14, color: colors.mutedForeground, textAlign: 'center', lineHeight: 20 },
});
