import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Plus, 
  Briefcase, 
  Clock, 
  MapPin, 
  Play, 
  CheckCircle, 
  FileText, 
  Receipt, 
  ChevronRight,
  Calendar,
  AlertCircle,
  Clipboard,
  User,
  ArrowRight
} from "lucide-react";
import { PageShell, PageHeader, SectionTitle } from "@/components/ui/page-shell";
import { EmptyState } from "@/components/ui/compact-card";
import { FilterChips, SearchBar } from "@/components/ui/filter-chips";
import { useJobs, useUpdateJob, useJobNextActions } from "@/hooks/use-jobs";
import { useGenerateQuoteFromJob } from "@/hooks/use-quotes";
import { useToast } from "@/hooks/use-toast";
import { useAppMode } from "@/hooks/use-app-mode";
import { useLocation } from "wouter";
import { format, isToday, isTomorrow, isThisWeek, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { queryClient } from "@/lib/queryClient";
import PasteJobModal from "@/components/PasteJobModal";
import { ConfirmationDialog } from "@/components/ConfirmationDialog";

type JobStatus = 'pending' | 'scheduled' | 'in_progress' | 'done' | 'invoiced';

interface Job {
  id: string;
  title: string;
  description?: string;
  clientId?: string;
  clientName?: string;
  address?: string;
  scheduledAt?: string;
  status: JobStatus;
}

interface WorkPageProps {
  onViewJob?: (id: string) => void;
  onCreateJob?: () => void;
  onShowQuoteModal?: (quoteId: string) => void;
  onShowInvoiceModal?: (invoiceId: string) => void;
}

export default function WorkPage({ 
  onViewJob, 
  onCreateJob,
  onShowQuoteModal,
  onShowInvoiceModal
}: WorkPageProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("active");
  const [pasteJobOpen, setPasteJobOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [pendingStatus, setPendingStatus] = useState<JobStatus | null>(null);
  const [, navigate] = useLocation();

  const { data: jobs = [] } = useJobs() as { data: Job[] };
  const { data: nextActions = {} } = useJobNextActions();
  const { toast } = useToast();
  const updateJobMutation = useUpdateJob();
  const generateQuoteMutation = useGenerateQuoteFromJob();
  const { actionPermissions } = useAppMode();
  const canCreateJobs = actionPermissions.canCreateJobs;

  const statusLabels: Record<JobStatus, string> = {
    pending: 'Pending',
    scheduled: 'Scheduled',
    in_progress: 'In Progress',
    done: 'Completed',
    invoiced: 'Invoiced',
  };

  // Group jobs by workflow stage
  const groupedJobs = useMemo(() => {
    const today: Job[] = [];
    const upcoming: Job[] = [];
    const inProgress: Job[] = [];
    const needsAction: Job[] = []; // Done but not invoiced
    const completed: Job[] = [];

    jobs.forEach(job => {
      // Filter by search
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesSearch = 
          (job.title || '').toLowerCase().includes(search) ||
          (job.clientName || '').toLowerCase().includes(search) ||
          (job.address || '').toLowerCase().includes(search);
        if (!matchesSearch) return;
      }

      // Categorize
      if (job.status === 'invoiced') {
        completed.push(job);
      } else if (job.status === 'done') {
        needsAction.push(job); // Needs invoice
      } else if (job.status === 'in_progress') {
        inProgress.push(job);
      } else if (job.scheduledAt) {
        const scheduledDate = parseISO(job.scheduledAt);
        if (isToday(scheduledDate)) {
          today.push(job);
        } else {
          upcoming.push(job);
        }
      } else {
        upcoming.push(job); // Pending without schedule
      }
    });

    // Sort by scheduled date
    const sortBySchedule = (a: Job, b: Job) => {
      if (!a.scheduledAt && !b.scheduledAt) return 0;
      if (!a.scheduledAt) return 1;
      if (!b.scheduledAt) return -1;
      return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
    };

    today.sort(sortBySchedule);
    upcoming.sort(sortBySchedule);

    return { today, upcoming, inProgress, needsAction, completed };
  }, [jobs, searchTerm]);

  // Counts for filter chips
  const counts = useMemo(() => ({
    active: groupedJobs.today.length + groupedJobs.upcoming.length + groupedJobs.inProgress.length + groupedJobs.needsAction.length,
    today: groupedJobs.today.length,
    inProgress: groupedJobs.inProgress.length,
    needsInvoice: groupedJobs.needsAction.length,
    completed: groupedJobs.completed.length,
  }), [groupedJobs]);

  const filterChips = [
    { id: "active", label: "Active", count: counts.active },
    { id: "today", label: "Today", count: counts.today },
    { id: "inProgress", label: "In Progress", count: counts.inProgress },
    { id: "needsInvoice", label: "Needs Invoice", count: counts.needsInvoice },
    { id: "completed", label: "Completed", count: counts.completed },
  ];

  // Handle status change
  const handleStatusChange = (job: Job, newStatus: JobStatus) => {
    setSelectedJob(job);
    setPendingStatus(newStatus);
    setStatusDialogOpen(true);
  };

  const handleConfirmStatusChange = async () => {
    if (!selectedJob || !pendingStatus) return;
    
    try {
      await updateJobMutation.mutateAsync({ id: selectedJob.id, data: { status: pendingStatus } });
      await queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      toast({
        title: `Job ${statusLabels[pendingStatus]}`,
        description: `${selectedJob.title || 'Job'} → ${statusLabels[pendingStatus]}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update job status",
        variant: "destructive",
      });
    }
  };

  // Handle quick actions
  const handleCreateQuote = async (jobId: string) => {
    try {
      const quote = await generateQuoteMutation.mutateAsync(jobId);
      toast({
        title: "Quote created",
        description: `Quote ${quote.number} ready to send`,
      });
      if (onShowQuoteModal && quote.id) {
        onShowQuoteModal(quote.id);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create quote",
        variant: "destructive",
      });
    }
  };

  const handleCreateInvoice = (jobId: string) => {
    navigate(`/invoices/new?jobId=${jobId}`);
  };

  // Get next action for a job
  const getNextAction = (job: Job) => {
    if (job.status === 'pending') return { label: 'Schedule', action: () => onViewJob?.(job.id), icon: Calendar };
    if (job.status === 'scheduled') return { label: 'Start', action: () => handleStatusChange(job, 'in_progress'), icon: Play };
    if (job.status === 'in_progress') return { label: 'Complete', action: () => handleStatusChange(job, 'done'), icon: CheckCircle };
    if (job.status === 'done') return { label: 'Invoice', action: () => handleCreateInvoice(job.id), icon: Receipt };
    return null;
  };

  // Job card component
  const JobCard = ({ job, showNextAction = true }: { job: Job; showNextAction?: boolean }) => {
    const nextAction = getNextAction(job);
    const scheduledLabel = job.scheduledAt 
      ? isToday(parseISO(job.scheduledAt)) 
        ? format(parseISO(job.scheduledAt), 'h:mm a')
        : isTomorrow(parseISO(job.scheduledAt))
        ? `Tomorrow ${format(parseISO(job.scheduledAt), 'h:mm a')}`
        : format(parseISO(job.scheduledAt), 'EEE d MMM')
      : null;

    return (
      <Card 
        className="hover-elevate cursor-pointer transition-all"
        onClick={() => onViewJob?.(job.id)}
        data-testid={`job-card-${job.id}`}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              {/* Status indicator + Title */}
              <div className="flex items-center gap-2 mb-1">
                <div 
                  className={cn(
                    "w-2 h-2 rounded-full flex-shrink-0",
                    job.status === 'in_progress' && "bg-amber-500 animate-pulse",
                    job.status === 'done' && "bg-green-500",
                    job.status === 'invoiced' && "bg-purple-500",
                    job.status === 'scheduled' && "bg-blue-500",
                    job.status === 'pending' && "bg-gray-400"
                  )}
                />
                <h3 className="font-semibold truncate">{job.title || 'Untitled Job'}</h3>
              </div>

              {/* Client */}
              {job.clientName && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-2">
                  <User className="h-3.5 w-3.5" />
                  <span className="truncate">{job.clientName}</span>
                </div>
              )}

              {/* Address & Time */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {job.address && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    <span className="truncate max-w-[150px]">{job.address}</span>
                  </div>
                )}
                {scheduledLabel && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>{scheduledLabel}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Action Button */}
            {showNextAction && nextAction && (
              <Button
                size="sm"
                variant={job.status === 'done' ? 'default' : 'outline'}
                className={cn(
                  "flex-shrink-0 rounded-xl",
                  job.status === 'done' && "text-white"
                )}
                style={job.status === 'done' ? { backgroundColor: 'hsl(var(--trade))' } : {}}
                onClick={(e) => {
                  e.stopPropagation();
                  nextAction.action();
                }}
                data-testid={`btn-${nextAction.label.toLowerCase()}-${job.id}`}
              >
                <nextAction.icon className="h-4 w-4 mr-1" />
                {nextAction.label}
              </Button>
            )}

            {!showNextAction && (
              <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  // Section component
  const JobSection = ({ 
    title, 
    jobs, 
    icon, 
    color,
    emptyMessage,
    showNextAction = true,
    sectionId
  }: { 
    title: string; 
    jobs: Job[]; 
    icon: React.ReactNode;
    color: string;
    emptyMessage?: string;
    showNextAction?: boolean;
    sectionId: string;
  }) => {
    if (jobs.length === 0 && !emptyMessage) return null;

    return (
      <section className="space-y-3" data-testid={`section-${sectionId}`}>
        <div className="flex items-center gap-2" data-testid={`section-header-${sectionId}`}>
          <div 
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${color}15` }}
          >
            {icon}
          </div>
          <h2 className="font-semibold">{title}</h2>
          <Badge variant="secondary" className="ml-auto">
            {jobs.length}
          </Badge>
        </div>
        {jobs.length > 0 ? (
          <div className="space-y-2">
            {jobs.map(job => (
              <JobCard key={job.id} job={job} showNextAction={showNextAction} />
            ))}
          </div>
        ) : emptyMessage ? (
          <Card className="border-dashed" data-testid={`empty-state-${sectionId}`}>
            <CardContent className="py-8 text-center text-muted-foreground">
              <p className="text-sm">{emptyMessage}</p>
            </CardContent>
          </Card>
        ) : null}
      </section>
    );
  };

  // Render based on active filter
  const renderContent = () => {
    if (activeFilter === 'today') {
      return (
        <JobSection
          sectionId="today"
          title="Today's Work"
          jobs={groupedJobs.today}
          icon={<Calendar className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />}
          color="hsl(var(--trade))"
          emptyMessage="No jobs scheduled for today"
        />
      );
    }

    if (activeFilter === 'inProgress') {
      return (
        <JobSection
          sectionId="in-progress"
          title="In Progress"
          jobs={groupedJobs.inProgress}
          icon={<Play className="h-4 w-4 text-amber-500" />}
          color="hsl(35 90% 55%)"
          emptyMessage="No jobs currently in progress"
        />
      );
    }

    if (activeFilter === 'needsInvoice') {
      return (
        <JobSection
          sectionId="needs-invoice"
          title="Needs Invoice"
          jobs={groupedJobs.needsAction}
          icon={<AlertCircle className="h-4 w-4 text-orange-500" />}
          color="hsl(25 90% 55%)"
          emptyMessage="All completed jobs have been invoiced"
        />
      );
    }

    if (activeFilter === 'completed') {
      return (
        <JobSection
          sectionId="completed"
          title="Completed & Invoiced"
          jobs={groupedJobs.completed}
          icon={<CheckCircle className="h-4 w-4 text-green-500" />}
          color="hsl(145 65% 45%)"
          showNextAction={false}
          emptyMessage="No completed jobs yet"
        />
      );
    }

    // Active (default) - show all active sections
    return (
      <div className="space-y-6" data-testid="section-active">
        {/* Needs Action Alert */}
        {groupedJobs.needsAction.length > 0 && (
          <JobSection
            sectionId="needs-invoice"
            title="Needs Invoice"
            jobs={groupedJobs.needsAction}
            icon={<AlertCircle className="h-4 w-4 text-orange-500" />}
            color="hsl(25 90% 55%)"
          />
        )}

        {/* Today */}
        {groupedJobs.today.length > 0 && (
          <JobSection
            sectionId="today"
            title="Today"
            jobs={groupedJobs.today}
            icon={<Calendar className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />}
            color="hsl(var(--trade))"
          />
        )}

        {/* In Progress */}
        {groupedJobs.inProgress.length > 0 && (
          <JobSection
            sectionId="in-progress"
            title="In Progress"
            jobs={groupedJobs.inProgress}
            icon={<Play className="h-4 w-4 text-amber-500" />}
            color="hsl(35 90% 55%)"
          />
        )}

        {/* Upcoming */}
        {groupedJobs.upcoming.length > 0 && (
          <JobSection
            sectionId="upcoming"
            title="Upcoming"
            jobs={groupedJobs.upcoming}
            icon={<Clock className="h-4 w-4 text-blue-500" />}
            color="hsl(210 80% 52%)"
          />
        )}

        {/* Empty state */}
        {counts.active === 0 && (
          <EmptyState
            icon={Briefcase}
            title="No active jobs"
            description="Create a job to get started with your work"
            action={
              canCreateJobs && onCreateJob && (
                <Button
                  onClick={onCreateJob}
                  className="rounded-xl text-white"
                  style={{ backgroundColor: 'hsl(var(--trade))' }}
                  data-testid="btn-create-first-job"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Job
                </Button>
              )
            }
          />
        )}
      </div>
    );
  };

  return (
    <PageShell data-testid="work-page">
      <PageHeader
        title="Work"
        subtitle={`${counts.active} active jobs`}
        action={
          canCreateJobs && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setPasteJobOpen(true)}
                className="rounded-xl press-scale border-primary/30 text-primary hover:bg-primary/5"
                data-testid="btn-paste-job"
              >
                <Clipboard className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Paste</span>
              </Button>
              <Button
                onClick={onCreateJob}
                className="rounded-xl text-white press-scale"
                style={{ backgroundColor: 'hsl(var(--trade))' }}
                data-testid="btn-create-job"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Job
              </Button>
            </div>
          )
        }
      />

      {/* Search */}
      <SearchBar
        value={searchTerm}
        onChange={setSearchTerm}
        placeholder="Search jobs, clients, addresses..."
      />

      {/* Filter Chips */}
      <FilterChips
        chips={filterChips}
        activeId={activeFilter}
        onSelect={setActiveFilter}
      />

      {/* Job Sections */}
      <div className="space-y-6 mt-4">
        {renderContent()}
      </div>

      {/* Paste Job Modal */}
      <PasteJobModal
        open={pasteJobOpen}
        onOpenChange={setPasteJobOpen}
        onJobCreated={(jobId) => {
          setPasteJobOpen(false);
          onViewJob?.(jobId);
        }}
      />

      {/* Status Change Confirmation */}
      <ConfirmationDialog
        open={statusDialogOpen}
        onOpenChange={setStatusDialogOpen}
        title={`${pendingStatus === 'in_progress' ? 'Start' : pendingStatus === 'done' ? 'Complete' : 'Update'} Job?`}
        description={`${selectedJob?.title || 'This job'} will be marked as ${statusLabels[pendingStatus || 'pending']}.`}
        confirmText={pendingStatus === 'in_progress' ? 'Start Job' : pendingStatus === 'done' ? 'Complete Job' : 'Update'}
        onConfirm={handleConfirmStatusChange}
      />
    </PageShell>
  );
}
