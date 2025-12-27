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
  Chrome,
  SkipForward,
  Users,
  Link2
} from "lucide-react";
import { SiStripe } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";
import appIconUrl from '@assets/Photo 1-12-2025, 6 03 07 pm (1)_1764576362665.png';

interface AuthAndOnboardingFlowProps {
  onComplete: () => void;
}

type FlowStep = 'auth' | 'business' | 'integrations' | 'team' | 'complete';

export default function AuthAndOnboardingFlow({ onComplete }: AuthAndOnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState<FlowStep>('auth');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [isLoading, setIsLoading] = useState(false);
  
  // Check URL for mode parameter to set initial auth mode
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    if (mode === 'signup' || mode === 'register') {
      setAuthMode('register');
    } else if (mode === 'login') {
      setAuthMode('login');
    }
    // Clear any error query params on initial load
    if (params.has('error')) {
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, []);

  // Update URL when switching between login/register modes
  const handleModeChange = (mode: 'login' | 'register') => {
    setAuthMode(mode);
    setError('');
    // Update URL without page reload
    const newUrl = mode === 'login' ? '/auth' : '/auth?mode=signup';
    window.history.replaceState({}, '', newUrl);
  };

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showGoogleAccountPicker, setShowGoogleAccountPicker] = useState(false);
  const { toast } = useToast();

  // Check if user is already authenticated and determine onboarding state
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (res.ok) {
          const user = await res.json();
          // Check if business settings exist and are complete
          const businessRes = await fetch('/api/business-settings', { credentials: 'include' });
          if (businessRes.ok) {
            const settings = await businessRes.json();
            // If onboarding has been completed, skip the onboarding flow entirely
            if (settings.onboardingCompleted) {
              onComplete();
              return;
            }
            // Has settings but incomplete - go to business setup
            setSettingsExist(true);
            setBusinessData(prev => ({
              ...prev,
              teamSize: settings.teamSize || '',
              businessName: settings.businessName || '',
              tradeType: settings.tradeType || '',
              abn: settings.abn || '',
              phone: settings.phone || '',
              address: settings.address || '',
              gstEnabled: settings.gstEnabled ?? true,
              defaultHourlyRate: String(settings.defaultHourlyRate || '120'),
              calloutFee: String(settings.calloutFee || '90'),
            }));
            setCurrentStep('business');
          } else if (businessRes.status === 404) {
            // User is authenticated but no business settings - go to business setup
            setCurrentStep('business');
          }
        }
      } catch (err) {
        // Not authenticated, stay on auth page
      }
    };
    checkAuthStatus();
  }, [onComplete]);

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

  // Integration setup state
  const [stripeConnecting, setStripeConnecting] = useState(false);
  const [stripeConnected, setStripeConnected] = useState(false);

  // Team invite state (for team mode)
  const [teamInvites, setTeamInvites] = useState<{ email: string; role: string }[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('staff');
  const [sendingInvites, setSendingInvites] = useState(false);
  
  // Track if settings already exist (for POST vs PATCH decision)
  const [settingsExist, setSettingsExist] = useState(false);

  const tradeTypes = [
    { value: 'plumbing', label: 'Plumbing' },
    { value: 'electrical', label: 'Electrical' },
    { value: 'carpentry', label: 'Carpentry' },
    { value: 'hvac', label: 'Air Conditioning & Heating' },
    { value: 'painting', label: 'Painting' },
    { value: 'landscaping', label: 'Landscaping' },
    { value: 'other', label: 'Other' }
  ];

  // Check if user is in team mode (not solo)
  const isTeamMode = businessData.teamSize && businessData.teamSize !== 'solo';

  const getStepProgress = () => {
    // Different step counts for solo vs team
    const steps = isTeamMode 
      ? ['auth', 'business', 'integrations', 'team', 'complete']
      : ['auth', 'business', 'integrations', 'complete'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentStep === 'auth') return authMode === 'login' ? 100 : 20;
    return Math.max(0, ((currentIndex + 1) / steps.length) * 100);
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 'auth':
        return authMode === 'login' ? 'Welcome Back' : 'Create Account';
      case 'business':
        return 'Your Business';
      case 'integrations':
        return 'Get Paid Faster';
      case 'team':
        return 'Invite Your Team';
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
        return 'Tell us about your business';
      case 'integrations':
        return 'Set up payment collection (optional - you can do this later)';
      case 'team':
        return 'Add team members to get them set up (optional)';
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
      // Don't show "session_expired" error on login page - user is already trying to log in
      const errorMsg = error.message || 'Login failed';
      if (!errorMsg.includes('session_expired')) {
        setError(errorMsg);
      }
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
      // Don't show "session_expired" error on registration page
      const errorMsg = error.message || 'Registration failed';
      if (!errorMsg.includes('session_expired')) {
        setError(errorMsg);
      }
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

      // Create or update business settings with team size
      const method = settingsExist ? 'PATCH' : 'POST';
      await apiRequest(method, '/api/business-settings', {
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
      
      // Mark that settings now exist for future updates
      setSettingsExist(true);

      // Invalidate cached data so dashboard will have fresh data for the checklist
      await queryClient.invalidateQueries({ queryKey: ['/api/business-settings'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });

      toast({
        title: "Business setup complete!",
        description: "Your business information has been saved."
      });

      // Move to integrations step
      setCurrentStep('integrations');
    } catch (error: any) {
      setError(error.message || 'Failed to save business settings');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Stripe Connect onboarding
  const handleConnectStripe = async () => {
    setStripeConnecting(true);
    try {
      const response = await apiRequest('POST', '/api/stripe-connect/onboard');
      const data = await response.json();
      if (data.onboardingUrl) {
        window.location.href = data.onboardingUrl;
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Connection Failed",
        description: error.message || "Failed to start Stripe Connect setup"
      });
    } finally {
      setStripeConnecting(false);
    }
  };

  // Mark onboarding as complete in database
  const markOnboardingComplete = async () => {
    try {
      await apiRequest('PATCH', '/api/business-settings', { onboardingCompleted: true });
      await queryClient.invalidateQueries({ queryKey: ['/api/business-settings'] });
    } catch (error) {
      console.error('Failed to mark onboarding complete:', error);
    }
  };

  // Handle skipping integrations step
  const handleSkipIntegrations = async () => {
    if (isTeamMode) {
      setCurrentStep('team');
    } else {
      await markOnboardingComplete();
      setCurrentStep('complete');
      setTimeout(() => onComplete(), 2000);
    }
  };

  // Handle continuing from integrations
  const handleContinueFromIntegrations = async () => {
    if (isTeamMode) {
      setCurrentStep('team');
    } else {
      await markOnboardingComplete();
      setCurrentStep('complete');
      setTimeout(() => onComplete(), 2000);
    }
  };

  // Add team member to invite list
  const handleAddInvite = () => {
    if (!inviteEmail.trim()) return;
    if (teamInvites.some(i => i.email === inviteEmail.trim())) {
      toast({ title: "Already added", description: "This email is already in the invite list" });
      return;
    }
    setTeamInvites(prev => [...prev, { email: inviteEmail.trim(), role: inviteRole }]);
    setInviteEmail('');
    setInviteRole('staff');
  };

  // Remove from invite list
  const handleRemoveInvite = (email: string) => {
    setTeamInvites(prev => prev.filter(i => i.email !== email));
  };

  // Send all pending invites
  const handleSendInvites = async () => {
    if (teamInvites.length === 0) {
      await markOnboardingComplete();
      setCurrentStep('complete');
      setTimeout(() => onComplete(), 2000);
      return;
    }

    setSendingInvites(true);
    try {
      // Send invites one by one
      for (const invite of teamInvites) {
        await apiRequest('POST', '/api/team/invite', {
          email: invite.email,
          roleId: invite.role
        });
      }
      await markOnboardingComplete();
      toast({
        title: "Invites Sent!",
        description: `${teamInvites.length} team member${teamInvites.length > 1 ? 's' : ''} invited`
      });
      setCurrentStep('complete');
      setTimeout(() => onComplete(), 2000);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Invite Failed",
        description: error.message || "Failed to send some invites"
      });
    } finally {
      setSendingInvites(false);
    }
  };

  // Skip team step
  const handleSkipTeam = async () => {
    await markOnboardingComplete();
    setCurrentStep('complete');
    setTimeout(() => onComplete(), 2000);
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

      <Tabs value={authMode} onValueChange={(value) => handleModeChange(value as 'login' | 'register')} className="w-full">
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

  const renderIntegrationsStep = () => (
    <div className="space-y-6">
      <div className="text-center mb-4">
        <div className="w-14 h-14 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <CreditCard className="w-7 h-7 text-white" />
        </div>
        <p className="text-sm text-muted-foreground">
          Connect Stripe to accept card payments directly to your bank account. 
          Takes just 2 minutes to set up.
        </p>
      </div>

      <Card className="border-2 border-dashed">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
              <SiStripe className="w-6 h-6 text-purple-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-base">Stripe Payments</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Accept credit card, debit card, and bank transfers. Get paid in 2-3 business days.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <Badge variant="outline" className="text-xs">2.9% + 30c per transaction</Badge>
                <Badge variant="outline" className="text-xs">Instant setup</Badge>
              </div>
            </div>
          </div>

          <Button
            onClick={handleConnectStripe}
            disabled={stripeConnecting}
            className="w-full mt-4 bg-purple-600 hover:bg-purple-700"
            data-testid="button-connect-stripe"
          >
            {stripeConnecting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Link2 className="w-4 h-4 mr-2" />
            )}
            Connect Stripe Account
          </Button>
        </CardContent>
      </Card>

      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">You can always do this later</p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              Go to the Integrations page anytime to connect payment services.
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-between gap-3">
        <Button variant="outline" onClick={() => setCurrentStep('business')} data-testid="button-back-integrations">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button
          variant="ghost"
          onClick={handleSkipIntegrations}
          data-testid="button-skip-integrations"
        >
          Skip for now
          <SkipForward className="w-4 h-4 ml-2" />
        </Button>
        <Button
          onClick={handleContinueFromIntegrations}
          className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
          data-testid="button-continue-integrations"
        >
          Continue
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );

  const renderTeamStep = () => (
    <div className="space-y-6">
      <div className="text-center mb-4">
        <div className="w-14 h-14 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <Users className="w-7 h-7 text-white" />
        </div>
        <p className="text-sm text-muted-foreground">
          Invite your team members so they can start using TradieTrack right away.
        </p>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="team@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="flex-1"
              data-testid="input-invite-email"
            />
            <Select value={inviteRole} onValueChange={setInviteRole}>
              <SelectTrigger className="w-28" data-testid="select-invite-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="staff">Staff</SelectItem>
                <SelectItem value="supervisor">Supervisor</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleAddInvite} size="icon" data-testid="button-add-invite">
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>

          {teamInvites.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">Pending Invites</p>
              {teamInvites.map((invite, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{invite.email}</span>
                    <Badge variant="outline" className="text-xs capitalize">{invite.role}</Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveInvite(invite.email)}
                    data-testid={`button-remove-invite-${idx}`}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-green-900 dark:text-green-100">Team members get their own login</p>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
              They'll receive an email with instructions to join your business.
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-between gap-3">
        <Button variant="outline" onClick={() => setCurrentStep('integrations')} data-testid="button-back-team">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button
          variant="ghost"
          onClick={handleSkipTeam}
          data-testid="button-skip-team"
        >
          Skip for now
          <SkipForward className="w-4 h-4 ml-2" />
        </Button>
        <Button
          onClick={handleSendInvites}
          disabled={sendingInvites}
          className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
          data-testid="button-send-invites"
        >
          {sendingInvites && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {teamInvites.length > 0 ? `Send ${teamInvites.length} Invite${teamInvites.length > 1 ? 's' : ''}` : 'Continue'}
          <ArrowRight className="w-4 h-4 ml-2" />
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
          Your account is ready. Let's get you some jobs!
        </p>
      </div>

      <div className="grid gap-3 text-left max-w-md mx-auto">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <span className="text-sm">Business details configured</span>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <span className="text-sm">Ready to create jobs, quotes & invoices</span>
        </div>
        {isTeamMode && teamInvites.length > 0 && (
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="text-sm">{teamInvites.length} team invite{teamInvites.length > 1 ? 's' : ''} sent</span>
          </div>
        )}
      </div>

      <Button
        onClick={onComplete}
        className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
        data-testid="button-get-started"
      >
        Start Using TradieTrack
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
            {currentStep === 'integrations' && renderIntegrationsStep()}
            {currentStep === 'team' && renderTeamStep()}
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