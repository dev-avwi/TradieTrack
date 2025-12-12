import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText,
  Receipt,
  DollarSign,
  BarChart3,
  Plus,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Filter,
  Download,
  Send,
  Eye
} from "lucide-react";
import { format, formatDistanceToNow, isAfter, parseISO } from "date-fns";

interface Quote {
  id: number;
  quoteNumber: string;
  clientId: number;
  total: string;
  status: string;
  createdAt: string;
  expiresAt?: string;
  client?: { name: string };
}

interface Invoice {
  id: number;
  invoiceNumber: string;
  clientId: number;
  total: string;
  status: string;
  createdAt: string;
  dueDate?: string;
  paidAt?: string;
  client?: { name: string };
}

interface Payment {
  id: number;
  invoiceId: number;
  amount: string;
  method: string;
  paidAt: string;
  invoice?: { invoiceNumber: string; client?: { name: string } };
}

type TabType = 'quotes' | 'invoices' | 'payments' | 'reports';

export default function MoneyHub() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<TabType>('quotes');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: quotes = [], isLoading: quotesLoading } = useQuery<Quote[]>({
    queryKey: ['/api/quotes'],
  });

  const { data: invoices = [], isLoading: invoicesLoading } = useQuery<Invoice[]>({
    queryKey: ['/api/invoices'],
  });

  const { data: payments = [], isLoading: paymentsLoading } = useQuery<Payment[]>({
    queryKey: ['/api/payments'],
  });

  const pendingQuotes = quotes.filter(q => q.status === 'draft' || q.status === 'sent');
  const unpaidInvoices = invoices.filter(i => i.status !== 'paid');
  const overdueInvoices = invoices.filter(i => 
    i.status !== 'paid' && i.dueDate && isAfter(new Date(), parseISO(i.dueDate))
  );

  const totalOutstanding = unpaidInvoices.reduce((sum, inv) => sum + parseFloat(inv.total || '0'), 0);
  const totalPaidThisMonth = payments
    .filter(p => {
      const paidDate = new Date(p.paidAt);
      const now = new Date();
      return paidDate.getMonth() === now.getMonth() && paidDate.getFullYear() === now.getFullYear();
    })
    .reduce((sum, p) => sum + parseFloat(p.amount || '0'), 0);

  const filteredQuotes = quotes.filter(q => 
    q.quoteNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    q.client?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredInvoices = invoices.filter(i => 
    i.invoiceNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    i.client?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string, type: 'quote' | 'invoice') => {
    const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle2 }> = {
      draft: { variant: 'secondary', icon: Clock },
      sent: { variant: 'outline', icon: Send },
      accepted: { variant: 'default', icon: CheckCircle2 },
      declined: { variant: 'destructive', icon: AlertCircle },
      expired: { variant: 'destructive', icon: AlertCircle },
      pending: { variant: 'outline', icon: Clock },
      paid: { variant: 'default', icon: CheckCircle2 },
      overdue: { variant: 'destructive', icon: AlertCircle },
      partial: { variant: 'secondary', icon: Clock },
    };

    const config = statusConfig[status] || { variant: 'secondary' as const, icon: Clock };
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 sm:p-6 border-b bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold" data-testid="text-money-title">Money</h1>
            <p className="text-muted-foreground">Quotes, invoices, payments & reports</p>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setLocation('/quotes/new')}
              data-testid="button-new-quote"
            >
              <Plus className="h-4 w-4 mr-2" />
              Quote
            </Button>
            <Button
              onClick={() => setLocation('/invoices/new')}
              style={{ backgroundColor: 'hsl(var(--trade))' }}
              data-testid="button-new-invoice"
            >
              <Plus className="h-4 w-4 mr-2" />
              Invoice
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <Card className="hover-elevate cursor-pointer" onClick={() => setActiveTab('quotes')} data-testid="card-pending-quotes">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Pending Quotes</p>
                  <p className="text-xl sm:text-2xl font-bold">{pendingQuotes.length}</p>
                </div>
                <FileText className="h-8 w-8 text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="hover-elevate cursor-pointer" onClick={() => setActiveTab('invoices')} data-testid="card-outstanding">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Outstanding</p>
                  <p className="text-xl sm:text-2xl font-bold">${totalOutstanding.toLocaleString()}</p>
                </div>
                <ArrowUpRight className="h-8 w-8 text-orange-500/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="hover-elevate cursor-pointer" onClick={() => setActiveTab('invoices')} data-testid="card-overdue">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Overdue</p>
                  <p className="text-xl sm:text-2xl font-bold text-destructive">{overdueInvoices.length}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-destructive/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="hover-elevate cursor-pointer" onClick={() => setActiveTab('payments')} data-testid="card-paid-month">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Paid This Month</p>
                  <p className="text-xl sm:text-2xl font-bold text-green-600">${totalPaidThisMonth.toLocaleString()}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-500/50" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex-1 p-4 sm:p-6 overflow-auto">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)} className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="quotes" className="flex-1 sm:flex-none gap-2" data-testid="tab-quotes">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Quotes</span>
                {pendingQuotes.length > 0 && (
                  <Badge variant="secondary" className="ml-1">{pendingQuotes.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="invoices" className="flex-1 sm:flex-none gap-2" data-testid="tab-invoices">
                <Receipt className="h-4 w-4" />
                <span className="hidden sm:inline">Invoices</span>
                {unpaidInvoices.length > 0 && (
                  <Badge variant="secondary" className="ml-1">{unpaidInvoices.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="payments" className="flex-1 sm:flex-none gap-2" data-testid="tab-payments">
                <DollarSign className="h-4 w-4" />
                <span className="hidden sm:inline">Payments</span>
              </TabsTrigger>
              <TabsTrigger value="reports" className="flex-1 sm:flex-none gap-2" data-testid="tab-reports">
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">Reports</span>
              </TabsTrigger>
            </TabsList>

            <div className="flex gap-2">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search"
                />
              </div>
              <Button variant="outline" size="icon" data-testid="button-filter">
                <Filter className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <TabsContent value="quotes" className="space-y-3">
            {quotesLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                        <Skeleton className="h-6 w-20" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredQuotes.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="font-semibold mb-2">No quotes yet</h3>
                  <p className="text-muted-foreground text-sm mb-4">Create your first quote to get started</p>
                  <Button onClick={() => setLocation('/quotes/new')} data-testid="button-create-first-quote">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Quote
                  </Button>
                </CardContent>
              </Card>
            ) : (
              filteredQuotes.map((quote) => (
                <Card 
                  key={quote.id} 
                  className="hover-elevate cursor-pointer"
                  onClick={() => setLocation(`/quotes/${quote.id}`)}
                  data-testid={`card-quote-${quote.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{quote.quoteNumber}</span>
                          {getStatusBadge(quote.status, 'quote')}
                        </div>
                        <p className="text-sm text-muted-foreground">{quote.client?.name || 'Unknown Client'}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(quote.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">${parseFloat(quote.total || '0').toLocaleString()}</p>
                        <div className="flex gap-1 mt-2">
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={(e) => { e.stopPropagation(); setLocation(`/quotes/${quote.id}`); }}
                            data-testid={`button-view-quote-${quote.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {quote.status === 'draft' && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={(e) => { e.stopPropagation(); }}
                              data-testid={`button-send-quote-${quote.id}`}
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="invoices" className="space-y-3">
            {invoicesLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                        <Skeleton className="h-6 w-20" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredInvoices.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Receipt className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="font-semibold mb-2">No invoices yet</h3>
                  <p className="text-muted-foreground text-sm mb-4">Create your first invoice to start getting paid</p>
                  <Button onClick={() => setLocation('/invoices/new')} data-testid="button-create-first-invoice">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Invoice
                  </Button>
                </CardContent>
              </Card>
            ) : (
              filteredInvoices.map((invoice) => {
                const isOverdue = invoice.status !== 'paid' && invoice.dueDate && isAfter(new Date(), parseISO(invoice.dueDate));
                return (
                  <Card 
                    key={invoice.id} 
                    className={`hover-elevate cursor-pointer ${isOverdue ? 'border-destructive/50' : ''}`}
                    onClick={() => setLocation(`/invoices/${invoice.id}`)}
                    data-testid={`card-invoice-${invoice.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{invoice.invoiceNumber}</span>
                            {getStatusBadge(isOverdue ? 'overdue' : invoice.status, 'invoice')}
                          </div>
                          <p className="text-sm text-muted-foreground">{invoice.client?.name || 'Unknown Client'}</p>
                          {invoice.dueDate && (
                            <p className={`text-xs ${isOverdue ? 'text-destructive' : 'text-muted-foreground'}`}>
                              Due: {format(parseISO(invoice.dueDate), 'dd MMM yyyy')}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold">${parseFloat(invoice.total || '0').toLocaleString()}</p>
                          <div className="flex gap-1 mt-2">
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={(e) => { e.stopPropagation(); setLocation(`/invoices/${invoice.id}`); }}
                              data-testid={`button-view-invoice-${invoice.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {invoice.status !== 'paid' && (
                              <Button 
                                size="sm" 
                                style={{ backgroundColor: 'hsl(var(--trade))' }}
                                onClick={(e) => { e.stopPropagation(); setLocation(`/collect-payment?invoiceId=${invoice.id}`); }}
                                data-testid={`button-collect-payment-${invoice.id}`}
                              >
                                <DollarSign className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          <TabsContent value="payments" className="space-y-3">
            {paymentsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                        <Skeleton className="h-6 w-20" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : payments.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <DollarSign className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="font-semibold mb-2">No payments yet</h3>
                  <p className="text-muted-foreground text-sm">Payments will appear here when invoices are paid</p>
                </CardContent>
              </Card>
            ) : (
              payments.map((payment) => (
                <Card 
                  key={payment.id} 
                  className="hover-elevate"
                  data-testid={`card-payment-${payment.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <span className="font-semibold">
                            {payment.invoice?.invoiceNumber || `Invoice #${payment.invoiceId}`}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {payment.invoice?.client?.name || 'Unknown Client'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(payment.paidAt), 'dd MMM yyyy, HH:mm')} via {payment.method}
                        </p>
                      </div>
                      <p className="text-lg font-bold text-green-600">
                        +${parseFloat(payment.amount || '0').toLocaleString()}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="reports" className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="hover-elevate cursor-pointer" data-testid="card-report-revenue">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    Revenue Report
                  </CardTitle>
                  <CardDescription>Monthly and yearly income breakdown</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full" onClick={() => setLocation('/reports')}>
                    <BarChart3 className="h-4 w-4 mr-2" />
                    View Report
                  </Button>
                </CardContent>
              </Card>

              <Card className="hover-elevate cursor-pointer" data-testid="card-report-jobs">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-blue-600" />
                    Jobs Report
                  </CardTitle>
                  <CardDescription>Job completion and status metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full" onClick={() => setLocation('/reports')}>
                    <BarChart3 className="h-4 w-4 mr-2" />
                    View Report
                  </Button>
                </CardContent>
              </Card>

              <Card className="hover-elevate cursor-pointer" data-testid="card-report-quotes">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-purple-600" />
                    Quote Conversion
                  </CardTitle>
                  <CardDescription>Quote acceptance rate and value</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full" onClick={() => setLocation('/reports')}>
                    <BarChart3 className="h-4 w-4 mr-2" />
                    View Report
                  </Button>
                </CardContent>
              </Card>

              <Card className="hover-elevate cursor-pointer" data-testid="card-report-export">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Download className="h-5 w-5 text-orange-600" />
                    Export Data
                  </CardTitle>
                  <CardDescription>Download reports as CSV or PDF</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full" onClick={() => setLocation('/reports')}>
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
