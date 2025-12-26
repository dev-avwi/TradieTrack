import { Link } from "wouter";
import { Twitter, Linkedin, Facebook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import tradietrackLogo from "/tradietrack-logo.png";

const productLinks = [
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "Mobile App", href: "#mobile-app" },
  { label: "Integrations", href: "#integrations" },
  { label: "Updates", href: "#updates" },
];

const companyLinks = [
  { label: "About Us", href: "#about" },
  { label: "Contact", href: "#contact" },
  { label: "Careers", href: "#careers" },
  { label: "Blog", href: "#blog" },
  { label: "Support", href: "#support" },
];

const legalLinks = [
  { label: "Privacy Policy", href: "#privacy" },
  { label: "Terms of Service", href: "#terms" },
  { label: "Cookie Policy", href: "#cookies" },
  { label: "Security", href: "#security" },
  { label: "GDPR", href: "#gdpr" },
];

export default function FooterSection() {
  return (
    <footer className="bg-gray-900 text-white py-16 px-5 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-12">
          <div className="max-w-md mx-auto text-center">
            <h3 className="text-lg font-semibold mb-4">
              Stay up to date with the latest features
            </h3>
            <div className="relative">
              <Input
                type="email"
                placeholder="Enter your email"
                className="w-full h-12 pl-5 pr-32 rounded-full bg-gray-800 border-gray-700 text-white placeholder:text-gray-400 focus:border-gray-600"
                data-testid="input-newsletter-email"
              />
              <Button
                className="absolute right-1 top-1 h-10 px-6 rounded-full bg-white text-gray-900 hover:bg-gray-100 font-semibold"
                data-testid="button-subscribe"
              >
                Subscribe
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12 mb-12">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <img
                src={tradietrackLogo}
                alt="TradieTrack"
                className="h-10 w-10"
                data-testid="img-footer-logo"
              />
              <span className="text-xl font-bold">TradieTrack</span>
            </div>
            <p className="text-gray-400 mb-6">
              The all-in-one platform for Australian tradies
            </p>
            <div className="flex items-center gap-4">
              <a
                href="#twitter"
                className="text-gray-400 hover:text-white transition"
                aria-label="Twitter"
                data-testid="link-twitter"
              >
                <Twitter className="h-5 w-5" />
              </a>
              <a
                href="#linkedin"
                className="text-gray-400 hover:text-white transition"
                aria-label="LinkedIn"
                data-testid="link-linkedin"
              >
                <Linkedin className="h-5 w-5" />
              </a>
              <a
                href="#facebook"
                className="text-gray-400 hover:text-white transition"
                aria-label="Facebook"
                data-testid="link-facebook"
              >
                <Facebook className="h-5 w-5" />
              </a>
            </div>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Product</h4>
            <ul className="space-y-3">
              {productLinks.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-gray-400 hover:text-white transition"
                    data-testid={`link-${link.label.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Company</h4>
            <ul className="space-y-3">
              {companyLinks.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-gray-400 hover:text-white transition"
                    data-testid={`link-${link.label.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Legal</h4>
            <ul className="space-y-3">
              {legalLinks.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-gray-400 hover:text-white transition"
                    data-testid={`link-${link.label.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="text-gray-400 font-medium" data-testid="text-footer-trusted">
              Trusted by 1,000+ Australian tradies
            </p>
            <p className="text-gray-500 text-sm" data-testid="text-footer-copyright">
              © 2025 TradieTrack. All rights reserved.
            </p>
            <p className="text-gray-500 text-sm" data-testid="text-footer-made-in">
              Made with love in Australia 🇦🇺
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
