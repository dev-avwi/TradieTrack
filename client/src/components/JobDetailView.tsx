import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Briefcase, User, MapPin, Calendar, Clock, Edit, FileText, Receipt, Camera, ExternalLink, Sparkles, Zap, Mic, ClipboardList, Users, Timer, CheckCircle, AlertTriangle } from "lucide-react";
import { TimerWidget } from "./TimeTracking";
import { useLocation } from "wouter";
import JobPhotoGallery from "./JobPhotoGallery";
import { JobVoiceNotes } from "./JobVoiceNotes";
import { JobSignature } from "./JobSignature";
import { JobForms } from "./CustomFormRenderer";
import { JobChat } from "./JobChat";
import SmartActionsPanel, { getJobSmartActions, SmartAction } from "./SmartActionsPanel";
import EmailTemplateEditor, { EmailTemplate } from "./EmailTemplateEditor";
import GeofenceSettingsCard from "./GeofenceSettingsCard";
import { LinkedDocumentsCard } from "./JobWorkflowComponents";
import JobFlowWizard from "@/components/JobFlowWizard";
import { useBusinessSettings } from "@/hooks/use-business-settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageShell } from "@/components/ui/page-shell";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useAppMode } from "@/hooks/use-app-mode";

interface Photo {
  url: string;
  caption?: string;
}

type JobStatus = 'pending' | 'scheduled' | 'in_progress' | 'done' | 'invoiced';

interface Job {
  id: string;
  title: string;
  description?: string;
  clientId?: string;
  address?: string;
  latitude?: string;
  longitude?: string;
  scheduledAt?: string;
  assignedTo?: string;
  status: JobStatus;
  photos?: Photo[];
  notes?: string;
  estimatedHours?: number;
  estimatedCost?: number;
  geofenceEnabled?: boolean;
  geofenceRadius?: number;
  geofenceAutoClockIn?: boolean;
  geofenceAutoClockOut?: boolean;
}

interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

interface User {
  id: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

interface LinkedDocument {
  id: string;
  title?: string;
  status: string;
  total: string;
  number?: string;
  quoteNumber?: string;
  invoiceNumber?: string;
  createdAt?: string;
  dueDate?: string;
  paidAt?: string;
}

interface JobWithLinks {
  linkedQuote?: LinkedDocument | null;
  linkedInvoice?: LinkedDocument | null;
}

interface TeamMember {
  id: string;
  memberId: string;
  firstName: string;
  lastName: string;
  roleName: string;
  isActive: boolean;
}

interface JobDetailViewProps {
  jobId: string;
  onBack: () => void;
  onEditJob?: (jobId: string) => void;
  onCompleteJob?: (jobId: string) => void;
  onCreateQuote?: (jobId: string) => void;
  onCreateInvoice?: (jobId: string) => void;
  onViewClient?: (clientId: string) => void;
}

export default function JobDetailView({
  jobId,
  onBack,
  onEditJob,
  onCompleteJob,
  onCreateQuote,
  onCreateInvoice,
  onViewClient,
}: JobDetailViewProps) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [showSmartActions, setShowSmartActions] = useState(false);
  const [smartActions, setSmartActions] = useState<SmartAction[]>([]);
  const [isExecutingActions, setIsExecutingActions] = useState(false);
  const [emailEditorOpen, setEmailEditorOpen] = useState(false);
  const [editingAction, setEditingAction] = useState<SmartAction | null>(null);
  const [emailTemplates, setEmailTemplates] = useState<Record<string, EmailTemplate>>({});
  const [showEmptyJobWarning, setShowEmptyJobWarning] = useState(false);
  
  const { userRole, isTradie, isSolo, actionPermissions } = useAppMode();
  const { data: businessSettings } = useBusinessSettings();

  const { data: job, isLoading: jobLoading, error: jobError } = useQuery<Job>({
    queryKey: ['/api/jobs', jobId],
  });

  const { data: client, isLoading: clientLoading } = useQuery<Client>({
    queryKey: ['/api/clients', job?.clientId],
    enabled: !!job?.clientId,
  });

  const { data: currentUser } = useQuery<User>({
    queryKey: ['/api/auth/me'],
  });

  // Fetch linked quote/invoice for this job using dedicated endpoint
  interface LinkedDocumentsResponse {
    linkedQuote: LinkedDocument | null;
    linkedInvoice: LinkedDocument | null;
    quoteCount: number;
    invoiceCount: number;
  }
  
  const { data: linkedDocuments } = useQuery<LinkedDocumentsResponse>({
    queryKey: ['/api/jobs', jobId, 'linked-documents'],
    queryFn: async () => {
      const res = await fetch(`/api/jobs/${jobId}/linked-documents`, { credentials: 'include' });
      if (!res.ok) {
        if (res.status === 401) return { linkedQuote: null, linkedInvoice: null, quoteCount: 0, invoiceCount: 0 };
        throw new Error('Failed to fetch linked documents');
      }
      return res.json();
    },
    enabled: !!currentUser && !!jobId,
    staleTime: 30000,
  });

  const linkedQuote = linkedDocuments?.linkedQuote;
  const linkedInvoice = linkedDocuments?.linkedInvoice;

  // Fetch team members for assignment (only for owners/managers)
  const { data: teamMembers = [] } = useQuery<TeamMember[]>({
    queryKey: ['/api/team/members'],
    enabled: !isTradie && !isSolo,
  });

  // Fetch job photos to check if job has documentation
  const { data: jobPhotos = [] } = useQuery<{ id: string }[]>({
    queryKey: ['/api/jobs', jobId, 'photos'],
    enabled: !!jobId && job?.status === 'in_progress',
  });

  // Fetch time entries for this job
  const { data: timeEntries = [] } = useQuery<{ id: string; endTime?: string }[]>({
    queryKey: ['/api/time-entries', { jobId }],
    queryFn: async () => {
      const res = await fetch(`/api/time-entries?jobId=${jobId}`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!jobId && job?.status === 'in_progress',
  });

  // Fetch voice notes for this job
  const { data: voiceNotes = [] } = useQuery<{ id: string }[]>({
    queryKey: ['/api/jobs', jobId, 'voice-notes'],
    enabled: !!jobId && job?.status === 'in_progress',
  });

  // Fetch signatures for this job
  const { data: signatures = [] } = useQuery<{ id: string }[]>({
    queryKey: ['/api/jobs', jobId, 'signatures'],
    enabled: !!jobId && job?.status === 'in_progress',
  });

  // Check if job is "empty" (no documentation)
  const isEmptyJob = () => {
    const hasPhotos = jobPhotos.length > 0;
    const hasNotes = job?.notes && job.notes.trim().length > 0;
    // Count ANY time entries (active or completed) - not just completed ones
    const hasTimeTracked = timeEntries.length > 0;
    const hasSignatures = signatures.length > 0;
    const hasVoiceNotes = voiceNotes.length > 0;
    return !hasPhotos && !hasNotes && !hasTimeTracked && !hasSignatures && !hasVoiceNotes;
  };

  // Handler for completing job with empty job guardrail
  const handleCompleteJob = () => {
    if (isEmptyJob()) {
      setShowEmptyJobWarning(true);
    } else {
      updateJobMutation.mutate({ status: 'done' });
    }
  };

  const confirmCompleteEmptyJob = () => {
    setShowEmptyJobWarning(false);
    updateJobMutation.mutate({ status: 'done' });
  };

  // Assign worker mutation
  const assignWorkerMutation = useMutation({
    mutationFn: async (assignedTo: string | null) => {
      return await apiRequest("PATCH", `/api/jobs/${jobId}`, { assignedTo });
    },
    onSuccess: (_data, assignedTo) => {
      // Invalidate all job-related queries to ensure sync across views
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs/my-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs/today'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/kpis'] });
      toast({
        title: assignedTo ? "Worker Assigned" : "Worker Unassigned",
        description: assignedTo 
          ? "Job has been assigned successfully" 
          : "Worker has been removed from this job",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update job assignment",
        variant: "destructive",
      });
    },
  });

  const updateJobMutation = useMutation({
    mutationFn: async (data: { status: string }) => {
      // Staff tradies use the status-specific endpoint (which only allows status updates on assigned jobs)
      // Owners and managers use the full update endpoint
      const endpoint = isTradie 
        ? `/api/jobs/${jobId}/status`
        : `/api/jobs/${jobId}`;
      return await apiRequest("PATCH", endpoint, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'linked-documents'] });
      toast({
        title: "Job Updated",
        description: "Job status has been updated",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update job",
        variant: "destructive",
      });
    },
  });

  const isLoading = jobLoading || clientLoading;

  // Initialize smart actions when job and client are loaded
  const initializeSmartActions = () => {
    if (job && client) {
      const actions = getJobSmartActions(job, client, linkedQuote, linkedInvoice);
      setSmartActions(actions);
      setShowSmartActions(true);
    }
  };

  const handleActionToggle = (actionId: string, enabled: boolean) => {
    setSmartActions(prev => prev.map(a => 
      a.id === actionId ? { ...a, enabled } : a
    ));
  };

  const handleActionPreview = (actionId: string) => {
    const action = smartActions.find(a => a.id === actionId);
    if (action) {
      toast({
        title: `Preview: ${action.title}`,
        description: action.preview?.message || action.description,
      });
    }
  };

  const handleActionEdit = (actionId: string) => {
    const action = smartActions.find(a => a.id === actionId);
    if (action && (action.type === 'send_email' || action.type === 'send_confirmation')) {
      setEditingAction(action);
      setEmailEditorOpen(true);
    } else {
      toast({
        title: "Edit Action",
        description: "This action type doesn't have an editable template",
      });
    }
  };

  const handleSaveEmailTemplate = (template: EmailTemplate) => {
    if (editingAction) {
      setEmailTemplates(prev => ({
        ...prev,
        [editingAction.id]: template
      }));
      
      setSmartActions(prev => prev.map(a => 
        a.id === editingAction.id 
          ? { 
              ...a, 
              preview: {
                ...a.preview,
                subject: template.subject,
                message: template.body,
              }
            } 
          : a
      ));
      
      setEditingAction(null);
    }
  };

  const handleExecuteActions = async () => {
    setIsExecutingActions(true);
    const enabledActions = smartActions.filter(a => a.enabled && !a.missingRequirements?.length);
    
    for (const action of enabledActions) {
      setSmartActions(prev => prev.map(a => 
        a.id === action.id ? { ...a, status: 'running' } : a
      ));

      try {
        if (action.type === 'create_invoice') {
          navigate(`/invoices/new?jobId=${jobId}`);
          setSmartActions(prev => prev.map(a => 
            a.id === action.id ? { ...a, status: 'completed' } : a
          ));
        } else if (action.type === 'send_email' || action.type === 'send_confirmation') {
          setSmartActions(prev => prev.map(a => 
            a.id === action.id ? { ...a, status: 'completed' } : a
          ));
        }
      } catch (error) {
        setSmartActions(prev => prev.map(a => 
          a.id === action.id ? { ...a, status: 'suggested' } : a
        ));
      }
    }

    setIsExecutingActions(false);
  };

  const handleSkipAll = () => {
    setSmartActions(prev => prev.map(a => ({ ...a, enabled: false, status: 'skipped' })));
    setShowSmartActions(false);
    toast({
      title: "Actions skipped",
      description: "You can always do these later from the job details",
    });
  };

  if (isLoading) {
    return (
      <PageShell data-testid="job-detail-loading">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="animate-pulse">
            <div className="h-6 w-48 bg-muted rounded mb-2" />
            <div className="h-4 w-32 bg-muted rounded" />
          </div>
        </div>
      </PageShell>
    );
  }

  if (jobError || !job) {
    return (
      <PageShell data-testid="job-detail-error">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">Job Not Found</h1>
            <p className="text-sm text-muted-foreground">This job may have been deleted</p>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell data-testid="job-detail-view">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">{job.title}</h1>
            {client?.name && (
              <span 
                className="text-sm text-muted-foreground hover:underline cursor-pointer"
                onClick={() => job.clientId && onViewClient?.(job.clientId)}
                data-testid="link-client"
              >
                {client.name}
              </span>
            )}
          </div>
        </div>

      </div>

      <div className="space-y-4">
        <JobFlowWizard
          status={job.status}
          hasQuote={!!linkedQuote}
          hasInvoice={!!linkedInvoice}
          invoicePaid={linkedInvoice?.status === 'paid'}
          onCreateQuote={() => onCreateQuote?.(jobId)}
          onViewQuote={() => linkedQuote && navigate(`/quotes/${linkedQuote.id}`)}
          onSchedule={() => onEditJob?.(jobId)}
          onStart={() => updateJobMutation.mutate({ status: 'in_progress' })}
          onComplete={handleCompleteJob}
          onCreateInvoice={() => onCreateInvoice?.(jobId)}
          onViewInvoice={() => linkedInvoice && navigate(`/invoices/${linkedInvoice.id}`)}
          data-testid="job-flow-wizard"
        />


        {!isTradie && (
          <LinkedDocumentsCard
            linkedQuote={linkedQuote}
            linkedInvoice={linkedInvoice}
            jobStatus={job.status}
            onViewQuote={(id) => navigate(`/quotes/${id}`)}
            onViewInvoice={(id) => navigate(`/invoices/${id}`)}
            onCreateQuote={() => onCreateQuote?.(jobId)}
            onCreateInvoice={() => onCreateInvoice?.(jobId)}
          />
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              Job Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {job.description && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Description</p>
                <p className="text-sm">{job.description}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 text-sm">
              {client?.name && (
                <div>
                  <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1">
                    <User className="h-3 w-3" />
                    Client
                  </div>
                  <p 
                    className="font-medium hover:underline cursor-pointer"
                    onClick={() => job.clientId && onViewClient?.(job.clientId)}
                    data-testid="client-name"
                  >
                    {client.name}
                  </p>
                </div>
              )}

              {job.address && (
                <div>
                  <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1">
                    <MapPin className="h-3 w-3" />
                    Address
                  </div>
                  <p className="font-medium">{job.address}</p>
                </div>
              )}

              {job.scheduledAt && (
                <div>
                  <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1">
                    <Calendar className="h-3 w-3" />
                    Scheduled
                  </div>
                  <p className="font-medium">
                    {format(new Date(job.scheduledAt), 'MMM d, yyyy')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(job.scheduledAt), 'h:mm a')}
                  </p>
                </div>
              )}

            </div>

            {/* Assign Worker - Only for team owners/managers */}
            {!isTradie && !isSolo && teamMembers.length > 0 && (
              <div className="pt-2 border-t">
                <div className="flex items-center gap-1 text-muted-foreground text-xs mb-2">
                  <Users className="h-3 w-3" />
                  Assign Worker
                </div>
                <Select
                  value={job.assignedTo || "unassigned"}
                  onValueChange={(value) => {
                    assignWorkerMutation.mutate(value === "unassigned" ? null : value);
                  }}
                  disabled={assignWorkerMutation.isPending}
                >
                  <SelectTrigger 
                    className="w-full" 
                    data-testid="select-assign-worker"
                  >
                    <SelectValue placeholder="Select worker..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">
                      Unassigned
                    </SelectItem>
                    {teamMembers.filter(m => m.isActive).map((member) => (
                      <SelectItem 
                        key={member.memberId} 
                        value={member.memberId}
                        data-testid={`option-worker-${member.memberId}`}
                      >
                        {member.firstName} {member.lastName} ({member.roleName})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {job.estimatedHours && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Estimated Hours</p>
                <p className="text-sm">{job.estimatedHours} hours</p>
              </div>
            )}

            {job.estimatedCost && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Estimated Cost</p>
                <p className="text-sm">${(Number(job.estimatedCost) / 100).toFixed(2)}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {job.notes && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{job.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Time Tracking Widget - Show for in_progress jobs */}
        {job.status === 'in_progress' && (
          <Card data-testid="card-time-tracking">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Timer className="h-4 w-4" />
                Time Tracking
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TimerWidget 
                jobId={jobId} 
                jobTitle={job.title}
              />
            </CardContent>
          </Card>
        )}

        {/* Geofence Time Tracking Settings - Only show for owners/managers */}
        {!isTradie && (
          <GeofenceSettingsCard
            jobId={jobId}
            hasLocation={!!(job.latitude && job.longitude)}
            geofenceEnabled={job.geofenceEnabled}
            geofenceRadius={job.geofenceRadius}
            geofenceAutoClockIn={job.geofenceAutoClockIn}
            geofenceAutoClockOut={job.geofenceAutoClockOut}
          />
        )}

        {/* Linked Documents Section - Shows quote/invoice status */}
        {(linkedQuote || linkedInvoice) && (
          <Card data-testid="card-linked-documents">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Linked Documents
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {linkedQuote && (
                <button
                  onClick={() => navigate(`/quotes/${linkedQuote.id}`)}
                  className="w-full p-3 rounded-lg border hover:border-primary/50 hover:bg-accent/50 transition-all text-left"
                  data-testid="button-view-linked-quote"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">
                        Quote #{linkedQuote.quoteNumber}
                      </span>
                      <Badge 
                        variant="secondary" 
                        className={`text-xs ${
                          linkedQuote.status === 'accepted' 
                            ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' 
                            : linkedQuote.status === 'sent'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                        }`}
                      >
                        {linkedQuote.status === 'accepted' ? 'Accepted' : 
                         linkedQuote.status === 'sent' ? 'Sent' : 'Draft'}
                      </Badge>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {linkedQuote.title} • ${parseFloat(linkedQuote.total || '0').toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                  </p>
                </button>
              )}

              {linkedInvoice && (
                <button
                  onClick={() => navigate(`/invoices/${linkedInvoice.id}`)}
                  className="w-full p-3 rounded-lg border hover:border-primary/50 hover:bg-accent/50 transition-all text-left"
                  data-testid="button-view-linked-invoice"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Receipt className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">
                        Invoice #{linkedInvoice.invoiceNumber}
                      </span>
                      <Badge 
                        variant="secondary" 
                        className={`text-xs ${
                          linkedInvoice.status === 'paid' 
                            ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' 
                            : linkedInvoice.status === 'sent'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                            : linkedInvoice.status === 'overdue'
                            ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                        }`}
                      >
                        {linkedInvoice.status === 'paid' ? 'Paid' : 
                         linkedInvoice.status === 'sent' ? 'Sent' : 
                         linkedInvoice.status === 'overdue' ? 'Overdue' : 'Draft'}
                      </Badge>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {linkedInvoice.title} • ${parseFloat(linkedInvoice.total || '0').toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                  </p>
                </button>
              )}

              {/* Prominent CTA: Create Invoice from Accepted Quote - hidden for staff tradies */}
              {linkedQuote?.status === 'accepted' && !linkedInvoice && !isTradie && (
                <Button
                  onClick={() => navigate(`/invoices/new?quoteId=${linkedQuote.id}&jobId=${jobId}`)}
                  className="w-full mt-2 text-white"
                  style={{ backgroundColor: 'hsl(var(--trade))' }}
                  data-testid="button-create-invoice-from-quote"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Create Invoice from Accepted Quote
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Photos - only show for in_progress, done, invoiced jobs */}
        {(job.status === 'in_progress' || job.status === 'done' || job.status === 'invoiced') ? (
          <JobPhotoGallery jobId={jobId} canUpload={job.status !== 'invoiced'} />
        ) : (
          <Card>
            <CardContent className="py-6">
              <div className="text-center text-muted-foreground">
                <Camera className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">
                  Photos can be added once the job is started
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Voice Notes - only show for in_progress, done, invoiced jobs */}
        {(job.status === 'in_progress' || job.status === 'done' || job.status === 'invoiced') ? (
          <JobVoiceNotes jobId={jobId} canUpload={job.status !== 'invoiced'} />
        ) : (
          <Card>
            <CardContent className="py-6">
              <div className="text-center text-muted-foreground">
                <Mic className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">
                  Voice notes can be added once the job is started
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Custom Forms - available for in_progress, done, invoiced jobs */}
        {(job.status === 'in_progress' || job.status === 'done' || job.status === 'invoiced') ? (
          <Card>
            <CardContent className="pt-4">
              <JobForms jobId={jobId} />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-6">
              <div className="text-center text-muted-foreground">
                <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">
                  Forms can be filled once the job is started
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Client Signature - show for in_progress (for capturing before completion), done and invoiced jobs */}
        {(job.status === 'in_progress' || job.status === 'done' || job.status === 'invoiced') && (
          <JobSignature jobId={jobId} />
        )}

        {/* Job Discussion - only show for team mode (not solo owners) */}
        {currentUser && !isSolo && (
          <JobChat 
            jobId={jobId} 
            currentUserId={currentUser.id}
          />
        )}

        {/* Action Buttons - follows 5-stage workflow: pending → scheduled → in_progress → done → invoiced */}
        <div className="flex flex-col gap-2 pt-2">
          {/* Pending → Schedule */}
          {job.status === 'pending' && (
            <Button
              onClick={() => updateJobMutation.mutate({ status: 'scheduled' })}
              disabled={updateJobMutation.isPending}
              data-testid="button-schedule-job"
              className="w-full text-white"
              style={{ backgroundColor: 'hsl(var(--trade))' }}
            >
              <Calendar className="h-4 w-4 mr-2" />
              {updateJobMutation.isPending ? 'Scheduling...' : 'Schedule Job'}
            </Button>
          )}

          {/* Scheduled → Start (Begin work on site) */}
          {job.status === 'scheduled' && (
            <Button
              onClick={() => updateJobMutation.mutate({ status: 'in_progress' })}
              disabled={updateJobMutation.isPending}
              data-testid="button-start-job"
              className="w-full text-white"
              style={{ backgroundColor: 'hsl(var(--trade))' }}
            >
              <Clock className="h-4 w-4 mr-2" />
              {updateJobMutation.isPending ? 'Starting...' : 'Start Job'}
            </Button>
          )}

          {/* In Progress → Complete (Finish work) */}
          {job.status === 'in_progress' && onCompleteJob && (
            <Button
              onClick={() => onCompleteJob(jobId)}
              data-testid="button-complete-job"
              className="w-full text-white"
              style={{ backgroundColor: 'hsl(var(--trade))' }}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Go Complete Job
            </Button>
          )}

          {/* Done → Smart Actions or Create Quote/Invoice (hidden for staff) */}
          {job.status === 'done' && !isTradie && (
            <>
              {showSmartActions && smartActions.length > 0 ? (
                <SmartActionsPanel
                  title="What's Next?"
                  subtitle="Choose your next steps - you control what happens"
                  actions={smartActions}
                  onActionToggle={handleActionToggle}
                  onActionPreview={handleActionPreview}
                  onActionEdit={handleActionEdit}
                  onExecuteAll={handleExecuteActions}
                  onSkipAll={handleSkipAll}
                  isExecuting={isExecutingActions}
                  entityType="job"
                  entityStatus={job.status}
                />
              ) : (
                <div className="space-y-2">
                  <Button
                    onClick={initializeSmartActions}
                    className="w-full"
                    variant="outline"
                    data-testid="button-show-smart-actions"
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    See Suggested Actions
                  </Button>
                  <div className="flex gap-2">
                    {onCreateQuote && (
                      <Button
                        variant="outline"
                        onClick={() => onCreateQuote(jobId)}
                        data-testid="button-create-quote"
                        className="flex-1"
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Quote
                      </Button>
                    )}
                    {onCreateInvoice && (
                      <Button
                        variant="outline"
                        onClick={() => onCreateInvoice(jobId)}
                        data-testid="button-create-invoice"
                        className="flex-1"
                      >
                        <Receipt className="h-4 w-4 mr-2" />
                        Invoice
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
          
          {/* Staff tradie sees confirmation when job is done */}
          {job.status === 'done' && isTradie && (
            <div className="text-center text-sm text-muted-foreground py-2">
              Job marked as complete
            </div>
          )}

          {/* Invoiced - Show status only */}
          {job.status === 'invoiced' && (
            <div className="text-center text-sm text-muted-foreground py-2">
              This job has been invoiced
            </div>
          )}
        </div>
      </div>

      {/* Email Template Editor Dialog */}
      {editingAction && (
        <EmailTemplateEditor
          isOpen={emailEditorOpen}
          onClose={() => {
            setEmailEditorOpen(false);
            setEditingAction(null);
          }}
          onSave={handleSaveEmailTemplate}
          actionType={editingAction.type === 'send_confirmation' ? 'confirmation' : 'invoice'}
          initialSubject={emailTemplates[editingAction.id]?.subject || editingAction.preview?.subject}
          initialBody={emailTemplates[editingAction.id]?.body || editingAction.preview?.message}
          recipientEmail={editingAction.preview?.recipient || client?.email}
          recipientName={client?.name || 'Client'}
          mergeFields={[
            { key: 'jobTitle', label: 'Job Title', value: job?.title || 'Job' },
            { key: 'total', label: 'Total', value: linkedQuote?.total ? `$${parseFloat(linkedQuote.total).toFixed(2)}` : 'TBA' },
            { key: 'invoiceNumber', label: 'Invoice #', value: linkedInvoice?.invoiceNumber || 'TBA' },
            { key: 'quoteNumber', label: 'Quote #', value: linkedQuote?.quoteNumber || 'TBA' },
            { key: 'scheduledDate', label: 'Scheduled Date', value: job?.scheduledAt ? format(new Date(job.scheduledAt), 'dd/MM/yyyy') : 'TBA' },
            { key: 'dueDate', label: 'Due Date', value: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString('en-AU') },
          ]}
          businessName={businessSettings?.businessName || 'Your Business'}
        />
      )}

      {/* Empty Job Warning Dialog */}
      <AlertDialog open={showEmptyJobWarning} onOpenChange={setShowEmptyJobWarning}>
        <AlertDialogContent data-testid="dialog-empty-job-warning">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Complete Job?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This job has no photos, notes, time tracked, or signatures. Are you sure you want to mark it as complete?
              <br /><br />
              Consider adding documentation before completing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-complete">Go Back</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmCompleteEmptyJob}
              className="bg-amber-600 hover:bg-amber-700"
              data-testid="button-confirm-complete-anyway"
            >
              Complete Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
