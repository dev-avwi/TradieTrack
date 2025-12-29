import { useState, useMemo, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { 
  FileText, 
  Receipt, 
  CreditCard, 
  Search, 
  Plus, 
  Clock,
  CheckCircle,
  AlertCircle,
  Send,
  XCircle,
  MoreVertical,
  Eye,
  Link2,
  Briefcase,
  LayoutGrid,
  List
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
type QuoteStatus = "all" | "draft" | "sent" | "accepted" | "rejected";
type InvoiceStatus = "all" | "draft" | "sent" | "paid" | "overdue";
type ReceiptStatus = "all" | "bank_transfer" | "card" | "cash";

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
      return { label: 'Draft', icon: Clock, className: 'bg-muted text-muted-foreground' };
    case 'sent':
      return { label: 'Sent', icon: Send, className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' };
    case 'accepted':
      return { label: 'Accepted', icon: CheckCircle, className: 'bg-green-500/10 text-green-600 dark:text-green-400' };
    case 'rejected':
      return { label: 'Rejected', icon: XCircle, className: 'bg-red-500/10 text-red-600 dark:text-red-400' };
    default:
      return { label: status, icon: Clock, className: 'bg-muted text-muted-foreground' };
  }
};

const getInvoiceStatusConfig = (status: string) => {
  switch (status) {
    case 'draft':
      return { label: 'Draft', icon: Clock, className: 'bg-muted text-muted-foreground' };
    case 'sent':
      return { label: 'Sent', icon: Send, className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' };
    case 'paid':
      return { label: 'Paid', icon: CheckCircle, className: 'bg-green-500/10 text-green-600 dark:text-green-400' };
    case 'overdue':
      return { label: 'Overdue', icon: AlertCircle, className: 'bg-red-500/10 text-red-600 dark:text-red-400' };
    default:
      return { label: status, icon: Clock, className: 'bg-muted text-muted-foreground' };
  }
};

function StatusFilterPill({ 
  label, 
  count, 
  isActive, 
  onClick,
  icon: Icon
}: { 
  label: string; 
  count: number; 
  isActive: boolean; 
  onClick: () => void;
  icon?: any;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
        isActive 
          ? "bg-primary text-primary-foreground" 
          : "bg-muted/50 text-muted-foreground hover:bg-muted"
      )}
      data-testid={`filter-${label.toLowerCase()}`}
    >
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {label}
      <Badge variant="secondary" className={cn(
        "h-5 px-1.5 text-xs ml-0.5",
        isActive ? "bg-primary-foreground/20 text-primary-foreground" : ""
      )}>
        {count}
      </Badge>
    </button>
  );
}

function CompactQuoteCard({ quote, onView, onSend, onConvert, linkedInvoice, onViewInvoice }: { 
  quote: any; 
  onView: () => void;
  onSend: () => void;
  onConvert: () => void;
  linkedInvoice?: any;
  onViewInvoice?: () => void;
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
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-sm truncate" data-testid={`quote-number-${quote.id}`}>
                {quote.title || quote.number}
              </span>
              <Badge className={cn("text-[10px] px-1.5 py-0", statusConfig.className)} data-testid={`quote-status-${quote.id}`}>
                {statusConfig.label}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="truncate">{quote.clientName || 'No client'}</span>
              {linkedInvoice && (
                <Badge 
                  variant="outline" 
                  className="text-[10px] px-1.5 py-0 cursor-pointer text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-700"
                  onClick={(e) => { e.stopPropagation(); onViewInvoice?.(); }}
                  data-testid={`quote-invoice-link-${quote.id}`}
                >
                  <Link2 className="w-2.5 h-2.5 mr-0.5" />
                  Invoice
                </Badge>
              )}
            </div>
          </div>
          <div className="text-right flex-shrink-0 flex items-center gap-2">
            <div>
              <p className="font-bold text-base" data-testid={`quote-amount-${quote.id}`}>
                {formatCurrency(amount)}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {quote.createdAt ? formatDistanceToNow(new Date(quote.createdAt), { addSuffix: true }) : ''}
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`quote-menu-${quote.id}`}>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView(); }}>
                  <Eye className="h-4 w-4 mr-2" />
                  View
                </DropdownMenuItem>
                {quote.status === 'draft' && (
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onSend(); }}>
                    <Send className="h-4 w-4 mr-2" />
                    Mark Sent
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
        </div>
      </CardContent>
    </Card>
  );
}

function CompactInvoiceCard({ 
  invoice, 
  onView, 
  onSend, 
  onMarkPaid, 
  onCreateLink, 
  linkedReceipt, 
  onViewReceipt,
  onViewJob 
}: { 
  invoice: any; 
  onView: () => void;
  onSend: () => void;
  onMarkPaid: () => void;
  onCreateLink: () => void;
  linkedReceipt?: any;
  onViewReceipt?: () => void;
  onViewJob?: () => void;
}) {
  const statusConfig = getInvoiceStatusConfig(invoice.status);
  const amount = normalizeToDollars(invoice.total);
  
  return (
    <Card 
      className="hover-elevate active-elevate-2 cursor-pointer transition-all"
      onClick={onView}
      data-testid={`invoice-card-${invoice.id}`}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-sm truncate" data-testid={`invoice-number-${invoice.id}`}>
                {invoice.title || invoice.number}
              </span>
              <Badge className={cn("text-[10px] px-1.5 py-0", statusConfig.className)} data-testid={`invoice-status-${invoice.id}`}>
                {statusConfig.label}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
              <span className="truncate">{invoice.clientName || invoice.client || 'No client'}</span>
              {invoice.dueDate && invoice.status !== 'paid' && (
                <span className="text-[10px]">Due: {new Date(invoice.dueDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</span>
              )}
              {invoice.status === 'paid' && linkedReceipt && (
                <Badge 
                  variant="outline" 
                  className="text-[10px] px-1.5 py-0 cursor-pointer text-green-600 dark:text-green-400 border-green-300 dark:border-green-700"
                  onClick={(e) => { e.stopPropagation(); onViewReceipt?.(); }}
                  data-testid={`invoice-receipt-link-${invoice.id}`}
                >
                  <Link2 className="w-2.5 h-2.5 mr-0.5" />
                  Receipt
                </Badge>
              )}
              {invoice.jobId && onViewJob && (
                <Badge 
                  variant="outline" 
                  className="text-[10px] px-1.5 py-0 cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); onViewJob(); }}
                  data-testid={`invoice-job-link-${invoice.id}`}
                >
                  <Briefcase className="w-2.5 h-2.5 mr-0.5" />
                  Job
                </Badge>
              )}
            </div>
          </div>
          <div className="text-right flex-shrink-0 flex items-center gap-2">
            <div>
              <p className="font-bold text-base" data-testid={`invoice-amount-${invoice.id}`}>
                {formatCurrency(amount)}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {invoice.createdAt ? formatDistanceToNow(new Date(invoice.createdAt), { addSuffix: true }) : ''}
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`invoice-menu-${invoice.id}`}>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView(); }}>
                  <Eye className="h-4 w-4 mr-2" />
                  View
                </DropdownMenuItem>
                {invoice.status === 'draft' && (
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onSend(); }}>
                    <Send className="h-4 w-4 mr-2" />
                    Mark Sent
                  </DropdownMenuItem>
                )}
                {(invoice.status === 'sent' || invoice.status === 'overdue') && (
                  <>
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onMarkPaid(); }}>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Mark Paid
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onCreateLink(); }}>
                      <CreditCard className="h-4 w-4 mr-2" />
                      Payment Link
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CompactReceiptCard({ receipt, onView, onViewInvoice }: { 
  receipt: any; 
  onView: () => void;
  onViewInvoice?: () => void;
}) {
  const amount = normalizeToDollars(receipt.amount);
  const paymentMethodLabel = receipt.paymentMethod === 'bank_transfer' ? 'Bank' 
    : receipt.paymentMethod === 'card' ? 'Card' 
    : receipt.paymentMethod === 'tap_to_pay' ? 'Tap'
    : receipt.paymentMethod === 'cash' ? 'Cash' 
    : receipt.paymentMethod || 'Unknown';
  
  return (
    <Card 
      className="hover-elevate active-elevate-2 cursor-pointer transition-all"
      onClick={onView}
      data-testid={`receipt-card-${receipt.id}`}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-sm truncate" data-testid={`receipt-number-${receipt.id}`}>
                {receipt.receiptNumber || receipt.description || 'Receipt'}
              </span>
              <Badge className="text-[10px] px-1.5 py-0 bg-green-500/10 text-green-600 dark:text-green-400">
                {paymentMethodLabel}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="truncate">{receipt.clientName || 'Unknown client'}</span>
              {receipt.invoiceId && onViewInvoice && (
                <Badge 
                  variant="outline" 
                  className="text-[10px] px-1.5 py-0 cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); onViewInvoice(); }}
                  data-testid={`receipt-invoice-link-${receipt.id}`}
                >
                  <Link2 className="w-2.5 h-2.5 mr-0.5" />
                  Invoice
                </Badge>
              )}
            </div>
          </div>
          <div className="text-right flex-shrink-0 flex items-center gap-2">
            <div>
              <p className="font-bold text-base text-green-600 dark:text-green-400" data-testid={`receipt-amount-${receipt.id}`}>
                +{formatCurrency(amount)}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {receipt.paidAt ? formatDistanceToNow(new Date(receipt.paidAt), { addSuffix: true }) : ''}
              </p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); onView(); }} data-testid={`receipt-view-${receipt.id}`}>
              <Eye className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DocumentSkeleton() {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <Skeleton className="h-4 w-32 mb-2" />
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="text-right">
            <Skeleton className="h-5 w-16 mb-1" />
            <Skeleton className="h-3 w-12" />
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
      description: "Create your first quote to start winning more work",
      buttonText: "Create Quote"
    },
    invoices: {
      icon: Receipt,
      title: "No invoices yet",
      description: "Create an invoice to start getting paid",
      buttonText: "Create Invoice"
    },
    receipts: {
      icon: CreditCard,
      title: "No receipts yet",
      description: "Receipts appear when payments are received",
      buttonText: "Collect Payment"
    }
  };
  
  const { icon: Icon, title, description, buttonText } = config[type];
  
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3">
        <Icon className="w-7 h-7 text-muted-foreground" />
      </div>
      <h3 className="font-semibold text-base mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-xs">{description}</p>
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
  const initialFilter = params.get('filter') || 'all';
  
  const [activeTab, setActiveTab] = useState<DocumentTab>(initialTab);
  const [quoteFilter, setQuoteFilter] = useState<QuoteStatus>(
    initialTab === 'quotes' ? (initialFilter as QuoteStatus) : "all"
  );
  const [invoiceFilter, setInvoiceFilter] = useState<InvoiceStatus>(
    initialTab === 'invoices' ? (initialFilter as InvoiceStatus) : "all"
  );
  const [receiptFilter, setReceiptFilter] = useState<ReceiptStatus>(
    initialTab === 'receipts' ? (initialFilter as ReceiptStatus) : "all"
  );
  
  // Update tab and filter when URL params change
  useEffect(() => {
    const urlParams = new URLSearchParams(searchParams);
    const tab = urlParams.get('tab') as DocumentTab;
    const filter = urlParams.get('filter');
    
    if (tab) {
      setActiveTab(tab);
      if (filter) {
        if (tab === 'quotes') {
          setQuoteFilter(filter as QuoteStatus);
        } else if (tab === 'invoices') {
          setInvoiceFilter(filter as InvoiceStatus);
        } else if (tab === 'receipts') {
          setReceiptFilter(filter as ReceiptStatus);
        }
      }
    }
  }, [searchParams]);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
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

  const invoicesByQuoteId = useMemo(() => {
    const map = new Map<string, any>();
    invoices.forEach((inv: any) => {
      if (inv.quoteId) {
        map.set(inv.quoteId, inv);
      }
    });
    return map;
  }, [invoices]);

  const receiptsByInvoiceId = useMemo(() => {
    const map = new Map<string, any>();
    receipts.forEach((rec: any) => {
      if (rec.invoiceId) {
        map.set(rec.invoiceId, rec);
      }
    });
    return map;
  }, [receipts]);

  const quoteStatusCounts = useMemo(() => {
    const counts = { all: quotes.length, draft: 0, sent: 0, accepted: 0, rejected: 0 };
    quotes.forEach((q: any) => {
      if (q.status && counts[q.status as keyof typeof counts] !== undefined) {
        counts[q.status as keyof typeof counts]++;
      }
    });
    return counts;
  }, [quotes]);

  const invoiceStatusCounts = useMemo(() => {
    const counts = { all: invoices.length, draft: 0, sent: 0, paid: 0, overdue: 0 };
    invoices.forEach((i: any) => {
      if (i.status && counts[i.status as keyof typeof counts] !== undefined) {
        counts[i.status as keyof typeof counts]++;
      }
    });
    return counts;
  }, [invoices]);

  const receiptMethodCounts = useMemo(() => {
    const counts = { all: receipts.length, bank_transfer: 0, card: 0, cash: 0 };
    receipts.forEach((r: any) => {
      const method = r.paymentMethod;
      if (method === 'bank_transfer') counts.bank_transfer++;
      else if (method === 'card' || method === 'tap_to_pay') counts.card++;
      else if (method === 'cash') counts.cash++;
    });
    return counts;
  }, [receipts]);
  
  const filteredQuotes = useMemo(() => {
    let result = quotes;
    if (quoteFilter !== 'all') {
      result = result.filter((q: any) => q.status === quoteFilter);
    }
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      result = result.filter((q: any) => 
        q.number?.toLowerCase().includes(search) ||
        q.clientName?.toLowerCase().includes(search) ||
        q.title?.toLowerCase().includes(search)
      );
    }
    return result;
  }, [quotes, quoteFilter, searchTerm]);
  
  const filteredInvoices = useMemo(() => {
    let result = invoices;
    if (invoiceFilter !== 'all') {
      result = result.filter((i: any) => i.status === invoiceFilter);
    }
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      result = result.filter((i: any) => 
        i.number?.toLowerCase().includes(search) ||
        i.clientName?.toLowerCase().includes(search) ||
        i.client?.toLowerCase().includes(search)
      );
    }
    return result;
  }, [invoices, invoiceFilter, searchTerm]);
  
  const filteredReceipts = useMemo(() => {
    let result = receipts;
    if (receiptFilter !== 'all') {
      if (receiptFilter === 'card') {
        result = result.filter((r: any) => r.paymentMethod === 'card' || r.paymentMethod === 'tap_to_pay');
      } else {
        result = result.filter((r: any) => r.paymentMethod === receiptFilter);
      }
    }
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      result = result.filter((r: any) => 
        r.receiptNumber?.toLowerCase().includes(search) ||
        r.clientName?.toLowerCase().includes(search)
      );
    }
    return result;
  }, [receipts, receiptFilter, searchTerm]);
  
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
      toast({ title: "Quote marked as sent", description: `${selectedDocument.number} is ready for your client` });
    } catch (error: any) {
      toast({ title: "Failed to send quote", description: error.message || "Please try again", variant: "destructive" });
    }
  };
  
  const handleConvertToInvoice = async (quote: any) => {
    try {
      const result = await convertToInvoiceMutation.mutateAsync(quote.id);
      toast({ title: "Invoice created", description: `${quote.number} converted to ${result?.number || 'invoice'}` });
      setActiveTab('invoices');
    } catch (error: any) {
      toast({ title: "Failed to convert quote", description: error.message || "Please try again", variant: "destructive" });
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
      toast({ title: "Invoice marked as sent", description: `${selectedDocument.number} is ready for payment` });
    } catch (error: any) {
      toast({ title: "Failed to send invoice", description: error.message || "Please try again", variant: "destructive" });
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
      toast({ title: "Payment recorded", description: `${selectedDocument.number} marked as paid` });
    } catch (error: any) {
      toast({ title: "Failed to mark as paid", description: error.message || "Please try again", variant: "destructive" });
    }
  };
  
  const handleCreatePaymentLink = async (invoice: any) => {
    try {
      const result = await createPaymentLinkMutation.mutateAsync(invoice.id);
      if (result?.paymentUrl) {
        navigator.clipboard.writeText(result.paymentUrl);
        toast({ title: "Payment link created", description: "Link copied to clipboard" });
      }
    } catch (error: any) {
      toast({ title: "Failed to create payment link", description: error.message || "Please try again", variant: "destructive" });
    }
  };
  
  const handleCreate = () => {
    switch (activeTab) {
      case 'quotes': navigate('/quotes/new'); break;
      case 'invoices': navigate('/invoices/new'); break;
      case 'receipts': navigate('/collect-payment'); break;
    }
  };

  const totalDocuments = activeTab === 'quotes' ? quotes.length 
    : activeTab === 'invoices' ? invoices.length 
    : receipts.length;
  
  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-col h-full bg-background">
      <div className="sticky top-0 z-10 bg-background">
        <div className="px-4 pt-4 pb-3 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" data-testid="documents-hub-title">Documents</h1>
            <p className="text-sm text-muted-foreground">{totalDocuments} total {activeTab}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center border rounded-lg p-0.5 bg-muted/30">
              <Button 
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'} 
                size="icon" 
                className="h-8 w-8"
                onClick={() => setViewMode('grid')}
                data-testid="view-grid"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button 
                variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
                size="icon" 
                className="h-8 w-8"
                onClick={() => setViewMode('list')}
                data-testid="view-list"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
            <Button onClick={handleCreate} className="gap-1.5" data-testid="button-create-document-header">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">{activeTab === 'quotes' ? 'Quote' : activeTab === 'invoices' ? 'Invoice' : 'Receipt'}</span>
            </Button>
          </div>
        </div>
        
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={`Search by title, client, or number...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-10"
              data-testid="documents-search"
            />
          </div>
        </div>

        <div className="px-4 pb-2">
          <TabsList className="w-full grid grid-cols-3 h-10 bg-muted/30" data-testid="documents-tabs">
            <TabsTrigger value="quotes" className="gap-1.5 text-sm" data-testid="tab-quotes">
              <FileText className="w-4 h-4" />
              Quotes
              <Badge variant="secondary" className="h-5 px-1.5 text-xs">{quotes.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="invoices" className="gap-1.5 text-sm" data-testid="tab-invoices">
              <Receipt className="w-4 h-4" />
              Invoices
              <Badge variant="secondary" className="h-5 px-1.5 text-xs">{invoices.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="receipts" className="gap-1.5 text-sm" data-testid="tab-receipts">
              <CreditCard className="w-4 h-4" />
              Receipts
              <Badge variant="secondary" className="h-5 px-1.5 text-xs">{receipts.length}</Badge>
            </TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="w-full">
          <div className="px-4 pb-3 flex gap-2">
            {activeTab === 'quotes' && (
              <>
                <StatusFilterPill label="All" count={quoteStatusCounts.all} isActive={quoteFilter === 'all'} onClick={() => setQuoteFilter('all')} icon={FileText} />
                <StatusFilterPill label="Draft" count={quoteStatusCounts.draft} isActive={quoteFilter === 'draft'} onClick={() => setQuoteFilter('draft')} icon={Clock} />
                <StatusFilterPill label="Sent" count={quoteStatusCounts.sent} isActive={quoteFilter === 'sent'} onClick={() => setQuoteFilter('sent')} icon={Send} />
                <StatusFilterPill label="Accepted" count={quoteStatusCounts.accepted} isActive={quoteFilter === 'accepted'} onClick={() => setQuoteFilter('accepted')} icon={CheckCircle} />
                <StatusFilterPill label="Rejected" count={quoteStatusCounts.rejected} isActive={quoteFilter === 'rejected'} onClick={() => setQuoteFilter('rejected')} icon={XCircle} />
              </>
            )}
            {activeTab === 'invoices' && (
              <>
                <StatusFilterPill label="All" count={invoiceStatusCounts.all} isActive={invoiceFilter === 'all'} onClick={() => setInvoiceFilter('all')} icon={Receipt} />
                <StatusFilterPill label="Draft" count={invoiceStatusCounts.draft} isActive={invoiceFilter === 'draft'} onClick={() => setInvoiceFilter('draft')} icon={Clock} />
                <StatusFilterPill label="Sent" count={invoiceStatusCounts.sent} isActive={invoiceFilter === 'sent'} onClick={() => setInvoiceFilter('sent')} icon={Send} />
                <StatusFilterPill label="Paid" count={invoiceStatusCounts.paid} isActive={invoiceFilter === 'paid'} onClick={() => setInvoiceFilter('paid')} icon={CheckCircle} />
                <StatusFilterPill label="Overdue" count={invoiceStatusCounts.overdue} isActive={invoiceFilter === 'overdue'} onClick={() => setInvoiceFilter('overdue')} icon={AlertCircle} />
              </>
            )}
            {activeTab === 'receipts' && (
              <>
                <StatusFilterPill label="All" count={receiptMethodCounts.all} isActive={receiptFilter === 'all'} onClick={() => setReceiptFilter('all')} icon={CreditCard} />
                <StatusFilterPill label="Bank" count={receiptMethodCounts.bank_transfer} isActive={receiptFilter === 'bank_transfer'} onClick={() => setReceiptFilter('bank_transfer')} />
                <StatusFilterPill label="Card" count={receiptMethodCounts.card} isActive={receiptFilter === 'card'} onClick={() => setReceiptFilter('card')} />
                <StatusFilterPill label="Cash" count={receiptMethodCounts.cash} isActive={receiptFilter === 'cash'} onClick={() => setReceiptFilter('cash')} />
              </>
            )}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
      
      <div className="flex-1 overflow-auto pb-20">
        <TabsContent value="quotes" className="mt-0 h-full">
          <div className={cn("p-4", viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 gap-3" : "space-y-2")}>
            {quotesLoading ? (
              <>
                <DocumentSkeleton />
                <DocumentSkeleton />
                <DocumentSkeleton />
              </>
            ) : filteredQuotes.length === 0 ? (
              searchTerm || quoteFilter !== 'all' ? (
                <div className="text-center py-8 text-muted-foreground col-span-full">
                  No quotes found
                </div>
              ) : (
                <div className="col-span-full">
                  <EmptyState type="quotes" onCreate={handleCreate} />
                </div>
              )
            ) : (
              filteredQuotes.map((quote: any) => {
                const linkedInvoice = invoicesByQuoteId.get(quote.id);
                return (
                  <CompactQuoteCard
                    key={quote.id}
                    quote={quote}
                    onView={() => navigate(`/quotes/${quote.id}`)}
                    onSend={() => handleSendQuote(quote)}
                    onConvert={() => handleConvertToInvoice(quote)}
                    linkedInvoice={linkedInvoice}
                    onViewInvoice={linkedInvoice ? () => navigate(`/invoices/${linkedInvoice.id}`) : undefined}
                  />
                );
              })
            )}
          </div>
        </TabsContent>
          
        <TabsContent value="invoices" className="mt-0 h-full">
          <div className={cn("p-4", viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 gap-3" : "space-y-2")}>
            {invoicesLoading ? (
              <>
                <DocumentSkeleton />
                <DocumentSkeleton />
                <DocumentSkeleton />
              </>
            ) : filteredInvoices.length === 0 ? (
              searchTerm || invoiceFilter !== 'all' ? (
                <div className="text-center py-8 text-muted-foreground col-span-full">
                  No invoices found
                </div>
              ) : (
                <div className="col-span-full">
                  <EmptyState type="invoices" onCreate={handleCreate} />
                </div>
              )
            ) : (
              filteredInvoices.map((invoice: any) => {
                const linkedReceipt = receiptsByInvoiceId.get(invoice.id);
                return (
                  <CompactInvoiceCard
                    key={invoice.id}
                    invoice={invoice}
                    onView={() => navigate(`/invoices/${invoice.id}`)}
                    onSend={() => handleSendInvoice(invoice)}
                    onMarkPaid={() => handleMarkPaid(invoice)}
                    onCreateLink={() => handleCreatePaymentLink(invoice)}
                    linkedReceipt={linkedReceipt}
                    onViewReceipt={linkedReceipt ? () => navigate(`/receipts/${linkedReceipt.id}`) : undefined}
                    onViewJob={invoice.jobId ? () => navigate(`/jobs/${invoice.jobId}`) : undefined}
                  />
                );
              })
            )}
          </div>
        </TabsContent>
          
        <TabsContent value="receipts" className="mt-0 h-full">
          <div className={cn("p-4", viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 gap-3" : "space-y-2")}>
            {receiptsLoading ? (
              <>
                <DocumentSkeleton />
                <DocumentSkeleton />
                <DocumentSkeleton />
              </>
            ) : filteredReceipts.length === 0 ? (
              searchTerm || receiptFilter !== 'all' ? (
                <div className="text-center py-8 text-muted-foreground col-span-full">
                  No receipts found
                </div>
              ) : (
                <div className="col-span-full">
                  <EmptyState type="receipts" onCreate={handleCreate} />
                </div>
              )
            ) : (
              filteredReceipts.map((receipt: any) => (
                <CompactReceiptCard
                  key={receipt.id}
                  receipt={receipt}
                  onView={() => navigate(`/receipts/${receipt.id}`)}
                  onViewInvoice={receipt.invoiceId ? () => navigate(`/invoices/${receipt.invoiceId}`) : undefined}
                />
              ))
            )}
          </div>
        </TabsContent>
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
