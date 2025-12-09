import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Printer, ArrowLeft, Send, FileText, Mail, Phone, User, MapPin, DollarSign, Download } from "lucide-react";
import { useBusinessSettings } from "@/hooks/use-business-settings";
import StatusBadge from "./StatusBadge";

interface QuoteDetailViewProps {
  quoteId: string;
  onBack?: () => void;
  onSend?: (id: string) => void;
}

export default function QuoteDetailView({ quoteId, onBack, onSend }: QuoteDetailViewProps) {
  const [isPrinting, setIsPrinting] = useState(false);
  const { data: businessSettings } = useBusinessSettings();

  // Fetch quote with line items
  const { data: quote, isLoading } = useQuery({
    queryKey: ['/api/quotes', quoteId],
    queryFn: async () => {
      const response = await fetch(`/api/quotes/${quoteId}`);
      if (!response.ok) throw new Error('Failed to fetch quote');
      return response.json();
    }
  });

  // Fetch client details
  const { data: client } = useQuery({
    queryKey: ['/api/clients', quote?.clientId],
    queryFn: async () => {
      if (!quote?.clientId) return null;
      const response = await fetch(`/api/clients/${quote.clientId}`);
      if (!response.ok) throw new Error('Failed to fetch client');
      return response.json();
    },
    enabled: !!quote?.clientId
  });

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
      // Create a new window with just the quote content
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
            <title>Quote - ${quote.title}</title>
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

  if (isLoading || !quote) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading quote details...</p>
        </div>
      </div>
    );
  }

  const subtotal = Number(quote.subtotal || 0);
  const gstAmount = Number(quote.gstAmount || 0);
  const total = Number(quote.total || 0);

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
          .print-quote-title {
            font-size: 28px !important;
            font-weight: bold !important;
            color: #333 !important;
            margin-bottom: 10px !important;
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
              <h1 className="text-2xl font-bold">Quote Details</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {quote.status === 'draft' && onSend && (
              <Button onClick={() => onSend(quote.id)} data-testid={`button-send-${quote.id}`}>
                <Send className="h-4 w-4 mr-2" />
                Send Quote
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

        {/* Printable Content */}
        <div className={`print-content ${isPrinting ? 'print-page' : ''}`}>
          {/* Quote document */}
          <Card className="print-page">
          <CardHeader className="print-header">
            <div className="flex flex-col sm:flex-row sm:justify-between gap-6 w-full">
              {/* Business information */}
              <div className="flex-1 print-business-info">
                <h2 className="text-2xl font-bold text-primary">
                  {businessSettings?.businessName || 'TradieTrack Business'}
                </h2>
                {businessSettings?.abn && (
                  <p className="text-sm text-muted-foreground"><strong>ABN:</strong> {businessSettings.abn}</p>
                )}
                {businessSettings?.email && (
                  <p className="text-sm text-muted-foreground">{businessSettings.email}</p>
                )}
                {businessSettings?.phone && (
                  <p className="text-sm text-muted-foreground">{businessSettings.phone}</p>
                )}
              </div>
              
              {/* Quote information */}
              <div className="space-y-2">
                <div className="print-quote-title text-2xl font-bold">QUOTE</div>
                <div className="space-y-1 text-sm">
                  <p><strong>Quote #:</strong> {quote.number}</p>
                  <p><strong>Date:</strong> {formatDate(quote.createdAt)}</p>
                  {quote.validUntil && <p><strong>Valid Until:</strong> {formatDate(quote.validUntil)}</p>}
                  <div className="flex items-center gap-2">
                    <strong>Status:</strong>
                    <StatusBadge status={quote.status} />
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Client information */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Bill To:</h3>
              <div className="bg-muted/30 p-4 rounded-lg">
                <p className="font-medium">{client?.name || 'Loading...'}</p>
                {client?.email && <p className="text-sm text-muted-foreground">{client.email}</p>}
                {client?.phone && <p className="text-sm text-muted-foreground">{client.phone}</p>}
                {client?.address && <p className="text-sm text-muted-foreground">{client.address}</p>}
              </div>
            </div>

            {/* Quote details */}
            <div>
              <h3 className="text-lg font-semibold mb-2">Quote Details</h3>
              <p className="font-medium">{quote.title}</p>
              {quote.description && (
                <p className="text-sm text-muted-foreground mt-1">{quote.description}</p>
              )}
            </div>

            {/* Line items */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Items</h3>
              <div className="overflow-x-auto">
                <table className="print-table w-full border-collapse border border-border">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="border border-border px-4 py-3 text-left">Description</th>
                      <th className="border border-border px-4 py-3 text-center w-20 sm:w-24">Qty</th>
                      <th className="border border-border px-4 py-3 text-right w-24 sm:w-32">Unit Price</th>
                      <th className="border border-border px-4 py-3 text-right w-24 sm:w-32">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quote.lineItems?.map((item: any, index: number) => (
                      <tr key={index}>
                        <td className="border border-border px-4 py-3 break-words">{item.description}</td>
                        <td className="border border-border px-4 py-3 text-center whitespace-nowrap">
                          {Number(item.quantity).toFixed(2)}
                        </td>
                        <td className="border border-border px-4 py-3 text-right whitespace-nowrap">
                          {formatCurrency(Number(item.unitPrice))}
                        </td>
                        <td className="border border-border px-4 py-3 text-right font-medium whitespace-nowrap">
                          {formatCurrency(Number(item.total))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals */}
            <div className="print-totals">
              <div className="space-y-2 bg-muted/30 p-4 rounded-lg">
                {businessSettings?.gstEnabled ? (
                  <>
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>GST (10%):</span>
                      <span>{formatCurrency(gstAmount)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total Amount:</span>
                      <span>{formatCurrency(total)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total Amount:</span>
                    <span>{formatCurrency(total)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            {quote.notes && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-2">Notes</h3>
                <div className="bg-muted/30 p-4 rounded-lg">
                  <p className="text-sm whitespace-pre-wrap">{quote.notes}</p>
                </div>
              </div>
            )}

            {/* Payment Terms - Important for quotes */}
            {businessSettings?.paymentInstructions && (
              <div className="bg-slate-50 border-2 border-slate-300 p-6 rounded-lg">
                <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <DollarSign className="h-5 w-5" /> Payment Terms
                </h3>
                <div className="bg-white p-4 rounded-md border border-slate-200">
                  <p className="text-sm text-slate-700 whitespace-pre-wrap font-medium leading-relaxed">
                    {businessSettings.paymentInstructions}
                  </p>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="mt-8 pt-6 border-t text-center text-sm text-muted-foreground">
              <p>Thank you for considering our services. We look forward to working with you.</p>
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