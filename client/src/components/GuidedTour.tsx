import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLocation } from "wouter";
import {
  X,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  LayoutDashboard,
  Briefcase,
  Users,
  FileText,
  Receipt,
  Settings,
  CheckCircle2
} from "lucide-react";

interface TourStep {
  id: string;
  title: string;
  description: string;
  route: string;
  icon: any;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to TradieTrack!",
    description: "Let's take a quick tour to show you around. We'll walk you through the key features to help you manage your trade business.",
    route: "/",
    icon: Sparkles
  },
  {
    id: "dashboard",
    title: "Your Dashboard",
    description: "This is your home base. See today's scheduled jobs, track your earnings, and get quick access to everything you need.",
    route: "/",
    icon: LayoutDashboard
  },
  {
    id: "clients",
    title: "Manage Clients",
    description: "Keep all your customer details in one place. Add new clients, view their job history, and quickly contact them.",
    route: "/clients",
    icon: Users
  },
  {
    id: "jobs",
    title: "Track Your Jobs",
    description: "Create and manage all your work here. Jobs flow through stages from pending to completed, keeping you organised.",
    route: "/work",
    icon: Briefcase
  },
  {
    id: "quotes",
    title: "Professional Quotes",
    description: "Create detailed quotes with line items and GST. Send them to clients and easily convert accepted quotes to invoices.",
    route: "/quotes",
    icon: FileText
  },
  {
    id: "invoices",
    title: "Get Paid Faster",
    description: "Generate professional invoices and accept online payments. Connect Stripe to let clients pay by card instantly.",
    route: "/invoices",
    icon: Receipt
  },
  {
    id: "settings",
    title: "Customise Your Business",
    description: "Set up your business details, upload your logo, and configure how TradieTrack works for you.",
    route: "/settings",
    icon: Settings
  },
  {
    id: "complete",
    title: "You're Ready!",
    description: "That's the basics covered. Start by adding your first client, then create a job. You can restart this tour anytime from Settings.",
    route: "/",
    icon: CheckCircle2
  }
];

interface GuidedTourProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export default function GuidedTour({ isOpen, onClose, onComplete }: GuidedTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const [, setLocation] = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);

  const step = TOUR_STEPS[currentStep];
  const isLastStep = currentStep === TOUR_STEPS.length - 1;
  const isFirstStep = currentStep === 0;
  const StepIcon = step.icon;

  // Navigate to the step's route
  useEffect(() => {
    if (!isOpen) return;

    const navigateToStep = async () => {
      setIsNavigating(true);
      
      const currentPath = window.location.pathname;
      const isRouteChange = step.route !== currentPath;
      
      if (isRouteChange) {
        setLocation(step.route);
        await new Promise(resolve => setTimeout(resolve, 400));
        window.scrollTo({ top: 0, behavior: 'instant' });
      }
      
      await new Promise(resolve => setTimeout(resolve, 200));
      setIsNavigating(false);
    };

    navigateToStep();
  }, [currentStep, isOpen, step.route, setLocation]);

  // Reset step when tour opens
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
    }
  }, [isOpen]);

  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (!isFirstStep) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem("tradietrack-tour-completed", "true");
    localStorage.setItem("tradietrack-tour-completed-date", new Date().toISOString());
    onComplete();
  };

  const handleSkip = () => {
    localStorage.setItem("tradietrack-tour-skipped", "true");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center"
      data-testid="guided-tour-overlay"
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleSkip}
      />

      {/* Tour Card - Bottom sheet on mobile, centered on desktop */}
      <Card
        className="relative w-full sm:w-[420px] sm:max-w-[90vw] mx-0 sm:mx-4 rounded-t-2xl sm:rounded-2xl border-0 sm:border shadow-2xl overflow-hidden"
        style={{ maxHeight: '85vh' }}
        data-testid="tour-tooltip"
      >
        {/* Header with gradient */}
        <div 
          className="px-6 pt-6 pb-4"
          style={{ 
            background: 'linear-gradient(135deg, hsl(var(--trade)) 0%, hsl(var(--trade) / 0.8) 100%)'
          }}
        >
          {/* Close button */}
          <Button 
            variant="ghost" 
            size="icon"
            className="absolute top-3 right-3 h-8 w-8 text-white/80 hover:text-white hover:bg-white/20"
            onClick={handleSkip}
            data-testid="button-close-tour"
          >
            <X className="h-4 w-4" />
          </Button>

          {/* Step indicator */}
          <div className="flex items-center gap-1.5 mb-4">
            {TOUR_STEPS.map((_, index) => (
              <div
                key={index}
                className={`h-1 rounded-full transition-all duration-300 ${
                  index === currentStep
                    ? "w-6 bg-white"
                    : index < currentStep
                    ? "w-2 bg-white/60"
                    : "w-2 bg-white/30"
                }`}
              />
            ))}
          </div>

          {/* Icon and title */}
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-white/20 backdrop-blur-sm">
              <StepIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-white/70 text-xs font-medium mb-0.5">
                Step {currentStep + 1} of {TOUR_STEPS.length}
              </p>
              <h3 className="text-white font-semibold text-lg">{step.title}</h3>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5 bg-card">
          <p className="text-muted-foreground text-sm leading-relaxed mb-6">
            {step.description}
          </p>

          {/* Navigation */}
          <div className="flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrevious}
              disabled={isFirstStep || isNavigating}
              className="text-muted-foreground"
              data-testid="button-tour-previous"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>

            <div className="flex gap-2">
              {!isLastStep && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSkip}
                  className="text-muted-foreground"
                >
                  Skip tour
                </Button>
              )}
              
              <Button
                size="sm"
                onClick={handleNext}
                disabled={isNavigating}
                className="min-w-[100px]"
                style={{ 
                  backgroundColor: 'hsl(var(--trade))',
                  color: 'white'
                }}
                data-testid="button-tour-next"
              >
                {isNavigating ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : isLastStep ? (
                  <>
                    Get Started
                    <Sparkles className="h-4 w-4 ml-1.5" />
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile handle indicator */}
        <div className="sm:hidden absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/30" />
      </Card>
    </div>
  );
}

export function useGuidedTour() {
  const [showTour, setShowTour] = useState(false);

  const hasCompleted = useCallback(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem("tradietrack-tour-completed") === "true" ||
           localStorage.getItem("tradietrack-tour-skipped") === "true";
  }, []);

  const startTour = useCallback(() => {
    setShowTour(true);
  }, []);

  const closeTour = useCallback(() => {
    setShowTour(false);
  }, []);

  const completeTour = useCallback(() => {
    setShowTour(false);
  }, []);

  const resetTour = useCallback(() => {
    localStorage.removeItem("tradietrack-tour-completed");
    localStorage.removeItem("tradietrack-tour-completed-date");
    localStorage.removeItem("tradietrack-tour-skipped");
  }, []);

  return {
    showTour,
    hasCompleted,
    startTour,
    closeTour,
    completeTour,
    resetTour
  };
}

export function TourTriggerButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      className="gap-2"
      data-testid="button-start-tour"
    >
      <Sparkles className="h-4 w-4" />
      Start App Tour
    </Button>
  );
}
