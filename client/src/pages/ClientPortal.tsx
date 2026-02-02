import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, X, Download, FileText, CreditCard, Clock, CalendarDays, Building2, Phone, Mail, MapPin, AlertCircle, CheckCircle2, FolderOpen } from "lucide-react";
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
  const showAcceptButtons = type === 'quote' && data.status === 'sent';
  const showPayButton = type === 'invoice' && data.status !== 'paid' && data.allowOnlinePayment && data.stripePaymentLink;
  const isAccepted = data.status === 'accepted';
  const isPaid = data.status === 'paid';

  return (
    <div className="min-h-screen bg-muted/30 dark:bg-background">
      <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-6">
        {/* Business Header */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              {data.business.logoUrl && (
                <img 
                  src={data.business.logoUrl} 
                  alt={data.business.name}
                  className="w-16 h-16 object-contain rounded-lg"
                />
              )}
              <div className="flex-1">
                <h1 className="text-xl font-bold">{data.business.name}</h1>
                {data.business.abn && (
                  <p className="text-sm text-muted-foreground">ABN: {data.business.abn}</p>
                )}
                <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
                  {data.business.phone && (
                    <a href={`tel:${data.business.phone}`} className="flex items-center gap-1 hover:text-foreground">
                      <Phone className="w-3 h-3" /> {data.business.phone}
                    </a>
                  )}
                  {data.business.email && (
                    <a href={`mailto:${data.business.email}`} className="flex items-center gap-1 hover:text-foreground">
                      <Mail className="w-3 h-3" /> {data.business.email}
                    </a>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Document Header */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-5 h-5 text-primary" />
                  <CardTitle className="text-lg">{docTypeLabel} #{data.number}</CardTitle>
                </div>
                <CardDescription>{data.title}</CardDescription>
              </div>
              <Badge className={getStatusColor(data.status, type || '')}>
                {data.status.charAt(0).toUpperCase() + data.status.slice(1)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Key Info Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Date</p>
                <p className="font-medium">{formatDate(data.createdAt)}</p>
              </div>
              {data.validUntil && (
                <div>
                  <p className="text-muted-foreground">Valid Until</p>
                  <p className="font-medium">{formatDate(data.validUntil)}</p>
                </div>
              )}
              {data.dueDate && (
                <div>
                  <p className="text-muted-foreground">Due Date</p>
                  <p className="font-medium">{formatDate(data.dueDate)}</p>
                </div>
              )}
              {data.paidAt && (
                <div>
                  <p className="text-muted-foreground">Paid On</p>
                  <p className="font-medium text-green-600">{formatDate(data.paidAt)}</p>
                </div>
              )}
              {data.acceptedAt && (
                <div>
                  <p className="text-muted-foreground">Accepted</p>
                  <p className="font-medium text-green-600">{formatDate(data.acceptedAt)}</p>
                </div>
              )}
            </div>

            {/* Client Info */}
            <div className="pt-2">
              <p className="text-sm text-muted-foreground mb-1">For</p>
              <p className="font-medium">{data.client.name}</p>
              {data.client.address && (
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                  <MapPin className="w-3 h-3" /> {data.client.address}
                </p>
              )}
            </div>

            {/* Job Site */}
            {data.job?.address && (
              <div className="pt-2">
                <p className="text-sm text-muted-foreground mb-1">Job Site</p>
                <p className="text-sm flex items-center gap-1">
                  <Building2 className="w-3 h-3" /> {data.job.address}
                </p>
              </div>
            )}

            {data.description && (
              <div className="pt-2">
                <p className="text-sm text-muted-foreground mb-1">Description</p>
                <p className="text-sm">{data.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Line Items */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.lineItems.map((item, idx) => (
                <div key={item.id || idx} className="flex justify-between items-start gap-4 pb-3 border-b last:border-0 last:pb-0">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{item.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {parseFloat(item.quantity).toFixed(2)} × {formatCurrency(item.unitPrice)}
                    </p>
                  </div>
                  <p className="font-medium text-sm whitespace-nowrap">{formatCurrency(item.total)}</p>
                </div>
              ))}
            </div>

            <Separator className="my-4" />

            {/* Totals */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(data.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">GST (10%)</span>
                <span>{formatCurrency(data.gstAmount)}</span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span>{formatCurrency(data.total)}</span>
              </div>
              {data.depositRequired && data.depositAmount && (
                <div className="flex justify-between text-primary">
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

        {/* Acceptance Status for Accepted Quotes */}
        {isAccepted && data.acceptedBy && (
          <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
                <div>
                  <p className="font-medium">Quote Accepted</p>
                  <p className="text-sm text-muted-foreground">
                    Accepted by {data.acceptedBy} on {formatDate(data.acceptedAt)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payment Received for Paid Invoices */}
        {isPaid && type === 'invoice' && (
          <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
                <div>
                  <p className="font-medium">Payment Received</p>
                  <p className="text-sm text-muted-foreground">
                    Paid on {formatDate(data.paidAt)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        {(showAcceptButtons || showPayButton) && (
          <Card>
            <CardContent className="pt-6">
              {showAcceptButtons && (
                <div className="space-y-4">
                  <p className="text-center text-sm text-muted-foreground mb-4">
                    Ready to proceed? Accept this quote to confirm.
                  </p>
                  <div className="flex flex-col gap-3">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Your name"
                        value={acceptedName}
                        onChange={(e) => setAcceptedName(e.target.value)}
                        className="flex-1 px-3 py-2 border rounded-md text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        onClick={handleAcceptQuote}
                        disabled={isAccepting || !acceptedName.trim()}
                        className="flex-1"
                      >
                        <Check className="w-4 h-4 mr-2" />
                        {isAccepting ? 'Accepting...' : 'Accept Quote'}
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={handleDeclineQuote}
                        disabled={isDeclining}
                      >
                        <X className="w-4 h-4 mr-2" />
                        {isDeclining ? 'Declining...' : 'Decline'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              
              {showPayButton && (
                <div className="space-y-4">
                  <p className="text-center text-sm text-muted-foreground">
                    Pay securely with credit card or bank transfer.
                  </p>
                  <Button 
                    onClick={handlePayNow}
                    size="lg"
                    className="w-full"
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    Pay {formatCurrency(data.total)} Now
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Download PDF */}
        <Card>
          <CardContent className="pt-6">
            <Button 
              variant="outline" 
              onClick={handleDownloadPdf}
              className="w-full"
            >
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
          </CardContent>
        </Card>

        {/* Client Portal Hub Link */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="text-center space-y-3">
              <FolderOpen className="w-10 h-10 mx-auto text-primary" />
              <div>
                <p className="font-medium">View All Your Documents</p>
                <p className="text-sm text-muted-foreground">
                  Access all your quotes, invoices, receipts and job history in one place
                </p>
              </div>
              <Link href="/portal">
                <Button className="w-full">
                  Open Client Portal
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground py-4">
          <p>Powered by TradieTrack</p>
          <p className="mt-1">Questions? Contact {data.business.name} directly.</p>
        </div>
      </div>
    </div>
  );
}
