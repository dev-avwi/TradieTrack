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
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { StylePreset } from "@shared/schema";
import LiveDocumentPreview from "@/components/LiveDocumentPreview";
import { useBusinessSettings } from "@/hooks/use-business-settings";
import { TemplateId, TemplateCustomization } from "@/lib/document-templates";

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

function StylePresetsWithPreview() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<StylePreset | null>(null);
  const [previewPreset, setPreviewPreset] = useState<StylePreset | null>(null);
  const [previewType, setPreviewType] = useState<"quote" | "invoice">("quote");
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    logoUrl: "",
    primaryColor: "#1f3a5f",
    accentColor: "#1f3a5f",
    fontFamily: "Inter",
    headerLayout: "standard",
    footerLayout: "standard",
    showLogo: true,
    showBusinessDetails: true,
    showBankDetails: true,
    tableBorders: true,
    alternateRowColors: true,
    compactMode: false,
    isDefault: false,
  });

  const { data: business } = useBusinessSettings();

  const { data: presets = [], isLoading } = useQuery<StylePreset[]>({
    queryKey: ["/api/style-presets"],
  });

  // Auto-select default preset for preview
  useEffect(() => {
    if (presets.length > 0 && !previewPreset) {
      const defaultPreset = presets.find(p => p.isDefault) || presets[0];
      setPreviewPreset(defaultPreset);
    }
  }, [presets, previewPreset]);

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("POST", "/api/style-presets", data);
    },
    onSuccess: () => {
      toast({ title: "Style preset created" });
      setDialogOpen(false);
      resetForm();
      setIsCreating(false);
      queryClient.invalidateQueries({ queryKey: ["/api/style-presets"] });
    },
    onError: () => {
      toast({ title: "Failed to create preset", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      return apiRequest("PATCH", `/api/style-presets/${id}`, data);
    },
    onSuccess: () => {
      toast({ title: "Style preset updated" });
      setDialogOpen(false);
      resetForm();
      setIsCreating(false);
      queryClient.invalidateQueries({ queryKey: ["/api/style-presets"] });
    },
    onError: () => {
      toast({ title: "Failed to update preset", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/style-presets/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Style preset deleted" });
      setDeleteDialogOpen(false);
      setSelectedPreset(null);
      if (previewPreset?.id === selectedPreset?.id) {
        setPreviewPreset(null);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/style-presets"] });
    },
    onError: () => {
      toast({ title: "Failed to delete preset", variant: "destructive" });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("PATCH", `/api/style-presets/${id}`, { isDefault: true });
    },
    onSuccess: () => {
      toast({ title: "Default style updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/style-presets"] });
    },
    onError: () => {
      toast({ title: "Failed to set default", variant: "destructive" });
    },
  });

  const createDefaultPresetMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/style-presets", {
        name: "Professional Navy",
        primaryColor: "#1f3a5f",
        accentColor: "#1f3a5f",
        fontFamily: "Inter",
        headerLayout: "standard",
        footerLayout: "standard",
        showLogo: true,
        showBusinessDetails: true,
        showBankDetails: true,
        tableBorders: true,
        alternateRowColors: true,
        compactMode: false,
        isDefault: true,
      });
    },
    onSuccess: () => {
      toast({ title: "Default style created" });
      queryClient.invalidateQueries({ queryKey: ["/api/style-presets"] });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      logoUrl: "",
      primaryColor: "#1f3a5f",
      accentColor: "#1f3a5f",
      fontFamily: "Inter",
      headerLayout: "standard",
      footerLayout: "standard",
      showLogo: true,
      showBusinessDetails: true,
      showBankDetails: true,
      tableBorders: true,
      alternateRowColors: true,
      compactMode: false,
      isDefault: false,
    });
    setSelectedPreset(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsCreating(true);
    setDialogOpen(true);
  };

  const openEditDialog = (preset: StylePreset) => {
    setIsCreating(false);
    setSelectedPreset(preset);
    setFormData({
      name: preset.name,
      logoUrl: preset.logoUrl || "",
      primaryColor: preset.primaryColor || "#1f3a5f",
      accentColor: preset.accentColor || "#1f3a5f",
      fontFamily: preset.fontFamily || "Inter",
      headerLayout: preset.headerLayout || "standard",
      footerLayout: preset.footerLayout || "standard",
      showLogo: preset.showLogo ?? true,
      showBusinessDetails: preset.showBusinessDetails ?? true,
      showBankDetails: preset.showBankDetails ?? true,
      tableBorders: preset.tableBorders ?? true,
      alternateRowColors: preset.alternateRowColors ?? true,
      compactMode: preset.compactMode ?? false,
      isDefault: preset.isDefault ?? false,
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (isCreating) {
      createMutation.mutate(formData);
    } else if (selectedPreset) {
      updateMutation.mutate({ id: selectedPreset.id, data: formData });
    }
  };

  // Build template customization from preset for preview
  const buildTemplateCustomization = (preset: StylePreset): TemplateCustomization => ({
    primaryColor: preset.primaryColor || "#1f3a5f",
    accentColor: preset.accentColor || "#1f3a5f",
    fontFamily: preset.fontFamily || "Inter",
    logoUrl: preset.logoUrl,
    showLogo: preset.showLogo ?? true,
    showBusinessDetails: preset.showBusinessDetails ?? true,
    showBankDetails: preset.showBankDetails ?? true,
    tableBorders: preset.tableBorders ?? true,
    alternateRowColors: preset.alternateRowColors ?? true,
    compactMode: preset.compactMode ?? false,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Left side: Style presets list */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold">Document Styles</h2>
            <p className="text-sm text-muted-foreground">
              Click a style to preview it
            </p>
          </div>
          <Button onClick={openCreateDialog} size="sm" data-testid="button-create-style">
            <Plus className="h-4 w-4 mr-2" />
            New Style
          </Button>
        </div>

        {presets.length === 0 ? (
          <Card className="p-6 text-center">
            <Palette className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <h3 className="font-semibold mb-2">No style presets yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first style to customize your documents
            </p>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <Button onClick={() => createDefaultPresetMutation.mutate()} variant="default" size="sm">
                {createDefaultPresetMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Use Default Style
              </Button>
              <Button onClick={openCreateDialog} variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Create Custom
              </Button>
            </div>
          </Card>
        ) : (
          <div className="space-y-2">
            {presets.map((preset) => (
              <Card 
                key={preset.id} 
                className={`cursor-pointer transition-all ${previewPreset?.id === preset.id ? 'ring-2 ring-primary' : 'hover-elevate'}`}
                onClick={() => setPreviewPreset(preset)}
                data-testid={`card-style-${preset.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="flex gap-1">
                        <ColorSwatch color={preset.primaryColor || "#1f3a5f"} />
                        <ColorSwatch color={preset.accentColor || "#1f3a5f"} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{preset.name}</span>
                          {preset.isDefault && (
                            <Badge variant="secondary" className="text-xs flex-shrink-0">
                              <Star className="h-3 w-3 mr-1" />
                              Default
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{preset.fontFamily || "Inter"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      {!preset.isDefault && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDefaultMutation.mutate(preset.id)}
                          title="Set as default"
                        >
                          <Star className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(preset)}
                        data-testid={`button-edit-style-${preset.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedPreset(preset);
                          setDeleteDialogOpen(true);
                        }}
                        data-testid={`button-delete-style-${preset.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
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
            {previewPreset && business ? (
              <div className="bg-muted/30 p-4">
                <div className="bg-white rounded-lg shadow-sm overflow-hidden" style={{ maxHeight: '600px', overflow: 'auto' }}>
                  <LiveDocumentPreview
                    documentType={previewType}
                    business={{
                      businessName: business.businessName || business.name || "Your Business",
                      email: business.email || "email@example.com",
                      phone: business.phone || "",
                      address: business.address || "",
                      abn: business.abn || "",
                      logoUrl: business.logoUrl || "",
                      bankName: business.bankName || "",
                      bankBsb: business.bankBsb || "",
                      bankAccount: business.bankAccount || "",
                    }}
                    client={{
                      name: "Sample Client",
                      email: "client@example.com",
                      phone: "0400 000 000",
                      address: "123 Sample Street, Sydney NSW 2000",
                    }}
                    lineItems={[
                      { description: "Labour - Standard Rate", quantity: 4, unitPrice: 85, unit: "hour" },
                      { description: "Materials and Supplies", quantity: 1, unitPrice: 150, unit: "item" },
                    ]}
                    gstEnabled={business.gstEnabled ?? true}
                    templateId={"modern-professional" as TemplateId}
                    templateCustomization={buildTemplateCustomization(previewPreset)}
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-16 text-center">
                <div>
                  <Eye className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {presets.length === 0 ? "Create a style to see preview" : "Select a style to preview"}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit/Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isCreating ? "Create Style Preset" : "Edit Style Preset"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Professional Blue"
                data-testid="input-style-name"
              />
            </div>

            <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded-md">
              Your business logo is pulled from Business Settings automatically.
            </p>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="primaryColor">Primary Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    id="primaryColor"
                    value={formData.primaryColor}
                    onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                    className="w-10 h-10 rounded-md border cursor-pointer"
                  />
                  <Input
                    value={formData.primaryColor}
                    onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="accentColor">Accent Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    id="accentColor"
                    value={formData.accentColor}
                    onChange={(e) => setFormData({ ...formData, accentColor: e.target.value })}
                    className="w-10 h-10 rounded-md border cursor-pointer"
                  />
                  <Input
                    value={formData.accentColor}
                    onChange={(e) => setFormData({ ...formData, accentColor: e.target.value })}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Font Family</Label>
              <Select
                value={formData.fontFamily}
                onValueChange={(value) => setFormData({ ...formData, fontFamily: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FONT_FAMILIES.map((font) => (
                    <SelectItem key={font.value} value={font.value}>
                      {font.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium">Display Options</Label>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="showLogo" className="font-normal">Show Logo</Label>
                  <Switch
                    id="showLogo"
                    checked={formData.showLogo}
                    onCheckedChange={(checked) => setFormData({ ...formData, showLogo: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="showBusinessDetails" className="font-normal">Show Business Details</Label>
                  <Switch
                    id="showBusinessDetails"
                    checked={formData.showBusinessDetails}
                    onCheckedChange={(checked) => setFormData({ ...formData, showBusinessDetails: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="showBankDetails" className="font-normal">Show Bank Details</Label>
                  <Switch
                    id="showBankDetails"
                    checked={formData.showBankDetails}
                    onCheckedChange={(checked) => setFormData({ ...formData, showBankDetails: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="tableBorders" className="font-normal">Table Borders</Label>
                  <Switch
                    id="tableBorders"
                    checked={formData.tableBorders}
                    onCheckedChange={(checked) => setFormData({ ...formData, tableBorders: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="alternateRowColors" className="font-normal">Alternate Row Colors</Label>
                  <Switch
                    id="alternateRowColors"
                    checked={formData.alternateRowColors}
                    onCheckedChange={(checked) => setFormData({ ...formData, alternateRowColors: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="compactMode" className="font-normal">Compact Mode</Label>
                  <Switch
                    id="compactMode"
                    checked={formData.compactMode}
                    onCheckedChange={(checked) => setFormData({ ...formData, compactMode: checked })}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t pt-4">
              <Label htmlFor="isDefault" className="font-medium">Set as Default</Label>
              <Switch
                id="isDefault"
                checked={formData.isDefault}
                onCheckedChange={(checked) => setFormData({ ...formData, isDefault: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!formData.name || createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-style"
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {isCreating ? "Create Style" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Style Preset</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedPreset?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedPreset && deleteMutation.mutate(selectedPreset.id)}
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
  const { data: business } = useBusinessSettings();
  
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Reusable Components</h2>
          <p className="text-sm text-muted-foreground">
            Create and manage reusable content blocks for your documents
          </p>
        </div>
        
        <Card className="p-6 text-center">
          <Layers className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <h3 className="font-semibold mb-2">Coming Soon</h3>
          <p className="text-sm text-muted-foreground">
            Save reusable paragraphs, terms, and content blocks to quickly add to quotes and invoices.
          </p>
        </Card>
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
              <div className="bg-white rounded-lg shadow-sm overflow-hidden" style={{ maxHeight: '400px', overflow: 'auto' }}>
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
                    <h4 className="font-medium mb-2">Sample Component Block</h4>
                    <p className="text-sm text-muted-foreground">
                      This is where your reusable content blocks will be previewed. Components can include warranty terms, payment conditions, or any frequently used text.
                    </p>
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
  
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Form Templates</h2>
          <p className="text-sm text-muted-foreground">
            Create custom forms for job sites and client interactions
          </p>
        </div>
        
        <Card className="p-6 text-center">
          <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <h3 className="font-semibold mb-2">Coming Soon</h3>
          <p className="text-sm text-muted-foreground">
            Design custom safety checklists, site inspections, and client intake forms with digital signatures.
          </p>
        </Card>
      </div>
      
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Preview</h2>
          <p className="text-sm text-muted-foreground">
            See how forms appear on mobile devices
          </p>
        </div>
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="bg-muted/30 p-4">
              <div className="bg-white rounded-lg shadow-sm overflow-hidden" style={{ maxHeight: '400px', overflow: 'auto' }}>
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    {business?.logoUrl && (
                      <img src={business.logoUrl} alt="Logo" className="h-12 w-auto object-contain" />
                    )}
                    <div>
                      <h3 className="font-bold text-lg" style={{ color: '#1f3a5f' }}>
                        {business?.businessName || 'Your Business'}
                      </h3>
                      <p className="text-sm text-muted-foreground">Safety Checklist</p>
                    </div>
                  </div>
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
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
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
