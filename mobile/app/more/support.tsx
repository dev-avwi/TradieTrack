import { useState, useMemo, useRef } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  StyleSheet, 
  TouchableOpacity,
  Animated,
  Linking,
  LayoutAnimation,
  Platform,
  UIManager
} from 'react-native';
import { Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, shadows, typography, iconSizes } from '../../src/lib/design-tokens';
import AppTour from '../../src/components/AppTour';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQCategory {
  id: string;
  title: string;
  icon: keyof typeof Feather.glyphMap;
  items: FAQItem[];
}

const FAQ_CATEGORIES: FAQCategory[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: 'play-circle',
    items: [
      {
        question: 'How do I create my first job?',
        answer: 'Go to the Jobs tab and tap the + button. Fill in the job details including client, address, and description. You can also add photos and notes as you work.',
      },
      {
        question: 'How do I add my first client?',
        answer: 'Navigate to Profile > Clients and tap "Add Client". Enter their name, contact details, and address. Clients are automatically created when you add them to a new job too.',
      },
      {
        question: 'How do I set up my business details?',
        answer: 'Go to Profile > Business Settings to add your business name, ABN, contact details, and logo. This information appears on your quotes and invoices.',
      },
      {
        question: 'Can I customise my branding?',
        answer: 'Yes! Go to Profile > Branding to set your primary colour, upload your logo, and customise how your documents look to clients.',
      },
    ],
  },
  {
    id: 'jobs-scheduling',
    title: 'Jobs & Scheduling',
    icon: 'briefcase',
    items: [
      {
        question: 'What do the job statuses mean?',
        answer: 'Jobs flow through stages: Pending (new), Scheduled (date set), In Progress (started), Done (completed), and Invoiced (payment sent). You can update status with a tap.',
      },
      {
        question: 'How do I add photos to a job?',
        answer: 'Open any job and tap the camera icon or "Add Photos". You can take new photos or select from your gallery. Photos are organised as before/after for documentation.',
      },
      {
        question: 'How do I schedule a job?',
        answer: 'Open a job and tap "Schedule" to set a date and time. You can also drag jobs on the calendar view or use the dispatch board for team scheduling.',
      },
      {
        question: 'How do I mark a job as complete?',
        answer: 'Open the job and tap "Mark Complete" or swipe to change status. You can add completion notes, final photos, and get the client signature if needed.',
      },
    ],
  },
  {
    id: 'quotes',
    title: 'Quotes',
    icon: 'file-text',
    items: [
      {
        question: 'How do I create a quote?',
        answer: 'Go to Profile > Quotes and tap + to create a new quote. Select a client, add line items with descriptions and prices, then preview before sending.',
      },
      {
        question: 'How do I send a quote to a client?',
        answer: 'After creating a quote, tap "Send" to email it directly to your client. They\'ll receive a professional PDF with your branding.',
      },
      {
        question: 'Can I request a deposit on quotes?',
        answer: 'Yes! When creating a quote, you can set a deposit percentage or fixed amount. Clients will see this clearly when they view the quote.',
      },
      {
        question: 'How do I convert a quote to an invoice?',
        answer: 'Once a quote is accepted, open it and tap "Convert to Invoice". All the details will be copied over, ready for you to send.',
      },
    ],
  },
  {
    id: 'invoices-payments',
    title: 'Invoices & Payments',
    icon: 'dollar-sign',
    items: [
      {
        question: 'How do I create an invoice?',
        answer: 'Go to Profile > Invoices and tap + to create one, or convert an accepted quote. Add your line items, payment terms, and send to the client.',
      },
      {
        question: 'How do I send an invoice?',
        answer: 'After creating an invoice, tap "Send" to email it to your client. They\'ll receive a professional PDF with payment instructions.',
      },
      {
        question: 'How do I connect Stripe for payments?',
        answer: 'Go to Profile > Payments and tap "Connect Stripe". Follow the setup wizard to link your bank account. Clients can then pay online.',
      },
      {
        question: 'How do I record a payment?',
        answer: 'Open an invoice and tap "Record Payment". Enter the amount, date, and payment method. The invoice status will update automatically.',
      },
      {
        question: 'How do I handle overdue invoices?',
        answer: 'TradieTrack can send automatic reminders. Go to Profile > Automations to set up overdue payment reminders. You can also manually send reminders from any invoice.',
      },
    ],
  },
  {
    id: 'team-management',
    title: 'Team Management',
    icon: 'users',
    items: [
      {
        question: 'How do I add team members?',
        answer: 'Go to Profile > Team Management and tap "Invite Member". Enter their email and select their role. They\'ll receive an invitation to join your team.',
      },
      {
        question: 'What are the different team roles?',
        answer: 'Admin has full access, Tradies can manage their assigned jobs, and Office Staff can handle quotes and invoices. Customise permissions for each role.',
      },
      {
        question: 'How do I assign jobs to team members?',
        answer: 'When creating or editing a job, use the "Assign to" field to select a team member. They\'ll be notified and can see the job in their dashboard.',
      },
    ],
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    icon: 'tool',
    items: [
      {
        question: 'Emails aren\'t sending - what do I do?',
        answer: 'Check Profile > Integrations to verify your email is connected. Make sure your internet connection is stable and try resending. Contact support if issues persist.',
      },
      {
        question: 'Stripe connection issues?',
        answer: 'Go to Profile > Payments and check your connection status. You may need to re-authenticate. Ensure your Stripe account is fully verified.',
      },
      {
        question: 'Data isn\'t syncing across devices?',
        answer: 'Make sure you\'re signed in with the same account on all devices. Check your internet connection. Pull down to refresh any screen to force a sync.',
      },
      {
        question: 'PDF quotes/invoices look wrong?',
        answer: 'Check your business settings and branding are complete. Try regenerating the PDF. If issues persist, contact support with a screenshot.',
      },
      {
        question: 'How do I request a new feature?',
        answer: 'We love feedback! Email us at support@tradietrack.com.au with your feature request. We review all suggestions for future updates.',
      },
    ],
  },
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
  tourCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderWidth: 2,
    borderColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    ...shadows.sm,
  },
  tourIconContainer: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tourContent: {
    flex: 1,
  },
  tourTitle: {
    ...typography.subtitle,
    color: colors.foreground,
    marginBottom: 2,
  },
  tourSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
    paddingLeft: spacing.xs,
  },
  faqSection: {
    marginBottom: spacing.xl,
  },
  categoryCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    overflow: 'hidden',
    ...shadows.sm,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  categoryIconContainer: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTitle: {
    flex: 1,
    ...typography.body,
    fontWeight: '600',
    color: colors.foreground,
  },
  categoryItems: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  faqItem: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  faqItemLast: {
    borderBottomWidth: 0,
  },
  faqQuestion: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    paddingLeft: spacing.xl,
    gap: spacing.md,
  },
  faqQuestionText: {
    flex: 1,
    ...typography.body,
    color: colors.foreground,
  },
  faqAnswer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
  },
  faqAnswerText: {
    ...typography.body,
    color: colors.mutedForeground,
    lineHeight: 22,
  },
  contactSection: {
    marginBottom: spacing.xl,
  },
  contactCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.sm,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  contactItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  contactIconContainer: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactContent: {
    flex: 1,
  },
  contactTitle: {
    ...typography.body,
    fontWeight: '500',
    color: colors.foreground,
  },
  contactSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  footer: {
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerText: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  versionText: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
});

interface AccordionCategoryProps {
  category: FAQCategory;
  isExpanded: boolean;
  onToggle: () => void;
  expandedItems: Set<string>;
  onToggleItem: (itemKey: string) => void;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}

function AccordionCategory({ 
  category, 
  isExpanded, 
  onToggle, 
  expandedItems, 
  onToggleItem,
  colors,
  styles 
}: AccordionCategoryProps) {
  const rotateAnim = useRef(new Animated.Value(isExpanded ? 1 : 0)).current;

  const handleToggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Animated.timing(rotateAnim, {
      toValue: isExpanded ? 0 : 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
    onToggle();
  };

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <View style={styles.categoryCard}>
      <TouchableOpacity 
        style={styles.categoryHeader} 
        onPress={handleToggle}
        activeOpacity={0.7}
      >
        <View style={styles.categoryIconContainer}>
          <Feather name={category.icon} size={iconSizes.lg} color={colors.primary} />
        </View>
        <Text style={styles.categoryTitle}>{category.title}</Text>
        <Animated.View style={{ transform: [{ rotate: rotation }] }}>
          <Feather name="chevron-down" size={iconSizes.lg} color={colors.mutedForeground} />
        </Animated.View>
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.categoryItems}>
          {category.items.map((item, index) => {
            const itemKey = `${category.id}-${index}`;
            const isItemExpanded = expandedItems.has(itemKey);
            
            return (
              <FAQItemComponent
                key={itemKey}
                item={item}
                isExpanded={isItemExpanded}
                onToggle={() => onToggleItem(itemKey)}
                isLast={index === category.items.length - 1}
                colors={colors}
                styles={styles}
              />
            );
          })}
        </View>
      )}
    </View>
  );
}

interface FAQItemComponentProps {
  item: FAQItem;
  isExpanded: boolean;
  onToggle: () => void;
  isLast: boolean;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}

function FAQItemComponent({ item, isExpanded, onToggle, isLast, colors, styles }: FAQItemComponentProps) {
  const rotateAnim = useRef(new Animated.Value(isExpanded ? 1 : 0)).current;

  const handleToggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Animated.timing(rotateAnim, {
      toValue: isExpanded ? 0 : 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
    onToggle();
  };

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <View style={[styles.faqItem, isLast && styles.faqItemLast]}>
      <TouchableOpacity 
        style={styles.faqQuestion} 
        onPress={handleToggle}
        activeOpacity={0.7}
      >
        <Text style={styles.faqQuestionText}>{item.question}</Text>
        <Animated.View style={{ transform: [{ rotate: rotation }] }}>
          <Feather name="chevron-down" size={iconSizes.md} color={colors.mutedForeground} />
        </Animated.View>
      </TouchableOpacity>
      
      {isExpanded && (
        <View style={styles.faqAnswer}>
          <Text style={styles.faqAnswerText}>{item.answer}</Text>
        </View>
      )}
    </View>
  );
}

export default function SupportScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [showTour, setShowTour] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const toggleItem = (itemKey: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemKey)) {
        next.delete(itemKey);
      } else {
        next.add(itemKey);
      }
      return next;
    });
  };

  const handleEmailSupport = () => {
    Linking.openURL('mailto:support@tradietrack.com.au');
  };

  const handleOpenDocs = () => {
    Linking.openURL('https://tradietrack.com/docs');
  };

  return (
    <>
      <Stack.Screen 
        options={{ 
          title: 'Help & Support',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.foreground,
        }} 
      />
      
      <ScrollView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Feather name="help-circle" size={28} color={colors.primary} />
            </View>
            <Text style={styles.headerTitle}>Help & Support</Text>
            <Text style={styles.headerSubtitle}>
              Get help and find answers to common questions
            </Text>
          </View>

          <TouchableOpacity 
            style={styles.tourCard}
            onPress={() => setShowTour(true)}
            activeOpacity={0.8}
          >
            <View style={styles.tourIconContainer}>
              <Feather name="navigation" size={iconSizes.xl} color={colors.primary} />
            </View>
            <View style={styles.tourContent}>
              <Text style={styles.tourTitle}>Start App Tour</Text>
              <Text style={styles.tourSubtitle}>Take a guided walkthrough of the app</Text>
            </View>
            <Feather name="chevron-right" size={iconSizes.lg} color={colors.mutedForeground} />
          </TouchableOpacity>

          <View style={styles.faqSection}>
            <Text style={styles.sectionTitle}>FREQUENTLY ASKED QUESTIONS</Text>
            
            {FAQ_CATEGORIES.map(category => (
              <AccordionCategory
                key={category.id}
                category={category}
                isExpanded={expandedCategories.has(category.id)}
                onToggle={() => toggleCategory(category.id)}
                expandedItems={expandedItems}
                onToggleItem={toggleItem}
                colors={colors}
                styles={styles}
              />
            ))}
          </View>

          <View style={styles.contactSection}>
            <Text style={styles.sectionTitle}>CONTACT US</Text>
            
            <View style={styles.contactCard}>
              <TouchableOpacity 
                style={[styles.contactItem, styles.contactItemBorder]}
                onPress={handleEmailSupport}
                activeOpacity={0.7}
              >
                <View style={styles.contactIconContainer}>
                  <Feather name="mail" size={iconSizes.lg} color={colors.primary} />
                </View>
                <View style={styles.contactContent}>
                  <Text style={styles.contactTitle}>Email Support</Text>
                  <Text style={styles.contactSubtitle}>support@tradietrack.com.au</Text>
                </View>
                <Feather name="external-link" size={iconSizes.md} color={colors.mutedForeground} />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.contactItem}
                onPress={handleOpenDocs}
                activeOpacity={0.7}
              >
                <View style={styles.contactIconContainer}>
                  <Feather name="book-open" size={iconSizes.lg} color={colors.primary} />
                </View>
                <View style={styles.contactContent}>
                  <Text style={styles.contactTitle}>Documentation</Text>
                  <Text style={styles.contactSubtitle}>Browse guides and tutorials</Text>
                </View>
                <Feather name="external-link" size={iconSizes.md} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>TradieTrack Mobile</Text>
            <Text style={styles.versionText}>Version 1.0.0 (Beta)</Text>
          </View>
        </View>
      </ScrollView>

      <AppTour visible={showTour} onClose={() => setShowTour(false)} />
    </>
  );
}
