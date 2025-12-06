import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  CheckCircle2, 
  Circle, 
  Building2, 
  Users, 
  FileText, 
  CreditCard,
  ChevronRight,
  X
} from "lucide-react";
import { useState } from "react";

interface GettingStartedChecklistProps {
  onNavigate?: (path: string) => void;
  onCreateClient?: () => void;
  onCreateQuote?: () => void;
}

interface SetupStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  action: () => void;
  actionLabel: string;
  icon: typeof Building2;
}

export default function GettingStartedChecklist({
  onNavigate,
  onCreateClient,
  onCreateQuote
}: GettingStartedChecklistProps) {
  const [dismissed, setDismissed] = useState(false);
  
  const { data: businessSettings } = useQuery({ queryKey: ["/api/business-settings"] });
  const { data: user } = useQuery({ queryKey: ["/api/auth/me"] });
  const { data: clients = [] } = useQuery({ queryKey: ["/api/clients"] });
  const { data: quotes = [] } = useQuery({ queryKey: ["/api/quotes"] });
  const { data: subscriptionStatus } = useQuery({ queryKey: ["/api/subscription/status"] });

  const hasBusinessProfile = !!(businessSettings as any)?.businessName && 
    ((!!(user as any)?.tradeType) || !!(businessSettings as any)?.teamSize);
  const hasClient = Array.isArray(clients) && clients.length > 0;
  const hasQuote = Array.isArray(quotes) && quotes.length > 0;
  const hasSubscription = (subscriptionStatus as any)?.hasActiveSubscription;

  const steps: SetupStep[] = [
    {
      id: "business",
      title: "Set up your business",
      description: "Add business name, ABN & details",
      completed: hasBusinessProfile,
      action: () => onNavigate?.("/settings"),
      actionLabel: "Complete",
      icon: Building2
    },
    {
      id: "client",
      title: "Add your first client",
      description: "Save client details for quoting",
      completed: hasClient,
      action: () => onCreateClient?.() || onNavigate?.("/clients"),
      actionLabel: "Add",
      icon: Users
    },
    {
      id: "quote",
      title: "Create your first quote",
      description: "Send a professional quote",
      completed: hasQuote,
      action: () => onCreateQuote?.() || onNavigate?.("/quotes"),
      actionLabel: "Create",
      icon: FileText
    }
  ];

  const completedCount = steps.filter(s => s.completed).length;
  const progressPercentage = (completedCount / steps.length) * 100;
  const allComplete = completedCount === steps.length;

  if (dismissed || allComplete) {
    return null;
  }

  if (!hasBusinessProfile) {
    return null;
  }

  return (
    <Card 
      style={{ borderRadius: '16px', border: '2px solid hsl(var(--trade) / 0.2)' }}
      data-testid="getting-started-checklist"
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
              style={{ backgroundColor: 'hsl(var(--trade))' }}
            >
              {completedCount}/{steps.length}
            </div>
            <div>
              <p className="font-semibold text-sm">Getting Started</p>
              <p className="text-xs text-muted-foreground">Complete your setup</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setDismissed(true)}
            className="h-8 w-8"
            data-testid="button-dismiss-checklist"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <Progress value={progressPercentage} className="h-1.5 mb-4" />
        
        <div className="space-y-2">
          {steps.map((step) => (
            <button 
              key={step.id}
              onClick={step.completed ? undefined : step.action}
              disabled={step.completed}
              className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all active:scale-[0.99] ${
                step.completed 
                  ? 'bg-muted/30 border-muted cursor-default' 
                  : 'bg-background border-border hover:border-primary/30 cursor-pointer'
              }`}
              style={{ borderRadius: '12px' }}
              data-testid={`step-${step.id}`}
            >
              <div className="flex items-center gap-3">
                <div 
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    step.completed 
                      ? 'bg-green-100 dark:bg-green-900/50' 
                      : 'bg-muted/50'
                  }`}
                >
                  {step.completed ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <step.icon className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="text-left">
                  <p className={`text-sm font-medium ${step.completed ? 'text-muted-foreground line-through' : ''}`}>
                    {step.title}
                  </p>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                </div>
              </div>
              {!step.completed && (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
