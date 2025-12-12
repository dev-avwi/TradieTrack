import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAppMode } from "@/hooks/use-app-mode";
import { format, isToday, isTomorrow, parseISO, formatDistanceToNow } from "date-fns";
import {
  Briefcase,
  Clock,
  DollarSign,
  FileText,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  MapPin,
  Phone,
  Plus,
  Calendar,
  TrendingUp,
  Zap,
  ChevronRight,
  Play,
  Send,
  Receipt
} from "lucide-react";

interface Job {
  id: number;
  title: string;
  description?: string;
  status: string;
  scheduledDate?: string;
  scheduledTime?: string;
  address?: string;
  clientId?: number;
  client?: { name: string; phone?: string };
}

interface Quote {
  id: number;
  quoteNumber: string;
  status: string;
  total: string;
  createdAt: string;
  client?: { name: string };
}

interface Invoice {
  id: number;
  invoiceNumber: string;
  status: string;
  total: string;
  dueDate?: string;
  client?: { name: string };
}

interface NextAction {
  id: string;
  type: 'job' | 'quote' | 'invoice' | 'payment';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  action: string;
  actionUrl: string;
  icon: typeof Briefcase;
}

export default function TodayDashboard() {
  const [, setLocation] = useLocation();
  const { isOwner, isManager, isTradie, isTeam } = useAppMode();
  const isStaff = isTradie && !isOwner && !isManager;

  const { data: jobs = [], isLoading: jobsLoading } = useQuery<Job[]>({
    queryKey: ['/api/jobs'],
  });

  const { data: quotes = [], isLoading: quotesLoading } = useQuery<Quote[]>({
    queryKey: ['/api/quotes'],
    enabled: !isStaff,
  });

  const { data: invoices = [], isLoading: invoicesLoading } = useQuery<Invoice[]>({
    queryKey: ['/api/invoices'],
    enabled: !isStaff,
  });

  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');

  const todaysJobs = jobs.filter(job => {
    if (!job.scheduledDate) return false;
    const jobDate = job.scheduledDate.split('T')[0];
    return jobDate === todayStr && job.status !== 'invoiced';
  }).sort((a, b) => {
    if (!a.scheduledTime) return 1;
    if (!b.scheduledTime) return -1;
    return a.scheduledTime.localeCompare(b.scheduledTime);
  });

  const upcomingJobs = jobs.filter(job => {
    if (!job.scheduledDate) return false;
    const jobDate = new Date(job.scheduledDate);
    return jobDate > today && job.status !== 'invoiced';
  }).slice(0, 3);

  const inProgressJobs = jobs.filter(job => job.status === 'in_progress');
  const pendingQuotes = quotes.filter(q => q.status === 'draft' || q.status === 'sent');
  const unpaidInvoices = invoices.filter(i => i.status !== 'paid');
  const overdueInvoices = invoices.filter(i => {
    if (i.status === 'paid' || !i.dueDate) return false;
    return new Date(i.dueDate) < today;
  });

  const totalOutstanding = unpaidInvoices.reduce((sum, inv) => sum + parseFloat(inv.total || '0'), 0);

  const generateNextActions = (): NextAction[] => {
    const actions: NextAction[] = [];

    if (inProgressJobs.length > 0) {
      const job = inProgressJobs[0];
      actions.push({
        id: `job-${job.id}`,
        type: 'job',
        title: `Complete "${job.title}"`,
        description: 'Job is in progress - finish up and add photos',
        priority: 'high',
        action: 'View Job',
        actionUrl: `/jobs/${job.id}`,
        icon: Play,
      });
    }

    if (todaysJobs.length > 0 && inProgressJobs.length === 0) {
      const job = todaysJobs[0];
      actions.push({
        id: `start-${job.id}`,
        type: 'job',
        title: `Start "${job.title}"`,
        description: job.scheduledTime ? `Scheduled for ${job.scheduledTime}` : 'Scheduled for today',
        priority: 'high',
        action: 'Start Job',
        actionUrl: `/jobs/${job.id}`,
        icon: Play,
      });
    }

    const draftQuotes = quotes.filter(q => q.status === 'draft');
    if (draftQuotes.length > 0) {
      const quote = draftQuotes[0];
      actions.push({
        id: `quote-${quote.id}`,
        type: 'quote',
        title: `Send quote to ${quote.client?.name || 'client'}`,
        description: `$${parseFloat(quote.total || '0').toLocaleString()} - ready to send`,
        priority: 'medium',
        action: 'Send Quote',
        actionUrl: `/quotes/${quote.id}`,
        icon: Send,
      });
    }

    if (overdueInvoices.length > 0) {
      const invoice = overdueInvoices[0];
      actions.push({
        id: `overdue-${invoice.id}`,
        type: 'invoice',
        title: `Chase payment from ${invoice.client?.name || 'client'}`,
        description: `$${parseFloat(invoice.total || '0').toLocaleString()} overdue`,
        priority: 'high',
        action: 'View Invoice',
        actionUrl: `/invoices/${invoice.id}`,
        icon: AlertCircle,
      });
    }

    const completedJobsNeedingInvoice = jobs.filter(j => j.status === 'done');
    if (completedJobsNeedingInvoice.length > 0) {
      const job = completedJobsNeedingInvoice[0];
      actions.push({
        id: `invoice-${job.id}`,
        type: 'job',
        title: `Create invoice for "${job.title}"`,
        description: 'Job completed - time to get paid',
        priority: 'medium',
        action: 'Create Invoice',
        actionUrl: `/invoices/new?jobId=${job.id}`,
        icon: Receipt,
      });
    }

    return actions.slice(0, 4);
  };

  const nextActions = generateNextActions();

  const getPriorityColor = (priority: 'high' | 'medium' | 'low') => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-700 border-red-200';
      case 'medium': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'low': return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      pending: { variant: 'outline', label: 'Pending' },
      scheduled: { variant: 'secondary', label: 'Scheduled' },
      in_progress: { variant: 'default', label: 'In Progress' },
      done: { variant: 'default', label: 'Done' },
      invoiced: { variant: 'default', label: 'Invoiced' },
    };
    const c = config[status] || { variant: 'secondary' as const, label: status };
    return <Badge variant={c.variant}>{c.label}</Badge>;
  };

  const isLoading = jobsLoading || quotesLoading || invoicesLoading;

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="p-4 sm:p-6 border-b bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold" data-testid="text-today-title">
              Today
            </h1>
            <p className="text-muted-foreground">
              {format(today, 'EEEE, d MMMM yyyy')}
            </p>
          </div>
          <Button 
            onClick={() => setLocation('/jobs/new')}
            style={{ backgroundColor: 'hsl(var(--trade))' }}
            data-testid="button-new-job"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Job
          </Button>
        </div>
      </div>

      <div className="flex-1 p-4 sm:p-6 space-y-6">
        {nextActions.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Zap className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
              What to do next
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {nextActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Card 
                    key={action.id}
                    className="hover-elevate cursor-pointer"
                    onClick={() => setLocation(action.actionUrl)}
                    data-testid={`card-action-${action.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div 
                          className={`w-10 h-10 rounded-lg flex items-center justify-center ${getPriorityColor(action.priority)}`}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{action.title}</p>
                          <p className="text-sm text-muted-foreground">{action.description}</p>
                        </div>
                        <Button size="sm" variant="ghost">
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {!isStaff && (
          <section>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card 
                className="hover-elevate cursor-pointer" 
                onClick={() => setLocation('/jobs')}
                data-testid="card-stat-jobs-today"
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs sm:text-sm text-muted-foreground">Jobs Today</p>
                      <p className="text-2xl font-bold">{todaysJobs.length}</p>
                    </div>
                    <Briefcase className="h-8 w-8 text-muted-foreground/30" />
                  </div>
                </CardContent>
              </Card>

              <Card 
                className="hover-elevate cursor-pointer" 
                onClick={() => setLocation('/money')}
                data-testid="card-stat-outstanding"
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs sm:text-sm text-muted-foreground">Outstanding</p>
                      <p className="text-2xl font-bold">${totalOutstanding.toLocaleString()}</p>
                    </div>
                    <DollarSign className="h-8 w-8 text-muted-foreground/30" />
                  </div>
                </CardContent>
              </Card>

              <Card 
                className="hover-elevate cursor-pointer" 
                onClick={() => setLocation('/money')}
                data-testid="card-stat-quotes"
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs sm:text-sm text-muted-foreground">Pending Quotes</p>
                      <p className="text-2xl font-bold">{pendingQuotes.length}</p>
                    </div>
                    <FileText className="h-8 w-8 text-muted-foreground/30" />
                  </div>
                </CardContent>
              </Card>

              <Card 
                className={`hover-elevate cursor-pointer ${overdueInvoices.length > 0 ? 'border-destructive/50' : ''}`}
                onClick={() => setLocation('/money')}
                data-testid="card-stat-overdue"
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs sm:text-sm text-muted-foreground">Overdue</p>
                      <p className={`text-2xl font-bold ${overdueInvoices.length > 0 ? 'text-destructive' : ''}`}>
                        {overdueInvoices.length}
                      </p>
                    </div>
                    <AlertCircle className={`h-8 w-8 ${overdueInvoices.length > 0 ? 'text-destructive/30' : 'text-muted-foreground/30'}`} />
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>
        )}

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Calendar className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
              Today's Schedule
            </h2>
            <Button variant="ghost" size="sm" onClick={() => setLocation('/calendar')}>
              View Calendar
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <Skeleton className="w-16 h-16" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3 w-32" />
                        <Skeleton className="h-3 w-40" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : todaysJobs.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="font-semibold mb-2">No jobs scheduled for today</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  {upcomingJobs.length > 0 
                    ? `You have ${upcomingJobs.length} upcoming job${upcomingJobs.length > 1 ? 's' : ''} scheduled`
                    : 'Schedule a job to get started'}
                </p>
                <Button onClick={() => setLocation('/jobs/new')} data-testid="button-schedule-job">
                  <Plus className="h-4 w-4 mr-2" />
                  Schedule Job
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {todaysJobs.map((job, index) => (
                <Card 
                  key={job.id}
                  className="hover-elevate cursor-pointer"
                  onClick={() => setLocation(`/jobs/${job.id}`)}
                  data-testid={`card-job-${job.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <div 
                        className="w-16 h-16 rounded-lg flex flex-col items-center justify-center text-white"
                        style={{ backgroundColor: 'hsl(var(--trade))' }}
                      >
                        <span className="text-xs opacity-80">
                          {job.scheduledTime || 'TBD'}
                        </span>
                        <span className="text-lg font-bold">
                          {index + 1}
                        </span>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-semibold truncate">{job.title}</h3>
                            <p className="text-sm text-muted-foreground">{job.client?.name || 'No client'}</p>
                          </div>
                          {getStatusBadge(job.status)}
                        </div>
                        
                        {job.address && (
                          <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            <span className="truncate">{job.address}</span>
                          </div>
                        )}
                        
                        {job.client?.phone && (
                          <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            <span>{job.client.phone}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2">
                        {job.status === 'scheduled' && (
                          <Button 
                            size="sm"
                            style={{ backgroundColor: 'hsl(var(--trade))' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setLocation(`/jobs/${job.id}`);
                            }}
                            data-testid={`button-start-job-${job.id}`}
                          >
                            <Play className="h-4 w-4 mr-1" />
                            Start
                          </Button>
                        )}
                        {job.status === 'in_progress' && (
                          <Badge className="bg-green-100 text-green-700">
                            <Play className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {upcomingJobs.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Coming Up</h2>
              <Button variant="ghost" size="sm" onClick={() => setLocation('/jobs')}>
                View All
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {upcomingJobs.map((job) => (
                <Card 
                  key={job.id}
                  className="hover-elevate cursor-pointer"
                  onClick={() => setLocation(`/jobs/${job.id}`)}
                  data-testid={`card-upcoming-${job.id}`}
                >
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground mb-1">
                      {job.scheduledDate && isTomorrow(parseISO(job.scheduledDate)) 
                        ? 'Tomorrow' 
                        : job.scheduledDate && format(parseISO(job.scheduledDate), 'EEE, d MMM')}
                    </p>
                    <h3 className="font-medium truncate">{job.title}</h3>
                    <p className="text-sm text-muted-foreground truncate">
                      {job.client?.name || 'No client'}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {inProgressJobs.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Play className="h-5 w-5 text-green-600" />
              Jobs In Progress
            </h2>
            <div className="space-y-3">
              {inProgressJobs.map((job) => (
                <Card 
                  key={job.id}
                  className="hover-elevate cursor-pointer border-green-200"
                  onClick={() => setLocation(`/jobs/${job.id}`)}
                  data-testid={`card-inprogress-${job.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">{job.title}</h3>
                        <p className="text-sm text-muted-foreground">{job.client?.name || 'No client'}</p>
                      </div>
                      <Button size="sm" variant="outline" data-testid={`button-continue-${job.id}`}>
                        Continue
                        <ArrowRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
