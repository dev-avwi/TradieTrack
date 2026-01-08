import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Play,
  ChevronRight,
  ChevronLeft,
  Briefcase,
  FileText,
  DollarSign,
  Receipt,
  Users,
  Settings,
  CheckCircle2,
  Sparkles,
  Gift,
  Trophy,
  Star,
  ArrowRight,
  Rocket,
  Target,
  Zap,
  Clock,
  MapPin,
  Camera,
  MessageSquare,
  X,
  Lock
} from "lucide-react";

interface ImmersiveOnboardingProps {
  onComplete: () => void;
  businessSettings: any;
}

interface LearningLevel {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  icon: typeof Briefcase;
  color: string;
  reward: string;
  steps: {
    title: string;
    description: string;
    icon: typeof Briefcase;
  }[];
}

const LEARNING_LEVELS: LearningLevel[] = [
  {
    id: 1,
    title: "The Basics",
    subtitle: "Learn how jobs flow through TradieTrack",
    description: "Understand the core workflow: Create jobs, track progress, and get paid.",
    icon: Target,
    color: "#3b82f6",
    reward: "Unlock quick actions",
    steps: [
      { title: "Create Your First Job", description: "Add a job with client details, address, and description", icon: Briefcase },
      { title: "Track Job Progress", description: "Move jobs through stages: Pending → Scheduled → In Progress → Complete", icon: ArrowRight },
      { title: "Complete a Job", description: "Mark a job as done and add final notes", icon: CheckCircle2 }
    ]
  },
  {
    id: 2,
    title: "Core Features",
    subtitle: "Master quoting and invoicing",
    description: "Create professional quotes, convert to invoices, and collect payments.",
    icon: FileText,
    color: "#10b981",
    reward: "Enable AI suggestions",
    steps: [
      { title: "Create a Quote", description: "Build professional quotes with line items and GST", icon: FileText },
      { title: "Send to Client", description: "Email or SMS your quote directly to clients", icon: MessageSquare },
      { title: "Convert to Invoice", description: "Turn accepted quotes into invoices instantly", icon: DollarSign },
      { title: "Collect Payment", description: "Accept card payments or bank transfers", icon: Receipt }
    ]
  },
  {
    id: 3,
    title: "Quick Wins",
    subtitle: "Time-saving features",
    description: "Discover shortcuts and automations that save you hours every week.",
    icon: Zap,
    color: "#f59e0b",
    reward: "Unlock automations",
    steps: [
      { title: "Template Library", description: "Save and reuse common job types and quote items", icon: FileText },
      { title: "Auto Reminders", description: "Set up automatic payment reminders", icon: Clock },
      { title: "Quick Actions", description: "Use the floating AI chat for instant help", icon: Sparkles },
      { title: "Photo Documentation", description: "Take before/after photos attached to jobs", icon: Camera }
    ]
  },
  {
    id: 4,
    title: "Power User",
    subtitle: "Advanced capabilities",
    description: "Team management, integrations, and business insights.",
    icon: Rocket,
    color: "#8b5cf6",
    reward: "Full feature access",
    steps: [
      { title: "Team Management", description: "Add team members and assign jobs", icon: Users },
      { title: "Live Tracking", description: "See your team's location on the map", icon: MapPin },
      { title: "Xero Integration", description: "Sync invoices with your accounting software", icon: Settings },
      { title: "Business Analytics", description: "View KPIs and performance insights", icon: Trophy }
    ]
  }
];

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
  const [phase, setPhase] = useState<'welcome' | 'walkthrough' | 'roadmap' | 'complete'>('welcome');
  const [walkthroughStep, setWalkthroughStep] = useState(0);
  const [expandedLevel, setExpandedLevel] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const serverLevel = businessSettings?.onboardingLevel || 0;
  const [localLevel, setLocalLevel] = useState(serverLevel);

  useEffect(() => {
    setLocalLevel(serverLevel);
  }, [serverLevel]);

  const markWalkthroughComplete = useMutation({
    mutationFn: async () => {
      await apiRequest('PATCH', '/api/business-settings', { 
        hasSeenWalkthrough: true,
        onboardingLevel: Math.max(localLevel, 1)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/business-settings'] });
      onComplete();
    }
  });

  const updateOnboardingLevel = useMutation({
    mutationFn: async (level: number) => {
      await apiRequest('PATCH', '/api/business-settings', { onboardingLevel: level });
      return level;
    },
    onSuccess: (level) => {
      setLocalLevel(level);
    }
  });

  const handleStartWalkthrough = () => {
    setPhase('walkthrough');
    setWalkthroughStep(0);
  };

  const handleSkipWalkthrough = () => {
    setPhase('roadmap');
  };

  const handleWalkthroughNext = () => {
    if (walkthroughStep < JOB_WALKTHROUGH_STEPS.length - 1) {
      setWalkthroughStep(prev => prev + 1);
    } else {
      setPhase('roadmap');
    }
  };

  const handleWalkthroughPrev = () => {
    if (walkthroughStep > 0) {
      setWalkthroughStep(prev => prev - 1);
    }
  };

  const handleCompleteLevel = (levelId: number) => {
    if (levelId > localLevel) {
      updateOnboardingLevel.mutate(levelId);
    }
  };

  const handleFinish = () => {
    markWalkthroughComplete.mutate();
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
                  See Roadmap
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

  if (phase === 'roadmap') {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col overflow-hidden" data-testid="onboarding-roadmap">
        <div className="flex items-center justify-between gap-2 p-4 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-primary/10">
              <Trophy className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-bold text-lg" data-testid="text-roadmap-title">Learning Roadmap</h1>
              <p className="text-sm text-muted-foreground" data-testid="text-roadmap-subtitle">Complete levels to unlock features</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={handleClose}
            data-testid="button-close-roadmap"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium" data-testid="text-progress-label">Your Progress</span>
                <span className="text-sm text-muted-foreground" data-testid="text-progress-value">Level {localLevel} of 4</span>
              </div>
              <Progress value={(localLevel / 4) * 100} className="h-2" data-testid="progress-roadmap" />
              <div className="flex justify-between mt-2">
                {[1, 2, 3, 4].map(level => (
                  <div 
                    key={level}
                    className={`flex items-center gap-1 text-xs ${level <= localLevel ? 'text-primary' : 'text-muted-foreground'}`}
                    data-testid={`indicator-level-${level}`}
                  >
                    {level <= localLevel ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <div className="w-3 h-3 rounded-full border-2 border-current" />
                    )}
                    <span>L{level}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {LEARNING_LEVELS.map((level, idx) => {
            const LevelIcon = level.icon;
            const isLocked = idx > localLevel;
            const isComplete = idx < localLevel;
            const isCurrent = idx === localLevel;
            const isExpanded = expandedLevel === level.id;

            return (
              <Card 
                key={level.id}
                className={`transition-all duration-300 ${isLocked ? 'opacity-60' : ''} ${isCurrent ? 'ring-2 ring-primary' : ''}`}
                data-testid={`level-card-${level.id}`}
              >
                <CardContent className="p-4">
                  <button 
                    type="button"
                    className="flex items-center gap-4 cursor-pointer w-full text-left"
                    onClick={() => setExpandedLevel(isExpanded ? null : level.id)}
                    data-testid={`button-expand-level-${level.id}`}
                  >
                    <div 
                      className="w-14 h-14 rounded-md flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${level.color}15` }}
                    >
                      {isComplete ? (
                        <CheckCircle2 className="h-7 w-7" style={{ color: level.color }} />
                      ) : isLocked ? (
                        <Lock className="h-7 w-7 text-muted-foreground" />
                      ) : (
                        <LevelIcon className="h-7 w-7" style={{ color: level.color }} />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center flex-wrap gap-2">
                        <h3 className="font-semibold" data-testid={`text-level-title-${level.id}`}>Level {level.id}: {level.title}</h3>
                        {isComplete && (
                          <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" data-testid={`badge-complete-level-${level.id}`}>
                            Complete
                          </Badge>
                        )}
                        {isCurrent && (
                          <Badge variant="outline" data-testid={`badge-current-level-${level.id}`}>
                            Current
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground" data-testid={`text-level-subtitle-${level.id}`}>{level.subtitle}</p>
                      <div className="flex items-center gap-1 mt-1 text-xs" style={{ color: level.color }}>
                        <Gift className="h-3 w-3" />
                        <span data-testid={`text-level-reward-${level.id}`}>{level.reward}</span>
                      </div>
                    </div>

                    <ChevronRight className={`h-5 w-5 text-muted-foreground transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`} />
                  </button>

                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t space-y-3" data-testid={`content-level-${level.id}`}>
                      <p className="text-sm text-muted-foreground" data-testid={`text-level-description-${level.id}`}>{level.description}</p>
                      <div className="space-y-2">
                        {level.steps.map((step, stepIdx) => {
                          const StepIcon = step.icon;
                          const stepComplete = isComplete || (isCurrent && stepIdx < 0);
                          return (
                            <div 
                              key={stepIdx}
                              className="flex items-start gap-3 p-2 rounded-md bg-muted/50"
                              data-testid={`step-${level.id}-${stepIdx + 1}`}
                            >
                              <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${level.color}15` }}>
                                {stepComplete ? (
                                  <CheckCircle2 className="h-4 w-4" style={{ color: level.color }} />
                                ) : (
                                  <StepIcon className="h-4 w-4" style={{ color: level.color }} />
                                )}
                              </div>
                              <div>
                                <p className="text-sm font-medium">{step.title}</p>
                                <p className="text-xs text-muted-foreground">{step.description}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {!isComplete && !isLocked && (
                        <Button 
                          className="w-full mt-3"
                          onClick={() => handleCompleteLevel(level.id)}
                          data-testid={`button-complete-level-${level.id}`}
                        >
                          <Star className="h-4 w-4 mr-2" />
                          Mark as Complete
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="p-4 border-t bg-background">
          <Button 
            size="lg" 
            className="w-full"
            onClick={handleFinish}
            data-testid="button-start-using"
          >
            <Rocket className="h-5 w-5 mr-2" />
            Start Using TradieTrack
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
