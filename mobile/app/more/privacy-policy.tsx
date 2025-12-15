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
  subSectionTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.foreground,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
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
  highlightBox: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  highlightText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '500',
    lineHeight: 22,
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
            TradieTrack Pty Ltd (ABN to be assigned) ("TradieTrack", "we", "us", or "our") is committed to protecting your privacy and handling your personal information in accordance with the Privacy Act 1988 (Cth) and the Australian Privacy Principles (APPs).
          </Text>
          <Text style={[styles.paragraph, styles.lastParagraph]}>
            This Privacy Policy explains how we collect, use, store, disclose, and protect your personal information when you use our mobile application and related services designed for Australian tradespeople and service businesses.
          </Text>
        </View>

        <View style={styles.highlightBox}>
          <Text style={styles.highlightText}>
            By using TradieTrack, you consent to the collection and use of your information as described in this Privacy Policy in accordance with Australian law.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>1. Information We Collect</Text>
          
          <Text style={styles.subSectionTitle}>Personal Information</Text>
          <Text style={styles.paragraph}>
            We collect personal information that you provide directly to us, including:
          </Text>
          <View style={styles.bulletList}>
            <BulletItem text="Full name, email address, and phone number" colors={colors} styles={styles} />
            <BulletItem text="Business name, ABN/ACN, and business address" colors={colors} styles={styles} />
            <BulletItem text="Trade licence numbers and qualifications" colors={colors} styles={styles} />
            <BulletItem text="Profile photo and business logo" colors={colors} styles={styles} />
          </View>

          <Text style={styles.subSectionTitle}>Client Information</Text>
          <Text style={styles.paragraph}>
            Information about your clients that you enter into the app:
          </Text>
          <View style={styles.bulletList}>
            <BulletItem text="Client names, addresses, and contact details" colors={colors} styles={styles} />
            <BulletItem text="Job site locations and property details" colors={colors} styles={styles} />
            <BulletItem text="Job history and service records" colors={colors} styles={styles} />
          </View>

          <Text style={styles.subSectionTitle}>Location Data</Text>
          <Text style={styles.paragraph}>
            With your consent, we collect:
          </Text>
          <View style={styles.bulletList}>
            <BulletItem text="Real-time GPS location for job site check-in/check-out" colors={colors} styles={styles} />
            <BulletItem text="Geofencing data for automatic time tracking" colors={colors} styles={styles} />
            <BulletItem text="Travel routes for mileage tracking (if enabled)" colors={colors} styles={styles} />
          </View>

          <Text style={styles.subSectionTitle}>Photos and Documents</Text>
          <View style={styles.bulletList}>
            <BulletItem text="Before and after job photos" colors={colors} styles={styles} />
            <BulletItem text="Site inspection images and documentation" colors={colors} styles={styles} />
            <BulletItem text="Signed quotes, contracts, and completion certificates" colors={colors} styles={styles} />
            <BulletItem text="Uploaded receipts and expense documentation" colors={colors} styles={styles} />
          </View>

          <Text style={styles.subSectionTitle}>Financial Information</Text>
          <View style={styles.bulletList}>
            <BulletItem text="Payment card details (processed securely by Stripe)" colors={colors} styles={styles} />
            <BulletItem text="Bank account details for payment receipts" colors={colors} styles={styles} />
            <BulletItem text="Invoice and quote amounts" colors={colors} styles={styles} />
            <BulletItem text="Expense records and financial reports" colors={colors} styles={styles} />
          </View>

          <Text style={styles.subSectionTitle}>Technical Information</Text>
          <Text style={[styles.paragraph, styles.lastParagraph]}>
            We automatically collect device information, IP address, app version, operating system, crash reports, and usage analytics to improve our services.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>2. How We Use Your Information</Text>
          
          <Text style={styles.subSectionTitle}>Business Operations</Text>
          <View style={styles.bulletList}>
            <BulletItem text="Creating and managing jobs, quotes, and invoices" colors={colors} styles={styles} />
            <BulletItem text="Processing payments and tracking expenses" colors={colors} styles={styles} />
            <BulletItem text="Enabling time tracking and job scheduling" colors={colors} styles={styles} />
            <BulletItem text="Managing client relationships and communications" colors={colors} styles={styles} />
            <BulletItem text="Generating business reports and analytics" colors={colors} styles={styles} />
          </View>

          <Text style={styles.subSectionTitle}>Service Improvement</Text>
          <View style={styles.bulletList}>
            <BulletItem text="Analysing usage patterns to improve app functionality" colors={colors} styles={styles} />
            <BulletItem text="Developing new features based on user feedback" colors={colors} styles={styles} />
            <BulletItem text="Troubleshooting technical issues and bugs" colors={colors} styles={styles} />
            <BulletItem text="Personalising your experience within the app" colors={colors} styles={styles} />
          </View>

          <Text style={styles.subSectionTitle}>Communications</Text>
          <View style={styles.bulletList}>
            <BulletItem text="Sending transactional emails (invoices, receipts, reminders)" colors={colors} styles={styles} />
            <BulletItem text="Providing customer support and responding to enquiries" colors={colors} styles={styles} />
            <BulletItem text="Sending service updates and important notifications" colors={colors} styles={styles} />
            <BulletItem text="Marketing communications (with your consent)" colors={colors} styles={styles} />
          </View>

          <Text style={styles.subSectionTitle}>Legal Compliance</Text>
          <Text style={[styles.paragraph, styles.lastParagraph]}>
            We may use your information to comply with legal obligations, resolve disputes, enforce our terms, and protect our rights and the rights of others.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>3. Data Storage and Security</Text>
          <Text style={styles.paragraph}>
            Your data security is our priority. We implement industry-standard measures to protect your information:
          </Text>
          <View style={styles.bulletList}>
            <BulletItem text="Data is stored on secure cloud servers with encryption at rest" colors={colors} styles={styles} />
            <BulletItem text="All data transmission uses TLS 1.3 encryption" colors={colors} styles={styles} />
            <BulletItem text="Payment information is processed by PCI-DSS compliant Stripe" colors={colors} styles={styles} />
            <BulletItem text="Regular security audits and vulnerability assessments" colors={colors} styles={styles} />
            <BulletItem text="Access controls and multi-factor authentication" colors={colors} styles={styles} />
            <BulletItem text="Automated backups with disaster recovery procedures" colors={colors} styles={styles} />
          </View>
          <Text style={styles.paragraph}>
            While we take reasonable steps to protect your information, no method of electronic storage or transmission is 100% secure. We cannot guarantee absolute security.
          </Text>
          <Text style={styles.subSectionTitle}>Data Retention</Text>
          <Text style={[styles.paragraph, styles.lastParagraph]}>
            We retain your personal information for as long as your account is active or as needed to provide services, comply with legal obligations (including tax record-keeping requirements of 5-7 years), resolve disputes, and enforce our agreements.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>4. Third-Party Services</Text>
          <Text style={styles.paragraph}>
            We share your information with trusted third-party service providers who assist in operating our platform:
          </Text>
          
          <Text style={styles.subSectionTitle}>Stripe (Payment Processing)</Text>
          <Text style={styles.paragraph}>
            Stripe processes all payment transactions. Your payment card details are handled directly by Stripe and are not stored on our servers. Stripe is PCI-DSS Level 1 certified.
          </Text>

          <Text style={styles.subSectionTitle}>SendGrid (Email Communications)</Text>
          <Text style={styles.paragraph}>
            SendGrid delivers transactional emails including invoices, quotes, and reminders on your behalf to your clients.
          </Text>

          <Text style={styles.subSectionTitle}>Google (Maps and Location Services)</Text>
          <Text style={styles.paragraph}>
            Google Maps provides location services, address autocomplete, and mapping functionality for job site navigation.
          </Text>

          <Text style={styles.subSectionTitle}>Cloud Infrastructure</Text>
          <Text style={styles.paragraph}>
            We use secure cloud hosting providers for data storage and application hosting. Data may be stored in Australia or overseas data centres with appropriate security measures.
          </Text>

          <Text style={[styles.paragraph, styles.lastParagraph]}>
            These providers are contractually bound to protect your information and may only use it for the specific services they provide to us.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>5. Australian Privacy Principles Compliance</Text>
          <Text style={styles.paragraph}>
            We are committed to complying with the 13 Australian Privacy Principles (APPs) under the Privacy Act 1988 (Cth). This includes:
          </Text>
          <View style={styles.bulletList}>
            <BulletItem text="APP 1: Open and transparent management of personal information" colors={colors} styles={styles} />
            <BulletItem text="APP 2: Allowing anonymity and pseudonymity where practicable" colors={colors} styles={styles} />
            <BulletItem text="APP 3: Collecting only information that is reasonably necessary" colors={colors} styles={styles} />
            <BulletItem text="APP 5: Notifying you about the collection of information" colors={colors} styles={styles} />
            <BulletItem text="APP 6: Using information only for disclosed purposes" colors={colors} styles={styles} />
            <BulletItem text="APP 8: Taking reasonable steps for overseas data transfers" colors={colors} styles={styles} />
            <BulletItem text="APP 11: Taking reasonable steps to secure personal information" colors={colors} styles={styles} />
            <BulletItem text="APP 12: Providing access to personal information on request" colors={colors} styles={styles} />
            <BulletItem text="APP 13: Correcting personal information upon request" colors={colors} styles={styles} />
          </View>
          <Text style={[styles.paragraph, styles.lastParagraph]}>
            For the full text of the Australian Privacy Principles, visit the Office of the Australian Information Commissioner (OAIC) website at www.oaic.gov.au.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>6. Your Rights</Text>
          <Text style={styles.paragraph}>
            Under Australian privacy law, you have the following rights:
          </Text>
          
          <Text style={styles.subSectionTitle}>Right to Access</Text>
          <Text style={styles.paragraph}>
            You can request access to the personal information we hold about you at any time. We will respond within 30 days.
          </Text>

          <Text style={styles.subSectionTitle}>Right to Correction</Text>
          <Text style={styles.paragraph}>
            You can request that we correct any inaccurate, incomplete, or outdated personal information. You can also update much of your information directly in the app settings.
          </Text>

          <Text style={styles.subSectionTitle}>Right to Deletion</Text>
          <Text style={styles.paragraph}>
            You can request deletion of your personal information, subject to our legal obligations to retain certain records (e.g., tax and financial records).
          </Text>

          <Text style={styles.subSectionTitle}>Right to Data Portability</Text>
          <Text style={styles.paragraph}>
            You can request an export of your data in a commonly used, machine-readable format.
          </Text>

          <Text style={styles.subSectionTitle}>Right to Opt-Out</Text>
          <Text style={styles.paragraph}>
            You can opt out of marketing communications at any time by using the unsubscribe link in emails or updating your notification preferences in the app.
          </Text>

          <Text style={styles.subSectionTitle}>Right to Complain</Text>
          <Text style={[styles.paragraph, styles.lastParagraph]}>
            If you believe we have breached your privacy, you can lodge a complaint with us directly or with the Office of the Australian Information Commissioner (OAIC) at www.oaic.gov.au.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>7. Cookies and Tracking</Text>
          <Text style={styles.paragraph}>
            Our mobile app may use local storage and similar technologies to:
          </Text>
          <View style={styles.bulletList}>
            <BulletItem text="Remember your preferences and settings" colors={colors} styles={styles} />
            <BulletItem text="Enable offline functionality" colors={colors} styles={styles} />
            <BulletItem text="Analyse app usage and performance" colors={colors} styles={styles} />
            <BulletItem text="Provide personalised experiences" colors={colors} styles={styles} />
          </View>
          <Text style={[styles.paragraph, styles.lastParagraph]}>
            You can manage these settings through your device's privacy controls.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>8. Children's Privacy</Text>
          <Text style={[styles.paragraph, styles.lastParagraph]}>
            TradieTrack is designed for business use by adults and is not intended for children under 18 years of age. We do not knowingly collect personal information from children.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>9. Changes to This Policy</Text>
          <Text style={[styles.paragraph, styles.lastParagraph]}>
            We may update this Privacy Policy from time to time to reflect changes in our practices or legal requirements. We will notify you of any material changes via email or in-app notification. Your continued use of TradieTrack after such changes constitutes acceptance of the updated policy.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>10. Contact Us</Text>
          <Text style={styles.paragraph}>
            If you have any questions about this Privacy Policy, wish to exercise your privacy rights, or have a complaint, please contact us:
          </Text>
          <View style={styles.bulletList}>
            <BulletItem text="Email: privacy@tradietrack.com.au" colors={colors} styles={styles} />
            <BulletItem text="Website: www.tradietrack.com.au/privacy" colors={colors} styles={styles} />
            <BulletItem text="Mail: TradieTrack Privacy Officer, PO Box [TBC], Sydney NSW 2000" colors={colors} styles={styles} />
          </View>
          <Text style={[styles.paragraph, styles.lastParagraph]}>
            We aim to respond to all privacy enquiries within 30 days. If you are not satisfied with our response, you may lodge a complaint with the Office of the Australian Information Commissioner (OAIC).
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Last Updated: 15 December 2025</Text>
          <Text style={styles.footerText}>Version 1.0</Text>
        </View>
      </ScrollView>
    </>
  );
}
