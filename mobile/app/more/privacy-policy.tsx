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

export default function PrivacyPolicyScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <>
      <Stack.Screen 
        options={{ 
          title: 'Privacy Policy',
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
            At TradieTrack, we are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, store, and protect your data when you use our mobile application and services.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Information Collection</Text>
          <Text style={styles.paragraph}>
            We collect information you provide directly to us when you:
          </Text>
          <View style={styles.bulletList}>
            <BulletItem text="Create an account (name, email, phone number, business details)" colors={colors} styles={styles} />
            <BulletItem text="Add clients, jobs, quotes, and invoices to the app" colors={colors} styles={styles} />
            <BulletItem text="Upload photos, documents, and other files" colors={colors} styles={styles} />
            <BulletItem text="Use location services for job site tracking" colors={colors} styles={styles} />
            <BulletItem text="Contact our support team" colors={colors} styles={styles} />
          </View>
          <Text style={[styles.paragraph, styles.lastParagraph]}>
            We may also collect technical information such as device type, operating system, app version, and usage analytics to improve our services.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>How We Use Information</Text>
          <Text style={styles.paragraph}>
            We use the information we collect to:
          </Text>
          <View style={styles.bulletList}>
            <BulletItem text="Provide, maintain, and improve our services" colors={colors} styles={styles} />
            <BulletItem text="Process your transactions and send related information" colors={colors} styles={styles} />
            <BulletItem text="Send you technical notices, updates, and support messages" colors={colors} styles={styles} />
            <BulletItem text="Respond to your comments, questions, and customer service requests" colors={colors} styles={styles} />
            <BulletItem text="Generate quotes, invoices, and business reports" colors={colors} styles={styles} />
            <BulletItem text="Enable location-based features such as job site tracking" colors={colors} styles={styles} />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Data Storage & Security</Text>
          <Text style={styles.paragraph}>
            Your data is stored securely on encrypted servers hosted in Australia. We implement industry-standard security measures to protect your information, including:
          </Text>
          <View style={styles.bulletList}>
            <BulletItem text="SSL/TLS encryption for all data transmission" colors={colors} styles={styles} />
            <BulletItem text="Encrypted storage for sensitive information" colors={colors} styles={styles} />
            <BulletItem text="Regular security audits and updates" colors={colors} styles={styles} />
            <BulletItem text="Access controls and authentication requirements" colors={colors} styles={styles} />
          </View>
          <Text style={[styles.paragraph, styles.lastParagraph]}>
            We retain your data for as long as your account is active or as needed to provide you services. You may request deletion of your data at any time.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Third Party Services</Text>
          <Text style={styles.paragraph}>
            We may share your information with trusted third-party service providers who assist us in operating our app:
          </Text>
          <View style={styles.bulletList}>
            <BulletItem text="Stripe for payment processing" colors={colors} styles={styles} />
            <BulletItem text="SendGrid for email communications" colors={colors} styles={styles} />
            <BulletItem text="Google Maps for location services" colors={colors} styles={styles} />
            <BulletItem text="Cloud storage providers for file hosting" colors={colors} styles={styles} />
          </View>
          <Text style={[styles.paragraph, styles.lastParagraph]}>
            These providers are contractually obligated to protect your information and use it only for the purposes we specify.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Your Rights</Text>
          <Text style={styles.paragraph}>
            Under Australian privacy law, you have the right to:
          </Text>
          <View style={styles.bulletList}>
            <BulletItem text="Access the personal information we hold about you" colors={colors} styles={styles} />
            <BulletItem text="Request correction of inaccurate information" colors={colors} styles={styles} />
            <BulletItem text="Request deletion of your personal information" colors={colors} styles={styles} />
            <BulletItem text="Opt out of marketing communications" colors={colors} styles={styles} />
            <BulletItem text="Export your data in a portable format" colors={colors} styles={styles} />
          </View>
          <Text style={[styles.paragraph, styles.lastParagraph]}>
            To exercise any of these rights, please contact us using the details below.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Contact Information</Text>
          <Text style={styles.paragraph}>
            If you have any questions about this Privacy Policy or our data practices, please contact us at:
          </Text>
          <View style={styles.bulletList}>
            <BulletItem text="Email: privacy@tradietrack.com.au" colors={colors} styles={styles} />
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
