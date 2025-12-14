import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Printer, ArrowLeft, Send, FileText, CreditCard, Download, Copy, ExternalLink, Loader2 } from "lucide-react";
import { useBusinessSettings } from "@/hooks/use-business-settings";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import StatusBadge from "./StatusBadge";
import { getTemplateStyles, TemplateId, DEFAULT_TEMPLATE } from "@/lib/document-templates";

interface InvoiceDetailViewProps {
  invoiceId: string;
  onBack?: () => void;
  onSend?: (id: string) => void;
  onMarkPaid?: (id: string) => void;
}

export default function InvoiceDetailView({ 
  invoiceId, 
  onBack, 
  onSend, 
  onMarkPaid 
}: InvoiceDetailViewProps) {
  const [isPrinting, setIsPrinting] = useState(false);
  const { data: businessSettings } = useBusinessSettings();
  const { toast } = useToast();

  const brandColor = businessSettings?.brandColor || '#2563eb';
  const templateId = (businessSettings?.documentTemplate as TemplateId) || DEFAULT_TEMPLATE;
  const templateStyles = getTemplateStyles(templateId, brandColor);
  const { template, primaryColor, headingStyle, tableHeaderStyle, getTableRowStyle, getNoteStyle } = templateStyles;

  const connectEnabled = businessSettings?.connectChargesEnabled === true;

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['/api/invoices', invoiceId],
    queryFn: async () => {
      const response = await fetch(`/api/invoices/${invoiceId}`);
      if (!response.ok) throw new Error('Failed to fetch invoice');
      return response.json();
    }
  });

  const { data: client } = useQuery({
    queryKey: ['/api/clients', invoice?.clientId],
    queryFn: async () => {
      if (!invoice?.clientId) return null;
      const response = await fetch(`/api/clients/${invoice.clientId}`);
      if (!response.ok) throw new Error('Failed to fetch client');
      return response.json();
    },
    enabled: !!invoice?.clientId
  });

  const { data: job } = useQuery({
    queryKey: ['/api/jobs', invoice?.jobId],
    queryFn: async () => {
      if (!invoice?.jobId) return null;
      const response = await fetch(`/api/jobs/${invoice.jobId}`);
      if (!response.ok) throw new Error('Failed to fetch job');
      return response.json();
    },
    enabled: !!invoice?.jobId
  });

  const { data: linkedQuote } = useQuery({
    queryKey: ['/api/quotes', invoice?.quoteId],
    queryFn: async () => {
      if (!invoice?.quoteId) return null;
      const response = await fetch(`/api/quotes/${invoice.quoteId}`);
      if (!response.ok) throw new Error('Failed to fetch linked quote');
      return response.json();
    },
    enabled: !!invoice?.quoteId
  });

  const { data: quoteSignature } = useQuery({
    queryKey: ['/api/digital-signatures', invoice?.quoteId, 'quote'],
    queryFn: async () => {
      if (!invoice?.quoteId) return null;
      const response = await fetch(`/api/digital-signatures?documentType=quote&documentId=${invoice.quoteId}`);
      if (!response.ok) return null;
      const signatures = await response.json();
      return signatures.length > 0 ? signatures[0] : null;
    },
    enabled: !!invoice?.quoteId && businessSettings?.includeSignatureOnInvoices === true
  });

  const toggleOnlinePaymentMutation = useMutation({
    mutationFn: async (allowOnlinePayment: boolean) => {
      return apiRequest('PATCH', `/api/invoices/${invoiceId}/online-payment`, {
        allowOnlinePayment
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/invoices', invoiceId] });
      toast({
        title: invoice?.allowOnlinePayment ? "Online payment disabled" : "Online payment enabled",
        description: invoice?.allowOnlinePayment 
          ? "Customers can no longer pay online for this invoice."
          : "Customers can now pay this invoice online via card.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update online payment setting",
        variant: "destructive",
      });
    }
  });

  const handleCopyPaymentLink = () => {
    if (invoice?.paymentToken) {
      const paymentUrl = `${window.location.origin}/pay/${invoice.paymentToken}`;
      navigator.clipboard.writeText(paymentUrl);
      toast({
        title: "Link copied",
        description: "Payment link copied to clipboard",
      });
    }
  };

  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 100);
  };

  const handleSaveAsPDF = async () => {
    setIsPrinting(true);
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/pdf`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }
      
      const blob = await response.blob();
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Invoice-${invoice.number || invoice.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "PDF Downloaded",
        description: "Invoice PDF has been downloaded successfully.",
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Error",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsPrinting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  if (isLoading || !invoice) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading invoice details...</p>
        </div>
      </div>
    );
  }

  const subtotal = Number(invoice.subtotal || 0);
  const gstAmount = Number(invoice.gstAmount || 0);
  const total = Number(invoice.total || 0);
  const isGstRegistered = businessSettings?.gstEnabled && gstAmount > 0;
  const documentTitle = isGstRegistered ? 'TAX INVOICE' : 'INVOICE';

  return (
    <>
      <style>{`
        @media print {
          * { visibility: hidden; }
          .print-content, .print-content * { visibility: visible; }
          .print-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            max-width: none !important;
            margin: 0 !important;
            padding: 20px !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
          }
          .no-print { display: none !important; }
          body {
            print-color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
          }
          @page { size: A4; margin: 12mm; }
        }
      `}</style>

      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 no-print">
          <div className="flex items-center gap-4">
            {onBack && (
              <Button variant="outline" onClick={onBack} data-testid="button-back">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            )}
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <h1 className="text-xl sm:text-2xl font-bold">Invoice Details</h1>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            {invoice.status === 'draft' && onSend && (
              <Button onClick={() => onSend(invoice.id)} className="w-full sm:w-auto" data-testid={`button-send-${invoice.id}`}>
                <Send className="h-4 w-4 mr-2" />
                Send Invoice
              </Button>
            )}
            {invoice.status === 'sent' && onMarkPaid && (
              <Button onClick={() => onMarkPaid(invoice.id)} className="w-full sm:w-auto" data-testid={`button-mark-paid-${invoice.id}`}>
                <CreditCard className="h-4 w-4 mr-2" />
                Mark Paid
              </Button>
            )}
            <Button variant="outline" onClick={handlePrint} className="w-full sm:w-auto" data-testid="button-print">
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            <Button variant="outline" onClick={handleSaveAsPDF} className="w-full sm:w-auto" data-testid="button-save-pdf">
              <Download className="h-4 w-4 mr-2" />
              Save as PDF
            </Button>
          </div>
        </div>

        {connectEnabled && invoice.status !== 'paid' && (
          <Card className="mb-6 no-print">
            <div className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <h3 className="font-semibold">Online Payment</h3>
                    <p className="text-sm text-muted-foreground">
                      Allow customers to pay this invoice online via card
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Switch
                    checked={invoice.allowOnlinePayment || false}
                    onCheckedChange={(checked) => toggleOnlinePaymentMutation.mutate(checked)}
                    disabled={toggleOnlinePaymentMutation.isPending}
                    data-testid="switch-online-payment"
                  />
                  {toggleOnlinePaymentMutation.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                </div>
              </div>

              {invoice.allowOnlinePayment && invoice.paymentToken && (
                <div className="mt-4 p-3 bg-muted rounded-lg">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <Label className="text-sm font-medium">Payment Link:</Label>
                    <div className="flex-1 flex items-center gap-2">
                      <code className="text-xs bg-background p-2 rounded flex-1 overflow-x-auto">
                        {`${window.location.origin}/pay/${invoice.paymentToken}`}
                      </code>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={handleCopyPaymentLink}
                        data-testid="button-copy-payment-link"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => window.open(`/pay/${invoice.paymentToken}`, '_blank')}
                        data-testid="button-open-payment-link"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        {!connectEnabled && invoice.status !== 'paid' && (
          <Card className="mb-6 no-print border-dashed">
            <div className="p-4">
              <div className="flex items-center gap-4">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                <div>
                  <h3 className="font-semibold text-muted-foreground">Online Payment</h3>
                  <p className="text-sm text-muted-foreground">
                    Connect your Stripe account in Settings to enable online payments for invoices.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        )}

        <div className="print-content">
          <Card 
            className="bg-white shadow-lg border overflow-hidden"
            style={{ fontFamily: template.fontFamily, fontSize: template.baseFontSize }}
          >
            <div 
              className="p-6 sm:p-8"
              style={{ borderBottom: template.showHeaderDivider ? `${template.headerBorderWidth} solid ${primaryColor}` : 'none' }}
            >
              <div className="flex flex-col sm:flex-row sm:justify-between gap-6 items-start">
                <div className="flex-1">
                  {businessSettings?.logoUrl && (
                    <img 
                      src={businessSettings.logoUrl} 
                      alt={businessSettings?.businessName || 'Logo'} 
                      className="max-w-[150px] max-h-[60px] object-contain mb-3"
                    />
                  )}
                  <h1 
                    className="text-2xl sm:text-3xl mb-2"
                    style={{ ...headingStyle }}
                  >
                    {businessSettings?.businessName || 'Your Business Name'}
                  </h1>
                  <div className="text-sm text-gray-600 space-y-0.5">
                    {businessSettings?.abn && (
                      <p><strong>ABN:</strong> {businessSettings.abn}</p>
                    )}
                    {businessSettings?.address && <p>{businessSettings.address}</p>}
                    {businessSettings?.phone && <p>Phone: {businessSettings.phone}</p>}
                    {businessSettings?.email && <p>Email: {businessSettings.email}</p>}
                    {businessSettings?.licenseNumber && (
                      <p>Licence No: {businessSettings.licenseNumber}</p>
                    )}
                  </div>
                </div>
                
                <div className="text-right">
                  <h2 
                    className="text-2xl sm:text-3xl uppercase tracking-wide"
                    style={{ ...headingStyle }}
                  >
                    {documentTitle}
                  </h2>
                  <p className="text-gray-600 mt-1">{invoice.number}</p>
                  <div className="mt-2">
                    <StatusBadge status={invoice.status} />
                  </div>
                </div>
              </div>
            </div>

            <CardContent className="p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row gap-8 mb-8">
                <div className="flex-1">
                  <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">Bill To</p>
                  <div className="text-gray-800">
                    <p className="font-semibold">{client?.name || 'Loading...'}</p>
                    {client?.address && <p>{client.address}</p>}
                    {client?.email && <p>{client.email}</p>}
                    {client?.phone && <p>{client.phone}</p>}
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">Invoice Details</p>
                  <div className="text-gray-800 space-y-1">
                    <p><strong>Date:</strong> {formatDate(invoice.createdAt)}</p>
                    {invoice.dueDate && (
                      <p><strong>Due Date:</strong> {formatDate(invoice.dueDate)}</p>
                    )}
                  </div>
                </div>
              </div>

              {job?.address && (
                <div className="mb-8">
                  <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">Job Site Location</p>
                  <div className="text-gray-800">
                    <p className="font-semibold">{job.address}</p>
                    {job.scheduledAt && (
                      <p className="text-gray-600 text-sm">Scheduled: {formatDate(job.scheduledAt)}</p>
                    )}
                  </div>
                </div>
              )}

              {(invoice.title || invoice.description) && (
                <div 
                  className="mb-8 p-4"
                  style={{ backgroundColor: template.sectionBackground, borderRadius: template.borderRadius }}
                >
                  <p 
                    className="font-semibold mb-2"
                    style={{ color: primaryColor }}
                  >
                    {invoice.title || 'Description'}
                  </p>
                  {invoice.description && (
                    <p className="text-gray-700">{invoice.description}</p>
                  )}
                </div>
              )}

              <div className="mb-6 overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr style={tableHeaderStyle}>
                      <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider" style={{ width: '50%', color: tableHeaderStyle.color }}>Description</th>
                      <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wider" style={{ width: '15%', color: tableHeaderStyle.color }}>Qty</th>
                      <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wider" style={{ width: '17%', color: tableHeaderStyle.color }}>Unit Price</th>
                      <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wider" style={{ width: '18%', color: tableHeaderStyle.color }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.lineItems?.map((item: any, index: number) => {
                      const isLast = index === (invoice.lineItems?.length || 0) - 1;
                      return (
                        <tr key={index} style={getTableRowStyle(index, isLast)}>
                          <td className="px-4 py-3 text-gray-900">{item.description}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{Number(item.quantity).toFixed(2)}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(Number(item.unitPrice))}</td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(Number(item.total))}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end mb-8">
                <div className="w-72">
                  <div className="flex justify-between py-2 border-b border-gray-200">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="font-semibold">{formatCurrency(subtotal)}</span>
                  </div>
                  {gstAmount > 0 && (
                    <div className="flex justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-600">GST (10%)</span>
                      <span className="font-semibold">{formatCurrency(gstAmount)}</span>
                    </div>
                  )}
                  <div 
                    className="flex justify-between py-3 mt-1"
                    style={{ borderTop: `2px solid ${primaryColor}` }}
                  >
                    <span 
                      className="text-lg"
                      style={{ ...headingStyle }}
                    >
                      Total{gstAmount > 0 ? ' (incl. GST)' : ''}
                    </span>
                    <span 
                      className="text-lg"
                      style={{ ...headingStyle }}
                    >
                      {formatCurrency(total)}
                    </span>
                  </div>
                </div>
              </div>

              {businessSettings?.paymentInstructions && (
                <div 
                  className="mb-8 p-5 rounded-lg"
                  style={{ 
                    background: `linear-gradient(135deg, ${primaryColor}10, ${primaryColor}05)`,
                    border: `1px solid ${primaryColor}30`
                  }}
                >
                  <h3 
                    className="font-semibold mb-3 text-sm"
                    style={{ color: primaryColor }}
                  >
                    Payment Details
                  </h3>
                  <p className="text-gray-700 text-sm whitespace-pre-wrap leading-relaxed">
                    {businessSettings.paymentInstructions}
                  </p>
                </div>
              )}

              {invoice.notes && (
                <div 
                  className="mb-8 p-4"
                  style={getNoteStyle()}
                >
                  <h3 className="font-semibold mb-2 text-gray-800">Additional Notes</h3>
                  <p className="text-gray-600 text-sm whitespace-pre-wrap">{invoice.notes}</p>
                </div>
              )}

              {invoice.status === 'sent' && invoice.dueDate && (
                <div className="mb-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm font-medium text-yellow-800">
                    <strong>Payment Due:</strong> This invoice is due on {formatDate(invoice.dueDate)}
                  </p>
                </div>
              )}

              {invoice.status === 'paid' && invoice.paidAt && (
                <div className="mb-8 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm font-medium text-green-800">
                    <strong>Paid:</strong> This invoice was paid on {formatDate(invoice.paidAt)}
                  </p>
                </div>
              )}

              {businessSettings?.includeSignatureOnInvoices && quoteSignature && (
                <div className="mb-8 p-4 border border-gray-200 rounded-lg">
                  <h3 className="font-semibold mb-3 text-gray-800 text-sm">Quote Acceptance Signature</h3>
                  <div className="flex flex-col sm:flex-row gap-6 items-start">
                    <div className="flex-shrink-0">
                      <img 
                        src={quoteSignature.signatureData} 
                        alt="Client Signature" 
                        className="max-w-[200px] max-h-[80px] object-contain border-b border-gray-300"
                      />
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      {quoteSignature.signerName && (
                        <p><strong>Signed by:</strong> {quoteSignature.signerName}</p>
                      )}
                      {quoteSignature.signedAt && (
                        <p><strong>Date:</strong> {formatDate(quoteSignature.signedAt)}</p>
                      )}
                      {linkedQuote?.number && (
                        <p><strong>Quote:</strong> {linkedQuote.number}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-10 pt-5 border-t border-gray-200 text-center text-gray-500 text-sm">
                <p>Thank you for your business!</p>
                {businessSettings?.abn && (
                  <p className="mt-1">ABN: {businessSettings.abn}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}