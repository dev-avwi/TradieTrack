import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  Plus,
  MousePointerClick
} from "lucide-react";

interface TourStep {
  id: string;
  title: string;
  description: string;
  route: string;
  targetSelector?: string;
  icon: any;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action?: 'click' | 'observe';
  highlightArea?: boolean;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to TradieTrack!",
    description: "Let's take a quick tour to help you get started. We'll show you the key features of your new job management system.",
    route: "/",
    icon: Sparkles,
    position: 'center'
  },
  {
    id: "dashboard",
    title: "Your Dashboard",
    description: "This is your home base. See today's jobs, key metrics, and recent activity at a glance. The dashboard gives you a snapshot of your business.",
    route: "/",
    targetSelector: '[data-testid="dashboard-kpis"], [data-testid="today-jobs-card"]',
    icon: LayoutDashboard,
    position: 'bottom',
    highlightArea: true
  },
  {
    id: "sidebar",
    title: "Navigation Sidebar",
    description: "Use the sidebar to navigate between different sections. On mobile, tap the menu icon in the top-left to open it.",
    route: "/",
    targetSelector: '[data-testid="sidebar"], [data-testid="button-sidebar-toggle"]',
    icon: LayoutDashboard,
    position: 'right'
  },
  {
    id: "clients",
    title: "Manage Your Clients",
    description: "Add and manage your customers here. Each client can have multiple jobs, quotes, and invoices linked to them.",
    route: "/clients",
    targetSelector: '[data-testid="clients-list"], [data-testid="button-add-client"]',
    icon: Users,
    position: 'bottom',
    highlightArea: true
  },
  {
    id: "clients-add",
    title: "Add New Clients",
    description: "Click the '+ New Client' button to add customers. You can also Quick Add clients when creating jobs.",
    route: "/clients",
    targetSelector: '[data-testid="button-add-client"], [data-testid="button-new-client"]',
    icon: Plus,
    position: 'left',
    action: 'observe'
  },
  {
    id: "jobs",
    title: "Your Work Hub",
    description: "All your jobs live here. Create new jobs, track their progress, and manage your workload. Jobs flow through stages: Pending → Scheduled → In Progress → Done → Invoiced.",
    route: "/jobs",
    targetSelector: '[data-testid="jobs-list"], [data-testid="work-content"]',
    icon: Briefcase,
    position: 'bottom',
    highlightArea: true
  },
  {
    id: "jobs-create",
    title: "Create New Jobs",
    description: "Use this button to create a new job. Link it to a client, add a description, set the address, and schedule it.",
    route: "/jobs",
    targetSelector: '[data-testid="button-new-job"], [data-testid="button-add-job"]',
    icon: Plus,
    position: 'left',
    action: 'observe'
  },
  {
    id: "quotes",
    title: "Professional Quotes",
    description: "Create detailed quotes with line items and automatic GST calculation. Send them to clients and convert accepted quotes to invoices.",
    route: "/quotes",
    targetSelector: '[data-testid="quotes-list"], [data-testid="quotes-content"]',
    icon: FileText,
    position: 'bottom',
    highlightArea: true
  },
  {
    id: "invoices",
    title: "Invoicing & Payments",
    description: "Generate professional invoices and get paid online. Connect Stripe to accept card payments directly.",
    route: "/invoices",
    targetSelector: '[data-testid="invoices-list"], [data-testid="invoices-content"]',
    icon: Receipt,
    position: 'bottom',
    highlightArea: true
  },
  {
    id: "settings",
    title: "Customise Your Business",
    description: "Set up your business details, add your logo, connect payment providers, and configure email settings. Make TradieTrack work the way you want.",
    route: "/settings",
    targetSelector: '[data-testid="settings"], [data-testid="settings-tabs"]',
    icon: Settings,
    position: 'bottom',
    highlightArea: true
  },
  {
    id: "complete",
    title: "You're All Set!",
    description: "That's the basics! Start by adding your first client, then create a job. You can restart this tour anytime from Settings → Support.",
    route: "/",
    icon: Sparkles,
    position: 'center'
  }
];

interface GuidedTourProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export default function GuidedTour({ isOpen, onClose, onComplete }: GuidedTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [, setLocation] = useLocation();
  const overlayRef = useRef<HTMLDivElement>(null);

  const step = TOUR_STEPS[currentStep];
  const progress = ((currentStep + 1) / TOUR_STEPS.length) * 100;
  const isLastStep = currentStep === TOUR_STEPS.length - 1;
  const isFirstStep = currentStep === 0;
  const StepIcon = step.icon;

  const findAndHighlightTarget = useCallback(() => {
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
      
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      setTargetRect(null);
    }
  }, [step.targetSelector]);

  useEffect(() => {
    if (!isOpen) return;

    const navigateAndHighlight = async () => {
      setIsNavigating(true);
      
      const currentPath = window.location.pathname;
      const isRouteChange = step.route !== currentPath;
      
      if (isRouteChange) {
        setLocation(step.route);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Scroll to top of page after route change
        window.scrollTo({ top: 0, behavior: 'instant' });
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      await new Promise(resolve => setTimeout(resolve, 300));
      findAndHighlightTarget();
      setIsNavigating(false);
    };

    navigateAndHighlight();
  }, [currentStep, isOpen, step.route, setLocation, findAndHighlightTarget]);

  useEffect(() => {
    if (!isOpen) return;
    
    const handleResize = () => findAndHighlightTarget();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen, findAndHighlightTarget]);

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

  const getTooltipPosition = () => {
    if (!targetRect || step.position === 'center') {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)'
      };
    }

    const padding = 20;
    const tooltipWidth = 380;
    const tooltipHeight = 280;
    
    switch (step.position) {
      case 'top':
        return {
          top: `${Math.max(padding, targetRect.top - tooltipHeight - padding)}px`,
          left: `${Math.min(window.innerWidth - tooltipWidth - padding, Math.max(padding, targetRect.left + targetRect.width / 2 - tooltipWidth / 2))}px`,
        };
      case 'bottom':
        return {
          top: `${Math.min(window.innerHeight - tooltipHeight - padding, targetRect.bottom + padding)}px`,
          left: `${Math.min(window.innerWidth - tooltipWidth - padding, Math.max(padding, targetRect.left + targetRect.width / 2 - tooltipWidth / 2))}px`,
        };
      case 'left':
        return {
          top: `${Math.min(window.innerHeight - tooltipHeight - padding, Math.max(padding, targetRect.top + targetRect.height / 2 - tooltipHeight / 2))}px`,
          left: `${Math.max(padding, targetRect.left - tooltipWidth - padding)}px`,
        };
      case 'right':
        return {
          top: `${Math.min(window.innerHeight - tooltipHeight - padding, Math.max(padding, targetRect.top + targetRect.height / 2 - tooltipHeight / 2))}px`,
          left: `${Math.min(window.innerWidth - tooltipWidth - padding, targetRect.right + padding)}px`,
        };
      default:
        return {
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)'
        };
    }
  };

  return (
    <div 
      ref={overlayRef}
      className="fixed inset-0 z-[9999]"
      data-testid="guided-tour-overlay"
    >
      {/* Consistent dark overlay - always the same opacity */}
      <div 
        className="absolute inset-0 bg-black/80 transition-opacity duration-300"
        style={{ pointerEvents: 'none' }}
      />

      {/* Spotlight cutout - only when there's a target */}
      {targetRect && (
        <>
          {/* Top overlay */}
          <div 
            className="absolute left-0 right-0 top-0 bg-black/80"
            style={{ height: Math.max(0, targetRect.top - 12), pointerEvents: 'none' }}
          />
          {/* Bottom overlay */}
          <div 
            className="absolute left-0 right-0 bg-black/80"
            style={{ 
              top: targetRect.bottom + 12, 
              height: Math.max(0, window.innerHeight - targetRect.bottom - 12),
              pointerEvents: 'none'
            }}
          />
          {/* Left overlay */}
          <div 
            className="absolute bg-black/80"
            style={{ 
              top: targetRect.top - 12,
              left: 0,
              width: Math.max(0, targetRect.left - 12),
              height: targetRect.height + 24,
              pointerEvents: 'none'
            }}
          />
          {/* Right overlay */}
          <div 
            className="absolute bg-black/80"
            style={{ 
              top: targetRect.top - 12,
              left: targetRect.right + 12,
              width: Math.max(0, window.innerWidth - targetRect.right - 12),
              height: targetRect.height + 24,
              pointerEvents: 'none'
            }}
          />
          {/* Spotlight border with glow */}
          <div
            className="absolute pointer-events-none rounded-lg border-2 transition-all duration-300"
            style={{
              top: targetRect.top - 12,
              left: targetRect.left - 12,
              width: targetRect.width + 24,
              height: targetRect.height + 24,
              borderColor: 'hsl(var(--trade))',
              boxShadow: '0 0 0 4px hsl(var(--trade) / 0.3), 0 0 30px hsl(var(--trade) / 0.5), inset 0 0 20px hsl(var(--trade) / 0.1)'
            }}
            data-testid="tour-spotlight"
          />
        </>
      )}

      {/* Tooltip card */}
      <Card
        className="absolute w-[380px] max-w-[calc(100vw-32px)] p-5 shadow-2xl border-2"
        style={{
          ...getTooltipPosition(),
          borderColor: 'hsl(var(--trade))',
          zIndex: 10000
        }}
        data-testid="tour-tooltip"
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div 
              className="p-2.5 rounded-xl"
              style={{ backgroundColor: 'hsl(var(--trade) / 0.15)' }}
            >
              <StepIcon className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
            </div>
            <div>
              <Badge 
                variant="secondary" 
                className="mb-1 text-xs"
                data-testid="tour-step-badge"
              >
                Step {currentStep + 1} of {TOUR_STEPS.length}
              </Badge>
              <h3 className="font-semibold text-base">{step.title}</h3>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            className="h-8 w-8 -mt-1 -mr-1"
            onClick={handleSkip}
            data-testid="button-close-tour"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
          {step.description}
        </p>

        {/* Action hint */}
        {step.action === 'observe' && targetRect && (
          <div className="flex items-center gap-2 text-xs text-primary mb-4 bg-primary/10 p-2 rounded-lg">
            <MousePointerClick className="h-4 w-4" />
            <span>Look at the highlighted element above</span>
          </div>
        )}

        {/* Progress bar */}
        <Progress value={progress} className="h-1.5 mb-4" data-testid="tour-progress" />

        {/* Navigation buttons */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePrevious}
            disabled={isFirstStep || isNavigating}
            data-testid="button-tour-previous"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>

          <div className="flex items-center gap-1.5">
            {TOUR_STEPS.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentStep(index)}
                disabled={isNavigating}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentStep
                    ? "bg-primary w-4"
                    : index < currentStep
                    ? "bg-primary/50"
                    : "bg-muted-foreground/30"
                }`}
                data-testid={`tour-dot-${index}`}
              />
            ))}
          </div>

          <Button
            size="sm"
            onClick={handleNext}
            disabled={isNavigating}
            style={{ backgroundColor: 'hsl(var(--trade))' }}
            data-testid="button-tour-next"
          >
            {isNavigating ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : isLastStep ? (
              <>
                <Sparkles className="h-4 w-4 mr-1" />
                Done
              </>
            ) : (
              <>
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </>
            )}
          </Button>
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
