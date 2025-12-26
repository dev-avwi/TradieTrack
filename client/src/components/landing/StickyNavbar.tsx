import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";

import tradietrackLogo from "/tradietrack-logo.png";

export default function StickyNavbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setMobileMenuOpen(false);
  };

  const navLinks = [
    { label: "Features", id: "features" },
    { label: "How It Works", id: "how-it-works" },
    { label: "Pricing", id: "pricing" },
    { label: "Contact", id: "contact" },
  ];

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 h-16 transition-all duration-300 ${
          isScrolled
            ? "bg-white/95 backdrop-blur-md shadow-sm"
            : "bg-transparent"
        }`}
        data-testid="sticky-navbar"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
          <div className="flex items-center justify-between h-full">
            {/* Left: Logo + Wordmark */}
            <Link href="/">
              <button
                className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                data-testid="navbar-logo"
              >
                <img
                  src={tradietrackLogo}
                  alt="TradieTrack"
                  className="h-8 w-auto"
                />
                <span className="text-xl font-bold tracking-tight">
                  <span className="text-[#3b82f6]">Tradie</span>
                  <span className="text-[#f97316]">Track</span>
                </span>
              </button>
            </Link>

            {/* Center: Navigation Links - Hidden on mobile */}
            <div className="hidden md:flex items-center gap-8">
              {navLinks.map((link) => (
                <button
                  key={link.id}
                  onClick={() => scrollToSection(link.id)}
                  className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                  data-testid={`nav-link-${link.id}`}
                >
                  {link.label}
                </button>
              ))}
            </div>

            {/* Right: CTA Button - Hidden on mobile */}
            <div className="hidden md:block">
              <Link href="/auth?mode=signup">
                <Button
                  className="bg-black hover:bg-gray-800 text-white rounded-full px-6 font-medium"
                  data-testid="navbar-cta"
                >
                  Start Free Trial
                </Button>
              </Link>
            </div>

            {/* Mobile: Hamburger Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 -mr-2 hover:bg-gray-100 rounded-lg transition-colors"
              data-testid="navbar-menu-button"
              aria-label="Open menu"
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Drawer */}
      <div
        className={`fixed inset-0 z-[60] md:hidden transition-opacity duration-300 ${
          mobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Backdrop */}
        <div
          className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
            mobileMenuOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setMobileMenuOpen(false)}
        />

        {/* Slide-in Panel */}
        <div
          className={`absolute top-0 right-0 bottom-0 w-72 bg-white shadow-2xl transform transition-transform duration-300 ease-out ${
            mobileMenuOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <span className="text-lg font-bold">
                <span className="text-[#3b82f6]">Tradie</span>
                <span className="text-[#f97316]">Track</span>
              </span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 -mr-2 hover:bg-gray-100 rounded-lg transition-colors"
                data-testid="navbar-close-menu"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Links */}
            <div className="flex-1 px-4 py-6">
              <nav className="space-y-1">
                {navLinks.map((link) => (
                  <button
                    key={link.id}
                    onClick={() => scrollToSection(link.id)}
                    className="w-full flex items-center py-3 px-4 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors text-left"
                    data-testid={`mobile-nav-link-${link.id}`}
                  >
                    {link.label}
                  </button>
                ))}
              </nav>
            </div>

            {/* Bottom CTA */}
            <div className="p-4 border-t border-gray-100">
              <Link href="/auth?mode=signup" onClick={() => setMobileMenuOpen(false)}>
                <Button
                  className="w-full bg-black hover:bg-gray-800 text-white rounded-full h-12 font-medium"
                  data-testid="mobile-navbar-cta"
                >
                  Start Free Trial
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
