import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import {
  Dialog,
  DialogContent,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Palette,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Star,
  Eye,
  Layers,
  FileText,
  ChevronDown,
  ChevronRight,
  DollarSign,
  Package,
  Shield,
  ClipboardCheck,
  Search,
  Calendar,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { StylePreset, RateCard, LineItemCatalog, CustomForm } from "@shared/schema";
import { format } from "date-fns";
import LiveDocumentPreview from "@/components/LiveDocumentPreview";
import { FormBuilder } from "@/components/CustomFormBuilder";
import { useBusinessSettings } from "@/hooks/use-business-settings";
import { TemplateId, TemplateCustomization, DOCUMENT_TEMPLATES, DOCUMENT_ACCENT_COLOR } from "@/lib/document-templates";
import { Check, Settings } from "lucide-react";

const FONT_FAMILIES = [
  { value: "Inter", label: "Inter" },
  { value: "Roboto", label: "Roboto" },
  { value: "Open Sans", label: "Open Sans" },
  { value: "Lato", label: "Lato" },
  { value: "Montserrat", label: "Montserrat" },
  { value: "Poppins", label: "Poppins" },
  { value: "Source Sans Pro", label: "Source Sans Pro" },
];

const LAYOUT_OPTIONS = [
  { value: "standard", label: "Standard" },
  { value: "minimal", label: "Minimal" },
  { value: "detailed", label: "Detailed" },
];

const UNIT_OPTIONS = [
  { value: "hour", label: "Hour" },
  { value: "item", label: "Item" },
  { value: "m", label: "Metre (m)" },
  { value: "sqm", label: "Square Metre (sqm)" },
  { value: "each", label: "Each" },
];

function ColorSwatch({ color, size = "sm" }: { color: string; size?: "sm" | "md" }) {
  const sizeClass = size === "sm" ? "w-5 h-5" : "w-8 h-8";
  return (
    <div
      className={`${sizeClass} rounded-md border border-border shadow-sm`}
      style={{ backgroundColor: color }}
    />
  );
}

// Mini template preview component
function MiniTemplatePreview({ templateId, accentColor }: { templateId: TemplateId; accentColor: string }) {
  const template = DOCUMENT_TEMPLATES[templateId];
  
  return (
    <div className="w-full aspect-[8.5/11] bg-white rounded border border-border shadow-sm p-2 text-[6px] overflow-hidden">
      {/* Header section */}
      <div 
        className="flex justify-between items-start mb-2 pb-1.5"
        style={{ 
          borderBottom: template.showHeaderDivider 
            ? `${template.headerBorderWidth} solid ${accentColor}` 
            : 'none' 
        }}
      >
        <div>
          <div 
            className="w-8 h-3 rounded-sm mb-0.5"
            style={{ backgroundColor: accentColor + '30' }}
          />
          <div className="w-12 h-1 bg-muted rounded-sm" />
        </div>
        <div 
          className="text-right font-bold"
          style={{ color: accentColor, fontSize: '8px' }}
        >
          INVOICE
        </div>
      </div>
      
      {/* Client info */}
      <div className="flex gap-2 mb-2">
        <div className="flex-1">
          <div className="w-8 h-1 bg-muted-foreground/30 rounded-sm mb-0.5" />
          <div className="w-10 h-1 bg-muted rounded-sm" />
        </div>
        <div className="flex-1">
          <div className="w-6 h-1 bg-muted-foreground/30 rounded-sm mb-0.5" />
          <div className="w-8 h-1 bg-muted rounded-sm" />
        </div>
      </div>
      
      {/* Table section */}
      <div className="mb-2">
        <div 
          className="flex gap-1 px-1 py-0.5 mb-0.5"
          style={{ 
            backgroundColor: template.tableStyle === 'minimal' ? 'transparent' : accentColor,
            borderBottom: template.tableStyle === 'minimal' ? `1px solid ${accentColor}` : 'none',
          }}
        >
          <div 
            className="flex-1 h-1 rounded-sm"
            style={{ 
              backgroundColor: template.tableStyle === 'minimal' ? '#666' : 'rgba(255,255,255,0.8)'
            }}
          />
        </div>
        {[0, 1, 2].map((i) => (
          <div 
            key={i}
            className="flex gap-1 px-1 py-0.5"
            style={{ 
              backgroundColor: template.tableStyle === 'striped' && i % 2 === 0 ? '#f9fafb' : 'transparent',
              borderBottom: template.tableStyle === 'bordered' ? '1px solid #eee' : 'none',
            }}
          >
            <div className="flex-1 h-1 bg-muted rounded-sm" />
            <div className="w-3 h-1 bg-muted rounded-sm" />
          </div>
        ))}
      </div>
      
      {/* Totals */}
      <div className="flex justify-end mb-2">
        <div className="w-12">
          <div className="flex justify-between mb-0.5">
            <div className="w-4 h-1 bg-muted rounded-sm" />
            <div className="w-3 h-1 bg-muted rounded-sm" />
          </div>
          <div 
            className="flex justify-between pt-0.5"
            style={{ borderTop: `1px solid ${accentColor}` }}
          >
            <div className="w-4 h-1 rounded-sm" style={{ backgroundColor: accentColor }} />
            <div className="w-4 h-1 rounded-sm" style={{ backgroundColor: accentColor }} />
          </div>
        </div>
      </div>
      
      {/* Notes section */}
      <div 
        className="p-1"
        style={{
          borderLeft: template.noteStyle === 'bordered' ? `2px solid ${accentColor}` : 'none',
          backgroundColor: template.noteStyle === 'bordered' ? '#fafafa' : 
                          template.noteStyle === 'highlighted' ? accentColor + '10' : 'transparent',
          borderRadius: template.noteStyle === 'highlighted' ? '2px' : 
                        template.noteStyle === 'bordered' ? '0 2px 2px 0' : '0',
          borderTop: template.noteStyle === 'simple' ? '1px solid #e5e7eb' : 'none',
        }}
      >
        <div className="w-8 h-1 bg-muted rounded-sm" />
      </div>
    </div>
  );
}

function StylePresetsWithPreview() {
  const { toast } = useToast();
  const [previewType, setPreviewType] = useState<"quote" | "invoice">("quote");
  const [selectedTemplateId, setSelectedTemplateId] = useState<TemplateId>('professional');
  
  // Customization state
  const [customization, setCustomization] = useState<TemplateCustomization>({
    tableStyle: 'bordered',
    noteStyle: 'bordered',
    headerBorderWidth: '2px',
    showHeaderDivider: true,
    bodyWeight: 600,
    headingWeight: 700,
    accentColor: DOCUMENT_ACCENT_COLOR,
  });

  const { data: business } = useBusinessSettings();

  const { data: presets = [], isLoading } = useQuery<StylePreset[]>({
    queryKey: ["/api/style-presets"],
  });

  // Get default preset accent color for preview
  const defaultPreset = presets.find(p => p.isDefault) || presets[0];
  const accentColor = customization.accentColor || defaultPreset?.accentColor || DOCUMENT_ACCENT_COLOR;

  // Track last user interaction to prevent server sync from overwriting active changes
  const lastUserChangeRef = useRef<number>(0);
  const SYNC_DEBOUNCE_MS = 3000; // Don't sync from server within 3 seconds of user change
  
  // Track if initial load has happened
  const hasInitialLoadRef = useRef(false);

  // Sync selected template from business settings
  // Runs on initial load and allows cross-device sync after user inactivity
  useEffect(() => {
    if (!business) return;
    
    const now = Date.now();
    const timeSinceLastChange = now - lastUserChangeRef.current;
    
    // Skip sync if user made changes within debounce period (prevents flicker)
    if (hasInitialLoadRef.current && timeSinceLastChange < SYNC_DEBOUNCE_MS) {
      return;
    }
    
    hasInitialLoadRef.current = true;
    
    if (business.documentTemplate) {
      let serverTemplateId = business.documentTemplate as TemplateId;
      // Backward compatibility: map legacy 'standard' to 'professional'
      if (serverTemplateId === 'standard' as any) {
        serverTemplateId = 'professional';
      }
      if (['professional', 'modern', 'minimal'].includes(serverTemplateId)) {
        // Only update if different from current (prevents unnecessary re-renders)
        setSelectedTemplateId(prev => prev !== serverTemplateId ? serverTemplateId : prev);
      }
    }
  }, [business?.documentTemplate]);

  // Load saved customization from business settings
  // Runs on initial load and allows cross-device sync after user inactivity
  useEffect(() => {
    if (!business) return;
    
    const now = Date.now();
    const timeSinceLastChange = now - lastUserChangeRef.current;
    
    // Skip sync if user made changes within debounce period (prevents flicker)
    if (hasInitialLoadRef.current && timeSinceLastChange < SYNC_DEBOUNCE_MS) {
      return;
    }
    
    const savedSettings = (business as any)?.documentTemplateSettings;
    if (savedSettings) {
      setCustomization(prev => ({
        ...prev,
        tableStyle: savedSettings.tableStyle || prev.tableStyle,
        noteStyle: savedSettings.noteStyle || prev.noteStyle,
        headerBorderWidth: savedSettings.headerBorderWidth || prev.headerBorderWidth,
        showHeaderDivider: savedSettings.showHeaderDivider ?? prev.showHeaderDivider,
        bodyWeight: savedSettings.bodyWeight || prev.bodyWeight,
        headingWeight: savedSettings.headingWeight || prev.headingWeight,
        accentColor: savedSettings.accentColor || prev.accentColor,
      }));
    }
  }, [(business as any)?.documentTemplateSettings]);

  // Reset customization to template defaults when user explicitly selects a new template
  const resetToTemplateDefaults = (templateId: TemplateId) => {
    const template = DOCUMENT_TEMPLATES[templateId];
    if (template) {
      setCustomization(prev => ({
        ...prev,
        tableStyle: template.tableStyle,
        noteStyle: template.noteStyle,
        headerBorderWidth: template.headerBorderWidth as '1px' | '2px' | '3px' | '4px',
        showHeaderDivider: template.showHeaderDivider,
        bodyWeight: template.bodyWeight as 400 | 500 | 600 | 700,
        headingWeight: template.headingWeight as 600 | 700 | 800,
      }));
    }
  };

  // Sync template selection to business settings (for PDF generation)
  // Note: We only update business settings - it's the single source of truth
  const updateTemplateMutation = useMutation({
    mutationFn: async (templateId: TemplateId) => {
      await apiRequest("PATCH", "/api/business-settings", {
        documentTemplate: templateId,
      });
    },
    onSuccess: () => {
      // Don't invalidate here - we've already updated local state
      // Invalidating causes unnecessary refetch and potential flicker
    },
  });

  const handleSelectTemplate = (templateId: TemplateId) => {
    // Mark user change timestamp to prevent server sync from overwriting
    lastUserChangeRef.current = Date.now();
    setSelectedTemplateId(templateId);
    resetToTemplateDefaults(templateId); // Reset to template defaults when user explicitly selects
    updateTemplateMutation.mutate(templateId);
    toast({ title: `${DOCUMENT_TEMPLATES[templateId].name} template selected` });
  };

  const updateCustomization = (updates: Partial<TemplateCustomization>) => {
    // Mark user change timestamp to prevent server sync from overwriting
    lastUserChangeRef.current = Date.now();
    setCustomization(prev => ({ ...prev, ...updates }));
  };

  // Save customization to server
  const saveCustomizationMutation = useMutation({
    mutationFn: async (customizationToSave: TemplateCustomization) => {
      await apiRequest("PATCH", "/api/business-settings", {
        documentTemplateSettings: customizationToSave,
      });
    },
    onSuccess: () => {
      // Don't invalidate - local state is already correct
      // This prevents unnecessary refetch and flicker
      toast({ title: "Template customisation saved" });
    },
    onError: () => {
      toast({ title: "Failed to save customisation", variant: "destructive" });
    },
  });

  const handleSaveCustomization = () => {
    // Mark user change timestamp to prevent server sync from overwriting
    lastUserChangeRef.current = Date.now();
    saveCustomizationMutation.mutate(buildTemplateCustomization());
  };

  // Build template customization for live preview
  const buildTemplateCustomization = (): TemplateCustomization => ({
    ...customization,
    accentColor: customization.accentColor || DOCUMENT_ACCENT_COLOR,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const templateIds: TemplateId[] = ['professional', 'modern', 'minimal'];

  return (
    <div className="space-y-8">
      {/* Main layout: Template cards + Customization on left, Preview on right */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left side: Template selection + Customization */}
        <div className="space-y-6">
          {/* Template Style Cards */}
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Template Style</h2>
              <p className="text-sm text-muted-foreground">
                Choose a base template for your quotes and invoices
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {templateIds.map((templateId) => {
                const template = DOCUMENT_TEMPLATES[templateId];
                const isActive = selectedTemplateId === templateId;
                
                return (
                  <Card 
                    key={templateId}
                    className={`cursor-pointer transition-all ${isActive ? 'ring-2 ring-primary' : 'hover-elevate'}`}
                    onClick={() => handleSelectTemplate(templateId)}
                    data-testid={`card-template-${templateId}`}
                  >
                    <CardContent className="p-3 space-y-3">
                      {/* Mini preview */}
                      <MiniTemplatePreview templateId={templateId} accentColor={accentColor} />
                      
                      {/* Template info */}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{template.name}</span>
                          {isActive && (
                            <Badge variant="default" className="text-xs">
                              <Check className="h-3 w-3 mr-1" />
                              Active
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {template.description}
                        </p>
                      </div>
                      
                      {/* Action button */}
                      {!isActive && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectTemplate(templateId);
                          }}
                        >
                          Select Template
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Customise Template Panel */}
          <Card data-testid="card-customise-template" className="relative overflow-hidden">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: "hsl(var(--trade) / 0.1)" }}
                >
                  <Settings className="h-5 w-5" style={{ color: "hsl(var(--trade))" }} />
                </div>
                <div>
                  <CardTitle className="text-lg">Customise Template</CardTitle>
                  <CardDescription>
                    Fine-tune the {DOCUMENT_TEMPLATES[selectedTemplateId].name} template
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Table Style */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Table Style</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(['bordered', 'striped', 'minimal'] as const).map((style) => (
                    <Button
                      key={style}
                      variant={customization.tableStyle === style ? "default" : "outline"}
                      size="sm"
                      onClick={() => updateCustomization({ tableStyle: style })}
                      className="capitalize"
                    >
                      {style}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Accent Colour */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Accent Colour</Label>
                <div className="flex items-center gap-3">
                  <Input
                    type="color"
                    value={customization.accentColor || DOCUMENT_ACCENT_COLOR}
                    onChange={(e) => updateCustomization({ accentColor: e.target.value })}
                    className="w-12 h-9 p-1 cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={customization.accentColor || DOCUMENT_ACCENT_COLOR}
                    onChange={(e) => updateCustomization({ accentColor: e.target.value })}
                    className="flex-1 font-mono text-sm"
                    placeholder="#2563eb"
                  />
                </div>
              </div>

              {/* Header Border */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Header Border</Label>
                <div className="grid grid-cols-4 gap-2">
                  {(['1px', '2px', '3px', '4px'] as const).map((width) => (
                    <Button
                      key={width}
                      variant={customization.headerBorderWidth === width ? "default" : "outline"}
                      size="sm"
                      onClick={() => updateCustomization({ headerBorderWidth: width })}
                    >
                      {width}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Show Header Divider */}
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Show Header Divider</Label>
                <Switch
                  checked={customization.showHeaderDivider}
                  onCheckedChange={(checked) => updateCustomization({ showHeaderDivider: checked })}
                />
              </div>

              {/* Font Weights */}
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Body Font Weight</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {([400, 500, 600, 700] as const).map((weight) => (
                      <Button
                        key={weight}
                        variant={customization.bodyWeight === weight ? "default" : "outline"}
                        size="sm"
                        onClick={() => updateCustomization({ bodyWeight: weight })}
                      >
                        {weight}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Heading Font Weight</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {([600, 700, 800] as const).map((weight) => (
                      <Button
                        key={weight}
                        variant={customization.headingWeight === weight ? "default" : "outline"}
                        size="sm"
                        onClick={() => updateCustomization({ headingWeight: weight })}
                      >
                        {weight}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Note Style */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Note Style</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(['simple', 'bordered', 'filled'] as const).map((style) => (
                    <Button
                      key={style}
                      variant={customization.noteStyle === style ? "default" : "outline"}
                      size="sm"
                      onClick={() => updateCustomization({ noteStyle: style })}
                      className="capitalize"
                    >
                      {style}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Save Button */}
              <div className="pt-4 border-t">
                <Button 
                  onClick={handleSaveCustomization}
                  disabled={saveCustomizationMutation.isPending}
                  className="w-full"
                >
                  {saveCustomizationMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Customisation"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right side: Live preview */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-lg font-semibold">Live Preview</h2>
              <p className="text-sm text-muted-foreground">
                See how your documents will look
              </p>
            </div>
            <Select value={previewType} onValueChange={(v) => setPreviewType(v as "quote" | "invoice")}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="quote">Quote</SelectItem>
                <SelectItem value="invoice">Invoice</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card className="overflow-hidden">
            <CardContent className="p-0">
              {business ? (
                <div className="bg-muted/30 p-4">
                  <div className="bg-white rounded-lg shadow-sm overflow-hidden" style={{ maxHeight: '700px', overflow: 'auto' }}>
                    <LiveDocumentPreview
                      type={previewType}
                      documentNumber={previewType === 'quote' ? 'Q-2024-001' : 'INV-2024-001'}
                      title={previewType === 'quote' ? 'Quote' : 'Invoice'}
                      date={new Date().toISOString()}
                      validUntil={previewType === 'quote' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : undefined}
                      dueDate={previewType === 'invoice' ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() : undefined}
                      business={{
                        businessName: business.businessName || business.name || "Your Business",
                        email: business.email || "email@example.com",
                        phone: business.phone || "",
                        address: business.address || "",
                        abn: business.abn || "",
                        logoUrl: business.logoUrl || "",
                      }}
                      client={{
                        name: "Sample Client",
                        email: "client@example.com",
                        phone: "0400 000 000",
                        address: "123 Sample Street, Sydney NSW 2000",
                      }}
                      lineItems={[
                        { description: "Labour - Standard Rate", quantity: 4, unitPrice: 85 },
                        { description: "Materials and Supplies", quantity: 1, unitPrice: 150 },
                        { description: "Site Preparation", quantity: 2, unitPrice: 65 },
                      ]}
                      notes="Thank you for your business. Payment is due within 14 days of invoice date."
                      gstEnabled={business.gstEnabled ?? true}
                      templateId={selectedTemplateId}
                      templateCustomization={buildTemplateCustomization()}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center py-16 text-center">
                  <div>
                    <Eye className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Configure your business settings to see preview
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Template Features Comparison Table */}
      <Card data-testid="card-template-features">
        <CardHeader>
          <CardTitle className="text-lg">Template Features</CardTitle>
          <CardDescription>Compare the built-in features of each template style</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-semibold">Feature</th>
                  <th className="text-center py-3 px-4 font-semibold">Professional</th>
                  <th className="text-center py-3 px-4 font-semibold">Modern</th>
                  <th className="text-center py-3 px-4 font-semibold">Minimal</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr>
                  <td className="py-3 px-4 text-muted-foreground">Default Table Style</td>
                  <td className="py-3 px-4 text-center">Bordered</td>
                  <td className="py-3 px-4 text-center">Striped</td>
                  <td className="py-3 px-4 text-center">Minimal</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 text-muted-foreground">Header Divider</td>
                  <td className="py-3 px-4 text-center">Yes (2px)</td>
                  <td className="py-3 px-4 text-center">Yes (3px)</td>
                  <td className="py-3 px-4 text-center">No</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 text-muted-foreground">Notes Style</td>
                  <td className="py-3 px-4 text-center">Bordered</td>
                  <td className="py-3 px-4 text-center">Highlighted</td>
                  <td className="py-3 px-4 text-center">Simple</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 text-muted-foreground">Best For</td>
                  <td className="py-3 px-4 text-center">
                    <Badge variant="secondary">Traditional business</Badge>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Badge variant="secondary">Modern trades</Badge>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Badge variant="secondary">Clean aesthetic</Badge>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function RateCardsSection() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingCard, setEditingCard] = useState<RateCard | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [cardToDelete, setCardToDelete] = useState<RateCard | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    tradeType: "general",
    hourlyRate: "100.00",
    calloutFee: "80.00",
    materialMarkupPct: "20.00",
    afterHoursMultiplier: "1.50",
    gstEnabled: true,
  });

  const { data: user } = useQuery<{ tradeType?: string }>({
    queryKey: ["/api/auth/me"],
  });

  const { data: rateCards = [], isLoading } = useQuery<RateCard[]>({
    queryKey: ["/api/rate-cards"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("POST", "/api/rate-cards", data);
    },
    onSuccess: () => {
      toast({ title: "Rate card created" });
      setDialogOpen(false);
      resetFormData();
      queryClient.invalidateQueries({ queryKey: ["/api/rate-cards"] });
    },
    onError: () => {
      toast({ title: "Failed to create rate card", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      return apiRequest("PATCH", `/api/rate-cards/${id}`, data);
    },
    onSuccess: () => {
      toast({ title: "Rate card updated" });
      setDialogOpen(false);
      setEditingCard(null);
      resetFormData();
      queryClient.invalidateQueries({ queryKey: ["/api/rate-cards"] });
    },
    onError: () => {
      toast({ title: "Failed to update rate card", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/rate-cards/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Rate card deleted" });
      setDeleteConfirmOpen(false);
      setCardToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["/api/rate-cards"] });
    },
    onError: () => {
      toast({ title: "Failed to delete rate card", variant: "destructive" });
    },
  });

  const resetFormData = () => {
    setFormData({
      name: "",
      tradeType: user?.tradeType || "general",
      hourlyRate: "100.00",
      calloutFee: "80.00",
      materialMarkupPct: "20.00",
      afterHoursMultiplier: "1.50",
      gstEnabled: true,
    });
  };

  const handleEditCard = (card: RateCard) => {
    setEditingCard(card);
    setFormData({
      name: card.name,
      tradeType: card.tradeType || "general",
      hourlyRate: String(card.hourlyRate || "100.00"),
      calloutFee: String(card.calloutFee || "80.00"),
      materialMarkupPct: String(card.materialMarkupPct || "20.00"),
      afterHoursMultiplier: String(card.afterHoursMultiplier || "1.50"),
      gstEnabled: card.gstEnabled !== false,
    });
    setDialogOpen(true);
  };

  const handleDeleteCard = (card: RateCard) => {
    setCardToDelete(card);
    setDeleteConfirmOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingCard(null);
    resetFormData();
  };

  const handleSubmit = () => {
    if (editingCard) {
      updateMutation.mutate({ id: editingCard.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const filteredCards = rateCards.filter((card) =>
    card.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    card.tradeType?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Input
            placeholder="Search rate cards..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8"
          />
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)} data-testid="button-create-rate-card">
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        {filteredCards.length} of {rateCards.length} rate card{rateCards.length !== 1 ? "s" : ""}
      </p>

      {filteredCards.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          {rateCards.length === 0 ? "No rate cards yet. Create one to set your pricing." : "No matching rate cards found."}
        </p>
      ) : (
        <ScrollArea className="h-[200px]">
          <div className="space-y-2 pr-3">
            {filteredCards.map((card) => (
              <div
                key={card.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 gap-2"
                data-testid={`rate-card-${card.id}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{card.name}</p>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1 flex-wrap">
                    <span>${card.hourlyRate}/hr</span>
                    <span>Callout: ${card.calloutFee}</span>
                    <span>{card.afterHoursMultiplier}x after hours</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="capitalize">
                    {card.tradeType}
                  </Badge>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    onClick={() => handleEditCard(card)}
                    data-testid={`button-edit-rate-card-${card.id}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="text-destructive"
                    onClick={() => handleDeleteCard(card)}
                    data-testid={`button-delete-rate-card-${card.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCard ? "Edit Rate Card" : "Create Rate Card"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rate-name">Name</Label>
              <Input
                id="rate-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Standard Rates"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="hourlyRate">Hourly Rate ($)</Label>
                <Input
                  id="hourlyRate"
                  type="number"
                  step="0.01"
                  value={formData.hourlyRate}
                  onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="calloutFee">Callout Fee ($)</Label>
                <Input
                  id="calloutFee"
                  type="number"
                  step="0.01"
                  value={formData.calloutFee}
                  onChange={(e) => setFormData({ ...formData, calloutFee: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="afterHoursMultiplier">After Hours Multiplier</Label>
                <Input
                  id="afterHoursMultiplier"
                  type="number"
                  step="0.1"
                  value={formData.afterHoursMultiplier}
                  onChange={(e) => setFormData({ ...formData, afterHoursMultiplier: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="materialMarkupPct">Material Markup (%)</Label>
                <Input
                  id="materialMarkupPct"
                  type="number"
                  step="1"
                  value={formData.materialMarkupPct}
                  onChange={(e) => setFormData({ ...formData, materialMarkupPct: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="gstEnabled">GST Enabled</Label>
              <Switch
                id="gstEnabled"
                checked={formData.gstEnabled}
                onCheckedChange={(checked) => setFormData({ ...formData, gstEnabled: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!formData.name || createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingCard ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rate Card</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{cardToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCardToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cardToDelete && deleteMutation.mutate(cardToDelete.id)}
              className="bg-destructive text-destructive-foreground"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function LineItemsCatalogSection() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingItem, setEditingItem] = useState<LineItemCatalog | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<LineItemCatalog | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    unit: "item",
    unitPrice: "0.00",
    tradeType: "general",
    defaultQty: "1.00",
  });

  const { data: user } = useQuery<{ tradeType?: string }>({
    queryKey: ["/api/auth/me"],
  });

  const { data: catalogItems = [], isLoading } = useQuery<LineItemCatalog[]>({
    queryKey: ["/api/catalog"],
  });

  const resetFormData = () => {
    setFormData({
      name: "",
      description: "",
      unit: "item",
      unitPrice: "0.00",
      tradeType: user?.tradeType || "general",
      defaultQty: "1.00",
    });
  };

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("POST", "/api/catalog", data);
    },
    onSuccess: () => {
      toast({ title: "Catalog item created" });
      setDialogOpen(false);
      resetFormData();
      queryClient.invalidateQueries({ queryKey: ["/api/catalog"] });
    },
    onError: () => {
      toast({ title: "Failed to create item", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      return apiRequest("PATCH", `/api/catalog/${id}`, data);
    },
    onSuccess: () => {
      toast({ title: "Catalog item updated" });
      setDialogOpen(false);
      setEditingItem(null);
      resetFormData();
      queryClient.invalidateQueries({ queryKey: ["/api/catalog"] });
    },
    onError: () => {
      toast({ title: "Failed to update item", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/catalog/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Catalog item deleted" });
      setDeleteConfirmOpen(false);
      setItemToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["/api/catalog"] });
    },
    onError: () => {
      toast({ title: "Failed to delete item", variant: "destructive" });
    },
  });

  const handleEditItem = (item: LineItemCatalog) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description || "",
      unit: item.unit || "item",
      unitPrice: String(item.unitPrice || "0.00"),
      tradeType: item.tradeType || "general",
      defaultQty: String(item.defaultQuantity || "1.00"),
    });
    setDialogOpen(true);
  };

  const handleDeleteItem = (item: LineItemCatalog) => {
    setItemToDelete(item);
    setDeleteConfirmOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingItem(null);
    resetFormData();
  };

  const handleSubmit = () => {
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const filteredItems = catalogItems.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Input
            placeholder="Search catalog items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8"
          />
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)} data-testid="button-create-catalog-item">
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        {filteredItems.length} of {catalogItems.length} item{catalogItems.length !== 1 ? "s" : ""} in catalog
      </p>

      {filteredItems.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          {catalogItems.length === 0 ? "No catalog items yet. Add items you use frequently." : "No matching items found."}
        </p>
      ) : (
        <ScrollArea className="h-[200px]">
          <div className="space-y-2 pr-3">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 gap-2"
                data-testid={`catalog-item-${item.id}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.name}</p>
                  <p className="text-sm text-muted-foreground truncate">
                    {item.description}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline">${item.unitPrice}/{item.unit}</Badge>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    onClick={() => handleEditItem(item)}
                    data-testid={`button-edit-catalog-item-${item.id}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="text-destructive"
                    onClick={() => handleDeleteItem(item)}
                    data-testid={`button-delete-catalog-item-${item.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Catalog Item" : "Add Catalog Item"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="item-name">Name</Label>
              <Input
                id="item-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Labour - Standard"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="item-description">Description</Label>
              <Input
                id="item-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="unitPrice">Unit Price ($)</Label>
                <Input
                  id="unitPrice"
                  type="number"
                  step="0.01"
                  value={formData.unitPrice}
                  onChange={(e) => setFormData({ ...formData, unitPrice: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Unit</Label>
                <Select
                  value={formData.unit}
                  onValueChange={(value) => setFormData({ ...formData, unit: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT_OPTIONS.map((unit) => (
                      <SelectItem key={unit.value} value={unit.value}>
                        {unit.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!formData.name || createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingItem ? "Save Changes" : "Add Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Catalog Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{itemToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setItemToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => itemToDelete && deleteMutation.mutate(itemToDelete.id)}
              className="bg-destructive text-destructive-foreground"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ComponentsTab() {
  const [rateCardsOpen, setRateCardsOpen] = useState(true);
  const [lineItemsOpen, setLineItemsOpen] = useState(true);
  const { data: business } = useBusinessSettings();

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Reusable Components</h2>
          <p className="text-sm text-muted-foreground">
            Building blocks for your quotes and invoices
          </p>
        </div>

        <div className="space-y-4">
          <Collapsible open={rateCardsOpen} onOpenChange={setRateCardsOpen}>
            <Card data-testid="card-rate-cards">
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover-elevate rounded-t-xl">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: "hsl(var(--trade) / 0.1)" }}
                      >
                        <DollarSign className="h-5 w-5" style={{ color: "hsl(var(--trade))" }} />
                      </div>
                      <div>
                        <CardTitle className="text-lg">Rate Cards</CardTitle>
                        <CardDescription>Hourly rates, callout fees, and multipliers</CardDescription>
                      </div>
                    </div>
                    {rateCardsOpen ? (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  <RateCardsSection />
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          <Collapsible open={lineItemsOpen} onOpenChange={setLineItemsOpen}>
            <Card data-testid="card-line-items">
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover-elevate rounded-t-xl">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: "hsl(var(--trade) / 0.1)" }}
                      >
                        <Package className="h-5 w-5" style={{ color: "hsl(var(--trade))" }} />
                      </div>
                      <div>
                        <CardTitle className="text-lg">Line Items Catalog</CardTitle>
                        <CardDescription>Reusable items for quotes and invoices</CardDescription>
                      </div>
                    </div>
                    {lineItemsOpen ? (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  <LineItemsCatalogSection />
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </div>
      </div>
      
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Preview</h2>
          <p className="text-sm text-muted-foreground">
            See how components appear in documents
          </p>
        </div>
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="bg-muted/30 p-4">
              <div className="bg-white rounded-lg shadow-sm overflow-hidden" style={{ maxHeight: '600px', overflow: 'auto' }}>
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    {business?.logoUrl && (
                      <img src={business.logoUrl} alt="Logo" className="h-12 w-auto object-contain" />
                    )}
                    <div>
                      <h3 className="font-bold text-lg" style={{ color: '#1f3a5f' }}>
                        {business?.businessName || 'Your Business'}
                      </h3>
                      <p className="text-sm text-muted-foreground">{business?.address}</p>
                    </div>
                  </div>
                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-2">Rate Cards & Line Items</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Your rate cards and line items will be used when creating quotes and invoices. Add frequently used items to save time.
                    </p>
                    <div className="space-y-2">
                      <div className="p-3 rounded-lg bg-muted/50 border">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">Labour - Standard Rate</span>
                          <span className="text-sm text-muted-foreground">$85/hour</span>
                        </div>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/50 border">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">Materials & Supplies</span>
                          <span className="text-sm text-muted-foreground">$150/item</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FormsTab() {
  const { data: business } = useBusinessSettings();
  const { toast } = useToast();
  const [safetyFormsOpen, setSafetyFormsOpen] = useState(true);
  const [complianceFormsOpen, setComplianceFormsOpen] = useState(true);
  const [inspectionFormsOpen, setInspectionFormsOpen] = useState(true);
  const [selectedForm, setSelectedForm] = useState<CustomForm | null>(null);
  const [editFormId, setEditFormId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [formToDelete, setFormToDelete] = useState<CustomForm | null>(null);

  const { data: forms = [], isLoading } = useQuery<CustomForm[]>({
    queryKey: ["/api/custom-forms"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/custom-forms/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Form deleted" });
      setDeleteConfirmOpen(false);
      setFormToDelete(null);
      if (selectedForm?.id === formToDelete?.id) {
        setSelectedForm(null);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/custom-forms"] });
    },
    onError: () => {
      toast({ title: "Failed to delete form", variant: "destructive" });
    },
  });

  const handleEditForm = (form: CustomForm) => {
    setEditFormId(form.id);
  };

  const handleDeleteForm = (form: CustomForm, e: React.MouseEvent) => {
    e.stopPropagation();
    setFormToDelete(form);
    setDeleteConfirmOpen(true);
  };

  const safetyForms = forms.filter(f => f.formType === 'safety' && f.isActive);
  const complianceForms = forms.filter(f => f.formType === 'compliance' && f.isActive);
  const inspectionForms = forms.filter(f => f.formType === 'inspection' && f.isActive);

  const getFormTypeIcon = (formType: string) => {
    switch (formType) {
      case 'safety':
        return <Shield className="h-4 w-4" />;
      case 'compliance':
        return <ClipboardCheck className="h-4 w-4" />;
      case 'inspection':
        return <Search className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getFormTypeBadgeVariant = (formType: string): "default" | "secondary" | "outline" => {
    switch (formType) {
      case 'safety':
        return "default";
      case 'compliance':
        return "secondary";
      case 'inspection':
        return "outline";
      default:
        return "outline";
    }
  };

  const renderFormCard = (form: CustomForm) => (
    <Card 
      key={form.id}
      className={`cursor-pointer transition-all ${selectedForm?.id === form.id ? 'ring-2 ring-primary' : 'hover-elevate'}`}
      onClick={() => setSelectedForm(form)}
      data-testid={`card-form-${form.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: "hsl(var(--trade) / 0.1)" }}
            >
              {getFormTypeIcon(form.formType || 'general')}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium truncate">{form.name}</span>
                <Badge variant={getFormTypeBadgeVariant(form.formType || 'general')} className="text-xs capitalize flex-shrink-0">
                  {form.formType || 'general'}
                </Badge>
                {form.requiresSignature && (
                  <Badge variant="outline" className="text-xs flex-shrink-0">
                    Signature
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                <Calendar className="h-3 w-3" />
                <span>
                  {form.updatedAt 
                    ? format(new Date(form.updatedAt), 'dd MMM yyyy') 
                    : form.createdAt 
                      ? format(new Date(form.createdAt), 'dd MMM yyyy')
                      : 'Unknown'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button 
              size="icon" 
              variant="ghost" 
              onClick={(e) => {
                e.stopPropagation();
                handleEditForm(form);
              }}
              data-testid={`button-edit-form-${form.id}`}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button 
              size="icon" 
              variant="ghost" 
              className="text-destructive"
              onClick={(e) => handleDeleteForm(form, e)}
              data-testid={`button-delete-form-${form.id}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderFormSection = (
    title: string,
    description: string,
    forms: CustomForm[],
    icon: React.ReactNode,
    isOpen: boolean,
    setIsOpen: (open: boolean) => void,
    testId: string
  ) => (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card data-testid={testId}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover-elevate rounded-t-xl">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: "hsl(var(--trade) / 0.1)" }}
                >
                  {icon}
                </div>
                <div>
                  <CardTitle className="text-lg">{title}</CardTitle>
                  <CardDescription>{description}</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">{forms.length}</Badge>
                {isOpen ? (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            {forms.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <p className="text-sm">No {title.toLowerCase()} created yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {forms.map(renderFormCard)}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const totalForms = safetyForms.length + complianceForms.length + inspectionForms.length;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold">Form Templates</h2>
            <p className="text-sm text-muted-foreground">
              Safety, compliance, and inspection forms
            </p>
          </div>
          <Button size="sm" data-testid="button-create-form">
            <Plus className="h-4 w-4 mr-2" />
            Create Form
          </Button>
        </div>

        {totalForms === 0 ? (
          <Card className="p-6 text-center">
            <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <h3 className="font-semibold mb-2">No forms yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create safety checklists, compliance forms, and inspection templates for your job sites.
            </p>
            <Button size="sm" data-testid="button-create-form-empty">
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Form
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {renderFormSection(
              "Safety Forms",
              "SWMS, JSA, and safety checklists",
              safetyForms,
              <Shield className="h-5 w-5" style={{ color: "hsl(var(--trade))" }} />,
              safetyFormsOpen,
              setSafetyFormsOpen,
              "card-safety-forms"
            )}

            {renderFormSection(
              "Compliance Forms",
              "Regulatory and compliance documentation",
              complianceForms,
              <ClipboardCheck className="h-5 w-5" style={{ color: "hsl(var(--trade))" }} />,
              complianceFormsOpen,
              setComplianceFormsOpen,
              "card-compliance-forms"
            )}

            {renderFormSection(
              "Inspection Forms",
              "Site inspections and quality checks",
              inspectionForms,
              <Search className="h-5 w-5" style={{ color: "hsl(var(--trade))" }} />,
              inspectionFormsOpen,
              setInspectionFormsOpen,
              "card-inspection-forms"
            )}
          </div>
        )}
      </div>
      
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Preview</h2>
          <p className="text-sm text-muted-foreground">
            {selectedForm ? `Preview: ${selectedForm.name}` : "Select a form to preview"}
          </p>
        </div>
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="bg-muted/30 p-4">
              <div className="bg-white rounded-lg shadow-sm overflow-hidden" style={{ maxHeight: '600px', overflow: 'auto' }}>
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    {business?.logoUrl && (
                      <img src={business.logoUrl} alt="Logo" className="h-12 w-auto object-contain" />
                    )}
                    <div>
                      <h3 className="font-bold text-lg" style={{ color: '#1f3a5f' }}>
                        {business?.businessName || 'Your Business'}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {selectedForm?.name || 'Safety Checklist'}
                      </p>
                    </div>
                  </div>
                  
                  {selectedForm ? (
                    <div className="space-y-4 border-t pt-4">
                      {selectedForm.description && (
                        <p className="text-sm text-muted-foreground">{selectedForm.description}</p>
                      )}
                      
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={getFormTypeBadgeVariant(selectedForm.formType || 'general')} className="capitalize">
                          {getFormTypeIcon(selectedForm.formType || 'general')}
                          <span className="ml-1">{selectedForm.formType || 'General'}</span>
                        </Badge>
                        {selectedForm.requiresSignature && (
                          <Badge variant="outline">Requires Signature</Badge>
                        )}
                        {selectedForm.tradeType && selectedForm.tradeType !== 'general' && (
                          <Badge variant="secondary" className="capitalize">{selectedForm.tradeType}</Badge>
                        )}
                      </div>

                      <div className="space-y-3 border-t pt-4">
                        {Array.isArray(selectedForm.fields) && selectedForm.fields.length > 0 ? (
                          (selectedForm.fields as Array<{ label?: string; type?: string }>).slice(0, 5).map((field, index) => (
                            <div key={index} className="flex items-center gap-2">
                              {field.type === 'checkbox' ? (
                                <div className="w-5 h-5 border-2 rounded" />
                              ) : (
                                <div className="w-5 h-5 border-2 rounded-full" />
                              )}
                              <span className="text-sm">{field.label || `Field ${index + 1}`}</span>
                            </div>
                          ))
                        ) : (
                          <>
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 border-2 rounded" />
                              <span className="text-sm">Sample checklist item</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 border-2 rounded" />
                              <span className="text-sm">Another item to verify</span>
                            </div>
                          </>
                        )}
                        
                        {Array.isArray(selectedForm.fields) && selectedForm.fields.length > 5 && (
                          <p className="text-xs text-muted-foreground">
                            +{selectedForm.fields.length - 5} more fields...
                          </p>
                        )}
                      </div>

                      {selectedForm.requiresSignature && (
                        <div className="border-t pt-3 mt-3">
                          <p className="text-xs text-muted-foreground">Signature required</p>
                          <div className="h-16 border-2 border-dashed rounded mt-2" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3 border-t pt-4">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 border-2 rounded" />
                        <span className="text-sm">Site hazards identified</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 border-2 rounded" />
                        <span className="text-sm">PPE requirements verified</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 border-2 rounded" />
                        <span className="text-sm">Emergency exits noted</span>
                      </div>
                      <div className="border-t pt-3 mt-3">
                        <p className="text-xs text-muted-foreground">Signature required</p>
                        <div className="h-16 border-2 border-dashed rounded mt-2" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Form</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{formToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setFormToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => formToDelete && deleteMutation.mutate(formToDelete.id)}
              className="bg-destructive text-destructive-foreground"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {editFormId && (
        <Dialog open={!!editFormId} onOpenChange={() => setEditFormId(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Form</DialogTitle>
            </DialogHeader>
            <FormBuilder
              formId={editFormId}
              onBack={() => {
                setEditFormId(null);
                queryClient.invalidateQueries({ queryKey: ["/api/custom-forms"] });
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export default function TemplatesHub() {
  return (
    <PageShell>
      <PageHeader
        title="Templates Hub"
        subtitle="Customize your document styles, components, and forms"
        leading={<Palette className="h-5 w-5" style={{ color: "hsl(var(--trade))" }} />}
      />

      <div className="mt-6">
        <Tabs defaultValue="styles" className="space-y-6">
          <TabsList>
            <TabsTrigger value="styles" className="gap-2">
              <Palette className="h-4 w-4" />
              Styles
            </TabsTrigger>
            <TabsTrigger value="components" className="gap-2">
              <Layers className="h-4 w-4" />
              Components
            </TabsTrigger>
            <TabsTrigger value="forms" className="gap-2">
              <FileText className="h-4 w-4" />
              Forms
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="styles">
            <StylePresetsWithPreview />
          </TabsContent>
          
          <TabsContent value="components">
            <ComponentsTab />
          </TabsContent>
          
          <TabsContent value="forms">
            <FormsTab />
          </TabsContent>
        </Tabs>
      </div>
    </PageShell>
  );
}
