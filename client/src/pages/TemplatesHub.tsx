import { useState, useRef, useEffect } from "react";
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
  DialogDescription,
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
  Upload,
  Sparkles,
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

function StylePresetsTab({ onNavigateToDocuments }: { onNavigateToDocuments?: () => void }) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<StylePreset | null>(null);
  const navigateAfterSaveRef = useRef(false);
  const [savingWithPreview, setSavingWithPreview] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
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
      setIsCreating(false);
      setSavingWithPreview(false);
      queryClient.invalidateQueries({ queryKey: ["/api/style-presets"] });
      if (navigateAfterSaveRef.current && onNavigateToDocuments) {
        navigateAfterSaveRef.current = false;
        onNavigateToDocuments();
      }
    },
    onError: () => {
      toast({ title: "Failed to create preset", variant: "destructive" });
      setSavingWithPreview(false);
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
      setSavingWithPreview(false);
      queryClient.invalidateQueries({ queryKey: ["/api/style-presets"] });
      if (navigateAfterSaveRef.current && onNavigateToDocuments) {
        navigateAfterSaveRef.current = false;
        onNavigateToDocuments();
      }
    },
    onError: () => {
      toast({ title: "Failed to update preset", variant: "destructive" });
      setSavingWithPreview(false);
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
    // Note: isCreating is NOT reset here - callers control it separately
  };

  const openCreateDialog = () => {
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
    setIsCreating(true);
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

  const handleSave = (andNavigate = false) => {
    navigateAfterSaveRef.current = andNavigate;
    setSavingWithPreview(andNavigate);
    if (isCreating) {
      createMutation.mutate(formData);
    } else if (selectedPreset) {
      updateMutation.mutate({ id: selectedPreset.id, data: formData });
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: "Please select an image file", variant: "destructive" });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Image must be smaller than 5MB", variant: "destructive" });
      return;
    }

    setIsUploadingLogo(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);
      formDataUpload.append('type', 'logo');

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formDataUpload,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      setFormData(prev => ({ ...prev, logoUrl: data.url }));
      toast({ title: "Logo uploaded successfully" });
    } catch (error) {
      toast({ title: "Failed to upload logo", variant: "destructive" });
    } finally {
      setIsUploadingLogo(false);
      if (logoInputRef.current) {
        logoInputRef.current.value = '';
      }
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
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <Button onClick={() => createDefaultPresetMutation.mutate()} variant="default">
              {createDefaultPresetMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Use Default Navy Style
            </Button>
            <Button onClick={openCreateDialog} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Create Custom
            </Button>
          </div>
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
              <CardContent className="pt-0 space-y-3">
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
                {!preset.isDefault && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setDefaultMutation.mutate(preset.id)}
                    disabled={setDefaultMutation.isPending}
                  >
                    {setDefaultMutation.isPending && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}
                    <Star className="h-3 w-3 mr-1" />
                    Set as Default
                  </Button>
                )}
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
              <Label>{formData.logoUrl ? "Current Logo" : "Upload Logo"}</Label>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoUpload}
                data-testid="input-logo-file"
              />
              {formData.logoUrl ? (
                <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
                  <img 
                    src={formData.logoUrl} 
                    alt="Logo" 
                    className="h-12 w-12 object-contain rounded border bg-white"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">Logo uploaded</p>
                    <p className="text-xs text-muted-foreground">Click to change</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={isUploadingLogo}
                      data-testid="button-change-logo"
                    >
                      {isUploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : "Change"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setFormData(prev => ({ ...prev, logoUrl: "" }))}
                      data-testid="button-remove-logo"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-20 border-dashed"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={isUploadingLogo}
                  data-testid="button-upload-logo"
                >
                  {isUploadingLogo ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-5 w-5 mr-2" />
                      Click to upload your logo
                    </>
                  )}
                </Button>
              )}
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

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => handleSave(false)}
              disabled={!formData.name || createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-style"
            >
              {(createMutation.isPending || updateMutation.isPending) && !savingWithPreview && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {isCreating ? "Create" : "Save"}
            </Button>
            <Button
              onClick={() => handleSave(true)}
              disabled={!formData.name || createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-preview-style"
            >
              {(createMutation.isPending || updateMutation.isPending) && savingWithPreview && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              <Eye className="h-4 w-4 mr-2" />
              {isCreating ? "Create & Preview" : "Save & Preview"}
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
  // Extract template-specific data
  const defaults = (template?.defaults as Record<string, unknown>) || {};
  const styling = (template?.styling as Record<string, unknown>) || {};
  const templateLineItems = (template?.defaultLineItems as Array<{ description: string; qty: number; unitPrice: number; unit?: string }>) || [];
  
  // Calculate totals from template line items or use defaults
  const items = templateLineItems.length > 0 
    ? templateLineItems.map(item => ({
        description: item.description,
        qty: item.qty || 1,
        unit: item.unit || "each",
        unitPrice: item.unitPrice || 0,
        total: (item.qty || 1) * (item.unitPrice || 0)
      }))
    : template?.type === "invoice" 
      ? [
          { description: "Labour - Completed Work", qty: 6, unit: "hour", unitPrice: 95, total: 570 },
          { description: "Parts & Materials", qty: 1, unit: "lot", unitPrice: 255, total: 255 },
        ]
      : template?.type === "job"
      ? [
          { description: "Site Work - As quoted", qty: 1, unit: "job", unitPrice: 450, total: 450 },
        ]
      : [
          { description: "Labour - Standard Rate", qty: 4, unit: "hour", unitPrice: 95, total: 380 },
          { description: "Materials", qty: 1, unit: "lot", unitPrice: 245.50, total: 245.50 },
        ];

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const gst = subtotal * 0.1;
  const total = subtotal + gst;

  // Get document title from template or use default based on type
  const documentTitle = (defaults.title as string) || 
    (template?.type === "invoice" ? "TAX INVOICE" : template?.type === "job" ? "JOB CARD" : "QUOTE");
  
  // Get description/terms from template
  const description = (defaults.description as string) || "";
  const terms = (defaults.terms as string) || "";
  const depositPct = (defaults.depositPct as number) || 0;
  const dueDays = (defaults.dueTermDays as number) || 14;

  // Use template brand color or style preset colors
  const templateBrandColor = styling.brandColor as string;
  const primaryColor = templateBrandColor || stylePreset?.primaryColor || "#1e40af";
  const accentColor = stylePreset?.accentColor || "#059669";
  const fontFamily = stylePreset?.fontFamily || "Inter";
  
  // Document number based on type
  const docNumber = template?.type === "invoice" ? "INV-00042" : template?.type === "job" ? "JOB-00127" : "Q-00089";

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
            Your Business Name
          </h2>
          {stylePreset?.showBusinessDetails !== false && (
            <div className="text-xs text-gray-600 mt-1">
              <p>123 Trade Street, Sydney NSW 2000</p>
              <p>0400 000 000 | hello@yourbusiness.com</p>
            </div>
          )}
        </div>
        <div className="text-right">
          <h1 className="text-2xl font-bold" style={{ color: primaryColor }}>
            {documentTitle}
          </h1>
          <p className="text-sm text-gray-600">{docNumber}</p>
          <p className="text-sm text-gray-600">{new Date().toLocaleDateString("en-AU")}</p>
          {template && (
            <p className="text-xs mt-1 px-2 py-0.5 rounded inline-block" style={{ backgroundColor: accentColor, color: "white" }}>
              {template.name}
            </p>
          )}
        </div>
      </div>

      {/* Description from template */}
      {description && (
        <div className="mb-4 p-3 rounded text-sm" style={{ backgroundColor: `${primaryColor}10` }}>
          <p className="text-gray-700 italic">{description}</p>
        </div>
      )}

      <div className="mb-4">
        <p className="text-xs font-semibold text-gray-500 uppercase">Bill To</p>
        <p className="font-medium">John Smith</p>
        <p className="text-sm text-gray-600">456 Customer Ave, Melbourne VIC 3000</p>
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
          {items.map((item, idx) => (
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
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between py-1 text-sm">
            <span>GST (10%):</span>
            <span>${gst.toFixed(2)}</span>
          </div>
          {depositPct > 0 && (
            <div className="flex justify-between py-1 text-sm text-gray-600">
              <span>Deposit ({depositPct}%):</span>
              <span>${(total * depositPct / 100).toFixed(2)}</span>
            </div>
          )}
          <div
            className="flex justify-between py-2 font-bold text-base mt-1"
            style={{ borderTop: `2px solid ${primaryColor}`, color: primaryColor }}
          >
            <span>Total:</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Terms & Conditions */}
      {terms && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Terms & Conditions</p>
          <p className="text-xs text-gray-600">{terms}</p>
        </div>
      )}

      {/* Payment due */}
      {dueDays > 0 && template?.type !== "job" && (
        <div className="mt-3 text-xs text-gray-500">
          Payment due within {dueDays} days
        </div>
      )}
    </div>
  );
}

function DocumentsTab({ autoSelectFirst, onAutoSelectComplete }: { autoSelectFirst?: boolean; onAutoSelectComplete?: () => void }) {
  const { toast } = useToast();
  const [expandedType, setExpandedType] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadType, setUploadType] = useState<"quote" | "invoice">("quote");
  const [analysisJobId, setAnalysisJobId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Auto-select first quote template when requested (after Save & Preview from Styles tab)
  useEffect(() => {
    // Only proceed if autoSelectFirst is true and templates have loaded
    if (autoSelectFirst && !templatesLoading && templates.length > 0 && !selectedTemplate) {
      // Find first quote template, or fall back to first template
      const quoteTemplate = templates.find((t) => t.type === "quote") || templates[0];
      if (quoteTemplate) {
        setSelectedTemplate(quoteTemplate);
        // Expand the quote section if the template is a quote
        if (quoteTemplate.type === "quote") {
          setExpandedType("quote");
        }
      }
      onAutoSelectComplete?.();
    }
  }, [autoSelectFirst, templates, templatesLoading, selectedTemplate, onAutoSelectComplete]);

  // Poll for analysis job completion
  const { data: analysisJob } = useQuery({
    queryKey: ["/api/templates/analyze", analysisJobId],
    queryFn: async () => {
      if (!analysisJobId) return null;
      const res = await fetch(`/api/templates/analyze/${analysisJobId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to check job status");
      return res.json();
    },
    enabled: !!analysisJobId,
    refetchInterval: analysisJobId ? 2000 : false,
  });

  // Handle analysis completion
  useEffect(() => {
    if (analysisJob?.status === "completed") {
      toast({
        title: "Template created!",
        description: "Your document has been analyzed and a new template was created.",
      });
      setAnalysisJobId(null);
      setUploadDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
    } else if (analysisJob?.status === "failed") {
      toast({
        title: "Analysis failed",
        description: analysisJob.error || "Could not analyze the document. Please try again.",
        variant: "destructive",
      });
      setAnalysisJobId(null);
    }
  }, [analysisJob?.status]);

  // Mutation for setting template as default
  const setDefaultMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const res = await fetch(`/api/templates/${templateId}/set-default`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to set default template");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Default template updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
    },
    onError: () => {
      toast({ title: "Failed to update default", variant: "destructive" });
    },
  });

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("templateType", uploadType);
      formData.append("tradeType", user?.tradeType || "general");

      const res = await fetch("/api/templates/analyze", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Upload failed");
      }

      const data = await res.json();
      setAnalysisJobId(data.jobId);
      toast({
        title: "Analyzing document...",
        description: "AI is analyzing your document to create a template. This may take a moment.",
      });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Could not upload the file",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

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
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold">Document Templates</h2>
          <p className="text-sm text-muted-foreground">
            Manage templates for quotes, invoices, and jobs
            {user?.tradeType && <span className="ml-1">(filtered for {user.tradeType})</span>}
          </p>
        </div>
        <Button onClick={() => setUploadDialogOpen(true)} variant="default">
          <Upload className="h-4 w-4 mr-2" />
          Upload Document
        </Button>
      </div>

      {/* AI Document Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Template Creator
            </DialogTitle>
            <DialogDescription>
              Upload an existing quote or invoice (PDF or image) and AI will analyze it to create a matching template.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Document Type</Label>
              <Select value={uploadType} onValueChange={(v) => setUploadType(v as "quote" | "invoice")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="quote">Quote</SelectItem>
                  <SelectItem value="invoice">Invoice</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div 
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover-elevate transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUpload(file);
                }}
              />
              {uploading || analysisJobId ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <p className="font-medium">
                    {uploading ? "Uploading..." : "AI is analyzing your document..."}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    This may take up to 30 seconds
                  </p>
                </div>
              ) : (
                <>
                  <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                  <p className="font-medium">Drop your document here</p>
                  <p className="text-sm text-muted-foreground">or click to browse</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Supports PDF, PNG, JPG (max 10MB)
                  </p>
                </>
              )}
            </div>

            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <p className="font-medium mb-1 flex items-center gap-1">
                <Sparkles className="h-4 w-4" />
                What AI extracts:
              </p>
              <ul className="text-muted-foreground space-y-1 text-xs">
                <li>• Brand colors and styling</li>
                <li>• Logo placement and layout</li>
                <li>• Line item columns and structure</li>
                <li>• Terms, payment details, signatures</li>
              </ul>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                {template.isDefault ? (
                                  <Badge variant="default" className="text-xs">
                                    <Check className="h-3 w-3 mr-1" />
                                    Default
                                  </Badge>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs h-7"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDefaultMutation.mutate(template.id);
                                    }}
                                    disabled={setDefaultMutation.isPending}
                                  >
                                    {setDefaultMutation.isPending ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <Star className="h-3 w-3 mr-1" />
                                    )}
                                    Set Default
                                  </Button>
                                )}
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
                  selectedTemplate.type === "job" ? (
                    // Job templates show settings preview, not a document
                    <div className="space-y-4">
                      <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <ClipboardList className="h-5 w-5 text-primary" />
                          <h3 className="font-semibold">{selectedTemplate.name}</h3>
                        </div>
                        {(() => {
                          const defaults = selectedTemplate.defaults as Record<string, unknown> || {};
                          return (
                            <>
                              {defaults.description && (
                                <p className="text-sm text-muted-foreground">{String(defaults.description)}</p>
                              )}
                              <div className="grid grid-cols-2 gap-3 pt-2">
                                {defaults.estimatedHours && (
                                  <div className="bg-background rounded p-2">
                                    <p className="text-xs text-muted-foreground">Estimated Hours</p>
                                    <p className="font-medium">{String(defaults.estimatedHours)}h</p>
                                  </div>
                                )}
                                {defaults.priority && (
                                  <div className="bg-background rounded p-2">
                                    <p className="text-xs text-muted-foreground">Priority</p>
                                    <p className="font-medium capitalize">{String(defaults.priority)}</p>
                                  </div>
                                )}
                              </div>
                              {defaults.notes && (
                                <div className="bg-background rounded p-2 mt-2">
                                  <p className="text-xs text-muted-foreground mb-1">Default Notes</p>
                                  <p className="text-sm">{String(defaults.notes)}</p>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                      <p className="text-xs text-muted-foreground text-center">
                        Job templates define default settings when creating new jobs
                      </p>
                    </div>
                  ) : (
                    <DocumentPreview template={selectedTemplate} stylePreset={defaultPreset} />
                  )
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
  const [autoSelectFirstTemplate, setAutoSelectFirstTemplate] = useState(() => {
    // Check URL for auto-select flag on initial render
    const params = new URLSearchParams(window.location.search);
    return params.get("autoSelect") === "true";
  });

  const handleNavigateToDocumentsWithPreview = () => {
    // Use URL params to persist the auto-select flag across potential re-mounts
    const url = new URL(window.location.href);
    url.searchParams.set("tab", "documents");
    url.searchParams.set("autoSelect", "true");
    window.history.replaceState({}, "", url.toString());
    
    setActiveTab("documents");
    setAutoSelectFirstTemplate(true);
  };
  
  // Clear URL param after auto-select completes
  const handleAutoSelectComplete = () => {
    setAutoSelectFirstTemplate(false);
    const url = new URL(window.location.href);
    url.searchParams.delete("autoSelect");
    window.history.replaceState({}, "", url.toString());
  };

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
          <StylePresetsTab onNavigateToDocuments={handleNavigateToDocumentsWithPreview} />
        </TabsContent>

        <TabsContent value="components" className="mt-6">
          <ComponentsTab />
        </TabsContent>

        <TabsContent value="documents" className="mt-6">
          <DocumentsTab 
            autoSelectFirst={autoSelectFirstTemplate} 
            onAutoSelectComplete={handleAutoSelectComplete} 
          />
        </TabsContent>

        <TabsContent value="forms" className="mt-6">
          <CustomFormsPage />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
