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
  warningBox: {
    backgroundColor: colors.destructiveLight || colors.muted,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.destructive,
  },
  warningText: {
    ...typography.body,
    color: colors.foreground,
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
            Welcome to TradieTrack. These Terms of Service ("Terms") constitute a legally binding agreement between you and TradieTrack Pty Ltd (ABN to be assigned) ("TradieTrack", "we", "us", or "our") governing your access to and use of our mobile application and related services.
          </Text>
          <Text style={[styles.paragraph, styles.lastParagraph]}>
            These Terms are governed by Australian law and are designed for Australian tradespeople and service businesses.
          </Text>
        </View>

        <View style={styles.highlightBox}>
          <Text style={styles.highlightText}>
            By creating an account, accessing, or using TradieTrack, you acknowledge that you have read, understood, and agree to be bound by these Terms and our Privacy Policy.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
          <Text style={styles.paragraph}>
            By accessing or using TradieTrack, you confirm that:
          </Text>
          <View style={styles.bulletList}>
            <BulletItem text="You are at least 18 years of age" colors={colors} styles={styles} />
            <BulletItem text="You have the legal capacity to enter into a binding agreement" colors={colors} styles={styles} />
            <BulletItem text="You are using the service for lawful business purposes" colors={colors} styles={styles} />
            <BulletItem text="All registration information you provide is accurate and complete" colors={colors} styles={styles} />
            <BulletItem text="You will maintain the accuracy of such information" colors={colors} styles={styles} />
          </View>
          <Text style={[styles.paragraph, styles.lastParagraph]}>
            If you do not agree to these Terms, you must not access or use TradieTrack. If you are accepting these Terms on behalf of a company or other legal entity, you represent that you have the authority to bind that entity.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>2. Description of Service</Text>
          <Text style={styles.paragraph}>
            TradieTrack is a comprehensive business management platform designed specifically for Australian tradespeople and service businesses. Our services include:
          </Text>
          
          <Text style={styles.subSectionTitle}>Job Management</Text>
          <View style={styles.bulletList}>
            <BulletItem text="Creating, scheduling, and tracking jobs" colors={colors} styles={styles} />
            <BulletItem text="Job site location tracking and mapping" colors={colors} styles={styles} />
            <BulletItem text="Photo documentation (before/after)" colors={colors} styles={styles} />
            <BulletItem text="Digital signatures and completion certificates" colors={colors} styles={styles} />
            <BulletItem text="Job notes, checklists, and custom forms" colors={colors} styles={styles} />
          </View>

          <Text style={styles.subSectionTitle}>Invoicing and Quotes</Text>
          <View style={styles.bulletList}>
            <BulletItem text="Professional quote and invoice generation" colors={colors} styles={styles} />
            <BulletItem text="Customisable templates with your branding" colors={colors} styles={styles} />
            <BulletItem text="Automated payment reminders" colors={colors} styles={styles} />
            <BulletItem text="GST calculation and reporting" colors={colors} styles={styles} />
          </View>

          <Text style={styles.subSectionTitle}>Payment Processing</Text>
          <View style={styles.bulletList}>
            <BulletItem text="Online payment collection via Stripe" colors={colors} styles={styles} />
            <BulletItem text="Credit card, debit card, and bank transfer acceptance" colors={colors} styles={styles} />
            <BulletItem text="Payment tracking and reconciliation" colors={colors} styles={styles} />
            <BulletItem text="Deposit and progress payment collection" colors={colors} styles={styles} />
          </View>

          <Text style={styles.subSectionTitle}>Additional Features</Text>
          <View style={styles.bulletList}>
            <BulletItem text="Client relationship management (CRM)" colors={colors} styles={styles} />
            <BulletItem text="Time tracking and timesheets" colors={colors} styles={styles} />
            <BulletItem text="Team management and job dispatch" colors={colors} styles={styles} />
            <BulletItem text="Expense tracking and reporting" colors={colors} styles={styles} />
            <BulletItem text="Calendar and scheduling tools" colors={colors} styles={styles} />
          </View>

          <Text style={[styles.paragraph, styles.lastParagraph]}>
            We may add, modify, suspend, or discontinue features at our discretion. We will provide reasonable notice of material changes where practicable.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>3. Account Responsibilities</Text>
          <Text style={styles.paragraph}>
            As a TradieTrack user, you are responsible for:
          </Text>
          <View style={styles.bulletList}>
            <BulletItem text="Maintaining the confidentiality of your login credentials" colors={colors} styles={styles} />
            <BulletItem text="All activities that occur under your account" colors={colors} styles={styles} />
            <BulletItem text="Ensuring your team members comply with these Terms" colors={colors} styles={styles} />
            <BulletItem text="Immediately notifying us of any unauthorised access" colors={colors} styles={styles} />
            <BulletItem text="Keeping your contact and business information up to date" colors={colors} styles={styles} />
          </View>
          
          <Text style={styles.subSectionTitle}>Prohibited Conduct</Text>
          <Text style={styles.paragraph}>
            You agree not to:
          </Text>
          <View style={styles.bulletList}>
            <BulletItem text="Use the service for any unlawful purpose" colors={colors} styles={styles} />
            <BulletItem text="Share your account credentials with unauthorised parties" colors={colors} styles={styles} />
            <BulletItem text="Attempt to gain unauthorised access to our systems" colors={colors} styles={styles} />
            <BulletItem text="Interfere with or disrupt the service or servers" colors={colors} styles={styles} />
            <BulletItem text="Reverse engineer, decompile, or disassemble the app" colors={colors} styles={styles} />
            <BulletItem text="Use automated systems to access the service without permission" colors={colors} styles={styles} />
            <BulletItem text="Transmit viruses, malware, or other harmful code" colors={colors} styles={styles} />
            <BulletItem text="Violate any applicable Australian laws or regulations" colors={colors} styles={styles} />
          </View>
          <Text style={[styles.paragraph, styles.lastParagraph]}>
            Violation of these terms may result in immediate account suspension or termination.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>4. Payment Terms</Text>
          
          <Text style={styles.subSectionTitle}>Subscription Plans</Text>
          <Text style={styles.paragraph}>
            TradieTrack offers both free and paid subscription plans. For paid plans:
          </Text>
          <View style={styles.bulletList}>
            <BulletItem text="Subscriptions are available on monthly or annual billing cycles" colors={colors} styles={styles} />
            <BulletItem text="All prices are quoted in Australian Dollars (AUD)" colors={colors} styles={styles} />
            <BulletItem text="Prices include GST where applicable" colors={colors} styles={styles} />
            <BulletItem text="Subscriptions automatically renew unless cancelled" colors={colors} styles={styles} />
          </View>

          <Text style={styles.subSectionTitle}>Payment Processing</Text>
          <Text style={styles.paragraph}>
            All payments are processed securely through Stripe. By providing payment information, you:
          </Text>
          <View style={styles.bulletList}>
            <BulletItem text="Authorise us to charge your payment method for subscription fees" colors={colors} styles={styles} />
            <BulletItem text="Confirm your payment information is accurate and current" colors={colors} styles={styles} />
            <BulletItem text="Agree to Stripe's terms of service for payment processing" colors={colors} styles={styles} />
          </View>

          <Text style={styles.subSectionTitle}>Transaction Fees</Text>
          <Text style={styles.paragraph}>
            When you collect payments from your clients through TradieTrack, standard payment processing fees apply. These are disclosed before you enable payment collection.
          </Text>

          <Text style={styles.subSectionTitle}>Refunds</Text>
          <View style={styles.bulletList}>
            <BulletItem text="Monthly subscriptions: No refunds for partial months" colors={colors} styles={styles} />
            <BulletItem text="Annual subscriptions: Pro-rata refund within first 14 days" colors={colors} styles={styles} />
            <BulletItem text="Refund requests should be sent to billing@tradietrack.com.au" colors={colors} styles={styles} />
          </View>

          <Text style={styles.subSectionTitle}>Price Changes</Text>
          <Text style={[styles.paragraph, styles.lastParagraph]}>
            We reserve the right to change subscription prices with 30 days written notice. Price changes will take effect at the start of your next billing cycle.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>5. Intellectual Property</Text>
          
          <Text style={styles.subSectionTitle}>Our Intellectual Property</Text>
          <Text style={styles.paragraph}>
            TradieTrack, including all software, design, trademarks, logos, content, and documentation, is owned by TradieTrack Pty Ltd and is protected by Australian and international intellectual property laws.
          </Text>
          <View style={styles.bulletList}>
            <BulletItem text="We grant you a limited, non-exclusive, non-transferable licence to use the app" colors={colors} styles={styles} />
            <BulletItem text="This licence is solely for your internal business purposes" colors={colors} styles={styles} />
            <BulletItem text="You may not copy, modify, distribute, or create derivative works" colors={colors} styles={styles} />
            <BulletItem text="All rights not expressly granted are reserved by TradieTrack" colors={colors} styles={styles} />
          </View>

          <Text style={styles.subSectionTitle}>Your Content</Text>
          <Text style={styles.paragraph}>
            You retain ownership of all content you create or upload to TradieTrack ("Your Content"), including:
          </Text>
          <View style={styles.bulletList}>
            <BulletItem text="Client information and job details" colors={colors} styles={styles} />
            <BulletItem text="Photos, documents, and files you upload" colors={colors} styles={styles} />
            <BulletItem text="Quotes, invoices, and custom templates" colors={colors} styles={styles} />
            <BulletItem text="Business branding and logos" colors={colors} styles={styles} />
          </View>
          <Text style={[styles.paragraph, styles.lastParagraph]}>
            By uploading content, you grant us a limited licence to store, process, and display Your Content solely to provide our services to you. We will not use Your Content for any other purpose without your consent.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>6. Limitation of Liability</Text>
          
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              Important: Please read this section carefully as it limits our liability to you.
            </Text>
          </View>

          <Text style={styles.paragraph}>
            To the maximum extent permitted by Australian law:
          </Text>
          <View style={styles.bulletList}>
            <BulletItem text="TradieTrack is provided 'as is' and 'as available' without warranties of any kind, express or implied" colors={colors} styles={styles} />
            <BulletItem text="We do not warrant that the service will be uninterrupted, error-free, or completely secure" colors={colors} styles={styles} />
            <BulletItem text="We are not liable for any indirect, incidental, special, consequential, or punitive damages" colors={colors} styles={styles} />
            <BulletItem text="We are not liable for lost profits, data loss, or business interruption" colors={colors} styles={styles} />
            <BulletItem text="Our total liability is limited to the amount you paid us in the 12 months preceding the claim" colors={colors} styles={styles} />
          </View>

          <Text style={styles.subSectionTitle}>Specific Exclusions</Text>
          <View style={styles.bulletList}>
            <BulletItem text="We are not responsible for the accuracy of information you enter" colors={colors} styles={styles} />
            <BulletItem text="We are not liable for disputes between you and your clients" colors={colors} styles={styles} />
            <BulletItem text="We are not responsible for third-party payment processing failures" colors={colors} styles={styles} />
            <BulletItem text="We are not liable for losses caused by your failure to secure your account" colors={colors} styles={styles} />
          </View>

          <Text style={[styles.paragraph, styles.lastParagraph]}>
            These limitations apply to the fullest extent permitted by law and survive any termination of these Terms.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>7. Australian Consumer Law</Text>
          <Text style={styles.paragraph}>
            Nothing in these Terms is intended to exclude, restrict, or modify rights you may have under the Australian Consumer Law (Schedule 2 of the Competition and Consumer Act 2010 (Cth)) ("ACL") that cannot be excluded, restricted, or modified by agreement.
          </Text>
          <Text style={styles.paragraph}>
            If the ACL applies to you as a consumer:
          </Text>
          <View style={styles.bulletList}>
            <BulletItem text="Our services come with guarantees that cannot be excluded under the ACL" colors={colors} styles={styles} />
            <BulletItem text="You are entitled to a replacement or refund for a major failure" colors={colors} styles={styles} />
            <BulletItem text="You are entitled to compensation for any other reasonably foreseeable loss or damage" colors={colors} styles={styles} />
            <BulletItem text="You are entitled to have services re-supplied or refunded if they fail to meet consumer guarantees" colors={colors} styles={styles} />
          </View>
          <Text style={[styles.paragraph, styles.lastParagraph]}>
            To the extent we are permitted to limit our liability under the ACL, our liability for breach of a consumer guarantee is limited to re-supplying the services or paying the cost of having them re-supplied.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>8. Dispute Resolution</Text>
          <Text style={styles.paragraph}>
            We are committed to resolving disputes fairly and efficiently. If you have a dispute with TradieTrack:
          </Text>
          
          <Text style={styles.subSectionTitle}>Step 1: Direct Resolution</Text>
          <Text style={styles.paragraph}>
            Contact our support team at support@tradietrack.com.au. We aim to resolve most issues within 10 business days.
          </Text>

          <Text style={styles.subSectionTitle}>Step 2: Formal Complaint</Text>
          <Text style={styles.paragraph}>
            If not resolved, submit a formal written complaint to legal@tradietrack.com.au. We will acknowledge receipt within 5 business days and provide a substantive response within 21 business days.
          </Text>

          <Text style={styles.subSectionTitle}>Step 3: Mediation</Text>
          <Text style={styles.paragraph}>
            If the dispute remains unresolved, either party may refer it to mediation through the Resolution Institute or a mutually agreed mediator. Costs will be shared equally unless otherwise agreed.
          </Text>

          <Text style={styles.subSectionTitle}>Step 4: Legal Proceedings</Text>
          <Text style={[styles.paragraph, styles.lastParagraph]}>
            If mediation is unsuccessful, either party may commence legal proceedings. Any legal action must be brought in the courts of New South Wales, Australia, and you consent to the exclusive jurisdiction of those courts.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>9. Termination</Text>
          
          <Text style={styles.subSectionTitle}>Termination by You</Text>
          <Text style={styles.paragraph}>
            You may cancel your account at any time through the app settings or by contacting support@tradietrack.com.au. Upon cancellation:
          </Text>
          <View style={styles.bulletList}>
            <BulletItem text="Your subscription will remain active until the end of the current billing period" colors={colors} styles={styles} />
            <BulletItem text="You will retain access to export your data for 30 days" colors={colors} styles={styles} />
            <BulletItem text="After 30 days, your data will be scheduled for deletion" colors={colors} styles={styles} />
          </View>

          <Text style={styles.subSectionTitle}>Termination by Us</Text>
          <Text style={styles.paragraph}>
            We may suspend or terminate your account if:
          </Text>
          <View style={styles.bulletList}>
            <BulletItem text="You breach these Terms of Service" colors={colors} styles={styles} />
            <BulletItem text="You fail to pay subscription fees when due" colors={colors} styles={styles} />
            <BulletItem text="We are required to do so by law" colors={colors} styles={styles} />
            <BulletItem text="Your use poses a security risk or legal liability" colors={colors} styles={styles} />
            <BulletItem text="Your account has been inactive for more than 24 months" colors={colors} styles={styles} />
          </View>

          <Text style={styles.subSectionTitle}>Effect of Termination</Text>
          <Text style={[styles.paragraph, styles.lastParagraph]}>
            Upon termination, your right to use TradieTrack ceases immediately. Sections that by their nature should survive termination will survive, including intellectual property rights, limitation of liability, indemnification, and dispute resolution.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>10. Changes to Terms</Text>
          <Text style={styles.paragraph}>
            We may update these Terms from time to time to reflect changes in our services, legal requirements, or business practices.
          </Text>
          <View style={styles.bulletList}>
            <BulletItem text="Material changes will be notified via email or in-app notification at least 30 days before taking effect" colors={colors} styles={styles} />
            <BulletItem text="Minor changes may be made without notice" colors={colors} styles={styles} />
            <BulletItem text="The current version will always be available within the app" colors={colors} styles={styles} />
            <BulletItem text="Continued use after changes constitutes acceptance" colors={colors} styles={styles} />
          </View>
          <Text style={[styles.paragraph, styles.lastParagraph]}>
            If you do not agree to updated Terms, you may terminate your account before the changes take effect.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>11. General Provisions</Text>
          
          <Text style={styles.subSectionTitle}>Governing Law</Text>
          <Text style={styles.paragraph}>
            These Terms are governed by the laws of New South Wales, Australia. You agree to submit to the exclusive jurisdiction of the courts of New South Wales.
          </Text>

          <Text style={styles.subSectionTitle}>Entire Agreement</Text>
          <Text style={styles.paragraph}>
            These Terms, together with our Privacy Policy, constitute the entire agreement between you and TradieTrack regarding the use of our services.
          </Text>

          <Text style={styles.subSectionTitle}>Severability</Text>
          <Text style={styles.paragraph}>
            If any provision of these Terms is found to be unenforceable, the remaining provisions will continue in full force and effect.
          </Text>

          <Text style={styles.subSectionTitle}>Waiver</Text>
          <Text style={styles.paragraph}>
            Our failure to enforce any right or provision does not constitute a waiver of that right or provision.
          </Text>

          <Text style={styles.subSectionTitle}>Assignment</Text>
          <Text style={[styles.paragraph, styles.lastParagraph]}>
            You may not assign or transfer these Terms without our written consent. We may assign our rights and obligations to a successor in connection with a merger, acquisition, or sale of assets.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>12. Contact Information</Text>
          <Text style={styles.paragraph}>
            If you have any questions about these Terms of Service, please contact us:
          </Text>
          <View style={styles.bulletList}>
            <BulletItem text="General enquiries: support@tradietrack.com.au" colors={colors} styles={styles} />
            <BulletItem text="Legal matters: legal@tradietrack.com.au" colors={colors} styles={styles} />
            <BulletItem text="Billing enquiries: billing@tradietrack.com.au" colors={colors} styles={styles} />
            <BulletItem text="Website: www.tradietrack.com.au" colors={colors} styles={styles} />
            <BulletItem text="Mail: TradieTrack Pty Ltd, PO Box [TBC], Sydney NSW 2000" colors={colors} styles={styles} />
          </View>
          <Text style={[styles.paragraph, styles.lastParagraph]}>
            We aim to respond to all enquiries within 5 business days.
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
