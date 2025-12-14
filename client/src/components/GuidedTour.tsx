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
  CheckCircle2,
  MousePointerClick,
  Plus,
  Edit,
  Eye,
  Send
} from "lucide-react";

interface TourStep {
  id: string;
  title: string;
  description: string;
  route: string;
  icon: any;
  targetSelector?: string;
  // Interactive step properties
  waitForClick?: boolean;
  clickTargetSelector?: string;
  clickTargetLabel?: string;
  // For sub-steps within a workflow
  subStep?: number;
  totalSubSteps?: number;
}

const TOUR_STEPS: TourStep[] = [
  // Welcome
  {
    id: "welcome",
    title: "Welcome to TradieTrack!",
    description: "Let's learn by doing! This tour will guide you through actually using the app. You'll click buttons and see how things work firsthand.",
    route: "/",
    icon: Sparkles
  },
  
  // Dashboard Overview
  {
    id: "dashboard-overview",
    title: "Your Dashboard",
    description: "This is your home base. You can see today's scheduled jobs, track earnings, and quickly access everything you need.",
    route: "/",
    icon: LayoutDashboard,
    targetSelector: '[data-testid="dashboard-content"], .dashboard-container, main'
  },
  
  // Clients Section - Interactive
  {
    id: "clients-intro",
    title: "Let's Add a Client",
    description: "First, let's go to the Clients page. Click the Clients button in the menu to continue.",
    route: "/clients",
    icon: Users,
    waitForClick: true,
    clickTargetSelector: '[data-testid="nav-clients"], a[href="/clients"], [href="/clients"]',
    clickTargetLabel: "Clients menu item"
  },
  {
    id: "clients-page",
    title: "Your Client List",
    description: "This is where all your customers live. You can search, filter, and manage everyone you work for.",
    route: "/clients",
    icon: Users,
    targetSelector: '[data-testid="clients-content"], [data-testid="clients-list"]'
  },
  {
    id: "clients-add-button",
    title: "Adding New Clients",
    description: "To add a new client, you'd click the '+ New Client' button. This opens a form where you enter their name, phone, email, and address.",
    route: "/clients",
    icon: Plus,
    targetSelector: '[data-testid="button-new-client"], [data-testid="add-client-button"], button:has-text("New Client")',
    waitForClick: true,
    clickTargetSelector: '[data-testid="button-new-client"], [data-testid="add-client-button"]',
    clickTargetLabel: "+ New Client button"
  },
  
  // Jobs Section - Interactive
  {
    id: "jobs-intro",
    title: "Now Let's Look at Jobs",
    description: "Jobs are the heart of your business. Click the Work button to see how job management works.",
    route: "/work",
    icon: Briefcase,
    waitForClick: true,
    clickTargetSelector: '[data-testid="nav-work"], a[href="/work"], [href="/work"]',
    clickTargetLabel: "Work menu item"
  },
  {
    id: "jobs-page",
    title: "Your Job Board",
    description: "Here you can see all your jobs organised by status. Jobs flow from Pending → Scheduled → In Progress → Done → Invoiced.",
    route: "/work",
    icon: Briefcase,
    targetSelector: '[data-testid="work-content"], [data-testid="jobs-list"]'
  },
  {
    id: "jobs-status-flow",
    title: "Job Status Workflow",
    description: "Each job card shows its current status. You can tap a job to update its progress, add photos, or mark it complete.",
    route: "/work",
    icon: Edit,
    targetSelector: '[data-testid="job-card"], .job-card, [data-testid="jobs-list"] > div:first-child'
  },
  
  // Quotes Section - Interactive Workflow
  {
    id: "quotes-intro",
    title: "Creating Professional Quotes",
    description: "Now let's see how to create quotes. Click Quotes to continue.",
    route: "/quotes",
    icon: FileText,
    waitForClick: true,
    clickTargetSelector: '[data-testid="nav-quotes"], a[href="/quotes"], [href="/quotes"]',
    clickTargetLabel: "Quotes menu item"
  },
  {
    id: "quotes-page",
    title: "Your Quotes List",
    description: "All your quotes are listed here with their status - Draft, Sent, Accepted, or Declined. You can filter and search to find any quote.",
    route: "/quotes",
    icon: FileText,
    targetSelector: '[data-testid="quotes-content"], [data-testid="quotes-list"]'
  },
  {
    id: "quotes-new-button",
    title: "Creating a New Quote",
    description: "To create a quote, click the '+ New Quote' button. This opens the live quote editor where you can add line items and see a preview.",
    route: "/quotes",
    icon: Plus,
    targetSelector: '[data-testid="button-new-quote"], [data-testid="create-quote-button"]',
    waitForClick: true,
    clickTargetSelector: '[data-testid="button-new-quote"], [data-testid="create-quote-button"]',
    clickTargetLabel: "+ New Quote button",
    subStep: 1,
    totalSubSteps: 3
  },
  {
    id: "quotes-editor-overview",
    title: "The Live Quote Editor",
    description: "This is where the magic happens! On the left, add your line items. On the right, see the quote preview update in real-time.",
    route: "/quotes/new",
    icon: Edit,
    targetSelector: '[data-testid="quote-editor"], .quote-editor, [data-testid="live-quote-editor"]',
    subStep: 2,
    totalSubSteps: 3
  },
  {
    id: "quotes-line-items",
    title: "Adding Line Items",
    description: "Click 'Add Line Item' to add services or materials. Enter a description, quantity, and price. GST is calculated automatically!",
    route: "/quotes/new",
    icon: Plus,
    targetSelector: '[data-testid="add-line-item"], [data-testid="button-add-item"]',
    subStep: 3,
    totalSubSteps: 3
  },
  
  // Invoices Section
  {
    id: "invoices-intro",
    title: "Getting Paid with Invoices",
    description: "Time to look at invoices! Click Invoices to see how you get paid.",
    route: "/invoices",
    icon: Receipt,
    waitForClick: true,
    clickTargetSelector: '[data-testid="nav-invoices"], a[href="/invoices"], [href="/invoices"]',
    clickTargetLabel: "Invoices menu item"
  },
  {
    id: "invoices-page",
    title: "Your Invoice Dashboard",
    description: "Track all your invoices here. See what's pending, overdue, or paid. The totals at the top show your financial snapshot.",
    route: "/invoices",
    icon: Receipt,
    targetSelector: '[data-testid="invoices-content"], [data-testid="invoices-list"]'
  },
  {
    id: "invoices-create",
    title: "Creating Invoices",
    description: "You can create invoices from scratch OR convert an accepted quote directly into an invoice - saving you time!",
    route: "/invoices",
    icon: FileText,
    targetSelector: '[data-testid="button-new-invoice"], [data-testid="create-invoice-button"]'
  },
  {
    id: "invoices-payments",
    title: "Accepting Payments",
    description: "Connect Stripe in Settings to accept card payments. Your clients can pay online directly from the invoice email!",
    route: "/invoices",
    icon: Receipt,
    targetSelector: '[data-testid="invoices-content"]'
  },
  
  // Settings
  {
    id: "settings-intro",
    title: "Customising Your Business",
    description: "Finally, let's check Settings. Click Settings to see your business configuration.",
    route: "/settings",
    icon: Settings,
    waitForClick: true,
    clickTargetSelector: '[data-testid="nav-settings"], a[href="/settings"], [href="/settings"]',
    clickTargetLabel: "Settings menu item"
  },
  {
    id: "settings-page",
    title: "Your Settings Hub",
    description: "Here you can update your business details, upload your logo, set up email templates, and connect payment processing.",
    route: "/settings",
    icon: Settings,
    targetSelector: '[data-testid="settings-content"], [data-testid="settings-tabs"]'
  },
  {
    id: "settings-branding",
    title: "Branding Your Business",
    description: "Add your logo and choose brand colours. These appear on all your quotes and invoices for a professional look.",
    route: "/settings",
    icon: Eye,
    targetSelector: '[data-testid="branding-tab"], [value="branding"]'
  },
  
  // Completion
  {
    id: "complete",
    title: "You're All Set!",
    description: "Brilliant! You've learned the basics. Start by adding your first client, create a job, then send a quote. You can restart this tour anytime from Settings → Support.",
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
  const [clickTargetRect, setClickTargetRect] = useState<DOMRect | null>(null);
  const [waitingForClick, setWaitingForClick] = useState(false);
  const [, setLocation] = useLocation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const clickListenerRef = useRef<(() => void) | null>(null);

  const step = TOUR_STEPS[currentStep];
  const isLastStep = currentStep === TOUR_STEPS.length - 1;
  const isFirstStep = currentStep === 0;
  const StepIcon = step.icon;

  // Find and measure target element
  const measureTarget = useCallback(() => {
    if (!step.targetSelector) {
      setTargetRect(null);
    } else {
      const selectors = step.targetSelector.split(', ');
      let element: Element | null = null;
      
      for (const selector of selectors) {
        try {
          element = document.querySelector(selector.trim());
          if (element) break;
        } catch (e) {
          // Invalid selector, skip
        }
      }

      if (element) {
        const rect = element.getBoundingClientRect();
        setTargetRect(rect);
      } else {
        setTargetRect(null);
      }
    }

    // Measure click target separately if it's an interactive step
    if (step.waitForClick && step.clickTargetSelector) {
      const clickSelectors = step.clickTargetSelector.split(', ');
      let clickElement: Element | null = null;
      
      for (const selector of clickSelectors) {
        try {
          clickElement = document.querySelector(selector.trim());
          if (clickElement) break;
        } catch (e) {
          // Invalid selector, skip
        }
      }

      if (clickElement) {
        const rect = clickElement.getBoundingClientRect();
        setClickTargetRect(rect);
        setWaitingForClick(true);
      } else {
        setClickTargetRect(null);
        setWaitingForClick(false);
      }
    } else {
      setClickTargetRect(null);
      setWaitingForClick(false);
    }
  }, [step.targetSelector, step.waitForClick, step.clickTargetSelector]);

  // Set up click listener for interactive steps
  useEffect(() => {
    if (!isOpen || !step.waitForClick || !step.clickTargetSelector) {
      return;
    }

    const setupClickListener = () => {
      const clickSelectors = step.clickTargetSelector!.split(', ');
      let clickElement: Element | null = null;
      
      for (const selector of clickSelectors) {
        try {
          clickElement = document.querySelector(selector.trim());
          if (clickElement) break;
        } catch (e) {
          // Invalid selector, skip
        }
      }

      if (clickElement) {
        const handleClick = () => {
          // User clicked the target - advance to next step
          setTimeout(() => {
            setCurrentStep(prev => prev + 1);
          }, 300); // Small delay so they see the click effect
        };

        clickElement.addEventListener('click', handleClick);
        clickListenerRef.current = () => {
          clickElement?.removeEventListener('click', handleClick);
        };
      }
    };

    // Wait for DOM to settle
    const timeout = setTimeout(setupClickListener, 500);

    return () => {
      clearTimeout(timeout);
      if (clickListenerRef.current) {
        clickListenerRef.current();
        clickListenerRef.current = null;
      }
    };
  }, [isOpen, currentStep, step.waitForClick, step.clickTargetSelector]);

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

    // Cut out spotlight for target area
    const spotlightRect = clickTargetRect || targetRect;
    if (spotlightRect) {
      const padding = 12;
      const radius = 12;
      const x = spotlightRect.left - padding;
      const y = spotlightRect.top - padding;
      const w = spotlightRect.width + padding * 2;
      const h = spotlightRect.height + padding * 2;

      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, radius);
      ctx.fill();

      // Draw border around spotlight - green for interactive, blue for info
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = waitingForClick ? 'hsl(160, 84%, 39%)' : 'hsl(210, 80%, 50%)';
      ctx.lineWidth = waitingForClick ? 3 : 2;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, radius);
      ctx.stroke();
    }
  }, [targetRect, clickTargetRect, waitingForClick]);

  // Navigate to step's route
  useEffect(() => {
    if (!isOpen) return;

    const navigateToStep = async () => {
      setIsNavigating(true);
      setTargetRect(null);
      setClickTargetRect(null);
      
      const currentPath = window.location.pathname;
      const isRouteChange = step.route !== currentPath;
      
      if (isRouteChange) {
        setLocation(step.route);
        await new Promise(resolve => setTimeout(resolve, 500));
        window.scrollTo({ top: 0, behavior: 'instant' });
      }
      
      await new Promise(resolve => setTimeout(resolve, 400));
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
  }, [isOpen, targetRect, clickTargetRect, waitingForClick, drawOverlay]);

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

  // Periodically re-measure targets (for dynamic content)
  useEffect(() => {
    if (!isOpen) return;
    
    const interval = setInterval(() => {
      measureTarget();
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isOpen, measureTarget]);

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

  const handleSkipThisStep = () => {
    setCurrentStep(prev => prev + 1);
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
      width: '400px',
      maxWidth: 'calc(100vw - 48px)'
    };
  };

  // Render pulsing click indicator
  const renderClickIndicator = () => {
    if (!waitingForClick || !clickTargetRect) return null;

    return (
      <div
        className="fixed pointer-events-none z-[10001]"
        style={{
          left: clickTargetRect.left + clickTargetRect.width / 2 - 24,
          top: clickTargetRect.top - 50
        }}
      >
        <div className="flex flex-col items-center animate-bounce">
          <div 
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-xs font-medium shadow-lg"
            style={{ backgroundColor: 'hsl(160, 84%, 39%)' }}
          >
            <MousePointerClick className="h-3.5 w-3.5" />
            Click here
          </div>
          <div 
            className="w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent"
            style={{ borderTopColor: 'hsl(160, 84%, 39%)' }}
          />
        </div>
      </div>
    );
  };

  return (
    <div 
      className="fixed inset-0 z-[9999]"
      style={{ pointerEvents: waitingForClick ? 'none' : 'auto' }}
      data-testid="guided-tour-overlay"
    >
      {/* Canvas overlay - light dimming so app is visible */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ 
          width: '100%', 
          height: '100%'
        }}
      />

      {/* Click indicator for interactive steps */}
      {renderClickIndicator()}

      {/* Tour Card */}
      <Card
        className="shadow-xl border-2 overflow-hidden"
        style={{
          ...getTooltipStyle(),
          borderColor: waitingForClick ? 'hsl(160, 84%, 39%)' : 'hsl(var(--trade))',
          zIndex: 10000,
          pointerEvents: 'auto' // Always allow card interaction
        }}
        data-testid="tour-tooltip"
      >
        {/* Header */}
        <div className="px-4 py-3 border-b bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div 
                className="p-2 rounded-lg"
                style={{ 
                  backgroundColor: waitingForClick 
                    ? 'hsl(160, 84%, 39%, 0.15)' 
                    : 'hsl(var(--trade) / 0.15)' 
                }}
              >
                {waitingForClick ? (
                  <MousePointerClick className="h-5 w-5" style={{ color: 'hsl(160, 84%, 39%)' }} />
                ) : (
                  <StepIcon className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">
                  Step {currentStep + 1} of {TOUR_STEPS.length}
                  {step.subStep && step.totalSubSteps && (
                    <span className="ml-1">
                      ({step.subStep}/{step.totalSubSteps})
                    </span>
                  )}
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
          <p className="text-muted-foreground text-sm leading-relaxed mb-3">
            {step.description}
          </p>

          {/* Interactive step indicator */}
          {waitingForClick && step.clickTargetLabel && (
            <div 
              className="flex items-center gap-2 p-2.5 rounded-lg mb-3 text-sm"
              style={{ 
                backgroundColor: 'hsl(160, 84%, 39%, 0.1)',
                border: '1px solid hsl(160, 84%, 39%, 0.3)'
              }}
            >
              <MousePointerClick className="h-4 w-4 flex-shrink-0" style={{ color: 'hsl(160, 84%, 39%)' }} />
              <span>
                <strong>Action:</strong> Click the {step.clickTargetLabel}
              </span>
            </div>
          )}

          {/* Step dots - compact for many steps */}
          <div className="flex items-center justify-center gap-1 mb-3 flex-wrap">
            {TOUR_STEPS.map((_, index) => (
              <div
                key={index}
                className={`h-1.5 rounded-full transition-all duration-200 ${
                  index === currentStep
                    ? "w-3 bg-primary"
                    : index < currentStep
                    ? "w-1.5 bg-primary/50"
                    : "w-1.5 bg-muted-foreground/30"
                }`}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between gap-2">
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
              {/* Skip this step (for interactive steps) */}
              {waitingForClick && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSkipThisStep}
                  className="text-muted-foreground text-xs"
                  data-testid="button-skip-step"
                >
                  Skip step
                </Button>
              )}

              {/* Skip entire tour */}
              {!isLastStep && !waitingForClick && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSkip}
                  className="text-muted-foreground text-xs"
                >
                  Skip tour
                </Button>
              )}
              
              {/* Next/Continue button - hidden for interactive steps waiting for click */}
              {!waitingForClick && (
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
              )}
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
      Start Interactive Tour
    </Button>
  );
}
