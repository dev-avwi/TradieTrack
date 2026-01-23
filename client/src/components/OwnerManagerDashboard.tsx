import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import GettingStartedChecklist from "./GettingStartedChecklist";
import TrustBanner from "./TrustBanner";
import ActivityFeed from "./ActivityFeed";
import AIAssistant from "./AIAssistant";
import FloatingActionButton from "./FloatingActionButton";
import AIScheduleOptimizer from "./AIScheduleOptimizer";
import { useDashboardKPIs, useTodaysJobs } from "@/hooks/use-dashboard-data";
import { useUpdateJob } from "@/hooks/use-jobs";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { 
  Briefcase, 
  DollarSign, 
  FileText, 
  Clock,
  User,
  MapPin,
  Plus,
  ChevronRight,
  ChevronDown,
  CalendarDays,
  TrendingUp,
  AlertCircle,
  Play,
  CheckCircle,
  Phone,
  MessageSquare,
  Navigation,
  Zap,
  Sparkles,
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
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(true);

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
      toast({
        title: "Job Started",
        description: "Timer started. You're on the clock!",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to start job",
        variant: "destructive",
      });
    }
  };

  const handleCompleteJob = async (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await updateJob.mutateAsync({ 
        id: jobId, 
        data: { status: 'done' } 
      });
      toast({
        title: "Job Complete",
        description: "Nice work! Job marked as done.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to complete job",
        variant: "destructive",
      });
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
    const encodedAddress = encodeURIComponent(address);
    window.open(`https://maps.google.com/maps?q=${encodedAddress}`, '_blank');
  };

  const getStatusButton = (job: any) => {
    if (job.status === 'pending') {
      return (
        <Button
          size="lg"
          className="w-full text-white font-semibold h-12 rounded-xl press-scale"
          style={{ backgroundColor: 'hsl(142.1 76.2% 36.3%)' }}
          onClick={(e) => handleStartJob(job.id, e)}
          disabled={updateJob.isPending}
          data-testid={`button-start-job-${job.id}`}
          aria-label={`Start job: ${job.title}`}
        >
          <Play className="h-5 w-5 mr-2" />
          Start Job
        </Button>
      );
    } else if (job.status === 'in_progress') {
      return (
        <Button
          size="lg"
          className="w-full text-white font-semibold h-12 rounded-xl press-scale"
          style={{ backgroundColor: 'hsl(var(--trade))' }}
          onClick={(e) => handleCompleteJob(job.id, e)}
          disabled={updateJob.isPending}
          data-testid={`button-complete-job-${job.id}`}
          aria-label={`Complete job: ${job.title}`}
        >
          <CheckCircle className="h-5 w-5 mr-2" />
          Complete Job
        </Button>
      );
    }
    return (
      <Button
        size="lg"
        variant="outline"
        className="w-full font-semibold h-12 rounded-xl press-scale"
        onClick={(e) => {
          e.stopPropagation();
          onNavigate?.(`/jobs/${job.id}`);
        }}
        data-testid={`button-view-job-${job.id}`}
        aria-label={`View details for job: ${job.title}`}
      >
        View Details
      </Button>
    );
  };

  const getStatusBadge = (status: string) => {
    if (status === 'done') {
      return <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-xs font-medium">Complete</Badge>;
    } else if (status === 'in_progress') {
      return (
        <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 animate-pulse" />
          In Progress
        </Badge>
      );
    }
    return <Badge variant="outline" className="text-xs font-medium">Scheduled</Badge>;
  };

  return (
    <div className="w-full px-4 sm:px-5 py-5 sm:py-6 pb-28 section-gap" data-testid="owner-manager-dashboard">
      {/* iOS-Style Header */}
      <div className="space-y-1 animate-fade-up">
        <h1 className="ios-title">
          {getGreeting()}, {userName}
        </h1>
        <p className="ios-caption">
          {todaysJobs.length > 0 
            ? `You have ${todaysJobs.length} job${todaysJobs.length > 1 ? 's' : ''} scheduled today`
            : businessName || "Welcome back"}
        </p>
      </div>

      <TrustBanner />

      {/* MONEY OWED - Most important metric for tradies */}
      {(kpis?.unpaidInvoicesTotal ?? 0) > 0 && (
        <section className="animate-fade-up" style={{ animationDelay: '50ms' }}>
          <div 
            className="feed-card card-press cursor-pointer border-2"
            style={{ borderColor: 'hsl(var(--destructive) / 0.3)' }}
            onClick={() => onNavigate?.('/documents?tab=invoices&filter=sent')}
            data-testid="kpi-money-owed"
          >
            <div className="card-padding">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: 'hsl(var(--destructive) / 0.1)' }}
                  >
                    <DollarSign className="h-6 w-6" style={{ color: 'hsl(var(--destructive))' }} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Money Owed to You</p>
                    <p className="text-3xl font-bold" style={{ color: 'hsl(var(--destructive))' }}>
                      ${(kpis?.unpaidInvoicesTotal || 0).toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant="outline" className="text-destructive border-destructive/30">
                    {kpis?.unpaidInvoicesCount || 0} unpaid
                  </Badge>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Quick Stats - Native Grid */}
      <section className="animate-fade-up" style={{ animationDelay: '75ms' }}>
        <h2 className="ios-label mb-3">Quick Stats</h2>
        <div className="grid grid-cols-2 gap-3">
          <div 
            className="feed-card card-press cursor-pointer"
            onClick={() => onNavigate?.('/jobs?filter=in_progress')}
            data-testid="kpi-jobs-today"
          >
            <div className="card-padding">
              <div className="flex items-center gap-3">
                <div 
                  className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}
                >
                  <Briefcase className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{kpis?.jobsToday || 0}</p>
                  <p className="ios-caption">Jobs Today</p>
                </div>
              </div>
            </div>
          </div>
          
          <div 
            className="feed-card card-press cursor-pointer"
            onClick={() => onNavigate?.('/jobs?filter=done')}
            data-testid="kpi-jobs-to-invoice"
          >
            <div className="card-padding">
              <div className="flex items-center gap-3">
                <div 
                  className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: (kpis?.jobsToInvoice ?? 0) > 0 ? 'hsl(38 92% 50% / 0.1)' : 'hsl(var(--muted) / 0.5)' }}
                >
                  <Zap className="h-5 w-5" style={{ color: (kpis?.jobsToInvoice ?? 0) > 0 ? 'hsl(38 92% 50%)' : 'hsl(var(--muted-foreground))' }} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{kpis?.jobsToInvoice ?? 0}</p>
                  <p className="ios-caption">To Invoice</p>
                </div>
              </div>
            </div>
          </div>

          <div 
            className="feed-card card-press cursor-pointer"
            onClick={() => onNavigate?.('/documents?tab=quotes&filter=sent')}
            data-testid="kpi-pending"
          >
            <div className="card-padding">
              <div className="flex items-center gap-3">
                <div 
                  className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: 'hsl(var(--muted) / 0.5)' }}
                >
                  <Clock className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{kpis?.quotesAwaiting || 0}</p>
                  <p className="ios-caption">Quotes Pending</p>
                </div>
              </div>
            </div>
          </div>
          
          <div 
            className="feed-card card-press cursor-pointer"
            onClick={() => onNavigate?.('/documents?tab=invoices&filter=paid')}
            data-testid="kpi-earnings"
          >
            <div className="card-padding">
              <div className="flex items-center gap-3">
                <div 
                  className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: 'hsl(142.1 76.2% 36.3% / 0.1)' }}
                >
                  <TrendingUp className="h-5 w-5" style={{ color: 'hsl(142.1, 76.2%, 36.3%)' }} />
                </div>
                <div>
                  <p className="text-2xl font-bold" style={{ color: 'hsl(142.1, 76.2%, 36.3%)' }}>
                    ${kpis?.weeklyEarnings?.toFixed(0) || "0"}
                  </p>
                  <p className="ios-caption">This Week</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    ${kpis?.monthlyEarnings?.toFixed(0) || "0"} this month
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AI Assistant - Collapsible Section */}
      <section 
        className="animate-fade-up" 
        style={{ animationDelay: '75ms' }}
        data-testid="ai-assistant-section"
      >
        <Collapsible open={isAIAssistantOpen} onOpenChange={setIsAIAssistantOpen}>
          <Card className="overflow-hidden">
            <CollapsibleTrigger asChild>
              <div 
                className="flex items-center justify-between p-4 cursor-pointer hover-elevate"
                style={{ 
                  background: 'linear-gradient(135deg, hsl(var(--trade) / 0.1) 0%, hsl(var(--trade) / 0.05) 100%)'
                }}
              >
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: 'hsl(var(--trade) / 0.15)' }}
                  >
                    <Sparkles className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
                  </div>
                  <div>
                    <h2 className="font-semibold text-base">AI Assistant</h2>
                    <p className="text-xs text-muted-foreground">Ask me anything about your business</p>
                  </div>
                </div>
                <ChevronDown 
                  className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${isAIAssistantOpen ? 'rotate-180' : ''}`} 
                />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="p-0">
                <AIAssistant onNavigate={onNavigate} embedded={true} />
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </section>

      {/* Quick Actions - Native Style - MOVED TO TOP for quick access */}
      <section className="animate-fade-up" style={{ animationDelay: '100ms' }}>
        <h2 className="ios-label mb-3">Quick Actions</h2>
        <div className="feed-card" data-testid="quick-actions-section">
          <div className="card-padding space-y-2">
            <div className="flex gap-2">
              {onCreateJob && (
                <Button 
                  size="sm"
                  className="flex-1 text-white font-medium h-10 px-3 rounded-xl press-scale"
                  style={{ backgroundColor: 'hsl(var(--trade))' }}
                  onClick={onCreateJob}
                  data-testid="button-quick-create-job"
                >
                  <Briefcase className="h-4 w-4 mr-1.5" />
                  <span className="truncate">Job</span>
                </Button>
              )}
              {onCreateQuote && (
                <Button 
                  variant="outline"
                  size="sm"
                  className="flex-1 h-10 px-3 rounded-xl press-scale"
                  onClick={onCreateQuote}
                  data-testid="button-quick-create-quote"
                >
                  <FileText className="h-4 w-4 mr-1.5" />
                  <span className="truncate">Quote</span>
                </Button>
              )}
              {onCreateInvoice && (
                <Button 
                  variant="outline"
                  size="sm"
                  className="flex-1 h-10 px-3 rounded-xl press-scale"
                  onClick={onCreateInvoice}
                  data-testid="button-quick-create-invoice"
                >
                  <DollarSign className="h-4 w-4 mr-1.5" />
                  <span className="truncate">Invoice</span>
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline"
                size="sm"
                className="flex-1 h-10 px-3 rounded-xl press-scale"
                onClick={() => onNavigate?.('/time-tracking')}
                data-testid="button-log-hours"
              >
                <Timer className="h-4 w-4 mr-1.5" />
                <span className="truncate">Log Hours</span>
              </Button>
              <Button 
                variant="outline"
                size="sm"
                className="flex-1 h-10 px-3 rounded-xl press-scale"
                onClick={() => onNavigate?.('/collect-payment')}
                data-testid="button-request-payment"
              >
                <CreditCard className="h-4 w-4 mr-1.5" />
                <span className="truncate">Request Payment</span>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Two-column layout: Left (AI Optimizer), Right (Today + Activity) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 items-start animate-fade-up" style={{ animationDelay: '150ms' }}>
        {/* LEFT COLUMN - AI Optimizer */}
        <div className="space-y-4 lg:space-y-6 order-2 lg:order-1">
          <AIScheduleOptimizer 
            className="shadow-lg h-full"
            onApplySchedule={(schedule) => {
              toast({
                title: "Schedule Applied",
                description: `Optimised route with ${schedule.optimizedOrder.length} jobs saved`,
              });
            }}
          />
        </div>

        {/* RIGHT COLUMN - Today + Activity stacking */}
        <div className="space-y-4 lg:space-y-6 order-1 lg:order-2">
        {/* TODAY'S SCHEDULE - Native Feed Style */}
        <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="ios-section-title flex items-center gap-2.5">
            <div 
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}
            >
              <CalendarDays className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
            </div>
            Today
          </h2>
          {todaysJobs.length > 0 && onViewJobs && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-xs h-8 px-3 rounded-xl press-scale"
              onClick={onViewJobs}
              data-testid="button-view-all-jobs"
            >
              View All
              <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          )}
        </div>

        {todaysJobs.length === 0 ? (
          <div className="feed-card card-padding text-center" data-testid="no-jobs-card">
            <div 
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: 'hsl(var(--muted) / 0.5)' }}
            >
              <Briefcase className="h-8 w-8 text-muted-foreground opacity-50" />
            </div>
            <p className="ios-body text-muted-foreground mb-4">No jobs scheduled for today</p>
            {onCreateJob && (
              <Button 
                size="lg"
                className="text-white font-semibold h-12 px-6 rounded-xl press-scale"
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
          <div className="feed-gap">
            {todaysJobs.map((job: any, index: number) => (
              <div 
                key={job.id}
                className={`${index === 0 ? 'card-accent' : 'feed-card border'} card-press cursor-pointer animate-slide-in stagger-delay-${Math.min(index + 1, 8)}`}
                style={{ opacity: 0 }}
                onClick={() => onNavigate?.(`/jobs/${job.id}`)}
                data-testid={`job-card-${job.id}`}
              >
                <div className="card-padding">
                  {/* Job Header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}
                      >
                        <span className="font-bold text-lg" style={{ color: 'hsl(var(--trade))' }}>
                          {formatJobTime(job.scheduledAt).split(' ')[0]}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="ios-label">
                            {formatJobTime(job.scheduledAt).split(' ')[1]}
                          </span>
                          {getStatusBadge(job.status)}
                        </div>
                        <h3 className="ios-card-title line-clamp-1 mt-0.5">{job.title}</h3>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" />
                  </div>

                  {/* Client & Address */}
                  <div className="space-y-1.5 mb-4">
                    {job.clientName && (
                      <div className="flex items-center gap-2 ios-body">
                        <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="line-clamp-1">{job.clientName}</span>
                      </div>
                    )}
                    {job.address && (
                      <div 
                        className="flex items-center gap-2 ios-caption cursor-pointer hover:text-primary transition-colors"
                        onClick={(e) => handleNavigate(job.address, e)}
                        data-testid={`address-link-${job.id}`}
                      >
                        <Navigation className="h-4 w-4 flex-shrink-0 text-primary" />
                        <span className="line-clamp-1 underline underline-offset-2">{job.address}</span>
                      </div>
                    )}
                  </div>

                  {/* Quick Contact Buttons - Call & SMS only (address is now one-tap above) */}
                  {job.clientPhone && (
                    <div className="flex gap-2 mb-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-10 rounded-xl press-scale"
                        onClick={(e) => handleCall(job.clientPhone, e)}
                        data-testid={`button-call-${job.id}`}
                        aria-label={`Call ${job.clientName}`}
                      >
                        <Phone className="h-4 w-4 mr-1.5" />
                        Call
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-10 rounded-xl press-scale"
                        onClick={(e) => handleSMS(job.clientPhone, e)}
                        data-testid={`button-sms-${job.id}`}
                        aria-label={`Send SMS to ${job.clientName}`}
                      >
                        <MessageSquare className="h-4 w-4 mr-1.5" />
                        SMS
                      </Button>
                    </div>
                  )}

                  {/* Primary Action Button */}
                  {getStatusButton(job)}
                </div>
              </div>
            ))}
          </div>
        )}
        </section>

        {/* RECENT ACTIVITY - in right column */}
        <ActivityFeed 
          limit={5}
          onViewAll={() => onNavigate?.('/communications')}
        />
        </div>
      </div>

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
