import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { Mail, Loader2, CheckCircle2, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function VerifyEmailPending() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const urlParams = new URLSearchParams(window.location.search);
  const emailFromUrl = urlParams.get('email') || '';
  
  const [resendEmail, setResendEmail] = useState(emailFromUrl);
  const [resendLoading, setResendLoading] = useState(false);

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
          title: "Verification Email Sent",
          description: data.message || "Check your inbox for the verification link",
        });
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
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Check Your Email</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center space-y-3">
            <p className="text-muted-foreground">
              We've sent a verification link to your email address.
            </p>
            <p className="text-muted-foreground text-sm">
              Click the link in the email to verify your account and complete setup.
            </p>
          </div>
          
          <Alert className="border-blue-200 bg-blue-50 text-blue-800 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-300">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              The verification link will expire in 24 hours.
            </AlertDescription>
          </Alert>
          
          <div className="space-y-4 pt-4 border-t">
            <p className="text-sm text-muted-foreground text-center">
              Didn't receive the email? Enter your email to resend:
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
              variant="outline"
              data-testid="button-resend-verification"
            >
              {resendLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Resend Verification Email
                </>
              )}
            </Button>
          </div>
          
          <div className="text-center pt-2">
            <Button 
              variant="ghost" 
              onClick={() => setLocation('/')}
              data-testid="button-back-login"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Login
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
