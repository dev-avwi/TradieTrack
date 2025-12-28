import { useState, useMemo } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  FileText, 
  Receipt, 
  CreditCard, 
  Search, 
  Plus, 
  Filter, 
  ChevronRight,
  Clock,
  CheckCircle,
  AlertCircle,
  Send,
  XCircle,
  DollarSign,
  MoreVertical,
  Eye,
  Mail,
  Download
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuotes, useSendQuote, useConvertQuoteToInvoice } from "@/hooks/use-quotes";
import { useInvoices, useSendInvoice, useMarkInvoicePaid, useCreatePaymentLink } from "@/hooks/use-invoices";
import { useBusinessSettings } from "@/hooks/use-business-settings";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { SendConfirmationDialog } from "@/components/SendConfirmationDialog";
import { ConfirmationDialog } from "@/components/ConfirmationDialog";

interface DocumentsHubProps {
  onNavigate?: (path: string) => void;
}

type DocumentTab = "quotes" | "invoices" | "receipts";

const normalizeToDollars = (total: string | number | null | undefined): number => {
  if (!total) return 0;
  if (typeof total === 'string') {
    return parseFloat(total) || 0;
  } else if (typeof total === 'number') {
    return total > 1000 ? total / 100 : total;
  }
  return 0;
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-AU', { 
    style: 'currency', 
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

const getQuoteStatusConfig = (status: string) => {
  switch (status) {
    case 'draft':
      return { label: 'Draft', variant: 'secondary' as const, icon: Clock };
    case 'sent':
      return { label: 'Sent', variant: 'default' as const, icon: Send };
    case 'accepted':
      return { label: 'Accepted', variant: 'default' as const, icon: CheckCircle, className: 'bg-green-500 hover:bg-green-600' };
    case 'rejected':
      return { label: 'Rejected', variant: 'destructive' as const, icon: XCircle };
    default:
      return { label: status, variant: 'secondary' as const, icon: Clock };
  }
};

const getInvoiceStatusConfig = (status: string) => {
  switch (status) {
    case 'draft':
      return { label: 'Draft', variant: 'secondary' as const, icon: Clock };
    case 'sent':
      return { label: 'Sent', variant: 'default' as const, icon: Send };
    case 'paid':
      return { label: 'Paid', variant: 'default' as const, icon: CheckCircle, className: 'bg-green-500 hover:bg-green-600' };
    case 'overdue':
      return { label: 'Overdue', variant: 'destructive' as const, icon: AlertCircle };
    default:
      return { label: status, variant: 'secondary' as const, icon: Clock };
  }
};

function QuoteCard({ quote, onView, onSend, onConvert }: { 
  quote: any; 
  onView: () => void;
  onSend: () => void;
  onConvert: () => void;
}) {
  const statusConfig = getQuoteStatusConfig(quote.status);
  const StatusIcon = statusConfig.icon;
  const amount = normalizeToDollars(quote.total);
  
  return (
    <Card 
      className="hover-elevate active-elevate-2 cursor-pointer transition-all"
      onClick={onView}
      data-testid={`quote-card-${quote.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-sm" data-testid={`quote-number-${quote.id}`}>
                {quote.number}
              </span>
              <Badge 
                variant={statusConfig.variant} 
                className={cn("text-xs", statusConfig.className)}
                data-testid={`quote-status-${quote.id}`}
              >
                <StatusIcon className="w-3 h-3 mr-1" />
                {statusConfig.label}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground truncate" data-testid={`quote-client-${quote.id}`}>
              {quote.clientName || 'No client'}
            </p>
            {quote.title && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {quote.title}
              </p>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <p className="font-bold text-lg" data-testid={`quote-amount-${quote.id}`}>
              {formatCurrency(amount)}
            </p>
            <p className="text-xs text-muted-foreground">
              {quote.createdAt ? formatDistanceToNow(new Date(quote.createdAt), { addSuffix: true }) : ''}
            </p>
          </div>
        </div>
        
        <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t">
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-11 w-11" data-testid={`quote-menu-${quote.id}`}>
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView(); }}>
                <Eye className="h-4 w-4 mr-2" />
                View Details
              </DropdownMenuItem>
              {quote.status === 'draft' && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onSend(); }}>
                  <Send className="h-4 w-4 mr-2" />
                  Mark as Sent
                </DropdownMenuItem>
              )}
              {quote.status === 'accepted' && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onConvert(); }}>
                  <Receipt className="h-4 w-4 mr-2" />
                  Convert to Invoice
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}

function InvoiceCard({ invoice, onView, onSend, onMarkPaid, onCreateLink }: { 
  invoice: any; 
  onView: () => void;
  onSend: () => void;
  onMarkPaid: () => void;
  onCreateLink: () => void;
}) {
  const statusConfig = getInvoiceStatusConfig(invoice.status);
  const StatusIcon = statusConfig.icon;
  const amount = normalizeToDollars(invoice.total);
  
  return (
    <Card 
      className="hover-elevate active-elevate-2 cursor-pointer transition-all"
      onClick={onView}
      data-testid={`invoice-card-${invoice.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-sm" data-testid={`invoice-number-${invoice.id}`}>
                {invoice.number}
              </span>
              <Badge 
                variant={statusConfig.variant} 
                className={cn("text-xs", statusConfig.className)}
                data-testid={`invoice-status-${invoice.id}`}
              >
                <StatusIcon className="w-3 h-3 mr-1" />
                {statusConfig.label}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground truncate" data-testid={`invoice-client-${invoice.id}`}>
              {invoice.clientName || invoice.client || 'No client'}
            </p>
            {invoice.dueDate && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Due: {new Date(invoice.dueDate).toLocaleDateString('en-AU')}
              </p>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <p className="font-bold text-lg" data-testid={`invoice-amount-${invoice.id}`}>
              {formatCurrency(amount)}
            </p>
            <p className="text-xs text-muted-foreground">
              {invoice.createdAt ? formatDistanceToNow(new Date(invoice.createdAt), { addSuffix: true }) : ''}
            </p>
          </div>
        </div>
        
        <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t">
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-11 w-11" data-testid={`invoice-menu-${invoice.id}`}>
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView(); }}>
                <Eye className="h-4 w-4 mr-2" />
                View Details
              </DropdownMenuItem>
              {invoice.status === 'draft' && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onSend(); }}>
                  <Send className="h-4 w-4 mr-2" />
                  Mark as Sent
                </DropdownMenuItem>
              )}
              {invoice.status === 'sent' && (
                <>
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onCreateLink(); }}>
                    <CreditCard className="h-4 w-4 mr-2" />
                    Create Payment Link
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onMarkPaid(); }}>
                    <DollarSign className="h-4 w-4 mr-2" />
                    Mark as Paid
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}

function ReceiptCard({ receipt, onView }: { receipt: any; onView: () => void }) {
  const amount = normalizeToDollars(receipt.amount);
  
  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'tap_to_pay': return 'Tap to Pay';
      case 'card': return 'Card';
      case 'stripe_connect': return 'Online Payment';
      case 'bank_transfer': return 'Bank Transfer';
      case 'cash': return 'Cash';
      default: return method || 'Payment';
    }
  };
  
  return (
    <Card 
      className="hover-elevate active-elevate-2 cursor-pointer transition-all"
      onClick={onView}
      data-testid={`receipt-card-${receipt.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-sm" data-testid={`receipt-number-${receipt.id}`}>
                {receipt.receiptNumber}
              </span>
              <Badge variant="default" className="text-xs bg-green-500 hover:bg-green-600">
                <CheckCircle className="w-3 h-3 mr-1" />
                Paid
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground truncate">
              {receipt.clientName || 'Payment received'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {getPaymentMethodLabel(receipt.paymentMethod)}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="font-bold text-lg text-green-600" data-testid={`receipt-amount-${receipt.id}`}>
              {formatCurrency(amount)}
            </p>
            <p className="text-xs text-muted-foreground">
              {receipt.paidAt ? formatDistanceToNow(new Date(receipt.paidAt), { addSuffix: true }) : ''}
            </p>
          </div>
        </div>
        
        <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t">
          <Button 
            variant="ghost" 
            className="h-11 px-4"
            onClick={(e) => { e.stopPropagation(); onView(); }}
            data-testid={`receipt-view-${receipt.id}`}
          >
            <Eye className="h-5 w-5 mr-2" />
            View Receipt
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DocumentSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="text-right">
            <Skeleton className="h-6 w-20 mb-1" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ type, onCreate }: { type: DocumentTab; onCreate: () => void }) {
  const config = {
    quotes: {
      icon: FileText,
      title: "No quotes yet",
      description: "Create your first quote to get started with winning more work",
      buttonText: "Create Quote"
    },
    invoices: {
      icon: Receipt,
      title: "No invoices yet",
      description: "Create an invoice to start getting paid for your work",
      buttonText: "Create Invoice"
    },
    receipts: {
      icon: CreditCard,
      title: "No receipts yet",
      description: "Receipts will appear here when payments are received",
      buttonText: "Collect Payment"
    }
  };
  
  const { icon: Icon, title, description, buttonText } = config[type];
  
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-xs">{description}</p>
      <Button onClick={onCreate} data-testid={`button-create-${type}`}>
        <Plus className="w-4 h-4 mr-2" />
        {buttonText}
      </Button>
    </div>
  );
}

export default function DocumentsHub({ onNavigate }: DocumentsHubProps) {
  const [, setLocation] = useLocation();
  const searchParams = useSearch();
  const navigate = onNavigate || setLocation;
  
  const params = new URLSearchParams(searchParams);
  const initialTab = (params.get('tab') as DocumentTab) || 'quotes';
  
  const [activeTab, setActiveTab] = useState<DocumentTab>(initialTab);
  const [searchTerm, setSearchTerm] = useState("");
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [markPaidDialogOpen, setMarkPaidDialogOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  
  const { toast } = useToast();
  const { data: businessSettings } = useBusinessSettings();
  
  const { data: quotesData = [], isLoading: quotesLoading } = useQuotes();
  const { data: invoicesData = [], isLoading: invoicesLoading } = useInvoices();
  const { data: receiptsData = [], isLoading: receiptsLoading } = useQuery({
    queryKey: ['/api/receipts'],
  });
  
  const quotes = Array.isArray(quotesData) ? quotesData : [];
  const invoices = Array.isArray(invoicesData) ? invoicesData : [];
  const receipts = Array.isArray(receiptsData) ? receiptsData : [];
  
  const sendQuoteMutation = useSendQuote();
  const convertToInvoiceMutation = useConvertQuoteToInvoice();
  const sendInvoiceMutation = useSendInvoice();
  const markPaidMutation = useMarkInvoicePaid();
  const createPaymentLinkMutation = useCreatePaymentLink();
  
  const filteredQuotes = useMemo(() => {
    if (!searchTerm) return quotes;
    const search = searchTerm.toLowerCase();
    return quotes.filter((q: any) => 
      q.number?.toLowerCase().includes(search) ||
      q.clientName?.toLowerCase().includes(search) ||
      q.title?.toLowerCase().includes(search)
    );
  }, [quotes, searchTerm]);
  
  const filteredInvoices = useMemo(() => {
    if (!searchTerm) return invoices;
    const search = searchTerm.toLowerCase();
    return invoices.filter((i: any) => 
      i.number?.toLowerCase().includes(search) ||
      i.clientName?.toLowerCase().includes(search) ||
      i.client?.toLowerCase().includes(search)
    );
  }, [invoices, searchTerm]);
  
  const filteredReceipts = useMemo(() => {
    if (!searchTerm) return receipts;
    const search = searchTerm.toLowerCase();
    return receipts.filter((r: any) => 
      r.receiptNumber?.toLowerCase().includes(search) ||
      r.clientName?.toLowerCase().includes(search)
    );
  }, [receipts, searchTerm]);
  
  const handleTabChange = (value: string) => {
    setActiveTab(value as DocumentTab);
    setSearchTerm("");
  };
  
  const handleSendQuote = (quote: any) => {
    setSelectedDocument(quote);
    setSendDialogOpen(true);
  };
  
  const handleConfirmSendQuote = async () => {
    if (!selectedDocument) return;
    try {
      await sendQuoteMutation.mutateAsync(selectedDocument.id);
      toast({
        title: "Quote marked as sent",
        description: `${selectedDocument.number} is now ready for your client`,
      });
    } catch (error: any) {
      toast({
        title: "Failed to send quote",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    }
  };
  
  const handleConvertToInvoice = async (quote: any) => {
    try {
      const result = await convertToInvoiceMutation.mutateAsync(quote.id);
      toast({
        title: "Invoice created",
        description: `${quote.number} converted to ${result?.number || 'invoice'}`,
      });
      setActiveTab('invoices');
    } catch (error: any) {
      toast({
        title: "Failed to convert quote",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    }
  };
  
  const handleSendInvoice = (invoice: any) => {
    setSelectedDocument(invoice);
    setSendDialogOpen(true);
  };
  
  const handleConfirmSendInvoice = async () => {
    if (!selectedDocument) return;
    try {
      await sendInvoiceMutation.mutateAsync(selectedDocument.id);
      toast({
        title: "Invoice marked as sent",
        description: `${selectedDocument.number} is ready for payment`,
      });
    } catch (error: any) {
      toast({
        title: "Failed to send invoice",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    }
  };
  
  const handleMarkPaid = (invoice: any) => {
    setSelectedDocument(invoice);
    setMarkPaidDialogOpen(true);
  };
  
  const handleConfirmMarkPaid = async () => {
    if (!selectedDocument) return;
    try {
      await markPaidMutation.mutateAsync(selectedDocument.id);
      toast({
        title: "Payment recorded",
        description: `${selectedDocument.number} marked as paid`,
      });
    } catch (error: any) {
      toast({
        title: "Failed to mark as paid",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    }
  };
  
  const handleCreatePaymentLink = async (invoice: any) => {
    try {
      const result = await createPaymentLinkMutation.mutateAsync(invoice.id);
      if (result?.paymentUrl) {
        navigator.clipboard.writeText(result.paymentUrl);
        toast({
          title: "Payment link created",
          description: "Link copied to clipboard - share it with your client",
        });
      }
    } catch (error: any) {
      toast({
        title: "Failed to create payment link",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    }
  };
  
  const handleCreate = () => {
    switch (activeTab) {
      case 'quotes':
        navigate('/quotes/new');
        break;
      case 'invoices':
        navigate('/invoices/new');
        break;
      case 'receipts':
        navigate('/collect-payment');
        break;
    }
  };
  
  const tabCounts = {
    quotes: quotes.length,
    invoices: invoices.length,
    receipts: receipts.length,
  };
  
  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-col h-full bg-background">
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="px-4 pt-4 pb-2">
          <h1 className="text-xl font-bold mb-3" data-testid="documents-hub-title">Documents</h1>
          
          <TabsList className="w-full grid grid-cols-3 h-12" data-testid="documents-tabs">
            <TabsTrigger 
              value="quotes" 
              className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              data-testid="tab-quotes"
            >
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Quotes</span>
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {tabCounts.quotes}
              </Badge>
            </TabsTrigger>
            <TabsTrigger 
              value="invoices" 
              className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              data-testid="tab-invoices"
            >
              <Receipt className="w-4 h-4" />
              <span className="hidden sm:inline">Invoices</span>
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {tabCounts.invoices}
              </Badge>
            </TabsTrigger>
            <TabsTrigger 
              value="receipts" 
              className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              data-testid="tab-receipts"
            >
              <CreditCard className="w-4 h-4" />
              <span className="hidden sm:inline">Receipts</span>
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {tabCounts.receipts}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </div>
        
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={`Search ${activeTab}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-11"
              data-testid="documents-search"
            />
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto pb-20">
        <TabsContent value="quotes" className="mt-0 h-full">
            <div className="p-4 space-y-3">
              {quotesLoading ? (
                <>
                  <DocumentSkeleton />
                  <DocumentSkeleton />
                  <DocumentSkeleton />
                </>
              ) : filteredQuotes.length === 0 ? (
                searchTerm ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No quotes matching "{searchTerm}"
                  </div>
                ) : (
                  <EmptyState type="quotes" onCreate={handleCreate} />
                )
              ) : (
                filteredQuotes.map((quote: any) => (
                  <QuoteCard
                    key={quote.id}
                    quote={quote}
                    onView={() => navigate(`/quotes/${quote.id}`)}
                    onSend={() => handleSendQuote(quote)}
                    onConvert={() => handleConvertToInvoice(quote)}
                  />
                ))
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="invoices" className="mt-0 h-full">
            <div className="p-4 space-y-3">
              {invoicesLoading ? (
                <>
                  <DocumentSkeleton />
                  <DocumentSkeleton />
                  <DocumentSkeleton />
                </>
              ) : filteredInvoices.length === 0 ? (
                searchTerm ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No invoices matching "{searchTerm}"
                  </div>
                ) : (
                  <EmptyState type="invoices" onCreate={handleCreate} />
                )
              ) : (
                filteredInvoices.map((invoice: any) => (
                  <InvoiceCard
                    key={invoice.id}
                    invoice={invoice}
                    onView={() => navigate(`/invoices/${invoice.id}`)}
                    onSend={() => handleSendInvoice(invoice)}
                    onMarkPaid={() => handleMarkPaid(invoice)}
                    onCreateLink={() => handleCreatePaymentLink(invoice)}
                  />
                ))
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="receipts" className="mt-0 h-full">
            <div className="p-4 space-y-3">
              {receiptsLoading ? (
                <>
                  <DocumentSkeleton />
                  <DocumentSkeleton />
                  <DocumentSkeleton />
                </>
              ) : filteredReceipts.length === 0 ? (
                searchTerm ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No receipts matching "{searchTerm}"
                  </div>
                ) : (
                  <EmptyState type="receipts" onCreate={handleCreate} />
                )
              ) : (
                filteredReceipts.map((receipt: any) => (
                  <ReceiptCard
                    key={receipt.id}
                    receipt={receipt}
                    onView={() => navigate(`/receipts/${receipt.id}`)}
                  />
                ))
              )}
            </div>
          </TabsContent>
      </div>
      
      <div className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-20">
        <Button 
          size="lg" 
          className="h-14 w-14 rounded-full shadow-lg"
          onClick={handleCreate}
          data-testid="button-create-document"
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>
      
      {selectedDocument && (
        <SendConfirmationDialog
          open={sendDialogOpen}
          onOpenChange={setSendDialogOpen}
          type={activeTab === 'quotes' ? 'quote' : 'invoice'}
          documentId={selectedDocument.id}
          documentNumber={selectedDocument.number || (activeTab === 'quotes' ? 'Quote' : 'Invoice')}
          clientName={selectedDocument.clientName || 'Unknown Client'}
          clientEmail={selectedDocument.clientEmail || ''}
          amount={normalizeToDollars(selectedDocument.total)}
          publicUrl={activeTab === 'quotes' 
            ? (selectedDocument.acceptanceToken 
                ? `${window.location.origin}/q/${selectedDocument.acceptanceToken}` 
                : '')
            : (selectedDocument.paymentToken 
                ? `${window.location.origin}/i/${selectedDocument.paymentToken}` 
                : '')
          }
          businessName={businessSettings?.businessName}
          onConfirmSend={activeTab === 'quotes' ? handleConfirmSendQuote : handleConfirmSendInvoice}
          isPending={activeTab === 'quotes' ? sendQuoteMutation.isPending : sendInvoiceMutation.isPending}
        />
      )}
      
      <ConfirmationDialog
        open={markPaidDialogOpen}
        onOpenChange={setMarkPaidDialogOpen}
        title="Mark Invoice as Paid"
        description={`Are you sure you want to mark ${selectedDocument?.number} as paid? This will record a payment of ${formatCurrency(normalizeToDollars(selectedDocument?.total))}.`}
        confirmLabel="Mark as Paid"
        onConfirm={handleConfirmMarkPaid}
        isPending={markPaidMutation.isPending}
      />
    </Tabs>
  );
}
