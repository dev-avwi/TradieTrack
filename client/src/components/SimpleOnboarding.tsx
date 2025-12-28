import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
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
  Briefcase,
  Phone,
  Mail,
  MapPin
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import tradietrackLogo from "/tradietrack-logo.png";

interface SimpleOnboardingProps {
  onComplete: () => void;
  onSkip?: () => void;
}

const TRADE_TYPES = [
  { id: 'electrical', label: 'Electrician', icon: Zap, color: 'bg-yellow-500' },
  { id: 'plumbing', label: 'Plumber', icon: Droplets, color: 'bg-blue-500' },
  { id: 'carpentry', label: 'Carpenter', icon: Hammer, color: 'bg-amber-600' },
  { id: 'painting', label: 'Painter', icon: Paintbrush, color: 'bg-purple-500' },
  { id: 'building', label: 'Builder', icon: Building2, color: 'bg-gray-600' },
  { id: 'hvac', label: 'HVAC', icon: Wind, color: 'bg-cyan-500' },
  { id: 'roofing', label: 'Roofer', icon: Home, color: 'bg-red-500' },
  { id: 'general', label: 'General Trade', icon: Wrench, color: 'bg-green-500' },
];

const STEPS = [
  { id: 'trade', title: 'Your Trade', description: 'What kind of work do you do?' },
  { id: 'business', title: 'Business Details', description: 'Quick business setup' },
  { id: 'done', title: 'All Set!', description: 'You\'re ready to go' },
];

export default function SimpleOnboarding({ onComplete, onSkip }: SimpleOnboardingProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    tradeType: '',
    businessName: '',
    abn: '',
    phone: '',
    email: '',
    address: '',
    gstRegistered: true,
    hourlyRate: '85',
  });

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
        await apiRequest('/api/business-settings', {
          method: 'POST',
          body: JSON.stringify({
            businessName: formData.businessName,
            abn: formData.abn,
            phone: formData.phone,
            email: formData.email,
            address: formData.address,
            tradeType: formData.tradeType,
            gstEnabled: formData.gstRegistered,
            defaultHourlyRate: parseFloat(formData.hourlyRate) || 85,
            calloutFee: 90,
            teamSize: 'solo',
            onboardingCompleted: true,
          }),
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
    
    if (currentStep === 2) {
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

  const renderTradeStep = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          What's your trade?
        </h2>
        <p className="text-muted-foreground">
          This helps us customize TradieTrack for your business
        </p>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {TRADE_TYPES.map((trade) => {
          const Icon = trade.icon;
          const isSelected = formData.tradeType === trade.id;
          
          return (
            <button
              key={trade.id}
              onClick={() => handleTradeSelect(trade.id)}
              data-testid={`trade-${trade.id}`}
              className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 hover-elevate ${
                isSelected 
                  ? 'border-primary bg-primary/10' 
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <div className={`w-12 h-12 rounded-xl ${trade.color} text-white flex items-center justify-center`}>
                <Icon className="h-6 w-6" />
              </div>
              <span className={`text-sm font-medium ${isSelected ? 'text-primary' : ''}`}>
                {trade.label}
              </span>
              {isSelected && (
                <CheckCircle className="h-4 w-4 text-primary" />
              )}
            </button>
          );
        })}
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

  const renderDoneStep = () => (
    <div className="text-center py-8 space-y-6">
      <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
        <CheckCircle className="h-10 w-10 text-green-600" />
      </div>
      
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          You're all set!
        </h2>
        <p className="text-muted-foreground max-w-sm mx-auto">
          Welcome to TradieTrack. You can add more details in Settings anytime.
        </p>
      </div>
      
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
      
      <Button onClick={handleNext} size="lg" className="px-8" data-testid="button-start">
        <Sparkles className="mr-2 h-4 w-4" />
        Start Using TradieTrack
      </Button>
    </div>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 0:
        return renderTradeStep();
      case 1:
        return renderBusinessStep();
      case 2:
        return renderDoneStep();
      default:
        return null;
    }
  };

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
