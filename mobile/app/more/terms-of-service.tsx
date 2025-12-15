import { useMemo } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  StyleSheet 
} from 'react-native';
import { Stack } from 'expo-router';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, shadows, typography } from '../../src/lib/design-tokens';

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  sectionTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
    marginBottom: spacing.md,
  },
  paragraph: {
    ...typography.body,
    color: colors.foreground,
    lineHeight: 24,
    marginBottom: spacing.lg,
  },
  lastParagraph: {
    marginBottom: 0,
  },
  bulletList: {
    marginBottom: spacing.lg,
  },
  bulletItem: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  bullet: {
    ...typography.body,
    color: colors.primary,
    marginRight: spacing.md,
    lineHeight: 24,
  },
  bulletText: {
    ...typography.body,
    color: colors.foreground,
    flex: 1,
    lineHeight: 24,
  },
  footer: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.lg,
  },
  footerText: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
});

interface BulletItemProps {
  text: string;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}

function BulletItem({ text, colors, styles }: BulletItemProps) {
  return (
    <View style={styles.bulletItem}>
      <Text style={styles.bullet}>•</Text>
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

export default function TermsOfServiceScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <>
      <Stack.Screen 
        options={{ 
          title: 'Terms of Service',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.foreground,
        }} 
      />
      <ScrollView 
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.paragraph}>
            Welcome to TradieTrack. These Terms of Service ("Terms") govern your use of our mobile application and services. By accessing or using TradieTrack, you agree to be bound by these Terms.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Acceptance of Terms</Text>
          <Text style={styles.paragraph}>
            By creating an account or using TradieTrack, you acknowledge that you have read, understood, and agree to be bound by these Terms and our Privacy Policy.
          </Text>
          <Text style={[styles.paragraph, styles.lastParagraph]}>
            If you do not agree to these Terms, you may not access or use our services. We reserve the right to modify these Terms at any time. Continued use of the service after changes constitutes acceptance of the modified Terms.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Description of Service</Text>
          <Text style={styles.paragraph}>
            TradieTrack is a business management platform designed for tradespeople and service businesses. Our services include:
          </Text>
          <View style={styles.bulletList}>
            <BulletItem text="Job scheduling and management" colors={colors} styles={styles} />
            <BulletItem text="Client relationship management (CRM)" colors={colors} styles={styles} />
            <BulletItem text="Quote and invoice generation" colors={colors} styles={styles} />
            <BulletItem text="Payment processing and tracking" colors={colors} styles={styles} />
            <BulletItem text="Time tracking and reporting" colors={colors} styles={styles} />
            <BulletItem text="Team management and dispatch" colors={colors} styles={styles} />
          </View>
          <Text style={[styles.paragraph, styles.lastParagraph]}>
            We may add, modify, or discontinue features at our discretion with reasonable notice to users.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>User Responsibilities</Text>
          <Text style={styles.paragraph}>
            As a user of TradieTrack, you agree to:
          </Text>
          <View style={styles.bulletList}>
            <BulletItem text="Provide accurate and complete information when creating your account" colors={colors} styles={styles} />
            <BulletItem text="Maintain the security of your account credentials" colors={colors} styles={styles} />
            <BulletItem text="Use the service only for lawful business purposes" colors={colors} styles={styles} />
            <BulletItem text="Not share your account with unauthorised users" colors={colors} styles={styles} />
            <BulletItem text="Comply with all applicable Australian laws and regulations" colors={colors} styles={styles} />
            <BulletItem text="Not attempt to reverse engineer or compromise our systems" colors={colors} styles={styles} />
          </View>
          <Text style={[styles.paragraph, styles.lastParagraph]}>
            You are responsible for all activity that occurs under your account. Notify us immediately if you suspect unauthorised access.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Payment Terms</Text>
          <Text style={styles.paragraph}>
            TradieTrack offers both free and paid subscription plans. For paid plans:
          </Text>
          <View style={styles.bulletList}>
            <BulletItem text="Payments are processed securely through Stripe" colors={colors} styles={styles} />
            <BulletItem text="Subscriptions are billed monthly or annually as selected" colors={colors} styles={styles} />
            <BulletItem text="All prices are in Australian Dollars (AUD) and include GST" colors={colors} styles={styles} />
            <BulletItem text="Refunds are available within 14 days for annual subscriptions" colors={colors} styles={styles} />
            <BulletItem text="You may cancel your subscription at any time through the app" colors={colors} styles={styles} />
          </View>
          <Text style={[styles.paragraph, styles.lastParagraph]}>
            We reserve the right to change pricing with 30 days notice. Price changes will not affect current billing periods.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Limitation of Liability</Text>
          <Text style={styles.paragraph}>
            To the maximum extent permitted by Australian law:
          </Text>
          <View style={styles.bulletList}>
            <BulletItem text="TradieTrack is provided 'as is' without warranties of any kind" colors={colors} styles={styles} />
            <BulletItem text="We are not liable for any indirect, incidental, or consequential damages" colors={colors} styles={styles} />
            <BulletItem text="Our total liability is limited to the amount you paid us in the past 12 months" colors={colors} styles={styles} />
            <BulletItem text="We do not guarantee uninterrupted or error-free service" colors={colors} styles={styles} />
          </View>
          <Text style={[styles.paragraph, styles.lastParagraph]}>
            Nothing in these Terms excludes or limits liability that cannot be excluded under Australian Consumer Law.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Governing Law</Text>
          <Text style={styles.paragraph}>
            These Terms are governed by the laws of Australia. Any disputes arising from these Terms or your use of TradieTrack will be resolved in the courts of New South Wales, Australia.
          </Text>
          <Text style={[styles.paragraph, styles.lastParagraph]}>
            If any provision of these Terms is found to be unenforceable, the remaining provisions will continue in full force and effect.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Contact Information</Text>
          <Text style={styles.paragraph}>
            If you have any questions about these Terms of Service, please contact us at:
          </Text>
          <View style={styles.bulletList}>
            <BulletItem text="Email: legal@tradietrack.com.au" colors={colors} styles={styles} />
            <BulletItem text="Website: www.tradietrack.com.au" colors={colors} styles={styles} />
          </View>
          <Text style={[styles.paragraph, styles.lastParagraph]}>
            We will respond to your inquiry within 30 days.
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Last Updated: 15 December 2025</Text>
        </View>
      </ScrollView>
    </>
  );
}
