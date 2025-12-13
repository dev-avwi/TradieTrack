import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Zap,
  Plus,
  ArrowRight,
  Mail,
  MessageSquare,
  FileText,
  Receipt,
  Bell,
  Clock,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Edit2,
  Play,
  Pause,
  ChevronRight,
  Briefcase,
  Settings,
  Timer
} from "lucide-react";

interface AutomationRule {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  trigger: {
    type: 'status_change' | 'time_delay' | 'no_response' | 'payment_received';
    entityType: 'job' | 'quote' | 'invoice';
    fromStatus?: string;
    toStatus?: string;
    delayDays?: number;
  };
  actions: Array<{
    type: 'send_email' | 'create_job' | 'create_invoice' | 'notification' | 'update_status';
    template?: string;
    message?: string;
    newStatus?: string;
  }>;
  createdAt: string;
}

const TRIGGER_TYPES = [
  { value: 'status_change', label: 'Status Changed', icon: ArrowRight, description: 'When a job/quote/invoice status changes' },
  { value: 'time_delay', label: 'Time Passed', icon: Clock, description: 'After a period of time' },
  { value: 'no_response', label: 'No Response', icon: AlertCircle, description: 'When client hasn\'t responded' },
  { value: 'payment_received', label: 'Payment Received', icon: CheckCircle2, description: 'When payment is made' },
];

const ACTION_TYPES = [
  { value: 'send_email', label: 'Send Email', icon: Mail },
  { value: 'create_job', label: 'Create Job', icon: Briefcase },
  { value: 'create_invoice', label: 'Create Invoice', icon: Receipt },
  { value: 'notification', label: 'Send Notification', icon: Bell },
  { value: 'update_status', label: 'Update Status', icon: Settings },
];

const JOB_STATUSES = ['pending', 'scheduled', 'in_progress', 'done', 'invoiced'];
const QUOTE_STATUSES = ['draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired'];
const INVOICE_STATUSES = ['draft', 'sent', 'viewed', 'paid', 'overdue', 'cancelled'];

const PRESET_AUTOMATIONS: Omit<AutomationRule, 'id' | 'createdAt'>[] = [
  {
    name: "Quote Accepted → Create Job",
    description: "Automatically create a job when a quote is accepted",
    isActive: false,
    trigger: {
      type: 'status_change',
      entityType: 'quote',
      toStatus: 'accepted',
    },
    actions: [
      { type: 'create_job' },
      { type: 'notification', message: 'A new job has been created from an accepted quote' },
    ],
  },
  {
    name: "Job Completed → Create Invoice",
    description: "Automatically create an invoice when a job is marked as done",
    isActive: false,
    trigger: {
      type: 'status_change',
      entityType: 'job',
      toStatus: 'done',
    },
    actions: [
      { type: 'create_invoice' },
      { type: 'send_email', template: 'job_completed' },
    ],
  },
  {
    name: "Quote Follow-up (3 days)",
    description: "Send a friendly follow-up email if quote not responded after 3 days",
    isActive: false,
    trigger: {
      type: 'no_response',
      entityType: 'quote',
      delayDays: 3,
    },
    actions: [
      { type: 'send_email', template: 'quote_followup' },
    ],
  },
  {
    name: "Quote Follow-up (5 days)",
    description: "Second follow-up email for quotes without response after 5 days",
    isActive: false,
    trigger: {
      type: 'no_response',
      entityType: 'quote',
      delayDays: 5,
    },
    actions: [
      { type: 'send_email', template: 'quote_followup_urgent' },
    ],
  },
  {
    name: "Quote Final Reminder (7 days)",
    description: "Final reminder before quote expires - creates urgency",
    isActive: false,
    trigger: {
      type: 'no_response',
      entityType: 'quote',
      delayDays: 7,
    },
    actions: [
      { type: 'send_email', template: 'quote_final_reminder' },
      { type: 'notification', message: 'Quote expires soon - may need follow-up call' },
    ],
  },
  {
    name: "Job Overdue Alert (1 day)",
    description: "Notify when a scheduled job passes its date without completion",
    isActive: false,
    trigger: {
      type: 'time_delay',
      entityType: 'job',
      delayDays: 1,
    },
    actions: [
      { type: 'notification', message: 'Job overdue: {job_title} was scheduled for {scheduled_date} but hasn\'t been completed' },
    ],
  },
  {
    name: "Job Overdue Alert (3 days)",
    description: "Escalated alert for jobs 3+ days overdue",
    isActive: false,
    trigger: {
      type: 'time_delay',
      entityType: 'job',
      delayDays: 3,
    },
    actions: [
      { type: 'notification', message: 'URGENT: Job {job_title} is 3+ days overdue!' },
      { type: 'send_email', template: 'job_overdue_internal' },
    ],
  },
  {
    name: "Invoice Reminder (7 days overdue)",
    description: "Send reminder when invoice is 7 days overdue",
    isActive: false,
    trigger: {
      type: 'time_delay',
      entityType: 'invoice',
      delayDays: 7,
    },
    actions: [
      { type: 'send_email', template: 'invoice_reminder' },
    ],
  },
  {
    name: "Invoice Final Notice (14 days)",
    description: "Final payment notice for invoices 14 days overdue",
    isActive: false,
    trigger: {
      type: 'time_delay',
      entityType: 'invoice',
      delayDays: 14,
    },
    actions: [
      { type: 'send_email', template: 'invoice_final_notice' },
      { type: 'notification', message: 'Invoice {invoice_number} is 14+ days overdue - may need follow-up call' },
    ],
  },
  {
    name: "Payment Received → Thank You",
    description: "Send thank you message when payment is received",
    isActive: false,
    trigger: {
      type: 'payment_received',
      entityType: 'invoice',
    },
    actions: [
      { type: 'send_email', template: 'payment_received' },
      { type: 'update_status', newStatus: 'paid' },
    ],
  },
  {
    name: "Job Scheduled → Confirmation",
    description: "Send confirmation when a job is scheduled",
    isActive: false,
    trigger: {
      type: 'status_change',
      entityType: 'job',
      toStatus: 'scheduled',
    },
    actions: [
      { type: 'send_email', template: 'job_confirmation' },
    ],
  },
  {
    name: "Job Starting Tomorrow → Reminder",
    description: "Send reminder to client the day before scheduled job",
    isActive: false,
    trigger: {
      type: 'time_delay',
      entityType: 'job',
      delayDays: -1,
    },
    actions: [
      { type: 'send_email', template: 'job_reminder' },
    ],
  },
];

function TriggerIcon({ type }: { type: string }) {
  const trigger = TRIGGER_TYPES.find(t => t.value === type);
  if (!trigger) return <Zap className="h-4 w-4" />;
  const Icon = trigger.icon;
  return <Icon className="h-4 w-4" />;
}

function ActionIcon({ type }: { type: string }) {
  const action = ACTION_TYPES.find(a => a.value === type);
  if (!action) return <Zap className="h-4 w-4" />;
  const Icon = action.icon;
  return <Icon className="h-4 w-4" />;
}

const EMAIL_TEMPLATES = [
  { value: 'quote_followup', label: 'Quote Follow-up' },
  { value: 'quote_followup_urgent', label: 'Quote Follow-up (Urgent)' },
  { value: 'quote_final_reminder', label: 'Quote Final Reminder' },
  { value: 'job_confirmation', label: 'Job Confirmation' },
  { value: 'job_reminder', label: 'Job Reminder' },
  { value: 'job_completed', label: 'Job Completed' },
  { value: 'job_overdue_internal', label: 'Job Overdue (Internal)' },
  { value: 'invoice_reminder', label: 'Invoice Reminder' },
  { value: 'invoice_final_notice', label: 'Invoice Final Notice' },
  { value: 'payment_received', label: 'Payment Received' },
];

interface FormAction {
  type: 'send_email' | 'create_job' | 'create_invoice' | 'notification' | 'update_status';
  template?: string;
  message?: string;
  newStatus?: string;
}

const initialFormState = {
  name: '',
  description: '',
  triggerType: 'status_change' as const,
  entityType: 'job' as const,
  fromStatus: '',
  toStatus: '',
  delayDays: 3,
  actions: [{ type: 'send_email' as const, template: '', message: '', newStatus: '' }] as FormAction[],
};

export default function Automations() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'available'>('active');
  const [formData, setFormData] = useState(initialFormState);
  const { toast } = useToast();

  const { data: automations = [], isLoading } = useQuery<AutomationRule[]>({
    queryKey: ['/api/automations'],
  });

  const toggleAutomationMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return apiRequest('PATCH', `/api/automations/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/automations'] });
      toast({
        title: "Automation updated",
        description: "The automation has been toggled",
      });
    },
  });

  const createAutomationMutation = useMutation({
    mutationFn: async (data: Omit<AutomationRule, 'id' | 'createdAt'>) => {
      return apiRequest('POST', '/api/automations', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/automations'] });
      setIsDialogOpen(false);
      toast({
        title: "Automation created",
        description: "Your new automation rule is ready",
      });
    },
  });

  const deleteAutomationMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/automations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/automations'] });
      toast({
        title: "Automation deleted",
        description: "The automation has been removed",
      });
    },
  });

  const handleAddPreset = (preset: Omit<AutomationRule, 'id' | 'createdAt'>) => {
    createAutomationMutation.mutate({ ...preset, isActive: true });
  };

  const resetForm = () => {
    setFormData(initialFormState);
  };

  const getStatusOptions = (entityType: string) => {
    switch (entityType) {
      case 'job': return JOB_STATUSES;
      case 'quote': return QUOTE_STATUSES;
      case 'invoice': return INVOICE_STATUSES;
      default: return [];
    }
  };

  const addAction = () => {
    setFormData(prev => ({
      ...prev,
      actions: [...prev.actions, { type: 'notification' as const, template: '', message: '', newStatus: '' }]
    }));
  };

  const removeAction = (index: number) => {
    if (formData.actions.length <= 1) return;
    setFormData(prev => ({
      ...prev,
      actions: prev.actions.filter((_, i) => i !== index)
    }));
  };

  const updateAction = (index: number, field: keyof FormAction, value: string) => {
    setFormData(prev => ({
      ...prev,
      actions: prev.actions.map((action, i) => 
        i === index ? { ...action, [field]: value } : action
      )
    }));
  };

  const handleCreateCustomAutomation = () => {
    if (!formData.name.trim()) {
      toast({ title: "Name required", description: "Please enter a name for your automation", variant: "destructive" });
      return;
    }
    
    const automationData: Omit<AutomationRule, 'id' | 'createdAt'> = {
      name: formData.name.trim(),
      description: formData.description.trim() || undefined,
      isActive: true,
      trigger: {
        type: formData.triggerType,
        entityType: formData.entityType,
        ...(formData.triggerType === 'status_change' && formData.fromStatus ? { fromStatus: formData.fromStatus } : {}),
        ...(formData.triggerType === 'status_change' && formData.toStatus ? { toStatus: formData.toStatus } : {}),
        ...((formData.triggerType === 'time_delay' || formData.triggerType === 'no_response') ? { delayDays: formData.delayDays } : {}),
      },
      actions: formData.actions.map(action => ({
        type: action.type,
        ...(action.type === 'send_email' && action.template ? { template: action.template } : {}),
        ...(action.type === 'notification' && action.message ? { message: action.message } : {}),
        ...(action.type === 'update_status' && action.newStatus ? { newStatus: action.newStatus } : {}),
      })),
    };
    
    createAutomationMutation.mutate(automationData, {
      onSuccess: () => resetForm()
    });
  };

  const activeAutomations = automations.filter(a => a.isActive);
  const inactiveAutomations = automations.filter(a => !a.isActive);

  const availablePresets = PRESET_AUTOMATIONS.filter(preset => 
    !automations.some(a => a.name === preset.name)
  );

  return (
    <PageShell data-testid="automations-page">
      <PageHeader
        title="Automations"
        subtitle="Set up automatic workflows to save time"
        action={
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-new-automation">
                <Plus className="h-4 w-4 mr-2" />
                New Automation
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle>Create Custom Automation</DialogTitle>
                <DialogDescription>
                  Build your own automation rule from scratch
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="flex-1 pr-4">
                <div className="space-y-6 py-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="automation-name">Automation Name</Label>
                      <Input
                        id="automation-name"
                        placeholder="e.g., Quote Follow-up After 5 Days"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        data-testid="input-automation-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="automation-description">Description (optional)</Label>
                      <Textarea
                        id="automation-description"
                        placeholder="What does this automation do?"
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        rows={2}
                        data-testid="input-automation-description"
                      />
                    </div>
                  </div>

                  <div className="border rounded-lg p-4 space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded bg-primary/10">
                        <Zap className="h-4 w-4 text-primary" />
                      </div>
                      <h3 className="font-medium">Trigger</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>When</Label>
                        <Select 
                          value={formData.triggerType} 
                          onValueChange={(v: typeof formData.triggerType) => setFormData(prev => ({ ...prev, triggerType: v }))}
                        >
                          <SelectTrigger data-testid="select-trigger-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TRIGGER_TYPES.map(t => (
                              <SelectItem key={t.value} value={t.value}>
                                <div className="flex items-center gap-2">
                                  <t.icon className="h-4 w-4" />
                                  {t.label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Entity</Label>
                        <Select 
                          value={formData.entityType} 
                          onValueChange={(v: typeof formData.entityType) => setFormData(prev => ({ ...prev, entityType: v, fromStatus: '', toStatus: '' }))}
                        >
                          <SelectTrigger data-testid="select-entity-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="job">Job</SelectItem>
                            <SelectItem value="quote">Quote</SelectItem>
                            <SelectItem value="invoice">Invoice</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {formData.triggerType === 'status_change' && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>From Status (optional)</Label>
                          <Select 
                            value={formData.fromStatus || "any"} 
                            onValueChange={(v) => setFormData(prev => ({ ...prev, fromStatus: v === "any" ? "" : v }))}
                          >
                            <SelectTrigger data-testid="select-from-status">
                              <SelectValue placeholder="Any status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="any">Any status</SelectItem>
                              {getStatusOptions(formData.entityType).map(s => (
                                <SelectItem key={s} value={s} className="capitalize">{s.replace('_', ' ')}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>To Status</Label>
                          <Select 
                            value={formData.toStatus} 
                            onValueChange={(v) => setFormData(prev => ({ ...prev, toStatus: v }))}
                          >
                            <SelectTrigger data-testid="select-to-status">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                              {getStatusOptions(formData.entityType).map(s => (
                                <SelectItem key={s} value={s} className="capitalize">{s.replace('_', ' ')}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}

                    {(formData.triggerType === 'time_delay' || formData.triggerType === 'no_response') && (
                      <div className="space-y-2">
                        <Label>After (days)</Label>
                        <Input
                          type="number"
                          min={1}
                          max={90}
                          value={formData.delayDays}
                          onChange={(e) => setFormData(prev => ({ ...prev, delayDays: parseInt(e.target.value) || 1 }))}
                          data-testid="input-delay-days"
                        />
                        <p className="text-xs text-muted-foreground">
                          {formData.triggerType === 'no_response' 
                            ? `Trigger after ${formData.delayDays} day(s) without client response` 
                            : `Trigger ${formData.delayDays} day(s) after the event`}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="border rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded bg-success/10">
                          <ArrowRight className="h-4 w-4 text-success" />
                        </div>
                        <h3 className="font-medium">Actions</h3>
                      </div>
                      <Button variant="outline" size="sm" onClick={addAction} data-testid="button-add-action">
                        <Plus className="h-4 w-4 mr-1" />
                        Add Action
                      </Button>
                    </div>

                    <div className="space-y-3">
                      {formData.actions.map((action, index) => (
                        <div key={index} className="border rounded-md p-3 space-y-3 bg-muted/30">
                          <div className="flex items-center justify-between gap-2">
                            <Select 
                              value={action.type} 
                              onValueChange={(v) => updateAction(index, 'type', v)}
                            >
                              <SelectTrigger className="flex-1" data-testid={`select-action-type-${index}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ACTION_TYPES.map(a => (
                                  <SelectItem key={a.value} value={a.value}>
                                    <div className="flex items-center gap-2">
                                      <a.icon className="h-4 w-4" />
                                      {a.label}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {formData.actions.length > 1 && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => removeAction(index)}
                                data-testid={`button-remove-action-${index}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>

                          {action.type === 'send_email' && (
                            <div className="space-y-2">
                              <Label>Email Template</Label>
                              <Select 
                                value={action.template || ""} 
                                onValueChange={(v) => updateAction(index, 'template', v)}
                              >
                                <SelectTrigger data-testid={`select-email-template-${index}`}>
                                  <SelectValue placeholder="Select template" />
                                </SelectTrigger>
                                <SelectContent>
                                  {EMAIL_TEMPLATES.map(t => (
                                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          {action.type === 'notification' && (
                            <div className="space-y-2">
                              <Label>Notification Message</Label>
                              <Textarea
                                placeholder="Enter notification message..."
                                value={action.message || ''}
                                onChange={(e) => updateAction(index, 'message', e.target.value)}
                                rows={2}
                                data-testid={`input-notification-message-${index}`}
                              />
                            </div>
                          )}

                          {action.type === 'update_status' && (
                            <div className="space-y-2">
                              <Label>New Status</Label>
                              <Select 
                                value={action.newStatus || ""} 
                                onValueChange={(v) => updateAction(index, 'newStatus', v)}
                              >
                                <SelectTrigger data-testid={`select-new-status-${index}`}>
                                  <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                  {getStatusOptions(formData.entityType).map(s => (
                                    <SelectItem key={s} value={s} className="capitalize">{s.replace('_', ' ')}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </ScrollArea>
              <DialogFooter className="flex gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }} data-testid="button-cancel-automation">
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateCustomAutomation} 
                  disabled={createAutomationMutation.isPending || !formData.name.trim()}
                  data-testid="button-save-automation"
                >
                  {createAutomationMutation.isPending ? "Creating..." : "Create Automation"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30">
                <Play className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeAutomations.length}</p>
                <p className="text-sm text-muted-foreground">Active Automations</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/30">
                <Pause className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{inactiveAutomations.length}</p>
                <p className="text-sm text-muted-foreground">Paused</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30">
                <Zap className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{availablePresets.length}</p>
                <p className="text-sm text-muted-foreground">Available Templates</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'active' | 'available')}>
        <TabsList>
          <TabsTrigger value="active" className="gap-2">
            <CheckCircle2 className="h-4 w-4" />
            My Automations
            {automations.length > 0 && (
              <Badge variant="secondary" className="ml-1">{automations.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="available" className="gap-2">
            <Plus className="h-4 w-4" />
            Templates
            {availablePresets.length > 0 && (
              <Badge variant="secondary" className="ml-1">{availablePresets.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4">
          {automations.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Zap className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No automations yet</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Add automation templates to streamline your workflow
                </p>
                <Button onClick={() => setActiveTab('available')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Browse Templates
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {automations.map((automation) => (
                <Card key={automation.id} data-testid={`automation-${automation.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div 
                          className={`p-2 rounded-full ${
                            automation.isActive 
                              ? 'bg-green-100 dark:bg-green-900/30' 
                              : 'bg-muted'
                          }`}
                        >
                          <Zap className={`h-5 w-5 ${
                            automation.isActive ? 'text-green-600' : 'text-muted-foreground'
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold">{automation.name}</h3>
                            <Badge 
                              variant={automation.isActive ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {automation.isActive ? 'Active' : 'Paused'}
                            </Badge>
                          </div>
                          {automation.description && (
                            <p className="text-sm text-muted-foreground mb-3">
                              {automation.description}
                            </p>
                          )}
                          
                          <div className="flex flex-wrap items-center gap-2 text-sm">
                            <div className="flex items-center gap-1 px-2 py-1 rounded bg-muted">
                              <TriggerIcon type={automation.trigger.type} />
                              <span className="capitalize">
                                {automation.trigger.entityType}
                                {automation.trigger.toStatus && ` → ${automation.trigger.toStatus}`}
                                {automation.trigger.delayDays && ` (${automation.trigger.delayDays} days)`}
                              </span>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            {automation.actions.map((action, idx) => (
                              <div 
                                key={idx}
                                className="flex items-center gap-1 px-2 py-1 rounded bg-primary/10"
                              >
                                <ActionIcon type={action.type} />
                                <span className="capitalize">{action.type.replace('_', ' ')}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={automation.isActive}
                          onCheckedChange={(checked) => 
                            toggleAutomationMutation.mutate({ 
                              id: automation.id, 
                              isActive: checked 
                            })
                          }
                          data-testid={`toggle-${automation.id}`}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteAutomationMutation.mutate(automation.id)}
                          data-testid={`delete-${automation.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="available" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            {PRESET_AUTOMATIONS.map((preset, idx) => {
              const isAdded = automations.some(a => a.name === preset.name);
              
              return (
                <Card 
                  key={idx}
                  className={isAdded ? 'opacity-60' : ''}
                  data-testid={`preset-${idx}`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-full bg-primary/10">
                          <Zap className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
                        </div>
                        <CardTitle className="text-base">{preset.name}</CardTitle>
                      </div>
                      {isAdded && (
                        <Badge variant="secondary">Added</Badge>
                      )}
                    </div>
                    <CardDescription>{preset.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap items-center gap-2 text-sm mb-4">
                      <div className="flex items-center gap-1 px-2 py-1 rounded bg-muted">
                        <TriggerIcon type={preset.trigger.type} />
                        <span className="capitalize">
                          {preset.trigger.entityType}
                          {preset.trigger.toStatus && ` → ${preset.trigger.toStatus}`}
                          {preset.trigger.delayDays && ` (${preset.trigger.delayDays} days)`}
                        </span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      {preset.actions.map((action, actionIdx) => (
                        <div 
                          key={actionIdx}
                          className="flex items-center gap-1 px-2 py-1 rounded bg-primary/10"
                        >
                          <ActionIcon type={action.type} />
                          <span className="capitalize">{action.type.replace('_', ' ')}</span>
                        </div>
                      ))}
                    </div>
                    
                    <Button
                      className="w-full"
                      variant={isAdded ? "secondary" : "default"}
                      disabled={isAdded || createAutomationMutation.isPending}
                      onClick={() => handleAddPreset(preset)}
                      data-testid={`add-preset-${idx}`}
                    >
                      {isAdded ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Already Added
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          Add Automation
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
