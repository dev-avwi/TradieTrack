import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { JobFormTemplate } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { EmptyState } from "@/components/ui/compact-card";
import { SearchBar, FilterChips } from "@/components/ui/filter-chips";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Plus, 
  FileText, 
  MoreVertical, 
  Edit, 
  Trash2,
  ChevronUp,
  ChevronDown,
  Copy,
  CheckCircle,
  XCircle,
  Type,
  AlignLeft,
  Hash,
  CheckSquare,
  List,
  Calendar,
  Camera,
  PenTool,
  FolderOpen,
  Layers,
  Store
} from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import KPIBox from "@/components/KPIBox";

const fieldTypeOptions = [
  { value: "text", label: "Text", icon: Type },
  { value: "textarea", label: "Text Area", icon: AlignLeft },
  { value: "number", label: "Number", icon: Hash },
  { value: "checkbox", label: "Checkbox", icon: CheckSquare },
  { value: "select", label: "Dropdown", icon: List },
  { value: "date", label: "Date", icon: Calendar },
  { value: "photo", label: "Photo", icon: Camera },
  { value: "signature", label: "Signature", icon: PenTool },
] as const;

const categoryOptions = [
  { value: "general", label: "General" },
  { value: "electrical", label: "Electrical" },
  { value: "plumbing", label: "Plumbing" },
  { value: "hvac", label: "HVAC" },
  { value: "carpentry", label: "Carpentry" },
  { value: "painting", label: "Painting" },
  { value: "roofing", label: "Roofing" },
  { value: "landscaping", label: "Landscaping" },
  { value: "other", label: "Other" },
];

const fieldSchema = z.object({
  id: z.string(),
  label: z.string().min(1, "Field label is required"),
  type: z.enum(["text", "textarea", "number", "checkbox", "select", "date", "photo", "signature"]),
  required: z.boolean().default(false),
  placeholder: z.string().optional(),
  options: z.array(z.string()).optional(),
});

const formTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  description: z.string().optional(),
  category: z.string().optional(),
  fields: z.array(fieldSchema).min(1, "At least one field is required"),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
});

type FormTemplateData = z.infer<typeof formTemplateSchema>;
type FieldData = z.infer<typeof fieldSchema>;

function FieldTypeIcon({ type }: { type: string }) {
  const option = fieldTypeOptions.find(o => o.value === type);
  const Icon = option?.icon || Type;
  return <Icon className="h-4 w-4" />;
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <Badge 
      variant="secondary" 
      className={cn(
        "gap-1",
        isActive 
          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" 
          : "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400"
      )}
    >
      {isActive ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {isActive ? "Active" : "Inactive"}
    </Badge>
  );
}

export default function JobForms() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<JobFormTemplate | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<JobFormTemplate | null>(null);
  const [optionsDialogOpen, setOptionsDialogOpen] = useState(false);
  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(null);
  const [tempOptions, setTempOptions] = useState<string>("");

  const { data: templates = [], isLoading } = useQuery<JobFormTemplate[]>({
    queryKey: ['/api/job-forms/templates'],
  });

  const form = useForm<FormTemplateData>({
    resolver: zodResolver(formTemplateSchema),
    defaultValues: {
      name: "",
      description: "",
      category: "general",
      fields: [{ id: crypto.randomUUID(), label: "", type: "text", required: false, placeholder: "" }],
      isActive: true,
      isDefault: false,
    },
  });

  const { fields, append, remove, move, update } = useFieldArray({
    control: form.control,
    name: "fields",
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (data: FormTemplateData) => {
      const response = await apiRequest("POST", "/api/job-forms/templates", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/job-forms/templates'] });
      toast({ title: "Template created", description: "Job form template has been created successfully" });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<FormTemplateData> }) => {
      const response = await apiRequest("PATCH", `/api/job-forms/templates/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/job-forms/templates'] });
      toast({ title: "Template updated", description: "Job form template has been updated successfully" });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/job-forms/templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/job-forms/templates'] });
      toast({ title: "Template deleted", description: "Job form template has been removed" });
      setDeleteDialogOpen(false);
      setTemplateToDelete(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const response = await apiRequest("PATCH", `/api/job-forms/templates/${id}`, { isActive });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/job-forms/templates'] });
      toast({ title: "Status updated", description: "Template status has been updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleOpenCreate = () => {
    setEditingTemplate(null);
    form.reset({
      name: "",
      description: "",
      category: "general",
      fields: [{ id: crypto.randomUUID(), label: "", type: "text", required: false, placeholder: "" }],
      isActive: true,
      isDefault: false,
    });
    setDialogOpen(true);
  };

  const handleOpenEdit = (template: JobFormTemplate) => {
    setEditingTemplate(template);
    const templateFields = (template.fields as FieldData[] || []).map(f => ({
      ...f,
      id: f.id || crypto.randomUUID(),
    }));
    form.reset({
      name: template.name,
      description: template.description || "",
      category: template.category || "general",
      fields: templateFields.length > 0 ? templateFields : [{ id: crypto.randomUUID(), label: "", type: "text" as const, required: false, placeholder: "" }],
      isActive: template.isActive ?? true,
      isDefault: template.isDefault ?? false,
    });
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingTemplate(null);
    form.reset();
  };

  const handleSubmit = (data: FormTemplateData) => {
    if (editingTemplate) {
      updateTemplateMutation.mutate({ id: editingTemplate.id, data });
    } else {
      createTemplateMutation.mutate(data);
    }
  };

  const handleDeleteClick = (template: JobFormTemplate) => {
    setTemplateToDelete(template);
    setDeleteDialogOpen(true);
  };

  const handleAddField = () => {
    append({ id: crypto.randomUUID(), label: "", type: "text", required: false, placeholder: "" });
  };

  const handleMoveFieldUp = (index: number) => {
    if (index > 0) {
      move(index, index - 1);
    }
  };

  const handleMoveFieldDown = (index: number) => {
    if (index < fields.length - 1) {
      move(index, index + 1);
    }
  };

  const handleOpenOptionsDialog = (index: number) => {
    const field = fields[index];
    setEditingFieldIndex(index);
    setTempOptions((field.options || []).join("\n"));
    setOptionsDialogOpen(true);
  };

  const handleSaveOptions = () => {
    if (editingFieldIndex !== null) {
      const options = tempOptions.split("\n").map(o => o.trim()).filter(o => o.length > 0);
      const currentField = fields[editingFieldIndex];
      update(editingFieldIndex, { ...currentField, options });
    }
    setOptionsDialogOpen(false);
    setEditingFieldIndex(null);
    setTempOptions("");
  };

  const handleDuplicateTemplate = (template: JobFormTemplate) => {
    setEditingTemplate(null);
    const templateFields = (template.fields as FieldData[] || []).map(f => ({
      ...f,
      id: crypto.randomUUID(),
    }));
    form.reset({
      name: `${template.name} (Copy)`,
      description: template.description || "",
      category: template.category || "general",
      fields: templateFields.length > 0 ? templateFields : [{ id: crypto.randomUUID(), label: "", type: "text" as const, required: false, placeholder: "" }],
      isActive: true,
      isDefault: false,
    });
    setDialogOpen(true);
  };

  const filteredTemplates = templates.filter((template) => {
    const matchesSearch = 
      template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (template.description?.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = categoryFilter === "all" || template.category === categoryFilter;
    const matchesStatus = statusFilter === "all" || 
      (statusFilter === "active" && template.isActive) ||
      (statusFilter === "inactive" && !template.isActive);
    
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const stats = {
    total: templates.length,
    active: templates.filter(t => t.isActive).length,
    inactive: templates.filter(t => !t.isActive).length,
    categories: new Set(templates.map(t => t.category).filter(Boolean)).size,
  };

  const categoryChips = [
    { id: 'all', label: 'All', count: stats.total, icon: <FileText className="h-3 w-3" /> },
    { id: 'active', label: 'Active', count: stats.active, icon: <CheckCircle className="h-3 w-3" /> },
    { id: 'inactive', label: 'Inactive', count: stats.inactive, icon: <XCircle className="h-3 w-3" /> },
  ];

  if (isLoading) {
    return (
      <PageShell data-testid="job-forms-page">
        <PageHeader title="Job Forms" subtitle="Loading..." />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell data-testid="job-forms-page">
      <PageHeader
        title="Job Forms"
        subtitle={`${templates.length} templates`}
        action={
          <div className="flex items-center gap-2">
            <Link href="/form-store">
              <Button 
                variant="outline"
                data-testid="button-form-store"
              >
                <Store className="h-4 w-4 mr-2" />
                Form Store
              </Button>
            </Link>
            <Button 
              onClick={handleOpenCreate} 
              data-testid="button-create-template"
              className="text-white font-medium"
              style={{ backgroundColor: 'hsl(var(--trade))', borderRadius: '12px' }}
            >
              <Plus className="h-4 w-4 mr-2" />
              New Template
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KPIBox
          title="Total Templates"
          value={stats.total}
          icon={FileText}
          data-testid="kpi-total-templates"
        />
        <KPIBox
          title="Active"
          value={stats.active}
          icon={CheckCircle}
          data-testid="kpi-active-templates"
        />
        <KPIBox
          title="Categories"
          value={stats.categories}
          icon={FolderOpen}
          data-testid="kpi-categories"
        />
      </div>

      <SearchBar
        value={searchTerm}
        onChange={setSearchTerm}
        placeholder="Search templates by name or description..."
      />

      <FilterChips 
        chips={categoryChips}
        activeId={statusFilter}
        onSelect={setStatusFilter}
      />

      {filteredTemplates.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={searchTerm || statusFilter !== "all" ? "No matching templates" : "No job form templates yet"}
          description={searchTerm || statusFilter !== "all" 
            ? "Try adjusting your search or filters" 
            : "Create custom forms for your jobs, or browse 50+ pre-made templates in the Form Store."}
          action={!searchTerm && statusFilter === "all" ? (
            <div className="flex flex-col sm:flex-row gap-2">
              <Link href="/form-store">
                <Button variant="outline" data-testid="button-empty-form-store">
                  <Store className="h-4 w-4 mr-2" />
                  Browse Form Store
                </Button>
              </Link>
              <Button onClick={handleOpenCreate} data-testid="button-empty-create-template">
                <Plus className="h-4 w-4 mr-2" />
                Create Custom Template
              </Button>
            </div>
          ) : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((template) => {
            const fieldCount = (template.fields as FieldData[] || []).length;
            return (
              <Card 
                key={template.id} 
                className="hover-elevate active-elevate-2"
                data-testid={`card-template-${template.id}`}
              >
                <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <CardTitle className="text-base truncate">{template.name}</CardTitle>
                      {template.isDefault && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">Default</Badge>
                      )}
                    </div>
                    {template.description && (
                      <CardDescription className="text-sm line-clamp-2">
                        {template.description}
                      </CardDescription>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 flex-shrink-0"
                        onClick={(e) => e.stopPropagation()}
                        data-testid={`button-template-actions-${template.id}`}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-xl">
                      <DropdownMenuItem 
                        onClick={() => handleOpenEdit(template)} 
                        data-testid={`button-edit-template-${template.id}`}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleDuplicateTemplate(template)} 
                        data-testid={`button-duplicate-template-${template.id}`}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleDeleteClick(template)} 
                        className="text-destructive"
                        data-testid={`button-delete-template-${template.id}`}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    {template.category && (
                      <Badge variant="outline" className="capitalize gap-1">
                        <FolderOpen className="h-3 w-3" />
                        {template.category}
                      </Badge>
                    )}
                    <Badge variant="secondary" className="gap-1">
                      <Layers className="h-3 w-3" />
                      {fieldCount} field{fieldCount !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <StatusBadge isActive={template.isActive ?? true} />
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {template.isActive ? "Active" : "Inactive"}
                      </span>
                      <Switch
                        checked={template.isActive ?? true}
                        onCheckedChange={(checked) => toggleStatusMutation.mutate({ id: template.id, isActive: checked })}
                        data-testid={`switch-template-status-${template.id}`}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "Edit Template" : "Create Template"}</DialogTitle>
            <DialogDescription>
              {editingTemplate 
                ? "Update the form template details and fields" 
                : "Create a new job form template with custom fields"}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Template Name</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g., Safety Checklist" 
                          {...field} 
                          data-testid="input-template-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || "general"}>
                        <FormControl>
                          <SelectTrigger data-testid="select-template-category">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categoryOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Describe what this form is used for..." 
                        {...field} 
                        data-testid="input-template-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <FormLabel className="text-base">Form Fields</FormLabel>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddField}
                    data-testid="button-add-field"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Field
                  </Button>
                </div>

                {form.formState.errors.fields?.root && (
                  <p className="text-sm text-destructive">{form.formState.errors.fields.root.message}</p>
                )}

                <div className="space-y-3">
                  {fields.map((field, index) => (
                    <Card key={field.id} className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="flex flex-col gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleMoveFieldUp(index)}
                              disabled={index === 0}
                              data-testid={`button-move-field-up-${index}`}
                            >
                              <ChevronUp className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleMoveFieldDown(index)}
                              disabled={index === fields.length - 1}
                              data-testid={`button-move-field-down-${index}`}
                            >
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="flex-1 grid gap-3 sm:grid-cols-3">
                            <FormField
                              control={form.control}
                              name={`fields.${index}.label`}
                              render={({ field: formField }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input 
                                      placeholder="Field label" 
                                      {...formField} 
                                      data-testid={`input-field-label-${index}`}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`fields.${index}.type`}
                              render={({ field: formField }) => (
                                <FormItem>
                                  <Select onValueChange={formField.onChange} value={formField.value}>
                                    <FormControl>
                                      <SelectTrigger data-testid={`select-field-type-${index}`}>
                                        <SelectValue placeholder="Type" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {fieldTypeOptions.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                          <div className="flex items-center gap-2">
                                            <option.icon className="h-4 w-4" />
                                            {option.label}
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`fields.${index}.placeholder`}
                              render={({ field: formField }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input 
                                      placeholder="Placeholder (optional)" 
                                      {...formField} 
                                      data-testid={`input-field-placeholder-${index}`}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <FormField
                              control={form.control}
                              name={`fields.${index}.required`}
                              render={({ field: formField }) => (
                                <FormItem className="flex items-center gap-2 space-y-0">
                                  <FormControl>
                                    <Checkbox
                                      checked={formField.value}
                                      onCheckedChange={formField.onChange}
                                      data-testid={`checkbox-field-required-${index}`}
                                    />
                                  </FormControl>
                                  <FormLabel className="text-xs font-normal">Required</FormLabel>
                                </FormItem>
                              )}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => remove(index)}
                              disabled={fields.length === 1}
                              data-testid={`button-remove-field-${index}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        {form.watch(`fields.${index}.type`) === "select" && (
                          <div className="ml-8">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenOptionsDialog(index)}
                              data-testid={`button-edit-options-${index}`}
                            >
                              <List className="h-4 w-4 mr-1" />
                              Edit Options ({(fields[index].options || []).length})
                            </Button>
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-6">
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-template-active"
                        />
                      </FormControl>
                      <FormLabel className="font-normal">Active</FormLabel>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="isDefault"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-template-default"
                        />
                      </FormControl>
                      <FormLabel className="font-normal">Set as default</FormLabel>
                      <FormDescription className="text-xs">(auto-attach to new jobs)</FormDescription>
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleCloseDialog}
                  data-testid="button-cancel-template"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending}
                  data-testid="button-save-template"
                >
                  {(createTemplateMutation.isPending || updateTemplateMutation.isPending) 
                    ? "Saving..." 
                    : editingTemplate ? "Update Template" : "Create Template"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={optionsDialogOpen} onOpenChange={setOptionsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Dropdown Options</DialogTitle>
            <DialogDescription>
              Enter each option on a new line
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={tempOptions}
            onChange={(e) => setTempOptions(e.target.value)}
            placeholder="Option 1&#10;Option 2&#10;Option 3"
            rows={8}
            data-testid="textarea-dropdown-options"
          />
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setOptionsDialogOpen(false)}
              data-testid="button-cancel-options"
            >
              Cancel
            </Button>
            <Button 
              type="button" 
              onClick={handleSaveOptions}
              data-testid="button-save-options"
            >
              Save Options
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{templateToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => templateToDelete && deleteTemplateMutation.mutate(templateToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteTemplateMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
