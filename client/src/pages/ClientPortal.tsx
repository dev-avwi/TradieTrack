import { useParams, Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Check, X, Download, FileText, CreditCard, Clock, CalendarDays, Building2, Phone, Mail, MapPin, AlertCircle, CheckCircle2, FolderOpen, ArrowLeft, ShieldCheck, Lock, Sparkles } from "lucide-react";
import { useState, useEffect, useLayoutEffect } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/lib/analytics";
import { SignaturePad } from "@/components/ui/signature-pad";
import DemoPaymentSimulator from "@/components/DemoPaymentSimulator";

interface DocumentData {
  type: 'quote' | 'invoice' | 'receipt';
  id: string;
  number: string;
  title: string;
  description?: string;
  status: string;
  subtotal: string;
  gstAmount: string;
  total: string;
  createdAt: string;
  validUntil?: string;
  dueDate?: string;
  paidAt?: string;
  acceptedAt?: string;
  acceptedBy?: string;
  depositRequired?: boolean;
  depositAmount?: string;
  depositPaid?: boolean;
  allowOnlinePayment?: boolean;
  stripePaymentLink?: string;
  lineItems: Array<{
    id: string;
    description: string;
    quantity: string;
    unitPrice: string;
    total: string;
  }>;
  client: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
  };
  business: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    abn?: string;
    logoUrl?: string;
  };
  job?: {
    title: string;
    address?: string;
  };
}

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

function getStatusColor(status: string, type: string): string {
  if (type === 'quote') {
    switch (status) {
      case 'accepted': return 'bg-green-100 text-green-800';
      case 'declined': return 'bg-red-100 text-red-800';
      case 'sent': return 'bg-blue-100 text-blue-800';
      default: return 'bg-slate-100 text-slate-700';
    }
  }
  if (type === 'invoice') {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'sent': return 'bg-blue-100 text-blue-800';
      default: return 'bg-slate-100 text-slate-700';
    }
  }
  return 'bg-green-100 text-green-800';
}

export default function ClientPortal() {
  const { type, token } = useParams<{ type: string; token: string }>();
  const { toast } = useToast();
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [localDeclined, setLocalDeclined] = useState(false);
  const [declineAnimating, setDeclineAnimating] = useState(false);
  const [acceptedName, setAcceptedName] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const [showDemoPayment, setShowDemoPayment] = useState(false);

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

  const { data, isLoading, error, refetch } = useQuery<DocumentData>({
    queryKey: ['/api/public/document', type, token],
    queryFn: async () => {
      const res = await fetch(`/api/public/document/${type}/${token}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Document not found');
      }
      return res.json();
    },
    retry: false
  });

  const handleDownloadPdf = async () => {
    try {
      let pdfUrl = '';
      if (type === 'quote') {
        pdfUrl = `/api/public/quote/${token}/pdf`;
      } else if (type === 'invoice') {
        pdfUrl = `/api/public/invoice/${token}/pdf`;
      } else if (type === 'receipt') {
        pdfUrl = `/api/public/receipt/${token}/pdf`;
      }
      window.open(pdfUrl, '_blank');
    } catch (err) {
      toast({
        title: "Download Failed",
        description: "Couldn't download the PDF. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleAcceptQuote = async () => {
    if (!acceptedName.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter your name to accept this quote",
        variant: "destructive"
      });
      return;
    }
    if (!signature) {
      toast({
        title: "Signature Required",
        description: "Please sign below to accept this quote",
        variant: "destructive"
      });
      return;
    }
    
    setIsAccepting(true);
    try {
      await apiRequest('POST', `/api/public/quote/${token}/accept`, { 
        acceptedBy: acceptedName.trim(),
        signature: signature
      });
      trackEvent('quote_accepted');
      toast({
        title: "Quote Accepted",
        description: "Thank you! The tradie has been notified.",
      });
      refetch();
    } catch (err: any) {
      toast({
        title: "Couldn't Accept Quote",
        description: `Couldn't accept this quote right now. Please try again or contact ${data?.business?.name || 'the business'}.`,
        variant: "destructive"
      });
    } finally {
      setIsAccepting(false);
    }
  };

  const handleDeclineQuote = async () => {
    if (localDeclined || isDeclining) return;
    if (!window.confirm('Are you sure you want to decline this quote? The tradie will be notified.')) {
      return;
    }
    setIsDeclining(true);
    try {
      await apiRequest('POST', `/api/public/quote/${token}/decline`, {});
      setDeclineAnimating(true);
      queryClient.setQueryData(['/api/public/document', type, token], (old: any) => 
        old ? { ...old, status: 'declined' } : old
      );
      setTimeout(() => {
        setLocalDeclined(true);
        setDeclineAnimating(false);
        refetch();
      }, 1500);
    } catch (err: any) {
      const errorMsg = err?.message || '';
      if (errorMsg.includes('already declined')) {
        setLocalDeclined(true);
        refetch();
      } else {
        toast({
          title: "Couldn't Decline Quote",
          description: `Something went wrong. Please try again or contact ${data?.business?.name || 'the business'}.`,
          variant: "destructive"
        });
      }
    } finally {
      setIsDeclining(false);
    }
  };

  const handlePayNow = () => {
    if (data?.stripePaymentLink) {
      window.location.href = data.stripePaymentLink;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen p-4 md:p-8 bg-white">
        <div className="max-w-3xl mx-auto space-y-6">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-white">
        <div className="max-w-md w-full text-center py-12">
          <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
          <h2 className="text-lg font-semibold mb-2 text-foreground">Document not found</h2>
          <p className="text-sm text-muted-foreground mb-4">This link may have expired or the document may no longer be available.</p>
          <p className="text-xs text-muted-foreground">If you think this is an error, please contact the business that sent this to you.</p>
        </div>
      </div>
    );
  }

  const docTypeLabel = type === 'quote' ? 'Quote' : type === 'invoice' ? 'Invoice' : 'Receipt';
  const effectiveStatus = (localDeclined || declineAnimating) ? 'declined' : data.status;
  const isQuoteDeclined = effectiveStatus === 'declined' && type === 'quote';
  const showAcceptButtons = type === 'quote' && !localDeclined && !declineAnimating && (data.status === 'sent' || data.status === 'draft');
  const showPayButton = type === 'invoice' && effectiveStatus !== 'paid' && data.allowOnlinePayment && data.stripePaymentLink;
  const showDemoButton = type === 'invoice' && effectiveStatus !== 'paid';
  const isAccepted = effectiveStatus === 'accepted';
  const isPaid = effectiveStatus === 'paid';

  return (
    <div className="min-h-screen bg-white relative">
      {declineAnimating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-rose-50/90 animate-in fade-in duration-500">
          <div className="text-center space-y-4 animate-in zoom-in-95 duration-700">
            <div className="w-20 h-20 mx-auto bg-rose-100 rounded-full flex items-center justify-center">
              <X className="w-10 h-10 text-rose-400" />
            </div>
            <h2 className="text-2xl font-bold text-rose-600">Quote Declined</h2>
            <p className="text-rose-500 text-sm max-w-xs mx-auto">
              The tradie has been notified of your decision.
            </p>
          </div>
        </div>
      )}
      <div className={`min-h-screen flex flex-col ${isQuoteDeclined && !declineAnimating ? 'opacity-100' : ''}`}>
        {/* Declined Banner */}
        {isQuoteDeclined && !declineAnimating && (
          <div className="bg-rose-100 text-rose-600 py-3 px-4 text-center border-b border-rose-200">
            <div className="flex items-center justify-center gap-2">
              <X className="w-4 h-4" />
              <span className="font-medium text-sm">This quote has been declined</span>
            </div>
          </div>
        )}
        {/* Teal Branded Header */}
        <header className="bg-brand text-white sticky top-0 z-20">
          <div className="px-4 py-4">
            <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                {data.business.logoUrl ? (
                  <img 
                    src={data.business.logoUrl} 
                    alt={data.business.name}
                    className="w-12 h-12 object-contain rounded-md bg-white/15 p-0.5"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-md bg-white/20 backdrop-blur flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-white" />
                  </div>
                )}
                <div className="min-w-0">
                  <h1 className="font-bold text-base truncate text-white">{data.business.name}</h1>
                  <div className="flex gap-3 text-xs text-white/70">
                    {data.business.phone && (
                      <a href={`tel:${data.business.phone}`} className="hover:text-white flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {data.business.phone}
                      </a>
                    )}
                    {data.business.email && (
                      <a href={`mailto:${data.business.email}`} className="hover:text-white flex items-center gap-1 hidden sm:flex">
                        <Mail className="w-3 h-3" /> {data.business.email}
                      </a>
                    )}
                  </div>
                </div>
              </div>
              <Link href={`/portal?doc=${type}&token=${token}`}>
                <Button variant="outline" size="sm" className="border-white/30 text-white bg-white/10 hover:bg-white/20">
                  <FolderOpen className="w-4 h-4 mr-1" />
                  <span className="hidden sm:inline">All Documents</span>
                </Button>
              </Link>
            </div>
          </div>
        </header>

        {/* Document Title Section */}
        <div className="bg-white border-b border-slate-100 py-5 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-brand" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">{docTypeLabel} #{data.number}</h2>
                  <p className="text-sm text-muted-foreground">{data.title}</p>
                </div>
              </div>
              <Badge className={`${getStatusColor(effectiveStatus, type || '')} rounded-full px-3 py-1 text-sm font-medium no-default-hover-elevate no-default-active-elevate`}>
                {effectiveStatus.charAt(0).toUpperCase() + effectiveStatus.slice(1)}
              </Badge>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <main className="flex-1 px-4 py-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Client & Document Info */}
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="bg-white rounded-xl shadow-sm border-slate-200">
                <CardContent className="pt-4">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Bill To</h3>
                  <p className="font-semibold text-foreground">{data.client.name}</p>
                  {data.client.address && (
                    <p className="text-sm text-muted-foreground flex items-start gap-1 mt-1">
                      <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" /> {data.client.address}
                    </p>
                  )}
                  {data.client.email && (
                    <p className="text-sm text-muted-foreground mt-1">{data.client.email}</p>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-white rounded-xl shadow-sm border-slate-200">
                <CardContent className="pt-4">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Details</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Date:</span>
                      <span className="font-medium text-foreground">{formatDate(data.createdAt)}</span>
                    </div>
                    {data.validUntil && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Valid Until:</span>
                        <span className="font-medium text-foreground">{formatDate(data.validUntil)}</span>
                      </div>
                    )}
                    {data.dueDate && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Due Date:</span>
                        <span className="font-medium text-foreground">{formatDate(data.dueDate)}</span>
                      </div>
                    )}
                    {data.paidAt && (
                      <div className="flex justify-between text-green-600">
                        <span>Paid:</span>
                        <span className="font-medium">{formatDate(data.paidAt)}</span>
                      </div>
                    )}
                    {data.acceptedAt && (
                      <div className="flex justify-between text-green-600">
                        <span>Accepted:</span>
                        <span className="font-medium">{formatDate(data.acceptedAt)}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Job Site */}
            {data.job?.address && data.job.address !== data.client.address && (
              <Card className="bg-white rounded-xl shadow-sm border-slate-200">
                <CardContent className="py-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="w-4 h-4 text-brand" />
                    <span className="text-muted-foreground">Job Site:</span>
                    <span className="font-medium text-foreground">{data.job.address}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {data.description && (
              <Card className="bg-white rounded-xl shadow-sm border-slate-200">
                <CardContent className="py-3">
                  <p className="text-sm text-slate-600">{data.description}</p>
                </CardContent>
              </Card>
            )}

            {/* Line Items Table */}
            <Card className="bg-white rounded-xl shadow-sm border-slate-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-foreground">Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="hidden sm:grid sm:grid-cols-12 text-xs font-medium text-muted-foreground uppercase tracking-wider pb-2 border-b border-slate-100">
                  <div className="col-span-6">Description</div>
                  <div className="col-span-2 text-right">Qty</div>
                  <div className="col-span-2 text-right">Rate</div>
                  <div className="col-span-2 text-right">Amount</div>
                </div>
                
                <div className="divide-y divide-slate-100">
                  {data.lineItems.map((item, idx) => (
                    <div key={item.id || idx} className="py-3 sm:grid sm:grid-cols-12 sm:gap-2 space-y-1 sm:space-y-0">
                      <div className="col-span-6 font-medium text-foreground">{item.description}</div>
                      <div className="col-span-2 text-right text-slate-600">
                        <span className="sm:hidden text-xs">Qty: </span>{parseFloat(item.quantity).toFixed(2)}
                      </div>
                      <div className="col-span-2 text-right text-slate-600">
                        <span className="sm:hidden text-xs">Rate: </span>{formatCurrency(item.unitPrice)}
                      </div>
                      <div className="col-span-2 text-right font-medium text-foreground">{formatCurrency(item.total)}</div>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className="border-t border-slate-100 pt-4 mt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="text-foreground">{formatCurrency(data.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">GST (10%)</span>
                    <span className="text-foreground">{formatCurrency(data.gstAmount)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-xl pt-3 border-t border-slate-100">
                    <span className="text-foreground">Total (AUD)</span>
                    <span className="text-brand">{formatCurrency(data.total)}</span>
                  </div>
                  {data.depositRequired && data.depositAmount && (
                    <div className="flex justify-between text-brand text-sm pt-1">
                      <span>Deposit Required</span>
                      <span className="flex items-center gap-1">
                        {formatCurrency(data.depositAmount)}
                        {data.depositPaid && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Acceptance Status */}
            {isAccepted && data.acceptedBy && (
              <Card className="bg-white rounded-xl shadow-sm border border-green-200">
                <CardContent className="py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-green-800">Quote Accepted</p>
                      <p className="text-sm text-green-600">
                        Accepted by {data.acceptedBy} on {formatDate(data.acceptedAt)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quote Declined Status */}
            {isQuoteDeclined && !declineAnimating && (
              <Card className="bg-rose-50/60 rounded-xl shadow-sm border border-rose-200">
                <CardContent className="py-5">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <X className="w-6 h-6 text-rose-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-rose-600 text-base">Quote Declined</p>
                      <p className="text-sm text-rose-500 mt-1">
                        This quote has been declined. Contact {data.business?.name || 'the business'} if you change your mind.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quote Accepted Status */}
            {isAccepted && type === 'quote' && !data.acceptedBy && (
              <Card className="bg-white rounded-xl shadow-sm border border-green-200">
                <CardContent className="py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-green-800">Quote Accepted</p>
                      <p className="text-sm text-green-600">
                        You accepted this quote{data.acceptedAt ? ` on ${new Date(data.acceptedAt).toLocaleDateString('en-AU')}` : ''}.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Payment Status */}
            {isPaid && type === 'invoice' && (
              <Card className="bg-white rounded-xl shadow-sm border border-green-200">
                <CardContent className="py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-green-800">Payment Received</p>
                      <p className="text-sm text-green-600">
                        Paid on {formatDate(data.paidAt)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quote Accept/Decline Card */}
            {showAcceptButtons && (
              <Card className="bg-white rounded-xl shadow-sm border border-brand/20">
                <CardContent className="pt-5 pb-5">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-8 h-8 bg-brand/10 rounded-full flex items-center justify-center">
                        <FileText className="w-4 h-4 text-brand" />
                      </div>
                      <h3 className="font-semibold text-foreground">Ready to accept this quote?</h3>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Your Name</label>
                      <Input
                        type="text"
                        placeholder="Enter your full name"
                        value={acceptedName}
                        onChange={(e) => setAcceptedName(e.target.value)}
                        className="w-full text-foreground bg-white border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Your Signature</label>
                      <SignaturePad 
                        onSignatureChange={setSignature}
                        className="w-full"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        onClick={handleAcceptQuote}
                        disabled={isAccepting || !acceptedName.trim() || !signature}
                        className="flex-1 bg-brand text-white"
                        size="lg"
                      >
                        <Check className="w-5 h-5 mr-2" />
                        {isAccepting ? 'Accepting...' : 'Accept Quote'}
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={handleDeclineQuote}
                        disabled={isDeclining}
                        size="lg"
                        className="border-slate-300 text-foreground"
                      >
                        <X className="w-5 h-5 mr-2" />
                        Decline
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Invoice Pay Card */}
            {showPayButton && (
              <Card className="bg-white rounded-xl shadow-sm border border-brand/20">
                <CardContent className="pt-5 pb-5">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-8 h-8 bg-brand/10 rounded-full flex items-center justify-center">
                        <CreditCard className="w-4 h-4 text-brand" />
                      </div>
                      <h3 className="font-semibold text-foreground">Pay securely online</h3>
                    </div>
                    <Button 
                      onClick={handlePayNow}
                      className="w-full bg-brand text-white"
                      size="lg"
                    >
                      <CreditCard className="w-5 h-5 mr-2" />
                      Pay {formatCurrency(data.total)} Now
                    </Button>
                    <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                      <Lock className="w-3 h-3 text-green-600" />
                      <span>Encrypted & secure via Stripe</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Demo Payment Button for invoices */}
            {showDemoButton && (
              <Button 
                variant="outline"
                onClick={() => setShowDemoPayment(true)}
                className="w-full border-orange-300 text-orange-700"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Test Payment (Demo)
              </Button>
            )}

            {/* Download PDF */}
            <Button 
              variant="outline" 
              onClick={handleDownloadPdf}
              className="w-full border-brand/30 text-brand"
            >
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-slate-100 py-5 px-4 mt-auto">
          <div className="max-w-4xl mx-auto text-center space-y-2">
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="w-4 h-4 text-brand" />
              <span>Secure & encrypted</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Powered by <span className="text-brand font-medium">JobRunner</span> · Questions? Contact{' '}
              <a href={`tel:${data.business.phone}`} className="hover:underline text-slate-600">{data.business.name}</a>
            </p>
          </div>
        </footer>
      </div>

      {/* Demo Payment Simulator */}
      {showDemoButton && (
        <DemoPaymentSimulator
          invoiceId={data.id}
          invoiceNumber={data.number}
          invoiceTotal={data.total}
          clientName={data.client.name}
          isOpen={showDemoPayment}
          onClose={() => setShowDemoPayment(false)}
          onPaymentComplete={() => refetch()}
        />
      )}
    </div>
  );
}
