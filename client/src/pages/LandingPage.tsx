import StickyNavbar from "@/components/landing/StickyNavbar";
import HeroSection from "@/components/landing/HeroSection";
import DeviceShowcase from "@/components/landing/DeviceShowcase";
import FeatureSections from "@/components/landing/FeatureSections";
import FeatureGrid from "@/components/landing/FeatureGrid";
import TestimonialSection from "@/components/landing/TestimonialSection";
import PricingSection from "@/components/landing/PricingSection";
import FooterSection from "@/components/landing/FooterSection";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 antialiased overflow-x-hidden scroll-smooth">
      <StickyNavbar />
      <HeroSection />
      <DeviceShowcase />
      <FeatureSections />
      <FeatureGrid />
      <TestimonialSection />
      <PricingSection />
      <FooterSection />
    </div>
  );
}
