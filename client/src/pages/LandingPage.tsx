import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { 
  Menu, 
  X,
  Calendar,
  MapPin,
  FileText,
  CreditCard,
  Users,
  CheckCircle2,
  ChevronRight,
  Smartphone,
  Zap,
  ArrowRight
} from "lucide-react";

import dashboardScreenshot from "@assets/appstore_screenshots/01_dashboard.png";
import jobsListScreenshot from "@assets/appstore_screenshots/02_jobs_list.png";
import scheduleScreenshot from "@assets/appstore_screenshots/04_schedule.png";
import jobMapScreenshot from "@assets/appstore_screenshots/05_job_map.png";
import quotePreviewScreenshot from "@assets/appstore_screenshots/07_quote_preview.png";

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="relative w-10 h-10">
                <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-orange-500 rounded-full"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="currentColor">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                  </svg>
                </div>
                <div className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-blue-600 rounded-sm rotate-45"></div>
              </div>
              <span className="text-xl font-bold">
                <span className="text-gray-900">Tradie</span>
                <span className="text-blue-600">Track</span>
              </span>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-gray-600 hover:text-gray-900 font-medium" data-testid="nav-features">Features</a>
              <a href="#how-it-works" className="text-gray-600 hover:text-gray-900 font-medium" data-testid="nav-how-it-works">How It Works</a>
              <a href="#testimonials" className="text-gray-600 hover:text-gray-900 font-medium" data-testid="nav-testimonials">Testimonials</a>
            </div>

            {/* Desktop CTA */}
            <div className="hidden md:flex items-center gap-4">
              <Link href="/auth">
                <Button variant="ghost" className="font-medium" data-testid="nav-login">
                  Log In
                </Button>
              </Link>
              <Link href="/auth">
                <Button className="bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-full px-6" data-testid="nav-get-started">
                  Get Started Free
                </Button>
              </Link>
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2"
              data-testid="button-mobile-menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 top-16 bg-slate-900/95 z-40">
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-2 mb-8">
                <div className="relative w-8 h-8">
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-orange-500 rounded-full"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="currentColor">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                    </svg>
                  </div>
                  <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-blue-600 rounded-sm rotate-45"></div>
                </div>
                <span className="text-xl font-bold">
                  <span className="text-white">Tradie</span>
                  <span className="text-blue-400">Track</span>
                </span>
              </div>
              
              <a href="#features" onClick={() => setMobileMenuOpen(false)} className="block text-xl text-white font-medium py-3" data-testid="mobile-nav-features">
                Features
              </a>
              <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="block text-xl text-white font-medium py-3" data-testid="mobile-nav-how-it-works">
                How It Works
              </a>
              <a href="#testimonials" onClick={() => setMobileMenuOpen(false)} className="block text-xl text-white font-medium py-3" data-testid="mobile-nav-testimonials">
                Testimonials
              </a>
              
              <Link href="/auth" onClick={() => setMobileMenuOpen(false)}>
                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-full py-6 text-lg mt-6" data-testid="mobile-get-started">
                  Get Started Free
                </Button>
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="pt-12 pb-8 sm:pt-20 sm:pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-gray-100 rounded-full px-4 py-2 mb-8">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium text-gray-700">The #1 app for modern tradespeople</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-6">
            Run your trade business{" "}
            <span className="text-blue-600">like a tech company.</span>
          </h1>

          {/* Subheadline */}
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-10">
            Ditch the paperwork and the chaos. Schedule jobs, send invoices, and manage your team from one beautiful, simple app.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
            <Link href="/auth">
              <Button size="lg" className="bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-full px-8 py-6 text-lg w-full sm:w-auto" data-testid="hero-start-trial">
                Start Your Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <a href="#how-it-works">
              <Button size="lg" variant="outline" className="rounded-full px-8 py-6 text-lg w-full sm:w-auto font-medium" data-testid="hero-watch-demo">
                Watch Demo
              </Button>
            </a>
          </div>
        </div>

        {/* Phone Mockup */}
        <div className="relative max-w-md mx-auto">
          <PhoneMockup screenshot={dashboardScreenshot} />
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Scheduling Feature */}
          <div className="grid lg:grid-cols-2 gap-12 items-center mb-24">
            <div>
              <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-100 rounded-2xl mb-6">
                <Calendar className="w-7 h-7 text-blue-600" />
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6">
                Scheduling that actually makes sense.
              </h2>
              <p className="text-lg text-gray-600 mb-8">
                Stop using whiteboards and WhatsApp groups. Our smart calendar manages your team, your jobs, and your time automatically. It's like having a project manager in your pocket.
              </p>
              <ul className="space-y-4">
                <FeatureCheck text="Drag & drop scheduling" />
                <FeatureCheck text="Team availability view" />
                <FeatureCheck text="Automatic job reminders" />
              </ul>
            </div>
            <div className="relative">
              <PhoneMockup screenshot={scheduleScreenshot} />
            </div>
          </div>

          {/* Maps Feature */}
          <div className="grid lg:grid-cols-2 gap-12 items-center mb-24">
            <div className="order-2 lg:order-1 relative">
              <PhoneMockup screenshot={jobMapScreenshot} />
            </div>
            <div className="order-1 lg:order-2">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-orange-100 rounded-2xl mb-6">
                <MapPin className="w-7 h-7 text-orange-600" />
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6">
                See the big picture. Literally.
              </h2>
              <p className="text-lg text-gray-600 mb-8">
                Visualize your jobs on an interactive map. Optimize routes, track your team, and never get lost again. Perfect for service-based trades covering a large area.
              </p>
              <a href="#how-it-works" className="inline-flex items-center text-blue-600 font-semibold hover:text-blue-700" data-testid="link-explore-maps">
                Explore Maps <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Quoting & Invoicing Feature */}
          <div className="grid lg:grid-cols-2 gap-12 items-center mb-24">
            <div>
              <div className="inline-flex items-center justify-center w-14 h-14 bg-green-100 rounded-2xl mb-6">
                <FileText className="w-7 h-7 text-green-600" />
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6">
                Professional quotes in seconds.
              </h2>
              <p className="text-lg text-gray-600 mb-8">
                Create stunning, professional quotes on-site. Convert them to invoices with one tap. Get paid faster with built-in payment links.
              </p>
              <ul className="space-y-4">
                <FeatureCheck text="Beautiful PDF templates" />
                <FeatureCheck text="One-tap quote to invoice" />
                <FeatureCheck text="Stripe payment integration" />
              </ul>
            </div>
            <div className="relative">
              <PhoneMockup screenshot={quotePreviewScreenshot} />
            </div>
          </div>

          {/* Jobs List Feature */}
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1 relative">
              <PhoneMockup screenshot={jobsListScreenshot} />
            </div>
            <div className="order-1 lg:order-2">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-purple-100 rounded-2xl mb-6">
                <Users className="w-7 h-7 text-purple-600" />
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6">
                All your jobs. One place.
              </h2>
              <p className="text-lg text-gray-600 mb-8">
                No more lost paperwork or forgotten jobs. Track every job from quote to payment. Know exactly where every project stands at a glance.
              </p>
              <ul className="space-y-4">
                <FeatureCheck text="Visual job status tracking" />
                <FeatureCheck text="Photo & note attachments" />
                <FeatureCheck text="Client communication history" />
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works / Efficiency Section */}
      <section id="how-it-works" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-orange-100 rounded-full px-4 py-2 mb-6">
              <Zap className="w-4 h-4 text-orange-600" />
              <span className="text-sm font-semibold text-orange-700">EFFICIENCY</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Everything you need,{" "}
              <span className="text-blue-600">just one app.</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              We know you're busy. That's why TradieTrack puts everything you need right at your fingertips. No switching between apps. No double entry.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard 
              icon={Calendar}
              title="Smart Scheduling"
              description="Drag and drop jobs, see team availability, get automatic reminders."
              color="blue"
            />
            <FeatureCard 
              icon={FileText}
              title="Quotes & Invoices"
              description="Create professional documents on-site and get paid faster."
              color="green"
            />
            <FeatureCard 
              icon={CreditCard}
              title="Payment Links"
              description="Stripe integration lets clients pay instantly. No more chasing payments."
              color="purple"
            />
            <FeatureCard 
              icon={MapPin}
              title="Job Mapping"
              description="See all your jobs on a map. Optimize routes automatically."
              color="orange"
            />
            <FeatureCard 
              icon={Users}
              title="Team Management"
              description="Assign jobs, track time, and communicate with your crew."
              color="indigo"
            />
            <FeatureCard 
              icon={Smartphone}
              title="Works Offline"
              description="No signal? No worries. Everything syncs when you're back online."
              color="teal"
            />
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Loved by tradies across Australia
            </h2>
            <p className="text-xl text-gray-600">
              Join thousands of tradespeople who've simplified their business.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <TestimonialCard
              quote="I used to spend hours on paperwork every weekend. Now I do everything from my phone between jobs. Game changer."
              author="Mike Thompson"
              role="Electrician, Sydney"
            />
            <TestimonialCard
              quote="The payment links feature alone has cut our invoice-to-payment time in half. Clients just click and pay."
              author="Sarah Chen"
              role="Plumber, Melbourne"
            />
            <TestimonialCard
              quote="Finally, an app that actually works offline! I can update jobs on remote sites with no signal and it all syncs later."
              author="Tom Williams"
              role="Builder, Gold Coast"
            />
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-gradient-to-br from-blue-600 to-blue-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
            Ready to run your business smarter?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join thousands of Australian tradies who've simplified their business with TradieTrack.
          </p>
          <Link href="/auth">
            <Button size="lg" className="bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-full px-10 py-6 text-lg" data-testid="cta-start-trial">
              Start Your Free Trial
              <ChevronRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
          <p className="text-sm text-blue-200 mt-4">
            No credit card required. Cancel anytime.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="relative w-8 h-8">
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-orange-500 rounded-full"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="currentColor">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                    </svg>
                  </div>
                  <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-blue-600 rounded-sm rotate-45"></div>
                </div>
                <span className="text-lg font-bold">
                  <span className="text-white">Tradie</span>
                  <span className="text-blue-400">Track</span>
                </span>
              </div>
              <p className="text-sm">
                Job management software built for Australian tradies.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-4">Product</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="hover:text-white" data-testid="link-features">Features</a></li>
                <li><a href="#how-it-works" className="hover:text-white" data-testid="link-how-it-works">How It Works</a></li>
                <li><a href="#" className="hover:text-white" data-testid="link-mobile-app">Mobile App</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-4">Company</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white" data-testid="link-about">About</a></li>
                <li><a href="#" className="hover:text-white" data-testid="link-contact">Contact</a></li>
                <li><a href="#" className="hover:text-white" data-testid="link-support">Support</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-4">Legal</h3>
              <ul className="space-y-2 text-sm">
                <li><Link href="/privacy" className="hover:text-white" data-testid="link-privacy">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-white" data-testid="link-terms">Terms of Service</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-sm">
            <p>&copy; {new Date().getFullYear()} TradieTrack. All rights reserved.</p>
            <p className="mt-1">Made with love in Australia</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function PhoneMockup({ screenshot }: { screenshot: string }) {
  return (
    <div className="relative mx-auto" style={{ maxWidth: "300px" }}>
      {/* Phone Frame */}
      <div className="relative bg-gray-900 rounded-[3rem] p-2 shadow-2xl">
        {/* Dynamic Island */}
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 w-24 h-6 bg-black rounded-full z-20"></div>
        
        {/* Screen */}
        <div className="relative bg-white rounded-[2.5rem] overflow-hidden">
          {/* Status Bar */}
          <div className="absolute top-0 left-0 right-0 h-12 bg-white z-10 flex items-center justify-between px-8 pt-2">
            <span className="text-xs font-semibold text-gray-900">9:41</span>
            <div className="flex items-center gap-1">
              <div className="flex gap-0.5">
                <div className="w-1 h-2 bg-gray-900 rounded-sm"></div>
                <div className="w-1 h-2.5 bg-gray-900 rounded-sm"></div>
                <div className="w-1 h-3 bg-gray-900 rounded-sm"></div>
                <div className="w-1 h-3.5 bg-gray-900 rounded-sm"></div>
              </div>
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-gray-900 ml-1" fill="currentColor">
                <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"/>
              </svg>
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-gray-900 ml-0.5" fill="currentColor">
                <rect x="2" y="7" width="18" height="10" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/>
                <rect x="20" y="10" width="2" height="4" rx="1" fill="currentColor"/>
                <rect x="4" y="9" width="10" height="6" rx="1" fill="currentColor"/>
              </svg>
            </div>
          </div>
          
          {/* Screenshot */}
          <img 
            src={screenshot} 
            alt="TradieTrack App"
            className="w-full h-auto"
          />
        </div>
      </div>
    </div>
  );
}

function FeatureCheck({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3">
      <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
      <span className="text-gray-700 font-medium">{text}</span>
    </div>
  );
}

function FeatureCard({ 
  icon: Icon, 
  title, 
  description,
  color 
}: { 
  icon: any; 
  title: string; 
  description: string;
  color: string;
}) {
  const colorClasses: Record<string, { bg: string; text: string }> = {
    blue: { bg: "bg-blue-100", text: "text-blue-600" },
    green: { bg: "bg-green-100", text: "text-green-600" },
    purple: { bg: "bg-purple-100", text: "text-purple-600" },
    orange: { bg: "bg-orange-100", text: "text-orange-600" },
    indigo: { bg: "bg-indigo-100", text: "text-indigo-600" },
    teal: { bg: "bg-teal-100", text: "text-teal-600" },
  };

  const colors = colorClasses[color] || colorClasses.blue;

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className={`inline-flex items-center justify-center w-12 h-12 ${colors.bg} rounded-xl mb-4`}>
        <Icon className={`w-6 h-6 ${colors.text}`} />
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}

function TestimonialCard({ 
  quote, 
  author, 
  role 
}: { 
  quote: string; 
  author: string; 
  role: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm">
      <div className="flex gap-1 mb-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <svg key={i} viewBox="0 0 20 20" className="w-5 h-5 text-yellow-400" fill="currentColor">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
          </svg>
        ))}
      </div>
      <p className="text-gray-700 mb-4 italic">"{quote}"</p>
      <div>
        <p className="font-semibold text-gray-900">{author}</p>
        <p className="text-sm text-gray-500">{role}</p>
      </div>
    </div>
  );
}
