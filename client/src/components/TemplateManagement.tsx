import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Plus, Edit, Trash2, Copy, FileText, Receipt, Briefcase, Filter, FileType } from "lucide-react";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { useDocumentTemplates, useCreateDocumentTemplate, useUpdateDocumentTemplate, useDeleteDocumentTemplate } from "@/hooks/use-templates";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface TemplateFormData {
  name: string;
  type: 'quote' | 'invoice' | 'job';
  tradeType: string;
  familyKey: string;
  styling: {
    brandColor: string;
    logoDisplay: boolean;
  };
  sections: {
    showHeader: boolean;
    showLineItems: boolean;
    showTotals: boolean;
    showTerms: boolean;
    showSignature: boolean;
  };
  defaults: {
    title: string;
    description: string;
    terms: string;
    depositPct: number;
    dueTermDays: number;
    gstEnabled: boolean;
  };
  defaultLineItems: Array<{
    description: string;
    qty: number;
    unitPrice: number;
    unit: string;
  }>;
}

const templateFormSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  type: z.enum(['quote', 'invoice', 'job']),
  tradeType: z.string().min(1, "Trade type is required"),
  familyKey: z.string().min(1, "Family key is required"),
  styling: z.object({
    brandColor: z.string().default("#2563eb"),
    logoDisplay: z.boolean().default(true),
  }),
  sections: z.object({
    showHeader: z.boolean().default(true),
    showLineItems: z.boolean().default(true),
    showTotals: z.boolean().default(true),
    showTerms: z.boolean().default(true),
    showSignature: z.boolean().default(true),
  }),
  defaults: z.object({
    title: z.string().min(1, "Default title is required"),
    description: z.string().default(""),
    terms: z.string().default(""),
    depositPct: z.number().min(0).max(100).default(50),
    dueTermDays: z.number().min(1).default(30),
    gstEnabled: z.boolean().default(true),
  }),
  defaultLineItems: z.array(z.object({
    description: z.string().min(1, "Line item description is required"),
    qty: z.number().min(1).default(1),
    unitPrice: z.number().min(0).default(0),
    unit: z.string().default("hour"),
  })).default([]),
});

const tradeTypes = [
  'plumbing', 'electrical', 'carpentry', 'painting', 'hvac', 'roofing', 
  'landscaping', 'tiling', 'flooring', 'renovation', 'handyman'
];

const units = [
  'hour', 'day', 'each', 'sqm', 'lm', 'flat', 'job'
];

export default function TemplateManagement() {
  const [filterType, setFilterType] = useState<string>('all');
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  // Get current user's trade type
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

  // Get user's trade type for display priority
  const userTradeType = userCheck?.user?.tradeType;
  
  // Default to 'all' to show all available templates from all trades
  const [filterTradeType, setFilterTradeType] = useState<string>('all');

  // Fetch templates with filtering
  const { data: templates = [], isLoading } = useDocumentTemplates(
    filterType === 'all' ? undefined : filterType,
    filterTradeType === 'all' ? undefined : filterTradeType
  );

  const createTemplateMutation = useCreateDocumentTemplate();
  const updateTemplateMutation = useUpdateDocumentTemplate();
  const deleteTemplateMutation = useDeleteDocumentTemplate();

  const form = useForm<TemplateFormData>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: {
      name: "",
      type: "quote",
      tradeType: userCheck?.user?.tradeType || "",
      familyKey: "",
      styling: {
        brandColor: "#2563eb",
        logoDisplay: true,
      },
      sections: {
        showHeader: true,
        showLineItems: true,
        showTotals: true,
        showTerms: true,
        showSignature: true,
      },
      defaults: {
        title: "",
        description: "",
        terms: "",
        depositPct: 50,
        dueTermDays: 30,
        gstEnabled: true,
      },
      defaultLineItems: [],
    },
  });

  const handleCreateTemplate = async (data: TemplateFormData) => {
    try {
      await createTemplateMutation.mutateAsync({
        name: data.name,
        type: data.type,
        familyKey: data.familyKey,
        tradeType: data.tradeType,
        styling: data.styling,
        sections: data.sections,
        defaults: data.defaults,
        defaultLineItems: data.defaultLineItems,
      });
      
      toast({
        title: "Template Created",
        description: "Your new template has been created successfully.",
      });
      
      setIsDialogOpen(false);
      form.reset();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create template. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleUpdateTemplate = async (data: TemplateFormData) => {
    if (!editingTemplate) return;
    
    try {
      await updateTemplateMutation.mutateAsync({
        id: editingTemplate.id,
        data: {
          name: data.name,
          type: data.type,
          familyKey: data.familyKey,
          tradeType: data.tradeType,
          styling: data.styling,
          sections: data.sections,
          defaults: data.defaults,
          defaultLineItems: data.defaultLineItems,
        },
      });
      
      toast({
        title: "Template Updated",
        description: "Your template has been updated successfully.",
      });
      
      setIsDialogOpen(false);
      setEditingTemplate(null);
      form.reset();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update template. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      await deleteTemplateMutation.mutateAsync(templateId);
      toast({
        title: "Template Deleted",
        description: "The template has been deleted successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete template. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleEditTemplate = (template: any) => {
    setEditingTemplate(template);
    form.reset({
      name: template.name,
      type: template.type,
      tradeType: template.tradeType,
      familyKey: template.familyKey,
      styling: template.styling || { brandColor: "#2563eb", logoDisplay: true },
      sections: template.sections || {
        showHeader: true,
        showLineItems: true,
        showTotals: true,
        showTerms: true,
        showSignature: true,
      },
      defaults: template.defaults || {
        title: "",
        description: "",
        terms: "",
        depositPct: 50,
        dueTermDays: 30,
        gstEnabled: true,
      },
      defaultLineItems: template.defaultLineItems || [],
    });
    setIsDialogOpen(true);
  };

  const handleDuplicateTemplate = (template: any) => {
    form.reset({
      name: `${template.name} (Copy)`,
      type: template.type,
      tradeType: template.tradeType,
      familyKey: `${template.familyKey}-copy`,
      styling: template.styling || { brandColor: "#2563eb", logoDisplay: true },
      sections: template.sections || {
        showHeader: true,
        showLineItems: true,
        showTotals: true,
        showTerms: true,
        showSignature: true,
      },
      defaults: template.defaults || {
        title: "",
        description: "",
        terms: "",
        depositPct: 50,
        dueTermDays: 30,
        gstEnabled: true,
      },
      defaultLineItems: template.defaultLineItems || [],
    });
    setEditingTemplate(null);
    setIsDialogOpen(true);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'quote': return FileText;
      case 'invoice': return Receipt;
      case 'job': return Briefcase;
      default: return FileText;
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'quote': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'invoice': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'job': return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  if (isLoading) {
    return (
      <PageShell>
        <div className="flex items-center justify-center h-64">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell data-testid="page-template-management">
      <PageHeader
        title="Templates"
        subtitle="Pre-built templates for quotes, invoices, and jobs"
        action={
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                onClick={() => {
                  setEditingTemplate(null);
                  form.reset();
                }}
                data-testid="button-create-template"
                style={{
                  backgroundColor: 'hsl(var(--trade))',
                  borderColor: 'hsl(var(--trade-border))',
                  color: 'white'
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingTemplate ? 'Edit Template' : 'Create New Template'}
                </DialogTitle>
              </DialogHeader>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(editingTemplate ? handleUpdateTemplate : handleCreateTemplate)} className="space-y-6">
                  <Tabs defaultValue="basic" className="w-full">
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="basic">Basic Info</TabsTrigger>
                      <TabsTrigger value="styling">Styling</TabsTrigger>
                      <TabsTrigger value="defaults">Defaults</TabsTrigger>
                      <TabsTrigger value="lineitems">Line Items</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="basic" className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Template Name</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., Emergency Plumbing Quote" {...field} data-testid="input-template-name" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="type"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Template Type</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-template-type">
                                    <SelectValue placeholder="Select type" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="quote">Quote</SelectItem>
                                  <SelectItem value="invoice">Invoice</SelectItem>
                                  <SelectItem value="job">Job</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="tradeType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Trade Type</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-trade-type">
                                    <SelectValue placeholder="Select trade type" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {tradeTypes.map((trade) => (
                                    <SelectItem key={trade} value={trade}>
                                      {trade.charAt(0).toUpperCase() + trade.slice(1)}
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
                          name="familyKey"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Template Key</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., plumbing-emergency" {...field} data-testid="input-family-key" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="styling" className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="styling.brandColor"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Brand Color</FormLabel>
                              <div className="flex items-center gap-4">
                                <FormControl>
                                  <Input type="color" className="w-12 h-12 p-1" {...field} data-testid="input-brand-color" />
                                </FormControl>
                                <Input value={field.value} onChange={field.onChange} placeholder="#2563eb" />
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="styling.logoDisplay"
                          render={({ field }) => (
                            <FormItem className="flex items-center justify-between p-4 border rounded-lg">
                              <div>
                                <FormLabel className="text-base">Show Logo</FormLabel>
                                <p className="text-sm text-muted-foreground">Display your business logo on documents</p>
                              </div>
                              <FormControl>
                                <input 
                                  type="checkbox" 
                                  checked={field.value} 
                                  onChange={field.onChange}
                                  className="w-4 h-4"
                                  data-testid="checkbox-logo-display"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <div className="space-y-4">
                        <h3 className="font-medium">Document Sections</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          {['showHeader', 'showLineItems', 'showTotals', 'showTerms', 'showSignature'].map((section) => (
                            <FormField
                              key={section}
                              control={form.control}
                              name={`sections.${section}` as any}
                              render={({ field }) => (
                                <FormItem className="flex items-center gap-2 p-3 border rounded-lg">
                                  <FormControl>
                                    <input 
                                      type="checkbox" 
                                      checked={field.value} 
                                      onChange={field.onChange}
                                      className="w-4 h-4"
                                    />
                                  </FormControl>
                                  <FormLabel className="text-sm capitalize">
                                    {section.replace('show', '')}
                                  </FormLabel>
                                </FormItem>
                              )}
                            />
                          ))}
                        </div>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="defaults" className="space-y-4">
                      <div className="space-y-4">
                        <FormField
                          control={form.control}
                          name="defaults.title"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Default Title</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., Emergency Plumbing Services Quote" {...field} data-testid="input-default-title" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="defaults.description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Default Description</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="Brief description of the work..."
                                  {...field}
                                  data-testid="textarea-default-description"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="defaults.terms"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Terms & Conditions</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="Payment terms, warranties, conditions..."
                                  rows={4}
                                  {...field}
                                  data-testid="textarea-terms"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <FormField
                            control={form.control}
                            name="defaults.depositPct"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Deposit Percentage</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    min="0" 
                                    max="100"
                                    {...field}
                                    onChange={(e) => field.onChange(parseInt(e.target.value) || 50)}
                                    data-testid="input-deposit-pct"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name="defaults.dueTermDays"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Due Term (Days)</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    min="1" 
                                    {...field}
                                    onChange={(e) => field.onChange(parseInt(e.target.value) || 30)}
                                    data-testid="input-due-term-days"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name="defaults.gstEnabled"
                            render={({ field }) => (
                              <FormItem className="flex items-center gap-2 p-4 border rounded-lg mt-6">
                                <FormControl>
                                  <input 
                                    type="checkbox" 
                                    checked={field.value} 
                                    onChange={field.onChange}
                                    className="w-4 h-4"
                                    data-testid="checkbox-gst-enabled"
                                  />
                                </FormControl>
                                <FormLabel>Include GST (10%)</FormLabel>
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="lineitems" className="space-y-4">
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <h3 className="text-lg font-medium">Default Line Items</h3>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const current = form.getValues("defaultLineItems");
                              form.setValue("defaultLineItems", [
                                ...current,
                                { description: "", qty: 1, unitPrice: 0, unit: "hour" }
                              ]);
                            }}
                            data-testid="button-add-line-item"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Line Item
                          </Button>
                        </div>
                        
                        {form.watch("defaultLineItems").map((_, index) => (
                          <div key={index} className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 border rounded-lg">
                            <FormField
                              control={form.control}
                              name={`defaultLineItems.${index}.description`}
                              render={({ field }) => (
                                <FormItem className="md:col-span-2">
                                  <FormLabel>Description</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Service description" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={form.control}
                              name={`defaultLineItems.${index}.qty`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Qty</FormLabel>
                                  <FormControl>
                                    <Input 
                                      type="number" 
                                      min="1"
                                      {...field}
                                      onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={form.control}
                              name={`defaultLineItems.${index}.unitPrice`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Unit Price</FormLabel>
                                  <FormControl>
                                    <Input 
                                      type="number" 
                                      min="0"
                                      step="0.01"
                                      {...field}
                                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={form.control}
                              name={`defaultLineItems.${index}.unit`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Unit</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {units.map((unit) => (
                                        <SelectItem key={unit} value={unit}>
                                          {unit}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const current = form.getValues("defaultLineItems");
                                form.setValue("defaultLineItems", current.filter((_, i) => i !== index));
                              }}
                              className="mt-6"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </TabsContent>
                  </Tabs>
                  
                  <div className="flex justify-end gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsDialogOpen(false)}
                      data-testid="button-cancel-template"
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending}
                      data-testid="button-save-template"
                      style={{
                        backgroundColor: 'hsl(var(--trade))',
                        borderColor: 'hsl(var(--trade-border))',
                        color: 'white'
                      }}
                    >
                      {editingTemplate ? 'Update Template' : 'Create Template'}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
              <div>
                <p className="text-lg font-bold">{templates.filter(t => t.type === 'quote').length}</p>
                <p className="text-xs text-muted-foreground">Quote Templates</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-success" />
              <div>
                <p className="text-lg font-bold">{templates.filter(t => t.type === 'invoice').length}</p>
                <p className="text-xs text-muted-foreground">Invoice Templates</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-info" />
              <div>
                <p className="text-lg font-bold">{templates.filter(t => t.type === 'job').length}</p>
                <p className="text-xs text-muted-foreground">Job Templates</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[140px]" data-testid="filter-template-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="quote">Quotes</SelectItem>
            <SelectItem value="invoice">Invoices</SelectItem>
            <SelectItem value="job">Jobs</SelectItem>
          </SelectContent>
        </Select>
        
        <Select value={filterTradeType} onValueChange={setFilterTradeType}>
          <SelectTrigger className="w-[160px]" data-testid="filter-trade-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {userTradeType && (
              <SelectItem value={userTradeType}>
                {userTradeType.charAt(0).toUpperCase() + userTradeType.slice(1)} (My Trade)
              </SelectItem>
            )}
            <SelectItem value="all">All Trades</SelectItem>
            {tradeTypes
              .filter(trade => trade !== userTradeType)
              .map((trade) => (
              <SelectItem key={trade} value={trade}>
                {trade.charAt(0).toUpperCase() + trade.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template) => {
          const IconComponent = getTypeIcon(template.type);
          return (
            <Card key={template.id} className="hover-elevate">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <IconComponent className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
                    <div>
                      <CardTitle className="text-base">{template.name}</CardTitle>
                      <p className="text-xs text-muted-foreground capitalize">{template.tradeType}</p>
                    </div>
                  </div>
                  <Badge className={getTypeBadgeColor(template.type)}>
                    {template.type}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {template.defaults?.title && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{template.defaults.title}</p>
                  )}
                  {template.defaultLineItems?.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {template.defaultLineItems.length} default line items
                    </p>
                  )}
                </div>
                
                <Separator className="my-3" />
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditTemplate(template)}
                    data-testid={`button-edit-template-${template.id}`}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDuplicateTemplate(template)}
                    data-testid={`button-duplicate-template-${template.id}`}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive"
                        data-testid={`button-delete-template-${template.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Template</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete "{template.name}"? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDeleteTemplate(template.id)}
                          className="bg-destructive hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {templates.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileType className="h-12 w-12 text-muted-foreground mb-4 opacity-30" />
            <h3 className="text-lg font-medium text-center mb-2">No templates found</h3>
            <p className="text-muted-foreground text-center mb-4">
              {filterType !== 'all' || filterTradeType !== 'all' 
                ? 'Try adjusting your filters or create a new template.'
                : 'Create your first template to get started.'}
            </p>
            <Button 
              onClick={() => setIsDialogOpen(true)}
              style={{
                backgroundColor: 'hsl(var(--trade))',
                borderColor: 'hsl(var(--trade-border))',
                color: 'white'
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Template
            </Button>
          </CardContent>
        </Card>
      )}
    </PageShell>
  );
}
