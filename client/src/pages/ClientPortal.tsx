import { useParams, Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, X, Download, FileText, CreditCard, Clock, CalendarDays, Building2, Phone, Mail, MapPin, AlertCircle, CheckCircle2, FolderOpen, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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
      case 'accepted': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'declined': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'sent': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  }
  if (type === 'invoice') {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'overdue': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'sent': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  }
  return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
}

export default function ClientPortal() {
  const { type, token } = useParams<{ type: string; token: string }>();
  const { toast } = useToast();
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [acceptedName, setAcceptedName] = useState('');

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
    
    setIsAccepting(true);
    try {
      await apiRequest('POST', `/api/public/quote/${token}/accept`, { 
        acceptedBy: acceptedName.trim() 
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
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <CardTitle>Document Not Found</CardTitle>
            <CardDescription>
              This link may have expired or the document doesn't exist.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center text-sm text-muted-foreground">
            If you received this link from a business, please contact them directly.
          </CardContent>
        </Card>
      </div>
    );
  }

  const docTypeLabel = type === 'quote' ? 'Quote' : type === 'invoice' ? 'Invoice' : 'Receipt';
  // Show accept buttons for quotes that are sent or draft (for testing)
  const showAcceptButtons = type === 'quote' && (data.status === 'sent' || data.status === 'draft');
  const showPayButton = type === 'invoice' && data.status !== 'paid' && data.allowOnlinePayment && data.stripePaymentLink;
  const isAccepted = data.status === 'accepted';
  const isPaid = data.status === 'paid';

  return (
    <div className="min-h-screen bg-muted/30 dark:bg-background">
      {/* Document Container - Full page feel */}
      <div className="min-h-screen flex flex-col">
        {/* Sticky Header with Business Info */}
        <header className="bg-card border-b sticky top-0 z-20 shadow-sm">
          <div className="px-4 py-3">
            <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                {data.business.logoUrl ? (
                  <img 
                    src={data.business.logoUrl} 
                    alt={data.business.name}
                    className="w-10 h-10 object-contain rounded border"
                  />
                ) : (
                  <div className="w-10 h-10 rounded border bg-primary/10 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                )}
                <div className="min-w-0">
                  <h1 className="font-bold text-base truncate">{data.business.name}</h1>
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    {data.business.phone && (
                      <a href={`tel:${data.business.phone}`} className="hover:text-primary flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {data.business.phone}
                      </a>
                    )}
                    {data.business.email && (
                      <a href={`mailto:${data.business.email}`} className="hover:text-primary flex items-center gap-1 hidden sm:flex">
                        <Mail className="w-3 h-3" /> {data.business.email}
                      </a>
                    )}
                  </div>
                </div>
              </div>
              <Link href="/portal">
                <Button variant="outline" size="sm">
                  <FolderOpen className="w-4 h-4 mr-1" />
                  <span className="hidden sm:inline">All Documents</span>
                </Button>
              </Link>
            </div>
          </div>
        </header>

        {/* Document Title Bar */}
        <div className="bg-primary text-primary-foreground py-4 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <FileText className="w-6 h-6" />
                <div>
                  <h2 className="text-xl font-bold">{docTypeLabel} #{data.number}</h2>
                  <p className="text-sm opacity-90">{data.title}</p>
                </div>
              </div>
              <Badge className={`${getStatusColor(data.status, type || '')} text-sm px-3 py-1`}>
                {data.status.charAt(0).toUpperCase() + data.status.slice(1)}
              </Badge>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <main className="flex-1 px-4 py-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Document Info Card */}
            <div className="grid md:grid-cols-2 gap-4">
              {/* Client Details */}
              <Card>
                <CardContent className="pt-4">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Bill To</h3>
                  <p className="font-semibold">{data.client.name}</p>
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

              {/* Document Details */}
              <Card>
                <CardContent className="pt-4">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Details</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Date:</span>
                      <span className="font-medium">{formatDate(data.createdAt)}</span>
                    </div>
                    {data.validUntil && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Valid Until:</span>
                        <span className="font-medium">{formatDate(data.validUntil)}</span>
                      </div>
                    )}
                    {data.dueDate && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Due Date:</span>
                        <span className="font-medium">{formatDate(data.dueDate)}</span>
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

            {/* Job Site if different */}
            {data.job?.address && data.job.address !== data.client.address && (
              <Card className="border-primary/20">
                <CardContent className="py-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="w-4 h-4 text-primary" />
                    <span className="text-muted-foreground">Job Site:</span>
                    <span className="font-medium">{data.job.address}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {data.description && (
              <Card>
                <CardContent className="py-3">
                  <p className="text-sm text-muted-foreground">{data.description}</p>
                </CardContent>
              </Card>
            )}

            {/* Line Items Table */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Items</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Table Header */}
                <div className="hidden sm:grid sm:grid-cols-12 text-xs font-medium text-muted-foreground uppercase tracking-wider pb-2 border-b">
                  <div className="col-span-6">Description</div>
                  <div className="col-span-2 text-right">Qty</div>
                  <div className="col-span-2 text-right">Rate</div>
                  <div className="col-span-2 text-right">Amount</div>
                </div>
                
                {/* Items */}
                <div className="divide-y">
                  {data.lineItems.map((item, idx) => (
                    <div key={item.id || idx} className="py-3 sm:grid sm:grid-cols-12 sm:gap-2 space-y-1 sm:space-y-0">
                      <div className="col-span-6 font-medium">{item.description}</div>
                      <div className="col-span-2 text-right text-muted-foreground sm:text-foreground">
                        <span className="sm:hidden text-xs">Qty: </span>{parseFloat(item.quantity).toFixed(2)}
                      </div>
                      <div className="col-span-2 text-right text-muted-foreground sm:text-foreground">
                        <span className="sm:hidden text-xs">Rate: </span>{formatCurrency(item.unitPrice)}
                      </div>
                      <div className="col-span-2 text-right font-medium">{formatCurrency(item.total)}</div>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className="border-t pt-4 mt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatCurrency(data.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">GST (10%)</span>
                    <span>{formatCurrency(data.gstAmount)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg pt-2 border-t">
                    <span>Total (AUD)</span>
                    <span>{formatCurrency(data.total)}</span>
                  </div>
                  {data.depositRequired && data.depositAmount && (
                    <div className="flex justify-between text-primary text-sm pt-1">
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
              <Card className="border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/30">
                <CardContent className="py-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                    <div>
                      <p className="font-medium text-green-800 dark:text-green-200">Quote Accepted</p>
                      <p className="text-sm text-green-700 dark:text-green-400">
                        Accepted by {data.acceptedBy} on {formatDate(data.acceptedAt)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Payment Status */}
            {isPaid && type === 'invoice' && (
              <Card className="border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/30">
                <CardContent className="py-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                    <div>
                      <p className="font-medium text-green-800 dark:text-green-200">Payment Received</p>
                      <p className="text-sm text-green-700 dark:text-green-400">
                        Paid on {formatDate(data.paidAt)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Action Buttons - Prominent */}
            {(showAcceptButtons || showPayButton) && (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="pt-4 pb-4">
                  {showAcceptButtons && (
                    <div className="space-y-3">
                      <h3 className="font-semibold text-center">Ready to accept this quote?</h3>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Enter your name to accept"
                          value={acceptedName}
                          onChange={(e) => setAcceptedName(e.target.value)}
                          className="flex-1 px-4 py-3 border rounded-md"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          onClick={handleAcceptQuote}
                          disabled={isAccepting || !acceptedName.trim()}
                          className="flex-1"
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
                        >
                          <X className="w-5 h-5 mr-2" />
                          Decline
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {showPayButton && (
                    <div className="space-y-3">
                      <h3 className="font-semibold text-center">Pay securely online</h3>
                      <Button 
                        onClick={handlePayNow}
                        className="w-full"
                        size="lg"
                      >
                        <CreditCard className="w-5 h-5 mr-2" />
                        Pay {formatCurrency(data.total)} Now
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Download PDF */}
            <Button 
              variant="outline" 
              onClick={handleDownloadPdf}
              className="w-full"
            >
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t bg-card py-4 px-4 mt-auto">
          <div className="max-w-4xl mx-auto text-center text-xs text-muted-foreground">
            <p>Powered by TradieTrack • Questions? Contact <a href={`tel:${data.business.phone}`} className="hover:underline text-foreground">{data.business.name}</a></p>
          </div>
        </footer>
      </div>
    </div>
  );
}
