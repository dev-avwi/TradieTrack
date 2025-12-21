import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Briefcase, 
  FileText, 
  Receipt, 
  Users, 
  MapPin, 
  Clock, 
  Smartphone,
  Check,
  Star,
  ArrowRight,
  ChevronRight,
  HardHat
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <MapPin className="h-6 w-6 text-primary" />
              </div>
              <span className="text-xl font-bold text-primary">TradieTrack</span>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/auth">
                <Button variant="ghost" data-testid="link-login">
                  Login
                </Button>
              </Link>
              <Link href="/auth">
                <Button data-testid="button-get-started-nav">
                  Get Started Free
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 to-background py-20 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-center lg:text-left">
              <Badge variant="secondary" className="mb-4">
                Built for Australian Tradies
              </Badge>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground mb-6">
                Job management software that{" "}
                <span className="text-primary">runs your business</span>
              </h1>
              <p className="text-lg sm:text-xl text-muted-foreground mb-8 max-w-2xl">
                From quote to payment in one app. Manage jobs, create invoices, 
                track your team, and get paid faster. Trusted by tradies across Australia.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Link href="/auth">
                  <Button size="lg" className="text-lg px-8" data-testid="button-start-free-trial">
                    Start Free Trial
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Button size="lg" variant="outline" className="text-lg px-8" data-testid="button-watch-demo">
                  Watch Demo
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                No credit card required. 14-day free trial.
              </p>
            </div>
            <div className="relative">
              <div className="relative mx-auto w-[280px] sm:w-[320px]">
                <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-primary/10 rounded-[3rem] blur-3xl"></div>
                <div className="relative rounded-[2rem] shadow-2xl border border-border bg-card p-6 aspect-[9/16] flex flex-col">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <span className="font-semibold text-primary">TradieTrack</span>
                  </div>
                  <div className="text-lg font-semibold mb-2">Good morning, Mike</div>
                  <div className="text-sm text-muted-foreground mb-4">3 jobs scheduled today</div>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-primary/5 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-primary">3</div>
                      <div className="text-xs text-muted-foreground">Jobs Today</div>
                    </div>
                    <div className="bg-green-500/10 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-green-600">$4.2k</div>
                      <div className="text-xs text-muted-foreground">This Week</div>
                    </div>
                  </div>
                  <div className="space-y-2 flex-1">
                    <div className="bg-muted/50 rounded-lg p-3">
                      <div className="text-sm font-medium">Hot Water Install</div>
                      <div className="text-xs text-muted-foreground">9:00 AM - John Smith</div>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <div className="text-sm font-medium">Blocked Drain</div>
                      <div className="text-xs text-muted-foreground">11:30 AM - Sarah Jones</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 sm:py-32 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Everything you need to run your trade business
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Stop juggling paperwork and spreadsheets. TradieTrack handles it all.
            </p>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard 
              icon={Briefcase}
              title="Job Management"
              description="Track jobs from quote to completion. Schedule, assign, and monitor progress in real-time."
            />
            <FeatureCard 
              icon={FileText}
              title="Professional Quotes"
              description="Create branded quotes in seconds. Send instantly and convert to invoices with one tap."
            />
            <FeatureCard 
              icon={Receipt}
              title="Invoicing & Payments"
              description="Get paid faster with Stripe integration. Send invoices and collect payments on the spot."
            />
            <FeatureCard 
              icon={Users}
              title="Team Management"
              description="Assign jobs, track time, and manage your crew from anywhere. Perfect for growing teams."
            />
            <FeatureCard 
              icon={MapPin}
              title="GPS & Routing"
              description="Optimise your day with route planning. See your team's location in real-time."
            />
            <FeatureCard 
              icon={Smartphone}
              title="Mobile App"
              description="iOS and Android apps that work offline. Take photos, capture signatures, update jobs on-site."
            />
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Simple, transparent pricing
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Start free, upgrade when you're ready. No hidden fees.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <PricingCard 
              name="Free"
              price="$0"
              description="Perfect for solo tradies getting started"
              features={[
                "Up to 5 active jobs",
                "Basic quotes & invoices",
                "Mobile app access",
                "Email support"
              ]}
              buttonText="Get Started"
              popular={false}
            />
            <PricingCard 
              name="Pro"
              price="$29"
              period="/month"
              description="For established tradies who want more"
              features={[
                "Unlimited jobs",
                "Custom branding",
                "Stripe payments",
                "SMS notifications",
                "Priority support"
              ]}
              buttonText="Start Free Trial"
              popular={true}
            />
            <PricingCard 
              name="Team"
              price="$79"
              period="/month"
              description="For growing businesses with staff"
              features={[
                "Everything in Pro",
                "Up to 10 team members",
                "GPS tracking",
                "Time tracking",
                "Team scheduling",
                "Advanced reports"
              ]}
              buttonText="Start Free Trial"
              popular={false}
            />
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 sm:py-32 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Trusted by tradies across Australia
            </h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <TestimonialCard 
              quote="TradieTrack has saved me hours every week on paperwork. My invoices look professional and I get paid faster."
              author="Mike Johnson"
              role="Plumber, Cairns QLD"
              rating={5}
            />
            <TestimonialCard 
              quote="The team features are brilliant. I can see where my guys are and assign jobs on the fly. Game changer."
              author="Sarah Mitchell"
              role="Electrical Contractor, Brisbane"
              rating={5}
            />
            <TestimonialCard 
              quote="Finally, an app that actually works offline! I can update jobs on remote sites with no signal."
              author="Tom Williams"
              role="Builder, Gold Coast"
              rating={5}
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 sm:py-32 bg-primary text-primary-foreground">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">
            Ready to take control of your business?
          </h2>
          <p className="text-xl opacity-90 mb-8">
            Join thousands of Australian tradies who've simplified their business with TradieTrack.
          </p>
          <Link href="/auth">
            <Button size="lg" variant="secondary" className="text-lg px-8" data-testid="button-start-free-trial-bottom">
              Start Your Free Trial
              <ChevronRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
          <p className="text-sm opacity-75 mt-4">
            No credit card required. Cancel anytime.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-background border-t py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <MapPin className="h-5 w-5 text-primary" />
                </div>
                <span className="text-lg font-bold">TradieTrack</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Job management software built for Australian tradies.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground" data-testid="link-features">Features</a></li>
                <li><a href="#pricing" className="hover:text-foreground" data-testid="link-pricing">Pricing</a></li>
                <li><a href="#" className="hover:text-foreground" data-testid="link-mobile-app">Mobile App</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground" data-testid="link-about">About</a></li>
                <li><a href="#" className="hover:text-foreground" data-testid="link-contact">Contact</a></li>
                <li><a href="#" className="hover:text-foreground" data-testid="link-support">Support</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Legal</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/privacy" className="hover:text-foreground" data-testid="link-privacy">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-foreground" data-testid="link-terms">Terms of Service</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t mt-8 pt-8 text-center text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} TradieTrack. All rights reserved.</p>
            <p className="mt-1">Made with love in Australia</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description }: { 
  icon: any; 
  title: string; 
  description: string; 
}) {
  return (
    <Card className="hover-elevate">
      <CardContent className="p-6">
        <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <h3 className="text-xl font-semibold mb-2">{title}</h3>
        <p className="text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function PricingCard({ 
  name, 
  price, 
  period, 
  description, 
  features, 
  buttonText, 
  popular 
}: { 
  name: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  buttonText: string;
  popular: boolean;
}) {
  return (
    <Card className={`relative ${popular ? 'border-primary shadow-lg scale-105' : ''}`}>
      {popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-primary text-primary-foreground">Most Popular</Badge>
        </div>
      )}
      <CardContent className="p-6 pt-8">
        <h3 className="text-xl font-semibold mb-2">{name}</h3>
        <div className="mb-4">
          <span className="text-4xl font-bold">{price}</span>
          {period && <span className="text-muted-foreground">{period}</span>}
        </div>
        <p className="text-muted-foreground text-sm mb-6">{description}</p>
        <ul className="space-y-3 mb-6">
          {features.map((feature, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              <Check className="h-4 w-4 text-primary flex-shrink-0" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
        <Link href="/auth">
          <Button 
            className="w-full" 
            variant={popular ? "default" : "outline"}
            data-testid={`button-pricing-${name.toLowerCase()}`}
          >
            {buttonText}
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

function TestimonialCard({ 
  quote, 
  author, 
  role, 
  rating 
}: { 
  quote: string;
  author: string;
  role: string;
  rating: number;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex gap-1 mb-4">
          {Array.from({ length: rating }).map((_, i) => (
            <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
          ))}
        </div>
        <p className="text-muted-foreground mb-4">"{quote}"</p>
        <div>
          <p className="font-semibold">{author}</p>
          <p className="text-sm text-muted-foreground">{role}</p>
        </div>
      </CardContent>
    </Card>
  );
}
