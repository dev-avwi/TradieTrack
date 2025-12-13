import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, 
  Calendar, 
  Play, 
  CheckCircle, 
  Receipt, 
  DollarSign,
  ChevronRight,
  ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";

type JobStatus = 'pending' | 'scheduled' | 'in_progress' | 'done' | 'invoiced';

interface JobFlowWizardProps {
  status: JobStatus;
  hasQuote?: boolean;
  hasInvoice?: boolean;
  invoicePaid?: boolean;
  onCreateQuote?: () => void;
  onViewQuote?: () => void;
  onSchedule?: () => void;
  onStart?: () => void;
  onComplete?: () => void;
  onCreateInvoice?: () => void;
  onViewInvoice?: () => void;
  onSendReminder?: () => void;
  className?: string;
}

interface FlowStep {
  id: string;
  label: string;
  icon: React.ElementType;
  status: 'completed' | 'current' | 'upcoming';
}

export default function JobFlowWizard({
  status,
  hasQuote = false,
  hasInvoice = false,
  invoicePaid = false,
  onCreateQuote,
  onViewQuote,
  onSchedule,
  onStart,
  onComplete,
  onCreateInvoice,
  onViewInvoice,
  onSendReminder,
  className
}: JobFlowWizardProps) {
  
  // Determine which steps are completed, current, or upcoming
  const steps: FlowStep[] = useMemo(() => {
    const statusOrder: JobStatus[] = ['pending', 'scheduled', 'in_progress', 'done', 'invoiced'];
    const currentIndex = statusOrder.indexOf(status);

    return [
      {
        id: 'quote',
        label: 'Quote',
        icon: FileText,
        status: hasQuote ? 'completed' : (status === 'pending' ? 'current' : 'upcoming')
      },
      {
        id: 'scheduled',
        label: 'Scheduled',
        icon: Calendar,
        status: currentIndex > 0 ? 'completed' : (status === 'pending' ? 'upcoming' : 'current')
      },
      {
        id: 'in_progress',
        label: 'In Progress',
        icon: Play,
        status: currentIndex > 1 ? 'completed' : (status === 'in_progress' ? 'current' : 'upcoming')
      },
      {
        id: 'done',
        label: 'Done',
        icon: CheckCircle,
        status: currentIndex > 2 ? 'completed' : (status === 'done' ? 'current' : 'upcoming')
      },
      {
        id: 'invoiced',
        label: 'Invoiced',
        icon: Receipt,
        status: hasInvoice ? 'completed' : (status === 'done' ? 'current' : 'upcoming')
      },
      {
        id: 'paid',
        label: 'Paid',
        icon: DollarSign,
        status: invoicePaid ? 'completed' : (hasInvoice ? 'current' : 'upcoming')
      }
    ];
  }, [status, hasQuote, hasInvoice, invoicePaid]);

  // Determine the next action
  const nextAction = useMemo(() => {
    if (status === 'pending' && !hasQuote) {
      return {
        label: 'Create Quote',
        description: 'Send a quote to your client',
        action: onCreateQuote,
        variant: 'outline' as const
      };
    }
    if (status === 'pending') {
      return {
        label: 'Schedule Job',
        description: 'Set a date and time for this job',
        action: onSchedule,
        variant: 'outline' as const
      };
    }
    if (status === 'scheduled') {
      return {
        label: 'Start Job',
        description: 'Begin working on this job',
        action: onStart,
        variant: 'default' as const
      };
    }
    if (status === 'in_progress') {
      return {
        label: 'Complete Job',
        description: 'Mark this job as finished',
        action: onComplete,
        variant: 'default' as const
      };
    }
    if (status === 'done' && !hasInvoice) {
      return {
        label: 'Create Invoice',
        description: 'Send an invoice to get paid',
        action: onCreateInvoice,
        variant: 'default' as const,
        primary: true
      };
    }
    if (hasInvoice && !invoicePaid) {
      return {
        label: 'View Invoice',
        description: 'Check invoice status or send reminder',
        action: onViewInvoice,
        variant: 'outline' as const
      };
    }
    return null;
  }, [status, hasQuote, hasInvoice, invoicePaid, onCreateQuote, onSchedule, onStart, onComplete, onCreateInvoice, onViewInvoice]);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Progress Steps */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between overflow-x-auto pb-2">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                {/* Step Circle */}
                <div className="flex flex-col items-center min-w-[48px]">
                  <div 
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                      step.status === 'completed' && "bg-green-500 text-white",
                      step.status === 'current' && "ring-2 ring-offset-2",
                      step.status === 'upcoming' && "bg-muted text-muted-foreground"
                    )}
                    style={step.status === 'current' ? { 
                      backgroundColor: 'hsl(var(--trade))', 
                      color: 'white',
                      ringColor: 'hsl(var(--trade))'
                    } : {}}
                    data-testid={`flow-step-${step.id}`}
                  >
                    <step.icon className="h-4 w-4" />
                  </div>
                  <span 
                    className={cn(
                      "text-[10px] mt-1 text-center whitespace-nowrap",
                      step.status === 'completed' && "text-green-600 font-medium",
                      step.status === 'current' && "font-semibold",
                      step.status === 'upcoming' && "text-muted-foreground"
                    )}
                    style={step.status === 'current' ? { color: 'hsl(var(--trade))' } : {}}
                  >
                    {step.label}
                  </span>
                </div>

                {/* Connector Line */}
                {index < steps.length - 1 && (
                  <div 
                    className={cn(
                      "h-0.5 w-4 sm:w-6 mx-1 transition-all",
                      step.status === 'completed' ? "bg-green-500" : "bg-muted"
                    )}
                  />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Next Action Card */}
      {nextAction && nextAction.action && (
        <Card 
          className={cn(
            "cursor-pointer hover-elevate transition-all",
            nextAction.primary && "border-2"
          )}
          style={nextAction.primary ? { borderColor: 'hsl(var(--trade))' } : {}}
          onClick={nextAction.action}
          data-testid="card-next-action"
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge 
                    variant="secondary"
                    className={cn(
                      "text-xs",
                      nextAction.primary && "text-white"
                    )}
                    style={nextAction.primary ? { backgroundColor: 'hsl(var(--trade))' } : {}}
                  >
                    Next Step
                  </Badge>
                </div>
                <h3 className="font-semibold">{nextAction.label}</h3>
                <p className="text-sm text-muted-foreground">{nextAction.description}</p>
              </div>
              <Button
                variant={nextAction.variant}
                className={cn(
                  "rounded-xl flex-shrink-0",
                  nextAction.primary && "text-white"
                )}
                style={nextAction.primary ? { backgroundColor: 'hsl(var(--trade))' } : {}}
                data-testid="btn-next-action"
              >
                {nextAction.label}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Done State */}
      {invoicePaid && (
        <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30">
          <CardContent className="p-4 text-center">
            <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
            <h3 className="font-semibold text-green-700 dark:text-green-300">Job Complete!</h3>
            <p className="text-sm text-green-600 dark:text-green-400">This job has been invoiced and paid</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
