import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Calendar, User, Camera, Play, Square, Clock, FileText, Receipt, DollarSign, ArrowRight, AlertCircle, CheckCircle2, TrendingUp, TrendingDown } from "lucide-react";
import StatusBadge from "./StatusBadge";
import { TimerWidget } from "@/components/TimeTracking";
import { useLocation } from "wouter";

type JobStatus = 'pending' | 'scheduled' | 'in_progress' | 'done' | 'invoiced';

// Next Action types from AI
interface NextAction {
  action: string;
  priority: 'high' | 'medium' | 'low';
  actionType: string;
  reason: string;
}

// Profit indicator types
interface ProfitData {
  profit: number;
  margin: number;
  status: 'profitable' | 'break_even' | 'loss';
}

interface JobCardProps {
  id: string;
  title: string;
  client: string;
  address: string;
  scheduledAt: string;
  status: JobStatus;
  assignedTo?: string;
  hasPhotos?: boolean;
  nextAction?: NextAction;
  profitData?: ProfitData;
  onViewClick?: (id: string) => void;
  onStatusChange?: (id: string, newStatus: JobStatus) => void;
  onGenerateQuote?: (id: string) => void;
  onViewTimeTracking?: (id: string) => void;
  onViewExpenses?: (id: string) => void;
}

export default function JobCard({ 
  id, 
  title, 
  client, 
  address, 
  scheduledAt, 
  status, 
  assignedTo,
  hasPhotos,
  nextAction,
  profitData,
  onViewClick, 
  onStatusChange,
  onGenerateQuote,
  onViewTimeTracking,
  onViewExpenses
}: JobCardProps) {
  const [, setLocation] = useLocation();
  
  // Get priority color for next action badge
  const getPriorityColor = (priority: 'high' | 'medium' | 'low') => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800';
      case 'medium': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800';
      case 'low': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800';
    }
  };

  // Get profit indicator styling
  const getProfitIndicator = () => {
    if (!profitData) return null;
    const { profit, margin, status: profitStatus } = profitData;
    
    if (profitStatus === 'loss') {
      return (
        <div className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400" title={`Loss: $${Math.abs(profit).toFixed(0)}`}>
          <TrendingDown className="h-3 w-3" />
          <span>-${Math.abs(profit).toFixed(0)}</span>
        </div>
      );
    }
    if (profitStatus === 'break_even') {
      return (
        <div className="flex items-center gap-1 text-xs text-muted-foreground" title="Break even">
          <span>~$0</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400" title={`Profit: $${profit.toFixed(0)} (${margin.toFixed(0)}%)`}>
        <TrendingUp className="h-3 w-3" />
        <span>+${profit.toFixed(0)}</span>
      </div>
    );
  };
  
  return (
    <Card className="hover-elevate" data-testid={`job-card-${id}`}>
      {/* Next Action Banner - The Standout Feature */}
      {nextAction && nextAction.priority !== 'low' && (
        <div className={`px-3 py-1.5 flex items-center gap-2 text-xs font-medium border-b ${getPriorityColor(nextAction.priority)}`} data-testid={`next-action-${id}`}>
          {nextAction.priority === 'high' ? <AlertCircle className="h-3 w-3" /> : <ArrowRight className="h-3 w-3" />}
          <span>{nextAction.action}</span>
        </div>
      )}
      
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1 min-w-0 flex-1">
            <h3 className="font-semibold text-base line-clamp-1">{title}</h3>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <User className="h-3 w-3" />
              <span className="truncate">{client}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 ml-2">
            <div className="flex items-center gap-2">
              {hasPhotos && <Camera className="h-4 w-4 text-muted-foreground" />}
              <StatusBadge status={status} />
            </div>
            {/* Profit Indicator for completed/invoiced jobs */}
            {(status === 'done' || status === 'invoiced') && getProfitIndicator()}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            <span className="truncate">{address}</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>{scheduledAt}</span>
          </div>
          {assignedTo && (
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" />
              <span>Assigned to {assignedTo}</span>
            </div>
          )}
        </div>
        
        {/* Time Tracking Widget - show for scheduled and in_progress jobs */}
        {(status === 'scheduled' || status === 'in_progress') && (
          <div className="border-t pt-3">
            <TimerWidget 
              jobId={id} 
              jobTitle={title}
              onTimerStart={() => {}}
              onTimerStop={() => {}}
            />
          </div>
        )}
        
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => onViewClick?.(id)}
              data-testid={`button-view-job-${id}`}
            >
              View
            </Button>
            
            {status !== 'done' && status !== 'invoiced' && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  // ServiceM8-style workflow: pending → scheduled → in_progress → done
                  const nextStatus: JobStatus = 
                    status === 'pending' ? 'scheduled' :
                    status === 'scheduled' ? 'in_progress' :
                    'done';
                  onStatusChange?.(id, nextStatus);
                }}
                data-testid={`button-status-job-${id}`}
              >
                {status === 'pending' && 'Schedule Job'}
                {status === 'scheduled' && 'Start Job'}
                {status === 'in_progress' && 'Complete Job'}
              </Button>
            )}
          </div>
          
          {/* Quick Actions for Workflow Integration */}
          <div className="flex flex-wrap gap-1">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setLocation(`/time-tracking?jobId=${id}`)}
              data-testid={`button-time-tracking-${id}`}
              className="text-xs"
            >
              <Clock className="h-3 w-3 mr-1" />
              Time
            </Button>
            
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setLocation(`/expenses?jobId=${id}`)}
              data-testid={`button-expenses-${id}`}
              className="text-xs"
            >
              <Receipt className="h-3 w-3 mr-1" />
              Expenses
            </Button>
            
            {(status === 'done' || status === 'in_progress' || status === 'scheduled') && (
              <>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setLocation(`/quotes/new?jobId=${id}`)}
                  data-testid={`button-new-quote-${id}`}
                  className="text-xs"
                >
                  <FileText className="h-3 w-3 mr-1" />
                  Quote
                </Button>
                
                {status === 'done' && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setLocation(`/invoices/new?jobId=${id}`)}
                    data-testid={`button-new-invoice-${id}`}
                    className="text-xs"
                  >
                    <DollarSign className="h-3 w-3 mr-1" />
                    Invoice
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}