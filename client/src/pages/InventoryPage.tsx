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
import {
  Plus,
  Search,
  Trash2,
  Edit,
  AlertTriangle,
  Package,
  ArrowUpDown,
  ArrowDown,
  ArrowUp,
  Tag,
  ShoppingCart,
  History,
  ChevronLeft,
  MoreVertical,
} from "lucide-react";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { EmptyState } from "@/components/ui/compact-card";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type {
  InventoryItem,
  InventoryCategory,
  InventoryTransaction,
  Supplier,
  PurchaseOrder,
} from "@shared/schema";

type ActiveTab = "items" | "categories" | "low-stock" | "purchase-orders";
type SortField = "name" | "currentStock" | "costPrice" | "sellPrice";
type SortDir = "asc" | "desc";

const statusColors: Record<string, string> = {
  pending: "bg-warning/10 text-warning",
  approved: "bg-primary/10 text-primary",
  sent: "bg-info/10 text-info",
  received: "bg-success/10 text-success",
  cancelled: "bg-destructive/10 text-destructive",
};

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("items");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [showItemDialog, setShowItemDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<InventoryCategory | null>(null);

  const [showAdjustDialog, setShowAdjustDialog] = useState(false);
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null);

  const [showPODialog, setShowPODialog] = useState(false);

  const { toast } = useToast();

  const { data: items = [], isLoading: itemsLoading } = useQuery<InventoryItem[]>({
    queryKey: ["/api/inventory/items"],
  });

  const { data: categories = [], isLoading: categoriesLoading } = useQuery<InventoryCategory[]>({
    queryKey: ["/api/inventory/categories"],
  });

  const { data: lowStockItems = [] } = useQuery<InventoryItem[]>({
    queryKey: ["/api/inventory/low-stock"],
  });

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });

  const { data: purchaseOrders = [], isLoading: posLoading } = useQuery<PurchaseOrder[]>({
    queryKey: ["/api/purchase-orders"],
  });

  const { data: transactions = [] } = useQuery<InventoryTransaction[]>({
    queryKey: ["/api/inventory/items", selectedItem?.id, "transactions"],
    enabled: !!selectedItem,
  });

  const createItemMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/inventory/items", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/low-stock"] });
      setShowItemDialog(false);
      setEditingItem(null);
      toast({ title: "Item created" });
    },
    onError: () => toast({ title: "Failed to create item", variant: "destructive" }),
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest("PATCH", `/api/inventory/items/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/low-stock"] });
      setShowItemDialog(false);
      setEditingItem(null);
      toast({ title: "Item updated" });
    },
    onError: () => toast({ title: "Failed to update item", variant: "destructive" }),
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/inventory/items/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/low-stock"] });
      setSelectedItem(null);
      toast({ title: "Item deleted" });
    },
    onError: () => toast({ title: "Failed to delete item", variant: "destructive" }),
  });

  const createCategoryMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/inventory/categories", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/categories"] });
      setShowCategoryDialog(false);
      setEditingCategory(null);
      toast({ title: "Category created" });
    },
    onError: () => toast({ title: "Failed to create category", variant: "destructive" }),
  });

  const createTransactionMutation = useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: any }) =>
      apiRequest("POST", `/api/inventory/items/${itemId}/transactions`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/low-stock"] });
      if (selectedItem) {
        queryClient.invalidateQueries({
          queryKey: ["/api/inventory/items", selectedItem.id, "transactions"],
        });
      }
      setShowAdjustDialog(false);
      setAdjustItem(null);
      toast({ title: "Stock adjusted" });
    },
    onError: () => toast({ title: "Failed to adjust stock", variant: "destructive" }),
  });

  const createPOMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/purchase-orders", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      setShowPODialog(false);
      toast({ title: "Purchase order created" });
    },
    onError: () => toast({ title: "Failed to create purchase order", variant: "destructive" }),
  });

  const updatePOStatusMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest("PATCH", `/api/purchase-orders/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      toast({ title: "Purchase order updated" });
    },
    onError: () => toast({ title: "Failed to update purchase order", variant: "destructive" }),
  });

  const filteredItems = items
    .filter((item) => {
      const matchesSearch =
        !searchQuery ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.sku && item.sku.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory =
        categoryFilter === "all" || item.categoryId === categoryFilter;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") cmp = a.name.localeCompare(b.name);
      else if (sortField === "currentStock")
        cmp = (a.currentStock ?? 0) - (b.currentStock ?? 0);
      else if (sortField === "costPrice")
        cmp = parseFloat(a.costPrice || "0") - parseFloat(b.costPrice || "0");
      else if (sortField === "sellPrice")
        cmp = parseFloat(a.sellPrice || "0") - parseFloat(b.sellPrice || "0");
      return sortDir === "asc" ? cmp : -cmp;
    });

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return "Uncategorized";
    return categories.find((c) => c.id === categoryId)?.name || "Unknown";
  };

  const getSupplierName = (supplierId: string | null) => {
    if (!supplierId) return "N/A";
    return suppliers.find((s) => s.id === supplierId)?.name || "Unknown";
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  if (selectedItem) {
    return (
      <PageShell>
        <ItemDetailView
          item={selectedItem}
          transactions={transactions}
          getCategoryName={getCategoryName}
          getSupplierName={getSupplierName}
          onBack={() => setSelectedItem(null)}
          onEdit={() => {
            setEditingItem(selectedItem);
            setShowItemDialog(true);
          }}
          onDelete={() => deleteItemMutation.mutate(selectedItem.id)}
          onAdjust={() => {
            setAdjustItem(selectedItem);
            setShowAdjustDialog(true);
          }}
        />
        <AdjustStockDialog
          open={showAdjustDialog}
          onOpenChange={setShowAdjustDialog}
          item={adjustItem}
          isPending={createTransactionMutation.isPending}
          onSubmit={(data) => {
            if (adjustItem) {
              createTransactionMutation.mutate({ itemId: adjustItem.id, data });
            }
          }}
        />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Inventory"
        subtitle="Manage your stock, materials, and supplies"
        action={
          <div className="flex items-center gap-2 flex-wrap">
            {activeTab === "items" && (
              <Button onClick={() => { setEditingItem(null); setShowItemDialog(true); }}>
                <Plus className="w-4 h-4 mr-1" /> Add Item
              </Button>
            )}
            {activeTab === "categories" && (
              <Button onClick={() => { setEditingCategory(null); setShowCategoryDialog(true); }}>
                <Plus className="w-4 h-4 mr-1" /> Add Category
              </Button>
            )}
            {activeTab === "purchase-orders" && (
              <Button onClick={() => setShowPODialog(true)}>
                <Plus className="w-4 h-4 mr-1" /> New PO
              </Button>
            )}
          </div>
        }
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ActiveTab)}>
        <TabsList className="mb-4">
          <TabsTrigger value="items">Items</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="low-stock">
            Low Stock
            {lowStockItems.length > 0 && (
              <Badge variant="destructive" className="ml-1.5 text-xs">
                {lowStockItems.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="purchase-orders">Purchase Orders</TabsTrigger>
        </TabsList>
      </Tabs>

      {activeTab === "items" && (
        <ItemsTab
          items={filteredItems}
          categories={categories}
          isLoading={itemsLoading}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          categoryFilter={categoryFilter}
          onCategoryFilterChange={setCategoryFilter}
          sortField={sortField}
          sortDir={sortDir}
          onToggleSort={toggleSort}
          getCategoryName={getCategoryName}
          onSelectItem={setSelectedItem}
          onAddItem={() => { setEditingItem(null); setShowItemDialog(true); }}
        />
      )}

      {activeTab === "categories" && (
        <CategoriesTab
          categories={categories}
          isLoading={categoriesLoading}
          items={items}
          onAdd={() => { setEditingCategory(null); setShowCategoryDialog(true); }}
          onEdit={(cat) => { setEditingCategory(cat); setShowCategoryDialog(true); }}
        />
      )}

      {activeTab === "low-stock" && (
        <LowStockTab
          items={lowStockItems}
          getCategoryName={getCategoryName}
          onSelectItem={setSelectedItem}
          onAdjust={(item) => {
            setAdjustItem(item);
            setShowAdjustDialog(true);
          }}
        />
      )}

      {activeTab === "purchase-orders" && (
        <PurchaseOrdersTab
          purchaseOrders={purchaseOrders}
          isLoading={posLoading}
          getSupplierName={getSupplierName}
          onAdd={() => setShowPODialog(true)}
          onUpdateStatus={(id, status) =>
            updatePOStatusMutation.mutate({ id, data: { status } })
          }
        />
      )}

      <ItemDialog
        open={showItemDialog}
        onOpenChange={setShowItemDialog}
        item={editingItem}
        categories={categories}
        suppliers={suppliers}
        isPending={createItemMutation.isPending || updateItemMutation.isPending}
        onSubmit={(data) => {
          if (editingItem) {
            updateItemMutation.mutate({ id: editingItem.id, data });
          } else {
            createItemMutation.mutate(data);
          }
        }}
      />

      <CategoryDialog
        open={showCategoryDialog}
        onOpenChange={setShowCategoryDialog}
        category={editingCategory}
        isPending={createCategoryMutation.isPending}
        onSubmit={(data) => createCategoryMutation.mutate(data)}
      />

      <AdjustStockDialog
        open={showAdjustDialog}
        onOpenChange={setShowAdjustDialog}
        item={adjustItem}
        isPending={createTransactionMutation.isPending}
        onSubmit={(data) => {
          if (adjustItem) {
            createTransactionMutation.mutate({ itemId: adjustItem.id, data });
          }
        }}
      />

      <PurchaseOrderDialog
        open={showPODialog}
        onOpenChange={setShowPODialog}
        suppliers={suppliers}
        isPending={createPOMutation.isPending}
        onSubmit={(data) => createPOMutation.mutate(data)}
      />
    </PageShell>
  );
}

function ItemsTab({
  items,
  categories,
  isLoading,
  searchQuery,
  onSearchChange,
  categoryFilter,
  onCategoryFilterChange,
  sortField,
  sortDir,
  onToggleSort,
  getCategoryName,
  onSelectItem,
  onAddItem,
}: {
  items: InventoryItem[];
  categories: InventoryCategory[];
  isLoading: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  categoryFilter: string;
  onCategoryFilterChange: (v: string) => void;
  sortField: SortField;
  sortDir: SortDir;
  onToggleSort: (f: SortField) => void;
  getCategoryName: (id: string | null) => string;
  onSelectItem: (item: InventoryItem) => void;
  onAddItem: () => void;
}) {
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    return sortDir === "asc" ? (
      <ArrowUp className="w-3 h-3" />
    ) : (
      <ArrowDown className="w-3 h-3" />
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-md" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={onCategoryFilterChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No inventory items"
          description="Add your first item to start tracking stock"
          action={
            <Button onClick={onAddItem}>
              <Plus className="w-4 h-4 mr-1" /> Add Item
            </Button>
          }
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="p-3 font-medium">
                    <button
                      className="flex items-center gap-1"
                      onClick={() => onToggleSort("name")}
                    >
                      Name <SortIcon field="name" />
                    </button>
                  </th>
                  <th className="p-3 font-medium hidden sm:table-cell">SKU</th>
                  <th className="p-3 font-medium hidden md:table-cell">Category</th>
                  <th className="p-3 font-medium">
                    <button
                      className="flex items-center gap-1"
                      onClick={() => onToggleSort("currentStock")}
                    >
                      Stock <SortIcon field="currentStock" />
                    </button>
                  </th>
                  <th className="p-3 font-medium hidden sm:table-cell">
                    <button
                      className="flex items-center gap-1"
                      onClick={() => onToggleSort("costPrice")}
                    >
                      Cost <SortIcon field="costPrice" />
                    </button>
                  </th>
                  <th className="p-3 font-medium hidden sm:table-cell">
                    <button
                      className="flex items-center gap-1"
                      onClick={() => onToggleSort("sellPrice")}
                    >
                      Sell <SortIcon field="sellPrice" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const isLow =
                    item.reorderLevel != null &&
                    (item.currentStock ?? 0) <= item.reorderLevel;
                  return (
                    <tr
                      key={item.id}
                      className="border-b last:border-0 hover-elevate cursor-pointer"
                      onClick={() => onSelectItem(item)}
                    >
                      <td className="p-3 font-medium">{item.name}</td>
                      <td className="p-3 hidden sm:table-cell text-muted-foreground">
                        {item.sku || "-"}
                      </td>
                      <td className="p-3 hidden md:table-cell">
                        <Badge variant="secondary" className="text-xs">
                          {getCategoryName(item.categoryId)}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <span
                          className={
                            isLow
                              ? "text-destructive font-semibold"
                              : "text-foreground"
                          }
                        >
                          {item.currentStock ?? 0}
                        </span>
                        {isLow && (
                          <AlertTriangle className="w-3.5 h-3.5 text-destructive inline ml-1" />
                        )}
                      </td>
                      <td className="p-3 hidden sm:table-cell text-muted-foreground">
                        {item.costPrice ? `$${parseFloat(item.costPrice).toFixed(2)}` : "-"}
                      </td>
                      <td className="p-3 hidden sm:table-cell text-muted-foreground">
                        {item.sellPrice ? `$${parseFloat(item.sellPrice).toFixed(2)}` : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function CategoriesTab({
  categories,
  isLoading,
  items,
  onAdd,
  onEdit,
}: {
  categories: InventoryCategory[];
  isLoading: boolean;
  items: InventoryItem[];
  onAdd: () => void;
  onEdit: (cat: InventoryCategory) => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 w-full rounded-md" />
        ))}
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <EmptyState
        icon={Tag}
        title="No categories"
        description="Create categories to organize your inventory"
        action={
          <Button onClick={onAdd}>
            <Plus className="w-4 h-4 mr-1" /> Add Category
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {categories.map((cat) => {
        const count = items.filter((i) => i.categoryId === cat.id).length;
        return (
          <Card key={cat.id} className="hover-elevate cursor-pointer" onClick={() => onEdit(cat)}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium truncate">{cat.name}</p>
                  {cat.description && (
                    <p className="text-sm text-muted-foreground truncate mt-0.5">
                      {cat.description}
                    </p>
                  )}
                </div>
                <Badge variant="secondary">{count} items</Badge>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function LowStockTab({
  items,
  getCategoryName,
  onSelectItem,
  onAdjust,
}: {
  items: InventoryItem[];
  getCategoryName: (id: string | null) => string;
  onSelectItem: (item: InventoryItem) => void;
  onAdjust: (item: InventoryItem) => void;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="No low stock items"
        description="All items are above their reorder levels"
      />
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <Card key={item.id}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div
                className="flex-1 min-w-0 cursor-pointer"
                onClick={() => onSelectItem(item)}
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
                  <p className="font-medium truncate">{item.name}</p>
                </div>
                <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                  <span>
                    Stock: <span className="text-destructive font-semibold">{item.currentStock ?? 0}</span>
                    {" / "}
                    Reorder at: {item.reorderLevel ?? 0}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {getCategoryName(item.categoryId)}
                  </Badge>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  onAdjust(item);
                }}
              >
                <ArrowUp className="w-4 h-4 mr-1" /> Restock
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function PurchaseOrdersTab({
  purchaseOrders,
  isLoading,
  getSupplierName,
  onAdd,
  onUpdateStatus,
}: {
  purchaseOrders: PurchaseOrder[];
  isLoading: boolean;
  getSupplierName: (id: string | null) => string;
  onAdd: () => void;
  onUpdateStatus: (id: string, status: string) => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-md" />
        ))}
      </div>
    );
  }

  if (purchaseOrders.length === 0) {
    return (
      <EmptyState
        icon={ShoppingCart}
        title="No purchase orders"
        description="Create purchase orders to manage supplier orders"
        action={
          <Button onClick={onAdd}>
            <Plus className="w-4 h-4 mr-1" /> New PO
          </Button>
        }
      />
    );
  }

  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="p-3 font-medium">PO Number</th>
              <th className="p-3 font-medium hidden sm:table-cell">Supplier</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium hidden sm:table-cell">Total</th>
              <th className="p-3 font-medium hidden md:table-cell">Order Date</th>
              <th className="p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {purchaseOrders.map((po) => (
              <tr key={po.id} className="border-b last:border-0">
                <td className="p-3 font-medium">{po.poNumber}</td>
                <td className="p-3 hidden sm:table-cell text-muted-foreground">
                  {getSupplierName(po.supplierId)}
                </td>
                <td className="p-3">
                  <Badge className={statusColors[po.status || "pending"]}>
                    {(po.status || "pending").charAt(0).toUpperCase() +
                      (po.status || "pending").slice(1)}
                  </Badge>
                </td>
                <td className="p-3 hidden sm:table-cell text-muted-foreground">
                  ${parseFloat(po.total || "0").toFixed(2)}
                </td>
                <td className="p-3 hidden md:table-cell text-muted-foreground">
                  {po.orderDate ? format(new Date(po.orderDate), "dd MMM yyyy") : "-"}
                </td>
                <td className="p-3">
                  <Select
                    value={po.status || "pending"}
                    onValueChange={(val) => onUpdateStatus(po.id, val)}
                  >
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="received">Received</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ItemDetailView({
  item,
  transactions,
  getCategoryName,
  getSupplierName,
  onBack,
  onEdit,
  onDelete,
  onAdjust,
}: {
  item: InventoryItem;
  transactions: InventoryTransaction[];
  getCategoryName: (id: string | null) => string;
  getSupplierName: (id: string | null) => string;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAdjust: () => void;
}) {
  const isLow =
    item.reorderLevel != null && (item.currentStock ?? 0) <= item.reorderLevel;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <h2 className="text-xl font-semibold flex-1 truncate">{item.name}</h2>
        <Button variant="outline" onClick={onEdit}>
          <Edit className="w-4 h-4 mr-1" /> Edit
        </Button>
        <Button variant="destructive" onClick={onDelete}>
          <Trash2 className="w-4 h-4 mr-1" /> Delete
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Current Stock</p>
            <p className={`text-2xl font-bold mt-1 ${isLow ? "text-destructive" : ""}`}>
              {item.currentStock ?? 0}
              <span className="text-sm font-normal text-muted-foreground ml-1">
                {item.unit || "each"}
              </span>
            </p>
            {isLow && (
              <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                <AlertTriangle className="w-3 h-3" /> Below reorder level ({item.reorderLevel})
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Cost Price</p>
            <p className="text-2xl font-bold mt-1">
              {item.costPrice ? `$${parseFloat(item.costPrice).toFixed(2)}` : "-"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Sell Price</p>
            <p className="text-2xl font-bold mt-1">
              {item.sellPrice ? `$${parseFloat(item.sellPrice).toFixed(2)}` : "-"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Category</p>
            <p className="text-lg font-medium mt-1">{getCategoryName(item.categoryId)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="font-medium">Details</p>
            <div className="text-sm space-y-1 text-muted-foreground">
              <p>SKU: {item.sku || "-"}</p>
              <p>Unit: {item.unit || "each"}</p>
              <p>Location: {item.location || "-"}</p>
              <p>Supplier: {getSupplierName(item.supplierId)}</p>
              <p>Min Stock: {item.minimumStock ?? 0}</p>
              <p>Reorder Level: {item.reorderLevel ?? 0}</p>
              <p>Reorder Qty: {item.reorderQuantity ?? "-"}</p>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium flex items-center gap-1.5">
              <History className="w-4 h-4" /> Stock History
            </p>
            <Button onClick={onAdjust}>
              <ArrowUpDown className="w-4 h-4 mr-1" /> Adjust Stock
            </Button>
          </div>
          {transactions.length === 0 ? (
            <Card>
              <CardContent className="p-4 text-center text-muted-foreground text-sm">
                No stock movements recorded
              </CardContent>
            </Card>
          ) : (
            <Card>
              <div className="max-h-[300px] overflow-y-auto">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between gap-2 p-3 border-b last:border-0 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        {tx.type === "in" && (
                          <ArrowDown className="w-3.5 h-3.5 text-success flex-shrink-0" />
                        )}
                        {tx.type === "out" && (
                          <ArrowUp className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
                        )}
                        {tx.type === "adjustment" && (
                          <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                        )}
                        <span className="font-medium capitalize">{tx.type}</span>
                        <span className="text-muted-foreground">
                          {tx.type === "out" ? "-" : "+"}
                          {tx.quantity}
                        </span>
                      </div>
                      {tx.notes && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {tx.notes}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {tx.transactionDate
                        ? format(new Date(tx.transactionDate), "dd MMM HH:mm")
                        : "-"}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function ItemDialog({
  open,
  onOpenChange,
  item,
  categories,
  suppliers,
  isPending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item: InventoryItem | null;
  categories: InventoryCategory[];
  suppliers: Supplier[];
  isPending: boolean;
  onSubmit: (data: any) => void;
}) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    sku: "",
    unit: "each",
    costPrice: "",
    sellPrice: "",
    categoryId: "",
    minimumStock: "0",
    reorderLevel: "0",
    reorderQuantity: "",
    location: "",
    supplierId: "",
  });

  const resetForm = () => {
    if (item) {
      setFormData({
        name: item.name,
        description: item.description || "",
        sku: item.sku || "",
        unit: item.unit || "each",
        costPrice: item.costPrice || "",
        sellPrice: item.sellPrice || "",
        categoryId: item.categoryId || "",
        minimumStock: String(item.minimumStock ?? 0),
        reorderLevel: String(item.reorderLevel ?? 0),
        reorderQuantity: item.reorderQuantity ? String(item.reorderQuantity) : "",
        location: item.location || "",
        supplierId: item.supplierId || "",
      });
    } else {
      setFormData({
        name: "",
        description: "",
        sku: "",
        unit: "each",
        costPrice: "",
        sellPrice: "",
        categoryId: "",
        minimumStock: "0",
        reorderLevel: "0",
        reorderQuantity: "",
        location: "",
        supplierId: "",
      });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v) resetForm();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? "Edit Item" : "Add Item"}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const payload: any = {
              name: formData.name,
              description: formData.description || null,
              sku: formData.sku || null,
              unit: formData.unit,
              costPrice: formData.costPrice || null,
              sellPrice: formData.sellPrice || null,
              categoryId: formData.categoryId || null,
              minimumStock: parseInt(formData.minimumStock) || 0,
              reorderLevel: parseInt(formData.reorderLevel) || 0,
              reorderQuantity: formData.reorderQuantity
                ? parseInt(formData.reorderQuantity)
                : null,
              location: formData.location || null,
              supplierId: formData.supplierId || null,
            };
            onSubmit(payload);
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>SKU</Label>
              <Input
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Unit</Label>
              <Select
                value={formData.unit}
                onValueChange={(v) => setFormData({ ...formData, unit: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="each">Each</SelectItem>
                  <SelectItem value="box">Box</SelectItem>
                  <SelectItem value="m">Metre</SelectItem>
                  <SelectItem value="m2">Square Metre</SelectItem>
                  <SelectItem value="kg">Kilogram</SelectItem>
                  <SelectItem value="litre">Litre</SelectItem>
                  <SelectItem value="roll">Roll</SelectItem>
                  <SelectItem value="pack">Pack</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Cost Price ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.costPrice}
                onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Sell Price ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.sellPrice}
                onChange={(e) => setFormData({ ...formData, sellPrice: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={formData.categoryId || "none"}
              onValueChange={(v) =>
                setFormData({ ...formData, categoryId: v === "none" ? "" : v })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Category</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Min Stock</Label>
              <Input
                type="number"
                value={formData.minimumStock}
                onChange={(e) =>
                  setFormData({ ...formData, minimumStock: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Reorder Level</Label>
              <Input
                type="number"
                value={formData.reorderLevel}
                onChange={(e) =>
                  setFormData({ ...formData, reorderLevel: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Reorder Qty</Label>
              <Input
                type="number"
                value={formData.reorderQuantity}
                onChange={(e) =>
                  setFormData({ ...formData, reorderQuantity: e.target.value })
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Location</Label>
            <Input
              placeholder="e.g. Warehouse A, Bin 3"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Supplier</Label>
            <Select
              value={formData.supplierId || "none"}
              onValueChange={(v) =>
                setFormData({ ...formData, supplierId: v === "none" ? "" : v })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select supplier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Supplier</SelectItem>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : item ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CategoryDialog({
  open,
  onOpenChange,
  category,
  isPending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  category: InventoryCategory | null;
  isPending: boolean;
  onSubmit: (data: any) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v) {
          setName(category?.name || "");
          setDescription(category?.description || "");
        }
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{category ? "Edit Category" : "Add Category"}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({ name, description: description || null });
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : category ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AdjustStockDialog({
  open,
  onOpenChange,
  item,
  isPending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item: InventoryItem | null;
  isPending: boolean;
  onSubmit: (data: any) => void;
}) {
  const [type, setType] = useState("in");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v) {
          setType("in");
          setQuantity("");
          setNotes("");
        }
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            Adjust Stock{item ? `: ${item.name}` : ""}
          </DialogTitle>
        </DialogHeader>
        {item && (
          <p className="text-sm text-muted-foreground">
            Current stock: {item.currentStock ?? 0} {item.unit || "each"}
          </p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({
              type,
              quantity: parseInt(quantity),
              notes: notes || null,
            });
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in">Stock In</SelectItem>
                <SelectItem value="out">Stock Out</SelectItem>
                <SelectItem value="adjustment">Adjustment</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Quantity *</Label>
            <Input
              type="number"
              required
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Reason / Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Adjust"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PurchaseOrderDialog({
  open,
  onOpenChange,
  suppliers,
  isPending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  suppliers: Supplier[];
  isPending: boolean;
  onSubmit: (data: any) => void;
}) {
  const [formData, setFormData] = useState({
    supplierId: "",
    poNumber: "",
    notes: "",
    total: "",
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v) {
          setFormData({ supplierId: "", poNumber: "", notes: "", total: "" });
        }
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>New Purchase Order</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({
              supplierId: formData.supplierId,
              poNumber: formData.poNumber,
              notes: formData.notes || null,
              total: formData.total || "0",
              subtotal: formData.total || "0",
              status: "pending",
            });
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label>PO Number *</Label>
            <Input
              required
              value={formData.poNumber}
              onChange={(e) =>
                setFormData({ ...formData, poNumber: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Supplier *</Label>
            <Select
              value={formData.supplierId}
              onValueChange={(v) =>
                setFormData({ ...formData, supplierId: v })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select supplier" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Total ($)</Label>
            <Input
              type="number"
              step="0.01"
              value={formData.total}
              onChange={(e) =>
                setFormData({ ...formData, total: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending || !formData.supplierId || !formData.poNumber}
            >
              {isPending ? "Creating..." : "Create PO"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
