import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, Mail, Printer, CheckCircle2, Receipt, Copy, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useBusinessSettings } from "@/hooks/use-business-settings";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";

interface ReceiptPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receiptId?: string;
  paymentData?: {
    amount: number;
    description?: string;
    paymentMethod?: string;
    invoiceId?: string;
    invoiceNumber?: string;
    quoteId?: string;
    quoteNumber?: string;
    clientId?: string;
    clientName?: string;
    clientEmail?: string;
    paidAt?: string;
  };
}

interface ReceiptData {
  id: string;
  receiptNumber: string;
  amount: number;
  gstAmount?: number;
  paymentMethod: string;
  paymentReference?: string;
  paidAt: string;
  clientId?: string;
  invoiceId?: string;
  notes?: string;
}

export default function ReceiptPreviewModal({ 
  open, 
  onOpenChange, 
  receiptId,
  paymentData 
}: ReceiptPreviewModalProps) {
  const { toast } = useToast();
  const { data: businessSettings } = useBusinessSettings();
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const brandColor = businessSettings?.brandColor || '#2563eb';

  useEffect(() => {
    if (open && receiptId) {
      fetchReceipt();
    } else if (open && paymentData) {
      setReceipt({
        id: 'preview',
        receiptNumber: 'RCPT-PREVIEW',
        amount: paymentData.amount,
        paymentMethod: paymentData.paymentMethod || 'card',
        paidAt: paymentData.paidAt || new Date().toISOString(),
        clientId: paymentData.clientId,
        invoiceId: paymentData.invoiceId,
      });
    }
  }, [open, receiptId, paymentData]);

  const fetchReceipt = async () => {
    if (!receiptId) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/receipts/${receiptId}`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setReceipt(data);
      }
    } catch (error) {
      console.error('Failed to fetch receipt:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!receiptId && !paymentData) return;
    setIsDownloading(true);
    
    try {
      if (receiptId) {
        const response = await fetch(`/api/receipts/${receiptId}/pdf`, { credentials: 'include' });
        if (!response.ok) throw new Error('Failed to download PDF');
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Receipt-${receipt?.receiptNumber || receiptId}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        toast({ title: "PDF Downloaded", description: "Receipt saved successfully" });
      } else {
        toast({ title: "Preview Only", description: "Save the payment first to download PDF", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Download Failed", description: "Unable to download PDF", variant: "destructive" });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSendEmail = async () => {
    const email = paymentData?.clientEmail;
    if (!email) {
      toast({ title: "No Email", description: "Client email not available", variant: "destructive" });
      return;
    }

    setIsSendingEmail(true);
    try {
      if (receiptId) {
        await apiRequest("POST", `/api/receipts/${receiptId}/send-email`, { email });
        toast({ title: "Receipt Sent", description: `Emailed to ${email}` });
      } else if (paymentData) {
        await apiRequest("POST", "/api/payments/send-receipt", {
          email,
          amount: paymentData.amount,
          description: paymentData.description,
          invoiceId: paymentData.invoiceId,
          invoiceNumber: paymentData.invoiceNumber,
          clientName: paymentData.clientName,
          method: 'email',
        });
        toast({ title: "Receipt Sent", description: `Emailed to ${email}` });
      }
    } catch (error) {
      toast({ title: "Send Failed", description: "Unable to send receipt email", variant: "destructive" });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const formatCurrency = (amount: number) => {
    const value = amount >= 100 ? amount / 100 : amount;
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(value);
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
      'stripe_connect': 'Online Payment',
      'manual': 'Manual Payment',
      'other': 'Other',
    };
    return methods[method?.toLowerCase()] || method;
  };

  const displayAmount = receipt?.amount || paymentData?.amount || 0;
  const displayMethod = receipt?.paymentMethod || paymentData?.paymentMethod || 'card';
  const displayDate = receipt?.paidAt || paymentData?.paidAt || new Date().toISOString();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <DialogTitle className="text-xl">Payment Received</DialogTitle>
              <DialogDescription>
                {receipt?.receiptNumber || 'Receipt Preview'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 mt-4">
            <Card className="overflow-hidden border-green-200 dark:border-green-800">
              <CardContent className="p-0">
                <div className="bg-gradient-to-r from-green-500 to-green-600 p-6 text-white">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-green-100 text-sm">Amount Paid</p>
                      <p className="text-3xl font-bold mt-1">{formatCurrency(displayAmount)}</p>
                    </div>
                    <Badge className="bg-white/20 text-white hover:bg-white/30">
                      Paid
                    </Badge>
                  </div>
                </div>
                
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Date</p>
                      <p className="font-medium text-sm mt-1">
                        {format(new Date(displayDate), 'd MMM yyyy, h:mm a')}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Method</p>
                      <p className="font-medium text-sm mt-1">{formatPaymentMethod(displayMethod)}</p>
                    </div>
                  </div>

                  {(paymentData?.invoiceNumber || paymentData?.quoteNumber) && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Reference</p>
                        <p className="font-medium text-sm mt-1">
                          {paymentData?.invoiceNumber && `Invoice #${paymentData.invoiceNumber}`}
                          {paymentData?.quoteNumber && `Quote #${paymentData.quoteNumber} Deposit`}
                        </p>
                      </div>
                    </>
                  )}

                  {paymentData?.clientName && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Received From</p>
                        <p className="font-medium text-sm mt-1">{paymentData.clientName}</p>
                        {paymentData.clientEmail && (
                          <p className="text-xs text-muted-foreground">{paymentData.clientEmail}</p>
                        )}
                      </div>
                    </>
                  )}

                  {paymentData?.description && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Description</p>
                        <p className="text-sm mt-1">{paymentData.description}</p>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-wrap gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleDownloadPDF}
                disabled={isDownloading || (!receiptId && !paymentData)}
                data-testid="button-download-receipt-pdf"
              >
                {isDownloading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Download PDF
              </Button>
              
              {paymentData?.clientEmail && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleSendEmail}
                  disabled={isSendingEmail}
                  data-testid="button-email-receipt"
                >
                  {isSendingEmail ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4 mr-2" />
                  )}
                  Email Receipt
                </Button>
              )}
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handlePrint}
                data-testid="button-print-receipt"
              >
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
            </div>

            <div className="text-center pt-4 border-t">
              <p className="text-sm font-medium" style={{ color: brandColor }}>
                {businessSettings?.businessName || 'Your Business'}
              </p>
              {businessSettings?.abn && (
                <p className="text-xs text-muted-foreground">ABN: {businessSettings.abn}</p>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                Thank you for your payment!
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
