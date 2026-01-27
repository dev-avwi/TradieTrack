import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { 
  Wrench, 
  Zap, 
  Droplets, 
  Hammer, 
  Paintbrush, 
  Home, 
  Wind,
  Building2,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Sparkles,
  User,
  Users,
  Briefcase,
  Phone,
  Mail,
  MapPin,
  Gift,
  Loader2,
  MessageSquarePlus,
  FileText,
  Receipt
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import tradietrackLogo from "/logo.png";
import { tradeCatalog } from "@shared/tradeCatalog";

interface SimpleOnboardingProps {
  onComplete: () => void;
  onSkip?: () => void;
}

// Build trade options from the centralized catalog
const TRADE_OPTIONS = Object.entries(tradeCatalog).map(([id, trade]) => ({
  id,
  name: trade.name,
  description: trade.description,
}));

// Group trades into categories for better organization
const TRADE_CATEGORIES = [
  {
    label: "Electrical & Mechanical",
    trades: ['electrical', 'hvac'],
  },
  {
    label: "Plumbing & Water",
    trades: ['plumbing'],
  },
  {
    label: "Building & Construction",
    trades: ['building', 'concreting', 'roofing', 'fencing'],
  },
  {
    label: "Interior & Finishing",
    trades: ['painting', 'tiling'],
  },
  {
    label: "Outdoor & Landscaping",
    trades: ['landscaping', 'grounds_maintenance'],
  },
  {
    label: "Specialty Services",
    trades: ['cleaning', 'handyman'],
  },
];

const getStepsForPlan = (plan: string) => {
  const baseSteps = [
    { id: 'trade', title: 'Your Trade', description: 'What kind of work do you do?' },
    { id: 'business', title: 'Business Details', description: 'Quick business setup' },
  ];
  
  if (plan === 'team') {
    return [
      ...baseSteps,
      { id: 'team', title: 'Your Team', description: 'Set up your team structure' },
      { id: 'done', title: 'All Set!', description: 'You\'re ready to go' },
    ];
  }
  
  return [
    ...baseSteps,
    { id: 'done', title: 'All Set!', description: 'You\'re ready to go' },
  ];
};

export default function SimpleOnboarding({ onComplete, onSkip }: SimpleOnboardingProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Fetch user from API to get intendedTier (persisted on server)
  const { data: user, isLoading: userLoading } = useQuery<{
    id: string;
    intendedTier?: string;
    [key: string]: any;
  }>({
    queryKey: ['/api/auth/me'],
  });
  
  // Use intendedTier from user data, falling back to 'free'
  const selectedPlan = user?.intendedTier || 'free';
  const isTeamPlan = selectedPlan === 'team';
  const isProPlan = selectedPlan === 'pro';
  
  const STEPS = getStepsForPlan(selectedPlan);
  
  const [formData, setFormData] = useState({
    tradeType: '',
    businessName: '',
    abn: '',
    phone: '',
    email: '',
    address: '',
    gstRegistered: true,
    hourlyRate: '85',
    teamSize: 'solo',
  });
  
  // Update teamSize when user data loads
  useEffect(() => {
    if (user?.intendedTier === 'team') {
      setFormData(prev => ({ ...prev, teamSize: 'team' }));
    }
  }, [user?.intendedTier]);

  const progressPercentage = ((currentStep + 1) / STEPS.length) * 100;

  const handleTradeSelect = (tradeId: string) => {
    setFormData(prev => ({ ...prev, tradeType: tradeId }));
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleNext = async () => {
    if (currentStep === 0 && !formData.tradeType) {
      toast({ variant: "destructive", title: "Please select your trade" });
      return;
    }
    
    if (currentStep === 1) {
      if (!formData.businessName.trim()) {
        toast({ variant: "destructive", title: "Business name is required" });
        return;
      }
      
      setIsSubmitting(true);
      try {
        await apiRequest('POST', '/api/business-settings', {
          businessName: formData.businessName,
          abn: formData.abn,
          phone: formData.phone,
          email: formData.email,
          address: formData.address,
          tradeType: formData.tradeType,
          gstEnabled: formData.gstRegistered,
          defaultHourlyRate: parseFloat(formData.hourlyRate) || 85,
          calloutFee: 90,
          teamSize: isTeamPlan ? 'team' : 'solo',
          onboardingCompleted: !isTeamPlan, // Team plan completes after team step
        });
        
        await queryClient.invalidateQueries({ queryKey: ['/api/business-settings'] });
        setCurrentStep(2);
      } catch (error) {
        toast({ 
          variant: "destructive", 
          title: "Error saving settings", 
          description: error instanceof Error ? error.message : "Please try again" 
        });
      } finally {
        setIsSubmitting(false);
      }
      return;
    }
    
    // For Team plan, step 2 is the team setup step
    if (isTeamPlan && currentStep === 2) {
      // Team step - mark onboarding as complete and move to done step
      setIsSubmitting(true);
      try {
        await apiRequest('PATCH', '/api/business-settings', {
          onboardingCompleted: true,
        });
        await queryClient.invalidateQueries({ queryKey: ['/api/business-settings'] });
        setCurrentStep(3); // Move to done step
      } catch (error) {
        toast({ 
          variant: "destructive", 
          title: "Error saving settings", 
          description: error instanceof Error ? error.message : "Please try again" 
        });
      } finally {
        setIsSubmitting(false);
      }
      return;
    }
    
    // Done step - seed demo data and start trial for pro/team users before completing
    const doneStepIndex = isTeamPlan ? 3 : 2;
    if (currentStep === doneStepIndex) {
      setIsSubmitting(true);
      try {
        // Seed demo data so user has something to explore
        try {
          await apiRequest('POST', '/api/onboarding/seed-demo-data', {});
          // Invalidate all data queries so demo data shows up immediately
          await queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
          await queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
          await queryClient.invalidateQueries({ queryKey: ['/api/quotes'] });
          await queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
        } catch (error) {
          console.log('Demo data seeding skipped:', error);
          // Don't block onboarding if demo data fails
        }

        // If user selected pro or team, start their trial automatically
        if (isProPlan || isTeamPlan) {
          try {
            await apiRequest('POST', '/api/subscription/trial', {});
            await queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
            await queryClient.invalidateQueries({ queryKey: ['/api/subscription/status'] });
          } catch (error) {
            console.error('Failed to start trial:', error);
            // Don't block onboarding completion if trial start fails
            toast({
              title: "Trial activation pending",
              description: "You can activate your trial from the subscription settings.",
            });
          }
        }
      } finally {
        setIsSubmitting(false);
      }
      onComplete();
      return;
    }
    
    setCurrentStep(prev => prev + 1);
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const [showTradeRequest, setShowTradeRequest] = useState(false);
  const [requestedTrade, setRequestedTrade] = useState('');

  const handleRequestTrade = async () => {
    if (!requestedTrade.trim()) {
      toast({ variant: "destructive", title: "Please enter your trade type" });
      return;
    }
    
    try {
      // Submit the trade request (we'll use general for now)
      await apiRequest('POST', '/api/trade-requests', {
        tradeName: requestedTrade.trim(),
      });
      
      toast({
        title: "Trade request submitted",
        description: "We'll add your trade soon! For now, you'll use the General category.",
      });
      
      // Set to general and continue
      handleTradeSelect('general');
      setShowTradeRequest(false);
    } catch (error) {
      // If API doesn't exist yet, just continue with general
      handleTradeSelect('general');
      setShowTradeRequest(false);
      toast({
        title: "Request noted",
        description: "Using General category for now. We'll add your trade soon!",
      });
    }
  };

  const renderTradeStep = () => {
    const selectedTrade = formData.tradeType ? tradeCatalog[formData.tradeType] : null;
    
    return (
      <div className="space-y-6">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            What's your trade?
          </h2>
          <p className="text-muted-foreground">
            Select your trade category to customize TradieTrack for your business
          </p>
        </div>
        
        <div className="max-w-md mx-auto space-y-4">
          <div className="space-y-2">
            <Label htmlFor="trade-select" className="flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              Trade Category
            </Label>
            <Select
              value={formData.tradeType}
              onValueChange={handleTradeSelect}
            >
              <SelectTrigger id="trade-select" className="w-full h-12" data-testid="select-trade">
                <SelectValue placeholder="Select your trade..." />
              </SelectTrigger>
              <SelectContent>
                {TRADE_CATEGORIES.map((category) => (
                  <SelectGroup key={category.label}>
                    <SelectLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {category.label}
                    </SelectLabel>
                    {category.trades.map((tradeId) => {
                      const trade = tradeCatalog[tradeId];
                      if (!trade) return null;
                      return (
                        <SelectItem key={tradeId} value={tradeId} data-testid={`trade-${tradeId}`}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: trade.color }}
                            />
                            <span>{trade.name}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectGroup>
                ))}
                <SelectGroup>
                  <SelectLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Other
                  </SelectLabel>
                  <SelectItem value="general" data-testid="trade-general">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-gray-500" />
                      <span>General Trade Services</span>
                    </div>
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          {selectedTrade && (
            <div className="p-4 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-2 mb-2">
                <div 
                  className="w-4 h-4 rounded-full" 
                  style={{ backgroundColor: selectedTrade.color }}
                />
                <span className="font-medium">{selectedTrade.name}</span>
              </div>
              <p className="text-sm text-muted-foreground">{selectedTrade.description}</p>
              {selectedTrade.typicalJobs && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {selectedTrade.typicalJobs.slice(0, 4).map((job) => (
                    <span key={job} className="text-xs bg-background px-2 py-0.5 rounded-full border">
                      {job}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {!showTradeRequest ? (
            <button
              type="button"
              onClick={() => setShowTradeRequest(true)}
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <MessageSquarePlus className="h-4 w-4" />
              Can't find your trade? Request it
            </button>
          ) : (
            <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
              <Label htmlFor="request-trade">Request a new trade category</Label>
              <Input
                id="request-trade"
                placeholder="e.g. Glazier, Pool Technician..."
                value={requestedTrade}
                onChange={(e) => setRequestedTrade(e.target.value)}
              />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setShowTradeRequest(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleRequestTrade}>
                  Submit & Continue with General
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                We'll notify you when your trade category is added. For now, you'll use the General category.
              </p>
            </div>
          )}
        </div>
        
        <div className="flex justify-end pt-4">
          <Button 
            onClick={handleNext} 
            disabled={!formData.tradeType}
            size="lg"
            data-testid="button-next"
          >
            Continue
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  const renderBusinessStep = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Quick business setup
        </h2>
        <p className="text-muted-foreground">
          Just the basics to get you started
        </p>
      </div>
      
      <div className="space-y-4 max-w-md mx-auto">
        <div className="space-y-2">
          <Label htmlFor="businessName" className="flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            Business Name *
          </Label>
          <Input
            id="businessName"
            placeholder="e.g. Smith Electrical"
            value={formData.businessName}
            onChange={(e) => handleInputChange('businessName', e.target.value)}
            data-testid="input-business-name"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="phone" className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Phone Number
          </Label>
          <Input
            id="phone"
            placeholder="0400 000 000"
            value={formData.phone}
            onChange={(e) => handleInputChange('phone', e.target.value)}
            data-testid="input-phone"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="abn" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            ABN (optional)
          </Label>
          <Input
            id="abn"
            placeholder="XX XXX XXX XXX"
            value={formData.abn}
            onChange={(e) => handleInputChange('abn', e.target.value)}
            data-testid="input-abn"
          />
        </div>
        
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <div>
            <Label htmlFor="gst" className="font-medium">GST Registered</Label>
            <p className="text-xs text-muted-foreground">Add 10% GST to quotes and invoices</p>
          </div>
          <Switch
            id="gst"
            checked={formData.gstRegistered}
            onCheckedChange={(checked) => handleInputChange('gstRegistered', checked)}
            data-testid="switch-gst"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="hourlyRate" className="flex items-center gap-2">
            Default Hourly Rate
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
            <Input
              id="hourlyRate"
              type="number"
              placeholder="85"
              value={formData.hourlyRate}
              onChange={(e) => handleInputChange('hourlyRate', e.target.value)}
              className="pl-7"
              data-testid="input-hourly-rate"
            />
          </div>
        </div>
      </div>
      
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={handleBack} data-testid="button-back">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button 
          onClick={handleNext} 
          disabled={isSubmitting || !formData.businessName.trim()}
          size="lg"
          data-testid="button-next"
        >
          {isSubmitting ? 'Saving...' : 'Complete Setup'}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  const renderTeamStep = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          You're the Team Owner
        </h2>
        <p className="text-muted-foreground">
          As the owner, you'll manage your team and assign jobs to your workers
        </p>
      </div>
      
      <div className="bg-muted/50 rounded-xl p-5 max-w-md mx-auto space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-primary font-bold text-sm">1</span>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white">Beta Access Unlocked</h4>
            <p className="text-sm text-muted-foreground">Full Team features during beta - no credit card required</p>
          </div>
        </div>
        
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-primary font-bold text-sm">2</span>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white">Invite your workers</h4>
            <p className="text-sm text-muted-foreground">They'll get an email to join your team</p>
          </div>
        </div>
        
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-primary font-bold text-sm">3</span>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white">Assign jobs & track progress</h4>
            <p className="text-sm text-muted-foreground">Live GPS tracking and team chat included</p>
          </div>
        </div>
      </div>
      
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 max-w-md mx-auto">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <span className="font-semibold text-green-900 dark:text-green-100">Team Features Ready</span>
        </div>
        <p className="text-sm text-green-700 dark:text-green-300">
          After setup, go to Team Management to invite your first team member.
        </p>
      </div>
      
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={handleBack} data-testid="button-back">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button 
          onClick={handleNext} 
          disabled={isSubmitting}
          size="lg"
          data-testid="button-next"
        >
          {isSubmitting ? 'Saving...' : 'Continue'}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  const renderDoneStep = () => (
    <div className="text-center py-6 space-y-5">
      <div className="relative mx-auto w-24 h-24">
        <div className="absolute inset-0 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full animate-pulse opacity-20" />
        <div className="relative w-24 h-24 bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/40 dark:to-emerald-900/40 rounded-full flex items-center justify-center">
          <CheckCircle className="h-12 w-12 text-green-600" />
        </div>
      </div>
      
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          You're Ready to Go!
        </h2>
        <p className="text-muted-foreground max-w-sm mx-auto">
          We've set up sample data so you can explore the app right away.
        </p>
      </div>

      <div className="bg-muted/50 rounded-xl p-4 max-w-sm mx-auto text-left">
        <h3 className="font-medium text-center mb-3 flex items-center justify-center gap-2">
          <Sparkles className="h-4 w-4 text-orange-500" />
          What's Waiting for You
        </h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-500" />
            <span>5 sample clients</span>
          </div>
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-orange-500" />
            <span>6 example jobs</span>
          </div>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-purple-500" />
            <span>3 draft quotes</span>
          </div>
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-green-500" />
            <span>2 invoices</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground text-center mt-3">
          Click through these to see how everything works!
        </p>
      </div>
      
      {/* Plan-specific content */}
      {isTeamPlan ? (
        <>
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 max-w-sm mx-auto">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Gift className="h-5 w-5 text-green-600" />
              <span className="font-semibold text-green-900 dark:text-green-100">Team Beta Access Active</span>
            </div>
            <p className="text-sm text-green-700 dark:text-green-300 mb-3">
              You're the Team Owner! All Team features unlocked during beta.
            </p>
            <a href="/team" className="text-sm font-medium text-green-600 hover:text-green-700 dark:text-green-400">
              Go to Team Management →
            </a>
          </div>
        </>
      ) : isProPlan ? (
        <>
          <div className="bg-gradient-to-r from-blue-50 to-orange-50 dark:from-blue-900/20 dark:to-orange-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 max-w-sm mx-auto">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Gift className="h-5 w-5 text-orange-500" />
              <span className="font-semibold text-blue-900 dark:text-blue-100">Pro Features Unlocked</span>
            </div>
            <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
              All Pro features are free during beta - unlimited jobs, invoices, and AI!
            </p>
            <a href="/subscription" className="text-sm font-medium text-orange-600 hover:text-orange-700 dark:text-orange-400">
              View Plans →
            </a>
          </div>
        </>
      ) : (
        <>
          <div className="bg-muted/50 rounded-xl p-4 max-w-sm mx-auto">
            <h3 className="font-medium mb-3">Free Plan Includes:</h3>
            <ul className="text-sm text-muted-foreground space-y-2 text-left">
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Unlimited quotes
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                25 jobs per month
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                25 invoices per month
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                50 clients
              </li>
            </ul>
          </div>

          {/* Upgrade CTA for free plan */}
          <div className="bg-gradient-to-r from-blue-50 to-orange-50 dark:from-blue-900/20 dark:to-orange-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 max-w-sm mx-auto">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Gift className="h-5 w-5 text-orange-500" />
              <span className="font-semibold text-blue-900 dark:text-blue-100">Want Unlimited Access?</span>
            </div>
            <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
              All Pro features are unlocked during beta!
            </p>
            <a href="/subscription" className="text-sm font-medium text-orange-600 hover:text-orange-700 dark:text-orange-400">
              View Plans →
            </a>
          </div>
        </>
      )}
      
      <Button onClick={handleNext} size="lg" className="px-8" disabled={isSubmitting} data-testid="button-start">
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {isProPlan || isTeamPlan ? 'Activating Trial...' : 'Starting...'}
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-4 w-4" />
            {isTeamPlan ? 'Go to Dashboard' : 'Start Using TradieTrack'}
          </>
        )}
      </Button>
    </div>
  );

  const renderCurrentStep = () => {
    const stepId = STEPS[currentStep]?.id;
    switch (stepId) {
      case 'trade':
        return renderTradeStep();
      case 'business':
        return renderBusinessStep();
      case 'team':
        return renderTeamStep();
      case 'done':
        return renderDoneStep();
      default:
        return null;
    }
  };

  // Show loading state while fetching user data
  if (userLoading) {
    return (
      <div className="min-h-screen relative overflow-hidden" data-testid="simple-onboarding-loading">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-blue-500 to-orange-400" />
        <div className="relative z-10 flex items-center justify-center min-h-screen">
          <div className="flex flex-col items-center gap-4">
            <img src={tradietrackLogo} alt="TradieTrack" className="h-12 w-auto" />
            <Loader2 className="h-8 w-8 text-white animate-spin" />
            <span className="text-white/80 text-sm">Loading your setup...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden" data-testid="simple-onboarding">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-blue-500 to-orange-400" />
      
      <div className="absolute top-0 right-0 w-96 h-96 bg-orange-400/30 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-700/40 rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2" />
      
      <div className="relative z-10 max-w-2xl mx-auto p-4 md:p-6 min-h-screen flex flex-col">
        <div className="flex items-center justify-center gap-3 mb-6">
          <img src={tradietrackLogo} alt="TradieTrack" className="h-10 w-auto" />
          <span className="text-xl font-bold text-white">
            <span className="text-white">Tradie</span>
            <span className="text-orange-200">Track</span>
          </span>
        </div>
        
        {currentStep < 2 && (
          <>
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm text-white text-sm font-medium px-4 py-2 rounded-full mb-4 mx-auto">
              <Sparkles className="h-4 w-4" />
              Quick Setup - {currentStep + 1} of 2
            </div>
            
            <div className="max-w-md mx-auto w-full mb-6">
              <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-orange-400 to-orange-300 rounded-full transition-all duration-500"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>
          </>
        )}
        
        <Card className="flex-1 shadow-xl">
          <CardContent className="p-6">
            {renderCurrentStep()}
          </CardContent>
        </Card>
        
        {onSkip && currentStep < 2 && (
          <div className="text-center py-4">
            <Button 
              variant="ghost" 
              onClick={onSkip}
              className="text-white/80 hover:text-white hover:bg-white/10"
              data-testid="button-skip"
            >
              Skip for now
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
