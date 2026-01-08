import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Play,
  ChevronRight,
  ChevronLeft,
  FileText,
  DollarSign,
  Users,
  CheckCircle2,
  Sparkles,
  Gift,
  Clock,
  Camera,
  X
} from "lucide-react";

interface ImmersiveOnboardingProps {
  onComplete: () => void;
  businessSettings: any;
}

const JOB_WALKTHROUGH_STEPS = [
  {
    title: "A New Lead Calls",
    description: "Sarah calls about a leaky tap. You're on another job, so you quickly add her details in TradieTrack.",
    action: "Create client & job",
    icon: Users,
    color: "#3b82f6"
  },
  {
    title: "Schedule the Visit",
    description: "You drag the job to tomorrow at 10am. TradieTrack sends Sarah a confirmation SMS automatically.",
    action: "Set appointment time",
    icon: Clock,
    color: "#10b981"
  },
  {
    title: "On-Site Assessment",
    description: "You arrive, take photos of the issue, and check-in with GPS. The app tracks your time automatically.",
    action: "Document the job",
    icon: Camera,
    color: "#f59e0b"
  },
  {
    title: "Create a Quote",
    description: "You build a quote with labour, parts, and GST. Sarah receives it by email with a 'View Quote' button.",
    action: "Send professional quote",
    icon: FileText,
    color: "#8b5cf6"
  },
  {
    title: "Quote Accepted!",
    description: "Sarah accepts online. You convert the quote to a job and schedule the repair work.",
    action: "Convert to job",
    icon: CheckCircle2,
    color: "#10b981"
  },
  {
    title: "Complete the Work",
    description: "You fix the tap, take 'after' photos, and mark the job complete. TradieTrack generates an invoice.",
    action: "Finish & invoice",
    icon: DollarSign,
    color: "#3b82f6"
  },
  {
    title: "Get Paid!",
    description: "Sarah taps 'Pay Now' in her email. Stripe processes the card. You get a notification: Cha-ching!",
    action: "Collect payment",
    icon: Gift,
    color: "#10b981"
  }
];

export default function ImmersiveOnboarding({ onComplete, businessSettings }: ImmersiveOnboardingProps) {
  const [phase, setPhase] = useState<'welcome' | 'walkthrough'>('welcome');
  const [walkthroughStep, setWalkthroughStep] = useState(0);
  const queryClient = useQueryClient();

  const markWalkthroughComplete = useMutation({
    mutationFn: async () => {
      await apiRequest('PATCH', '/api/business-settings', { 
        hasSeenWalkthrough: true
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/business-settings'] });
      onComplete();
    }
  });

  const handleStartWalkthrough = () => {
    setPhase('walkthrough');
    setWalkthroughStep(0);
  };

  const handleSkipWalkthrough = () => {
    markWalkthroughComplete.mutate();
  };

  const handleWalkthroughNext = () => {
    if (walkthroughStep < JOB_WALKTHROUGH_STEPS.length - 1) {
      setWalkthroughStep(prev => prev + 1);
    } else {
      markWalkthroughComplete.mutate();
    }
  };

  const handleWalkthroughPrev = () => {
    if (walkthroughStep > 0) {
      setWalkthroughStep(prev => prev - 1);
    }
  };

  const handleClose = () => {
    markWalkthroughComplete.mutate();
  };

  if (phase === 'welcome') {
    return (
      <div className="fixed inset-0 z-50 bg-gradient-to-br from-primary via-primary/90 to-primary/80 flex items-center justify-center p-4" data-testid="onboarding-welcome">
        <div className="max-w-lg w-full text-center text-white space-y-8">
          <div className="space-y-2">
            <div className="mx-auto w-20 h-20 bg-white/20 backdrop-blur rounded-md flex items-center justify-center mb-6">
              <Sparkles className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-4xl font-bold" data-testid="text-welcome-greeting">G'day, {businessSettings?.businessName?.split(' ')[0] || 'Mate'}!</h1>
            <p className="text-xl text-white/80" data-testid="text-welcome-subtitle">Welcome to TradieTrack</p>
          </div>

          <Card className="bg-white/10 border-white/20 backdrop-blur">
            <CardContent className="p-6 space-y-4">
              <p className="text-lg text-white/90" data-testid="text-welcome-description">
                Let us show you around in <strong>2 minutes</strong>. We'll walk through the life of a job - from the first call to getting paid.
              </p>
              <div className="flex items-center justify-center gap-2 text-white/70">
                <Gift className="h-5 w-5" />
                <span className="text-sm" data-testid="text-reward-hint">Complete the tour to unlock AI suggestions</span>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <Button 
              size="lg"
              className="w-full h-14 text-lg font-semibold bg-white text-primary hover:bg-white/90"
              onClick={handleStartWalkthrough}
              data-testid="button-start-tour"
            >
              <Play className="h-5 w-5 mr-2" />
              Start the Tour
            </Button>
            <Button 
              variant="ghost"
              className="w-full text-white/70 hover:text-white hover:bg-white/10"
              onClick={handleSkipWalkthrough}
              data-testid="button-skip-tour"
            >
              I'll explore on my own
            </Button>
          </div>

          <p className="text-xs text-white/50" data-testid="text-replay-hint">
            You can replay this tour anytime from Settings
          </p>
        </div>
      </div>
    );
  }

  if (phase === 'walkthrough') {
    const step = JOB_WALKTHROUGH_STEPS[walkthroughStep];
    const progress = ((walkthroughStep + 1) / JOB_WALKTHROUGH_STEPS.length) * 100;
    const StepIcon = step.icon;

    return (
      <div className="fixed inset-0 z-50 bg-background dark:bg-slate-900 flex flex-col" data-testid="onboarding-walkthrough">
        <div className="flex items-center justify-between gap-2 p-4 border-b">
          <div className="flex items-center gap-3">
            <Badge variant="secondary" data-testid="badge-life-of-job">
              Life of a Job
            </Badge>
            <span className="text-sm text-muted-foreground" data-testid="text-step-counter">
              Step {walkthroughStep + 1} of {JOB_WALKTHROUGH_STEPS.length}
            </span>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleClose}
            data-testid="button-close-walkthrough"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <Progress value={progress} className="h-1 rounded-none" data-testid="progress-walkthrough" />

        <div className="flex-1 flex items-center justify-center p-6">
          <Card className="max-w-md w-full">
            <CardContent className="p-8 space-y-8 text-center">
              <div 
                className="mx-auto w-24 h-24 rounded-md flex items-center justify-center transition-all duration-500"
                style={{ backgroundColor: `${step.color}15` }}
                data-testid={`icon-step-${walkthroughStep + 1}`}
              >
                <StepIcon className="h-12 w-12" style={{ color: step.color }} />
              </div>

              <div className="space-y-3">
                <h2 className="text-2xl font-bold" data-testid="text-step-title">{step.title}</h2>
                <p className="text-lg text-muted-foreground leading-relaxed" data-testid="text-step-description">{step.description}</p>
              </div>

              <Badge 
                variant="outline"
                className="inline-flex items-center gap-2"
                data-testid="badge-step-action"
              >
                <CheckCircle2 className="h-4 w-4" style={{ color: step.color }} />
                {step.action}
              </Badge>
            </CardContent>
          </Card>
        </div>

        <div className="p-4 border-t bg-muted/50">
          <div className="max-w-md mx-auto flex items-center justify-between gap-2">
            <Button 
              variant="ghost" 
              onClick={handleWalkthroughPrev}
              disabled={walkthroughStep === 0}
              data-testid="button-walkthrough-prev"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>

            <div className="flex gap-1.5" data-testid="dots-step-progress">
              {JOB_WALKTHROUGH_STEPS.map((_, idx) => (
                <div
                  key={idx}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    idx === walkthroughStep 
                      ? 'bg-primary' 
                      : idx < walkthroughStep 
                        ? 'bg-green-500'
                        : 'bg-muted-foreground/30'
                  }`}
                  data-testid={`dot-step-${idx + 1}`}
                />
              ))}
            </div>

            <Button 
              onClick={handleWalkthroughNext}
              data-testid="button-walkthrough-next"
            >
              {walkthroughStep === JOB_WALKTHROUGH_STEPS.length - 1 ? (
                <>
                  Start Exploring
                  <ChevronRight className="h-4 w-4 ml-1" />
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
    );
  }

  return null;
}
