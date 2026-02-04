import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Phone, 
  FileText, 
  Receipt, 
  Briefcase, 
  ArrowLeft,
  Check,
  X,
  CreditCard,
  Download,
  Clock,
  CheckCircle2,
  AlertCircle,
  LogOut,
  Building2,
  Calendar,
  MapPin,
  Mail
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PortalClient {
  id: string;
  name: string;
  email?: string;
}

interface PortalQuote {
  id: string;
  number: string;
  title: string;
  status: string;
  total: string;
  createdAt: string;
  validUntil?: string;
  acceptanceToken?: string;
  business: {
    businessName?: string;
    businessEmail?: string;
    businessPhone?: string;
    logoUrl?: string;
  } | null;
}

interface PortalInvoice {
  id: string;
  number: string;
  title: string;
  status: string;
  total: string;
  createdAt: string;
  dueDate?: string;
  paidAt?: string;
  paymentToken?: string;
  allowOnlinePayment?: boolean;
  stripePaymentLink?: string;
  business: {
    businessName?: string;
    businessEmail?: string;
    businessPhone?: string;
    logoUrl?: string;
  } | null;
}

interface PortalReceipt {
  id: string;
  number: string;
  total: string;
  paymentDate: string;
  viewToken?: string;
}

interface PortalJob {
  id: string;
  title: string;
  address?: string;
  status: string;
  scheduledAt?: string;
  completedAt?: string;
  photos?: any[];
}

interface PortalData {
  phone: string;
  clients: PortalClient[];
  quotes: PortalQuote[];
  invoices: PortalInvoice[];
  receipts: PortalReceipt[];
  jobs: PortalJob[];
}

type ViewState = 'phone' | 'code' | 'dashboard' | 'quote-detail' | 'invoice-detail';

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(num || 0);
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

function getQuoteStatusColor(status: string): string {
  switch (status) {
    case 'accepted': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'declined': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    case 'sent': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  }
}

function getInvoiceStatusColor(status: string): string {
  switch (status) {
    case 'paid': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'overdue': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    case 'sent': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  }
}

function getJobStatusColor(status: string): string {
  switch (status) {
    case 'done': case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'in_progress': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    case 'scheduled': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
    case 'cancelled': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  }
}

export default function ClientPortalHub() {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [viewState, setViewState] = useState<ViewState>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [portalData, setPortalData] = useState<PortalData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<PortalQuote | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<PortalInvoice | null>(null);
  const [sourceDocument, setSourceDocument] = useState<{ type: string; token: string } | null>(null);

  useEffect(() => {
    const initializePortal = async () => {
      const params = new URLSearchParams(window.location.search);
      const docType = params.get('doc');
      const docToken = params.get('token');
      
      if (docType && docToken) {
        setSourceDocument({ type: docType, token: docToken });
        
        const savedToken = localStorage.getItem('portal_session_token');
        if (savedToken) {
          setSessionToken(savedToken);
          setViewState('dashboard');
          fetchPortalData(savedToken);
          return;
        }
        
        try {
          const res = await fetch('/api/portal/auto-auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ documentType: docType, documentToken: docToken })
          });
          
          if (res.ok) {
            const data = await res.json();
            if (data.sessionToken) {
              localStorage.setItem('portal_session_token', data.sessionToken);
              setSessionToken(data.sessionToken);
              setViewState('dashboard');
              fetchPortalData(data.sessionToken);
              return;
            }
          }
        } catch (error) {
          console.error('Auto-auth failed:', error);
        }
      }
      
      const savedToken = localStorage.getItem('portal_session_token');
      if (savedToken) {
        setSessionToken(savedToken);
        setViewState('dashboard');
        fetchPortalData(savedToken);
      }
    };
    
    initializePortal();
  }, []);

  const fetchPortalData = async (token: string) => {
    setIsLoadingData(true);
    try {
      const res = await fetch('/api/portal/data', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem('portal_session_token');
          setSessionToken(null);
          setViewState('phone');
          return;
        }
        throw new Error('Failed to fetch data');
      }
      
      const data = await res.json();
      setPortalData(data);
    } catch (error) {
      console.error('Error fetching portal data:', error);
      toast({
        title: "Error",
        description: "Failed to load your data. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleRequestCode = async () => {
    if (!phone.trim()) {
      toast({
        title: "Phone Required",
        description: "Please enter your mobile number",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/portal/request-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim() })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        toast({
          title: "Code Sent",
          description: "Check your phone for a verification code"
        });
        setViewState('code');
      } else {
        throw new Error(data.error || 'Failed to send code');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send verification code",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!code.trim() || code.length !== 6) {
      toast({
        title: "Invalid Code",
        description: "Please enter the 6-digit code from your SMS",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/portal/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), code: code.trim() })
      });
      
      const data = await res.json();
      
      if (res.ok && data.sessionToken) {
        localStorage.setItem('portal_session_token', data.sessionToken);
        setSessionToken(data.sessionToken);
        setViewState('dashboard');
        fetchPortalData(data.sessionToken);
        toast({
          title: "Welcome!",
          description: "You're now logged in to your portal"
        });
      } else {
        throw new Error(data.error || 'Invalid verification code');
      }
    } catch (error: any) {
      toast({
        title: "Verification Failed",
        description: error.message || "Invalid or expired code. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      if (sessionToken) {
        await fetch('/api/portal/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sessionToken}`
          }
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('portal_session_token');
      setSessionToken(null);
      setPortalData(null);
      setPhone('');
      setCode('');
      setViewState('phone');
    }
  };

  const handlePayInvoice = (invoice: PortalInvoice) => {
    if (invoice.stripePaymentLink) {
      window.location.href = invoice.stripePaymentLink;
    } else if (invoice.paymentToken) {
      window.location.href = `/portal/invoice/${invoice.paymentToken}`;
    }
  };

  const handleViewQuote = (quote: PortalQuote) => {
    if (quote.acceptanceToken) {
      window.open(`/portal/quote/${quote.acceptanceToken}`, '_blank');
    }
  };

  const handleViewReceipt = (receipt: PortalReceipt) => {
    if (receipt.viewToken) {
      window.open(`/portal/receipt/${receipt.viewToken}`, '_blank');
    }
  };

  if (viewState === 'phone') {
    return (
      <div className="min-h-screen bg-muted/30 dark:bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Phone className="w-8 h-8 text-primary" />
            </div>
            <CardTitle>Client Portal</CardTitle>
            <CardDescription>
              Enter your mobile number to access your quotes, invoices, and job history
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Input
                type="tel"
                placeholder="0400 000 000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="text-center text-lg"
              />
            </div>
            <Button 
              onClick={handleRequestCode}
              disabled={isLoading || !phone.trim()}
              className="w-full"
              size="lg"
            >
              {isLoading ? 'Sending...' : 'Send Verification Code'}
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              We'll send a 6-digit code to verify your identity
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (viewState === 'code') {
    return (
      <div className="min-h-screen bg-muted/30 dark:bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-primary" />
            </div>
            <CardTitle>Enter Verification Code</CardTitle>
            <CardDescription>
              We sent a 6-digit code to {phone}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Input
                type="text"
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="text-center text-2xl tracking-widest font-mono"
                maxLength={6}
              />
            </div>
            <Button 
              onClick={handleVerifyCode}
              disabled={isLoading || code.length !== 6}
              className="w-full"
              size="lg"
            >
              {isLoading ? 'Verifying...' : 'Verify & Continue'}
            </Button>
            <div className="flex gap-2">
              <Button 
                variant="ghost" 
                onClick={() => setViewState('phone')}
                className="flex-1"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button 
                variant="ghost" 
                onClick={handleRequestCode}
                disabled={isLoading}
                className="flex-1"
              >
                Resend Code
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (viewState === 'dashboard') {
    return (
      <div className="min-h-screen bg-muted/30 dark:bg-background">
        <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
          {sourceDocument && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setLocation(`/portal/${sourceDocument.type}/${sourceDocument.token}`)}
              className="mb-2"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to {sourceDocument.type === 'quote' ? 'Quote' : sourceDocument.type === 'invoice' ? 'Invoice' : 'Receipt'}
            </Button>
          )}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Your Portal</h1>
              <p className="text-sm text-muted-foreground">
                {portalData?.phone ? `Logged in as ${portalData.phone}` : 'Welcome back'}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>

          {isLoadingData ? (
            <div className="space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : (
            <Tabs defaultValue="quotes" className="w-full">
              <TabsList className="grid w-full grid-cols-4 mb-6">
                <TabsTrigger value="quotes" className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  <span className="hidden sm:inline">Quotes</span>
                  {portalData?.quotes.length ? (
                    <Badge variant="secondary" className="ml-1">{portalData.quotes.length}</Badge>
                  ) : null}
                </TabsTrigger>
                <TabsTrigger value="invoices" className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  <span className="hidden sm:inline">Invoices</span>
                  {portalData?.invoices.length ? (
                    <Badge variant="secondary" className="ml-1">{portalData.invoices.length}</Badge>
                  ) : null}
                </TabsTrigger>
                <TabsTrigger value="receipts" className="flex items-center gap-2">
                  <Receipt className="w-4 h-4" />
                  <span className="hidden sm:inline">Receipts</span>
                  {portalData?.receipts.length ? (
                    <Badge variant="secondary" className="ml-1">{portalData.receipts.length}</Badge>
                  ) : null}
                </TabsTrigger>
                <TabsTrigger value="jobs" className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4" />
                  <span className="hidden sm:inline">Jobs</span>
                  {portalData?.jobs.length ? (
                    <Badge variant="secondary" className="ml-1">{portalData.jobs.length}</Badge>
                  ) : null}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="quotes" className="space-y-4">
                {portalData?.quotes.length === 0 ? (
                  <Card>
                    <CardContent className="pt-6 text-center text-muted-foreground">
                      <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No quotes yet</p>
                    </CardContent>
                  </Card>
                ) : (
                  portalData?.quotes.map((quote) => (
                    <Card key={quote.id} className="hover-elevate cursor-pointer" onClick={() => handleViewQuote(quote)}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-medium truncate">Quote #{quote.number}</h3>
                              <Badge className={getQuoteStatusColor(quote.status)}>
                                {quote.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground truncate">{quote.title}</p>
                            {quote.business?.businessName && (
                              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                <Building2 className="w-3 h-3" />
                                {quote.business.businessName}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatDate(quote.createdAt)}
                              {quote.validUntil && ` • Valid until ${formatDate(quote.validUntil)}`}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-lg">{formatCurrency(quote.total)}</p>
                            {quote.status === 'sent' && (
                              <Button size="sm" className="mt-2">
                                <Check className="w-3 h-3 mr-1" />
                                View & Accept
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>

              <TabsContent value="invoices" className="space-y-4">
                {portalData?.invoices.length === 0 ? (
                  <Card>
                    <CardContent className="pt-6 text-center text-muted-foreground">
                      <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No invoices yet</p>
                    </CardContent>
                  </Card>
                ) : (
                  portalData?.invoices.map((invoice) => (
                    <Card key={invoice.id} className="hover-elevate">
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-medium truncate">Invoice #{invoice.number}</h3>
                              <Badge className={getInvoiceStatusColor(invoice.status)}>
                                {invoice.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground truncate">{invoice.title}</p>
                            {invoice.business?.businessName && (
                              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                <Building2 className="w-3 h-3" />
                                {invoice.business.businessName}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatDate(invoice.createdAt)}
                              {invoice.dueDate && invoice.status !== 'paid' && ` • Due ${formatDate(invoice.dueDate)}`}
                              {invoice.paidAt && ` • Paid ${formatDate(invoice.paidAt)}`}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-lg">{formatCurrency(invoice.total)}</p>
                            {invoice.status !== 'paid' && invoice.allowOnlinePayment && (
                              <Button size="sm" className="mt-2" onClick={(e) => { e.stopPropagation(); handlePayInvoice(invoice); }}>
                                <CreditCard className="w-3 h-3 mr-1" />
                                Pay Now
                              </Button>
                            )}
                            {invoice.status === 'paid' && (
                              <div className="flex items-center gap-1 text-green-600 text-sm mt-2">
                                <CheckCircle2 className="w-4 h-4" />
                                Paid
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>

              <TabsContent value="receipts" className="space-y-4">
                {portalData?.receipts.length === 0 ? (
                  <Card>
                    <CardContent className="pt-6 text-center text-muted-foreground">
                      <Receipt className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No receipts yet</p>
                    </CardContent>
                  </Card>
                ) : (
                  portalData?.receipts.map((receipt) => (
                    <Card key={receipt.id} className="hover-elevate cursor-pointer" onClick={() => handleViewReceipt(receipt)}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium">Receipt #{receipt.number}</h3>
                            <p className="text-xs text-muted-foreground mt-1">
                              Paid {formatDate(receipt.paymentDate)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-lg">{formatCurrency(receipt.total)}</p>
                            <Button size="sm" variant="outline" className="mt-2">
                              <Download className="w-3 h-3 mr-1" />
                              View
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>

              <TabsContent value="jobs" className="space-y-4">
                {portalData?.jobs.length === 0 ? (
                  <Card>
                    <CardContent className="pt-6 text-center text-muted-foreground">
                      <Briefcase className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No jobs yet</p>
                    </CardContent>
                  </Card>
                ) : (
                  portalData?.jobs.map((job) => (
                    <Card key={job.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-medium truncate">{job.title}</h3>
                              <Badge className={getJobStatusColor(job.status)}>
                                {job.status.replace('_', ' ')}
                              </Badge>
                            </div>
                            {job.address && (
                              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                                <MapPin className="w-3 h-3" />
                                {job.address}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {job.scheduledAt ? `Scheduled: ${formatDate(job.scheduledAt)}` : 'Not scheduled'}
                              {job.completedAt && ` • Completed: ${formatDate(job.completedAt)}`}
                            </p>
                          </div>
                          {job.photos && job.photos.length > 0 && (
                            <Badge variant="secondary">
                              {job.photos.length} photo{job.photos.length !== 1 ? 's' : ''}
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>
            </Tabs>
          )}

          <div className="text-center text-xs text-muted-foreground pt-6 pb-4">
            <p>Powered by TradieTrack</p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
