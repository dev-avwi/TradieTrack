import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
          Complete
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

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-28 space-y-6" data-testid="owner-manager-dashboard">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          {getGreeting()}, {userName}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {todaysJobs.length > 0 
            ? `${todaysJobs.length} job${todaysJobs.length > 1 ? 's' : ''} scheduled today`
            : businessName || "Welcome back"}
        </p>
      </div>

      <TrustBanner />

      {/* KPI Row - Full Width */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(kpis?.unpaidInvoicesTotal ?? 0) > 0 && (
          <Card 
            className="cursor-pointer hover-elevate col-span-2 sm:col-span-2"
            onClick={() => onNavigate?.('/documents?tab=invoices&filter=sent')}
            data-testid="kpi-money-owed"
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                   style={{ backgroundColor: 'hsl(var(--destructive) / 0.1)' }}>
                <DollarSign className="h-5 w-5" style={{ color: 'hsl(var(--destructive))' }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground font-medium">Money Owed</p>
                <p className="text-xl font-bold" style={{ color: 'hsl(var(--destructive))' }}>
                  {fmtAud(kpis?.unpaidInvoicesTotal || 0)}
                </p>
              </div>
              <Badge variant="outline" className="text-destructive border-destructive/30 text-xs flex-shrink-0">
                {kpis?.unpaidInvoicesCount || 0} unpaid
              </Badge>
            </CardContent>
          </Card>
        )}

        <Card 
          className="cursor-pointer hover-elevate"
          onClick={() => onNavigate?.('/jobs?filter=in_progress')}
          data-testid="kpi-jobs-today"
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Briefcase className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
              <span className="text-xs text-muted-foreground font-medium">Jobs Today</span>
            </div>
            <p className="text-2xl font-bold">{kpis?.jobsToday || 0}</p>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover-elevate"
          onClick={() => onNavigate?.('/jobs?filter=done')}
          data-testid="kpi-jobs-to-invoice"
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="h-4 w-4" style={{ color: (kpis?.jobsToInvoice ?? 0) > 0 ? 'hsl(38 92% 50%)' : undefined }} />
              <span className="text-xs text-muted-foreground font-medium">To Invoice</span>
            </div>
            <p className="text-2xl font-bold">{kpis?.jobsToInvoice ?? 0}</p>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover-elevate"
          onClick={() => onNavigate?.('/documents?tab=quotes&filter=sent')}
          data-testid="kpi-pending"
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-medium">Quotes Pending</span>
            </div>
            <p className="text-2xl font-bold">{kpis?.quotesAwaiting || 0}</p>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover-elevate"
          onClick={() => onNavigate?.('/documents?tab=invoices&filter=paid')}
          data-testid="kpi-earnings"
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4" style={{ color: 'hsl(142.1, 76.2%, 36.3%)' }} />
              <span className="text-xs text-muted-foreground font-medium">This Week</span>
            </div>
            <p className="text-xl font-bold" style={{ color: 'hsl(142.1, 76.2%, 36.3%)' }}>
              {fmtAud(kpis?.weeklyEarnings || 0)}
            </p>
            <p className="text-[10px] text-muted-foreground">{fmtAud(kpis?.monthlyEarnings || 0)} this month</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions - Full Width */}
      <Card data-testid="quick-actions-section">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2">
            {onCreateJob && (
              <Button 
                size="sm"
                className="text-white font-medium"
                style={{ backgroundColor: 'hsl(var(--trade))' }}
                onClick={onCreateJob}
                data-testid="button-quick-create-job"
              >
                <Briefcase className="h-4 w-4 mr-1.5" />
                Job
              </Button>
            )}
            {onCreateQuote && (
              <Button 
                variant="outline"
                size="sm"
                onClick={onCreateQuote}
                data-testid="button-quick-create-quote"
              >
                <FileText className="h-4 w-4 mr-1.5" />
                Quote
              </Button>
            )}
            {onCreateInvoice && (
              <Button 
                variant="outline"
                size="sm"
                onClick={onCreateInvoice}
                data-testid="button-quick-create-invoice"
              >
                <DollarSign className="h-4 w-4 mr-1.5" />
                Invoice
              </Button>
            )}
            <Button 
              variant="outline"
              size="sm"
              onClick={() => onNavigate?.('/time-tracking')}
              data-testid="button-log-hours"
            >
              <Timer className="h-4 w-4 mr-1.5" />
              Log Hours
            </Button>
            <Button 
              variant="outline"
              size="sm"
              onClick={() => onNavigate?.('/collect-payment')}
              data-testid="button-request-payment"
            >
              <CreditCard className="h-4 w-4 mr-1.5" />
              Collect Payment
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Content - Two Columns on Desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* LEFT COLUMN */}
        <div className="space-y-4">
          {/* Today's Schedule */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarDays className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
                Today's Schedule
              </CardTitle>
              {todaysJobs.length > 0 && onViewJobs && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={onViewJobs}
                  data-testid="button-view-all-jobs"
                >
                  View All
                  <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              )}
            </CardHeader>
            <CardContent className="pt-0">
              {todaysJobs.length === 0 ? (
                <div className="text-center py-8">
                  <Briefcase className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground mb-4">No jobs scheduled for today</p>
                  {onCreateJob && (
                    <Button 
                      className="text-white font-medium"
                      style={{ backgroundColor: 'hsl(var(--trade))' }}
                      onClick={onCreateJob}
                      data-testid="button-schedule-job"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Schedule a Job
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {todaysJobs.map((job: any) => (
                    <div 
                      key={job.id}
                      className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20 cursor-pointer hover-elevate"
                      onClick={() => onNavigate?.(`/jobs/${job.id}`)}
                      data-testid={`job-card-${job.id}`}
                    >
                      <div className="flex-shrink-0 text-center w-12">
                        <p className="text-sm font-bold" style={{ color: 'hsl(var(--trade))' }}>
                          {formatJobTime(job.scheduledAt).replace(/(am|pm)/, '')}
                        </p>
                        <p className="text-[10px] text-muted-foreground uppercase">
                          {formatJobTime(job.scheduledAt).includes('am') ? 'AM' : 'PM'}
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
                              className="flex items-center gap-1 truncate cursor-pointer text-primary"
                              onClick={(e) => handleNavigate(job.address, e)}
                              data-testid={`address-link-${job.id}`}
                            >
                              <Navigation className="h-3 w-3 flex-shrink-0" />
                              Map
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {job.clientPhone && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => handleCall(job.clientPhone, e)}
                              data-testid={`button-call-${job.id}`}
                            >
                              <Phone className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => handleSMS(job.clientPhone, e)}
                              data-testid={`button-sms-${job.id}`}
                            >
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

          {/* Cashflow Insight */}
          {cashflowLoading ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-primary" />
                  Cashflow Insight
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0"><Skeleton className="h-32 w-full" /></CardContent>
            </Card>
          ) : cashflow ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-primary" />
                  Cashflow Insight
                  {cashflow.collectedTrend > 0 ? (
                    <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-xs ml-auto">
                      <TrendingUp className="h-3 w-3 mr-1" />+{cashflow.collectedTrend}%
                    </Badge>
                  ) : cashflow.collectedTrend < 0 ? (
                    <Badge className="bg-red-500/10 text-red-600 border-red-500/20 text-xs ml-auto">
                      {cashflow.collectedTrend}%
                    </Badge>
                  ) : null}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-4">
                {/* Weekly Bar Chart */}
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Weekly Collections</p>
                  <div className="flex items-end gap-2 h-16">
                    {cashflow.revenueByWeek.map((week, i) => {
                      const maxAmount = Math.max(...cashflow.revenueByWeek.map(w => w.amount), 1);
                      const heightPercent = Math.max((week.amount / maxAmount) * 100, 4);
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-[10px] text-muted-foreground font-medium">
                            {week.amount > 0 ? `$${(week.amount / 1000).toFixed(1)}k` : '-'}
                          </span>
                          <div 
                            className="w-full rounded-t-md"
                            style={{ 
                              height: `${heightPercent}%`,
                              backgroundColor: i === cashflow.revenueByWeek.length - 1 ? 'hsl(var(--primary))' : 'hsl(var(--primary) / 0.3)',
                              minHeight: '3px'
                            }}
                          />
                          <span className="text-[10px] text-muted-foreground">{week.week}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Month Comparison */}
                <div className="flex items-center justify-between gap-4 pt-3 border-t">
                  <div>
                    <p className="text-xs text-muted-foreground">This Month</p>
                    <p className="text-lg font-bold" style={{ color: 'hsl(142.1, 76.2%, 36.3%)' }}>
                      {fmtAud(cashflow.collectedThisMonth)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Last Month</p>
                    <p className="text-lg font-bold text-muted-foreground">
                      {fmtAud(cashflow.collectedLastMonth)}
                    </p>
                  </div>
                </div>

                {/* Due & Overdue */}
                {cashflow.dueThisWeekCount > 0 && (
                  <div 
                    className="flex items-center justify-between gap-4 p-3 rounded-lg border cursor-pointer hover-elevate"
                    onClick={() => onNavigate?.('/documents?tab=invoices')}
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" style={{ color: 'hsl(38 92% 50%)' }} />
                      <div>
                        <p className="text-sm font-medium">Due This Week</p>
                        <p className="text-xs text-muted-foreground">{cashflow.dueThisWeekCount} invoice{cashflow.dueThisWeekCount !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <p className="text-sm font-bold" style={{ color: 'hsl(38 92% 50%)' }}>{fmtAud(cashflow.dueThisWeek)}</p>
                  </div>
                )}

                {cashflow.overdueCount > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-4">
                      <span className="flex items-center gap-1.5 text-sm font-medium" style={{ color: 'hsl(var(--destructive))' }}>
                        <AlertCircle className="h-4 w-4" />
                        Overdue ({cashflow.overdueCount})
                      </span>
                      <span className="text-sm font-bold" style={{ color: 'hsl(var(--destructive))' }}>
                        {fmtAud(cashflow.overdueTotal)}
                      </span>
                    </div>
                    {cashflow.overdueInvoices.map((inv) => (
                      <div 
                        key={inv.id} 
                        className="flex items-center justify-between gap-4 py-2 border-t cursor-pointer"
                        onClick={() => onNavigate?.(`/invoices/${inv.id}`)}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{inv.clientName}</p>
                          <p className="text-xs text-muted-foreground">#{inv.number}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <p className="text-sm font-semibold">{fmtAud(inv.total)}</p>
                          <Badge variant="outline" className="text-destructive border-destructive/30 text-xs">
                            {inv.daysOverdue}d
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-4">
          {/* Profit Snapshot */}
          {profitLoading ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" style={{ color: 'hsl(142.1, 76.2%, 36.3%)' }} />
                  Profit Snapshot
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0"><Skeleton className="h-24 w-full" /></CardContent>
            </Card>
          ) : profitSnapshot && (profitSnapshot.revenueThisMonth > 0 || profitSnapshot.labourCostThisMonth > 0 || profitSnapshot.materialCostThisMonth > 0) ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" style={{ color: 'hsl(142.1, 76.2%, 36.3%)' }} />
                  Profit Snapshot
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Revenue</p>
                    <p className="text-lg font-bold" style={{ color: 'hsl(142.1, 76.2%, 36.3%)' }}>
                      {fmtAud(profitSnapshot.revenueThisMonth)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Gross Profit</p>
                    <p className="text-lg font-bold" style={{ color: profitSnapshot.grossProfit >= 0 ? 'hsl(142.1, 76.2%, 36.3%)' : 'hsl(var(--destructive))' }}>
                      {fmtAud(Math.abs(profitSnapshot.grossProfit))}
                      {profitSnapshot.grossProfit < 0 && ' loss'}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{profitSnapshot.grossMargin}% margin</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Labour</p>
                    <p className="text-base font-semibold">{fmtAud(profitSnapshot.labourCostThisMonth)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Materials</p>
                    <p className="text-base font-semibold">{fmtAud(profitSnapshot.materialCostThisMonth)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* Team Performance */}
          {teamPerfLoading ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Team Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0"><Skeleton className="h-24 w-full" /></CardContent>
            </Card>
          ) : teamPerformance && teamPerformance.workers.length > 0 ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Team Performance
                </CardTitle>
                <span className="text-xs text-muted-foreground">Last 30 days</span>
              </CardHeader>
              <CardContent className="pt-0 space-y-4">
                {/* Summary */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-2.5 rounded-lg bg-muted/50">
                    <p className="text-lg font-bold">{teamPerformance.summary.totalHours}</p>
                    <p className="text-[10px] text-muted-foreground">Hours</p>
                  </div>
                  <div className="text-center p-2.5 rounded-lg bg-muted/50">
                    <p className="text-lg font-bold">{teamPerformance.summary.totalJobs}</p>
                    <p className="text-[10px] text-muted-foreground">Jobs</p>
                  </div>
                  <div className="text-center p-2.5 rounded-lg bg-muted/50">
                    <p className="text-lg font-bold" style={{ color: 'hsl(142.1, 76.2%, 36.3%)' }}>
                      ${(teamPerformance.summary.totalRevenue / 1000).toFixed(1)}k
                    </p>
                    <p className="text-[10px] text-muted-foreground">Revenue</p>
                  </div>
                </div>

                {/* Workers */}
                <div className="space-y-2.5">
                  {teamPerformance.workers.map((worker, index) => (
                    <div key={worker.id} className={`flex items-center justify-between gap-3 ${index > 0 ? 'pt-2.5 border-t' : ''}`}>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold"
                          style={{ backgroundColor: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' }}
                        >
                          {worker.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{worker.name}</p>
                          <p className="text-[10px] text-muted-foreground capitalize">{worker.role}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 flex-shrink-0 text-right">
                        <div>
                          <p className="text-sm font-semibold">{worker.hoursThisMonth}h</p>
                          <p className="text-[10px] text-muted-foreground">{worker.hoursThisWeek}h/wk</p>
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{worker.jobsCompleted}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {worker.jobsActive > 0 ? `${worker.jobsActive} active` : 'jobs'}
                          </p>
                        </div>
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
      </div>

      {/* AI Day Planner - Full Width */}
      <AIScheduleOptimizer 
        className="shadow-lg"
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
