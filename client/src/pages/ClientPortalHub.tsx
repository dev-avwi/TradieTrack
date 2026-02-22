import { useState, useEffect, useLayoutEffect } from "react";
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
  Shield,
  Users,
  UserCircle,
  Heart,
  Loader2,
  MessageCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import jobrunnerLogo from "@assets/jobrunner-logo-cropped.png";

interface PortalClient {
  id: string;
  name: string;
  email?: string;
}

interface PortalQuote {
  id: string;
  clientId?: string;
  number: string;
  title: string;
  status: string;
  total: string;
  createdAt: string;
  validUntil?: string;
  acceptanceToken?: string;
  business: {
    businessName?: string;
    email?: string;
    phone?: string;
    logoUrl?: string;
  } | null;
}

interface PortalInvoice {
  id: string;
  clientId?: string;
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
    email?: string;
    phone?: string;
    logoUrl?: string;
  } | null;
}

interface PortalReceipt {
  id: string;
  clientId?: string;
  number: string;
  total: string;
  paymentDate: string;
  viewToken?: string;
}

interface PortalJob {
  id: string;
  clientId?: string;
  title: string;
  address?: string;
  status: string;
  scheduledAt?: string;
  completedAt?: string;
  photos?: any[];
  portalToken?: string;
  assignedWorkers?: Array<{ id: string; name: string }>;
  userId?: string;
}

interface PortalData {
  phone: string;
  clients: PortalClient[];
  quotes: PortalQuote[];
  invoices: PortalInvoice[];
  receipts: PortalReceipt[];
  jobs: PortalJob[];
}

type ViewState = 'phone' | 'code' | 'dashboard' | 'quote-detail' | 'invoice-detail' | 'not-found' | 'select-client';

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
    case 'accepted': return 'bg-green-100 text-green-800';
    case 'declined': return 'bg-red-100 text-red-800';
    case 'sent': return 'bg-blue-100 text-blue-800';
    default: return 'bg-slate-100 text-slate-700';
  }
}

function getInvoiceStatusColor(status: string): string {
  switch (status) {
    case 'paid': return 'bg-green-100 text-green-800';
    case 'overdue': return 'bg-red-100 text-red-800';
    case 'sent': return 'bg-blue-100 text-blue-800';
    default: return 'bg-slate-100 text-slate-700';
  }
}

function getJobStatusColor(status: string): string {
  switch (status) {
    case 'paid': return 'bg-green-100 text-green-800';
    case 'done': case 'completed': return 'bg-green-100 text-green-800';
    case 'invoiced': return 'bg-purple-100 text-purple-800';
    case 'in_progress': return 'bg-orange-100 text-orange-800';
    case 'scheduled': return 'bg-blue-100 text-blue-800';
    case 'cancelled': return 'bg-red-100 text-red-800';
    case 'unscheduled': return 'bg-slate-100 text-slate-600';
    default: return 'bg-slate-100 text-slate-700';
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
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [requestingWorker, setRequestingWorker] = useState<{ workerId: string; workerName: string; jobId: string; jobTitle: string } | null>(null);
  const [requestMessage, setRequestMessage] = useState('');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [submittedRequests, setSubmittedRequests] = useState<Set<string>>(new Set());

  useLayoutEffect(() => {
    const root = document.documentElement;
    const previousTheme = root.classList.contains('dark') ? 'dark' : 'light';
    root.classList.remove('dark');

    root.style.setProperty('--background', '210 40% 98%');
    root.style.setProperty('--foreground', '222.2 84% 4.9%');
    root.style.setProperty('--card', '0 0% 100%');
    root.style.setProperty('--card-foreground', '222.2 84% 4.9%');
    root.style.setProperty('--popover', '0 0% 100%');
    root.style.setProperty('--popover-foreground', '222.2 84% 4.9%');
    root.style.setProperty('--muted', '210 40% 96.1%');
    root.style.setProperty('--muted-foreground', '215.4 16.3% 46.9%');
    root.style.setProperty('--border', '214.3 31.8% 91.4%');
    root.style.setProperty('--input', '214.3 31.8% 91.4%');
    root.style.setProperty('--ring', '221.2 83.2% 53.3%');
    root.style.setProperty('color-scheme', 'light');

    return () => {
      if (previousTheme === 'dark') {
        root.classList.add('dark');
      }
      root.style.removeProperty('--background');
      root.style.removeProperty('--foreground');
      root.style.removeProperty('--card');
      root.style.removeProperty('--card-foreground');
      root.style.removeProperty('--popover');
      root.style.removeProperty('--popover-foreground');
      root.style.removeProperty('--muted');
      root.style.removeProperty('--muted-foreground');
      root.style.removeProperty('--border');
      root.style.removeProperty('--input');
      root.style.removeProperty('--ring');
      root.style.removeProperty('color-scheme');
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
    setLoadError(false);
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
      if (data.clients.length === 0) {
        setViewState('not-found');
      } else if (data.clients.length === 1) {
        setSelectedClientId(data.clients[0].id);
        setViewState('dashboard');
      } else {
        setViewState('select-client');
      }
    } catch (error) {
      console.error('Error fetching portal data:', error);
      setLoadError(true);
      toast({
        title: "Couldn't Load Data",
        description: "Something went wrong loading your documents. Please try again.",
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

  const handleViewInvoice = (invoice: PortalInvoice) => {
    if (invoice.paymentToken) {
      window.location.href = `/portal/invoice/${invoice.paymentToken}`;
    }
  };

  const handleViewReceipt = (receipt: PortalReceipt) => {
    if (receipt.viewToken) {
      window.location.href = `/portal/receipt/${receipt.viewToken}`;
    }
  };

  const handleRequestWorker = async (workerId: string, workerName: string, jobId: string, jobTitle: string, clientId?: string) => {
    setIsSubmittingRequest(true);
    try {
      const res = await fetch('/api/portal/request-worker', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          workerId,
          workerName,
          jobId,
          jobTitle,
          clientId,
          message: requestMessage || undefined,
        })
      });
      
      if (res.ok) {
        toast({
          title: "Request Sent!",
          description: `Your request for ${workerName} has been sent to the business`,
        });
        setSubmittedRequests(prev => new Set([...prev, `${workerId}-${jobId}`]));
        setRequestingWorker(null);
        setRequestMessage('');
      } else {
        const data = await res.json();
        throw new Error(data.error || 'Failed to send request');
      }
    } catch (error: any) {
      toast({
        title: "Request Failed",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  if (viewState === 'phone') {
    return (
      <div className="min-h-screen flex flex-col relative bg-white">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at top, rgba(37,99,235,0.03), transparent, transparent)' }} />
        <div className="py-10 px-4 relative">
          <div className="max-w-md mx-auto text-center">
            <img src={jobrunnerLogo} alt="JobRunner" className="w-8 h-8 mx-auto mb-3 object-contain" />
            <h1 className="text-2xl font-bold text-slate-900">Client Portal</h1>
            <p className="text-sm text-slate-500 mt-1">Access your quotes, invoices, and job history</p>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-start px-4 relative">
          <Card className="w-full max-w-md rounded-md shadow-lg bg-white">
            <CardHeader className="text-center pb-2">
              <div className="w-14 h-14 rounded-full bg-brand/10 ring-1 ring-brand/20 flex items-center justify-center mx-auto mb-3">
                <Phone className="w-6 h-6 text-brand" />
              </div>
              <CardTitle className="text-lg text-slate-900">Verify Your Identity</CardTitle>
              <CardDescription className="text-slate-500">
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
                  className="text-center text-lg bg-white text-slate-900"
                />
              </div>
              <Button 
                onClick={handleRequestCode}
                disabled={isLoading || !phone.trim()}
                className="w-full bg-brand"
                size="lg"
              >
                {isLoading ? 'Sending...' : 'Send Verification Code'}
              </Button>
              <p className="text-xs text-center text-slate-500 flex items-center justify-center gap-1.5">
                <Shield className="w-3.5 h-3.5" />
                We'll send a 6-digit code to verify your identity
              </p>
            </CardContent>
          </Card>

          <div className="mt-4 text-center">
            <a href="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to JobRunner
            </a>
          </div>
        </div>

        <div className="text-center py-8 flex items-center justify-center gap-2">
          <img src={jobrunnerLogo} alt="JobRunner" className="w-8 h-8 object-contain" />
          <span className="text-sm text-slate-500">Powered by <span className="font-semibold text-slate-500">JobRunner</span></span>
        </div>
      </div>
    );
  }

  if (viewState === 'code') {
    return (
      <div className="min-h-screen flex flex-col relative bg-white">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at top, rgba(37,99,235,0.03), transparent, transparent)' }} />
        <div className="py-10 px-4 relative">
          <div className="max-w-md mx-auto text-center">
            <img src={jobrunnerLogo} alt="JobRunner" className="w-8 h-8 mx-auto mb-3 object-contain" />
            <h1 className="text-2xl font-bold text-slate-900">Client Portal</h1>
            <p className="text-sm text-slate-500 mt-1">Secure verification</p>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-start px-4 relative">
          <Card className="w-full max-w-md rounded-md shadow-lg bg-white">
            <CardHeader className="text-center pb-2">
              <div className="w-14 h-14 rounded-full bg-brand/10 ring-1 ring-brand/20 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6 text-brand" />
              </div>
              <CardTitle className="text-lg text-slate-900">Enter Verification Code</CardTitle>
              <CardDescription className="text-slate-500">
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
                  className="text-center text-2xl tracking-widest font-mono bg-white text-slate-900"
                  maxLength={6}
                />
              </div>
              <Button 
                onClick={handleVerifyCode}
                disabled={isLoading || code.length !== 6}
                className="w-full bg-brand"
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

        <div className="text-center py-8 flex items-center justify-center gap-2">
          <img src={jobrunnerLogo} alt="JobRunner" className="w-8 h-8 object-contain" />
          <span className="text-sm text-slate-500">Powered by <span className="font-semibold text-slate-500">JobRunner</span></span>
        </div>
      </div>
    );
  }

  if (viewState === 'not-found') {
    return (
      <div className="min-h-screen flex flex-col relative bg-white">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at top, rgba(37,99,235,0.03), transparent, transparent)' }} />
        <div className="py-10 px-4 relative">
          <div className="max-w-md mx-auto text-center">
            <img src={jobrunnerLogo} alt="JobRunner" className="w-8 h-8 mx-auto mb-3 object-contain" />
            <h1 className="text-2xl font-bold text-slate-900">Client Portal</h1>
            <p className="text-sm text-slate-500 mt-1">Account lookup</p>
          </div>
        </div>

        <div className="flex-1 flex items-start justify-center px-4 relative">
          <div className="w-full max-w-md text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8 text-slate-500" />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-slate-900">
                We couldn't find an active client profile for that contact.
              </h2>
              <p className="text-sm text-slate-500">
                If you think this is a mistake, contact your service provider.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Button
                className="w-full bg-brand"
                size="lg"
                onClick={() => window.location.href = 'mailto:admin@avwebinnovation.com?subject=Quote%20Request'}
              >
                <Mail className="w-4 h-4 mr-2" />
                Request a Quote
              </Button>
              <Button
                variant="outline"
                className="w-full"
                size="lg"
                onClick={() => window.location.href = 'tel:1300000000'}
              >
                <Phone className="w-4 h-4 mr-2" />
                Call Dispatch
              </Button>
            </div>
            <Button
              variant="ghost"
              className="text-slate-500"
              onClick={handleLogout}
            >
              Try a different number
            </Button>
          </div>
        </div>

        <div className="text-center py-8 flex items-center justify-center gap-2">
          <img src={jobrunnerLogo} alt="JobRunner" className="w-8 h-8 object-contain" />
          <span className="text-sm text-slate-500">Powered by <span className="font-semibold text-slate-500">JobRunner</span></span>
        </div>
      </div>
    );
  }

  if (viewState === 'select-client') {
    return (
      <div className="min-h-screen flex flex-col relative bg-white">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at top, rgba(37,99,235,0.03), transparent, transparent)' }} />
        <div className="py-10 px-4 relative">
          <div className="max-w-md mx-auto text-center">
            <img src={jobrunnerLogo} alt="JobRunner" className="w-8 h-8 mx-auto mb-3 object-contain" />
            <h1 className="text-2xl font-bold text-slate-900">Client Portal</h1>
            <p className="text-sm text-slate-500 mt-1">Select your account</p>
          </div>
        </div>

        <div className="flex-1 flex items-start justify-center px-4 relative">
          <div className="w-full max-w-md space-y-6">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-full bg-brand/10 ring-1 ring-brand/20 flex items-center justify-center mx-auto">
                <Users className="w-6 h-6 text-brand" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Which account are you checking?</h2>
              <p className="text-sm text-slate-500">Multiple profiles are linked to this number</p>
            </div>
            <div className="space-y-3">
              {portalData?.clients.map((client) => (
                <div
                  key={client.id}
                  className="bg-white rounded-md shadow-lg p-4 cursor-pointer hover-elevate"
                  onClick={() => {
                    setSelectedClientId(client.id);
                    setViewState('dashboard');
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-5 h-5 text-brand" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-900 truncate">{client.name}</h3>
                      {client.email && (
                        <p className="text-xs text-slate-500 truncate flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {client.email}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="text-center py-8 flex items-center justify-center gap-2">
          <img src={jobrunnerLogo} alt="JobRunner" className="w-8 h-8 object-contain" />
          <span className="text-sm text-slate-500">Powered by <span className="font-semibold text-slate-500">JobRunner</span></span>
        </div>
      </div>
    );
  }

  if (viewState === 'dashboard') {
    const filteredQuotes = selectedClientId ? portalData?.quotes.filter(q => q.clientId === selectedClientId) : portalData?.quotes;
    const filteredInvoices = selectedClientId ? portalData?.invoices.filter(i => i.clientId === selectedClientId) : portalData?.invoices;
    const filteredReceipts = selectedClientId ? portalData?.receipts.filter(r => r.clientId === selectedClientId) : portalData?.receipts;
    const filteredJobs = selectedClientId ? portalData?.jobs.filter(j => j.clientId === selectedClientId) : portalData?.jobs;
    const business = filteredQuotes?.[0]?.business || filteredInvoices?.[0]?.business || null;
    const selectedClient = portalData?.clients.find(c => c.id === selectedClientId);
    const clientName = selectedClient?.name || portalData?.clients[0]?.name;

    return (
      <div className="min-h-screen flex flex-col bg-white">
        <header className="bg-brand sticky top-0 z-20">
          <div className="px-4 py-4">
            <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                {business?.logoUrl ? (
                  <img
                    src={business.logoUrl}
                    alt={business.businessName || 'Business'}
                    className="w-8 h-8 object-contain rounded-md bg-white/10 p-1"
                  />
                ) : (
                  <img src={jobrunnerLogo} alt="JobRunner" className="w-8 h-8 object-contain" />
                )}
                <div className="min-w-0">
                  <h1 className="font-bold text-base text-white truncate">
                    {business?.businessName || 'Client Portal'}
                  </h1>
                  <div className="flex gap-3 text-xs text-white/70 flex-wrap">
                    {business?.phone && (
                      <a href={`tel:${business.phone}`} className="hover:text-white flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {business.phone}
                      </a>
                    )}
                    {business?.email && (
                      <a href={`mailto:${business.email}`} className="hover:text-white flex items-center gap-1 hidden sm:flex">
                        <Mail className="w-3 h-3" /> {business.email}
                      </a>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {portalData && portalData.clients.length > 1 && (
                  <Button variant="outline" size="sm" onClick={() => setViewState('select-client')} className="text-white border-white/30">
                    <Users className="w-4 h-4 mr-1" />
                    <span className="hidden sm:inline">Switch</span>
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handleLogout} className="text-white border-white/30">
                  <LogOut className="w-4 h-4 mr-1" />
                  <span className="hidden sm:inline">Logout</span>
                </Button>
              </div>
            </div>
          </div>
        </header>

        <div className="border-b border-slate-200 px-4 py-4">
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
                <Button variant="outline" size="sm" className="border border-slate-200"
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
            ) : loadError ? (
              <div className="text-center py-12">
                <AlertCircle className="w-12 h-12 mx-auto text-slate-500/40 mb-4" />
                <h2 className="text-lg font-semibold mb-2 text-slate-900">Couldn't load your documents</h2>
                <p className="text-sm text-slate-500 mb-4">Something went wrong. Please check your connection and try again.</p>
                <Button variant="outline" size="sm" onClick={() => sessionToken && fetchPortalData(sessionToken)}>
                  Try again
                </Button>
              </div>
            ) : (
              <Tabs defaultValue="quotes" className="w-full">
                <TabsList className="grid w-full grid-cols-4 mb-6 bg-slate-100">
                  <TabsTrigger value="quotes" className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    <span className="hidden sm:inline">Quotes</span>
                    {filteredQuotes?.length ? (
                      <Badge variant="secondary" className="ml-1">{filteredQuotes.length}</Badge>
                    ) : null}
                  </TabsTrigger>
                  <TabsTrigger value="invoices" className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    <span className="hidden sm:inline">Invoices</span>
                    {filteredInvoices?.length ? (
                      <Badge variant="secondary" className="ml-1">{filteredInvoices.length}</Badge>
                    ) : null}
                  </TabsTrigger>
                  <TabsTrigger value="receipts" className="flex items-center gap-2">
                    <Receipt className="w-4 h-4" />
                    <span className="hidden sm:inline">Receipts</span>
                    {filteredReceipts?.length ? (
                      <Badge variant="secondary" className="ml-1">{filteredReceipts.length}</Badge>
                    ) : null}
                  </TabsTrigger>
                  <TabsTrigger value="jobs" className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4" />
                    <span className="hidden sm:inline">Jobs</span>
                    {filteredJobs?.length ? (
                      <Badge variant="secondary" className="ml-1">{filteredJobs.length}</Badge>
                    ) : null}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="quotes" className="space-y-4">
                  {filteredQuotes?.length === 0 ? (
                    <div className="bg-white rounded-md shadow-lg p-10 text-center">
                      <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                        <FileText className="w-8 h-8 text-slate-500" />
                      </div>
                      <h3 className="text-lg font-semibold text-slate-900 mb-1">No Quotes Yet</h3>
                      <p className="text-sm text-slate-500">Your quotes will appear here once they're sent</p>
                    </div>
                  ) : (
                    filteredQuotes?.map((quote) => (
                      <div
                        key={quote.id}
                        className={`bg-white rounded-md shadow-lg overflow-hidden hover-elevate cursor-pointer ${
                          quote.status === 'sent'
                            ? 'border border-brand/20'
                            : ''
                        }`}
                        onClick={() => handleViewQuote(quote)}
                      >
                        <div className="p-5">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center flex-shrink-0">
                              <FileText className="w-5 h-5 text-brand" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-semibold text-slate-900 truncate">Quote #{quote.number}</h3>
                                <Badge className={getQuoteStatusColor(quote.status)}>
                                  {quote.status}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <div className="ml-13 space-y-1">
                            <p className="text-sm text-slate-500 truncate">{quote.title}</p>
                            {quote.business?.businessName && (
                              <p className="text-xs text-slate-500 flex items-center gap-1">
                                <Building2 className="w-3 h-3" />
                                {quote.business.businessName}
                              </p>
                            )}
                            <p className="text-xs text-slate-500">
                              {formatDate(quote.createdAt)}
                              {quote.validUntil && ` · Valid until ${formatDate(quote.validUntil)}`}
                            </p>
                          </div>
                          <div className="mt-4 pt-4 border-t border-slate-200">
                            <div className="flex items-center justify-between gap-4">
                              <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Amount</p>
                                <p className="text-xl font-bold text-slate-900">{formatCurrency(quote.total)}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                        {quote.status === 'sent' && (
                          <div className="px-5 pb-5">
                            <Button className="w-full" size="lg">
                              <Check className="w-4 h-4 mr-2" />
                              View & Accept Quote
                            </Button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="invoices" className="space-y-4">
                  {filteredInvoices?.length === 0 ? (
                    <div className="bg-white rounded-md shadow-lg p-10 text-center">
                      <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                        <CreditCard className="w-8 h-8 text-slate-500" />
                      </div>
                      <h3 className="text-lg font-semibold text-slate-900 mb-1">No Invoices Yet</h3>
                      <p className="text-sm text-slate-500">Your invoices will appear here once they're created</p>
                    </div>
                  ) : (
                    filteredInvoices?.map((invoice) => {
                      const isPayable = invoice.status !== 'paid' && invoice.allowOnlinePayment;
                      const isPaid = invoice.status === 'paid';
                      const isOverdue = invoice.status === 'overdue';

                      return (
                        <div
                          key={invoice.id}
                          className={`rounded-md overflow-hidden hover-elevate cursor-pointer ${
                            isPayable
                              ? 'bg-brand/5 shadow-xl border-2 border-brand/20'
                              : isPaid
                              ? 'bg-white shadow-lg border border-green-200'
                              : isOverdue
                              ? 'bg-white shadow-lg border border-red-200'
                              : 'bg-white shadow-lg'
                          }`}
                          onClick={() => handleViewInvoice(invoice)}
                        >
                          <div className="p-5">
                            <div className="flex items-center gap-3 mb-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                                isPaid
                                  ? 'bg-green-100'
                                  : isOverdue
                                  ? 'bg-red-100'
                                  : 'bg-brand/10'
                              }`}>
                                {isPaid ? (
                                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                                ) : isOverdue ? (
                                  <AlertCircle className="w-5 h-5 text-red-500" />
                                ) : (
                                  <CreditCard className="w-5 h-5 text-brand" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="font-semibold text-slate-900 truncate">Invoice #{invoice.number}</h3>
                                  <Badge className={getInvoiceStatusColor(invoice.status)}>
                                    {invoice.status}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                            <div className="ml-13 space-y-1">
                              <p className="text-sm text-slate-500 truncate">{invoice.title}</p>
                              {invoice.business?.businessName && (
                                <p className="text-xs text-slate-500 flex items-center gap-1">
                                  <Building2 className="w-3 h-3" />
                                  {invoice.business.businessName}
                                </p>
                              )}
                              <p className="text-xs text-slate-500">
                                {formatDate(invoice.createdAt)}
                                {invoice.dueDate && invoice.status !== 'paid' && ` · Due ${formatDate(invoice.dueDate)}`}
                                {invoice.paidAt && ` · Paid ${formatDate(invoice.paidAt)}`}
                              </p>
                            </div>
                            <div className="mt-4 pt-4 border-t border-slate-200">
                              <div className="flex items-center justify-between gap-4">
                                <div>
                                  <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
                                    {isPaid ? 'Amount Paid' : isOverdue ? 'Amount Overdue' : 'Amount Due'}
                                  </p>
                                  <p className={`text-xl font-bold ${
                                    isPaid ? 'text-green-700' : isOverdue ? 'text-red-600' : 'text-slate-900'
                                  }`}>{formatCurrency(invoice.total)}</p>
                                </div>
                                {isPaid && (
                                  <div className="flex items-center gap-1.5 text-green-600 text-sm font-medium">
                                    <CheckCircle2 className="w-5 h-5" />
                                    Paid
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          {isPayable && (
                            <div className="px-5 pb-5">
                              <Button className="w-full" size="lg" onClick={(e) => { e.stopPropagation(); handlePayInvoice(invoice); }}>
                                <CreditCard className="w-4 h-4 mr-2" />
                                Pay Now
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </TabsContent>

                <TabsContent value="receipts" className="space-y-4">
                  {filteredReceipts?.length === 0 ? (
                    <div className="bg-white rounded-md shadow-lg p-10 text-center">
                      <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
                        <Receipt className="w-8 h-8 text-green-300" />
                      </div>
                      <h3 className="text-lg font-semibold text-slate-900 mb-1">No Receipts Yet</h3>
                      <p className="text-sm text-slate-500">Payment receipts will appear here after completed payments</p>
                    </div>
                  ) : (
                    filteredReceipts?.map((receipt) => (
                      <div
                        key={receipt.id}
                        className="bg-white rounded-md shadow-lg border border-green-200 overflow-hidden hover-elevate cursor-pointer"
                        onClick={() => handleViewReceipt(receipt)}
                      >
                        <div className="p-5">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                              <CheckCircle2 className="w-5 h-5 text-green-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-slate-900 truncate">Receipt #{receipt.number}</h3>
                              <p className="text-xs text-slate-500">
                                Paid {formatDate(receipt.paymentDate)}
                              </p>
                            </div>
                          </div>
                          <div className="mt-4 pt-4 border-t border-green-100">
                            <div className="flex items-center justify-between gap-4">
                              <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Amount Paid</p>
                                <p className="text-xl font-bold text-green-700">{formatCurrency(receipt.total)}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="px-5 pb-5">
                          <Button variant="outline" className="w-full">
                            <Download className="w-4 h-4 mr-2" />
                            View Receipt
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="jobs" className="space-y-4">
                  {filteredJobs?.length === 0 ? (
                    <div className="bg-white rounded-md shadow-lg p-10 text-center">
                      <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                        <Briefcase className="w-8 h-8 text-slate-500" />
                      </div>
                      <h3 className="text-lg font-semibold text-slate-900 mb-1">No Jobs Yet</h3>
                      <p className="text-sm text-slate-500">Your job history will appear here</p>
                    </div>
                  ) : (
                    filteredJobs?.map((job) => {
                      const isDone = job.status === 'done' || job.status === 'completed';
                      const isInvoiced = job.status === 'invoiced';
                      const isInProgress = job.status === 'in_progress';
                      const isScheduled = job.status === 'scheduled';

                      return (
                        <div
                          key={job.id}
                          className={`bg-white rounded-md shadow-lg overflow-hidden ${
                            isDone
                              ? 'border border-green-200'
                              : isInvoiced
                              ? 'border border-purple-200'
                              : isInProgress
                              ? 'border border-orange-200'
                              : isScheduled
                              ? 'border border-blue-200'
                              : ''
                          }`}
                        >
                          <div 
                            className="p-5 cursor-pointer hover-elevate"
                            onClick={() => {
                              if (job.portalToken) {
                                window.location.href = `/p/${job.portalToken}`;
                              }
                            }}
                          >
                            <div className="flex items-center gap-3 mb-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                                isDone
                                  ? 'bg-green-100'
                                  : isInvoiced
                                  ? 'bg-purple-100'
                                  : isInProgress
                                  ? 'bg-orange-100'
                                  : isScheduled
                                  ? 'bg-blue-100'
                                  : 'bg-slate-100'
                              }`}>
                                <Briefcase className={`w-5 h-5 ${
                                  isDone
                                    ? 'text-green-600'
                                    : isInvoiced
                                    ? 'text-purple-600'
                                    : isInProgress
                                    ? 'text-orange-600'
                                    : isScheduled
                                    ? 'text-blue-600'
                                    : 'text-slate-500'
                                }`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="font-semibold text-slate-900 truncate">{job.title}</h3>
                                  <Badge className={getJobStatusColor(job.status)}>
                                    {job.status === 'done' ? 'Completed' : job.status === 'in_progress' ? 'In Progress' : job.status === 'invoiced' ? 'Invoiced' : job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                                  </Badge>
                                </div>
                              </div>
                              {job.photos && job.photos.length > 0 && (
                                <Badge variant="secondary">
                                  {job.photos.length} photo{job.photos.length !== 1 ? 's' : ''}
                                </Badge>
                              )}
                            </div>
                            <div className="ml-13 space-y-1">
                              {job.address && (
                                <p className="text-sm text-slate-500 flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {job.address}
                                </p>
                              )}
                              <p className="text-xs text-slate-500 flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {job.scheduledAt ? `Scheduled: ${formatDate(job.scheduledAt)}` : 'Not scheduled'}
                                {job.completedAt && ` · Completed: ${formatDate(job.completedAt)}`}
                              </p>
                            </div>
                          </div>
                          
                          {job.assignedWorkers && job.assignedWorkers.length > 0 && (
                            <div className="px-5 pb-4 border-t border-slate-200">
                              <div className="pt-3">
                                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-2">Assigned Team</p>
                                <div className="space-y-2">
                                  {job.assignedWorkers.map((worker) => {
                                    const requestKey = `${worker.id}-${job.id}`;
                                    const alreadyRequested = submittedRequests.has(requestKey);
                                    const isExpanded = requestingWorker?.workerId === worker.id && requestingWorker?.jobId === job.id;
                                    
                                    return (
                                      <div key={worker.id} className="space-y-2">
                                        <div className="flex items-center justify-between gap-2">
                                          <div className="flex items-center gap-2 min-w-0">
                                            <div className="w-7 h-7 rounded-full bg-brand/10 flex items-center justify-center flex-shrink-0">
                                              <UserCircle className="w-4 h-4 text-brand" />
                                            </div>
                                            <span className="text-sm font-medium text-slate-900 truncate">{worker.name}</span>
                                          </div>
                                          {alreadyRequested ? (
                                            <Badge variant="secondary" className="flex-shrink-0">
                                              <Check className="w-3 h-3 mr-1" />
                                              Requested
                                            </Badge>
                                          ) : isDone ? (
                                            <Button 
                                              variant="outline" 
                                              size="sm"
                                              className="flex-shrink-0"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                if (isExpanded) {
                                                  setRequestingWorker(null);
                                                  setRequestMessage('');
                                                } else {
                                                  setRequestingWorker({ workerId: worker.id, workerName: worker.name, jobId: job.id, jobTitle: job.title });
                                                }
                                              }}
                                            >
                                              <Heart className="w-3.5 h-3.5 mr-1" />
                                              Request Again
                                            </Button>
                                          ) : null}
                                        </div>
                                        
                                        {isExpanded && (
                                          <div className="ml-9 p-3 bg-slate-50 rounded-md space-y-2">
                                            <p className="text-xs text-slate-500">Add a note for the business (optional):</p>
                                            <textarea
                                              className="w-full text-sm border border-slate-200 rounded-md p-2 bg-white text-slate-900 resize-none"
                                              rows={2}
                                              placeholder="e.g. Great work last time, would love the same person..."
                                              value={requestMessage}
                                              onChange={(e) => setRequestMessage(e.target.value)}
                                              onClick={(e) => e.stopPropagation()}
                                            />
                                            <div className="flex gap-2">
                                              <Button 
                                                size="sm" 
                                                className="flex-1"
                                                disabled={isSubmittingRequest}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleRequestWorker(worker.id, worker.name, job.id, job.title, selectedClientId || undefined);
                                                }}
                                              >
                                                {isSubmittingRequest ? (
                                                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                                                ) : (
                                                  <MessageCircle className="w-3.5 h-3.5 mr-1" />
                                                )}
                                                Send Request
                                              </Button>
                                              <Button 
                                                variant="ghost" 
                                                size="sm"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setRequestingWorker(null);
                                                  setRequestMessage('');
                                                }}
                                              >
                                                Cancel
                                              </Button>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          )}

                          {job.portalToken && (isInProgress || isScheduled) && (
                            <div className="px-5 pb-4">
                              <Button 
                                variant="outline" 
                                className="w-full"
                                onClick={() => window.location.href = `/p/${job.portalToken}`}
                              >
                                <MapPin className="w-4 h-4 mr-2" />
                                Track Live Progress
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </TabsContent>
              </Tabs>
            )}
          </div>
        </main>

        <div className="text-center py-8 border-t border-slate-200 bg-white/80 backdrop-blur-sm flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <img src={jobrunnerLogo} alt="JobRunner" className="w-8 h-8 object-contain" />
            <span className="text-sm text-slate-500">Powered by <span className="font-semibold text-slate-900">JobRunner</span></span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500/60">
            <Shield className="w-3.5 h-3.5" />
            <span>Secure portal with industry-standard encryption</span>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
