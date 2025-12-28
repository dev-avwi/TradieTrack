import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CustomFormsPage } from "@/components/CustomFormBuilder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Mail,
  MessageSquare,
  ScrollText,
  Shield,
  Receipt,
  ClipboardList,
  CheckSquare,
  FileText,
  Plus,
  Pencil,
  Trash2,
  CheckCircle,
  Loader2,
  ChevronRight,
  ChevronDown,
  Eye,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { BusinessTemplate, BusinessTemplateFamily, BusinessTemplatePurpose } from "@shared/schema";
import { BUSINESS_TEMPLATE_PURPOSES } from "@shared/schema";
import { type LucideIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface TemplateFamilyMeta {
  family: BusinessTemplateFamily;
  count: number;
  activeTemplateId: string | null;
  activeTemplateName: string | null;
}

interface FamilyConfig {
  name: string;
  description: string;
  icon: LucideIcon;
  category: "communications" | "financial" | "jobs_safety";
}

const FAMILY_CONFIG: Record<BusinessTemplateFamily, FamilyConfig> = {
  email: {
    name: "Email Templates",
    description: "Customizable email templates for client communications",
    icon: Mail,
    category: "communications",
  },
  sms: {
    name: "SMS Templates",
    description: "Text message templates for quick updates",
    icon: MessageSquare,
    category: "communications",
  },
  terms_conditions: {
    name: "Terms & Conditions",
    description: "Standard terms included in quotes and invoices",
    icon: ScrollText,
    category: "financial",
  },
  warranty: {
    name: "Warranty Terms",
    description: "Warranty information for your work",
    icon: Shield,
    category: "financial",
  },
  payment_notice: {
    name: "Payment Notices",
    description: "Templates for payment reminders and overdue notices",
    icon: Receipt,
    category: "financial",
  },
  safety_form: {
    name: "Safety Forms",
    description: "Job site safety checklists and documentation",
    icon: ClipboardList,
    category: "jobs_safety",
  },
  checklist: {
    name: "Job Checklists",
    description: "Standard checklists for job completion",
    icon: CheckSquare,
    category: "jobs_safety",
  },
};

const CATEGORIES = {
  communications: { name: "Communications", families: ["email", "sms"] as BusinessTemplateFamily[] },
  financial: { name: "Financial", families: ["terms_conditions", "warranty", "payment_notice"] as BusinessTemplateFamily[] },
  jobs_safety: { name: "Jobs & Safety", families: ["safety_form", "checklist"] as BusinessTemplateFamily[] },
};

const PURPOSE_CONFIG: Record<BusinessTemplatePurpose, { label: string; family: 'email' | 'sms' | 'general' }> = {
  quote_sent: { label: "Quote Sent", family: 'email' },
  invoice_sent: { label: "Invoice Sent", family: 'email' },
  payment_reminder: { label: "Payment Reminder", family: 'email' },
  job_confirmation: { label: "Job Confirmation", family: 'email' },
  job_completed: { label: "Job Completed", family: 'email' },
  quote_accepted: { label: "Quote Accepted", family: 'email' },
  quote_declined: { label: "Quote Declined", family: 'email' },
  sms_quote_sent: { label: "Quote Sent", family: 'sms' },
  sms_invoice_sent: { label: "Invoice Sent", family: 'sms' },
  sms_payment_reminder: { label: "Payment Reminder", family: 'sms' },
  sms_job_confirmation: { label: "Job Confirmation", family: 'sms' },
  sms_job_completed: { label: "Job Completed", family: 'sms' },
  general: { label: "General", family: 'general' },
};

const getPurposesForFamily = (family: BusinessTemplateFamily): BusinessTemplatePurpose[] => {
  if (family === 'email') {
    return ['quote_sent', 'invoice_sent', 'payment_reminder', 'job_confirmation', 'job_completed', 'quote_accepted', 'quote_declined'];
  }
  if (family === 'sms') {
    return ['sms_quote_sent', 'sms_invoice_sent', 'sms_payment_reminder', 'sms_job_confirmation', 'sms_job_completed'];
  }
  return ['general'];
};

const SAMPLE_DATA: Record<string, string> = {
  client_name: "John Smith",
  business_name: "My Trade Business",
  quote_number: "Q-0001",
  invoice_number: "INV-0001",
  quote_total: "$1,250.00",
  invoice_total: "$1,250.00",
  job_title: "Kitchen Renovation",
  job_address: "123 Main St, Sydney NSW 2000",
  due_date: "15 Jan 2025",
  completion_date: "10 Jan 2025",
  warranty_months: "12",
  deposit_percent: "50",
  bank_details: "BSB: 123-456, Account: 12345678",
  days_overdue: "7",
  worker_name: "Mike Johnson",
  date: "27 Dec 2024",
};

function renderPreview(content: string): string {
  let preview = content;
  for (const [key, value] of Object.entries(SAMPLE_DATA)) {
    preview = preview.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return preview;
}

export default function TemplatesHub() {
  const { toast } = useToast();
  const [location] = useLocation();
  
  // Parse URL query params for auto-selecting tab
  const getInitialTab = () => {
    const searchParams = new URLSearchParams(window.location.search);
    const tabParam = searchParams.get('tab');
    if (tabParam && ['communications', 'financial', 'jobs_safety'].includes(tabParam)) {
      return tabParam;
    }
    return "communications";
  };
  
  const [activeTab, setActiveTab] = useState<string>(getInitialTab);
  const [expandedFamily, setExpandedFamily] = useState<BusinessTemplateFamily | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<BusinessTemplate | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    content: "",
    subject: "",
    purpose: "general" as BusinessTemplatePurpose,
  });

  const { data: familiesMeta = [], isLoading: familiesLoading, refetch: refetchFamilies } = useQuery<TemplateFamilyMeta[]>({
    queryKey: ["/api/business-templates/families"],
  });

  const { data: templates = [], isLoading: templatesLoading, refetch: refetchTemplates } = useQuery<BusinessTemplate[]>({
    queryKey: ["/api/business-templates"],
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/business-templates/seed");
    },
    onSuccess: () => {
      refetchFamilies();
      refetchTemplates();
    },
  });

  useEffect(() => {
    if (!familiesLoading && familiesMeta.length === 0) {
      seedMutation.mutate();
    }
  }, [familiesLoading, familiesMeta.length]);

  const createMutation = useMutation({
    mutationFn: async (data: { family: string; name: string; description?: string; content: string; subject?: string; purpose?: string }) => {
      return apiRequest("POST", "/api/business-templates", data);
    },
    onSuccess: () => {
      toast({ title: "Template created successfully" });
      setEditDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["/api/business-templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/business-templates/families"] });
    },
    onError: () => {
      toast({ title: "Failed to create template", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name?: string; description?: string; content?: string; subject?: string; purpose?: string } }) => {
      return apiRequest("PATCH", `/api/business-templates/${id}`, data);
    },
    onSuccess: () => {
      toast({ title: "Template updated successfully" });
      setEditDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["/api/business-templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/business-templates/families"] });
    },
    onError: () => {
      toast({ title: "Failed to update template", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/business-templates/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Template deleted successfully" });
      setDeleteDialogOpen(false);
      setSelectedTemplate(null);
      queryClient.invalidateQueries({ queryKey: ["/api/business-templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/business-templates/families"] });
    },
    onError: () => {
      toast({ title: "Failed to delete template", variant: "destructive" });
    },
  });

  const activateMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/business-templates/${id}/activate`);
    },
    onSuccess: () => {
      toast({ title: "Template set as active" });
      queryClient.invalidateQueries({ queryKey: ["/api/business-templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/business-templates/families"] });
    },
    onError: () => {
      toast({ title: "Failed to set active template", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({ name: "", description: "", content: "", subject: "", purpose: "general" });
    setSelectedTemplate(null);
    setIsCreating(false);
  };

  const openCreateDialog = (family: BusinessTemplateFamily) => {
    setIsCreating(true);
    setSelectedTemplate({ family } as BusinessTemplate);
    const defaultPurpose = getPurposesForFamily(family)[0] || 'general';
    setFormData({ name: "", description: "", content: "", subject: "", purpose: defaultPurpose });
    setEditDialogOpen(true);
  };

  const openEditDialog = (template: BusinessTemplate) => {
    setIsCreating(false);
    setSelectedTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || "",
      content: template.content,
      subject: template.subject || "",
      purpose: (template.purpose as BusinessTemplatePurpose) || "general",
    });
    setEditDialogOpen(true);
  };

  const handleSave = () => {
    if (!selectedTemplate) return;
    
    if (isCreating) {
      createMutation.mutate({
        family: selectedTemplate.family,
        name: formData.name,
        description: formData.description || undefined,
        content: formData.content,
        subject: formData.subject || undefined,
        purpose: formData.purpose,
      });
    } else {
      updateMutation.mutate({
        id: selectedTemplate.id,
        data: {
          name: formData.name,
          description: formData.description || undefined,
          content: formData.content,
          subject: formData.subject || undefined,
          purpose: formData.purpose,
        },
      });
    }
  };

  const handleDelete = () => {
    if (selectedTemplate) {
      deleteMutation.mutate(selectedTemplate.id);
    }
  };

  const getFamilyMeta = (family: BusinessTemplateFamily): TemplateFamilyMeta | undefined => {
    return familiesMeta.find((m) => m.family === family);
  };

  const getFamilyTemplates = (family: BusinessTemplateFamily): BusinessTemplate[] => {
    return templates.filter((t) => t.family === family);
  };

  const isLoading = familiesLoading || templatesLoading || seedMutation.isPending;

  if (isLoading) {
    return (
      <PageShell>
        <PageHeader
          title="Templates"
          subtitle="Manage all your business templates in one place"
          leading={<FileText className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />}
        />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Templates"
        subtitle="Manage all your business templates in one place"
        leading={<FileText className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="communications" data-testid="tab-communications">
            Communications
          </TabsTrigger>
          <TabsTrigger value="financial" data-testid="tab-financial">
            Financial
          </TabsTrigger>
          <TabsTrigger value="jobs_safety" data-testid="tab-jobs-safety">
            Jobs & Safety
          </TabsTrigger>
        </TabsList>

        {Object.entries(CATEGORIES).map(([categoryKey, category]) => (
          <TabsContent key={categoryKey} value={categoryKey} className="space-y-4">
            {categoryKey === "jobs_safety" ? (
              <>
                {/* Default Templates Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Default Templates</h3>
                  {category.families.map((family) => {
                    const config = FAMILY_CONFIG[family];
                    const meta = getFamilyMeta(family);
                    const familyTemplates = getFamilyTemplates(family);
                    const Icon = config.icon;
                    const isExpanded = expandedFamily === family;

                    return (
                      <Card key={family} className="hover-elevate" data-testid={`card-family-${family}`}>
                        <CardHeader
                          className="cursor-pointer"
                          onClick={() => setExpandedFamily(isExpanded ? null : family)}
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-10 h-10 rounded-lg flex items-center justify-center"
                                style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}
                              >
                                <Icon className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
                              </div>
                              <div>
                                <CardTitle className="text-lg">{config.name}</CardTitle>
                                <CardDescription>{config.description}</CardDescription>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <Badge variant="secondary" data-testid={`badge-count-${family}`}>
                                {meta?.count || 0} template{(meta?.count || 0) !== 1 ? "s" : ""}
                              </Badge>
                              {meta?.activeTemplateName && (
                                <Badge className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 border-0">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Active
                                </Badge>
                              )}
                              {isExpanded ? (
                                <ChevronDown className="h-5 w-5 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-5 w-5 text-muted-foreground" />
                              )}
                            </div>
                          </div>
                        </CardHeader>

                        {isExpanded && (
                          <CardContent className="pt-0">
                            <div className="border-t pt-4 space-y-3">
                              <div className="flex justify-between items-center mb-4">
                                <p className="text-sm text-muted-foreground">
                                  {familyTemplates.length === 0
                                    ? "No templates yet"
                                    : `${familyTemplates.length} template${familyTemplates.length !== 1 ? "s" : ""}`}
                                </p>
                                <Button
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openCreateDialog(family);
                                  }}
                                  data-testid={`button-create-${family}`}
                                >
                                  <Plus className="h-4 w-4 mr-1" />
                                  Create New
                                </Button>
                              </div>

                              {familyTemplates.map((template) => (
                                <div
                                  key={template.id}
                                  className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                                  data-testid={`template-item-${template.id}`}
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className="font-medium truncate">{template.name}</p>
                                      {template.isActive && (
                                        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 border-0" size="sm">
                                          Active
                                        </Badge>
                                      )}
                                      {template.isDefault && (
                                        <Badge variant="outline" size="sm">
                                          System Default
                                        </Badge>
                                      )}
                                    </div>
                                    {template.description && (
                                      <p className="text-sm text-muted-foreground truncate">
                                        {template.description}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 ml-3">
                                    {!template.isActive && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          activateMutation.mutate(template.id);
                                        }}
                                        disabled={activateMutation.isPending}
                                        data-testid={`button-activate-${template.id}`}
                                      >
                                        Set Active
                                      </Button>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openEditDialog(template);
                                      }}
                                      data-testid={`button-edit-${template.id}`}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    {!template.isDefault && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedTemplate(template);
                                          setDeleteDialogOpen(true);
                                        }}
                                        className="text-destructive hover:text-destructive"
                                        data-testid={`button-delete-${template.id}`}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        )}
                      </Card>
                    );
                  })}
                </div>

                {/* Custom Forms Builder Section */}
                <div className="border-t pt-6 mt-6">
                  <h3 className="text-lg font-semibold mb-4">Custom Forms Builder</h3>
                  <CustomFormsPage />
                </div>
              </>
            ) : (
              category.families.map((family) => {
                const config = FAMILY_CONFIG[family];
                const meta = getFamilyMeta(family);
                const familyTemplates = getFamilyTemplates(family);
                const Icon = config.icon;
                const isExpanded = expandedFamily === family;

                return (
                  <Card key={family} className="hover-elevate" data-testid={`card-family-${family}`}>
                    <CardHeader
                      className="cursor-pointer"
                      onClick={() => setExpandedFamily(isExpanded ? null : family)}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}
                          >
                            <Icon className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{config.name}</CardTitle>
                            <CardDescription>{config.description}</CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary" data-testid={`badge-count-${family}`}>
                            {meta?.count || 0} template{(meta?.count || 0) !== 1 ? "s" : ""}
                          </Badge>
                          {meta?.activeTemplateName && (
                            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 border-0">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Active
                            </Badge>
                          )}
                          {isExpanded ? (
                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </CardHeader>

                    {isExpanded && (
                      <CardContent className="pt-0">
                        <div className="border-t pt-4 space-y-3">
                          <div className="flex justify-between items-center mb-4">
                            <p className="text-sm text-muted-foreground">
                              {familyTemplates.length === 0
                                ? "No templates yet"
                                : `${familyTemplates.length} template${familyTemplates.length !== 1 ? "s" : ""}`}
                            </p>
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                openCreateDialog(family);
                              }}
                              data-testid={`button-create-${family}`}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Create New
                            </Button>
                          </div>

                          {familyTemplates.map((template) => (
                            <div
                              key={template.id}
                              className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                              data-testid={`template-item-${template.id}`}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-medium truncate">{template.name}</p>
                                  {(family === 'email' || family === 'sms') && template.purpose && template.purpose !== 'general' && (
                                    <Badge variant="secondary" size="sm">
                                      {PURPOSE_CONFIG[template.purpose as BusinessTemplatePurpose]?.label || template.purpose}
                                    </Badge>
                                  )}
                                  {template.isActive && (
                                    <Badge className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 border-0" size="sm">
                                      Active
                                    </Badge>
                                  )}
                                  {template.isDefault && (
                                    <Badge variant="outline" size="sm">
                                      System Default
                                    </Badge>
                                  )}
                                </div>
                                {template.description && (
                                  <p className="text-sm text-muted-foreground truncate">
                                    {template.description}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-2 ml-3">
                                {!template.isActive && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      activateMutation.mutate(template.id);
                                    }}
                                    disabled={activateMutation.isPending}
                                    data-testid={`button-activate-${template.id}`}
                                  >
                                    Set Active
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openEditDialog(template);
                                  }}
                                  data-testid={`button-edit-${template.id}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                {!template.isDefault && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedTemplate(template);
                                      setDeleteDialogOpen(true);
                                    }}
                                    data-testid={`button-delete-${template.id}`}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })
            )}
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={editDialogOpen} onOpenChange={(open) => {
        setEditDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>
              {isCreating ? "Create Template" : "Edit Template"}
            </DialogTitle>
            <DialogDescription>
              {isCreating
                ? `Create a new ${FAMILY_CONFIG[selectedTemplate?.family as BusinessTemplateFamily]?.name || "template"}`
                : `Edit your ${FAMILY_CONFIG[selectedTemplate?.family as BusinessTemplateFamily]?.name || "template"}`}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4 flex-1 overflow-y-auto min-h-0">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter template name"
                  data-testid="input-template-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of this template"
                  data-testid="input-template-description"
                />
              </div>

              {(selectedTemplate?.family === "email" || selectedTemplate?.family === "sms") && (
                <div className="space-y-2">
                  <Label htmlFor="purpose">Trigger / Purpose</Label>
                  <Select
                    value={formData.purpose}
                    onValueChange={(value) => setFormData({ ...formData, purpose: value as BusinessTemplatePurpose })}
                  >
                    <SelectTrigger data-testid="select-template-purpose">
                      <SelectValue placeholder="Select when this template is used" />
                    </SelectTrigger>
                    <SelectContent>
                      {getPurposesForFamily(selectedTemplate.family).map((purpose) => (
                        <SelectItem key={purpose} value={purpose}>
                          {PURPOSE_CONFIG[purpose]?.label || purpose}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Multiple templates can be active for different triggers
                  </p>
                </div>
              )}

              {(selectedTemplate?.family === "email" || selectedTemplate?.family === "sms") && (
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject Line</Label>
                  <Input
                    id="subject"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    placeholder="Email subject or SMS opening"
                    data-testid="input-template-subject"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="content">Content</Label>
                <Textarea
                  id="content"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Enter template content..."
                  rows={10}
                  className="resize-none"
                  data-testid="input-template-content"
                />
                <p className="text-xs text-muted-foreground">
                  Use variables like {"{client_name}"}, {"{job_title}"}, {"{quote_total}"} for dynamic content
                </p>
              </div>
            </div>

            <div className="flex flex-col rounded-lg border bg-muted/50 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted">
                <Eye className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">Live Preview</span>
              </div>
              <ScrollArea className="flex-1 p-4" data-testid="preview-panel">
                <div className="space-y-4">
                  {(selectedTemplate?.family === "email" || selectedTemplate?.family === "sms") && formData.subject && (
                    <div className="rounded-md border bg-background p-3">
                      <p className="text-xs text-muted-foreground mb-1">Subject</p>
                      <p className="font-medium">{renderPreview(formData.subject)}</p>
                    </div>
                  )}
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    {formData.content ? (
                      <div className="whitespace-pre-wrap">
                        {renderPreview(formData.content).split('\n').map((line, i) => {
                          if ((selectedTemplate?.family === "terms_conditions" || selectedTemplate?.family === "safety_form") && line.trim().endsWith(':')) {
                            return <p key={i} className="font-semibold mt-4 mb-2">{line}</p>;
                          }
                          if (line.trim().startsWith('- ') || line.trim().startsWith('• ')) {
                            return <p key={i} className="ml-4">{line}</p>;
                          }
                          if (line.trim().match(/^\d+\./)) {
                            return <p key={i} className="ml-4">{line}</p>;
                          }
                          return <p key={i} className="mb-2">{line || '\u00A0'}</p>;
                        })}
                      </div>
                    ) : (
                      <p className="text-muted-foreground italic">
                        Start typing to see a live preview of your template...
                      </p>
                    )}
                  </div>
                </div>
              </ScrollArea>
            </div>
          </div>

          <DialogFooter className="flex-shrink-0 border-t pt-4 mt-4">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!formData.name || !formData.content || createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-template"
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {isCreating ? "Create Template" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedTemplate?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
