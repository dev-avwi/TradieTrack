import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  DollarSign, 
  TrendingUp, 
  FileText, 
  Users, 
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  Download,
  BarChart3,
  CreditCard,
  Wallet,
  ArrowUpRight,
  ExternalLink,
  RefreshCw,
  Banknote
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from "recharts";

interface ReportSummary {
  period: { start: string; end: string };
  revenue: {
    total: number;
    pending: number;
    overdue: number;
    gstCollected: number;
  };
  jobs: {
    total: number;
    completed: number;
    inProgress: number;
  };
  quotes: {
    total: number;
    accepted: number;
    pending: number;
    conversionRate: number;
  };
  invoices: {
    total: number;
    paid: number;
    unpaid: number;
    overdue: number;
  };
}

interface MonthlyRevenue {
  year: number;
  months: Array<{
    month: string;
    revenue: number;
    gst: number;
    invoicesPaid: number;
  }>;
  yearTotal: number;
  yearGst: number;
}

interface ClientReport {
  clients: Array<{
    id: string;
    name: string;
    email: string;
    phone: string;
    totalRevenue: number;
    outstandingBalance: number;
    jobsCompleted: number;
    invoicesPaid: number;
    invoicesOutstanding: number;
  }>;
  totals: {
    totalRevenue: number;
    totalOutstanding: number;
  };
}

interface StripePayment {
  id: string;
  amount: number;
  fee: number;
  net: number;
  status: string;
  paid: boolean;
  refunded: boolean;
  description: string;
  customer: string | null;
  paymentMethod: string;
  created: string;
  receiptUrl: string | null;
}

interface StripePayout {
  id: string;
  amount: number;
  status: string;
  arrivalDate: string | null;
  created: string;
  method: string;
  destination: string | null;
}

interface StripePaymentsReport {
  available: boolean;
  accountId?: string;
  message?: string;
  balance: {
    available: number;
    pending: number;
    currency: string;
  } | null;
  payments: StripePayment[];
  payouts: StripePayout[];
  totals?: {
    totalRevenue: number;
    totalFees: number;
    totalNet: number;
    paymentCount: number;
    refundedAmount: number;
  };
  period?: {
    start: string;
    end: string;
  };
}

const CHART_COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];

export default function Reports() {
  const [, navigate] = useLocation();
  const [dateRange, setDateRange] = useState<'ytd' | 'month' | 'quarter' | 'year'>('ytd');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());

  const getDateRange = () => {
    const now = new Date();
    let start: Date;
    
    switch (dateRange) {
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter':
        const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
        start = new Date(now.getFullYear(), quarterMonth, 1);
        break;
      case 'year':
        start = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        break;
      case 'ytd':
      default:
        start = new Date(now.getFullYear(), 0, 1);
        break;
    }
    
    return { startDate: start.toISOString(), endDate: now.toISOString() };
  };

  const { data: summary, isLoading: summaryLoading, error: summaryError } = useQuery<ReportSummary>({
    queryKey: ['/api/reports/summary', dateRange],
    queryFn: async () => {
      const range = getDateRange();
      const res = await fetch(`/api/reports/summary?startDate=${range.startDate}&endDate=${range.endDate}`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch summary');
      return res.json();
    },
    retry: 1,
  });

  const { data: revenueData, isLoading: revenueLoading } = useQuery<MonthlyRevenue>({
    queryKey: ['/api/reports/revenue', selectedYear],
    queryFn: async () => {
      const res = await fetch(`/api/reports/revenue?year=${selectedYear}`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch revenue');
      return res.json();
    },
    retry: 1,
  });

  const { data: clientData, isLoading: clientsLoading } = useQuery<ClientReport>({
    queryKey: ['/api/reports/clients'],
    queryFn: async () => {
      const res = await fetch('/api/reports/clients?limit=10', {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch clients');
      return res.json();
    },
    retry: 1,
  });

  const { data: stripeData, isLoading: stripeLoading, refetch: refetchStripe } = useQuery<StripePaymentsReport>({
    queryKey: ['/api/reports/stripe-payments', dateRange],
    queryFn: async () => {
      const range = getDateRange();
      const res = await fetch(`/api/reports/stripe-payments?startDate=${range.startDate}&endDate=${range.endDate}`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch Stripe payments');
      return res.json();
    },
    retry: 1,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const jobPieData = summary ? [
    { name: 'Completed', value: summary.jobs.completed, color: 'hsl(var(--chart-1))' },
    { name: 'In Progress', value: summary.jobs.inProgress, color: 'hsl(var(--chart-2))' },
    { name: 'Other', value: summary.jobs.total - summary.jobs.completed - summary.jobs.inProgress, color: 'hsl(var(--chart-3))' },
  ].filter(d => d.value > 0) : [];

  return (
    <PageShell>
      <PageHeader
        title="Reports"
        subtitle="Business performance insights and analytics"
        leading={<BarChart3 className="h-6 w-6" />}
      />
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <Select value={dateRange} onValueChange={(v: any) => setDateRange(v)}>
            <SelectTrigger className="w-[180px]" data-testid="select-date-range">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="quarter">This Quarter</SelectItem>
              <SelectItem value="ytd">Year to Date</SelectItem>
              <SelectItem value="year">Last 12 Months</SelectItem>
            </SelectContent>
          </Select>
          
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => navigate('/job-profitability')} data-testid="button-job-profitability">
              <TrendingUp className="h-4 w-4 mr-2" />
              Job Profitability
            </Button>
            <Button variant="outline" data-testid="button-export-report">
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="text-2xl font-bold" data-testid="text-total-revenue">
                    {summaryLoading ? '...' : formatCurrency(summary?.revenue.total || 0)}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Incl. GST: {formatCurrency(summary?.revenue.gstCollected || 0)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold" data-testid="text-pending-revenue">
                    {summaryLoading ? '...' : formatCurrency(summary?.revenue.pending || 0)}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-yellow-100 dark:bg-yellow-900/20 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {summary?.invoices.unpaid || 0} unpaid invoices
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Overdue</p>
                  <p className="text-2xl font-bold text-red-600" data-testid="text-overdue-revenue">
                    {summaryLoading ? '...' : formatCurrency(summary?.revenue.overdue || 0)}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {summary?.invoices.overdue || 0} overdue invoices
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Quote Conversion</p>
                  <p className="text-2xl font-bold" data-testid="text-conversion-rate">
                    {summaryLoading ? '...' : `${(summary?.quotes.conversionRate || 0).toFixed(0)}%`}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {summary?.quotes.accepted || 0} of {summary?.quotes.total || 0} quotes
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="revenue" className="w-full">
          <TabsList className="grid w-full grid-cols-4 max-w-lg">
            <TabsTrigger value="revenue" data-testid="tab-revenue">Revenue</TabsTrigger>
            <TabsTrigger value="payments" data-testid="tab-payments">Payments</TabsTrigger>
            <TabsTrigger value="jobs" data-testid="tab-jobs">Jobs</TabsTrigger>
            <TabsTrigger value="clients" data-testid="tab-clients">Clients</TabsTrigger>
          </TabsList>

          <TabsContent value="revenue" className="mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle>Monthly Revenue</CardTitle>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-[100px]" data-testid="select-year">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2025">2025</SelectItem>
                    <SelectItem value="2024">2024</SelectItem>
                    <SelectItem value="2023">2023</SelectItem>
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueData?.months || []}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="month" 
                        className="text-xs"
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <YAxis 
                        className="text-xs"
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        tickFormatter={(value) => `$${(value/1000).toFixed(0)}k`}
                      />
                      <Tooltip 
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                      <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 flex gap-8 justify-center text-sm text-muted-foreground">
                  <div>
                    <span className="font-medium text-foreground">Total: </span>
                    {formatCurrency(revenueData?.yearTotal || 0)}
                  </div>
                  <div>
                    <span className="font-medium text-foreground">GST: </span>
                    {formatCurrency(revenueData?.yearGst || 0)}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments" className="mt-6">
            <div className="space-y-6">
              {stripeLoading ? (
                <Card>
                  <CardContent className="flex items-center justify-center py-12">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  </CardContent>
                </Card>
              ) : !stripeData?.available ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <div className="rounded-full bg-muted p-4 mb-4">
                      <CreditCard className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">Stripe Not Connected</h3>
                    <p className="text-muted-foreground text-center mb-4 max-w-sm">
                      {stripeData?.message || 'Connect your Stripe account to see payment data'}
                    </p>
                    <Button onClick={() => navigate('/integrations')} data-testid="button-connect-stripe">
                      Connect Stripe
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Available</p>
                            <p className="text-2xl font-bold text-green-600" data-testid="text-stripe-available">
                              {formatCurrency(stripeData?.balance?.available || 0)}
                            </p>
                          </div>
                          <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                            <Wallet className="h-5 w-5 text-green-600 dark:text-green-400" />
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Ready to transfer to bank
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Pending</p>
                            <p className="text-2xl font-bold" data-testid="text-stripe-pending">
                              {formatCurrency(stripeData?.balance?.pending || 0)}
                            </p>
                          </div>
                          <div className="h-10 w-10 rounded-full bg-yellow-100 dark:bg-yellow-900/20 flex items-center justify-center">
                            <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Being processed
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Net Revenue</p>
                            <p className="text-2xl font-bold" data-testid="text-stripe-net">
                              {formatCurrency(stripeData?.totals?.totalNet || 0)}
                            </p>
                          </div>
                          <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                            <Banknote className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          After Stripe fees
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Payments</p>
                            <p className="text-2xl font-bold" data-testid="text-stripe-count">
                              {stripeData?.totals?.paymentCount || 0}
                            </p>
                          </div>
                          <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
                            <CreditCard className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Total: {formatCurrency(stripeData?.totals?.totalRevenue || 0)}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid gap-6 md:grid-cols-2">
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between gap-2">
                        <CardTitle>Recent Payments</CardTitle>
                        <Button variant="ghost" size="icon" onClick={() => refetchStripe()} data-testid="button-refresh-payments">
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </CardHeader>
                      <CardContent>
                        {stripeData?.payments?.length === 0 ? (
                          <p className="text-muted-foreground text-center py-6">No payments in this period</p>
                        ) : (
                          <div className="space-y-3">
                            {stripeData?.payments?.slice(0, 5).map((payment) => (
                              <div key={payment.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                                <div className="flex items-center gap-3">
                                  <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                                    <DollarSign className="h-5 w-5 text-green-600" />
                                  </div>
                                  <div>
                                    <p className="font-medium">{payment.customer || 'Customer'}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {format(new Date(payment.created), 'MMM d, yyyy h:mm a')}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="font-semibold text-green-600">{formatCurrency(payment.amount)}</p>
                                  <div className="flex items-center gap-1">
                                    {payment.refunded ? (
                                      <Badge variant="destructive" className="text-xs">Refunded</Badge>
                                    ) : payment.paid ? (
                                      <Badge className="bg-green-600 text-xs">Paid</Badge>
                                    ) : (
                                      <Badge variant="secondary" className="text-xs">{payment.status}</Badge>
                                    )}
                                    {payment.receiptUrl && (
                                      <a href={payment.receiptUrl} target="_blank" rel="noopener noreferrer">
                                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                                      </a>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Recent Payouts</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {stripeData?.payouts?.length === 0 ? (
                          <p className="text-muted-foreground text-center py-6">No payouts yet</p>
                        ) : (
                          <div className="space-y-3">
                            {stripeData?.payouts?.slice(0, 5).map((payout) => (
                              <div key={payout.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                                <div className="flex items-center gap-3">
                                  <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                                    <ArrowUpRight className="h-5 w-5 text-blue-600" />
                                  </div>
                                  <div>
                                    <p className="font-medium">Bank Transfer</p>
                                    <p className="text-xs text-muted-foreground">
                                      {payout.destination ? `To ${payout.destination}` : 'To bank account'}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="font-semibold">{formatCurrency(payout.amount)}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {payout.arrivalDate 
                                      ? format(new Date(payout.arrivalDate), 'MMM d, yyyy') 
                                      : payout.status}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {stripeData?.totals && stripeData.totals.totalFees > 0 && (
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Processing Fees (2.5% platform + Stripe)</span>
                          <span className="font-medium text-yellow-600">
                            -{formatCurrency(stripeData.totals.totalFees)}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="jobs" className="mt-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Job Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={jobPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {jobPieData.map((entry, index) => (
                            <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex justify-center gap-6 mt-4">
                    {jobPieData.map((item, index) => (
                      <div key={item.name} className="flex items-center gap-2">
                        <div 
                          className="h-3 w-3 rounded-full" 
                          style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                        />
                        <span className="text-sm text-muted-foreground">
                          {item.name}: {item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Job Metrics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span>Jobs Completed</span>
                    </div>
                    <span className="text-xl font-semibold" data-testid="text-jobs-completed">
                      {summary?.jobs.completed || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Clock className="h-5 w-5 text-blue-600" />
                      <span>In Progress</span>
                    </div>
                    <span className="text-xl font-semibold" data-testid="text-jobs-in-progress">
                      {summary?.jobs.inProgress || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-purple-600" />
                      <span>Total Jobs</span>
                    </div>
                    <span className="text-xl font-semibold" data-testid="text-jobs-total">
                      {summary?.jobs.total || 0}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="clients" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Top Clients by Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2 font-medium text-muted-foreground">Client</th>
                        <th className="text-right py-3 px-2 font-medium text-muted-foreground">Revenue</th>
                        <th className="text-right py-3 px-2 font-medium text-muted-foreground hidden sm:table-cell">Outstanding</th>
                        <th className="text-right py-3 px-2 font-medium text-muted-foreground hidden md:table-cell">Jobs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientData?.clients.map((client) => (
                        <tr 
                          key={client.id} 
                          className="border-b hover-elevate cursor-pointer" 
                          onClick={() => navigate(`/clients/${client.id}`)}
                          data-testid={`row-client-${client.id}`}
                        >
                          <td className="py-3 px-2">
                            <div>
                              <p className="font-medium text-primary hover:underline">{client.name}</p>
                              <p className="text-xs text-muted-foreground">{client.email}</p>
                            </div>
                          </td>
                          <td className="text-right py-3 px-2 font-medium text-green-600">
                            {formatCurrency(client.totalRevenue)}
                          </td>
                          <td className="text-right py-3 px-2 hidden sm:table-cell">
                            {client.outstandingBalance > 0 ? (
                              <span className="text-yellow-600">{formatCurrency(client.outstandingBalance)}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="text-right py-3 px-2 hidden md:table-cell">
                            {client.jobsCompleted}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {clientData && (
                  <div className="mt-4 pt-4 border-t flex gap-8 justify-end text-sm">
                    <div>
                      <span className="text-muted-foreground">Total Revenue: </span>
                      <span className="font-semibold text-green-600">
                        {formatCurrency(clientData.totals.totalRevenue)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total Outstanding: </span>
                      <span className="font-semibold text-yellow-600">
                        {formatCurrency(clientData.totals.totalOutstanding)}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PageShell>
  );
}
