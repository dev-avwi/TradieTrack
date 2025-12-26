import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Briefcase, User, MapPin, Calendar, Clock, Edit, FileText, Receipt, Camera, ExternalLink, Sparkles, Zap, Mic, ClipboardList, Users, Timer, CheckCircle, AlertTriangle, Loader2, PenLine, Trash2, Play, Square, Navigation, History, Mail, MessageSquare, CreditCard, Send, Bell, Plus, CheckCircle2 } from "lucide-react";
import { TimerWidget } from "./TimeTracking";
import { useLocation, useSearch } from "wouter";
import { getJobUrgency, getInProgressDuration } from "@/lib/jobUrgency";
import JobPhotoGallery from "./JobPhotoGallery";
import { JobVoiceNotes } from "./JobVoiceNotes";
import { JobDocuments } from "./JobDocuments";
import { JobSignature } from "./JobSignature";
import { AIPhotoAnalysis } from "./AIPhotoAnalysis";
import { JobForms } from "./CustomFormRenderer";
import { SafetyFormsSection, SafetyCheckDialog } from "./SafetyFormsSection";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { formatHistoryDate } from "@shared/dateUtils";
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
  startedAt?: string;
  completedAt?: string;
  invoicedAt?: string;
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
  const searchString = useSearch();
  const chatSectionRef = useRef<HTMLDivElement>(null);
  const [showSmartActions, setShowSmartActions] = useState(false);
  const [smartActions, setSmartActions] = useState<SmartAction[]>([]);
  const [isExecutingActions, setIsExecutingActions] = useState(false);
  const [emailEditorOpen, setEmailEditorOpen] = useState(false);
  const [editingAction, setEditingAction] = useState<SmartAction | null>(null);
  const [emailTemplates, setEmailTemplates] = useState<Record<string, EmailTemplate>>({});
  const [showEmptyJobWarning, setShowEmptyJobWarning] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [editedNotes, setEditedNotes] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSafetyCheck, setShowSafetyCheck] = useState(false);
  const [showRollbackConfirm, setShowRollbackConfirm] = useState(false);
  const [rollbackTargetStatus, setRollbackTargetStatus] = useState<JobStatus | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Update current time every second for live timer display
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  
  // Check for tab=chat in URL to scroll to chat section
  const shouldScrollToChat = searchString?.includes('tab=chat');
  
  // Scroll to chat section when navigating from Chat Hub with tab=chat
  useEffect(() => {
    if (shouldScrollToChat && chatSectionRef.current) {
      // Small delay to ensure the section is rendered
      setTimeout(() => {
        chatSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
  }, [shouldScrollToChat]);
  
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
  interface LinkedReceipt {
    id: string;
    receiptNumber: string;
    amount: string;
    gstAmount: string | null;
    paymentMethod: string | null;
    paidAt: string | null;
    pdfUrl: string | null;
    createdAt: string;
  }
  
  interface LinkedDocumentsResponse {
    linkedQuote: LinkedDocument | null;
    linkedInvoice: LinkedDocument | null;
    linkedReceipts: LinkedReceipt[];
    quoteCount: number;
    invoiceCount: number;
    receiptCount: number;
  }
  
  const { data: linkedDocuments } = useQuery<LinkedDocumentsResponse>({
    queryKey: ['/api/jobs', jobId, 'linked-documents'],
    queryFn: async () => {
      const res = await fetch(`/api/jobs/${jobId}/linked-documents`, { credentials: 'include' });
      if (!res.ok) {
        if (res.status === 401) return { linkedQuote: null, linkedInvoice: null, linkedReceipts: [], quoteCount: 0, invoiceCount: 0, receiptCount: 0 };
        throw new Error('Failed to fetch linked documents');
      }
      return res.json();
    },
    enabled: !!currentUser && !!jobId,
    staleTime: 30000,
  });

  const linkedQuote = linkedDocuments?.linkedQuote;
  const linkedInvoice = linkedDocuments?.linkedInvoice;
  const linkedReceipts = linkedDocuments?.linkedReceipts || [];

  // Fetch team members for assignment (only for owners/managers)
  const { data: teamMembers = [] } = useQuery<TeamMember[]>({
    queryKey: ['/api/team/members'],
    enabled: !isTradie && !isSolo,
  });

  // Fetch job photos - enable for all job statuses to support team sync
  const { data: jobPhotos = [] } = useQuery<{ id: string }[]>({
    queryKey: ['/api/jobs', jobId, 'photos'],
    enabled: !!jobId,
  });

  // Fetch time entries for this job - only for active jobs where time tracking applies
  const { data: timeEntries = [] } = useQuery<{ id: string; endTime?: string }[]>({
    queryKey: ['/api/time-entries', { jobId }],
    queryFn: async () => {
      const res = await fetch(`/api/time-entries?jobId=${jobId}`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!jobId,
  });

  // Fetch voice notes - enable for all job statuses to support team sync
  const { data: voiceNotes = [] } = useQuery<{ id: string }[]>({
    queryKey: ['/api/jobs', jobId, 'voice-notes'],
    enabled: !!jobId,
  });

  // Fetch signatures - enable for all job statuses to support team sync
  const { data: signatures = [] } = useQuery<{ id: string }[]>({
    queryKey: ['/api/jobs', jobId, 'signatures'],
    enabled: !!jobId,
  });

  // Activity feed types and styling
  interface JobActivityItem {
    id: string;
    type: string;
    title: string;
    description: string;
    timestamp: string;
    status: 'success' | 'pending' | 'failed';
    entityType?: 'job' | 'quote' | 'invoice' | null;
    entityId?: string | null;
    metadata?: Record<string, any>;
  }

  const activityIcons: Record<string, typeof Mail> = {
    email_sent: Mail,
    sms_sent: MessageSquare,
    payment_received: CreditCard,
    quote_sent: FileText,
    invoice_sent: Send,
    reminder_sent: Bell,
    quote_accepted: CheckCircle2,
    job_scheduled: Clock,
    job_started: Clock,
    job_completed: CheckCircle2,
    job_created: Briefcase,
    job_status_changed: Briefcase,
    quote_created: Plus,
    invoice_created: Plus,
    invoice_paid: CreditCard,
  };

  const activityColors: Record<string, { bg: string; icon: string }> = {
    email_sent: { bg: 'hsl(210 80% 52% / 0.1)', icon: 'hsl(210 80% 52%)' },
    sms_sent: { bg: 'hsl(280 65% 60% / 0.1)', icon: 'hsl(280 65% 60%)' },
    payment_received: { bg: 'hsl(145 65% 45% / 0.1)', icon: 'hsl(145 65% 45%)' },
    quote_sent: { bg: 'hsl(35 90% 55% / 0.1)', icon: 'hsl(35 90% 55%)' },
    invoice_sent: { bg: 'hsl(5 85% 55% / 0.1)', icon: 'hsl(5 85% 55%)' },
    reminder_sent: { bg: 'hsl(25 90% 55% / 0.1)', icon: 'hsl(25 90% 55%)' },
    quote_accepted: { bg: 'hsl(145 65% 45% / 0.1)', icon: 'hsl(145 65% 45%)' },
    job_scheduled: { bg: 'hsl(210 80% 52% / 0.1)', icon: 'hsl(210 80% 52%)' },
    job_started: { bg: 'hsl(35 90% 55% / 0.1)', icon: 'hsl(35 90% 55%)' },
    job_completed: { bg: 'hsl(145 65% 45% / 0.1)', icon: 'hsl(145 65% 45%)' },
    job_created: { bg: 'hsl(210 80% 52% / 0.1)', icon: 'hsl(210 80% 52%)' },
    job_status_changed: { bg: 'hsl(35 90% 55% / 0.1)', icon: 'hsl(35 90% 55%)' },
    quote_created: { bg: 'hsl(35 90% 55% / 0.1)', icon: 'hsl(35 90% 55%)' },
    invoice_created: { bg: 'hsl(5 85% 55% / 0.1)', icon: 'hsl(5 85% 55%)' },
    invoice_paid: { bg: 'hsl(145 65% 45% / 0.1)', icon: 'hsl(145 65% 45%)' },
  };

  // Fetch job-specific activity history
  const { data: jobActivities = [], isLoading: activitiesLoading } = useQuery<JobActivityItem[]>({
    queryKey: ['/api/jobs', jobId, 'activity'],
    queryFn: async () => {
      const res = await fetch(`/api/jobs/${jobId}/activity?limit=10`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!currentUser && !!jobId,
    staleTime: 30000,
  });

  // Fetch active timer to check if timer is running for this job
  const { data: globalActiveTimer } = useQuery<{ id: string; jobId?: string; startTime: string; description?: string } | null>({
    queryKey: ['/api/time-entries/active/current'],
    refetchInterval: 1000,
  });

  const activeTimerForThisJob = globalActiveTimer && globalActiveTimer.jobId === jobId ? globalActiveTimer : null;

  // Auto-start timer mutation
  const startTimerMutation = useMutation({
    mutationFn: async (data: { description: string; jobId: string; hourlyRate?: string }) => {
      return apiRequest('POST', '/api/time-entries', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/time-entries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/time-entries/active/current'] });
      queryClient.invalidateQueries({ queryKey: ['/api/time-tracking/dashboard'] });
      toast({
        title: "Timer Started",
        description: "Time tracking has begun automatically",
      });
    },
    onError: (error: any) => {
      console.error('Auto-start timer error:', error);
    },
  });

  // Stop timer mutation
  const stopTimerMutation = useMutation({
    mutationFn: async (timerId: string) => {
      return apiRequest('POST', `/api/time-entries/${timerId}/stop`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/time-entries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/time-entries/active/current'] });
      queryClient.invalidateQueries({ queryKey: ['/api/time-tracking/dashboard'] });
      toast({
        title: "Time Saved",
        description: "Your time has been recorded",
      });
    },
  });

  // Helper to get elapsed time string
  const getElapsedTime = (startTime: string) => {
    const start = new Date(startTime);
    const diffMs = currentTime.getTime() - start.getTime();
    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Calculate job urgency for scheduled jobs
  const jobUrgency = job ? getJobUrgency(job.scheduledAt, job.status) : null;

  // Fetch safety form submissions to check if safety forms have been completed
  interface FormSubmissionWithForm {
    id: string;
    formId: string;
    status: string;
    submissionData: Record<string, any>;
  }
  
  const { data: formSubmissions = [] } = useQuery<FormSubmissionWithForm[]>({
    queryKey: ['/api/jobs', jobId, 'form-submissions'],
    enabled: !!jobId,
  });

  const { data: customForms = [] } = useQuery<{ id: string; formType: string; requiresSignature: boolean }[]>({
    queryKey: ['/api/custom-forms'],
    enabled: !!jobId,
  });

  // Check if any safety forms exist and if any are completed
  const safetyForms = customForms.filter(f => 
    f.formType === 'safety' || f.formType === 'compliance' || f.formType === 'inspection'
  );
  
  const hasSafetyForms = safetyForms.length > 0;
  
  const safetyFormSubmissions = formSubmissions.filter(s => {
    const form = customForms.find(f => f.id === s.formId);
    return form && (form.formType === 'safety' || form.formType === 'compliance' || form.formType === 'inspection');
  });
  
  const hasCompletedSafetyForm = safetyFormSubmissions.length > 0;

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

  // Save notes mutation - allows tradies to update notes during job
  const saveNotesMutation = useMutation({
    mutationFn: async (notes: string) => {
      return await apiRequest("PATCH", `/api/jobs/${jobId}`, { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId] });
      setShowNotesModal(false);
      toast({
        title: "Notes Saved",
        description: "Your notes have been updated",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save notes",
        variant: "destructive",
      });
    },
  });

  const handleOpenNotesModal = () => {
    setEditedNotes(job?.notes || '');
    setShowNotesModal(true);
  };

  const handleSaveNotes = () => {
    saveNotesMutation.mutate(editedNotes);
  };

  // Delete job mutation
  const deleteJobMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", `/api/jobs/${jobId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/kpis'] });
      toast({
        title: "Job Deleted",
        description: "The job has been permanently deleted",
      });
      onBack();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete job",
        variant: "destructive",
      });
    },
  });

  const handleDeleteJob = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDeleteJob = () => {
    setShowDeleteConfirm(false);
    deleteJobMutation.mutate();
  };

  // On My Way mutation - sends SMS to client
  const onMyWayMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/jobs/${jobId}/on-my-way`);
    },
    onSuccess: () => {
      toast({
        title: "On My Way notification sent to client",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send notification",
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

        <div className="flex items-center gap-2">
          {onEditJob && (
            <Button variant="outline" size="icon" onClick={() => onEditJob(jobId)} data-testid="button-edit-job">
              <Edit className="h-4 w-4" />
            </Button>
          )}
          {!isTradie && (
            <Button 
              variant="outline" 
              size="icon" 
              onClick={handleDeleteJob}
              disabled={deleteJobMutation.isPending}
              data-testid="button-delete-job"
            >
              {deleteJobMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 text-destructive" />
              )}
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {/* Urgency Banner for scheduled jobs */}
        {job.status === 'scheduled' && jobUrgency && (
          <div 
            className={`rounded-xl p-4 border ${jobUrgency.bgColor} ${jobUrgency.animate ? 'animate-pulse' : ''}`}
            data-testid="banner-job-urgency"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${jobUrgency.level === 'overdue' ? 'bg-red-200 dark:bg-red-800' : jobUrgency.level === 'starting_soon' ? 'bg-orange-200 dark:bg-orange-800' : 'bg-blue-200 dark:bg-blue-800'}`}>
                  <Clock className={`h-5 w-5 ${jobUrgency.color}`} />
                </div>
                <div>
                  <p className={`font-semibold ${jobUrgency.color}`}>{jobUrgency.label}</p>
                  <p className="text-sm text-muted-foreground">
                    {jobUrgency.level === 'overdue' ? 'This job is past its scheduled time' : 'Ready to start?'}
                  </p>
                </div>
              </div>
              <Button
                onClick={() => setShowSafetyCheck(true)}
                disabled={updateJobMutation.isPending}
                className="text-white shrink-0"
                style={{ backgroundColor: 'hsl(var(--trade))' }}
                data-testid="button-quick-start"
              >
                <Play className="h-4 w-4 mr-2" />
                Start Now
              </Button>
            </div>
          </div>
        )}

        {/* Prominent Active Timer Banner for in_progress jobs */}
        {job.status === 'in_progress' && activeTimerForThisJob && (
          <div 
            className="rounded-xl overflow-hidden relative"
            style={{ backgroundColor: 'hsl(var(--trade) / 0.15)' }}
            data-testid="banner-active-timer"
          >
            <div 
              className="absolute inset-0 rounded-xl"
              style={{ 
                border: '2px solid hsl(var(--trade))',
                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
              }}
            />
            <div className="relative p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1">
                  <div 
                    className="p-3 rounded-full animate-pulse"
                    style={{ backgroundColor: 'hsl(var(--trade) / 0.2)' }}
                  >
                    <Timer className="h-6 w-6" style={{ color: 'hsl(var(--trade))' }} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div 
                        className="w-2 h-2 rounded-full animate-pulse" 
                        style={{ backgroundColor: 'hsl(var(--trade))' }}
                      />
                      <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'hsl(var(--trade))' }}>
                        Timer Running
                      </span>
                    </div>
                    <div 
                      className="text-3xl font-mono font-bold tracking-wider" 
                      style={{ color: 'hsl(var(--trade))' }}
                      data-testid="text-live-timer"
                    >
                      {getElapsedTime(activeTimerForThisJob.startTime)}
                    </div>
                  </div>
                </div>
                <Button 
                  variant="destructive" 
                  onClick={() => stopTimerMutation.mutate(activeTimerForThisJob.id)}
                  disabled={stopTimerMutation.isPending}
                  className="h-12 px-6"
                  data-testid="button-stop-timer-banner"
                >
                  <Square className="h-4 w-4 mr-2" />
                  {stopTimerMutation.isPending ? 'Saving...' : 'Clock Out'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* In Progress without active timer - prompt to start */}
        {job.status === 'in_progress' && !activeTimerForThisJob && !globalActiveTimer && (
          <div 
            className="rounded-xl p-4 border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30"
            data-testid="banner-no-timer"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-amber-200 dark:bg-amber-800">
                  <Timer className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="font-semibold text-amber-700 dark:text-amber-300">Timer not running</p>
                  <p className="text-sm text-muted-foreground">Start tracking time for this job</p>
                </div>
              </div>
              <Button
                onClick={() => startTimerMutation.mutate({
                  description: `Working on ${job.title}`,
                  jobId: jobId,
                  hourlyRate: '85.00',
                })}
                disabled={startTimerMutation.isPending}
                className="text-white shrink-0"
                style={{ backgroundColor: 'hsl(var(--trade))' }}
                data-testid="button-start-timer-banner"
              >
                <Play className="h-4 w-4 mr-2" />
                {startTimerMutation.isPending ? 'Starting...' : 'Start Timer'}
              </Button>
            </div>
          </div>
        )}

        {/* On My Way Quick Action - only for scheduled/in_progress jobs with a client */}
        {(job.status === 'scheduled' || job.status === 'in_progress') && job.clientId && (
          <div 
            className="rounded-xl p-4 border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30"
            data-testid="banner-on-my-way"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-blue-200 dark:bg-blue-800">
                  <Navigation className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="font-semibold text-blue-700 dark:text-blue-300">Heading to the job?</p>
                  <p className="text-sm text-muted-foreground">Let the client know you're on your way</p>
                </div>
              </div>
              <Button
                onClick={() => onMyWayMutation.mutate()}
                disabled={onMyWayMutation.isPending}
                className="shrink-0"
                variant="outline"
                data-testid="button-on-my-way"
              >
                {onMyWayMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Navigation className="h-4 w-4 mr-2" />
                    On My Way
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        <JobFlowWizard
          status={job.status}
          hasQuote={!!linkedQuote}
          hasInvoice={!!linkedInvoice}
          invoicePaid={linkedInvoice?.status === 'paid'}
          timestamps={{
            scheduledAt: job.scheduledAt,
            startedAt: job.startedAt,
            completedAt: job.completedAt,
            invoicedAt: job.invoicedAt,
          }}
          jobId={jobId}
          timerRunning={!!activeTimerForThisJob}
          onCreateQuote={() => onCreateQuote?.(jobId)}
          onViewQuote={() => linkedQuote && navigate(`/quotes/${linkedQuote.id}`)}
          onSchedule={() => onEditJob?.(jobId)}
          onStart={() => updateJobMutation.mutate({ status: 'in_progress' })}
          onComplete={handleCompleteJob}
          onCreateInvoice={() => onCreateInvoice?.(jobId)}
          onViewInvoice={() => linkedInvoice && navigate(`/invoices/${linkedInvoice.id}`)}
          onStatusChange={(newStatus) => {
            setRollbackTargetStatus(newStatus);
            setShowRollbackConfirm(true);
          }}
          data-testid="job-flow-wizard"
        />


        {!isTradie && (
          <LinkedDocumentsCard
            linkedQuote={linkedQuote}
            linkedInvoice={linkedInvoice}
            linkedReceipts={linkedReceipts}
            jobStatus={job.status}
            onViewQuote={(id) => navigate(`/quotes/${id}`)}
            onViewInvoice={(id) => navigate(`/invoices/${id}`)}
            onViewReceipt={(id) => {
              window.open(`/api/receipts/${id}/pdf`, '_blank');
            }}
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

        {/* Editable Notes Card - Always visible like mobile app */}
        <Card 
          className="cursor-pointer hover:border-primary/50 transition-colors"
          onClick={handleOpenNotesModal}
          data-testid="card-job-notes"
        >
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Notes
              </span>
              <PenLine className="h-4 w-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {job.notes ? (
              <p className="text-sm whitespace-pre-wrap">{job.notes}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Tap to add notes about this job...
              </p>
            )}
          </CardContent>
        </Card>

        {/* AI Photo Analysis - Show when photos exist */}
        {jobPhotos.length > 0 && (
          <AIPhotoAnalysis
            jobId={jobId}
            photoCount={jobPhotos.length}
            existingNotes={job.notes}
          />
        )}

        {/* Time Tracking Widget - Show for scheduled and in_progress jobs */}
        {(job.status === 'scheduled' || job.status === 'in_progress') && (
          <Card 
            className="border-2"
            style={{ borderColor: 'hsl(var(--trade) / 0.3)' }}
            data-testid="card-time-tracking"
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2" style={{ color: 'hsl(var(--trade))' }}>
                <Timer className="h-5 w-5" />
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

        {/* Safety Forms Section - Prominent before job starts */}
        <SafetyFormsSection 
          jobId={jobId} 
          jobStatus={job.status}
        />

        {/* Photos - show for ALL job statuses so team sync works */}
        <JobPhotoGallery jobId={jobId} canUpload={job.status !== 'invoiced'} />

        {/* Voice Notes - show for ALL job statuses so team sync works */}
        <JobVoiceNotes jobId={jobId} canUpload={job.status !== 'invoiced'} />

        {/* Uploaded Documents - external quotes, invoices, PDFs */}
        <JobDocuments jobId={jobId} canUpload={job.status !== 'invoiced'} />

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
          <div ref={chatSectionRef} data-testid="section-job-chat">
            <JobChat 
              jobId={jobId} 
              currentUserId={currentUser.id}
            />
          </div>
        )}

        {/* Job Activity Feed - shows history of events for this job */}
        <Card data-testid="job-activity-feed">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <History className="h-4 w-4" />
              Activity History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activitiesLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : jobActivities.length === 0 ? (
              <div className="text-center py-6">
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3"
                  style={{ backgroundColor: 'hsl(var(--muted) / 0.5)' }}
                >
                  <History className="h-6 w-6 text-muted-foreground/40" />
                </div>
                <p className="text-sm text-muted-foreground mb-1">No activity yet</p>
                <p className="text-xs text-muted-foreground/70">
                  Status changes, emails sent, and other events will appear here
                </p>
              </div>
            ) : (
              <div className="relative">
                {jobActivities.length > 1 && (
                  <div className="absolute left-[14px] top-6 bottom-4 w-px bg-gradient-to-b from-border to-transparent" />
                )}
                <div className="space-y-1">
                  {jobActivities.map((activity, index) => {
                    const Icon = activityIcons[activity.type] || Briefcase;
                    const colors = activityColors[activity.type] || { bg: 'hsl(var(--muted) / 0.5)', icon: 'hsl(var(--muted-foreground))' };
                    
                    return (
                      <div 
                        key={activity.id}
                        className="relative flex items-start gap-3 p-2 rounded-lg"
                        data-testid={`activity-item-${activity.id}`}
                      >
                        <div className="relative z-10">
                          <div 
                            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                            style={{ backgroundColor: colors.bg }}
                          >
                            <Icon className="h-3.5 w-3.5" style={{ color: colors.icon }} />
                          </div>
                          {activity.status === 'success' && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-card flex items-center justify-center">
                              <CheckCircle2 className="h-1.5 w-1.5 text-white" />
                            </div>
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0 pt-0.5">
                          <p className="text-sm font-medium truncate">{activity.title}</p>
                          {activity.description && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{activity.description}</p>
                          )}
                          <p className="text-[10px] text-muted-foreground/70 mt-1">
                            {formatHistoryDate(activity.timestamp)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

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
              onClick={() => setShowSafetyCheck(true)}
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

      {/* Notes Edit Modal - Like mobile app */}
      <Dialog open={showNotesModal} onOpenChange={setShowNotesModal}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-edit-notes">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Job Notes
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              value={editedNotes}
              onChange={(e) => setEditedNotes(e.target.value)}
              placeholder="Add notes about this job..."
              className="min-h-[200px] resize-none"
              autoFocus
              data-testid="textarea-job-notes"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowNotesModal(false)}
              data-testid="button-cancel-notes"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveNotes}
              disabled={saveNotesMutation.isPending}
              data-testid="button-save-notes"
            >
              {saveNotesMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Notes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Job Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent data-testid="dialog-delete-job">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Delete Job?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{job.title}"? This action cannot be undone.
              <br /><br />
              All photos, notes, and other data associated with this job will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteJob}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete Job
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Status Rollback Confirmation Dialog */}
      <AlertDialog open={showRollbackConfirm} onOpenChange={setShowRollbackConfirm}>
        <AlertDialogContent data-testid="dialog-rollback-status">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Change Job Status?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to change this job back to "{rollbackTargetStatus}"?
              <br /><br />
              This will clear the timestamps for any later stages. For example, reverting to "In Progress" will clear the "Done" and "Invoiced" timestamps.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => setRollbackTargetStatus(null)}
              data-testid="button-cancel-rollback"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (rollbackTargetStatus) {
                  updateJobMutation.mutate({ status: rollbackTargetStatus });
                }
                setShowRollbackConfirm(false);
                setRollbackTargetStatus(null);
              }}
              className="bg-amber-500 hover:bg-amber-600"
              data-testid="button-confirm-rollback"
            >
              Change Status
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Safety Check Dialog - prompts before starting work */}
      <SafetyCheckDialog
        open={showSafetyCheck}
        onOpenChange={setShowSafetyCheck}
        onContinue={() => {
          setShowSafetyCheck(false);
          updateJobMutation.mutate({ status: 'in_progress' });
          // Auto-start timer when starting job (only if no timer is already running)
          if (!globalActiveTimer && job?.title) {
            setTimeout(() => {
              startTimerMutation.mutate({
                description: `Working on ${job.title}`,
                jobId: jobId,
                hourlyRate: '85.00',
              });
            }, 500);
          }
        }}
        onAddSafetyForm={() => {
          setShowSafetyCheck(false);
          const safetySection = document.querySelector('[data-testid="card-safety-forms"]');
          if (safetySection) {
            safetySection.scrollIntoView({ behavior: 'smooth' });
            const addButton = safetySection.querySelector('[data-testid="button-add-safety-form"]') as HTMLButtonElement;
            if (addButton) {
              setTimeout(() => addButton.click(), 300);
            }
          }
        }}
        hasSafetyForms={hasSafetyForms && !hasCompletedSafetyForm}
      />
    </PageShell>
  );
}
