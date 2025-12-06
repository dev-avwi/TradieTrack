import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Calendar, User, Camera, Play, Square, Clock, FileText, Receipt, DollarSign } from "lucide-react";
import StatusBadge from "./StatusBadge";
import { TimerWidget } from "@/components/TimeTracking";
import { useLocation } from "wouter";

type JobStatus = 'pending' | 'scheduled' | 'in_progress' | 'done' | 'invoiced';

interface JobCardProps {
  id: string;
  title: string;
  client: string;
  address: string;
  scheduledAt: string;
  status: JobStatus;
  assignedTo?: string;
  hasPhotos?: boolean;
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
  onViewClick, 
  onStatusChange,
  onGenerateQuote,
  onViewTimeTracking,
  onViewExpenses
}: JobCardProps) {
  const [, setLocation] = useLocation();
  return (
    <Card className="hover-elevate" data-testid={`job-card-${id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1 min-w-0 flex-1">
            <h3 className="font-semibold text-base line-clamp-1">{title}</h3>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <User className="h-3 w-3" />
              <span className="truncate">{client}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-2">
            {hasPhotos && <Camera className="h-4 w-4 text-muted-foreground" />}
            <StatusBadge status={status} />
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
          
          {status === 'done' && (
            <Button 
              size="sm"
              className="w-full"
              onClick={() => setLocation(`/invoices/new?jobId=${id}`)}
              data-testid={`button-invoice-job-${id}`}
            >
              <DollarSign className="h-4 w-4 mr-2" />
              Create Invoice
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}