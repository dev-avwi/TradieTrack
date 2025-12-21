import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, ArrowLeft, ArrowRight, Building2, Palette, DollarSign, Users, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

// Import step components
import BusinessProfileStep from "./onboarding/BusinessProfileStep";
import BrandingStep from "./onboarding/BrandingStep";
import DefaultRatesStep from "./onboarding/DefaultRatesStep";
import TeamInvitationStep from "./onboarding/TeamInvitationStep";

export interface OnboardingData {
  // Business Profile
  businessProfile: {
    companyName: string;
    abn: string;
    contactEmail: string;
    contactPhone: string;
    address: string;
    city: string;
    state: string;
    postcode: string;
    gstRegistered: boolean;
    tradeType: string;
  };
  
  // Branding
  branding: {
    logoUrl?: string;
    primaryColor: string;
    quotePrefix: string;
    invoicePrefix: string;
    businessTagline: string;
  };
  
  // Default Rates
  defaultRates: {
    hourlyRate: number;
    calloutFee: number;
    paymentTerms: number; // days
    quoteValidityPeriod: number; // days
    gstRate: number;
  };
  
  // Team Invitation (optional)
  teamInvitation: {
    inviteTeamMembers: boolean;
    invitations: Array<{
      email: string;
      role: 'admin' | 'employee';
    }>;
  };
}

interface OnboardingWizardProps {
  onComplete: (data: OnboardingData) => void;
  onSkip?: () => void;
  onSignOut?: () => void;
}

const STEPS = [
  {
    id: 'business-profile',
    title: 'Business Profile',
    description: 'Set up your company information',
    icon: Building2,
    required: true,
  },
  {
    id: 'branding',
    title: 'Branding',
    description: 'Customize your business appearance',
    icon: Palette,
    required: false,
  },
  {
    id: 'default-rates',
    title: 'Default Rates',
    description: 'Configure your pricing and terms',
    icon: DollarSign,
    required: true,
  },
  {
    id: 'team-invitation',
    title: 'Team Setup',
    description: 'Invite team members (optional)',
    icon: Users,
    required: false,
  },
];

export default function OnboardingWizard({ onComplete, onSkip, onSignOut }: OnboardingWizardProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [finalizationRequested, setFinalizationRequested] = useState(false);
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({
    businessProfile: {
      companyName: '',
      abn: '',
      contactEmail: '',
      contactPhone: '',
      address: '',
      city: '',
      state: 'NSW', // Default to NSW for Australian trades
      postcode: '',
      gstRegistered: false,
      tradeType: 'plumbing', // Default to plumbing
    },
    branding: {
      primaryColor: '#2563eb', // Default blue
      quotePrefix: 'Q',
      invoicePrefix: 'INV',
      businessTagline: '',
    },
    defaultRates: {
      hourlyRate: 85, // Default Australian tradie rate
      calloutFee: 120,
      paymentTerms: 14, // 14 days payment terms
      quoteValidityPeriod: 30, // 30 days quote validity
      gstRate: 10, // Australian GST rate
    },
    teamInvitation: {
      inviteTeamMembers: false,
      invitations: [],
    },
  });

  // Calculate progress percentage
  const progressPercentage = ((currentStep + 1) / STEPS.length) * 100;

  // Map step IDs to OnboardingData keys
  const STEP_KEY_MAPPING: Record<string, keyof OnboardingData> = {
    'business-profile': 'businessProfile',
    'branding': 'branding', 
    'default-rates': 'defaultRates',
    'team-invitation': 'teamInvitation',
  };

  const handleStepComplete = (stepIndex: number, stepData: any) => {
    // Don't allow step completion if already submitting
    if (isSubmitting) {
      console.log('Already submitting onboarding, ignoring step completion');
      return;
    }
    
    const stepId = STEPS[stepIndex].id;
    const dataKey = STEP_KEY_MAPPING[stepId];
    
    if (!dataKey) {
      console.error(`Unknown step ID: ${stepId}`);
      return;
    }
    
    console.log(`Step ${stepId} completed with data:`, stepData);
    
    // Update onboarding data with functional update
    setOnboardingData(prev => ({
      ...prev,
      [dataKey]: {
        ...prev[dataKey],
        ...stepData,
      },
    }));
    
    // Mark step as completed with functional update
    setCompletedSteps(prev => new Set([...Array.from(prev), stepIndex]));
    
    // Advance to next step (if not last) - useEffect handles finalization for last step
    if (stepIndex < STEPS.length - 1) {
      setCurrentStep(stepIndex + 1);
    }
  };
  
  // Effect to handle finalization when last step is completed
  useEffect(() => {
    const lastStepIndex = STEPS.length - 1;
    if (
      completedSteps.has(lastStepIndex) &&
      !isSubmitting &&
      currentStep === lastStepIndex &&
      !finalizationRequested
    ) {
      setFinalizationRequested(true);
      void finalizeOnboarding(onboardingData, completedSteps);
    }
  }, [completedSteps, currentStep, isSubmitting, onboardingData, finalizationRequested]);

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const finalizeOnboarding = async (
    finalData: OnboardingData,
    finalCompletedSteps: Set<number>
  ) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    const requiredSteps = STEPS.map((step, index) => ({ step, index }))
      .filter(({ step }) => step.required);
    const missingRequiredSteps = requiredSteps.filter(
      ({ index }) => !finalCompletedSteps.has(index)
    );

    if (missingRequiredSteps.length > 0) {
      setCurrentStep(missingRequiredSteps[0].index);
      setIsSubmitting(false);
      setFinalizationRequested(false);
      return;
    }

    try {
      await onComplete(finalData);
    } catch (error) {
      console.error("Failed to complete onboarding", error);
      toast({
        variant: "destructive",
        title: "Unable to finish setup",
        description:
          error instanceof Error ? error.message : "Please try again in a moment.",
      });
      setIsSubmitting(false);
      setFinalizationRequested(false);
    }
  };

  const renderCurrentStep = () => {
    const stepId = STEPS[currentStep].id;
    
    switch (stepId) {
      case 'business-profile':
        return (
          <BusinessProfileStep
            data={onboardingData.businessProfile}
            onComplete={(data) => handleStepComplete(currentStep, data)}
            onPrevious={handlePrevious}
            isFirst={currentStep === 0}
          />
        );
      
      case 'branding':
        return (
          <BrandingStep
            data={onboardingData.branding}
            onComplete={(data) => handleStepComplete(currentStep, data)}
            onPrevious={handlePrevious}
          />
        );
      
      case 'default-rates':
        return (
          <DefaultRatesStep
            data={onboardingData.defaultRates}
            onComplete={(data) => handleStepComplete(currentStep, data)}
            onPrevious={handlePrevious}
          />
        );
      
      case 'team-invitation':
        return (
          <TeamInvitationStep
            data={onboardingData.teamInvitation}
            onComplete={(data) => handleStepComplete(currentStep, data)}
            onPrevious={handlePrevious}
            isLast={currentStep === STEPS.length - 1}
          />
        );
      
      default:
        // Placeholder for other steps
        const currentStepData = STEPS[currentStep];
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <currentStepData.icon className="h-6 w-6" />
                {currentStepData.title}
              </CardTitle>
              <CardDescription>
                {currentStepData.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <p className="text-muted-foreground">
                  This step will be implemented with the {currentStepData.title.toLowerCase()} form.
                </p>
                
                {/* Step Navigation */}
                <div className="flex justify-between">
                  <Button
                    variant="outline"
                    onClick={handlePrevious}
                    disabled={currentStep === 0}
                    data-testid="button-previous-step"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Previous
                  </Button>
                  
                  <div className="flex gap-2">
                    {!STEPS[currentStep].required && (
                      <Button
                        variant="ghost"
                        onClick={() => handleStepComplete(currentStep, {})}
                        data-testid="button-skip-step"
                      >
                        Skip Step
                      </Button>
                    )}
                    
                    <Button
                      onClick={() => handleStepComplete(currentStep, {})}
                      data-testid="button-next-step"
                    >
                      {currentStep === STEPS.length - 1 ? 'Complete Setup' : 'Continue'}
                      {currentStep < STEPS.length - 1 && (
                        <ArrowRight className="h-4 w-4 ml-2" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background" data-testid="onboarding-wizard">
      <div className="max-w-4xl mx-auto p-4 md:p-6">
        {/* Top bar with sign out option */}
        {onSignOut && (
          <div className="flex justify-end mb-4">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={onSignOut}
              data-testid="button-signout-onboarding"
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Wrong account? Sign out
            </Button>
          </div>
        )}
        
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Welcome to TradieTrack!</h1>
          <p className="text-muted-foreground mb-6">
            Let's get your business set up in just a few steps
          </p>
          
          {/* Progress Bar */}
          <div className="max-w-md mx-auto mb-4">
            <Progress value={progressPercentage} className="h-2" />
            <p className="text-sm text-muted-foreground mt-2">
              Step {currentStep + 1} of {STEPS.length}
            </p>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="flex flex-wrap justify-center mb-8 gap-2 md:gap-4">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === currentStep;
            const isCompleted = completedSteps.has(index);
            
            return (
              <div
                key={step.id}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-all ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : isCompleted
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
                <span className="text-sm font-medium hidden md:inline">
                  {step.title}
                </span>
                {step.required && !isCompleted && (
                  <Badge variant="secondary" className="text-xs hidden md:inline-flex">
                    Required
                  </Badge>
                )}
              </div>
            );
          })}
        </div>

        {/* Current Step Content */}
        <div className="mb-8">
          {renderCurrentStep()}
        </div>

        {/* Skip Option */}
        {onSkip && (
          <div className="text-center">
            <Button 
              variant="ghost" 
              onClick={onSkip}
              data-testid="button-skip-onboarding"
            >
              Skip Setup (Setup Later)
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}