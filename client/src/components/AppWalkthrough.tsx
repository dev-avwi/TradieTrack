import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Briefcase,
  Users,
  FileText,
  Receipt,
  Settings,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Lightbulb,
  X,
  Sparkles,
  MapPin,
  Calendar,
  DollarSign,
  Camera,
  Mail,
  CreditCard
} from "lucide-react";

interface WalkthroughStep {
  id: string;
  title: string;
  description: string;
  icon: any;
  tips: string[];
  action?: {
    label: string;
    path: string;
  };
}

const WALKTHROUGH_STEPS: WalkthroughStep[] = [
  {
    id: "clients",
    title: "Add Your First Client",
    description: "Start by adding your customers to TradieTrack. You can quickly add clients with just a name and phone number, or add full details including email and address for invoicing.",
    icon: Users,
    tips: [
      "Use Quick Add to create clients on the fly when creating jobs",
      "Client addresses auto-fill when creating jobs for that client",
      "Keep client emails updated for sending quotes and invoices"
    ],
    action: {
      label: "Go to Clients",
      path: "/clients"
    }
  },
  {
    id: "jobs",
    title: "Create a Job",
    description: "Jobs are at the heart of TradieTrack. Create a job for each piece of work, schedule it, and track progress from start to finish.",
    icon: Briefcase,
    tips: [
      "Jobs flow through 5 stages: Pending → Scheduled → In Progress → Done → Invoiced",
      "Add photos to document your work before, during, and after",
      "Use the address field for navigation to job sites"
    ],
    action: {
      label: "Go to Jobs",
      path: "/jobs"
    }
  },
  {
    id: "quotes",
    title: "Send Professional Quotes",
    description: "Create detailed quotes for your customers with line items, GST calculation, and optional deposits. Convert accepted quotes to invoices with one tap.",
    icon: FileText,
    tips: [
      "GST is automatically calculated at 10% for Australian businesses",
      "Request deposits upfront to secure larger jobs",
      "Use templates to speed up common quote types"
    ],
    action: {
      label: "Go to Quotes",
      path: "/quotes"
    }
  },
  {
    id: "invoices",
    title: "Get Paid Faster",
    description: "Generate professional invoices and get paid online. Connect Stripe to accept card payments directly to your bank account.",
    icon: Receipt,
    tips: [
      "Connect Stripe in Settings to accept online payments",
      "Payment links are included automatically in invoice emails",
      "Set payment terms (e.g., 14 days) to stay on top of cash flow"
    ],
    action: {
      label: "Go to Invoices",
      path: "/invoices"
    }
  },
  {
    id: "settings",
    title: "Customise Your Setup",
    description: "Add your logo, set your rates, connect email and payment integrations. Make TradieTrack work the way you want.",
    icon: Settings,
    tips: [
      "Add your logo to appear on quotes and invoices",
      "Set default hourly rates and callout fees",
      "Connect Gmail or SendGrid for email delivery"
    ],
    action: {
      label: "Go to Settings",
      path: "/settings"
    }
  }
];

interface AppWalkthroughProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  onNavigate?: (path: string) => void;
}

export default function AppWalkthrough({ isOpen, onClose, onComplete, onNavigate }: AppWalkthroughProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());

  const step = WALKTHROUGH_STEPS[currentStep];
  const progress = ((currentStep + 1) / WALKTHROUGH_STEPS.length) * 100;
  const isLastStep = currentStep === WALKTHROUGH_STEPS.length - 1;
  const isFirstStep = currentStep === 0;

  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      setCompletedSteps(prev => new Set([...prev, step.id]));
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (!isFirstStep) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem("tradietrack-walkthrough-completed", "true");
    onComplete();
  };

  const handleSkip = () => {
    localStorage.setItem("tradietrack-walkthrough-skipped", "true");
    onClose();
  };

  const handleAction = () => {
    if (step.action && onNavigate) {
      onNavigate(step.action.path);
      setCompletedSteps(prev => new Set([...prev, step.id]));
      onClose();
    }
  };

  const StepIcon = step.icon;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg" data-testid="walkthrough-dialog">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <Badge variant="secondary" className="mb-2" data-testid="walkthrough-step-badge">
              Step {currentStep + 1} of {WALKTHROUGH_STEPS.length}
            </Badge>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleSkip}
              className="text-muted-foreground"
              data-testid="button-skip-walkthrough"
            >
              Skip Tour
            </Button>
          </div>
          <DialogTitle className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <StepIcon className="h-5 w-5 text-primary" />
            </div>
            {step.title}
          </DialogTitle>
          <DialogDescription className="text-base">
            {step.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Progress value={progress} className="h-2" data-testid="walkthrough-progress" />

          <Card className="bg-muted/50 border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                Pro Tips
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="space-y-2">
                {step.tips.map((tip, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    {tip}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <div className="flex items-center justify-center gap-2 py-2">
            {WALKTHROUGH_STEPS.map((s, index) => (
              <button
                key={s.id}
                onClick={() => setCurrentStep(index)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentStep
                    ? "bg-primary"
                    : completedSteps.has(s.id)
                    ? "bg-primary/50"
                    : "bg-muted-foreground/30"
                }`}
                data-testid={`walkthrough-dot-${index}`}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={isFirstStep}
            data-testid="button-walkthrough-previous"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>

          <div className="flex gap-2">
            {step.action && (
              <Button
                variant="secondary"
                onClick={handleAction}
                data-testid="button-walkthrough-action"
              >
                {step.action.label}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
            <Button
              onClick={handleNext}
              data-testid="button-walkthrough-next"
            >
              {isLastStep ? (
                <>
                  <Sparkles className="h-4 w-4 mr-1" />
                  Get Started
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
      </DialogContent>
    </Dialog>
  );
}

export function useAppWalkthrough() {
  const [showWalkthrough, setShowWalkthrough] = useState(false);

  const hasCompleted = useCallback(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem("tradietrack-walkthrough-completed") === "true" ||
           localStorage.getItem("tradietrack-walkthrough-skipped") === "true";
  }, []);

  const startWalkthrough = useCallback(() => {
    setShowWalkthrough(true);
  }, []);

  const closeWalkthrough = useCallback(() => {
    setShowWalkthrough(false);
  }, []);

  const completeWalkthrough = useCallback(() => {
    setShowWalkthrough(false);
  }, []);

  const resetWalkthrough = useCallback(() => {
    localStorage.removeItem("tradietrack-walkthrough-completed");
    localStorage.removeItem("tradietrack-walkthrough-skipped");
  }, []);

  return {
    showWalkthrough,
    hasCompleted,
    startWalkthrough,
    closeWalkthrough,
    completeWalkthrough,
    resetWalkthrough
  };
}

export function WalkthroughTrigger({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      className="gap-2"
      data-testid="button-start-walkthrough"
    >
      <Sparkles className="h-4 w-4" />
      App Tour
    </Button>
  );
}
