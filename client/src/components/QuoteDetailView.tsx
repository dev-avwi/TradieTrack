import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Send, FileText, Download } from "lucide-react";
import { useBusinessSettings } from "@/hooks/use-business-settings";
import { useToast } from "@/hooks/use-toast";
import StatusBadge from "./StatusBadge";

interface QuoteDetailViewProps {
  quoteId: string;
  onBack?: () => void;
  onSend?: (id: string) => void;
}

export default function QuoteDetailView({ quoteId, onBack, onSend }: QuoteDetailViewProps) {
  const [isPrinting, setIsPrinting] = useState(false);
  const { data: businessSettings } = useBusinessSettings();
  const { toast } = useToast();

  const brandColor = businessSettings?.brandColor || '#2563eb';

  const { data: quote, isLoading } = useQuery({
    queryKey: ['/api/quotes', quoteId],
    queryFn: async () => {
      const response = await fetch(`/api/quotes/${quoteId}`);
      if (!response.ok) throw new Error('Failed to fetch quote');
      return response.json();
    }
  });

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

  const { data: job } = useQuery({
    queryKey: ['/api/jobs', quote?.jobId],
    queryFn: async () => {
      if (!quote?.jobId) return null;
      const response = await fetch(`/api/jobs/${quote.jobId}`);
      if (!response.ok) throw new Error('Failed to fetch job');
      return response.json();
    },
    enabled: !!quote?.jobId
  });

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
      const response = await fetch(`/api/quotes/${quoteId}/pdf`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }
      
      const blob = await response.blob();
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Quote-${quote.number || quote.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "PDF Downloaded",
        description: "Quote PDF has been downloaded successfully.",
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
              <h1 className="text-xl sm:text-2xl font-bold">Quote Details</h1>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            {quote.status === 'draft' && onSend && (
              <Button onClick={() => onSend(quote.id)} className="w-full sm:w-auto" data-testid={`button-send-${quote.id}`}>
                <Send className="h-4 w-4 mr-2" />
                Send Quote
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

        <div className="print-content">
          <Card className="bg-white shadow-lg border overflow-hidden">
            <div 
              className="p-6 sm:p-8 relative"
              style={{ borderBottom: `3px solid ${brandColor}` }}
            >
              {quote.status === 'accepted' && (
                <div 
                  className="absolute top-20 right-16 px-5 py-2 text-lg font-bold uppercase tracking-wide border-[3px] opacity-80"
                  style={{ 
                    color: '#22c55e',
                    borderColor: '#22c55e',
                    transform: 'rotate(-15deg)'
                  }}
                >
                  ACCEPTED
                </div>
              )}
              
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
                    className="text-2xl sm:text-3xl font-bold mb-2"
                    style={{ color: brandColor }}
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
                    className="text-2xl sm:text-3xl font-bold uppercase tracking-wide"
                    style={{ color: brandColor }}
                  >
                    QUOTE
                  </h2>
                  <p className="text-gray-600 mt-1">{quote.number}</p>
                  <div className="mt-2">
                    <StatusBadge status={quote.status} />
                  </div>
                </div>
              </div>
            </div>

            <CardContent className="p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row gap-8 mb-8">
                <div className="flex-1">
                  <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">Quote For</p>
                  <div className="text-gray-800">
                    <p className="font-semibold">{client?.name || 'Loading...'}</p>
                    {client?.address && <p>{client.address}</p>}
                    {client?.email && <p>{client.email}</p>}
                    {client?.phone && <p>{client.phone}</p>}
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">Quote Details</p>
                  <div className="text-gray-800 space-y-1">
                    <p><strong>Date:</strong> {formatDate(quote.createdAt)}</p>
                    {quote.validUntil && (
                      <p><strong>Valid Until:</strong> {formatDate(quote.validUntil)}</p>
                    )}
                    {quote.acceptedAt && (
                      <p><strong>Accepted:</strong> {formatDate(quote.acceptedAt)}</p>
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

              {(quote.title || quote.description) && (
                <div className="mb-8 p-4 bg-gray-50 rounded-md">
                  <p 
                    className="font-semibold mb-2"
                    style={{ color: brandColor }}
                  >
                    {quote.title || 'Description'}
                  </p>
                  {quote.description && (
                    <p className="text-gray-700">{quote.description}</p>
                  )}
                </div>
              )}

              <div className="mb-6 overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr style={{ backgroundColor: brandColor }}>
                      <th className="px-4 py-3 text-left text-white font-semibold text-xs uppercase tracking-wider" style={{ width: '50%' }}>Description</th>
                      <th className="px-4 py-3 text-right text-white font-semibold text-xs uppercase tracking-wider" style={{ width: '15%' }}>Qty</th>
                      <th className="px-4 py-3 text-right text-white font-semibold text-xs uppercase tracking-wider" style={{ width: '17%' }}>Unit Price</th>
                      <th className="px-4 py-3 text-right text-white font-semibold text-xs uppercase tracking-wider" style={{ width: '18%' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quote.lineItems?.map((item: any, index: number) => (
                      <tr key={index} className="border-b border-gray-200">
                        <td className="px-4 py-3 text-gray-900">{item.description}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{Number(item.quantity).toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(Number(item.unitPrice))}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(Number(item.total))}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4} style={{ borderBottom: `2px solid ${brandColor}` }}></td>
                    </tr>
                  </tfoot>
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
                    style={{ borderTop: `2px solid ${brandColor}` }}
                  >
                    <span 
                      className="text-lg font-bold"
                      style={{ color: brandColor }}
                    >
                      Total{gstAmount > 0 ? ' (incl. GST)' : ''}
                    </span>
                    <span 
                      className="text-lg font-bold"
                      style={{ color: brandColor }}
                    >
                      {formatCurrency(total)}
                    </span>
                  </div>
                </div>
              </div>

              {quote.notes && (
                <div 
                  className="mb-8 p-4 rounded-r-md"
                  style={{ 
                    background: '#fafafa',
                    borderLeft: `4px solid ${brandColor}`
                  }}
                >
                  <h3 className="font-semibold mb-2 text-gray-800">Additional Notes</h3>
                  <p className="text-gray-600 text-sm whitespace-pre-wrap">{quote.notes}</p>
                </div>
              )}

              {businessSettings?.warrantyPeriod && (
                <div 
                  className="mb-8 p-4 rounded-r-md"
                  style={{ 
                    background: '#fafafa',
                    borderLeft: `4px solid ${brandColor}`
                  }}
                >
                  <h3 className="font-semibold mb-2 text-gray-800">Warranty</h3>
                  <p className="text-gray-600 text-sm">
                    All work is guaranteed for {businessSettings.warrantyPeriod} from completion date.
                  </p>
                </div>
              )}

              {quote.status !== 'accepted' && quote.status !== 'declined' && (
                <div className="mb-8 p-5 border-2 border-dashed border-gray-300 rounded-lg">
                  <h3 className="font-semibold mb-4 text-gray-800">Quote Acceptance</h3>
                  <p className="text-sm text-gray-600 mb-5">
                    By signing below, I accept this quote and authorise the work to proceed in accordance with the terms and conditions above.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-8">
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 mb-8">Client Signature</p>
                      <div className="border-b border-gray-800"></div>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 mb-8">Print Name</p>
                      <div className="border-b border-gray-800"></div>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 mb-8">Date</p>
                      <div className="border-b border-gray-800"></div>
                    </div>
                  </div>
                </div>
              )}

              {quote.status === 'accepted' && quote.acceptedBy && (
                <div 
                  className="mb-8 p-4 rounded-lg"
                  style={{ 
                    background: '#dcfce7',
                    borderLeft: `4px solid #22c55e`
                  }}
                >
                  <h3 className="font-semibold mb-2" style={{ color: '#166534' }}>Quote Accepted</h3>
                  <div className="text-sm" style={{ color: '#166534' }}>
                    <p>Accepted by: {quote.acceptedBy}</p>
                    <p>Date: {formatDate(quote.acceptedAt)}</p>
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