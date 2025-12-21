import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Button>
          </Link>
        </div>

        <Card>
          <CardContent className="p-8">
            <h1 className="text-3xl font-bold mb-2" data-testid="heading-privacy-policy">Privacy Policy</h1>
            <p className="text-muted-foreground mb-8">Last updated: December 2025</p>

            <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
              <section>
                <h2 className="text-xl font-semibold mb-3">1. Introduction</h2>
                <p className="text-muted-foreground leading-relaxed">
                  TradieTrack ("we", "our", or "us") is committed to protecting the privacy of Australian 
                  tradespeople and their clients. This Privacy Policy explains how we collect, use, disclose, 
                  and safeguard your information when you use our platform. We comply with the Australian 
                  Privacy Principles (APPs) contained in the Privacy Act 1988 (Cth).
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">2. Information We Collect</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">We collect information that you provide directly to us:</p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li><strong>Account Information:</strong> Name, email address, phone number, business name, ABN, and address when you register</li>
                  <li><strong>Business Data:</strong> Quotes, invoices, jobs, client information, and financial data you enter into the platform</li>
                  <li><strong>Payment Information:</strong> Credit card details (processed securely by Stripe), bank account details for receiving payments</li>
                  <li><strong>Communications:</strong> Messages, emails, and SMS sent through our platform</li>
                  <li><strong>Usage Data:</strong> How you interact with our services, including log data and device information</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">3. How We Use Your Information</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">We use the information we collect to:</p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>Provide, maintain, and improve our services</li>
                  <li>Process transactions and send related information (invoices, payment confirmations)</li>
                  <li>Send you technical notices, updates, and support messages</li>
                  <li>Respond to your comments, questions, and customer service requests</li>
                  <li>Generate business insights and analytics for your dashboard</li>
                  <li>Comply with Australian tax and legal obligations</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">4. Information Sharing</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">We share your information only in the following circumstances:</p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li><strong>With Your Clients:</strong> When you send quotes or invoices, your business details are shared with your clients</li>
                  <li><strong>Service Providers:</strong> With trusted third parties who assist in operating our platform (Stripe for payments, SendGrid for emails, Twilio for SMS)</li>
                  <li><strong>Legal Requirements:</strong> If required by law, regulation, or legal process</li>
                  <li><strong>Business Transfers:</strong> In connection with any merger, sale of company assets, or acquisition</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-3">
                  We do not sell your personal information to third parties.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">5. Data Security</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We implement appropriate technical and organizational measures to protect your personal 
                  information against unauthorized access, alteration, disclosure, or destruction. This includes:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-3">
                  <li>Encryption of data in transit and at rest</li>
                  <li>Secure authentication and session management</li>
                  <li>Regular security assessments and updates</li>
                  <li>Restricted access to personal information on a need-to-know basis</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">6. Data Retention</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We retain your personal information for as long as your account is active or as needed to 
                  provide you services. We also retain information as required by Australian tax law (typically 
                  5-7 years for financial records). You may request deletion of your account and associated data, 
                  subject to legal retention requirements.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">6A. Notifiable Data Breaches</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  In accordance with the Notifiable Data Breaches (NDB) scheme under the Privacy Act 1988, 
                  if we become aware of a data breach that is likely to result in serious harm to you, we will:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>Notify affected individuals as soon as practicable</li>
                  <li>Notify the Office of the Australian Information Commissioner (OAIC)</li>
                  <li>Provide recommendations about steps you can take to protect yourself</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-3">
                  If you believe your data may have been compromised, please contact us immediately at 
                  privacy@tradietrack.com.au.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">6B. Overseas Disclosure</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Some of our third-party service providers may process your data outside of Australia. 
                  This includes cloud infrastructure providers and payment processors. Before disclosing 
                  your personal information overseas, we take reasonable steps to ensure the overseas 
                  recipient handles your information in accordance with Australian Privacy Principles. 
                  Countries where your data may be processed include the United States (for Stripe, SendGrid, 
                  and cloud services).
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">7. Your Rights</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">Under Australian privacy law, you have the right to:</p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>Access the personal information we hold about you</li>
                  <li>Request correction of inaccurate information</li>
                  <li>Request deletion of your information (subject to legal requirements)</li>
                  <li>Withdraw consent for marketing communications</li>
                  <li>Lodge a complaint with the Office of the Australian Information Commissioner (OAIC)</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">8. Cookies and Tracking</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We use cookies and similar technologies to maintain your session, remember your preferences, 
                  and analyze how our services are used. You can control cookie settings through your browser, 
                  but disabling cookies may affect your ability to use some features.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">9. Third-Party Services</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">Our platform integrates with the following third-party services:</p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li><strong>Stripe:</strong> For secure payment processing (<a href="https://stripe.com/au/privacy" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">Stripe Privacy Policy</a>)</li>
                  <li><strong>SendGrid:</strong> For email delivery (<a href="https://www.twilio.com/legal/privacy" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">SendGrid Privacy Policy</a>)</li>
                  <li><strong>Twilio:</strong> For SMS notifications (<a href="https://www.twilio.com/legal/privacy" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">Twilio Privacy Policy</a>)</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">10. Changes to This Policy</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We may update this Privacy Policy from time to time. We will notify you of any material changes 
                  by posting the new policy on this page and updating the "Last updated" date. Your continued use 
                  of our services after such modifications constitutes your acknowledgment of the modified policy.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">11. Contact Us</h2>
                <p className="text-muted-foreground leading-relaxed">
                  If you have any questions about this Privacy Policy or our privacy practices, please contact us at:
                </p>
                <div className="mt-3 p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    <strong>TradieTrack Support</strong><br />
                    Email: privacy@tradietrack.com.au<br />
                    Phone: 1300 TRADIE (1300 872 343)
                  </p>
                </div>
              </section>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            By using TradieTrack, you agree to this Privacy Policy and our{" "}
            <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
