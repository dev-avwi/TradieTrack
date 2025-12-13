import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { 
  Plus, 
  Briefcase, 
  Clock, 
  Play, 
  CheckCircle, 
  Receipt, 
  Calendar,
  AlertCircle,
  Clipboard,
  User
} from "lucide-react";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { SearchBar } from "@/components/ui/filter-chips";
import { useJobs, useUpdateJob } from "@/hooks/use-jobs";
import { useToast } from "@/hooks/use-toast";
import { useAppMode } from "@/hooks/use-app-mode";
import { useLocation } from "wouter";
import { format, isToday, isTomorrow, parseISO } from "date-fns";
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
}: WorkPageProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [pasteJobOpen, setPasteJobOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [pendingStatus, setPendingStatus] = useState<JobStatus | null>(null);
  const [, navigate] = useLocation();

  const { data: jobs = [] } = useJobs() as { data: Job[] };
  const { toast } = useToast();
  const updateJobMutation = useUpdateJob();
  const { actionPermissions } = useAppMode();
  const canCreateJobs = actionPermissions.canCreateJobs;

  const statusLabels: Record<JobStatus, string> = {
    pending: 'Pending',
    scheduled: 'Scheduled',
    in_progress: 'In Progress',
    done: 'Completed',
    invoiced: 'Invoiced',
  };

  // Group jobs into 4 kanban columns
  const kanbanColumns = useMemo(() => {
    const todayJobs: Job[] = [];
    const inProgress: Job[] = [];
    const needsInvoice: Job[] = [];
    const completed: Job[] = [];
    const nowDate = new Date();

    jobs.forEach(job => {
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesSearch = 
          (job.title || '').toLowerCase().includes(search) ||
          (job.clientName || '').toLowerCase().includes(search) ||
          (job.address || '').toLowerCase().includes(search);
        if (!matchesSearch) return;
      }

      if (job.status === 'invoiced') {
        completed.push(job);
      } else if (job.status === 'done') {
        needsInvoice.push(job);
      } else if (job.status === 'in_progress') {
        inProgress.push(job);
      } else {
        // Today column: all pending/scheduled jobs (today, overdue, future, and unscheduled)
        // This is the "queue" of work that needs to be started
        todayJobs.push(job);
      }
    });

    const sortBySchedule = (a: Job, b: Job) => {
      if (!a.scheduledAt && !b.scheduledAt) return 0;
      if (!a.scheduledAt) return 1;
      if (!b.scheduledAt) return -1;
      return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
    };

    todayJobs.sort(sortBySchedule);

    return { today: todayJobs, inProgress, needsInvoice, completed };
  }, [jobs, searchTerm]);

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

  const handleCreateInvoice = (jobId: string) => {
    navigate(`/invoices/new?jobId=${jobId}`);
  };

  const getNextAction = (job: Job) => {
    if (job.status === 'pending') return { label: 'Start', action: () => handleStatusChange(job, 'in_progress'), icon: Play };
    if (job.status === 'scheduled') return { label: 'Start', action: () => handleStatusChange(job, 'in_progress'), icon: Play };
    if (job.status === 'in_progress') return { label: 'Done', action: () => handleStatusChange(job, 'done'), icon: CheckCircle };
    if (job.status === 'done') return { label: 'Invoice', action: () => handleCreateInvoice(job.id), icon: Receipt };
    return null;
  };

  // Compact kanban card
  const KanbanCard = ({ job }: { job: Job }) => {
    const nextAction = getNextAction(job);
    const scheduledLabel = job.scheduledAt 
      ? isToday(parseISO(job.scheduledAt)) 
        ? format(parseISO(job.scheduledAt), 'h:mm a')
        : isTomorrow(parseISO(job.scheduledAt))
        ? 'Tomorrow'
        : format(parseISO(job.scheduledAt), 'EEE d')
      : null;

    return (
      <Card 
        className="hover-elevate cursor-pointer"
        onClick={() => onViewJob?.(job.id)}
        data-testid={`job-card-${job.id}`}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm truncate leading-tight">
                {job.title || 'Untitled Job'}
              </h4>
              {job.clientName && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                  <User className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{job.clientName}</span>
                </div>
              )}
              {scheduledLabel && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                  <Clock className="h-3 w-3 flex-shrink-0" />
                  <span>{scheduledLabel}</span>
                </div>
              )}
            </div>
            {nextAction && (
              <Button
                size="sm"
                variant={job.status === 'done' ? 'default' : 'outline'}
                className={cn(
                  "flex-shrink-0 h-7 px-2 text-xs rounded-lg",
                  job.status === 'done' && "text-white"
                )}
                style={job.status === 'done' ? { backgroundColor: 'hsl(var(--trade))' } : {}}
                onClick={(e) => {
                  e.stopPropagation();
                  nextAction.action();
                }}
                data-testid={`btn-${nextAction.label.toLowerCase()}-${job.id}`}
              >
                <nextAction.icon className="h-3 w-3 mr-1" />
                {nextAction.label}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  // Column component
  const KanbanColumn = ({ 
    title, 
    jobs, 
    icon, 
    iconColor,
    columnId,
    emptyText,
    isMobile = false
  }: { 
    title: string; 
    jobs: Job[]; 
    icon: React.ReactNode;
    iconColor: string;
    columnId: string;
    emptyText: string;
    isMobile?: boolean;
  }) => (
    <div 
      className={cn(
        "flex-shrink-0",
        isMobile ? "w-full" : "w-full min-w-0"
      )}
      data-testid={`column-${columnId}`}
    >
      <div className="h-full flex flex-col bg-muted/30 rounded-xl p-3">
        <div className="flex items-center gap-2 mb-3 px-1">
          <div 
            className="w-6 h-6 rounded-md flex items-center justify-center"
            style={{ backgroundColor: `${iconColor}20` }}
          >
            {icon}
          </div>
          <span className="font-semibold text-sm">{title}</span>
          <Badge variant="secondary" className="ml-auto text-xs">
            {jobs.length}
          </Badge>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-3">
          {jobs.length > 0 ? (
            jobs.map(job => <KanbanCard key={job.id} job={job} />)
          ) : (
            <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">
              {emptyText}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const totalActive = kanbanColumns.today.length + kanbanColumns.inProgress.length + kanbanColumns.needsInvoice.length;

  return (
    <PageShell data-testid="work-page">
      <PageHeader
        title="Work"
        subtitle={`${totalActive} active jobs`}
        action={
          canCreateJobs && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPasteJobOpen(true)}
                className="rounded-xl"
                data-testid="btn-paste-job"
              >
                <Clipboard className="h-4 w-4" />
                <span className="hidden sm:inline ml-1">Paste</span>
              </Button>
              <Button
                size="sm"
                onClick={onCreateJob}
                className="rounded-xl text-white"
                style={{ backgroundColor: 'hsl(var(--trade))' }}
                data-testid="btn-create-job"
              >
                <Plus className="h-4 w-4 mr-1" />
                Job
              </Button>
            </div>
          )
        }
      />

      <SearchBar
        value={searchTerm}
        onChange={setSearchTerm}
        placeholder="Search jobs..."
      />

      {/* Mobile Tab Navigation - visible below md breakpoint */}
      <Tabs defaultValue="queue" className="md:hidden mt-4">
        <TabsList className="w-full grid grid-cols-4 h-auto p-1" data-testid="mobile-column-tabs">
          <TabsTrigger 
            value="queue" 
            className="flex flex-col gap-0.5 py-2 px-1 text-xs data-[state=active]:text-[hsl(var(--trade))]"
            data-testid="tab-queue"
          >
            <span>Queue</span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {kanbanColumns.today.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger 
            value="in-progress" 
            className="flex flex-col gap-0.5 py-2 px-1 text-xs data-[state=active]:text-[hsl(var(--warning))]"
            data-testid="tab-in-progress"
          >
            <span>In Progress</span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {kanbanColumns.inProgress.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger 
            value="needs-invoice" 
            className="flex flex-col gap-0.5 py-2 px-1 text-xs data-[state=active]:text-[hsl(var(--destructive))]"
            data-testid="tab-needs-invoice"
          >
            <span>Invoice</span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {kanbanColumns.needsInvoice.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger 
            value="completed" 
            className="flex flex-col gap-0.5 py-2 px-1 text-xs data-[state=active]:text-[hsl(var(--success))]"
            data-testid="tab-completed"
          >
            <span>Done</span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {kanbanColumns.completed.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="mt-3" data-testid="mobile-kanban-content-queue">
          <KanbanColumn
            columnId="queue"
            title="Queue"
            jobs={kanbanColumns.today}
            icon={<Calendar className="h-3.5 w-3.5" style={{ color: 'hsl(var(--trade))' }} />}
            iconColor="hsl(var(--trade))"
            emptyText="No jobs in queue"
            isMobile
          />
        </TabsContent>
        <TabsContent value="in-progress" className="mt-3" data-testid="mobile-kanban-content-in-progress">
          <KanbanColumn
            columnId="in-progress"
            title="In Progress"
            jobs={kanbanColumns.inProgress}
            icon={<Play className="h-3.5 w-3.5" style={{ color: 'hsl(var(--warning))' }} />}
            iconColor="hsl(var(--warning))"
            emptyText="Nothing in progress"
            isMobile
          />
        </TabsContent>
        <TabsContent value="needs-invoice" className="mt-3" data-testid="mobile-kanban-content-needs-invoice">
          <KanbanColumn
            columnId="needs-invoice"
            title="Needs Invoice"
            jobs={kanbanColumns.needsInvoice}
            icon={<AlertCircle className="h-3.5 w-3.5" style={{ color: 'hsl(var(--destructive))' }} />}
            iconColor="hsl(var(--destructive))"
            emptyText="All invoiced"
            isMobile
          />
        </TabsContent>
        <TabsContent value="completed" className="mt-3" data-testid="mobile-kanban-content-completed">
          <KanbanColumn
            columnId="completed"
            title="Done"
            jobs={kanbanColumns.completed}
            icon={<CheckCircle className="h-3.5 w-3.5" style={{ color: 'hsl(var(--success))' }} />}
            iconColor="hsl(var(--success))"
            emptyText="No completed jobs"
            isMobile
          />
        </TabsContent>
      </Tabs>

      {/* Desktop: Grid layout - hidden on mobile, visible from md breakpoint */}
      <div 
        className="hidden md:grid md:grid-cols-4 gap-4 mt-4"
        data-testid="kanban-board"
      >
        <KanbanColumn
          columnId="queue"
          title="Queue"
          jobs={kanbanColumns.today}
          icon={<Calendar className="h-3.5 w-3.5" style={{ color: 'hsl(var(--trade))' }} />}
          iconColor="hsl(var(--trade))"
          emptyText="No jobs in queue"
        />
        <KanbanColumn
          columnId="in-progress"
          title="In Progress"
          jobs={kanbanColumns.inProgress}
          icon={<Play className="h-3.5 w-3.5" style={{ color: 'hsl(var(--warning))' }} />}
          iconColor="hsl(var(--warning))"
          emptyText="Nothing in progress"
        />
        <KanbanColumn
          columnId="needs-invoice"
          title="Needs Invoice"
          jobs={kanbanColumns.needsInvoice}
          icon={<AlertCircle className="h-3.5 w-3.5" style={{ color: 'hsl(var(--destructive))' }} />}
          iconColor="hsl(var(--destructive))"
          emptyText="All invoiced"
        />
        <KanbanColumn
          columnId="completed"
          title="Done"
          jobs={kanbanColumns.completed}
          icon={<CheckCircle className="h-3.5 w-3.5" style={{ color: 'hsl(var(--success))' }} />}
          iconColor="hsl(var(--success))"
          emptyText="No completed jobs"
        />
      </div>

      {/* Empty state when no jobs at all */}
      {jobs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
            <Briefcase className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="font-semibold mb-1">No jobs yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Create your first job to get started</p>
          {canCreateJobs && onCreateJob && (
            <Button
              onClick={onCreateJob}
              className="rounded-xl text-white"
              style={{ backgroundColor: 'hsl(var(--trade))' }}
              data-testid="btn-create-first-job"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Job
            </Button>
          )}
        </div>
      )}

      <PasteJobModal
        open={pasteJobOpen}
        onOpenChange={setPasteJobOpen}
        onCreateJob={async (data) => {
          try {
            const response = await fetch('/api/jobs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                title: data.title,
                description: data.description,
                address: data.address,
                status: 'pending',
              }),
            });
            if (response.ok) {
              const job = await response.json();
              await queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
              setPasteJobOpen(false);
              onViewJob?.(job.id);
              toast({
                title: "Job Created",
                description: `${data.title} created successfully`,
              });
            }
          } catch (error) {
            toast({
              title: "Error",
              description: "Failed to create job",
              variant: "destructive",
            });
          }
        }}
      />

      <ConfirmationDialog
        open={statusDialogOpen}
        onOpenChange={setStatusDialogOpen}
        title={`${pendingStatus === 'in_progress' ? 'Start' : pendingStatus === 'done' ? 'Complete' : 'Update'} Job?`}
        description={`${selectedJob?.title || 'This job'} will be marked as ${statusLabels[pendingStatus || 'pending']}.`}
        confirmLabel={pendingStatus === 'in_progress' ? 'Start Job' : pendingStatus === 'done' ? 'Mark Complete' : 'Update'}
        onConfirm={handleConfirmStatusChange}
      />
    </PageShell>
  );
}
