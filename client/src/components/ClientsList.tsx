import { useState, useEffect } from "react";
import { useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Plus, Users, Phone, Mail, MapPin, Briefcase, LayoutGrid, List, MoreVertical, FileText, MessageCircle, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
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
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { EmptyState } from "@/components/ui/compact-card";
import { SearchBar, FilterChips } from "@/components/ui/filter-chips";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import KPIBox from "./KPIBox";
import { useClients, useDeleteClient } from "@/hooks/use-clients";
import { useToast } from "@/hooks/use-toast";
import ClientCard from "./ClientCard";
import { cn } from "@/lib/utils";


interface ClientsListProps {
  onCreateClient?: () => void;
  onViewClient?: (id: string) => void;
  onCreateJobForClient?: (id: string) => void;
  onCallClient?: (phone: string) => void;
  onEmailClient?: (email: string) => void;
  onSmsClient?: (clientId: string, phone: string) => void;
}

export default function ClientsList({
  onCreateClient,
  onViewClient,
  onCreateJobForClient,
  onCallClient,
  onEmailClient,
  onSmsClient
}: ClientsListProps) {
  const searchParams = useSearch();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<{ id: string; name: string } | null>(null);
  const { data = [], isLoading = true } = useClients() ?? {};
  const clients = Array.isArray(data) ? data : [];
  const deleteClient = useDeleteClient();
  const { toast } = useToast();

  const handleDeleteClick = (client: { id: string; name: string }) => {
    setClientToDelete(client);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!clientToDelete) return;
    
    try {
      await deleteClient.mutateAsync(clientToDelete.id);
      toast({
        title: "Client deleted",
        description: `${clientToDelete.name} has been removed.`,
      });
    } catch (error: any) {
      toast({
        title: "Failed to delete client",
        description: error.message || "An error occurred while deleting the client.",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setClientToDelete(null);
    }
  };

  const tableColumns: ColumnDef<any>[] = [
    {
      id: "name",
      header: "Name",
      accessorKey: "name",
      sortable: true,
      cell: (row) => <span className="font-medium">{row.name}</span>,
    },
    {
      id: "email",
      header: "Email",
      accessorKey: "email",
      sortable: true,
      cell: (row) =>
        row.email ? (
          <a
            href={`mailto:${row.email}`}
            className="text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {row.email}
          </a>
        ) : (
          "—"
        ),
    },
    {
      id: "phone",
      header: "Phone",
      accessorKey: "phone",
      sortable: true,
      hideOnMobile: true,
      cell: (row) =>
        row.phone ? (
          <a
            href={`tel:${row.phone}`}
            className="text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {row.phone}
          </a>
        ) : (
          "—"
        ),
    },
    {
      id: "address",
      header: "Address",
      accessorKey: "address",
      hideOnMobile: true,
      cell: (row) => (
        <span className="text-muted-foreground truncate max-w-[200px] block">
          {row.address || "—"}
        </span>
      ),
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
              data-testid={`button-client-table-actions-${row.id}`}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" style={{ borderRadius: "12px" }}>
            <DropdownMenuItem onClick={() => onViewClient?.(row.id)}>
              <Users className="h-4 w-4 mr-2" />
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onCreateJobForClient?.(row.id)}>
              <Briefcase className="h-4 w-4 mr-2" />
              Create Job
            </DropdownMenuItem>
            {row.phone && (
              <DropdownMenuItem onClick={() => onCallClient?.(row.phone)}>
                <Phone className="h-4 w-4 mr-2" />
                Call
              </DropdownMenuItem>
            )}
            {row.phone && (
              <DropdownMenuItem onClick={() => onSmsClient?.(row.id, row.phone)}>
                <MessageCircle className="h-4 w-4 mr-2" />
                SMS
              </DropdownMenuItem>
            )}
            {row.email && (
              <DropdownMenuItem onClick={() => onEmailClient?.(row.email)}>
                <Mail className="h-4 w-4 mr-2" />
                Email
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => handleDeleteClick({ id: row.id, name: row.name })}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    const filterParam = params.get('filter');
    if (filterParam && ['all', 'with_email', 'with_phone', 'with_address'].includes(filterParam)) {
      setActiveFilter(filterParam);
    }
  }, [searchParams]);

  const filteredClients = clients.filter((client: any) => {
    const name = client.name ? client.name.toLowerCase() : '';
    const email = client.email ? client.email.toLowerCase() : '';
    const phone = client.phone || '';
    const address = client.address ? client.address.toLowerCase() : '';
    const search = searchTerm.toLowerCase();
    
    const matchesSearch = name.includes(search) ||
           email.includes(search) ||
           phone.includes(search) ||
           address.includes(search);
    
    const matchesFilter = activeFilter === 'all' ||
      (activeFilter === 'with_email' && client.email) ||
      (activeFilter === 'with_phone' && client.phone) ||
      (activeFilter === 'with_address' && client.address);
    
    return matchesSearch && matchesFilter;
  });

  const stats = {
    total: clients.length,
    withEmail: clients.filter((c: any) => c.email).length,
    withPhone: clients.filter((c: any) => c.phone).length,
    withAddress: clients.filter((c: any) => c.address).length,
  };

  return (
    <PageShell data-testid="clients-list">
      {/* Header */}
      <PageHeader
        title="Clients"
        subtitle={`${clients.length} total`}
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
                data-testid="button-clients-view-cards"
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
                data-testid="button-clients-view-table"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
            <Button 
              onClick={onCreateClient} 
              data-testid="button-create-client"
              className="text-white font-medium"
              style={{ backgroundColor: 'hsl(var(--trade))', borderRadius: '12px' }}
            >
              <Plus className="h-4 w-4 mr-2" />
              New Client
            </Button>
          </div>
        }
      />

      {/* Search */}
      <SearchBar
        value={searchTerm}
        onChange={setSearchTerm}
        placeholder="Search clients by name, email, phone, or address..."
      />

      {/* Filter Chips */}
      <FilterChips 
        chips={[
          { id: 'all', label: 'All', count: stats.total, icon: <Users className="h-3 w-3" /> },
          { id: 'with_email', label: 'With Email', count: stats.withEmail, icon: <Mail className="h-3 w-3" /> },
          { id: 'with_phone', label: 'With Phone', count: stats.withPhone, icon: <Phone className="h-3 w-3" /> },
          { id: 'with_address', label: 'With Address', count: stats.withAddress, icon: <MapPin className="h-3 w-3" /> }
        ]}
        activeId={activeFilter}
        onSelect={setActiveFilter}
      />

      {/* KPI Stats - 4 across on desktop, 2x2 on mobile - clickable to filter */}
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
              icon={Users}
              title="Total Clients"
              value={stats.total.toString()}
              onClick={() => setActiveFilter('all')}
            />
            <KPIBox
              icon={Mail}
              title="With Email"
              value={stats.withEmail.toString()}
              onClick={() => setActiveFilter('with_email')}
            />
            <KPIBox
              icon={Phone}
              title="With Phone"
              value={stats.withPhone.toString()}
              onClick={() => setActiveFilter('with_phone')}
            />
            <KPIBox
              icon={MapPin}
              title="With Address"
              value={stats.withAddress.toString()}
              onClick={() => setActiveFilter('with_address')}
            />
          </>
        )}
      </div>

      {/* Recent Clients */}
      <Card>
          <CardHeader className="px-4 pt-4 pb-3">
            <CardTitle className="text-base font-semibold">Recent Clients</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {isLoading ? (
              <div className="text-center py-4 text-muted-foreground">
                <div className="animate-pulse text-xs">Loading...</div>
              </div>
            ) : clients.length > 0 ? (
              <div className="max-h-[200px] overflow-y-auto">
                <div className="space-y-2 pr-2">
                  {clients.slice(0, 5).map((client: any) => (
                    <div 
                      key={client.id}
                      className="flex items-start gap-2 text-xs hover-elevate p-2 rounded cursor-pointer"
                      onClick={() => onViewClient?.(client.id)}
                    >
                      <div 
                        className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                        style={{ backgroundColor: 'hsl(var(--trade))' }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{client.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {client.phone || client.email || 'No contact info'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-20" />
                <p className="text-xs">No clients yet</p>
              </div>
            )}
          </CardContent>
        </Card>

      {/* Clients List - Table or Card View */}
      {isLoading ? (
        <div className="space-y-3" data-testid="clients-loading">
          {[1, 2, 3].map((i) => (
            <Card key={i} style={{ borderRadius: '14px' }}>
              <CardContent className="p-4 animate-pulse">
                <div className="space-y-3">
                  <div className="h-5 w-48 bg-muted rounded" />
                  <div className="h-4 w-32 bg-muted rounded" />
                  <div className="flex gap-4">
                    <div className="h-3 w-24 bg-muted rounded" />
                    <div className="h-3 w-24 bg-muted rounded" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredClients.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No clients found"
          description={
            searchTerm 
              ? "Try adjusting your search terms"
              : "Save client details once, use them everywhere. Makes quoting and invoicing a breeze."
          }
          action={
            !searchTerm && (
              <Button 
                onClick={onCreateClient}
                style={{ borderRadius: '12px' }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Client
              </Button>
            )
          }
          tip={!searchTerm ? "Client details auto-fill into quotes and invoices" : undefined}
          encouragement={!searchTerm ? "Start with your most frequent customer" : undefined}
        />
      ) : viewMode === "table" ? (
        <DataTable
          data={filteredClients}
          columns={tableColumns}
          onRowClick={(row) => onViewClient?.(row.id)}
          isLoading={isLoading}
          pageSize={15}
          showViewToggle={false}
          getRowId={(row) => row.id}
        />
      ) : (
        <div className="space-y-3" data-testid="clients-list-card">
          {filteredClients.map((client: any) => (
            <ClientCard
              key={client.id}
              {...client}
              onView={() => onViewClient?.(client.id)}
              onCreateJob={() => onCreateJobForClient?.(client.id)}
              onCall={() => onCallClient?.(client.phone)}
              onEmail={() => onEmailClient?.(client.email)}
              onDelete={() => handleDeleteClick({ id: client.id, name: client.name })}
            />
          ))}
        </div>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent style={{ borderRadius: '14px' }}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Client</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{clientToDelete?.name}</strong>? This action cannot be undone. Any associated jobs, quotes, and invoices will remain but will no longer be linked to this client.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel style={{ borderRadius: '10px' }}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              style={{ borderRadius: '10px' }}
              disabled={deleteClient.isPending}
            >
              {deleteClient.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}