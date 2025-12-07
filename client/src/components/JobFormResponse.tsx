import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { format } from 'date-fns';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { JobFormTemplate, JobFormResponse as JobFormResponseType } from '@shared/schema';
import {
  FileText,
  Plus,
  Loader2,
  CalendarIcon,
  Camera,
  PenTool,
  ChevronDown,
  ChevronUp,
  Edit,
  Eye,
  CheckCircle,
  Clock,
  Trash2,
} from 'lucide-react';

interface FieldDefinition {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'checkbox' | 'select' | 'date' | 'photo' | 'signature';
  required?: boolean;
  placeholder?: string;
  options?: string[];
}

interface JobFormResponseProps {
  jobId: string;
  onSignatureRequest?: () => void;
}

export function JobFormResponse({ jobId, onSignatureRequest }: JobFormResponseProps) {
  const { toast } = useToast();
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<JobFormTemplate | null>(null);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingResponse, setEditingResponse] = useState<JobFormResponseType | null>(null);
  const [viewingResponse, setViewingResponse] = useState<JobFormResponseType | null>(null);
  const [expandedResponses, setExpandedResponses] = useState<Set<string>>(new Set());
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawingSignature, setIsDrawingSignature] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const { data: templates = [], isLoading: templatesLoading } = useQuery<JobFormTemplate[]>({
    queryKey: ['/api/job-forms/templates'],
  });

  const { data: responses = [], isLoading: responsesLoading } = useQuery<JobFormResponseType[]>({
    queryKey: ['/api/jobs', jobId, 'forms'],
  });

  const activeTemplates = templates.filter((t) => t.isActive);

  const { control, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm({
    defaultValues: {} as Record<string, any>,
  });

  const createResponseMutation = useMutation({
    mutationFn: async (data: { templateId: string; responses: Record<string, any>; photos?: string[] }) => {
      return apiRequest('POST', `/api/jobs/${jobId}/forms`, {
        ...data,
        userId: undefined,
        submittedAt: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'forms'] });
      toast({
        title: 'Form submitted',
        description: 'Your form response has been saved successfully.',
      });
      setFormDialogOpen(false);
      setSelectedTemplate(null);
      reset({});
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to submit form',
        variant: 'destructive',
      });
    },
  });

  const updateResponseMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { responses: Record<string, any> } }) => {
      return apiRequest('PATCH', `/api/jobs/${jobId}/forms/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'forms'] });
      toast({
        title: 'Form updated',
        description: 'Your form response has been updated.',
      });
      setFormDialogOpen(false);
      setEditingResponse(null);
      reset({});
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update form',
        variant: 'destructive',
      });
    },
  });

  const handleSelectTemplate = (template: JobFormTemplate) => {
    setSelectedTemplate(template);
    setShowTemplateSelector(false);
    const defaultValues: Record<string, any> = {};
    const fields = template.fields as FieldDefinition[] || [];
    fields.forEach((field) => {
      if (field.type === 'checkbox') {
        defaultValues[field.id] = false;
      } else if (field.type === 'number') {
        defaultValues[field.id] = '';
      } else {
        defaultValues[field.id] = '';
      }
    });
    reset(defaultValues);
    setFormDialogOpen(true);
  };

  const handleEditResponse = (response: JobFormResponseType) => {
    const template = templates.find((t) => t.id === response.templateId);
    if (template) {
      setEditingResponse(response);
      setSelectedTemplate(template);
      const responseData = response.responses as Record<string, any> || {};
      reset(responseData);
      setFormDialogOpen(true);
    }
  };

  const handleViewResponse = (response: JobFormResponseType) => {
    setViewingResponse(response);
  };

  const onSubmitForm = (formData: Record<string, any>) => {
    if (!selectedTemplate) return;

    const fields = selectedTemplate.fields as FieldDefinition[] || [];
    const missingRequired = fields.filter(
      (field) => field.required && (formData[field.id] === undefined || formData[field.id] === '' || formData[field.id] === null)
    );

    if (missingRequired.length > 0) {
      toast({
        title: 'Required fields missing',
        description: `Please fill in: ${missingRequired.map((f) => f.label).join(', ')}`,
        variant: 'destructive',
      });
      return;
    }

    if (editingResponse) {
      updateResponseMutation.mutate({
        id: editingResponse.id,
        data: { responses: formData },
      });
    } else {
      createResponseMutation.mutate({
        templateId: selectedTemplate.id,
        responses: formData,
      });
    }
  };

  const handleCloseDialog = () => {
    setFormDialogOpen(false);
    setSelectedTemplate(null);
    setEditingResponse(null);
    reset({});
    setHasSignature(false);
  };

  const toggleExpanded = (responseId: string) => {
    setExpandedResponses((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(responseId)) {
        newSet.delete(responseId);
      } else {
        newSet.add(responseId);
      }
      return newSet;
    });
  };

  const initializeSignatureCanvas = () => {
    if (signatureCanvasRef.current) {
      const canvas = signatureCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }
  };

  const getSignatureCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    } else {
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    }
  };

  const startDrawingSignature = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>, fieldId: string) => {
    e.preventDefault();
    const canvas = signatureCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    setIsDrawingSignature(true);
    setHasSignature(true);
    const { x, y } = getSignatureCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const drawSignature = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawingSignature) return;

    const canvas = signatureCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    const { x, y } = getSignatureCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawingSignature = () => {
    setIsDrawingSignature(false);
  };

  const clearSignatureCanvas = (fieldId: string) => {
    initializeSignatureCanvas();
    setHasSignature(false);
    setValue(fieldId, '');
  };

  const saveSignatureToField = (fieldId: string) => {
    if (signatureCanvasRef.current && hasSignature) {
      const dataUrl = signatureCanvasRef.current.toDataURL('image/png');
      setValue(fieldId, dataUrl);
    }
  };

  const renderFormField = (field: FieldDefinition) => {
    const isRequired = field.required;

    switch (field.type) {
      case 'text':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id} className="text-sm font-medium">
              {field.label}
              {isRequired && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Controller
              name={field.id}
              control={control}
              render={({ field: controllerField }) => (
                <Input
                  {...controllerField}
                  id={field.id}
                  placeholder={field.placeholder}
                  data-testid={`input-field-${field.id}`}
                />
              )}
            />
          </div>
        );

      case 'textarea':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id} className="text-sm font-medium">
              {field.label}
              {isRequired && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Controller
              name={field.id}
              control={control}
              render={({ field: controllerField }) => (
                <Textarea
                  {...controllerField}
                  id={field.id}
                  placeholder={field.placeholder}
                  rows={3}
                  data-testid={`textarea-field-${field.id}`}
                />
              )}
            />
          </div>
        );

      case 'number':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id} className="text-sm font-medium">
              {field.label}
              {isRequired && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Controller
              name={field.id}
              control={control}
              render={({ field: controllerField }) => (
                <Input
                  {...controllerField}
                  type="number"
                  id={field.id}
                  placeholder={field.placeholder}
                  onChange={(e) => controllerField.onChange(e.target.value ? Number(e.target.value) : '')}
                  data-testid={`input-number-field-${field.id}`}
                />
              )}
            />
          </div>
        );

      case 'checkbox':
        return (
          <div key={field.id} className="flex items-center space-x-3 py-2">
            <Controller
              name={field.id}
              control={control}
              render={({ field: controllerField }) => (
                <Checkbox
                  id={field.id}
                  checked={controllerField.value || false}
                  onCheckedChange={controllerField.onChange}
                  data-testid={`checkbox-field-${field.id}`}
                />
              )}
            />
            <Label htmlFor={field.id} className="text-sm font-medium cursor-pointer">
              {field.label}
              {isRequired && <span className="text-destructive ml-1">*</span>}
            </Label>
          </div>
        );

      case 'select':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id} className="text-sm font-medium">
              {field.label}
              {isRequired && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Controller
              name={field.id}
              control={control}
              render={({ field: controllerField }) => (
                <Select onValueChange={controllerField.onChange} value={controllerField.value || ''}>
                  <SelectTrigger data-testid={`select-field-${field.id}`}>
                    <SelectValue placeholder={field.placeholder || 'Select an option'} />
                  </SelectTrigger>
                  <SelectContent>
                    {(field.options || []).map((option, idx) => (
                      <SelectItem key={idx} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        );

      case 'date':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id} className="text-sm font-medium">
              {field.label}
              {isRequired && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Controller
              name={field.id}
              control={control}
              render={({ field: controllerField }) => (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !controllerField.value && 'text-muted-foreground'
                      )}
                      data-testid={`datepicker-field-${field.id}`}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {controllerField.value ? format(new Date(controllerField.value), 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={controllerField.value ? new Date(controllerField.value) : undefined}
                      onSelect={(date) => controllerField.onChange(date?.toISOString())}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              )}
            />
          </div>
        );

      case 'photo':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id} className="text-sm font-medium">
              {field.label}
              {isRequired && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Controller
              name={field.id}
              control={control}
              render={({ field: controllerField }) => (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          controllerField.onChange(file.name);
                        }
                      }}
                      className="hidden"
                      id={`photo-input-${field.id}`}
                      data-testid={`photo-input-${field.id}`}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById(`photo-input-${field.id}`)?.click()}
                      className="w-full"
                      data-testid={`button-upload-photo-${field.id}`}
                    >
                      <Camera className="h-4 w-4 mr-2" />
                      {controllerField.value ? 'Photo attached' : 'Take Photo'}
                    </Button>
                  </div>
                  {controllerField.value && (
                    <p className="text-xs text-muted-foreground">{controllerField.value}</p>
                  )}
                </div>
              )}
            />
          </div>
        );

      case 'signature':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id} className="text-sm font-medium">
              {field.label}
              {isRequired && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Controller
              name={field.id}
              control={control}
              render={({ field: controllerField }) => (
                <div className="space-y-2">
                  {controllerField.value ? (
                    <div className="border rounded-lg p-2 bg-white">
                      <img
                        src={controllerField.value}
                        alt="Signature"
                        className="max-h-32 mx-auto"
                        data-testid={`signature-preview-${field.id}`}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          controllerField.onChange('');
                          setHasSignature(false);
                        }}
                        className="w-full mt-2"
                        data-testid={`button-clear-signature-${field.id}`}
                      >
                        Clear & Re-sign
                      </Button>
                    </div>
                  ) : (
                    <div className="border rounded-lg p-2 bg-white">
                      <canvas
                        ref={signatureCanvasRef}
                        width={350}
                        height={120}
                        className="w-full border rounded cursor-crosshair touch-none"
                        onMouseDown={(e) => startDrawingSignature(e, field.id)}
                        onMouseMove={drawSignature}
                        onMouseUp={() => {
                          stopDrawingSignature();
                          saveSignatureToField(field.id);
                        }}
                        onMouseLeave={() => {
                          stopDrawingSignature();
                          saveSignatureToField(field.id);
                        }}
                        onTouchStart={(e) => startDrawingSignature(e, field.id)}
                        onTouchMove={drawSignature}
                        onTouchEnd={() => {
                          stopDrawingSignature();
                          saveSignatureToField(field.id);
                        }}
                        data-testid={`signature-canvas-${field.id}`}
                      />
                      <div className="flex items-center gap-2 mt-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => clearSignatureCanvas(field.id)}
                          className="flex-1"
                          data-testid={`button-reset-signature-${field.id}`}
                        >
                          Clear
                        </Button>
                        {onSignatureRequest && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={onSignatureRequest}
                            className="flex-1"
                            data-testid={`button-use-signature-capture-${field.id}`}
                          >
                            <PenTool className="h-3 w-3 mr-1" />
                            Full Capture
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            />
          </div>
        );

      default:
        return null;
    }
  };

  const renderResponseValue = (field: FieldDefinition, value: any) => {
    if (value === undefined || value === null || value === '') {
      return <span className="text-muted-foreground">-</span>;
    }

    switch (field.type) {
      case 'checkbox':
        return value ? (
          <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            <CheckCircle className="h-3 w-3 mr-1" />
            Yes
          </Badge>
        ) : (
          <Badge variant="secondary">No</Badge>
        );

      case 'date':
        return format(new Date(value), 'PPP');

      case 'signature':
        return value ? (
          <img src={value} alt="Signature" className="max-h-16 border rounded" />
        ) : (
          <span className="text-muted-foreground">Not signed</span>
        );

      case 'photo':
        return value ? (
          <Badge variant="secondary" className="gap-1">
            <Camera className="h-3 w-3" />
            {value}
          </Badge>
        ) : (
          <span className="text-muted-foreground">No photo</span>
        );

      default:
        return <span>{String(value)}</span>;
    }
  };

  const getTemplateById = (templateId: string) => {
    return templates.find((t) => t.id === templateId);
  };

  const isLoading = templatesLoading || responsesLoading;

  if (isLoading) {
    return (
      <Card data-testid="card-job-forms-loading">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Job Forms
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-job-forms">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Job Forms
            </CardTitle>
            <CardDescription>
              {responses.length > 0
                ? `${responses.length} form${responses.length !== 1 ? 's' : ''} submitted`
                : 'Fill out forms for this job'}
            </CardDescription>
          </div>
          {activeTemplates.length > 0 && (
            <Button
              size="sm"
              onClick={() => setShowTemplateSelector(true)}
              data-testid="button-add-form"
            >
              <Plus className="h-4 w-4 mr-2" />
              Fill Form
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {activeTemplates.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No form templates available</p>
            <p className="text-xs mt-1">Create templates in Settings to use here</p>
          </div>
        ) : responses.length === 0 ? (
          <div className="text-center py-6">
            <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
            <p className="text-sm text-muted-foreground mb-3">No forms filled out yet</p>
            <Button
              variant="outline"
              onClick={() => setShowTemplateSelector(true)}
              data-testid="button-fill-first-form"
            >
              <Plus className="h-4 w-4 mr-2" />
              Fill Out a Form
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {responses.map((response) => {
              const template = getTemplateById(response.templateId);
              const isExpanded = expandedResponses.has(response.id);
              const responseData = response.responses as Record<string, any> || {};
              const fields = (template?.fields as FieldDefinition[]) || [];

              return (
                <div
                  key={response.id}
                  className="border rounded-lg overflow-hidden"
                  data-testid={`response-item-${response.id}`}
                >
                  <div
                    className="flex items-center justify-between gap-2 p-3 hover:bg-accent/50 cursor-pointer"
                    onClick={() => toggleExpanded(response.id)}
                    data-testid={`response-header-${response.id}`}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{template?.name || 'Unknown Form'}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {response.submittedAt && format(new Date(response.submittedAt), 'PPp')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditResponse(response);
                        }}
                        data-testid={`button-edit-response-${response.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t p-3 bg-muted/30 space-y-2">
                      {fields.map((field) => (
                        <div key={field.id} className="grid grid-cols-2 gap-2 text-sm">
                          <span className="text-muted-foreground">{field.label}:</span>
                          <span>{renderResponseValue(field, responseData[field.id])}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={showTemplateSelector} onOpenChange={setShowTemplateSelector}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select Form Template</DialogTitle>
            <DialogDescription>
              Choose a form template to fill out for this job
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {activeTemplates.map((template) => (
              <button
                key={template.id}
                className="w-full p-3 text-left border rounded-lg hover:bg-accent/50 transition-colors"
                onClick={() => handleSelectTemplate(template)}
                data-testid={`button-select-template-${template.id}`}
              >
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{template.name}</p>
                    {template.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                        {template.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      {template.category && (
                        <Badge variant="outline" className="text-xs capitalize">
                          {template.category}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {((template.fields as FieldDefinition[]) || []).length} fields
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={formDialogOpen} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingResponse ? 'Edit Form Response' : selectedTemplate?.name}
            </DialogTitle>
            <DialogDescription>
              {editingResponse
                ? 'Update your form response below'
                : selectedTemplate?.description || 'Fill out the form fields below'}
            </DialogDescription>
          </DialogHeader>
          {selectedTemplate && (
            <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-4">
              {((selectedTemplate.fields as FieldDefinition[]) || []).map((field) => renderFormField(field))}
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseDialog}
                  data-testid="button-cancel-form"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createResponseMutation.isPending || updateResponseMutation.isPending}
                  data-testid="button-submit-form"
                >
                  {(createResponseMutation.isPending || updateResponseMutation.isPending) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {editingResponse ? 'Update' : 'Submit'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingResponse} onOpenChange={(open) => !open && setViewingResponse(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Form Response</DialogTitle>
          </DialogHeader>
          {viewingResponse && (
            <div className="space-y-3">
              {(() => {
                const template = getTemplateById(viewingResponse.templateId);
                const fields = (template?.fields as FieldDefinition[]) || [];
                const responseData = viewingResponse.responses as Record<string, any> || {};

                return fields.map((field) => (
                  <div key={field.id}>
                    <p className="text-sm font-medium text-muted-foreground">{field.label}</p>
                    <div className="mt-1">{renderResponseValue(field, responseData[field.id])}</div>
                  </div>
                ));
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
