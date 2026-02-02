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
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-3">
        {/* Business Header - Compact */}
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center gap-3">
              {data.business.logoUrl && (
                <img 
                  src={data.business.logoUrl} 
                  alt={data.business.name}
                  className="w-10 h-10 object-contain rounded"
                />
              )}
              <div className="flex-1 min-w-0">
                <h1 className="text-base font-bold truncate">{data.business.name}</h1>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
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

        {/* Document Header - Compact */}
        <Card>
          <CardContent className="py-3">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="font-semibold truncate">{docTypeLabel} #{data.number}</span>
                </div>
                <p className="text-sm text-muted-foreground truncate">{data.title}</p>
              </div>
              <Badge className={getStatusColor(data.status, type || '')}>
                {data.status.charAt(0).toUpperCase() + data.status.slice(1)}
              </Badge>
            </div>
            
            {/* Key Info - Inline */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mb-2">
              <span>Date: <span className="text-foreground">{formatDate(data.createdAt)}</span></span>
              {data.validUntil && <span>Valid: <span className="text-foreground">{formatDate(data.validUntil)}</span></span>}
              {data.dueDate && <span>Due: <span className="text-foreground">{formatDate(data.dueDate)}</span></span>}
              {data.paidAt && <span className="text-green-600">Paid: {formatDate(data.paidAt)}</span>}
              {data.acceptedAt && <span className="text-green-600">Accepted: {formatDate(data.acceptedAt)}</span>}
            </div>

            {/* Client Info - Inline */}
            <div className="text-sm">
              <span className="text-muted-foreground">For: </span>
              <span className="font-medium">{data.client.name}</span>
              {data.client.address && (
                <span className="text-muted-foreground text-xs ml-2">
                  <MapPin className="w-3 h-3 inline" /> {data.client.address}
                </span>
              )}
            </div>

            {/* Job Site - Only if different from client */}
            {data.job?.address && data.job.address !== data.client.address && (
              <div className="text-xs text-muted-foreground mt-1">
                <Building2 className="w-3 h-3 inline" /> Job: {data.job.address}
              </div>
            )}

            {data.description && (
              <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{data.description}</p>
            )}
          </CardContent>
        </Card>

        {/* Line Items - Compact */}
        <Card>
          <CardContent className="py-3">
            <p className="font-semibold text-sm mb-2">Items</p>
            <div className="space-y-2">
              {data.lineItems.map((item, idx) => (
                <div key={item.id || idx} className="flex justify-between items-start gap-2 pb-2 border-b last:border-0 last:pb-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{item.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {parseFloat(item.quantity).toFixed(2)} × {formatCurrency(item.unitPrice)}
                    </p>
                  </div>
                  <p className="text-sm font-medium whitespace-nowrap">{formatCurrency(item.total)}</p>
                </div>
              ))}
            </div>

            <Separator className="my-2" />

            {/* Totals - Compact */}
            <div className="space-y-1 text-sm">
              <div className="flex justify-between gap-2 text-xs">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(data.subtotal)}</span>
              </div>
              <div className="flex justify-between gap-2 text-xs">
                <span className="text-muted-foreground">GST (10%)</span>
                <span>{formatCurrency(data.gstAmount)}</span>
              </div>
              <div className="flex justify-between gap-2 font-bold text-base pt-1 border-t">
                <span>Total</span>
                <span>{formatCurrency(data.total)}</span>
              </div>
              {data.depositRequired && data.depositAmount && (
                <div className="flex justify-between gap-2 text-primary text-xs">
                  <span>Deposit Required</span>
                  <span className="flex items-center gap-1">
                    {formatCurrency(data.depositAmount)}
                    {data.depositPaid && <CheckCircle2 className="w-3 h-3 text-green-500" />}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Acceptance Status - Compact */}
        {isAccepted && data.acceptedBy && (
          <div className="flex items-center gap-2 p-2 rounded-md bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 text-sm">
            <CheckCircle2 className="w-4 h-4" />
            <span>Accepted by {data.acceptedBy} on {formatDate(data.acceptedAt)}</span>
          </div>
        )}

        {/* Payment Status - Compact */}
        {isPaid && type === 'invoice' && (
          <div className="flex items-center gap-2 p-2 rounded-md bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 text-sm">
            <CheckCircle2 className="w-4 h-4" />
            <span>Paid on {formatDate(data.paidAt)}</span>
          </div>
        )}

        {/* Action Buttons - Compact */}
        {(showAcceptButtons || showPayButton) && (
          <Card>
            <CardContent className="py-3">
              {showAcceptButtons && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Your name to accept"
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
                      size="sm"
                    >
                      <Check className="w-3 h-3 mr-1" />
                      {isAccepting ? 'Accepting...' : 'Accept'}
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={handleDeclineQuote}
                      disabled={isDeclining}
                      size="sm"
                    >
                      <X className="w-3 h-3 mr-1" />
                      Decline
                    </Button>
                  </div>
                </div>
              )}
              
              {showPayButton && (
                <Button 
                  onClick={handlePayNow}
                  className="w-full"
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Pay {formatCurrency(data.total)} Now
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Actions Row - Combined PDF & Portal */}
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleDownloadPdf}
            className="flex-1"
            size="sm"
          >
            <Download className="w-3 h-3 mr-1" />
            PDF
          </Button>
          <Link href="/portal" className="flex-1">
            <Button className="w-full" size="sm">
              <FolderOpen className="w-3 h-3 mr-1" />
              All Documents
            </Button>
          </Link>
        </div>

        {/* Footer - Compact */}
        <div className="text-center text-xs text-muted-foreground py-2">
          <p>Powered by TradieTrack • <a href={`tel:${data.business.phone}`} className="hover:underline">{data.business.name}</a></p>
        </div>
      </div>
    </div>
  );
}
