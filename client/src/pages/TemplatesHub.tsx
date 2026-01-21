import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CustomFormsPage } from "@/components/CustomFormBuilder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  Layers,
  FileText,
  ClipboardList,
  Receipt,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  ChevronRight,
  ChevronDown,
  Star,
  DollarSign,
  Package,
  Eye,
  Check,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { StylePreset, RateCard, LineItemCatalog, DocumentTemplate } from "@shared/schema";

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

function StylePresetsTab() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<StylePreset | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    logoUrl: "",
    primaryColor: "#1e40af",
    accentColor: "#059669",
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

  const { data: presets = [], isLoading } = useQuery<StylePreset[]>({
    queryKey: ["/api/style-presets"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("POST", "/api/style-presets", data);
    },
    onSuccess: () => {
      toast({ title: "Style preset created" });
      setDialogOpen(false);
      resetForm();
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
      queryClient.invalidateQueries({ queryKey: ["/api/style-presets"] });
    },
    onError: () => {
      toast({ title: "Failed to delete preset", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      logoUrl: "",
      primaryColor: "#1e40af",
      accentColor: "#059669",
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
    setIsCreating(false);
  };

  const openCreateDialog = () => {
    setIsCreating(true);
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (preset: StylePreset) => {
    setIsCreating(false);
    setSelectedPreset(preset);
    setFormData({
      name: preset.name,
      logoUrl: preset.logoUrl || "",
      primaryColor: preset.primaryColor || "#1e40af",
      accentColor: preset.accentColor || "#059669",
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold">Document Styles</h2>
          <p className="text-sm text-muted-foreground">
            Create reusable style presets for your quotes, invoices, and documents
          </p>
        </div>
        <Button onClick={openCreateDialog} data-testid="button-create-style">
          <Plus className="h-4 w-4 mr-2" />
          New Style
        </Button>
      </div>

      {presets.length === 0 ? (
        <Card className="p-8 text-center">
          <Palette className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="font-semibold mb-2">No style presets yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create your first style preset to customize how your documents look
          </p>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Create Style Preset
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {presets.map((preset) => (
            <Card key={preset.id} className="hover-elevate" data-testid={`card-style-${preset.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate flex items-center gap-2">
                      {preset.name}
                      {preset.isDefault && (
                        <Badge variant="secondary" className="text-xs">
                          <Star className="h-3 w-3 mr-1" />
                          Default
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="text-xs mt-1">
                      {preset.fontFamily || "Inter"}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
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
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Primary:</span>
                    <ColorSwatch color={preset.primaryColor || "#1e40af"} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Accent:</span>
                    <ColorSwatch color={preset.accentColor || "#059669"} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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

            <div className="space-y-2">
              <Label htmlFor="logoUrl">Logo URL</Label>
              <Input
                id="logoUrl"
                value={formData.logoUrl}
                onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                placeholder="https://example.com/logo.png"
                data-testid="input-style-logo"
              />
            </div>

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
                    data-testid="input-primary-color"
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
                    data-testid="input-accent-color"
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
                <SelectTrigger data-testid="select-font-family">
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

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Header Layout</Label>
                <Select
                  value={formData.headerLayout}
                  onValueChange={(value) => setFormData({ ...formData, headerLayout: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LAYOUT_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Footer Layout</Label>
                <Select
                  value={formData.footerLayout}
                  onValueChange={(value) => setFormData({ ...formData, footerLayout: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LAYOUT_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4">
              <Label className="text-base">Display Options</Label>
              <div className="grid gap-3 md:grid-cols-2">
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
              {isCreating ? "Create" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {rateCards.length} rate card{rateCards.length !== 1 ? "s" : ""}
        </p>
        <Button size="sm" onClick={() => setDialogOpen(true)} data-testid="button-create-rate-card">
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>

      {rateCards.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          No rate cards yet. Create one to set your pricing.
        </p>
      ) : (
        <div className="space-y-2">
          {rateCards.map((card) => (
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {catalogItems.length} item{catalogItems.length !== 1 ? "s" : ""} in catalog
        </p>
        <Button size="sm" onClick={() => setDialogOpen(true)} data-testid="button-create-catalog-item">
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>

      {catalogItems.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          No catalog items yet. Add items you use frequently.
        </p>
      ) : (
        <div className="space-y-2">
          {catalogItems.map((item) => (
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Reusable Components</h2>
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
  );
}

function DocumentPreview({ template, stylePreset }: { template: DocumentTemplate | null; stylePreset: StylePreset | null }) {
  const sampleData = {
    businessName: "Your Business Name",
    businessAddress: "123 Trade Street, Sydney NSW 2000",
    businessPhone: "0400 000 000",
    businessEmail: "hello@yourbusiness.com",
    clientName: "John Smith",
    clientAddress: "456 Customer Ave, Melbourne VIC 3000",
    documentNumber: "Q-00001",
    date: new Date().toLocaleDateString("en-AU"),
    dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString("en-AU"),
    items: [
      { description: "Labour - Standard Rate", qty: 4, unit: "hour", unitPrice: 95, total: 380 },
      { description: "Materials - Electrical Supplies", qty: 1, unit: "item", unitPrice: 245.50, total: 245.50 },
    ],
    subtotal: 625.50,
    gst: 62.55,
    total: 688.05,
  };

  const primaryColor = stylePreset?.primaryColor || "#1e40af";
  const accentColor = stylePreset?.accentColor || "#059669";
  const fontFamily = stylePreset?.fontFamily || "Inter";

  return (
    <div
      className="bg-white rounded-lg shadow-lg p-6 text-black min-h-[400px]"
      style={{ fontFamily }}
    >
      <div
        className="flex items-start justify-between pb-4 mb-4"
        style={{ borderBottom: `2px solid ${primaryColor}` }}
      >
        <div>
          {stylePreset?.showLogo && stylePreset?.logoUrl && (
            <img src={stylePreset.logoUrl} alt="Logo" className="h-12 mb-2 object-contain" />
          )}
          <h2 className="text-lg font-bold" style={{ color: primaryColor }}>
            {sampleData.businessName}
          </h2>
          {stylePreset?.showBusinessDetails !== false && (
            <div className="text-xs text-gray-600 mt-1">
              <p>{sampleData.businessAddress}</p>
              <p>{sampleData.businessPhone} | {sampleData.businessEmail}</p>
            </div>
          )}
        </div>
        <div className="text-right">
          <h1 className="text-2xl font-bold" style={{ color: primaryColor }}>
            {template?.type === "invoice" ? "INVOICE" : template?.type === "job" ? "JOB CARD" : "QUOTE"}
          </h1>
          <p className="text-sm text-gray-600">{sampleData.documentNumber}</p>
          <p className="text-sm text-gray-600">{sampleData.date}</p>
        </div>
      </div>

      <div className="mb-4">
        <p className="text-xs font-semibold text-gray-500 uppercase">Bill To</p>
        <p className="font-medium">{sampleData.clientName}</p>
        <p className="text-sm text-gray-600">{sampleData.clientAddress}</p>
      </div>

      <table className="w-full text-sm mb-4" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ backgroundColor: primaryColor, color: "white" }}>
            <th className="text-left p-2">Description</th>
            <th className="text-right p-2">Qty</th>
            <th className="text-right p-2">Unit</th>
            <th className="text-right p-2">Price</th>
            <th className="text-right p-2">Total</th>
          </tr>
        </thead>
        <tbody>
          {sampleData.items.map((item, idx) => (
            <tr
              key={idx}
              style={{
                backgroundColor: stylePreset?.alternateRowColors && idx % 2 === 1 ? "#f9fafb" : "white",
                borderBottom: stylePreset?.tableBorders ? "1px solid #e5e7eb" : "none",
              }}
            >
              <td className="p-2">{item.description}</td>
              <td className="text-right p-2">{item.qty}</td>
              <td className="text-right p-2">{item.unit}</td>
              <td className="text-right p-2">${item.unitPrice.toFixed(2)}</td>
              <td className="text-right p-2">${item.total.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-end">
        <div className="w-48">
          <div className="flex justify-between py-1 text-sm">
            <span>Subtotal:</span>
            <span>${sampleData.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between py-1 text-sm">
            <span>GST (10%):</span>
            <span>${sampleData.gst.toFixed(2)}</span>
          </div>
          <div
            className="flex justify-between py-2 font-bold text-base mt-1"
            style={{ borderTop: `2px solid ${primaryColor}`, color: primaryColor }}
          >
            <span>Total:</span>
            <span>${sampleData.total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {stylePreset?.showBankDetails !== false && (
        <div className="mt-6 pt-4 border-t text-xs text-gray-500">
          <p className="font-semibold">Payment Details</p>
          <p>BSB: 123-456 | Account: 12345678</p>
        </div>
      )}
    </div>
  );
}

function DocumentsTab() {
  const [expandedType, setExpandedType] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);

  const { data: user } = useQuery<{ tradeType?: string }>({
    queryKey: ["/api/auth/me"],
  });

  const { data: templates = [], isLoading: templatesLoading } = useQuery<DocumentTemplate[]>({
    queryKey: ["/api/templates", user?.tradeType],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (user?.tradeType) params.append("tradeType", user.tradeType);
      const url = `/api/templates${params.toString() ? `?${params.toString()}` : ""}`;
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch templates");
      return response.json();
    },
    enabled: true,
  });

  const { data: stylePresets = [] } = useQuery<StylePreset[]>({
    queryKey: ["/api/style-presets"],
  });

  const defaultPreset = stylePresets.find((p) => p.isDefault) || stylePresets[0] || null;

  const TEMPLATE_TYPES = [
    { type: "quote", name: "Quote Templates", description: "Pre-configured quote formats", icon: FileText },
    { type: "invoice", name: "Invoice Templates", description: "Standard invoice layouts", icon: Receipt },
    { type: "job", name: "Job Templates", description: "Default settings for new jobs", icon: ClipboardList },
  ];

  const getTemplatesByType = (type: string) => templates.filter((t) => t.type === type);

  if (templatesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Document Templates</h2>
        <p className="text-sm text-muted-foreground">
          Manage templates for quotes, invoices, and jobs
          {user?.tradeType && <span className="ml-1">(filtered for {user.tradeType})</span>}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          {TEMPLATE_TYPES.map(({ type, name, description, icon: Icon }) => {
            const typeTemplates = getTemplatesByType(type);
            const isExpanded = expandedType === type;

            return (
              <Collapsible
                key={type}
                open={isExpanded}
                onOpenChange={(open) => setExpandedType(open ? type : null)}
              >
                <Card data-testid={`card-document-${type}`}>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover-elevate rounded-t-xl">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: "hsl(var(--trade) / 0.1)" }}
                          >
                            <Icon className="h-5 w-5" style={{ color: "hsl(var(--trade))" }} />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{name}</CardTitle>
                            <CardDescription>{description}</CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary">
                            {typeTemplates.length} template{typeTemplates.length !== 1 ? "s" : ""}
                          </Badge>
                          {isExpanded ? (
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
                      <div className="border-t pt-4 space-y-2">
                        {typeTemplates.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            No {type} templates available
                          </p>
                        ) : (
                          typeTemplates.map((template) => (
                            <div
                              key={template.id}
                              className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer ${
                                selectedTemplate?.id === template.id
                                  ? "border-primary bg-primary/5"
                                  : "bg-muted/30 hover-elevate"
                              }`}
                              onClick={() => setSelectedTemplate(template)}
                              data-testid={`template-item-${template.id}`}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-medium truncate">{template.name}</p>
                                  {template.tradeType && (
                                    <Badge variant="secondary" className="text-xs capitalize">
                                      {template.tradeType}
                                    </Badge>
                                  )}
                                  {template.isDefault && (
                                    <Badge variant="outline" className="text-xs">
                                      <Check className="h-3 w-3 mr-1" />
                                      Default
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedTemplate(template);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </div>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>

        <div className="lg:sticky lg:top-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Live Preview</CardTitle>
              </div>
              <CardDescription>
                {selectedTemplate
                  ? `Previewing: ${selectedTemplate.name}`
                  : "Select a template to preview"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                {selectedTemplate ? (
                  <DocumentPreview template={selectedTemplate} stylePreset={defaultPreset} />
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                    <FileText className="h-12 w-12 mb-4 opacity-50" />
                    <p className="text-sm">Click a template to see preview</p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function TemplatesHub() {
  const getInitialTab = () => {
    const searchParams = new URLSearchParams(window.location.search);
    const tabParam = searchParams.get("tab");
    if (tabParam && ["styles", "components", "documents", "forms"].includes(tabParam)) {
      return tabParam;
    }
    return "styles";
  };

  const [activeTab, setActiveTab] = useState<string>(getInitialTab);

  return (
    <PageShell>
      <PageHeader
        title="Templates Hub"
        subtitle="Manage styles, components, and document templates"
        leading={<Layers className="h-5 w-5" style={{ color: "hsl(var(--trade))" }} />}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid" data-testid="tabs-list">
          <TabsTrigger value="styles" className="gap-2" data-testid="tab-styles">
            <Palette className="h-4 w-4 hidden sm:block" />
            Styles
          </TabsTrigger>
          <TabsTrigger value="components" className="gap-2" data-testid="tab-components">
            <Layers className="h-4 w-4 hidden sm:block" />
            Components
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-2" data-testid="tab-documents">
            <FileText className="h-4 w-4 hidden sm:block" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="forms" className="gap-2" data-testid="tab-forms">
            <ClipboardList className="h-4 w-4 hidden sm:block" />
            Forms
          </TabsTrigger>
        </TabsList>

        <TabsContent value="styles" className="mt-6">
          <StylePresetsTab />
        </TabsContent>

        <TabsContent value="components" className="mt-6">
          <ComponentsTab />
        </TabsContent>

        <TabsContent value="documents" className="mt-6">
          <DocumentsTab />
        </TabsContent>

        <TabsContent value="forms" className="mt-6">
          <CustomFormsPage />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
