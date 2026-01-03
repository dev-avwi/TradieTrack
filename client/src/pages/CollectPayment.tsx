import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { useLocation, useSearch } from "wouter";
import { useIntegrationHealth, isStripeReady } from "@/hooks/use-integration-health";
import { 
  QrCode, 
  Link2, 
  Mail, 
  Copy, 
  Check, 
  Plus, 
  Loader2, 
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  Share2,
  Wifi,
  CreditCard,
  FileText,
  Banknote,
  Receipt,
  ArrowRight,
  AlertTriangle,
  TrendingUp,
  Zap,
  Smartphone
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface PaymentRequest {
  id: string;
  amount: string;
  gstAmount: string;
  description: string;
  reference: string | null;
  status: 'pending' | 'paid' | 'cancelled' | 'expired';
  token: string;
  expiresAt: string | null;
  paidAt: string | null;
  paymentMethod: string | null;
  createdAt: string;
  paymentUrl?: string;
  clientId?: string | null;
  invoiceId?: string | null;
  jobId?: string | null;
}

interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

interface Invoice {
  id: string;
  number: string;
  title: string;
  total: string;
  status: string;
  clientId: string;
  jobId?: string | null;
  dueDate?: string | null;
}

interface Job {
  id: string;
  title: string;
  address?: string | null;
  clientId?: string | null;
  status: string;
}

interface Receipt {
  id: string;
  receiptNumber: string;
  amount: string;
  gstAmount?: string | null;
  paymentMethod: string;
  paymentReference?: string | null;
  paidAt: string | null;
  clientId?: string | null;
  invoiceId?: string | null;
  jobId?: string | null;
  notes?: string | null;
  createdAt: string;
}

export default function CollectPayment() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const { data: integrationHealth } = useIntegrationHealth();
  const stripeConnected = isStripeReady(integrationHealth);
  
  // Track if we've processed URL params to avoid re-opening dialogs
  const [urlParamsProcessed, setUrlParamsProcessed] = useState(false);
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showRecordPaymentDialog, setShowRecordPaymentDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [showTapToPayDialog, setShowTapToPayDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<PaymentRequest | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("qr");
  
  const [newAmount, setNewAmount] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newReference, setNewReference] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>("");
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [expiresInHours, setExpiresInHours] = useState("24");
  
  const [recordAmount, setRecordAmount] = useState("");
  const [recordInvoiceId, setRecordInvoiceId] = useState("");
  const [recordPaymentMethod, setRecordPaymentMethod] = useState("cash");
  const [recordReference, setRecordReference] = useState("");
  const [recordNotes, setRecordNotes] = useState("");
  
  const [receiptAmount, setReceiptAmount] = useState("");
  const [receiptDescription, setReceiptDescription] = useState("");
  const [receiptPaymentMethod, setReceiptPaymentMethod] = useState("cash");
  const [receiptReference, setReceiptReference] = useState("");
  const [receiptClientId, setReceiptClientId] = useState<string | null>(null);
  const [receiptInvoiceId, setReceiptInvoiceId] = useState<string | null>(null);
  const [receiptJobId, setReceiptJobId] = useState<string>("");
  
  const [sharePhone, setSharePhone] = useState("");
  const [shareEmail, setShareEmail] = useState("");
  
  const [tapToPayAmount, setTapToPayAmount] = useState("");
  const [tapToPayDescription, setTapToPayDescription] = useState("");
  const [tapToPayRequest, setTapToPayRequest] = useState<PaymentRequest | null>(null);

  const { data: paymentRequests, isLoading } = useQuery<PaymentRequest[]>({
    queryKey: ['/api/payment-requests'],
  });

  const { data: clients } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
  });

  const { data: invoices } = useQuery<Invoice[]>({
    queryKey: ['/api/invoices'],
  });

  const { data: jobs } = useQuery<Job[]>({
    queryKey: ['/api/jobs'],
  });

  const { data: receipts } = useQuery<Receipt[]>({
    queryKey: ['/api/receipts'],
  });

  const unpaidInvoices = invoices?.filter(inv => inv.status !== 'paid') || [];

  useEffect(() => {
    if (selectedInvoiceId && invoices) {
      const invoice = invoices.find(inv => inv.id === selectedInvoiceId);
      if (invoice) {
        const totalStr = typeof invoice.total === 'number' 
          ? invoice.total.toFixed(2) 
          : String(invoice.total || '0.00');
        setNewAmount(totalStr);
        setNewDescription(`Payment for ${invoice.number}: ${invoice.title}`);
        setNewReference(invoice.number);
        setSelectedClientId(invoice.clientId);
        if (invoice.jobId && !selectedJobId) setSelectedJobId(invoice.jobId);
      }
    }
  }, [selectedInvoiceId, invoices]);

  useEffect(() => {
    if (recordInvoiceId && invoices) {
      const invoice = invoices.find(inv => inv.id === recordInvoiceId);
      if (invoice) {
        const totalStr = typeof invoice.total === 'number' 
          ? invoice.total.toFixed(2) 
          : String(invoice.total || '0.00');
        setRecordAmount(totalStr);
        setRecordReference(invoice.number);
      }
    }
  }, [recordInvoiceId, invoices]);

  useEffect(() => {
    if (receiptInvoiceId && invoices) {
      const invoice = invoices.find(inv => inv.id === receiptInvoiceId);
      if (invoice) {
        const totalStr = typeof invoice.total === 'number' 
          ? invoice.total.toFixed(2) 
          : String(invoice.total || '0.00');
        setReceiptAmount(totalStr);
        setReceiptDescription(`Payment for ${invoice.number}: ${invoice.title}`);
        setReceiptReference(invoice.number);
        setReceiptClientId(invoice.clientId);
        if (invoice.jobId && !receiptJobId) setReceiptJobId(invoice.jobId);
      }
    }
  }, [receiptInvoiceId, invoices]);

  // Handle URL parameters from job detail navigation
  useEffect(() => {
    if (urlParamsProcessed || !invoices) return;
    
    const params = new URLSearchParams(searchString);
    const invoiceId = params.get('invoiceId');
    const jobId = params.get('jobId');
    const method = params.get('method');
    
    if (invoiceId) {
      const invoice = invoices.find(inv => inv.id === invoiceId);
      if (invoice) {
        const totalStr = typeof invoice.total === 'number' 
          ? invoice.total.toFixed(2) 
          : String(invoice.total || '0.00');
        
        // Pre-fill data for tap to pay
        setTapToPayAmount(totalStr);
        setTapToPayDescription(`Payment for ${invoice.number}: ${invoice.title}`);
        
        // Also set up create dialog data
        setSelectedInvoiceId(invoiceId);
        if (jobId) setSelectedJobId(jobId);
        
        // Open the appropriate dialog based on method parameter
        if (method === 'qr') {
          setShowTapToPayDialog(true);
        } else if (method === 'link') {
          setShowCreateDialog(true);
        } else {
          // Default to tap to pay
          setShowTapToPayDialog(true);
        }
        
        setUrlParamsProcessed(true);
      }
    }
  }, [searchString, invoices, urlParamsProcessed]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/payment-requests', data);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/payment-requests'] });
      setShowCreateDialog(false);
      resetCreateForm();
      setSelectedRequest(data);
      setShowShareDialog(true);
      toast({
        title: "Payment request created",
        description: "Share the QR code or link with your customer",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create payment request",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const tapToPayMutation = useMutation({
    mutationFn: async (data: { amount: string; description: string }) => {
      const parsedAmount = parseFloat(data.amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        throw new Error('Please enter a valid amount');
      }
      const response = await apiRequest('POST', '/api/payment-requests', {
        amount: parsedAmount,
        description: data.description.trim() || 'QR Payment',
        expiresInHours: 1,
      });
      const result = await response.json();
      if (!result.paymentUrl && !result.token) {
        throw new Error('Payment request created but URL not available');
      }
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/payment-requests'] });
      setTapToPayRequest(data);
      toast({
        title: "Ready for payment",
        description: "Show the QR code to your customer",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create payment request",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('POST', `/api/payment-requests/${id}/cancel`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/payment-requests'] });
      toast({ title: "Payment request cancelled" });
    },
  });

  const recordPaymentMutation = useMutation({
    mutationFn: async (data: { invoiceId: string; amount: string; paymentMethod: string; reference?: string; notes?: string }) => {
      const response = await apiRequest('POST', `/api/invoices/${data.invoiceId}/record-payment`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      queryClient.invalidateQueries({ queryKey: ['/api/payment-requests'] });
      setShowRecordPaymentDialog(false);
      resetRecordForm();
      toast({
        title: "Payment recorded",
        description: "Invoice has been marked as paid",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to record payment",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const sendEmailMutation = useMutation({
    mutationFn: async ({ id, email }: { id: string; email: string }) => {
      await apiRequest('POST', `/api/payment-requests/${id}/send-email`, { email });
    },
    onSuccess: () => {
      setShareEmail("");
      toast({
        title: "Email sent",
        description: "Payment link sent via email",
      });
    },
    onError: () => {
      toast({
        title: "Failed to send email",
        variant: "destructive",
      });
    },
  });

  const receiptMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/receipts', data);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/receipts'] });
      setShowReceiptDialog(false);
      resetReceiptForm();
      toast({
        title: "Receipt generated",
        description: `Receipt ${data.receiptNumber} created`,
      });
      navigate(`/receipts/${data.id}`);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to generate receipt",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const resetCreateForm = () => {
    setNewAmount("");
    setNewDescription("");
    setNewReference("");
    setSelectedClientId("");
    setSelectedInvoiceId("");
    setSelectedJobId("");
    setExpiresInHours("24");
  };

  const resetRecordForm = () => {
    setRecordAmount("");
    setRecordInvoiceId("");
    setRecordPaymentMethod("cash");
    setRecordReference("");
    setRecordNotes("");
  };

  const resetReceiptForm = () => {
    setReceiptAmount("");
    setReceiptDescription("");
    setReceiptPaymentMethod("cash");
    setReceiptReference("");
    setReceiptClientId(null);
    setReceiptInvoiceId(null);
    setReceiptJobId("");
  };

  const getPaymentUrl = (request: PaymentRequest) => {
    if (request.paymentUrl) return request.paymentUrl;
    const baseUrl = window.location.origin;
    return `${baseUrl}/pay/${request.token}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copied to clipboard" });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">Pending</Badge>;
      case 'paid':
        return <Badge className="bg-emerald-500">Paid</Badge>;
      case 'cancelled':
        return <Badge variant="secondary">Cancelled</Badge>;
      case 'expired':
        return <Badge variant="destructive">Expired</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getInvoiceNumber = (invoiceId: string | null | undefined) => {
    if (!invoiceId || !invoices) return null;
    const invoice = invoices.find(i => i.id === invoiceId);
    return invoice?.number;
  };

  const pendingRequests = paymentRequests?.filter(r => r.status === 'pending') || [];
  const completedRequests = paymentRequests?.filter(r => r.status !== 'pending') || [];
  
  const totalPending = pendingRequests.reduce((sum, r) => sum + parseFloat(r.amount), 0);
  const totalReceived = completedRequests.filter(r => r.status === 'paid').reduce((sum, r) => sum + parseFloat(r.amount), 0);

  return (
    <PageShell>
      <PageHeader
        title="Collect Payment"
        subtitle="Get paid on-site or send payment links"
        leading={<DollarSign className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />}
      />

      {/* Stripe Warning - Compact */}
      {!stripeConnected && (
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 mb-6" data-testid="banner-stripe-warning">
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
              <span className="text-sm font-medium text-amber-700 dark:text-amber-300">Connect Stripe to accept card payments</span>
            </div>
            <Button size="sm" variant="outline" onClick={() => navigate('/integrations')} data-testid="button-setup-stripe">
              Connect
            </Button>
          </CardContent>
        </Card>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card data-testid="kpi-outstanding">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold" style={{ color: 'hsl(var(--trade))' }}>${totalPending.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">Outstanding</p>
          </CardContent>
        </Card>
        <Card data-testid="kpi-pending-count">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{pendingRequests.length}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card data-testid="kpi-received">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">${totalReceived.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">Received</p>
          </CardContent>
        </Card>
      </div>

      {/* Primary Action - Unified Payment Collection Card */}
      <Card className="mb-6 border-2" style={{ borderColor: 'hsl(var(--trade))' }} data-testid="card-collect-payment">
        <CardContent className="p-5">
          {/* Header with Payment Method Selector */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="rounded-xl p-3" style={{ backgroundColor: 'hsl(var(--trade))' }}>
                <CreditCard className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Collect Payment</h3>
                <p className="text-sm text-muted-foreground">Get paid in-person or remotely</p>
              </div>
            </div>
          </div>

          {/* Payment Method Toggle */}
          <Tabs defaultValue="tap" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="tap" className="gap-2" data-testid="tab-tap-to-pay">
                <Smartphone className="h-4 w-4" />
                Tap to Pay
              </TabsTrigger>
              <TabsTrigger value="qr" className="gap-2" data-testid="tab-qr-code">
                <QrCode className="h-4 w-4" />
                QR Code
              </TabsTrigger>
              <TabsTrigger value="link" className="gap-2" data-testid="tab-send-link">
                <Link2 className="h-4 w-4" />
                Send Link
              </TabsTrigger>
            </TabsList>

            {/* Tap to Pay Content */}
            <TabsContent value="tap" className="space-y-4">
              <div className="text-center py-6 bg-muted/30 rounded-lg">
                <div className="rounded-full p-4 mx-auto w-fit mb-3" style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}>
                  <Smartphone className="h-10 w-10" style={{ color: 'hsl(var(--trade))' }} />
                </div>
                <h4 className="font-medium mb-1">Contactless Payment</h4>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  Customer taps their card or phone on your device to pay instantly
                </p>
                <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <span>Requires iPhone XS+ with Stripe Terminal SDK</span>
                </div>
              </div>
              <Button 
                className="w-full h-12 text-base" 
                style={{ backgroundColor: 'hsl(var(--trade))', color: 'white' }}
                onClick={() => setShowTapToPayDialog(true)}
                disabled={!stripeConnected}
                data-testid="button-start-tap-to-pay"
              >
                <Smartphone className="h-5 w-5 mr-2" />
                Start Tap to Pay
              </Button>
              {!stripeConnected && (
                <p className="text-xs text-center text-amber-600">Connect Stripe to enable Tap to Pay</p>
              )}
            </TabsContent>

            {/* QR Code Content */}
            <TabsContent value="qr" className="space-y-4">
              <div className="text-center py-6 bg-muted/30 rounded-lg">
                <div className="rounded-full p-4 mx-auto w-fit mb-3" style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}>
                  <QrCode className="h-10 w-10" style={{ color: 'hsl(var(--trade))' }} />
                </div>
                <h4 className="font-medium mb-1">QR Code Payment</h4>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  Show a QR code for customer to scan and pay from their phone
                </p>
              </div>
              <Button 
                className="w-full h-12 text-base" 
                style={{ backgroundColor: 'hsl(var(--trade))', color: 'white' }}
                onClick={() => setShowTapToPayDialog(true)}
                disabled={!stripeConnected}
                data-testid="button-show-qr"
              >
                <QrCode className="h-5 w-5 mr-2" />
                Generate QR Code
              </Button>
            </TabsContent>

            {/* Send Link Content */}
            <TabsContent value="link" className="space-y-4">
              <div className="text-center py-6 bg-muted/30 rounded-lg">
                <div className="rounded-full p-4 mx-auto w-fit mb-3" style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}>
                  <Link2 className="h-10 w-10" style={{ color: 'hsl(var(--trade))' }} />
                </div>
                <h4 className="font-medium mb-1">Payment Link</h4>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  Create a payment link to send via email, SMS, or copy to clipboard
                </p>
              </div>
              <Button 
                className="w-full h-12 text-base" 
                style={{ backgroundColor: 'hsl(var(--trade))', color: 'white' }}
                onClick={() => setShowCreateDialog(true)}
                disabled={!stripeConnected}
                data-testid="button-create-link"
              >
                <Plus className="h-5 w-5 mr-2" />
                Create Payment Link
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Secondary Action - Record Manual Payment */}
      <Card 
        className="mb-6 hover-elevate cursor-pointer" 
        onClick={() => setShowRecordPaymentDialog(true)}
        data-testid="card-record-payment"
      >
        <CardContent className="p-4 flex items-center gap-3">
          <div className="rounded-lg p-2 bg-emerald-100 dark:bg-emerald-900/30">
            <Banknote className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="flex-1">
            <p className="font-medium">Record Manual Payment</p>
            <p className="text-xs text-muted-foreground">Cash, bank transfer, or other payment method</p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </CardContent>
      </Card>

      {/* Active Requests */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : pendingRequests.length === 0 && completedRequests.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="rounded-full bg-muted p-4 mb-4">
                <QrCode className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No payment requests yet</h3>
              <p className="text-muted-foreground text-center mb-4 max-w-sm text-sm">
                Create your first payment request to get started
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {pendingRequests.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">ACTIVE REQUESTS</h3>
                <div className="space-y-2">
                  {pendingRequests.map((request) => (
                    <Card key={request.id} className="hover-elevate" data-testid={`request-${request.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="font-bold text-lg">${parseFloat(request.amount).toFixed(2)}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
                              </p>
                            </div>
                            <div className="h-10 w-px bg-border" />
                            <div>
                              <p className="text-sm font-medium truncate max-w-[200px]">{request.description}</p>
                              {request.invoiceId && (
                                <p className="text-xs text-muted-foreground">{getInvoiceNumber(request.invoiceId)}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedRequest(request);
                                setShowShareDialog(true);
                              }}
                              data-testid={`button-share-${request.id}`}
                            >
                              <Share2 className="h-4 w-4 mr-1" />
                              Share
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => cancelMutation.mutate(request.id)}
                              data-testid={`button-cancel-${request.id}`}
                            >
                              <XCircle className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {completedRequests.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">HISTORY</h3>
                <Card>
                  <CardContent className="p-0">
                    {completedRequests.slice(0, 5).map((request, index) => (
                      <div 
                        key={request.id} 
                        className={`flex items-center justify-between p-4 ${index !== completedRequests.slice(0, 5).length - 1 ? 'border-b' : ''}`}
                      >
                        <div className="flex items-center gap-3">
                          {request.status === 'paid' ? (
                            <CheckCircle className="h-5 w-5 text-emerald-500" />
                          ) : (
                            <XCircle className="h-5 w-5 text-muted-foreground" />
                          )}
                          <div>
                            <p className="text-sm font-medium">${parseFloat(request.amount).toFixed(2)}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">{request.description}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          {getStatusBadge(request.status)}
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(request.createdAt), 'MMM d')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                {completedRequests.length > 5 && (
                  <Button variant="ghost" className="w-full mt-2" onClick={() => navigate('/reports')}>
                    View all {completedRequests.length} payments
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* QR Payment Dialog */}
      <Dialog open={showTapToPayDialog} onOpenChange={(open) => {
        if (!open) {
          setShowTapToPayDialog(false);
          setTapToPayAmount("");
          setTapToPayDescription("");
          setTapToPayRequest(null);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
              QR Payment
            </DialogTitle>
            <DialogDescription>
              Generate a QR code for customer to scan and pay
            </DialogDescription>
          </DialogHeader>

          {!tapToPayRequest ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Amount</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={tapToPayAmount}
                    onChange={(e) => setTapToPayAmount(e.target.value)}
                    className="pl-8 text-2xl font-bold h-14"
                    autoFocus
                    data-testid="input-tap-to-pay-amount"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description (optional)</Label>
                <Input
                  placeholder="What's this for?"
                  value={tapToPayDescription}
                  onChange={(e) => setTapToPayDescription(e.target.value)}
                  data-testid="input-tap-to-pay-description"
                />
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setShowTapToPayDialog(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => tapToPayMutation.mutate({
                    amount: tapToPayAmount,
                    description: tapToPayDescription,
                  })}
                  disabled={!tapToPayAmount || parseFloat(tapToPayAmount) <= 0 || tapToPayMutation.isPending}
                  data-testid="button-create-tap-to-pay"
                >
                  {tapToPayMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <QrCode className="h-4 w-4 mr-2" />
                      Show QR
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-center p-4 rounded-lg" style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}>
                <p className="text-3xl font-bold" style={{ color: 'hsl(var(--trade))' }}>
                  ${parseFloat(tapToPayRequest.amount).toFixed(2)}
                </p>
              </div>

              <div className="flex flex-col items-center">
                <div className="bg-white p-4 rounded-lg shadow-inner">
                  <QRCodeSVG
                    value={getPaymentUrl(tapToPayRequest)}
                    size={180}
                    level="H"
                    includeMargin={true}
                  />
                </div>
                <p className="text-sm text-muted-foreground text-center mt-3">
                  Customer scans to pay
                </p>
              </div>

              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>Expires in 1 hour</span>
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setTapToPayRequest(null);
                    setTapToPayAmount("");
                    setTapToPayDescription("");
                  }}
                >
                  New Payment
                </Button>
                <Button
                  variant="outline"
                  onClick={() => copyToClipboard(getPaymentUrl(tapToPayRequest))}
                >
                  {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                  Copy Link
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Request Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Payment Request</DialogTitle>
            <DialogDescription>
              Create a payment link to send to your customer
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Link to Invoice (optional)</Label>
              <Select value={selectedInvoiceId} onValueChange={setSelectedInvoiceId}>
                <SelectTrigger data-testid="select-invoice">
                  <SelectValue placeholder="Select invoice to auto-fill" />
                </SelectTrigger>
                <SelectContent>
                  {unpaidInvoices.map((invoice) => (
                    <SelectItem key={invoice.id} value={invoice.id}>
                      {invoice.number} - ${typeof invoice.total === 'number' ? invoice.total.toFixed(2) : invoice.total}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  className="pl-8"
                  data-testid="input-amount"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                placeholder="Payment for services"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                data-testid="input-description"
              />
            </div>

            <div className="space-y-2">
              <Label>Reference (optional)</Label>
              <Input
                placeholder="Invoice number or reference"
                value={newReference}
                onChange={(e) => setNewReference(e.target.value)}
                data-testid="input-reference"
              />
            </div>

            <div className="space-y-2">
              <Label>Expires in</Label>
              <Select value={expiresInHours} onValueChange={setExpiresInHours}>
                <SelectTrigger data-testid="select-expiry">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 hour</SelectItem>
                  <SelectItem value="24">24 hours</SelectItem>
                  <SelectItem value="72">3 days</SelectItem>
                  <SelectItem value="168">7 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate({
                amount: parseFloat(newAmount),
                description: newDescription,
                reference: newReference || undefined,
                clientId: selectedClientId || undefined,
                invoiceId: selectedInvoiceId || undefined,
                jobId: selectedJobId || undefined,
                expiresInHours: parseInt(expiresInHours),
              })}
              disabled={!newAmount || !newDescription || createMutation.isPending}
              data-testid="button-create-request"
            >
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Create Request"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog open={showRecordPaymentDialog} onOpenChange={setShowRecordPaymentDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Record a cash or bank transfer payment
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Invoice</Label>
              <Select value={recordInvoiceId} onValueChange={setRecordInvoiceId}>
                <SelectTrigger data-testid="select-record-invoice">
                  <SelectValue placeholder="Select invoice" />
                </SelectTrigger>
                <SelectContent>
                  {unpaidInvoices.map((invoice) => (
                    <SelectItem key={invoice.id} value={invoice.id}>
                      {invoice.number} - ${typeof invoice.total === 'number' ? invoice.total.toFixed(2) : invoice.total}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={recordAmount}
                  onChange={(e) => setRecordAmount(e.target.value)}
                  className="pl-8"
                  data-testid="input-record-amount"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={recordPaymentMethod} onValueChange={setRecordPaymentMethod}>
                <SelectTrigger data-testid="select-payment-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Reference (optional)</Label>
              <Input
                placeholder="Transaction reference"
                value={recordReference}
                onChange={(e) => setRecordReference(e.target.value)}
                data-testid="input-record-reference"
              />
            </div>

            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="Add any notes"
                value={recordNotes}
                onChange={(e) => setRecordNotes(e.target.value)}
                data-testid="input-record-notes"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRecordPaymentDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => recordPaymentMutation.mutate({
                invoiceId: recordInvoiceId,
                amount: recordAmount,
                paymentMethod: recordPaymentMethod,
                reference: recordReference || undefined,
                notes: recordNotes || undefined,
              })}
              disabled={!recordInvoiceId || !recordAmount || recordPaymentMutation.isPending}
              data-testid="button-record-submit"
            >
              {recordPaymentMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Record Payment"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Share Payment Link</DialogTitle>
            <DialogDescription>
              ${selectedRequest ? parseFloat(selectedRequest.amount).toFixed(2) : '0.00'} - {selectedRequest?.description}
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="qr">QR Code</TabsTrigger>
                <TabsTrigger value="link">Link</TabsTrigger>
                <TabsTrigger value="send">Send</TabsTrigger>
              </TabsList>

              <TabsContent value="qr" className="mt-4">
                <div className="flex flex-col items-center">
                  <div className="bg-white p-4 rounded-lg shadow-inner">
                    <QRCodeSVG
                      value={getPaymentUrl(selectedRequest)}
                      size={180}
                      level="H"
                      includeMargin={true}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground text-center mt-4">
                    Customer scans this code with their phone camera to pay
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="link" className="mt-4">
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      value={getPaymentUrl(selectedRequest)}
                      readOnly
                      className="font-mono text-sm"
                      data-testid="input-payment-link"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(getPaymentUrl(selectedRequest))}
                      data-testid="button-copy-link"
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Share this link via any messaging app
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="send" className="mt-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Send via Email</Label>
                    <div className="flex gap-2">
                      <Input
                        type="email"
                        placeholder="customer@email.com"
                        value={shareEmail}
                        onChange={(e) => setShareEmail(e.target.value)}
                        data-testid="input-email"
                      />
                      <Button
                        onClick={() => sendEmailMutation.mutate({ id: selectedRequest.id, email: shareEmail })}
                        disabled={!shareEmail || sendEmailMutation.isPending}
                        data-testid="button-send-email"
                      >
                        {sendEmailMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Send'
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Receipt Dialog */}
      <Dialog open={showReceiptDialog} onOpenChange={setShowReceiptDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Generate Receipt</DialogTitle>
            <DialogDescription>
              Create a receipt for a completed payment
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Link to Invoice (optional)</Label>
              <Select value={receiptInvoiceId || ""} onValueChange={(v) => setReceiptInvoiceId(v || null)}>
                <SelectTrigger data-testid="select-receipt-invoice">
                  <SelectValue placeholder="Select invoice" />
                </SelectTrigger>
                <SelectContent>
                  {invoices?.map((invoice) => (
                    <SelectItem key={invoice.id} value={invoice.id}>
                      {invoice.number} - ${typeof invoice.total === 'number' ? invoice.total.toFixed(2) : invoice.total}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={receiptAmount}
                  onChange={(e) => setReceiptAmount(e.target.value)}
                  className="pl-8"
                  data-testid="input-receipt-amount"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                placeholder="Payment description"
                value={receiptDescription}
                onChange={(e) => setReceiptDescription(e.target.value)}
                data-testid="input-receipt-description"
              />
            </div>

            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={receiptPaymentMethod} onValueChange={setReceiptPaymentMethod}>
                <SelectTrigger data-testid="select-receipt-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReceiptDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => receiptMutation.mutate({
                amount: parseFloat(receiptAmount),
                description: receiptDescription,
                paymentMethod: receiptPaymentMethod,
                paymentReference: receiptReference || undefined,
                clientId: receiptClientId || undefined,
                invoiceId: receiptInvoiceId || undefined,
                jobId: receiptJobId || undefined,
              })}
              disabled={!receiptAmount || !receiptDescription || receiptMutation.isPending}
              data-testid="button-generate-receipt"
            >
              {receiptMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Receipt className="h-4 w-4 mr-2" />
                  Generate
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
