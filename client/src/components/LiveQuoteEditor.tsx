import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useClients } from "@/hooks/use-clients";
import { useCreateQuote } from "@/hooks/use-quotes";
import { useBusinessSettings } from "@/hooks/use-business-settings";
import { useDocumentTemplates, type DocumentTemplate } from "@/hooks/use-templates";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import LiveDocumentPreview from "./LiveDocumentPreview";
import CatalogModal from "@/components/CatalogModal";
import RecentJobPicker from "@/components/RecentJobPicker";
import QuoteRevisions from "./QuoteRevisions";
import {
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  Eye,
  FileText,
  User,
  Calendar,
  Package,
  BookOpen,
  ChevronLeft,
  Check,
  DollarSign,
  Percent,
  Briefcase,
  History
} from "lucide-react";

const lineItemSchema = z.object({
  description: z.string().min(1, "Description required"),
  quantity: z.string().min(1, "Quantity required"),
  unitPrice: z.string().min(1, "Price required"),
});

const quoteFormSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  validUntil: z.string().min(1, "Valid until date is required"),
  notes: z.string().optional(),
  depositRequired: z.boolean().default(false),
  depositPercent: z.number().min(0).max(100).default(50),
  lineItems: z.array(lineItemSchema).min(1, "At least one line item required"),
});

type QuoteFormData = z.infer<typeof quoteFormSchema>;

interface LiveQuoteEditorProps {
  quoteId?: string;
  onSave?: (quoteId: string) => void;
  onCancel?: () => void;
}

export default function LiveQuoteEditor({ quoteId, onSave, onCancel }: LiveQuoteEditorProps) {
  const { toast } = useToast();
  const { data: clients = [] } = useClients();
  const { data: businessSettings } = useBusinessSettings();
  const createQuoteMutation = useCreateQuote();
  const isEditMode = !!quoteId;

  const { data: existingQuote, isLoading: quoteLoading } = useQuery({
    queryKey: ['/api/quotes', quoteId],
    enabled: !!quoteId,
  });

  const { data: revisions = [] } = useQuery<any[]>({
    queryKey: ['/api/quotes', quoteId, 'revisions'],
    enabled: !!quoteId,
  });

  const updateQuoteMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("PATCH", `/api/quotes/${quoteId}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quotes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/quotes', quoteId] });
    },
  });

  const createRevisionMutation = useMutation({
    mutationFn: async (notes?: string) => {
      const response = await apiRequest("POST", `/api/quotes/${quoteId}/revisions`, { notes });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quotes', quoteId, 'revisions'] });
    },
  });
  
  // Read jobId from URL query parameters (e.g., /quotes/new?jobId=123)
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const urlJobId = urlParams.get('jobId');
  
  const [mobileView, setMobileView] = useState<'edit' | 'preview'>('edit');
  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ description: "", quantity: "1", unitPrice: "" });
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [templateSheetOpen, setTemplateSheetOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | undefined>(urlJobId || undefined);
  const [jobAutoLoaded, setJobAutoLoaded] = useState(false);

  const { data: userCheck } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (!res.ok) throw new Error('Not authenticated');
      return res.json();
    },
    retry: false,
    staleTime: 30000,
  });

  // Fetch job data if jobId is provided in URL
  const { data: preloadedJob, isLoading: jobLoading } = useQuery({
    queryKey: ['/api/jobs', urlJobId],
    enabled: !!urlJobId && !jobAutoLoaded,
  });

  const form = useForm<QuoteFormData>({
    resolver: zodResolver(quoteFormSchema),
    defaultValues: {
      clientId: "",
      title: "",
      description: "",
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: "",
      depositRequired: false,
      depositPercent: 50,
      lineItems: [],
    },
  });

  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: "lineItems"
  });

  // Auto-fill form when editing an existing quote
  const [quoteLoaded, setQuoteLoaded] = useState(false);
  useEffect(() => {
    if (existingQuote && !quoteLoaded && clients.length > 0) {
      setQuoteLoaded(true);
      const quote = existingQuote as any;
      
      form.setValue("clientId", quote.clientId || "");
      form.setValue("title", quote.title || "");
      form.setValue("description", quote.description || "");
      form.setValue("notes", quote.notes || "");
      
      if (quote.validUntil) {
        form.setValue("validUntil", new Date(quote.validUntil).toISOString().split('T')[0]);
      }
      
      if (quote.depositPercent && Number(quote.depositPercent) > 0) {
        form.setValue("depositRequired", true);
        form.setValue("depositPercent", Number(quote.depositPercent));
      }
      
      if (quote.lineItems && quote.lineItems.length > 0) {
        const items = quote.lineItems.map((item: any) => ({
          description: item.description || "",
          quantity: String(item.quantity || 1),
          unitPrice: String(item.unitPrice || 0),
        }));
        form.setValue("lineItems", items);
      }
    }
  }, [existingQuote, quoteLoaded, clients, form]);

  // Auto-fill form when job is loaded from URL parameter
  useEffect(() => {
    if (preloadedJob && !jobAutoLoaded && clients.length > 0 && !isEditMode) {
      setJobAutoLoaded(true);
      const job = preloadedJob as any;
      
      // Set client
      if (job.clientId) {
        form.setValue("clientId", job.clientId);
      }
      
      // Set title and description from job
      form.setValue("title", job.title || "");
      form.setValue("description", job.description || "");
      
      toast({
        title: "Job details loaded",
        description: `Creating quote for "${job.title}"`,
      });
    }
  }, [preloadedJob, jobAutoLoaded, clients, form, toast, isEditMode]);

  const watchedValues = form.watch();
  const selectedClient = (clients as any[]).find(c => c.id === watchedValues.clientId);

  // Prefill form from selected job (and optionally copy from existing quote)
  const handleSelectJob = (job: any, linkedDocument?: any) => {
    setSelectedJobId(job.id);
    
    // Set client
    if (job.client?.id) {
      form.setValue("clientId", job.client.id);
    }
    
    // If job already has a linked quote, copy from it
    if (linkedDocument) {
      form.setValue("title", linkedDocument.title || job.title || "");
      form.setValue("description", linkedDocument.description || job.description || "");
      form.setValue("notes", linkedDocument.notes || linkedDocument.terms || "");
      
      if (linkedDocument.depositPercent) {
        form.setValue("depositRequired", true);
        form.setValue("depositPercent", linkedDocument.depositPercent);
      }
      
      // Copy line items from existing quote
      if (linkedDocument.lineItems && linkedDocument.lineItems.length > 0) {
        const items = linkedDocument.lineItems.map((item: any) => ({
          description: item.description || "",
          quantity: String(item.quantity || item.qty || 1),
          unitPrice: String(item.unitPrice || 0),
        }));
        form.setValue("lineItems", items);
      }
      
      toast({
        title: "Copied from existing quote",
        description: `Quote data copied from "${job.title}"`,
      });
      return;
    }
    
    // Otherwise, create from job details
    form.setValue("title", job.title || "");
    form.setValue("description", job.description || "");
    
    // Clear existing line items and add job-based items
    form.setValue("lineItems", []);
    
    // If job has time tracking, add a labor line item
    if (job.timeTracking?.totalHours > 0) {
      const hourlyRate = businessSettings?.defaultHourlyRate || 85;
      form.setValue("lineItems", [{
        description: `Labour - ${job.title}`,
        quantity: String(job.timeTracking.totalHours),
        unitPrice: String(hourlyRate),
      }]);
    }
    
    toast({
      title: "Job loaded",
      description: `Quote prefilled from "${job.title}"`,
    });
  };

  const handleApplyTemplate = (template: DocumentTemplate) => {
    form.setValue("title", template.defaults?.title || "");
    form.setValue("description", template.defaults?.description || "");
    form.setValue("notes", template.defaults?.terms || "");
    
    if (template.defaults?.depositPct) {
      form.setValue("depositRequired", true);
      form.setValue("depositPercent", template.defaults.depositPct);
    }
    
    if (template.defaultLineItems) {
      const items = template.defaultLineItems.map((item: any) => ({
        description: item.description,
        quantity: String(item.qty || 1),
        unitPrice: String(item.unitPrice || 0),
      }));
      form.setValue("lineItems", items);
    }
    
    setTemplateSheetOpen(false);
    toast({
      title: "Template applied",
      description: `"${template.name}" template has been applied`,
    });
  };

  const handleAddLineItem = () => {
    setEditForm({ description: "", quantity: "1", unitPrice: "" });
    setEditingLineIndex(-1);
  };

  const handleEditLineItem = (index: number) => {
    const item = watchedValues.lineItems[index];
    setEditForm({
      description: item.description || "",
      quantity: String(item.quantity || "1"),
      unitPrice: String(item.unitPrice || "")
    });
    setEditingLineIndex(index);
  };

  const handleSaveLineItem = () => {
    if (!editForm.description.trim()) {
      toast({
        title: "Description required",
        description: "Please enter a description for this item",
        variant: "destructive"
      });
      return;
    }

    if (editingLineIndex === -1) {
      append(editForm);
    } else if (editingLineIndex !== null) {
      update(editingLineIndex, editForm);
    }
    setEditingLineIndex(null);
  };

  const handleCatalogSelect = (item: any) => {
    append({
      description: item.description,
      quantity: String(item.defaultQuantity || 1),
      unitPrice: String(item.unitPrice || 0),
    });
    setCatalogOpen(false);
    toast({
      title: "Item added",
      description: `"${item.description}" added to quote`,
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(amount);
  };

  const calculateTotal = (quantity: string, unitPrice: string) => {
    return (parseFloat(quantity) || 0) * (parseFloat(unitPrice) || 0);
  };

  const subtotal = watchedValues.lineItems?.reduce(
    (sum, item) => sum + calculateTotal(item.quantity, item.unitPrice), 
    0
  ) || 0;
  const gst = subtotal * 0.1;
  const total = subtotal + gst;

  const hasSignificantChanges = (data: QuoteFormData): boolean => {
    if (!existingQuote) return false;
    const quote = existingQuote as any;
    
    const currentTotal = data.lineItems.reduce(
      (sum, item) => sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0),
      0
    ) * 1.1;
    const existingTotal = parseFloat(quote.total) || 0;
    
    const lineItemsChanged = data.lineItems.length !== (quote.lineItems?.length || 0);
    const totalChanged = Math.abs(currentTotal - existingTotal) > 0.01;
    const titleChanged = data.title !== quote.title;
    
    return lineItemsChanged || totalChanged || titleChanged;
  };

  const handleSubmit = async (data: QuoteFormData) => {
    try {
      const quoteData = {
        clientId: data.clientId,
        title: data.title,
        description: data.description,
        validUntil: new Date(data.validUntil),
        notes: data.notes,
        depositRequired: data.depositRequired,
        depositPercent: data.depositRequired ? data.depositPercent : 0,
        depositAmount: data.depositRequired ? (total * (data.depositPercent / 100)).toFixed(2) : "0",
        lineItems: data.lineItems.map(item => ({
          description: item.description,
          quantity: parseFloat(item.quantity),
          unitPrice: parseFloat(item.unitPrice),
        })),
      };

      if (isEditMode && quoteId) {
        const shouldCreateRevision = hasSignificantChanges(data);
        
        if (shouldCreateRevision) {
          await createRevisionMutation.mutateAsync("Auto-saved before update");
        }
        
        await updateQuoteMutation.mutateAsync(quoteData);
        
        toast({
          title: "Quote updated!",
          description: shouldCreateRevision 
            ? "Quote saved and revision created" 
            : "Your changes have been saved",
        });

        onSave?.(quoteId);
      } else {
        const result = await createQuoteMutation.mutateAsync(quoteData);
        
        toast({
          title: "Quote created!",
          description: "Your quote has been saved successfully",
        });

        onSave?.(result.id);
      }
    } catch (error) {
      console.error("Error saving quote:", error);
      toast({
        title: "Error",
        description: `Failed to ${isEditMode ? 'update' : 'create'} quote. Please try again.`,
        variant: "destructive",
      });
    }
  };

  const gstEnabled = businessSettings?.gstEnabled ?? true;

  const businessInfo = {
    businessName: businessSettings?.businessName,
    abn: businessSettings?.abn,
    address: businessSettings?.address,
    phone: businessSettings?.phone,
    email: businessSettings?.email,
    logoUrl: businessSettings?.logoUrl,
    brandColor: userCheck?.user?.tradeColor,
  };

  const clientInfo = selectedClient ? {
    name: selectedClient.name,
    email: selectedClient.email,
    phone: selectedClient.phone,
    address: selectedClient.address,
  } : null;

  const previewLineItems = watchedValues.lineItems?.map(item => ({
    description: item.description,
    quantity: parseFloat(item.quantity) || 0,
    unitPrice: parseFloat(item.unitPrice) || 0,
  })) || [];

  return (
    <div className="h-full flex flex-col">
      {/* Mobile Tab Switcher - Made more noticeable */}
      <div className="lg:hidden border-b-2 bg-card sticky top-0 z-10 shadow-sm">
        <Tabs value={mobileView} onValueChange={(v) => setMobileView(v as 'edit' | 'preview')} className="w-full">
          <TabsList className="grid w-full grid-cols-2 gap-1 p-1.5 bg-muted/60">
            <TabsTrigger 
              value="edit" 
              className="gap-2 font-semibold rounded-lg data-[state=active]:shadow-md transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Edit2 className="h-4 w-4" />
              Edit
            </TabsTrigger>
            <TabsTrigger 
              value="preview" 
              className="gap-2 font-semibold rounded-lg data-[state=active]:shadow-md transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Eye className="h-4 w-4" />
              Preview
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Desktop: Side-by-side layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Form Panel */}
        <div className={`flex-1 overflow-auto p-4 lg:p-6 ${mobileView === 'preview' ? 'hidden lg:block' : ''}`}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6 max-w-xl mx-auto lg:mx-0">
            {/* Header */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onCancel}
                  className="rounded-xl"
                  data-testid="button-back"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <h1 className="ios-title">{isEditMode ? 'Edit Quote' : 'New Quote'}</h1>
              </div>
              <div className="flex items-center gap-2">
                {isEditMode && quoteId && (
                  <QuoteRevisions 
                    quoteId={quoteId} 
                    compact={true}
                  />
                )}
                <Badge 
                  className="px-3 py-1.5 text-xs font-semibold"
                  style={{ 
                    backgroundColor: 'hsl(var(--trade) / 0.1)', 
                    color: 'hsl(var(--trade))',
                    border: 'none'
                  }}
                >
                  {formatCurrency(total)}
                </Badge>
              </div>
            </div>

            {/* Quick Create from Job */}
            <RecentJobPicker
              type="quote"
              onSelectJob={handleSelectJob}
              selectedJobId={selectedJobId}
            />

            {/* Client Selection */}
            <Card className="rounded-2xl overflow-hidden">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <User className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
                  Client
                </div>
                <Select
                  value={watchedValues.clientId}
                  onValueChange={(value) => form.setValue("clientId", value)}
                >
                  <SelectTrigger className="rounded-xl" data-testid="select-client">
                    <SelectValue placeholder="Tap to select a client..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {(clients as any[]).map((client) => (
                      <SelectItem 
                        key={client.id} 
                        value={client.id}
                        className="cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0"
                            style={{ 
                              backgroundColor: 'hsl(var(--primary) / 0.1)',
                              color: 'hsl(var(--primary))'
                            }}
                          >
                            {client.name?.charAt(0)?.toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium truncate">{client.name}</div>
                            {client.email && (
                              <div className="text-xs text-muted-foreground truncate">{client.email}</div>
                            )}
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.clientId && (
                  <p className="text-xs text-destructive">{form.formState.errors.clientId.message}</p>
                )}
              </CardContent>
            </Card>

            {/* Quote Details */}
            <Card className="rounded-2xl overflow-hidden">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <FileText className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
                  Quote Details
                </div>
                
                <div>
                  <Label htmlFor="title" className="text-xs text-muted-foreground">Title</Label>
                  <Input
                    id="title"
                    {...form.register("title")}
                    placeholder="e.g., Bathroom Renovation"
                    className="h-12 rounded-xl mt-1"
                    data-testid="input-title"
                  />
                  {form.formState.errors.title && (
                    <p className="text-xs text-destructive mt-1">{form.formState.errors.title.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="description" className="text-xs text-muted-foreground">Description (optional)</Label>
                  <Textarea
                    id="description"
                    {...form.register("description")}
                    placeholder="Brief description of the work..."
                    className="rounded-xl mt-1 min-h-[80px]"
                    data-testid="input-description"
                  />
                </div>

                <div>
                  <Label htmlFor="validUntil" className="text-xs text-muted-foreground">Valid Until</Label>
                  <div className="relative mt-1">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="validUntil"
                      type="date"
                      {...form.register("validUntil")}
                      className="h-12 rounded-xl pl-10"
                      data-testid="input-valid-until"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Line Items */}
            <Card className="rounded-2xl overflow-hidden">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Package className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
                    Line Items
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {fields.length} {fields.length === 1 ? 'item' : 'items'}
                  </Badge>
                </div>

                {/* Item list */}
                <div className="space-y-2">
                  {fields.map((field, index) => {
                    const item = watchedValues.lineItems[index];
                    const itemTotal = calculateTotal(item?.quantity || "0", item?.unitPrice || "0");
                    
                    return (
                      <div 
                        key={field.id}
                        className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover-elevate"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{item?.description || 'Untitled'}</p>
                          <p className="text-xs text-muted-foreground">
                            {item?.quantity} × {formatCurrency(parseFloat(item?.unitPrice || "0"))}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-sm">{formatCurrency(itemTotal)}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg"
                            onClick={() => handleEditLineItem(index)}
                            data-testid={`button-edit-item-${index}`}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg text-destructive hover:text-destructive"
                            onClick={() => remove(index)}
                            data-testid={`button-delete-item-${index}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Add item buttons */}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddLineItem}
                    className="flex-1 h-12 rounded-xl gap-2 press-scale"
                    data-testid="button-add-item"
                  >
                    <Plus className="h-4 w-4" />
                    Add Item
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCatalogOpen(true)}
                    className="h-12 w-12 rounded-xl press-scale"
                    data-testid="button-from-catalog"
                  >
                    <BookOpen className="h-4 w-4" />
                  </Button>
                </div>

                {form.formState.errors.lineItems && (
                  <p className="text-xs text-destructive">{form.formState.errors.lineItems.message}</p>
                )}

                {/* Totals */}
                {fields.length > 0 && (
                  <div className="pt-4 border-t space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">GST (10%)</span>
                      <span>{formatCurrency(gst)}</span>
                    </div>
                    <div className="flex justify-between text-base font-bold pt-2 border-t">
                      <span>Total (inc. GST)</span>
                      <span style={{ color: 'hsl(var(--trade))' }}>{formatCurrency(total)}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Deposit Settings */}
            <Card className="rounded-2xl overflow-hidden">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Percent className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
                    Deposit Required
                  </div>
                  <Switch
                    checked={watchedValues.depositRequired}
                    onCheckedChange={(checked) => form.setValue("depositRequired", checked)}
                    data-testid="switch-deposit-required"
                  />
                </div>

                {watchedValues.depositRequired && (
                  <div className="space-y-3 pt-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Deposit Percentage</Label>
                      <div className="flex items-center gap-3 mt-1">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={watchedValues.depositPercent}
                          onChange={(e) => form.setValue("depositPercent", parseInt(e.target.value) || 0)}
                          className="h-12 rounded-xl w-24"
                          data-testid="input-deposit-percent"
                        />
                        <span className="text-sm text-muted-foreground">%</span>
                        <span className="text-sm font-medium ml-auto">
                          {formatCurrency(total * (watchedValues.depositPercent / 100))}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Notes */}
            <Card className="rounded-2xl overflow-hidden">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <FileText className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
                  Notes & Terms
                </div>
                <Textarea
                  {...form.register("notes")}
                  placeholder="Terms, conditions, or notes for the client..."
                  className="rounded-xl min-h-[100px]"
                  data-testid="input-notes"
                />
              </CardContent>
            </Card>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={createQuoteMutation.isPending || updateQuoteMutation.isPending}
              className="w-full h-14 rounded-2xl text-base font-semibold gap-2 press-scale"
              style={{ 
                backgroundColor: 'hsl(var(--trade))',
                color: 'white'
              }}
              data-testid={isEditMode ? "button-update-quote" : "button-create-quote"}
            >
              {(createQuoteMutation.isPending || updateQuoteMutation.isPending) ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {isEditMode ? 'Saving...' : 'Creating...'}
                </>
              ) : (
                <>
                  <Check className="h-5 w-5" />
                  {isEditMode ? 'Save Changes' : 'Create Quote'}
                </>
              )}
            </Button>
          </form>
        </div>

        {/* Preview Panel */}
        <div className={`flex-1 bg-muted/30 overflow-auto p-4 lg:p-6 ${mobileView === 'edit' ? 'hidden lg:block' : ''}`}>
          <div className="max-w-lg mx-auto">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Live Preview</h2>
              <Badge variant="outline" className="text-xs">Updates as you type</Badge>
            </div>
            <LiveDocumentPreview
              type="quote"
              title={watchedValues.title}
              description={watchedValues.description}
              validUntil={watchedValues.validUntil}
              lineItems={previewLineItems}
              notes={watchedValues.notes}
              business={businessInfo}
              client={clientInfo}
              showDepositSection={watchedValues.depositRequired}
              depositPercent={watchedValues.depositPercent}
              gstEnabled={gstEnabled}
            />
          </div>
        </div>
      </div>

      {/* Line Item Editor Sheet */}
      <Sheet open={editingLineIndex !== null} onOpenChange={() => setEditingLineIndex(null)}>
        <SheetContent side="bottom" className="h-auto max-h-[80vh] rounded-t-3xl">
          <SheetHeader className="pb-4">
            <SheetTitle>{editingLineIndex === -1 ? 'Add Item' : 'Edit Item'}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 pb-4">
            <div>
              <Label className="text-xs text-muted-foreground">Description</Label>
              <Input
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="What are you charging for?"
                className="h-12 rounded-xl mt-1"
                data-testid="input-item-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Quantity</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editForm.quantity}
                  onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                  className="h-12 rounded-xl mt-1"
                  data-testid="input-item-quantity"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Unit Price ($)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editForm.unitPrice}
                  onChange={(e) => setEditForm({ ...editForm, unitPrice: e.target.value })}
                  className="h-12 rounded-xl mt-1"
                  data-testid="input-item-price"
                />
              </div>
            </div>
            <div className="pt-2 p-3 rounded-xl bg-muted/50">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Line Total</span>
                <span className="font-semibold">{formatCurrency(calculateTotal(editForm.quantity, editForm.unitPrice))}</span>
              </div>
            </div>
          </div>
          <SheetFooter className="pt-2">
            <Button
              onClick={handleSaveLineItem}
              className="w-full h-12 rounded-xl press-scale"
              style={{ backgroundColor: 'hsl(var(--trade))' }}
              data-testid="button-save-item"
            >
              {editingLineIndex === -1 ? 'Add Item' : 'Save Changes'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Catalog Modal */}
      <CatalogModal
        open={catalogOpen}
        onOpenChange={setCatalogOpen}
        onSelectItem={handleCatalogSelect}
        tradeType={userCheck?.user?.tradeType}
      />
    </div>
  );
}
