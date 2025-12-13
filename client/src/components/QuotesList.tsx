import { useState, useEffect } from "react";
import { useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { FileText, Clock, TrendingUp, Send, CheckCircle, XCircle, LayoutGrid, List, MoreVertical, DollarSign, Archive, RotateCcw } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import QuoteCard from "./QuoteCard";
import { useQuotes, useConvertQuoteToInvoice, useSendQuote, useRecentQuotes, useUnarchiveQuote } from "@/hooks/use-quotes";
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
import { parseTradieFriendlyError, formatToastDescription } from "@/lib/errorUtils";
import { SendConfirmationDialog } from "./SendConfirmationDialog";


interface QuotesListProps {
  onCreateQuote?: () => void;
  onViewQuote?: (id: string) => void;
  onSendQuote?: (id: string) => void;
  onConvertToInvoice?: (id: string) => void;
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

export default function QuotesList({
  onCreateQuote,
  onViewQuote,
  onSendQuote,
  onConvertToInvoice
}: QuotesListProps) {
  const searchParams = useSearch();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [showOlderQuotes, setShowOlderQuotes] = useState(false);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<any>(null);
  const showArchived = activeFilter === 'archived';
  const { data = [], isLoading = true } = useQuotes({ archived: showArchived }) ?? {};
  const quotes = Array.isArray(data) ? data : [];
  const { data: businessSettings } = useBusinessSettings();
  const { toast } = useToast();
  const unarchiveQuoteMutation = useUnarchiveQuote();

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    const filterParam = params.get('filter');
    if (filterParam && ['all', 'draft', 'sent', 'accepted', 'rejected'].includes(filterParam)) {
      setActiveFilter(filterParam);
    }
  }, [searchParams]);
  const convertToInvoiceMutation = useConvertQuoteToInvoice();
  const sendQuoteMutation = useSendQuote();
  
  // Recent data for activity section
  const { recent: recentQuotes = [], older: olderQuotes = [], isLoading: quotesLoading } = useRecentQuotes() ?? {};

  // Open confirmation dialog instead of sending directly
  const handleSendQuote = (id: string) => {
    const quote = quotes.find((q: any) => q.id === id);
    if (quote) {
      setSelectedQuote(quote);
      setSendDialogOpen(true);
    }
  };

  // Called when user confirms send in dialog
  const handleConfirmSend = async () => {
    if (!selectedQuote) return;
    
    try {
      await sendQuoteMutation.mutateAsync(selectedQuote.id);
      toast({
        title: "Quote marked as sent",
        description: `${selectedQuote.number} for ${selectedQuote.clientName} is now ready for your client`,
      });
      if (onSendQuote) onSendQuote(selectedQuote.id);
    } catch (error: any) {
      const parsedError = parseTradieFriendlyError(error);
      toast({
        title: parsedError.title,
        description: formatToastDescription(parsedError),
        variant: "destructive",
      });
    }
  };

  const handleConvertToInvoice = async (id: string) => {
    const quote = quotes.find((q: any) => q.id === id);
    try {
      const result = await convertToInvoiceMutation.mutateAsync(id);
      const invoiceNumber = result?.number || 'New Invoice';
      const amount = result?.total ? new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(normalizeToDollars(result.total)) : '';
      toast({
        title: "Invoice created",
        description: `${quote?.number || 'Quote'} → ${invoiceNumber}${amount ? ` for ${amount}` : ''} - Ready to send to ${quote?.clientName || 'client'}`,
      });
      if (onConvertToInvoice) onConvertToInvoice(id);
    } catch (error: any) {
      const parsedError = parseTradieFriendlyError(error);
      toast({
        title: parsedError.title,
        description: formatToastDescription(parsedError),
        variant: "destructive",
      });
    }
  };

  const handleRestoreQuote = async (id: string) => {
    const quote = quotes.find((q: any) => q.id === id);
    try {
      await unarchiveQuoteMutation.mutateAsync(id);
      toast({
        title: "Quote Restored",
        description: `${quote?.number || 'Quote'} has been restored`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to restore quote",
        variant: "destructive",
      });
    }
  };

  const stats = {
    total: quotes.length,
    draft: quotes.filter((q: any) => q.status && q.status === 'draft').length,
    sent: quotes.filter((q: any) => q.status && q.status === 'sent').length,
    accepted: quotes.filter((q: any) => q.status && q.status === 'accepted').length,
    rejected: quotes.filter((q: any) => q.status && q.status === 'rejected').length,
    archived: showArchived ? quotes.length : undefined
  };

  const filteredQuotes = quotes.filter((quote: any) => {
    const number = quote.number ? quote.number.toLowerCase() : '';
    const title = quote.title ? quote.title.toLowerCase() : '';
    const description = quote.description ? quote.description.toLowerCase() : '';
    const clientName = quote.clientName ? quote.clientName.toLowerCase() : '';
    const search = searchTerm.toLowerCase();
    
    const matchesSearch = number.includes(search) ||
                         title.includes(search) ||
                         description.includes(search) ||
                         clientName.includes(search);
    
    const matchesFilter = activeFilter === 'all' || activeFilter === 'archived' || quote.status === activeFilter;
    
    return matchesSearch && matchesFilter;
  });

  const filterChips = [
    { id: 'all', label: 'All', count: stats.total, icon: <FileText className="h-3 w-3" /> },
    { id: 'draft', label: 'Draft', count: stats.draft, icon: <Clock className="h-3 w-3" /> },
    { id: 'sent', label: 'Sent', count: stats.sent, icon: <Send className="h-3 w-3" /> },
    { id: 'accepted', label: 'Accepted', count: stats.accepted, icon: <CheckCircle className="h-3 w-3" /> },
    { id: 'rejected', label: 'Rejected', count: stats.rejected, icon: <XCircle className="h-3 w-3" /> },
    { id: 'archived', label: 'Archived', count: stats.archived, icon: <Archive className="h-3 w-3" /> }
  ];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(amount);
  };

  const tableColumns: ColumnDef<any>[] = [
    {
      id: "number",
      header: "Quote #",
      accessorKey: "number",
      sortable: true,
      cell: (row) => <span className="font-medium">{row.number || "—"}</span>,
    },
    {
      id: "title",
      header: "Title",
      accessorKey: "title",
      sortable: true,
      cell: (row) => row.title || "Untitled Quote",
    },
    {
      id: "client",
      header: "Client",
      accessorKey: "clientName",
      sortable: true,
      cell: (row) => row.clientName || "—",
    },
    {
      id: "total",
      header: "Amount",
      accessorKey: "total",
      sortable: true,
      cell: (row) => (
        <span className="font-medium">{formatCurrency(normalizeToDollars(row.total))}</span>
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
      id: "validUntil",
      header: "Valid Until",
      accessorKey: "validUntil",
      sortable: true,
      hideOnMobile: true,
      cell: (row) =>
        row.validUntil
          ? new Date(row.validUntil).toLocaleDateString("en-AU")
          : "—",
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
              data-testid={`button-quote-table-actions-${row.id}`}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" style={{ borderRadius: "12px" }}>
            <DropdownMenuItem onClick={() => onViewQuote?.(row.id)}>
              <FileText className="h-4 w-4 mr-2" />
              View Details
            </DropdownMenuItem>
            {row.status === "draft" && (
              <DropdownMenuItem onClick={() => handleSendQuote(row.id)}>
                <Send className="h-4 w-4 mr-2" />
                Send Quote
              </DropdownMenuItem>
            )}
            {row.status === "accepted" && !showArchived && (
              <DropdownMenuItem onClick={() => handleConvertToInvoice(row.id)}>
                <DollarSign className="h-4 w-4 mr-2" />
                Convert to Invoice
              </DropdownMenuItem>
            )}
            {showArchived && (
              <DropdownMenuItem onClick={() => handleRestoreQuote(row.id)}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Restore Quote
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <PageShell data-testid="quotes-list">
      <PageHeader
        title="Quotes"
        subtitle="Manage your quotes and proposals"
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
                data-testid="button-quotes-view-cards"
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
                data-testid="button-quotes-view-table"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
            <Button 
              onClick={onCreateQuote} 
              data-testid="button-create-quote"
              className="text-white"
              style={{ backgroundColor: 'hsl(var(--trade))' }}
            >
              <FileText className="h-4 w-4 mr-2" />
              New Quote
            </Button>
          </div>
        }
      />

      {/* Search */}
      <SearchBar
        value={searchTerm}
        onChange={setSearchTerm}
        placeholder="Search quotes by number, client, or job..."
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
              title="Total Quotes"
              value={stats.total}
              icon={FileText}
              onClick={() => setActiveFilter('all')}
            />
            <KPIBox
              title="Draft"
              value={stats.draft}
              icon={Clock}
              onClick={() => setActiveFilter('draft')}
            />
            <KPIBox
              title="Sent"
              value={stats.sent}
              icon={Send}
              onClick={() => setActiveFilter('sent')}
            />
            <KPIBox
              title="Accepted"
              value={stats.accepted}
              icon={CheckCircle}
              onClick={() => setActiveFilter('accepted')}
            />
          </>
        )}
      </div>

      {/* Recent Quotes */}
      <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Recent Quotes
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-[400px] overflow-y-auto">
          {quotesLoading ? (
            <div className="text-center py-4 text-muted-foreground">
              <div className="animate-pulse text-xs">Loading...</div>
            </div>
          ) : recentQuotes.length > 0 ? (
            <div className="space-y-1 pr-2">
              {recentQuotes.slice(0, 5).map((quote: any) => (
                <div 
                  key={quote.id}
                  className="flex items-start gap-2 p-2 rounded-lg hover-elevate cursor-pointer"
                  onClick={() => onViewQuote?.(quote.id)}
                >
                  <div 
                    className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                    style={{ backgroundColor: 'hsl(var(--trade))' }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-xs truncate">{quote.title || 'Untitled'}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {quote.clientName || 'Unknown'}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[10px] font-medium">
                      {formatCurrency(normalizeToDollars(quote.total))}
                    </p>
                    <Badge variant="secondary" className="text-[10px] h-4 px-1">
                      {quote.status || 'draft'}
                    </Badge>
                  </div>
                </div>
              ))}
              
              {/* Older Quotes - Expandable */}
              {showOlderQuotes && olderQuotes.length > 0 && (
                <div className="pt-2 mt-2 border-t space-y-1">
                  <p className="text-[10px] text-muted-foreground px-2 mb-1">Older</p>
                  {olderQuotes.slice(0, 6).map((quote: any) => (
                    <div 
                      key={quote.id}
                      className="flex items-start gap-2 p-2 rounded-lg hover-elevate cursor-pointer opacity-75"
                      onClick={() => onViewQuote?.(quote.id)}
                    >
                      <div 
                        className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 opacity-60"
                        style={{ backgroundColor: 'hsl(var(--trade))' }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-xs truncate">{quote.title || 'Untitled'}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {formatHistoryDate(quote.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Toggle Button */}
              {olderQuotes.length > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full mt-2 text-xs h-7" 
                  onClick={() => setShowOlderQuotes(!showOlderQuotes)}
                  data-testid="button-toggle-older-quotes"
                >
                  {showOlderQuotes ? 'Show Less' : `View Older (${olderQuotes.length})`}
                </Button>
              )}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-20" />
              <p className="text-xs">No recent quotes</p>
            </div>
          )}
          </CardContent>
        </Card>

      {/* Quotes List - Table or Card View */}
      {isLoading ? (
        <div className="space-y-3" data-testid="quotes-loading">
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
      ) : filteredQuotes.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No quotes found"
          description={
            searchTerm || activeFilter !== 'all'
              ? "Try adjusting your filters or search terms"
              : "Send professional quotes that clients can accept and pay online. GST calculated automatically."
          }
          action={
            (!searchTerm && activeFilter === 'all') && (
              <Button 
                onClick={onCreateQuote}
                variant="default"
              >
                <FileText className="h-4 w-4 mr-2" />
                Create Your First Quote
              </Button>
            )
          }
          tip={(!searchTerm && activeFilter === 'all') ? "Accepted quotes can be converted to invoices with one tap" : undefined}
          encouragement={(!searchTerm && activeFilter === 'all') ? "Professional quotes help you win more work" : undefined}
        />
      ) : viewMode === "table" ? (
        <DataTable
          data={filteredQuotes}
          columns={tableColumns}
          onRowClick={(row) => onViewQuote?.(row.id)}
          isLoading={isLoading}
          pageSize={15}
          showViewToggle={false}
          getRowId={(row) => row.id}
        />
      ) : (
        <div className="space-y-3" data-testid="quotes-list-cards">
          {filteredQuotes.map((quote: any) => (
            <QuoteCard
              key={quote.id}
              id={quote.id}
              number={quote.number}
              client={quote.clientName || 'Unknown Client'}
              jobTitle={quote.title}
              total={normalizeToDollars(quote.total)}
              status={quote.status}
              validUntil={quote.validUntil ? new Date(quote.validUntil).toLocaleDateString() : ''}
              sentAt={quote.sentAt ? new Date(quote.sentAt).toLocaleDateString() : undefined}
              onViewClick={onViewQuote}
              onSendClick={handleSendQuote}
              onConvertToInvoice={handleConvertToInvoice}
            />
          ))}
        </div>
      )}

      {/* Send Confirmation Dialog */}
      {selectedQuote && (
        <SendConfirmationDialog
          open={sendDialogOpen}
          onOpenChange={setSendDialogOpen}
          type="quote"
          documentId={selectedQuote.id}
          documentNumber={selectedQuote.number || 'Quote'}
          clientName={selectedQuote.clientName || 'Unknown Client'}
          clientEmail={selectedQuote.clientEmail || ''}
          amount={normalizeToDollars(selectedQuote.total)}
          publicUrl={selectedQuote.acceptanceToken 
            ? `${window.location.origin}/q/${selectedQuote.acceptanceToken}` 
            : `${window.location.origin}/quotes/${selectedQuote.id}`
          }
          businessName={businessSettings?.businessName}
          onConfirmSend={handleConfirmSend}
          isPending={sendQuoteMutation.isPending}
        />
      )}
    </PageShell>
  );
}