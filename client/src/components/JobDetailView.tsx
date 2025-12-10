import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Briefcase, User, MapPin, Calendar, Clock, CheckCircle, Edit, FileText, Receipt, MoreVertical, Camera, ExternalLink, Sparkles, Zap, Mic, ClipboardList, Users } from "lucide-react";
import { useLocation } from "wouter";
import JobPhotoGallery from "./JobPhotoGallery";
import { JobVoiceNotes } from "./JobVoiceNotes";
import { JobSignature } from "./JobSignature";
import { JobForms } from "./CustomFormRenderer";
import { JobChat } from "./JobChat";
import SmartActionsPanel, { getJobSmartActions, SmartAction } from "./SmartActionsPanel";
import EmailTemplateEditor, { EmailTemplate } from "./EmailTemplateEditor";
import GeofenceSettingsCard from "./GeofenceSettingsCard";
import { useBusinessSettings } from "@/hooks/use-business-settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageShell } from "@/components/ui/page-shell";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  quoteNumber?: string;
  invoiceNumber?: string;
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

  // Fetch linked quote/invoice for this job from contextual endpoint
  // Uses the same queryKey pattern as the contextual jobs list for proper cache sharing
  const { data: contextualJobs } = useQuery<JobWithLinks[]>({
    queryKey: ['/api/jobs/contextual'],
    queryFn: async () => {
      const res = await fetch('/api/jobs/contextual', { credentials: 'include' });
      if (!res.ok) {
        if (res.status === 401) return []; // Handle unauthenticated gracefully
        throw new Error('Failed to fetch contextual jobs');
      }
      return res.json();
    },
    enabled: !!currentUser, // Only fetch when authenticated
    staleTime: 30000,
  });

  // Find the current job from contextual data
  const currentJobWithLinks = contextualJobs?.find((j: any) => j.id === jobId);
  const linkedQuote = currentJobWithLinks?.linkedQuote;
  const linkedInvoice = currentJobWithLinks?.linkedInvoice;

  // Fetch team members for assignment (only for owners/managers)
  const { data: teamMembers = [] } = useQuery<TeamMember[]>({
    queryKey: ['/api/team/members'],
    enabled: !isTradie && !isSolo,
  });

  // Assign worker mutation
  const assignWorkerMutation = useMutation({
    mutationFn: async (assignedTo: string | null) => {
      return await apiRequest("PATCH", `/api/jobs/${jobId}`, { assignedTo });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      toast({
        title: "Worker Assigned",
        description: "Job has been assigned successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to assign worker",
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
      queryClient.invalidateQueries({ queryKey: ['/api/jobs/contextual'] });
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" data-testid="badge-status-pending">Pending</Badge>;
      case 'scheduled':
        return <Badge variant="default" className="bg-blue-500" data-testid="badge-status-scheduled">Scheduled</Badge>;
      case 'in_progress':
        return <Badge variant="default" className="bg-amber-500" data-testid="badge-status-in-progress">In Progress</Badge>;
      case 'done':
        return <Badge variant="default" className="bg-green-500" data-testid="badge-status-done">Completed</Badge>;
      case 'invoiced':
        return <Badge variant="default" className="bg-purple-500" data-testid="badge-status-invoiced">Invoiced</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
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
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {client?.name && (
                <span 
                  className="hover:underline cursor-pointer"
                  onClick={() => job.clientId && onViewClient?.(job.clientId)}
                  data-testid="link-client"
                >
                  {client.name}
                </span>
              )}
              {getStatusBadge(job.status)}
            </div>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" data-testid="button-job-actions">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onEditJob && !isTradie && (
              <DropdownMenuItem onClick={() => onEditJob(jobId)} data-testid="menu-edit-job">
                <Edit className="h-4 w-4 mr-2" />
                Edit Job
              </DropdownMenuItem>
            )}
            {job.status !== 'done' && onCompleteJob && (
              <DropdownMenuItem onClick={() => onCompleteJob(jobId)} data-testid="menu-complete-job">
                <CheckCircle className="h-4 w-4 mr-2" />
                Go Complete Job
              </DropdownMenuItem>
            )}
            {onCreateQuote && !isTradie && (
              <DropdownMenuItem onClick={() => onCreateQuote(jobId)} data-testid="menu-create-quote">
                <FileText className="h-4 w-4 mr-2" />
                Create Quote
              </DropdownMenuItem>
            )}
            {onCreateInvoice && !isTradie && (
              <DropdownMenuItem onClick={() => onCreateInvoice(jobId)} data-testid="menu-create-invoice">
                <Receipt className="h-4 w-4 mr-2" />
                Create Invoice
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="space-y-4">
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

              <div>
                <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1">
                  <Clock className="h-3 w-3" />
                  Status
                </div>
                <div>{getStatusBadge(job.status)}</div>
              </div>
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

              {/* Prominent CTA: Create Invoice from Accepted Quote */}
              {linkedQuote?.status === 'accepted' && !linkedInvoice && (
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

        {/* Client Signature - only show for done or invoiced jobs */}
        {(job.status === 'done' || job.status === 'invoiced') && (
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
    </PageShell>
  );
}
