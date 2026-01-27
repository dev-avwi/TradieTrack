import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

// Custom hook for scroll-triggered animations
function useScrollAnimation(options?: IntersectionObserverInit) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px', ...options }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  return { ref, isVisible };
}

// Animated section wrapper component
function AnimatedSection({ 
  children, 
  className = "", 
  animation = "fade-up",
  delay = 0 
}: { 
  children: React.ReactNode; 
  className?: string; 
  animation?: "fade-up" | "fade-left" | "fade-right" | "scale";
  delay?: number;
}) {
  const { ref, isVisible } = useScrollAnimation();
  
  const animationClass = {
    "fade-up": "scroll-fade-up",
    "fade-left": "scroll-fade-left", 
    "fade-right": "scroll-fade-right",
    "scale": "scroll-scale"
  }[animation];

  return (
    <div 
      ref={ref}
      className={`${animationClass} ${isVisible ? 'visible' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

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
  Download,
  Globe,
  Monitor
} from "lucide-react";
import { SiApple, SiGoogleplay } from "react-icons/si";

import tradietrackLogo from "/logo.png";

// App screenshots for phone mockups
import dashboardScreenshot from "@assets/appstore_screenshots/01_dashboard.png";
import jobsListScreenshot from "@assets/appstore_screenshots/02_jobs_list.png";
import scheduleScreenshot from "@assets/appstore_screenshots/04_schedule.png";
import jobMapScreenshot from "@assets/appstore_screenshots/05_job_map.png";
import quotePreviewScreenshot from "@assets/appstore_screenshots/07_quote_preview.png";

// Construction-themed environmental mockups for toggle section
import macbookMockup from "@assets/mockuuups-construction-themed-macbook-pro-mockup_1766762122913.jpeg";
import iphoneMockup from "@assets/mockuuups-construction-project-with-an-iphone-15-pro-mockup_1766762122914.jpeg";

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [showAppPopup, setShowAppPopup] = useState(false);
  const [mockupMode, setMockupMode] = useState<'mobile' | 'web'>('mobile');

  // Show mobile app popup after a short delay on first visit
  useEffect(() => {
    const hasSeenPopup = localStorage.getItem('tradietrack_app_popup_dismissed');
    if (!hasSeenPopup) {
      const timer = setTimeout(() => {
        setShowAppPopup(true);
      }, 3000); // Show after 3 seconds
      return () => clearTimeout(timer);
    }
  }, []);

  const dismissAppPopup = () => {
    setShowAppPopup(false);
    localStorage.setItem('tradietrack_app_popup_dismissed', 'true');
  };

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Custom smooth scroll with easing for better UX
  const smoothScrollTo = useCallback((targetY: number, duration: number = 800) => {
    const startY = window.pageYOffset;
    const difference = targetY - startY;
    const startTime = performance.now();
    
    // Easing function: easeInOutCubic for smooth acceleration/deceleration
    const easeInOutCubic = (t: number): number => {
      return t < 0.5 
        ? 4 * t * t * t 
        : 1 - Math.pow(-2 * t + 2, 3) / 2;
    };
    
    const animateScroll = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeInOutCubic(progress);
      
      window.scrollTo(0, startY + difference * easedProgress);
      
      if (progress < 1) {
        requestAnimationFrame(animateScroll);
      }
    };
    
    requestAnimationFrame(animateScroll);
  }, []);

  const scrollToTop = () => {
    smoothScrollTo(0, 600);
  };

  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, sectionId: string) => {
    e.preventDefault();
    const element = document.getElementById(sectionId);
    if (element) {
      const offset = 80; // Account for fixed header
      const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
      smoothScrollTo(elementPosition - offset, 800);
    }
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 antialiased overflow-x-hidden">
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
                href="#pricing" 
                onClick={(e) => scrollToSection(e, "pricing")}
                className="text-[15px] text-gray-600 hover:text-gray-900 font-medium transition-colors" 
                data-testid="nav-pricing"
              >
                Pricing
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
                  href="#pricing" 
                  onClick={(e) => scrollToSection(e, "pricing")} 
                  className="flex items-center gap-3 py-3 px-3 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors" 
                  data-testid="mobile-nav-pricing"
                >
                  <CreditCard className="w-5 h-5 text-gray-400" />
                  Pricing
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

              {/* Beta access note */}
              <div className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-full px-4 py-2">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                </span>
                <span className="text-sm font-medium text-orange-700">
                  Beta: First 10 users get lifetime free access
                </span>
              </div>
            </div>

            {/* Right: Phone Mockup */}
            <div className="relative flex justify-center lg:justify-end animate-fade-in-up">
              <div className="relative w-[280px] sm:w-[300px] animate-float">
                {/* Mobile App Label */}
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/90 backdrop-blur-sm px-4 py-1.5 rounded-full shadow-md border border-gray-200 z-30">
                  <Smartphone className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-semibold text-gray-700">Mobile App Preview</span>
                </div>
                
                {/* Phone Frame */}
                <div 
                  className="relative bg-gray-900 rounded-[2.5rem] p-[6px] shadow-2xl shadow-gray-400/30 hover:shadow-gray-400/40 transition-shadow duration-500 will-change-auto"
                  style={{ transform: 'translateZ(0)' }}
                >
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
          <AnimatedSection>
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
          </AnimatedSection>
        </div>
      </section>

      {/* Work From Anywhere - Mockup Showcase with Toggle */}
      <section className="py-20 lg:py-28 bg-gradient-to-b from-white to-gray-50/50">
        <div className="max-w-6xl mx-auto px-5 lg:px-8">
          <AnimatedSection className="text-center mb-12 lg:mb-16">
            <span className="inline-block text-sm font-semibold text-blue-600 uppercase tracking-wider mb-4">Work From Anywhere</span>
            <h2 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold tracking-tight mb-5">
              Your business, in your pocket
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8">
              Whether you're on-site with your phone or at your desk with a browser – TradieTrack works wherever you do.
            </p>
            
            {/* Toggle Buttons */}
            <div className="inline-flex items-center bg-gray-900 rounded-full p-1.5" data-testid="mockup-toggle-container">
              <button
                onClick={() => setMockupMode('mobile')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 ${
                  mockupMode === 'mobile' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-400 hover:text-white'
                }`}
                data-testid="button-toggle-mobile"
              >
                <Smartphone className="w-4 h-4" />
                Mobile App
              </button>
              <button
                onClick={() => setMockupMode('web')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 ${
                  mockupMode === 'web' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-400 hover:text-white'
                }`}
                data-testid="button-toggle-web"
              >
                <Monitor className="w-4 h-4" />
                Web App
              </button>
            </div>
          </AnimatedSection>

          {/* Mockup Display */}
          <AnimatedSection animation="scale" delay={100} className="relative">
            {/* Mobile App View - Environmental iPhone Mockup */}
            <div 
              className={`transition-all duration-500 ease-out ${
                mockupMode === 'mobile' 
                  ? 'opacity-100 translate-y-0' 
                  : 'opacity-0 translate-y-4 absolute inset-0 pointer-events-none'
              }`}
            >
              <div className="relative max-w-2xl mx-auto">
                <img 
                  src={iphoneMockup} 
                  alt="TradieTrack mobile app on construction site" 
                  className="w-full h-auto rounded-2xl shadow-2xl"
                />
              </div>
              {/* Feature badges */}
              <div className="flex flex-wrap justify-center gap-2 mt-8">
                <span className="inline-flex items-center gap-1.5 bg-white border border-gray-200 px-4 py-2 rounded-full text-sm font-medium text-gray-800 shadow-sm">
                  <Check className="w-4 h-4 text-green-600" />
                  Works offline
                </span>
                <span className="inline-flex items-center gap-1.5 bg-white border border-gray-200 px-4 py-2 rounded-full text-sm font-medium text-gray-800 shadow-sm">
                  <Check className="w-4 h-4 text-green-600" />
                  iOS & Android
                </span>
                <span className="inline-flex items-center gap-1.5 bg-white border border-gray-200 px-4 py-2 rounded-full text-sm font-medium text-gray-800 shadow-sm">
                  <Check className="w-4 h-4 text-green-600" />
                  Instant sync
                </span>
              </div>
            </div>

            {/* Web App View - Environmental MacBook Mockup */}
            <div 
              className={`transition-all duration-500 ease-out ${
                mockupMode === 'web' 
                  ? 'opacity-100 translate-y-0' 
                  : 'opacity-0 translate-y-4 absolute inset-0 pointer-events-none'
              }`}
            >
              <div className="relative max-w-4xl mx-auto">
                <img 
                  src={macbookMockup} 
                  alt="TradieTrack web dashboard on MacBook at construction site" 
                  className="w-full h-auto rounded-2xl shadow-2xl"
                />
              </div>
              {/* Feature badges */}
              <div className="flex flex-wrap justify-center gap-2 mt-8">
                <span className="inline-flex items-center gap-1.5 bg-white border border-gray-200 px-4 py-2 rounded-full text-sm font-medium text-gray-800 shadow-sm">
                  <Check className="w-4 h-4 text-green-600" />
                  Full dashboard
                </span>
                <span className="inline-flex items-center gap-1.5 bg-white border border-gray-200 px-4 py-2 rounded-full text-sm font-medium text-gray-800 shadow-sm">
                  <Check className="w-4 h-4 text-green-600" />
                  Team management
                </span>
                <span className="inline-flex items-center gap-1.5 bg-white border border-gray-200 px-4 py-2 rounded-full text-sm font-medium text-gray-800 shadow-sm">
                  <Check className="w-4 h-4 text-green-600" />
                  Advanced reports
                </span>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 lg:py-28 scroll-mt-20">
        <div className="max-w-6xl mx-auto px-5 lg:px-8">
          {/* Section Header */}
          <AnimatedSection className="text-center mb-16 lg:mb-20">
            <span className="inline-block text-sm font-semibold text-orange-600 uppercase tracking-wider mb-4">Features</span>
            <h2 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold tracking-tight mb-5">
              Everything you need to run your business
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              From the first call to the final invoice. One app, no paperwork.
            </p>
          </AnimatedSection>

          {/* Feature 1: Scheduling */}
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center mb-24 lg:mb-32">
            <AnimatedSection animation="fade-right" className="order-2 lg:order-1">
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
            </AnimatedSection>
            <AnimatedSection animation="fade-left" delay={100} className="order-1 lg:order-2 flex justify-center">
              <PhoneMockup screenshot={scheduleScreenshot} />
            </AnimatedSection>
          </div>

          {/* Feature 2: Job Map */}
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center mb-24 lg:mb-32">
            <AnimatedSection animation="fade-right" className="flex justify-center">
              <PhoneMockup screenshot={jobMapScreenshot} />
            </AnimatedSection>
            <AnimatedSection animation="fade-left" delay={100}>
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
            </AnimatedSection>
          </div>

          {/* Feature 3: Quotes & Invoices */}
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center mb-24 lg:mb-32">
            <AnimatedSection animation="fade-right" className="order-2 lg:order-1">
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
            </AnimatedSection>
            <AnimatedSection animation="fade-left" delay={100} className="order-1 lg:order-2 flex justify-center">
              <PhoneMockup screenshot={quotePreviewScreenshot} />
            </AnimatedSection>
          </div>

          {/* Feature 4: Job Management */}
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <AnimatedSection animation="fade-right" className="flex justify-center">
              <PhoneMockup screenshot={jobsListScreenshot} />
            </AnimatedSection>
            <AnimatedSection animation="fade-left" delay={100}>
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
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 lg:py-28 bg-gray-50 scroll-mt-20">
        <div className="max-w-6xl mx-auto px-5 lg:px-8">
          <AnimatedSection className="text-center mb-16">
            <span className="inline-block text-sm font-semibold text-orange-600 uppercase tracking-wider mb-4">How It Works</span>
            <h2 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold tracking-tight mb-5">
              Get up and running in minutes
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              No complicated setup. No training needed. Just sign up and start managing your business.
            </p>
          </AnimatedSection>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            <AnimatedSection delay={0}>
              <StepCard 
                number={1}
                icon={Smartphone}
                title="Create your account"
                description="Sign up in under 2 minutes. Available on iOS, Android, and web."
              />
            </AnimatedSection>
            <AnimatedSection delay={150}>
              <StepCard 
                number={2}
                icon={Calendar}
                title="Add your first job"
                description="Enter client details, schedule the job, and start tracking your work."
              />
            </AnimatedSection>
            <AnimatedSection delay={300}>
              <StepCard 
                number={3}
                icon={CreditCard}
                title="Send quotes & get paid"
                description="Create professional quotes, convert to invoices, and accept payments."
              />
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 lg:py-28 scroll-mt-20">
        <div className="max-w-6xl mx-auto px-5 lg:px-8">
          <AnimatedSection className="text-center mb-16">
            <span className="inline-block text-sm font-semibold text-orange-600 uppercase tracking-wider mb-4">Pricing</span>
            <h2 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold tracking-tight mb-5">
              Simple, transparent pricing
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Start free, upgrade when you're ready. All prices in AUD including GST.
            </p>
          </AnimatedSection>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Free Plan */}
            <AnimatedSection delay={0}>
              <PricingCard
                name="Free"
                price="$0"
                period="forever"
                description="Perfect for trying out TradieTrack"
                features={[
                  "Unlimited quotes",
                  "25 jobs per month",
                  "25 invoices per month",
                  "Up to 50 clients",
                  "100MB photo storage",
                  "5 document templates"
                ]}
                buttonText="Get Started Free"
                buttonVariant="outline"
                href="/auth?mode=signup"
              />
            </AnimatedSection>

            {/* Pro Plan - Most Popular */}
            <AnimatedSection delay={150}>
              <PricingCard
                name="Pro"
                price="$39"
                period="/month"
                description="Unlimited everything for solo tradies"
                features={[
                  "Unlimited jobs",
                  "Unlimited quotes & invoices",
                  "Unlimited clients",
                  "Unlimited photo storage",
                  "All templates",
                  "Automatic reminders",
                  "AI Assistant",
                  "Custom branding",
                  "Recurring invoices",
                  "Priority support"
                ]}
                buttonText="Join Beta Free"
                buttonVariant="default"
                popular={true}
                href="/auth?mode=signup&plan=pro"
              />
            </AnimatedSection>

            {/* Team Plan */}
            <AnimatedSection delay={300}>
              <PricingCard
                name="Team"
                price="$49"
                period="/month + $29/seat"
                description="Full power for growing businesses"
                features={[
                  "Everything in Pro",
                  "Unlimited team members",
                  "Live team tracking",
                  "Team chat & messaging",
                  "Role-based access",
                  "Dispatch board",
                  "Geofence clock in/out",
                  "Job assignments",
                  "Advanced reporting"
                ]}
                buttonText="Join Beta Free"
                buttonVariant="default"
                href="/auth?mode=signup&plan=team"
              />
            </AnimatedSection>
          </div>

          <AnimatedSection delay={400} className="text-center mt-10">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-full px-5 py-2.5 mb-4">
              <span className="text-sm font-semibold text-green-700">
                Beta Special: First 10 users get lifetime free access in exchange for a testimonial
              </span>
            </div>
            <p className="text-sm text-gray-500">All features unlocked during beta. No credit card required.</p>
          </AnimatedSection>
        </div>
      </section>

      {/* Download Section - Web & Mobile Apps */}
      <section id="download" className="scroll-mt-20 py-20 lg:py-28 bg-gray-50">
        <div className="max-w-5xl mx-auto px-5 lg:px-8">
          <AnimatedSection className="text-center mb-14">
            <span className="inline-block text-sm font-semibold text-orange-600 uppercase tracking-wider mb-4">Get TradieTrack</span>
            <h2 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold tracking-tight mb-5">
              Use it anywhere — web or mobile
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              TradieTrack works on any device. Use the web app on your computer or download the mobile app to manage your business on the go.
            </p>
          </AnimatedSection>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Web App Card */}
            <AnimatedSection animation="fade-right">
              <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all duration-300 h-full">
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center">
                    <Monitor className="w-7 h-7 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">Web App</h3>
                    <p className="text-sm text-gray-500">Works in any browser</p>
                  </div>
                </div>
                <p className="text-gray-600 mb-6">
                  Access TradieTrack from your computer, laptop, or tablet. Perfect for office work, detailed quotes, and managing your business from your desk.
                </p>
                <Link href="/auth?mode=signup">
                  <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold h-12 rounded-lg" data-testid="download-web-app">
                    <Globe className="w-5 h-5 mr-2" />
                    Open Web App
                  </Button>
                </Link>
              </div>
            </AnimatedSection>

            {/* Mobile App Card */}
            <AnimatedSection animation="fade-left" delay={100}>
              <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all duration-300 h-full">
              <div className="flex items-center gap-4 mb-5">
                <div className="w-14 h-14 bg-orange-100 rounded-xl flex items-center justify-center">
                  <Smartphone className="w-7 h-7 text-orange-600" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">Mobile App</h3>
                  <p className="text-sm text-gray-500">iOS & Android</p>
                </div>
              </div>
              <p className="text-gray-600 mb-6">
                Take photos, track time, and manage jobs on-site. The mobile app keeps everything synced with your web account automatically.
              </p>
              
              {/* App Store Badges */}
              <div className="flex flex-col gap-3">
                <a 
                  href="https://apps.apple.com/app/tradietrack/id6756844699"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-3 bg-black text-white rounded-lg px-5 py-3 hover:bg-gray-800 transition-colors"
                  data-testid="download-app-store"
                >
                  <SiApple className="w-6 h-6" />
                  <div className="text-left">
                    <div className="text-[9px] uppercase tracking-wider opacity-80">Download on the</div>
                    <div className="text-base font-semibold -mt-0.5">App Store</div>
                  </div>
                </a>
                
                <a 
                  href="#"
                  className="flex items-center justify-center gap-3 bg-black text-white rounded-lg px-5 py-3 opacity-50 cursor-not-allowed"
                  data-testid="download-google-play"
                  title="Coming Soon"
                >
                  <SiGoogleplay className="w-5 h-5" />
                  <div className="text-left">
                    <div className="text-[9px] uppercase tracking-wider opacity-80">Coming soon to</div>
                    <div className="text-base font-semibold -mt-0.5">Google Play</div>
                  </div>
                </a>
              </div>
              </div>
            </AnimatedSection>
          </div>
          
          <AnimatedSection delay={200} className="text-center text-sm text-gray-500 mt-8">
            <p>Your data syncs seamlessly between web and mobile — work from anywhere!</p>
          </AnimatedSection>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 lg:py-28 bg-gradient-to-b from-blue-600 to-blue-700">
        <AnimatedSection className="max-w-3xl mx-auto px-5 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold text-white tracking-tight mb-6">
            Ready to simplify your business?
          </h2>
          <p className="text-lg lg:text-xl text-blue-100 mb-10 max-w-xl mx-auto">
            Join our growing community of Australian tradies. Free during beta - first 10 users get lifetime access!
          </p>
          <Link href="/auth?mode=signup">
            <Button size="lg" className="bg-orange-500 hover:bg-orange-600 text-white font-semibold h-14 px-10 text-lg rounded-lg shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all" data-testid="cta-start-trial">
              Join the Beta
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
          <p className="text-sm text-blue-200 mt-5">
            No credit card required. Just agree to provide a testimonial.
          </p>
        </AnimatedSection>
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
                    href="#pricing" 
                    onClick={(e) => scrollToSection(e, "pricing")}
                    className="hover:text-white transition-colors" 
                    data-testid="link-pricing"
                  >
                    Pricing
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
          from { opacity: 0; transform: translateY(40px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fade-in-left {
          from { opacity: 0; transform: translateX(-40px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes fade-in-right {
          from { opacity: 0; transform: translateX(40px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes scale-in {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-fade-in {
          animation: fade-in 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
          will-change: opacity, transform;
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.8s cubic-bezier(0.22, 1, 0.36, 1) forwards;
          opacity: 0;
          will-change: opacity, transform;
        }
        /* Scroll-triggered animation classes */
        .scroll-fade-up {
          opacity: 0;
          transform: translateY(40px);
          transition: opacity 0.8s cubic-bezier(0.22, 1, 0.36, 1), transform 0.8s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .scroll-fade-up.visible {
          opacity: 1;
          transform: translateY(0);
        }
        .scroll-fade-left {
          opacity: 0;
          transform: translateX(-40px);
          transition: opacity 0.8s cubic-bezier(0.22, 1, 0.36, 1), transform 0.8s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .scroll-fade-left.visible {
          opacity: 1;
          transform: translateX(0);
        }
        .scroll-fade-right {
          opacity: 0;
          transform: translateX(40px);
          transition: opacity 0.8s cubic-bezier(0.22, 1, 0.36, 1), transform 0.8s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .scroll-fade-right.visible {
          opacity: 1;
          transform: translateX(0);
        }
        .scroll-scale {
          opacity: 0;
          transform: scale(0.9);
          transition: opacity 0.8s cubic-bezier(0.22, 1, 0.36, 1), transform 0.8s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .scroll-scale.visible {
          opacity: 1;
          transform: scale(1);
        }
        /* Staggered animations */
        .stagger-1 { transition-delay: 0.1s; }
        .stagger-2 { transition-delay: 0.2s; }
        .stagger-3 { transition-delay: 0.3s; }
        .stagger-4 { transition-delay: 0.4s; }
        /* Float animation for hero */
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
        /* Prevent layout shift during image load */
        img {
          content-visibility: auto;
        }
        /* Smooth transitions for interactive elements */
        .group:hover .group-hover\\:shadow-2xl {
          transition-timing-function: cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }
      `}</style>

      {/* Mobile App Download CTA Popup */}
      {showAppPopup && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in" style={{ animationFillMode: 'both' }}>
          <div 
            className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all"
            style={{ animation: 'fade-in-up 0.4s ease-out forwards' }}
          >
            {/* Close button */}
            <button
              onClick={dismissAppPopup}
              className="absolute top-3 right-3 p-1.5 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors z-10"
              data-testid="button-close-app-popup"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>

            {/* Gradient header */}
            <div className="bg-gradient-to-r from-blue-600 to-orange-500 p-6 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 backdrop-blur rounded-2xl mb-4">
                <Smartphone className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-1">
                Get the TradieTrack App
              </h3>
              <p className="text-white/90 text-sm">
                Manage your business from anywhere
              </p>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <Check className="w-4 h-4 text-green-600" />
                  </div>
                  <span className="text-gray-700 text-sm">Take job photos on-site</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <Check className="w-4 h-4 text-green-600" />
                  </div>
                  <span className="text-gray-700 text-sm">Track time and GPS location</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <Check className="w-4 h-4 text-green-600" />
                  </div>
                  <span className="text-gray-700 text-sm">Works offline, syncs automatically</span>
                </div>
              </div>

              {/* App Store Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <a 
                  href="#" 
                  className="flex-1 flex items-center justify-center gap-2 bg-black hover:bg-gray-800 text-white rounded-lg py-3 px-4 transition-colors"
                  data-testid="popup-app-store"
                >
                  <SiApple className="w-6 h-6" />
                  <div className="text-left">
                    <div className="text-[9px] uppercase tracking-wider opacity-80">Download on the</div>
                    <div className="text-sm font-semibold -mt-0.5">App Store</div>
                  </div>
                </a>
                <a 
                  href="#" 
                  className="flex-1 flex items-center justify-center gap-2 bg-black hover:bg-gray-800 text-white rounded-lg py-3 px-4 transition-colors"
                  data-testid="popup-google-play"
                >
                  <SiGoogleplay className="w-5 h-5" />
                  <div className="text-left">
                    <div className="text-[9px] uppercase tracking-wider opacity-80">Get it on</div>
                    <div className="text-sm font-semibold -mt-0.5">Google Play</div>
                  </div>
                </a>
              </div>

              {/* Dismiss link */}
              <button
                onClick={dismissAppPopup}
                className="w-full text-center text-sm text-gray-500 hover:text-gray-700 transition-colors"
                data-testid="button-dismiss-app-popup"
              >
                Maybe later
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PhoneMockup({ screenshot }: { screenshot: string }) {
  const [imageLoaded, setImageLoaded] = useState(false);
  
  return (
    <div className="relative w-[260px] sm:w-[280px] group">
      {/* Phone Frame */}
      <div 
        className="relative bg-gray-900 rounded-[2.5rem] p-[6px] shadow-xl group-hover:shadow-2xl transition-shadow duration-500 will-change-auto"
        style={{ transform: 'translateZ(0)' }}
      >
        {/* Dynamic Island */}
        <div className="absolute top-3 left-1/2 transform -translate-x-1/2 w-20 h-5 bg-black rounded-full z-20"></div>
        
        {/* Screen */}
        <div className="relative bg-white rounded-[2.25rem] overflow-hidden">
          {/* Placeholder to prevent layout shift */}
          <div 
            className={`w-full aspect-[9/19.5] bg-gray-100 transition-opacity duration-300 ${imageLoaded ? 'opacity-0 absolute inset-0' : 'opacity-100'}`}
          />
          <img 
            src={screenshot} 
            alt="TradieTrack App"
            className={`w-full h-auto transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setImageLoaded(true)}
            loading="lazy"
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

function PricingCard({
  name,
  price,
  period,
  description,
  features,
  buttonText,
  buttonVariant = "default",
  popular = false,
  href,
  isContactSales = false
}: {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  buttonText: string;
  buttonVariant?: "default" | "outline";
  popular?: boolean;
  href?: string;
  isContactSales?: boolean;
}) {
  const handleContactSales = () => {
    window.location.href = "mailto:admin@avwebinnovation.com?subject=TradieTrack%20Team%20Plan%20Enquiry&body=Hi%20TradieTrack%20Team%20(AV%20Web%20Innovation)%2C%0A%0AI'm%20interested%20in%20the%20TradieTrack%20Team%20plan%20for%20my%20business.%0A%0ABusiness%20Name%3A%20%0ANumber%20of%20Team%20Members%3A%20%0APhone%3A%20%0A%0AThanks!";
  };

  return (
    <div className={`relative bg-white rounded-2xl p-8 shadow-sm border transition-all duration-300 hover:shadow-md ${
      popular ? "border-orange-500 ring-2 ring-orange-500/20" : "border-gray-100 hover:border-gray-200"
    }`}>
      {popular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <span className="bg-orange-500 text-white text-xs font-semibold px-4 py-1.5 rounded-full shadow-md">
            Most Popular
          </span>
        </div>
      )}
      
      <div className="text-center mb-6">
        <h3 className="text-xl font-bold text-gray-900 mb-2">{name}</h3>
        <div className="flex items-baseline justify-center gap-1">
          <span className="text-4xl font-extrabold text-gray-900">{price}</span>
          <span className="text-gray-500 text-sm">{period}</span>
        </div>
        <p className="text-gray-600 text-sm mt-2">{description}</p>
      </div>

      <ul className="space-y-3 mb-8">
        {features.map((feature, i) => (
          <li key={i} className="flex items-start gap-3">
            <div className="flex-shrink-0 w-5 h-5 bg-green-100 rounded-full flex items-center justify-center mt-0.5">
              <Check className="w-3 h-3 text-green-600" />
            </div>
            <span className="text-gray-700 text-sm">{feature}</span>
          </li>
        ))}
      </ul>

      {isContactSales ? (
        <Button 
          variant={buttonVariant as any}
          onClick={handleContactSales}
          className="w-full h-12 font-semibold rounded-lg"
          data-testid={`pricing-${name.toLowerCase()}-cta`}
        >
          {buttonText}
        </Button>
      ) : (
        <Link href={href || "/auth?mode=signup"}>
          <Button 
            variant={buttonVariant as any}
            className={`w-full h-12 font-semibold rounded-lg ${
              buttonVariant === "default" 
                ? "bg-orange-500 hover:bg-orange-600 text-white" 
                : ""
            }`}
            data-testid={`pricing-${name.toLowerCase()}-cta`}
          >
            {buttonText}
          </Button>
        </Link>
      )}
    </div>
  );
}
