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
  targetSelector?: string;
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
    icon: LayoutDashboard,
    targetSelector: '[data-testid="today-jobs-card"], [data-testid="dashboard-content"]'
  },
  {
    id: "clients",
    title: "Manage Clients",
    description: "Keep all your customer details in one place. Add new clients, view their job history, and quickly contact them.",
    route: "/clients",
    icon: Users,
    targetSelector: '[data-testid="clients-list"], [data-testid="clients-content"]'
  },
  {
    id: "jobs",
    title: "Track Your Jobs",
    description: "Create and manage all your work here. Jobs flow through stages from pending to completed, keeping you organised.",
    route: "/work",
    icon: Briefcase,
    targetSelector: '[data-testid="work-content"], [data-testid="jobs-list"]'
  },
  {
    id: "quotes",
    title: "Professional Quotes",
    description: "Create detailed quotes with line items and GST. Send them to clients and easily convert accepted quotes to invoices.",
    route: "/quotes",
    icon: FileText,
    targetSelector: '[data-testid="quotes-content"], [data-testid="quotes-list"]'
  },
  {
    id: "invoices",
    title: "Get Paid Faster",
    description: "Generate professional invoices and accept online payments. Connect Stripe to let clients pay by card instantly.",
    route: "/invoices",
    icon: Receipt,
    targetSelector: '[data-testid="invoices-content"], [data-testid="invoices-list"]'
  },
  {
    id: "settings",
    title: "Customise Your Business",
    description: "Set up your business details, upload your logo, and configure how TradieTrack works for you.",
    route: "/settings",
    icon: Settings,
    targetSelector: '[data-testid="settings-content"], [data-testid="settings-tabs"]'
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
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [, setLocation] = useLocation();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const step = TOUR_STEPS[currentStep];
  const isLastStep = currentStep === TOUR_STEPS.length - 1;
  const isFirstStep = currentStep === 0;
  const StepIcon = step.icon;

  // Find and measure target element
  const measureTarget = useCallback(() => {
    if (!step.targetSelector) {
      setTargetRect(null);
      return;
    }

    const selectors = step.targetSelector.split(', ');
    let element: Element | null = null;
    
    for (const selector of selectors) {
      element = document.querySelector(selector.trim());
      if (element) break;
    }

    if (element) {
      const rect = element.getBoundingClientRect();
      setTargetRect(rect);
    } else {
      setTargetRect(null);
    }
  }, [step.targetSelector]);

  // Draw the overlay with spotlight cutout
  const drawOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Light overlay - 35% opacity so app is clearly visible
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(0, 0, width, height);

    // Cut out spotlight if we have a target
    if (targetRect) {
      const padding = 8;
      const radius = 12;
      const x = targetRect.left - padding;
      const y = targetRect.top - padding;
      const w = targetRect.width + padding * 2;
      const h = targetRect.height + padding * 2;

      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, radius);
      ctx.fill();

      // Draw subtle border around spotlight
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = 'hsl(160, 84%, 39%)'; // Trade green
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, radius);
      ctx.stroke();
    }
  }, [targetRect]);

  // Navigate to step's route
  useEffect(() => {
    if (!isOpen) return;

    const navigateToStep = async () => {
      setIsNavigating(true);
      setTargetRect(null);
      
      const currentPath = window.location.pathname;
      const isRouteChange = step.route !== currentPath;
      
      if (isRouteChange) {
        setLocation(step.route);
        await new Promise(resolve => setTimeout(resolve, 400));
        window.scrollTo({ top: 0, behavior: 'instant' });
      }
      
      await new Promise(resolve => setTimeout(resolve, 300));
      measureTarget();
      setIsNavigating(false);
    };

    navigateToStep();
  }, [currentStep, isOpen, step.route, setLocation, measureTarget]);

  // Redraw overlay when target changes
  useEffect(() => {
    if (isOpen) {
      drawOverlay();
    }
  }, [isOpen, targetRect, drawOverlay]);

  // Handle window resize
  useEffect(() => {
    if (!isOpen) return;
    
    const handleResize = () => {
      measureTarget();
      drawOverlay();
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen, measureTarget, drawOverlay]);

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

  // Position tooltip - bottom of screen on mobile for visibility
  const getTooltipStyle = (): React.CSSProperties => {
    const isMobile = window.innerWidth < 640;
    
    if (isMobile) {
      return {
        position: 'fixed',
        bottom: '16px',
        left: '16px',
        right: '16px',
        maxWidth: 'none'
      };
    }
    
    // Desktop: position near bottom-right but not covering too much
    return {
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      width: '380px',
      maxWidth: 'calc(100vw - 48px)'
    };
  };

  return (
    <div 
      className="fixed inset-0 z-[9999]"
      data-testid="guided-tour-overlay"
    >
      {/* Canvas overlay - light dimming so app is visible */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ width: '100%', height: '100%' }}
      />

      {/* Tour Card */}
      <Card
        className="shadow-xl border-2 overflow-hidden"
        style={{
          ...getTooltipStyle(),
          borderColor: 'hsl(var(--trade))',
          zIndex: 10000
        }}
        data-testid="tour-tooltip"
      >
        {/* Header */}
        <div className="px-4 py-3 border-b bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div 
                className="p-2 rounded-lg"
                style={{ backgroundColor: 'hsl(var(--trade) / 0.15)' }}
              >
                <StepIcon className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">
                  Step {currentStep + 1} of {TOUR_STEPS.length}
                </p>
                <h3 className="font-semibold text-sm">{step.title}</h3>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon"
              className="h-8 w-8"
              onClick={handleSkip}
              data-testid="button-close-tour"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 py-3">
          <p className="text-muted-foreground text-sm leading-relaxed mb-4">
            {step.description}
          </p>

          {/* Step dots */}
          <div className="flex items-center justify-center gap-1.5 mb-4">
            {TOUR_STEPS.map((_, index) => (
              <div
                key={index}
                className={`h-1.5 rounded-full transition-all duration-200 ${
                  index === currentStep
                    ? "w-4 bg-primary"
                    : index < currentStep
                    ? "w-1.5 bg-primary/50"
                    : "w-1.5 bg-muted-foreground/30"
                }`}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
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
                  className="text-muted-foreground text-xs"
                >
                  Skip
                </Button>
              )}
              
              <Button
                size="sm"
                onClick={handleNext}
                disabled={isNavigating}
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
