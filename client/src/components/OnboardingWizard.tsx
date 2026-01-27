import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, ArrowLeft, ArrowRight, Building2, Palette, DollarSign, Users, LogOut, Sparkles, Wrench, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import tradietrackLogo from "/logo.png";

// Import step components
import TeamSizeStep from "./onboarding/TeamSizeStep";
import BusinessProfileStep from "./onboarding/BusinessProfileStep";
import BrandingStep from "./onboarding/BrandingStep";
import DefaultRatesStep from "./onboarding/DefaultRatesStep";
import TeamInvitationStep from "./onboarding/TeamInvitationStep";

export interface OnboardingData {
  // Team Size - FIRST QUESTION
  teamSize: {
    teamSize: 'solo' | 'small' | 'medium' | 'large';
  };
  
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
  
  // Team Invitation (optional - only for non-solo)
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

const ALL_STEPS = [
  {
    id: 'team-size',
    title: 'Team Size',
    description: 'How many people in your business?',
    icon: Users,
    required: true,
    color: 'orange',
    bgColor: 'bg-orange-500',
    lightBg: 'bg-orange-50',
    textColor: 'text-orange-600',
    borderColor: 'border-orange-200',
    showForSolo: true,
  },
  {
    id: 'business-profile',
    title: 'Business Profile',
    description: 'Set up your company information',
    icon: Building2,
    required: true,
    color: 'blue',
    bgColor: 'bg-blue-500',
    lightBg: 'bg-blue-50',
    textColor: 'text-blue-600',
    borderColor: 'border-blue-200',
    showForSolo: true,
  },
  {
    id: 'branding',
    title: 'Branding',
    description: 'Customize your business appearance',
    icon: Palette,
    required: false,
    color: 'green',
    bgColor: 'bg-green-500',
    lightBg: 'bg-green-50',
    textColor: 'text-green-600',
    borderColor: 'border-green-200',
    showForSolo: true,
  },
  {
    id: 'default-rates',
    title: 'Default Rates',
    description: 'Configure your pricing and terms',
    icon: DollarSign,
    required: true,
    color: 'blue',
    bgColor: 'bg-blue-500',
    lightBg: 'bg-blue-50',
    textColor: 'text-blue-600',
    borderColor: 'border-blue-200',
    showForSolo: true,
  },
  {
    id: 'team-invitation',
    title: 'Team Setup',
    description: 'Invite your team members',
    icon: Users,
    required: false,
    color: 'purple',
    bgColor: 'bg-purple-500',
    lightBg: 'bg-purple-50',
    textColor: 'text-purple-600',
    borderColor: 'border-purple-200',
    showForSolo: false, // Only show for teams
  },
];

export default function OnboardingWizard({ onComplete, onSkip, onSignOut }: OnboardingWizardProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [finalizationRequested, setFinalizationRequested] = useState(false);
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({
    teamSize: {
      teamSize: 'solo', // Default to solo
    },
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

  // Filter steps based on team size - solo users skip team invitation
  const isSolo = onboardingData.teamSize.teamSize === 'solo';
  const STEPS = ALL_STEPS.filter(step => isSolo ? step.showForSolo : true);

  // Calculate progress percentage
  const progressPercentage = ((currentStep + 1) / STEPS.length) * 100;

  // Map step IDs to OnboardingData keys
  const STEP_KEY_MAPPING: Record<string, keyof OnboardingData> = {
    'team-size': 'teamSize',
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
      case 'team-size':
        return (
          <TeamSizeStep
            data={onboardingData.teamSize}
            onComplete={(data) => handleStepComplete(currentStep, data)}
          />
        );
      
      case 'business-profile':
        return (
          <BusinessProfileStep
            data={onboardingData.businessProfile}
            onComplete={(data) => handleStepComplete(currentStep, data)}
            onPrevious={handlePrevious}
            isFirst={false}
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

  const currentStepData = STEPS[currentStep];

  return (
    <div className="min-h-screen relative overflow-hidden" data-testid="onboarding-wizard">
      {/* Vibrant gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-blue-500 to-orange-400" />
      
      {/* Decorative shapes */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-orange-400/30 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-700/40 rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2" />
      <div className="absolute top-1/2 left-1/4 w-64 h-64 bg-white/10 rounded-full blur-2xl" />
      
      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto p-4 md:p-6 min-h-screen flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <img src={tradietrackLogo} alt="TradieTrack" className="h-10 w-auto" />
            <span className="text-xl font-bold text-white hidden sm:inline">
              <span className="text-white">Tradie</span>
              <span className="text-orange-200">Track</span>
            </span>
          </div>
          {onSignOut && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={onSignOut}
              data-testid="button-signout-onboarding"
              className="text-white/80 hover:text-white hover:bg-white/10"
            >
              <LogOut className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Wrong account?</span> Sign out
            </Button>
          )}
        </div>
        
        {/* Header with welcome message */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm text-white text-sm font-medium px-4 py-2 rounded-full mb-4">
            <Sparkles className="h-4 w-4" />
            Getting you set up
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">
            Welcome to TradieTrack!
          </h1>
          <p className="text-lg text-blue-100 max-w-md mx-auto">
            Let's get your business set up in just a few quick steps
          </p>
        </div>

        {/* Step Progress Cards */}
        <div className="flex justify-center gap-2 sm:gap-3 mb-8 flex-wrap">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === currentStep;
            const isCompleted = completedSteps.has(index);
            const isPast = index < currentStep;
            
            return (
              <div
                key={step.id}
                className={`relative flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-3 rounded-xl transition-all duration-300 ${
                  isActive
                    ? 'bg-white text-gray-900 shadow-lg scale-105'
                    : isCompleted
                    ? 'bg-green-400/90 text-white'
                    : isPast
                    ? 'bg-white/30 text-white'
                    : 'bg-white/20 text-white/70'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  isActive 
                    ? `${step.lightBg} ${step.textColor}` 
                    : isCompleted 
                    ? 'bg-green-500 text-white'
                    : 'bg-white/20'
                }`}>
                  {isCompleted ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>
                <div className="hidden sm:block">
                  <p className="text-sm font-semibold leading-tight">{step.title}</p>
                  {step.required && !isCompleted && isActive && (
                    <span className="text-xs opacity-75">Required</span>
                  )}
                </div>
                {/* Connector line */}
                {index < STEPS.length - 1 && (
                  <div className={`hidden md:block absolute -right-3 top-1/2 w-3 h-0.5 ${
                    isCompleted || isPast ? 'bg-white/50' : 'bg-white/20'
                  }`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Progress indicator */}
        <div className="max-w-md mx-auto w-full mb-6">
          <div className="flex items-center justify-between text-white/80 text-sm mb-2">
            <span>Step {currentStep + 1} of {STEPS.length}</span>
            <span>{Math.round(progressPercentage)}% complete</span>
          </div>
          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-orange-400 to-orange-300 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        {/* Current Step Content Card */}
        <div className="flex-1 mb-6">
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            {/* Step header bar */}
            <div className={`px-6 py-4 ${currentStepData.lightBg} ${currentStepData.borderColor} border-b flex items-center gap-3`}>
              <div className={`w-10 h-10 rounded-xl ${currentStepData.bgColor} text-white flex items-center justify-center shadow-sm`}>
                <currentStepData.icon className="h-5 w-5" />
              </div>
              <div>
                <h2 className={`font-semibold ${currentStepData.textColor}`}>{currentStepData.title}</h2>
                <p className="text-sm text-gray-500">{currentStepData.description}</p>
              </div>
            </div>
            
            {/* Step content */}
            <div className="p-2">
              {renderCurrentStep()}
            </div>
          </div>
        </div>

        {/* Skip Option */}
        {onSkip && (
          <div className="text-center pb-4">
            <Button 
              variant="ghost" 
              onClick={onSkip}
              data-testid="button-skip-onboarding"
              className="text-white/80 hover:text-white hover:bg-white/10"
            >
              Skip Setup (Complete Later)
            </Button>
          </div>
        )}
        
        {/* Decorative footer element */}
        <div className="flex justify-center gap-2 pb-4">
          <Wrench className="h-5 w-5 text-white/30" />
          <Zap className="h-5 w-5 text-orange-300/50" />
          <Wrench className="h-5 w-5 text-white/30" />
        </div>
      </div>
    </div>
  );
}