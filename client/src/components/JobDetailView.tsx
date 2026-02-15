import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Briefcase, User, MapPin, Calendar, Clock, Edit, FileText, FileEdit, Receipt, Camera, ExternalLink, Sparkles, Zap, Mic, ClipboardList, Users, Timer, CheckCircle, AlertTriangle, Loader2, PenLine, Trash2, Play, Square, Navigation, History, Mail, MessageSquare, CreditCard, Send, Bell, Plus, CheckCircle2, Smartphone, QrCode, DollarSign, Link2, Check, X, UserPlus, Copy, Circle, Package, Truck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { TimerWidget } from "./TimeTracking";
import { useLocation, useSearch } from "wouter";
import { getJobUrgency, getInProgressDuration } from "@/lib/jobUrgency";
import JobPhotoGallery from "./JobPhotoGallery";
import { JobVoiceNotes } from "./JobVoiceNotes";
import { JobDocuments } from "./JobDocuments";
import { JobVariations } from "./JobVariations";
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
import QuickCollectPayment from "./QuickCollectPayment";
import { BeforePhotoPrompt } from "./BeforePhotoPrompt";
import LinkedJobsCard from "./LinkedJobsCard";
import JobProfitabilityCard from "./JobProfitabilityCard";
import { UnifiedSendModal } from "./UnifiedSendModal";
import { ManualSmsComposer } from "./ManualSmsComposer";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarWidget } from "@/components/ui/calendar";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { formatHistoryDate } from "@shared/dateUtils";
import { useAppMode } from "@/hooks/use-app-mode";
import { useIntegrationHealth, isTwilioReady } from "@/hooks/use-integration-health";

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
  workerStatus?: string;
  workerStatusUpdatedAt?: string;
  workerEta?: string;
  workerEtaMinutes?: number;
  portalEnabled?: boolean;
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

interface QuoteLineItem {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  total: string;
  sortOrder: number;
}

interface LinkedDocument {
  id: string;
  title?: string;
  status: string;
  total: string;
  number?: string;
  quoteNumber?: string;
  invoiceNumber?: string;
  description?: string;
  lineItems?: QuoteLineItem[];
  createdAt?: string;
  dueDate?: string;
  paidAt?: string;
}

interface JobMaterial {
  id: string;
  name: string;
  description?: string;
  quantity: string;
  unit: string;
  unitCost: string;
  totalCost: string;
  supplier?: string;
  trackingNumber?: string;
  trackingCarrier?: string;
  trackingUrl?: string;
  status: string;
  notes?: string;
  markupPercent?: string;
  receiptPhotoUrl?: string;
  createdAt: string;
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
  const [showQuickCollect, setShowQuickCollect] = useState(false);
  const [showBeforePhotoPrompt, setShowBeforePhotoPrompt] = useState(false);
  const [showUnifiedSendModal, setShowUnifiedSendModal] = useState(false);
  const [unifiedSendDefaultTab, setUnifiedSendDefaultTab] = useState<'email' | 'sms'>('email');
  const [showManualSms, setShowManualSms] = useState(false);
  const [pendingTimerStart, setPendingTimerStart] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [newJobTitle, setNewJobTitle] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteRole, setInviteRole] = useState<'subcontractor' | 'viewer'>('subcontractor');
  const [invitePermissions, setInvitePermissions] = useState<string[]>(['view_job', 'add_notes']);
  const [inviteExpiry, setInviteExpiry] = useState<'never' | '7days' | '30days'>('never');
  const [generatedInviteLink, setGeneratedInviteLink] = useState<string | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [showAllActivities, setShowAllActivities] = useState(false);
  const [showAddMaterial, setShowAddMaterial] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState<Date | undefined>(undefined);
  const [rescheduleTime, setRescheduleTime] = useState("09:00");
  const [materialName, setMaterialName] = useState('');
  const [materialQty, setMaterialQty] = useState('1');
  const [materialUnit, setMaterialUnit] = useState('each');
  const [materialUnitCost, setMaterialUnitCost] = useState('');
  const [materialSupplier, setMaterialSupplier] = useState('');
  const [materialTrackingNumber, setMaterialTrackingNumber] = useState('');
  const [materialTrackingCarrier, setMaterialTrackingCarrier] = useState('');
  const [materialTrackingUrl, setMaterialTrackingUrl] = useState('');
  const [materialNotes, setMaterialNotes] = useState('');
  const [materialMarkupPercent, setMaterialMarkupPercent] = useState('');
  const [materialReceiptPhotoUrl, setMaterialReceiptPhotoUrl] = useState('');
  const [showSiteUpdateDialog, setShowSiteUpdateDialog] = useState(false);
  const [siteUpdateNote, setSiteUpdateNote] = useState('');
  const [siteUpdatePhoto, setSiteUpdatePhoto] = useState<File | null>(null);
  const [siteUpdatePhotoPreview, setSiteUpdatePhotoPreview] = useState<string | null>(null);
  const [selectedDurationEstimate, setSelectedDurationEstimate] = useState<string>('');
  
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
  const { data: integrationHealth } = useIntegrationHealth();
  const twilioConnected = isTwilioReady(integrationHealth);

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

  const { data: jobMaterials = [], isLoading: materialsLoading } = useQuery<JobMaterial[]>({
    queryKey: ['/api/jobs', jobId, 'materials'],
    enabled: !!jobId,
  });

  const { data: jobVariations = [] } = useQuery<any[]>({
    queryKey: ['/api/jobs', jobId, 'variations'],
    enabled: !!jobId,
  });

  // Fetch team members for assignment (only for owners/managers)
  const { data: teamMembers = [] } = useQuery<TeamMember[]>({
    queryKey: ['/api/team/members'],
    enabled: !isTradie && !isSolo,
  });

  // Fetch all jobs to check worker availability (for assignment dropdown)
  const { data: allJobs = [] } = useQuery<Job[]>({
    queryKey: ['/api/jobs'],
    enabled: !isTradie && !isSolo && teamMembers.length > 0,
  });

  // Helper function to check if a worker is on another active job
  const isWorkerOnOtherJob = (memberId: string): boolean => {
    return allJobs.some(
      (j) => j.assignedTo === memberId && j.status === 'in_progress' && j.id !== jobId
    );
  };

  // Fetch job photos - enable for all job statuses to support team sync
  const { data: jobPhotos = [] } = useQuery<{ id: string }[]>({
    queryKey: ['/api/jobs', jobId, 'photos'],
    enabled: !!jobId,
  });

  // Fetch job notes - timestamped notes tied to moments
  interface JobNote {
    id: string;
    content: string;
    createdBy?: string;
    createdByName?: string;
    createdAt: string;
  }
  const { data: jobNotesData = [] } = useQuery<JobNote[]>({
    queryKey: ['/api/jobs', jobId, 'notes'],
    enabled: !!jobId,
  });

  // Time entry interface for calculating actual hours
  interface TimeEntryForCosting {
    id: string;
    startTime: string;
    endTime?: string;
    isBreak?: boolean;
    hourlyRate?: number;
  }

  // Fetch time entries for this job - only for active jobs where time tracking applies
  const { data: timeEntries = [] } = useQuery<TimeEntryForCosting[]>({
    queryKey: ['/api/time-entries', { jobId }],
    queryFn: async () => {
      const res = await fetch(`/api/time-entries?jobId=${jobId}`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!jobId,
  });

  // Calculate actual hours from completed time entries (excluding breaks)
  const actualHoursData = (() => {
    const completedWorkEntries = timeEntries.filter(
      (entry) => entry.endTime && !entry.isBreak
    );
    
    const totalMinutes = completedWorkEntries.reduce((total, entry) => {
      const start = new Date(entry.startTime).getTime();
      const end = new Date(entry.endTime!).getTime();
      return total + Math.floor((end - start) / 60000);
    }, 0);
    
    const actualHours = totalMinutes / 60;
    
    // Get average hourly rate from entries that have it set
    const entriesWithRate = completedWorkEntries.filter(e => e.hourlyRate && e.hourlyRate > 0);
    const avgHourlyRate = entriesWithRate.length > 0
      ? entriesWithRate.reduce((sum, e) => sum + (e.hourlyRate || 0), 0) / entriesWithRate.length
      : 0;
    
    const laborCost = actualHours * avgHourlyRate;
    
    return {
      actualHours: Math.round(actualHours * 100) / 100,
      laborCost: Math.round(laborCost * 100) / 100,
      hasData: completedWorkEntries.length > 0,
      hourlyRate: avgHourlyRate,
    };
  })();

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
    photo_added: Camera,
    voice_note_added: Mic,
    note_updated: PenLine,
    note_added: Plus,
    note_edited: PenLine,
    note_deleted: Trash2,
    variation_created: Plus,
    variation_sent: Send,
    variation_approved: Check,
    variation_rejected: X,
    variation_deleted: Trash2,
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
    photo_added: { bg: 'hsl(180 60% 45% / 0.1)', icon: 'hsl(180 60% 45%)' },
    voice_note_added: { bg: 'hsl(320 70% 55% / 0.1)', icon: 'hsl(320 70% 55%)' },
    note_updated: { bg: 'hsl(45 85% 50% / 0.1)', icon: 'hsl(45 85% 50%)' },
    note_added: { bg: 'hsl(145 65% 45% / 0.1)', icon: 'hsl(145 65% 45%)' },
    note_edited: { bg: 'hsl(45 85% 50% / 0.1)', icon: 'hsl(45 85% 50%)' },
    note_deleted: { bg: 'hsl(5 85% 55% / 0.1)', icon: 'hsl(5 85% 55%)' },
    variation_created: { bg: 'hsl(35 90% 55% / 0.1)', icon: 'hsl(35 90% 55%)' },
    variation_sent: { bg: 'hsl(210 80% 52% / 0.1)', icon: 'hsl(210 80% 52%)' },
    variation_approved: { bg: 'hsl(145 65% 45% / 0.1)', icon: 'hsl(145 65% 45%)' },
    variation_rejected: { bg: 'hsl(5 85% 55% / 0.1)', icon: 'hsl(5 85% 55%)' },
    variation_deleted: { bg: 'hsl(5 85% 55% / 0.1)', icon: 'hsl(5 85% 55%)' },
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
    refetchInterval: 15000,
    staleTime: 10000,
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

  // Get user's trade type for filtering custom forms
  const { data: authUser } = useQuery<{ tradeType?: string }>({
    queryKey: ['/api/auth/me'],
    staleTime: 30000,
  });
  const userTradeType = authUser?.tradeType;

  const { data: customForms = [] } = useQuery<{ id: string; formType: string; requiresSignature: boolean }[]>({
    queryKey: ['/api/custom-forms', userTradeType],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (userTradeType) params.append('tradeType', userTradeType);
      const url = `/api/custom-forms${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch forms');
      return response.json();
    },
    enabled: !!authUser && !!jobId,
    staleTime: 30000,
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
    const hasNotes = jobNotesData.length > 0 || (job?.notes && job.notes.trim().length > 0);
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
    mutationFn: async (data: { status?: string; scheduledAt?: string }) => {
      // Staff tradies use the status-specific endpoint (which only allows status updates on assigned jobs)
      // Owners and managers use the full update endpoint
      // For non-status updates (like rescheduling), always use the full endpoint
      const isStatusOnly = data.status && !data.scheduledAt;
      const endpoint = isTradie && isStatusOnly
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

  // Add new note mutation - creates timestamped note tied to the moment
  const addNoteMutation = useMutation({
    mutationFn: async (content: string) => {
      return await apiRequest("POST", `/api/jobs/${jobId}/notes`, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'notes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/activity-logs'] });
      setShowNotesModal(false);
      setEditedNotes('');
      toast({
        title: "Note Added",
        description: "Your note has been recorded with timestamp",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add note",
        variant: "destructive",
      });
    },
  });

  const handleOpenNotesModal = () => {
    setEditedNotes('');
    setShowNotesModal(true);
  };

  const handleSaveNotes = () => {
    if (editedNotes.trim()) {
      addNoteMutation.mutate(editedNotes.trim());
    }
  };

  const [isSiteUpdateSubmitting, setIsSiteUpdateSubmitting] = useState(false);

  const handleSiteUpdatePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSiteUpdatePhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setSiteUpdatePhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitSiteUpdate = async () => {
    if (!siteUpdateNote.trim()) return;
    setIsSiteUpdateSubmitting(true);
    try {
      const noteContent = `[Site Update] ${siteUpdateNote.trim()}`;
      await apiRequest("POST", `/api/jobs/${jobId}/notes`, { content: noteContent });

      if (siteUpdatePhoto && siteUpdatePhotoPreview) {
        await apiRequest("POST", `/api/jobs/${jobId}/photos`, {
          fileName: siteUpdatePhoto.name,
          fileBase64: siteUpdatePhotoPreview.split(',')[1],
          mimeType: siteUpdatePhoto.type,
          category: 'progress',
          caption: siteUpdateNote.trim(),
        });
      }

      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'notes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'photos'] });
      queryClient.invalidateQueries({ queryKey: ['/api/activity-logs'] });

      setSiteUpdateNote('');
      setSiteUpdatePhoto(null);
      setSiteUpdatePhotoPreview(null);
      setShowSiteUpdateDialog(false);
      toast({
        title: "Site update logged",
        description: "Your note and photo have been recorded",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to log site update",
        variant: "destructive",
      });
    } finally {
      setIsSiteUpdateSubmitting(false);
    }
  };

  // Rename job mutation
  const renameJobMutation = useMutation({
    mutationFn: async (title: string) => {
      return await apiRequest("PATCH", `/api/jobs/${jobId}`, { title });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      setShowRenameDialog(false);
      toast({
        title: "Job Renamed",
        description: "Job title has been updated",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to rename job",
        variant: "destructive",
      });
    },
  });

  const handleOpenRenameDialog = () => {
    setNewJobTitle(job?.title || '');
    setShowRenameDialog(true);
  };

  const handleRenameJob = () => {
    if (newJobTitle.trim()) {
      renameJobMutation.mutate(newJobTitle.trim());
    }
  };

  const addMaterialMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', `/api/jobs/${jobId}/materials`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'materials'] });
      setShowAddMaterial(false);
      setMaterialName('');
      setMaterialQty('1');
      setMaterialUnit('each');
      setMaterialUnitCost('');
      setMaterialSupplier('');
      setMaterialTrackingNumber('');
      setMaterialTrackingCarrier('');
      setMaterialTrackingUrl('');
      setMaterialNotes('');
      setMaterialMarkupPercent('');
      setMaterialReceiptPhotoUrl('');
      toast({ title: 'Material added' });
    },
    onError: () => {
      toast({ title: 'Failed to add material', variant: 'destructive' });
    },
  });

  const updateMaterialStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest('PATCH', `/api/materials/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'materials'] });
    },
  });

  const deleteMaterialMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/materials/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'materials'] });
      toast({ title: 'Material removed' });
    },
  });

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

  // Job Invites
  interface JobInviteData {
    id: string;
    inviteCode: string;
    email: string | null;
    role: string;
    permissions: string[];
    expiresAt: string | null;
    usedAt: string | null;
    usedBy: number | null;
    status: string;
    createdAt: string;
    inviteLink?: string;
  }

  const { data: jobInvites, refetch: refetchInvites } = useQuery<JobInviteData[]>({
    queryKey: ['/api/jobs', jobId, 'invites'],
    enabled: !!jobId && !isTradie,
  });

  const createInviteMutation = useMutation({
    mutationFn: async () => {
      const expiresAt = inviteExpiry === 'never' 
        ? null 
        : inviteExpiry === '7days' 
          ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      
      const response = await apiRequest("POST", `/api/jobs/${jobId}/invites`, {
        role: inviteRole,
        permissions: invitePermissions,
        expiresAt,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setGeneratedInviteLink(data.inviteLink);
      refetchInvites();
      toast({
        title: "Invite Created",
        description: "Share the link with your subcontractor",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create invite",
        variant: "destructive",
      });
    },
  });

  const revokeInviteMutation = useMutation({
    mutationFn: async (inviteId: string) => {
      return await apiRequest("DELETE", `/api/jobs/${jobId}/invites/${inviteId}`);
    },
    onSuccess: () => {
      refetchInvites();
      toast({
        title: "Invite Revoked",
        description: "The invite link is no longer valid",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to revoke invite",
        variant: "destructive",
      });
    },
  });

  const handleCopyInviteLink = async () => {
    if (generatedInviteLink) {
      await navigator.clipboard.writeText(generatedInviteLink);
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 2000);
    }
  };

  const handleOpenInviteModal = () => {
    setGeneratedInviteLink(null);
    setInviteRole('subcontractor');
    setInvitePermissions(['view_job', 'add_notes']);
    setInviteExpiry('never');
    setShowInviteModal(true);
  };

  const togglePermission = (perm: string) => {
    if (invitePermissions.includes(perm)) {
      setInvitePermissions(invitePermissions.filter(p => p !== perm));
    } else {
      setInvitePermissions([...invitePermissions, perm]);
    }
  };

  // Helper to check if job is overdue (past scheduled time)
  const isJobOverdue = (): boolean => {
    if (!job?.scheduledAt) return false;
    const scheduledTime = new Date(job.scheduledAt);
    return currentTime > scheduledTime;
  };

  // Helper to parse error messages and detect SMS configuration issues
  const handleSmsError = (error: any) => {
    let errorMessage = error.message || "Failed to send notification";
    // Parse "400: {json}" style errors
    if (errorMessage.includes(': ')) {
      const parts = errorMessage.split(': ');
      if (!isNaN(parseInt(parts[0]))) {
        errorMessage = parts.slice(1).join(': ');
      }
    }
    // Try to extract error from JSON body
    try {
      const parsed = JSON.parse(errorMessage);
      errorMessage = parsed.error || errorMessage;
    } catch {}
    
    const isNotConfigured = errorMessage.toLowerCase().includes('not configured') || 
                            errorMessage.toLowerCase().includes('set up');
    if (isNotConfigured) {
      toast({
        title: "SMS error",
        description: "SMS could not be sent. Please try again later.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Couldn't send notification",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const DURATION_OPTIONS = [
    { value: '45', label: '30-60 mins', minutes: 45 },
    { value: '90', label: '1-2 hours', minutes: 90 },
    { value: '240', label: 'Half day', minutes: 240 },
    { value: '480', label: 'Full day', minutes: 480 },
    { value: '960', label: 'Multi-day', minutes: 960 },
  ];

  const getDurationLabel = (minutes: number): string => {
    const option = DURATION_OPTIONS.find(o => o.minutes === minutes);
    if (option) return option.label;
    if (minutes < 60) return `${minutes} mins`;
    if (minutes < 480) return `${Math.round(minutes / 60)} hours`;
    return `${Math.round(minutes / 480)} day(s)`;
  };

  // On My Way mutation - updates worker status and sends SMS to client
  const onMyWayMutation = useMutation({
    mutationFn: async () => {
      const etaMinutes = selectedDurationEstimate ? parseInt(selectedDurationEstimate) : undefined;
      const etaLabel = etaMinutes ? getDurationLabel(etaMinutes) : '30-60 mins';
      return await apiRequest("PATCH", `/api/jobs/${jobId}/worker-status`, {
        workerStatus: 'on_my_way',
        workerEta: etaLabel,
        workerEtaMinutes: etaMinutes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId] });
      setSelectedDurationEstimate('');
      toast({
        title: "On My Way - client notified",
        description: "SMS sent with tracking link",
      });
    },
    onError: handleSmsError,
  });

  // Arrived mutation - updates worker status to arrived
  const arrivedMutation = useMutation({
    mutationFn: async () => {
      const etaMinutes = selectedDurationEstimate ? parseInt(selectedDurationEstimate) : undefined;
      const etaLabel = etaMinutes ? getDurationLabel(etaMinutes) : undefined;
      return await apiRequest("PATCH", `/api/jobs/${jobId}/worker-status`, {
        workerStatus: 'arrived',
        workerEtaMinutes: etaMinutes,
        workerEta: etaLabel,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId] });
      setSelectedDurationEstimate('');
      toast({
        title: "Arrived - client notified",
      });
    },
    onError: handleSmsError,
  });

  const [portalUrl, setPortalUrl] = useState<string | null>(null);

  useEffect(() => {
    if (job?.portalEnabled && jobId) {
      fetch(`/api/jobs/${jobId}/portal-links`, {
        credentials: 'include',
      }).then(res => res.ok ? res.json() : []).then((tokens: any[]) => {
        if (tokens && tokens.length > 0) {
          const activeToken = tokens.find((t: any) => !t.revokedAt);
          if (activeToken) {
            const baseUrl = window.location.origin;
            setPortalUrl(`${baseUrl}/job-portal/${activeToken.token}`);
          }
        }
      }).catch(() => {});
    }
  }, [job?.portalEnabled, jobId]);

  // Portal link mutation - generates client tracking link
  const portalLinkMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/jobs/${jobId}/portal-link`);
      return res;
    },
    onSuccess: (data: any) => {
      if (data.url) {
        setPortalUrl(data.url);
        navigator.clipboard.writeText(data.url).then(() => {
          toast({
            title: "Portal link copied",
            description: "Client tracking link copied to clipboard",
          });
        }).catch(() => {
          toast({
            title: "Portal link created",
            description: data.url,
          });
        });
      }
    },
  });

  // Running Late mutation - sends SMS to client when past scheduled time
  const runningLateMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/jobs/${jobId}/running-late`);
    },
    onSuccess: () => {
      toast({
        title: "Running Late notification sent to client",
      });
    },
    onError: handleSmsError,
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

  const groupActivitiesByDate = (activities: JobActivityItem[]) => {
    const groups: { date: string; label: string; activities: JobActivityItem[] }[] = [];
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    activities.forEach(activity => {
      const actDate = new Date(activity.timestamp);
      const dateKey = actDate.toDateString();

      let label: string;
      if (dateKey === today.toDateString()) label = 'Today';
      else if (dateKey === yesterday.toDateString()) label = 'Yesterday';
      else label = format(actDate, 'EEE, d MMM');

      const existing = groups.find(g => g.date === dateKey);
      if (existing) {
        existing.activities.push(activity);
      } else {
        groups.push({ date: dateKey, label, activities: [activity] });
      }
    });

    return groups;
  };

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
            <div 
              className="flex items-center gap-2 group cursor-pointer"
              onClick={handleOpenRenameDialog}
              title="Click to rename job"
            >
              <h1 className="text-lg font-semibold">{job.title}</h1>
              <Edit className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            {client?.name && (
              <span 
                className="text-sm text-muted-foreground hover:underline cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  job.clientId && onViewClient?.(job.clientId);
                }}
                data-testid="link-client"
              >
                {client.name}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isTradie && (
            <Button variant="outline" size="icon" onClick={handleOpenInviteModal} data-testid="button-invite">
              <UserPlus className="h-4 w-4" />
            </Button>
          )}
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

      {/* Full-width banners */}
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
                onClick={() => {
                  setPendingTimerStart(true);
                  setShowBeforePhotoPrompt(true);
                }}
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

        {/* Worker Dispatch Status Controls */}
        {(job.status === 'scheduled' || job.status === 'in_progress' || job.status === 'pending') && job.clientId && (
          <div className="rounded-xl p-4 border border-border bg-card" data-testid="worker-status-controls">
            {job.workerStatus && job.workerStatus !== 'assigned' && (
              <div className="flex items-center gap-2 mb-3">
                <div className={`h-2.5 w-2.5 rounded-full ${
                  job.workerStatus === 'on_my_way' ? 'bg-amber-500 animate-pulse' :
                  job.workerStatus === 'arrived' ? 'bg-green-500' :
                  job.workerStatus === 'in_progress' ? 'bg-blue-500 animate-pulse' :
                  job.workerStatus === 'completed' ? 'bg-green-600' : 'bg-gray-400'
                }`} />
                <span className="text-sm font-medium">
                  {job.workerStatus === 'on_my_way' ? 'On My Way' :
                   job.workerStatus === 'arrived' ? 'Arrived on Site' :
                   job.workerStatus === 'in_progress' ? 'Work in Progress' :
                   job.workerStatus === 'completed' ? 'Completed' : ''}
                </span>
                {job.workerEta && job.workerStatus === 'on_my_way' && (
                  <Badge variant="secondary" className="text-xs">ETA: {job.workerEta}</Badge>
                )}
              </div>
            )}
            
            {(!job.workerStatus || job.workerStatus === 'assigned' || job.workerStatus === 'on_my_way') && (
              <div className="mb-3">
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Estimated Duration</label>
                <Select value={selectedDurationEstimate} onValueChange={setSelectedDurationEstimate}>
                  <SelectTrigger data-testid="select-duration-estimate">
                    <SelectValue placeholder="Select estimated duration" />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              {(!job.workerStatus || job.workerStatus === 'assigned') && (
                <Button
                  onClick={() => onMyWayMutation.mutate()}
                  disabled={onMyWayMutation.isPending}
                  variant="default"
                  className="gap-2"
                  data-testid="button-on-my-way"
                >
                  {onMyWayMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Navigation className="h-4 w-4" />
                  )}
                  On My Way
                </Button>
              )}

              {(!job.workerStatus || job.workerStatus === 'assigned') && isJobOverdue() && (
                <Button
                  onClick={() => runningLateMutation.mutate()}
                  disabled={runningLateMutation.isPending}
                  variant="default"
                  className="gap-2"
                  data-testid="button-running-late"
                >
                  {runningLateMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <AlertTriangle className="h-4 w-4" />
                  )}
                  Running Late
                </Button>
              )}
              
              {job.workerStatus === 'on_my_way' && (
                <Button
                  onClick={() => arrivedMutation.mutate()}
                  disabled={arrivedMutation.isPending}
                  variant="default"
                  className="gap-2"
                  data-testid="button-arrived"
                >
                  {arrivedMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MapPin className="h-4 w-4" />
                  )}
                  Arrived
                </Button>
              )}
              
              <Button
                onClick={() => portalLinkMutation.mutate()}
                disabled={portalLinkMutation.isPending}
                variant="outline"
                className="gap-2"
                data-testid="button-share-portal"
              >
                {portalLinkMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Link2 className="h-4 w-4" />
                )}
                Share Tracking Link
              </Button>
              {portalUrl && (
                <Button
                  onClick={() => window.open(portalUrl, '_blank')}
                  variant="outline"
                  className="gap-2"
                  data-testid="button-view-portal"
                >
                  <ExternalLink className="h-4 w-4" />
                  View Client Portal
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Two-column layout on desktop, single column on mobile */}
      <div className="lg:grid lg:grid-cols-5 lg:gap-6 space-y-4 lg:space-y-0 mt-4">
        {/* Left column - Primary content */}
        <div className="flex flex-col gap-4 lg:col-span-3">
          {/* Action Buttons - follows 5-stage workflow: pending → scheduled → in_progress → done → invoiced */}
          <div className="flex flex-col gap-2 pb-2">
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

            {/* Done status badge */}
            {job.status === 'done' && (
              <div className="flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">Job Completed</span>
              </div>
            )}

            {/* Quick actions row - Job Chat + Email + SMS in one row */}
            <div className="flex gap-2">
              {currentUser && !isSolo && (
                <div ref={chatSectionRef} data-testid="section-job-chat" className="flex-1">
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => navigate(`/chat?job=${jobId}`)}
                  >
                    <MessageSquare className="h-4 w-4" />
                    Job Chat
                  </Button>
                </div>
              )}
              {client?.email && (
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={() => { setUnifiedSendDefaultTab('email'); setShowUnifiedSendModal(true); }}
                  data-testid="button-email-client"
                >
                  <Mail className="h-4 w-4" />
                  Email
                </Button>
              )}
              {client?.phone && (
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={() => { setUnifiedSendDefaultTab('sms'); setShowUnifiedSendModal(true); }}
                  data-testid="button-sms-client"
                >
                  <MessageSquare className="h-4 w-4" />
                  SMS
                </Button>
              )}
            </div>
          </div>

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
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium hover:underline inline-flex items-center gap-1"
                    >
                      {job.address}
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  </div>
                )}

                {job.scheduledAt && (
                  <div>
                    <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1">
                      <Calendar className="h-3 w-3" />
                      Scheduled
                    </div>
                    <Popover open={rescheduleOpen} onOpenChange={(open) => {
                      setRescheduleOpen(open);
                      if (open && job.scheduledAt) {
                        const d = new Date(job.scheduledAt);
                        setRescheduleDate(d);
                        setRescheduleTime(format(d, 'HH:mm'));
                      }
                    }}>
                      <PopoverTrigger asChild>
                        <button className="text-left hover:bg-muted/50 rounded-md p-1 -m-1 transition-colors group">
                          <p className="font-medium group-hover:text-primary">
                            {format(new Date(job.scheduledAt), 'MMM d, yyyy')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(job.scheduledAt), 'h:mm a')}
                            <span className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity text-primary">
                              (tap to reschedule)
                            </span>
                          </p>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <div className="p-3 border-b">
                          <p className="font-medium text-sm">Reschedule Job</p>
                          <p className="text-xs text-muted-foreground">Pick a new date and time</p>
                        </div>
                        <CalendarWidget
                          mode="single"
                          selected={rescheduleDate}
                          onSelect={setRescheduleDate}
                          initialFocus
                        />
                        <div className="p-3 border-t space-y-3">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <Input
                              type="time"
                              value={rescheduleTime}
                              onChange={(e) => setRescheduleTime(e.target.value)}
                              className="flex-1"
                            />
                          </div>
                          <Button
                            className="w-full"
                            disabled={!rescheduleDate || updateJobMutation.isPending}
                            onClick={() => {
                              if (!rescheduleDate) return;
                              const [hours, minutes] = rescheduleTime.split(':').map(Number);
                              const newDate = new Date(rescheduleDate);
                              newDate.setHours(hours, minutes, 0, 0);
                              updateJobMutation.mutate(
                                { scheduledAt: newDate.toISOString() },
                                { onSuccess: () => setRescheduleOpen(false) }
                              );
                            }}
                          >
                            {updateJobMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <Calendar className="h-4 w-4 mr-2" />
                            )}
                            Confirm Reschedule
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
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
                      {teamMembers.filter(m => m.isActive && m.roleName?.toLowerCase() !== 'administrator').map((member) => {
                        const onOtherJob = isWorkerOnOtherJob(member.memberId);
                        return (
                          <SelectItem 
                            key={member.memberId} 
                            value={member.memberId}
                            data-testid={`option-worker-${member.memberId}`}
                          >
                            <div className="flex items-center gap-2">
                              <span>{member.firstName} {member.lastName} ({member.roleName})</span>
                              {onOtherJob ? (
                                <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">On a job</span>
                              ) : (
                                <span className="text-xs text-green-600 dark:text-green-400 font-medium">Available</span>
                              )}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Job Costing Section - Shows estimated vs actual hours */}
              {(job.estimatedHours || actualHoursData.hasData) && (
                <div className="pt-2 border-t">
                  <div className="flex items-center gap-1 text-muted-foreground text-xs mb-2">
                    <DollarSign className="h-3 w-3" />
                    Job Costing
                  </div>
                  <div className="space-y-2">
                    {job.estimatedHours && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Estimated</span>
                        <span className="text-sm font-medium">{job.estimatedHours} hrs</span>
                      </div>
                    )}
                    {actualHoursData.hasData && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Actual</span>
                        <span className="text-sm font-medium">{actualHoursData.actualHours} hrs</span>
                      </div>
                    )}
                    {job.estimatedHours && actualHoursData.hasData && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Variance</span>
                        {(() => {
                          const variance = actualHoursData.actualHours - job.estimatedHours;
                          const isOver = variance > 0;
                          const isUnder = variance < 0;
                          return (
                            <span className={`text-sm font-medium ${isOver ? 'text-red-600 dark:text-red-400' : isUnder ? 'text-green-600 dark:text-green-400' : ''}`}>
                              {isOver ? '+' : ''}{variance.toFixed(2)} hrs
                            </span>
                          );
                        })()}
                      </div>
                    )}
                    {actualHoursData.hasData && actualHoursData.laborCost > 0 && (
                      <div className="flex items-center justify-between pt-1 border-t">
                        <span className="text-sm text-muted-foreground">Labor Cost</span>
                        <span className="text-sm font-medium">${actualHoursData.laborCost.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
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

          {!isTradie && (
            <JobProfitabilityCard jobId={jobId} />
          )}

          {job.status !== 'invoiced' && job.status !== 'pending' && (
            <Card data-testid="card-log-site-update">
              <CardContent className="pt-4 pb-4">
                <Button
                  className="w-full gap-2"
                  style={{ backgroundColor: 'hsl(var(--trade))', color: 'white' }}
                  onClick={() => setShowSiteUpdateDialog(true)}
                >
                  <PenLine className="h-4 w-4" />
                  Log Site Update
                </Button>
              </CardContent>
            </Card>
          )}

          {(linkedQuote?.lineItems?.length > 0 || jobVariations.length > 0 || jobMaterials.length > 0) && (
            <Card data-testid="card-job-brief">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <ClipboardList className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
                  <CardTitle className="text-sm font-medium">Job Brief</CardTitle>
                </div>
                {linkedQuote && (
                  <p className="text-xs text-muted-foreground">
                    Scope of work from {linkedQuote.number || linkedQuote.quoteNumber ? `Quote #${linkedQuote.number || linkedQuote.quoteNumber}` : "Linked Quote"}
                  </p>
                )}
              </CardHeader>
              <CardContent className="pt-0 space-y-4">
                {linkedQuote?.lineItems && linkedQuote.lineItems.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Original Scope</span>
                    </div>
                    {linkedQuote.description && (
                      <p className="text-sm text-muted-foreground">{linkedQuote.description}</p>
                    )}
                    <div className="space-y-1.5">
                      {linkedQuote.lineItems.map((item) => (
                        <div key={item.id} className="flex items-start gap-2">
                          <Circle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground/50" />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm">{item.description}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 text-sm text-muted-foreground">
                            {parseFloat(item.quantity) !== 1 && (
                              <span>x{item.quantity}</span>
                            )}
                            {!isTradie && item.total && !isNaN(parseFloat(item.total)) && (
                              <span className="text-right w-20">${parseFloat(item.total).toFixed(2)}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {jobVariations.filter((v: any) => v.status === 'approved').length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <FileEdit className="h-3.5 w-3.5 text-amber-600" />
                      <span className="text-xs font-medium text-amber-700 dark:text-amber-400 uppercase tracking-wide">Variations</span>
                      <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        {jobVariations.filter((v: any) => v.status === 'approved').length}
                      </Badge>
                    </div>
                    <div className="space-y-1.5 pl-0.5">
                      {jobVariations.filter((v: any) => v.status === 'approved').map((variation: any) => (
                        <div key={variation.id} className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/20 rounded-md p-2">
                          <Plus className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-600" />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium">{variation.title}</span>
                            {variation.description && (
                              <p className="text-xs text-muted-foreground mt-0.5">{variation.description}</p>
                            )}
                          </div>
                          {!isTradie && variation.totalAmount && (
                            <span className="text-sm font-medium text-amber-700 dark:text-amber-400 shrink-0">
                              +${parseFloat(variation.totalAmount).toFixed(2)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!isTradie && jobVariations.filter((v: any) => v.status === 'sent' || v.status === 'draft').length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pending Variations</span>
                      <Badge variant="outline" className="text-xs">
                        {jobVariations.filter((v: any) => v.status === 'sent' || v.status === 'draft').length}
                      </Badge>
                    </div>
                    <div className="space-y-1.5 pl-0.5">
                      {jobVariations.filter((v: any) => v.status === 'sent' || v.status === 'draft').map((variation: any) => (
                        <div key={variation.id} className="flex items-start gap-2 opacity-70">
                          <Clock className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm">{variation.title}</span>
                          </div>
                          <Badge variant="outline" className="text-xs shrink-0">
                            {variation.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {jobMaterials.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Package className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Materials</span>
                      <Badge variant="secondary" className="text-xs">{jobMaterials.length}</Badge>
                    </div>
                    <div className="space-y-1.5">
                      {jobMaterials.slice(0, 5).map((material) => (
                        <div key={material.id} className="flex items-center gap-2 text-sm">
                          <span className="flex-1 min-w-0 truncate">{material.name}</span>
                          <span className="text-muted-foreground shrink-0">{material.quantity} {material.unit}</span>
                          <Badge variant="outline" className="text-xs shrink-0 capitalize">
                            {material.status}
                          </Badge>
                        </div>
                      ))}
                      {jobMaterials.length > 5 && (
                        <p className="text-xs text-muted-foreground">+{jobMaterials.length - 5} more materials</p>
                      )}
                    </div>
                  </div>
                )}

                {!isTradie && linkedQuote?.total && (
                  <div className="pt-2 border-t space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Original Quote</span>
                      <span>${parseFloat(linkedQuote.total).toFixed(2)}</span>
                    </div>
                    {jobVariations.filter((v: any) => v.status === 'approved').length > 0 && (
                      <>
                        <div className="flex items-center justify-between text-sm text-amber-700 dark:text-amber-400">
                          <span>Approved Variations</span>
                          <span>+${jobVariations.filter((v: any) => v.status === 'approved').reduce((sum: number, v: any) => sum + (parseFloat(v.totalAmount) || 0), 0).toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm font-semibold pt-1 border-t">
                          <span>Revised Total</span>
                          <span>${(parseFloat(linkedQuote.total) + jobVariations.filter((v: any) => v.status === 'approved').reduce((sum: number, v: any) => sum + (parseFloat(v.totalAmount) || 0), 0)).toFixed(2)}</span>
                        </div>
                      </>
                    )}
                    {jobVariations.filter((v: any) => v.status === 'approved').length === 0 && (
                      <div className="flex items-center justify-between text-sm font-semibold">
                        <span>Total</span>
                        <span>${parseFloat(linkedQuote.total).toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

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
                  {jobNotesData.length > 0 && (
                    <Badge variant="secondary" className="text-xs">{jobNotesData.length}</Badge>
                  )}
                </span>
                <Plus className="h-4 w-4 text-muted-foreground" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              {jobNotesData.length > 0 ? (
                <div className="space-y-3">
                  {jobNotesData.slice(0, 3).map((note) => (
                    <div key={note.id} className="p-3 rounded-lg bg-muted/50 border border-border">
                      <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{formatHistoryDate(note.createdAt)}</span>
                        {note.createdByName && (
                          <>
                            <span>•</span>
                            <span>{note.createdByName}</span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                  {jobNotesData.length > 3 && (
                    <p className="text-xs text-muted-foreground text-center">
                      +{jobNotesData.length - 3} more notes
                    </p>
                  )}
                </div>
              ) : job.notes ? (
                <div className="p-3 rounded-lg bg-muted/50 border border-border">
                  <p className="text-sm whitespace-pre-wrap">{job.notes}</p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>Legacy note</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Tap to add a note tied to this moment...
                </p>
              )}
            </CardContent>
          </Card>

          {/* Job Variations / Change Orders - for tracking scope changes */}
          <JobVariations jobId={jobId} canEdit={job.status !== 'invoiced' && !isTradie} />

          {/* Client Signature - show for in_progress (for capturing before completion), done and invoiced jobs */}
          {(job.status === 'in_progress' || job.status === 'done' || job.status === 'invoiced') && (
            <JobSignature jobId={jobId} />
          )}

          {/* Voice Notes - show for ALL job statuses so team sync works */}
          <JobVoiceNotes 
            jobId={jobId} 
            canUpload={job.status !== 'invoiced'} 
            existingNotes={job.notes}
          />

          {/* Uploaded Documents - external quotes, invoices, PDFs */}
          <JobDocuments jobId={jobId} canUpload={job.status !== 'invoiced'} />

        </div>

        {/* Right column - Secondary/supporting content */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          {job.status === 'done' && !linkedInvoice && !isTradie && (
            <Card className="border-2" style={{ borderColor: 'hsl(142.1 76.2% 36.3% / 0.5)' }} data-testid="card-create-invoice-prompt">
              <CardContent className="py-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'hsl(142.1 76.2% 36.3% / 0.15)' }}>
                    <Receipt className="h-5 w-5" style={{ color: 'hsl(142.1 76.2% 36.3%)' }} />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Job Complete — Get Paid</p>
                    <p className="text-xs text-muted-foreground">Create and send an invoice to your client</p>
                  </div>
                </div>
                <Button
                  className="w-full"
                  style={{ backgroundColor: 'hsl(142.1 76.2% 36.3%)', color: 'white' }}
                  onClick={() => onCreateInvoice?.(jobId)}
                  data-testid="button-create-invoice-prompt"
                >
                  <Receipt className="h-4 w-4 mr-2" />
                  Create Invoice
                </Button>
              </CardContent>
            </Card>
          )}
          {!isTradie && (
            <LinkedDocumentsCard
              linkedQuote={linkedQuote}
              linkedInvoice={linkedInvoice}
              linkedReceipts={linkedReceipts}
              jobStatus={job.status}
              onViewQuote={(id) => navigate(`/quotes/${id}`)}
              onViewInvoice={(id) => navigate(`/invoices/${id}`)}
              onViewReceipt={(id) => navigate(`/receipts/${id}`)}
              onCreateQuote={() => onCreateQuote?.(jobId)}
              onCreateInvoice={() => onCreateInvoice?.(jobId)}
            />
          )}

          {/* Quick Collect Payment - Shows when job is done/in_progress with accepted quote but no invoice yet */}
          {(job.status === 'done' || job.status === 'in_progress') && linkedQuote && linkedQuote.status === 'accepted' && !linkedInvoice && (
            <Card data-testid="card-quick-collect">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <CreditCard className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
                    Collect Payment Now
                  </CardTitle>
                  <Badge variant="secondary" className="text-xs">Based on quote</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Collect payment immediately using the accepted quote amount. An invoice and receipt will be created automatically.
                </p>
                <div className="flex items-center justify-between mb-4 p-3 rounded-lg bg-background border">
                  <span className="text-sm text-muted-foreground">Quote total</span>
                  <span className="text-lg font-bold" style={{ color: 'hsl(var(--trade))' }}>
                    ${parseFloat(linkedQuote.total as string || '0').toFixed(2)}
                  </span>
                </div>
                <Button
                  className="w-full"
                  style={{ backgroundColor: 'hsl(var(--trade))', color: 'white' }}
                  onClick={() => setShowQuickCollect(true)}
                  data-testid="button-quick-collect-open"
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Quick Collect Payment
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Collect Payment Section - Shows when invoice is unpaid */}
          {linkedInvoice && !isTradie && (linkedInvoice.status === 'sent' || linkedInvoice.status === 'overdue' || linkedInvoice.status === 'partial') && (
            <Card data-testid="card-collect-payment">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <CreditCard className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
                    Collect Payment
                  </CardTitle>
                  <Badge variant="outline" className="text-xs">
                    ${parseFloat(linkedInvoice.total as string || '0').toFixed(2)} outstanding
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Invoice {linkedInvoice.invoiceNumber} is ready for payment
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="default"
                    className="flex items-center justify-center gap-2"
                    style={{ backgroundColor: 'hsl(var(--trade))', color: 'white' }}
                    onClick={() => navigate(`/collect-payment?invoiceId=${linkedInvoice.id}&jobId=${jobId}`)}
                    data-testid="button-tap-to-pay-job"
                  >
                    <Smartphone className="h-4 w-4" />
                    Tap to Pay
                  </Button>
                  <Button
                    variant="outline"
                    className="flex items-center justify-center gap-2"
                    onClick={() => navigate(`/collect-payment?invoiceId=${linkedInvoice.id}&jobId=${jobId}&method=qr`)}
                    data-testid="button-qr-code-job"
                  >
                    <QrCode className="h-4 w-4" />
                    QR Code
                  </Button>
                  <Button
                    variant="outline"
                    className="flex items-center justify-center gap-2"
                    onClick={() => navigate(`/collect-payment?invoiceId=${linkedInvoice.id}&jobId=${jobId}&method=link`)}
                    data-testid="button-send-link-job"
                  >
                    <Link2 className="h-4 w-4" />
                    Send Link
                  </Button>
                  <Button
                    variant="outline"
                    className="flex items-center justify-center gap-2"
                    onClick={() => navigate(`/invoices/${linkedInvoice.id}?action=recordPayment`)}
                    data-testid="button-record-cash-job"
                  >
                    <DollarSign className="h-4 w-4" />
                    Record Cash
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Receipt Display - Shows after payment received */}
          {linkedReceipts.length > 0 && !isTradie && (
            <Card data-testid="card-payment-received">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  Payment Received
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {linkedReceipts.map((receipt) => (
                    <div 
                      key={receipt.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-card border cursor-pointer hover-elevate"
                      onClick={() => navigate(`/receipts/${receipt.id}`)}
                      data-testid={`receipt-item-${receipt.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                          <Receipt className="h-4 w-4 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Receipt #{receipt.receiptNumber}</p>
                          <p className="text-xs text-muted-foreground">
                            {receipt.paymentMethod || 'Payment'} • {receipt.paidAt ? new Date(receipt.paidAt).toLocaleDateString() : 'Recently'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-emerald-600">${parseFloat(receipt.amount).toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Materials Tracking */}
          <Card data-testid="card-materials">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
                  <CardTitle className="text-sm font-medium">Materials & Parts</CardTitle>
                  {jobMaterials.length > 0 && (
                    <Badge variant="secondary" className="text-xs">{jobMaterials.length}</Badge>
                  )}
                </div>
                <Button size="sm" variant="ghost" onClick={() => setShowAddMaterial(!showAddMaterial)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {showAddMaterial && (
                <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
                  <Input
                    placeholder="Material name (e.g., 25mm copper pipe)"
                    value={materialName}
                    onChange={(e) => setMaterialName(e.target.value)}
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <Input
                      placeholder="Qty"
                      type="number"
                      value={materialQty}
                      onChange={(e) => setMaterialQty(e.target.value)}
                    />
                    <Select value={materialUnit} onValueChange={setMaterialUnit}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="each">each</SelectItem>
                        <SelectItem value="metre">metre</SelectItem>
                        <SelectItem value="sqm">sqm</SelectItem>
                        <SelectItem value="litre">litre</SelectItem>
                        <SelectItem value="kg">kg</SelectItem>
                        <SelectItem value="box">box</SelectItem>
                        <SelectItem value="pack">pack</SelectItem>
                        <SelectItem value="roll">roll</SelectItem>
                      </SelectContent>
                    </Select>
                    {!isTradie && (
                      <Input
                        placeholder="$ Cost"
                        type="number"
                        step="0.01"
                        value={materialUnitCost}
                        onChange={(e) => setMaterialUnitCost(e.target.value)}
                      />
                    )}
                  </div>
                  <Input
                    placeholder="Supplier (optional)"
                    value={materialSupplier}
                    onChange={(e) => setMaterialSupplier(e.target.value)}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Tracking # (optional)"
                      value={materialTrackingNumber}
                      onChange={(e) => setMaterialTrackingNumber(e.target.value)}
                    />
                    <Select value={materialTrackingCarrier} onValueChange={setMaterialTrackingCarrier}>
                      <SelectTrigger>
                        <SelectValue placeholder="Carrier" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auspost">Australia Post</SelectItem>
                        <SelectItem value="startrack">StarTrack</SelectItem>
                        <SelectItem value="tnt">TNT</SelectItem>
                        <SelectItem value="toll">Toll</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Input
                    placeholder="Tracking URL (optional)"
                    value={materialTrackingUrl}
                    onChange={(e) => setMaterialTrackingUrl(e.target.value)}
                  />
                  <Input
                    placeholder="Notes (optional)"
                    value={materialNotes}
                    onChange={(e) => setMaterialNotes(e.target.value)}
                  />
                  {!isTradie && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="relative">
                        <Input
                          placeholder="Markup %"
                          type="number"
                          step="0.01"
                          min="0"
                          value={materialMarkupPercent}
                          onChange={(e) => setMaterialMarkupPercent(e.target.value)}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                      </div>
                      <Input
                        placeholder="Receipt photo URL (optional)"
                        value={materialReceiptPhotoUrl}
                        onChange={(e) => setMaterialReceiptPhotoUrl(e.target.value)}
                      />
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={!materialName.trim() || addMaterialMutation.isPending}
                      onClick={() => {
                        addMaterialMutation.mutate({
                          name: materialName.trim(),
                          quantity: materialQty || '1',
                          unit: materialUnit,
                          unitCost: materialUnitCost || '0',
                          supplier: materialSupplier || undefined,
                          trackingNumber: materialTrackingNumber || undefined,
                          trackingCarrier: materialTrackingCarrier || undefined,
                          trackingUrl: materialTrackingUrl || undefined,
                          notes: materialNotes || undefined,
                          markupPercent: materialMarkupPercent || undefined,
                          receiptPhotoUrl: materialReceiptPhotoUrl || undefined,
                        });
                      }}
                      style={{ backgroundColor: 'hsl(var(--trade))', color: 'white' }}
                    >
                      {addMaterialMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add Material'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowAddMaterial(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {jobMaterials.length === 0 && !showAddMaterial && (
                <p className="text-sm text-muted-foreground py-2">No materials tracked yet. Tap Add to start tracking parts and supplies.</p>
              )}

              {jobMaterials.length > 0 && (
                <div className="space-y-2">
                  {jobMaterials.map((mat) => {
                    const statusColors: Record<string, string> = {
                      needed: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
                      ordered: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
                      shipped: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
                      received: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
                      installed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
                    };
                    return (
                      <div key={mat.id} className="flex items-start gap-3 p-2 rounded-lg border bg-background">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">{mat.name}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusColors[mat.status] || statusColors.needed}`}>
                              {mat.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                            <span>{mat.quantity} {mat.unit}</span>
                            {mat.supplier && <span>from {mat.supplier}</span>}
                            {!isTradie && mat.totalCost && parseFloat(mat.totalCost) > 0 && (
                              <span className="font-medium">${parseFloat(mat.totalCost).toFixed(2)}</span>
                            )}
                            {!isTradie && mat.markupPercent && parseFloat(mat.markupPercent) > 0 && (
                              <span className="text-muted-foreground">+{parseFloat(mat.markupPercent).toFixed(0)}% markup</span>
                            )}
                          </div>
                          {mat.trackingNumber && (() => {
                            const trackingUrls: Record<string, string> = {
                              auspost: `https://auspost.com.au/mypost/track/#/details/${mat.trackingNumber}`,
                              startrack: `https://startrack.com.au/track/#/details/${mat.trackingNumber}`,
                              tnt: `https://www.tnt.com/express/en_au/site/tracking.html?searchType=con&cons=${mat.trackingNumber}`,
                              toll: `https://www.toll.com.au/tracking/search?q=${mat.trackingNumber}`,
                            };
                            const carrierLabel = mat.trackingCarrier === 'auspost' ? 'AusPost' : mat.trackingCarrier === 'startrack' ? 'StarTrack' : mat.trackingCarrier?.toUpperCase() || '';
                            const url = mat.trackingCarrier ? trackingUrls[mat.trackingCarrier as keyof typeof trackingUrls] : null;
                            return (
                              <div className="flex items-center gap-1 mt-1 text-xs">
                                <Truck className="h-3 w-3 text-muted-foreground" />
                                {url ? (
                                  <a
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline flex items-center gap-1"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {carrierLabel} {mat.trackingNumber}
                                    <ExternalLink className="h-2.5 w-2.5" />
                                  </a>
                                ) : (
                                  <span className="text-muted-foreground">
                                    {carrierLabel} <span className="font-mono">{mat.trackingNumber}</span>
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                          {mat.trackingUrl && (
                            <div className="flex items-center gap-1 mt-1 text-xs">
                              <Link2 className="h-3 w-3 text-muted-foreground" />
                              <a
                                href={mat.trackingUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline flex items-center gap-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                Tracking Link
                                <ExternalLink className="h-2.5 w-2.5" />
                              </a>
                            </div>
                          )}
                          {!isTradie && mat.receiptPhotoUrl && /^https?:\/\//i.test(mat.receiptPhotoUrl) && (
                            <div className="flex items-center gap-1 mt-1 text-xs">
                              <Receipt className="h-3 w-3 text-muted-foreground" />
                              <a
                                href={mat.receiptPhotoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline flex items-center gap-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                View Receipt
                                <ExternalLink className="h-2.5 w-2.5" />
                              </a>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Select
                            value={mat.status}
                            onValueChange={(val) => updateMaterialStatusMutation.mutate({ id: mat.id, status: val })}
                          >
                            <SelectTrigger className="h-7 w-[90px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="needed">Needed</SelectItem>
                              <SelectItem value="ordered">Ordered</SelectItem>
                              <SelectItem value="shipped">Shipped</SelectItem>
                              <SelectItem value="received">Received</SelectItem>
                              <SelectItem value="installed">Installed</SelectItem>
                            </SelectContent>
                          </Select>
                          {!isTradie && (
                            <Button size="icon" variant="ghost" onClick={() => deleteMaterialMutation.mutate(mat.id)}>
                              <Trash2 className="text-muted-foreground" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {!isTradie && jobMaterials.length > 0 && (
                <div className="flex items-center justify-end pt-2 border-t">
                  <span className="text-sm font-medium">
                    Materials Total: ${jobMaterials.reduce((sum, m) => sum + (parseFloat(m.totalCost) || 0), 0).toFixed(2)}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

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
              assignedTo={job.assignedTo}
            />
          )}

          {/* AI Photo Analysis - Show when photos exist */}
          {jobPhotos.length > 0 && (
            <AIPhotoAnalysis
              jobId={jobId}
              photoCount={jobPhotos.length}
              existingNotes={jobNotesData.length > 0 ? jobNotesData.map(n => n.content).join('\n') : job.notes}
            />
          )}

          {/* Photos - show for ALL job statuses so team sync works */}
          <JobPhotoGallery jobId={jobId} canUpload={job.status !== 'invoiced'} />

          {/* Linked Jobs - Client history with photo copy */}
          <LinkedJobsCard
            jobId={jobId}
            clientId={job.clientId}
            clientName={client?.name || 'Client'}
          />

          {/* Safety Forms Section - grows to fill remaining space */}
          <SafetyFormsSection 
            jobId={jobId} 
            jobStatus={job.status}
            className="flex-grow"
          />

        </div>
      </div>

      {/* Full-width Job Timeline below both columns */}
      <Card className="mt-4" data-testid="job-activity-feed">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <History className="h-4 w-4" />
            Job Timeline
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
            <div>
              {(() => {
                const displayedActivities = showAllActivities ? jobActivities : jobActivities.slice(0, 6);
                const dateGroups = groupActivitiesByDate(displayedActivities);
                return (
                  <>
                    <div className="relative">
                      <div className="absolute left-[15px] top-0 bottom-0 w-px bg-border" />

                      {dateGroups.map((group, groupIndex) => (
                        <div key={group.date}>
                          <div className={`relative flex items-center gap-3 mb-3 ${groupIndex > 0 ? 'mt-4' : ''}`}>
                            <div className="w-8 h-5 bg-card z-10 flex items-center justify-center">
                              <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                            </div>
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                              {group.label}
                            </span>
                          </div>

                          {group.activities.map((activity) => {
                            const Icon = activityIcons[activity.type] || Briefcase;
                            const colors = activityColors[activity.type] || { bg: 'hsl(var(--muted) / 0.5)', icon: 'hsl(var(--muted-foreground))' };

                            return (
                              <div
                                key={activity.id}
                                className="relative flex gap-3 pb-4 last:pb-0"
                                data-testid={`activity-item-${activity.id}`}
                              >
                                <div className="relative z-10 shrink-0">
                                  <div
                                    className="w-8 h-8 rounded-full flex items-center justify-center bg-card border-2"
                                    style={{ borderColor: colors.bg }}
                                  >
                                    <Icon className="h-3.5 w-3.5" style={{ color: colors.icon }} />
                                  </div>
                                </div>

                                <div className="flex-1 min-w-0 pt-1">
                                  <p className="text-sm font-medium">{activity.title}</p>
                                  {activity.description && (
                                    <p className="text-xs text-muted-foreground mt-0.5">{activity.description}</p>
                                  )}
                                  <p className="text-[11px] text-muted-foreground/70 mt-1">
                                    {formatHistoryDate(activity.timestamp)}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                    {jobActivities.length > 6 && (
                      <div className="pt-2">
                        <Button
                          variant="ghost"
                          className="w-full text-xs"
                          onClick={() => setShowAllActivities(!showAllActivities)}
                        >
                          {showAllActivities ? 'Show less' : `View all (${jobActivities.length})`}
                        </Button>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </CardContent>
      </Card>

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

      {/* Add Note Modal - Timestamped notes tied to moments */}
      <Dialog open={showNotesModal} onOpenChange={setShowNotesModal}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-add-note">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenLine className="h-5 w-5" />
              Add Note
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              This note will be timestamped and tied to this moment.
            </p>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              value={editedNotes}
              onChange={(e) => setEditedNotes(e.target.value)}
              placeholder="What's happening right now..."
              className="min-h-[150px] resize-none"
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
              disabled={addNoteMutation.isPending || !editedNotes.trim()}
              data-testid="button-save-notes"
            >
              {addNoteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                'Add Note'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Job Dialog */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent className="sm:max-w-[400px]" data-testid="dialog-rename-job">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-primary" />
              Rename Job
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <input
              type="text"
              value={newJobTitle}
              onChange={(e) => setNewJobTitle(e.target.value)}
              placeholder="Enter job title..."
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newJobTitle.trim()) {
                  handleRenameJob();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRenameDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleRenameJob}
              disabled={renameJobMutation.isPending || !newJobTitle.trim()}
            >
              {renameJobMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save'
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

      {/* Job Invite Modal */}
      <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
        <DialogContent className="sm:max-w-[500px]" data-testid="dialog-job-invite">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Invite to Job
            </DialogTitle>
          </DialogHeader>
          
          {generatedInviteLink ? (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">Share this link:</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={generatedInviteLink}
                    className="flex-1 px-3 py-2 rounded-md border border-input bg-background text-sm"
                  />
                  <Button size="icon" onClick={handleCopyInviteLink}>
                    {copiedInvite ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              
              <div className="text-sm text-muted-foreground space-y-1">
                <p><strong>Role:</strong> {inviteRole === 'subcontractor' ? 'Subcontractor' : 'Viewer'}</p>
                <p><strong>Expires:</strong> {inviteExpiry === 'never' ? 'Never' : inviteExpiry === '7days' ? 'In 7 days' : 'In 30 days'}</p>
              </div>

              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => setGeneratedInviteLink(null)}
              >
                Create Another Invite
              </Button>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Role</label>
                <Select value={inviteRole} onValueChange={(v: 'subcontractor' | 'viewer') => setInviteRole(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="subcontractor">Subcontractor</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Permissions</label>
                <div className="space-y-2">
                  {[
                    { id: 'view_job', label: 'View Job Details' },
                    { id: 'add_notes', label: 'Add Notes' },
                    { id: 'add_photos', label: 'Add Photos' },
                    { id: 'update_status', label: 'Update Status' },
                    { id: 'view_client', label: 'View Client Info' },
                  ].map((perm) => (
                    <label key={perm.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={invitePermissions.includes(perm.id)}
                        onChange={() => togglePermission(perm.id)}
                        className="rounded border-input"
                      />
                      <span className="text-sm">{perm.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Expires</label>
                <Select value={inviteExpiry} onValueChange={(v: 'never' | '7days' | '30days') => setInviteExpiry(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="never">Never</SelectItem>
                    <SelectItem value="7days">In 7 days</SelectItem>
                    <SelectItem value="30days">In 30 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Existing invites list */}
          {jobInvites && jobInvites.length > 0 && !generatedInviteLink && (
            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-2">Active Invites</p>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {jobInvites.filter(i => i.status === 'pending').map((invite) => (
                  <div key={invite.id} className="flex items-center justify-between p-2 bg-muted rounded-md text-sm">
                    <div>
                      <span className="font-medium capitalize">{invite.role}</span>
                      <span className="text-muted-foreground ml-2">
                        {invite.expiresAt 
                          ? `Expires ${format(new Date(invite.expiresAt), 'MMM d')}`
                          : 'No expiry'}
                      </span>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => revokeInviteMutation.mutate(invite.id)}
                      disabled={revokeInviteMutation.isPending}
                    >
                      <X className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteModal(false)}>
              {generatedInviteLink ? 'Done' : 'Cancel'}
            </Button>
            {!generatedInviteLink && (
              <Button 
                onClick={() => createInviteMutation.mutate()}
                disabled={createInviteMutation.isPending || invitePermissions.length === 0}
              >
                {createInviteMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Link2 className="h-4 w-4 mr-2" />
                    Generate Link
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {/* Quick Collect Payment Modal */}
      {linkedQuote && linkedQuote.status === 'accepted' && client && (
        <QuickCollectPayment
          open={showQuickCollect}
          onOpenChange={setShowQuickCollect}
          jobId={jobId}
          jobTitle={job?.title || 'Job'}
          quoteId={linkedQuote.id}
          quoteTotal={linkedQuote.total as string || '0'}
          quoteGst={(parseFloat(linkedQuote.total as string || '0') * 0.0909).toFixed(2)}
          clientName={client.name}
          clientId={client.id}
          onSuccess={(receiptId) => {
            navigate(`/receipts/${receiptId}`);
          }}
        />
      )}

      {/* Before Photo Prompt - shown when starting timer */}
      <BeforePhotoPrompt
        open={showBeforePhotoPrompt}
        onOpenChange={(open) => {
          setShowBeforePhotoPrompt(open);
          if (!open) {
            setPendingTimerStart(false);
          }
        }}
        jobId={jobId}
        jobTitle={job?.title || 'Job'}
        onComplete={() => {
          if (job?.title) {
            startTimerMutation.mutate({
              description: `Working on ${job.title}`,
              jobId: jobId,
              hourlyRate: '85.00',
            });
          }
          setShowBeforePhotoPrompt(false);
          setPendingTimerStart(false);
        }}
        onSkip={() => {
          if (job?.title) {
            startTimerMutation.mutate({
              description: `Working on ${job.title}`,
              jobId: jobId,
              hourlyRate: '85.00',
            });
          }
          setShowBeforePhotoPrompt(false);
          setPendingTimerStart(false);
        }}
      />

      {/* Unified Send Modal - Email + SMS side by side */}
      {client && (
        <UnifiedSendModal
          open={showUnifiedSendModal}
          onOpenChange={setShowUnifiedSendModal}
          documentType="job"
          documentId={jobId}
          recipientName={client.name}
          recipientEmail={client.email}
          recipientPhone={client.phone}
          documentTitle={job?.title}
          defaultTab={unifiedSendDefaultTab}
        />
      )}

      {/* Manual SMS Composer - fallback when Twilio not configured */}
      {client?.phone && (
        <ManualSmsComposer
          open={showManualSms}
          onOpenChange={setShowManualSms}
          recipientName={client.name}
          recipientPhone={client.phone}
        />
      )}

      {/* Log Site Update Dialog */}
      <Dialog open={showSiteUpdateDialog} onOpenChange={(open) => {
        setShowSiteUpdateDialog(open);
        if (!open) {
          setSiteUpdateNote('');
          setSiteUpdatePhoto(null);
          setSiteUpdatePhotoPreview(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenLine className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
              Log Site Update
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="What's happening on site right now?"
              value={siteUpdateNote}
              onChange={(e) => setSiteUpdateNote(e.target.value)}
              className="min-h-[100px]"
            />
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  className="gap-2"
                  onClick={() => document.getElementById('site-update-photo-input')?.click()}
                >
                  <Camera className="h-4 w-4" />
                  {siteUpdatePhoto ? 'Change Photo' : 'Add Photo (optional)'}
                </Button>
              </label>
              <input
                id="site-update-photo-input"
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleSiteUpdatePhotoChange}
              />
              {siteUpdatePhotoPreview && (
                <div className="relative">
                  <img
                    src={siteUpdatePhotoPreview}
                    alt="Preview"
                    className="w-full max-h-48 object-cover rounded-md"
                  />
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={() => {
                      setSiteUpdatePhoto(null);
                      setSiteUpdatePhotoPreview(null);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowSiteUpdateDialog(false);
                setSiteUpdateNote('');
                setSiteUpdatePhoto(null);
                setSiteUpdatePhotoPreview(null);
              }}
              disabled={isSiteUpdateSubmitting}
            >
              Cancel
            </Button>
            <Button
              style={{ backgroundColor: 'hsl(var(--trade))', color: 'white' }}
              onClick={handleSubmitSiteUpdate}
              disabled={!siteUpdateNote.trim() || isSiteUpdateSubmitting}
            >
              {isSiteUpdateSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Update'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
