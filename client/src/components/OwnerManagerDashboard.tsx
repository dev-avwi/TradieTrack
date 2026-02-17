import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import GettingStartedChecklist from "./GettingStartedChecklist";
import TrustBanner from "./TrustBanner";
import ActivityFeed from "./ActivityFeed";
import FloatingActionButton from "./FloatingActionButton";
import AIScheduleOptimizer from "./AIScheduleOptimizer";
import { useDashboardKPIs, useTodaysJobs } from "@/hooks/use-dashboard-data";
import { useUpdateJob } from "@/hooks/use-jobs";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Briefcase, 
  DollarSign, 
  FileText, 
  Clock,
  User,
  Users,
  Plus,
  ChevronRight,
  CalendarDays,
  TrendingUp,
  AlertCircle,
  Play,
  CheckCircle,
  Phone,
  MessageSquare,
  Navigation,
  Zap,
  Timer,
  Receipt,
  CreditCard
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

export default function OwnerManagerDashboard({
  userName = "there",
  businessName,
  onCreateJob,
  onCreateQuote,
  onCreateInvoice,
  onViewJobs,
  onNavigate,
}: OwnerManagerDashboardProps) {
  const { data: kpis } = useDashboardKPIs();
  const { data: todaysJobs = [] } = useTodaysJobs();
  const updateJob = useUpdateJob();
  const { toast } = useToast();

  interface CashflowData {
    outstandingTotal: number;
    overdueTotal: number;
    overdueCount: number;
    overdueInvoices: Array<{
      id: string;
      number: string;
      clientName: string;
      total: number;
      dueDate: string;
      daysOverdue: number;
    }>;
    dueThisWeek: number;
    dueThisWeekCount: number;
    collectedThisMonth: number;
    collectedLastMonth: number;
    collectedTrend: number;
    revenueByWeek: Array<{ week: string; amount: number }>;
  }

  interface ProfitSnapshot {
    revenueToday: number;
    revenueThisWeek: number;
    revenueThisMonth: number;
    labourCostThisMonth: number;
    materialCostThisMonth: number;
    grossProfit: number;
    grossMargin: number;
    cashCollectedToday: number;
  }
  const { data: profitSnapshot, isLoading: profitLoading } = useQuery<ProfitSnapshot>({
    queryKey: ["/api/dashboard/profit-snapshot"],
  });

  const { data: cashflow, isLoading: cashflowLoading } = useQuery<CashflowData>({
    queryKey: ["/api/dashboard/cashflow"],
  });

  interface TeamPerformance {
    workers: Array<{
      id: string;
      name: string;
      role: string;
      hoursThisMonth: number;
      hoursThisWeek: number;
      jobsCompleted: number;
      jobsActive: number;
      revenueGenerated: number;
    }>;
    summary: {
      totalHours: number;
      totalJobs: number;
      totalRevenue: number;
    };
    period: string;
  }

  const { data: teamPerformance, isLoading: teamPerfLoading } = useQuery<TeamPerformance>({
    queryKey: ["/api/dashboard/team-performance"],
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
      {/* ─── HEADER + QUICK ACTIONS ─── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5">
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
          <Button variant="outline" size="sm" onClick={() => onNavigate?.('/time-tracking')} data-testid="button-log-hours">
            <Timer className="h-3.5 w-3.5 mr-1" />
            Hours
          </Button>
          <Button variant="outline" size="sm" onClick={() => onNavigate?.('/collect-payment')} data-testid="button-request-payment">
            <CreditCard className="h-3.5 w-3.5 mr-1" />
            Payment
          </Button>
        </div>
      </div>

      <TrustBanner />

      {/* ─── MONEY AT A GLANCE ─── */}
      {hasMoneyData && (
        <Card 
          className="mb-4 cursor-pointer hover-elevate"
          onClick={() => onNavigate?.('/documents?tab=invoices&filter=sent')}
          data-testid="kpi-money-owed"
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                     style={{ backgroundColor: 'hsl(var(--destructive) / 0.1)' }}>
                  <DollarSign className="h-5 w-5" style={{ color: 'hsl(var(--destructive))' }} />
                </div>
                <div>
                  <p className="text-2xl font-bold" style={{ color: 'hsl(var(--destructive))' }}>
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
                {(cashflow?.dueThisWeekCount ?? 0) > 0 && (
                  <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs">
                    <Clock className="h-3 w-3 mr-1" />
                    {cashflow?.dueThisWeekCount} due
                  </Badge>
                )}
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── STATS ROW ─── */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <Card 
          className="cursor-pointer hover-elevate"
          onClick={() => onNavigate?.('/jobs?filter=in_progress')}
          data-testid="kpi-jobs-today"
        >
          <CardContent className="text-center py-3 px-2">
            <p className="text-2xl font-bold">{kpis?.jobsToday || 0}</p>
            <p className="text-[11px] text-muted-foreground font-medium">Jobs Today</p>
          </CardContent>
        </Card>
        <Card 
          className="cursor-pointer hover-elevate"
          onClick={() => onNavigate?.('/jobs?filter=done')}
          data-testid="kpi-jobs-to-invoice"
        >
          <CardContent className="text-center py-3 px-2">
            <p className="text-2xl font-bold" style={{ color: (kpis?.jobsToInvoice ?? 0) > 0 ? 'hsl(38 92% 50%)' : undefined }}>
              {kpis?.jobsToInvoice ?? 0}
            </p>
            <p className="text-[11px] text-muted-foreground font-medium">To Invoice</p>
          </CardContent>
        </Card>
        <Card 
          className="cursor-pointer hover-elevate"
          onClick={() => onNavigate?.('/documents?tab=quotes&filter=sent')}
          data-testid="kpi-pending"
        >
          <CardContent className="text-center py-3 px-2">
            <p className="text-2xl font-bold">{kpis?.quotesAwaiting || 0}</p>
            <p className="text-[11px] text-muted-foreground font-medium">Quotes Out</p>
          </CardContent>
        </Card>
        <Card 
          className="cursor-pointer hover-elevate"
          onClick={() => onNavigate?.('/documents?tab=invoices&filter=paid')}
          data-testid="kpi-earnings"
        >
          <CardContent className="text-center py-3 px-2">
            <p className="text-2xl font-bold" style={{ color: 'hsl(142.1, 76.2%, 36.3%)' }}>
              {fmtAud(kpis?.weeklyEarnings || 0)}
            </p>
            <p className="text-[11px] text-muted-foreground font-medium">This Week</p>
          </CardContent>
        </Card>
      </div>

      {/* ─── TODAY'S SCHEDULE ─── */}
      <Card className="mb-4">
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

      {/* ─── FINANCIAL ROW: Profit + Cashflow side by side ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
        {/* Profit Snapshot */}
        {profitLoading ? (
          <Card><CardContent className="p-4"><Skeleton className="h-24 w-full" /></CardContent></Card>
        ) : profitSnapshot && (profitSnapshot.revenueThisMonth > 0 || profitSnapshot.labourCostThisMonth > 0 || profitSnapshot.materialCostThisMonth > 0) ? (
          <Card>
            <CardHeader className="py-3 px-4 pb-2">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" style={{ color: 'hsl(142.1, 76.2%, 36.3%)' }} />
                Profit This Month
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <div className="flex items-baseline gap-3 mb-3">
                <p className="text-2xl font-bold" style={{ color: 'hsl(142.1, 76.2%, 36.3%)' }}>
                  {fmtAud(profitSnapshot.grossProfit)}
                </p>
                <span className="text-xs text-muted-foreground">{profitSnapshot.grossMargin}% margin</span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center border-t pt-3">
                <div>
                  <p className="text-sm font-semibold">{fmtAud(profitSnapshot.revenueThisMonth)}</p>
                  <p className="text-[10px] text-muted-foreground">Revenue</p>
                </div>
                <div>
                  <p className="text-sm font-semibold">{fmtAud(profitSnapshot.labourCostThisMonth)}</p>
                  <p className="text-[10px] text-muted-foreground">Labour</p>
                </div>
                <div>
                  <p className="text-sm font-semibold">{fmtAud(profitSnapshot.materialCostThisMonth)}</p>
                  <p className="text-[10px] text-muted-foreground">Materials</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Cashflow Insight */}
        {cashflowLoading ? (
          <Card><CardContent className="p-4"><Skeleton className="h-24 w-full" /></CardContent></Card>
        ) : cashflow ? (
          <Card>
            <CardHeader className="py-3 px-4 pb-2">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Receipt className="h-4 w-4 text-primary" />
                Cashflow
                {cashflow.collectedTrend > 0 ? (
                  <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-xs ml-auto no-default-active-elevate">
                    +{cashflow.collectedTrend}%
                  </Badge>
                ) : cashflow.collectedTrend < 0 ? (
                  <Badge className="bg-red-500/10 text-red-600 border-red-500/20 text-xs ml-auto no-default-active-elevate">
                    {cashflow.collectedTrend}%
                  </Badge>
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0 space-y-3">
              <div className="flex items-end gap-1.5 h-10">
                {cashflow.revenueByWeek.map((week, i) => {
                  const maxAmount = Math.max(...cashflow.revenueByWeek.map(w => w.amount), 1);
                  const heightPercent = Math.max((week.amount / maxAmount) * 100, 6);
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                      <div 
                        className="w-full rounded-sm"
                        style={{ 
                          height: `${heightPercent}%`,
                          backgroundColor: i === cashflow.revenueByWeek.length - 1 ? 'hsl(var(--primary))' : 'hsl(var(--primary) / 0.25)',
                          minHeight: '3px'
                        }}
                      />
                      <span className="text-[9px] text-muted-foreground">{week.week}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-lg font-bold" style={{ color: 'hsl(142.1, 76.2%, 36.3%)' }}>
                    {fmtAud(cashflow.collectedThisMonth)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">this month</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-muted-foreground">
                    {fmtAud(cashflow.collectedLastMonth)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">last month</p>
                </div>
              </div>

              {cashflow.overdueCount > 0 && (
                <div 
                  className="border-t pt-2 cursor-pointer"
                  onClick={() => onNavigate?.('/documents?tab=invoices&filter=overdue')}
                >
                  <div className="flex items-center justify-between gap-4 mb-1.5">
                    <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: 'hsl(var(--destructive))' }}>
                      <AlertCircle className="h-3.5 w-3.5" />
                      Overdue ({cashflow.overdueCount})
                    </span>
                    <span className="text-sm font-bold" style={{ color: 'hsl(var(--destructive))' }}>
                      {fmtAud(cashflow.overdueTotal)}
                    </span>
                  </div>
                  <div className="space-y-0">
                    {cashflow.overdueInvoices.slice(0, 3).map((inv) => (
                      <div 
                        key={inv.id} 
                        className="flex items-center justify-between gap-4 py-1.5 text-sm hover-elevate rounded-md -mx-1 px-1 cursor-pointer"
                        onClick={(e) => { e.stopPropagation(); onNavigate?.(`/invoices/${inv.id}`); }}
                      >
                        <span className="text-muted-foreground truncate">{inv.clientName || 'Unknown'}</span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="font-medium">{fmtAud(inv.total)}</span>
                          <span className="text-xs font-medium" style={{ color: 'hsl(var(--destructive))' }}>{inv.daysOverdue}d</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>

      {/* ─── TEAM + ACTIVITY ROW ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
        {/* Team Performance */}
        {teamPerfLoading ? (
          <Card><CardContent className="p-4"><Skeleton className="h-24 w-full" /></CardContent></Card>
        ) : teamPerformance && teamPerformance.workers.length > 0 ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 py-3 px-4 pb-2">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Team (30 days)
              </CardTitle>
              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0">
                <span>{teamPerformance.summary.totalHours}h</span>
                <span>{teamPerformance.summary.totalJobs} jobs</span>
                <span style={{ color: 'hsl(142.1, 76.2%, 36.3%)' }}>{fmtAud(teamPerformance.summary.totalRevenue)}</span>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <div className="divide-y">
                {teamPerformance.workers.map((worker) => (
                  <div key={worker.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar className="h-7 w-7 flex-shrink-0">
                        <AvatarFallback className="text-[10px] font-semibold" style={{ backgroundColor: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' }}>
                          {worker.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{worker.name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0 text-xs text-muted-foreground">
                      <span>{worker.hoursThisMonth}h</span>
                      <span>{worker.jobsCompleted} done</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Activity Feed */}
        <ActivityFeed 
          limit={5}
          onViewAll={() => onNavigate?.('/communications')}
        />
      </div>

      {/* AI Day Planner */}
      <AIScheduleOptimizer 
        onApplySchedule={(schedule) => {
          toast({
            title: "Schedule Applied",
            description: `Optimised route with ${schedule.optimizedOrder.length} jobs saved`,
          });
        }}
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
