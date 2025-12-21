import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Menu, 
  X,
  Calendar,
  MapPin,
  FileText,
  CreditCard,
  Users,
  Check,
  ChevronRight,
  Smartphone,
  Star,
  ArrowRight,
  Zap,
  Shield,
  Clock
} from "lucide-react";

import tradietrackLogo from "/tradietrack-logo.png";
import dashboardScreenshot from "@assets/appstore_screenshots/01_dashboard.png";
import jobsListScreenshot from "@assets/appstore_screenshots/02_jobs_list.png";
import scheduleScreenshot from "@assets/appstore_screenshots/04_schedule.png";
import jobMapScreenshot from "@assets/appstore_screenshots/05_job_map.png";
import quotePreviewScreenshot from "@assets/appstore_screenshots/07_quote_preview.png";

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      {/* Navigation - matches app styling */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-5xl mx-auto px-4 md:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5" data-testid="nav-logo">
              <img 
                src={tradietrackLogo} 
                alt="TradieTrack" 
                className="h-8 w-auto"
              />
              <span className="text-lg font-semibold tracking-tight">
                TradieTrack
              </span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="nav-features">Features</a>
              <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="nav-how-it-works">How It Works</a>
              <a href="#reviews" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="nav-reviews">Reviews</a>
            </div>

            {/* Desktop CTA */}
            <div className="hidden md:flex items-center gap-3">
              <Link href="/auth">
                <Button variant="ghost" size="sm" className="text-sm" data-testid="nav-login">
                  Sign In
                </Button>
              </Link>
              <Link href="/auth">
                <Button size="sm" className="text-sm" data-testid="nav-get-started">
                  Join Beta
                </Button>
              </Link>
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 -mr-2 text-muted-foreground"
              data-testid="button-mobile-menu"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-background">
            <div className="px-4 py-4 space-y-1">
              <a href="#features" onClick={() => setMobileMenuOpen(false)} className="block py-2.5 text-sm text-muted-foreground" data-testid="mobile-nav-features">
                Features
              </a>
              <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="block py-2.5 text-sm text-muted-foreground" data-testid="mobile-nav-how-it-works">
                How It Works
              </a>
              <a href="#reviews" onClick={() => setMobileMenuOpen(false)} className="block py-2.5 text-sm text-muted-foreground" data-testid="mobile-nav-reviews">
                Reviews
              </a>
              <div className="pt-3 flex gap-3">
                <Link href="/auth" onClick={() => setMobileMenuOpen(false)} className="flex-1">
                  <Button variant="outline" className="w-full" data-testid="mobile-login">
                    Sign In
                  </Button>
                </Link>
                <Link href="/auth" onClick={() => setMobileMenuOpen(false)} className="flex-1">
                  <Button className="w-full" data-testid="mobile-get-started">
                    Join Beta
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="pt-24 md:pt-32 pb-16 md:pb-24 px-4 md:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left: Content */}
            <div className="text-center lg:text-left">
              {/* Beta Badge */}
              <div className="inline-flex items-center gap-2 bg-primary/5 border border-primary/10 rounded-full px-3 py-1.5 mb-6">
                <span className="w-1.5 h-1.5 bg-success rounded-full"></span>
                <span className="text-xs font-medium text-muted-foreground">Currently in beta for Australian tradies</span>
              </div>

              {/* Main Headline */}
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight tracking-tight mb-5">
                Job management built for the way you work.
              </h1>

              {/* Subheadline */}
              <p className="text-base lg:text-lg text-muted-foreground leading-relaxed mb-8 max-w-md mx-auto lg:mx-0">
                Schedule jobs, send quotes, invoice clients, and get paid — all from one app. Available on iOS and web.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-6">
                <Link href="/auth">
                  <Button size="lg" className="w-full sm:w-auto gap-2" data-testid="hero-join-beta">
                    Use TradieTrack
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
                <a href="#features">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto" data-testid="hero-learn-more">
                    See Features
                  </Button>
                </a>
              </div>

              {/* Beta note */}
              <p className="text-xs text-muted-foreground">
                Free during beta. No credit card required.
              </p>
            </div>

            {/* Right: App Preview */}
            <div className="relative flex justify-center lg:justify-end">
              <AppPreview screenshot={dashboardScreenshot} />
            </div>
          </div>
        </div>
      </section>

      {/* Trust Bar */}
      <section className="py-8 border-y border-border bg-card/50">
        <div className="max-w-5xl mx-auto px-4 md:px-6">
          <div className="flex flex-wrap justify-center items-center gap-6 md:gap-10">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">iOS + Web</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Secure payments</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Works offline</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Quick setup</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 md:py-24">
        <div className="max-w-5xl mx-auto px-4 md:px-6">
          {/* Section Header */}
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">
              Everything you need to run your business
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              From the first enquiry to the final invoice. One app for the whole job.
            </p>
          </div>

          {/* Feature 1: Jobs */}
          <FeatureBlock
            icon={Users}
            iconBg="bg-primary/10"
            iconColor="text-primary"
            title="All your jobs in one place"
            description="Track every job from quote to completion. Add photos, notes, and see exactly where each project stands."
            screenshot={jobsListScreenshot}
            features={["Job status tracking", "Photos and notes", "Client history"]}
            imageFirst={false}
          />

          {/* Feature 2: Calendar */}
          <FeatureBlock
            icon={Calendar}
            iconBg="bg-info/10"
            iconColor="text-info"
            title="Smart scheduling"
            description="See your whole week at a glance. Schedule jobs, check team availability, and never miss an appointment."
            screenshot={scheduleScreenshot}
            features={["Weekly calendar view", "Team availability", "Job reminders"]}
            imageFirst={true}
          />

          {/* Feature 3: Maps */}
          <FeatureBlock
            icon={MapPin}
            iconBg="bg-warning/10"
            iconColor="text-warning"
            title="Jobs on a map"
            description="Visualise your work area. Plan routes, track your team, and see all your jobs at once."
            screenshot={jobMapScreenshot}
            features={["Interactive job map", "Route planning", "Team locations"]}
            imageFirst={false}
          />

          {/* Feature 4: Quotes & Invoices */}
          <FeatureBlock
            icon={FileText}
            iconBg="bg-success/10"
            iconColor="text-success"
            title="Quote on-site, get paid faster"
            description="Create professional quotes in seconds. Convert to invoice with one tap. Accept payments online."
            screenshot={quotePreviewScreenshot}
            features={["Professional PDFs", "One-tap invoicing", "Online payments"]}
            imageFirst={true}
          />
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-16 md:py-24 bg-card/30 border-y border-border">
        <div className="max-w-5xl mx-auto px-4 md:px-6">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">
              Get started in minutes
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              No complicated setup. No training required. Just sign up and start managing your jobs.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-6">
            <StepCard 
              number={1}
              title="Create your account"
              description="Sign up with email or Google. Takes less than a minute."
            />
            <StepCard 
              number={2}
              title="Add your first job"
              description="Enter client details and schedule your work."
            />
            <StepCard 
              number={3}
              title="Send quotes & invoices"
              description="Create professional documents and get paid online."
            />
          </div>
        </div>
      </section>

      {/* Reviews */}
      <section id="reviews" className="py-16 md:py-24">
        <div className="max-w-5xl mx-auto px-4 md:px-6">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">
              What tradies are saying
            </h2>
            <p className="text-muted-foreground">
              Early feedback from our beta users.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <ReviewCard
              quote="Finally an app that works how I work. The offline mode is a game changer on remote sites."
              author="Mike T."
              trade="Electrician, Sydney"
            />
            <ReviewCard
              quote="Sending invoices from my phone has cut my admin time in half. Love the payment links."
              author="Sarah C."
              trade="Plumber, Melbourne"
            />
            <ReviewCard
              quote="Clean and simple. My whole team picked it up in minutes. No training needed."
              author="Tom W."
              trade="Builder, Brisbane"
            />
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 md:py-24 bg-primary text-primary-foreground">
        <div className="max-w-2xl mx-auto px-4 md:px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">
            Ready to simplify your business?
          </h2>
          <p className="text-primary-foreground/80 mb-8 max-w-md mx-auto">
            Join the beta and see why tradies are switching to TradieTrack.
          </p>
          <Link href="/auth">
            <Button size="lg" variant="secondary" className="gap-2" data-testid="cta-join-beta">
              Use TradieTrack
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <p className="text-xs text-primary-foreground/60 mt-4">
            Free during beta. Available on iOS and web.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t border-border py-10">
        <div className="max-w-5xl mx-auto px-4 md:px-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <img 
                  src={tradietrackLogo} 
                  alt="TradieTrack" 
                  className="h-7 w-auto"
                />
                <span className="text-base font-semibold">TradieTrack</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Job management for Australian tradies. Simple. Powerful. Mobile-first.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-sm mb-3">Product</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground transition-colors" data-testid="footer-features">Features</a></li>
                <li><a href="#how-it-works" className="hover:text-foreground transition-colors" data-testid="footer-how-it-works">How It Works</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-sm mb-3">Company</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="mailto:admin@avwebinnovation.com" className="hover:text-foreground transition-colors" data-testid="footer-contact">Contact</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-sm mb-3">Legal</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/privacy" className="hover:text-foreground transition-colors" data-testid="footer-privacy">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-foreground transition-colors" data-testid="footer-terms">Terms of Service</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border pt-6 text-center text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} TradieTrack. Made in Australia.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function AppPreview({ screenshot }: { screenshot: string }) {
  return (
    <div className="relative w-[240px] sm:w-[260px]">
      {/* Simple phone frame - no fake notch */}
      <div className="relative bg-foreground rounded-[32px] p-[8px] shadow-xl">
        {/* Screen with rounded corners */}
        <div className="relative bg-background rounded-[24px] overflow-hidden">
          <img 
            src={screenshot} 
            alt="TradieTrack App"
            className="w-full h-auto block"
          />
        </div>
      </div>
      
      {/* Subtle shadow/glow effect */}
      <div className="absolute -z-10 inset-0 bg-gradient-to-b from-primary/5 to-transparent rounded-[40px] blur-2xl scale-110 opacity-60"></div>
    </div>
  );
}

function FeatureBlock({ 
  icon: Icon,
  iconBg,
  iconColor,
  title, 
  description,
  screenshot,
  features,
  imageFirst
}: { 
  icon: any;
  iconBg: string;
  iconColor: string;
  title: string; 
  description: string;
  screenshot: string;
  features: string[];
  imageFirst: boolean;
}) {
  return (
    <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center mb-16 lg:mb-24 last:mb-0">
      <div className={imageFirst ? "order-2 lg:order-1" : "order-2"}>
        <div className={`inline-flex items-center justify-center w-10 h-10 ${iconBg} rounded-lg mb-4`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        <h3 className="text-xl sm:text-2xl font-semibold tracking-tight mb-3">
          {title}
        </h3>
        <p className="text-muted-foreground leading-relaxed mb-5">
          {description}
        </p>
        <ul className="space-y-2">
          {features.map((feature, i) => (
            <li key={i} className="flex items-center gap-2.5 text-sm">
              <div className="w-4 h-4 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0">
                <Check className="w-2.5 h-2.5 text-success" />
              </div>
              <span className="text-muted-foreground">{feature}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className={`flex justify-center ${imageFirst ? "order-1 lg:order-2" : "order-1"}`}>
        <AppPreview screenshot={screenshot} />
      </div>
    </div>
  );
}

function StepCard({ 
  number,
  title, 
  description
}: { 
  number: number;
  title: string; 
  description: string;
}) {
  return (
    <Card className="text-center">
      <CardContent className="pt-6">
        <div className="w-10 h-10 bg-primary text-primary-foreground rounded-lg flex items-center justify-center font-semibold text-lg mx-auto mb-4">
          {number}
        </div>
        <h3 className="font-semibold mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function ReviewCard({ 
  quote, 
  author, 
  trade
}: { 
  quote: string; 
  author: string; 
  trade: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex gap-0.5 mb-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Star key={i} className="w-4 h-4 text-warning fill-warning" />
          ))}
        </div>
        <p className="text-sm text-muted-foreground mb-4 leading-relaxed">"{quote}"</p>
        <div>
          <p className="font-medium text-sm">{author}</p>
          <p className="text-xs text-muted-foreground">{trade}</p>
        </div>
      </CardContent>
    </Card>
  );
}
