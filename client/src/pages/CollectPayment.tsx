import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { useLocation } from "wouter";
import { useIntegrationHealth, isStripeReady } from "@/hooks/use-integration-health";
import { 
  QrCode, 
  Link2, 
  MessageSquare, 
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
  Smartphone,
  RefreshCw,
  Trash2,
  Wifi,
  CreditCard,
  FileText,
  Briefcase,
  Banknote,
  ExternalLink,
  Receipt,
  ArrowRight,
  Building2,
  AlertTriangle
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
  const { data: integrationHealth } = useIntegrationHealth();
  const stripeConnected = isStripeReady(integrationHealth);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showRecordPaymentDialog, setShowRecordPaymentDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
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
  const activeJobs = jobs?.filter(job => job.status !== 'invoiced') || [];

  useEffect(() => {
    if (selectedInvoiceId && invoices) {
      const invoice = invoices.find(inv => inv.id === selectedInvoiceId);
      if (invoice) {
        const totalStr = typeof invoice.total === 'number' 
          ? invoice.total.toFixed(2) 
          : String(invoice.total || '0.00');
        setNewAmount(totalStr);
        setNewDescription(`Payment for ${invoice.number}: ${invoice.title}`);
        setNewReference(invoice.number); // Auto-fill reference with invoice number
        setSelectedClientId(invoice.clientId);
        // Only auto-fill job if field is empty (respect manual overrides)
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
        setRecordReference(invoice.number); // Auto-fill reference with invoice number
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
        setReceiptReference(invoice.number); // Auto-fill reference with invoice number
        setReceiptClientId(invoice.clientId);
        // Only auto-fill job if field is empty (respect manual overrides)
        if (invoice.jobId && !receiptJobId) setReceiptJobId(invoice.jobId);
      }
    }
  }, [receiptInvoiceId, invoices]);

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

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('POST', `/api/payment-requests/${id}/cancel`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/payment-requests'] });
      toast({
        title: "Payment request cancelled",
      });
    },
  });

  const sendSmsMutation = useMutation({
    mutationFn: async ({ id, phoneNumber }: { id: string; phoneNumber: string }) => {
      await apiRequest('POST', `/api/payment-requests/${id}/send-sms`, { phoneNumber });
    },
    onSuccess: () => {
      setSharePhone("");
      toast({
        title: "SMS sent",
        description: "Payment link sent via SMS",
      });
    },
    onError: () => {
      toast({
        title: "Failed to send SMS",
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

  const createReceiptMutation = useMutation({
    mutationFn: async (data: { 
      amount: number; 
      description: string; 
      paymentMethod: string;
      paymentReference?: string;
      clientId?: string;
      invoiceId?: string;
      jobId?: string;
    }) => {
      const response = await apiRequest('POST', '/api/receipts', data);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/receipts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      setShowReceiptDialog(false);
      resetReceiptForm();
      toast({
        title: "Receipt generated",
        description: `Receipt ${data.receiptNumber} created successfully`,
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
    setReceiptClientId("");
    setReceiptInvoiceId("");
    setReceiptJobId("");
  };

  const handleCreate = () => {
    if (!newAmount || parseFloat(newAmount) <= 0) {
      toast({
        title: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }
    if (!newDescription.trim()) {
      toast({
        title: "Please enter a description",
        variant: "destructive",
      });
      return;
    }
    
    createMutation.mutate({
      amount: parseFloat(newAmount),
      description: newDescription.trim(),
      reference: newReference.trim() || undefined,
      clientId: selectedClientId || undefined,
      invoiceId: selectedInvoiceId || undefined,
      jobId: selectedJobId || undefined,
      expiresInHours: parseInt(expiresInHours),
    });
  };

  const handleRecordPayment = () => {
    if (!recordInvoiceId) {
      toast({
        title: "Please select an invoice",
        variant: "destructive",
      });
      return;
    }
    if (!recordAmount || parseFloat(recordAmount) <= 0) {
      toast({
        title: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }
    
    recordPaymentMutation.mutate({
      invoiceId: recordInvoiceId,
      amount: recordAmount,
      paymentMethod: recordPaymentMethod,
      reference: recordReference || undefined,
      notes: recordNotes || undefined,
    });
  };

  const handleCreateReceipt = () => {
    if (!receiptAmount || parseFloat(receiptAmount) <= 0) {
      toast({
        title: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }
    
    createReceiptMutation.mutate({
      amount: parseFloat(receiptAmount),
      description: receiptDescription.trim() || "Payment received",
      paymentMethod: receiptPaymentMethod,
      paymentReference: receiptReference || undefined,
      clientId: receiptClientId || undefined,
      invoiceId: receiptInvoiceId || undefined,
      jobId: receiptJobId || undefined,
    });
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Link copied",
        description: "Payment link copied to clipboard",
      });
    } catch (err) {
      toast({
        title: "Failed to copy",
        variant: "destructive",
      });
    }
  };

  const getPaymentUrl = (request: PaymentRequest) => {
    // Use the server-provided paymentUrl if available (production-ready)
    // Fall back to constructing from origin for backward compatibility
    return request.paymentUrl || `${window.location.origin}/pay/${request.token}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-yellow-600 border-yellow-600"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'paid':
        return <Badge className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Paid</Badge>;
      case 'cancelled':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Cancelled</Badge>;
      case 'expired':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Expired</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getClientName = (clientId: string | null | undefined) => {
    if (!clientId || !clients) return null;
    const client = clients.find(c => c.id === clientId);
    return client?.name;
  };

  const getInvoiceNumber = (invoiceId: string | null | undefined) => {
    if (!invoiceId || !invoices) return null;
    const invoice = invoices.find(i => i.id === invoiceId);
    return invoice?.number;
  };

  const getJobTitle = (jobId: string | null | undefined) => {
    if (!jobId || !jobs) return null;
    const job = jobs.find(j => j.id === jobId);
    return job?.title;
  };

  const pendingRequests = paymentRequests?.filter(r => r.status === 'pending') || [];
  const completedRequests = paymentRequests?.filter(r => r.status !== 'pending') || [];

  return (
    <PageShell>
      <PageHeader
        title="Collect Payment"
        subtitle="Request payments on-site or record cash and bank transfers"
        leading={<DollarSign className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />}
        action={
          <div className="flex gap-2 flex-wrap">
            <Button 
              variant="outline" 
              onClick={() => setShowReceiptDialog(true)} 
              data-testid="button-generate-receipt"
            >
              <Receipt className="h-4 w-4 mr-2" />
              Generate Receipt
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setShowRecordPaymentDialog(true)} 
              data-testid="button-record-payment"
            >
              <Banknote className="h-4 w-4 mr-2" />
              Record Payment
            </Button>
            <Button 
              onClick={() => setShowCreateDialog(true)} 
              disabled={!stripeConnected}
              data-testid="button-new-payment"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Request
            </Button>
          </div>
        }
      />

      {/* Stripe Integration Warning */}
      {!stripeConnected && (
        <div 
          className="rounded-xl p-4 border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 mb-6"
          data-testid="banner-stripe-warning"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-amber-200 dark:bg-amber-800">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="font-semibold text-amber-700 dark:text-amber-300">Payments Not Connected</p>
                <p className="text-sm text-muted-foreground">Connect Stripe to accept online card payments</p>
              </div>
            </div>
            <Button
              onClick={() => navigate('/integrations')}
              className="shrink-0"
              variant="outline"
              data-testid="button-setup-stripe"
            >
              Set Up Payments
            </Button>
          </div>
        </div>
      )}

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card 
          className="hover-elevate cursor-pointer" 
          onClick={() => navigate('/invoices')}
          data-testid="card-link-invoices"
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg p-2" style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}>
              <FileText className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
            </div>
            <div>
              <p className="font-medium text-sm">Invoices</p>
              <p className="text-xs text-muted-foreground">{unpaidInvoices.length} unpaid</p>
            </div>
          </CardContent>
        </Card>
        
        <Card 
          className="hover-elevate cursor-pointer" 
          onClick={() => navigate('/jobs')}
          data-testid="card-link-jobs"
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg p-2" style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}>
              <Briefcase className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
            </div>
            <div>
              <p className="font-medium text-sm">Jobs</p>
              <p className="text-xs text-muted-foreground">{activeJobs.length} active</p>
            </div>
          </CardContent>
        </Card>
        
        <Card 
          className="hover-elevate cursor-pointer" 
          onClick={() => navigate('/clients')}
          data-testid="card-link-clients"
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg p-2" style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}>
              <Building2 className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
            </div>
            <div>
              <p className="font-medium text-sm">Clients</p>
              <p className="text-xs text-muted-foreground">{clients?.length || 0} total</p>
            </div>
          </CardContent>
        </Card>
        
        <Card 
          className="hover-elevate cursor-pointer" 
          onClick={() => navigate('/reports')}
          data-testid="card-link-reports"
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg p-2" style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}>
              <Receipt className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
            </div>
            <div>
              <p className="font-medium text-sm">Reports</p>
              <p className="text-xs text-muted-foreground">View payments</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tap to Pay Info Banner */}
      <Card className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/20" data-testid="card-contactless-info">
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-blue-500 p-3 shadow-lg" data-testid="icon-contactless">
              <Wifi className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-1 flex items-center gap-2" data-testid="text-contactless-title">
                <span>Contactless Payments</span>
                <Badge variant="secondary" className="text-xs" data-testid="badge-works-now">Works Now</Badge>
              </h3>
              <p className="text-sm text-muted-foreground mb-2" data-testid="text-contactless-description">
                Customer scans the QR code and pays with Apple Pay, Google Pay, or card. 
                It's just as easy as tapping a card!
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground" data-testid="text-accepted-cards">
                <CreditCard className="h-3.5 w-3.5" />
                <span>Cards accepted: Visa, Mastercard, Amex • Apple Pay • Google Pay</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : paymentRequests?.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="rounded-full bg-muted p-4 mb-4">
                <QrCode className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No payment requests yet</h3>
              <p className="text-muted-foreground text-center mb-4 max-w-sm">
                Create a payment request to get a QR code or shareable link that customers can use to pay you on-site.
              </p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowRecordPaymentDialog(true)} data-testid="button-record-first">
                  <Banknote className="h-4 w-4 mr-2" />
                  Record Payment
                </Button>
                <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-first">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Request
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {pendingRequests.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-yellow-600" />
                  Pending Payments ({pendingRequests.length})
                </h2>
                <div className="grid gap-3">
                  {pendingRequests.map((request) => (
                    <Card key={request.id} className="hover-elevate">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-bold text-xl">${parseFloat(request.amount).toFixed(2)}</span>
                              {getStatusBadge(request.status)}
                            </div>
                            <p className="text-sm text-muted-foreground truncate mb-1">{request.description}</p>
                            
                            {/* Linked items */}
                            <div className="flex flex-wrap gap-2 mt-2">
                              {request.invoiceId && (
                                <Badge 
                                  variant="outline" 
                                  className="cursor-pointer hover:bg-accent"
                                  onClick={() => navigate(`/invoices/${request.invoiceId}`)}
                                >
                                  <FileText className="h-3 w-3 mr-1" />
                                  {getInvoiceNumber(request.invoiceId)}
                                </Badge>
                              )}
                              {request.jobId && (
                                <Badge 
                                  variant="outline" 
                                  className="cursor-pointer hover:bg-accent"
                                  onClick={() => navigate(`/jobs/${request.jobId}`)}
                                >
                                  <Briefcase className="h-3 w-3 mr-1" />
                                  {getJobTitle(request.jobId)}
                                </Badge>
                              )}
                              {request.clientId && (
                                <Badge 
                                  variant="outline" 
                                  className="cursor-pointer hover:bg-accent"
                                  onClick={() => navigate(`/clients/${request.clientId}`)}
                                >
                                  <Building2 className="h-3 w-3 mr-1" />
                                  {getClientName(request.clientId)}
                                </Badge>
                              )}
                            </div>
                            
                            {request.reference && (
                              <p className="text-xs text-muted-foreground mt-2">Ref: {request.reference}</p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              Created {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => {
                                setSelectedRequest(request);
                                setShowShareDialog(true);
                              }}
                              data-testid={`button-share-${request.id}`}
                            >
                              <Share2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => cancelMutation.mutate(request.id)}
                              data-testid={`button-cancel-${request.id}`}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Receipts section */}
            {receipts && receipts.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-muted-foreground" />
                  Receipts ({receipts.length})
                </h2>
                <div className="grid gap-3">
                  {receipts.slice(0, 10).map((receipt) => (
                    <Card 
                      key={receipt.id} 
                      className="cursor-pointer hover-elevate"
                      onClick={() => navigate(`/receipts/${receipt.id}`)}
                      data-testid={`card-receipt-${receipt.id}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-bold text-lg">${parseFloat(receipt.amount).toFixed(2)}</span>
                              <Badge className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Paid</Badge>
                            </div>
                            <p className="text-sm font-medium">{receipt.receiptNumber}</p>
                            
                            {/* Linked items */}
                            <div className="flex flex-wrap gap-2 mt-2">
                              {receipt.clientId && (
                                <Badge variant="outline">
                                  <Building2 className="h-3 w-3 mr-1" />
                                  {getClientName(receipt.clientId)}
                                </Badge>
                              )}
                              {receipt.invoiceId && (
                                <Badge 
                                  variant="outline" 
                                  className="cursor-pointer hover:bg-accent"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/invoices/${receipt.invoiceId}`);
                                  }}
                                >
                                  <FileText className="h-3 w-3 mr-1" />
                                  {getInvoiceNumber(receipt.invoiceId)}
                                </Badge>
                              )}
                              {receipt.jobId && (
                                <Badge 
                                  variant="outline" 
                                  className="cursor-pointer hover:bg-accent"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/jobs/${receipt.jobId}`);
                                  }}
                                >
                                  <Briefcase className="h-3 w-3 mr-1" />
                                  {getJobTitle(receipt.jobId)}
                                </Badge>
                              )}
                            </div>
                            
                            {receipt.paidAt && (
                              <p className="text-xs text-green-600 mt-2">
                                Paid {format(new Date(receipt.paidAt), 'dd MMM yyyy, h:mm a')}
                              </p>
                            )}
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {completedRequests.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-muted-foreground" />
                  Completed Requests ({completedRequests.length})
                </h2>
                <div className="grid gap-3">
                  {completedRequests.slice(0, 10).map((request) => (
                    <Card key={request.id} className="opacity-75">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-bold text-lg">${parseFloat(request.amount).toFixed(2)}</span>
                              {getStatusBadge(request.status)}
                            </div>
                            <p className="text-sm text-muted-foreground truncate">{request.description}</p>
                            
                            {/* Linked items */}
                            <div className="flex flex-wrap gap-2 mt-2">
                              {request.invoiceId && (
                                <Badge 
                                  variant="outline" 
                                  className="cursor-pointer hover:bg-accent"
                                  onClick={() => navigate(`/invoices/${request.invoiceId}`)}
                                >
                                  <FileText className="h-3 w-3 mr-1" />
                                  {getInvoiceNumber(request.invoiceId)}
                                </Badge>
                              )}
                              {request.jobId && (
                                <Badge 
                                  variant="outline" 
                                  className="cursor-pointer hover:bg-accent"
                                  onClick={() => navigate(`/jobs/${request.jobId}`)}
                                >
                                  <Briefcase className="h-3 w-3 mr-1" />
                                  {getJobTitle(request.jobId)}
                                </Badge>
                              )}
                            </div>
                            
                            {request.paidAt && (
                              <p className="text-xs text-green-600 mt-2">
                                Paid {format(new Date(request.paidAt), 'dd MMM yyyy, h:mm a')}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create Payment Request Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              New Payment Request
            </DialogTitle>
            <DialogDescription>
              Create a QR code or link for on-site payments
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Link to Invoice */}
            {unpaidInvoices.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="invoice">Link to Invoice</Label>
                <Select value={selectedInvoiceId || "none"} onValueChange={(val) => setSelectedInvoiceId(val === "none" ? "" : val)}>
                  <SelectTrigger data-testid="select-invoice">
                    <SelectValue placeholder="Select an invoice (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No invoice</SelectItem>
                    {unpaidInvoices.map((invoice) => (
                      <SelectItem key={invoice.id} value={invoice.id}>
                        {invoice.number} - ${parseFloat(invoice.total).toFixed(2)} ({invoice.status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Selecting an invoice will auto-fill the amount and description
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="amount">Amount (AUD) *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  className="pl-7"
                  data-testid="input-amount"
                />
              </div>
              {newAmount && parseFloat(newAmount) > 0 && (
                <p className="text-xs text-muted-foreground">
                  Includes ${(parseFloat(newAmount) / 11).toFixed(2)} GST
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                placeholder="e.g., Kitchen tap repair"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="resize-none"
                rows={2}
                data-testid="input-description"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reference">Reference (optional)</Label>
              <Input
                id="reference"
                placeholder="e.g., Job #123"
                value={newReference}
                onChange={(e) => setNewReference(e.target.value)}
                data-testid="input-reference"
              />
            </div>

            {clients && clients.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="client">Client (optional)</Label>
                <Select value={selectedClientId || "none"} onValueChange={(val) => setSelectedClientId(val === "none" ? "" : val)}>
                  <SelectTrigger data-testid="select-client">
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No client</SelectItem>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {activeJobs.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="job">Link to Job (optional)</Label>
                <Select value={selectedJobId || "none"} onValueChange={(val) => setSelectedJobId(val === "none" ? "" : val)}>
                  <SelectTrigger data-testid="select-job">
                    <SelectValue placeholder="Select a job" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No job</SelectItem>
                    {activeJobs.map((job) => (
                      <SelectItem key={job.id} value={job.id}>
                        {job.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="expires">Link expires in</Label>
              <Select value={expiresInHours} onValueChange={setExpiresInHours}>
                <SelectTrigger data-testid="select-expires">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 hour</SelectItem>
                  <SelectItem value="4">4 hours</SelectItem>
                  <SelectItem value="24">24 hours</SelectItem>
                  <SelectItem value="72">3 days</SelectItem>
                  <SelectItem value="168">1 week</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); resetCreateForm(); }}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreate} 
              disabled={createMutation.isPending}
              data-testid="button-create-request"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <QrCode className="h-4 w-4 mr-2" />
                  Create Request
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Manual Payment Dialog */}
      <Dialog open={showRecordPaymentDialog} onOpenChange={setShowRecordPaymentDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5" />
              Record Payment
            </DialogTitle>
            <DialogDescription>
              Record a cash, bank transfer, or other offline payment
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="record-invoice">Invoice *</Label>
              <Select value={recordInvoiceId || ""} onValueChange={setRecordInvoiceId}>
                <SelectTrigger data-testid="select-record-invoice">
                  <SelectValue placeholder="Select an invoice" />
                </SelectTrigger>
                <SelectContent>
                  {unpaidInvoices.length === 0 ? (
                    <SelectItem value="" disabled>No unpaid invoices</SelectItem>
                  ) : (
                    unpaidInvoices.map((invoice) => (
                      <SelectItem key={invoice.id} value={invoice.id}>
                        {invoice.number} - ${parseFloat(invoice.total).toFixed(2)} ({invoice.title})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="record-amount">Amount Received (AUD) *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="record-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={recordAmount}
                  onChange={(e) => setRecordAmount(e.target.value)}
                  className="pl-7"
                  data-testid="input-record-amount"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="record-method">Payment Method *</Label>
              <Select value={recordPaymentMethod} onValueChange={setRecordPaymentMethod}>
                <SelectTrigger data-testid="select-record-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="card">Card (in person)</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="record-reference">Payment Reference (optional)</Label>
              <Input
                id="record-reference"
                placeholder="e.g., Bank transfer ref or cheque number"
                value={recordReference}
                onChange={(e) => setRecordReference(e.target.value)}
                data-testid="input-record-reference"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="record-notes">Notes (optional)</Label>
              <Textarea
                id="record-notes"
                placeholder="Any additional notes about this payment"
                value={recordNotes}
                onChange={(e) => setRecordNotes(e.target.value)}
                className="resize-none"
                rows={2}
                data-testid="input-record-notes"
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setShowRecordPaymentDialog(false); resetRecordForm(); }}>
              Cancel
            </Button>
            <Button 
              onClick={handleRecordPayment} 
              disabled={recordPaymentMutation.isPending || !recordInvoiceId}
              data-testid="button-record-payment-submit"
            >
              {recordPaymentMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Recording...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Record Payment
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Manual Receipt Dialog */}
      <Dialog open={showReceiptDialog} onOpenChange={setShowReceiptDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Generate Receipt
            </DialogTitle>
            <DialogDescription>
              Create a receipt for a payment received. Optionally link to an invoice or client.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="receipt-invoice">Link to Invoice (optional)</Label>
              <Select value={receiptInvoiceId || "none"} onValueChange={(val) => { setReceiptInvoiceId(val === "none" ? null : val); }}>
                <SelectTrigger data-testid="select-receipt-invoice">
                  <SelectValue placeholder="Select an invoice (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No invoice</SelectItem>
                  {invoices?.map((invoice) => (
                    <SelectItem key={invoice.id} value={invoice.id}>
                      {invoice.number} - ${parseFloat(invoice.total).toFixed(2)} ({invoice.title})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="receipt-amount">Amount Received (AUD) *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="receipt-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={receiptAmount}
                  onChange={(e) => setReceiptAmount(e.target.value)}
                  className="pl-7"
                  data-testid="input-receipt-amount"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="receipt-description">Description</Label>
              <Input
                id="receipt-description"
                placeholder="e.g., Payment for plumbing services"
                value={receiptDescription}
                onChange={(e) => setReceiptDescription(e.target.value)}
                data-testid="input-receipt-description"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="receipt-method">Payment Method *</Label>
              <Select value={receiptPaymentMethod} onValueChange={setReceiptPaymentMethod}>
                <SelectTrigger data-testid="select-receipt-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="card">Card (in person)</SelectItem>
                  <SelectItem value="tap_to_pay">Tap to Pay</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="receipt-reference">Payment Reference (optional)</Label>
              <Input
                id="receipt-reference"
                placeholder="e.g., Bank transfer ref or cheque number"
                value={receiptReference}
                onChange={(e) => setReceiptReference(e.target.value)}
                data-testid="input-receipt-reference"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="receipt-client">Client (optional)</Label>
              <Select value={receiptClientId || "none"} onValueChange={(val) => setReceiptClientId(val === "none" ? null : val)}>
                <SelectTrigger data-testid="select-receipt-client">
                  <SelectValue placeholder="Select a client (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No client</SelectItem>
                  {clients?.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setShowReceiptDialog(false); resetReceiptForm(); }}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateReceipt} 
              disabled={createReceiptMutation.isPending || !receiptAmount}
              data-testid="button-generate-receipt-submit"
            >
              {createReceiptMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Receipt className="h-4 w-4 mr-2" />
                  Generate Receipt
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              Share Payment Request
            </DialogTitle>
            <DialogDescription>
              ${selectedRequest ? parseFloat(selectedRequest.amount).toFixed(2) : '0.00'} - {selectedRequest?.description}
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="qr" className="flex items-center gap-1">
                  <QrCode className="h-4 w-4" />
                  QR Code
                </TabsTrigger>
                <TabsTrigger value="link" className="flex items-center gap-1">
                  <Link2 className="h-4 w-4" />
                  Link
                </TabsTrigger>
                <TabsTrigger value="send" className="flex items-center gap-1">
                  <MessageSquare className="h-4 w-4" />
                  Send
                </TabsTrigger>
              </TabsList>

              <TabsContent value="qr" className="mt-4">
                <div className="flex flex-col items-center">
                  <div className="bg-white p-4 rounded-lg shadow-inner">
                    <QRCodeSVG
                      value={getPaymentUrl(selectedRequest)}
                      size={200}
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
                      {copied ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Share this link with your customer via any messaging app
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="send" className="mt-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Send via Email
                    </Label>
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
    </PageShell>
  );
}
