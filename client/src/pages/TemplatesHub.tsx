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

function RateCardsSection() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
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
      setFormData({
        name: "",
        tradeType: user?.tradeType || "general",
        hourlyRate: "100.00",
        calloutFee: "80.00",
        materialMarkupPct: "20.00",
        afterHoursMultiplier: "1.50",
        gstEnabled: true,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/rate-cards"] });
    },
    onError: () => {
      toast({ title: "Failed to create rate card", variant: "destructive" });
    },
  });

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
                className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
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
                <Badge variant="secondary" className="capitalize ml-2">
                  {card.tradeType}
                </Badge>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Rate Card</DialogTitle>
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
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate(formData)}
              disabled={!formData.name || createMutation.isPending}
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LineItemsCatalogSection() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
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

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("POST", "/api/catalog", data);
    },
    onSuccess: () => {
      toast({ title: "Catalog item created" });
      setDialogOpen(false);
      setFormData({
        name: "",
        description: "",
        unit: "item",
        unitPrice: "0.00",
        tradeType: user?.tradeType || "general",
        defaultQty: "1.00",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/catalog"] });
    },
    onError: () => {
      toast({ title: "Failed to create item", variant: "destructive" });
    },
  });

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
                className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                data-testid={`catalog-item-${item.id}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.name}</p>
                  <p className="text-sm text-muted-foreground truncate">
                    {item.description}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                  <Badge variant="outline">${item.unitPrice}/{item.unit}</Badge>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Catalog Item</DialogTitle>
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
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate(formData)}
              disabled={!formData.name || !formData.description || createMutation.isPending}
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
  const [safetyFormsOpen, setSafetyFormsOpen] = useState(true);
  const [complianceFormsOpen, setComplianceFormsOpen] = useState(true);
  const [inspectionFormsOpen, setInspectionFormsOpen] = useState(true);
  const [selectedForm, setSelectedForm] = useState<CustomForm | null>(null);

  const { data: forms = [], isLoading } = useQuery<CustomForm[]>({
    queryKey: ["/api/custom-forms"],
  });

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
