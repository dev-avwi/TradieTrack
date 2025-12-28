import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Download, Mail, FileText, Receipt, Calendar, CreditCard, Hash, Building, User, MapPin, Phone, AtSign, Loader2, ChevronRight, FolderOpen } from "lucide-react";
import { useBusinessSettings } from "@/hooks/use-business-settings";
import { useToast } from "@/hooks/use-toast";
import StatusBadge from "./StatusBadge";
import { format } from "date-fns";

interface ReceiptDetailViewProps {
  receiptId: string;
  onBack?: () => void;
}

interface ReceiptData {
  id: string;
  userId: string;
  invoiceId: string | null;
  receiptNumber: string;
  amount: number;
  gstAmount: number | null;
  paymentMethod: string;
  paymentReference: string | null;
  paidAt: string | null;
  clientId: string | null;
  notes: string | null;
  createdAt: string;
}

interface ClientData {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
}

interface InvoiceData {
  id: string;
  number: string;
  title: string | null;
  jobId: string | null;
}

interface JobData {
  id: string;
  title: string;
  address: string | null;
}

export default function ReceiptDetailView({ receiptId, onBack }: ReceiptDetailViewProps) {
  const [isPrinting, setIsPrinting] = useState(false);
  const [, navigate] = useLocation();
  const { data: businessSettings } = useBusinessSettings();
  const { toast } = useToast();

  const brandColor = businessSettings?.brandColor || '#2563eb';

  const { data: receipt, isLoading } = useQuery<ReceiptData>({
    queryKey: ['/api/receipts', receiptId],
    queryFn: async () => {
      const response = await fetch(`/api/receipts/${receiptId}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch receipt');
      return response.json();
    }
  });

  const { data: client } = useQuery<ClientData>({
    queryKey: ['/api/clients', receipt?.clientId],
    queryFn: async () => {
      if (!receipt?.clientId) return null;
      const response = await fetch(`/api/clients/${receipt.clientId}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch client');
      return response.json();
    },
    enabled: !!receipt?.clientId
  });

  const { data: invoice } = useQuery<InvoiceData>({
    queryKey: ['/api/invoices', receipt?.invoiceId],
    queryFn: async () => {
      if (!receipt?.invoiceId) return null;
      const response = await fetch(`/api/invoices/${receipt.invoiceId}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch invoice');
      return response.json();
    },
    enabled: !!receipt?.invoiceId
  });

  const { data: job } = useQuery<JobData>({
    queryKey: ['/api/jobs', invoice?.jobId],
    queryFn: async () => {
      if (!invoice?.jobId) return null;
      const response = await fetch(`/api/jobs/${invoice.jobId}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch job');
      return response.json();
    },
    enabled: !!invoice?.jobId
  });

  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 100);
  };

  const isIOSSafari = () => {
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    const isWebKit = /WebKit/.test(ua);
    const isChrome = /CriOS/.test(ua);
    const isFirefox = /FxiOS/.test(ua);
    return isIOS && isWebKit && !isChrome && !isFirefox;
  };

  const handleSaveAsPDF = async () => {
    setIsPrinting(true);
    
    const pdfUrl = `/api/receipts/${receiptId}/pdf`;
    const filename = `Receipt-${receipt?.receiptNumber || receiptId}.pdf`;
    
    let pdfWindow: Window | null = null;
    if (isIOSSafari()) {
      pdfWindow = window.open('', '_blank');
      if (pdfWindow) {
        pdfWindow.document.write('<html><head><title>Generating PDF...</title></head><body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;"><p>Generating PDF, please wait...</p></body></html>');
      }
    }
    
    try {
      const response = await fetch(pdfUrl, { credentials: 'include' });
      
      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      if (isIOSSafari() && pdfWindow) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          pdfWindow!.document.write(`<html><head><title>${filename}</title></head><body style="margin:0;"><embed width="100%" height="100%" src="${dataUrl}" type="application/pdf" /></body></html>`);
          pdfWindow!.document.close();
        };
        reader.readAsDataURL(blob);
        window.URL.revokeObjectURL(url);
        toast({
          title: "PDF Opened",
          description: "PDF opened in new tab.",
        });
      } else {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        toast({
          title: "PDF Downloaded",
          description: `${filename} has been saved.`,
        });
      }
    } catch (error) {
      console.error('PDF download error:', error);
      toast({
        title: "Download Failed",
        description: "Unable to download PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsPrinting(false);
    }
  };

  const handleSendEmail = async () => {
    if (!client?.email) {
      toast({
        title: "No Email Address",
        description: "This client doesn't have an email address on file.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(`/api/receipts/${receiptId}/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: client.email })
      });

      if (!response.ok) throw new Error('Failed to send email');

      toast({
        title: "Receipt Sent",
        description: `Receipt emailed to ${client.email}`,
      });
    } catch (error) {
      toast({
        title: "Send Failed",
        description: "Unable to send receipt. Please try again.",
        variant: "destructive",
      });
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(cents / 100);
  };

  const formatPaymentMethod = (method: string) => {
    const methods: Record<string, string> = {
      'card': 'Card Payment',
      'tap_to_pay': 'Tap to Pay',
      'bank_transfer': 'Bank Transfer',
      'cash': 'Cash',
      'cheque': 'Cheque',
      'eftpos': 'EFTPOS',
      'stripe': 'Online Payment',
      'manual': 'Manual Payment',
      'other': 'Other',
    };
    return methods[method?.toLowerCase()] || method;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!receipt) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-semibold">Receipt Not Found</h1>
        </div>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>This receipt could not be found or may have been deleted.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const subtotal = receipt.gstAmount ? receipt.amount - receipt.gstAmount : receipt.amount;
  const gst = receipt.gstAmount || 0;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* Logical breadcrumb navigation */}
      <div className="flex items-center gap-1 text-sm text-muted-foreground mb-4 print:hidden">
        <button 
          onClick={() => navigate('/documents?tab=receipts')} 
          className="hover:text-foreground transition-colors flex items-center gap-1"
          data-testid="breadcrumb-documents"
        >
          <FolderOpen className="h-3.5 w-3.5" />
          Documents
        </button>
        {invoice && (
          <>
            <ChevronRight className="h-3.5 w-3.5" />
            <button 
              onClick={() => navigate(`/invoices/${invoice.id}`)} 
              className="hover:text-foreground transition-colors"
              data-testid="breadcrumb-invoice"
            >
              Invoice {invoice.number}
            </button>
          </>
        )}
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">{receipt.receiptNumber}</span>
      </div>

      <div className="flex items-center justify-between mb-6 print:hidden">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onBack || (() => navigate('/documents?tab=receipts'))} data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl md:text-2xl font-semibold">Payment Receipt</h1>
            <p className="text-sm text-muted-foreground">{receipt.receiptNumber}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint} disabled={isPrinting} data-testid="button-print">
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button variant="outline" size="sm" onClick={handleSaveAsPDF} disabled={isPrinting} data-testid="button-download-pdf">
            <Download className="h-4 w-4 mr-2" />
            PDF
          </Button>
          {client?.email && (
            <Button variant="outline" size="sm" onClick={handleSendEmail} data-testid="button-send-email">
              <Mail className="h-4 w-4 mr-2" />
              Email
            </Button>
          )}
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-6 md:p-8">
          <div className="flex justify-between items-start mb-8">
            <div>
              {businessSettings?.logoUrl && (
                <img 
                  src={businessSettings.logoUrl} 
                  alt={businessSettings?.businessName || 'Business'} 
                  className="h-12 mb-3 object-contain"
                />
              )}
              <h2 className="text-xl font-bold" style={{ color: brandColor }}>
                {businessSettings?.businessName || 'Your Business'}
              </h2>
              <div className="text-sm text-muted-foreground mt-1 space-y-0.5">
                {businessSettings?.abn && <p>ABN: {businessSettings.abn}</p>}
                {businessSettings?.businessAddress && <p>{businessSettings.businessAddress}</p>}
                {businessSettings?.businessPhone && <p>{businessSettings.businessPhone}</p>}
                {businessSettings?.businessEmail && <p>{businessSettings.businessEmail}</p>}
              </div>
            </div>
            
            <div className="text-right">
              <h1 className="text-2xl font-bold uppercase tracking-wide" style={{ color: brandColor }}>
                Receipt
              </h1>
              <p className="text-sm text-muted-foreground mt-1">{receipt.receiptNumber}</p>
              {receipt.paidAt && (
                <p className="text-sm text-muted-foreground mt-2">
                  {format(new Date(receipt.paidAt), 'd MMMM yyyy, h:mm a')}
                </p>
              )}
              <div className="mt-3">
                <StatusBadge status="paid" />
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            {client && (
              <div>
                <h3 className="text-xs uppercase tracking-wide text-muted-foreground mb-2 font-semibold">
                  Received From
                </h3>
                <div className="space-y-1">
                  <p className="font-medium">{client.name}</p>
                  {client.address && <p className="text-sm text-muted-foreground">{client.address}</p>}
                  {client.email && <p className="text-sm text-muted-foreground">{client.email}</p>}
                  {client.phone && <p className="text-sm text-muted-foreground">{client.phone}</p>}
                </div>
              </div>
            )}
            
            <div>
              <h3 className="text-xs uppercase tracking-wide text-muted-foreground mb-2 font-semibold">
                Payment Details
              </h3>
              <div className="space-y-1 text-sm">
                <p><span className="font-medium">Method:</span> {formatPaymentMethod(receipt.paymentMethod)}</p>
                {receipt.paidAt && (
                  <p><span className="font-medium">Date:</span> {format(new Date(receipt.paidAt), 'd MMMM yyyy')}</p>
                )}
                {receipt.paymentReference && (
                  <p><span className="font-medium">Reference:</span> {receipt.paymentReference}</p>
                )}
              </div>
            </div>
          </div>

          <div className="border-2 border-green-500 rounded-lg p-5 mb-6 bg-gradient-to-br from-green-50/50 to-green-100/20 dark:from-green-950/20 dark:to-green-900/10">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-green-700 dark:text-green-400">
                Payment Received
              </h3>
              <span className="px-3 py-1 bg-green-500 text-white rounded-full text-xs font-semibold uppercase">
                Paid
              </span>
            </div>
            
            {gst > 0 && (
              <>
                <div className="flex justify-between py-2 border-b border-green-200 dark:border-green-800">
                  <span className="text-sm text-green-700 dark:text-green-400">Subtotal (excl. GST)</span>
                  <span className="font-medium text-green-700 dark:text-green-400">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-green-200 dark:border-green-800">
                  <span className="text-sm text-green-700 dark:text-green-400">GST (10%)</span>
                  <span className="font-medium text-green-700 dark:text-green-400">{formatCurrency(gst)}</span>
                </div>
              </>
            )}
            
            <div className="flex justify-between pt-3 mt-2 border-t-2 border-green-500">
              <span className="text-lg font-bold text-green-700 dark:text-green-400">
                Amount Paid {gst > 0 ? '(incl. GST)' : ''}
              </span>
              <span className="text-lg font-bold text-green-700 dark:text-green-400">
                {formatCurrency(receipt.amount)}
              </span>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <div className="p-3 border rounded-md">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Payment Method</p>
              <p className="font-medium text-sm">{formatPaymentMethod(receipt.paymentMethod)}</p>
            </div>
            <div className="p-3 border rounded-md">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Transaction ID</p>
              <p className="font-medium text-sm break-all">{receipt.id}</p>
            </div>
            {receipt.paidAt && (
              <div className="p-3 border rounded-md">
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Date & Time</p>
                <p className="font-medium text-sm">{format(new Date(receipt.paidAt), 'd MMMM yyyy, h:mm a')}</p>
              </div>
            )}
            {receipt.paymentReference && (
              <div className="p-3 border rounded-md">
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Reference</p>
                <p className="font-medium text-sm">{receipt.paymentReference}</p>
              </div>
            )}
          </div>

          {invoice && (
            <div 
              className="p-4 border rounded-md border-l-4 mb-4 cursor-pointer hover-elevate transition-colors" 
              style={{ borderLeftColor: brandColor }}
              onClick={() => navigate(`/invoices/${invoice.id}`)}
              data-testid="link-invoice-reference"
            >
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Invoice Reference</p>
              <p className="font-medium underline hover:no-underline" style={{ color: brandColor }}>
                Invoice #{invoice.number}
              </p>
              {invoice.title && <p className="text-sm text-muted-foreground">{invoice.title}</p>}
            </div>
          )}

          {job && (
            <div 
              className="p-4 border rounded-md border-l-4 mb-6 cursor-pointer hover-elevate transition-colors" 
              style={{ borderLeftColor: brandColor }}
              onClick={() => navigate(`/jobs/${job.id}`)}
              data-testid="link-job-reference"
            >
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Job Reference</p>
              <p className="font-medium underline hover:no-underline" style={{ color: brandColor }}>{job.title}</p>
              {job.address && <p className="text-sm text-muted-foreground">{job.address}</p>}
            </div>
          )}

          <div className="text-center py-6 rounded-lg mb-6" style={{ backgroundColor: `${brandColor}08` }}>
            <p className="text-lg font-semibold" style={{ color: brandColor }}>
              Thank you for your payment!
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              This receipt confirms your payment has been received and processed.
            </p>
          </div>

          <div className="pt-4 border-t text-center text-xs text-muted-foreground">
            <p>Payment Receipt from {businessSettings?.businessName || 'Your Business'}</p>
            {businessSettings?.abn && <p>ABN: {businessSettings.abn}</p>}
            <p className="mt-2">Generated by TradieTrack</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
