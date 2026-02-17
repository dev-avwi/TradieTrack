import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  Receipt,
  CreditCard,
  Eye,
  Check,
  ExternalLink,
  Info,
  DollarSign,
  Camera,
  X,
  Plus
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import jobrunnerLogo from "@assets/jobrunner-logo-cropped.png";
import { tradeCatalog } from "@shared/tradeCatalog";

interface SimpleOnboardingProps {
  onComplete: () => void;
  onSkip?: () => void;
}

const TRADE_OPTIONS = Object.entries(tradeCatalog).map(([id, trade]) => ({
  id,
  name: trade.name,
  description: trade.description,
}));

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
    { id: 'trade', title: 'Trade', description: 'What kind of work do you do?' },
    { id: 'business', title: 'Business', description: 'Quick business setup' },
    { id: 'payments', title: 'Payments', description: 'Get paid faster' },
  ];
  
  if (plan === 'team') {
    return [
      ...baseSteps,
      { id: 'team', title: 'Team', description: 'Set up your team structure' },
      { id: 'portal', title: 'Preview', description: 'See your client portal' },
      { id: 'done', title: 'Done', description: 'You\'re ready to go' },
    ];
  }
  
  return [
    ...baseSteps,
    { id: 'portal', title: 'Preview', description: 'See your client portal' },
    { id: 'done', title: 'Done', description: 'You\'re ready to go' },
  ];
};

function StepIndicator({ steps, currentStep }: { steps: { id: string; title: string }[]; currentStep: number }) {
  return (
    <div className="w-full max-w-lg mx-auto mb-6">
      <div className="flex items-center justify-between relative">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isActive = index === currentStep;
          const isUpcoming = index > currentStep;

          return (
            <div key={step.id} className="flex flex-col items-center relative z-10" style={{ flex: index === 0 || index === steps.length - 1 ? '0 0 auto' : '1' }}>
              <div
                className={`w-8 h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                  isCompleted
                    ? 'bg-white text-green-600'
                    : isActive
                    ? 'bg-white text-blue-600 ring-4 ring-white/30'
                    : 'bg-white/20 text-white/60 border-2 border-white/30'
                }`}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              <span className={`mt-1.5 text-[10px] md:text-xs font-medium whitespace-nowrap transition-colors ${
                isCompleted || isActive ? 'text-white' : 'text-white/50'
              }`}>
                {step.title}
              </span>
            </div>
          );
        })}
        <div className="absolute top-4 left-0 right-0 h-0.5 bg-white/20 -z-0" style={{ marginLeft: '16px', marginRight: '16px' }}>
          <div
            className="h-full bg-white/60 transition-all duration-500"
            style={{ width: `${currentStep === 0 ? 0 : (currentStep / (steps.length - 1)) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export default function SimpleOnboarding({ onComplete, onSkip }: SimpleOnboardingProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stripeConnecting, setStripeConnecting] = useState(false);
  const [resumeChecked, setResumeChecked] = useState(false);
  
  const { data: user, isLoading: userLoading } = useQuery<{
    id: string;
    intendedTier?: string;
    [key: string]: any;
  }>({
    queryKey: ['/api/auth/me'],
  });
  
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

  useEffect(() => {
    if (user?.intendedTier === 'team') {
      setFormData(prev => ({ ...prev, teamSize: 'team' }));
    }
  }, [user?.intendedTier]);

  useEffect(() => {
    const checkExistingSettings = async () => {
      try {
        const res = await fetch('/api/business-settings', { credentials: 'include' });
        if (res.ok) {
          const settings = await res.json();
          if (!settings.onboardingCompleted) {
            if (settings.tradeType) {
              setFormData(prev => ({
                ...prev,
                tradeType: settings.tradeType || '',
                businessName: settings.businessName || '',
                abn: settings.abn || '',
                phone: settings.phone || '',
                gstRegistered: settings.gstEnabled ?? true,
                hourlyRate: String(settings.defaultHourlyRate || '85'),
              }));
              if (settings.businessName) {
                setCurrentStep(2);
              } else {
                setCurrentStep(1);
              }
            }
          }
        }
      } catch (e) {
        // No existing settings, start fresh
      } finally {
        setResumeChecked(true);
      }
    };
    checkExistingSettings();
  }, []);

  const handleTradeSelect = (tradeId: string) => {
    setFormData(prev => ({ ...prev, tradeType: tradeId }));
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const autoSaveTrade = async (tradeType: string) => {
    try {
      const res = await fetch('/api/business-settings', { credentials: 'include' });
      if (res.ok) {
        await apiRequest('PATCH', '/api/business-settings', {
          tradeType,
          onboardingCompleted: false,
        });
      } else if (res.status === 404) {
        await apiRequest('POST', '/api/business-settings', {
          tradeType,
          onboardingCompleted: false,
          businessName: '',
        });
      }
    } catch (e) {
      // Silent fail - auto-save is best effort
    }
  };

  const getStepIndexById = (id: string) => STEPS.findIndex(s => s.id === id);

  const handleNext = async () => {
    const stepId = STEPS[currentStep]?.id;

    if (stepId === 'trade') {
      if (!formData.tradeType) {
        toast({ variant: "destructive", title: "Please select your trade" });
        return;
      }
      autoSaveTrade(formData.tradeType);
      setCurrentStep(prev => prev + 1);
      return;
    }
    
    if (stepId === 'business') {
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
          onboardingCompleted: false,
          logoUrl: logoPreview || undefined,
        });
        
        await queryClient.invalidateQueries({ queryKey: ['/api/business-settings'] });
        setCurrentStep(prev => prev + 1);
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

    if (stepId === 'payments') {
      setCurrentStep(prev => prev + 1);
      return;
    }
    
    if (stepId === 'team') {
      setIsSubmitting(true);
      try {
        await apiRequest('PATCH', '/api/business-settings', {
          onboardingCompleted: false,
        });
        await queryClient.invalidateQueries({ queryKey: ['/api/business-settings'] });
        setCurrentStep(prev => prev + 1);
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

    if (stepId === 'portal') {
      setCurrentStep(prev => prev + 1);
      return;
    }
    
    if (stepId === 'done') {
      setIsSubmitting(true);
      try {
        if (teamInviteEmails.length > 0) {
          for (const email of teamInviteEmails) {
            try {
              await apiRequest('POST', '/api/team/invite', {
                email,
                role: 'tradie',
              });
            } catch (error) {
              console.log('Failed to send invite to:', email);
            }
          }
        }

        try {
          await apiRequest('POST', '/api/onboarding/seed-demo-data', {});
          await queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
          await queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
          await queryClient.invalidateQueries({ queryKey: ['/api/quotes'] });
          await queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
        } catch (error) {
          console.log('Demo data seeding skipped:', error);
        }

        if (isProPlan || isTeamPlan) {
          try {
            await apiRequest('POST', '/api/subscription/trial', {});
            await queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
            await queryClient.invalidateQueries({ queryKey: ['/api/subscription/status'] });
          } catch (error) {
            console.error('Failed to start trial:', error);
            toast({
              title: "Trial activation pending",
              description: "You can activate your trial from the subscription settings.",
            });
          }
        }

        try {
          await apiRequest('PATCH', '/api/business-settings', {
            onboardingCompleted: true,
          });
          await queryClient.invalidateQueries({ queryKey: ['/api/business-settings'] });
        } catch (e) {
          // best effort
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

  const handleStripeConnect = async () => {
    setStripeConnecting(true);
    try {
      const res = await apiRequest('POST', '/api/stripe-connect/onboard', {});
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast({ variant: "destructive", title: "Could not start Stripe setup", description: "Please try again later." });
      }
    } catch (error) {
      toast({ 
        variant: "destructive", 
        title: "Stripe connection failed", 
        description: error instanceof Error ? error.message : "Please try again later or skip for now." 
      });
    } finally {
      setStripeConnecting(false);
    }
  };

  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [teamInviteEmails, setTeamInviteEmails] = useState<string[]>([]);
  const [currentInviteEmail, setCurrentInviteEmail] = useState('');

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: "destructive", title: "File too large", description: "Please upload an image under 5MB" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setLogoPreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const [showTradeRequest, setShowTradeRequest] = useState(false);
  const [requestedTrade, setRequestedTrade] = useState('');

  const handleRequestTrade = async () => {
    if (!requestedTrade.trim()) {
      toast({ variant: "destructive", title: "Please enter your trade type" });
      return;
    }
    
    try {
      await apiRequest('POST', '/api/trade-requests', {
        tradeName: requestedTrade.trim(),
      });
      
      toast({
        title: "Trade request submitted",
        description: "We'll add your trade soon! For now, you'll use the General category.",
      });
      
      handleTradeSelect('general');
      setShowTradeRequest(false);
    } catch (error) {
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
            Select your trade category to customize JobRunner for your business
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
        <div className="flex flex-col items-center mb-4">
          <button
            type="button"
            onClick={() => logoInputRef.current?.click()}
            className="w-20 h-20 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center overflow-hidden transition-all"
          >
            {logoPreview ? (
              <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <Camera className="h-6 w-6 text-muted-foreground/50" />
            )}
          </button>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            onChange={handleLogoSelect}
            className="hidden"
          />
          <p className="text-xs text-muted-foreground mt-2">Add your logo (optional)</p>
        </div>

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
          <Label htmlFor="email" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Email
          </Label>
          <Input
            id="email"
            placeholder="hello@yourbusiness.com.au"
            value={formData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            data-testid="input-email"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="address" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Address
          </Label>
          <Input
            id="address"
            placeholder="123 Main St, Sydney NSW 2000"
            value={formData.address}
            onChange={(e) => handleInputChange('address', e.target.value)}
            data-testid="input-address"
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
          {isSubmitting ? 'Saving...' : 'Continue'}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  const renderPaymentsStep = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <div className="mx-auto w-16 h-16 bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/40 dark:to-blue-900/40 rounded-full flex items-center justify-center mb-4">
          <CreditCard className="h-8 w-8 text-purple-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Get Paid Faster
        </h2>
        <p className="text-muted-foreground max-w-sm mx-auto">
          Connect Stripe to accept card payments and send payment links
        </p>
      </div>
      
      <div className="max-w-md mx-auto space-y-4">
        <div className="bg-muted/30 rounded-xl p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center flex-shrink-0">
              <CreditCard className="h-4 w-4 text-purple-600" />
            </div>
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white">Accept card payments</h4>
              <p className="text-sm text-muted-foreground">Clients pay invoices directly online</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
              <ExternalLink className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white">Send payment links</h4>
              <p className="text-sm text-muted-foreground">One-click payment links via SMS or email</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center flex-shrink-0">
              <DollarSign className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white">Fast deposits</h4>
              <p className="text-sm text-muted-foreground">Funds deposited directly to your bank</p>
            </div>
          </div>
        </div>

        <Button 
          onClick={handleStripeConnect}
          disabled={stripeConnecting}
          size="lg"
          className="w-full"
        >
          {stripeConnecting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <CreditCard className="mr-2 h-4 w-4" />
              Connect Stripe
            </>
          )}
        </Button>

        <div className="flex items-start gap-2 px-1">
          <Info className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            You can always connect Stripe later from Settings
          </p>
        </div>
      </div>
      
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={handleBack} data-testid="button-back">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button 
          variant="ghost"
          onClick={handleNext}
          data-testid="button-skip-stripe"
        >
          Skip for now
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  const renderPortalStep = () => (
    <div className="space-y-6">
      <div className="text-center mb-4">
        <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40 rounded-full flex items-center justify-center mb-4">
          <Eye className="h-8 w-8 text-blue-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Your Client Portal
        </h2>
        <p className="text-muted-foreground max-w-sm mx-auto">
          See what your clients will see when they view quotes and invoices
        </p>
      </div>
      
      <div className="max-w-sm mx-auto">
        <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
          <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-3">
            <p className="text-white font-semibold text-sm">
              {formData.businessName || 'Your Business'}
            </p>
            <p className="text-blue-100 text-xs">Client Portal</p>
          </div>
          
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Quote #1024</p>
                <p className="text-sm font-semibold text-gray-900">Kitchen Renovation</p>
              </div>
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                Pending
              </span>
            </div>
            
            <div className="border-t pt-3 space-y-2">
              <div className="flex justify-between text-xs text-gray-600">
                <span>Demolition & prep work</span>
                <span className="font-medium">$850.00</span>
              </div>
              <div className="flex justify-between text-xs text-gray-600">
                <span>New cabinetry install</span>
                <span className="font-medium">$2,400.00</span>
              </div>
              <div className="flex justify-between text-xs text-gray-600">
                <span>Benchtop & splashback</span>
                <span className="font-medium">$1,200.00</span>
              </div>
              <div className="border-t pt-2 flex justify-between text-sm font-semibold text-gray-900">
                <span>Total (inc. GST)</span>
                <span>$4,895.00</span>
              </div>
            </div>
            
            <div className="flex gap-2 pt-1">
              <div className="flex-1 bg-green-600 text-white text-center text-xs font-medium py-2 rounded-md">
                Accept Quote
              </div>
              <div className="flex-1 bg-blue-600 text-white text-center text-xs font-medium py-2 rounded-md">
                Pay Invoice
              </div>
            </div>
          </div>
        </div>
        
        <p className="text-xs text-center text-muted-foreground mt-3">
          Clients receive a link to view and accept quotes or pay invoices online
        </p>
      </div>
      
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={handleBack} data-testid="button-back">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button 
          onClick={handleNext}
          size="lg"
          data-testid="button-next"
        >
          Continue
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

      <div className="max-w-md mx-auto space-y-3">
        <Label className="flex items-center gap-2">
          <Mail className="h-4 w-4" />
          Invite Team Members (optional)
        </Label>
        <div className="flex gap-2">
          <Input
            placeholder="team@example.com"
            type="email"
            value={currentInviteEmail}
            onChange={(e) => setCurrentInviteEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (currentInviteEmail.trim() && currentInviteEmail.includes('@')) {
                  setTeamInviteEmails(prev => [...prev, currentInviteEmail.trim()]);
                  setCurrentInviteEmail('');
                }
              }
            }}
            data-testid="input-team-invite-email"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (currentInviteEmail.trim() && currentInviteEmail.includes('@')) {
                setTeamInviteEmails(prev => [...prev, currentInviteEmail.trim()]);
                setCurrentInviteEmail('');
              }
            }}
            disabled={!currentInviteEmail.trim() || !currentInviteEmail.includes('@')}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {teamInviteEmails.length > 0 && (
          <div className="space-y-1">
            {teamInviteEmails.map((email, index) => (
              <div key={index} className="flex items-center justify-between bg-muted/50 rounded-md px-3 py-1.5 text-sm">
                <div className="flex items-center gap-2">
                  <Mail className="h-3 w-3 text-muted-foreground" />
                  <span>{email}</span>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => setTeamInviteEmails(prev => prev.filter((_, i) => i !== index))}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              Invites will be sent when you complete setup
            </p>
          </div>
        )}
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
            {isTeamPlan ? 'Go to Dashboard' : 'Start Using JobRunner'}
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
      case 'payments':
        return renderPaymentsStep();
      case 'team':
        return renderTeamStep();
      case 'portal':
        return renderPortalStep();
      case 'done':
        return renderDoneStep();
      default:
        return null;
    }
  };

  if (userLoading || !resumeChecked) {
    return (
      <div className="min-h-screen relative overflow-hidden" data-testid="simple-onboarding-loading">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-blue-500 to-orange-400" />
        <div className="relative z-10 flex items-center justify-center min-h-screen">
          <div className="flex flex-col items-center gap-4">
            <img src={jobrunnerLogo} alt="JobRunner" className="h-16 w-auto" />
            <Loader2 className="h-8 w-8 text-white animate-spin" />
            <span className="text-white/80 text-sm">Loading your setup...</span>
          </div>
        </div>
      </div>
    );
  }

  const currentStepId = STEPS[currentStep]?.id;
  const isDoneStep = currentStepId === 'done';

  return (
    <div className="min-h-screen relative overflow-hidden" data-testid="simple-onboarding">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-blue-500 to-orange-400" />
      
      <div className="absolute top-0 right-0 w-96 h-96 bg-orange-400/30 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-700/40 rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2" />
      
      <div className="relative z-10 max-w-2xl mx-auto p-4 md:p-6 min-h-screen flex flex-col">
        <div className="flex items-center justify-center gap-3 mb-6">
          <img src={jobrunnerLogo} alt="JobRunner" className="h-14 w-auto" />
          <span className="text-xl font-bold text-white">
            <span className="text-white">Job</span>
            <span className="text-orange-200">Runner</span>
          </span>
        </div>
        
        {!isDoneStep && (
          <StepIndicator steps={STEPS} currentStep={currentStep} />
        )}
        
        <Card className="flex-1 shadow-xl bg-white/95 backdrop-blur-sm border-white/50 [&_*]:text-gray-800 [&_.text-muted-foreground]:text-gray-500">
          <CardContent className="p-6">
            {renderCurrentStep()}
          </CardContent>
        </Card>
        
        {onSkip && !isDoneStep && (
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
