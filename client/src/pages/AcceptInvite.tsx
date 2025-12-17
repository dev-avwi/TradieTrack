import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CheckCircle2, Users, AlertCircle, Loader2, Building2, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

interface InviteDetails {
  valid: boolean;
  error?: string;
  invite?: {
    businessName: string;
    roleName: string;
    email: string;
    inviterName: string;
    firstName?: string;
    lastName?: string;
  };
}

export default function AcceptInvite() {
  const [, params] = useRoute("/accept-invite/:token");
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const token = params?.token || '';
  
  const [acceptStatus, setAcceptStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    password: '',
    confirmPassword: '',
  });

  const { data: currentUser } = useQuery({
    queryKey: ['/api/auth/me'],
    retry: false,
  });

  const { data: inviteData, isLoading: validating, error: validateError } = useQuery<InviteDetails>({
    queryKey: ['/api/team/invite/validate', token],
    enabled: !!token,
  });

  useEffect(() => {
    if (inviteData?.invite) {
      setFormData(prev => ({
        ...prev,
        firstName: inviteData.invite?.firstName || '',
        lastName: inviteData.invite?.lastName || '',
      }));
    }
  }, [inviteData]);

  const handleAcceptAsExistingUser = async () => {
    setAcceptStatus('loading');
    try {
      const response = await apiRequest("POST", `/api/team/invite/accept/${token}`, {});
      const data = await response.json();
      
      if (response.ok) {
        setAcceptStatus('success');
        queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
        toast({
          title: "Welcome to the team!",
          description: `You've joined ${inviteData?.invite?.businessName}`,
        });
        
        setTimeout(() => {
          setLocation('/');
        }, 2000);
      } else {
        setAcceptStatus('error');
        setErrorMessage(data.error || 'Failed to accept invitation');
      }
    } catch (error) {
      setAcceptStatus('error');
      setErrorMessage('Failed to accept invitation. Please try again.');
    }
  };

  const handleAcceptAsNewUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure your passwords match",
        variant: "destructive",
      });
      return;
    }
    
    if (formData.password.length < 8) {
      toast({
        title: "Password too short",
        description: "Password must be at least 8 characters",
        variant: "destructive",
      });
      return;
    }

    setAcceptStatus('loading');
    try {
      const response = await apiRequest("POST", `/api/team/invite/accept/${token}`, {
        email: inviteData?.invite?.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        username: inviteData?.invite?.email?.split('@')[0] + Math.random().toString(36).substring(2, 6),
      });
      const data = await response.json();
      
      if (response.ok) {
        setAcceptStatus('success');
        queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
        toast({
          title: "Account created!",
          description: `You've joined ${inviteData?.invite?.businessName}`,
        });
        
        setTimeout(() => {
          setLocation('/');
        }, 2000);
      } else {
        setAcceptStatus('error');
        setErrorMessage(data.error || 'Failed to accept invitation');
      }
    } catch (error) {
      setAcceptStatus('error');
      setErrorMessage('Failed to create account. Please try again.');
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center gap-2 justify-center text-2xl">
              <AlertCircle className="h-6 w-6 text-destructive" />
              Invalid Link
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertDescription>
                This invitation link is invalid or expired. Please request a new invitation from your team leader.
              </AlertDescription>
            </Alert>
            <Button 
              onClick={() => setLocation('/login')} 
              className="w-full mt-4"
              data-testid="button-go-to-login"
            >
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-12">
            <div className="text-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-muted-foreground">Verifying invitation...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!inviteData?.valid || inviteData?.error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center gap-2 justify-center text-2xl">
              <AlertCircle className="h-6 w-6 text-destructive" />
              Invalid Invitation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertDescription>
                {inviteData?.error || 'This invitation is no longer valid. It may have already been used or expired.'}
              </AlertDescription>
            </Alert>
            <Button 
              onClick={() => setLocation('/login')} 
              className="w-full"
              data-testid="button-go-to-login"
            >
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (acceptStatus === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center gap-2 justify-center text-2xl text-green-600">
              <CheckCircle2 className="h-6 w-6" />
              Welcome to the Team!
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700 dark:text-green-400">
                You've successfully joined {inviteData?.invite?.businessName}. Redirecting to dashboard...
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  const invite = inviteData.invite!;
  const isLoggedIn = !!currentUser;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Users className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">You're Invited!</CardTitle>
          <CardDescription className="text-base mt-2">
            Join <span className="font-semibold text-foreground">{invite.businessName}</span> on TradieTrack
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Business</p>
                <p className="font-medium">{invite.businessName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <UserPlus className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Your Role</p>
                <p className="font-medium">{invite.roleName}</p>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              Invited by <span className="font-medium text-foreground">{invite.inviterName}</span>
            </div>
          </div>

          {errorMessage && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          {isLoggedIn ? (
            <div className="space-y-4">
              <p className="text-sm text-center text-muted-foreground">
                You're signed in. Click below to join the team.
              </p>
              <Button
                onClick={handleAcceptAsExistingUser}
                disabled={acceptStatus === 'loading'}
                className="w-full"
                size="lg"
                data-testid="button-accept-invite"
              >
                {acceptStatus === 'loading' ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Joining team...
                  </>
                ) : (
                  "Accept Invitation & Join Team"
                )}
              </Button>
            </div>
          ) : (
            <form onSubmit={handleAcceptAsNewUser} className="space-y-4">
              <p className="text-sm text-center text-muted-foreground">
                Create your account to join the team
              </p>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={invite.email}
                  disabled
                  className="bg-muted"
                  data-testid="input-email"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                    placeholder="First name"
                    required
                    data-testid="input-first-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                    placeholder="Last name"
                    required
                    data-testid="input-last-name"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Create a password (min 8 characters)"
                  required
                  minLength={8}
                  data-testid="input-password"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  placeholder="Confirm your password"
                  required
                  data-testid="input-confirm-password"
                />
              </div>
              
              <Button
                type="submit"
                disabled={acceptStatus === 'loading'}
                className="w-full"
                size="lg"
                data-testid="button-create-account-and-join"
              >
                {acceptStatus === 'loading' ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  "Create Account & Join Team"
                )}
              </Button>
            </form>
          )}
          
          <div className="text-center">
            <Button
              variant="link"
              onClick={() => setLocation('/login')}
              className="text-sm text-muted-foreground"
              data-testid="link-login-instead"
            >
              Already have an account? Sign in instead
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
