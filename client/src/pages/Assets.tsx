import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertAssetSchema, type Asset } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { EmptyState } from "@/components/ui/compact-card";
import { SearchBar, FilterChips } from "@/components/ui/filter-chips";
import { DataTable, ColumnDef, StatusBadge } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Plus, 
  Package, 
  Wrench, 
  Truck, 
  HardHat, 
  LayoutGrid, 
  List, 
  MoreVertical, 
  Edit, 
  Trash2,
  Calendar,
  DollarSign,
  MapPin,
  User,
  Image as ImageIcon,
  AlertTriangle,
  CheckCircle,
  MinusCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import KPIBox from "@/components/KPIBox";
import { format } from "date-fns";

const assetFormSchema = insertAssetSchema.extend({
  name: z.string().min(1, "Name is required"),
  purchaseDate: z.string().optional().nullable(),
  lastMaintenanceDate: z.string().optional().nullable(),
  nextMaintenanceDate: z.string().optional().nullable(),
  purchasePrice: z.coerce.number().optional().nullable(),
  currentValue: z.coerce.number().optional().nullable(),
});

type AssetFormData = z.infer<typeof assetFormSchema>;

const categoryOptions = [
  { value: "tool", label: "Tool", icon: Wrench },
  { value: "equipment", label: "Equipment", icon: HardHat },
  { value: "vehicle", label: "Vehicle", icon: Truck },
  { value: "material", label: "Material", icon: Package },
];

const conditionOptions = [
  { value: "new", label: "New", color: "bg-blue-500" },
  { value: "good", label: "Good", color: "bg-green-500" },
  { value: "fair", label: "Fair", color: "bg-yellow-500" },
  { value: "poor", label: "Poor", color: "bg-orange-500" },
  { value: "retired", label: "Retired", color: "bg-gray-500" },
];

function ConditionBadge({ condition }: { condition: string }) {
  const option = conditionOptions.find(o => o.value === condition) || conditionOptions[1];
  const Icon = condition === "good" ? CheckCircle : condition === "poor" || condition === "retired" ? AlertTriangle : MinusCircle;
  
  return (
    <Badge 
      variant="secondary" 
      className={cn(
        "gap-1 capitalize",
        condition === "good" && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
        condition === "fair" && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
        condition === "poor" && "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
        condition === "new" && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
        condition === "retired" && "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400"
      )}
    >
      <Icon className="h-3 w-3" />
      {option.label}
    </Badge>
  );
}

function CategoryIcon({ category }: { category?: string | null }) {
  const option = categoryOptions.find(o => o.value === category);
  const Icon = option?.icon || Package;
  return <Icon className="h-4 w-4" />;
}

export default function Assets() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [conditionFilter, setConditionFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [assetToDelete, setAssetToDelete] = useState<Asset | null>(null);

  const { data: assets = [], isLoading } = useQuery<Asset[]>({
    queryKey: ['/api/assets'],
  });

  const form = useForm<AssetFormData>({
    resolver: zodResolver(assetFormSchema),
    defaultValues: {
      name: "",
      description: "",
      category: "tool",
      serialNumber: "",
      purchaseDate: null,
      purchasePrice: null,
      currentValue: null,
      condition: "good",
      location: "",
      assignedTo: null,
      photoUrl: "",
      notes: "",
      isActive: true,
      lastMaintenanceDate: null,
      nextMaintenanceDate: null,
    },
  });

  const createAssetMutation = useMutation({
    mutationFn: async (data: AssetFormData) => {
      const response = await apiRequest("POST", "/api/assets", {
        ...data,
        purchaseDate: data.purchaseDate ? new Date(data.purchaseDate).toISOString() : null,
        lastMaintenanceDate: data.lastMaintenanceDate ? new Date(data.lastMaintenanceDate).toISOString() : null,
        nextMaintenanceDate: data.nextMaintenanceDate ? new Date(data.nextMaintenanceDate).toISOString() : null,
        purchasePrice: data.purchasePrice?.toString() || null,
        currentValue: data.currentValue?.toString() || null,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/assets'] });
      toast({ title: "Asset created", description: "Asset has been added successfully" });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateAssetMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: AssetFormData }) => {
      const response = await apiRequest("PATCH", `/api/assets/${id}`, {
        ...data,
        purchaseDate: data.purchaseDate ? new Date(data.purchaseDate).toISOString() : null,
        lastMaintenanceDate: data.lastMaintenanceDate ? new Date(data.lastMaintenanceDate).toISOString() : null,
        nextMaintenanceDate: data.nextMaintenanceDate ? new Date(data.nextMaintenanceDate).toISOString() : null,
        purchasePrice: data.purchasePrice?.toString() || null,
        currentValue: data.currentValue?.toString() || null,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/assets'] });
      toast({ title: "Asset updated", description: "Asset has been updated successfully" });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteAssetMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/assets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/assets'] });
      toast({ title: "Asset deleted", description: "Asset has been removed" });
      setDeleteDialogOpen(false);
      setAssetToDelete(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleOpenCreate = () => {
    setEditingAsset(null);
    form.reset({
      name: "",
      description: "",
      category: "tool",
      serialNumber: "",
      purchaseDate: null,
      purchasePrice: null,
      currentValue: null,
      condition: "good",
      location: "",
      assignedTo: null,
      photoUrl: "",
      notes: "",
      isActive: true,
      lastMaintenanceDate: null,
      nextMaintenanceDate: null,
    });
    setDialogOpen(true);
  };

  const handleOpenEdit = (asset: Asset) => {
    setEditingAsset(asset);
    form.reset({
      name: asset.name,
      description: asset.description || "",
      category: asset.category || "tool",
      serialNumber: asset.serialNumber || "",
      purchaseDate: asset.purchaseDate ? format(new Date(asset.purchaseDate), "yyyy-MM-dd") : null,
      purchasePrice: asset.purchasePrice ? parseFloat(asset.purchasePrice) : null,
      currentValue: asset.currentValue ? parseFloat(asset.currentValue) : null,
      condition: asset.condition || "good",
      location: asset.location || "",
      assignedTo: asset.assignedTo || null,
      photoUrl: asset.photoUrl || "",
      notes: asset.notes || "",
      isActive: asset.isActive ?? true,
      lastMaintenanceDate: asset.lastMaintenanceDate ? format(new Date(asset.lastMaintenanceDate), "yyyy-MM-dd") : null,
      nextMaintenanceDate: asset.nextMaintenanceDate ? format(new Date(asset.nextMaintenanceDate), "yyyy-MM-dd") : null,
    });
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingAsset(null);
    form.reset();
  };

  const handleSubmit = (data: AssetFormData) => {
    if (editingAsset) {
      updateAssetMutation.mutate({ id: editingAsset.id, data });
    } else {
      createAssetMutation.mutate(data);
    }
  };

  const handleDeleteClick = (asset: Asset) => {
    setAssetToDelete(asset);
    setDeleteDialogOpen(true);
  };

  const filteredAssets = assets.filter((asset) => {
    const matchesSearch = 
      asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (asset.description?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (asset.serialNumber?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (asset.location?.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = categoryFilter === "all" || asset.category === categoryFilter;
    const matchesCondition = conditionFilter === "all" || asset.condition === conditionFilter;
    
    return matchesSearch && matchesCategory && matchesCondition;
  });

  const stats = {
    total: assets.length,
    tools: assets.filter(a => a.category === "tool").length,
    equipment: assets.filter(a => a.category === "equipment").length,
    vehicles: assets.filter(a => a.category === "vehicle").length,
    needsMaintenance: assets.filter(a => {
      if (!a.nextMaintenanceDate) return false;
      return new Date(a.nextMaintenanceDate) <= new Date();
    }).length,
  };

  const totalValue = assets.reduce((sum, asset) => {
    return sum + (asset.currentValue ? parseFloat(asset.currentValue) : 0);
  }, 0);

  const tableColumns: ColumnDef<Asset>[] = [
    {
      id: "name",
      header: "Asset",
      accessorKey: "name",
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-3">
          {row.photoUrl ? (
            <img 
              src={row.photoUrl} 
              alt={row.name} 
              className="h-10 w-10 rounded-lg object-cover"
            />
          ) : (
            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
              <CategoryIcon category={row.category} />
            </div>
          )}
          <div>
            <div className="font-medium">{row.name}</div>
            {row.serialNumber && (
              <div className="text-xs text-muted-foreground">S/N: {row.serialNumber}</div>
            )}
          </div>
        </div>
      ),
    },
    {
      id: "category",
      header: "Category",
      accessorKey: "category",
      sortable: true,
      cell: (row) => (
        <Badge variant="outline" className="capitalize gap-1">
          <CategoryIcon category={row.category} />
          {row.category || "Other"}
        </Badge>
      ),
    },
    {
      id: "condition",
      header: "Condition",
      accessorKey: "condition",
      sortable: true,
      cell: (row) => <ConditionBadge condition={row.condition || "good"} />,
    },
    {
      id: "location",
      header: "Location",
      accessorKey: "location",
      hideOnMobile: true,
      cell: (row) => row.location || "—",
    },
    {
      id: "currentValue",
      header: "Value",
      accessorKey: "currentValue",
      sortable: true,
      hideOnMobile: true,
      cell: (row) => row.currentValue ? `$${parseFloat(row.currentValue).toLocaleString()}` : "—",
    },
    {
      id: "actions",
      header: "",
      className: "w-10",
      cell: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => e.stopPropagation()}
              data-testid={`button-asset-actions-${row.id}`}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-xl">
            <DropdownMenuItem onClick={() => handleOpenEdit(row)} data-testid={`button-edit-asset-${row.id}`}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => handleDeleteClick(row)} 
              className="text-destructive"
              data-testid={`button-delete-asset-${row.id}`}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <PageShell data-testid="assets-page">
      <PageHeader
        title="Assets"
        subtitle={`${assets.length} total`}
        action={
          <div className="flex items-center gap-2">
            <div className="hidden md:inline-flex rounded-lg border bg-muted p-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode("cards")}
                className={cn(
                  "h-8 px-3 rounded-md",
                  viewMode === "cards" && "bg-background shadow-sm"
                )}
                data-testid="button-assets-view-cards"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode("table")}
                className={cn(
                  "h-8 px-3 rounded-md",
                  viewMode === "table" && "bg-background shadow-sm"
                )}
                data-testid="button-assets-view-table"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
            <Button 
              onClick={handleOpenCreate} 
              data-testid="button-create-asset"
              className="text-white font-medium"
              style={{ backgroundColor: 'hsl(var(--trade))', borderRadius: '12px' }}
            >
              <Plus className="h-4 w-4 mr-2" />
              New Asset
            </Button>
          </div>
        }
      />

      <SearchBar
        value={searchTerm}
        onChange={setSearchTerm}
        placeholder="Search assets by name, serial number, or location..."
      />

      <FilterChips 
        chips={[
          { id: 'all', label: 'All', count: stats.total, icon: <Package className="h-3 w-3" /> },
          { id: 'tool', label: 'Tools', count: stats.tools, icon: <Wrench className="h-3 w-3" /> },
          { id: 'equipment', label: 'Equipment', count: stats.equipment, icon: <HardHat className="h-3 w-3" /> },
          { id: 'vehicle', label: 'Vehicles', count: stats.vehicles, icon: <Truck className="h-3 w-3" /> },
        ]}
        activeId={categoryFilter}
        onSelect={setCategoryFilter}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {isLoading ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-card border rounded-md p-4">
                <div className="animate-pulse space-y-2">
                  <div className="h-4 w-16 bg-muted rounded" />
                  <div className="h-8 w-12 bg-muted rounded" />
                </div>
              </div>
            ))}
          </>
        ) : (
          <>
            <KPIBox
              icon={Package}
              title="Total Assets"
              value={stats.total.toString()}
              onClick={() => setCategoryFilter('all')}
            />
            <KPIBox
              icon={DollarSign}
              title="Total Value"
              value={`$${totalValue.toLocaleString()}`}
            />
            <KPIBox
              icon={Wrench}
              title="Tools"
              value={stats.tools.toString()}
              onClick={() => setCategoryFilter('tool')}
            />
            <KPIBox
              icon={AlertTriangle}
              title="Needs Maintenance"
              value={stats.needsMaintenance.toString()}
              iconColor={stats.needsMaintenance > 0 ? "text-orange-500" : undefined}
            />
          </>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="animate-pulse space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 bg-muted rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-24 bg-muted rounded" />
                      <div className="h-3 w-16 bg-muted rounded" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredAssets.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No assets found"
          description={searchTerm || categoryFilter !== "all" 
            ? "Try adjusting your search or filters" 
            : "Add your first asset to start tracking your tools and equipment"}
          action={
            <Button onClick={handleOpenCreate} data-testid="button-create-first-asset">
              <Plus className="h-4 w-4 mr-2" />
              Add Asset
            </Button>
          }
        />
      ) : viewMode === "table" ? (
        <DataTable
          data={filteredAssets}
          columns={tableColumns}
          onRowClick={(row) => handleOpenEdit(row)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAssets.map((asset) => (
            <Card 
              key={asset.id} 
              className="hover-elevate active-elevate-2 cursor-pointer"
              onClick={() => handleOpenEdit(asset)}
              data-testid={`card-asset-${asset.id}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {asset.photoUrl ? (
                    <img 
                      src={asset.photoUrl} 
                      alt={asset.name} 
                      className="h-14 w-14 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="h-14 w-14 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      <CategoryIcon category={asset.category} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-semibold truncate">{asset.name}</h3>
                        {asset.serialNumber && (
                          <p className="text-xs text-muted-foreground">S/N: {asset.serialNumber}</p>
                        )}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 flex-shrink-0"
                            data-testid={`button-asset-menu-${asset.id}`}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpenEdit(asset); }}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={(e) => { e.stopPropagation(); handleDeleteClick(asset); }} 
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <Badge variant="outline" className="capitalize text-xs gap-1">
                        <CategoryIcon category={asset.category} />
                        {asset.category || "Other"}
                      </Badge>
                      <ConditionBadge condition={asset.condition || "good"} />
                    </div>
                    <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                      {asset.location && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">{asset.location}</span>
                        </div>
                      )}
                      {asset.currentValue && (
                        <div className="flex items-center gap-1.5">
                          <DollarSign className="h-3 w-3" />
                          <span>${parseFloat(asset.currentValue).toLocaleString()}</span>
                        </div>
                      )}
                      {asset.nextMaintenanceDate && (
                        <div className={cn(
                          "flex items-center gap-1.5",
                          new Date(asset.nextMaintenanceDate) <= new Date() && "text-orange-500"
                        )}>
                          <Calendar className="h-3 w-3" />
                          <span>Next maintenance: {format(new Date(asset.nextMaintenanceDate), "MMM d, yyyy")}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAsset ? "Edit Asset" : "Add New Asset"}</DialogTitle>
            <DialogDescription>
              {editingAsset ? "Update the asset details below" : "Enter the details for your new asset"}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Name *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g., DeWalt Drill" 
                          {...field} 
                          data-testid="input-asset-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || "tool"}>
                        <FormControl>
                          <SelectTrigger data-testid="select-asset-category">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categoryOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              <div className="flex items-center gap-2">
                                <option.icon className="h-4 w-4" />
                                {option.label}
                              </div>
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
                  name="condition"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Condition</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || "good"}>
                        <FormControl>
                          <SelectTrigger data-testid="select-asset-condition">
                            <SelectValue placeholder="Select condition" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {conditionOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
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
                  name="serialNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Serial Number</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Enter serial number" 
                          {...field} 
                          value={field.value || ""}
                          data-testid="input-asset-serial"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g., Warehouse, Van #1" 
                          {...field} 
                          value={field.value || ""}
                          data-testid="input-asset-location"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Add a description..." 
                          className="resize-none"
                          {...field} 
                          value={field.value || ""}
                          data-testid="textarea-asset-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="purchaseDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purchase Date</FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          {...field} 
                          value={field.value || ""}
                          data-testid="input-asset-purchase-date"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="purchasePrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purchase Price</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input 
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            className="pl-9"
                            {...field} 
                            value={field.value || ""}
                            onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                            data-testid="input-asset-purchase-price"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="currentValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Value</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input 
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            className="pl-9"
                            {...field} 
                            value={field.value || ""}
                            onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                            data-testid="input-asset-current-value"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="assignedTo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assigned To</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Team member name" 
                          {...field} 
                          value={field.value || ""}
                          data-testid="input-asset-assigned-to"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="photoUrl"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Photo URL</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input 
                            placeholder="https://example.com/photo.jpg" 
                            className="pl-9"
                            {...field} 
                            value={field.value || ""}
                            data-testid="input-asset-photo-url"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="lastMaintenanceDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Maintenance</FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          {...field} 
                          value={field.value || ""}
                          data-testid="input-asset-last-maintenance"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="nextMaintenanceDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Next Maintenance</FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          {...field} 
                          value={field.value || ""}
                          data-testid="input-asset-next-maintenance"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Additional notes..." 
                          className="resize-none"
                          {...field} 
                          value={field.value || ""}
                          data-testid="textarea-asset-notes"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleCloseDialog}
                  data-testid="button-cancel-asset"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createAssetMutation.isPending || updateAssetMutation.isPending}
                  data-testid="button-save-asset"
                >
                  {(createAssetMutation.isPending || updateAssetMutation.isPending) ? "Saving..." : editingAsset ? "Update Asset" : "Create Asset"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Asset</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{assetToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => assetToDelete && deleteAssetMutation.mutate(assetToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteAssetMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteAssetMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
