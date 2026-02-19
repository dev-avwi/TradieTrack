import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import GettingStartedChecklist from "./GettingStartedChecklist";
import TrustBanner from "./TrustBanner";
import ActivityFeed from "./ActivityFeed";
import FloatingActionButton from "./FloatingActionButton";
import { useDashboardKPIs, useTodaysJobs } from "@/hooks/use-dashboard-data";
import { useUpdateJob } from "@/hooks/use-jobs";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { 
  Briefcase, 
  DollarSign, 
  FileText, 
  Clock,
  User,
  Plus,
  ChevronRight,
  CalendarDays,
  AlertCircle,
  Play,
  CheckCircle,
  Phone,
  MessageSquare,
  Navigation,
  WifiOff,
  Target,
  AlertTriangle,
  Lightbulb,
  Calendar,
  ArrowRight,
  TrendingUp,
  ShieldAlert,
} from "lucide-react";

interface OwnerManagerDashboardProps {
  userName?: string;
  businessName?: string;
  onCreateJob?: () => void;
  onCreateQuote?: () => void;
  onCreateInvoice?: () => void;
  onViewJobs?: () => void;
  onViewInvoices?: () => void;
  onViewQuotes?: () => void;
  onNavigate?: (path: string) => void;
}

function ConnectionBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="mb-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-2.5 flex items-center gap-3">
      <WifiOff className="w-4 h-4 text-amber-600 flex-shrink-0" />
      <div>
        <p className="text-sm font-medium text-amber-800 dark:text-amber-200">You're offline</p>
        <p className="text-xs text-amber-600 dark:text-amber-400">Data may be out of date. Changes will sync when you're back online.</p>
      </div>
    </div>
  );
}

export default function OwnerManagerDashboard({
  userName = "there",
  businessName,
  onCreateJob,
  onCreateQuote,
  onCreateInvoice,
  onViewJobs,
  onNavigate,
}: OwnerManagerDashboardProps) {
  const { data: kpis, isLoading: kpisLoading } = useDashboardKPIs();
  const { data: todaysJobs = [] } = useTodaysJobs();
  const updateJob = useUpdateJob();
  const { toast } = useToast();

  interface CashflowData {
    overdueTotal: number;
    overdueCount: number;
  }

  const { data: cashflow } = useQuery<CashflowData>({
    queryKey: ["/api/dashboard/cashflow"],
    staleTime: 5 * 60 * 1000,
  });

  interface ActionItem {
    id: string;
    priority: string;
    title: string;
    description: string;
    impact: string;
    cta: string;
    ctaUrl: string;
    metric: string;
    category: string;
  }
  interface ActionCenterData {
    actions: ActionItem[];
    summary: { fixNowCount: number; thisWeekCount: number; suggestionsCount: number; totalCount: number };
    sections: { fix_now: ActionItem[]; this_week: ActionItem[]; suggestions: ActionItem[] };
  }

  const { data: actionData } = useQuery<ActionCenterData>({
    queryKey: ["/api/bi/action-center"],
    staleTime: 5 * 60 * 1000,
  });

  interface ComplianceDoc {
    id: string;
    type: string;
    title: string;
    expiryDate: string | null;
  }
  const { data: complianceDocs } = useQuery<ComplianceDoc[]>({
    queryKey: ["/api/compliance-documents"],
    staleTime: 5 * 60 * 1000,
  });

  const expiringDocs = (complianceDocs || []).filter((doc) => {
    if (!doc.expiryDate) return false;
    const expiry = new Date(doc.expiryDate);
    const now = new Date();
    const daysUntil = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntil <= 30;
  });

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const formatJobTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-AU', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const handleStartJob = async (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await updateJob.mutateAsync({ 
        id: jobId, 
        data: { status: 'in_progress' } 
      });
      toast({ title: "Job Started", description: "Timer started. You're on the clock!" });
    } catch {
      toast({ title: "Error", description: "Failed to start job", variant: "destructive" });
    }
  };

  const handleCompleteJob = async (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await updateJob.mutateAsync({ 
        id: jobId, 
        data: { status: 'done' } 
      });
      toast({ title: "Job Complete", description: "Nice work! Job marked as done." });
    } catch {
      toast({ title: "Error", description: "Failed to complete job", variant: "destructive" });
    }
  };

  const handleCall = (phone: string, e: React.MouseEvent) => {
    e.stopPropagation();
    window.location.href = `tel:${phone}`;
  };

  const handleSMS = (phone: string, e: React.MouseEvent) => {
    e.stopPropagation();
    window.location.href = `sms:${phone}`;
  };

  const handleNavigate = (address: string, e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(`https://maps.google.com/maps?q=${encodeURIComponent(address)}`, '_blank');
  };

  const getStatusButton = (job: any) => {
    if (job.status === 'pending') {
      return (
        <Button
          size="sm"
          className="text-white font-medium"
          style={{ backgroundColor: 'hsl(142.1 76.2% 36.3%)' }}
          onClick={(e) => handleStartJob(job.id, e)}
          disabled={updateJob.isPending}
          data-testid={`button-start-job-${job.id}`}
        >
          <Play className="h-3.5 w-3.5 mr-1.5" />
          Start
        </Button>
      );
    } else if (job.status === 'in_progress') {
      return (
        <Button
          size="sm"
          className="text-white font-medium"
          style={{ backgroundColor: 'hsl(var(--trade))' }}
          onClick={(e) => handleCompleteJob(job.id, e)}
          disabled={updateJob.isPending}
          data-testid={`button-complete-job-${job.id}`}
        >
          <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
          Done
        </Button>
      );
    }
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          onNavigate?.(`/jobs/${job.id}`);
        }}
        data-testid={`button-view-job-${job.id}`}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    );
  };

  const getStatusBadge = (status: string) => {
    if (status === 'done') {
      return <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-xs">Done</Badge>;
    } else if (status === 'in_progress') {
      return (
        <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1 animate-pulse" />
          Active
        </Badge>
      );
    }
    return <Badge variant="outline" className="text-xs">Scheduled</Badge>;
  };

  const fmtAud = (n: number) => '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const hasMoneyData = (kpis?.unpaidInvoicesTotal ?? 0) > 0;
  const hasOverdue = (cashflow?.overdueCount ?? 0) > 0;

  return (
    <div className="w-full px-4 sm:px-6 py-4 pb-28" data-testid="owner-manager-dashboard">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {getGreeting()}, {userName}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {todaysJobs.length > 0 
              ? `${todaysJobs.length} job${todaysJobs.length > 1 ? 's' : ''} on today`
              : businessName || "Welcome back"}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5" data-testid="quick-actions-section">
          {onCreateJob && (
            <Button 
              size="sm"
              className="text-white font-medium"
              style={{ backgroundColor: 'hsl(var(--trade))' }}
              onClick={onCreateJob}
              data-testid="button-quick-create-job"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Job
            </Button>
          )}
          {onCreateQuote && (
            <Button variant="outline" size="sm" onClick={onCreateQuote} data-testid="button-quick-create-quote">
              <FileText className="h-3.5 w-3.5 mr-1" />
              Quote
            </Button>
          )}
          {onCreateInvoice && (
            <Button variant="outline" size="sm" onClick={onCreateInvoice} data-testid="button-quick-create-invoice">
              <DollarSign className="h-3.5 w-3.5 mr-1" />
              Invoice
            </Button>
          )}
        </div>
      </div>

      <ConnectionBanner />
      <TrustBanner />

      {hasMoneyData && (
        <Card 
          className="mb-3 cursor-pointer hover-elevate"
          onClick={() => onNavigate?.('/documents?tab=invoices&filter=unpaid')}
          data-testid="kpi-money-owed"
        >
          <CardContent className="p-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                     style={{ backgroundColor: 'hsl(var(--destructive) / 0.1)' }}>
                  <DollarSign className="h-4 w-4" style={{ color: 'hsl(var(--destructive))' }} />
                </div>
                <div>
                  <p className="text-xl font-bold" style={{ color: 'hsl(var(--destructive))' }}>
                    {fmtAud(kpis?.unpaidInvoicesTotal || 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">owed across {kpis?.unpaidInvoicesCount || 0} invoices</p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {hasOverdue && (
                  <Badge className="bg-red-500/10 text-red-600 border-red-500/20 text-xs">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {cashflow?.overdueCount} overdue
                  </Badge>
                )}
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {kpisLoading ? (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 mb-3">
          {[1,2,3,4,5,6].map(i => (
            <Card key={i}>
              <CardContent className="py-1.5 px-2">
                <Skeleton className="h-6 w-12 mb-1" />
                <Skeleton className="h-3 w-10" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 mb-3">
          <Card 
            className="cursor-pointer hover-elevate"
            onClick={() => onNavigate?.('/work?filter=today')}
            data-testid="kpi-jobs-today"
          >
            <CardContent className="py-1.5 px-2">
              <div className="flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'hsl(221.2 83.2% 53.3%)' }} />
                <p className="text-lg font-bold">{kpis?.jobsToday || 0}</p>
              </div>
              <p className="text-[10px] text-muted-foreground font-medium mt-0 truncate">Jobs Today</p>
            </CardContent>
          </Card>
          <Card 
            className="cursor-pointer hover-elevate"
            onClick={() => onNavigate?.('/work?filter=done')}
            data-testid="kpi-jobs-to-invoice"
          >
            <CardContent className="py-1.5 px-2">
              <div className="flex items-center gap-1">
                <DollarSign className="h-3.5 w-3.5 flex-shrink-0" style={{ color: (kpis?.jobsToInvoice ?? 0) > 0 ? 'hsl(38 92% 50%)' : undefined }} />
                <p className="text-lg font-bold" style={{ color: (kpis?.jobsToInvoice ?? 0) > 0 ? 'hsl(38 92% 50%)' : undefined }}>
                  {kpis?.jobsToInvoice ?? 0}
                </p>
              </div>
              <p className="text-[10px] text-muted-foreground font-medium mt-0 truncate">To Invoice</p>
            </CardContent>
          </Card>
          <Card 
            className="cursor-pointer hover-elevate"
            onClick={() => onNavigate?.('/documents?tab=quotes&filter=sent')}
            data-testid="kpi-pending"
          >
            <CardContent className="py-1.5 px-2">
              <div className="flex items-center gap-1">
                <FileText className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'hsl(var(--trade))' }} />
                <p className="text-lg font-bold">{kpis?.quotesAwaiting || 0}</p>
              </div>
              <p className="text-[10px] text-muted-foreground font-medium mt-0 truncate">Quotes Out</p>
            </CardContent>
          </Card>
          <Card 
            className="cursor-pointer hover-elevate"
            onClick={() => onNavigate?.('/work?filter=in_progress')}
            data-testid="kpi-active-jobs"
          >
            <CardContent className="py-1.5 px-2">
              <div className="flex items-center gap-1">
                <Briefcase className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'hsl(var(--trade))' }} />
                <p className="text-lg font-bold">{kpis?.activeJobs || 0}</p>
              </div>
              <p className="text-[10px] text-muted-foreground font-medium mt-0 truncate">Active Jobs</p>
            </CardContent>
          </Card>
          <Card 
            className="cursor-pointer hover-elevate"
            onClick={() => onNavigate?.('/insights?tab=profit')}
            data-testid="kpi-weekly-earnings"
          >
            <CardContent className="py-1.5 px-2">
              <div className="flex items-center gap-1">
                <TrendingUp className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'hsl(142.1 76.2% 36.3%)' }} />
                <p className="text-lg font-bold" style={{ color: 'hsl(142.1 76.2% 36.3%)' }}>
                  {fmtAud(kpis?.weeklyEarnings || 0)}
                </p>
              </div>
              <p className="text-[10px] text-muted-foreground font-medium mt-0 truncate">This Week</p>
            </CardContent>
          </Card>
          <Card 
            className="cursor-pointer hover-elevate"
            onClick={() => onNavigate?.('/documents?tab=invoices&filter=overdue')}
            data-testid="kpi-overdue-invoices"
          >
            <CardContent className="py-1.5 px-2">
              <div className="flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" style={{ color: (cashflow?.overdueCount ?? 0) > 0 ? 'hsl(0 84.2% 60.2%)' : undefined }} />
                <p className="text-lg font-bold" style={{ color: (cashflow?.overdueCount ?? 0) > 0 ? 'hsl(0 84.2% 60.2%)' : undefined }}>
                  {cashflow?.overdueCount ?? 0}
                </p>
              </div>
              <p className="text-[10px] text-muted-foreground font-medium mt-0 truncate">Overdue</p>
            </CardContent>
          </Card>
        </div>
      )}

      {todaysJobs.length > 0 && (
        <Card className="mb-4" data-testid="todays-overview">
          <CardHeader className="flex flex-row items-center justify-between gap-4 py-3 px-4">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
              Today's Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-4">
            {(() => {
              const now = new Date();
              const sortedJobs = [...todaysJobs].sort((a: any, b: any) => 
                new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
              );
              const nextJob = sortedJobs.find((job: any) => 
                new Date(job.scheduledAt) > now && job.status !== 'done'
              );
              return (
                <div className="space-y-1.5">
                  {nextJob && (
                    <div className="flex items-center gap-2 mb-3 px-2 py-1.5 rounded-md bg-muted/50">
                      <ArrowRight className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'hsl(var(--trade))' }} />
                      <p className="text-xs font-medium">
                        <span className="text-muted-foreground">Next: </span>
                        <span>{nextJob.title}</span>
                        <span className="text-muted-foreground"> at </span>
                        <span style={{ color: 'hsl(var(--trade))' }}>{formatJobTime(nextJob.scheduledAt)}</span>
                      </p>
                    </div>
                  )}
                  {sortedJobs.map((job: any) => {
                    const statusColor = job.status === 'done' 
                      ? 'hsl(142.1 76.2% 36.3%)' 
                      : job.status === 'in_progress' 
                        ? 'hsl(38 92% 50%)' 
                        : 'hsl(var(--trade))';
                    return (
                      <div
                        key={job.id}
                        className="flex items-center gap-3 py-1.5 cursor-pointer hover-elevate rounded-md px-1"
                        onClick={() => onNavigate?.(`/jobs/${job.id}`)}
                      >
                        <div 
                          className="w-1 self-stretch rounded-full flex-shrink-0"
                          style={{ backgroundColor: statusColor }}
                        />
                        <div className="w-12 flex-shrink-0">
                          <p className="text-xs font-semibold" style={{ color: 'hsl(var(--trade))' }}>
                            {formatJobTime(job.scheduledAt)}
                          </p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{job.title}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {job.assignedToName && (
                              <span className="flex items-center gap-1 truncate">
                                <User className="h-3 w-3 flex-shrink-0" />
                                {job.assignedToName}
                              </span>
                            )}
                            {job.clientName && !job.assignedToName && (
                              <span className="truncate">{job.clientName}</span>
                            )}
                          </div>
                        </div>
                        {getStatusBadge(job.status)}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {actionData && actionData.summary.totalCount > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 py-3 px-4">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Target className="h-4 w-4" style={{ color: 'hsl(var(--destructive))' }} />
                Action Centre
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => onNavigate?.('/action-center')} data-testid="button-view-action-center">
                View All <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
              </Button>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="space-y-2">
                {actionData.actions.slice(0, 3).map((action) => {
                  const priorityIcon = action.priority === 'fix_now' ? AlertTriangle : action.priority === 'this_week' ? Clock : Lightbulb;
                  const PIcon = priorityIcon;
                  const priorityColor = action.priority === 'fix_now' ? 'hsl(0 84.2% 60.2%)' : action.priority === 'this_week' ? 'hsl(38 92% 50%)' : 'hsl(142.1 76.2% 36.3%)';
                  return (
                    <div
                      key={action.id}
                      className="flex items-center gap-3 p-2.5 rounded-md cursor-pointer hover-elevate"
                      onClick={() => onNavigate?.(action.ctaUrl)}
                      data-testid={`action-item-${action.id}`}
                    >
                      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                           style={{ backgroundColor: `${priorityColor}15` }}>
                        <PIcon className="h-4 w-4" style={{ color: priorityColor }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{action.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{action.impact}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {expiringDocs.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 py-3 px-4">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <ShieldAlert className="h-4 w-4" style={{ color: 'hsl(38 92% 50%)' }} />
                Compliance Alerts
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => onNavigate?.('/files')} data-testid="button-view-compliance">
                View All <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
              </Button>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4">
              <div className="space-y-2">
                {expiringDocs.slice(0, 3).map((doc) => {
                  const expiry = new Date(doc.expiryDate!);
                  const now = new Date();
                  const daysUntil = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                  const isExpired = daysUntil <= 0;
                  const color = isExpired ? 'hsl(0 84.2% 60.2%)' : 'hsl(38 92% 50%)';
                  return (
                    <div
                      key={doc.id}
                      className="flex items-center gap-3 p-2.5 rounded-md cursor-pointer hover-elevate"
                      onClick={() => onNavigate?.('/files')}
                    >
                      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                           style={{ backgroundColor: `${color}15` }}>
                        <ShieldAlert className="h-4 w-4" style={{ color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{doc.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {isExpired ? `Expired ${Math.abs(daysUntil)} days ago` : `Expires in ${daysUntil} days`}
                        </p>
                      </div>
                      <Badge variant="secondary" className={isExpired ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning'}>
                        {isExpired ? 'Expired' : 'Expiring'}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 py-3 px-4">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <CalendarDays className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
            Today's Schedule
          </CardTitle>
          {todaysJobs.length > 0 && onViewJobs && (
            <Button variant="ghost" size="sm" onClick={onViewJobs} data-testid="button-view-all-jobs">
              All Jobs <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
            </Button>
          )}
        </CardHeader>
        <CardContent className="pt-0 px-4 pb-4">
          {todaysJobs.length === 0 ? (
            <div className="text-center py-6">
              <Briefcase className="h-8 w-8 text-muted-foreground/25 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-3">No jobs on today</p>
              {onCreateJob && (
                <Button 
                  size="sm"
                  className="text-white font-medium"
                  style={{ backgroundColor: 'hsl(var(--trade))' }}
                  onClick={onCreateJob}
                  data-testid="button-schedule-job"
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  Schedule a Job
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y">
              {todaysJobs.map((job: any) => (
                <div 
                  key={job.id}
                  className="flex items-center gap-3 py-2.5 cursor-pointer hover-elevate rounded-md -mx-1 px-1"
                  onClick={() => onNavigate?.(`/jobs/${job.id}`)}
                  data-testid={`job-card-${job.id}`}
                >
                  <div className="flex-shrink-0 w-14 text-right pr-2 border-r">
                    <p className="text-sm font-semibold" style={{ color: 'hsl(var(--trade))' }}>
                      {formatJobTime(job.scheduledAt)}
                    </p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">{job.title}</span>
                      {getStatusBadge(job.status)}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      {job.clientName && (
                        <span className="flex items-center gap-1 truncate">
                          <User className="h-3 w-3 flex-shrink-0" />
                          {job.clientName}
                        </span>
                      )}
                      {job.address && (
                        <span 
                          className="flex items-center gap-1 truncate cursor-pointer"
                          style={{ color: 'hsl(var(--trade))' }}
                          onClick={(e) => handleNavigate(job.address, e)}
                          data-testid={`address-link-${job.id}`}
                        >
                          <Navigation className="h-3 w-3 flex-shrink-0" />
                          Map
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {job.clientPhone && (
                      <>
                        <Button variant="ghost" size="icon" onClick={(e) => handleCall(job.clientPhone, e)} data-testid={`button-call-${job.id}`}>
                          <Phone className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={(e) => handleSMS(job.clientPhone, e)} data-testid={`button-sms-${job.id}`}>
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    {getStatusButton(job)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      </div>

      <ActivityFeed 
        limit={5}
        onViewAll={() => onNavigate?.('/communications')}
      />

      <GettingStartedChecklist 
        onNavigate={onNavigate}
        onCreateClient={() => onNavigate?.('/clients')}
        onCreateQuote={onCreateQuote}
      />

      <FloatingActionButton
        onCreateJob={onCreateJob}
        onCreateQuote={onCreateQuote}
        onCreateInvoice={onCreateInvoice}
        onCreateClient={() => onNavigate?.('/clients/new')}
        onCollectPayment={() => onNavigate?.('/collect-payment')}
      />
    </div>
  );
}
