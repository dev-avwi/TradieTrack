import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { 
  Plus, 
  Briefcase, 
  Clock, 
  Play, 
  CheckCircle, 
  Receipt, 
  Calendar,
  Clipboard,
  User,
  MapPin,
  LayoutGrid,
  List,
  MoreVertical,
  Hourglass,
  AlertCircle,
  Archive,
  RotateCcw
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { EmptyState } from "@/components/ui/compact-card";
import { SearchBar, FilterChips } from "@/components/ui/filter-chips";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import StatusBadge from "@/components/StatusBadge";
import { useJobs, useUpdateJob, useUnarchiveJob } from "@/hooks/use-jobs";
import { useToast } from "@/hooks/use-toast";
import { useAppMode } from "@/hooks/use-app-mode";
import { useLocation } from "wouter";
import { format, parseISO } from "date-fns";
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
  const [activeFilter, setActiveFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [pasteJobOpen, setPasteJobOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [pendingStatus, setPendingStatus] = useState<JobStatus | null>(null);
  const [, navigate] = useLocation();

  const showArchived = activeFilter === 'archived';
  const { data: jobs = [], isLoading } = useJobs({ archived: showArchived }) as { data: Job[], isLoading: boolean };
  const { toast } = useToast();
  const updateJobMutation = useUpdateJob();
  const unarchiveJobMutation = useUnarchiveJob();
  const { actionPermissions } = useAppMode();
  const canCreateJobs = actionPermissions.canCreateJobs;

  const statusLabels: Record<JobStatus, string> = {
    pending: 'Pending',
    scheduled: 'Scheduled',
    in_progress: 'In Progress',
    done: 'Completed',
    invoiced: 'Invoiced',
  };

  const stats = useMemo(() => ({
    total: jobs.length,
    pending: jobs.filter(j => j.status === 'pending').length,
    scheduled: jobs.filter(j => j.status === 'scheduled').length,
    inProgress: jobs.filter(j => j.status === 'in_progress').length,
    done: jobs.filter(j => j.status === 'done').length,
    invoiced: jobs.filter(j => j.status === 'invoiced').length,
    archived: showArchived ? jobs.length : undefined,
  }), [jobs, showArchived]);

  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      const search = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || 
        (job.title || '').toLowerCase().includes(search) ||
        (job.clientName || '').toLowerCase().includes(search) ||
        (job.address || '').toLowerCase().includes(search);

      const matchesFilter = activeFilter === 'all' || activeFilter === 'archived' || job.status === activeFilter;

      return matchesSearch && matchesFilter;
    });
  }, [jobs, searchTerm, activeFilter]);

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

  const handleRestoreJob = async (job: Job) => {
    try {
      await unarchiveJobMutation.mutateAsync(job.id);
      toast({
        title: "Job Restored",
        description: `${job.title || 'Job'} has been restored`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to restore job",
        variant: "destructive",
      });
    }
  };

  const getNextAction = (job: Job) => {
    if (showArchived) {
      return { label: 'Restore', action: () => handleRestoreJob(job), icon: RotateCcw };
    }
    if (job.status === 'pending') return { label: 'Start', action: () => handleStatusChange(job, 'in_progress'), icon: Play };
    if (job.status === 'scheduled') return { label: 'Start', action: () => handleStatusChange(job, 'in_progress'), icon: Play };
    if (job.status === 'in_progress') return { label: 'Done', action: () => handleStatusChange(job, 'done'), icon: CheckCircle };
    if (job.status === 'done') return { label: 'Invoice', action: () => handleCreateInvoice(job.id), icon: Receipt };
    return null;
  };

  const tableColumns: ColumnDef<Job>[] = [
    {
      id: "title",
      header: "Job",
      accessorKey: "title",
      sortable: true,
      cell: (row) => (
        <div className="min-w-0">
          <span className="font-medium block truncate">{row.title || 'Untitled Job'}</span>
          {row.clientName && (
            <span className="text-xs text-muted-foreground truncate block">{row.clientName}</span>
          )}
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      accessorKey: "status",
      sortable: true,
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      id: "scheduledAt",
      header: "Scheduled",
      accessorKey: "scheduledAt",
      sortable: true,
      hideOnMobile: true,
      cell: (row) => row.scheduledAt ? format(parseISO(row.scheduledAt), 'dd MMM, h:mm a') : '—',
    },
    {
      id: "address",
      header: "Address",
      accessorKey: "address",
      hideOnMobile: true,
      cell: (row) => (
        <span className="text-muted-foreground truncate max-w-[200px] block">
          {row.address || "—"}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      className: "w-10",
      cell: (row) => {
        const nextAction = getNextAction(row);
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => e.stopPropagation()}
                data-testid={`button-job-table-actions-${row.id}`}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" style={{ borderRadius: "12px" }}>
              <DropdownMenuItem onClick={() => onViewJob?.(row.id)}>
                <Briefcase className="h-4 w-4 mr-2" />
                View Details
              </DropdownMenuItem>
              {nextAction && (
                <DropdownMenuItem onClick={nextAction.action}>
                  <nextAction.icon className="h-4 w-4 mr-2" />
                  {nextAction.label}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const JobCardItem = ({ job }: { job: Job }) => {
    const nextAction = getNextAction(job);
    const scheduledLabel = job.scheduledAt 
      ? format(parseISO(job.scheduledAt), 'EEE d MMM, h:mm a')
      : null;

    return (
      <Card 
        className="hover-elevate cursor-pointer"
        style={{ borderRadius: '14px' }}
        onClick={() => onViewJob?.(job.id)}
        data-testid={`job-card-${job.id}`}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-semibold text-base truncate leading-tight">
                  {job.title || 'Untitled Job'}
                </h4>
                <StatusBadge status={job.status} />
              </div>
              
              <div className="space-y-1">
                {job.clientName && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <User className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate">{job.clientName}</span>
                  </div>
                )}
                {job.address && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate">{job.address}</span>
                  </div>
                )}
                {scheduledLabel && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>{scheduledLabel}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {nextAction && (
            <div className="mt-3 pt-3 border-t flex justify-end">
              <Button
                size="sm"
                variant={job.status === 'done' ? 'default' : 'outline'}
                className={cn(
                  "rounded-lg",
                  job.status === 'done' && "text-white"
                )}
                style={job.status === 'done' ? { backgroundColor: 'hsl(var(--trade))' } : {}}
                onClick={(e) => {
                  e.stopPropagation();
                  nextAction.action();
                }}
                data-testid={`btn-${nextAction.label.toLowerCase()}-${job.id}`}
              >
                <nextAction.icon className="h-4 w-4 mr-1.5" />
                {nextAction.label}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <PageShell data-testid="work-page">
      <PageHeader
        title="Work"
        subtitle={`${jobs.length} total jobs`}
        action={
          canCreateJobs && (
            <div className="flex items-center gap-2">
              <div className="hidden md:inline-flex rounded-lg border bg-muted p-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewMode("cards")}
                  className={cn(
                    "h-8 px-3 rounded-md",
                    viewMode === "cards" && "bg-background shadow-sm"
                  )}
                  data-testid="button-work-view-cards"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewMode("table")}
                  className={cn(
                    "h-8 px-3 rounded-md",
                    viewMode === "table" && "bg-background shadow-sm"
                  )}
                  data-testid="button-work-view-table"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
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
        placeholder="Search jobs by title, client, or address..."
      />

      <FilterChips 
        chips={[
          { id: 'all', label: 'All', count: stats.total, icon: <Briefcase className="h-3 w-3" /> },
          { id: 'pending', label: 'Pending', count: stats.pending, icon: <Hourglass className="h-3 w-3" /> },
          { id: 'scheduled', label: 'Scheduled', count: stats.scheduled, icon: <Calendar className="h-3 w-3" /> },
          { id: 'in_progress', label: 'In Progress', count: stats.inProgress, icon: <Play className="h-3 w-3" /> },
          { id: 'done', label: 'Done', count: stats.done, icon: <CheckCircle className="h-3 w-3" /> },
          { id: 'invoiced', label: 'Invoiced', count: stats.invoiced, icon: <Receipt className="h-3 w-3" /> },
          { id: 'archived', label: 'Archived', count: stats.archived, icon: <Archive className="h-3 w-3" /> },
        ]}
        activeId={activeFilter}
        onSelect={setActiveFilter}
      />


      {isLoading ? (
        <div className="space-y-3" data-testid="jobs-loading">
          {[1, 2, 3].map((i) => (
            <Card key={i} style={{ borderRadius: '14px' }}>
              <CardContent className="p-4 animate-pulse">
                <div className="space-y-3">
                  <div className="h-5 w-48 bg-muted rounded" />
                  <div className="h-4 w-32 bg-muted rounded" />
                  <div className="flex gap-4">
                    <div className="h-3 w-24 bg-muted rounded" />
                    <div className="h-3 w-24 bg-muted rounded" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredJobs.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No jobs found"
          description={
            searchTerm 
              ? "Try adjusting your search terms"
              : "Create your first job to start tracking work and generating invoices."
          }
          action={
            !searchTerm && canCreateJobs && (
              <Button 
                onClick={onCreateJob}
                style={{ borderRadius: '12px' }}
                className="text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Job
              </Button>
            )
          }
          tip={!searchTerm ? "Jobs flow: Pending → Scheduled → In Progress → Done → Invoiced" : undefined}
          encouragement={!searchTerm ? "Track jobs from start to payment" : undefined}
        />
      ) : viewMode === "table" ? (
        <DataTable
          data={filteredJobs}
          columns={tableColumns}
          onRowClick={(row) => onViewJob?.(row.id)}
          isLoading={isLoading}
          pageSize={15}
          showViewToggle={false}
          getRowId={(row) => row.id}
        />
      ) : (
        <div className="grid grid-cols-2 gap-3" data-testid="jobs-list-cards">
          {filteredJobs.map((job: Job) => (
            <JobCardItem key={job.id} job={job} />
          ))}
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
