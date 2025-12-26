import { Link } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import dashboardScreenshot from "@assets/appstore_screenshots/01_dashboard.png";

export default function HeroSection() {
  return (
    <section 
      className="relative py-20 md:py-32 px-5 lg:px-8 overflow-hidden"
      style={{
        background: "linear-gradient(to bottom, #f5f0ea 0%, #e8f4f8 100%)"
      }}
    >
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col items-center text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="text-5xl md:text-6xl font-bold leading-tight tracking-tight text-gray-900 max-w-4xl"
            style={{ fontFamily: "Inter, sans-serif" }}
          >
            Run your trade business like a pro
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
            className="mt-6 text-lg md:text-xl text-gray-600 max-w-2xl leading-relaxed"
          >
            All-in-one platform for managing jobs, clients, quotes, and invoicing. 
            From first call to final payment, we've got your back.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
            className="mt-10 flex flex-col sm:flex-row items-center gap-4"
          >
            <Link href="/auth?mode=signup">
              <Button 
                size="lg" 
                className="bg-black hover:bg-gray-800 text-white font-semibold h-12 px-8 rounded-full text-base shadow-lg hover:shadow-xl transition-all"
                data-testid="hero-start-trial"
              >
                Start Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <a href="#features">
              <Button 
                size="lg" 
                variant="outline"
                className="border-2 border-black text-black hover:bg-black hover:text-white font-semibold h-12 px-8 rounded-full text-base transition-all"
                data-testid="hero-see-features"
              >
                See Features
              </Button>
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
            className="mt-16 md:mt-20 w-full max-w-4xl"
          >
            <div className="relative">
              <div 
                className="rounded-2xl overflow-hidden shadow-2xl"
                style={{
                  boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.15), 0 12px 24px -8px rgba(0, 0, 0, 0.1)"
                }}
              >
                <img 
                  src={dashboardScreenshot} 
                  alt="TradieTrack Dashboard" 
                  className="w-full h-auto"
                  data-testid="img-dashboard-mockup"
                />
              </div>
            </div>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.5, ease: "easeOut" }}
            className="mt-10 text-sm md:text-base text-gray-500 font-medium"
            data-testid="text-trusted-tradies"
          >
            Trusted by 1,000+ Australian tradies
          </motion.p>
        </div>
      </div>
    </section>
  );
}
