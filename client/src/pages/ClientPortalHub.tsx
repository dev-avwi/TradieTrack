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
  Mail,
  Shield
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import jobrunnerLogo from "@assets/ChatGPT_Image_Feb_15,_2026,_08_30_34_PM_1771151701664.png";

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
    default: return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300';
  }
}

function getInvoiceStatusColor(status: string): string {
  switch (status) {
    case 'paid': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'overdue': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    case 'sent': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    default: return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300';
  }
}

function getJobStatusColor(status: string): string {
  switch (status) {
    case 'done': case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'in_progress': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    case 'scheduled': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
    case 'cancelled': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    default: return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300';
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
    const root = document.documentElement;
    const previousTheme = root.classList.contains('dark') ? 'dark' : 'light';
    root.classList.remove('dark');
    
    return () => {
      if (previousTheme === 'dark') {
        root.classList.add('dark');
      }
    };
  }, []);

  useEffect(() => {
    const initializePortal = async () => {
      const params = new URLSearchParams(window.location.search);
      const phoneParam = params.get('phone');
      if (phoneParam) {
        setPhone(phoneParam);
      }

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
      window.location.href = `/portal/quote/${quote.acceptanceToken}`;
    }
  };

  const handleViewReceipt = (receipt: PortalReceipt) => {
    if (receipt.viewToken) {
      window.location.href = `/portal/receipt/${receipt.viewToken}`;
    }
  };

  if (viewState === 'phone') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-[#2563EB]/5 flex flex-col">
        <div className="py-10 px-4">
          <div className="max-w-md mx-auto text-center">
            <img src={jobrunnerLogo} alt="JobRunner" className="w-14 h-14 mx-auto mb-3 object-contain" />
            <h1 className="text-2xl font-bold text-slate-900">Client Portal</h1>
            <p className="text-sm text-slate-500 mt-1">Access your quotes, invoices, and job history</p>
          </div>
        </div>

        <div className="flex-1 flex items-start justify-center px-4">
          <Card className="w-full max-w-md rounded-2xl shadow-lg border-slate-200/60">
            <CardHeader className="text-center pb-2">
              <div className="w-12 h-12 rounded-full bg-[#2563EB]/10 flex items-center justify-center mx-auto mb-3">
                <Phone className="w-6 h-6 text-[#2563EB]" />
              </div>
              <CardTitle className="text-lg">Verify Your Identity</CardTitle>
              <CardDescription>
                Enter the mobile number associated with your account
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
                className="w-full bg-[#2563EB] hover:bg-[#1D4ED8]"
                size="lg"
              >
                {isLoading ? 'Sending...' : 'Send Verification Code'}
              </Button>
              <p className="text-xs text-center text-slate-400 flex items-center justify-center gap-1.5">
                <Shield className="w-3.5 h-3.5" />
                We'll send a 6-digit code to verify your identity
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="text-center py-6 flex items-center justify-center gap-2">
          <img src={jobrunnerLogo} alt="JobRunner" className="w-5 h-5 object-contain" />
          <span className="text-xs text-slate-400">Powered by <span className="font-medium text-slate-500">JobRunner</span></span>
        </div>
      </div>
    );
  }

  if (viewState === 'code') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-[#2563EB]/5 flex flex-col">
        <div className="py-10 px-4">
          <div className="max-w-md mx-auto text-center">
            <img src={jobrunnerLogo} alt="JobRunner" className="w-14 h-14 mx-auto mb-3 object-contain" />
            <h1 className="text-2xl font-bold text-slate-900">Client Portal</h1>
            <p className="text-sm text-slate-500 mt-1">Secure verification</p>
          </div>
        </div>

        <div className="flex-1 flex items-start justify-center px-4">
          <Card className="w-full max-w-md rounded-2xl shadow-lg border-slate-200/60">
            <CardHeader className="text-center pb-2">
              <div className="w-12 h-12 rounded-full bg-[#2563EB]/10 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6 text-[#2563EB]" />
              </div>
              <CardTitle className="text-lg">Enter Verification Code</CardTitle>
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
                className="w-full bg-[#2563EB] hover:bg-[#1D4ED8]"
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

        <div className="text-center py-6 flex items-center justify-center gap-2">
          <img src={jobrunnerLogo} alt="JobRunner" className="w-5 h-5 object-contain" />
          <span className="text-xs text-slate-400">Powered by <span className="font-medium text-slate-500">JobRunner</span></span>
        </div>
      </div>
    );
  }

  if (viewState === 'dashboard') {
    const business = portalData?.quotes[0]?.business || portalData?.invoices[0]?.business || null;
    const clientName = portalData?.clients[0]?.name;

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-[#2563EB]/5 flex flex-col">
        <header className="bg-[#2563EB] sticky top-0 z-20">
          <div className="px-4 py-4">
            <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                {business?.logoUrl ? (
                  <img
                    src={business.logoUrl}
                    alt={business.businessName || 'Business'}
                    className="w-10 h-10 object-contain rounded-md bg-white/10 p-1"
                  />
                ) : (
                  <img src={jobrunnerLogo} alt="JobRunner" className="w-10 h-10 object-contain" />
                )}
                <div className="min-w-0">
                  <h1 className="font-bold text-base text-white truncate">
                    {business?.businessName || 'Client Portal'}
                  </h1>
                  <div className="flex gap-3 text-xs text-white/70 flex-wrap">
                    {business?.businessPhone && (
                      <a href={`tel:${business.businessPhone}`} className="hover:text-white flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {business.businessPhone}
                      </a>
                    )}
                    {business?.businessEmail && (
                      <a href={`mailto:${business.businessEmail}`} className="hover:text-white flex items-center gap-1 hidden sm:flex">
                        <Mail className="w-3 h-3" /> {business.businessEmail}
                      </a>
                    )}
                  </div>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleLogout} className="text-white border-white/30 hover:bg-white/10">
                <LogOut className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </header>

        <div className="bg-gradient-to-r from-[#2563EB]/5 to-transparent border-b border-[#2563EB]/10 px-4 py-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {clientName ? `Welcome back, ${clientName}` : 'Your Documents'}
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  {portalData?.phone ? `Logged in as ${portalData.phone}` : 'View your quotes, invoices, and jobs'}
                </p>
              </div>
              {sourceDocument && (
                <Button variant="outline" size="sm" className="border-slate-300"
                  onClick={() => setLocation(`/portal/${sourceDocument.type}/${sourceDocument.token}`)}>
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  <span className="hidden sm:inline">
                    Back to {sourceDocument.type === 'quote' ? 'Quote' : sourceDocument.type === 'invoice' ? 'Invoice' : 'Receipt'}
                  </span>
                  <span className="sm:hidden">Back</span>
                </Button>
              )}
            </div>
          </div>
        </div>

        <main className="flex-1 px-4 py-6">
          <div className="max-w-4xl mx-auto">
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
                    <Card className="border-slate-200/60">
                      <CardContent className="pt-8 pb-8 text-center">
                        <FileText className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                        <p className="text-slate-500 text-sm">No quotes yet</p>
                      </CardContent>
                    </Card>
                  ) : (
                    portalData?.quotes.map((quote) => (
                      <Card key={quote.id} className="hover-elevate cursor-pointer" onClick={() => handleViewQuote(quote)}>
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <h3 className="font-medium truncate">Quote #{quote.number}</h3>
                                <Badge className={getQuoteStatusColor(quote.status)}>
                                  {quote.status}
                                </Badge>
                              </div>
                              <p className="text-sm text-slate-500 truncate">{quote.title}</p>
                              {quote.business?.businessName && (
                                <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                                  <Building2 className="w-3 h-3" />
                                  {quote.business.businessName}
                                </p>
                              )}
                              <p className="text-xs text-slate-400 mt-1">
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
                    <Card className="border-slate-200/60">
                      <CardContent className="pt-8 pb-8 text-center">
                        <CreditCard className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                        <p className="text-slate-500 text-sm">No invoices yet</p>
                      </CardContent>
                    </Card>
                  ) : (
                    portalData?.invoices.map((invoice) => (
                      <Card key={invoice.id} className="hover-elevate">
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <h3 className="font-medium truncate">Invoice #{invoice.number}</h3>
                                <Badge className={getInvoiceStatusColor(invoice.status)}>
                                  {invoice.status}
                                </Badge>
                              </div>
                              <p className="text-sm text-slate-500 truncate">{invoice.title}</p>
                              {invoice.business?.businessName && (
                                <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                                  <Building2 className="w-3 h-3" />
                                  {invoice.business.businessName}
                                </p>
                              )}
                              <p className="text-xs text-slate-400 mt-1">
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
                    <Card className="border-slate-200/60">
                      <CardContent className="pt-8 pb-8 text-center">
                        <Receipt className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                        <p className="text-slate-500 text-sm">No receipts yet</p>
                      </CardContent>
                    </Card>
                  ) : (
                    portalData?.receipts.map((receipt) => (
                      <Card key={receipt.id} className="hover-elevate cursor-pointer" onClick={() => handleViewReceipt(receipt)}>
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium">Receipt #{receipt.number}</h3>
                              <p className="text-xs text-slate-400 mt-1">
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
                    <Card className="border-slate-200/60">
                      <CardContent className="pt-8 pb-8 text-center">
                        <Briefcase className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                        <p className="text-slate-500 text-sm">No jobs yet</p>
                      </CardContent>
                    </Card>
                  ) : (
                    portalData?.jobs.map((job) => (
                      <Card key={job.id}>
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <h3 className="font-medium truncate">{job.title}</h3>
                                <Badge className={getJobStatusColor(job.status)}>
                                  {job.status.replace('_', ' ')}
                                </Badge>
                              </div>
                              {job.address && (
                                <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                                  <MapPin className="w-3 h-3" />
                                  {job.address}
                                </p>
                              )}
                              <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
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
          </div>
        </main>

        <div className="text-center py-6 border-t border-slate-200 bg-white/80 backdrop-blur-sm flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <img src={jobrunnerLogo} alt="JobRunner" className="w-5 h-5 object-contain" />
            <span className="text-xs text-slate-500">Powered by <span className="font-medium text-slate-700">JobRunner</span></span>
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <Shield className="w-3 h-3" />
            <span>Secure & encrypted</span>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
