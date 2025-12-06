import { useState, useEffect } from "react";
import { useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Briefcase, User, Clock, MapPin, MoreVertical, Edit, FileText, CheckCircle, AlertCircle, LayoutGrid, List, ChevronRight, Play, ArrowRight } from "lucide-react";
import { PageShell, PageHeader, SectionTitle } from "@/components/ui/page-shell";
import { EmptyState } from "@/components/ui/compact-card";
import { FilterChips, SearchBar } from "@/components/ui/filter-chips";
import { DataTable, ColumnDef, StatusBadge } from "@/components/ui/data-table";
import { useJobs, useUpdateJob, useRecentJobs } from "@/hooks/use-jobs";
import { useGenerateQuoteFromJob } from "@/hooks/use-quotes";
import { useToast } from "@/hooks/use-toast";
import { useAppMode } from "@/hooks/use-app-mode";
import { formatHistoryDate } from "@shared/dateUtils";
import { queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { ConfirmationDialog } from "./ConfirmationDialog";

type JobStatus = 'pending' | 'scheduled' | 'in_progress' | 'done' | 'invoiced';

interface JobsListProps {
  onCreateJob?: () => void;
  onViewJob?: (id: string) => void;
  onStatusChange?: (id: string, newStatus: JobStatus) => void;
  onGenerateQuote?: (id: string) => void;
  onShowQuoteModal?: (quoteId: string) => void;
}

export default function JobsList({
  onCreateJob,
  onViewJob,
  onStatusChange,
  onGenerateQuote,
  onShowQuoteModal
}: JobsListProps) {
  const searchParams = useSearch();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showOlderJobs, setShowOlderJobs] = useState(false);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [pendingStatus, setPendingStatus] = useState<JobStatus | null>(null);
  const { data: jobs = [] } = useJobs() as { data: any[] };
  
  // Get role-based permissions
  const { actionPermissions, shouldFilterToAssignedJobs } = useAppMode();
  const canCreateJobs = actionPermissions.canCreateJobs;

  const tableColumns: ColumnDef<any>[] = [
    {
      id: "title",
      header: "Job",
      accessorKey: "title",
      sortable: true,
      cell: (row) => (
        <div className="font-medium">{row.title || "Untitled Job"}</div>
      ),
    },
    {
      id: "client",
      header: "Client",
      accessorKey: "clientName",
      sortable: true,
      cell: (row) => row.clientName || "—",
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
      cell: (row) =>
        row.scheduledAt
          ? new Date(row.scheduledAt).toLocaleDateString("en-AU")
          : "—",
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
      cell: (row) => (
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
          <DropdownMenuContent align="end" className="rounded-xl">
            <DropdownMenuItem onClick={() => onViewJob?.(row.id)}>
              <Edit className="h-4 w-4 mr-2" />
              View Details
            </DropdownMenuItem>
            {row.status === "pending" && (
              <DropdownMenuItem
                onClick={() => handleStatusChange(row.id, "scheduled")}
              >
                <Clock className="h-4 w-4 mr-2" />
                Schedule Job
              </DropdownMenuItem>
            )}
            {row.status === "scheduled" && (
              <DropdownMenuItem
                onClick={() => handleStatusChange(row.id, "in_progress")}
              >
                <Play className="h-4 w-4 mr-2" />
                Start Job
              </DropdownMenuItem>
            )}
            {row.status === "in_progress" && (
              <DropdownMenuItem
                onClick={() => handleStatusChange(row.id, "done")}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Complete Job
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => handleGenerateQuote(row.id)}>
              <FileText className="h-4 w-4 mr-2" />
              Generate Quote
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    const filterParam = params.get('filter');
    if (filterParam && ['all', 'pending', 'scheduled', 'in_progress', 'done', 'invoiced'].includes(filterParam)) {
      setStatusFilter(filterParam);
    }
  }, [searchParams]);
  const { recent: recentJobs, older: olderJobs, isLoading: jobsLoading } = useRecentJobs();
  const { toast } = useToast();
  const updateJobMutation = useUpdateJob();
  const generateQuoteMutation = useGenerateQuoteFromJob();

  // Status display labels for toast messages
  const statusLabels: Record<JobStatus, string> = {
    pending: 'Pending',
    scheduled: 'Scheduled',
    in_progress: 'In Progress',
    done: 'Completed',
    invoiced: 'Invoiced',
  };

  // Open confirmation dialog for status change
  const handleStatusChange = (id: string, newStatus: JobStatus) => {
    const job = jobs.find((j: any) => j.id === id);
    if (job) {
      setSelectedJob(job);
      setPendingStatus(newStatus);
      setStatusDialogOpen(true);
    }
  };

  // Called when user confirms status change
  const handleConfirmStatusChange = async () => {
    if (!selectedJob || !pendingStatus) return;
    
    try {
      await updateJobMutation.mutateAsync({ id: selectedJob.id, data: { status: pendingStatus } });
      await queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      const jobTitle = selectedJob.title || 'Job';
      const clientName = selectedJob.clientName || '';
      toast({
        title: `Job ${statusLabels[pendingStatus]}`,
        description: `${jobTitle}${clientName ? ` for ${clientName}` : ''} → ${statusLabels[pendingStatus]}`,
      });
      if (onStatusChange) onStatusChange(selectedJob.id, pendingStatus);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update job status",
        variant: "destructive",
      });
    }
  };

  const handleGenerateQuote = async (jobId: string) => {
    try {
      const quote = await generateQuoteMutation.mutateAsync(jobId);
      toast({
        title: "Quote generated",
        description: `Quote ${quote.number} has been created successfully`,
      });
      
      if (onShowQuoteModal && quote.id) {
        onShowQuoteModal(quote.id);
      }
      
      if (onGenerateQuote) onGenerateQuote(jobId);
    } catch (error) {
      toast({
        title: "Error", 
        description: "Failed to generate quote from job",
        variant: "destructive",
      });
    }
  };

  const statusCounts = {
    all: jobs.length,
    pending: jobs.filter(j => j.status === 'pending').length,
    scheduled: jobs.filter(j => j.status === 'scheduled').length,
    in_progress: jobs.filter(j => j.status === 'in_progress').length,
    done: jobs.filter(j => j.status === 'done').length,
    invoiced: jobs.filter(j => j.status === 'invoiced').length
  };

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = (job.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (job.clientName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (job.address || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || job.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    if (status === 'done') {
      return <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-[11px] font-medium px-2 py-0.5 rounded-full">Completed</Badge>;
    }
    if (status === 'invoiced') {
      return <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20 text-[11px] font-medium px-2 py-0.5 rounded-full">Invoiced</Badge>;
    }
    if (status === 'in_progress') {
      return (
        <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[11px] font-medium px-2 py-0.5 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 animate-pulse" />
          In Progress
        </Badge>
      );
    }
    if (status === 'scheduled') {
      return <Badge className="bg-slate-500/10 text-slate-600 border-slate-500/20 dark:text-slate-400 text-[11px] font-medium px-2 py-0.5 rounded-full">Scheduled</Badge>;
    }
    return <Badge variant="outline" className="text-[11px] font-medium px-2 py-0.5 rounded-full">New</Badge>;
  };

  const filterChips = [
    { id: "all", label: "All", count: statusCounts.all },
    { id: "pending", label: "New", count: statusCounts.pending },
    { id: "scheduled", label: "Scheduled", count: statusCounts.scheduled },
    { id: "in_progress", label: "In Progress", count: statusCounts.in_progress },
    { id: "done", label: "Completed", count: statusCounts.done },
    { id: "invoiced", label: "Invoiced", count: statusCounts.invoiced }
  ];

  return (
    <PageShell data-testid="jobs-list">
      <PageHeader
        title="Jobs"
        subtitle={`${jobs.length} total`}
        action={
          <div className="flex items-center gap-2">
            <div className="hidden md:inline-flex rounded-xl border bg-muted p-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode("cards")}
                className={cn(
                  "h-8 px-3 rounded-lg press-scale",
                  viewMode === "cards" && "bg-background shadow-sm"
                )}
                data-testid="button-view-cards"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode("table")}
                className={cn(
                  "h-8 px-3 rounded-lg press-scale",
                  viewMode === "table" && "bg-background shadow-sm"
                )}
                data-testid="button-view-table"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
            {onCreateJob && canCreateJobs && (
              <Button 
                onClick={onCreateJob} 
                data-testid="button-create-job"
                className="text-white font-medium rounded-xl h-10 px-4 press-scale"
                style={{ backgroundColor: 'hsl(var(--trade))' }}
              >
                <Plus className="h-4 w-4 mr-2" />
                New Job
              </Button>
            )}
          </div>
        }
      />

      {/* Search and Filter Chips */}
      <div className="space-y-3">
        <SearchBar
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Search jobs, clients, addresses..."
        />
        <FilterChips
          chips={filterChips}
          activeId={statusFilter}
          onSelect={setStatusFilter}
        />
      </div>

      {/* KPI Stats - Native Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {jobsLoading ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="feed-card card-padding">
                <div className="animate-pulse space-y-2">
                  <div className="h-4 w-16 bg-muted rounded" />
                  <div className="h-8 w-12 bg-muted rounded" />
                </div>
              </div>
            ))}
          </>
        ) : (
          <>
            {[
              { title: "Total Jobs", value: statusCounts.all, filter: 'all', icon: Briefcase, color: 'hsl(var(--trade))' },
              { title: "Scheduled", value: statusCounts.scheduled, filter: 'scheduled', icon: Clock, color: 'hsl(210 80% 52%)' },
              { title: "In Progress", value: statusCounts.in_progress, filter: 'in_progress', icon: Play, color: 'hsl(35 90% 55%)' },
              { title: "Completed", value: statusCounts.done, filter: 'done', icon: CheckCircle, color: 'hsl(145 65% 45%)' },
            ].map((kpi) => (
              <div
                key={kpi.filter}
                className="feed-card card-press cursor-pointer"
                onClick={() => setStatusFilter(kpi.filter)}
              >
                <div className="card-padding">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${kpi.color}15` }}
                    >
                      <kpi.icon className="h-5 w-5" style={{ color: kpi.color }} />
                    </div>
                    <div>
                      <p className="text-xl font-bold">{kpi.value}</p>
                      <p className="ios-caption">{kpi.title}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Recent Activity - Native Feed */}
      <section className="animate-fade-up" style={{ animationDelay: '50ms' }}>
        <SectionTitle icon={<Clock className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />}>
          Recent Activity
        </SectionTitle>
        <div className="mt-3 feed-card">
          <div className="card-padding">
            {jobsLoading ? (
              <div className="text-center py-4">
                <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin mx-auto"
                     style={{ borderColor: 'hsl(var(--trade))', borderTopColor: 'transparent' }} />
              </div>
            ) : (recentJobs && recentJobs.length > 0) || (olderJobs && olderJobs.length > 0) ? (
              <div className="max-h-[220px] overflow-y-auto">
                <div className="space-y-1">
                  {recentJobs && recentJobs.length > 0 && (
                    <>
                      <p className="ios-label px-1 mb-2">This Week</p>
                      {recentJobs.slice(0, 4).map((job: any, index: number) => (
                        <div 
                          key={job.id}
                          className={`flex items-center gap-3 p-2.5 rounded-xl hover-elevate cursor-pointer animate-slide-in stagger-delay-${Math.min(index + 1, 8)}`}
                          style={{ opacity: 0 }}
                          onClick={() => onViewJob?.(job.id)}
                        >
                          <div 
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: 'hsl(var(--trade))' }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="ios-body font-medium truncate">{job.title || 'Untitled Job'}</p>
                            <p className="ios-caption truncate">
                              {job.clientName} · {formatHistoryDate(job.createdAt)}
                            </p>
                          </div>
                          {getStatusBadge(job.status)}
                        </div>
                      ))}
                    </>
                  )}

                  {olderJobs && olderJobs.length > 0 && (
                    <div className="pt-3 border-t mt-3">
                      <p className="ios-label px-1 mb-2">Earlier</p>
                      {olderJobs.slice(0, showOlderJobs ? undefined : 3).map((job: any, index: number) => (
                        <div 
                          key={job.id}
                          className="flex items-center gap-3 p-2.5 rounded-xl hover-elevate cursor-pointer"
                          onClick={() => onViewJob?.(job.id)}
                        >
                          <div 
                            className="w-2 h-2 rounded-full flex-shrink-0 opacity-50"
                            style={{ backgroundColor: 'hsl(var(--trade))' }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="ios-body font-medium truncate">{job.title || 'Untitled Job'}</p>
                            <p className="ios-caption truncate">
                              {job.clientName} · {formatHistoryDate(job.createdAt)}
                            </p>
                          </div>
                          {getStatusBadge(job.status)}
                        </div>
                      ))}
                      
                      {olderJobs.length > 3 && !showOlderJobs && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full h-9 text-xs mt-2 rounded-xl press-scale"
                          onClick={() => setShowOlderJobs(true)}
                        >
                          View {olderJobs.length - 3} more...
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <div 
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
                  style={{ backgroundColor: 'hsl(var(--muted) / 0.5)' }}
                >
                  <Briefcase className="h-6 w-6 text-muted-foreground/40" />
                </div>
                <p className="ios-caption">No recent jobs</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Jobs List - Table or Card View */}
      <section className="animate-fade-up" style={{ animationDelay: '100ms' }}>
        <SectionTitle icon={<Briefcase className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />}>
          All Jobs
        </SectionTitle>
        <div className="mt-3">
          {jobsLoading ? (
            <div className="feed-gap" data-testid="jobs-loading">
              {[1, 2, 3].map((i) => (
                <div key={i} className="feed-card card-padding animate-pulse">
                  <div className="space-y-3">
                    <div className="h-5 w-48 bg-muted rounded" />
                    <div className="h-4 w-32 bg-muted rounded" />
                    <div className="flex gap-4">
                      <div className="h-3 w-24 bg-muted rounded" />
                      <div className="h-3 w-24 bg-muted rounded" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredJobs.length === 0 ? (
            <EmptyState
              icon={Briefcase}
              title="No jobs found"
              description={
                searchTerm || statusFilter !== "all"
                  ? "Try adjusting your search or filters"
                  : "Jobs help you track work from start to finish and convert to invoices in one tap."
              }
              action={
                (!searchTerm && statusFilter === "all" && onCreateJob && canCreateJobs) && (
                  <Button 
                    onClick={onCreateJob} 
                    className="rounded-xl h-11 px-5 press-scale"
                    style={{ backgroundColor: 'hsl(var(--trade))', color: 'white' }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Job
                  </Button>
                )
              }
              tip={(!searchTerm && statusFilter === "all") ? "Add photos and notes to jobs for easy reference later" : undefined}
              encouragement={(!searchTerm && statusFilter === "all") ? "Most tradies add their first job in under 2 minutes" : undefined}
            />
          ) : viewMode === "table" ? (
            <DataTable
              data={filteredJobs}
              columns={tableColumns}
              onRowClick={(row) => onViewJob?.(row.id)}
              isLoading={jobsLoading}
              pageSize={15}
              showViewToggle={false}
              getRowId={(row) => row.id}
            />
          ) : (
            <div className="feed-gap" data-testid="jobs-list-card">
              {filteredJobs.map((job: any, index: number) => (
                <div 
                  key={job.id} 
                  className={`feed-card card-press cursor-pointer animate-slide-in stagger-delay-${Math.min(index + 1, 8)}`}
                  style={{ opacity: 0 }}
                  onClick={() => onViewJob?.(job.id)}
                  data-testid={`job-item-${job.id}`}
                >
                  <div className="card-padding">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="ios-card-title truncate">{job.title || 'Untitled Job'}</h3>
                          {getStatusBadge(job.status)}
                        </div>
                        {job.clientName && (
                          <div className="flex items-center gap-2 ios-body mb-2">
                            <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            <span className="truncate">{job.clientName}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-4 flex-wrap">
                          {job.scheduledAt && (
                            <div className="flex items-center gap-1.5 ios-caption">
                              <Clock className="h-3.5 w-3.5" />
                              <span>{new Date(job.scheduledAt).toLocaleDateString('en-AU')}</span>
                            </div>
                          )}
                          {job.address && (
                            <div className="flex items-center gap-1.5 ios-caption">
                              <MapPin className="h-3.5 w-3.5" />
                              <span className="truncate max-w-[180px]">{job.address}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-9 w-9 rounded-xl"
                              data-testid={`button-job-actions-${job.id}`}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl">
                            <DropdownMenuItem onClick={() => onViewJob?.(job.id)}>
                              <Edit className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            {job.status !== 'pending' && (
                              <DropdownMenuItem onClick={() => handleStatusChange(job.id, 'pending')}>
                                <Clock className="h-4 w-4 mr-2" />
                                Mark as Pending
                              </DropdownMenuItem>
                            )}
                            {job.status !== 'in_progress' && (
                              <DropdownMenuItem onClick={() => handleStatusChange(job.id, 'in_progress')}>
                                <Play className="h-4 w-4 mr-2" />
                                Mark as In Progress
                              </DropdownMenuItem>
                            )}
                            {job.status !== 'done' && (
                              <DropdownMenuItem onClick={() => handleStatusChange(job.id, 'done')}>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Mark as Done
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => handleGenerateQuote(job.id)}>
                              <FileText className="h-4 w-4 mr-2" />
                              Generate Quote
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Job Status Change Confirmation Dialog */}
      {selectedJob && pendingStatus && (
        <ConfirmationDialog
          open={statusDialogOpen}
          onOpenChange={setStatusDialogOpen}
          title="Change Job Status"
          description={`Update status for this job?`}
          details={[
            { label: "Job", value: selectedJob.title || 'Untitled Job' },
            { label: "Client", value: selectedJob.clientName || 'Unknown' },
            { label: "Current Status", value: statusLabels[selectedJob.status as JobStatus] || 'Unknown' },
            { label: "New Status", value: statusLabels[pendingStatus] },
          ]}
          confirmLabel={`Mark as ${statusLabels[pendingStatus]}`}
          onConfirm={handleConfirmStatusChange}
          isPending={updateJobMutation.isPending}
        />
      )}
    </PageShell>
  );
}
