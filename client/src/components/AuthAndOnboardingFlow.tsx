import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Loader2, 
  User, 
  Building, 
  Mail, 
  AlertCircle, 
  CheckCircle, 
  ArrowRight, 
  ArrowLeft,
  Zap,
  CreditCard,
  Settings,
  X,
  Phone,
  Globe,
  Lock,
  Eye,
  EyeOff,
  Chrome
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import appIconUrl from '@assets/Photo 1-12-2025, 6 03 07 pm (1)_1764576362665.png';

interface AuthAndOnboardingFlowProps {
  onComplete: () => void;
}

type FlowStep = 'auth' | 'business' | 'complete';

export default function AuthAndOnboardingFlow({ onComplete }: AuthAndOnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState<FlowStep>('auth');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showGoogleAccountPicker, setShowGoogleAccountPicker] = useState(false);
  const { toast } = useToast();

  // Check if user is already authenticated (from Google OAuth) and skip to business setup
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (res.ok) {
          const user = await res.json();
          // Check if business settings exist
          const businessRes = await fetch('/api/business-settings', { credentials: 'include' });
          if (businessRes.status === 404) {
            // User is authenticated but no business settings - go to business setup
            setCurrentStep('business');
          }
        }
      } catch (err) {
        // Not authenticated, stay on auth page
      }
    };
    checkAuthStatus();
  }, []);

  // Authentication data
  const [loginData, setLoginData] = useState({
    email: '',
    password: ''
  });

  // Account creation data
  const [accountData, setAccountData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    username: ''
  });

  // Business setup data
  const [businessData, setBusinessData] = useState({
    teamSize: '',
    numberOfEmployees: '1',
    businessName: '',
    tradeType: '',
    abn: '',
    phone: '',
    address: '',
    gstEnabled: true,
    defaultHourlyRate: '120',
    calloutFee: '90'
  });

  const tradeTypes = [
    { value: 'plumbing', label: 'Plumbing' },
    { value: 'electrical', label: 'Electrical' },
    { value: 'carpentry', label: 'Carpentry' },
    { value: 'hvac', label: 'Air Conditioning & Heating' },
    { value: 'painting', label: 'Painting' },
    { value: 'landscaping', label: 'Landscaping' },
    { value: 'other', label: 'Other' }
  ];

  const getStepProgress = () => {
    const stepOrder = ['auth', 'business', 'complete'];
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentStep === 'auth') return authMode === 'login' ? 100 : 25;
    return Math.max(0, ((currentIndex + 1) / stepOrder.length) * 100);
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 'auth':
        return authMode === 'login' ? 'Welcome Back' : 'Create Account';
      case 'business':
        return 'Business Setup';
      case 'complete':
        return 'All Set!';
      default:
        return 'Welcome';
    }
  };

  const getStepDescription = () => {
    switch (currentStep) {
      case 'auth':
        return authMode === 'login' 
          ? 'Sign in to your TradieTrack account'
          : 'Create your professional trade business account';
      case 'business':
        return 'Set up your business details and trade information';
      case 'complete':
        return 'Your TradieTrack account is ready to use';
      default:
        return '';
    }
  };

  const handleGoogleSignIn = () => {
    // Show account picker in development mode to simulate Google's account selection
    setShowGoogleAccountPicker(true);
  };

  const handleSelectGoogleAccount = (accountIndex: number) => {
    setShowGoogleAccountPicker(false);
    // In production, the prompt=select_account parameter handles this
    // In development, we simulate by redirecting to the OAuth endpoint
    window.location.href = '/api/auth/google';
  };

  const handleLogin = async () => {
    if (!loginData.email || !loginData.password) {
      setError('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await apiRequest('POST', '/api/auth/login', {
        email: loginData.email,
        password: loginData.password
      });
      
      const result = await response.json();

      if (result.success) {
        toast({
          title: "Login successful!",
          description: "Welcome back to TradieTrack!"
        });
        
        // Check if business settings exist
        try {
          const businessRes = await fetch('/api/business-settings', { credentials: 'include' });
          if (businessRes.status === 404) {
            // User is authenticated but no business settings - go to business setup
            setCurrentStep('business');
            return;
          } else if (businessRes.ok) {
            // User has business settings - complete the flow
            onComplete();
            return;
          } else {
            // Unexpected error - log it but proceed to let main app handle routing
            console.error('Failed to check business settings:', businessRes.status);
            toast({
              variant: "destructive",
              title: "Warning",
              description: "Could not verify account setup. Proceeding anyway..."
            });
          }
        } catch (err) {
          console.error('Error checking business settings:', err);
          // Network error or similar - show warning and proceed anyway
          toast({
            variant: "destructive",
            title: "Warning",
            description: "Could not verify account setup. Proceeding anyway..."
          });
        }
        
        // Fallback: proceed to main app
        onComplete();
      } else {
        setError(result.error || 'Login failed');
      }
    } catch (error: any) {
      setError(error.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!accountData.email || !accountData.password || !accountData.firstName) {
      setError('Please fill in all required fields');
      return;
    }

    if (accountData.password !== accountData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (accountData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await apiRequest('POST', '/api/auth/register', accountData);
      const result = await response.json();

      if (result.success) {
        toast({
          title: "Account created!",
          description: "Please check your email to verify your account."
        });
        setCurrentStep('business');
      } else {
        setError(result.error || 'Registration failed');
      }
    } catch (error: any) {
      setError(error.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBusinessSetup = async () => {
    if (!businessData.teamSize || !businessData.businessName || !businessData.tradeType) {
      setError('Please fill in all required business information');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Ensure numeric values are valid strings
      const hourlyRate = businessData.defaultHourlyRate?.trim() || '120';
      const callout = businessData.calloutFee?.trim() || '90';
      
      // Validate they're numeric strings
      if (isNaN(Number(hourlyRate)) || isNaN(Number(callout))) {
        setError('Hourly rate and callout fee must be valid numbers');
        setIsLoading(false);
        return;
      }

      // Create business settings with team size
      await apiRequest('POST', '/api/business-settings', {
        teamSize: businessData.teamSize,
        numberOfEmployees: parseInt(businessData.numberOfEmployees) || 1,
        businessName: businessData.businessName,
        tradeType: businessData.tradeType,
        abn: businessData.abn || null,
        phone: businessData.phone || null,
        address: businessData.address || null,
        gstEnabled: businessData.gstEnabled,
        defaultHourlyRate: hourlyRate,
        calloutFee: callout
      });

      // Invalidate cached data so dashboard will have fresh data for the checklist
      await queryClient.invalidateQueries({ queryKey: ['/api/business-settings'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });

      toast({
        title: "Business setup complete!",
        description: "Your business information has been saved."
      });

      // Skip integrations step - go straight to complete (integrations are platform-level)
      setCurrentStep('complete');
      
      // Auto-complete after showing success
      setTimeout(() => {
        onComplete();
      }, 2000);
    } catch (error: any) {
      setError(error.message || 'Failed to save business settings');
    } finally {
      setIsLoading(false);
    }
  };


  const renderAuthStep = () => (
    <div className="space-y-8">
      {/* Logo Icon + Title - Updated Dec 1 2024 v2 */}
      <div className="flex flex-col items-center text-center space-y-4">
        <div className="w-28 h-28 flex items-center justify-center">
          <img src={`${appIconUrl}?v=2`} alt="TradieTrack Logo" className="w-full h-full object-contain drop-shadow-xl" data-testid="img-login-logo" />
        </div>
        <div className="space-y-1">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-500 to-blue-600 bg-clip-text text-transparent">
            TradieTrack
          </h1>
          <p className="text-muted-foreground text-sm font-medium">
            Professional Business Management
          </p>
        </div>
      </div>

      <Tabs value={authMode} onValueChange={(value) => setAuthMode(value as 'login' | 'register')} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login">Sign In</TabsTrigger>
          <TabsTrigger value="register">Create Account</TabsTrigger>
        </TabsList>

        <TabsContent value="login" className="space-y-4">
          <Card className="border-none shadow-lg">
            <CardContent className="space-y-4 pt-6">
              {/* Google Sign-In Button */}
              <Button 
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                variant="outline"
                className="w-full h-12 text-base font-medium"
                data-testid="button-google-signin"
              >
                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or continue with email</span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={loginData.email}
                    onChange={(e) => setLoginData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="your@email.com"
                    data-testid="input-login-email"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={loginData.password}
                      onChange={(e) => setLoginData(prev => ({ ...prev, password: e.target.value }))}
                      placeholder="Enter your password"
                      data-testid="input-login-password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                      data-testid="button-toggle-password-visibility"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>

                <Button 
                  onClick={handleLogin}
                  disabled={isLoading}
                  className="w-full h-11"
                  data-testid="button-login"
                >
                  {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Sign In
                </Button>

                {/* Beta Mode Banner */}
                <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <Zap className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-green-900 dark:text-green-100">Free During Beta</p>
                      <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                        All features are free and unlimited during the beta period. We'll notify you before any changes.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="register" className="space-y-4">
          <Card className="border-none shadow-lg">
            <CardContent className="space-y-4 pt-6">
              {/* Google Sign-In Button */}
              <Button 
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                variant="outline"
                className="w-full h-12 text-base font-medium"
                data-testid="button-google-signup"
              >
                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or create with email</span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input
                      id="firstName"
                      value={accountData.firstName}
                      onChange={(e) => setAccountData(prev => ({ ...prev, firstName: e.target.value }))}
                      placeholder="John"
                      data-testid="input-first-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={accountData.lastName}
                      onChange={(e) => setAccountData(prev => ({ ...prev, lastName: e.target.value }))}
                      placeholder="Smith"
                      data-testid="input-last-name"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="registerEmail">Email *</Label>
                  <Input
                    id="registerEmail"
                    type="email"
                    value={accountData.email}
                    onChange={(e) => setAccountData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="your@email.com"
                    data-testid="input-register-email"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="registerPassword">Password *</Label>
                  <div className="relative">
                    <Input
                      id="registerPassword"
                      type={showPassword ? "text" : "password"}
                      value={accountData.password}
                      onChange={(e) => setAccountData(prev => ({ ...prev, password: e.target.value }))}
                      placeholder="At least 8 characters"
                      data-testid="input-register-password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password *</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={accountData.confirmPassword}
                      onChange={(e) => setAccountData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      placeholder="Confirm your password"
                      data-testid="input-confirm-password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>

                <Button 
                  onClick={handleRegister}
                  disabled={isLoading}
                  className="w-full h-11"
                  data-testid="button-register"
                >
                  {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create Account
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="text-center text-sm text-muted-foreground">
        <p>
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );

  const renderBusinessStep = () => (
    <div className="space-y-6">
      <div className="grid gap-4">
        {/* Team Size Question - First and Most Important */}
        <div className="grid gap-3 p-4 border-2 border-primary/20 rounded-lg bg-primary/5">
          <div className="flex items-start gap-2">
            <div className="w-full">
              <Label htmlFor="teamSize" className="text-base font-semibold">How many people work in your business? *</Label>
              <p className="text-sm text-muted-foreground mt-1">
                This helps us customize your experience
              </p>
            </div>
          </div>
          <Select
            value={businessData.teamSize}
            onValueChange={(value) => {
              setBusinessData(prev => ({ 
                ...prev, 
                teamSize: value,
                numberOfEmployees: value === 'solo' ? '1' : value === 'small' ? '3' : value === 'medium' ? '10' : '25'
              }));
            }}
          >
            <SelectTrigger data-testid="select-team-size" className="h-11">
              <SelectValue placeholder="Select team size" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="solo">
                <div className="flex flex-col items-start">
                  <span className="font-medium">Just me (Solo Tradie)</span>
                  <span className="text-xs text-muted-foreground">Simple setup for one person</span>
                </div>
              </SelectItem>
              <SelectItem value="small">
                <div className="flex flex-col items-start">
                  <span className="font-medium">Small Team (2-5 people)</span>
                  <span className="text-xs text-muted-foreground">Basic team features</span>
                </div>
              </SelectItem>
              <SelectItem value="medium">
                <div className="flex flex-col items-start">
                  <span className="font-medium">Growing Business (6-20 people)</span>
                  <span className="text-xs text-muted-foreground">Advanced scheduling & management</span>
                </div>
              </SelectItem>
              <SelectItem value="large">
                <div className="flex flex-col items-start">
                  <span className="font-medium">Established Company (20+ people)</span>
                  <span className="text-xs text-muted-foreground">Full team management suite</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {businessData.teamSize && (
          <>
            <div className="grid gap-2">
              <Label htmlFor="businessName">Business Name *</Label>
              <Input
                id="businessName"
                value={businessData.businessName}
                onChange={(e) => setBusinessData(prev => ({ ...prev, businessName: e.target.value }))}
                placeholder="Your Business Name"
                data-testid="input-business-name"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="tradeType">Trade Type *</Label>
              <Select
                value={businessData.tradeType}
                onValueChange={(value) => setBusinessData(prev => ({ ...prev, tradeType: value }))}
              >
                <SelectTrigger data-testid="select-trade-type">
                  <SelectValue placeholder="Select your trade" />
                </SelectTrigger>
                <SelectContent>
                  {tradeTypes.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="abn">ABN (optional)</Label>
              <Input
                id="abn"
                value={businessData.abn}
                onChange={(e) => setBusinessData(prev => ({ ...prev, abn: e.target.value }))}
                placeholder="12 345 678 901"
                data-testid="input-abn"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input
                id="phone"
                value={businessData.phone}
                onChange={(e) => setBusinessData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="04XX XXX XXX"
                data-testid="input-phone"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="address">Business Address (optional)</Label>
              <Input
                id="address"
                value={businessData.address}
                onChange={(e) => setBusinessData(prev => ({ ...prev, address: e.target.value }))}
                placeholder="123 Main St, Sydney NSW 2000"
                data-testid="input-address"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="hourlyRate">Default Hourly Rate (AUD)</Label>
                <Input
                  id="hourlyRate"
                  type="number"
                  value={businessData.defaultHourlyRate}
                  onChange={(e) => setBusinessData(prev => ({ ...prev, defaultHourlyRate: e.target.value }))}
                  placeholder="120"
                  data-testid="input-hourly-rate"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="calloutFee">Callout Fee (AUD)</Label>
                <Input
                  id="calloutFee"
                  type="number"
                  value={businessData.calloutFee}
                  onChange={(e) => setBusinessData(prev => ({ ...prev, calloutFee: e.target.value }))}
                  placeholder="90"
                  data-testid="input-callout-fee"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <Label htmlFor="gstEnabled">GST Registration</Label>
                <p className="text-sm text-muted-foreground">
                  Include GST (10%) in quotes and invoices
                </p>
              </div>
              <Switch
                id="gstEnabled"
                checked={businessData.gstEnabled}
                onCheckedChange={(checked) => setBusinessData(prev => ({ ...prev, gstEnabled: checked }))}
                data-testid="switch-gst-enabled"
              />
            </div>
          </>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setCurrentStep('auth')} data-testid="button-back">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button 
          onClick={handleBusinessSetup}
          disabled={isLoading || !businessData.teamSize || !businessData.businessName || !businessData.tradeType}
          className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
          data-testid="button-continue-business"
        >
          {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Get Started
          <CheckCircle className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );

  const renderCompleteStep = () => (
    <div className="space-y-6 text-center">
      <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-green-600 rounded-full flex items-center justify-center mx-auto">
        <CheckCircle className="w-8 h-8 text-white" />
      </div>
      
      <div>
        <h2 className="text-2xl font-bold text-green-600 mb-2">Welcome to TradieTrack!</h2>
        <p className="text-muted-foreground">
          Your account is now set up and ready to help you manage your trade business efficiently.
        </p>
      </div>

      <div className="grid gap-3 text-left max-w-md mx-auto">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <span className="text-sm">Business details configured</span>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <span className="text-sm">Account ready for jobs and quotes</span>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <span className="text-sm">Integration preferences saved</span>
        </div>
      </div>

      <Button
        onClick={onComplete}
        className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
        data-testid="button-get-started"
      >
        Get Started
        <ArrowRight className="w-4 h-4 ml-2" />
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md mx-auto">
        {/* Progress bar - only show after auth */}
        {currentStep !== 'auth' && (
          <div className="mb-8">
            <Progress value={getStepProgress()} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>Setup Progress</span>
              <span>{Math.round(getStepProgress())}%</span>
            </div>
          </div>
        )}

        <Card className="border-2 border-orange-500/30 dark:border-orange-500/40 shadow-2xl">
          <CardHeader className="text-center pb-6">
            <CardTitle className="text-xl font-bold">{getStepTitle()}</CardTitle>
            <CardDescription>{getStepDescription()}</CardDescription>
          </CardHeader>
          <CardContent>
            {currentStep === 'auth' && renderAuthStep()}
            {currentStep === 'business' && renderBusinessStep()}
            {currentStep === 'complete' && renderCompleteStep()}
          </CardContent>
        </Card>

        {currentStep === 'auth' && (
          <div className="mt-6 text-center">
            <Badge variant="outline" className="text-xs">
              Secure & Professional
            </Badge>
          </div>
        )}
      </div>

      {/* Google Account Picker Dialog */}
      <Dialog open={showGoogleAccountPicker} onOpenChange={setShowGoogleAccountPicker}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <svg className="w-6 h-6" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Choose an account
            </DialogTitle>
            <DialogDescription>
              to continue to TradieTrack
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground text-center">
              Select a Google account to sign in with TradieTrack
            </p>
            
            <Button
              variant="outline"
              className="w-full justify-start h-auto py-3 px-4"
              onClick={() => handleSelectGoogleAccount(0)}
              data-testid="google-account-primary"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold">
                  <User className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <div className="font-medium">Continue with Google</div>
                  <div className="text-sm text-muted-foreground">Use your Google account</div>
                </div>
              </div>
            </Button>

            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setShowGoogleAccountPicker(false)}
              data-testid="google-account-cancel"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}