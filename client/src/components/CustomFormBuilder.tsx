import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
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
  Edit2,
  Eye,
  ChevronLeft,
  Upload,
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

function PreviewField({ field }: { field: FormField }) {
  if (field.type === 'section') {
    return (
      <div className="border-b pb-2 pt-4">
        <h3 className="font-semibold text-sm">{field.label}</h3>
      </div>
    );
  }

  const renderInput = () => {
    switch (field.type) {
      case 'text':
      case 'email':
      case 'phone':
      case 'number':
        return (
          <Input
            type={field.type === 'number' ? 'number' : 'text'}
            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
            className="h-12 rounded-xl"
            disabled
          />
        );
      case 'textarea':
        return (
          <Textarea
            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
            className="rounded-xl resize-none"
            rows={3}
            disabled
          />
        );
      case 'checkbox':
        return (
          <div className="flex items-center gap-3">
            <Checkbox disabled />
            <span className="text-sm text-muted-foreground">{field.placeholder || 'Check if applicable'}</span>
          </div>
        );
      case 'radio':
        return (
          <RadioGroup disabled className="space-y-2">
            {(field.options || ['Option 1', 'Option 2']).map((option, i) => (
              <div key={i} className="flex items-center gap-3">
                <RadioGroupItem value={option} id={`${field.id}-${i}`} disabled />
                <Label htmlFor={`${field.id}-${i}`} className="text-sm">{option}</Label>
              </div>
            ))}
          </RadioGroup>
        );
      case 'select':
        return (
          <Select disabled>
            <SelectTrigger className="h-12 rounded-xl">
              <SelectValue placeholder={field.placeholder || 'Select option'} />
            </SelectTrigger>
          </Select>
        );
      case 'date':
        return <Input type="date" className="h-12 rounded-xl" disabled />;
      case 'time':
        return <Input type="time" className="h-12 rounded-xl" disabled />;
      case 'photo':
        return (
          <div className="h-24 border-2 border-dashed rounded-xl flex items-center justify-center text-muted-foreground gap-2">
            <Upload className="h-5 w-5" />
            <span className="text-sm">Upload photo</span>
          </div>
        );
      case 'signature':
        return (
          <div className="h-24 border-2 border-dashed rounded-xl flex items-center justify-center text-muted-foreground">
            <PenTool className="h-5 w-5 mr-2" />
            <span className="text-sm">Signature</span>
          </div>
        );
      default:
        return <Input className="h-12 rounded-xl" disabled />;
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm">
        {field.label}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {field.description && (
        <p className="text-xs text-muted-foreground">{field.description}</p>
      )}
      {renderInput()}
    </div>
  );
}

function FormPreview({ fields, formName, requiresSignature }: { 
  fields: FormField[], 
  formName: string, 
  requiresSignature: boolean 
}) {
  return (
    <div className="p-4 lg:p-6">
      <div className="max-w-md mx-auto">
        <Card className="rounded-2xl overflow-hidden shadow-lg">
          <CardHeader className="pb-4">
            <h2 className="text-lg font-semibold">{formName || 'Untitled Form'}</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Add fields to see preview</p>
            ) : (
              fields.map(field => (
                <PreviewField key={field.id} field={field} />
              ))
            )}
            {requiresSignature && (
              <div className="border-t pt-4 mt-4">
                <Label className="text-sm">Customer Signature</Label>
                <div className="h-24 border-2 border-dashed rounded-xl mt-2 flex items-center justify-center text-muted-foreground">
                  <PenTool className="h-5 w-5 mr-2" />
                  Sign here
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

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
  const [mobileView, setMobileView] = useState<'edit' | 'preview'>('edit');
  const [addFieldSheetOpen, setAddFieldSheetOpen] = useState(false);

  const { data: existingForm, isLoading } = useQuery<CustomForm>({
    queryKey: ['/api/custom-forms', formId],
    enabled: isEditing,
  });

  useEffect(() => {
    if (existingForm) {
      setFormName(existingForm.name);
      setFormDescription(existingForm.description || "");
      setFormType(existingForm.formType || "general");
      setRequiresSignature(existingForm.requiresSignature || false);
      setFields((existingForm.fields as FormField[]) || []);
    }
  }, [existingForm]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('POST', '/api/custom-forms', data);
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
      return await apiRequest('PATCH', `/api/custom-forms/${formId}`, data);
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

  const generateId = () => `field_${crypto.randomUUID()}`;

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
    setAddFieldSheetOpen(false);
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
    <div className="h-full flex flex-col">
      {/* Tab switcher visible below xl breakpoint (1280px) */}
      <div className="xl:hidden border-b-2 bg-card sticky top-0 z-10 shadow-sm">
        <Tabs value={mobileView} onValueChange={(v) => setMobileView(v as 'edit' | 'preview')} className="w-full">
          <TabsList className="grid w-full grid-cols-2 gap-1 p-1.5 bg-muted/60">
            <TabsTrigger value="edit" className="gap-2 font-semibold rounded-lg data-[state=active]:shadow-md transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Edit2 className="h-4 w-4" />
              Edit
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-2 font-semibold rounded-lg data-[state=active]:shadow-md transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Eye className="h-4 w-4" />
              Preview
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Edit panel: visible when editing (below xl) or always on xl+ */}
        <div className={`flex-1 overflow-auto p-4 xl:p-6 ${mobileView === 'preview' ? 'hidden xl:block' : ''}`}>
          <div className="space-y-6 max-w-3xl">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Button type="button" variant="ghost" size="icon" onClick={onBack} className="rounded-xl" data-testid="button-back">
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <h1 className="ios-title text-xl font-semibold">{isEditing ? 'Edit Form' : 'New Form'}</h1>
              </div>
              <Badge 
                className="px-3 py-1.5 text-xs font-semibold" 
                style={{ backgroundColor: 'hsl(var(--trade) / 0.1)', color: 'hsl(var(--trade))', border: 'none' }}
              >
                {fields.length} fields
              </Badge>
            </div>

            <Card className="rounded-2xl overflow-hidden">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <FileText className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
                  Form Details
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="form-name">Form Name</Label>
                    <Input
                      id="form-name"
                      placeholder="e.g., Site Safety Checklist"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="h-12 rounded-xl"
                      data-testid="input-form-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="form-type">Form Type</Label>
                    <Select value={formType} onValueChange={setFormType}>
                      <SelectTrigger className="h-12 rounded-xl" data-testid="select-form-type">
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
                    className="rounded-xl resize-none"
                    data-testid="input-form-description"
                  />
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
                  <div className="space-y-0.5">
                    <Label>Require Signature</Label>
                    <p className="text-xs text-muted-foreground">Customer must sign after completing</p>
                  </div>
                  <Switch
                    checked={requiresSignature}
                    onCheckedChange={setRequiresSignature}
                    data-testid="switch-require-signature"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl overflow-hidden">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <ClipboardList className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
                    Form Fields
                  </div>
                  <Sheet open={addFieldSheetOpen} onOpenChange={setAddFieldSheetOpen}>
                    <SheetTrigger asChild>
                      <Button size="sm" className="rounded-xl xl:hidden" data-testid="button-add-field-mobile">
                        <Plus className="h-4 w-4 mr-1" />
                        Add Field
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl">
                      <SheetHeader>
                        <SheetTitle>Add Field</SheetTitle>
                      </SheetHeader>
                      <div className="grid grid-cols-2 gap-2 p-4 overflow-auto">
                        {FIELD_TYPES.map(fieldType => {
                          const Icon = fieldType.icon;
                          return (
                            <Button
                              key={fieldType.type}
                              variant="outline"
                              className="h-auto py-3 flex-col gap-2 rounded-xl"
                              onClick={() => addField(fieldType.type)}
                              data-testid={`button-add-${fieldType.type}-mobile`}
                            >
                              <div 
                                className="h-10 w-10 rounded-lg flex items-center justify-center" 
                                style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}
                              >
                                <Icon className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
                              </div>
                              <span className="text-sm font-medium">{fieldType.label}</span>
                            </Button>
                          );
                        })}
                      </div>
                    </SheetContent>
                  </Sheet>
                </div>
                
                {fields.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">No fields yet</p>
                    <p className="text-sm text-muted-foreground">Add fields to build your form</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {fields.map((field, index) => {
                      const FieldIcon = getFieldIcon(field.type);
                      return (
                        <div
                          key={field.id}
                          className="flex items-center gap-3 p-3 border rounded-xl bg-card hover-elevate cursor-pointer"
                          onClick={() => {
                            setEditingField(field);
                            setShowFieldDialog(true);
                          }}
                          data-testid={`field-item-${field.id}`}
                        >
                          <GripVertical className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                          <div 
                            className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
                            style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}
                          >
                            <FieldIcon className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium truncate">{field.label}</span>
                              {field.required && (
                                <Badge variant="secondary" className="text-xs shrink-0">Required</Badge>
                              )}
                            </div>
                            <span className="text-sm text-muted-foreground capitalize">{field.type}</span>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
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

            <div className="hidden xl:block">
              <Card className="rounded-2xl overflow-hidden">
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Plus className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
                    Add Field
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {FIELD_TYPES.map(fieldType => {
                      const Icon = fieldType.icon;
                      return (
                        <Button
                          key={fieldType.type}
                          variant="outline"
                          className="h-auto py-3 flex-col gap-2 rounded-xl"
                          onClick={() => addField(fieldType.type)}
                          data-testid={`button-add-${fieldType.type}`}
                        >
                          <div 
                            className="h-10 w-10 rounded-lg flex items-center justify-center" 
                            style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}
                          >
                            <Icon className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
                          </div>
                          <span className="text-sm font-medium">{fieldType.label}</span>
                        </Button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="sticky bottom-0 bg-background/95 backdrop-blur pt-4 pb-4 border-t -mx-4 px-4 xl:-mx-6 xl:px-6">
              <Button 
                onClick={handleSave} 
                disabled={createMutation.isPending || updateMutation.isPending} 
                className="w-full h-12 rounded-xl"
                data-testid="button-save-form"
              >
                <Save className="h-4 w-4 mr-2" />
                {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save Form'}
              </Button>
            </div>
          </div>
        </div>

        {/* Preview panel: visible when previewing (below xl) or always on xl+ */}
        <div className={`xl:w-[400px] border-l bg-muted/30 overflow-auto ${mobileView === 'edit' ? 'hidden xl:block' : ''}`}>
          <FormPreview fields={fields} formName={formName} requiresSignature={requiresSignature} />
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

  useEffect(() => {
    if (field) {
      // Deep clone to avoid mutating original field data
      setEditedField({ 
        ...field, 
        options: field.options ? [...field.options] : undefined,
        validation: field.validation ? { ...field.validation } : undefined,
      });
    }
  }, [field]);

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
      <DialogContent className="sm:max-w-md rounded-2xl">
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
              className="h-12 rounded-xl"
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
                className="h-12 rounded-xl"
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
                className="h-12 rounded-xl"
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
                      className="h-12 rounded-xl"
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
                    className="h-12 rounded-xl"
                    data-testid="input-new-option"
                  />
                  <Button variant="outline" size="icon" onClick={addOption} className="shrink-0 rounded-xl">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {editedField.type !== 'section' && (
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
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
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Cancel</Button>
          <Button onClick={handleSave} className="rounded-xl" data-testid="button-save-field">Save Field</Button>
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
      return await apiRequest('DELETE', `/api/custom-forms/${id}`);
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
        <Button onClick={onCreateNew} className="rounded-xl" data-testid="button-create-form">
          <Plus className="h-4 w-4 mr-2" />
          Create Form
        </Button>
      </div>

      {!forms || forms.length === 0 ? (
        <Card className="p-12 text-center rounded-2xl">
          <ClipboardList className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No forms yet</h3>
          <p className="text-muted-foreground mb-4">Create your first custom form template</p>
          <Button onClick={onCreateNew} className="rounded-xl">
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
                className="hover-elevate cursor-pointer rounded-2xl"
                onClick={() => onEdit(form.id)}
                data-testid={`form-card-${form.id}`}
              >
                <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-3">
                  <div 
                    className="h-12 w-12 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}
                  >
                    <Icon className="h-6 w-6" style={{ color: 'hsl(var(--trade))' }} />
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
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
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
