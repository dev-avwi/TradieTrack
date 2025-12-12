import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Eye, EyeOff, AlertCircle, Zap, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import appIconUrl from '@assets/Photo 1-12-2025, 6 03 07 pm (1)_1764576362665.png';

interface AuthFlowProps {
  onLoginSuccess: () => void;
  onNeedOnboarding: () => void;
}

export default function AuthFlow({ onLoginSuccess, onNeedOnboarding }: AuthFlowProps) {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { toast } = useToast();

  const [loginData, setLoginData] = useState({
    email: '',
    password: ''
  });

  const [registerData, setRegisterData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    username: ''
  });

  const getPasswordRequirements = (password: string) => {
    return [
      { label: 'At least 8 characters', met: password.length >= 8 },
      { label: 'Contains a number', met: /\d/.test(password) },
      { label: 'Contains uppercase letter', met: /[A-Z]/.test(password) },
      { label: 'Contains lowercase letter', met: /[a-z]/.test(password) },
    ];
  };

  const passwordRequirements = getPasswordRequirements(registerData.password);
  const allRequirementsMet = passwordRequirements.every(r => r.met);
  const passwordsMatch = registerData.password === registerData.confirmPassword && registerData.confirmPassword.length > 0;

  const handleGoogleSignIn = () => {
    setIsGoogleLoading(true);
    setError('');
    // Mark OAuth in progress so App.tsx can detect the return
    sessionStorage.setItem('oauth-in-progress', 'true');
    // Direct redirect to Google OAuth - no custom picker
    window.location.href = '/api/auth/google';
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!loginData.email || !loginData.password) {
      setError('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await apiRequest('POST', '/api/auth/login', loginData);
      const result = await response.json();

      if (result.success) {
        toast({
          title: "Welcome back!",
          description: `Signed in as ${result.user.firstName || result.user.username}`
        });
        
        // Let App.tsx handle business settings check
        // It already has the logic with react-query
        onLoginSuccess();
      } else {
        setError(result.error || 'Login failed');
      }
    } catch (error: any) {
      setError(error.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!registerData.email || !registerData.password || !registerData.firstName) {
      setError('Please fill in all required fields');
      return;
    }

    if (registerData.password !== registerData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate all password requirements are met
    if (!allRequirementsMet) {
      setError('Please meet all password requirements');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Auto-generate username from email if not provided
      const username = registerData.username || registerData.email.split('@')[0];
      
      const response = await apiRequest('POST', '/api/auth/register', {
        ...registerData,
        username
      });
      const result = await response.json();

      if (result.success) {
        toast({
          title: "Account created!",
          description: "Let's set up your business profile"
        });
        // Trigger auth refresh first, then app will detect missing business settings
        onLoginSuccess();
      } else {
        setError(result.error || 'Registration failed');
      }
    } catch (error: any) {
      setError(error.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Modern Header */}
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-orange-500 to-blue-600 p-1 shadow-xl">
              <div className="w-full h-full rounded-xl bg-background flex items-center justify-center">
                <img src={appIconUrl} alt="TradieTrack" className="w-20 h-20 object-contain" />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-500 via-orange-400 to-blue-600 bg-clip-text text-transparent">
              TradieTrack
            </h1>
            <p className="text-muted-foreground text-lg">
              {authMode === 'login' ? 'Welcome back!' : 'Start your free trial'}
            </p>
          </div>
        </div>

        {/* Auth Card */}
        <Card className="border-2 shadow-2xl">
          <CardContent className="pt-6">
            <Tabs value={authMode} onValueChange={(value) => setAuthMode(value as 'login' | 'register')}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login" data-testid="tab-login">Sign In</TabsTrigger>
                <TabsTrigger value="register" data-testid="tab-register">Sign Up</TabsTrigger>
              </TabsList>

              {/* Error Alert */}
              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Login Tab */}
              <TabsContent value="login" className="space-y-4 mt-0">
                {/* Google Sign-In Button */}
                <Button 
                  onClick={handleGoogleSignIn}
                  disabled={isLoading || isGoogleLoading}
                  variant="outline"
                  className="w-full h-11 text-base font-medium border-2 hover-elevate"
                  data-testid="button-google-signin"
                >
                  {isGoogleLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                      Connecting to Google...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      Continue with Google
                    </>
                  )}
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-3 text-muted-foreground font-medium">Or continue with email</span>
                  </div>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={loginData.email}
                      onChange={(e) => setLoginData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="your@email.com"
                      disabled={isLoading}
                      data-testid="input-login-email"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Password</Label>
                      <a 
                        href="/reset-password" 
                        className="text-sm text-primary hover:underline"
                        data-testid="link-forgot-password"
                      >
                        Forgot password?
                      </a>
                    </div>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={loginData.password}
                        onChange={(e) => setLoginData(prev => ({ ...prev, password: e.target.value }))}
                        placeholder="Enter your password"
                        disabled={isLoading}
                        className="pr-10"
                        data-testid="input-login-password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowPassword(!showPassword)}
                        tabIndex={-1}
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
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-11"
                    data-testid="button-login"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      'Sign In'
                    )}
                  </Button>
                </form>

                {/* Demo Credentials */}
                <div 
                  className="border-2 rounded-lg p-4"
                  style={{
                    background: 'linear-gradient(to right, hsl(var(--trade) / 0.05), hsl(var(--trade) / 0.1))',
                    borderColor: 'hsl(var(--trade) / 0.3)'
                  }}
                >
                  <div className="flex items-start gap-3">
                    <Zap className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: 'hsl(var(--trade))' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold mb-1" style={{ color: 'hsl(var(--trade))' }}>Try Demo Account</p>
                      <div className="text-sm space-y-1" style={{ color: 'hsl(var(--trade) / 0.8)' }}>
                        <p className="font-mono text-xs">demo@tradietrack.com.au</p>
                        <p className="font-mono text-xs">demo123456</p>
                      </div>
                      <p className="text-xs mt-2" style={{ color: 'hsl(var(--trade) / 0.7)' }}>
                        Pre-loaded with clients, jobs, quotes & invoices
                      </p>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Register Tab */}
              <TabsContent value="register" className="space-y-4 mt-0">
                {/* Google Sign-Up Button */}
                <Button 
                  onClick={handleGoogleSignIn}
                  disabled={isLoading || isGoogleLoading}
                  variant="outline"
                  className="w-full h-11 text-base font-medium border-2 hover-elevate"
                  data-testid="button-google-signup"
                >
                  {isGoogleLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                      Connecting to Google...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      Sign up with Google
                    </>
                  )}
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-3 text-muted-foreground font-medium">Or create with email</span>
                  </div>
                </div>

                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name *</Label>
                      <Input
                        id="firstName"
                        value={registerData.firstName}
                        onChange={(e) => setRegisterData(prev => ({ ...prev, firstName: e.target.value }))}
                        placeholder="John"
                        disabled={isLoading}
                        data-testid="input-first-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        value={registerData.lastName}
                        onChange={(e) => setRegisterData(prev => ({ ...prev, lastName: e.target.value }))}
                        placeholder="Smith"
                        disabled={isLoading}
                        data-testid="input-last-name"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="registerEmail">Email *</Label>
                    <Input
                      id="registerEmail"
                      type="email"
                      value={registerData.email}
                      onChange={(e) => setRegisterData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="your@email.com"
                      disabled={isLoading}
                      data-testid="input-register-email"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="registerPassword">Password *</Label>
                    <div className="relative">
                      <Input
                        id="registerPassword"
                        type={showPassword ? "text" : "password"}
                        value={registerData.password}
                        onChange={(e) => setRegisterData(prev => ({ ...prev, password: e.target.value }))}
                        placeholder="Create a strong password"
                        disabled={isLoading}
                        className="pr-10"
                        data-testid="input-register-password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowPassword(!showPassword)}
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                    {registerData.password.length > 0 && (
                      <div className="space-y-1 pt-1" data-testid="password-requirements">
                        {passwordRequirements.map((req, index) => (
                          <div 
                            key={index} 
                            className={`flex items-center gap-2 text-xs ${req.met ? 'text-green-600' : 'text-muted-foreground'}`}
                          >
                            {req.met ? (
                              <Check className="h-3 w-3" />
                            ) : (
                              <X className="h-3 w-3" />
                            )}
                            <span>{req.label}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password *</Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        value={registerData.confirmPassword}
                        onChange={(e) => setRegisterData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        placeholder="Confirm your password"
                        disabled={isLoading}
                        className="pr-10"
                        data-testid="input-confirm-password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        tabIndex={-1}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                    {registerData.confirmPassword.length > 0 && (
                      <div className={`flex items-center gap-2 text-xs pt-1 ${passwordsMatch ? 'text-green-600' : 'text-destructive'}`}>
                        {passwordsMatch ? (
                          <>
                            <Check className="h-3 w-3" />
                            <span>Passwords match</span>
                          </>
                        ) : (
                          <>
                            <X className="h-3 w-3" />
                            <span>Passwords don't match</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <Button 
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-11"
                    data-testid="button-register"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 w-4 mr-2 animate-spin" />
                        Creating account...
                      </>
                    ) : (
                      'Create Account'
                    )}
                  </Button>

                  <p className="text-xs text-center text-muted-foreground">
                    By creating an account, you agree to our Terms of Service
                  </p>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-sm text-muted-foreground">
          Professional business management for Australian tradies
        </p>
      </div>
    </div>
  );
}
