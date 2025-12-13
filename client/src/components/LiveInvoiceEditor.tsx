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
import { useToast } from "@/hooks/use-toast";
import { useClients } from "@/hooks/use-clients";
import { useCreateInvoice } from "@/hooks/use-invoices";
import { useBusinessSettings } from "@/hooks/use-business-settings";
import { useDocumentTemplates, type DocumentTemplate } from "@/hooks/use-templates";
import { useQuery } from "@tanstack/react-query";
import LiveDocumentPreview from "./LiveDocumentPreview";
import CatalogModal from "@/components/CatalogModal";
import CompletedJobPicker from "@/components/CompletedJobPicker";
import {
  Plus,
  Trash2,
  Edit2,
  Eye,
  FileText,
  User,
  Calendar,
  Package,
  BookOpen,
  ChevronLeft,
  Check,
} from "lucide-react";

const lineItemSchema = z.object({
  description: z.string().min(1, "Description required"),
  quantity: z.string().min(1, "Quantity required"),
  unitPrice: z.string().min(1, "Price required"),
});

const invoiceFormSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  lineItems: z.array(lineItemSchema).min(1, "At least one line item required"),
});

type InvoiceFormData = z.infer<typeof invoiceFormSchema>;

interface LiveInvoiceEditorProps {
  onSave?: (invoiceId: string) => void;
  onCancel?: () => void;
}

export default function LiveInvoiceEditor({ onSave, onCancel }: LiveInvoiceEditorProps) {
  const { toast } = useToast();
  const { data: clients = [] } = useClients();
  const { data: businessSettings } = useBusinessSettings();
  const createInvoiceMutation = useCreateInvoice();
  
  // Read jobId or quoteId from URL query parameters
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const urlJobId = urlParams.get('jobId');
  const urlQuoteId = urlParams.get('quoteId');
  
  const [mobileView, setMobileView] = useState<'edit' | 'preview'>('edit');
  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ description: "", quantity: "1", unitPrice: "" });
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [templateSheetOpen, setTemplateSheetOpen] = useState(false);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | undefined>(urlQuoteId || undefined);
  const [sourceQuoteId, setSourceQuoteId] = useState<string | undefined>(urlQuoteId || undefined);
  const [selectedJobId, setSelectedJobId] = useState<string | undefined>(urlJobId || undefined);
  const [autoLoaded, setAutoLoaded] = useState(false);

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
  const { data: preloadedJob } = useQuery({
    queryKey: ['/api/jobs', urlJobId],
    enabled: !!urlJobId && !autoLoaded,
  });

  // Fetch quote data if quoteId is provided in URL
  const { data: preloadedQuote } = useQuery({
    queryKey: ['/api/quotes', urlQuoteId],
    enabled: !!urlQuoteId && !autoLoaded,
  });

  const form = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: {
      clientId: "",
      title: "",
      description: "",
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: "",
      lineItems: [],
    },
  });

  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: "lineItems"
  });

  // Auto-fill form when job or quote is loaded from URL parameter
  useEffect(() => {
    if (autoLoaded || clients.length === 0) return;
    
    // Priority: Quote data first (contains line items), then job data
    if (preloadedQuote) {
      setAutoLoaded(true);
      const quote = preloadedQuote as any;
      
      // Set client from quote
      if (quote.clientId) {
        form.setValue("clientId", quote.clientId);
      }
      
      // Copy quote details to invoice
      form.setValue("title", quote.title || "");
      form.setValue("description", quote.description || "");
      form.setValue("notes", quote.notes || quote.terms || "");
      
      // Copy line items from quote
      if (quote.lineItems && quote.lineItems.length > 0) {
        const items = quote.lineItems.map((item: any) => ({
          description: String(item.description ?? ""),
          quantity: String(item.quantity ?? item.qty ?? 1),
          unitPrice: String(item.unitPrice ?? item.unit_price ?? 0),
        }));
        form.setValue("lineItems", items);
      }
      
      toast({
        title: "Quote details loaded",
        description: `Creating invoice from quote "${quote.title}"`,
      });
    } else if (preloadedJob) {
      setAutoLoaded(true);
      const job = preloadedJob as any;
      
      // Mark this job as selected in the picker
      setSelectedJobId(job.id);
      
      // Set client from job
      if (job.clientId) {
        form.setValue("clientId", job.clientId);
      }
      
      // Set title and description from job
      form.setValue("title", job.title || "");
      form.setValue("description", job.description || "");
      
      // Set default due date
      const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      form.setValue("dueDate", dueDate);
      
      // Fetch linked documents to get quote line items
      fetch(`/api/jobs/${job.id}/linked-documents`, { credentials: 'include' })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.quote?.lineItems && data.quote.lineItems.length > 0) {
            const items = data.quote.lineItems.map((item: any) => ({
              description: String(item.description ?? ""),
              quantity: String(item.quantity ?? item.qty ?? 1),
              unitPrice: String(item.unitPrice ?? item.unit_price ?? 0),
            }));
            form.setValue("lineItems", items);
            setSourceQuoteId(data.quote.id);
            setSelectedQuoteId(data.quote.id);
            
            toast({
              title: "Job loaded",
              description: `Invoice prefilled from "${job.title}" with quote line items`,
            });
          } else {
            toast({
              title: "Job loaded", 
              description: `Invoice prefilled from "${job.title}". Add line items for your charges.`,
            });
          }
        })
        .catch(() => {
          toast({
            title: "Job loaded",
            description: `Invoice prefilled from "${job.title}". Add line items for your charges.`,
          });
        });
    }
  }, [preloadedJob, preloadedQuote, autoLoaded, clients, form, toast]);

  const watchedValues = form.watch();
  const selectedClient = (clients as any[]).find(c => c.id === watchedValues.clientId);

  // Prefill form from accepted quote - the natural workflow for invoice creation
  const handleSelectQuote = (quote: any) => {
    setSelectedQuoteId(quote.id);
    setSourceQuoteId(quote.id);
    
    // Set client from quote
    if (quote.client?.id) {
      form.setValue("clientId", quote.client.id);
    }
    
    // Copy quote details to invoice
    form.setValue("title", quote.title || "");
    form.setValue("description", quote.description || "");
    form.setValue("notes", quote.notes || quote.terms || "");
    
    // Use quote's valid until date as due date if available, otherwise default to 14 days
    let dueDate: string;
    if (quote.validUntil) {
      dueDate = new Date(quote.validUntil).toISOString().split('T')[0];
    } else {
      dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    }
    form.setValue("dueDate", dueDate);
    
    // Copy line items from quote - ensure all values are strings for the form
    // Use nullish coalescing to handle all possible property names
    if (quote.lineItems && quote.lineItems.length > 0) {
      const items = quote.lineItems.map((item: any) => ({
        description: String(item.description ?? ""),
        quantity: String(item.quantity ?? item.qty ?? 1),
        unitPrice: String(item.unitPrice ?? item.unit_price ?? 0),
      }));
      form.setValue("lineItems", items);
    } else {
      form.setValue("lineItems", []);
    }
    
    toast({
      title: "Quote loaded",
      description: `Invoice prefilled from accepted quote #${quote.number}`,
    });
  };

  // Prefill form from completed job - the primary workflow for invoice creation
  const handleSelectJob = async (job: any) => {
    setSelectedJobId(job.id);
    
    // Set client from job
    if (job.client?.id) {
      form.setValue("clientId", job.client.id);
    } else if (job.clientId) {
      form.setValue("clientId", job.clientId);
    }
    
    // Copy job details to invoice
    form.setValue("title", job.title || "");
    form.setValue("description", job.description || "");
    
    // Set default due date to 14 days from now
    const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    form.setValue("dueDate", dueDate);
    
    // Check if job has a linked quote with line items
    if (job.linkedQuote?.lineItems && job.linkedQuote.lineItems.length > 0) {
      const items = job.linkedQuote.lineItems.map((item: any) => ({
        description: String(item.description ?? ""),
        quantity: String(item.quantity ?? item.qty ?? 1),
        unitPrice: String(item.unitPrice ?? item.unit_price ?? 0),
      }));
      form.setValue("lineItems", items);
      
      // Set the source quote for linking
      setSourceQuoteId(job.linkedQuote.id);
      setSelectedQuoteId(job.linkedQuote.id);
      
      toast({
        title: "Job loaded",
        description: `Invoice prefilled from "${job.title}" with quote line items`,
      });
    } else {
      // Try to fetch linked documents to get quote line items
      try {
        const res = await fetch(`/api/jobs/${job.id}/linked-documents`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (data.quote?.lineItems && data.quote.lineItems.length > 0) {
            const items = data.quote.lineItems.map((item: any) => ({
              description: String(item.description ?? ""),
              quantity: String(item.quantity ?? item.qty ?? 1),
              unitPrice: String(item.unitPrice ?? item.unit_price ?? 0),
            }));
            form.setValue("lineItems", items);
            
            // Set the source quote for linking
            setSourceQuoteId(data.quote.id);
            setSelectedQuoteId(data.quote.id);
            
            toast({
              title: "Job loaded",
              description: `Invoice prefilled from "${job.title}" with quote line items`,
            });
            return;
          }
        }
      } catch (err) {
        console.error("Error fetching linked documents:", err);
      }
      
      // No quote line items - just prefill from job
      form.setValue("lineItems", []);
      setSourceQuoteId(undefined);
      setSelectedQuoteId(undefined);
      
      toast({
        title: "Job loaded",
        description: `Invoice prefilled from "${job.title}". Add line items for your charges.`,
      });
    }
  };

  const handleApplyTemplate = (template: DocumentTemplate) => {
    form.setValue("title", template.defaults?.title || "");
    form.setValue("description", template.defaults?.description || "");
    form.setValue("notes", template.defaults?.terms || "");
    
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
      description: `"${item.description}" added to invoice`,
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

  const handleSubmit = async (data: InvoiceFormData) => {
    try {
      const invoiceData: any = {
        clientId: data.clientId,
        title: data.title,
        description: data.description,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        notes: data.notes,
        lineItems: data.lineItems.map(item => ({
          description: item.description,
          quantity: parseFloat(item.quantity),
          unitPrice: parseFloat(item.unitPrice),
        })),
      };

      // Only include quoteId if it's defined (linking invoice to source quote)
      if (sourceQuoteId) {
        invoiceData.quoteId = sourceQuoteId;
      }

      const result = await createInvoiceMutation.mutateAsync(invoiceData);
      
      toast({
        title: "Invoice created!",
        description: "Your invoice has been saved successfully",
      });

      onSave?.(result.id);
    } catch (error) {
      console.error("Error creating invoice:", error);
      toast({
        title: "Error",
        description: "Failed to create invoice. Please try again.",
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
            <div className="flex items-center justify-between">
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
                <h1 className="ios-title">New Invoice</h1>
              </div>
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

            {/* Create Invoice from Completed Job - only show when not already coming from a job/quote context */}
            {!urlJobId && !urlQuoteId && (
              <CompletedJobPicker
                onSelectJob={handleSelectJob}
                selectedJobId={selectedJobId}
              />
            )}

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

            {/* Invoice Details */}
            <Card className="rounded-2xl overflow-hidden">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <FileText className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
                  Invoice Details
                </div>
                
                <div>
                  <Label htmlFor="title" className="text-xs text-muted-foreground">Title</Label>
                  <Input
                    id="title"
                    {...form.register("title")}
                    placeholder="e.g., Plumbing Services - March"
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
                  <Label htmlFor="dueDate" className="text-xs text-muted-foreground">Due Date</Label>
                  <div className="relative mt-1">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="dueDate"
                      type="date"
                      {...form.register("dueDate")}
                      className="h-12 rounded-xl pl-10"
                      data-testid="input-due-date"
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

            {/* Notes */}
            <Card className="rounded-2xl overflow-hidden">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <FileText className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
                  Payment Terms & Notes
                </div>
                <Textarea
                  {...form.register("notes")}
                  placeholder="Payment terms, bank details, or notes for the client..."
                  className="rounded-xl min-h-[100px]"
                  data-testid="input-notes"
                />
              </CardContent>
            </Card>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={createInvoiceMutation.isPending}
              className="w-full h-14 rounded-2xl text-base font-semibold gap-2 press-scale"
              style={{ 
                backgroundColor: 'hsl(var(--trade))',
                color: 'white'
              }}
              data-testid="button-create-invoice"
            >
              {createInvoiceMutation.isPending ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Check className="h-5 w-5" />
                  Create Invoice
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
              type="invoice"
              title={watchedValues.title}
              description={watchedValues.description}
              dueDate={watchedValues.dueDate}
              lineItems={previewLineItems}
              notes={watchedValues.notes}
              business={businessInfo}
              client={clientInfo}
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
