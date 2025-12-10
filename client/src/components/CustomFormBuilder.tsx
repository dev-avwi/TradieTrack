import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
  Plus,
  Trash2,
  GripVertical,
  Save,
  ArrowLeft,
  Type,
  Hash,
  Mail,
  Phone,
  AlignLeft,
  CheckSquare,
  Circle,
  List,
  Calendar,
  Clock,
  Camera,
  PenTool,
  Minus,
  MoreVertical,
  Copy,
  ChevronUp,
  ChevronDown,
  FileText,
  ClipboardList,
  Shield,
  Search,
} from "lucide-react";
import type { CustomForm } from "@shared/schema";

export interface FormField {
  id: string;
  type: 'text' | 'number' | 'email' | 'phone' | 'textarea' | 'checkbox' | 'radio' | 'select' | 'date' | 'time' | 'photo' | 'signature' | 'section';
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  description?: string;
  defaultValue?: string;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

const FIELD_TYPES = [
  { type: 'text' as const, label: 'Text', icon: Type, description: 'Single line text input' },
  { type: 'number' as const, label: 'Number', icon: Hash, description: 'Numeric input' },
  { type: 'email' as const, label: 'Email', icon: Mail, description: 'Email address' },
  { type: 'phone' as const, label: 'Phone', icon: Phone, description: 'Phone number' },
  { type: 'textarea' as const, label: 'Text Area', icon: AlignLeft, description: 'Multi-line text' },
  { type: 'checkbox' as const, label: 'Checkbox', icon: CheckSquare, description: 'Yes/No option' },
  { type: 'radio' as const, label: 'Radio', icon: Circle, description: 'Single choice from options' },
  { type: 'select' as const, label: 'Dropdown', icon: List, description: 'Dropdown selection' },
  { type: 'date' as const, label: 'Date', icon: Calendar, description: 'Date picker' },
  { type: 'time' as const, label: 'Time', icon: Clock, description: 'Time picker' },
  { type: 'photo' as const, label: 'Photo', icon: Camera, description: 'Photo capture/upload' },
  { type: 'signature' as const, label: 'Signature', icon: PenTool, description: 'Signature capture' },
  { type: 'section' as const, label: 'Section', icon: Minus, description: 'Header divider' },
];

const FORM_TYPES = [
  { value: 'general', label: 'General', icon: FileText },
  { value: 'safety', label: 'Safety', icon: Shield },
  { value: 'compliance', label: 'Compliance', icon: ClipboardList },
  { value: 'inspection', label: 'Inspection', icon: Search },
];

interface FormBuilderProps {
  formId?: string;
  onBack: () => void;
}

export function FormBuilder({ formId, onBack }: FormBuilderProps) {
  const { toast } = useToast();
  const isEditing = !!formId;

  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formType, setFormType] = useState("general");
  const [requiresSignature, setRequiresSignature] = useState(false);
  const [fields, setFields] = useState<FormField[]>([]);
  const [editingField, setEditingField] = useState<FormField | null>(null);
  const [showFieldDialog, setShowFieldDialog] = useState(false);

  const { data: existingForm, isLoading } = useQuery<CustomForm>({
    queryKey: ['/api/custom-forms', formId],
    enabled: isEditing,
  });

  useState(() => {
    if (existingForm) {
      setFormName(existingForm.name);
      setFormDescription(existingForm.description || "");
      setFormType(existingForm.formType || "general");
      setRequiresSignature(existingForm.requiresSignature || false);
      setFields((existingForm.fields as FormField[]) || []);
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('/api/custom-forms', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/custom-forms'] });
      toast({ title: "Form created", description: "Your custom form has been saved." });
      onBack();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest(`/api/custom-forms/${formId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/custom-forms'] });
      toast({ title: "Form updated", description: "Your changes have been saved." });
      onBack();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!formName.trim()) {
      toast({ title: "Name required", description: "Please enter a form name.", variant: "destructive" });
      return;
    }
    if (fields.length === 0) {
      toast({ title: "Fields required", description: "Please add at least one field.", variant: "destructive" });
      return;
    }

    const data = {
      name: formName,
      description: formDescription,
      formType,
      requiresSignature,
      fields,
      isActive: true,
    };

    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const generateId = () => `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const addField = (type: FormField['type']) => {
    const fieldType = FIELD_TYPES.find(f => f.type === type);
    const newField: FormField = {
      id: generateId(),
      type,
      label: fieldType?.label || 'New Field',
      required: false,
      options: type === 'radio' || type === 'select' ? ['Option 1', 'Option 2'] : undefined,
    };
    setFields([...fields, newField]);
    setEditingField(newField);
    setShowFieldDialog(true);
  };

  const updateField = (updatedField: FormField) => {
    setFields(fields.map(f => f.id === updatedField.id ? updatedField : f));
    setShowFieldDialog(false);
    setEditingField(null);
  };

  const deleteField = (fieldId: string) => {
    setFields(fields.filter(f => f.id !== fieldId));
  };

  const duplicateField = (field: FormField) => {
    const duplicate = { ...field, id: generateId(), label: `${field.label} (Copy)` };
    const index = fields.findIndex(f => f.id === field.id);
    const newFields = [...fields];
    newFields.splice(index + 1, 0, duplicate);
    setFields(newFields);
  };

  const moveField = (fieldId: string, direction: 'up' | 'down') => {
    const index = fields.findIndex(f => f.id === fieldId);
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === fields.length - 1)) {
      return;
    }
    const newFields = [...fields];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    [newFields[index], newFields[swapIndex]] = [newFields[swapIndex], newFields[index]];
    setFields(newFields);
  };

  const getFieldIcon = (type: FormField['type']) => {
    const fieldType = FIELD_TYPES.find(f => f.type === type);
    return fieldType ? fieldType.icon : Type;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">{isEditing ? 'Edit Form' : 'Create Form'}</h1>
            <p className="text-sm text-muted-foreground">Build your custom form template</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-form">
          <Save className="h-4 w-4 mr-2" />
          {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save Form'}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Form Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="form-name">Form Name</Label>
                  <Input
                    id="form-name"
                    placeholder="e.g., Site Safety Checklist"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    data-testid="input-form-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="form-type">Form Type</Label>
                  <Select value={formType} onValueChange={setFormType}>
                    <SelectTrigger data-testid="select-form-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FORM_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex items-center gap-2">
                            <type.icon className="h-4 w-4" />
                            {type.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="form-description">Description (Optional)</Label>
                <Textarea
                  id="form-description"
                  placeholder="Brief description of when to use this form..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={2}
                  data-testid="input-form-description"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Require Signature</Label>
                  <p className="text-sm text-muted-foreground">Customer must sign after completing</p>
                </div>
                <Switch
                  checked={requiresSignature}
                  onCheckedChange={setRequiresSignature}
                  data-testid="switch-require-signature"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-3">
              <div>
                <CardTitle className="text-lg">Form Fields</CardTitle>
                <CardDescription>Drag to reorder, click to edit</CardDescription>
              </div>
              <Badge variant="secondary">{fields.length} fields</Badge>
            </CardHeader>
            <CardContent>
              {fields.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">No fields yet</p>
                  <p className="text-sm text-muted-foreground">Add fields from the panel on the right</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {fields.map((field, index) => {
                    const FieldIcon = getFieldIcon(field.type);
                    return (
                      <div
                        key={field.id}
                        className="flex items-center gap-3 p-3 border rounded-lg bg-card hover-elevate cursor-pointer"
                        onClick={() => {
                          setEditingField(field);
                          setShowFieldDialog(true);
                        }}
                        data-testid={`field-item-${field.id}`}
                      >
                        <GripVertical className="h-4 w-4 text-muted-foreground/50" />
                        <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center">
                          <FieldIcon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{field.label}</span>
                            {field.required && <Badge variant="secondary" className="text-xs">Required</Badge>}
                          </div>
                          <span className="text-sm text-muted-foreground capitalize">{field.type}</span>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); moveField(field.id, 'up'); }} disabled={index === 0}>
                              <ChevronUp className="h-4 w-4 mr-2" />
                              Move Up
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); moveField(field.id, 'down'); }} disabled={index === fields.length - 1}>
                              <ChevronDown className="h-4 w-4 mr-2" />
                              Move Down
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); duplicateField(field); }}>
                              <Copy className="h-4 w-4 mr-2" />
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); deleteField(field.id); }} className="text-destructive">
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Add Field</CardTitle>
              <CardDescription>Click to add to form</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                <div className="p-4 space-y-1">
                  {FIELD_TYPES.map(fieldType => {
                    const Icon = fieldType.icon;
                    return (
                      <Button
                        key={fieldType.type}
                        variant="ghost"
                        className="w-full justify-start gap-3 h-auto py-3"
                        onClick={() => addField(fieldType.type)}
                        data-testid={`button-add-${fieldType.type}`}
                      >
                        <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="text-left">
                          <div className="font-medium">{fieldType.label}</div>
                          <div className="text-xs text-muted-foreground">{fieldType.description}</div>
                        </div>
                      </Button>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>

      <FieldEditDialog
        field={editingField}
        open={showFieldDialog}
        onOpenChange={setShowFieldDialog}
        onSave={updateField}
      />
    </div>
  );
}

interface FieldEditDialogProps {
  field: FormField | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (field: FormField) => void;
}

function FieldEditDialog({ field, open, onOpenChange, onSave }: FieldEditDialogProps) {
  const [editedField, setEditedField] = useState<FormField | null>(null);
  const [newOption, setNewOption] = useState("");

  useState(() => {
    if (field) {
      setEditedField({ ...field });
    }
  });

  const handleSave = () => {
    if (editedField) {
      onSave(editedField);
    }
  };

  const addOption = () => {
    if (newOption.trim() && editedField) {
      setEditedField({
        ...editedField,
        options: [...(editedField.options || []), newOption.trim()],
      });
      setNewOption("");
    }
  };

  const removeOption = (index: number) => {
    if (editedField) {
      const newOptions = [...(editedField.options || [])];
      newOptions.splice(index, 1);
      setEditedField({ ...editedField, options: newOptions });
    }
  };

  const updateOption = (index: number, value: string) => {
    if (editedField) {
      const newOptions = [...(editedField.options || [])];
      newOptions[index] = value;
      setEditedField({ ...editedField, options: newOptions });
    }
  };

  if (!editedField) return null;

  const hasOptions = editedField.type === 'radio' || editedField.type === 'select';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Field</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="field-label">Label</Label>
            <Input
              id="field-label"
              value={editedField.label}
              onChange={(e) => setEditedField({ ...editedField, label: e.target.value })}
              data-testid="input-field-label"
            />
          </div>
          
          {editedField.type !== 'section' && editedField.type !== 'checkbox' && (
            <div className="space-y-2">
              <Label htmlFor="field-placeholder">Placeholder (Optional)</Label>
              <Input
                id="field-placeholder"
                value={editedField.placeholder || ""}
                onChange={(e) => setEditedField({ ...editedField, placeholder: e.target.value })}
                data-testid="input-field-placeholder"
              />
            </div>
          )}

          {editedField.type !== 'section' && (
            <div className="space-y-2">
              <Label htmlFor="field-description">Help Text (Optional)</Label>
              <Input
                id="field-description"
                placeholder="Instructions for filling this field"
                value={editedField.description || ""}
                onChange={(e) => setEditedField({ ...editedField, description: e.target.value })}
                data-testid="input-field-description"
              />
            </div>
          )}

          {hasOptions && (
            <div className="space-y-2">
              <Label>Options</Label>
              <div className="space-y-2">
                {(editedField.options || []).map((option, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={option}
                      onChange={(e) => updateOption(index, e.target.value)}
                      data-testid={`input-option-${index}`}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeOption(index)}
                      className="shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Add option..."
                    value={newOption}
                    onChange={(e) => setNewOption(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addOption()}
                    data-testid="input-new-option"
                  />
                  <Button variant="outline" size="icon" onClick={addOption} className="shrink-0">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {editedField.type !== 'section' && (
            <div className="flex items-center justify-between">
              <Label htmlFor="field-required">Required</Label>
              <Switch
                id="field-required"
                checked={editedField.required || false}
                onCheckedChange={(checked) => setEditedField({ ...editedField, required: checked })}
                data-testid="switch-field-required"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} data-testid="button-save-field">Save Field</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface FormListProps {
  onCreateNew: () => void;
  onEdit: (formId: string) => void;
}

export function FormList({ onCreateNew, onEdit }: FormListProps) {
  const { toast } = useToast();

  const { data: forms, isLoading } = useQuery<CustomForm[]>({
    queryKey: ['/api/custom-forms'],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/custom-forms/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/custom-forms'] });
      toast({ title: "Form deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const getFormTypeIcon = (type: string) => {
    const formType = FORM_TYPES.find(t => t.value === type);
    return formType?.icon || FileText;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Custom Forms</h1>
          <p className="text-sm text-muted-foreground">Create and manage form templates for your jobs</p>
        </div>
        <Button onClick={onCreateNew} data-testid="button-create-form">
          <Plus className="h-4 w-4 mr-2" />
          Create Form
        </Button>
      </div>

      {!forms || forms.length === 0 ? (
        <Card className="p-12 text-center">
          <ClipboardList className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No forms yet</h3>
          <p className="text-muted-foreground mb-4">Create your first custom form template</p>
          <Button onClick={onCreateNew}>
            <Plus className="h-4 w-4 mr-2" />
            Create Form
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {forms.map(form => {
            const Icon = getFormTypeIcon(form.formType || 'general');
            const fieldCount = Array.isArray(form.fields) ? form.fields.length : 0;
            return (
              <Card 
                key={form.id} 
                className="hover-elevate cursor-pointer"
                onClick={() => onEdit(form.id)}
                data-testid={`form-card-${form.id}`}
              >
                <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(form.id); }}>
                        Edit Form
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(form.id); }}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>
                <CardContent>
                  <h3 className="font-medium truncate">{form.name}</h3>
                  {form.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{form.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-3">
                    <Badge variant="secondary" className="capitalize">{form.formType}</Badge>
                    <span className="text-sm text-muted-foreground">{fieldCount} fields</span>
                    {form.requiresSignature && (
                      <Badge variant="outline">
                        <PenTool className="h-3 w-3 mr-1" />
                        Sign
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function CustomFormsPage() {
  const [view, setView] = useState<'list' | 'create' | 'edit'>('list');
  const [editingFormId, setEditingFormId] = useState<string | null>(null);

  const handleEdit = (formId: string) => {
    setEditingFormId(formId);
    setView('edit');
  };

  const handleBack = () => {
    setView('list');
    setEditingFormId(null);
  };

  if (view === 'create') {
    return <FormBuilder onBack={handleBack} />;
  }

  if (view === 'edit' && editingFormId) {
    return <FormBuilder formId={editingFormId} onBack={handleBack} />;
  }

  return <FormList onCreateNew={() => setView('create')} onEdit={handleEdit} />;
}
