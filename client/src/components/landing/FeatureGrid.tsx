import { motion } from "framer-motion";
import { 
  Palette, 
  Plug, 
  MessageCircle, 
  Flag, 
  LayoutGrid, 
  Smartphone 
} from "lucide-react";

const features = [
  {
    icon: Palette,
    title: "Customise your branding",
    description: "Personalize invoices, quotes with your logo and colors",
    color: "bg-purple-100 text-purple-600"
  },
  {
    icon: Plug,
    title: "Integrations",
    description: "Connect with Xero, Stripe, Google Calendar, and more",
    color: "bg-blue-100 text-blue-600",
    hasMarquee: true
  },
  {
    icon: MessageCircle,
    title: "Real-time team chat",
    description: "Keep conversations in sync with job-specific messaging",
    color: "bg-green-100 text-green-600"
  },
  {
    icon: Flag,
    title: "Australian made",
    description: "Built for Aussie tradies with GST, ABN, and ATO compliance",
    color: "bg-amber-100 text-amber-600"
  },
  {
    icon: LayoutGrid,
    title: "Multiple views",
    description: "Switch between calendar, list, map, and timeline views",
    color: "bg-cyan-100 text-cyan-600"
  },
  {
    icon: Smartphone,
    title: "Mobile first",
    description: "Full-featured iOS app for the field",
    color: "bg-rose-100 text-rose-600"
  }
];

const integrations = [
  { name: "Xero", bg: "bg-[#13B5EA]" },
  { name: "Stripe", bg: "bg-[#635BFF]" },
  { name: "Google Calendar", bg: "bg-[#4285F4]" },
  { name: "SendGrid", bg: "bg-[#1A82E2]" },
  { name: "Twilio", bg: "bg-[#F22F46]" }
];

function IntegrationMarquee() {
  return (
    <div className="mt-4 overflow-hidden group">
      <div 
        className="flex gap-3 animate-marquee group-hover:[animation-play-state:paused]"
        style={{
          width: "max-content"
        }}
      >
        {[...integrations, ...integrations].map((integration, index) => (
          <div
            key={`${integration.name}-${index}`}
            className={`${integration.bg} text-white text-xs font-medium px-3 py-1.5 rounded-full whitespace-nowrap`}
          >
            {integration.name}
          </div>
        ))}
      </div>
      <style>{`
        @keyframes marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .animate-marquee {
          animation: marquee 15s linear infinite;
        }
      `}</style>
    </div>
  );
}

function FeatureCard({ feature, index }: { feature: typeof features[0]; index: number }) {
  const Icon = feature.icon;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.1, ease: "easeOut" }}
      className="bg-gray-50 dark:bg-gray-900 rounded-2xl p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
      data-testid={`card-feature-${index}`}
    >
      <div className={`w-12 h-12 rounded-xl ${feature.color} flex items-center justify-center mb-4`}>
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
        {feature.title}
      </h3>
      <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
        {feature.description}
      </p>
      {feature.hasMarquee && <IntegrationMarquee />}
    </motion.div>
  );
}

export default function FeatureGrid() {
  return (
    <section id="features" className="py-20 md:py-28 px-5 lg:px-8 bg-white dark:bg-gray-950">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center mb-16"
        >
          <h2 
            className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4"
            style={{ fontFamily: "Inter, sans-serif" }}
            data-testid="text-feature-heading"
          >
            Built for tradies, powered by simplicity
          </h2>
          <p 
            className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto"
            data-testid="text-feature-subheading"
          >
            Smart, flexible, and built around your trade business workflow
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <FeatureCard key={feature.title} feature={feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
