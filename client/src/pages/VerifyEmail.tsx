import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest, setSessionToken, queryClient } from "@/lib/queryClient";
import { CheckCircle2, Mail, AlertCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function VerifyEmail() {
  const [, params] = useRoute("/verify-email");
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [verifyingToken, setVerifyingToken] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<'pending' | 'success' | 'error'>('pending');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [resendEmail, setResendEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    // Check for token in URL params
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    if (token) {
      setVerifyingToken(token);
      handleVerifyEmail(token);
    }
  }, []);

  const handleVerifyEmail = async (token: string) => {
    setLoading(true);
    try {
      const response = await apiRequest("POST", "/api/auth/verify-email", { token });
      const data = await response.json();
      
      if (response.ok) {
        setVerificationStatus('success');
        toast({
          title: "Email Verified!",
          description: data.message,
        });
        
        // Save session token for Safari/iOS fallback where cookies may not work
        if (data.sessionToken) {
          setSessionToken(data.sessionToken);
        }
        
        // Invalidate auth queries to trigger refetch with new session
        await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        
        // Redirect to dashboard - App.tsx will show onboarding if business settings are missing
        setTimeout(() => {
          setLocation('/');
        }, 1500);
      } else {
        setVerificationStatus('error');
        setErrorMessage(data.error || 'Verification failed');
      }
    } catch (error) {
      setVerificationStatus('error');
      setErrorMessage('Failed to verify email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!resendEmail.trim()) {
      toast({
        title: "Email Required",
        description: "Please enter your email address",
        variant: "destructive",
      });
      return;
    }

    setResendLoading(true);
    try {
      const response = await apiRequest("POST", "/api/auth/resend-verification", { 
        email: resendEmail 
      });
      const data = await response.json();
      
      if (response.ok) {
        toast({
          title: "Verification Email Sent!",
          description: data.message,
        });
        setResendEmail('');
      } else {
        toast({
          title: "Failed to Send Email",
          description: data.error || 'Failed to send verification email',
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send verification email. Please try again.",
        variant: "destructive",
      });
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center gap-2 justify-center text-2xl">
            <Mail className="h-6 w-6 text-primary" />
            Email Verification
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {verifyingToken ? (
            // Token verification in progress or completed
            <div className="space-y-4">
              {verificationStatus === 'pending' && loading && (
                <div className="text-center space-y-3">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                  <p>Verifying your email address...</p>
                </div>
              )}
              
              {verificationStatus === 'success' && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription className="text-green-600">
                    Email verified successfully! Redirecting...
                  </AlertDescription>
                </Alert>
              )}
              
              {verificationStatus === 'error' && (
                <div className="space-y-4">
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {errorMessage}
                    </AlertDescription>
                  </Alert>
                  
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground text-center">
                      Need a new verification link? Enter your email below:
                    </p>
                    
                    <div className="space-y-2">
                      <Label htmlFor="resend-email">Email Address</Label>
                      <Input
                        id="resend-email"
                        type="email"
                        placeholder="Enter your email address"
                        value={resendEmail}
                        onChange={(e) => setResendEmail(e.target.value)}
                        data-testid="input-resend-email"
                      />
                    </div>
                    
                    <Button
                      onClick={handleResendVerification}
                      disabled={resendLoading}
                      className="w-full"
                      data-testid="button-resend-verification"
                    >
                      {resendLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        "Resend Verification Email"
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            // No token - show resend form
            <div className="space-y-4">
              <div className="text-center space-y-2">
                <CheckCircle2 className="h-12 w-12 mx-auto text-muted-foreground" />
                <h3 className="text-lg font-semibold">Check Your Email</h3>
                <p className="text-sm text-muted-foreground">
                  We've sent a verification link to your email address. Click the link to verify your account.
                </p>
              </div>
              
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground text-center">
                  Didn't receive the email? Enter your email to resend:
                </p>
                
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email address"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    data-testid="input-email"
                  />
                </div>
                
                <Button
                  onClick={handleResendVerification}
                  disabled={resendLoading}
                  className="w-full"
                  data-testid="button-resend"
                >
                  {resendLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Resend Verification Email"
                  )}
                </Button>
              </div>
            </div>
          )}
          
          <div className="text-center">
            <Button 
              variant="ghost" 
              onClick={() => setLocation('/')}
              data-testid="button-back-home"
            >
              Back to Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}