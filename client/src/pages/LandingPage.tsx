import { useState, useEffect } from "react";
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
  ArrowRight,
  Play,
  Sparkles,
  Download
} from "lucide-react";
import { SiApple, SiGoogleplay } from "react-icons/si";

import tradietrackLogo from "/tradietrack-logo.png";
import dashboardScreenshot from "@assets/appstore_screenshots/01_dashboard.png";
import jobsListScreenshot from "@assets/appstore_screenshots/02_jobs_list.png";
import scheduleScreenshot from "@assets/appstore_screenshots/04_schedule.png";
import jobMapScreenshot from "@assets/appstore_screenshots/05_job_map.png";
import quotePreviewScreenshot from "@assets/appstore_screenshots/07_quote_preview.png";

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, sectionId: string) => {
    e.preventDefault();
    const element = document.getElementById(sectionId);
    if (element) {
      const offset = 80; // Account for fixed header
      const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
      window.scrollTo({
        top: elementPosition - offset,
        behavior: "smooth"
      });
    }
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 antialiased overflow-x-hidden scroll-smooth">
      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled 
          ? "bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100" 
          : "bg-white/80 backdrop-blur-sm"
      }`}>
        <div className="max-w-6xl mx-auto px-5 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-18">
            {/* Logo - Click to scroll to top */}
            <button 
              onClick={scrollToTop}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity" 
              data-testid="nav-logo"
            >
              <img 
                src={tradietrackLogo} 
                alt="TradieTrack" 
                className="h-9 w-auto"
              />
              <span className="text-xl font-bold tracking-tight">
                <span className="text-blue-600">Tradie</span>
                <span className="text-orange-500">Track</span>
              </span>
            </button>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-10">
              <a 
                href="#features" 
                onClick={(e) => scrollToSection(e, "features")}
                className="text-[15px] text-gray-600 hover:text-gray-900 font-medium transition-colors" 
                data-testid="nav-features"
              >
                Features
              </a>
              <a 
                href="#how-it-works" 
                onClick={(e) => scrollToSection(e, "how-it-works")}
                className="text-[15px] text-gray-600 hover:text-gray-900 font-medium transition-colors" 
                data-testid="nav-how-it-works"
              >
                How It Works
              </a>
              <a 
                href="#download" 
                onClick={(e) => scrollToSection(e, "download")}
                className="text-[15px] text-gray-600 hover:text-gray-900 font-medium transition-colors" 
                data-testid="nav-download"
              >
                Download
              </a>
            </div>

            {/* Desktop CTA - Get Started and Login grouped together */}
            <div className="hidden lg:flex items-center">
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <Link href="/auth?mode=login">
                  <Button variant="ghost" className="text-[15px] font-medium h-9 px-4 rounded-md hover:bg-white hover:shadow-sm transition-all" data-testid="nav-login">
                    Log In
                  </Button>
                </Link>
                <Link href="/auth?mode=signup">
                  <Button className="bg-orange-500 hover:bg-orange-600 text-white text-[15px] font-semibold h-9 px-5 rounded-md shadow-sm transition-all" data-testid="nav-get-started">
                    Get Started Free
                  </Button>
                </Link>
              </div>
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -mr-2 hover:bg-gray-100 rounded-lg transition-colors"
              data-testid="button-mobile-menu"
              aria-label="Open menu"
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu - Slide from right with blur */}
      <div 
        className={`fixed inset-0 z-[60] lg:hidden transition-opacity duration-300 ${
          mobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Backdrop with blur */}
        <div 
          className={`absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity duration-300 ${
            mobileMenuOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setMobileMenuOpen(false)}
        />
        
        {/* Slide-in panel */}
        <div 
          className={`absolute top-0 right-0 bottom-0 w-[280px] bg-white shadow-2xl transform transition-transform duration-300 ease-out ${
            mobileMenuOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <span className="text-lg font-bold">
                <span className="text-blue-600">Tradie</span>
                <span className="text-orange-500">Track</span>
              </span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 -mr-2 hover:bg-gray-100 rounded-lg transition-colors"
                data-testid="button-close-menu"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Links */}
            <div className="flex-1 px-5 py-6">
              <nav className="space-y-1">
                <a 
                  href="#features" 
                  onClick={(e) => scrollToSection(e, "features")} 
                  className="flex items-center gap-3 py-3 px-3 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors" 
                  data-testid="mobile-nav-features"
                >
                  <Sparkles className="w-5 h-5 text-gray-400" />
                  Features
                </a>
                <a 
                  href="#how-it-works" 
                  onClick={(e) => scrollToSection(e, "how-it-works")} 
                  className="flex items-center gap-3 py-3 px-3 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors" 
                  data-testid="mobile-nav-how-it-works"
                >
                  <Play className="w-5 h-5 text-gray-400" />
                  How It Works
                </a>
                <a 
                  href="#download" 
                  onClick={(e) => scrollToSection(e, "download")} 
                  className="flex items-center gap-3 py-3 px-3 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors" 
                  data-testid="mobile-nav-download"
                >
                  <Download className="w-5 h-5 text-gray-400" />
                  Download App
                </a>
              </nav>
            </div>

            {/* Bottom CTAs - Grouped together */}
            <div className="p-5 border-t border-gray-100 space-y-3">
              <Link href="/auth?mode=signup" onClick={() => setMobileMenuOpen(false)}>
                <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white h-12 text-[15px] font-semibold rounded-lg" data-testid="mobile-get-started">
                  Get Started Free
                </Button>
              </Link>
              <Link href="/auth?mode=login" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="outline" className="w-full h-12 text-[15px] font-medium rounded-lg" data-testid="mobile-login">
                  Log In
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <section className="pt-28 lg:pt-36 pb-16 lg:pb-24 px-5 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left: Content */}
            <div className="text-center lg:text-left animate-fade-in">
              {/* Beta Badge */}
              <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-50 to-orange-50 border border-blue-100 rounded-full px-4 py-2 mb-8">
                <Sparkles className="w-4 h-4 text-orange-500" />
                <span className="text-sm font-semibold text-gray-700">Free for early users</span>
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
                <Link href="/auth?mode=signup">
                  <Button size="lg" className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white font-semibold h-12 px-7 text-base rounded-lg shadow-md hover:shadow-lg hover:scale-[1.02] transition-all" data-testid="hero-start-trial">
                    Start Using Free
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <a 
                  href="#how-it-works"
                  onClick={(e) => scrollToSection(e, "how-it-works")}
                >
                  <Button size="lg" variant="outline" className="w-full sm:w-auto h-12 px-7 text-base font-medium rounded-lg border-gray-300 hover:bg-gray-50 hover:scale-[1.02] transition-all" data-testid="hero-watch-demo">
                    <Play className="mr-2 h-4 w-4" />
                    See How It Works
                  </Button>
                </a>
              </div>

              {/* Free access note */}
              <p className="text-sm text-gray-500">
                Currently free while in beta. No credit card required.
              </p>
            </div>

            {/* Right: Phone Mockup */}
            <div className="relative flex justify-center lg:justify-end animate-fade-in-up">
              <div className="relative w-[280px] sm:w-[300px]">
                {/* Phone Frame */}
                <div className="relative bg-gray-900 rounded-[2.5rem] p-[6px] shadow-2xl shadow-gray-400/30 hover:shadow-gray-400/40 transition-shadow duration-500">
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
      <section className="py-10 border-y border-gray-100 bg-gray-50/50">
        <div className="max-w-6xl mx-auto px-5 lg:px-8">
          <p className="text-center text-sm text-gray-500 mb-6">Built for trade businesses across Australia</p>
          <div className="flex flex-wrap justify-center items-center gap-6 lg:gap-12">
            {["Electricians", "Plumbers", "Builders", "HVAC Techs", "Property Maintenance"].map((trade, i) => (
              <span 
                key={trade} 
                className="text-gray-400 font-medium text-sm uppercase tracking-wider hover:text-gray-600 transition-colors cursor-default"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                {trade}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 lg:py-28 scroll-mt-20">
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
              <a 
                href="#how-it-works" 
                onClick={(e) => scrollToSection(e, "how-it-works")}
                className="inline-flex items-center text-blue-600 font-semibold hover:text-blue-700 transition-colors group" 
                data-testid="link-explore-maps"
              >
                Learn more <ChevronRight className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
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
      <section id="how-it-works" className="py-20 lg:py-28 bg-gray-50 scroll-mt-20">
        <div className="max-w-6xl mx-auto px-5 lg:px-8">
          <div className="text-center mb-16">
            <span className="inline-block text-sm font-semibold text-orange-600 uppercase tracking-wider mb-4">How It Works</span>
            <h2 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold tracking-tight mb-5">
              Get up and running in minutes
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              No complicated setup. No training needed. Just sign up and start managing your business.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            <StepCard 
              number={1}
              icon={Smartphone}
              title="Create your account"
              description="Sign up in under 2 minutes. Available on iOS, Android, and web."
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

      {/* Final CTA */}
      <section className="py-20 lg:py-28 bg-gradient-to-b from-blue-600 to-blue-700">
        <div className="max-w-3xl mx-auto px-5 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold text-white tracking-tight mb-6">
            Ready to simplify your business?
          </h2>
          <p className="text-lg lg:text-xl text-blue-100 mb-10 max-w-xl mx-auto">
            Join our growing community of Australian tradies. Free while we're in beta.
          </p>
          <Link href="/auth?mode=signup">
            <Button size="lg" className="bg-orange-500 hover:bg-orange-600 text-white font-semibold h-14 px-10 text-lg rounded-lg shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all" data-testid="cta-start-trial">
              Get Started Free
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
          <p className="text-sm text-blue-200 mt-5">
            No credit card required. No commitment.
          </p>
        </div>
      </section>

      {/* Download Section */}
      <section id="download" className="scroll-mt-20 py-20 lg:py-28 bg-gray-50">
        <div className="max-w-4xl mx-auto px-5 lg:px-8 text-center">
          <span className="inline-block text-sm font-semibold text-orange-600 uppercase tracking-wider mb-4">Download Now</span>
          <h2 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold tracking-tight mb-5">
            Get the TradieTrack App
          </h2>
          <p className="text-lg text-gray-600 max-w-xl mx-auto mb-10">
            Available on iOS and Android. Take your business with you wherever you go.
          </p>
          
          {/* App Store Badges */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {/* App Store Badge */}
            <a 
              href="https://apps.apple.com/app/tradietrack/id6756844699"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 bg-black text-white rounded-xl px-6 py-3 hover:bg-gray-800 transition-colors group"
              data-testid="download-app-store"
            >
              <SiApple className="w-8 h-8" />
              <div className="text-left">
                <div className="text-[10px] uppercase tracking-wider opacity-80">Download on the</div>
                <div className="text-lg font-semibold -mt-0.5">App Store</div>
              </div>
            </a>
            
            {/* Google Play Badge */}
            <a 
              href="#"
              className="flex items-center gap-3 bg-black text-white rounded-xl px-6 py-3 hover:bg-gray-800 transition-colors group opacity-60 cursor-not-allowed"
              data-testid="download-google-play"
              title="Coming Soon"
            >
              <SiGoogleplay className="w-7 h-7" />
              <div className="text-left">
                <div className="text-[10px] uppercase tracking-wider opacity-80">Get it on</div>
                <div className="text-lg font-semibold -mt-0.5">Google Play</div>
              </div>
            </a>
          </div>
          
          <p className="text-sm text-gray-500 mt-6">
            Android version coming soon!
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12 lg:py-16">
        <div className="max-w-6xl mx-auto px-5 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
            <div>
              <button 
                onClick={scrollToTop}
                className="flex items-center gap-3 mb-5 hover:opacity-80 transition-opacity"
              >
                <img 
                  src={tradietrackLogo} 
                  alt="TradieTrack" 
                  className="h-8 w-auto brightness-0 invert"
                />
                <span className="text-lg font-bold">
                  <span className="text-blue-400">Tradie</span>
                  <span className="text-orange-400">Track</span>
                </span>
              </button>
              <p className="text-sm leading-relaxed">
                Job management software built for Australian tradies. Simple. Powerful. Mobile-first.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm uppercase tracking-wider mb-5">Product</h3>
              <ul className="space-y-3 text-sm">
                <li>
                  <a 
                    href="#features" 
                    onClick={(e) => scrollToSection(e, "features")}
                    className="hover:text-white transition-colors" 
                    data-testid="link-features"
                  >
                    Features
                  </a>
                </li>
                <li>
                  <a 
                    href="#how-it-works" 
                    onClick={(e) => scrollToSection(e, "how-it-works")}
                    className="hover:text-white transition-colors" 
                    data-testid="link-how-it-works"
                  >
                    How It Works
                  </a>
                </li>
                <li>
                  <a 
                    href="#download" 
                    onClick={(e) => scrollToSection(e, "download")}
                    className="hover:text-white transition-colors" 
                    data-testid="link-mobile-app"
                  >
                    Download App
                  </a>
                </li>
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

      {/* Global Styles for animations */}
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.6s ease-out forwards;
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.8s ease-out 0.2s forwards;
          opacity: 0;
        }
        html {
          scroll-behavior: smooth;
        }
      `}</style>
    </div>
  );
}

function PhoneMockup({ screenshot }: { screenshot: string }) {
  return (
    <div className="relative w-[260px] sm:w-[280px] group">
      {/* Phone Frame */}
      <div className="relative bg-gray-900 rounded-[2.5rem] p-[6px] shadow-xl group-hover:shadow-2xl transition-shadow duration-500">
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
    <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all duration-300 hover:-translate-y-1">
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
