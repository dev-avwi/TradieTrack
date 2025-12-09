import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Printer, ArrowLeft, Send, FileText, CreditCard, Mail, Phone, User, MapPin, Download, Copy, ExternalLink, Loader2, Briefcase, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";
import { useBusinessSettings } from "@/hooks/use-business-settings";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import StatusBadge from "./StatusBadge";

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
  const [, setLocation] = useLocation();
  const { data: businessSettings } = useBusinessSettings();
  const { toast } = useToast();

  // Check if Stripe Connect is enabled for this business
  const connectEnabled = businessSettings?.connectChargesEnabled === true;

  // Fetch invoice with line items
  const { data: invoice, isLoading } = useQuery({
    queryKey: ['/api/invoices', invoiceId],
    queryFn: async () => {
      const response = await fetch(`/api/invoices/${invoiceId}`);
      if (!response.ok) throw new Error('Failed to fetch invoice');
      return response.json();
    }
  });

  // Fetch client details
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

  // Mutation to toggle online payment
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

  const handleSaveAsPDF = () => {
    setIsPrinting(true);
    setTimeout(() => {
      // Create a new window with just the invoice content
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        const printContent = document.querySelector('.print-content');
        if (!printContent) {
          console.error('Print content not found');
          setIsPrinting(false);
          return;
        }
        
        // Get all stylesheets and style tags
        const stylesheets = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
          .map(link => link.outerHTML)
          .join('\n');
        const styles = Array.from(document.querySelectorAll('style'))
          .map(style => style.outerHTML)
          .join('\n');
        
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Invoice - ${invoice.title}</title>
            ${stylesheets}
            ${styles}
          </head>
          <body>
            ${printContent.outerHTML}
            <script>
              window.onload = function() {
                // Allow user to manually save as PDF or print
                // Don't auto-trigger print dialog
              }
            </script>
          </body>
          </html>
        `);
        printWindow.document.close();
      }
      setIsPrinting(false);
    }, 100);
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

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          * {
            visibility: hidden;
          }
          .print-content,
          .print-content * {
            visibility: visible;
          }
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
          .no-print {
            display: none !important;
          }
          .print-header {
            display: flex !important;
            justify-content: space-between !important;
            align-items: start !important;
            margin-bottom: 30px !important;
            page-break-inside: avoid !important;
          }
          .print-table {
            width: 100% !important;
            border-collapse: collapse !important;
            margin-bottom: 20px !important;
          }
          .print-table th,
          .print-table td {
            border: 1px solid #ddd !important;
            padding: 8px !important;
            text-align: left !important;
          }
          .print-table th {
            background-color: #f5f5f5 !important;
            font-weight: bold !important;
          }
          .print-totals {
            margin-top: 20px !important;
            float: right !important;
            width: 300px !important;
          }
          .print-business-info {
            text-align: right !important;
          }
          .print-invoice-title {
            font-size: 36px !important;
            font-weight: 800 !important;
            color: #1e40af !important;
            margin-bottom: 15px !important;
            letter-spacing: 1px !important;
            text-transform: uppercase !important;
            border-bottom: 3px solid #3b82f6 !important;
            padding-bottom: 8px !important;
          }
          .print-due-notice {
            background-color: #fef3c7 !important;
            border: 1px solid #f59e0b !important;
            padding: 10px !important;
            border-radius: 5px !important;
            margin-top: 15px !important;
          }
          body {
            print-color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
          }
          @page {
            size: A4;
            margin: 12mm;
          }
          .print-table tr {
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      <div className={`max-w-4xl mx-auto p-6 ${isPrinting ? 'print-page' : ''}`}>
        {/* Action buttons - hidden when printing */}
        <div className="flex items-center justify-between mb-6 no-print">
          <div className="flex items-center gap-4">
            {onBack && (
              <Button variant="outline" onClick={onBack} data-testid="button-back">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            )}
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <h1 className="text-2xl font-bold">Invoice Details</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {invoice.status === 'draft' && onSend && (
              <Button onClick={() => onSend(invoice.id)} data-testid={`button-send-${invoice.id}`}>
                <Send className="h-4 w-4 mr-2" />
                Send Invoice
              </Button>
            )}
            {invoice.status === 'sent' && onMarkPaid && (
              <Button onClick={() => onMarkPaid(invoice.id)} data-testid={`button-mark-paid-${invoice.id}`}>
                <CreditCard className="h-4 w-4 mr-2" />
                Mark Paid
              </Button>
            )}
            <Button variant="outline" onClick={handlePrint} data-testid="button-print">
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            <Button variant="outline" onClick={handleSaveAsPDF} data-testid="button-save-pdf">
              <Download className="h-4 w-4 mr-2" />
              Save as PDF
            </Button>
          </div>
        </div>

        {/* Online Payment Section - Only show if Stripe Connect is enabled and invoice is not paid */}
        {connectEnabled && invoice.status !== 'paid' && (
          <Card className="mb-6 no-print">
            <CardContent className="p-4">
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
            </CardContent>
          </Card>
        )}

        {/* Show message if Stripe Connect not enabled */}
        {!connectEnabled && invoice.status !== 'paid' && (
          <Card className="mb-6 no-print border-dashed">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                <div>
                  <h3 className="font-semibold text-muted-foreground">Online Payment</h3>
                  <p className="text-sm text-muted-foreground">
                    Connect your Stripe account in Settings to enable online payments for invoices.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* View Linked Job */}
        {invoice?.jobId && (
          <Card className="mb-6 no-print hover-elevate cursor-pointer" onClick={() => setLocation(`/jobs/${invoice.jobId}`)}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Briefcase className="h-5 w-5 text-primary" />
                  <div>
                    <h3 className="font-semibold">Linked Job</h3>
                    <p className="text-sm text-muted-foreground">
                      View the job associated with this invoice
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Printable Content */}
        <div className={`print-content ${isPrinting ? 'print-page' : ''}`}>
          {/* Professional Invoice Document */}
          <Card className="print-page max-w-4xl mx-auto bg-white shadow-lg border">
          {/* Invoice Header */}
          <div className="print-header border-b p-4 sm:p-8 bg-slate-50">
            <div className="flex flex-col sm:flex-row sm:justify-between gap-6 items-start">
              {/* Company Information */}
              <div className="flex-1">
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
                  {businessSettings?.businessName || 'Your Business Name'}
                </h1>
                {businessSettings?.abn && (
                  <p className="text-sm text-slate-600 mb-1">
                    <span className="font-medium">ABN:</span> {businessSettings.abn}
                  </p>
                )}
                <div className="text-sm text-slate-600 space-y-1">
                  {businessSettings?.email && (
                    <p className="break-words">{businessSettings.email}</p>
                  )}
                  {businessSettings?.phone && (
                    <p>{businessSettings.phone}</p>
                  )}
                  {businessSettings?.address && (
                    <p className="break-words">{businessSettings.address}</p>
                  )}
                </div>
              </div>
              
              {/* Invoice Title & Details */}
              <div className="w-full sm:w-auto sm:text-right">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-4">
                  {businessSettings?.gstEnabled ? 'TAX INVOICE' : 'INVOICE'}
                </h2>
                <div className="bg-white border rounded-lg p-4 shadow-sm">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between gap-4 sm:gap-8">
                      <span className="font-medium text-slate-600">Invoice #:</span>
                      <span className="font-mono font-semibold">{invoice.number}</span>
                    </div>
                    <div className="flex justify-between gap-4 sm:gap-8">
                      <span className="font-medium text-slate-600">Date:</span>
                      <span>{formatDate(invoice.createdAt)}</span>
                    </div>
                    {invoice.dueDate && (
                      <div className="flex justify-between gap-4 sm:gap-8">
                        <span className="font-medium text-slate-600">Due Date:</span>
                        <span className="font-semibold text-red-600">{formatDate(invoice.dueDate)}</span>
                      </div>
                    )}
                    <div className="flex justify-between gap-4 sm:gap-8 pt-2 border-t">
                      <span className="font-medium text-slate-600">Status:</span>
                      <StatusBadge status={invoice.status} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <CardContent className="p-8">
            {/* Invoice Description */}
            {(invoice.title || invoice.description) && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-slate-800 mb-2">Description</h3>
                <div className="bg-slate-50 p-4 rounded border">
                  <p className="font-medium text-slate-900">{invoice.title}</p>
                  {invoice.description && (
                    <p className="text-sm text-slate-600 mt-1">{invoice.description}</p>
                  )}
                </div>
              </div>
            )}

            {/* Client Billing Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div>
                <h3 className="text-sm font-semibold text-slate-600 mb-3 uppercase tracking-wide">Bill To:</h3>
                <div className="bg-slate-50 p-4 rounded border">
                  <p className="font-semibold text-slate-900 text-lg">{client?.name || 'Loading...'}</p>
                  <div className="text-sm text-slate-600 space-y-1 mt-2">
                    {client?.email && <p>{client.email}</p>}
                    {client?.phone && <p>{client.phone}</p>}
                    {client?.address && <p className="whitespace-pre-line">{client.address}</p>}
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-semibold text-slate-600 mb-3 uppercase tracking-wide">Payment Terms:</h3>
                <div className="bg-slate-50 p-4 rounded border text-sm text-slate-700">
                  <p>Net 30 days</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Payment is due within 30 days of invoice date
                  </p>
                </div>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="mb-8">
              <h3 className="text-sm font-semibold text-slate-600 mb-4 uppercase tracking-wide">Items & Services</h3>
              <div className="overflow-x-auto">
                <table className="print-table w-full border-collapse border border-slate-200 rounded-lg overflow-hidden">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200">
                      <th className="px-4 sm:px-6 py-3 text-left text-sm font-semibold text-slate-700">Description</th>
                      <th className="px-4 sm:px-6 py-3 text-center w-16 sm:w-20 text-sm font-semibold text-slate-700">Qty</th>
                      <th className="px-4 sm:px-6 py-3 text-right w-24 sm:w-32 text-sm font-semibold text-slate-700">Unit Price</th>
                      <th className="px-4 sm:px-6 py-3 text-right w-24 sm:w-32 text-sm font-semibold text-slate-700">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.lineItems?.map((item: any, index: number) => (
                      <tr key={index} className="border-b border-slate-200">
                        <td className="px-4 sm:px-6 py-4 text-slate-900 break-words">{item.description}</td>
                        <td className="px-4 sm:px-6 py-4 text-center text-slate-700 whitespace-nowrap">
                          {Number(item.quantity)}
                        </td>
                        <td className="px-4 sm:px-6 py-4 text-right text-slate-700 whitespace-nowrap">
                          {formatCurrency(Number(item.unitPrice))}
                        </td>
                        <td className="px-4 sm:px-6 py-4 text-right font-semibold text-slate-900 whitespace-nowrap">
                          {formatCurrency(Number(item.total))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Invoice Total */}
            <div className="print-totals flex justify-end mb-8">
              <div className="w-80">
                {businessSettings?.gstEnabled ? (
                  <div className="space-y-2">
                    <div className="flex justify-between py-2 text-sm">
                      <span className="text-slate-600">Subtotal:</span>
                      <span className="font-semibold text-slate-900">{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex justify-between py-2 text-sm">
                      <span className="text-slate-600">GST (10%):</span>
                      <span className="font-semibold text-slate-900">{formatCurrency(gstAmount)}</span>
                    </div>
                    <div className="border-t border-slate-300 pt-3">
                      <div className="flex justify-between items-center bg-slate-100 p-4 rounded">
                        <span className="text-lg font-bold text-slate-900">Total Amount:</span>
                        <span className="text-xl font-bold text-slate-900">{formatCurrency(total)}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-100 p-4 rounded">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold text-slate-900">Total Amount:</span>
                      <span className="text-xl font-bold text-slate-900">{formatCurrency(total)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Payment due notice for unpaid invoices */}
            {invoice.status === 'sent' && invoice.dueDate && (
              <div className="print-due-notice bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                <p className="text-sm font-medium text-yellow-800">
                  <strong>Payment Due:</strong> This invoice is due on {formatDate(invoice.dueDate)}
                </p>
              </div>
            )}

            {/* Payment status for paid invoices */}
            {invoice.status === 'paid' && invoice.paidAt && (
              <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                <p className="text-sm font-medium text-green-800">
                  <strong>Paid:</strong> This invoice was paid on {formatDate(invoice.paidAt)}
                </p>
              </div>
            )}

            {/* Notes */}
            {invoice.notes && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-2">Notes</h3>
                <div className="bg-muted/30 p-4 rounded-lg">
                  <p className="text-sm whitespace-pre-wrap">{invoice.notes}</p>
                </div>
              </div>
            )}

            {/* Enhanced Payment Instructions & Terms */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
              {/* Payment Methods */}
              <div className="border border-slate-200 p-6 rounded bg-slate-50">
                <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wide">
                  Payment Methods
                </h3>
                <div className="text-sm text-slate-700 space-y-3">
                  {businessSettings?.bankDetails && (
                    <div>
                      <p className="font-medium text-slate-800 mb-1">Direct Bank Transfer (Preferred)</p>
                      <div className="bg-white p-3 rounded border text-xs">
                        <pre className="whitespace-pre-wrap font-mono">{businessSettings.bankDetails}</pre>
                      </div>
                    </div>
                  )}
                  {businessSettings?.paymentInstructions && (
                    <div>
                      <p className="font-medium text-slate-800 mb-1">Additional Instructions</p>
                      <div className="text-xs leading-relaxed">
                        <pre className="whitespace-pre-wrap font-sans">{businessSettings.paymentInstructions}</pre>
                      </div>
                    </div>
                  )}
                  <div className="pt-2 border-t text-xs text-slate-600">
                    <p>• Cash payments accepted on-site</p>
                    <p>• Credit card payments via Square/EFTPOS</p>
                    <p>• Please include invoice number with payment</p>
                  </div>
                </div>
              </div>

              {/* Terms & Conditions */}
              <div className="border border-slate-200 p-6 rounded bg-slate-50">
                <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wide">
                  Terms & Conditions
                </h3>
                <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
                  <p><strong>Payment Terms:</strong> Net 30 days from invoice date</p>
                  <p><strong>Late Payment Fees:</strong> {businessSettings?.lateFeeRate || '1.5% per month'} will be charged on all overdue amounts after 30 days</p>
                  <p><strong>Workmanship Warranty:</strong> {businessSettings?.warrantyPeriod || '12 months'} guarantee on all labor and workmanship</p>
                  <p><strong>Materials:</strong> Manufacturer warranty applies to all supplied materials</p>
                  <p><strong>Disputes:</strong> Any disputes must be raised in writing within 7 days of completion</p>
                  <p><strong>Right to Remedy:</strong> We reserve the right to remedy any defective work within reasonable timeframes</p>
                  <p className="pt-2 border-t">
                    <strong>Australian Consumer Law:</strong> Your rights as a consumer are protected under the Australian Consumer Law. 
                    For major failures, you are entitled to a replacement or refund; for minor failures, repair or remedy. 
                    Goods come with guarantees that cannot be excluded under the Australian Consumer Law.
                  </p>
                  <p className="pt-1">
                    <strong>GST & Legal:</strong> Prices include GST where applicable. This document constitutes a tax invoice 
                    for GST purposes under Australian Taxation Office requirements.
                  </p>
                </div>
              </div>
            </div>

            {/* Professional Compliance Information */}
            <div 
              className="mt-6 border p-6 rounded"
              style={{ 
                borderColor: 'hsl(var(--trade) / 0.2)',
                backgroundColor: 'hsl(var(--trade) / 0.05)' 
              }}
            >
              <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wide">
                Professional Trade Compliance
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-600">
                <div>
                  {businessSettings?.licenseNumber && (
                    <p><strong>Trade License:</strong> {businessSettings.licenseNumber}</p>
                  )}
                  {businessSettings?.regulatorRegistration && (
                    <p><strong>Regulator Registration:</strong> {businessSettings.regulatorRegistration}</p>
                  )}
                  {businessSettings?.insurancePolicyNumber && businessSettings?.insuranceProvider && (
                    <p><strong>Public Liability Insurance:</strong> Policy #{businessSettings.insurancePolicyNumber} ({businessSettings.insuranceProvider})</p>
                  )}
                  {businessSettings?.insuranceAmount && (
                    <p><strong>Insurance Coverage:</strong> {businessSettings.insuranceAmount}</p>
                  )}
                  <p><strong>Work Guarantee:</strong> All tradework guaranteed for {businessSettings?.warrantyPeriod || '12 months'}</p>
                </div>
                <div>
                  <p><strong>Standards Compliance:</strong> All work meets Australian Standards (AS/NZS)</p>
                  <p><strong>OH&S Compliance:</strong> Work Health & Safety Act 2011 compliant</p>
                  <p><strong>Environmental:</strong> Waste disposal meets EPA guidelines</p>
                  <p><strong>Quality Assurance:</strong> Building Code of Australia (BCA) compliance</p>
                  {businessSettings?.gstEnabled && (
                    <p><strong>Tax Registration:</strong> Registered for GST (ABN: {businessSettings.abn})</p>
                  )}
                </div>
              </div>
            </div>

            {/* Legal Compliance Footer */}
            <div className="mt-6 border-2 border-slate-300 p-4 rounded bg-slate-100">
              <h4 className="text-xs font-bold text-slate-800 mb-2 uppercase tracking-wide">
                Australian Trade Compliance Declaration
              </h4>
              <div className="text-xs text-slate-700 space-y-1 leading-relaxed">
                <p>
                  <strong>Consumer Protection:</strong> This invoice and all associated work is covered by the Australian Consumer Law. 
                  Consumer guarantees apply and cannot be excluded. For complaints contact {businessSettings?.email || 'your local consumer affairs office'}.
                </p>
                <p>
                  <strong>Trade Licensing:</strong> All work performed by licensed tradesperson{businessSettings?.licenseNumber ? ` (License: ${businessSettings.licenseNumber})` : ''}. 
                  Work meets all relevant Australian Standards and local building codes.
                </p>
                <p>
                  <strong>Insurance & Liability:</strong> {businessSettings?.insuranceProvider && businessSettings?.insurancePolicyNumber ? 
                    `Fully insured with ${businessSettings.insuranceProvider} (Policy: ${businessSettings.insurancePolicyNumber})` : 
                    'Appropriate public liability insurance held'} 
                  covering all work performed. Minimum {businessSettings?.insuranceAmount || '$2,000,000'} coverage.
                </p>
                <p>
                  <strong>Warranty Declaration:</strong> {businessSettings?.warrantyPeriod || '12 months'} warranty on workmanship. 
                  Materials covered by manufacturer warranty. Defects must be reported within warranty period for remedy.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-8 pt-6 border-t text-center text-sm text-muted-foreground">
              <p>Thank you for your business. We appreciate your prompt payment.</p>
              {businessSettings?.businessName && (
                <p className="mt-2">
                  <strong>{businessSettings.businessName}</strong>
                  {businessSettings.email && ` • ${businessSettings.email}`}
                  {businessSettings.phone && ` • ${businessSettings.phone}`}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
        </div>
      </div>
    </>
  );
}