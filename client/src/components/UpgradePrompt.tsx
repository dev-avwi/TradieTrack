import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Check, PartyPopper } from "lucide-react";

interface UpgradePromptProps {
  trigger?: "job-limit" | "logo-upload" | "branding" | "ai-features" | "team-members";
  onClose?: () => void;
  compact?: boolean;
}

export default function UpgradePrompt({ 
  trigger = "job-limit", 
  onClose,
  compact = false 
}: UpgradePromptProps) {

  const betaFeatures = [
    "Unlimited jobs, quotes & invoices",
    "Custom logo & branding",
    "AI-powered quote generation",
    "Team member management",
    "Automatic invoice reminders",
    "Advanced reporting & analytics",
    "Photo attachments on jobs",
    "Recurring jobs & invoices",
  ];

  if (compact) {
    return (
      <Alert 
        className="border"
        style={{ 
          borderColor: 'hsl(var(--trade) / 0.2)',
          backgroundColor: 'hsl(var(--trade) / 0.05)'
        }}
      >
        <Sparkles className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
        <AlertDescription style={{ color: 'hsl(var(--trade))' }}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span>All features are free during beta!</span>
            <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
              Free
            </Badge>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6" data-testid="upgrade-prompt">
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center space-x-2">
          <PartyPopper className="h-6 w-6 text-green-600" />
          <h2 className="text-2xl font-bold">Free During Beta!</h2>
        </div>
        <p className="text-muted-foreground max-w-md mx-auto">
          Enjoy all Pro features at no cost while we're in beta. We'll let you know before any changes.
        </p>
      </div>

      <div className="max-w-md mx-auto">
        <Card className="relative border-green-300 dark:border-green-700 shadow-lg">
          <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
            <Badge className="bg-green-600 text-white">
              Beta Access
            </Badge>
          </div>
          
          <CardHeader className="text-center pt-8">
            <CardTitle className="flex items-center justify-center space-x-2">
              <Sparkles className="h-5 w-5 text-green-600" />
              <span>All Features Unlocked</span>
            </CardTitle>
            <div className="space-y-1">
              <div className="text-3xl font-bold text-green-600">
                Free
              </div>
              <p className="text-sm text-muted-foreground">No credit card required</p>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <ul className="space-y-2">
              {betaFeatures.map((feature, index) => (
                <li key={index} className="flex items-center space-x-2">
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="text-sm">{feature}</span>
                </li>
              ))}
            </ul>
            
            {onClose && (
              <Button 
                className="w-full" 
                size="lg"
                onClick={onClose}
                data-testid="button-close-beta-info"
              >
                Got it, thanks!
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {!onClose && (
        <p className="text-center text-xs text-muted-foreground">
          Thank you for trying TradieTrack during our beta period.
        </p>
      )}
    </div>
  );
}
