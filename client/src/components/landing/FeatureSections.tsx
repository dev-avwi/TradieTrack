import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import jobsListScreenshot from "@assets/appstore_screenshots/02_jobs_list.png";
import quotePreviewScreenshot from "@assets/appstore_screenshots/07_quote_preview.png";

interface FeatureSectionProps {
  category: string;
  heading: string;
  description: string;
  pills: string[];
  imageSrc: string;
  imageAlt: string;
  imageOnRight: boolean;
  gradientColor: "purple" | "blue";
}

function FeatureSection({
  category,
  heading,
  description,
  pills,
  imageSrc,
  imageAlt,
  imageOnRight,
  gradientColor,
}: FeatureSectionProps) {
  const [activePill, setActivePill] = useState(0);

  const gradientStyles = {
    purple: "from-purple-400/30 via-purple-500/20 to-transparent",
    blue: "from-blue-400/30 via-blue-500/20 to-transparent",
  };

  const contentBlock = (
    <motion.div
      initial={{ opacity: 0, x: imageOnRight ? -30 : 30 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="flex flex-col justify-center"
    >
      <span
        className="inline-block text-xs font-semibold tracking-wider uppercase text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full w-fit mb-6"
        data-testid={`badge-${category.replace(/\s+/g, "-")}`}
      >
        {category}
      </span>

      <h2
        className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight mb-4"
        style={{ fontFamily: "Inter, sans-serif" }}
      >
        {heading}
      </h2>

      <p className="text-lg text-gray-600 leading-relaxed mb-8 max-w-md">
        {description}
      </p>

      <div className="flex flex-wrap gap-2 mb-8">
        {pills.map((pill, index) => (
          <button
            key={pill}
            onClick={() => setActivePill(index)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              activePill === index
                ? "bg-black text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
            data-testid={`pill-${pill.toLowerCase().replace(/\s+/g, "-")}`}
          >
            {pill}
          </button>
        ))}
      </div>

      <Link href="/auth?mode=signup">
        <span
          className="inline-flex items-center text-black font-semibold hover:underline cursor-pointer group"
          data-testid={`link-start-trial-${category.replace(/\s+/g, "-")}`}
        >
          Start Free Trial
          <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
        </span>
      </Link>
    </motion.div>
  );

  const imageBlock = (
    <motion.div
      initial={{ opacity: 0, x: imageOnRight ? 30 : -30 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
      className="relative"
    >
      <div
        className={`absolute inset-0 bg-gradient-radial ${gradientStyles[gradientColor]} blur-3xl scale-110 -z-10`}
        style={{
          background: `radial-gradient(ellipse at center, ${
            gradientColor === "purple"
              ? "rgba(147, 51, 234, 0.25)"
              : "rgba(59, 130, 246, 0.25)"
          } 0%, transparent 70%)`,
        }}
      />
      <div
        className="rounded-2xl overflow-hidden shadow-2xl"
        style={{
          boxShadow:
            "0 25px 50px -12px rgba(0, 0, 0, 0.15), 0 12px 24px -8px rgba(0, 0, 0, 0.1)",
        }}
      >
        <img
          src={imageSrc}
          alt={imageAlt}
          className="w-full h-auto"
          data-testid={`img-${imageAlt.toLowerCase().replace(/\s+/g, "-")}`}
        />
      </div>
    </motion.div>
  );

  return (
    <section className="py-20 px-5 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div
          className={`grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center ${
            !imageOnRight ? "lg:[&>*:first-child]:order-2" : ""
          }`}
        >
          {imageOnRight ? (
            <>
              {contentBlock}
              {imageBlock}
            </>
          ) : (
            <>
              {imageBlock}
              {contentBlock}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

export default function FeatureSections() {
  return (
    <div id="features">
      <FeatureSection
        category="job management"
        heading="Keep every job moving forward"
        description="Plan, schedule, and complete your work - all in one place. With smart job tracking, deadlines, and real-time progress, you stay organized and clients stay happy."
        pills={["Jobs", "Scheduling", "Time Tracking", "Reports"]}
        imageSrc={jobsListScreenshot}
        imageAlt="Jobs List"
        imageOnRight={true}
        gradientColor="purple"
      />

      <FeatureSection
        category="financial management"
        heading="Track income, get paid, stress less"
        description="Create professional quotes and invoices, log expenses, and keep tabs on your earnings. Whether you bill per job or hourly, everything's automated and GST-ready."
        pills={["Quotes", "Invoices", "Payments", "GST Reports"]}
        imageSrc={quotePreviewScreenshot}
        imageAlt="Quote Preview"
        imageOnRight={false}
        gradientColor="blue"
      />
    </div>
  );
}
