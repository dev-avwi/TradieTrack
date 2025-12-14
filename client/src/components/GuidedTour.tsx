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
  ArrowRight,
  LogOut,
  MoreHorizontal
} from "lucide-react";

interface TourStep {
  id: string;
  title: string;
  description: string;
  route: string;
  icon: any;
  targetSelector?: string;
  waitForClick?: boolean;
  clickTargetSelector?: string;
  clickTargetLabel?: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to TradieTrack!",
    description: "This tour will guide you through the app step by step. We'll highlight each area and you'll click through to learn how it works. Ready?",
    route: "/",
    icon: Sparkles
  },
  {
    id: "dashboard",
    title: "Your Dashboard",
    description: "This is your home base. You'll see today's jobs, earnings summary, and quick actions. Everything starts here.",
    route: "/",
    icon: LayoutDashboard,
    targetSelector: '[data-testid="dashboard-content"], main, .dashboard-container'
  },
  {
    id: "nav-more-clients",
    title: "Open the More Menu",
    description: "On mobile, some features are in the 'More' menu. Tap 'More' at the bottom to find Clients.",
    route: "/",
    icon: MoreHorizontal,
    waitForClick: true,
    clickTargetSelector: '[data-testid="bottom-nav-more"], [data-testid="nav-more"]',
    clickTargetLabel: "More"
  },
  {
    id: "nav-clients",
    title: "Go to Clients",
    description: "Now tap 'Clients' to see your customer list.",
    route: "/more",
    icon: Users,
    waitForClick: true,
    clickTargetSelector: '[data-testid="card-clients"], [data-testid="nav-clients"], a[href="/clients"]',
    clickTargetLabel: "Clients"
  },
  {
    id: "clients-page",
    title: "Your Client List",
    description: "Here's where all your customers are stored. You can search, call, email, or view their job history from here.",
    route: "/clients",
    icon: Users,
    targetSelector: '[data-testid="clients-content"], [data-testid="clients-list"], main'
  },
  {
    id: "clients-add",
    title: "Adding a New Client",
    description: "See the '+ New Client' button? That's how you add customers. Try clicking it now.",
    route: "/clients",
    icon: Plus,
    waitForClick: true,
    clickTargetSelector: '[data-testid="button-new-client"], [data-testid="add-client-button"], button:has(svg.lucide-plus)',
    clickTargetLabel: "+ New Client"
  },
  {
    id: "nav-work",
    title: "Now Let's See Your Jobs",
    description: "Tap 'Work' at the bottom to see how job management works.",
    route: "/clients",
    icon: Briefcase,
    waitForClick: true,
    clickTargetSelector: '[data-testid="bottom-nav-work"], [data-testid="nav-work"], a[href="/work"]',
    clickTargetLabel: "Work"
  },
  {
    id: "jobs-page",
    title: "Your Job Board",
    description: "Jobs flow through stages: Pending → Scheduled → In Progress → Done → Invoiced. Each card shows a job's status.",
    route: "/work",
    icon: Briefcase,
    targetSelector: '[data-testid="work-content"], [data-testid="jobs-list"], main'
  },
  {
    id: "nav-more-quotes",
    title: "Back to More Menu",
    description: "Tap 'More' again to find the Quotes section.",
    route: "/work",
    icon: MoreHorizontal,
    waitForClick: true,
    clickTargetSelector: '[data-testid="bottom-nav-more"], [data-testid="nav-more"]',
    clickTargetLabel: "More"
  },
  {
    id: "nav-quotes",
    title: "Time for Quotes",
    description: "Now tap 'Quotes' to see how you create professional quotes for your clients.",
    route: "/more",
    icon: FileText,
    waitForClick: true,
    clickTargetSelector: '[data-testid="card-quotes"], [data-testid="nav-quotes"], a[href="/quotes"]',
    clickTargetLabel: "Quotes"
  },
  {
    id: "quotes-page",
    title: "Your Quotes",
    description: "Create quotes with line items and GST calculated automatically. When a client accepts, you can convert it straight to an invoice!",
    route: "/quotes",
    icon: FileText,
    targetSelector: '[data-testid="quotes-content"], [data-testid="quotes-list"], main'
  },
  {
    id: "nav-more-invoices",
    title: "Back to More Menu",
    description: "Tap 'More' to find Invoices.",
    route: "/quotes",
    icon: MoreHorizontal,
    waitForClick: true,
    clickTargetSelector: '[data-testid="bottom-nav-more"], [data-testid="nav-more"]',
    clickTargetLabel: "More"
  },
  {
    id: "nav-invoices",
    title: "Check Your Invoices",
    description: "Tap 'Invoices' to see how you get paid.",
    route: "/more",
    icon: Receipt,
    waitForClick: true,
    clickTargetSelector: '[data-testid="card-invoices"], [data-testid="nav-invoices"], a[href="/invoices"]',
    clickTargetLabel: "Invoices"
  },
  {
    id: "invoices-page",
    title: "Getting Paid",
    description: "Track all your invoices here - what's pending, overdue, or paid. Connect Stripe to accept card payments directly!",
    route: "/invoices",
    icon: Receipt,
    targetSelector: '[data-testid="invoices-content"], [data-testid="invoices-list"], main'
  },
  {
    id: "nav-more-settings",
    title: "One More Time",
    description: "Tap 'More' to find Settings.",
    route: "/invoices",
    icon: MoreHorizontal,
    waitForClick: true,
    clickTargetSelector: '[data-testid="bottom-nav-more"], [data-testid="nav-more"]',
    clickTargetLabel: "More"
  },
  {
    id: "nav-settings",
    title: "Finally, Your Settings",
    description: "Tap 'Settings' to customise your business profile, logo, and preferences.",
    route: "/more",
    icon: Settings,
    waitForClick: true,
    clickTargetSelector: '[data-testid="card-settings"], [data-testid="nav-settings"], a[href="/settings"]',
    clickTargetLabel: "Settings"
  },
  {
    id: "settings-page",
    title: "Business Settings",
    description: "Set up your business details, upload your logo, configure email templates, and connect payment processing here.",
    route: "/settings",
    icon: Settings,
    targetSelector: '[data-testid="settings-content"], [data-testid="settings-tabs"], main'
  },
  {
    id: "complete",
    title: "You're All Set!",
    description: "Great job! You've seen all the main areas. Start by adding your first client, create a job, then send a quote. Good luck!",
    route: "/",
    icon: CheckCircle2
  }
];

interface GuidedTourProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

type CardPosition = 'top' | 'bottom' | 'left' | 'right' | 'center';

export default function GuidedTour({ isOpen, onClose, onComplete }: GuidedTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [cardPosition, setCardPosition] = useState<CardPosition>('center');
  const [isReady, setIsReady] = useState(false);
  const [location, setLocation] = useLocation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const step = TOUR_STEPS[currentStep];
  const isLastStep = currentStep === TOUR_STEPS.length - 1;
  const isFirstStep = currentStep === 0;
  const isInteractive = step.waitForClick && step.clickTargetSelector;
  const StepIcon = step.icon;

  // Find element by trying multiple selectors
  const findElement = useCallback((selectorString: string): Element | null => {
    const selectors = selectorString.split(', ');
    for (const selector of selectors) {
      try {
        const el = document.querySelector(selector.trim());
        if (el) return el;
      } catch (e) {
        // Invalid selector
      }
    }
    return null;
  }, []);

  // Scroll element into view with offset for headers
  const scrollToElement = useCallback((element: Element): Promise<void> => {
    return new Promise((resolve) => {
      const rect = element.getBoundingClientRect();
      const headerOffset = 80; // Account for sticky header
      const viewportHeight = window.innerHeight;
      
      // Calculate if element is visible
      const isVisible = rect.top >= headerOffset && rect.bottom <= viewportHeight - 100;
      
      if (!isVisible) {
        const scrollTop = window.scrollY + rect.top - headerOffset - 50;
        window.scrollTo({
          top: Math.max(0, scrollTop),
          behavior: 'smooth'
        });
        // Wait for scroll to complete
        setTimeout(resolve, 400);
      } else {
        resolve();
      }
    });
  }, []);

  // Calculate best position for the tour card relative to target
  const calculateCardPosition = useCallback((rect: DOMRect): CardPosition => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const cardHeight = 280; // Approximate card height
    const cardWidth = Math.min(380, viewportWidth - 32);
    const padding = 20;

    // Check available space in each direction
    const spaceAbove = rect.top - 80; // Account for header
    const spaceBelow = viewportHeight - rect.bottom - 20;
    const spaceLeft = rect.left;
    const spaceRight = viewportWidth - rect.right;

    // For mobile, prefer bottom positioning
    if (viewportWidth < 640) {
      return spaceBelow > cardHeight + padding ? 'bottom' : 'top';
    }

    // Prefer positioning below or to the side
    if (spaceBelow > cardHeight + padding) return 'bottom';
    if (spaceAbove > cardHeight + padding) return 'top';
    if (spaceRight > cardWidth + padding) return 'right';
    if (spaceLeft > cardWidth + padding) return 'left';
    
    return 'bottom'; // Default
  }, []);

  // Measure and set up target
  const setupTarget = useCallback(async () => {
    const selector = isInteractive ? step.clickTargetSelector : step.targetSelector;
    
    if (!selector) {
      setTargetRect(null);
      setCardPosition('center');
      setIsReady(true);
      return;
    }

    const element = findElement(selector);
    if (!element) {
      setTargetRect(null);
      setCardPosition('center');
      setIsReady(true);
      return;
    }

    // Scroll to element first
    await scrollToElement(element);

    // Now measure the element
    const rect = element.getBoundingClientRect();
    setTargetRect(rect);
    setCardPosition(calculateCardPosition(rect));
    setIsReady(true);
  }, [step, isInteractive, findElement, scrollToElement, calculateCardPosition]);

  // Handle step navigation
  useEffect(() => {
    if (!isOpen) return;

    const navigateToStep = async () => {
      setIsTransitioning(true);
      setIsReady(false);
      setTargetRect(null);

      // Navigate to route if needed
      const currentPath = window.location.pathname;
      if (step.route !== currentPath) {
        setLocation(step.route);
        await new Promise(r => setTimeout(r, 500));
      }

      // Set up target after navigation
      await setupTarget();
      setIsTransitioning(false);
    };

    navigateToStep();
  }, [currentStep, isOpen, step.route, setLocation, setupTarget]);

  // Draw overlay with spotlight
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

    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, width, height);

    // Cut out spotlight for target
    if (targetRect && isReady) {
      const padding = 12;
      const radius = 12;
      const x = targetRect.left - padding;
      const y = targetRect.top - padding;
      const w = targetRect.width + padding * 2;
      const h = targetRect.height + padding * 2;

      // Clear the spotlight area
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, radius);
      ctx.fill();

      // Draw glowing border
      ctx.globalCompositeOperation = 'source-over';
      const borderColor = isInteractive ? '#10b981' : '#3b82f6';
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 3;
      ctx.shadowColor = borderColor;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, radius);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }, [targetRect, isReady, isInteractive]);

  // Redraw on changes
  useEffect(() => {
    if (isOpen) {
      drawOverlay();
    }
  }, [isOpen, targetRect, isReady, drawOverlay]);

  // Handle resize
  useEffect(() => {
    if (!isOpen) return;
    
    const handleResize = () => {
      setupTarget();
      drawOverlay();
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen, setupTarget, drawOverlay]);

  // Listen for clicks on interactive targets
  useEffect(() => {
    if (!isOpen || !isInteractive || !step.clickTargetSelector || !isReady) return;

    const element = findElement(step.clickTargetSelector);
    if (!element) return;

    const handleClick = () => {
      setTimeout(() => {
        setCurrentStep(prev => Math.min(prev + 1, TOUR_STEPS.length - 1));
      }, 200);
    };

    element.addEventListener('click', handleClick);
    return () => element.removeEventListener('click', handleClick);
  }, [isOpen, isInteractive, step.clickTargetSelector, isReady, findElement]);

  // Detect route changes for navigation-based interactive steps using wouter's location
  // If user navigated to the next step's route, advance automatically
  useEffect(() => {
    if (!isOpen || !isInteractive) return;
    
    const nextStep = TOUR_STEPS[currentStep + 1];
    if (!nextStep) return;
    
    // If we're now at the next step's route, advance
    if (location === nextStep.route && step.route !== nextStep.route) {
      setCurrentStep(prev => Math.min(prev + 1, TOUR_STEPS.length - 1));
    }
  }, [isOpen, isInteractive, location, currentStep, step.route]);

  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleExit();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Reset on open and set body attribute for other components to know tour is active
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
      document.body.setAttribute('data-tour-active', 'true');
    } else {
      document.body.removeAttribute('data-tour-active');
    }
    
    return () => {
      document.body.removeAttribute('data-tour-active');
    };
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

  const handleExit = () => {
    localStorage.setItem("tradietrack-tour-skipped", "true");
    onClose();
  };

  const handleSkipStep = () => {
    if (!isLastStep) {
      setCurrentStep(prev => prev + 1);
    }
  };

  if (!isOpen) return null;

  // Calculate card style based on position
  const getCardStyle = (): React.CSSProperties => {
    const isMobile = window.innerWidth < 640;
    const cardWidth = isMobile ? 'calc(100vw - 32px)' : '380px';
    
    const base: React.CSSProperties = {
      position: 'fixed',
      width: cardWidth,
      maxWidth: 'calc(100vw - 32px)',
      zIndex: 10001,
      pointerEvents: 'auto'
    };

    // On mobile: position card at TOP of screen to leave bottom nav accessible
    if (isMobile) {
      return {
        ...base,
        left: '16px',
        right: '16px',
        top: '80px',
        width: 'auto',
        maxHeight: '50vh',
        overflowY: 'auto'
      };
    }

    // Desktop: center if no target
    if (!targetRect || cardPosition === 'center') {
      return {
        ...base,
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)'
      };
    }

    const gap = 20;
    const cardHeight = 350; // Approximate max card height

    switch (cardPosition) {
      case 'bottom':
        // Ensure card doesn't go off bottom of screen
        const bottomTop = Math.min(targetRect.bottom + gap, window.innerHeight - cardHeight - 20);
        return {
          ...base,
          left: Math.max(16, Math.min(targetRect.left, window.innerWidth - 400)),
          top: Math.max(80, bottomTop)
        };
      case 'top':
        // Ensure card doesn't go off top of screen - use top positioning instead of bottom
        const topPosition = Math.max(80, targetRect.top - cardHeight - gap);
        return {
          ...base,
          left: Math.max(16, Math.min(targetRect.left, window.innerWidth - 400)),
          top: topPosition
        };
      case 'right':
        return {
          ...base,
          left: Math.min(targetRect.right + gap, window.innerWidth - 400),
          top: Math.max(80, Math.min(targetRect.top, window.innerHeight - cardHeight - 20))
        };
      case 'left':
        return {
          ...base,
          right: Math.max(16, window.innerWidth - targetRect.left + gap),
          top: Math.max(80, Math.min(targetRect.top, window.innerHeight - cardHeight - 20))
        };
      default:
        return base;
    }
  };

  // Render arrow pointing to target
  const renderArrow = () => {
    if (!targetRect || !isReady || cardPosition === 'center') return null;

    const arrowColor = isInteractive ? '#10b981' : '#3b82f6';
    
    return (
      <div 
        className="fixed pointer-events-none z-[10002]"
        style={{
          left: targetRect.left + targetRect.width / 2 - 20,
          top: targetRect.top - 45
        }}
      >
        {isInteractive && (
          <div className="flex flex-col items-center animate-bounce">
            <div 
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-white text-sm font-semibold shadow-lg whitespace-nowrap"
              style={{ backgroundColor: arrowColor }}
            >
              <MousePointerClick className="h-4 w-4" />
              Click "{step.clickTargetLabel}"
            </div>
            <div 
              className="w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent mt-[-1px]"
              style={{ borderTopColor: arrowColor }}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div 
      className="fixed inset-0 z-[9999]"
      style={{ pointerEvents: isInteractive && isReady ? 'none' : 'auto' }}
      onClick={isInteractive ? undefined : handleExit}
      data-testid="guided-tour-overlay"
    >
      {/* Canvas overlay */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
      />

      {/* Arrow/indicator pointing to target */}
      {renderArrow()}

      {/* Tour Card */}
      <Card
        ref={cardRef}
        className="shadow-2xl border-2 overflow-hidden bg-background"
        style={{
          ...getCardStyle(),
          borderColor: isInteractive ? '#10b981' : 'hsl(var(--primary))'
        }}
        onClick={(e) => e.stopPropagation()}
        data-testid="tour-tooltip"
      >
        {/* Header */}
        <div 
          className="px-4 py-3 border-b"
          style={{ 
            backgroundColor: isInteractive ? 'rgba(16, 185, 129, 0.1)' : 'hsl(var(--muted))' 
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div 
                className="p-2 rounded-lg flex-shrink-0"
                style={{ 
                  backgroundColor: isInteractive ? 'rgba(16, 185, 129, 0.2)' : 'hsl(var(--primary) / 0.1)' 
                }}
              >
                {isInteractive ? (
                  <MousePointerClick className="h-5 w-5 text-emerald-500" />
                ) : (
                  <StepIcon className="h-5 w-5 text-primary" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground font-medium">
                  Step {currentStep + 1} of {TOUR_STEPS.length}
                </p>
                <h3 className="font-semibold text-base truncate">{step.title}</h3>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon"
              className="h-8 w-8 flex-shrink-0"
              onClick={handleExit}
              data-testid="button-close-tour"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 py-4">
          <p className="text-muted-foreground text-sm leading-relaxed mb-4">
            {step.description}
          </p>

          {/* Interactive action prompt */}
          {isInteractive && isReady && (
            <div 
              className="flex items-center gap-3 p-3 rounded-lg mb-4 border"
              style={{ 
                backgroundColor: 'rgba(16, 185, 129, 0.05)',
                borderColor: 'rgba(16, 185, 129, 0.3)'
              }}
            >
              <ArrowRight className="h-5 w-5 text-emerald-500 flex-shrink-0 animate-pulse" />
              <span className="text-sm font-medium">
                Click <strong>"{step.clickTargetLabel}"</strong> to continue
              </span>
            </div>
          )}

          {/* Loading state */}
          {isTransitioning && (
            <div className="flex items-center justify-center py-4">
              <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          )}

          {/* Step progress dots */}
          <div className="flex items-center justify-center gap-1 mb-4 flex-wrap">
            {TOUR_STEPS.map((_, index) => (
              <div
                key={index}
                className={`h-2 rounded-full transition-all duration-200 ${
                  index === currentStep
                    ? "w-4 bg-primary"
                    : index < currentStep
                    ? "w-2 bg-primary/40"
                    : "w-2 bg-muted-foreground/20"
                }`}
              />
            ))}
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrevious}
              disabled={isFirstStep || isTransitioning}
              className="text-muted-foreground"
              data-testid="button-tour-previous"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>

            <div className="flex items-center gap-2">
              {/* Skip this step (for interactive steps) */}
              {isInteractive && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSkipStep}
                  className="text-muted-foreground text-xs"
                  data-testid="button-skip-step"
                >
                  Skip step
                </Button>
              )}

              {/* Done button - fallback for interactive steps when click detection fails */}
              {isInteractive && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNext}
                  data-testid="button-done-step"
                >
                  Done
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}

              {/* Next button (hidden during interactive steps) */}
              {!isInteractive && (
                <Button
                  size="sm"
                  onClick={handleNext}
                  disabled={isTransitioning}
                  data-testid="button-tour-next"
                >
                  {isTransitioning ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : isLastStep ? (
                    <>
                      Finish
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

          {/* Exit tour link */}
          <div className="flex justify-center mt-3 pt-3 border-t">
            <button 
              onClick={handleExit}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
              data-testid="button-exit-tour"
            >
              <LogOut className="h-3 w-3" />
              Exit tour (press Esc)
            </button>
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
