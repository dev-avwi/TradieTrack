import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";

export default function TermsOfService() {
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
            <h1 className="text-3xl font-bold mb-2" data-testid="heading-terms-of-service">Terms of Service</h1>
            <p className="text-muted-foreground mb-8">Last updated: November 2025</p>

            <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
              <section>
                <h2 className="text-xl font-semibold mb-3">1. Agreement to Terms</h2>
                <p className="text-muted-foreground leading-relaxed">
                  By accessing or using TradieTrack ("the Service"), you agree to be bound by these Terms of Service 
                  and all applicable laws and regulations. If you do not agree with any of these terms, you are 
                  prohibited from using or accessing this Service. These Terms of Service apply to all users of 
                  the Service, including tradespeople, their employees, and their clients.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">2. Description of Service</h2>
                <p className="text-muted-foreground leading-relaxed">
                  TradieTrack is a business management platform designed for Australian tradespeople. The Service 
                  provides tools for managing jobs, quotes, invoices, clients, and payments. We offer both free 
                  and paid subscription plans with varying features.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">3. Account Registration</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">To use the Service, you must:</p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>Be at least 18 years of age</li>
                  <li>Provide accurate and complete registration information</li>
                  <li>Maintain the security of your account credentials</li>
                  <li>Promptly update any information that changes</li>
                  <li>Accept responsibility for all activities under your account</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-3">
                  You are responsible for maintaining the confidentiality of your account and password and for 
                  restricting access to your computer or device.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">4. Subscription and Payments</h2>
                <p className="text-muted-foreground leading-relaxed mb-3"><strong>Free Plan:</strong></p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>Unlimited quotes</li>
                  <li>25 jobs per month</li>
                  <li>25 invoices per month</li>
                  <li>50 clients</li>
                  <li>Basic features included at no cost</li>
                </ul>
                
                <p className="text-muted-foreground leading-relaxed mt-4 mb-3"><strong>Pro Plan ($39/month AUD):</strong></p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>Unlimited jobs, quotes, and invoices</li>
                  <li>Custom branding and theming</li>
                  <li>AI-powered quote assistance</li>
                  <li>Priority email and SMS support</li>
                  <li>Advanced reporting and analytics</li>
                </ul>

                <p className="text-muted-foreground leading-relaxed mt-4">
                  <strong>Billing:</strong> Subscriptions are billed monthly in advance. All fees are quoted in 
                  Australian Dollars (AUD) and include GST where applicable. You authorize us to charge your 
                  payment method automatically each billing cycle.
                </p>

                <p className="text-muted-foreground leading-relaxed mt-3">
                  <strong>Cancellation:</strong> You may cancel your subscription at any time through your account 
                  settings. Cancellation takes effect at the end of the current billing period. No refunds are 
                  provided for partial months.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">5. Payment Processing</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  <strong>Invoice Payments:</strong> When your clients pay invoices through TradieTrack, payments 
                  are processed by Stripe. A platform fee of 2.5% applies to all invoice payments, in addition to 
                  standard Stripe processing fees.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  <strong>Payouts:</strong> Funds from client payments are transferred to your connected bank 
                  account according to Stripe's standard payout schedule (typically 2-3 business days in Australia).
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">6. User Responsibilities</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">You agree to:</p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>Use the Service only for lawful purposes</li>
                  <li>Ensure all information you provide is accurate and current</li>
                  <li>Comply with all applicable Australian tax laws, including GST obligations</li>
                  <li>Maintain valid Australian Business Number (ABN) registration if required</li>
                  <li>Not misrepresent your qualifications, licenses, or business details</li>
                  <li>Protect confidential information of your clients</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">7. Prohibited Uses</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">You may not:</p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>Use the Service for any illegal or unauthorized purpose</li>
                  <li>Violate any laws in your jurisdiction</li>
                  <li>Transmit viruses, malware, or other harmful code</li>
                  <li>Attempt to gain unauthorized access to the Service or its systems</li>
                  <li>Interfere with or disrupt the Service or servers</li>
                  <li>Use the Service to send spam or unsolicited communications</li>
                  <li>Impersonate another person or entity</li>
                  <li>Resell or redistribute the Service without permission</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">8. Intellectual Property</h2>
                <p className="text-muted-foreground leading-relaxed">
                  The Service and its original content, features, and functionality are owned by TradieTrack and 
                  are protected by international copyright, trademark, and other intellectual property laws. You 
                  retain ownership of all content you upload to the Service, but grant us a license to use, 
                  store, and display that content for the purpose of providing the Service.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">9. Limitation of Liability</h2>
                <p className="text-muted-foreground leading-relaxed">
                  To the maximum extent permitted by Australian Consumer Law, TradieTrack shall not be liable 
                  for any indirect, incidental, special, consequential, or punitive damages, or any loss of 
                  profits or revenues, whether incurred directly or indirectly, or any loss of data, use, 
                  goodwill, or other intangible losses.
                </p>
                <p className="text-muted-foreground leading-relaxed mt-3">
                  Our total liability for any claims arising out of or relating to these terms or the Service 
                  shall not exceed the amount you paid us in the 12 months preceding the claim.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">10. Disclaimer of Warranties</h2>
                <p className="text-muted-foreground leading-relaxed">
                  The Service is provided "as is" and "as available" without any warranties of any kind, either 
                  express or implied. We do not warrant that the Service will be uninterrupted, timely, secure, 
                  or error-free. You are responsible for ensuring that your use of the Service complies with 
                  all applicable laws, including tax and licensing requirements.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">11. Indemnification</h2>
                <p className="text-muted-foreground leading-relaxed">
                  You agree to indemnify, defend, and hold harmless TradieTrack and its officers, directors, 
                  employees, and agents from any claims, damages, losses, liabilities, and expenses (including 
                  legal fees) arising from your use of the Service, your violation of these Terms, or your 
                  violation of any rights of another party.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">12. Termination</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We may terminate or suspend your account and access to the Service immediately, without prior 
                  notice, for any reason, including breach of these Terms. Upon termination, your right to use 
                  the Service will cease immediately. All provisions of these Terms which by their nature should 
                  survive termination shall survive.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">13. Changes to Terms</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We reserve the right to modify these Terms at any time. We will notify you of material changes 
                  by posting the new Terms on this page and updating the "Last updated" date. Your continued use 
                  of the Service after such modifications constitutes your acceptance of the new Terms.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">14. Governing Law</h2>
                <p className="text-muted-foreground leading-relaxed">
                  These Terms shall be governed by and construed in accordance with the laws of Australia, 
                  specifically the State of New South Wales. Any disputes arising from these Terms or the 
                  Service shall be subject to the exclusive jurisdiction of the courts of New South Wales.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">15. Australian Consumer Law</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  Nothing in these Terms excludes, restricts, or modifies any rights or remedies, or any 
                  guarantee, warranty, or other term or condition, implied or imposed by the Australian 
                  Consumer Law or any other applicable law that cannot be excluded, restricted, or modified.
                </p>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  <strong>Consumer Guarantees:</strong> The Australian Consumer Law provides consumers with 
                  statutory guarantees. Our services come with guarantees that cannot be excluded under 
                  Australian Consumer Law. You are entitled to:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>Services provided with due care and skill</li>
                  <li>Services fit for any specified purpose</li>
                  <li>Services provided within a reasonable time if no time is specified</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-3">
                  <strong>Remedies:</strong> If we fail to comply with a consumer guarantee, you may be 
                  entitled to a remedy including having the service provided again at no cost, or a refund 
                  for services not yet provided.
                </p>
                <p className="text-muted-foreground leading-relaxed mt-3">
                  <strong>Dispute Resolution:</strong> If you have a complaint about our services, please 
                  contact us first at support@tradietrack.com.au. We aim to resolve disputes within 14 days. 
                  If we cannot resolve the matter, you may lodge a complaint with the Australian Competition 
                  and Consumer Commission (ACCC) or your state/territory consumer protection agency.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">16. Service Availability & Disclaimers</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  <strong>Uptime:</strong> We strive to maintain 99.9% service availability but do not 
                  guarantee uninterrupted access. Scheduled maintenance will be announced in advance where 
                  possible. We are not liable for any losses arising from service unavailability.
                </p>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  <strong>Third-Party Services:</strong> Our platform integrates with third-party services 
                  (Stripe, SendGrid, Twilio). We are not responsible for the availability, performance, or 
                  policies of these services. Payment processing is provided by Stripe and subject to Stripe's 
                  terms of service.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  <strong>Licensing & Insurance:</strong> You are responsible for maintaining appropriate 
                  trade licenses, certifications, and business insurance as required by Australian law. 
                  TradieTrack does not verify your qualifications or provide insurance coverage.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">17. Contact Information</h2>
                <p className="text-muted-foreground leading-relaxed">
                  If you have any questions about these Terms of Service, please contact us at:
                </p>
                <div className="mt-3 p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    <strong>TradieTrack Support</strong><br />
                    Email: support@tradietrack.com.au<br />
                    Phone: 1300 TRADIE (1300 872 343)
                  </p>
                </div>
              </section>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            By using TradieTrack, you agree to these Terms of Service and our{" "}
            <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
