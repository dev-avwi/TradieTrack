import { useParams, Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Check, X, Download, FileText, CreditCard, Clock, CalendarDays, Building2, Phone, Mail, MapPin, AlertCircle, CheckCircle2, FolderOpen, ArrowLeft, ShieldCheck, Lock, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
  const [acceptedName, setAcceptedName] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const [showDemoPayment, setShowDemoPayment] = useState(false);

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
        title: "Error",
        description: "Failed to download PDF",
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
      toast({
        title: "Quote Accepted",
        description: "Thank you! The tradie has been notified.",
      });
      refetch();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to accept quote",
        variant: "destructive"
      });
    } finally {
      setIsAccepting(false);
    }
  };

  const handleDeclineQuote = async () => {
    setIsDeclining(true);
    try {
      await apiRequest('POST', `/api/public/quote/${token}/decline`, {});
      toast({
        title: "Quote Declined",
        description: "The tradie has been notified.",
      });
      refetch();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to decline quote",
        variant: "destructive"
      });
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-[#2563EB]/5 p-4 md:p-8">
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-[#2563EB]/5 flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-white rounded-xl shadow-sm border border-slate-200/60">
          <CardHeader className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <CardTitle className="text-slate-900">Document Not Found</CardTitle>
            <p className="text-slate-500 text-sm mt-2">
              This link may have expired or the document doesn't exist.
            </p>
          </CardHeader>
          <CardContent className="text-center text-sm text-slate-500">
            If you received this link from a business, please contact them directly.
          </CardContent>
        </Card>
      </div>
    );
  }

  const docTypeLabel = type === 'quote' ? 'Quote' : type === 'invoice' ? 'Invoice' : 'Receipt';
  const showAcceptButtons = type === 'quote' && (data.status === 'sent' || data.status === 'draft');
  const showPayButton = type === 'invoice' && data.status !== 'paid' && data.allowOnlinePayment && data.stripePaymentLink;
  const showDemoButton = type === 'invoice' && data.status !== 'paid';
  const isAccepted = data.status === 'accepted';
  const isPaid = data.status === 'paid';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-[#2563EB]/5">
      <div className="min-h-screen flex flex-col">
        {/* Teal Branded Header */}
        <header className="bg-gradient-to-r from-[#2563EB] to-[#2563EB]/90 text-white sticky top-0 z-20">
          <div className="px-4 py-4">
            <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                {data.business.logoUrl ? (
                  <img 
                    src={data.business.logoUrl} 
                    alt={data.business.name}
                    className="w-10 h-10 object-contain rounded-md brightness-0 invert"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-md bg-white/20 backdrop-blur flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-white" />
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
        <div className="bg-white border-b border-slate-200/60 py-5 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#2563EB]/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-[#2563EB]" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{docTypeLabel} #{data.number}</h2>
                  <p className="text-sm text-slate-500">{data.title}</p>
                </div>
              </div>
              <Badge className={`${getStatusColor(data.status, type || '')} rounded-full px-3 py-1 text-sm font-medium no-default-hover-elevate no-default-active-elevate`}>
                {data.status.charAt(0).toUpperCase() + data.status.slice(1)}
              </Badge>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <main className="flex-1 px-4 py-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Client & Document Info */}
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="bg-white rounded-xl shadow-sm border border-slate-200/60">
                <CardContent className="pt-4">
                  <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Bill To</h3>
                  <p className="font-semibold text-slate-900">{data.client.name}</p>
                  {data.client.address && (
                    <p className="text-sm text-slate-500 flex items-start gap-1 mt-1">
                      <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" /> {data.client.address}
                    </p>
                  )}
                  {data.client.email && (
                    <p className="text-sm text-slate-500 mt-1">{data.client.email}</p>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-white rounded-xl shadow-sm border border-slate-200/60">
                <CardContent className="pt-4">
                  <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Details</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Date:</span>
                      <span className="font-medium text-slate-900">{formatDate(data.createdAt)}</span>
                    </div>
                    {data.validUntil && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Valid Until:</span>
                        <span className="font-medium text-slate-900">{formatDate(data.validUntil)}</span>
                      </div>
                    )}
                    {data.dueDate && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Due Date:</span>
                        <span className="font-medium text-slate-900">{formatDate(data.dueDate)}</span>
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
              <Card className="bg-white rounded-xl shadow-sm border border-slate-200/60">
                <CardContent className="py-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="w-4 h-4 text-[#2563EB]" />
                    <span className="text-slate-500">Job Site:</span>
                    <span className="font-medium text-slate-900">{data.job.address}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {data.description && (
              <Card className="bg-white rounded-xl shadow-sm border border-slate-200/60">
                <CardContent className="py-3">
                  <p className="text-sm text-slate-600">{data.description}</p>
                </CardContent>
              </Card>
            )}

            {/* Line Items Table */}
            <Card className="bg-white rounded-xl shadow-sm border border-slate-200/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-slate-900">Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="hidden sm:grid sm:grid-cols-12 text-xs font-medium text-slate-500 uppercase tracking-wider pb-2 border-b border-slate-100">
                  <div className="col-span-6">Description</div>
                  <div className="col-span-2 text-right">Qty</div>
                  <div className="col-span-2 text-right">Rate</div>
                  <div className="col-span-2 text-right">Amount</div>
                </div>
                
                <div className="divide-y divide-slate-100">
                  {data.lineItems.map((item, idx) => (
                    <div key={item.id || idx} className="py-3 sm:grid sm:grid-cols-12 sm:gap-2 space-y-1 sm:space-y-0">
                      <div className="col-span-6 font-medium text-slate-900">{item.description}</div>
                      <div className="col-span-2 text-right text-slate-600">
                        <span className="sm:hidden text-xs">Qty: </span>{parseFloat(item.quantity).toFixed(2)}
                      </div>
                      <div className="col-span-2 text-right text-slate-600">
                        <span className="sm:hidden text-xs">Rate: </span>{formatCurrency(item.unitPrice)}
                      </div>
                      <div className="col-span-2 text-right font-medium text-slate-900">{formatCurrency(item.total)}</div>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className="border-t border-slate-200 pt-4 mt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Subtotal</span>
                    <span className="text-slate-900">{formatCurrency(data.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">GST (10%)</span>
                    <span className="text-slate-900">{formatCurrency(data.gstAmount)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-xl pt-3 border-t border-slate-200">
                    <span className="text-slate-900">Total (AUD)</span>
                    <span className="text-[#2563EB]">{formatCurrency(data.total)}</span>
                  </div>
                  {data.depositRequired && data.depositAmount && (
                    <div className="flex justify-between text-[#2563EB] text-sm pt-1">
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
              <Card className="bg-white rounded-xl shadow-sm border border-[#2563EB]/20">
                <CardContent className="pt-5 pb-5">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-8 h-8 bg-[#2563EB]/10 rounded-full flex items-center justify-center">
                        <FileText className="w-4 h-4 text-[#2563EB]" />
                      </div>
                      <h3 className="font-semibold text-slate-900">Ready to accept this quote?</h3>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Your Name</label>
                      <Input
                        type="text"
                        placeholder="Enter your full name"
                        value={acceptedName}
                        onChange={(e) => setAcceptedName(e.target.value)}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Your Signature</label>
                      <SignaturePad 
                        onSignatureChange={setSignature}
                        className="w-full"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        onClick={handleAcceptQuote}
                        disabled={isAccepting || !acceptedName.trim() || !signature}
                        className="flex-1 bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
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
                        className="border-slate-300 text-slate-700"
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
              <Card className="bg-white rounded-xl shadow-sm border border-[#2563EB]/20">
                <CardContent className="pt-5 pb-5">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-8 h-8 bg-[#2563EB]/10 rounded-full flex items-center justify-center">
                        <CreditCard className="w-4 h-4 text-[#2563EB]" />
                      </div>
                      <h3 className="font-semibold text-slate-900">Pay securely online</h3>
                    </div>
                    <Button 
                      onClick={handlePayNow}
                      className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
                      size="lg"
                    >
                      <CreditCard className="w-5 h-5 mr-2" />
                      Pay {formatCurrency(data.total)} Now
                    </Button>
                    <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
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
              className="w-full border-[#2563EB]/30 text-[#2563EB]"
            >
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-slate-200/60 py-5 px-4 mt-auto">
          <div className="max-w-4xl mx-auto text-center space-y-2">
            <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="w-4 h-4 text-[#2563EB]" />
              <span>Secure & encrypted</span>
            </div>
            <p className="text-xs text-slate-400">
              Powered by <span className="text-[#2563EB] font-medium">JobRunner</span> · Questions? Contact{' '}
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
