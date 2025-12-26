import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";

type BillingPeriod = "monthly" | "annual";

interface PricingPlan {
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  perSeat?: { monthly: number; annual: number };
  description: string;
  features: string[];
  cta: string;
  ctaVariant: "outline" | "default";
  popular?: boolean;
  href?: string;
}

const plans: PricingPlan[] = [
  {
    name: "Free",
    monthlyPrice: 0,
    annualPrice: 0,
    description: "For solo tradies just starting out",
    features: [
      "Up to 3 active jobs",
      "Basic quotes & invoices",
      "Time tracking",
      "iOS & Android app",
      "Email support",
    ],
    cta: "Start Free",
    ctaVariant: "outline",
    href: "/auth?mode=signup",
  },
  {
    name: "Pro",
    monthlyPrice: 39,
    annualPrice: 31,
    description: "For growing trade businesses",
    features: [
      "Everything in Free",
      "Unlimited jobs",
      "Online payments (Stripe)",
      "Team management (up to 3)",
      "GST reporting",
      "Priority support",
    ],
    cta: "Start Free Trial",
    ctaVariant: "default",
    popular: true,
    href: "/auth?mode=signup",
  },
  {
    name: "Team",
    monthlyPrice: 59,
    annualPrice: 47,
    perSeat: { monthly: 29, annual: 23 },
    description: "For established teams",
    features: [
      "Everything in Pro",
      "Unlimited team members",
      "GPS tracking & geofencing",
      "Advanced reporting",
      "Custom branding",
      "Dedicated support",
    ],
    cta: "Contact Sales",
    ctaVariant: "outline",
  },
];

export default function PricingSection() {
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("monthly");

  return (
    <section id="pricing" className="py-20 lg:py-28 bg-gray-50">
      <div className="max-w-6xl mx-auto px-5 lg:px-8">
        <div className="text-center mb-12 lg:mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold tracking-tight mb-5"
          >
            Simple plans for serious work
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
            className="text-lg text-gray-600 max-w-2xl mx-auto mb-10"
          >
            Choose the plan that fits your business
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
            className="inline-flex items-center gap-3"
          >
            <div className="inline-flex bg-gray-100 rounded-full p-1">
              <button
                onClick={() => setBillingPeriod("monthly")}
                className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-200 ${
                  billingPeriod === "monthly"
                    ? "bg-black text-white shadow-sm"
                    : "bg-transparent text-gray-600 hover:text-gray-900"
                }`}
                data-testid="toggle-monthly-billing"
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingPeriod("annual")}
                className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-200 ${
                  billingPeriod === "annual"
                    ? "bg-black text-white shadow-sm"
                    : "bg-transparent text-gray-600 hover:text-gray-900"
                }`}
                data-testid="toggle-annual-billing"
              >
                Annual
              </button>
            </div>
            {billingPeriod === "annual" && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="inline-flex items-center bg-green-100 text-green-700 text-xs font-semibold px-3 py-1 rounded-full"
              >
                Save 20%
              </motion.span>
            )}
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1, ease: "easeOut" }}
              className={`relative bg-white rounded-2xl p-8 shadow-sm border ${
                plan.popular
                  ? "ring-2 ring-black border-transparent"
                  : "border-gray-100"
              }`}
              data-testid={`pricing-card-${plan.name.toLowerCase()}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center bg-black text-white text-xs font-semibold px-4 py-1.5 rounded-full">
                    Popular
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {plan.name}
                </h3>
                <p className="text-gray-600 text-sm">{plan.description}</p>
              </div>

              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  {billingPeriod === "annual" && plan.monthlyPrice > 0 && (
                    <span className="text-gray-400 line-through text-lg mr-1">
                      ${plan.monthlyPrice}
                    </span>
                  )}
                  <span className="text-4xl font-bold text-gray-900">
                    ${billingPeriod === "annual" ? plan.annualPrice : plan.monthlyPrice}
                  </span>
                  <span className="text-gray-600">/month</span>
                </div>
                {plan.perSeat && (
                  <p className="text-sm text-gray-500 mt-1">
                    + ${billingPeriod === "annual" ? plan.perSeat.annual : plan.perSeat.monthly}/seat
                  </p>
                )}
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700 text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              {plan.href ? (
                <Link href={plan.href}>
                  <Button
                    variant={plan.ctaVariant}
                    className={`w-full h-12 rounded-full font-semibold ${
                      plan.ctaVariant === "default"
                        ? "bg-black hover:bg-gray-800 text-white"
                        : "border-2 border-black text-black hover:bg-black hover:text-white"
                    }`}
                    data-testid={`button-${plan.name.toLowerCase()}-cta`}
                  >
                    {plan.cta}
                  </Button>
                </Link>
              ) : (
                <Button
                  variant={plan.ctaVariant}
                  className={`w-full h-12 rounded-full font-semibold ${
                    plan.ctaVariant === "default"
                      ? "bg-black hover:bg-gray-800 text-white"
                      : "border-2 border-black text-black hover:bg-black hover:text-white"
                  }`}
                  data-testid={`button-${plan.name.toLowerCase()}-cta`}
                >
                  {plan.cta}
                </Button>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
