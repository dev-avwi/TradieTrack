import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  Wrench,
  Search,
  Calendar as CalendarIcon,
  Trash2,
  Edit,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  Briefcase,
  BarChart3,
  Gauge,
  Route,
  TrendingUp,
  ChevronDown,
} from "lucide-react";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { EmptyState } from "@/components/ui/compact-card";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { Equipment, EquipmentCategory, EquipmentMaintenance } from "@shared/schema";

const statusConfig: Record<string, { label: string; className: string }> = {
  active: { label: "Available", className: "bg-success/10 text-success" },
  available: { label: "Available", className: "bg-success/10 text-success" },
  in_use: { label: "In Use", className: "bg-primary/10 text-primary" },
  maintenance: { label: "Maintenance", className: "bg-warning/10 text-warning" },
  retired: { label: "Retired", className: "bg-muted text-muted-foreground" },
  sold: { label: "Sold", className: "bg-muted text-muted-foreground" },
};

function formatAUD(value: string | number | null | undefined): string {
  if (!value) return "-";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "-";
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(num);
}

function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || statusConfig.active;
  return <Badge variant="secondary" className={config.className}>{config.label}</Badge>;
}

const defaultFormData = {
  name: "",
  categoryId: "",
  serialNumber: "",
  manufacturer: "",
  model: "",
  purchaseDate: "",
  purchasePrice: "",
  status: "active",
  location: "",
  description: "",
};

const defaultMaintenanceForm = {
  title: "",
  type: "scheduled",
  description: "",
  cost: "",
  scheduledDate: "",
  nextDueDate: "",
};

function JobAssignmentsSection({ assignments, equipmentId }: { assignments: any[]; equipmentId: string }) {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [usageForm, setUsageForm] = useState({
    hoursUsed: "",
    kmTravelled: "",
    capacityUsed: "",
    capacityAvailable: "",
    postJobNotes: "",
    wasOversized: false,
  });

  const updateUsageMutation = useMutation({
    mutationFn: async ({ jobId, assignmentId, data }: { jobId: string; assignmentId: string; data: Record<string, unknown> }) => {
      await apiRequest("PATCH", `/api/jobs/${jobId}/equipment/${assignmentId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment", equipmentId, "assignments"] });
      setEditingId(null);
      toast({ title: "Usage data saved" });
    },
    onError: () => {
      toast({ title: "Failed to save usage data", variant: "destructive" });
    },
  });

  function openUsageForm(assignment: any) {
    setUsageForm({
      hoursUsed: assignment.hoursUsed || "",
      kmTravelled: assignment.kmTravelled || "",
      capacityUsed: assignment.capacityUsed || "",
      capacityAvailable: assignment.capacityAvailable || "",
      postJobNotes: assignment.postJobNotes || "",
      wasOversized: assignment.wasOversized || false,
    });
    setEditingId(assignment.id);
  }

  function handleSaveUsage(assignment: any) {
    const payload: Record<string, unknown> = {};
    if (usageForm.hoursUsed) payload.hoursUsed = usageForm.hoursUsed;
    if (usageForm.kmTravelled) payload.kmTravelled = usageForm.kmTravelled;
    if (usageForm.capacityUsed) payload.capacityUsed = usageForm.capacityUsed;
    if (usageForm.capacityAvailable) payload.capacityAvailable = usageForm.capacityAvailable;
    if (usageForm.postJobNotes) payload.postJobNotes = usageForm.postJobNotes;
    payload.wasOversized = usageForm.wasOversized;

    updateUsageMutation.mutate({
      jobId: assignment.jobId,
      assignmentId: assignment.id,
      data: payload,
    });
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Assigned to Jobs</h3>
      {assignments.length > 0 ? (
        <div className="space-y-2">
          {assignments.map((assignment: any) => (
            <div key={assignment.id} className="rounded-lg bg-muted/50 overflow-hidden">
              <div className="flex items-start gap-3 p-3">
                <Briefcase className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium truncate">{assignment.jobTitle || 'Job'}</p>
                    <Badge variant="secondary" className="text-xs flex-shrink-0">
                      {assignment.jobStatus || 'Active'}
                    </Badge>
                    {assignment.wasOversized && (
                      <Badge variant="secondary" className="bg-destructive/10 text-destructive text-xs">Oversized</Badge>
                    )}
                  </div>
                  {(assignment.hoursUsed || assignment.kmTravelled || assignment.capacityUsed) && (
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                      {assignment.hoursUsed && <span>{assignment.hoursUsed}h used</span>}
                      {assignment.kmTravelled && <span>{assignment.kmTravelled}km</span>}
                      {assignment.capacityUsed && (
                        <span>Cap: {assignment.capacityUsed}{assignment.capacityAvailable ? ` / ${assignment.capacityAvailable}` : ''}</span>
                      )}
                    </div>
                  )}
                  {assignment.postJobNotes && (
                    <p className="text-xs text-muted-foreground mt-1 italic">{assignment.postJobNotes}</p>
                  )}
                  {assignment.notes && !assignment.postJobNotes && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{assignment.notes}</p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => editingId === assignment.id ? setEditingId(null) : openUsageForm(assignment)}
                >
                  {editingId === assignment.id ? "Cancel" : "Add Usage"}
                </Button>
              </div>
              {editingId === assignment.id && (
                <div className="px-3 pb-3 space-y-3 border-t pt-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Hours Used</Label>
                      <Input
                        type="number"
                        step="0.5"
                        value={usageForm.hoursUsed}
                        onChange={(e) => setUsageForm({ ...usageForm, hoursUsed: e.target.value })}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">KM Travelled</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={usageForm.kmTravelled}
                        onChange={(e) => setUsageForm({ ...usageForm, kmTravelled: e.target.value })}
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Capacity Used</Label>
                      <Input
                        value={usageForm.capacityUsed}
                        onChange={(e) => setUsageForm({ ...usageForm, capacityUsed: e.target.value })}
                        placeholder="e.g. 80t"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Capacity Available</Label>
                      <Input
                        value={usageForm.capacityAvailable}
                        onChange={(e) => setUsageForm({ ...usageForm, capacityAvailable: e.target.value })}
                        placeholder="e.g. 120t"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Post-Job Notes</Label>
                    <Textarea
                      value={usageForm.postJobNotes}
                      onChange={(e) => setUsageForm({ ...usageForm, postJobNotes: e.target.value })}
                      rows={2}
                      placeholder="Notes about usage..."
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`oversized-${assignment.id}`}
                      checked={usageForm.wasOversized}
                      onCheckedChange={(checked) => setUsageForm({ ...usageForm, wasOversized: !!checked })}
                    />
                    <Label htmlFor={`oversized-${assignment.id}`} className="text-xs cursor-pointer">
                      Was oversized for this job
                    </Label>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleSaveUsage(assignment)}
                    disabled={updateUsageMutation.isPending}
                  >
                    {updateUsageMutation.isPending ? "Saving..." : "Save Usage"}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Not assigned to any jobs</p>
      )}
    </div>
  );
}

function EquipmentUtilisation() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/reports/equipment-utilisation"],
    queryFn: async () => {
      const res = await fetch("/api/reports/equipment-utilisation", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-10 w-full" /></CardContent></Card>
          ))}
        </div>
        {[1, 2, 3].map((i) => (
          <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>
        ))}
      </div>
    );
  }

  const summary = data?.summary || {};
  const equipmentItems = data?.equipment || [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Wrench className="h-3.5 w-3.5" />
              <span>Equipment Used</span>
            </div>
            <p className="text-xl font-semibold">{summary.totalEquipmentUsed || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Briefcase className="h-3.5 w-3.5" />
              <span>Total Jobs</span>
            </div>
            <p className="text-xl font-semibold">{summary.totalJobAssignments || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Clock className="h-3.5 w-3.5" />
              <span>Hours Logged</span>
            </div>
            <p className="text-xl font-semibold">{summary.totalHoursLogged || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Route className="h-3.5 w-3.5" />
              <span>Total KM</span>
            </div>
            <p className="text-xl font-semibold">{summary.totalKmLogged || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Oversized</span>
            </div>
            <p className="text-xl font-semibold">{summary.oversizedInstances || 0}</p>
          </CardContent>
        </Card>
      </div>

      {equipmentItems.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No utilisation data"
          description="Equipment usage data will appear here once equipment is assigned to jobs."
        />
      ) : (
        <div className="space-y-2">
          {equipmentItems.map((item: any) => {
            const isExpanded = expandedId === item.equipmentId;
            return (
              <Card key={item.equipmentId}>
                <CardContent className="p-0">
                  <div
                    className="p-4 cursor-pointer hover-elevate"
                    onClick={() => setExpandedId(isExpanded ? null : item.equipmentId)}
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-muted/50">
                          <Wrench className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium truncate">{item.name}</p>
                            {item.utilizationRate > 80 && (
                              <Badge variant="secondary" className="bg-warning/10 text-warning text-xs">
                                <Gauge className="h-3 w-3 mr-0.5" />
                                High Use
                              </Badge>
                            )}
                            {item.oversizedCount > 0 && (
                              <Badge variant="secondary" className="bg-destructive/10 text-destructive text-xs">
                                Oversized
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                            {item.category && <span>{item.category}</span>}
                            <span>{item.totalJobs} job{item.totalJobs !== 1 ? 's' : ''}</span>
                            {item.totalHoursUsed > 0 && <span>{item.totalHoursUsed}h</span>}
                            {item.totalKmTravelled > 0 && <span>{item.totalKmTravelled}km</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="text-right text-sm">
                          <p className="font-medium">{item.utilizationRate}%</p>
                          <p className="text-xs text-muted-foreground">utilisation</p>
                        </div>
                        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>
                    </div>
                  </div>
                  {isExpanded && item.assignments && item.assignments.length > 0 && (
                    <div className="px-4 pb-4 space-y-2 border-t pt-3">
                      {item.assignments.map((a: any, idx: number) => (
                        <div key={idx} className="flex items-start gap-3 p-2 rounded-lg bg-muted/50">
                          <Briefcase className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium truncate">{a.jobTitle || 'Job'}</p>
                              <Badge variant="secondary" className="text-xs">{a.jobStatus || 'Active'}</Badge>
                              {a.wasOversized && (
                                <Badge variant="secondary" className="bg-destructive/10 text-destructive text-xs">Oversized</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                              {a.hoursUsed && <span>{a.hoursUsed}h used</span>}
                              {a.kmTravelled && <span>{a.kmTravelled}km</span>}
                              {a.capacityUsed && <span>Cap: {a.capacityUsed}{a.capacityAvailable ? ` / ${a.capacityAvailable}` : ''}</span>}
                              {a.assignedAt && <span>{format(new Date(a.assignedAt), "dd MMM yyyy")}</span>}
                            </div>
                            {a.postJobNotes && (
                              <p className="text-xs text-muted-foreground mt-1 italic">{a.postJobNotes}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function EquipmentPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Equipment | null>(null);
  const [selectedItem, setSelectedItem] = useState<Equipment | null>(null);
  const [maintenanceDialogOpen, setMaintenanceDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [formData, setFormData] = useState(defaultFormData);
  const [maintenanceForm, setMaintenanceForm] = useState(defaultMaintenanceForm);

  const { data: equipmentList = [], isLoading } = useQuery<Equipment[]>({
    queryKey: ["/api/equipment"],
  });

  const { data: categories = [] } = useQuery<EquipmentCategory[]>({
    queryKey: ["/api/equipment/categories"],
  });

  const { data: maintenanceRecords = [], isLoading: maintenanceLoading } = useQuery<EquipmentMaintenance[]>({
    queryKey: ["/api/equipment", selectedItem?.id, "maintenance"],
    enabled: !!selectedItem,
    queryFn: async () => {
      const res = await fetch(`/api/equipment/${selectedItem!.id}/maintenance`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: allJobEquipment = [] } = useQuery<any[]>({
    queryKey: ["/api/equipment", selectedItem?.id, "assignments"],
    enabled: !!selectedItem,
    queryFn: async () => {
      const res = await fetch(`/api/equipment/${selectedItem!.id}/assignments`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      await apiRequest("POST", "/api/equipment", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      setCreateDialogOpen(false);
      setFormData(defaultFormData);
      toast({ title: "Equipment added" });
    },
    onError: () => {
      toast({ title: "Failed to add equipment", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      await apiRequest("PATCH", `/api/equipment/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      setEditingItem(null);
      setFormData(defaultFormData);
      toast({ title: "Equipment updated" });
    },
    onError: () => {
      toast({ title: "Failed to update equipment", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/equipment/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      setSelectedItem(null);
      toast({ title: "Equipment deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete equipment", variant: "destructive" });
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (data: { name: string }) => {
      await apiRequest("POST", "/api/equipment/categories", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment/categories"] });
      setCategoryDialogOpen(false);
      setNewCategoryName("");
      toast({ title: "Category created" });
    },
    onError: () => {
      toast({ title: "Failed to create category", variant: "destructive" });
    },
  });

  const createMaintenanceMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      await apiRequest("POST", `/api/equipment/${selectedItem!.id}/maintenance`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment", selectedItem?.id, "maintenance"] });
      setMaintenanceDialogOpen(false);
      setMaintenanceForm(defaultMaintenanceForm);
      toast({ title: "Maintenance record added" });
    },
    onError: () => {
      toast({ title: "Failed to add maintenance record", variant: "destructive" });
    },
  });

  const filtered = equipmentList.filter((item) => {
    const matchesSearch =
      !searchQuery ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.serialNumber && item.serialNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.manufacturer && item.manufacturer.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.model && item.model.toLowerCase().includes(searchQuery.toLowerCase()));

    if (activeTab === "all") return matchesSearch;
    if (activeTab === "available") return matchesSearch && (item.status === "active" || item.status === "available");
    if (activeTab === "in_use") return matchesSearch && item.status === "in_use";
    if (activeTab === "maintenance") return matchesSearch && item.status === "maintenance";
    return matchesSearch;
  });

  function getCategoryName(categoryId: string | null) {
    if (!categoryId) return null;
    const cat = categories.find((c) => c.id === categoryId);
    return cat?.name || null;
  }

  function openCreate() {
    setFormData(defaultFormData);
    setEditingItem(null);
    setCreateDialogOpen(true);
  }

  function openEdit(item: Equipment) {
    setFormData({
      name: item.name || "",
      categoryId: item.categoryId || "",
      serialNumber: item.serialNumber || "",
      manufacturer: item.manufacturer || "",
      model: item.model || "",
      purchaseDate: item.purchaseDate ? format(new Date(item.purchaseDate), "yyyy-MM-dd") : "",
      purchasePrice: item.purchasePrice || "",
      status: item.status || "active",
      location: item.location || "",
      description: item.description || "",
    });
    setEditingItem(item);
    setCreateDialogOpen(true);
  }

  function handleSubmit() {
    if (!formData.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    const payload: Record<string, unknown> = {
      name: formData.name.trim(),
      status: formData.status,
    };
    if (formData.categoryId) payload.categoryId = formData.categoryId;
    if (formData.serialNumber) payload.serialNumber = formData.serialNumber;
    if (formData.manufacturer) payload.manufacturer = formData.manufacturer;
    if (formData.model) payload.model = formData.model;
    if (formData.purchaseDate) payload.purchaseDate = new Date(formData.purchaseDate).toISOString();
    if (formData.purchasePrice) payload.purchasePrice = formData.purchasePrice;
    if (formData.location) payload.location = formData.location;
    if (formData.description) payload.description = formData.description;

    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  function handleMaintenanceSubmit() {
    if (!maintenanceForm.title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    const payload: Record<string, unknown> = {
      title: maintenanceForm.title.trim(),
      type: maintenanceForm.type,
    };
    if (maintenanceForm.description) payload.description = maintenanceForm.description;
    if (maintenanceForm.cost) payload.cost = maintenanceForm.cost;
    if (maintenanceForm.scheduledDate) payload.scheduledDate = new Date(maintenanceForm.scheduledDate).toISOString();
    if (maintenanceForm.nextDueDate) payload.nextDueDate = new Date(maintenanceForm.nextDueDate).toISOString();

    createMaintenanceMutation.mutate(payload);
  }

  return (
    <PageShell>
      <PageHeader
        title="Equipment & Assets"
        leading={<Wrench className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />}
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add Equipment
          </Button>
        }
      />

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="relative flex-1 w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search equipment..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="available">Available</TabsTrigger>
            <TabsTrigger value="in_use">In Use</TabsTrigger>
            <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
            <TabsTrigger value="utilisation">Utilisation</TabsTrigger>
          </TabsList>
        </Tabs>

        {activeTab === "utilisation" ? (
          <EquipmentUtilisation />
        ) : isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Wrench}
            title={searchQuery ? "No equipment found" : "No equipment yet"}
            description={searchQuery ? "Try adjusting your search." : "Add your first piece of equipment to start tracking your tools and assets."}
            action={
              !searchQuery ? (
                <Button onClick={openCreate}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  Add Equipment
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-2">
            {filtered.map((item) => {
              const categoryName = getCategoryName(item.categoryId);
              return (
                <div
                  key={item.id}
                  className="feed-card cursor-pointer hover-elevate"
                  onClick={() => setSelectedItem(item)}
                >
                  <div className="card-padding">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-muted/50">
                          <Wrench className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{item.name}</p>
                          <div className="flex items-center gap-2 flex-wrap text-sm text-muted-foreground mt-0.5">
                            {categoryName && <span>{categoryName}</span>}
                            {item.serialNumber && (
                              <>
                                {categoryName && <span>·</span>}
                                <span>SN: {item.serialNumber}</span>
                              </>
                            )}
                            {item.location && (
                              <>
                                <span>·</span>
                                <span>{item.location}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <StatusBadge status={item.status || "active"} />
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(item);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Equipment" : "Add Equipment"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Makita Impact Driver"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Category</Label>
                <Button variant="ghost" size="sm" onClick={() => setCategoryDialogOpen(true)}>
                  <Plus className="h-3 w-3 mr-1" />
                  New
                </Button>
              </div>
              <Select
                value={formData.categoryId || "none"}
                onValueChange={(v) => setFormData({ ...formData, categoryId: v === "none" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No category</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Serial Number</Label>
                <Input
                  value={formData.serialNumber}
                  onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Manufacturer</Label>
                <Input
                  value={formData.manufacturer}
                  onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Model</Label>
              <Input
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Purchase Date</Label>
                <Input
                  type="date"
                  value={formData.purchaseDate}
                  onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Purchase Cost (AUD)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.purchasePrice}
                  onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(v) => setFormData({ ...formData, status: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Available</SelectItem>
                  <SelectItem value="in_use">In Use</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="retired">Retired</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Location</Label>
              <Input
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="e.g., Workshop, Van 1"
              />
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending ? "Saving..." : editingItem ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Category Name</Label>
              <Input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="e.g., Power Tools"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createCategoryMutation.mutate({ name: newCategoryName })}
              disabled={!newCategoryName.trim() || createCategoryMutation.isPending}
            >
              {createCategoryMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={!!selectedItem} onOpenChange={(open) => { if (!open) setSelectedItem(null); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedItem && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2 flex-wrap">
                  {selectedItem.name}
                  <StatusBadge status={selectedItem.status || "active"} />
                </SheetTitle>
              </SheetHeader>
              <div className="space-y-6 mt-6">
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Details</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {getCategoryName(selectedItem.categoryId) && (
                      <div>
                        <p className="text-muted-foreground">Category</p>
                        <p className="font-medium">{getCategoryName(selectedItem.categoryId)}</p>
                      </div>
                    )}
                    {selectedItem.serialNumber && (
                      <div>
                        <p className="text-muted-foreground">Serial Number</p>
                        <p className="font-medium">{selectedItem.serialNumber}</p>
                      </div>
                    )}
                    {selectedItem.manufacturer && (
                      <div>
                        <p className="text-muted-foreground">Manufacturer</p>
                        <p className="font-medium">{selectedItem.manufacturer}</p>
                      </div>
                    )}
                    {selectedItem.model && (
                      <div>
                        <p className="text-muted-foreground">Model</p>
                        <p className="font-medium">{selectedItem.model}</p>
                      </div>
                    )}
                    {selectedItem.purchaseDate && (
                      <div>
                        <p className="text-muted-foreground">Purchase Date</p>
                        <p className="font-medium">{format(new Date(selectedItem.purchaseDate), "dd MMM yyyy")}</p>
                      </div>
                    )}
                    {selectedItem.purchasePrice && (
                      <div>
                        <p className="text-muted-foreground">Purchase Cost</p>
                        <p className="font-medium">{formatAUD(selectedItem.purchasePrice)}</p>
                      </div>
                    )}
                    {selectedItem.location && (
                      <div>
                        <p className="text-muted-foreground">Location</p>
                        <p className="font-medium">{selectedItem.location}</p>
                      </div>
                    )}
                    {selectedItem.currentValue && (
                      <div>
                        <p className="text-muted-foreground">Current Value</p>
                        <p className="font-medium">{formatAUD(selectedItem.currentValue)}</p>
                      </div>
                    )}
                  </div>
                  {selectedItem.description && (
                    <div className="text-sm">
                      <p className="text-muted-foreground">Notes</p>
                      <p className="mt-0.5">{selectedItem.description}</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedItem(null);
                      openEdit(selectedItem);
                    }}
                  >
                    <Edit className="h-4 w-4 mr-1.5" />
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      if (confirm("Delete this equipment?")) {
                        deleteMutation.mutate(selectedItem.id);
                      }
                    }}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 mr-1.5" />
                    Delete
                  </Button>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Maintenance History</h3>
                    <Button size="sm" onClick={() => {
                      setMaintenanceForm(defaultMaintenanceForm);
                      setMaintenanceDialogOpen(true);
                    }}>
                      <Plus className="h-3 w-3 mr-1" />
                      Add Record
                    </Button>
                  </div>

                  {maintenanceLoading ? (
                    <div className="space-y-2">
                      {[1, 2].map((i) => (
                        <Card key={i}>
                          <CardContent className="p-3">
                            <Skeleton className="h-4 w-32 mb-2" />
                            <Skeleton className="h-3 w-48" />
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : maintenanceRecords.length === 0 ? (
                    <Card>
                      <CardContent className="p-4 text-center text-sm text-muted-foreground">
                        No maintenance records yet
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-2">
                      {maintenanceRecords.map((record) => (
                        <Card key={record.id}>
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between gap-2 flex-wrap">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-medium text-sm">{record.title}</p>
                                  <Badge variant="secondary" className="text-xs">
                                    {record.type === "scheduled" ? "Service" : record.type === "repair" ? "Repair" : "Inspection"}
                                  </Badge>
                                </div>
                                {record.description && (
                                  <p className="text-xs text-muted-foreground mt-1">{record.description}</p>
                                )}
                                <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                                  {record.scheduledDate && (
                                    <span className="flex items-center gap-1">
                                      <CalendarIcon className="h-3 w-3" />
                                      {format(new Date(record.scheduledDate), "dd MMM yyyy")}
                                    </span>
                                  )}
                                  {record.cost && (
                                    <span>{formatAUD(record.cost)}</span>
                                  )}
                                  {record.vendor && (
                                    <span>{record.vendor}</span>
                                  )}
                                </div>
                                {record.nextDueDate && (
                                  <p className="text-xs text-warning mt-1 flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    Next due: {format(new Date(record.nextDueDate), "dd MMM yyyy")}
                                  </p>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>

                <JobAssignmentsSection
                  assignments={allJobEquipment}
                  equipmentId={selectedItem.id}
                />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={maintenanceDialogOpen} onOpenChange={setMaintenanceDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Maintenance Record</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                value={maintenanceForm.title}
                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, title: e.target.value })}
                placeholder="e.g., Annual Service"
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={maintenanceForm.type}
                onValueChange={(v) => setMaintenanceForm({ ...maintenanceForm, type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">Service</SelectItem>
                  <SelectItem value="repair">Repair</SelectItem>
                  <SelectItem value="inspection">Inspection</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={maintenanceForm.description}
                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={maintenanceForm.scheduledDate}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, scheduledDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Cost (AUD)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={maintenanceForm.cost}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, cost: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Next Due Date</Label>
              <Input
                type="date"
                value={maintenanceForm.nextDueDate}
                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, nextDueDate: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMaintenanceDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleMaintenanceSubmit}
              disabled={createMaintenanceMutation.isPending}
            >
              {createMaintenanceMutation.isPending ? "Saving..." : "Add Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
