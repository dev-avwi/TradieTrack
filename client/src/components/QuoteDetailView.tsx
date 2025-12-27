import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Send, FileText, Download, Share2, Copy, Check, Mail, AlertTriangle } from "lucide-react";
import { useBusinessSettings } from "@/hooks/use-business-settings";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { useIntegrationHealth, isEmailReady } from "@/hooks/use-integration-health";
import StatusBadge from "./StatusBadge";
import EmailComposeModal from "./EmailComposeModal";
import { getTemplateStyles, TemplateId, DEFAULT_TEMPLATE } from "@/lib/document-templates";

interface QuoteDetailViewProps {
  quoteId: string;
  onBack?: () => void;
  onSend?: (id: string) => void;
}

export default function QuoteDetailView({ quoteId, onBack, onSend }: QuoteDetailViewProps) {
  const [isPrinting, setIsPrinting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showEmailCompose, setShowEmailCompose] = useState(false);
  const [, setLocation] = useLocation();
  const { data: businessSettings } = useBusinessSettings();
  const { data: integrationHealth } = useIntegrationHealth();
  const { toast } = useToast();

  const emailConnected = isEmailReady(integrationHealth);
  const brandColor = businessSettings?.brandColor || '#2563eb';
  const templateId = (businessSettings?.documentTemplate as TemplateId) || DEFAULT_TEMPLATE;
  const templateStyles = getTemplateStyles(templateId, brandColor);
  const { template, primaryColor, headingStyle, tableHeaderStyle, getTableRowStyle, getNoteStyle } = templateStyles;

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

  // Feature detection: check if download attribute is supported
  const supportsDownloadAttribute = () => {
    return 'download' in document.createElement('a');
  };

  // Detect iOS Safari specifically (needs special handling for blob downloads)
  const isIOSSafari = () => {
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    const isWebKit = /WebKit/.test(ua);
    const isChrome = /CriOS/.test(ua); // Chrome on iOS
    const isFirefox = /FxiOS/.test(ua); // Firefox on iOS
    return isIOS && isWebKit && !isChrome && !isFirefox;
  };

  const handleSaveAsPDF = async () => {
    setIsPrinting(true);
    
    const pdfUrl = `/api/quotes/${quoteId}/pdf`;
    const filename = `Quote-${quote?.number || quote?.id || quoteId}.pdf`;
    
    // For iOS Safari: open window SYNCHRONOUSLY before any async operations
    // This prevents Safari from blocking it as a popup
    let pdfWindow: Window | null = null;
    if (isIOSSafari()) {
      pdfWindow = window.open('', '_blank');
      if (pdfWindow) {
        pdfWindow.document.write('<html><head><title>Generating PDF...</title></head><body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;"><p>Generating PDF, please wait...</p></body></html>');
      }
    }
    
    try {
      const response = await fetch(pdfUrl, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      if (isIOSSafari() && pdfWindow) {
        // iOS Safari: convert blob to data URL and write to already-open window
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
      } else if (supportsDownloadAttribute()) {
        // Desktop and most modern mobile browsers: use anchor click with download attribute
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => window.URL.revokeObjectURL(url), 5000);
        toast({
          title: "PDF Downloaded",
          description: "Quote PDF has been downloaded successfully.",
        });
      } else {
        // Fallback for browsers without download attribute support
        window.location.href = url;
        toast({
          title: "PDF Ready",
          description: "PDF opened. Use your browser's save option to download.",
        });
        setTimeout(() => window.URL.revokeObjectURL(url), 60000);
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      if (pdfWindow) {
        pdfWindow.close();
      }
      toast({
        title: "Error",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsPrinting(false);
    }
  };

  const handleShare = async () => {
    const publicUrl = quote?.acceptanceToken 
      ? `${window.location.origin}/q/${quote.acceptanceToken}`
      : `${window.location.origin}/quotes/${quoteId}`;
    
    const shareData = {
      title: `Quote ${quote?.number || quoteId}`,
      text: `Quote for ${quote?.title || 'work'} - ${formatCurrency(Number(quote?.total || 0))}`,
      url: publicUrl,
    };

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        toast({
          title: "Shared",
          description: "Quote link shared successfully.",
        });
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          handleCopyLink(publicUrl);
        }
      }
    } else {
      handleCopyLink(publicUrl);
    }
  };

  const handleCopyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({
        title: "Link Copied",
        description: "Quote link copied to clipboard.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to copy link. Please try again.",
        variant: "destructive",
      });
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

  // Generate the public quote URL for email
  const getPublicQuoteUrl = () => {
    return quote?.acceptanceToken 
      ? `${window.location.origin}/q/${quote.acceptanceToken}`
      : undefined;
  };

  // Handler for sending quote email
  const handleSendQuoteEmail = async (customSubject: string, customMessage: string) => {
    if (!quote) return;
    
    const skipEmail = !customSubject && !customMessage;
    
    const response = await fetch(`/api/quotes/${quoteId}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ customSubject, customMessage, skipEmail })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to send quote');
    }
    
    // Invalidate quote cache to refresh status
    queryClient.invalidateQueries({ queryKey: ['/api/quotes', quoteId] });
    
    toast({
      title: skipEmail ? "Quote Ready" : "Quote Sent",
      description: skipEmail 
        ? `Quote ${quote.number} status updated. Send it via Gmail!`
        : `Quote ${quote.number} has been sent to ${client?.name || 'the client'}.`,
    });
    setShowEmailCompose(false);
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
            height: auto !important;
            overflow: visible !important;
          }
          .no-print { display: none !important; }
          body {
            print-color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
            height: auto !important;
            overflow: visible !important;
          }
          html, body {
            height: auto !important;
            overflow: visible !important;
          }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
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
            {/* Primary action - Send Quote via Email with PDF */}
            {(quote.status === 'draft' || quote.status === 'sent') && client?.email && (
              emailConnected ? (
                <Button onClick={() => setShowEmailCompose(true)} className="w-full sm:w-auto" data-testid="button-send-email">
                  <Mail className="h-4 w-4 mr-2" />
                  {quote.status === 'draft' ? 'Send Quote' : 'Resend'}
                </Button>
              ) : (
                <div 
                  className="flex items-center gap-2 p-1.5 px-3 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800"
                  data-testid="warning-email-not-configured"
                >
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <span className="text-xs font-medium text-amber-800 dark:text-amber-400">Email not set up</span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 px-2 text-xs text-amber-900 hover:bg-amber-200 dark:text-amber-300 dark:hover:bg-amber-900"
                    onClick={() => setLocation('/integrations')}
                    data-testid="button-setup-email"
                  >
                    Set Up
                  </Button>
                </div>
              )
            )}
            {/* Legacy onSend prop support */}
            {quote.status === 'draft' && onSend && !client?.email && (
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
            <Button variant="outline" onClick={handleShare} className="w-full sm:w-auto" data-testid="button-share">
              {copied ? <Check className="h-4 w-4 mr-2" /> : <Share2 className="h-4 w-4 mr-2" />}
              {copied ? 'Copied!' : 'Share'}
            </Button>
          </div>
        </div>

        <div className="print-content">
          <Card 
            className="bg-white shadow-lg border overflow-hidden"
            style={{ fontFamily: template.fontFamily, fontSize: template.baseFontSize, fontWeight: template.bodyWeight }}
          >
            <div 
              className="p-6 sm:p-8 relative"
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
                <div 
                  className="mb-8 p-4"
                  style={{ backgroundColor: template.sectionBackground, borderRadius: template.borderRadius }}
                >
                  <p 
                    className="font-semibold mb-2"
                    style={{ color: primaryColor }}
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
                    <tr style={tableHeaderStyle}>
                      <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider" style={{ width: '50%', color: tableHeaderStyle.color }}>Description</th>
                      <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wider" style={{ width: '15%', color: tableHeaderStyle.color }}>Qty</th>
                      <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wider" style={{ width: '17%', color: tableHeaderStyle.color }}>Unit Price</th>
                      <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wider" style={{ width: '18%', color: tableHeaderStyle.color }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quote.lineItems?.map((item: any, index: number) => {
                      const isLast = index === (quote.lineItems?.length || 0) - 1;
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

              {quote.notes && (
                <div 
                  className="mb-8 p-4"
                  style={getNoteStyle()}
                >
                  <h3 className="font-semibold mb-2 text-gray-800">Additional Notes</h3>
                  <p className="text-gray-600 text-sm whitespace-pre-wrap">{quote.notes}</p>
                </div>
              )}

              {businessSettings?.warrantyPeriod && (
                <div 
                  className="mb-8 p-4"
                  style={getNoteStyle()}
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

      {/* Email Compose Modal with PDF attachment */}
      {quote && client && (
        <EmailComposeModal
          isOpen={showEmailCompose}
          onClose={() => setShowEmailCompose(false)}
          type="quote"
          documentId={quoteId}
          clientName={client.name || ''}
          clientEmail={client.email || ''}
          documentNumber={quote.number || quote.id.slice(0, 8)}
          documentTitle={quote.title || 'Quote'}
          total={quote.total || '0'}
          businessName={businessSettings?.businessName}
          publicUrl={getPublicQuoteUrl()}
          onSend={handleSendQuoteEmail}
        />
      )}
    </>
  );
}