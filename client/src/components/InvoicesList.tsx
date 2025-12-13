import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Receipt, DollarSign, Clock, Send, CheckCircle, AlertCircle, FileText, LayoutGrid, List, MoreVertical, Archive, RotateCcw } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import InvoiceCard from "./InvoiceCard";
import { useInvoices, useRecentInvoices, useSendInvoice, useMarkInvoicePaid, useCreatePaymentLink, useUnarchiveInvoice } from "@/hooks/use-invoices";
import { useClients } from "@/hooks/use-clients";
import { useBusinessSettings } from "@/hooks/use-business-settings";
import { useToast } from "@/hooks/use-toast";
import { formatHistoryDate, getStatusColor } from "@shared/dateUtils";
import { PageShell } from "@/components/ui/page-shell";
import { PageHeader } from "@/components/ui/page-shell";
import { SearchBar, FilterChips } from "@/components/ui/filter-chips";
import { EmptyState } from "@/components/ui/compact-card";
import { DataTable, ColumnDef, StatusBadge } from "@/components/ui/data-table";
import KPIBox from "./KPIBox";
import { cn } from "@/lib/utils";
import { SendConfirmationDialog } from "./SendConfirmationDialog";
import { ConfirmationDialog } from "./ConfirmationDialog";
import { parseTradieFriendlyError, formatToastDescription } from "@/lib/errorUtils";

interface InvoicesListProps {
  onCreateInvoice?: () => void;
  onViewInvoice?: (id: string) => void;
  onSendInvoice?: (id: string) => void;
  onCreatePaymentLink?: (id: string) => void;
  onMarkPaid?: (id: string) => void;
}

// Helper: Normalize total to dollars (works for both string decimals and numeric cents)
const normalizeToDollars = (total: string | number | null | undefined): number => {
  if (!total) return 0;
  
  if (typeof total === 'string') {
    // Decimal string like '85.00' → parse as dollars
    return parseFloat(total) || 0;
  } else if (typeof total === 'number') {
    // Assume numbers are in cents (e.g., 8500 → 85.00)
    return total / 100;
  }
  
  return 0;
};

export default function InvoicesList({
  onCreateInvoice,
  onViewInvoice,
  onSendInvoice,
  onCreatePaymentLink,
  onMarkPaid
}: InvoicesListProps) {
  const searchParams = useSearch();
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [showOlderInvoices, setShowOlderInvoices] = useState(false);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [markPaidDialogOpen, setMarkPaidDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const { toast } = useToast();
  const sendInvoiceMutation = useSendInvoice();
  const markPaidMutation = useMarkInvoicePaid();
  const createPaymentLinkMutation = useCreatePaymentLink();

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    const filterParam = params.get('filter');
    if (filterParam && ['all', 'draft', 'sent', 'paid', 'overdue'].includes(filterParam)) {
      setActiveFilter(filterParam);
    }
  }, [searchParams]);
  
  const showArchived = activeFilter === 'archived';
  const { data: invoicesData = [], isLoading = true } = useInvoices({ archived: showArchived }) ?? {};
  const { data: clientsData = [] } = useClients() ?? {};
  const { data: businessSettings } = useBusinessSettings();
  const invoices = Array.isArray(invoicesData) ? invoicesData : [];
  const clients = Array.isArray(clientsData) ? clientsData : [];
  const unarchiveInvoiceMutation = useUnarchiveInvoice();

  // Open confirmation dialog instead of sending directly
  const handleSendInvoice = (id: string) => {
    const invoice = invoices.find((inv: any) => inv.id === id);
    if (invoice) {
      setSelectedInvoice(invoice);
      setSendDialogOpen(true);
    }
  };

  // Called when user confirms send in dialog
  const handleConfirmSend = async () => {
    if (!selectedInvoice) return;
    
    try {
      await sendInvoiceMutation.mutateAsync(selectedInvoice.id);
      toast({
        title: "Invoice marked as sent",
        description: `${selectedInvoice.number} for ${selectedInvoice.clientName} is ready for payment`,
      });
      if (onSendInvoice) onSendInvoice(selectedInvoice.id);
    } catch (error: any) {
      const parsedError = parseTradieFriendlyError(error);
      toast({
        title: parsedError.title,
        description: formatToastDescription(parsedError),
        variant: "destructive",
      });
    }
  };

  // Open mark paid confirmation dialog
  const handleMarkPaid = (id: string) => {
    const invoice = invoices.find((inv: any) => inv.id === id);
    if (invoice) {
      setSelectedInvoice(invoice);
      setMarkPaidDialogOpen(true);
    }
  };

  // Called when user confirms mark as paid
  const handleConfirmMarkPaid = async () => {
    if (!selectedInvoice) return;
    
    try {
      await markPaidMutation.mutateAsync(selectedInvoice.id);
      const amount = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(normalizeToDollars(selectedInvoice.total));
      toast({
        title: "Payment recorded",
        description: `${selectedInvoice.number} - ${amount} from ${selectedInvoice.clientName || selectedInvoice.client} marked as paid`,
      });
      if (onMarkPaid) onMarkPaid(selectedInvoice.id);
    } catch (error: any) {
      const parsedError = parseTradieFriendlyError(error);
      toast({
        title: parsedError.title,
        description: formatToastDescription(parsedError),
        variant: "destructive",
      });
    }
  };

  // Restore archived invoice
  const handleRestoreInvoice = async (id: string) => {
    const invoice = invoices.find((inv: any) => inv.id === id);
    try {
      await unarchiveInvoiceMutation.mutateAsync(id);
      toast({
        title: "Invoice Restored",
        description: `${invoice?.number || 'Invoice'} has been restored`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to restore invoice",
        variant: "destructive",
      });
    }
  };

  // Create payment link with feedback
  const handleCreatePaymentLink = async (id: string) => {
    const invoice = invoices.find((inv: any) => inv.id === id);
    if (!invoice) return;
    
    try {
      const result = await createPaymentLinkMutation.mutateAsync(id);
      const amount = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(normalizeToDollars(invoice.total));
      
      if (result?.url) {
        await navigator.clipboard.writeText(result.url);
        toast({
          title: "Payment link created",
          description: `${invoice.number} - ${amount} link copied to clipboard. Share with ${invoice.clientName || invoice.client}`,
        });
      } else {
        toast({
          title: "Payment link ready",
          description: `${invoice.number} - ${amount} payment link is ready`,
        });
      }
      if (onCreatePaymentLink) onCreatePaymentLink(id);
    } catch (error: any) {
      const parsedError = parseTradieFriendlyError(error);
      toast({
        title: parsedError.title,
        description: formatToastDescription(parsedError),
        variant: "destructive",
      });
    }
  };
  
  // Recent data for activity section
  const { recent: recentInvoices = [], older: olderInvoices = [], isLoading: invoicesLoading } = useRecentInvoices() ?? {};

  // Transform invoice data with client info
  const transformedInvoices = invoices.map((invoice: any) => {
    const client = clients.find((c: any) => c.id === invoice.clientId);
    
    return {
      id: invoice.id,
      number: invoice.number,
      client: client?.name || 'Unknown Client',
      jobTitle: invoice.title,
      total: normalizeToDollars(invoice.total),
      status: invoice.status,
      sentAt: invoice.sentAt ? new Date(invoice.sentAt).toLocaleDateString() : undefined,
      paidAt: invoice.paidAt ? new Date(invoice.paidAt).toLocaleDateString() : undefined,
      dueDate: invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : undefined
    };
  });

  // Filter invoices
  const filteredInvoices = transformedInvoices.filter((invoice: any) => {
    const number = invoice.number ? invoice.number.toLowerCase() : '';
    const client = invoice.client ? invoice.client.toLowerCase() : '';
    const jobTitle = invoice.jobTitle ? invoice.jobTitle.toLowerCase() : '';
    const search = searchTerm.toLowerCase();
    
    const matchesSearch = number.includes(search) ||
                         client.includes(search) ||
                         jobTitle.includes(search);
    
    const matchesFilter = activeFilter === 'all' || activeFilter === 'archived' || invoice.status === activeFilter;
    
    return matchesSearch && matchesFilter;
  });

  // Calculate stats with null-safe filtering
  const stats = {
    total: transformedInvoices.length,
    draft: transformedInvoices.filter((i: any) => i.status && i.status === 'draft').length,
    sent: transformedInvoices.filter((i: any) => i.status && i.status === 'sent').length,
    paid: transformedInvoices.filter((i: any) => i.status && i.status === 'paid').length,
    overdue: transformedInvoices.filter((i: any) => i.status && i.status === 'overdue').length,
    archived: showArchived ? transformedInvoices.length : undefined
  };

  // Calculate totals in dollars (parsed from decimal strings)
  const totalValues = {
    all: transformedInvoices.reduce((sum: number, i: any) => sum + i.total, 0),
    unpaid: transformedInvoices.filter((i: any) => i.status && i.status !== 'paid').reduce((sum: number, i: any) => sum + i.total, 0),
    paid: transformedInvoices.filter((i: any) => i.status && i.status === 'paid').reduce((sum: number, i: any) => sum + i.total, 0),
    overdue: transformedInvoices.filter((i: any) => i.status && i.status === 'overdue').reduce((sum: number, i: any) => sum + i.total, 0)
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(amount);
  };

  const filterChips = [
    { id: 'all', label: 'All', count: stats.total, icon: <Receipt className="h-3 w-3" /> },
    { id: 'draft', label: 'Draft', count: stats.draft, icon: <FileText className="h-3 w-3" /> },
    { id: 'sent', label: 'Sent', count: stats.sent, icon: <Send className="h-3 w-3" /> },
    { id: 'paid', label: 'Paid', count: stats.paid, icon: <CheckCircle className="h-3 w-3" /> },
    { id: 'overdue', label: 'Overdue', count: stats.overdue, icon: <AlertCircle className="h-3 w-3" /> },
    { id: 'archived', label: 'Archived', count: stats.archived, icon: <Archive className="h-3 w-3" /> }
  ];

  const tableColumns: ColumnDef<any>[] = [
    {
      id: "number",
      header: "Invoice #",
      accessorKey: "number",
      sortable: true,
      cell: (row) => <span className="font-medium">{row.number || "—"}</span>,
    },
    {
      id: "client",
      header: "Client",
      accessorKey: "client",
      sortable: true,
    },
    {
      id: "jobTitle",
      header: "Description",
      accessorKey: "jobTitle",
      hideOnMobile: true,
      cell: (row) => (
        <span className="text-muted-foreground truncate max-w-[200px] block">
          {row.jobTitle || "—"}
        </span>
      ),
    },
    {
      id: "total",
      header: "Amount",
      accessorKey: "total",
      sortable: true,
      cell: (row) => (
        <span className="font-medium">{formatCurrency(row.total)}</span>
      ),
    },
    {
      id: "status",
      header: "Status",
      accessorKey: "status",
      sortable: true,
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      id: "dueDate",
      header: "Due Date",
      accessorKey: "dueDate",
      sortable: true,
      hideOnMobile: true,
      cell: (row) => row.dueDate || "—",
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
              data-testid={`button-invoice-table-actions-${row.id}`}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" style={{ borderRadius: "12px" }}>
            <DropdownMenuItem onClick={() => onViewInvoice?.(row.id)}>
              <FileText className="h-4 w-4 mr-2" />
              View Details
            </DropdownMenuItem>
            {row.status === "draft" && (
              <DropdownMenuItem onClick={() => handleSendInvoice(row.id)}>
                <Send className="h-4 w-4 mr-2" />
                Send Invoice
              </DropdownMenuItem>
            )}
            {row.status !== "paid" && !showArchived && (
              <>
                <DropdownMenuItem onClick={() => handleCreatePaymentLink(row.id)}>
                  <DollarSign className="h-4 w-4 mr-2" />
                  Create Payment Link
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleMarkPaid(row.id)}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Mark as Paid
                </DropdownMenuItem>
              </>
            )}
            {showArchived && (
              <DropdownMenuItem onClick={() => handleRestoreInvoice(row.id)}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Restore Invoice
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <PageShell data-testid="invoices-list">
      <PageHeader
        title="Invoices"
        subtitle={`${invoices.length} total`}
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
                data-testid="button-invoices-view-cards"
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
                data-testid="button-invoices-view-table"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
            <Button 
              onClick={onCreateInvoice} 
              data-testid="button-create-invoice"
              className="text-white font-medium"
              style={{ backgroundColor: 'hsl(var(--trade))', borderRadius: '12px' }}
            >
              <Receipt className="h-4 w-4 mr-2" />
              New Invoice
            </Button>
          </div>
        }
      />

      {/* Search */}
      <SearchBar
        value={searchTerm}
        onChange={setSearchTerm}
        placeholder="Search invoices by number, client, or job..."
      />

      {/* Filter Chips */}
      <FilterChips 
        chips={filterChips}
        activeId={activeFilter}
        onSelect={setActiveFilter}
      />

      {/* KPI Stats - 4 across on desktop, 2x2 on mobile - clickable to filter */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {isLoading ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-muted/10 rounded-lg animate-pulse" />
            ))}
          </>
        ) : (
          <>
            <KPIBox
              title="Total Value"
              value={formatCurrency(totalValues.all)}
              icon={DollarSign}
              onClick={() => setActiveFilter('all')}
            />
            <KPIBox
              title="Unpaid"
              value={formatCurrency(totalValues.unpaid)}
              icon={AlertCircle}
              onClick={() => setActiveFilter('sent')}
            />
            <KPIBox
              title="Paid"
              value={formatCurrency(totalValues.paid)}
              icon={CheckCircle}
              onClick={() => setActiveFilter('paid')}
            />
            <KPIBox
              title="Overdue"
              value={formatCurrency(totalValues.overdue)}
              icon={Clock}
              onClick={() => setActiveFilter('overdue')}
            />
          </>
        )}
      </div>

      {/* Recent Invoices */}
      <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Recent Invoices
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-[400px] overflow-y-auto">
          {invoicesLoading ? (
            <div className="text-center py-4 text-muted-foreground">
              <div className="animate-pulse text-xs">Loading...</div>
            </div>
          ) : recentInvoices.length > 0 ? (
            <div className="space-y-1 pr-2">
              {recentInvoices.slice(0, 5).map((invoice: any) => (
                <div 
                  key={invoice.id}
                  className="flex items-start gap-2 p-2 rounded-lg hover-elevate cursor-pointer"
                  onClick={() => onViewInvoice?.(invoice.id)}
                >
                  <div 
                    className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                    style={{ backgroundColor: 'hsl(var(--trade))' }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-xs truncate">{invoice.title || 'Untitled'}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {invoice.clientName || 'Unknown'}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[10px] font-medium">
                      {formatCurrency(normalizeToDollars(invoice.total))}
                    </p>
                    <Badge variant="secondary" className="text-[10px] h-4 px-1">
                      {invoice.status || 'draft'}
                    </Badge>
                  </div>
                </div>
              ))}
              
              {/* Older Invoices - Expandable */}
              {showOlderInvoices && olderInvoices.length > 0 && (
                <div className="pt-2 mt-2 border-t space-y-1">
                  <p className="text-[10px] text-muted-foreground px-2 mb-1">Older</p>
                  {olderInvoices.slice(0, 6).map((invoice: any) => (
                    <div 
                      key={invoice.id}
                      className="flex items-start gap-2 p-2 rounded-lg hover-elevate cursor-pointer opacity-75"
                      onClick={() => onViewInvoice?.(invoice.id)}
                    >
                      <div 
                        className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                        style={{ backgroundColor: 'hsl(var(--trade))' }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-xs truncate">{invoice.title || 'Untitled'}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {formatHistoryDate(invoice.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Toggle Button */}
              {olderInvoices.length > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full mt-2 text-xs h-7" 
                  onClick={() => setShowOlderInvoices(!showOlderInvoices)}
                  data-testid="button-toggle-older-invoices"
                >
                  {showOlderInvoices ? 'Show Less' : `View Older (${olderInvoices.length})`}
                </Button>
              )}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <Receipt className="h-8 w-8 mx-auto mb-2 opacity-20" />
              <p className="text-xs">No recent invoices</p>
            </div>
          )}
          </CardContent>
        </Card>

      {/* Invoices List - Table or Card View */}
      {isLoading ? (
        <div className="space-y-3" data-testid="invoices-loading">
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
      ) : filteredInvoices.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No invoices found"
          description={
            searchTerm || activeFilter !== 'all'
              ? "Try adjusting your filters or search terms"
              : "Get paid faster with professional invoices. Clients can pay online and you get automatic reminders for overdue payments."
          }
          action={
            (!searchTerm && activeFilter === 'all') && (
              <Button 
                onClick={onCreateInvoice}
                style={{ borderRadius: '12px' }}
              >
                <Receipt className="h-4 w-4 mr-2" />
                Create Your First Invoice
              </Button>
            )
          }
          tip={(!searchTerm && activeFilter === 'all') ? "Convert quotes to invoices in one tap, or create invoices from scratch" : undefined}
          encouragement={(!searchTerm && activeFilter === 'all') ? "Online payments and automatic reminders help you get paid sooner" : undefined}
        />
      ) : viewMode === "table" ? (
        <DataTable
          data={filteredInvoices}
          columns={tableColumns}
          onRowClick={(row) => onViewInvoice?.(row.id)}
          isLoading={isLoading}
          pageSize={15}
          showViewToggle={false}
          getRowId={(row) => row.id}
        />
      ) : (
        <div className="space-y-3" data-testid="invoices-list-cards">
          {filteredInvoices.map((invoice: any) => (
            <InvoiceCard
              key={invoice.id}
              id={invoice.id}
              number={invoice.number}
              client={invoice.client}
              jobTitle={invoice.jobTitle}
              total={invoice.total}
              status={invoice.status}
              sentAt={invoice.sentAt}
              paidAt={invoice.paidAt}
              dueDate={invoice.dueDate}
              onViewClick={onViewInvoice}
              onSendClick={handleSendInvoice}
              onCreatePaymentLink={handleCreatePaymentLink}
              onMarkPaid={handleMarkPaid}
            />
          ))}
        </div>
      )}

      {/* Send Confirmation Dialog */}
      {selectedInvoice && (
        <SendConfirmationDialog
          open={sendDialogOpen}
          onOpenChange={setSendDialogOpen}
          type="invoice"
          documentId={selectedInvoice.id}
          documentNumber={selectedInvoice.number || 'Invoice'}
          clientName={selectedInvoice.clientName || selectedInvoice.client || 'Unknown Client'}
          clientEmail={selectedInvoice.clientEmail || ''}
          amount={normalizeToDollars(selectedInvoice.total)}
          publicUrl={selectedInvoice.paymentToken 
            ? `${window.location.origin}/pay/${selectedInvoice.paymentToken}` 
            : `${window.location.origin}/invoices/${selectedInvoice.id}`
          }
          businessName={businessSettings?.businessName}
          onConfirmSend={handleConfirmSend}
          isPending={sendInvoiceMutation.isPending}
        />
      )}

      {/* Mark Paid Confirmation Dialog */}
      {selectedInvoice && (
        <ConfirmationDialog
          open={markPaidDialogOpen}
          onOpenChange={setMarkPaidDialogOpen}
          title="Mark as Paid"
          description="Confirm you've received payment for this invoice. This will update the status to paid."
          details={[
            { label: "Invoice", value: selectedInvoice.number || 'Invoice' },
            { label: "Client", value: selectedInvoice.clientName || selectedInvoice.client || 'Unknown' },
            { label: "Amount", value: new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(normalizeToDollars(selectedInvoice.total)) },
          ]}
          confirmLabel="Confirm Payment Received"
          onConfirm={handleConfirmMarkPaid}
          isPending={markPaidMutation.isPending}
        />
      )}
    </PageShell>
  );
}