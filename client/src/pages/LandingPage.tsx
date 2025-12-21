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
  Check,
  ChevronRight,
  Smartphone,
  Star,
  ArrowRight,
  Play
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
    <div className="min-h-screen bg-white text-gray-900 antialiased">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-5 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-18">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3" data-testid="nav-logo">
              <img 
                src={tradietrackLogo} 
                alt="TradieTrack" 
                className="h-9 w-auto"
              />
              <span className="text-xl font-bold tracking-tight">
                <span className="text-gray-900">Tradie</span>
                <span className="text-blue-600">Track</span>
              </span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-10">
              <a href="#features" className="text-[15px] text-gray-600 hover:text-gray-900 font-medium transition-colors" data-testid="nav-features">Features</a>
              <a href="#how-it-works" className="text-[15px] text-gray-600 hover:text-gray-900 font-medium transition-colors" data-testid="nav-how-it-works">How It Works</a>
              <a href="#testimonials" className="text-[15px] text-gray-600 hover:text-gray-900 font-medium transition-colors" data-testid="nav-testimonials">Testimonials</a>
            </div>

            {/* Desktop CTA */}
            <div className="hidden lg:flex items-center gap-3">
              <Link href="/auth">
                <Button variant="ghost" className="text-[15px] font-medium h-10 px-4" data-testid="nav-login">
                  Log In
                </Button>
              </Link>
              <Link href="/auth">
                <Button className="bg-orange-500 hover:bg-orange-600 text-white text-[15px] font-semibold h-10 px-5 rounded-lg shadow-sm" data-testid="nav-get-started">
                  Start Free Trial
                </Button>
              </Link>
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 -mr-2"
              data-testid="button-mobile-menu"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden absolute top-16 left-0 right-0 bg-white border-b border-gray-200 shadow-lg">
            <div className="px-5 py-6 space-y-1">
              <a href="#features" onClick={() => setMobileMenuOpen(false)} className="block py-3 text-[15px] text-gray-700 font-medium" data-testid="mobile-nav-features">
                Features
              </a>
              <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="block py-3 text-[15px] text-gray-700 font-medium" data-testid="mobile-nav-how-it-works">
                How It Works
              </a>
              <a href="#testimonials" onClick={() => setMobileMenuOpen(false)} className="block py-3 text-[15px] text-gray-700 font-medium" data-testid="mobile-nav-testimonials">
                Testimonials
              </a>
              <div className="pt-4 flex flex-col gap-3">
                <Link href="/auth" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="outline" className="w-full h-11 text-[15px] font-medium" data-testid="mobile-login">
                    Log In
                  </Button>
                </Link>
                <Link href="/auth" onClick={() => setMobileMenuOpen(false)}>
                  <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white h-11 text-[15px] font-semibold" data-testid="mobile-get-started">
                    Start Free Trial
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="pt-28 lg:pt-36 pb-16 lg:pb-24 px-5 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left: Content */}
            <div className="text-center lg:text-left">
              {/* Trust Badge */}
              <div className="inline-flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-full px-4 py-2 mb-8">
                <div className="flex items-center">
                  {[1,2,3,4,5].map(i => (
                    <Star key={i} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  ))}
                </div>
                <span className="text-sm font-medium text-gray-700">4.9/5 from 2,000+ reviews</span>
              </div>

              {/* Main Headline */}
              <h1 className="text-[2.5rem] sm:text-5xl lg:text-[3.25rem] font-extrabold leading-[1.1] tracking-tight mb-6">
                Run your trade business{" "}
                <span className="text-blue-600">smarter, not harder.</span>
              </h1>

              {/* Subheadline */}
              <p className="text-lg lg:text-xl text-gray-600 leading-relaxed mb-8 max-w-lg mx-auto lg:mx-0">
                The all-in-one app for Australian tradies. Schedule jobs, send quotes, invoice clients, and get paid faster — all from your phone.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-8">
                <Link href="/auth">
                  <Button size="lg" className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white font-semibold h-12 px-7 text-base rounded-lg shadow-md hover:shadow-lg transition-all" data-testid="hero-start-trial">
                    Start Free Trial
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <a href="#how-it-works">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto h-12 px-7 text-base font-medium rounded-lg border-gray-300 hover:bg-gray-50" data-testid="hero-watch-demo">
                    <Play className="mr-2 h-4 w-4" />
                    Watch Demo
                  </Button>
                </a>
              </div>

              {/* No credit card */}
              <p className="text-sm text-gray-500">
                14-day free trial. No credit card required.
              </p>
            </div>

            {/* Right: Phone Mockup */}
            <div className="relative flex justify-center lg:justify-end">
              <div className="relative w-[280px] sm:w-[300px]">
                {/* Phone Frame */}
                <div className="relative bg-gray-900 rounded-[2.5rem] p-[6px] shadow-2xl shadow-gray-400/30">
                  {/* Dynamic Island */}
                  <div className="absolute top-3 left-1/2 transform -translate-x-1/2 w-20 h-5 bg-black rounded-full z-20"></div>
                  
                  {/* Screen */}
                  <div className="relative bg-white rounded-[2.25rem] overflow-hidden">
                    <img 
                      src={dashboardScreenshot} 
                      alt="TradieTrack Dashboard"
                      className="w-full h-auto"
                    />
                  </div>
                </div>

                {/* Decorative gradient blob */}
                <div className="absolute -z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-gradient-to-br from-blue-100 via-orange-50 to-transparent rounded-full blur-3xl opacity-60"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Bar */}
      <section className="py-8 border-y border-gray-100 bg-gray-50/50">
        <div className="max-w-6xl mx-auto px-5 lg:px-8">
          <p className="text-center text-sm text-gray-500 mb-6">Trusted by trade businesses across Australia</p>
          <div className="flex flex-wrap justify-center items-center gap-8 lg:gap-14">
            {["Electricians", "Plumbers", "Builders", "HVAC Techs", "Property Maintenance"].map((trade) => (
              <span key={trade} className="text-gray-400 font-medium text-sm uppercase tracking-wider">{trade}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 lg:py-28">
        <div className="max-w-6xl mx-auto px-5 lg:px-8">
          {/* Section Header */}
          <div className="text-center mb-16 lg:mb-20">
            <span className="inline-block text-sm font-semibold text-orange-600 uppercase tracking-wider mb-4">Features</span>
            <h2 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold tracking-tight mb-5">
              Everything you need to run your business
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              From the first call to the final invoice. One app, no paperwork.
            </p>
          </div>

          {/* Feature 1: Scheduling */}
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center mb-24 lg:mb-32">
            <div className="order-2 lg:order-1">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-xl mb-6">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">
                Smart scheduling that saves hours
              </h3>
              <p className="text-gray-600 text-lg leading-relaxed mb-6">
                See your whole week at a glance. Drag and drop jobs, check team availability, and send automatic reminders to clients.
              </p>
              <ul className="space-y-3">
                <FeatureItem text="Drag & drop job scheduling" />
                <FeatureItem text="Team calendar & availability" />
                <FeatureItem text="Automatic client reminders" />
              </ul>
            </div>
            <div className="order-1 lg:order-2 flex justify-center">
              <PhoneMockup screenshot={scheduleScreenshot} />
            </div>
          </div>

          {/* Feature 2: Job Map */}
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center mb-24 lg:mb-32">
            <div className="flex justify-center">
              <PhoneMockup screenshot={jobMapScreenshot} />
            </div>
            <div>
              <div className="inline-flex items-center justify-center w-12 h-12 bg-orange-100 rounded-xl mb-6">
                <MapPin className="w-6 h-6 text-orange-600" />
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">
                See all your jobs on a map
              </h3>
              <p className="text-gray-600 text-lg leading-relaxed mb-6">
                Plan your day visually. Track your team's locations in real-time and optimise routes to save time and fuel.
              </p>
              <a href="#how-it-works" className="inline-flex items-center text-blue-600 font-semibold hover:text-blue-700 transition-colors" data-testid="link-explore-maps">
                Learn more <ChevronRight className="ml-1 h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Feature 3: Quotes & Invoices */}
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center mb-24 lg:mb-32">
            <div className="order-2 lg:order-1">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-xl mb-6">
                <FileText className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">
                Quote on-site. Get paid faster.
              </h3>
              <p className="text-gray-600 text-lg leading-relaxed mb-6">
                Create professional quotes in seconds. Convert to invoice with one tap. Get paid instantly with built-in payment links.
              </p>
              <ul className="space-y-3">
                <FeatureItem text="Professional PDF templates" />
                <FeatureItem text="One-tap quote to invoice" />
                <FeatureItem text="Stripe payment integration" />
              </ul>
            </div>
            <div className="order-1 lg:order-2 flex justify-center">
              <PhoneMockup screenshot={quotePreviewScreenshot} />
            </div>
          </div>

          {/* Feature 4: Job Management */}
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div className="flex justify-center">
              <PhoneMockup screenshot={jobsListScreenshot} />
            </div>
            <div>
              <div className="inline-flex items-center justify-center w-12 h-12 bg-purple-100 rounded-xl mb-6">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">
                Never lose track of a job again
              </h3>
              <p className="text-gray-600 text-lg leading-relaxed mb-6">
                Every job from quote to completion in one place. Add photos, notes, and track progress. Know exactly where every project stands.
              </p>
              <ul className="space-y-3">
                <FeatureItem text="Visual job status tracking" />
                <FeatureItem text="Photos & notes on every job" />
                <FeatureItem text="Client communication history" />
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 lg:py-28 bg-gray-50">
        <div className="max-w-6xl mx-auto px-5 lg:px-8">
          <div className="text-center mb-16">
            <span className="inline-block text-sm font-semibold text-orange-600 uppercase tracking-wider mb-4">How It Works</span>
            <h2 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold tracking-tight mb-5">
              Get up and running in minutes
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              No complicated setup. No training needed. Just download and start managing your business.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            <StepCard 
              number={1}
              icon={Smartphone}
              title="Download the app"
              description="Available on iOS and Android. Create your account in under 2 minutes."
            />
            <StepCard 
              number={2}
              icon={Calendar}
              title="Add your first job"
              description="Enter client details, schedule the job, and start tracking your work."
            />
            <StepCard 
              number={3}
              icon={CreditCard}
              title="Send quotes & get paid"
              description="Create professional quotes, convert to invoices, and accept payments."
            />
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-20 lg:py-28">
        <div className="max-w-6xl mx-auto px-5 lg:px-8">
          <div className="text-center mb-16">
            <span className="inline-block text-sm font-semibold text-orange-600 uppercase tracking-wider mb-4">Testimonials</span>
            <h2 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold tracking-tight mb-5">
              Loved by tradies across Australia
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Join thousands who've simplified their business with TradieTrack.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            <TestimonialCard
              quote="I used to spend hours on paperwork every Sunday. Now I do everything from my phone between jobs. Absolute game changer."
              author="Mike Thompson"
              role="Electrician"
              location="Sydney"
            />
            <TestimonialCard
              quote="The payment links cut our invoice-to-payment time in half. Clients just click and pay. No more chasing invoices."
              author="Sarah Chen"
              role="Plumber"
              location="Melbourne"
            />
            <TestimonialCard
              quote="Finally an app that works offline! I update jobs on remote sites with no signal and it syncs when I'm back online."
              author="Tom Williams"
              role="Builder"
              location="Gold Coast"
            />
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 lg:py-28 bg-gradient-to-b from-blue-600 to-blue-700">
        <div className="max-w-3xl mx-auto px-5 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold text-white tracking-tight mb-6">
            Ready to run your business smarter?
          </h2>
          <p className="text-lg lg:text-xl text-blue-100 mb-10 max-w-xl mx-auto">
            Join thousands of Australian tradies who've made the switch. Start your free trial today.
          </p>
          <Link href="/auth">
            <Button size="lg" className="bg-orange-500 hover:bg-orange-600 text-white font-semibold h-14 px-10 text-lg rounded-lg shadow-lg hover:shadow-xl transition-all" data-testid="cta-start-trial">
              Start Your Free Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
          <p className="text-sm text-blue-200 mt-5">
            No credit card required. Cancel anytime.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12 lg:py-16">
        <div className="max-w-6xl mx-auto px-5 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
            <div>
              <div className="flex items-center gap-3 mb-5">
                <img 
                  src={tradietrackLogo} 
                  alt="TradieTrack" 
                  className="h-8 w-auto brightness-0 invert"
                />
                <span className="text-lg font-bold">
                  <span className="text-white">Tradie</span>
                  <span className="text-blue-400">Track</span>
                </span>
              </div>
              <p className="text-sm leading-relaxed">
                Job management software built for Australian tradies. Simple. Powerful. Mobile-first.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm uppercase tracking-wider mb-5">Product</h3>
              <ul className="space-y-3 text-sm">
                <li><a href="#features" className="hover:text-white transition-colors" data-testid="link-features">Features</a></li>
                <li><a href="#how-it-works" className="hover:text-white transition-colors" data-testid="link-how-it-works">How It Works</a></li>
                <li><a href="#" className="hover:text-white transition-colors" data-testid="link-mobile-app">Mobile App</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm uppercase tracking-wider mb-5">Company</h3>
              <ul className="space-y-3 text-sm">
                <li><a href="#" className="hover:text-white transition-colors" data-testid="link-about">About</a></li>
                <li><a href="mailto:admin@avwebinnovation.com" className="hover:text-white transition-colors" data-testid="link-contact">Contact</a></li>
                <li><a href="#" className="hover:text-white transition-colors" data-testid="link-support">Support</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm uppercase tracking-wider mb-5">Legal</h3>
              <ul className="space-y-3 text-sm">
                <li><Link href="/privacy" className="hover:text-white transition-colors" data-testid="link-privacy">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-white transition-colors" data-testid="link-terms">Terms of Service</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-sm">
            <p>&copy; {new Date().getFullYear()} TradieTrack. All rights reserved.</p>
            <p className="mt-2 text-gray-500">Made with love in Australia</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function PhoneMockup({ screenshot }: { screenshot: string }) {
  return (
    <div className="relative w-[260px] sm:w-[280px]">
      {/* Phone Frame */}
      <div className="relative bg-gray-900 rounded-[2.5rem] p-[6px] shadow-xl">
        {/* Dynamic Island */}
        <div className="absolute top-3 left-1/2 transform -translate-x-1/2 w-20 h-5 bg-black rounded-full z-20"></div>
        
        {/* Screen */}
        <div className="relative bg-white rounded-[2.25rem] overflow-hidden">
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

function FeatureItem({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-shrink-0 w-5 h-5 bg-green-100 rounded-full flex items-center justify-center">
        <Check className="w-3 h-3 text-green-600" />
      </div>
      <span className="text-gray-700">{text}</span>
    </div>
  );
}

function StepCard({ 
  number,
  icon: Icon, 
  title, 
  description
}: { 
  number: number;
  icon: any; 
  title: string; 
  description: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
      <div className="flex items-center gap-4 mb-5">
        <div className="w-10 h-10 bg-blue-600 text-white rounded-lg flex items-center justify-center font-bold text-lg">
          {number}
        </div>
        <Icon className="w-6 h-6 text-gray-400" />
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-3">{title}</h3>
      <p className="text-gray-600 leading-relaxed">{description}</p>
    </div>
  );
}

function TestimonialCard({ 
  quote, 
  author, 
  role,
  location
}: { 
  quote: string; 
  author: string; 
  role: string;
  location: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
      <div className="flex gap-1 mb-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} className="w-5 h-5 text-yellow-400 fill-yellow-400" />
        ))}
      </div>
      <p className="text-gray-700 leading-relaxed mb-6">"{quote}"</p>
      <div>
        <p className="font-semibold text-gray-900">{author}</p>
        <p className="text-sm text-gray-500">{role} · {location}</p>
      </div>
    </div>
  );
}
