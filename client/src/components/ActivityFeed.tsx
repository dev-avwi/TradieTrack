import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { 
  Mail,
  MessageSquare,
  CreditCard,
  FileText,
  CheckCircle2,
  Clock,
  Bell,
  Send,
  AlertCircle,
  ChevronRight,
  Briefcase,
  Plus
} from "lucide-react";
import { formatHistoryDate } from "@shared/dateUtils";
import { Button } from "@/components/ui/button";

interface ActivityFeedProps {
  limit?: number;
  onViewAll?: () => void;
  compact?: boolean;
}

interface ActivityItem {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  status: 'success' | 'pending' | 'failed';
  entityType?: 'job' | 'quote' | 'invoice' | null;
  entityId?: string | null;
  navigationPath?: string | null;
  metadata?: Record<string, any>;
}

const activityIcons: Record<string, typeof Mail> = {
  email_sent: Mail,
  sms_sent: MessageSquare,
  payment_received: CreditCard,
  quote_sent: FileText,
  invoice_sent: Send,
  reminder_sent: Bell,
  quote_accepted: CheckCircle2,
  job_scheduled: Clock,
  job_started: Clock,
  job_completed: CheckCircle2,
  job_created: Briefcase,
  job_status_change: Briefcase,
  quote_created: Plus,
  invoice_created: Plus,
  invoice_paid: CreditCard,
};

const activityColors: Record<string, { bg: string; icon: string }> = {
  email_sent: { bg: 'hsl(210 80% 52% / 0.1)', icon: 'hsl(210 80% 52%)' },
  sms_sent: { bg: 'hsl(280 65% 60% / 0.1)', icon: 'hsl(280 65% 60%)' },
  payment_received: { bg: 'hsl(145 65% 45% / 0.1)', icon: 'hsl(145 65% 45%)' },
  quote_sent: { bg: 'hsl(35 90% 55% / 0.1)', icon: 'hsl(35 90% 55%)' },
  invoice_sent: { bg: 'hsl(5 85% 55% / 0.1)', icon: 'hsl(5 85% 55%)' },
  reminder_sent: { bg: 'hsl(25 90% 55% / 0.1)', icon: 'hsl(25 90% 55%)' },
  quote_accepted: { bg: 'hsl(145 65% 45% / 0.1)', icon: 'hsl(145 65% 45%)' },
  job_scheduled: { bg: 'hsl(210 80% 52% / 0.1)', icon: 'hsl(210 80% 52%)' },
  job_started: { bg: 'hsl(35 90% 55% / 0.1)', icon: 'hsl(35 90% 55%)' },
  job_completed: { bg: 'hsl(145 65% 45% / 0.1)', icon: 'hsl(145 65% 45%)' },
  job_created: { bg: 'hsl(210 80% 52% / 0.1)', icon: 'hsl(210 80% 52%)' },
  job_status_change: { bg: 'hsl(35 90% 55% / 0.1)', icon: 'hsl(35 90% 55%)' },
  quote_created: { bg: 'hsl(35 90% 55% / 0.1)', icon: 'hsl(35 90% 55%)' },
  invoice_created: { bg: 'hsl(5 85% 55% / 0.1)', icon: 'hsl(5 85% 55%)' },
  invoice_paid: { bg: 'hsl(145 65% 45% / 0.1)', icon: 'hsl(145 65% 45%)' },
};

export default function ActivityFeed({ 
  limit = 5, 
  onViewAll,
  compact = false 
}: ActivityFeedProps) {
  const [, setLocation] = useLocation();
  
  const { data: activities = [], isLoading } = useQuery<ActivityItem[]>({
    queryKey: [`/api/activity/recent/${limit}`],
    staleTime: 30 * 1000,
  });

  const { data: systemStatus } = useQuery({
    queryKey: ['/api/integrations/health'],
    staleTime: 60 * 1000,
  });

  const health = systemStatus as any;
  const emailWorking = health?.services?.email?.status === 'ready';
  const smsWorking = health?.services?.sms?.status === 'ready';
  
  const handleActivityClick = (activity: ActivityItem) => {
    if (activity.navigationPath) {
      setLocation(activity.navigationPath);
    }
  };

  if (compact) {
    return (
      <div className="space-y-2" data-testid="activity-feed-compact">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 ios-caption">
            <Clock className="h-3 w-3" />
            <span>System Activity</span>
          </div>
          <div className="flex items-center gap-2">
            {emailWorking && (
              <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-green-300 text-green-600 rounded-full">
                <span className="w-1 h-1 rounded-full bg-green-500 mr-1" />
                Email
              </Badge>
            )}
            {smsWorking && (
              <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-green-300 text-green-600 rounded-full">
                <span className="w-1 h-1 rounded-full bg-green-500 mr-1" />
                SMS
              </Badge>
            )}
          </div>
        </div>
        
        {activities.length === 0 ? (
          <p className="ios-caption py-2">
            No recent activity. Your automations will show here.
          </p>
        ) : (
          <div className="space-y-1">
            {activities.slice(0, 3).map((activity) => {
              const Icon = activityIcons[activity.type] || Mail;
              return (
                <div 
                  key={activity.id}
                  className="flex items-center gap-2 text-xs py-1"
                >
                  <Icon className="h-3 w-3 text-muted-foreground" />
                  <span className="truncate flex-1">{activity.title}</span>
                  <span className="text-muted-foreground shrink-0">
                    {formatHistoryDate(activity.timestamp)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <section className="animate-fade-up" style={{ animationDelay: '200ms' }} data-testid="activity-feed">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h2 className="ios-label">Activity</h2>
          <div className="flex items-center gap-1.5">
            {emailWorking && (
              <Badge variant="outline" className="text-[10px] py-0.5 px-2 border-green-300/50 text-green-600 rounded-full bg-green-50/50 dark:bg-green-950/30">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse" />
                Email Live
              </Badge>
            )}
            {smsWorking && (
              <Badge variant="outline" className="text-[10px] py-0.5 px-2 border-green-300/50 text-green-600 rounded-full bg-green-50/50 dark:bg-green-950/30">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse" />
                SMS Live
              </Badge>
            )}
          </div>
        </div>
        {onViewAll && activities.length > 0 && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onViewAll}
            className="text-xs h-8 px-3 rounded-xl press-scale"
            data-testid="button-view-all-activity"
          >
            View All
            <ChevronRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        )}
      </div>

      {/* Activity Feed Card */}
      <div className="feed-card">
        <div className="card-padding">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" 
                   style={{ borderColor: 'hsl(var(--trade))', borderTopColor: 'transparent' }} />
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-8">
              <div 
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
                style={{ backgroundColor: 'hsl(var(--muted) / 0.5)' }}
              >
                <Bell className="h-7 w-7 text-muted-foreground/40" />
              </div>
              <p className="ios-card-title mb-1">No activity yet</p>
              <p className="ios-caption max-w-[250px] mx-auto">
                When you send quotes, invoices, or receive payments, you'll see it here.
              </p>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline connector */}
              <div className="absolute left-[18px] top-8 bottom-4 w-px bg-gradient-to-b from-border to-transparent" />
              
              {/* Activity Items */}
              <div className="space-y-1">
                {activities.slice(0, limit).map((activity, index) => {
                  const Icon = activityIcons[activity.type] || Mail;
                  const colors = activityColors[activity.type] || { bg: 'hsl(var(--muted) / 0.5)', icon: 'hsl(var(--muted-foreground))' };
                  const isClickable = !!activity.navigationPath;
                  
                  return (
                    <div 
                      key={activity.id}
                      className={`relative flex items-start gap-3 p-3 rounded-xl hover-elevate animate-slide-in stagger-delay-${Math.min(index + 1, 8)} ${isClickable ? 'cursor-pointer' : ''}`}
                      style={{ opacity: 0 }}
                      onClick={() => handleActivityClick(activity)}
                      data-testid={`activity-item-${activity.id}`}
                    >
                      {/* Icon with status indicator */}
                      <div className="relative z-10">
                        <div 
                          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                          style={{ backgroundColor: colors.bg }}
                        >
                          <Icon className="h-4 w-4" style={{ color: colors.icon }} />
                        </div>
                        {/* Status dot */}
                        {activity.status === 'success' && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-card flex items-center justify-center">
                            <CheckCircle2 className="h-2 w-2 text-white" />
                          </div>
                        )}
                        {activity.status === 'pending' && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-amber-500 border-2 border-card flex items-center justify-center">
                            <Clock className="h-2 w-2 text-white" />
                          </div>
                        )}
                        {activity.status === 'failed' && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-red-500 border-2 border-card flex items-center justify-center">
                            <AlertCircle className="h-2 w-2 text-white" />
                          </div>
                        )}
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0 pt-0.5">
                        <p className="ios-body font-medium truncate">{activity.title}</p>
                        <p className="ios-caption truncate mt-0.5">{activity.description}</p>
                        <p className="ios-label mt-1.5" style={{ fontSize: '10px' }}>
                          {formatHistoryDate(activity.timestamp)}
                        </p>
                      </div>
                      
                      {/* Navigation indicator */}
                      {isClickable && (
                        <div className="flex items-center self-center">
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
