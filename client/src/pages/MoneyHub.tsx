import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, isAfter, isBefore, subDays, differenceInDays } from "date-fns";
import { 
  DollarSign, 
  FileText, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingUp,
  Send,
  ChevronRight,
  Filter,
  Calendar,
  CreditCard,
  Receipt,
  Banknote,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Invoice, Quote, Client } from "@shared/schema";
import { PageShell, PageHeader } from "@/components/ui/page-shell";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount / 100);
};

interface KPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: { value: number; positive: boolean };
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

function KPICard({ title, value, subtitle, icon, trend, variant = 'default' }: KPICardProps) {
  const variantStyles = {
    default: 'bg-card',
    success: 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800',
    warning: 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800',
    danger: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',
  };

  return (
    <Card className={`${variantStyles[variant]} transition-all hover-elevate`} data-testid={`kpi-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div className="rounded-lg bg-primary/10 p-2">
            {icon}
          </div>
        </div>
        {trend && (
          <div className="mt-2 flex items-center gap-1 text-xs">
            {trend.positive ? (
              <ArrowUpRight className="h-3 w-3 text-green-600" />
            ) : (
              <ArrowDownRight className="h-3 w-3 text-red-600" />
            )}
            <span className={trend.positive ? 'text-green-600' : 'text-red-600'}>
              {Math.abs(trend.value)}%
            </span>
            <span className="text-muted-foreground">vs last month</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface InvoiceRowProps {
  invoice: Invoice & { client?: Client };
  onView: () => void;
  onSend?: () => void;
}

function InvoiceRow({ invoice, onView, onSend }: InvoiceRowProps) {
  const isOverdue = invoice.dueDate && isBefore(new Date(invoice.dueDate), new Date()) && invoice.status !== 'paid';
  const daysOverdue = invoice.dueDate ? Math.abs(differenceInDays(new Date(), new Date(invoice.dueDate))) : 0;

  const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    draft: { label: 'Draft', variant: 'secondary' },
    sent: { label: 'Sent', variant: 'outline' },
    viewed: { label: 'Viewed', variant: 'outline' },
    partial: { label: 'Partial', variant: 'default' },
    paid: { label: 'Paid', variant: 'default' },
    overdue: { label: 'Overdue', variant: 'destructive' },
  };

  const status = isOverdue ? 'overdue' : invoice.status;
  const config = statusConfig[status] || statusConfig.draft;

  return (
    <div 
      className="flex items-center justify-between p-3 rounded-lg border bg-card hover-elevate cursor-pointer transition-all"
      onClick={onView}
      data-testid={`invoice-row-${invoice.id}`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="rounded-lg bg-primary/10 p-2 flex-shrink-0">
          <FileText className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">
              #{invoice.number || invoice.id.slice(0, 8)}
            </span>
            <Badge variant={config.variant} className="text-xs">
              {config.label}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground truncate">
            {invoice.client?.name || invoice.clientId?.slice(0, 8) || 'Unknown Client'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="font-semibold">{formatCurrency(invoice.total)}</p>
          {invoice.dueDate && (
            <p className={`text-xs ${isOverdue ? 'text-red-600' : 'text-muted-foreground'}`}>
              {isOverdue ? `${daysOverdue}d overdue` : `Due ${format(new Date(invoice.dueDate), 'dd MMM')}`}
            </p>
          )}
        </div>
        {invoice.status === 'draft' && onSend && (
          <Button 
            size="sm" 
            variant="outline"
            onClick={(e) => { e.stopPropagation(); onSend(); }}
            data-testid={`send-invoice-${invoice.id}`}
          >
            <Send className="h-3 w-3 mr-1" />
            Send
          </Button>
        )}
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  );
}

interface QuoteRowProps {
  quote: Quote & { client?: Client };
  onView: () => void;
}

function QuoteRow({ quote, onView }: QuoteRowProps) {
  const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    draft: { label: 'Draft', variant: 'secondary' },
    sent: { label: 'Sent', variant: 'outline' },
    viewed: { label: 'Viewed', variant: 'outline' },
    accepted: { label: 'Accepted', variant: 'default' },
    declined: { label: 'Declined', variant: 'destructive' },
    expired: { label: 'Expired', variant: 'secondary' },
  };

  const config = statusConfig[quote.status] || statusConfig.draft;

  return (
    <div 
      className="flex items-center justify-between p-3 rounded-lg border bg-card hover-elevate cursor-pointer transition-all"
      onClick={onView}
      data-testid={`quote-row-${quote.id}`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="rounded-lg bg-blue-500/10 p-2 flex-shrink-0">
          <Receipt className="h-4 w-4 text-blue-500" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">
              #{quote.number || quote.id.slice(0, 8)}
            </span>
            <Badge variant={config.variant} className="text-xs">
              {config.label}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground truncate">
            {quote.client?.name || quote.clientId?.slice(0, 8) || 'Unknown Client'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="font-semibold">{formatCurrency(quote.total)}</p>
          {quote.validUntil && (
            <p className="text-xs text-muted-foreground">
              Valid until {format(new Date(quote.validUntil), 'dd MMM')}
            </p>
          )}
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  );
}

export default function MoneyHub() {
  const [activeTab, setActiveTab] = useState<'overview' | 'invoices' | 'quotes' | 'payments'>('overview');
  const [invoiceFilter, setInvoiceFilter] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<string>('30d');

  const { data: invoices = [], isLoading: invoicesLoading } = useQuery<Invoice[]>({
    queryKey: ['/api/invoices'],
  });

  const { data: quotes = [], isLoading: quotesLoading } = useQuery<Quote[]>({
    queryKey: ['/api/quotes'],
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
  });

  const clientMap = useMemo(() => {
    return new Map(clients.map(c => [c.id, c]));
  }, [clients]);

  const invoicesWithClients = useMemo(() => {
    return invoices.map(inv => ({
      ...inv,
      client: clientMap.get(inv.clientId) || undefined,
    }));
  }, [invoices, clientMap]);

  const quotesWithClients = useMemo(() => {
    return quotes.map(q => ({
      ...q,
      client: clientMap.get(q.clientId) || undefined,
    }));
  }, [quotes, clientMap]);

  const stats = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = subDays(now, 30);

    const outstanding = invoicesWithClients.filter(
      inv => inv.status !== 'paid' && inv.status !== 'draft'
    );
    const outstandingTotal = outstanding.reduce((sum, inv) => sum + inv.total, 0);

    const overdue = outstanding.filter(
      inv => inv.dueDate && isBefore(new Date(inv.dueDate), now)
    );
    const overdueTotal = overdue.reduce((sum, inv) => sum + inv.total, 0);

    const paid = invoicesWithClients.filter(inv => inv.status === 'paid');
    const paidTotal = paid.reduce((sum, inv) => sum + inv.total, 0);

    const recentPaid = paid.filter(
      inv => inv.paidAt && isAfter(new Date(inv.paidAt), thirtyDaysAgo)
    );
    const recentPaidTotal = recentPaid.reduce((sum, inv) => sum + inv.total, 0);

    const drafts = invoicesWithClients.filter(inv => inv.status === 'draft');
    const draftsTotal = drafts.reduce((sum, inv) => sum + inv.total, 0);

    const acceptedQuotes = quotesWithClients.filter(q => q.status === 'accepted');
    const acceptedQuotesTotal = acceptedQuotes.reduce((sum, q) => sum + q.total, 0);

    const pendingQuotes = quotesWithClients.filter(q => q.status === 'sent' || q.status === 'viewed');
    const pendingQuotesTotal = pendingQuotes.reduce((sum, q) => sum + q.total, 0);

    return {
      outstandingTotal,
      outstandingCount: outstanding.length,
      overdueTotal,
      overdueCount: overdue.length,
      paidTotal,
      paidCount: paid.length,
      recentPaidTotal,
      recentPaidCount: recentPaid.length,
      draftsTotal,
      draftsCount: drafts.length,
      acceptedQuotesTotal,
      acceptedQuotesCount: acceptedQuotes.length,
      pendingQuotesTotal,
      pendingQuotesCount: pendingQuotes.length,
    };
  }, [invoicesWithClients, quotesWithClients]);

  const filteredInvoices = useMemo(() => {
    let filtered = [...invoicesWithClients];
    
    if (invoiceFilter === 'outstanding') {
      filtered = filtered.filter(inv => inv.status !== 'paid' && inv.status !== 'draft');
    } else if (invoiceFilter === 'overdue') {
      filtered = filtered.filter(inv => 
        inv.dueDate && 
        isBefore(new Date(inv.dueDate), new Date()) && 
        inv.status !== 'paid'
      );
    } else if (invoiceFilter === 'paid') {
      filtered = filtered.filter(inv => inv.status === 'paid');
    } else if (invoiceFilter === 'draft') {
      filtered = filtered.filter(inv => inv.status === 'draft');
    }

    return filtered.sort((a, b) => {
      if (a.status === 'draft' && b.status !== 'draft') return -1;
      if (a.status !== 'draft' && b.status === 'draft') return 1;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }, [invoicesWithClients, invoiceFilter]);

  const isLoading = invoicesLoading || quotesLoading;

  const handleViewInvoice = (invoiceId: string) => {
    window.dispatchEvent(new CustomEvent('openInvoiceDetail', { detail: { invoiceId } }));
  };

  const handleViewQuote = (quoteId: string) => {
    window.dispatchEvent(new CustomEvent('openQuoteDetail', { detail: { quoteId } }));
  };

  return (
    <PageShell data-testid="money-hub-page">
      <PageHeader 
        title="Money Hub" 
        subtitle="Track invoices, payments, and quotes in one place"
      />
      <div className="space-y-6 mt-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {isLoading ? (
            <>
              {[1, 2, 3, 4].map(i => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-4 w-24 mb-2" />
                    <Skeleton className="h-8 w-32" />
                  </CardContent>
                </Card>
              ))}
            </>
          ) : (
            <>
              <KPICard
                title="Outstanding"
                value={formatCurrency(stats.outstandingTotal)}
                subtitle={`${stats.outstandingCount} invoices`}
                icon={<Clock className="h-5 w-5 text-primary" />}
                variant={stats.outstandingCount > 0 ? 'warning' : 'default'}
              />
              <KPICard
                title="Overdue"
                value={formatCurrency(stats.overdueTotal)}
                subtitle={`${stats.overdueCount} invoices`}
                icon={<AlertTriangle className="h-5 w-5 text-red-500" />}
                variant={stats.overdueCount > 0 ? 'danger' : 'default'}
              />
              <KPICard
                title="Paid (30 days)"
                value={formatCurrency(stats.recentPaidTotal)}
                subtitle={`${stats.recentPaidCount} invoices`}
                icon={<CheckCircle2 className="h-5 w-5 text-green-500" />}
                variant="success"
              />
              <KPICard
                title="Pending Quotes"
                value={formatCurrency(stats.pendingQuotesTotal)}
                subtitle={`${stats.pendingQuotesCount} awaiting response`}
                icon={<Receipt className="h-5 w-5 text-blue-500" />}
              />
            </>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <TabsList>
              <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
              <TabsTrigger value="invoices" data-testid="tab-invoices">
                Invoices
                {stats.outstandingCount > 0 && (
                  <Badge variant="secondary" className="ml-2">{stats.outstandingCount}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="quotes" data-testid="tab-quotes">
                Quotes
                {stats.pendingQuotesCount > 0 && (
                  <Badge variant="secondary" className="ml-2">{stats.pendingQuotesCount}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="payments" data-testid="tab-payments">Payments</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="mt-4 space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    Needs Attention
                  </CardTitle>
                  <CardDescription>Overdue and outstanding invoices</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[280px]">
                    <div className="space-y-2">
                      {isLoading ? (
                        [1, 2, 3].map(i => (
                          <Skeleton key={i} className="h-16 w-full" />
                        ))
                      ) : filteredInvoices
                          .filter(inv => inv.status !== 'paid' && inv.status !== 'draft')
                          .slice(0, 5)
                          .map(invoice => (
                            <InvoiceRow
                              key={invoice.id}
                              invoice={invoice}
                              onView={() => handleViewInvoice(invoice.id)}
                            />
                          ))}
                      {!isLoading && filteredInvoices.filter(inv => inv.status !== 'paid' && inv.status !== 'draft').length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                          <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                          <p>All caught up! No outstanding invoices.</p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-blue-500" />
                    Pending Quotes
                  </CardTitle>
                  <CardDescription>Awaiting client response</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[280px]">
                    <div className="space-y-2">
                      {quotesLoading ? (
                        [1, 2, 3].map(i => (
                          <Skeleton key={i} className="h-16 w-full" />
                        ))
                      ) : quotesWithClients
                          .filter(q => q.status === 'sent' || q.status === 'viewed')
                          .slice(0, 5)
                          .map(quote => (
                            <QuoteRow
                              key={quote.id}
                              quote={quote}
                              onView={() => handleViewQuote(quote.id)}
                            />
                          ))}
                      {!quotesLoading && quotesWithClients.filter(q => q.status === 'sent' || q.status === 'viewed').length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                          <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                          <p>No pending quotes</p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  Recent Payments
                </CardTitle>
                <CardDescription>Last 30 days of received payments</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {isLoading ? (
                      [1, 2, 3].map(i => (
                        <Skeleton key={i} className="h-16 w-full" />
                      ))
                    ) : invoicesWithClients
                        .filter(inv => inv.status === 'paid')
                        .sort((a, b) => new Date(b.paidAt || 0).getTime() - new Date(a.paidAt || 0).getTime())
                        .slice(0, 5)
                        .map(invoice => (
                          <InvoiceRow
                            key={invoice.id}
                            invoice={invoice}
                            onView={() => handleViewInvoice(invoice.id)}
                          />
                        ))}
                    {!isLoading && invoicesWithClients.filter(inv => inv.status === 'paid').length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <Banknote className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                        <p>No payments received yet</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invoices" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-base">All Invoices</CardTitle>
                  <Select value={invoiceFilter} onValueChange={setInvoiceFilter}>
                    <SelectTrigger className="w-[140px]" data-testid="invoice-filter">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Filter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="outstanding">Outstanding</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="draft">Drafts</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {isLoading ? (
                      [1, 2, 3, 4, 5].map(i => (
                        <Skeleton key={i} className="h-16 w-full" />
                      ))
                    ) : filteredInvoices.map(invoice => (
                      <InvoiceRow
                        key={invoice.id}
                        invoice={invoice}
                        onView={() => handleViewInvoice(invoice.id)}
                      />
                    ))}
                    {!isLoading && filteredInvoices.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                        <p>No invoices found</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="quotes" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">All Quotes</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {quotesLoading ? (
                      [1, 2, 3, 4, 5].map(i => (
                        <Skeleton key={i} className="h-16 w-full" />
                      ))
                    ) : quotesWithClients
                        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
                        .map(quote => (
                          <QuoteRow
                            key={quote.id}
                            quote={quote}
                            onView={() => handleViewQuote(quote.id)}
                          />
                        ))}
                    {!quotesLoading && quotesWithClients.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <Receipt className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                        <p>No quotes found</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-base">Payment History</CardTitle>
                  <Select value={timeRange} onValueChange={setTimeRange}>
                    <SelectTrigger className="w-[140px]" data-testid="time-range-filter">
                      <Calendar className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Time range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7d">Last 7 days</SelectItem>
                      <SelectItem value="30d">Last 30 days</SelectItem>
                      <SelectItem value="90d">Last 90 days</SelectItem>
                      <SelectItem value="all">All time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {isLoading ? (
                      [1, 2, 3, 4, 5].map(i => (
                        <Skeleton key={i} className="h-16 w-full" />
                      ))
                    ) : invoicesWithClients
                        .filter(inv => {
                          if (inv.status !== 'paid' || !inv.paidAt) return false;
                          const paidDate = new Date(inv.paidAt);
                          const now = new Date();
                          if (timeRange === '7d') return isAfter(paidDate, subDays(now, 7));
                          if (timeRange === '30d') return isAfter(paidDate, subDays(now, 30));
                          if (timeRange === '90d') return isAfter(paidDate, subDays(now, 90));
                          return true;
                        })
                        .sort((a, b) => new Date(b.paidAt || 0).getTime() - new Date(a.paidAt || 0).getTime())
                        .map(invoice => (
                          <InvoiceRow
                            key={invoice.id}
                            invoice={invoice}
                            onView={() => handleViewInvoice(invoice.id)}
                          />
                        ))}
                    {!isLoading && invoicesWithClients.filter(inv => inv.status === 'paid').length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <CreditCard className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                        <p>No payments in this period</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PageShell>
  );
}
