import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Play, 
  X, 
  ChevronRight, 
  ChevronLeft,
  Briefcase,
  FileText,
  DollarSign,
  Receipt,
  Users,
  Zap,
  CheckCircle2
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface WalkthroughStep {
  title: string;
  description: string;
  icon: typeof Briefcase;
  color: string;
  tips: string[];
}

const WALKTHROUGH_STEPS: WalkthroughStep[] = [
  {
    title: "Create Jobs",
    description: "Add jobs for your clients with all the details - address, description, scheduled time, and more.",
    icon: Briefcase,
    color: "hsl(var(--trade))",
    tips: [
      "Tap the + button to create a new job",
      "Add client details and job address",
      "Set a scheduled date and time",
      "Track job progress through stages"
    ]
  },
  {
    title: "Send Quotes",
    description: "Create professional quotes with line items, deposit requests, and your branding.",
    icon: FileText,
    color: "hsl(217, 91%, 60%)",
    tips: [
      "Add line items with descriptions and prices",
      "Include GST automatically for Australian clients",
      "Request deposits upfront",
      "Send via email or SMS directly"
    ]
  },
  {
    title: "Invoice & Get Paid",
    description: "Generate invoices from accepted quotes and collect payments with Stripe.",
    icon: DollarSign,
    color: "hsl(142, 76%, 36%)",
    tips: [
      "Convert quotes to invoices instantly",
      "Accept card payments via Stripe",
      "Track payment status in real-time",
      "Send payment reminders automatically"
    ]
  },
  {
    title: "Track Expenses",
    description: "Snap photos of receipts and track job expenses for accurate profit margins.",
    icon: Receipt,
    color: "hsl(25, 95%, 53%)",
    tips: [
      "Photo receipt capture with AI extraction",
      "Link expenses to specific jobs",
      "Track materials, fuel, and supplies",
      "Export for tax time"
    ]
  },
  {
    title: "Manage Your Team",
    description: "Assign jobs to team members and track their progress in real-time.",
    icon: Users,
    color: "hsl(262, 83%, 58%)",
    tips: [
      "Add team members with different roles",
      "Assign jobs with drag-and-drop",
      "Track time and location",
      "Communicate via team chat"
    ]
  },
  {
    title: "AI Assistant",
    description: "Get smart suggestions, schedule optimisation, and business insights powered by AI.",
    icon: Zap,
    color: "hsl(var(--trade))",
    tips: [
      "Ask questions about your business",
      "Get scheduling recommendations",
      "AI-powered quote suggestions",
      "Voice transcription for notes"
    ]
  }
];

const STORAGE_KEY = "tradietrack_walkthrough_seen";

interface FirstTimeWalkthroughProps {
  onComplete?: () => void;
  forceShow?: boolean;
}

export default function FirstTimeWalkthrough({ 
  onComplete, 
  forceShow = false 
}: FirstTimeWalkthroughProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    if (forceShow) {
      setIsOpen(true);
      return;
    }

    const hasSeen = localStorage.getItem(STORAGE_KEY);
    if (!hasSeen) {
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [forceShow]);

  const handleSkip = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setIsOpen(false);
    onComplete?.();
  };

  const handleComplete = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setIsOpen(false);
    onComplete?.();
  };

  const handleNext = () => {
    if (currentStep < WALKTHROUGH_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleStart = () => {
    setHasStarted(true);
    setCurrentStep(0);
  };

  const step = WALKTHROUGH_STEPS[currentStep];
  const progress = ((currentStep + 1) / WALKTHROUGH_STEPS.length) * 100;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) handleSkip();
    }}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden" data-testid="walkthrough-modal">
        {!hasStarted ? (
          <div className="p-6 space-y-6">
            <DialogHeader className="space-y-3">
              <div 
                className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}
              >
                <Play className="h-8 w-8" style={{ color: 'hsl(var(--trade))' }} />
              </div>
              <DialogTitle className="text-center text-2xl">
                Welcome to TradieTrack!
              </DialogTitle>
              <DialogDescription className="text-center text-base">
                Your all-in-one app for managing jobs, quotes, invoices, and getting paid faster.
                Let us show you around in 60 seconds.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <Button 
                className="w-full h-12 text-base font-medium text-white"
                style={{ backgroundColor: 'hsl(var(--trade))' }}
                onClick={handleStart}
                data-testid="button-start-walkthrough"
              >
                <Play className="h-5 w-5 mr-2" />
                Start Quick Tour
              </Button>
              <Button 
                variant="ghost" 
                className="w-full"
                onClick={handleSkip}
                data-testid="button-skip-walkthrough"
              >
                Skip for now
              </Button>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              You can replay this tour anytime from Settings
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <span className="text-sm text-muted-foreground">
                Step {currentStep + 1} of {WALKTHROUGH_STEPS.length}
              </span>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={handleSkip}
                data-testid="button-close-walkthrough"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <Progress value={progress} className="h-1 rounded-none" />

            <div className="p-6 space-y-6">
              <div className="text-center space-y-4">
                <div 
                  className="mx-auto w-20 h-20 rounded-2xl flex items-center justify-center transition-all duration-300"
                  style={{ backgroundColor: `${step.color}15` }}
                >
                  <step.icon 
                    className="h-10 w-10 transition-all duration-300" 
                    style={{ color: step.color }} 
                  />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                  <p className="text-muted-foreground">{step.description}</p>
                </div>
              </div>

              <div className="bg-muted/50 rounded-xl p-4 space-y-2">
                {step.tips.map((tip, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <CheckCircle2 
                      className="h-5 w-5 mt-0.5 flex-shrink-0" 
                      style={{ color: step.color }} 
                    />
                    <span className="text-sm">{tip}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between p-4 border-t bg-muted/30">
              <Button 
                variant="ghost" 
                onClick={handlePrevious}
                disabled={currentStep === 0}
                data-testid="button-previous-step"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>

              <div className="flex gap-1.5">
                {WALKTHROUGH_STEPS.map((_, index) => (
                  <button
                    key={index}
                    className="w-2 h-2 rounded-full transition-all duration-200"
                    style={{
                      backgroundColor: index === currentStep 
                        ? 'hsl(var(--trade))' 
                        : 'hsl(var(--muted-foreground) / 0.3)'
                    }}
                    onClick={() => setCurrentStep(index)}
                    data-testid={`dot-step-${index}`}
                  />
                ))}
              </div>

              <Button 
                onClick={handleNext}
                className="text-white"
                style={{ backgroundColor: 'hsl(var(--trade))' }}
                data-testid="button-next-step"
              >
                {currentStep === WALKTHROUGH_STEPS.length - 1 ? (
                  <>
                    Get Started
                    <CheckCircle2 className="h-4 w-4 ml-1" />
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
        )}
      </DialogContent>
    </Dialog>
  );
}

export function useWalkthroughReset() {
  const resetWalkthrough = () => {
    localStorage.removeItem(STORAGE_KEY);
  };

  const hasSeenWalkthrough = () => {
    return localStorage.getItem(STORAGE_KEY) === "true";
  };

  return { resetWalkthrough, hasSeenWalkthrough };
}
