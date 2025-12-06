import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest, setSessionToken } from "@/lib/queryClient";
import { useState } from "react";
import { Loader2, User } from "lucide-react";

interface DemoLoginProps {
  onLogin: () => void;
}

export default function DemoLogin({ onLogin }: DemoLoginProps) {
  const [isLogging, setIsLogging] = useState(false);

  const handleDemoLogin = async () => {
    setIsLogging(true);
    try {
      const response = await apiRequest("POST", "/api/auth/demo-login");
      const result = await response.json();
      
      if (result.success) {
        console.log("Demo login successful:", result.user);
        // Save session token for iOS/Safari fallback where cookies may not work
        if (result.sessionToken) {
          setSessionToken(result.sessionToken);
        }
        onLogin(); // Trigger refresh of parent component
      } else {
        console.error("Demo login failed:", result.error);
      }
    } catch (error) {
      console.error("Demo login error:", error);
    } finally {
      setIsLogging(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
            <User className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">TradieTrack Demo</CardTitle>
          <CardDescription>
            Click below to explore the app with demo data from Mike's Plumbing Services
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={handleDemoLogin}
            disabled={isLogging}
            className="w-full"
            size="lg"
            data-testid="button-demo-login"
          >
            {isLogging ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Logging in...
              </>
            ) : (
              <>
                <User className="mr-2 h-4 w-4" />
                Enter Demo
              </>
            )}
          </Button>
          
          <div className="text-center text-sm text-muted-foreground">
            <p className="mb-2">Demo includes:</p>
            <ul className="text-xs space-y-1">
              <li>• 3 clients with contact details</li>
              <li>• Active jobs and completed work</li>
              <li>• Sample quotes and invoices</li>
              <li>• Australian GST calculations</li>
              <li>• Plumbing trade personalization</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}