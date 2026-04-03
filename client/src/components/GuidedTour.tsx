import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
  mobileOnly?: boolean;
  desktopRoute?: string;
  desktopAlternative?: {
    title: string;
    description: string;
    clickTargetSelector?: string;
    clickTargetLabel?: string;
  };
}

const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to JobRunner!",
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
    clickTargetLabel: "More",
    mobileOnly: true,
    desktopAlternative: {
      title: "Navigate to Clients",
      description: "On desktop, all navigation is in the sidebar. Click 'Clients' in the sidebar to see your customer list.",
      clickTargetSelector: '[data-testid="sidebar-clients"], a[href="/clients"]',
      clickTargetLabel: "Clients"
    }
  },
  {
    id: "nav-clients",
    title: "Go to Clients",
    description: "Now tap 'Clients' to see your customer list.",
    route: "/more",
    icon: Users,
    waitForClick: true,
    clickTargetSelector: '[data-testid="card-clients"], [data-testid="nav-clients"], a[href="/clients"]',
    clickTargetLabel: "Clients",
    mobileOnly: true
  },
  {
    id: "clients-page",
    title: "Your Client List",
    description: "Here's where all your customers are stored. We've added 5 sample clients to get you started - try clicking one to see their details!",
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
    clickTargetSelector: '[data-testid="button-create-client"]',
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
    clickTargetLabel: "Work",
    mobileOnly: true,
    desktopAlternative: {
      title: "Navigate to Your Jobs",
      description: "Click 'Work' in the sidebar to see how job management works.",
      clickTargetSelector: '[data-testid="sidebar-work"]',
      clickTargetLabel: "Work"
    }
  },
  {
    id: "jobs-page",
    title: "Your Job Board",
    description: "Jobs flow through stages: Pending → Scheduled → In Progress → Done. You have 6 sample jobs in various stages - click one to see how job tracking works!",
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
    clickTargetLabel: "More",
    mobileOnly: true,
    desktopAlternative: {
      title: "Navigate to Documents",
      description: "Click 'Documents' in the sidebar to see your quotes, invoices, and receipts.",
      clickTargetSelector: '[data-testid="sidebar-documents"]',
      clickTargetLabel: "Documents"
    }
  },
  {
    id: "nav-quotes",
    title: "Time for Quotes",
    description: "Now tap 'Quotes' to see how you create professional quotes for your clients.",
    route: "/more",
    icon: FileText,
    waitForClick: true,
    clickTargetSelector: '[data-testid="card-quotes"], [data-testid="nav-quotes"], a[href="/quotes"]',
    clickTargetLabel: "Quotes",
    mobileOnly: true
  },
  {
    id: "quotes-page",
    title: "Your Quotes",
    description: "You have 3 sample quotes ready to explore. Click one to see the professional layout with GST calculated automatically. When a client accepts, convert it to an invoice with one click!",
    route: "/quotes",
    desktopRoute: "/documents",
    icon: FileText,
    targetSelector: '[data-testid="quotes-content"], [data-testid="quotes-list"], main',
    desktopAlternative: {
      title: "Your Documents",
      description: "Here's where all your quotes, invoices, and receipts are stored. Use the tabs at the top to switch between them. You have sample documents to explore - try clicking one!"
    }
  },
  {
    id: "nav-more-invoices",
    title: "Back to More Menu",
    description: "Tap 'More' to find Invoices.",
    route: "/quotes",
    icon: MoreHorizontal,
    waitForClick: true,
    clickTargetSelector: '[data-testid="bottom-nav-more"], [data-testid="nav-more"]',
    clickTargetLabel: "More",
    mobileOnly: true
  },
  {
    id: "nav-invoices",
    title: "Check Your Invoices",
    description: "Tap 'Invoices' to see how you get paid.",
    route: "/more",
    icon: Receipt,
    waitForClick: true,
    clickTargetSelector: '[data-testid="card-invoices"], [data-testid="nav-invoices"], a[href="/invoices"]',
    clickTargetLabel: "Invoices",
    mobileOnly: true
  },
  {
    id: "invoices-page",
    title: "Getting Paid",
    description: "You have 2 sample invoices to explore. Track pending, overdue, or paid invoices. Connect Stripe to accept card payments and get paid faster!",
    route: "/invoices",
    icon: Receipt,
    targetSelector: '[data-testid="invoices-content"], [data-testid="invoices-list"], main',
    mobileOnly: true
  },
  {
    id: "nav-more-settings",
    title: "One More Time",
    description: "Tap 'More' to find Settings.",
    route: "/invoices",
    desktopRoute: "/documents",
    icon: MoreHorizontal,
    waitForClick: true,
    clickTargetSelector: '[data-testid="bottom-nav-more"], [data-testid="nav-more"]',
    clickTargetLabel: "More",
    mobileOnly: true,
    desktopAlternative: {
      title: "Navigate to Settings",
      description: "Click 'Settings' in the sidebar to customise your business profile, logo, and preferences.",
      clickTargetSelector: '[data-testid="sidebar-settings"], a[href="/settings"]',
      clickTargetLabel: "Settings"
    }
  },
  {
    id: "nav-settings",
    title: "Finally, Your Settings",
    description: "Tap 'Settings' to customise your business profile, logo, and preferences.",
    route: "/more",
    icon: Settings,
    waitForClick: true,
    clickTargetSelector: '[data-testid="card-settings"], [data-testid="nav-settings"], a[href="/settings"]',
    clickTargetLabel: "Settings",
    mobileOnly: true
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
    description: "Great job! You've explored all the main areas. You have sample clients, jobs, quotes, and invoices to practice with. When you're ready, add your first real client!",
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
  
  // Filter out mobile-only steps on desktop (>= 768px)
  const [isMobileView, setIsMobileView] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  
  useEffect(() => {
    const handleResize = () => setIsMobileView(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Transform steps based on screen size - apply desktop alternatives for mobile-only steps (memoized for stability)
  const filteredSteps = useMemo(() => 
    TOUR_STEPS.map(s => {
      if (s.mobileOnly && !isMobileView && s.desktopAlternative) {
        return {
          ...s,
          title: s.desktopAlternative.title,
          description: s.desktopAlternative.description,
          clickTargetSelector: s.desktopAlternative.clickTargetSelector || s.clickTargetSelector,
          clickTargetLabel: s.desktopAlternative.clickTargetLabel || s.clickTargetLabel,
          mobileOnly: false
        };
      }
      if (!s.mobileOnly && !isMobileView && s.desktopAlternative) {
        return {
          ...s,
          title: s.desktopAlternative.title,
          description: s.desktopAlternative.description,
          clickTargetSelector: s.desktopAlternative.clickTargetSelector || s.clickTargetSelector,
          clickTargetLabel: s.desktopAlternative.clickTargetLabel || s.clickTargetLabel,
        };
      }
      return s;
    }).filter(s => !s.mobileOnly || isMobileView),
    [isMobileView]
  );
  
  // Guard currentStep to stay within bounds when filteredSteps changes
  const safeCurrentStep = Math.min(currentStep, filteredSteps.length - 1);
  const step = filteredSteps[safeCurrentStep];
  const isLastStep = safeCurrentStep === filteredSteps.length - 1;
  const isFirstStep = safeCurrentStep === 0;
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

  const scrollToElement = useCallback((element: Element): Promise<void> => {
    return new Promise((resolve) => {
      const rect = element.getBoundingClientRect();
      const headerOffset = 80;
      const viewportHeight = window.innerHeight;
      
      const sidebarContent = element.closest('[data-sidebar="content"]');
      if (sidebarContent) {
        const sidebarRect = sidebarContent.getBoundingClientRect();
        const elementRelativeTop = rect.top - sidebarRect.top + sidebarContent.scrollTop;
        const targetScroll = elementRelativeTop - sidebarRect.height / 2 + rect.height / 2;
        sidebarContent.scrollTo({
          top: Math.max(0, targetScroll),
          behavior: 'smooth'
        });
        setTimeout(resolve, 400);
        return;
      }
      
      const isVisible = rect.top >= headerOffset && rect.bottom <= viewportHeight - 100;
      if (!isVisible) {
        const scrollTop = window.scrollY + rect.top - headerOffset - 50;
        window.scrollTo({
          top: Math.max(0, scrollTop),
          behavior: 'smooth'
        });
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
    const cardHeight = 280;
    const cardWidth = Math.min(380, viewportWidth - 32);
    const padding = 20;

    const spaceAbove = rect.top - 80;
    const spaceBelow = viewportHeight - rect.bottom - 20;
    const spaceLeft = rect.left;
    const spaceRight = viewportWidth - rect.right;

    if (viewportWidth < 640) {
      return spaceBelow > cardHeight + padding ? 'bottom' : 'top';
    }

    if (rect.left < 300 && spaceRight > cardWidth + padding) return 'right';
    
    if (spaceBelow > cardHeight + padding) return 'bottom';
    if (spaceAbove > cardHeight + padding) return 'top';
    if (spaceRight > cardWidth + padding) return 'right';
    if (spaceLeft > cardWidth + padding) return 'left';
    
    return 'bottom';
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

      const currentPath = window.location.pathname;
      const targetRoute = (!isMobileView && step.desktopRoute) ? step.desktopRoute : step.route;
      if (targetRoute !== currentPath) {
        setLocation(targetRoute);
        window.scrollTo({ top: 0 });
        const mainContent = document.querySelector('main');
        if (mainContent) mainContent.scrollTop = 0;
        await new Promise(r => setTimeout(r, 500));
      }

      // Set up target after navigation
      await setupTarget();
      setIsTransitioning(false);
    };

    navigateToStep();
  }, [currentStep, isOpen, step.route, step.desktopRoute, isMobileView, setLocation, setupTarget]);

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

      ctx.globalCompositeOperation = 'source-over';
      const borderColor = isInteractive ? 'rgba(16, 185, 129, 0.6)' : 'rgba(59, 130, 246, 0.5)';
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 2;
      ctx.shadowColor = borderColor;
      ctx.shadowBlur = 3;
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
        setCurrentStep(prev => Math.min(prev + 1, filteredSteps.length - 1));
      }, 200);
    };

    element.addEventListener('click', handleClick);
    return () => element.removeEventListener('click', handleClick);
  }, [isOpen, isInteractive, step.clickTargetSelector, isReady, findElement]);

  // Detect route changes for navigation-based interactive steps using wouter's location
  // If user navigated to the next step's route, advance automatically
  useEffect(() => {
    if (!isOpen || !isInteractive) return;
    
    const nextStep = filteredSteps[safeCurrentStep + 1];
    if (!nextStep) return;
    
    // If we're now at the next step's route, advance
    if (location === nextStep.route && step.route !== nextStep.route) {
      setCurrentStep(prev => Math.min(prev + 1, filteredSteps.length - 1));
    }
  }, [isOpen, isInteractive, location, safeCurrentStep, step.route, filteredSteps]);

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
      const prevIdx = safeCurrentStep - 1;
      const prevStep = filteredSteps[prevIdx];
      if (prevStep) {
        const targetRoute = (!isMobileView && prevStep.desktopRoute) ? prevStep.desktopRoute : prevStep.route;
        const currentPath = window.location.pathname;
        if (targetRoute !== currentPath) {
          setLocation(targetRoute);
        }
      }
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem("jobrunner-tour-completed", "true");
    localStorage.setItem("jobrunner-tour-completed-date", new Date().toISOString());
    onComplete();
  };

  const handleExit = () => {
    localStorage.setItem("jobrunner-tour-skipped", "true");
    onClose();
  };

  const handleSkipStep = () => {
    if (!isLastStep) {
      setCurrentStep(prev => prev + 1);
    }
  };

  if (!isOpen) return null;

  // Check if a proposed card rect overlaps the target spotlight area
  const wouldOverlapTarget = (cardLeft: number, cardTop: number, cardW: number, cardH: number, target: DOMRect): boolean => {
    const spotPad = 20;
    const tLeft = target.left - spotPad;
    const tRight = target.right + spotPad;
    const tTop = target.top - spotPad;
    const tBottom = target.bottom + spotPad;
    const cRight = cardLeft + cardW;
    const cBottom = cardTop + cardH;
    return !(cardLeft >= tRight || cRight <= tLeft || cardTop >= tBottom || cBottom <= tTop);
  };

  // Calculate card style based on position
  const getCardStyle = (): React.CSSProperties => {
    const isMobile = window.innerWidth < 640;
    const cardWidthPx = isMobile ? window.innerWidth - 32 : 380;
    const cardWidthStr = isMobile ? 'calc(100vw - 32px)' : '380px';
    
    const base: React.CSSProperties = {
      position: 'fixed',
      width: cardWidthStr,
      maxWidth: 'calc(100vw - 32px)',
      zIndex: 10001,
      pointerEvents: 'auto'
    };

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

    if (!targetRect || cardPosition === 'center') {
      return {
        ...base,
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)'
      };
    }

    const gap = 20;
    const cardH = 350;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const tryPosition = (pos: CardPosition): React.CSSProperties | null => {
      let left: number;
      let top: number;
      switch (pos) {
        case 'bottom':
          left = Math.max(16, Math.min(targetRect.left, vw - cardWidthPx - 16));
          top = Math.max(80, Math.min(targetRect.bottom + gap, vh - cardH - 20));
          break;
        case 'top':
          left = Math.max(16, Math.min(targetRect.left, vw - cardWidthPx - 16));
          top = Math.max(80, targetRect.top - cardH - gap);
          break;
        case 'right':
          left = Math.min(targetRect.right + gap, vw - cardWidthPx - 16);
          top = Math.max(80, Math.min(targetRect.top, vh - cardH - 20));
          break;
        case 'left':
          left = Math.max(16, targetRect.left - cardWidthPx - gap);
          top = Math.max(80, Math.min(targetRect.top, vh - cardH - 20));
          break;
        default:
          return null;
      }
      if (isInteractive && wouldOverlapTarget(left, top, cardWidthPx, cardH, targetRect)) {
        return null;
      }
      return { ...base, left, top };
    };

    const preferred = tryPosition(cardPosition);
    if (preferred) return preferred;

    const fallbacks: CardPosition[] = ['bottom', 'right', 'top', 'left'];
    for (const pos of fallbacks) {
      if (pos === cardPosition) continue;
      const result = tryPosition(pos);
      if (result) return result;
    }

    return {
      ...base,
      right: 16,
      bottom: 20
    };
  };

  const renderArrow = () => {
    if (!targetRect || !isReady || cardPosition === 'center') return null;
    if (!isInteractive) return null;

    const arrowColor = 'rgba(16, 185, 129, 0.85)';
    const isLeftSide = targetRect.left < 300;
    
    if (isLeftSide) {
      return (
        <div 
          className="fixed pointer-events-none z-[10002]"
          style={{
            left: targetRect.right + 8,
            top: targetRect.top + targetRect.height / 2 - 16
          }}
        >
          <div className="flex items-center animate-pulse">
            <div 
              className="w-0 h-0 border-t-[6px] border-b-[6px] border-r-[6px] border-transparent"
              style={{ borderRightColor: arrowColor }}
            />
            <div 
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-white text-xs font-medium shadow-md whitespace-nowrap"
              style={{ backgroundColor: arrowColor }}
            >
              Click "{step.clickTargetLabel}"
            </div>
          </div>
        </div>
      );
    }
    
    return (
      <div 
        className="fixed pointer-events-none z-[10002]"
        style={{
          left: targetRect.left + targetRect.width / 2 - 20,
          top: targetRect.top - 38
        }}
      >
        <div className="flex flex-col items-center animate-pulse">
          <div 
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-white text-xs font-medium shadow-md whitespace-nowrap"
            style={{ backgroundColor: arrowColor }}
          >
            Click "{step.clickTargetLabel}"
          </div>
          <div 
            className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-transparent mt-[-1px]"
            style={{ borderTopColor: arrowColor }}
          />
        </div>
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
        className="shadow-xl border overflow-hidden bg-background"
        style={{
          ...getCardStyle(),
          borderColor: isInteractive ? 'rgba(16, 185, 129, 0.4)' : 'hsl(var(--border))'
        }}
        onClick={(e) => e.stopPropagation()}
        data-testid="tour-tooltip"
      >
        {/* Header */}
        <div 
          className="px-4 py-3 border-b bg-muted/50"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div 
                className="p-2 rounded-lg flex-shrink-0 bg-muted"
              >
                <StepIcon className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground font-medium">
                  Step {safeCurrentStep + 1} of {filteredSteps.length}
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
            <div className="flex items-center gap-2 p-2.5 rounded-md mb-4 bg-muted">
              <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm text-muted-foreground">
                Click <strong className="text-foreground">"{step.clickTargetLabel}"</strong> to continue
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
            {filteredSteps.map((_, index) => (
              <div
                key={index}
                className={`h-2 rounded-full transition-all duration-200 ${
                  index === safeCurrentStep
                    ? "w-4 bg-primary"
                    : index < safeCurrentStep
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
    return localStorage.getItem("jobrunner-tour-completed") === "true" ||
           localStorage.getItem("jobrunner-tour-skipped") === "true";
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
    localStorage.removeItem("jobrunner-tour-completed");
    localStorage.removeItem("jobrunner-tour-completed-date");
    localStorage.removeItem("jobrunner-tour-skipped");
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
