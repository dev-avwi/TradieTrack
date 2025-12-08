import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Briefcase, 
  Calendar,
  Plus,
  FileText,
  Receipt,
  Camera,
  DollarSign,
  Clock,
  ChevronRight,
  TrendingUp,
  History,
  MessageSquare,
  Star,
  Repeat,
  Pause,
  Play,
  SkipForward,
  StopCircle
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import StatusBadge from "./StatusBadge";
import KPIBox from "./KPIBox";
import { useLocation } from "wouter";
import { useState } from "react";

interface ClientDetailViewProps {
  clientId: string;
  onBack?: () => void;
  onCreateJob?: (clientId: string, clientAddress?: string) => void;
  onCreateQuote?: (clientId: string) => void;
  onViewJob?: (jobId: string) => void;
  onViewQuote?: (quoteId: string) => void;
  onViewInvoice?: (invoiceId: string) => void;
}

export default function ClientDetailView({ 
  clientId, 
  onBack, 
  onCreateJob,
  onCreateQuote,
  onViewJob,
  onViewQuote,
  onViewInvoice
}: ClientDetailViewProps) {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("overview");
  const { toast } = useToast();

  const { data: client, isLoading: clientLoading } = useQuery({
    queryKey: ['/api/clients', clientId],
    queryFn: async () => {
      const response = await fetch(`/api/clients/${clientId}`);
      if (!response.ok) throw new Error('Failed to fetch client');
      return response.json();
    }
  });

  const { data: jobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ['/api/clients', clientId, 'jobs'],
    queryFn: async () => {
      const response = await fetch(`/api/clients/${clientId}/jobs`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!clientId
  });

  const { data: quotes = [] } = useQuery({
    queryKey: ['/api/clients', clientId, 'quotes'],
    queryFn: async () => {
      const response = await fetch('/api/quotes', { credentials: 'include' });
      if (!response.ok) return [];
      const allQuotes = await response.json();
      return allQuotes.filter((q: any) => q.clientId === clientId);
    },
    enabled: !!clientId
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['/api/clients', clientId, 'invoices'],
    queryFn: async () => {
      const response = await fetch('/api/invoices', { credentials: 'include' });
      if (!response.ok) return [];
      const allInvoices = await response.json();
      return allInvoices.filter((i: any) => i.clientId === clientId);
    },
    enabled: !!clientId
  });

  const { data: allPhotos = [], isLoading: photosLoading } = useQuery({
    queryKey: ['/api/clients', clientId, 'photos'],
    queryFn: async () => {
      const allJobPhotos: any[] = [];
      for (const job of jobs) {
        try {
          const response = await fetch(`/api/jobs/${job.id}/photos`);
          if (response.ok) {
            const photos = await response.json();
            allJobPhotos.push(...photos.map((p: any) => ({ ...p, jobId: job.id, jobTitle: job.title })));
          }
        } catch (e) {
          console.error('Failed to fetch job photos:', e);
        }
      }
      return allJobPhotos;
    },
    enabled: jobs.length > 0
  });

  // Fetch recurring jobs for this client
  const { data: recurringJobs = [] } = useQuery({
    queryKey: ['/api/clients', clientId, 'recurring-jobs'],
    queryFn: async () => {
      const response = await fetch(`/api/clients/${clientId}/recurring-jobs`, { credentials: 'include' });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!clientId
  });

  // Mutations for recurring job actions
  const updateRecurringStatusMutation = useMutation({
    mutationFn: async ({ jobId, action }: { jobId: string; action: 'pause' | 'resume' | 'end' }) => {
      return apiRequest(`/api/recurring-jobs/${jobId}/${action}`, {
        method: 'POST'
      });
    },
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients', clientId, 'recurring-jobs'] });
      toast({
        title: action === 'pause' ? 'Recurring job paused' : 
               action === 'resume' ? 'Recurring job resumed' : 
               'Recurring job ended',
        description: action === 'end' ? 'No more jobs will be generated from this series.' : undefined
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update recurring job status',
        variant: 'destructive'
      });
    }
  });

  const skipNextRecurrenceMutation = useMutation({
    mutationFn: async (jobId: string) => {
      return apiRequest(`/api/recurring-jobs/${jobId}/skip`, {
        method: 'POST'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients', clientId, 'recurring-jobs'] });
      toast({
        title: 'Next occurrence skipped',
        description: 'The next scheduled job has been skipped.'
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to skip next occurrence',
        variant: 'destructive'
      });
    }
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatRelativeDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(num || 0);
  };

  if (clientLoading) {
    return (
      <PageShell>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading client details...</p>
          </div>
        </div>
      </PageShell>
    );
  }

  if (!client) {
    return (
      <PageShell>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">Client not found</p>
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Clients
            </Button>
          </div>
        </div>
      </PageShell>
    );
  }

  const totalJobValue = jobs.reduce((sum: number, job: any) => {
    const quote = quotes.find((q: any) => q.jobId === job.id);
    return sum + (quote?.total ? parseFloat(quote.total) : 0);
  }, 0);

  const paidInvoices = invoices.filter((i: any) => i.status === 'paid');
  const totalPaid = paidInvoices.reduce((sum: number, i: any) => sum + parseFloat(i.total || '0'), 0);
  const unpaidInvoices = invoices.filter((i: any) => i.status === 'sent' || i.status === 'overdue');
  const totalUnpaid = unpaidInvoices.reduce((sum: number, i: any) => sum + parseFloat(i.total || '0'), 0);

  const completedJobs = jobs.filter((j: any) => j.status === 'done' || j.status === 'invoiced');
  const activeJobs = jobs.filter((j: any) => j.status === 'in_progress' || j.status === 'scheduled');

  const sortedJobs = [...jobs].sort((a: any, b: any) => 
    new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );
  const lastJob = sortedJobs.length > 0 ? sortedJobs[0] : null;

  const createTimelineEvents = () => {
    const events: any[] = [];
    
    jobs.forEach((job: any) => {
      events.push({
        type: 'job',
        id: job.id,
        title: job.title,
        status: job.status,
        date: job.createdAt || job.scheduledAt,
        icon: Briefcase,
        action: () => onViewJob?.(job.id)
      });
    });
    
    quotes.forEach((quote: any) => {
      events.push({
        type: 'quote',
        id: quote.id,
        title: `Quote ${quote.number || '#' + quote.id.slice(0, 6)}`,
        status: quote.status,
        date: quote.createdAt || quote.sentAt,
        amount: quote.total,
        icon: FileText,
        action: () => onViewQuote ? onViewQuote(quote.id) : setLocation(`/quotes/${quote.id}`)
      });
    });
    
    invoices.forEach((invoice: any) => {
      events.push({
        type: 'invoice',
        id: invoice.id,
        title: `Invoice ${invoice.number || '#' + invoice.id.slice(0, 6)}`,
        status: invoice.status,
        date: invoice.createdAt || invoice.sentAt,
        amount: invoice.total,
        icon: Receipt,
        action: () => onViewInvoice ? onViewInvoice(invoice.id) : setLocation(`/invoices/${invoice.id}`)
      });
    });
    
    return events.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  };

  const timelineEvents = createTimelineEvents();

  return (
    <PageShell data-testid="client-detail">
      <PageHeader
        title={client.name}
        subtitle="Client Profile"
        action={
          <Button variant="outline" onClick={onBack} data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPIBox
          icon={Briefcase}
          title="Total Jobs"
          value={jobs.length.toString()}
          onClick={() => setActiveTab("jobs")}
        />
        <KPIBox
          icon={TrendingUp}
          title="Total Revenue"
          value={formatCurrency(totalPaid)}
        />
        <KPIBox
          icon={Clock}
          title="Outstanding"
          value={formatCurrency(totalUnpaid)}
        />
        <KPIBox
          icon={Star}
          title="Active Jobs"
          value={activeJobs.length.toString()}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center gap-4 p-4 border-b">
            <div 
              className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white flex-shrink-0"
              style={{ backgroundColor: 'hsl(var(--trade))' }}
            >
              {client.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold truncate">{client.name}</h2>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {lastJob && (
                  <span>Last job: {formatRelativeDate(lastJob.createdAt || lastJob.scheduledAt)}</span>
                )}
                {jobs.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {completedJobs.length} completed
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x">
            {client.email && (
              <a 
                href={`mailto:${client.email}`}
                className="flex items-center gap-3 p-4 hover-elevate"
                data-testid="link-email"
              >
                <Mail className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm font-medium truncate">{client.email}</p>
                </div>
              </a>
            )}
            
            {client.phone && (
              <a 
                href={`tel:${client.phone}`}
                className="flex items-center gap-3 p-4 hover-elevate"
                data-testid="link-phone"
              >
                <Phone className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <p className="text-sm font-medium">{client.phone}</p>
                </div>
              </a>
            )}
            
            {client.address && (
              <a 
                href={`https://maps.google.com/?q=${encodeURIComponent(client.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 hover-elevate"
                data-testid="link-address"
              >
                <MapPin className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Address</p>
                  <p className="text-sm font-medium truncate">{client.address}</p>
                </div>
              </a>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button 
          onClick={() => onCreateJob?.(clientId, client.address)}
          className="text-white"
          style={{ backgroundColor: 'hsl(var(--trade))' }}
          data-testid="button-create-job"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Job
        </Button>
        <Button 
          variant="outline"
          onClick={() => onCreateQuote?.(clientId)}
          data-testid="button-create-quote"
        >
          <FileText className="h-4 w-4 mr-2" />
          New Quote
        </Button>
        {client.email && (
          <Button 
            variant="outline"
            onClick={() => window.open(`mailto:${client.email}`)}
            data-testid="button-send-email"
          >
            <Mail className="h-4 w-4 mr-2" />
            Email
          </Button>
        )}
        {client.phone && (
          <Button 
            variant="outline"
            onClick={() => window.open(`tel:${client.phone}`)}
            data-testid="button-call"
          >
            <Phone className="h-4 w-4 mr-2" />
            Call
          </Button>
        )}
      </div>

      {/* Recurring Jobs Section */}
      {recurringJobs.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Repeat className="h-4 w-4" />
              Recurring Jobs
              <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0">
                {recurringJobs.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recurringJobs.map((rj: any) => (
              <div 
                key={rj.id}
                className="border rounded-lg p-4 space-y-3"
                data-testid={`recurring-job-${rj.id}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {rj.recurrenceLabel || rj.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {rj.recurrencePattern === 'fortnightly' ? 'Every fortnight' :
                       `Every ${rj.recurrenceInterval > 1 ? rj.recurrenceInterval + ' ' : ''}${rj.recurrencePattern}${rj.recurrenceInterval > 1 ? 's' : ''}`}
                    </p>
                  </div>
                  <Badge 
                    variant={rj.recurrenceStatus === 'active' ? 'default' : 
                             rj.recurrenceStatus === 'paused' ? 'secondary' : 'outline'}
                    className={rj.recurrenceStatus === 'active' ? 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20' :
                               rj.recurrenceStatus === 'paused' ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20' :
                               'text-muted-foreground'}
                  >
                    {rj.recurrenceStatus === 'active' ? 'Active' :
                     rj.recurrenceStatus === 'paused' ? 'Paused' : 'Ended'}
                  </Badge>
                </div>
                
                {rj.nextRecurrenceDate && rj.recurrenceStatus === 'active' && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Next: {formatDate(rj.nextRecurrenceDate)}</span>
                  </div>
                )}
                
                {rj.recurrenceStatus !== 'ended' && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {rj.recurrenceStatus === 'active' ? (
                      <>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => updateRecurringStatusMutation.mutate({ jobId: rj.id, action: 'pause' })}
                          disabled={updateRecurringStatusMutation.isPending}
                          data-testid={`button-pause-recurring-${rj.id}`}
                        >
                          <Pause className="h-3.5 w-3.5 mr-1.5" />
                          Pause
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => skipNextRecurrenceMutation.mutate(rj.id)}
                          disabled={skipNextRecurrenceMutation.isPending}
                          data-testid={`button-skip-recurring-${rj.id}`}
                        >
                          <SkipForward className="h-3.5 w-3.5 mr-1.5" />
                          Skip Next
                        </Button>
                      </>
                    ) : (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => updateRecurringStatusMutation.mutate({ jobId: rj.id, action: 'resume' })}
                        disabled={updateRecurringStatusMutation.isPending}
                        data-testid={`button-resume-recurring-${rj.id}`}
                      >
                        <Play className="h-3.5 w-3.5 mr-1.5" />
                        Resume
                      </Button>
                    )}
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      onClick={() => updateRecurringStatusMutation.mutate({ jobId: rj.id, action: 'end' })}
                      disabled={updateRecurringStatusMutation.isPending}
                      data-testid={`button-end-recurring-${rj.id}`}
                    >
                      <StopCircle className="h-3.5 w-3.5 mr-1.5" />
                      End
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full grid grid-cols-5 h-auto">
          <TabsTrigger value="overview" className="text-xs py-2.5" data-testid="tab-overview">
            <History className="h-3.5 w-3.5 mr-1.5" />
            <span className="hidden sm:inline">Activity</span>
          </TabsTrigger>
          <TabsTrigger value="jobs" className="text-xs py-2.5" data-testid="tab-jobs">
            <Briefcase className="h-3.5 w-3.5 mr-1.5" />
            <span className="hidden sm:inline">Jobs</span>
            <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">{jobs.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="quotes" className="text-xs py-2.5" data-testid="tab-quotes">
            <FileText className="h-3.5 w-3.5 mr-1.5" />
            <span className="hidden sm:inline">Quotes</span>
            <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">{quotes.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="invoices" className="text-xs py-2.5" data-testid="tab-invoices">
            <Receipt className="h-3.5 w-3.5 mr-1.5" />
            <span className="hidden sm:inline">Invoices</span>
            <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">{invoices.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="photos" className="text-xs py-2.5" data-testid="tab-photos">
            <Camera className="h-3.5 w-3.5 mr-1.5" />
            <span className="hidden sm:inline">Photos</span>
            {allPhotos.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">{allPhotos.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <History className="h-4 w-4" />
                Activity Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              {timelineEvents.length === 0 ? (
                <div className="text-center py-8">
                  <History className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground mb-3">No activity yet with this client</p>
                  <Button 
                    size="sm"
                    onClick={() => onCreateJob?.(clientId)}
                    className="text-white"
                    style={{ backgroundColor: 'hsl(var(--trade))' }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Job
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
                  <div className="space-y-4">
                    {timelineEvents.slice(0, 10).map((event, index) => (
                      <div 
                        key={`${event.type}-${event.id}`}
                        className="relative flex gap-4 cursor-pointer hover-elevate rounded-lg p-2 -ml-2"
                        onClick={event.action}
                        data-testid={`timeline-${event.type}-${event.id}`}
                      >
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center z-10 flex-shrink-0"
                          style={{ 
                            backgroundColor: event.type === 'job' 
                              ? 'hsl(var(--trade) / 0.1)' 
                              : event.type === 'quote'
                              ? 'hsl(var(--primary) / 0.1)'
                              : 'hsl(var(--success) / 0.1)'
                          }}
                        >
                          <event.icon 
                            className="h-4 w-4" 
                            style={{ 
                              color: event.type === 'job' 
                                ? 'hsl(var(--trade))' 
                                : event.type === 'quote'
                                ? 'hsl(var(--primary))'
                                : 'hsl(var(--success))'
                            }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm truncate">{event.title}</p>
                            <StatusBadge status={event.status} />
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                            <span>
                              {event.date && !isNaN(new Date(event.date).getTime()) 
                                ? formatRelativeDate(event.date) 
                                : 'No date'}
                            </span>
                            {event.amount && (
                              <span className="font-medium">{formatCurrency(event.amount)}</span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {client.notes && (
            <Card className="mt-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{client.notes}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="jobs" className="mt-4 space-y-3">
          {jobsLoading ? (
            <Card>
              <CardContent className="py-8">
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              </CardContent>
            </Card>
          ) : jobs.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <div className="text-center">
                  <Briefcase className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground mb-3">No jobs yet for this client</p>
                  <Button 
                    size="sm"
                    onClick={() => onCreateJob?.(clientId)}
                    className="text-white"
                    style={{ backgroundColor: 'hsl(var(--trade))' }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Job
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            jobs.map((job: any) => (
              <Card
                key={job.id}
                className="hover-elevate active-elevate-2 cursor-pointer"
                style={{ borderRadius: '14px' }}
                onClick={() => onViewJob?.(job.id)}
                data-testid={`job-card-${job.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}
                        >
                          <Briefcase className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-sm truncate">{job.title}</h3>
                            <StatusBadge status={job.status} />
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {job.scheduledAt ? formatDate(job.scheduledAt) : 'Not scheduled'}
                          </div>
                        </div>
                      </div>
                      {job.address && (
                        <div className="pl-12 flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">{job.address}</span>
                        </div>
                      )}
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="quotes" className="mt-4 space-y-3">
          {quotes.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <div className="text-center">
                  <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground mb-3">No quotes yet for this client</p>
                  <Button 
                    size="sm"
                    onClick={() => onCreateQuote?.(clientId)}
                    variant="outline"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Quote
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            quotes.map((quote: any) => (
              <Card
                key={quote.id}
                className="hover-elevate active-elevate-2 cursor-pointer"
                style={{ borderRadius: '14px' }}
                onClick={() => onViewQuote ? onViewQuote(quote.id) : setLocation(`/quotes/${quote.id}`)}
                data-testid={`quote-card-${quote.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: 'hsl(var(--primary) / 0.1)' }}
                        >
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-sm">{quote.number || `Q-${quote.id.slice(0, 6)}`}</h3>
                            <StatusBadge status={quote.status} />
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{quote.title}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="text-right">
                        <p className="font-bold text-sm" style={{ color: 'hsl(var(--trade))' }}>
                          {formatCurrency(quote.total)}
                        </p>
                        {quote.sentAt && (
                          <p className="text-[10px] text-muted-foreground">
                            Sent {formatRelativeDate(quote.sentAt)}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="invoices" className="mt-4 space-y-3">
          {invoices.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <div className="text-center">
                  <Receipt className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No invoices yet for this client</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Create a quote first, then convert to invoice when accepted
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {unpaidInvoices.length > 0 && (
                <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-amber-600" />
                    <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      {formatCurrency(totalUnpaid)} outstanding
                    </span>
                    <span className="text-xs text-amber-600">
                      ({unpaidInvoices.length} invoice{unpaidInvoices.length !== 1 ? 's' : ''})
                    </span>
                  </div>
                </div>
              )}
              
              {invoices.map((invoice: any) => (
                <Card
                  key={invoice.id}
                  className="hover-elevate active-elevate-2 cursor-pointer"
                  style={{ borderRadius: '14px' }}
                  onClick={() => onViewInvoice ? onViewInvoice(invoice.id) : setLocation(`/invoices/${invoice.id}`)}
                  data-testid={`invoice-card-${invoice.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ 
                              backgroundColor: invoice.status === 'paid' 
                                ? 'hsl(var(--success) / 0.1)' 
                                : 'hsl(var(--trade) / 0.1)' 
                            }}
                          >
                            <Receipt 
                              className="h-5 w-5" 
                              style={{ 
                                color: invoice.status === 'paid' 
                                  ? 'hsl(var(--success))' 
                                  : 'hsl(var(--trade))' 
                              }}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-sm">{invoice.number || `INV-${invoice.id.slice(0, 6)}`}</h3>
                              <StatusBadge status={invoice.status} />
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{invoice.title}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="text-right">
                          <p className="font-bold text-sm" style={{ color: 'hsl(var(--trade))' }}>
                            {formatCurrency(invoice.total)}
                          </p>
                          {invoice.paidAt ? (
                            <p className="text-[10px] text-green-600">
                              Paid {formatRelativeDate(invoice.paidAt)}
                            </p>
                          ) : invoice.dueDate && (
                            <p className={`text-[10px] ${invoice.status === 'overdue' ? 'text-destructive' : 'text-muted-foreground'}`}>
                              Due {formatDate(invoice.dueDate)}
                            </p>
                          )}
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </TabsContent>

        <TabsContent value="photos" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Job Photos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {photosLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              ) : allPhotos.length === 0 ? (
                <div className="text-center py-8">
                  <Camera className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No photos yet for this client's jobs</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Photos from jobs will appear here automatically
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {allPhotos.map((photo: any) => (
                    <div 
                      key={photo.id}
                      className="relative group aspect-square rounded-lg overflow-hidden border hover-elevate cursor-pointer"
                      onClick={() => photo.signedUrl && window.open(photo.signedUrl, '_blank')}
                    >
                      {photo.signedUrl ? (
                        <img 
                          src={photo.signedUrl} 
                          alt={photo.caption || photo.fileName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center">
                          <Camera className="h-8 w-8 text-muted-foreground/30" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                        <div className="text-white text-xs">
                          <p className="font-medium truncate">{photo.jobTitle || 'Job'}</p>
                          {photo.caption && <p className="truncate opacity-75">{photo.caption}</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
